import WebSocket from "ws";

export function setupRealtimeVoice(io, deps) {
  const {
    OPENAI_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID,
    SYSTEM_PROMPT, LOCATIONS, tools,
    mkSession, sessions, normalizeText, safeParseJSON,
    applyExtractionToSession, fetchTariffs,
    customerLookup, objectToUrlEncoded, splynx, sendTicketEmail,
    // NEW: address availability deps
    checkAddressAvailability,
  } = deps;

  const realtimeTools = tools.map((t) => ({
    type: "function", name: t.name,
    description: t.description, parameters: t.parameters,
  }));

  io.on("connection", (socket) => {
    console.log(`🔌 Voice client connected: ${socket.id}`);

    const session = mkSession();
    let openaiWs = null;

    // ═══════════════════════════════════════════════════════════
    //  ElevenLabs State — Per-Response Connection Pattern
    // ═══════════════════════════════════════════════════════════
    let elevenLabsWs = null;
    let elevenLabsReady = false;
    let textBuffer = [];

    let assistantTextBuffer = "";
    let pendingFunctionCalls = 0;
    let lastTtsText = "";
    let isResponseActive = false;
    let assistantSpeaking = false;
    let awaitingStructuredInput = false;
    let structuredInputField = null;

    const PCM_SAMPLE_RATE = 16000;

    // Anti-repeat + throttle
    let lastAssistantText = "";
    let lastResponseCreateTime = 0;
    const RESPONSE_CREATE_MIN_GAP_MS = 1500;

    let responseCreateTimeout = null;
    function throttledResponseCreate() {
      if (responseCreateTimeout) return;
      const now = Date.now();
      const gap = now - lastResponseCreateTime;
      const delay = Math.max(0, RESPONSE_CREATE_MIN_GAP_MS - gap);
      if (delay > 0) console.log(`⏳ Throttling response.create by ${delay}ms`);
      responseCreateTimeout = setTimeout(() => {
        responseCreateTimeout = null;
        if (openaiWs?.readyState === WebSocket.OPEN) {
          lastResponseCreateTime = Date.now();
          console.log("📤 Sending response.create to OpenAI");
          openaiWs.send(JSON.stringify({ type: "response.create" }));
        }
      }, delay);
    }

    // Silence timeout
    let silenceTimer = null;
    const SILENCE_TIMEOUT_MS = 25000;

    function startSilenceTimer() {
      clearSilenceTimer();
      if (awaitingStructuredInput) return;
      if (finalMessageLock || session.finalLock) return;
      if (pendingFunctionCalls > 0) return;
      if (assistantSpeaking) return;

      silenceTimer = setTimeout(() => {
        silenceTimer = null;
        if (awaitingStructuredInput) return;
        if (finalMessageLock || session.finalLock) return;
        if (pendingFunctionCalls > 0) return;
        if (assistantSpeaking) return;

        console.log(`⏰ User silent for ${SILENCE_TIMEOUT_MS / 1000}s — nudging AI`);
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "[SILENCE_NUDGE] The user has not responded. Do NOT repeat your last question. Instead, assume a reasonable default for whatever you last asked, confirm it briefly in one sentence, and move to the NEXT step immediately." }],
            },
          }));
          throttledResponseCreate();
        }
      }, SILENCE_TIMEOUT_MS);
    }

    function clearSilenceTimer() {
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
    }

    // Final message lock
    let finalMessageLock = false;
    let finalMessageTimer = null;

    function lockFinalMessage(durationMs = 15000) {
      finalMessageLock = true;
      session.finalLock = true;
      clearSilenceTimer();
      console.log(`🔒 Final message lock ON (${durationMs}ms)`);
      if (finalMessageTimer) clearTimeout(finalMessageTimer);
      finalMessageTimer = setTimeout(() => {
        finalMessageLock = false;
        session.finalLock = false;
        console.log("🔓 Final message lock auto-released");
        socket.emit("status", "listening");
      }, durationMs);
    }

    function unlockFinalMessage() {
      finalMessageLock = false;
      session.finalLock = false;
      if (finalMessageTimer) { clearTimeout(finalMessageTimer); finalMessageTimer = null; }
      console.log("🔓 Final message lock released");
    }

    // Structured Input Detection
    let lastStructuredInputField = null;
    let lastStructuredInputTime = 0;
    const STRUCTURED_INPUT_COOLDOWN_MS = 30000;

    function detectStructuredInputRequest(text) {
      if (!text) return null;
      const collected = session.collected || {};
      const now = Date.now();

      const DET = `(?:(?:your|the|an?|me)\\s+){0,2}`;
      const DETF = `(?:(?:your|the|an?|me)\\s+){0,2}(?:full\\s+)?`;

      const emailPatterns = [
        new RegExp(`(?:provide|share|enter|type|give)\\s+${DET}email`, "i"),
        /what(?:'?s|\s+is)\s+your\s+email/i,
        new RegExp(`could you\\s+(?:please\\s+)?(?:provide|share|give|send|type)\\s+${DET}email`, "i"),
        new RegExp(`(?:please|kindly)\\s+(?:provide|share|enter|type)\\s+${DET}email`, "i"),
        /(?:need|like)\s+your\s+email/i,
        /email\s+(?:address\s+)?(?:please|to\s+proceed)/i,
      ];

      const phonePatterns = [
        new RegExp(`(?:provide|share|enter|type|give)\\s+${DET}(?:phone|mobile|contact)`, "i"),
        /what(?:'?s|\s+is)\s+your\s+(?:phone|mobile|contact)/i,
        new RegExp(`could you\\s+(?:please\\s+)?(?:provide|share|give)\\s+${DET}(?:phone|mobile|contact)`, "i"),
        new RegExp(`(?:please|kindly)\\s+(?:provide|share|enter)\\s+${DET}(?:phone|mobile|contact)`, "i"),
        /(?:need|like)\s+your\s+(?:phone|mobile|contact)/i,
      ];

      const addressPatterns = [
        new RegExp(`(?:provide|share|enter|type|give)\\s+${DETF}address`, "i"),
        /what(?:'?s|\s+is)\s+(?:your|the)\s+(?:full\s+)?address/i,
        new RegExp(`could you\\s+(?:please\\s+)?(?:provide|share|give|type|enter)\\s+${DETF}address`, "i"),
        new RegExp(`(?:please|kindly)\\s+(?:provide|share|enter|type)\\s+${DETF}address`, "i"),
        /(?:need|like)\s+(?:your|the)\s+(?:full\s+)?address/i,
        /where\s+(?:do\s+you\s+)?need\s+the\s+connection/i,
      ];

      if (!collected.email) {
        for (const p of emailPatterns) {
          if (p.test(text)) {
            if (lastStructuredInputField === "email" && (now - lastStructuredInputTime) < STRUCTURED_INPUT_COOLDOWN_MS) return null;
            lastStructuredInputField = "email";
            lastStructuredInputTime = now;
            return "email";
          }
        }
      }

      if (!collected.phone) {
        for (const p of phonePatterns) {
          if (p.test(text)) {
            if (lastStructuredInputField === "phone" && (now - lastStructuredInputTime) < STRUCTURED_INPUT_COOLDOWN_MS) return null;
            lastStructuredInputField = "phone";
            lastStructuredInputTime = now;
            return "phone";
          }
        }
      }

      if (!collected.address) {
        for (const p of addressPatterns) {
          if (p.test(text)) {
            if (/(?:at|for|to)\s+(?:your\s+)?address/i.test(text) && !/(?:provide|enter|type|share|give)\s+/.test(text.toLowerCase())) return null;
            if (lastStructuredInputField === "address" && (now - lastStructuredInputTime) < STRUCTURED_INPUT_COOLDOWN_MS) return null;
            lastStructuredInputField = "address";
            lastStructuredInputTime = now;
            return "address";
          }
        }
      }

      return null;
    }

    // ═══════════════ Ordinal Network Choice Mapping ═══════════════
    // When AI asks "First option NBN, second OptiComm", user may say
    // "2", "second", "two", "the second one", "option 2", etc.
    function mapOrdinalNetworkChoice(text) {
      const t = (text || "").toLowerCase().trim();
      // If they explicitly said NBN or OptiComm, no mapping needed
      if (/\bnbn\b/.test(t) || /\b(opti\s*comm|opticomm)\b/.test(t)) return null;
      // Map ordinals/numbers to network
      if (/\b(first|1st|one|1|option\s*1|option\s*one|number\s*1|the\s*first)\b/.test(t)) return "NBN";
      if (/\b(second|2nd|two|2|option\s*2|option\s*two|number\s*2|the\s*second|to)\b/.test(t)) return "Opticomm";
      return null;
    }

    // Check if the AI just asked the network preference question
    function wasLastMessageNetworkQuestion() {
      const msgs = session.messages || [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          const t = (msgs[i].content || "").toLowerCase();
          return (
            (t.includes("nbn") && t.includes("opticomm")) ||
            (t.includes("first option") && t.includes("second option")) ||
            t.includes("nbn or opticomm") ||
            t.includes("which one would you prefer")
          );
        }
        if (msgs[i].role === "user") break; // stop at previous user msg
      }
      return false;
    }

    function detectBadTranscription(text) {
      if (!text) return null;
      const lower = text.toLowerCase();
      const emailVoicePatterns = /\b(at\s+(gmail|yahoo|hotmail|outlook|icloud)|dot\s+(com|net|org|au|co)|at\s+\w+\s+dot)\b/i;
      if (emailVoicePatterns.test(lower)) return "email";
      const spelledDigits = lower.replace(/[^a-z0-9\s]/g, "");
      const digitWords = (spelledDigits.match(/\b(zero|one|two|three|four|five|six|seven|eight|nine|oh)\b/g) || []);
      if (digitWords.length >= 6) return "phone";
      return null;
    }

    // ═══════════════════════════════════════════════════════════
    //  ElevenLabs Connection Management
    // ═══════════════════════════════════════════════════════════
    function openElevenLabsStream(force = false) {
      if (
        !force &&
        elevenLabsWs &&
        (elevenLabsWs.readyState === WebSocket.OPEN ||
          elevenLabsWs.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      closeElevenLabsWs();

      const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_flash_v2_5&output_format=pcm_16000`;
      const elWs = new WebSocket(wsUrl);

      elWs.on("open", () => {
        console.log(`✅ [EL] ElevenLabs WebSocket connected`);
        elWs.send(JSON.stringify({
          text: " ",
          voice_settings: { stability: 0.4, similarity_boost: 0.75, speed: 1.15 },
          xi_api_key: ELEVENLABS_API_KEY,
        }));

        if (elevenLabsWs === elWs) {
          elevenLabsReady = true;
          for (const text of textBuffer) {
            sendTextToElevenLabs(text);
          }
          textBuffer = [];
        }
      });

      elWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio) {
            socket.emit("audio_chunk_pcm", { sampleRate: PCM_SAMPLE_RATE, audio: msg.audio });
          }
          const isFinal = msg.isFinal === true || msg.is_final === true || msg.final === true;
          if (isFinal) {
            socket.emit("audio_done");
            assistantSpeaking = false;
            if (!pendingFunctionCalls && !awaitingStructuredInput && !finalMessageLock && !session.finalLock) {
              startSilenceTimer();
            }
          }
        } catch (err) { }
      });

      elWs.on("error", (err) => {
        console.warn(`⚠️ [EL] ElevenLabs WS error: ${err.message}`);
      });

      elWs.on("close", () => {
        if (elevenLabsWs === elWs) {
          elevenLabsReady = false;
        }
      });

      elevenLabsWs = elWs;
    }

    function sendTextToElevenLabs(text) {
      if (elevenLabsWs?.readyState === WebSocket.OPEN) {
        elevenLabsWs.send(JSON.stringify({ text, try_trigger_generation: true }));
      }
    }

    function flushElevenLabsStream() {
      if (elevenLabsWs?.readyState === WebSocket.OPEN) {
        elevenLabsWs.send(JSON.stringify({ text: "" }));
      }
    }

    function closeElevenLabsWs() {
      if (elevenLabsWs) {
        try {
          if (elevenLabsWs.readyState === WebSocket.CONNECTING) {
            elevenLabsWs.terminate();
          } else if (elevenLabsWs.readyState === WebSocket.OPEN) {
            elevenLabsWs.close();
          }
        } catch (err) {
          console.warn(`⚠️ [EL] Error closing ElevenLabs WS: ${err.message}`);
        }
        elevenLabsWs = null;
        elevenLabsReady = false;
        textBuffer = [];
      }
    }

    // ═══════════════ OpenAI Realtime API ═══════════════
    function connectOpenAI() {
      return new Promise((resolve, reject) => {
        openaiWs = new WebSocket(
          "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview",
          { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "OpenAI-Beta": "realtime=v1" } }
        );

        openaiWs.on("open", () => {
          console.log("✅ [WS-1] OpenAI Realtime connected");
          const instructions = SYSTEM_PROMPT + "\n\nCRITICAL: You MUST ALWAYS respond in English only. Never respond in any other language.";

          openaiWs.send(JSON.stringify({
            type: "session.update",
            session: {
              instructions,
              modalities: ["text"],
              input_audio_format: "pcm16",
              turn_detection: {
                type: "server_vad",
                threshold: 0.8,
                prefix_padding_ms: 300,
                silence_duration_ms: 2000,
              },
              tools: realtimeTools,
              tool_choice: "auto",
              input_audio_transcription: { model: "whisper-1" },
            },
          }));

          openElevenLabsStream();
        });

        openaiWs.on("message", (raw) => {
          try {
            const data = JSON.parse(raw.toString());
            if (resolve) { resolve(); resolve = null; }
            handleOpenAIEvent(data);
          }
          catch (e) { console.error("[WS-1] parse error:", e.message); }
        });

        openaiWs.on("error", (err) => { console.error("[WS-1] error:", err.message); reject(err); });
        openaiWs.on("close", (code) => {
          console.log(`[WS-1] closed (${code})`);
          closeElevenLabsWs();
        });
      });
    }

    // ═══════════════ OpenAI Event Handler ═══════════════
    let lastEventLog = "";
    function handleOpenAIEvent(event) {
      if (event.type !== lastEventLog) {
        console.log(`📡 [WS-1] Event: ${event.type}`);
        lastEventLog = event.type;
      }

      switch (event.type) {
        case "session.created": break;
        case "session.updated":
          console.log("✅ [WS-1] Session configured");
          break;

        case "input_audio_buffer.speech_started":
          if (awaitingStructuredInput || pendingFunctionCalls > 0 || session.finalLock || finalMessageLock) {
            console.log(`🔇 Speech ignored (locked)`);
            if (openaiWs?.readyState === WebSocket.OPEN) {
              openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
            }
            break;
          }

          console.log(`🎙️ USER INTERRUPTED -> Stopping AI Voice`);
          socket.emit("status", "user_speaking");
          socket.emit("interrupt");
          socket.emit("audio_interrupt");

          clearSilenceTimer();

          if (isResponseActive) {
            openaiWs.send(JSON.stringify({ type: "response.cancel" }));
          }

          closeElevenLabsWs();
          openElevenLabsStream(true);

          assistantTextBuffer = "";
          lastTtsText = "";
          assistantSpeaking = false;
          break;

        case "input_audio_buffer.speech_stopped":
          socket.emit("status", "processing");
          break;

        case "conversation.item.input_audio_transcription.completed":
          if (event.transcript) {
            const cleaned = normalizeText(event.transcript);
            if (cleaned) {
              const looksLikeEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(cleaned);
              const digitCount = (cleaned.match(/\d/g) || []).length;
              const looksLikePhone = digitCount >= 6;

              if (assistantSpeaking && !(looksLikeEmail || looksLikePhone)) {
                console.log(`🔇 Ignoring transcript during assistant speech`);
                break;
              }

              if (!awaitingStructuredInput) {
                const badTranscript = detectBadTranscription(cleaned);
                if (badTranscript) {
                  awaitingStructuredInput = true;
                  structuredInputField = badTranscript;
                  const placeholder = badTranscript === "email" ? "Enter your email address" : "Enter your phone number";
                  socket.emit("request_structured_input", { field: badTranscript, prompt: placeholder });
                  break;
                }
              }

              console.log(`👤 User: "${cleaned}"`);
              socket.emit("user_transcript", cleaned);

              // ── Ordinal network choice mapping ──
              // If AI just asked "First option NBN, second OptiComm" and user says "2"/"second"/"two",
              // inject a clarified message so OpenAI clearly understands the choice
              const mappedNetwork = mapOrdinalNetworkChoice(cleaned);
              if (mappedNetwork && wasLastMessageNetworkQuestion()) {
                const clarified = `I want ${mappedNetwork}`;
                console.log(`🔄 Ordinal mapped: "${cleaned}" → "${clarified}" (network: ${mappedNetwork})`);
                session.collected.networkPreference = mappedNetwork;
                session.messages.push({ role: "user", content: clarified });
                sessions.set(session.id, session);

                // Inject clarified text into OpenAI Realtime conversation
                if (openaiWs?.readyState === WebSocket.OPEN) {
                  openaiWs.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "message",
                      role: "user",
                      content: [{ type: "input_text", text: clarified }],
                    },
                  }));
                  throttledResponseCreate();
                }
                clearSilenceTimer();
                break; // Skip normal processing — we injected the clarified version
              }

              session.messages.push({ role: "user", content: cleaned });
              sessions.set(session.id, session);
              clearSilenceTimer();
            }
          }
          break;

        case "response.created":
          isResponseActive = true;
          openElevenLabsStream();
          assistantSpeaking = true;
          socket.emit("status", "speaking");
          break;

        case "response.text.delta":
          if (event.delta) {
            assistantTextBuffer += event.delta;
            socket.emit("assistant_text_delta", event.delta);
            if (elevenLabsReady) {
              sendTextToElevenLabs(event.delta);
            } else {
              textBuffer.push(event.delta);
            }
          }
          break;

        case "response.text.done":
          if (event.text) {
            const newTextNorm = event.text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
            const lastTextNorm = lastAssistantText.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
            const isDuplicate = newTextNorm.length > 20 && lastTextNorm.length > 20 &&
              (newTextNorm === lastTextNorm || newTextNorm.includes(lastTextNorm) || lastTextNorm.includes(newTextNorm));

            if (isDuplicate) {
              console.log(`🔁 DUPLICATE response detected — skipping`);
              assistantTextBuffer = "";
              break;
            }

            lastAssistantText = event.text;
            console.log(`🤖 AI: "${event.text.substring(0, 100)}..."`);
            session.messages.push({ role: "assistant", content: event.text });
            sessions.set(session.id, session);
            socket.emit("assistant_text_done", event.text);

            flushElevenLabsStream();

            const detectedField = detectStructuredInputRequest(event.text);
            if (detectedField) {
              awaitingStructuredInput = true;
              structuredInputField = detectedField;

              let placeholder;
              if (detectedField === "email") placeholder = "Enter your email address";
              else if (detectedField === "phone") placeholder = "Enter your phone number";
              else if (detectedField === "address") placeholder = "Enter your full address (e.g. 9 George St, North Strathfield NSW 2137)";

              console.log(`📋 Structured input requested: ${detectedField}`);
              clearSilenceTimer();

              if (openaiWs?.readyState === WebSocket.OPEN) {
                openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
              }

              socket.emit("request_structured_input", { field: detectedField, prompt: placeholder });
            }
          }
          break;

        case "response.done":
          isResponseActive = false;

          if (assistantTextBuffer.trim()) {
            const t = assistantTextBuffer.toLowerCase();
            const confirms = ["raised", "ticket details", "details via email", "agent will contact", "raised a ticket", "raised sales inquiry"];
            const isConfirmation = confirms.some(c => t.includes(c));
            if (isConfirmation) {
              console.log("🔒 Final confirmation detected.");
              setTimeout(() => {
                if (finalMessageLock) {
                  unlockFinalMessage();
                  socket.emit("status", "listening");
                }
              }, 12000);
            }
          }

          if (!pendingFunctionCalls) {
            socket.emit("status", "listening");
          }
          assistantTextBuffer = "";
          break;

        case "response.output_item.added":
          if (event.item?.type === "function_call") {
            const fnName = event.item.name || event.item.function_call?.name;
            if (fnName === "create_ticket") {
              lockFinalMessage(15000);
              if (openaiWs?.readyState === WebSocket.OPEN) {
                openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
              }
            }
          }
          break;

        case "response.output_item.done":
          if (event.item?.type === "function_call") {
            pendingFunctionCalls++;
            handleFunctionCall(event.item);
          }
          break;

        case "error":
          console.error("[WS-1] OpenAI error:", JSON.stringify(event.error));
          socket.emit("error_msg", event.error?.message || "AI error");
          break;
      }
    }

    // ═══════════════ Tool Execution ═══════════════
    async function handleFunctionCall(item) {
      const { call_id, name: fn, arguments: argsStr } = item;
      const args = safeParseJSON(argsStr) || {};
      console.log(`🔧 Tool: ${fn}`, JSON.stringify(args).substring(0, 200));

      let result;
      socket.emit("status", "processing");
      clearSilenceTimer();
      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
      }
      try { result = await execTool(fn, args); }
      catch (err) { result = JSON.stringify({ success: false, error: err.message }); }

      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id, output: result }
        }));
      }

      pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
      if (pendingFunctionCalls === 0) {
        socket.emit("status", "processing");
        setTimeout(() => { throttledResponseCreate(); }, 100);
      }
    }

    async function execTool(fn, args) {
      if (fn === "extract_call_fields") {
        applyExtractionToSession(session, args);
        return JSON.stringify({ success: true });
      }

      if (fn === "customer_lookup") {
        return JSON.stringify(await customerLookup(args));
      }

      if (fn === "get_internet_plans") {
        try {
          const tariffs = await fetchTariffs();
          return JSON.stringify({
            success: true,
            plans: tariffs.map((t) => ({
              id: t.id, title: t.title, price: parseFloat(t.price),
              download: `${t.speed_download / 1000} Mbps`,
              upload: `${t.speed_upload / 1000} Mbps`,
              available_for_locations: t.available_for_locations || [],
            })),
          });
        } catch (err) {
          return JSON.stringify({ success: false, error: err.message });
        }
      }

      // ==================== CHECK ADDRESS AVAILABILITY ====================
      if (fn === "check_address_availability") {
        try {
          return await checkAddressAvailability(args, session);
        } catch (err) {
          console.error("check_address_availability error in realtime:", err.message);
          return JSON.stringify({ success: false, error: err.message, address: args.address });
        }
      }

      if (fn === "create_ticket") {
        let fa = { ...args };
        if (typeof fa.message === "string") fa.message = { message: fa.message };

        const collected = session.collected || {};
        const hasCustomerId = !!(fa.customer_id || collected.customer_id);
        const isSupportTicket = hasCustomerId;

        try {
          if (isSupportTicket) {
            console.log(`📝 Creating SUPPORT ticket in Splynx: subject="${fa.subject}" customer_id=${fa.customer_id}`);
            const r = await splynx.request("POST", "admin/support/tickets", objectToUrlEncoded(fa));
            console.log(`✅ Splynx ticket created: ID=${r.id}`);
            const emailResult = await sendTicketEmail(r.id, fa, collected, true);
            return JSON.stringify({ success: true, ticket_id: r.id, email_sent: emailResult.sent, email_error: emailResult.reason || null });
          } else {
            console.log(`📧 SALES inquiry — sending email only (no Splynx ticket): subject="${fa.subject}"`);
            const emailResult = await sendTicketEmail(null, fa, collected, false);
            return JSON.stringify({ success: true, message: "Sales inquiry submitted successfully", email_sent: emailResult.sent, email_error: emailResult.reason || null });
          }
        } catch (err) {
          console.error("❌ Create ticket/email failed:", err.message || err);
          return JSON.stringify({ success: false, error: err.message || "Failed to process request" });
        }
      }

      if (fn === "get_ticket_types") return JSON.stringify({ success: true, types: await splynx.request("GET", "admin/support/tickets-types") });
      if (fn === "get_ticket_groups") return JSON.stringify({ success: true, groups: await splynx.request("GET", "admin/support/tickets-groups") });
      if (fn === "get_ticket_statuses") return JSON.stringify({ success: true, statuses: await splynx.request("GET", "admin/support/tickets-statuses") });
      return JSON.stringify({ error: `Unknown tool: ${fn}` });
    }

    // ═══════════════ Client Audio → OpenAI ═══════════════
    let lastAudioLog = 0;
    socket.on("audio_chunk", (b64) => {
      const shouldSuppress = awaitingStructuredInput ||
        pendingFunctionCalls > 0 ||
        session.finalLock ||
        finalMessageLock;

      if (shouldSuppress) return;

      const now = Date.now();
      if (now - lastAudioLog > 2000) {
        const state = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][openaiWs?.readyState] || "UNKNOWN";
        console.log(`🎤 [${socket.id}] [OpenAI: ${state}]`);
        lastAudioLog = now;
      }
      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
      }
    });

    // ═══════════════ Structured Input ═══════════════
    socket.on("structured_input", (payload) => {
      if (!payload || !payload.field || !payload.value) return;
      const { field, value } = payload;
      console.log(`📋 Structured input received: ${field} = "${value}"`);

      clearSilenceTimer();
      awaitingStructuredInput = false;
      structuredInputField = null;

      if (field === "email") session.collected.email = value;
      else if (field === "phone") session.collected.phone = value;
      else if (field === "address") session.collected.address = value;
      sessions.set(session.id, session);

      let userMessage;
      if (field === "email") userMessage = `My email is ${value}`;
      else if (field === "phone") userMessage = `My phone number is ${value}`;
      else if (field === "address") userMessage = `My address is ${value}`;

      session.messages.push({ role: "user", content: userMessage });
      sessions.set(session.id, session);

      socket.emit("user_transcript", userMessage);

      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: userMessage }],
          },
        }));
        throttledResponseCreate();
      }

      socket.emit("structured_input_accepted", { field, value });
      socket.emit("status", "listening");
    });

    // ═══════════════ Cleanup ═══════════════
    socket.on("disconnect", () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
      clearSilenceTimer();
      if (finalMessageTimer) { clearTimeout(finalMessageTimer); finalMessageTimer = null; }
      if (responseCreateTimeout) { clearTimeout(responseCreateTimeout); responseCreateTimeout = null; }
      closeElevenLabsWs();
      if (openaiWs) try { openaiWs.close(); } catch (_) { }
      sessions.delete(session.id);
    });

    // ═══════════════ Boot ═══════════════
    (async () => {
      try {
        console.log("⏳ Connecting OpenAI Realtime...");
        await connectOpenAI();
        console.log("✅ OpenAI connected! ElevenLabs pre-warmed. Waiting 2s...");
        socket.emit("connections_ready");
        await new Promise(r => setTimeout(r, 2000));

        if (!session.hasGreeted) {
          session.hasGreeted = true;
          console.log("🗣️ Triggering natural AI greeting...");
          if (openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({ type: "response.create" }));
          }
          sessions.set(session.id, session);
        } else {
          socket.emit("status", "listening");
        }
      } catch (err) {
        console.error("❌ Connection failed:", err.message);
        socket.emit("error_msg", "Failed to connect to AI services");
      }
    })();
  });
}