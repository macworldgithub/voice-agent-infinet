import WebSocket from "ws";
export function setupRealtimeVoice(io, deps) {
  const {
    OPENAI_API_KEY,
    ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID,
    SYSTEM_PROMPT,
    LOCATIONS,
    tools,
    mkSession,
    sessions,
    normalizeText,
    normalizePhone,
    safeParseJSON,
    applyExtractionToSession,
    fetchTariffs,
    customerLookup,
    objectToUrlEncoded,
    splynx,
    sendTicketEmail,
    checkAddressAvailability,
  } = deps;

  const realtimeTools = tools.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  io.on("connection", (socket) => {
    console.log(`📌 Voice client connected: ${socket.id}`);

    const session = mkSession();
    let openaiWs = null;

    // --- ElevenLabs state -------------------------------------------
    let elevenLabsWs = null;
    let elevenLabsReady = false;
    let textBuffer = [];

    let assistantTextBuffer = "";
    let pendingFunctionCalls = 0;
    let lastTtsText = "";
    let isResponseActive = false;
    let assistantSpeaking = false;
    let responseTextComplete = false;
    let ttsChunkCount = 0;
    let ttsFinalized = false;
    let ttsDrainTimer = null;
    let lastTtsAudioAt = 0;
    let awaitingStructuredInput = false;
    let structuredInputField = null;

    const PCM_SAMPLE_RATE = 16000;
    let lastAssistantText = "";

    // --- FIX 5: Retry state at connection scope ------------------
    let emptyResponseCount = 0;
    const MAX_EMPTY_RETRIES = 3;

    let cancelPending = false;

    let currentResponseId = null;
    let currentResponseHadOutput = false;

    // --- FIX 4: Post-done response.create gate -------------------
    let pendingPostDoneCreate = false;
    let pendingPostDoneHint = null;

    // --- FIX 1 & 2: Sales step machine --------------------------
    let salesStep = null;

    // --- SILENCE TIMER FIX: Track whether last response was package-related ---
    let lastResponseWasPackage = false;

    function initSalesStepMachine() {
      if (salesStep !== null) return;
      const c = session.collected || {};
      if (c.leadInterest && c._websiteCheckDone) {
        if (!c._firstName) {
          salesStep = "firstName";
        } else if (!c._lastName) {
          salesStep = "lastName";
        } else if (!c.phone) {
          salesStep = "phone";
        } else if (!c.email) {
          salesStep = "email";
        } else {
          salesStep = "createTicket";
        }
        console.log(`📋 Sales step machine INIT — starting at: ${salesStep}`);
      }
    }

    function advanceSalesStep(completedStep) {
      const c = session.collected || {};
      if (salesStep !== completedStep) return;
      const order = [
        "firstName",
        "lastName",
        "phone",
        "email",
        "createTicket",
        "done",
      ];
      const idx = order.indexOf(completedStep);
      if (idx === -1) return;
      const next = order[idx + 1];
      if (!next) {
        salesStep = "done";
        return;
      }

      if (next === "lastName" && c._lastName) {
        advanceSalesStep("lastName");
        return;
      }
      if (next === "phone" && c.phone) {
        advanceSalesStep("phone");
        return;
      }
      if (next === "email" && c.email) {
        advanceSalesStep("email");
        return;
      }
      if (
        next === "createTicket" &&
        c._firstName &&
        c._lastName &&
        c.phone &&
        c.email
      ) {
        salesStep = "createTicket";
      } else {
        salesStep = next;
      }
      console.log(`📋 Sales step → ${salesStep}`);
    }

    function buildSalesStepHint() {
      const c = session.collected || {};

      if (
        salesStep === null &&
        c.leadInterest &&
        (c._websiteCheckDone || c._websiteCheckAsked)
      ) {
        initSalesStepMachine();
      }

      if (!salesStep || salesStep === "done") return null;

      const name = c._firstName || c.preferredName || "";

      switch (salesStep) {
        case "firstName":
          return `SALES STEP [firstName]: Ask ONLY for the customer's first name. Say something like "Could I start with your first name?" Say NOTHING else. Do NOT ask for last name, phone, or email yet.`;

        case "lastName":
          return `SALES STEP [lastName]: You have their first name (${c._firstName || "collected"}). Ask ONLY for their last name now. Say something like "And your last name?" Do NOT ask for anything else.`;

        case "phone":
          return `SALES STEP [phone]: You have their name (${name}). Ask ONLY for their mobile phone number now. Say something like "What's the best mobile number for you?" Do NOT ask for email yet.`;

        case "email":
          return `SALES STEP [email]: You have name and phone. Ask ONLY for their email address now. IMPORTANT: When asking for email, always mention that a text input box has appeared for them to type it accurately. Say something like "And finally, could I grab your email? There's a text box on your screen you can type it into."`;

        case "createTicket": {
          const missing = [];
          if (!c._firstName && !c.name && !c.preferredName)
            missing.push("name");
          if (!c.phone) missing.push("phone");
          if (!c.email) missing.push("email");
          if (!c.leadInterest) missing.push("selected plan");

          if (missing.length > 0) {
            if (!c.phone) salesStep = "phone";
            else if (!c.email) salesStep = "email";
            return buildSalesStepHint();
          }

          return `SALES STEP [createTicket]: ALL required details are collected:
- Name: ${c._firstName || ""} ${c._lastName || ""} / ${c.name || ""}
- Phone: ${c.phone}
- Email: ${c.email}
- Plan: ${c.leadInterest}
- Address: ${c.address || "provided earlier"}

YOU MUST NOW CALL create_ticket IMMEDIATELY. Do NOT say anything to the user yet. Do NOT say "you're all set" yet. CALL THE TOOL FIRST. The message body should include all collected details and the selected plan.`;
        }

        default:
          return null;
      }
    }

    // --- FIX 3: Raw phone buffer ---------------------------------
    let rawPhoneBuffer = null;
    let awaitingPhoneVerification = false;

    // Plans-presented cooldown
    let plansPresentedAt = 0;
    const PLANS_PRESENTED_COOLDOWN_MS = 60000;

    // --- Single pending response.create gate --------------------
    let responseCreatePending = false;

    function scheduleResponseCreate(
      contextHint = null,
      delayMs = 0,
      force = false,
    ) {
      if (isResponseActive && !force) {
        if (contextHint) pendingPostDoneHint = contextHint;
        pendingPostDoneCreate = true;
        console.log(`⏳ scheduleResponseCreate queued for post-done`);
        return;
      }

      if (responseCreatePending) {
        console.log(`⏭️  scheduleResponseCreate skipped (pending already)`);
        return;
      }
      responseCreatePending = true;

      const send = () => {
        responseCreatePending = false;
        if (openaiWs?.readyState !== WebSocket.OPEN) return;
        if (isResponseActive) {
          pendingPostDoneCreate = true;
          if (contextHint) pendingPostDoneHint = contextHint;
          return;
        }

        const salesHint = buildSalesStepHint();
        const combinedHint = [contextHint, salesHint]
          .filter(Boolean)
          .join("\n\n");

        if (combinedHint) {
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `[SYSTEM_CONTEXT]: ${combinedHint}`,
                  },
                ],
              },
            }),
          );
        }

        console.log("📤 Sending response.create to OpenAI");
        openaiWs.send(JSON.stringify({ type: "response.create" }));
      };

      if (delayMs > 0) {
        setTimeout(send, delayMs);
      } else {
        send();
      }
    }

    // --- SILENCE TIMER ------------------------------------------
    let silenceTimer = null;
    const SILENCE_TIMEOUT_MS = 15000;
    const SILENCE_TIMEOUT_PACKAGE_MS = 20000;

    function startSilenceTimer() {
      clearSilenceTimer();

      if (awaitingStructuredInput) return;
      if (finalMessageLock || session.finalLock) return;
      if (pendingFunctionCalls > 0) return;
      if (assistantSpeaking) return;

      const inPlansCooldown =
        Date.now() - plansPresentedAt < PLANS_PRESENTED_COOLDOWN_MS;
      const timeoutMs = inPlansCooldown
        ? SILENCE_TIMEOUT_PACKAGE_MS
        : SILENCE_TIMEOUT_MS;

      console.log(
        `⏱️  Silence timer started: ${timeoutMs / 1000}s (${inPlansCooldown ? "package cooldown" : "normal"})`,
      );

      silenceTimer = setTimeout(() => {
        silenceTimer = null;

        if (awaitingStructuredInput) return;
        if (finalMessageLock || session.finalLock) return;
        if (pendingFunctionCalls > 0) return;
        if (assistantSpeaking) return;

        const stillInPlansCooldown =
          Date.now() - plansPresentedAt < PLANS_PRESENTED_COOLDOWN_MS;
        const nudgeText = stillInPlansCooldown
          ? "[SILENCE_NUDGE] The user has not responded after you presented plans. Do NOT select a plan for them. Simply ask them gently which plan they'd like to go with."
          : "[SILENCE_NUDGE] The user has not responded. REPEAT your last question. Say something like: 'Sorry about that — let me just repeat my last question. [REPEAT THE EXACT SAME QUESTION]'. Do NOT move forward.";

        console.log(`⏰ User silent for ${timeoutMs / 1000}s — nudging AI`);
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: nudgeText }],
              },
            }),
          );
          scheduleResponseCreate();
        }
      }, timeoutMs);
    }

    function clearSilenceTimer() {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    }

    const TTS_DRAIN_TIMEOUT_MS = 1800;

    function clearTtsDrainTimer() {
      if (ttsDrainTimer) {
        clearTimeout(ttsDrainTimer);
        ttsDrainTimer = null;
      }
    }

    function startTtsDrainTimer() {
      clearTtsDrainTimer();
      if (!responseTextComplete) return;
      ttsDrainTimer = setTimeout(() => {
        ttsDrainTimer = null;
        if (!responseTextComplete || ttsFinalized) return;
        const sinceLastAudio = Date.now() - lastTtsAudioAt;
        if (sinceLastAudio >= TTS_DRAIN_TIMEOUT_MS) {
          finalizeTtsPlayback();
        }
      }, TTS_DRAIN_TIMEOUT_MS);
    }

    function finalizeTtsPlayback() {
      if (ttsFinalized) return;
      ttsFinalized = true;
      clearTtsDrainTimer();
      assistantSpeaking = false;
      lastResponseWasPackage = false;
      socket.emit("audio_done");

      if (
        !pendingFunctionCalls &&
        !awaitingStructuredInput &&
        !finalMessageLock &&
        !session.finalLock
      ) {
        startSilenceTimer();
      }
    }

    function maybeFinalizeTtsPlayback() {
      if (!responseTextComplete) return;
      if (textBuffer.length > 0) return;
      if (ttsChunkCount > 0) return;
      finalizeTtsPlayback();
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
      if (finalMessageTimer) {
        clearTimeout(finalMessageTimer);
        finalMessageTimer = null;
      }
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

      const intent = String(collected.intent || "").toLowerCase();
      const isRelocation = intent === "relocation" || intent === "moving";
      const emailAlreadyCollected = !!collected.email;
      const shouldCheckEmail = !emailAlreadyCollected || isRelocation;

      const DET = `(?:(?:your|the|an?|me)\\s+){0,2}`;

      const emailPatterns = [
        new RegExp(`(?:provide|share|enter|type|give)\\s+${DET}email`, "i"),
        /what(?:'?s|\s+is)\s+your\s+email/i,
        new RegExp(
          `could you\\s+(?:please\\s+)?(?:provide|share|give|send|type)\\s+${DET}email`,
          "i",
        ),
        new RegExp(
          `(?:please|kindly)\\s+(?:provide|share|enter|type)\\s+${DET}email`,
          "i",
        ),
        /(?:need|like)\s+your\s+email/i,
        /email\s+(?:address\s+)?(?:please|to\s+proceed)/i,
        /grab\s+your\s+email/i,
        /(?:could|can)\s+I\s+(?:get|grab|have|take)\s+your\s+email/i,
        /(?:need|like)\s+(?:is\s+)?your\s+email/i,
        /(?:last\s+thing|next\s+thing|also)\s+.*\s+email/i,
        /pop\s+(?:in|up)?\s+.*email/i,
        /type\s+(?:in|that)\s+.*email|email\s+.*type\s+(?:in|that)/i,
        /(?:send|get)\s+.*\s+email\s+address/i,
        /email\s+address\s+(?:so|for|and)/i,
        /your\s+email\s+(?:address|for\s+me|please)/i,
        /(?:I'll\s+need|I\s+need|we\s+need|gonna\s+need)\s+.*email/i,
        /(?:could\s+you|can\s+you)\s+.*email/i,
        /email\s+(?:on\s+)?(?:your|the)\s+account/i,
        /account\s+(?:is\s+)?(?:under|linked\s+to)\s+(?:what\s+)?email/i,
        /text\s+box.*email|email.*text\s+box/i,
      ];

      if (shouldCheckEmail) {
        for (const p of emailPatterns) {
          if (p.test(text)) {
            if (
              lastStructuredInputField === "email" &&
              now - lastStructuredInputTime < STRUCTURED_INPUT_COOLDOWN_MS &&
              !isRelocation
            )
              return null;
            lastStructuredInputField = "email";
            lastStructuredInputTime = now;
            return "email";
          }
        }
      }

      return null;
    }

    function detectPhoneVerificationRequest(text) {
      if (!text) return false;
      const lower = text.toLowerCase();
      const c = session.collected || {};
      if (!c._emailVerifiedCustomerId) return false;
      if (c._phoneVerified) return false;
      return (
        lower.includes("phone") ||
        lower.includes("contact number") ||
        lower.includes("mobile number") ||
        lower.includes("number on the account")
      );
    }

    function mapOrdinalNetworkChoice(text) {
      const t = (text || "").toLowerCase().trim();
      if (/\bnbn\b/.test(t) || /\b(opti\s*comm|opticomm)\b/.test(t))
        return null;
      if (
        /\b(first|1st|one|1|option\s*1|option\s*one|number\s*1|the\s*first)\b/.test(
          t,
        )
      )
        return "NBN";
      if (
        /\b(second|2nd|two|2|option\s*2|option\s*two|number\s*2|the\s*second|to)\b/.test(
          t,
        )
      )
        return "Opticomm";
      return null;
    }

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
        if (msgs[i].role === "user") break;
      }
      return false;
    }

    function detectBadTranscription(text) {
      if (!text) return null;
      const lower = text.toLowerCase();
      const emailVoicePatterns =
        /\b(at\s+(gmail|yahoo|hotmail|outlook|icloud)|dot\s+(com|net|org|au|co)|at\s+\w+\s+dot)\b/i;
      if (emailVoicePatterns.test(lower)) return "email";
      return null;
    }

    function detectPlanPresentation(text) {
      if (!text) return false;
      const lower = text.toLowerCase();
      return (
        (lower.includes("mbps") &&
          (lower.includes("$") ||
            lower.includes("per month") ||
            lower.includes("/m"))) ||
        (lower.includes("plan") && lower.includes("available")) ||
        lower.includes("here are the plans") ||
        lower.includes("here's what's available") ||
        lower.includes("which of those plans") ||
        lower.includes("catches your eye")
      );
    }

    function detectWebsiteCheckQuestion(text) {
      if (!text) return false;
      const lower = text.toLowerCase();
      return (
        lower.includes("check out our website") ||
        lower.includes("visited our website") ||
        lower.includes("had a chance to check out") ||
        lower.includes("seen the plans or pricing") ||
        lower.includes("look at the plans or pricing") ||
        (lower.includes("website") &&
          (lower.includes("plans") || lower.includes("pricing")))
      );
    }

    function detectWebsiteCheckAnswer(text) {
      if (!text) return false;
      const lower = text.toLowerCase().trim();
      if (
        /\b(yes|yeah|yep|yup|i have|i did|already|looked|checked|seen|saw|visited)\b/.test(
          lower,
        )
      )
        return true;
      if (
        /\b(no|nope|not yet|haven't|didn't|i haven't|i didn't|no i haven't)\b/.test(
          lower,
        )
      )
        return true;
      return false;
    }

    function detectSalesStepAnswer(text) {
      if (!salesStep || salesStep === "done" || salesStep === "createTicket")
        return;
      const c = session.collected || {};

      if (salesStep === "firstName") {
        const words = text.trim().split(/\s+/);
        const firstName = words[0];
        if (firstName && firstName.length > 1) {
          session.collected._firstName = firstName;
          sessions.set(session.id, session);
          console.log(`📋 Sales step: firstName captured = "${firstName}"`);
          advanceSalesStep("firstName");
        }
      } else if (salesStep === "lastName") {
        const words = text.trim().split(/\s+/);
        const lastName = words[words.length - 1];
        if (lastName && lastName.length > 1) {
          session.collected._lastName = lastName;
          session.collected.name = `${c._firstName || ""} ${lastName}`.trim();
          session.collected.preferredName = c._firstName || lastName;
          sessions.set(session.id, session);
          console.log(`📋 Sales step: lastName captured = "${lastName}"`);
          advanceSalesStep("lastName");
        }
      } else if (salesStep === "phone") {
        const digits = text.replace(/\D/g, "");
        if (digits.length >= 8) {
          session.collected.phone = digits;
          sessions.set(session.id, session);
          console.log(`📋 Sales step: phone captured = "${digits}"`);
          advanceSalesStep("phone");
        }
      }
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
        elWs.send(
          JSON.stringify({
            text: " ",
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.75,
              speed: 1.1,
            },
            xi_api_key: ELEVENLABS_API_KEY,
          }),
        );

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
            socket.emit("audio_chunk_pcm", {
              sampleRate: PCM_SAMPLE_RATE,
              audio: msg.audio,
            });
            lastTtsAudioAt = Date.now();
            startTtsDrainTimer();
          }

          const isFinal =
            msg.isFinal === true || msg.is_final === true || msg.final === true;

          if (isFinal) {
            console.log(`🔊 [EL] TTS chunk complete (isFinal)`);
            if (ttsChunkCount > 0) ttsChunkCount -= 1;
            maybeFinalizeTtsPlayback();
          }
        } catch (err) {}
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

    function interruptElevenLabsStream() {
      if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) {
        openElevenLabsStream(true);
        return;
      }
      try {
        elevenLabsWs.send(JSON.stringify({ text: "" }));
      } catch (e) {
        console.warn("[EL] interrupt flush failed:", e.message);
      }
      try {
        elevenLabsWs.send(
          JSON.stringify({
            text: " ",
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.75,
              speed: 1.1,
            },
            xi_api_key: ELEVENLABS_API_KEY,
          }),
        );
        elevenLabsReady = true;
      } catch (e) {
        console.warn("[EL] re-prime failed:", e.message);
        openElevenLabsStream(true);
      }
    }

    function sendTextToElevenLabs(text) {
      if (elevenLabsWs?.readyState === WebSocket.OPEN) {
        ttsChunkCount += 1;
        elevenLabsWs.send(
          JSON.stringify({ text, try_trigger_generation: true }),
        );
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

    // ══════════════════ OpenAI Realtime API ══════════════════
    function connectOpenAI() {
      return new Promise((resolve, reject) => {
        openaiWs = new WebSocket(
          "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview",
          {
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "OpenAI-Beta": "realtime=v1",
            },
          },
        );

        openaiWs.on("open", () => {
          console.log("✅ [WS-1] OpenAI Realtime connected");
          const instructions =
            SYSTEM_PROMPT +
            "\n\nCRITICAL: You MUST ALWAYS respond in English only. Never respond in any other language." +
            "\n\nFIELD COLLECTION RULE: When collecting customer details (name, phone, email), you MUST ask for ONE field at a time. Wait for the customer's answer before moving to the next field. The [SYSTEM_CONTEXT] hint will tell you EXACTLY which field to ask for next. Follow it precisely.";

          openaiWs.send(
            JSON.stringify({
              type: "session.update",
              session: {
                instructions,
                modalities: ["text"],
                input_audio_format: "pcm16",
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.8,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 1500,
                },
                tools: realtimeTools,
                tool_choice: "auto",
                input_audio_transcription: { model: "whisper-1" },
              },
            }),
          );

          openElevenLabsStream();
        });

        let resolved = false;
        openaiWs.on("message", (raw) => {
          try {
            const data = JSON.parse(raw.toString());
            if (!resolved) {
              resolved = true;
              resolve();
            }
            handleOpenAIEvent(data);
          } catch (e) {
            console.error("[WS-1] parse error:", e.message);
          }
        });

        openaiWs.on("error", (err) => {
          console.error("[WS-1] error:", err.message);
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });
        openaiWs.on("close", (code) => {
          console.log(`[WS-1] closed (${code})`);
          closeElevenLabsWs();
        });
      });
    }

    // ══════════════════ OpenAI Event Handler ══════════════════
    let lastEventLog = "";

    function handleOpenAIEvent(event) {
      if (event.type !== lastEventLog) {
        console.log(`📡 [WS-1] Event: ${event.type}`);
        lastEventLog = event.type;
      }

      switch (event.type) {
        case "session.created":
          break;

        case "session.updated":
          console.log("✅ [WS-1] Session configured");
          break;

        case "input_audio_buffer.speech_started": {
          if (
            awaitingStructuredInput ||
            pendingFunctionCalls > 0 ||
            session.finalLock ||
            finalMessageLock
          ) {
            console.log(`🔇 Speech ignored (locked)`);
            if (openaiWs?.readyState === WebSocket.OPEN) {
              openaiWs.send(
                JSON.stringify({ type: "input_audio_buffer.clear" }),
              );
            }
            break;
          }

          console.log(`🎙️ USER INTERRUPTED -> Stopping AI Voice`);
          socket.emit("status", "user_speaking");
          socket.emit("interrupt");
          socket.emit("audio_interrupt");

          clearSilenceTimer();

          if (isResponseActive) {
            cancelPending = true;
            openaiWs.send(JSON.stringify({ type: "response.cancel" }));
          }

          interruptElevenLabsStream();

          assistantTextBuffer = "";
          lastTtsText = "";
          assistantSpeaking = false;
          responseTextComplete = false;
          ttsChunkCount = 0;
          ttsFinalized = false;
          clearTtsDrainTimer();
          lastResponseWasPackage = false;
          emptyResponseCount = 0;
          responseCreatePending = false;
          pendingPostDoneCreate = false;
          pendingPostDoneHint = null;
          break;
        }

        case "input_audio_buffer.speech_stopped":
          socket.emit("status", "processing");
          break;

        case "conversation.item.input_audio_transcription.completed": {
          if (!event.transcript) break;

          const cleaned = normalizeText(event.transcript);
          if (!cleaned) break;

          const looksLikeEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(cleaned);
          const digitCount = (cleaned.match(/\d/g) || []).length;
          const looksLikePhone = digitCount >= 6;

          if (assistantSpeaking && !(looksLikeEmail || looksLikePhone)) {
            console.log(`🔇 Ignoring transcript during assistant speech`);
            break;
          }

          // --- FIX 3: Capture raw phone BEFORE any LLM processing ---
          if (awaitingPhoneVerification && looksLikePhone) {
            const digits = cleaned.replace(/\D/g, "");
            if (digits.length >= 6) {
              rawPhoneBuffer = digits;
              console.log(
                `📞 Raw phone captured from transcript: "${rawPhoneBuffer}"`,
              );
            }
          }

          if (!awaitingStructuredInput) {
            const badTranscript = detectBadTranscription(cleaned);
            if (badTranscript === "email") {
              awaitingStructuredInput = true;
              structuredInputField = "email";
              socket.emit("request_structured_input", {
                field: "email",
                prompt: "Enter your email address",
              });
              break;
            }
          }

          console.log(`👤 User: "${cleaned}"`);
          socket.emit("user_transcript", cleaned);

          const mappedNetwork = mapOrdinalNetworkChoice(cleaned);
          if (mappedNetwork && wasLastMessageNetworkQuestion()) {
            const clarified = `I want ${mappedNetwork}`;
            console.log(`🔄 Ordinal mapped: "${cleaned}" → "${clarified}"`);
            session.collected.networkPreference = mappedNetwork;
            session.messages.push({ role: "user", content: clarified });
            sessions.set(session.id, session);

            if (openaiWs?.readyState === WebSocket.OPEN) {
              openaiWs.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "user",
                    content: [{ type: "input_text", text: clarified }],
                  },
                }),
              );
              scheduleResponseCreate();
            }
            clearSilenceTimer();
            break;
          }

          if (
            session.collected._websiteCheckRequired &&
            !session.collected._websiteCheckDone &&
            detectWebsiteCheckAnswer(cleaned)
          ) {
            const lastAiMsg = [...(session.messages || [])]
              .reverse()
              .find((m) => m.role === "assistant");
            if (
              lastAiMsg &&
              detectWebsiteCheckQuestion(lastAiMsg.content || "")
            ) {
              session.collected._websiteCheckDone = true;
              sessions.set(session.id, session);
              console.log(`✅ Website check answered — marked DONE`);
              initSalesStepMachine();
            }
          }

          detectSalesStepAnswer(cleaned);

          session.messages.push({ role: "user", content: cleaned });
          sessions.set(session.id, session);

          clearSilenceTimer();
          break;
        }

        case "response.created":
          isResponseActive = true;
          currentResponseId = event.response?.id || null;
          currentResponseHadOutput = false;
          cancelPending = false;
          responseTextComplete = false;
          ttsChunkCount = 0;
          ttsFinalized = false;
          lastTtsAudioAt = 0;
          clearTtsDrainTimer();
          openElevenLabsStream();
          assistantSpeaking = true;
          socket.emit("status", "speaking");
          break;

        case "response.text.delta":
          if (event.delta) {
            currentResponseHadOutput = true;
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
            currentResponseHadOutput = true;
            const newTextNorm = event.text
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, "")
              .trim();
            const lastTextNorm = lastAssistantText
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, "")
              .trim();
            const isDuplicate =
              newTextNorm.length > 20 &&
              lastTextNorm.length > 20 &&
              (newTextNorm === lastTextNorm ||
                newTextNorm.includes(lastTextNorm) ||
                lastTextNorm.includes(newTextNorm));

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
            responseTextComplete = true;
            maybeFinalizeTtsPlayback();
            startTtsDrainTimer();

            if (detectPlanPresentation(event.text)) {
              plansPresentedAt = Date.now();
              lastResponseWasPackage = true;
              console.log(
                `📋 Plans presented — cooldown activated (${PLANS_PRESENTED_COOLDOWN_MS / 1000}s), timer deferred to TTS completion`,
              );
            }

            // --- FIX 3: Detect phone verification request ---
            if (detectPhoneVerificationRequest(event.text)) {
              awaitingPhoneVerification = true;
              rawPhoneBuffer = null;
              console.log(`📞 Awaiting phone verification input`);
            }

            if (
              session.collected.leadInterest &&
              session.collected._websiteCheckRequired &&
              !session.collected._websiteCheckAsked &&
              detectWebsiteCheckQuestion(event.text)
            ) {
              session.collected._websiteCheckAsked = true;
              sessions.set(session.id, session);
              console.log(`📋 Website check question detected — marked ASKED`);
            }

            const detectedField = detectStructuredInputRequest(event.text);
            if (detectedField === "email") {
              awaitingStructuredInput = true;
              structuredInputField = "email";
              console.log(`📋 Structured input requested: email`);
              clearSilenceTimer();
              if (openaiWs?.readyState === WebSocket.OPEN) {
                openaiWs.send(
                  JSON.stringify({ type: "input_audio_buffer.clear" }),
                );
              }
              socket.emit("request_structured_input", {
                field: "email",
                prompt: "Enter your email address",
              });
            }
          }
          break;

        case "response.done": {
          isResponseActive = false;

          const outputItems = event.response?.output || [];
          const hasTextOutput =
            outputItems.some(
              (item) =>
                item.type === "message" &&
                item.content?.some((c) => c.type === "text" && c.text?.trim()),
            ) || currentResponseHadOutput;
          const hasFunctionCall = outputItems.some(
            (item) => item.type === "function_call",
          );

          // --- FIX 5: Proper retry logic ---
          if (
            !hasFunctionCall &&
            !hasTextOutput &&
            pendingFunctionCalls === 0 &&
            !finalMessageLock
          ) {
            if (cancelPending) {
              console.log(`✅ response.done (cancelled) — no retry`);
              cancelPending = false;
              socket.emit("status", "listening");

              if (pendingPostDoneCreate) {
                pendingPostDoneCreate = false;
                const hint = pendingPostDoneHint;
                pendingPostDoneHint = null;
                setTimeout(() => scheduleResponseCreate(hint), 50);
              }
              break;
            }

            emptyResponseCount++;
            if (emptyResponseCount <= MAX_EMPTY_RETRIES) {
              const retryDelay = 150 * Math.pow(2, emptyResponseCount - 1);
              console.warn(
                `⚠️ response.done with no output (attempt ${emptyResponseCount}/${MAX_EMPTY_RETRIES}) — retrying in ${retryDelay}ms`,
              );
              scheduleResponseCreate(null, retryDelay, true);
            } else {
              console.warn(
                `⚠️ Max retries (${MAX_EMPTY_RETRIES}) reached — stopping retry loop`,
              );
              emptyResponseCount = 0;
              socket.emit("status", "listening");
            }
            break;
          }

          // Successful response — reset retry counter
          emptyResponseCount = 0;

          if (assistantTextBuffer.trim()) {
            const t = assistantTextBuffer.toLowerCase();
            const confirms = [
              "raised",
              "ticket details",
              "details via email",
              "agent will contact",
              "raised a ticket",
              "raised sales inquiry",
            ];
            const isConfirmation = confirms.some((c) => t.includes(c));
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

          // --- FIX 4: Fire any queued post-done response.create ---
          if (pendingPostDoneCreate && pendingFunctionCalls === 0) {
            pendingPostDoneCreate = false;
            const hint = pendingPostDoneHint;
            pendingPostDoneHint = null;
            console.log(`📤 Firing queued post-done response.create`);
            setTimeout(() => scheduleResponseCreate(hint, 0, true), 50);
            break;
          }

          if (!pendingFunctionCalls) {
            socket.emit("status", "listening");
          }
          assistantTextBuffer = "";
          currentResponseHadOutput = false;
          break;
        }

        case "response.output_item.added":
          if (event.item?.type === "function_call") {
            const fnName = event.item.name || event.item.function_call?.name;
            if (fnName === "create_ticket") {
              lockFinalMessage(20000);
              if (openaiWs?.readyState === WebSocket.OPEN) {
                openaiWs.send(
                  JSON.stringify({ type: "input_audio_buffer.clear" }),
                );
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
          if (isResponseActive) isResponseActive = false;
          if (pendingFunctionCalls > 0) pendingFunctionCalls = 0;
          emptyResponseCount = 0;
          responseCreatePending = false;
          pendingPostDoneCreate = false;
          socket.emit("status", "listening");
          break;
      }
    }

    // ══════════════════ Tool Execution ══════════════════
    async function handleFunctionCall(item) {
      const { call_id, name: fn, arguments: argsStr } = item;
      let args = safeParseJSON(argsStr) || {};

      // --- Guard: verify_phone must NEVER run in sales flow ---
      if (
        fn === "verify_phone" &&
        !session.collected._emailVerifiedCustomerId
      ) {
        console.log(
          `⚠️  verify_phone called in SALES flow — redirecting to extract_call_fields to save phone`,
        );
        const phoneToSave = args.phone || rawPhoneBuffer;
        rawPhoneBuffer = null;
        awaitingPhoneVerification = false;
        if (phoneToSave) {
          session.collected.phone =
            String(phoneToSave).replace(/\D/g, "") || phoneToSave;
          sessions.set(session.id, session);
          if (salesStep === "phone") advanceSalesStep("phone");
          console.log(`📋 Sales phone saved: ${session.collected.phone}`);
        }
        const fakeResult = JSON.stringify({
          success: true,
          _redirected: true,
          message: "Phone number saved.",
        });
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id,
                output: fakeResult,
              },
            }),
          );
        }
        pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
        if (
          pendingFunctionCalls === 0 &&
          openaiWs?.readyState === WebSocket.OPEN
        ) {
          const salesHint = buildSalesStepHint() || "";
          const hint = `Phone number has been saved. ${salesHint}\n\nIMPORTANT: Respond immediately — proceed to the next step.`;
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [
                  { type: "input_text", text: `[SYSTEM_CONTEXT]: ${hint}` },
                ],
              },
            }),
          );
          scheduleResponseCreate();
        }
        return;
      }

      // --- FIX 3: Override phone arg with raw buffer if available ---
      if (fn === "verify_phone" && rawPhoneBuffer) {
        console.log(
          `📞 FIX 3: Overriding LLM phone arg "${args.phone}" with raw transcript value "${rawPhoneBuffer}"`,
        );
        args = { ...args, phone: rawPhoneBuffer };
        rawPhoneBuffer = null;
        awaitingPhoneVerification = false;
      }

      console.log(`🔧 Tool: ${fn}`, JSON.stringify(args).substring(0, 200));

      let result;
      socket.emit("status", "processing");
      clearSilenceTimer();

      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
      }

      const toolTimeout = setTimeout(() => {
        console.warn(`⚠️ Tool ${fn} timed out after 30s`);
        pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
        if (pendingFunctionCalls === 0) socket.emit("status", "listening");
      }, 30000);

      try {
        result = await execTool(fn, args);
      } catch (err) {
        result = JSON.stringify({ success: false, error: err.message });
      }

      clearTimeout(toolTimeout);

      // --- Build system hint ---
      let systemHint = `Current collected fields: ${JSON.stringify(
        Object.fromEntries(
          Object.entries(session.collected || {}).filter(
            ([k]) => k !== "_registeredPhone" && k !== "_rp",
          ),
        ),
      )}.`;

      if (fn === "check_address_availability") {
        let parsedResult = null;
        try {
          parsedResult = JSON.parse(result);
        } catch (_) {}
        if (parsedResult) {
          const networkLabel = parsedResult.network || "the available network";
          const planCount = Array.isArray(parsedResult.availablePlans)
            ? parsedResult.availablePlans.length
            : 0;
          const requiresFilter =
            parsedResult.requiresResidentialFilter === true;

          if (parsedResult.orderable === false) {
            systemHint += `\nTOOL RESULT: Address not serviceable. Tell customer empathetically and offer to take their details.`;
          } else if (planCount > 0 && requiresFilter) {
            systemHint += `\nTOOL RESULT: ${planCount} plans found on "${networkLabel}". requiresResidentialFilter=true. Ask: "Is this for your home or a business?" before showing plans.`;
          } else if (planCount > 0 && !requiresFilter) {
            systemHint += `\nTOOL RESULT: ${planCount} plans found on "${networkLabel}". Present ALL plans NOW. Speak slowly. End with "Which of these catches your eye?" LOCKED to ${networkLabel}.`;
          } else {
            systemHint += `\nTOOL RESULT: No plans returned. Tell customer and offer alternative help.`;
          }

          if (session.networkShown) {
            systemHint += `\nNETWORK LOCK: Only ${session.networkShown} — NEVER mention ${session.networkShown === "OptiComm" ? "NBN" : "OptiComm"} again.`;
          }
        }
      }

      if (fn === "customer_lookup") {
        let parsedResult = null;
        try {
          parsedResult = JSON.parse(result);
        } catch (_) {}
        if (parsedResult?.success && parsedResult?.customer) {
          systemHint += `\nTOOL RESULT: Email lookup succeeded — customer found. Say "Perfect, I can see that account." Then ask for their phone number to verify. When they give it, call verify_phone.`;
          awaitingPhoneVerification = true;
          rawPhoneBuffer = null;
        } else {
          systemHint += `\nTOOL RESULT: Customer not found. Ask customer to double-check their email address.`;
        }
      }

      if (fn === "verify_phone") {
        let parsedResult = null;
        try {
          parsedResult = JSON.parse(result);
        } catch (_) {}
        if (parsedResult?.verificationFailed) {
          awaitingPhoneVerification = true;
          rawPhoneBuffer = null;
          systemHint += `\nTOOL RESULT: Phone verification FAILED. Tell customer: "That phone number doesn't match what we have on file. Could you double-check the number and try again?" Do NOT proceed.`;
        } else if (parsedResult?.success && parsedResult?.verified) {
          awaitingPhoneVerification = false;
          rawPhoneBuffer = null;
          systemHint += `\nTOOL RESULT: Phone verification PASSED — fully verified. Say "Perfect, thanks for confirming — your account's all verified now." then ask what they need help with.`;
        } else {
          systemHint += `\nTOOL RESULT: Verification error — ${parsedResult?.message || "unknown"}. Tell customer to email support@infinetbroadband.com.au.`;
        }
      }

      if (fn === "create_ticket") {
        let parsedResult = null;
        try {
          parsedResult = JSON.parse(result);
        } catch (_) {}
        if (
          parsedResult?._blocked &&
          parsedResult?.reason === "email_missing"
        ) {
          unlockFinalMessage();
          const emailHint =
            buildSalesStepHint() ||
            "Ask for the customer email now. Tell them to use the text box on screen.";
          systemHint += `
TOOL RESULT: create_ticket was BLOCKED because email has not been collected yet. You MUST ask for the email address NOW before submitting. ${emailHint}`;
        } else if (parsedResult?.success) {
          salesStep = "done";
          const ticketId = parsedResult.ticket_id;
          const isSales = parsedResult._isSalesTicket === true || !ticketId;
          if (isSales) {
            systemHint += `\nTOOL RESULT: Sales enquiry submitted. Say: "Awesome, you're all set! I've submitted your enquiry and our sales team will be in touch via email shortly. Is there anything else you'd like to know?"`;
          } else {
            systemHint += `\nTOOL RESULT: Support ticket #${ticketId} created. Say: "Brilliant, all done! I've raised support ticket number ${ticketId} — you'll get details via email shortly. Is there anything else I can help with?"`;
          }
        } else {
          systemHint += `\nTOOL RESULT: Ticket FAILED — ${parsedResult?.error || "unknown error"}. Apologise and suggest calling 1300 101 414 or emailing support@infinetbroadband.com.au.`;
        }
      }

      if (fn === "send_portal_login_email") {
        systemHint += `\nTOOL RESULT: Portal login email sent. Tell customer the request was sent and team will be in touch.`;
      }

      if (fn === "extract_call_fields") {
        const c = session.collected || {};
        const shouldGate =
          c.leadInterest &&
          c._websiteCheckRequired &&
          !c._websiteCheckAsked &&
          !c._websiteCheckDone;

        if (shouldGate) {
          systemHint += `\nCRITICAL GATE: Ask: "Just out of curiosity — have you had a chance to check out our website and seen the plans or pricing?" WAIT for their answer before collecting name/phone/email.`;
        }
        if (
          c.leadInterest &&
          c._websiteCheckRequired &&
          (c._websiteCheckAsked || c._websiteCheckDone)
        ) {
          systemHint += `\nWEBSITE CHECK DONE: Do NOT ask again. Proceed with order collection.`;
        }

        const stepHint = buildSalesStepHint();
        if (stepHint) systemHint += `\n\n${stepHint}`;
      }

      // Send function output to OpenAI
      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id, output: result },
          }),
        );
      }

      pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);

      if (
        pendingFunctionCalls === 0 &&
        openaiWs?.readyState === WebSocket.OPEN
      ) {
        openaiWs.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `[SYSTEM_CONTEXT]: ${systemHint}\n\nIMPORTANT: Respond immediately based on the tool result above.`,
                },
              ],
            },
          }),
        );

        if (fn === "create_ticket") {
          unlockFinalMessage();
        }

        console.log(`📤 Tool complete (${fn}) — triggering response.create`);
        scheduleResponseCreate();
      }
    }

    async function execTool(fn, args) {
      if (fn === "extract_call_fields") {
        applyExtractionToSession(session, args);

        const c = session.collected || {};
        if (salesStep === "firstName" && (args.preferredName || args.name)) {
          const firstName = (args.preferredName || args.name || "").split(
            " ",
          )[0];
          if (firstName) {
            session.collected._firstName = firstName;
            sessions.set(session.id, session);
            advanceSalesStep("firstName");
          }
        }
        if (salesStep === "lastName" && args.name && args.name.includes(" ")) {
          const parts = args.name.split(" ");
          session.collected._lastName = parts[parts.length - 1];
          sessions.set(session.id, session);
          advanceSalesStep("lastName");
        }
        if (salesStep === "phone" && args.phone) {
          advanceSalesStep("phone");
        }
        if (salesStep === "email" && args.email) {
          advanceSalesStep("email");
        }

        return JSON.stringify({ success: true });
      }

      if (fn === "customer_lookup") {
        const lookupArgs = { ...(args || {}) };
        delete lookupArgs.phone;

        if (!lookupArgs.email && !lookupArgs.name) {
          return JSON.stringify({
            success: false,
            message: "Email is required for customer lookup",
          });
        }

        try {
          const result = await customerLookup(lookupArgs);
          if (result.success && result.customer) {
            session.collected._emailVerifiedCustomerId = result.customer.id;
            session.collected._registeredPhone =
              result.customer.phone || result.customer.phone_mobile || null;
            session.collected._rp = session.collected._registeredPhone;
            session.collected._phoneVerified = false;
            session.collected.customer_id = result.customer.id;
            sessions.set(session.id, session);
            console.log(
              `📧 Email lookup OK — customer ${result.customer.id}. ` +
                `Registered phone: ${session.collected._registeredPhone ? "stored (hidden)" : "NOT on record"}`,
            );
            const safeResult = { ...result };
            if (safeResult.customer) {
              safeResult.customer = { ...safeResult.customer };
              delete safeResult.customer.phone;
              delete safeResult.customer.phone_mobile;
              delete safeResult.customer.mobile;
              delete safeResult.customer.phone2;
            }
            return JSON.stringify(safeResult);
          }
          return JSON.stringify(result);
        } catch (e) {
          return JSON.stringify({ success: false, error: e.message });
        }
      }

      if (fn === "verify_phone") {
        const { phone } = args || {};
        if (!phone) {
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "No phone number provided.",
          });
        }

        const emailCustomerId = session.collected._emailVerifiedCustomerId;
        if (!emailCustomerId) {
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "Email verification must be completed first.",
          });
        }

        const registeredPhone =
          session.collected._registeredPhone || session.collected._rp;
        if (!registeredPhone) {
          console.warn(
            `⚠️ No registered phone for customer ${emailCustomerId}`,
          );
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message:
              "No phone number registered on this account. Please contact support via email.",
          });
        }

        const normalize =
          normalizePhone && typeof normalizePhone === "function"
            ? normalizePhone
            : (p) =>
                String(p || "")
                  .replace(/\D/g, "")
                  .replace(/^61(\d{9})$/, "0$1");

        const normalizedInput = normalize(phone);
        const normalizedRegistered = normalize(registeredPhone);

        console.log(
          `📞 Phone verify: input="${normalizedInput}" registered="${normalizedRegistered.substring(0, 4)}****"`,
        );

        if (normalizedInput !== normalizedRegistered) {
          console.log(`❌ Phone mismatch — verification FAILED`);
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "Phone number does not match the registered number.",
          });
        }

        session.collected._phoneVerified = true;
        sessions.set(session.id, session);
        console.log(
          `✅ Phone verification PASSED — customer ${emailCustomerId} fully verified`,
        );
        return JSON.stringify({
          success: true,
          verified: true,
          customer_id: emailCustomerId,
        });
      }

      if (fn === "check_address_availability") {
        try {
          if (args.address) session.collected.address = args.address;
          return await checkAddressAvailability(args, session);
        } catch (err) {
          console.error("check_address_availability error:", err.message);
          return JSON.stringify({
            success: false,
            error: err.message,
            address: args.address,
          });
        }
      }

      if (fn === "create_ticket") {
        let fa = { ...args };
        if (typeof fa.message === "string")
          fa.message = { message: fa.message };

        const collected = session.collected || {};
        const hasCustomerId = !!(fa.customer_id || collected.customer_id);
        const hasLeadInterest = !!(collected.leadInterest || fa.leadInterest);
        const isSupportTicket = hasCustomerId && !hasLeadInterest;

        // --- GUARD: Block sales create_ticket if email is missing ---
        if (!isSupportTicket && !collected.email) {
          console.warn(
            "⚠️  create_ticket BLOCKED — email missing. Forcing email step.",
          );
          salesStep = "email";
          if (typeof unlockFinalMessage === "function") unlockFinalMessage();
          finalMessageLock = false;
          session.finalLock = false;
          const emailHint =
            buildSalesStepHint() ||
            "SALES STEP [email]: Ask for the customer email now. Tell them to use the text box on screen.";
          return JSON.stringify({
            success: false,
            _blocked: true,
            reason: "email_missing",
            message: emailHint,
          });
        }

        const detailLines = [];
        const fullName =
          [collected._firstName, collected._lastName]
            .filter(Boolean)
            .join(" ") ||
          collected.name ||
          collected.preferredName;
        if (fullName) detailLines.push(`Name: ${fullName}`);
        if (collected.email) detailLines.push(`Email: ${collected.email}`);
        if (collected.phone) detailLines.push(`Phone: ${collected.phone}`);
        if (collected.address)
          detailLines.push(`Address: ${collected.address}`);
        if (collected.networkPreference)
          detailLines.push(`Network: ${collected.networkPreference}`);
        if (collected.residentialPreference)
          detailLines.push(`Type: ${collected.residentialPreference}`);
        if (collected.leadInterest || fa.leadInterest)
          detailLines.push(
            `Selected Plan: ${collected.leadInterest || fa.leadInterest}`,
          );

        const detailsBlock =
          detailLines.length > 0
            ? `\n\n--- Customer Details ---\n${detailLines.join("\n")}`
            : "";

        if (fa.message?.message) {
          fa.message.message += detailsBlock;
        } else if (detailsBlock) {
          fa.message = { message: detailsBlock.trim() };
        }

        let ticketResult;
        try {
          if (isSupportTicket) {
            console.log(
              `📝 Creating SUPPORT ticket: "${fa.subject}" customer_id=${fa.customer_id}`,
            );
            const r = await splynx.request(
              "POST",
              "admin/support/tickets",
              objectToUrlEncoded(fa),
            );
            console.log(`✅ Splynx ticket created: ID=${r.id}`);
            const emailResult = await sendTicketEmail(
              r.id,
              fa,
              collected,
              true,
            );
            ticketResult = {
              success: true,
              ticket_id: r.id,
              email_sent: emailResult.sent,
              email_error: emailResult.reason || null,
              _isSalesTicket: false,
              _ticketCompleted: true,
            };
          } else {
            console.log(`📧 SALES inquiry — email only: "${fa.subject}"`);
            const emailResult = await sendTicketEmail(
              null,
              fa,
              collected,
              false,
            );
            ticketResult = {
              success: true,
              message: "Sales inquiry submitted successfully",
              email_sent: emailResult.sent,
              email_error: emailResult.reason || null,
              _isSalesTicket: true,
              _ticketCompleted: true,
            };
          }
        } catch (err) {
          console.error("❌ Create ticket/email failed:", err.message || err);
          ticketResult = {
            success: false,
            error: err.message || "Failed to process request",
            _ticketCompleted: true,
          };
        }

        return JSON.stringify(ticketResult);
      }

      if (fn === "get_ticket_types")
        return JSON.stringify({
          success: true,
          types: await splynx.request("GET", "admin/support/tickets-types"),
        });
      if (fn === "get_ticket_groups")
        return JSON.stringify({
          success: true,
          groups: await splynx.request("GET", "admin/support/tickets-groups"),
        });
      if (fn === "get_ticket_statuses")
        return JSON.stringify({
          success: true,
          statuses: await splynx.request(
            "GET",
            "admin/support/tickets-statuses",
          ),
        });

      return JSON.stringify({ error: `Unknown tool: ${fn}` });
    }

    // ══════════════════ Client Audio → OpenAI ══════════════════
    let lastAudioLog = 0;
    socket.on("audio_chunk", (b64) => {
      const shouldSuppress =
        awaitingStructuredInput ||
        pendingFunctionCalls > 0 ||
        session.finalLock ||
        finalMessageLock;

      if (shouldSuppress) return;

      const now = Date.now();
      if (now - lastAudioLog > 2000) {
        const state =
          ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][openaiWs?.readyState] ||
          "UNKNOWN";
        console.log(`🎤 [${socket.id}] [OpenAI: ${state}]`);
        lastAudioLog = now;
      }
      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(
          JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }),
        );
      }
    });

    // ══════════════════ Structured Input ══════════════════
    socket.on("structured_input", (payload) => {
      if (!payload || !payload.field || !payload.value) return;
      const { field, value } = payload;
      console.log(`📋 Structured input received: ${field} = "${value}"`);

      clearSilenceTimer();
      awaitingStructuredInput = false;
      structuredInputField = null;

      if (field !== "email") return;

      session.collected.email = value;
      sessions.set(session.id, session);

      if (salesStep === "email") {
        advanceSalesStep("email");
        console.log(`📋 Sales step: email collected via structured input`);
      }

      const userMessage = `My email is ${value}`;
      session.messages.push({ role: "user", content: userMessage });
      sessions.set(session.id, session);

      socket.emit("user_transcript", userMessage);

      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: userMessage }],
            },
          }),
        );
        scheduleResponseCreate();
      }

      socket.emit("structured_input_accepted", { field, value });
      socket.emit("status", "listening");
    });

    // ══════════════════ Cleanup ══════════════════
    socket.on("disconnect", () => {
      console.log(`📌 Disconnected: ${socket.id}`);
      clearSilenceTimer();
      if (finalMessageTimer) {
        clearTimeout(finalMessageTimer);
        finalMessageTimer = null;
      }
      closeElevenLabsWs();
      if (openaiWs)
        try {
          openaiWs.close();
        } catch (_) {}
      sessions.delete(session.id);
    });

    // ══════════════════ Boot ══════════════════
    (async () => {
      try {
        console.log("⏳ Connecting OpenAI Realtime...");
        await connectOpenAI();
        console.log(
          "✅ OpenAI connected! ElevenLabs pre-warmed. Waiting 200ms...",
        );
        socket.emit("connections_ready");
        await new Promise((r) => setTimeout(r, 200));

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
