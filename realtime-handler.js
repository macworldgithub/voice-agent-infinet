import WebSocket from "ws";
import axios from "axios";

// ═══════════════════════════════════════════════════════════
//  SCRAPER API CONFIG — Change this if your scraper runs elsewhere
// ═══════════════════════════════════════════════════════════
const SCRAPER_API_URL = process.env.SCRAPER_API_URL || "http://localhost:5050";

export function setupRealtimeVoice(io, deps) {
  const {
    OPENAI_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID,
    SYSTEM_PROMPT, LOCATIONS, tools,
    mkSession, sessions, normalizeText, safeParseJSON,
    applyExtractionToSession, fetchTariffs, determineLocationId,
    customerLookup, objectToUrlEncoded, splynx, sendTicketEmail,
  } = deps;

  const realtimeTools = tools.map((t) => ({
    type: "function", name: t.name,
    description: t.description, parameters: t.parameters,
  }));

  io.on("connection", (socket) => {
    console.log(`🔌 Voice client connected: ${socket.id}`);

    const session = mkSession();
    let openaiWs = null;
    let elevenLabsWs = null;
    let assistantTextBuffer = "";
    let pendingFunctionCalls = 0;
    let ttsChunks = [];
    let keepAliveTimer = null;
    let lastTtsText = "";
    let ttsTimeout = null;
    let ttsInFlight = false;
    let ttsTextOutBuffer = "";
    let ttsSendTimer = null;
    let ttsStartedForResponse = false;
    let elevenLabsReady = false;
    const PCM_SAMPLE_RATE = 16000;
    let assistantSpeaking = false;
    let awaitingStructuredInput = false;
    let structuredInputField = null;

    // ═══════════════════════════════════════════════════════════
    //  [CHANGED] Enhanced interrupt protection for final messages
    // ═══════════════════════════════════════════════════════════
    let finalMessageLock = false;   // Prevents ANY interruption during final confirmation
    let finalMessageTimer = null;   // Auto-unlock after timeout

    function lockFinalMessage(durationMs = 15000) {
      finalMessageLock = true;
      session.finalLock = true;
      console.log(`🔒 Final message lock ON (${durationMs}ms)`);
      // Clear any existing timer
      if (finalMessageTimer) clearTimeout(finalMessageTimer);
      // Auto-unlock after duration as safety net
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
      if (finalMessageTimer) {
        clearTimeout(finalMessageTimer);
        finalMessageTimer = null;
      }
      console.log("🔓 Final message lock released");
    }

    // ═══════════════════════════════════════════════════════════
    //  [CHANGED] Structured Input Detection — added "address"
    // ═══════════════════════════════════════════════════════════
    function detectStructuredInputRequest(text) {
      if (!text) return null;

      // Email patterns
      const emailPatterns = [
        /\b(your|the|an?)\s+email/i,
        /email\s+address/i,
        /provide.*email/i,
        /share.*email/i,
        /enter.*email/i,
        /what('?s|\s+is)\s+your\s+email/i,
        /could you.*email/i,
        /please.*email/i,
        /confirm.*email/i,
      ];

      // Phone patterns
      const phonePatterns = [
        /\b(your|the|a)\s+(phone|mobile|contact)\s*(number)?/i,
        /phone\s+number/i,
        /contact\s+number/i,
        /mobile\s+number/i,
        /provide.*phone/i,
        /share.*phone/i,
        /what('?s|\s+is)\s+your\s+(phone|mobile|contact)/i,
        /could you.*phone/i,
        /please.*(phone|mobile|contact)/i,
        /confirm.*(phone|mobile|contact)/i,
      ];

      // [NEW] Address patterns
      const addressPatterns = [
        /\b(your|the|full)\s+address/i,
        /provide.*address/i,
        /share.*address/i,
        /enter.*address/i,
        /what('?s|\s+is)\s+your\s+address/i,
        /could you.*address/i,
        /please.*address/i,
        /type.*address/i,
        /where.*need.*connection/i,
        /address.*where.*connection/i,
        /connection\s+address/i,
        /new\s+address/i,
      ];

      for (const p of emailPatterns) {
        if (p.test(text)) return "email";
      }
      for (const p of phonePatterns) {
        if (p.test(text)) return "phone";
      }
      for (const p of addressPatterns) {
        if (p.test(text)) return "address";
      }
      return null;
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

    async function speakViaElevenLabsRest(text) {
      if (!text?.trim()) return;
      try {
        assistantSpeaking = true;
        const resp = await axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=pcm_16000`,
          {
            text: text.trim(),
            model_id: "eleven_turbo_v2_5",
            voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.0, use_speaker_boost: true },
          },
          {
            headers: {
              Accept: "application/octet-stream",
              "xi-api-key": ELEVENLABS_API_KEY,
              "Content-Type": "application/json",
            },
            responseType: "arraybuffer",
            timeout: 20000,
          }
        );
        const buf = Buffer.from(resp.data);
        socket.emit("audio_chunk_pcm", { sampleRate: PCM_SAMPLE_RATE, audio: buf.toString("base64") });
        socket.emit("audio_done");
        assistantSpeaking = false;
        console.log(`🔊 [REST] Sent audio (${buf.length} bytes)`);
      } catch (err) {
        assistantSpeaking = false;
        console.error("[REST] ElevenLabs TTS failed:", err?.response?.status, err?.message);
        socket.emit("error_msg", "ElevenLabs REST TTS failed.");
      }
    }

    // ═══════════════ WEBSOCKET 1: OpenAI Realtime API ═══════════════
    function connectOpenAI() {
      return new Promise((resolve, reject) => {
        openaiWs = new WebSocket(
          "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
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
              turn_detection: { type: "server_vad", threshold: 0.8, silence_duration_ms: 500, prefix_padding_ms: 300 },
              tools: realtimeTools,
              tool_choice: "auto",
              input_audio_transcription: { model: "whisper-1" },
            },
          }));
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
        openaiWs.on("close", (code) => { console.log(`[WS-1] closed (${code})`); });
      });
    }

    // ═══════════════ WEBSOCKET 2: ElevenLabs TTS ═══════════════
    function connectElevenLabs() {
      return new Promise((resolve, reject) => {
        const url = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_flash_v2_5&output_format=pcm_16000`;
        elevenLabsWs = new WebSocket(url, {
          headers: { "xi-api-key": ELEVENLABS_API_KEY },
        });

        elevenLabsWs.on("open", () => {
          console.log("✅ [WS-2] ElevenLabs connected");
          elevenLabsWs.send(JSON.stringify({
            text: " ",
            voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.0, use_speaker_boost: true },
            generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
            xi_api_key: ELEVENLABS_API_KEY,
          }));
          elevenLabsReady = true;
          if (ttsTextOutBuffer && !ttsSendTimer) {
            ttsSendTimer = setTimeout(() => { ttsSendTimer = null; sendTtsChunkNow({ flush: false }); }, 0);
          }
          keepAliveTimer = setInterval(() => {
            if (elevenLabsWs?.readyState === WebSocket.OPEN) {
              elevenLabsWs.send(JSON.stringify({ text: " " }));
            }
          }, 10000);
          resolve();
        });

        elevenLabsWs.on("message", (raw) => {
          try {
            const rawText = raw?.toString?.() ?? "";
            if (!rawText) return;
            let msg;
            try { msg = JSON.parse(rawText); } catch (_) { return; }

            if (msg?.error) {
              console.error("[WS-2] ElevenLabs error:", msg.error?.message || msg.error);
              socket.emit("error_msg", `ElevenLabs TTS error: ${msg.error?.message || msg.error}`);
            }

            if (msg.audio) {
              if (!ttsInFlight && !ttsStartedForResponse && ttsChunks.length === 0) return;
              ttsChunks.push(Buffer.from(msg.audio, "base64"));
              socket.emit("audio_chunk_pcm", { sampleRate: PCM_SAMPLE_RATE, audio: msg.audio });
            }

            const isFinal = msg.isFinal === true || msg.is_final === true || msg.final === true;
            if (isFinal) {
              if (ttsChunks.length > 0) {
                const fullBuffer = Buffer.concat(ttsChunks);
                socket.emit("audio_complete", fullBuffer.toString("base64"));
                console.log(`🔊 [WS-2] Sent ${ttsChunks.length} chunks (${fullBuffer.length} bytes)`);
                ttsChunks = [];
                ttsInFlight = false;
                ttsStartedForResponse = false;
                if (ttsTimeout) { clearTimeout(ttsTimeout); ttsTimeout = null; }
              } else {
                ttsInFlight = false;
                ttsStartedForResponse = false;
                if (ttsTimeout) { clearTimeout(ttsTimeout); ttsTimeout = null; }
                speakViaElevenLabsRest(lastTtsText);
              }
              socket.emit("audio_done");
              assistantSpeaking = false;
            }
          } catch (e) { console.error("[WS-2] parse error:", e.message); }
        });

        elevenLabsWs.on("error", (err) => { console.error("[WS-2] error:", err.message); reject(err); });
        elevenLabsWs.on("close", (code) => {
          console.log(`[WS-2] ElevenLabs closed (${code})`);
          clearInterval(keepAliveTimer);
          elevenLabsWs = null;
          elevenLabsReady = false;
        });
      });
    }

    function speakViaElevenLabs(text) {
      if (!text?.trim() || !elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) {
        speakViaElevenLabsRest(text);
        return;
      }
      ttsChunks = [];
      lastTtsText = text;
      ttsInFlight = true;
      if (ttsTimeout) clearTimeout(ttsTimeout);
      ttsTimeout = setTimeout(() => {
        if (!ttsInFlight) return;
        console.warn("[WS-2] TTS timeout — falling back to REST");
        ttsInFlight = false;
        speakViaElevenLabsRest(lastTtsText);
      }, 7000);
      socket.emit("status", "speaking");
      assistantSpeaking = true;
      elevenLabsWs.send(JSON.stringify({ text: text, try_trigger_generation: true }));
      elevenLabsWs.send(JSON.stringify({ text: "", flush: true }));
    }

    function clearTtsStreamingState() {
      ttsTextOutBuffer = "";
      ttsStartedForResponse = false;
      if (ttsSendTimer) { clearTimeout(ttsSendTimer); ttsSendTimer = null; }
    }

    function sendTtsChunkNow({ flush } = { flush: false }) {
      if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN || !elevenLabsReady) return;
      const chunk = ttsTextOutBuffer;
      if (!chunk && !flush) return;

      if (!ttsStartedForResponse) {
        ttsChunks = [];
        socket.emit("status", "speaking");
        ttsStartedForResponse = true;
        assistantSpeaking = true;
      }

      if (chunk) {
        lastTtsText += chunk;
        elevenLabsWs.send(JSON.stringify({ text: chunk, try_trigger_generation: true }));
        ttsTextOutBuffer = "";
      }
      if (flush) {
        elevenLabsWs.send(JSON.stringify({ text: "", flush: true }));
      }
    }

    function queueTtsDelta(delta) {
      if (!delta) return;
      ttsTextOutBuffer += delta;
      if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN || !elevenLabsReady) return;
      if (ttsSendTimer) return;
      ttsSendTimer = setTimeout(() => { ttsSendTimer = null; sendTtsChunkNow({ flush: false }); }, 120);
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
          // [CHANGED] Block interrupts during final message
          if (awaitingStructuredInput || pendingFunctionCalls > 0 || session.finalLock || finalMessageLock) {
            console.log(`🔇 [WS-1] Speech ignored (locked: structured=${awaitingStructuredInput} tools=${pendingFunctionCalls} final=${finalMessageLock})`);
            if (openaiWs?.readyState === WebSocket.OPEN) {
              openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
            }
            break;
          }
          console.log(`🎙️ User started speaking...`);
          socket.emit("status", "user_speaking");
          socket.emit("interrupt");
          socket.emit("audio_interrupt");
          clearTtsStreamingState();
          ttsChunks = [];
          lastTtsText = "";
          ttsInFlight = false;
          assistantSpeaking = false;
          if (ttsTimeout) { clearTimeout(ttsTimeout); ttsTimeout = null; }
          if (ttsSendTimer) { clearTimeout(ttsSendTimer); ttsSendTimer = null; }
          try {
            if (elevenLabsWs?.readyState === WebSocket.OPEN) {
              elevenLabsWs.send(JSON.stringify({ text: " ", flush: true }));
            }
          } catch (_) { }
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
                console.log(`🔇 Ignoring transcript during assistant speech: "${cleaned.substring(0, 80)}..."`);
                break;
              }

              if (!awaitingStructuredInput) {
                const badTranscript = detectBadTranscription(cleaned);
                if (badTranscript) {
                  console.log(`⚠️ Bad transcription detected (${badTranscript}): "${cleaned.substring(0, 80)}"`);
                  awaitingStructuredInput = true;
                  structuredInputField = badTranscript;
                  const placeholder = badTranscript === "email" ? "Enter your email address" : "Enter your phone number";
                  socket.emit("request_structured_input", { field: badTranscript, prompt: placeholder });
                  break;
                }
              }

              console.log(`👤 User: "${cleaned}"`);
              socket.emit("user_transcript", cleaned);
              session.messages.push({ role: "user", content: cleaned });
              sessions.set(session.id, session);
            }
          }
          break;

        case "response.text.delta":
          if (event.delta) {
            assistantTextBuffer += event.delta;
            socket.emit("assistant_text_delta", event.delta);
            queueTtsDelta(event.delta);
          }
          break;

        case "response.text.done":
          if (event.text) {
            console.log(`🤖 AI: "${event.text.substring(0, 100)}..."`);
            session.messages.push({ role: "assistant", content: event.text });
            sessions.set(session.id, session);
            socket.emit("assistant_text_done", event.text);

            // [CHANGED] Detect structured input for email, phone, AND address
            const detectedField = detectStructuredInputRequest(event.text);
            if (detectedField) {
              awaitingStructuredInput = true;
              structuredInputField = detectedField;

              let placeholder;
              if (detectedField === "email") placeholder = "Enter your email address";
              else if (detectedField === "phone") placeholder = "Enter your phone number";
              else if (detectedField === "address") placeholder = "Enter your full address (e.g. 9 George St, North Strathfield NSW 2137)";

              console.log(`📋 Structured input requested: ${detectedField}`);

              if (openaiWs?.readyState === WebSocket.OPEN) {
                openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
              }

              socket.emit("request_structured_input", { field: detectedField, prompt: placeholder });
            }
          }
          break;

        case "response.output_item.added":
          if (event.item?.type === "function_call") {
            const fnName = event.item.name || event.item.function_call?.name;
            if (fnName === "create_ticket") {
              // [CHANGED] Use enhanced lock for final message
              lockFinalMessage(15000);
              console.log(`🔒 Tool '${fnName}' planned. Full lock engaged.`);
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

        case "response.done":
          if (assistantTextBuffer.trim()) {
            if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
              if (!ttsInFlight) {
                ttsInFlight = true;
                if (ttsTimeout) clearTimeout(ttsTimeout);
                lastTtsText = lastTtsText || "";
                const capturedText = assistantTextBuffer;
                ttsTimeout = setTimeout(() => {
                  if (!ttsInFlight) return;
                  ttsInFlight = false;
                  speakViaElevenLabsRest(capturedText);
                }, 9000);
              }
              sendTtsChunkNow({ flush: true });
              clearTtsStreamingState();
            } else {
              speakViaElevenLabsRest(assistantTextBuffer);
            }

            // [CHANGED] Detect final confirmation and keep lock until TTS finishes
            const t = assistantTextBuffer.toLowerCase();
            const confirms = ["raised", "ticket details", "details via email", "agent will contact", "raised a ticket", "raised sales inquiry"];
            const isConfirmation = confirms.some(c => t.includes(c));
            if (isConfirmation) {
              // Keep lock ON during TTS playback — unlock happens after audio_done
              console.log("🔒 Final confirmation detected. Lock stays ON until audio finishes.");
              // Set a safety timeout to unlock after 12 seconds
              setTimeout(() => {
                if (finalMessageLock) {
                  unlockFinalMessage();
                  socket.emit("status", "listening");
                }
              }, 12000);
            }
          } else {
            clearTtsStreamingState();
          }

          if (!pendingFunctionCalls) {
            socket.emit("status", "listening");
          }
          assistantTextBuffer = "";
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
        setTimeout(() => {
          if (openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({ type: "response.create" }));
          }
        }, 250);
      }
      pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
      if (pendingFunctionCalls === 0) {
        socket.emit("status", "processing");
      }
    }

    async function execTool(fn, args) {
      if (fn === "extract_call_fields") {
        applyExtractionToSession(session, args);
        return JSON.stringify({ success: true });
      }

      // ═══════════════════════════════════════════════════════════
      //  [CHANGED] scrape_address_plans — calls Python scraper API
      // ═══════════════════════════════════════════════════════════
      if (fn === "scrape_address_plans") {
        const { address, plan_type, network } = args;
        if (!address) return JSON.stringify({ error: "Address is required" });

        try {
          console.log(`🔍 Calling scraper API: address="${address}" plan_type="${plan_type || 'Residential'}" network="${network || ''}"`);
          const resp = await axios.post(`${SCRAPER_API_URL}/scrape-plans`, {
            address: address,
            plan_type: plan_type || "Residential",
            network: network || "",
          }, { timeout: 60000 }); // 60s timeout for scraper

          const data = resp.data;
          if (!data.success) {
            return JSON.stringify({ success: false, error: data.error || "Scraper failed" });
          }

          // Format packages for the AI to display as numbered list
          const packages = data.packages.map((p, i) => ({
            number: i + 1,
            name: p.name,
            price_month: p.price_month,
            speed_down: p.speed_down,
            speed_up: p.speed_up,
            network: p.network,
            data: p.data || "Unlimited",
            contract: p.contract || "No contract",
            promo: p.promo || "",
            regular_price: p.regular_price || "",
            product_id: p.product_id || "",
          }));

          return JSON.stringify({
            success: true,
            address: data.address,
            total: packages.length,
            packages: packages,
            cached: data.cached || false,
          });
        } catch (err) {
          console.error("Scraper API call failed:", err.message);
          return JSON.stringify({
            success: false,
            error: `Scraper API error: ${err.message}. Make sure scraper_api.py is running on ${SCRAPER_API_URL}`,
          });
        }
      }

      // [CHANGED] check_address_availability now also uses scraper
      if (fn === "check_address_availability") {
        if (!args.address) return JSON.stringify({ error: "Address is required" });

        // First try scraper for real availability
        try {
          const resp = await axios.post(`${SCRAPER_API_URL}/scrape-plans`, {
            address: args.address,
            plan_type: session.collected.residentialPreference === "business" ? "Business" : "Residential",
            network: "",
          }, { timeout: 60000 });

          if (resp.data.success && resp.data.packages.length > 0) {
            // Determine available networks from scraped data
            const networks = [...new Set(resp.data.packages.map(p => p.network).filter(Boolean))];
            return JSON.stringify({
              success: true,
              address: args.address,
              available: true,
              networks: networks,
              totalPlans: resp.data.packages.length,
              message: `Address is serviceable. Available networks: ${networks.join(", ")}`,
            });
          }
        } catch (err) {
          console.warn("Scraper check failed, falling back to location-based check:", err.message);
        }

        // Fallback to original location-based check
        const locId = await determineLocationId(args.address);
        const t = await fetchTariffs();
        const avail = locId ? t.filter(x => x.available_for_locations?.includes(locId)) : [];
        return JSON.stringify({
          success: true,
          address: args.address,
          locationId: locId,
          locationName: LOCATIONS.find(l => l.id === locId)?.name || "Unknown",
          available: avail.length > 0,
          availablePlans: avail.map(p => ({
            title: p.title,
            price: parseFloat(p.price),
            download: `${p.speed_download / 1000} Mbps`,
            upload: `${p.speed_upload / 1000} Mbps`
          }))
        });
      }

      if (fn === "get_internet_plans") {
        // [CHANGED] If we have address + preferences in session, use scraper
        const addr = session.collected.address;
        const planType = session.collected.residentialPreference === "business" ? "Business" : "Residential";
        const network = session.collected.networkPreference || "";

        if (addr) {
          try {
            const resp = await axios.post(`${SCRAPER_API_URL}/scrape-plans`, {
              address: addr,
              plan_type: planType,
              network: network,
            }, { timeout: 60000 });

            if (resp.data.success) {
              const packages = resp.data.packages.map((p, i) => ({
                number: i + 1,
                name: p.name,
                price_month: p.price_month,
                speed_down: p.speed_down,
                speed_up: p.speed_up,
                network: p.network,
                data: p.data || "Unlimited",
                promo: p.promo || "",
                regular_price: p.regular_price || "",
              }));
              return JSON.stringify({ success: true, plans: packages });
            }
          } catch (err) {
            console.warn("Scraper failed for get_internet_plans, falling back:", err.message);
          }
        }

        // Fallback to Splynx tariffs
        const t = await fetchTariffs();
        return JSON.stringify({
          success: true,
          plans: t.map(x => ({
            id: x.id,
            title: x.title,
            price: parseFloat(x.price),
            download: `${x.speed_download / 1000} Mbps`,
            upload: `${x.speed_upload / 1000} Mbps`,
            available_for_locations: x.available_for_locations || []
          }))
        });
      }

      if (fn === "customer_lookup") return JSON.stringify(await customerLookup(args));

      if (fn === "create_ticket") {
        // [CHANGED] Lock is already engaged from response.output_item.added
        let fa = { ...args };
        if (typeof fa.message === "string") fa.message = { message: fa.message };
        const r = await splynx.request("POST", "admin/support/tickets", objectToUrlEncoded(fa));
        await sendTicketEmail(r.id, fa, session.collected, session.collected.customerType === "existing");
        return JSON.stringify({ success: true, ticket_id: r.id });
      }

      if (fn === "get_ticket_types") return JSON.stringify({ success: true, types: await splynx.request("GET", "admin/support/tickets-types") });
      if (fn === "get_ticket_groups") return JSON.stringify({ success: true, groups: await splynx.request("GET", "admin/support/tickets-groups") });
      if (fn === "get_ticket_statuses") return JSON.stringify({ success: true, statuses: await splynx.request("GET", "admin/support/tickets-statuses") });
      return JSON.stringify({ error: `Unknown tool: ${fn}` });
    }

    // ═══════════════ Client Audio → OpenAI ═══════════════
    let lastAudioLog = 0;
    socket.on("audio_chunk", (b64) => {
      // [CHANGED] Also check finalMessageLock
      const shouldSuppress = awaitingStructuredInput ||
        pendingFunctionCalls > 0 ||
        session.finalLock ||
        finalMessageLock;

      if (shouldSuppress) return;

      const now = Date.now();
      if (now - lastAudioLog > 2000) {
        let rms = 0;
        try {
          const bin = Buffer.from(b64, "base64");
          const i16 = new Int16Array(bin.buffer, bin.byteOffset, Math.floor(bin.length / 2));
          let sum = 0;
          for (let i = 0; i < i16.length; i++) sum += i16[i] * i16[i];
          rms = Math.sqrt(sum / i16.length) / 32768;
        } catch (_) { }
        const state = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][openaiWs?.readyState] || "UNKNOWN";
        console.log(`🎤 [${socket.id}] [Vol: ${(rms * 100).toFixed(1)}%] [OpenAI: ${state}]`);
        lastAudioLog = now;
      }
      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
      }
    });

    // ═══════════════ Structured Input (bypasses STT) ═══════════════
    socket.on("structured_input", (payload) => {
      if (!payload || !payload.field || !payload.value) {
        console.warn("⚠️ Invalid structured_input payload:", payload);
        return;
      }
      const { field, value } = payload;
      console.log(`📋 Structured input received: ${field} = "${value}"`);

      awaitingStructuredInput = false;
      structuredInputField = null;

      // [CHANGED] Save to session — including address
      if (field === "email") {
        session.collected.email = value;
      } else if (field === "phone") {
        session.collected.phone = value;
      } else if (field === "address") {
        session.collected.address = value;
      }
      sessions.set(session.id, session);

      // Build user message
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
        openaiWs.send(JSON.stringify({ type: "response.create" }));
      }

      socket.emit("structured_input_accepted", { field, value });
      socket.emit("status", "listening");
    });

    // ═══════════════ Cleanup ═══════════════
    socket.on("disconnect", () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
      clearInterval(keepAliveTimer);
      if (ttsTimeout) { clearTimeout(ttsTimeout); ttsTimeout = null; }
      if (finalMessageTimer) { clearTimeout(finalMessageTimer); finalMessageTimer = null; }
      if (openaiWs) try { openaiWs.close(); } catch (_) { }
      if (elevenLabsWs) try { elevenLabsWs.send(JSON.stringify({ text: "" })); elevenLabsWs.close(); } catch (_) { }
      sessions.delete(session.id);
    });

    // ═══════════════ Boot ═══════════════
    (async () => {
      try {
        console.log("⏳ Connecting both WebSockets...");
        await Promise.all([connectOpenAI(), connectElevenLabs()]);
        console.log("✅ Both WebSockets connected! Waiting 2s...");
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