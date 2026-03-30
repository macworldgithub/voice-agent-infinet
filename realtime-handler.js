import WebSocket from "ws";
import axios from "axios";

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
        // REST fallback returns raw PCM16 (little-endian) at 16kHz
        socket.emit("audio_chunk_pcm", { sampleRate: PCM_SAMPLE_RATE, audio: buf.toString("base64") });
        socket.emit("audio_done");
        assistantSpeaking = false;
        console.log(`🔊 [REST] Sent audio (${buf.length} bytes)`);
      } catch (err) {
        assistantSpeaking = false;
        const status = err?.response?.status;
        const detail = err?.response?.data || err?.message || err;
        console.error("[REST] ElevenLabs TTS failed:", status, detail);
        socket.emit("error_msg", "ElevenLabs REST TTS failed. Check API key/voice/model.");
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
              turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 800, prefix_padding_ms: 300 },
              tools: realtimeTools,
              tool_choice: "auto",
              input_audio_transcription: { model: "whisper-1" },
            },
          }));
        });

        openaiWs.on("message", (raw) => {
          try {
            const data = JSON.parse(raw.toString());
            // Resolve the connection promise on any initial valid data from OpenAI
            if (resolve) {
              resolve();
              resolve = null;
            }
            handleOpenAIEvent(data);
          }
          catch (e) { console.error("[WS-1] parse error:", e.message); }
        });

        openaiWs.on("error", (err) => { console.error("[WS-1] error:", err.message); reject(err); });
        openaiWs.on("close", (code) => { console.log(`[WS-1] closed (${code})`); });
      });
    }

    // ═══════════════ WEBSOCKET 2: ElevenLabs TTS (persistent) ═══════════════
    function connectElevenLabs() {
      return new Promise((resolve, reject) => {
        const url = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_flash_v2_5&output_format=pcm_16000`;
        elevenLabsWs = new WebSocket(url, {
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
          },
        });

        elevenLabsWs.on("open", () => {
          console.log("✅ [WS-2] ElevenLabs connected");
          // BOS: beginning of stream with API key and voice config
          elevenLabsWs.send(JSON.stringify({
            text: " ",
            voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.0, use_speaker_boost: true },
            generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
            // Keep for backward compatibility with older ElevenLabs WS auth
            xi_api_key: ELEVENLABS_API_KEY,
          }));
          elevenLabsReady = true;
          // If we buffered text while ElevenLabs was connecting, start sending now.
          if (ttsTextOutBuffer && !ttsSendTimer) {
            ttsSendTimer = setTimeout(() => {
              ttsSendTimer = null;
              sendTtsChunkNow({ flush: false });
            }, 0);
          }
          // Keep-alive every 10s so the connection doesn't timeout
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
            try {
              msg = JSON.parse(rawText);
            } catch (_) {
              // ElevenLabs may send non-JSON frames (pings/binary). Ignore safely.
              return;
            }

            if (msg?.error) {
              const emsg = msg.error?.message || msg.error || "ElevenLabs error";
              console.error("[WS-2] ElevenLabs error message:", emsg);
              socket.emit("error_msg", `ElevenLabs TTS error: ${emsg}`);
            }

            if (msg.audio) {
              if (!ttsInFlight && ttsChunks.length === 0) {
                // If we timed out or another request started, ignore delayed WS audio
                return;
              }
              // Store as buffer to avoid base64 concatenation issues
              ttsChunks.push(Buffer.from(msg.audio, "base64"));
              // Stream PCM chunk to frontend immediately for low-latency playback
              socket.emit("audio_chunk_pcm", { sampleRate: PCM_SAMPLE_RATE, audio: msg.audio });
            }

            const isFinal = msg.isFinal === true || msg.is_final === true || msg.final === true;
            if (isFinal) {
              if (ttsChunks.length > 0) {
                const fullBuffer = Buffer.concat(ttsChunks);
                // Only send audio_complete if we haven't already fallen back or finished
                if (ttsInFlight) {
                  socket.emit("audio_complete", fullBuffer.toString("base64"));
                  console.log(`🔊 [WS-2] Sent ${ttsChunks.length} audio chunks (${fullBuffer.length} bytes)`);
                }
                ttsChunks = [];
                ttsInFlight = false;
                if (ttsTimeout) { clearTimeout(ttsTimeout); ttsTimeout = null; }
              } else {
                console.warn("[WS-2] Final received but no audio chunks were produced");
                socket.emit("error_msg", "ElevenLabs produced no audio. Check voice/model configuration.");
                // Fallback: generate via REST so the user still hears something.
                ttsInFlight = false;
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

    // Send text to ElevenLabs persistent WS — flush triggers audio, connection stays open
    function speakViaElevenLabs(text) {
      if (!text?.trim() || !elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) {
        console.warn("[WS-2] Cannot speak — ElevenLabs not connected");
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
        ttsInFlight = false; // Mark as false so subsequent WS chunks are ignored
        speakViaElevenLabsRest(lastTtsText);
      }, 7000);

      socket.emit("status", "speaking");
      console.log(`🗣️ [WS-2] Speaking: "${text.substring(0, 80)}..."`);
      assistantSpeaking = true;
      elevenLabsWs.send(JSON.stringify({ text: text, try_trigger_generation: true }));
      // flush forces immediate audio generation — connection stays open
      elevenLabsWs.send(JSON.stringify({ text: "", flush: true }));
    }

    function clearTtsStreamingState() {
      ttsTextOutBuffer = "";
      ttsStartedForResponse = false;
      if (ttsSendTimer) {
        clearTimeout(ttsSendTimer);
        ttsSendTimer = null;
      }
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
      // Always buffer text, even if ElevenLabs isn't ready yet (prevents losing first words)
      ttsTextOutBuffer += delta;
      if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN || !elevenLabsReady) {
        return;
      }

      // Send quickly but not on every token: debounce ~120ms.
      if (ttsSendTimer) return;
      ttsSendTimer = setTimeout(() => {
        ttsSendTimer = null;
        sendTtsChunkNow({ flush: false });
      }, 120);
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
          // Ignore speech detection during the very first part of assistant speech (mitigate echo)
          // or if the assistant has just started responding.
          if (assistantSpeaking) {
            console.log("🤫 VAD detection during assistant speech (potential echo suppression)");
            // We still emit barge-in events, but maybe delay them?
            // For now, let's just allow it but ensure assistantSpeaking is true
          }
          socket.emit("status", "user_speaking");
          socket.emit("interrupt");
          socket.emit("audio_interrupt");
          // Reset any in-progress TTS chunking for the previous response.
          clearTtsStreamingState();
          // Strong reset for current voice generation
          ttsChunks = [];
          lastTtsText = "";
          ttsInFlight = false;
          assistantSpeaking = false;
          if (ttsTimeout) { clearTimeout(ttsTimeout); ttsTimeout = null; }
          if (ttsSendTimer) { clearTimeout(ttsSendTimer); ttsSendTimer = null; }
          try {
            if (elevenLabsWs?.readyState === WebSocket.OPEN) {
              // Attempt to terminate any in-flight generation
              elevenLabsWs.send(JSON.stringify({ text: "", flush: true }));
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
              // Prevent the assistant's own voice (speaker echo) from being treated as user input.
              // If the user actually barges in, OpenAI will emit speech_started and we clear assistantSpeaking.
              if (assistantSpeaking && !(looksLikeEmail || looksLikePhone)) {
                console.log(`🔇 Ignoring transcript during assistant speech: "${cleaned.substring(0, 80)}..."`);
                break;
              }
              if (assistantSpeaking && (looksLikeEmail || looksLikePhone)) {
                console.log(`🟡 Transcript during assistant speech allowed (identifier detected): "${cleaned.substring(0, 80)}..."`);
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
            // Start speaking ASAP: stream deltas into ElevenLabs.
            queueTtsDelta(event.delta);
          }
          break;

        case "response.text.done":
          if (event.text) {
            console.log(`🤖 AI: "${event.text.substring(0, 100)}..."`);
            session.messages.push({ role: "assistant", content: event.text });
            sessions.set(session.id, session);
            socket.emit("assistant_text_done", event.text);
          }
          break;

        case "response.output_item.done":
          if (event.item?.type === "function_call") {
            pendingFunctionCalls++;
            handleFunctionCall(event.item);
          }
          break;

        case "response.done":
          if (pendingFunctionCalls === 0 && assistantTextBuffer.trim()) {
            // Finish any pending streamed chunks, then flush.
            if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
              // Start timeout window on first real response audio generation.
              if (!ttsInFlight) {
                ttsInFlight = true;
                if (ttsTimeout) clearTimeout(ttsTimeout);
                lastTtsText = lastTtsText || "";
                ttsTimeout = setTimeout(() => {
                  if (!ttsInFlight) return;
                  console.warn("[WS-2] TTS timeout — falling back to REST");
                  ttsInFlight = false;
                  speakViaElevenLabsRest(assistantTextBuffer);
                }, 9000);
              }
              if (ttsSendTimer) {
                clearTimeout(ttsSendTimer);
                ttsSendTimer = null;
              }
              sendTtsChunkNow({ flush: true });
              clearTtsStreamingState();
            } else {
              // WS not available: do one-shot REST TTS.
              speakViaElevenLabsRest(assistantTextBuffer);
            }
            // Ensure status returns to listening if we have a mic open
            if (!pendingFunctionCalls) {
              socket.emit("status", "listening");
            }
          } else {
            clearTtsStreamingState();
            if (!pendingFunctionCalls) {
              socket.emit("status", "listening");
            }
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
      try { result = await execTool(fn, args); }
      catch (err) { result = JSON.stringify({ success: false, error: err.message }); }

      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id, output: result } }));
        openaiWs.send(JSON.stringify({ type: "response.create" }));
      }
      pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
    }

    async function execTool(fn, args) {
      if (fn === "extract_call_fields") { applyExtractionToSession(session, args); return JSON.stringify({ success: true }); }
      if (fn === "get_internet_plans") {
        const t = await fetchTariffs();
        return JSON.stringify({ success: true, plans: t.map(x => ({ id: x.id, title: x.title, price: parseFloat(x.price), download: `${x.speed_download / 1000} Mbps`, upload: `${x.speed_upload / 1000} Mbps`, available_for_locations: x.available_for_locations || [] })) });
      }
      if (fn === "check_address_availability") {
        if (!args.address) return JSON.stringify({ error: "Address is required" });
        const locId = await determineLocationId(args.address);
        const t = await fetchTariffs();
        const avail = locId ? t.filter(x => x.available_for_locations?.includes(locId)) : [];
        return JSON.stringify({ success: true, address: args.address, locationId: locId, locationName: LOCATIONS.find(l => l.id === locId)?.name || "Unknown", availablePlans: avail.map(p => ({ title: p.title, price: parseFloat(p.price), download: `${p.speed_download / 1000} Mbps`, upload: `${p.speed_upload / 1000} Mbps` })) });
      }
      if (fn === "customer_lookup") return JSON.stringify(await customerLookup(args));
      if (fn === "create_ticket") {
        let fa = { ...args }; if (typeof fa.message === "string") fa.message = { message: fa.message };
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
      const now = Date.now();
      if (now - lastAudioLog > 2000) {
        // Calculate Volume (RMS)
        let rms = 0;
        try {
          const bin = Buffer.from(b64, "base64");
          const i16 = new Int16Array(bin.buffer, bin.byteOffset, Math.floor(bin.length / 2));
          let sum = 0;
          for (let i = 0; i < i16.length; i++) sum += i16[i] * i16[i];
          rms = Math.sqrt(sum / i16.length) / 32768;
        } catch (_) {}

        const state = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][openaiWs?.readyState] || "UNKNOWN";
        console.log(`🎤 [${socket.id}] [Vol: ${(rms * 100).toFixed(1)}%] [OpenAI: ${state}]`);
        lastAudioLog = now;
      }
      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
      }
    });

    // ═══════════════ Cleanup ═══════════════
    socket.on("disconnect", () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
      clearInterval(keepAliveTimer);
      if (ttsTimeout) { clearTimeout(ttsTimeout); ttsTimeout = null; }
      if (openaiWs) try { openaiWs.close(); } catch (_) { }
      if (elevenLabsWs) try { elevenLabsWs.send(JSON.stringify({ text: "" })); elevenLabsWs.close(); } catch (_) { }
      sessions.delete(session.id);
    });

    // ═══════════════ Boot: connect BOTH WebSockets, then 2s delay, then greet ═══════════════
    (async () => {
      try {
        console.log("⏳ Connecting both WebSockets...");
        await Promise.all([connectOpenAI(), connectElevenLabs()]);
        console.log("✅ Both WebSockets connected! Waiting 2s for stability...");
        socket.emit("connections_ready");

        // 2 second delay for stability
        await new Promise(r => setTimeout(r, 2000));

        // Now send greeting ONLY IF not already greeted
        if (!session.hasGreeted) {
          const greeting = "Hi there! Welcome to InfiNET Broadband. Could you please share your name to get started?";
          if (openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
              type: "conversation.item.create",
              item: { type: "message", role: "assistant", content: [{ type: "text", text: greeting }] },
            }));
          }
          session.hasGreeted = true;
          session.messages.push({ role: "assistant", content: greeting });
          sessions.set(session.id, session);
          socket.emit("assistant_text_done", greeting);
          speakViaElevenLabs(greeting);
        } else {
          console.log("ℹ️ Skipping redundant greeting for existing session.");
          socket.emit("status", "listening");
        }
      } catch (err) {
        console.error("❌ Connection failed:", err.message);
        socket.emit("error_msg", "Failed to connect to AI services");
      }
    })();
  });
}
