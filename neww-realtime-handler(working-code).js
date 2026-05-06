import WebSocket from "ws";
// ═══════════════════════════════════════════════════════════════════════════
//  DEBUG LOGGER — structured, timestamped, flow-aware
// ═══════════════════════════════════════════════════════════════════════════
function dbg(flow, step, status, data = {}) {
  const ts = new Date().toISOString();
  const dataParts = Object.entries(data)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(" ");
  console.log(
    `[${ts}][FLOW:${flow}][STEP:${step}][STATUS:${status}] ${dataParts}`,
  );
}
// ═══════════════════════════════════════════════════════════════════════════
//  VOICE EMAIL CAPTURE — NATO PHONETIC PARSER + ASSEMBLER
// ═══════════════════════════════════════════════════════════════════════════
const DOMAIN_SHORTCUTS = {
  gmail: "gmail.com",
  "gmail dot com": "gmail.com",
  "google mail": "gmail.com",
  yahoo: "yahoo.com",
  "yahoo dot com": "yahoo.com",
  hotmail: "hotmail.com",
  "hotmail dot com": "hotmail.com",
  outlook: "outlook.com",
  "outlook dot com": "outlook.com",
  icloud: "icloud.com",
  "icloud dot com": "icloud.com",
  live: "live.com",
  "live dot com": "live.com",
  protonmail: "protonmail.com",
  "proton mail": "protonmail.com",
  bigpond: "bigpond.com",
  "bigpond dot com": "bigpond.com",
  optusnet: "optusnet.com.au",
  tpg: "tpg.com.au",
  bele: "bele.ai",
};

// FIX P4e: Strip filler words AND AI speech leakage before parsing email
function stripEmailFillers(text) {
  if (!text) return text;
  return (
    text
      // FIX P4e: Remove common AI speech leakage patterns captured by mic
      .replace(
        /\b(of\s+ai|for\s+example|for\s+instance|listen\s*,?|go\s+ahead|spelling\s+mode|letter\s+by\s+letter)\b/gi,
        " ",
      )
      .replace(
        /\b(okay|ok|my email(?: address| is)?|the email(?: address| is)?|email is|address is|it'?s|it is|so|well|right|sure|actually|basically|i think|i believe|let me|let's see|umm?|uh+|hmm?|ah+)\b/gi,
        " ",
      )
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

function parseVoiceEmail(transcript) {
  if (!transcript) return null;
  let raw = transcript.toLowerCase().trim();

  const directEmail = raw.match(/\b([^\s@]+@[^\s@]+\.[^\s@]{2,})\b/);
  if (directEmail) return directEmail[1].toLowerCase();

  // FIX P4a: Expand hyphenated spelled-out letter sequences FIRST
  // e.g. "S-H-A-U-N" → "s h a u n", "B-E-L-E" → "b e l e"
  raw = raw.replace(
    /(?<![a-z0-9])([a-z])(?:-([a-z]))+(?![a-z0-9])/gi,
    (match) => {
      return match.toLowerCase().split("-").join(" ");
    },
  );

  raw = raw
    .replace(/\bfull\s+stop\b/gi, " dot ")
    .replace(/\bat\s+sign\b/gi, " at ")
    .replace(/\bunder\s+score\b/gi, " underscore ")
    .replace(/\bdouble\s+u\b/gi, " w ")
    .replace(/\bdouble\s+([a-z])\b/gi, (_, ch) => ` ${ch} ${ch} `)
    .replace(/\bcomma\b/gi, "")
    .replace(/[,;'"]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  let domainReplaced = raw;
  for (const [spoken, actual] of Object.entries(DOMAIN_SHORTCUTS)) {
    const re = new RegExp(`\\b${spoken.replace(/\./g, "\\.")}\\b`, "gi");
    domainReplaced = domainReplaced.replace(re, actual);
  }
  raw = domainReplaced;

  const tokens = raw.split(/\s+/).filter(Boolean);
  const parts = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (/^[a-z0-9._@+-]+\.[a-z]{2,}$/.test(tok)) {
      parts.push(tok);
      continue;
    }
    if (/^[a-z]$/.test(tok) || /^\d$/.test(tok)) {
      parts.push(tok);
      continue;
    }
    if (/^\d{2,}$/.test(tok)) {
      parts.push(tok);
      continue;
    }
    if (NATO_MAP.hasOwnProperty(tok)) {
      const val = NATO_MAP[tok];
      if (val !== null) parts.push(val);
      continue;
    }
    if (/^[a-z]{2,6}(\.[a-z]{2,6})?$/.test(tok)) {
      parts.push(tok);
      continue;
    }
    parts.push(tok);
  }

  let email = parts.join("");
  email = email
    .replace(/@+/g, "@")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.\-_]+/, "")
    .replace(/[.\-_]+@/, "@")
    .replace(/@[.\-_]+/, "@")
    .replace(/[.\-_]+$/, "");

  if (!email.includes("@")) return null;
  const [local, domain] = email.split("@");
  if (!local || local.length < 1) return null;
  if (!domain || !domain.includes(".")) return null;
  if (domain.endsWith(".")) return null;

  return email.toLowerCase();
}

function looksLikeVoiceEmailSpelling(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(lower)) return true;
  if (
    /\bat\s+(gmail|yahoo|hotmail|outlook|icloud|bigpond|optusnet|tpg|live|proton|bele)/.test(
      lower,
    )
  )
    return true;
  const natoCount = (
    lower.match(
      /\b(alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliet|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|xray|yankee|zulu)\b/gi,
    ) || []
  ).length;
  if (natoCount >= 2 && /\bat\b/.test(lower)) return true;
  const words = lower.split(/\s+/);
  const hasAt = words.includes("at");
  const hasDot =
    words.includes("dot") || words.includes("period") || words.includes("stop");
  const singleLetterCount = words.filter((w) => /^[a-z]$/.test(w)).length;
  if (hasAt && hasDot && singleLetterCount >= 2) return true;
  // FIX P4: Also detect hyphenated spelling like "S-H-A-U-N at B-E-L-E dot A-I"
  const hyphenSpellingCount = (lower.match(/\b[a-z]-[a-z]\b/g) || []).length;
  if (hyphenSpellingCount >= 2 && hasAt) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
//  FSM STATES
// ═══════════════════════════════════════════════════════════════════════════
const FSM_STATE = {
  IDLE: "IDLE",
  SPEAKING: "SPEAKING",
  LISTENING: "LISTENING",
  EMAIL_CAPTURE: "EMAIL_CAPTURE",
  EMAIL_CONFIRMATION: "EMAIL_CONFIRMATION",
  PACKAGE_PRESENTATION: "PACKAGE_PRESENTATION",
  TOOL_EXECUTING: "TOOL_EXECUTING",
  FINAL: "FINAL",
};

// ═══════════════════════════════════════════════════════════════════════════
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
    console.log(`🔌 Voice client connected: ${socket.id}`);
    console.log(`📊 [DEBUG] New connection - initializing handlers`);

    const session = mkSession();

    let openaiWs = null;

    // ─── ElevenLabs state ─────────────────────────────────────────
    let elevenLabsWs = null;
    let elevenLabsReady = false;
    let textBuffer = [];
    let elevenLabsStreaming = false;

    let assistantTextBuffer = "";
    let pendingFunctionCalls = 0;
    let lastTtsText = "";
    let isResponseActive = false;
    let assistantSpeaking = false;
    let awaitingStructuredInput = false;
    let structuredInputField = null;

    const PCM_SAMPLE_RATE = 16000;
    let lastAssistantText = "";

    let emptyResponseCount = 0;
    const MAX_EMPTY_RETRIES = 3;

    let cancelPending = false;

    let currentResponseId = null;
    let currentResponseHadOutput = false;

    let pendingPostDoneCreate = false;
    let pendingPostDoneHint = null;

    let salesStep = null;

    let lastResponseWasPackage = false;

    // ═══════════════════════════════════════════════════════════════
    //  UNIFIED EMAIL STATE
    // ═══════════════════════════════════════════════════════════════
    const email_state = {
      value: "",
      is_confirmed: false,
    };

    function setEmailValue(newEmail) {
      const prev = email_state.value;
      email_state.value = newEmail;
      email_state.is_confirmed = false;
      dbg("sales", "email_state_set", "overwrite", {
        prev,
        next: newEmail,
        confirmed: false,
        salesStep,
        createTicketBlockedForEmail: "see_closure",
      });
    }

    function confirmEmail() {
      email_state.is_confirmed = true;
      session.collected.email = email_state.value;
      sessions.set(session.id, session);
      dbg("sales", "email_confirmed", "success", {
        email: email_state.value,
        is_confirmed: true,
        session_email: session.collected.email,
        salesStep,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    //  FINITE STATE MACHINE
    // ═══════════════════════════════════════════════════════════════
    let fsmState = FSM_STATE.IDLE;

    function transitionFSM(newState) {
      const prev = fsmState;
      fsmState = newState;
      dbg(session?.collected?.intent || "unknown", "fsm_transition", "ok", {
        from: prev,
        to: newState,
      });
      socket.emit("fsm_state", newState);
    }

    function debugState(label = "state_snapshot") {
      const c = session.collected || {};
      dbg(c.intent || "unknown", label, "snapshot", {
        fsmState,
        salesStep,
        "email_state.value": email_state.value,
        "email_state.is_confirmed": email_state.is_confirmed,
        createTicketBlockedForEmail,
        pendingFunctionCalls,
        isResponseActive,
        assistantSpeaking,
        elevenLabsStreaming,
        intent: c.intent || "none",
        leadInterest: c.leadInterest || "none",
        websiteCheckDone: c._websiteCheckDone || false,
        "session.collected.email": c.email || "",
        "session.collected.phone": c.phone || "",
        _firstName: c._firstName || "",
        _lastName: c._lastName || "",
      });
    }

    // ═══════════════════════════════════════════════════════════════
    //  CENTRAL TIMER MANAGER
    // ═══════════════════════════════════════════════════════════════
    const TimerManager = (() => {
      let _silenceTimer = null;
      let _emailConfirmTimer = null;
      let _finalMessageTimer = null;
      let _watchdogTimer = null;

      const SILENCE_NORMAL_MS = 15000;
      const SILENCE_PACKAGE_MS = 20000;
      const EMAIL_CONFIRM_MS = 30000;
      const WATCHDOG_MS = 8000;

      function _clearSilence() {
        if (_silenceTimer) {
          clearTimeout(_silenceTimer);
          _silenceTimer = null;
          console.log(`⏱️  [TMgr] Silence timer CLEARED`);
        }
      }
      function _clearEmailConfirm() {
        if (_emailConfirmTimer) {
          clearTimeout(_emailConfirmTimer);
          _emailConfirmTimer = null;
          console.log(`⏱️  [TMgr] Email confirm timer CLEARED`);
        }
      }
      function _clearFinalMessage() {
        if (_finalMessageTimer) {
          clearTimeout(_finalMessageTimer);
          _finalMessageTimer = null;
        }
      }
      function _clearWatchdog() {
        if (_watchdogTimer) {
          clearTimeout(_watchdogTimer);
          _watchdogTimer = null;
        }
      }

      return {
        startSilence(isPackage = false) {
          _clearSilence();
          console.log(
            `⏱️  [TMgr] startSilence called - isPackage=${isPackage}`,
          );
          if (
            fsmState === FSM_STATE.EMAIL_CAPTURE ||
            fsmState === FSM_STATE.EMAIL_CONFIRMATION ||
            fsmState === FSM_STATE.SPEAKING ||
            fsmState === FSM_STATE.TOOL_EXECUTING ||
            fsmState === FSM_STATE.FINAL
          ) {
            console.log(
              `⏱️  [TMgr] Silence timer suppressed (FSM: ${fsmState})`,
            );
            return;
          }
          if (awaitingStructuredInput) return;
          if (finalMessageLock || session.finalLock) return;
          if (pendingFunctionCalls > 0) return;
          if (elevenLabsStreaming) {
            console.log(`⏱️  [TMgr] Silence timer suppressed (EL streaming)`);
            return;
          }
          if (assistantSpeaking) return;

          const timeoutMs = isPackage ? SILENCE_PACKAGE_MS : SILENCE_NORMAL_MS;
          console.log(
            `⏱️  [TMgr] Silence timer START: ${timeoutMs / 1000}s (${isPackage ? "package" : "normal"}) [FSM: ${fsmState}]`,
          );

          _silenceTimer = setTimeout(() => {
            _silenceTimer = null;
            if (fsmState === FSM_STATE.EMAIL_CAPTURE) return;
            if (fsmState === FSM_STATE.EMAIL_CONFIRMATION) return;
            if (fsmState === FSM_STATE.SPEAKING) return;
            if (fsmState === FSM_STATE.TOOL_EXECUTING) return;
            if (fsmState === FSM_STATE.FINAL) return;
            if (awaitingStructuredInput) return;
            if (finalMessageLock || session.finalLock) return;
            if (pendingFunctionCalls > 0) return;
            if (assistantSpeaking) return;
            if (elevenLabsStreaming) return;

            const nudgeText = isPackage
              ? "[CRITICAL_SILENCE_NUDGE] User has NOT responded after you presented plans. ABSOLUTELY DO NOT auto-select or assume a plan. User MUST explicitly tell you which plan they want. Ask clearly: 'Which of these plans would you like to go with?' or 'Which one catches your eye?' and WAIT for their explicit choice."
              : "[SILENCE_NUDGE] The user has not responded. REPEAT your last question. Do NOT move forward.";

            console.log(
              `⏰ [TMgr] Silence fired (${timeoutMs / 1000}s) — nudging AI`,
            );
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
        },

        resetSilence() {
          _clearSilence();
          console.log(`⏱️  [TMgr] User input detected → timer reset`);
        },
        clearSilence: _clearSilence,

        startEmailConfirm() {
          _clearEmailConfirm();
          console.log(
            `⏱️  [TMgr] Email confirm timer START (${EMAIL_CONFIRM_MS / 1000}s)`,
          );
          _emailConfirmTimer = setTimeout(() => {
            _emailConfirmTimer = null;
            if (fsmState !== FSM_STATE.EMAIL_CONFIRMATION) return;
            console.log(`⏰ [TMgr] Email confirm timeout — re-asking`);
            if (openaiWs?.readyState === WebSocket.OPEN) {
              openaiWs.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "user",
                    content: [
                      {
                        type: "input_text",
                        text: `[SYSTEM_CONTEXT]: The customer hasn't responded to the email confirmation. Re-read the email back: "${email_state.value}" — spell each letter individually with hyphens, say "at" for @, say "dot" for full stops. Never say "double X". Ask again if it's correct.`,
                      },
                    ],
                  },
                }),
              );
              scheduleResponseCreate();
            }
          }, EMAIL_CONFIRM_MS);
        },

        clearEmailConfirm: _clearEmailConfirm,

        startWatchdog() {
          _clearWatchdog();
          _watchdogTimer = setTimeout(() => {
            _watchdogTimer = null;
            if (!isResponseActive && pendingFunctionCalls === 0) {
              console.warn(
                `⚠️ [TMgr] Watchdog fired — agent stuck, triggering recovery`,
              );
              if (openaiWs?.readyState === WebSocket.OPEN) {
                openaiWs.send(
                  JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "message",
                      role: "user",
                      content: [
                        {
                          type: "input_text",
                          text: "[SYSTEM_CONTEXT]: Please respond immediately to the last user message.",
                        },
                      ],
                    },
                  }),
                );
                scheduleResponseCreate(null, 0, true);
              }
            }
          }, WATCHDOG_MS);
        },

        clearWatchdog: _clearWatchdog,

        startFinalLock(durationMs = 15000, onRelease) {
          _clearFinalMessage();
          finalMessageLock = true;
          session.finalLock = true;
          _clearSilence();
          console.log(`🔒 [TMgr] Final message lock ON (${durationMs}ms)`);
          _finalMessageTimer = setTimeout(() => {
            _finalMessageTimer = null;
            finalMessageLock = false;
            session.finalLock = false;
            console.log("🔓 [TMgr] Final message lock auto-released");
            socket.emit("status", "listening");
            if (onRelease) onRelease();
          }, durationMs);
        },

        releaseFinalLock() {
          if (!finalMessageLock && !session.finalLock) return;
          finalMessageLock = false;
          session.finalLock = false;
          _clearFinalMessage();
          console.log("🔓 [TMgr] Final message lock released");
        },

        clearAll() {
          _clearSilence();
          _clearEmailConfirm();
          _clearFinalMessage();
          _clearWatchdog();
        },

        get hasSilenceTimer() {
          return _silenceTimer !== null;
        },
        get hasEmailConfirmTimer() {
          return _emailConfirmTimer !== null;
        },
      };
    })();

    // ─── Final message lock flags ──────────────────────────────────
    let finalMessageLock = false;

    // ═══════════════════════════════════════════════════════════════
    //  EMAIL CAPTURE — Simplified. System prompt handles logic based on salesStep.
    //  Only email_state (value + is_confirmed) is tracked here.
    // ═══════════════════════════════════════════════════════════════
    let createTicketBlockedForEmail = false;

    function startEmailCapture() {
      dbg("sales", "startEmailCapture", "initiated", {
        current_email: email_state.value,
        is_confirmed: email_state.is_confirmed,
        salesStep,
      });

      // If email not yet confirmed, reset and ask for it fresh
      if (!email_state.is_confirmed) {
        email_state.value = "";
        email_state.is_confirmed = false;
      }
      // If already confirmed, preserve it (won't be called in this state anyway)

      createTicketBlockedForEmail = true;
      TimerManager.clearSilence();
      TimerManager.clearEmailConfirm();
      transitionFSM(FSM_STATE.EMAIL_CAPTURE);
      socket.emit("email_spelling_mode", { active: true });
    }

    function resetEmailCapture() {
      dbg("sales", "resetEmailCapture", "cleared", {
        email: email_state.value,
        is_confirmed: email_state.is_confirmed,
      });
      TimerManager.clearEmailConfirm();
      transitionFSM(FSM_STATE.LISTENING);
      socket.emit("email_spelling_mode", { active: false });
    }

    function handleEmailCaptureTranscript(text) {
      if (
        fsmState !== FSM_STATE.EMAIL_CAPTURE &&
        fsmState !== FSM_STATE.EMAIL_CONFIRMATION
      ) {
        dbg("sales", "handleEmailCaptureTranscript", "skipped", {
          reason: "not_in_email_fsm_state",
          fsmState,
        });
        return false;
      }

      const cleaned = normalizeText(text);
      if (!cleaned) {
        dbg("sales", "handleEmailCaptureTranscript", "skipped", {
          reason: "empty_transcript",
        });
        return true;
      }

      dbg("sales", "handleEmailCaptureTranscript", "processing", {
        input: cleaned,
        fsmState,
        email_confirmed: email_state.is_confirmed,
        email_value: email_state.value,
      });

      // ── Phase 2: Waiting for YES/NO confirmation (fsmState = EMAIL_CONFIRMATION) ────
      if (fsmState === FSM_STATE.EMAIL_CONFIRMATION) {
        dbg("sales", "email_confirmation_phase", "awaiting_yesno", {
          email: email_state.value,
          input: cleaned,
        });
        TimerManager.clearEmailConfirm();

        const lower = cleaned.toLowerCase().trim();
        const isYes =
          /\b(yes|yeah|yep|yup|correct|that'?s right|that is correct|right|confirm|confirmed|affirmative|go ahead|sounds good)\b/.test(
            lower,
          );
        const isNo =
          /\b(no|nope|wrong|incorrect|that'?s wrong|not right|try again|redo|different|change|mistake)\b/.test(
            lower,
          );

        dbg("sales", "email_yesno_detection", "result", {
          input: lower,
          isYes,
          isNo,
          email: email_state.value,
        });

        if (isYes) {
          dbg("sales", "emailCapture_YES", "confirmed", {
            email: email_state.value,
            salesStep,
          });

          confirmEmail();
          createTicketBlockedForEmail = false;

          if (salesStep === "email") advanceSalesStep("email");

          const userMsg = `My email address is ${email_state.value}`;
          session.messages.push({ role: "user", content: userMsg });
          sessions.set(session.id, session);
          socket.emit("user_transcript", userMsg);

          resetEmailCapture();

          if (openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "user",
                  content: [{ type: "input_text", text: userMsg }],
                },
              }),
            );
            scheduleResponseCreate();
          }
          return true;
        }

        if (isNo) {
          dbg("sales", "email_confirmation_rejected", "user_said_no", {
            rejectedEmail: email_state.value,
          });

          email_state.value = "";
          email_state.is_confirmed = false;
          createTicketBlockedForEmail = true;

          // Check if user provided inline correction
          const afterNo = cleaned
            .replace(
              /^.*?\b(no|nope|wrong|incorrect|that'?s wrong|not right)\b[,.]?\s*/i,
              "",
            )
            .trim();
          const strippedAfterNo = stripEmailFillers(afterNo);

          if (strippedAfterNo && looksLikeVoiceEmailSpelling(strippedAfterNo)) {
            dbg("sales", "email_no_with_inline_correction", "parsing_inline", {
              afterNo: strippedAfterNo,
            });
            const parsedInline = parseVoiceEmail(strippedAfterNo);
            if (parsedInline) {
              setEmailValue(parsedInline);
              socket.emit("email_spelling_confirmation", {
                email: parsedInline,
              });
              transitionFSM(FSM_STATE.EMAIL_CONFIRMATION);
              TimerManager.startEmailConfirm();
              if (openaiWs?.readyState === WebSocket.OPEN) {
                const [local, domain] = parsedInline.split("@");
                openaiWs.send(
                  JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "message",
                      role: "user",
                      content: [
                        {
                          type: "input_text",
                          text: `[SYSTEM_CONTEXT]: Customer corrected email inline to "${parsedInline}". Read back exact letters only: local="${local}" spell with hyphens, say "at", domain="${domain}" spell with dots. Ask "is that correct?" ONLY.`,
                        },
                      ],
                    },
                  }),
                );
                scheduleResponseCreate();
              }
              return true;
            }
          }

          // No inline correction — ask to spell again
          if (openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "user",
                  content: [
                    {
                      type: "input_text",
                      text: `[SYSTEM_CONTEXT]: Customer said the email was wrong. Ask them to spell the COMPLETE email again from the beginning, one letter at a time. For @ say 'at', for . say 'dot'. Never say "double X" — always spell each letter separately.`,
                    },
                  ],
                },
              }),
            );
            scheduleResponseCreate();
          }
          transitionFSM(FSM_STATE.EMAIL_CAPTURE);
          return true;
        }

        // Ambiguous response — re-ask yes/no
        dbg("sales", "email_confirmation_ambiguous", "re_asking_yesno", {
          input: cleaned,
        });
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `[SYSTEM_CONTEXT]: Customer's response was unclear ("${cleaned}"). Pending email: "${email_state.value}". Read it back using individual letters and ask ONLY "is that correct?" Wait for yes or no.`,
                  },
                ],
              },
            }),
          );
          scheduleResponseCreate();
        }
        return true;
      }

      // ── Phase 1: Parse the spoken email (fsmState = EMAIL_CAPTURE) ───
      const cleanedForEmail = stripEmailFillers(cleaned);
      dbg("sales", "email_filler_stripped", "result", {
        original: cleaned,
        stripped: cleanedForEmail,
      });

      if (!cleanedForEmail || cleanedForEmail.length < 2) {
        dbg("sales", "email_parse_skipped", "empty_after_strip");
        return true;
      }

      const parsed = parseVoiceEmail(cleanedForEmail);

      dbg("sales", "email_parse_result", parsed ? "success" : "failed", {
        parsed,
        raw: cleanedForEmail,
      });

      if (!parsed) {
        dbg("sales", "email_parse_failed", "no_email_found", {
          combined: cleanedForEmail,
        });
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `[SYSTEM_CONTEXT]: Couldn't parse email from: "${cleanedForEmail}". Ask customer to repeat from the beginning, one letter at a time. For @ say 'at', for . say 'dot'.`,
                  },
                ],
              },
            }),
          );
          scheduleResponseCreate();
        }
        return true;
      }

      setEmailValue(parsed);
      dbg("sales", "email_parsed_requesting_confirmation", "ok", {
        email: parsed,
      });

      socket.emit("email_spelling_confirmation", { email: parsed });
      transitionFSM(FSM_STATE.EMAIL_CONFIRMATION);
      TimerManager.startEmailConfirm();

      if (openaiWs?.readyState === WebSocket.OPEN) {
        const [local, domain] = parsed.split("@");
        openaiWs.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `[SYSTEM_CONTEXT]: Email parsed as "${parsed}". Read back exact letters only: "${local}" spelled with hyphens (e.g. s-h-a-u-n), say "at", then "${domain}" with "dot" for periods (e.g. b-e-l-e dot a-i). Format: "I've got s-h-a-u-n at b-e-l-e dot a-i — is that correct?" Wait for yes or no ONLY. Never say "double X".`,
                },
              ],
            },
          }),
        );
        scheduleResponseCreate();
      }

      return true;
    }

    // ─── Sales step machine ────────────────────────────────────────
    function initSalesStepMachine() {
      if (salesStep !== null) {
        dbg("sales", "initSalesStepMachine", "skipped", {
          reason: "already_initialized",
          salesStep,
        });
        return;
      }
      const c = session.collected || {};

      if (c.leadInterest && c._websiteCheckDone) {
        // FIX: Check any name field, not just _firstName/_lastName
        const hasFirstName =
          c._firstName ||
          c.preferredName ||
          (c.name && c.name.trim().length >= 2);
        const hasLastName =
          c._lastName || (c.name && c.name.trim().split(/\s+/).length >= 2);

        if (!hasFirstName) salesStep = "firstName";
        else if (!hasLastName) salesStep = "lastName";
        else if (!c.phone) salesStep = "phone";
        else if (!c.email || !email_state.is_confirmed) salesStep = "email";
        else salesStep = "createTicket";
        dbg("sales", "initSalesStepMachine", "initialized", {
          startStep: salesStep,
          websiteCheckDone: true,
          _firstName: c._firstName || "",
          _lastName: c._lastName || "",
          phone: c.phone || "",
          email: c.email || "",
          emailConfirmed: email_state.is_confirmed,
        });
      } else {
        dbg("sales", "initSalesStepMachine", "blocked", {
          leadInterest: !!c.leadInterest,
          websiteCheckDone: !!c._websiteCheckDone,
        });
      }
    }

    function advanceSalesStep(completedStep) {
      const c = session.collected || {};
      dbg("sales", "advanceSalesStep_ENTRY", "called", {
        completedStep,
        salesStep,
        "email_state.is_confirmed": email_state.is_confirmed,
        "session.collected.email": c.email || "",
        "session.collected.phone": c.phone || "",
        _firstName: c._firstName || "",
        _lastName: c._lastName || "",
      });

      if (salesStep !== completedStep) {
        dbg("sales", "advanceSalesStep_MISMATCH", "no_op", {
          completedStep,
          currentSalesStep: salesStep,
          reason: "salesStep !== completedStep",
        });
        return;
      }

      const order = [
        "firstName",
        "lastName",
        "phone",
        "email",
        "createTicket",
        "done",
      ];
      const idx = order.indexOf(completedStep);
      if (idx === -1) {
        dbg("sales", "advanceSalesStep", "unknown_step", { completedStep });
        return;
      }
      const next = order[idx + 1];
      if (!next) {
        salesStep = "done";
        dbg("sales", "advanceSalesStep_RESULT", "done", {
          from: completedStep,
        });
        return;
      }

      if (next === "lastName" && c._lastName) {
        dbg("sales", "advanceSalesStep_SKIP", "lastName_already_set", {
          _lastName: c._lastName,
        });
        advanceSalesStep("lastName");
        return;
      }
      if (next === "phone" && c.phone) {
        dbg("sales", "advanceSalesStep_SKIP", "phone_already_set", {
          phone: c.phone,
        });
        advanceSalesStep("phone");
        return;
      }
      if (next === "email" && c.email && email_state.is_confirmed) {
        dbg("sales", "advanceSalesStep_SKIP", "email_already_confirmed", {
          email: c.email,
          is_confirmed: email_state.is_confirmed,
        });
        advanceSalesStep("email");
        return;
      }

      const hasName =
        (c._firstName && c._lastName) ||
        (c.name && c.name.trim().split(/\s+/).length >= 2) ||
        (c._firstName && c.name) ||
        c.preferredName;

      if (
        next === "createTicket" &&
        hasName &&
        c.phone &&
        c.email &&
        email_state.is_confirmed
      ) {
        salesStep = "createTicket";
      } else {
        salesStep = next;
      }

      dbg("sales", "advanceSalesStep_RESULT", "advanced", {
        from: completedStep,
        to: salesStep,
        conditionCheck: {
          _firstName: c._firstName || "",
          _lastName: c._lastName || "",
          phone: c.phone || "",
          email: c.email || "",
          emailConfirmed: email_state.is_confirmed,
        },
      });
    }

    function buildSalesStepHint() {
      const c = session.collected || {};

      const _logAndReturn = (label, val) => {
        dbg("sales", "buildSalesStepHint_RETURN", label, {
          salesStep,
          "email_state.value": email_state.value,
          "email_state.is_confirmed": email_state.is_confirmed,
          createTicketBlockedForEmail,
          fsmState,
          leadInterest: c.leadInterest || "",
          websiteCheckDone: c._websiteCheckDone || false,
          hint: String(val || "").substring(0, 150),
        });
        return val;
      };

      if (
        c.leadInterest &&
        c._websiteCheckRequired &&
        !c._websiteCheckAsked &&
        !c._websiteCheckDone
      ) {
        if (!c._websiteCheckAsked) {
          return _logAndReturn(
            "website_check_not_asked",
            `SALES STEP [website_check]: You MUST ask: "Just out of curiosity — have you had a chance to check out our website and seen the plans or pricing?" Do NOT proceed to collect name, phone, or email until this question is asked and answered. websiteCheckAsked=${c._websiteCheckAsked} websiteCheckDone=${c._websiteCheckDone}`,
          );
        } else {
          return _logAndReturn(
            "website_check_asked_awaiting",
            `SALES STEP [website_check]: Website check already asked. Wait for customer answer. Do NOT proceed to name/phone/email yet. websiteCheckDone=${c._websiteCheckDone}`,
          );
        }
      }

      if (
        salesStep === null &&
        c.leadInterest &&
        (c._websiteCheckDone || c._websiteCheckAsked)
      ) {
        initSalesStepMachine();
      }

      if (!salesStep || salesStep === "done") {
        return _logAndReturn("null_no_salesstep", null);
      }

      const name = c._firstName || c.preferredName || "";

      switch (salesStep) {
        case "firstName":
          // FIX: Auto-populate _firstName from name/preferredName if LLM already extracted it
          if (c.preferredName || (c.name && c.name.trim().length >= 2)) {
            const derivedFirst =
              c.preferredName || c.name.trim().split(/\s+/)[0];
            const INVALID = new Set([
              "yes",
              "yeah",
              "no",
              "nope",
              "ok",
              "okay",
              "i",
              "my",
              "the",
              "a",
              "an",
              "hi",
              "hello",
            ]);
            if (
              derivedFirst &&
              derivedFirst.length >= 2 &&
              !INVALID.has(derivedFirst.toLowerCase())
            ) {
              session.collected._firstName = derivedFirst;
              sessions.set(session.id, session);
              dbg("sales", "firstName_auto_populated_from_name", "advancing", {
                derivedFirst,
                name: c.name,
              });
              advanceSalesStep("firstName");
              return buildSalesStepHint();
            }
          }
          return _logAndReturn(
            "step_firstName",
            `[FLOW: sales][STEP: firstName][STATUS: pending] Ask ONLY for the customer's first name. Say something like "Could I start with your first name?" Say NOTHING else.`,
          );

        case "lastName":
          // FIX: Auto-populate _lastName from full name if LLM already extracted it
          if (
            !c._lastName &&
            c.name &&
            c.name.trim().split(/\s+/).length >= 2
          ) {
            const parts = c.name.trim().split(/\s+/);
            const derivedLast = parts[parts.length - 1];
            const INVALID = new Set([
              "yes",
              "yeah",
              "no",
              "nope",
              "ok",
              "okay",
              "i",
              "my",
              "the",
              "a",
              "an",
            ]);
            if (
              derivedLast &&
              derivedLast.length >= 2 &&
              !INVALID.has(derivedLast.toLowerCase())
            ) {
              session.collected._lastName = derivedLast;
              sessions.set(session.id, session);
              dbg("sales", "lastName_auto_populated_from_name", "advancing", {
                derivedLast,
                name: c.name,
              });
              advanceSalesStep("lastName");
              return buildSalesStepHint();
            }
          }
          return _logAndReturn(
            "step_lastName",
            `[FLOW: sales][STEP: lastName][STATUS: pending] You have their first name (${c._firstName || "collected"}). Ask ONLY for their last name. Say something like "And your last name?"`,
          );

        case "phone":
          return _logAndReturn(
            "step_phone",
            `[FLOW: sales][STEP: phone][STATUS: pending] You have their name (${name}). Ask ONLY for their mobile phone number. Say something like "What's the best mobile number for you?"`,
          );

        case "email":
          if (email_state.value && email_state.is_confirmed) {
            dbg(
              "sales",
              "buildSalesStepHint_email",
              "already_confirmed_skipping",
              { email: email_state.value },
            );
            advanceSalesStep("email");
            return buildSalesStepHint();
          }
          if (
            fsmState === FSM_STATE.EMAIL_CONFIRMATION &&
            !email_state.is_confirmed
          ) {
            return _logAndReturn(
              "step_email_confirm_pending",
              `[FLOW: sales][STEP: email][STATUS: awaiting_confirmation] Email value is "${email_state.value}". Read it back using individual letters and ask "is that correct?" Do NOT ask for email again. Wait for yes or no ONLY.`,
            );
          }
          if (fsmState === FSM_STATE.EMAIL_CAPTURE) {
            return _logAndReturn(
              "step_email_capture_active",
              `[FLOW: sales][STEP: email][STATUS: capture_active] Email capture already active. Do NOT ask for email again. Wait for customer to finish spelling.`,
            );
          }
          return _logAndReturn(
            "step_email_ask",
            `[FLOW: sales][STEP: email][STATUS: pending] Ask for email: "Could I grab your email address? Please spell it letter by letter — for @ say 'at', for dots say 'dot'. Example: s-h-a-u-n at b-e-l-e dot a-i." Then STOP and wait.`,
          );

        case "createTicket": {
          if (createTicketBlockedForEmail) {
            dbg(
              "sales",
              "buildSalesStepHint_createTicket",
              "blocked_by_email",
              {
                createTicketBlockedForEmail,
                "email_state.is_confirmed": email_state.is_confirmed,
              },
            );
            if (!email_state.is_confirmed) {
              return _logAndReturn(
                "step_createTicket_email_blocked",
                `[FLOW: sales][STEP: email][STATUS: capture_required] Email not yet confirmed. Do NOT call create_ticket. email_state.is_confirmed=${email_state.is_confirmed}. Ask for email NOW using VOICE SPELLING MODE. Say: "Could I grab your email? Please spell it letter by letter."`,
              );
            }
            return _logAndReturn(
              "step_createTicket_email_confirmed",
              `[FLOW: sales][STEP: create_ticket][STATUS: ready] Email confirmed. Proceed with create_ticket.`,
            );
          }

          const missing = [];
          if (!c._firstName && !c.name && !c.preferredName)
            missing.push("name");
          if (!c.phone) missing.push("phone");
          if (!c.email) missing.push("email");
          if (!c.leadInterest) missing.push("selected plan");

          if (missing.length > 0) {
            dbg("sales", "buildSalesStepHint_createTicket", "missing_fields", {
              missing,
            });
            if (!c.phone) salesStep = "phone";
            else if (!c.email) salesStep = "email";
            return buildSalesStepHint();
          }

          dbg("sales", "buildSalesStepHint_createTicket", "ready_to_fire", {
            name: `${c._firstName || ""} ${c._lastName || ""}`.trim(),
            phone: c.phone,
            email: c.email,
            plan: c.leadInterest,
          });

          return _logAndReturn(
            "step_createTicket_execute",
            `[FLOW: sales][STEP: create_ticket][STATUS: execute] ALL required details collected:
- Name: ${c._firstName || ""} ${c._lastName || ""} / ${c.name || ""}
- Phone: ${c.phone}
- Email: ${c.email}
- Plan: ${c.leadInterest}
- Address: ${c.address || "provided earlier"}
- email_state.is_confirmed: true

STEP 1: Call extract_call_fields to save any recently collected details.
STEP 2: THEN call create_ticket IMMEDIATELY. Do NOT say anything to the user first. CALL THE TOOLS.`,
          );
        }

        default:
          return _logAndReturn("unknown_step", null);
      }
    }

    // ─── Raw phone buffer ──────────────────────────────────────────
    let rawPhoneBuffer = null;
    let rawPhoneBufferTimestamp = 0;
    let awaitingPhoneVerification = false;

    // ─── Single pending response.create gate ──────────────────────
    let responseCreatePending = false;

    function scheduleResponseCreate(
      contextHint = null,
      delayMs = 0,
      force = false,
    ) {
      if (isResponseActive && !force) {
        if (contextHint) pendingPostDoneHint = contextHint;
        pendingPostDoneCreate = true;
        dbg("sales", "scheduleResponseCreate", "queued_post_done", {
          salesStep,
          fsmState,
          "email_state.is_confirmed": email_state.is_confirmed,
          createTicketBlockedForEmail,
          hint: (contextHint || "").substring(0, 100),
        });
        return;
      }

      if (responseCreatePending && !force) {
        dbg("sales", "scheduleResponseCreate", "skipped_already_pending", {
          salesStep,
        });
        return;
      }
      responseCreatePending = true;

      const send = () => {
        responseCreatePending = false;
        if (openaiWs?.readyState !== WebSocket.OPEN) return;
        if (isResponseActive && !force) {
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

        dbg("sales", "scheduleResponseCreate_FIRING", "sending", {
          salesStep,
          fsmState,
          "email_state.is_confirmed": email_state.is_confirmed,
          createTicketBlockedForEmail,
          isResponseActive,
          pendingFunctionCalls,
          force,
          combinedHint: combinedHint.substring(0, 200),
        });

        console.log("📤 Sending response.create to OpenAI");
        openaiWs.send(JSON.stringify({ type: "response.create" }));

        TimerManager.startWatchdog();
      };

      if (delayMs > 0) {
        setTimeout(send, delayMs);
      } else {
        send();
      }
    }

    // ─── Detection helpers ─────────────────────────────────────────
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

    function detectEmailSpellingRequest(text) {
      if (!text) return false;
      const lower = text.toLowerCase();
      return (
        (lower.includes("spell") && lower.includes("email")) ||
        (lower.includes("one letter at a time") && lower.includes("email")) ||
        (lower.includes("nato") && lower.includes("email")) ||
        (lower.includes("say 'at'") && lower.includes("email")) ||
        (lower.includes("i'm listening") && lower.includes("email"))
      );
    }

    // FIX P1+P2: Rewritten detectSalesStepAnswer with website check guard and input validation
    function detectSalesStepAnswer(text) {
      if (!salesStep || salesStep === "done" || salesStep === "createTicket")
        return;

      // FIX P1+P2: Never extract field values before website check is done
      const c = session.collected || {};
      if (!c._websiteCheckDone) {
        dbg(
          "sales",
          "detectSalesStepAnswer_SKIPPED",
          "website_check_not_done",
          { salesStep, text: text.substring(0, 50) },
        );
        return;
      }

      // FIX P2: Words that must never be captured as names
      const INVALID_NAME_WORDS = new Set([
        "yes",
        "yeah",
        "yep",
        "no",
        "nope",
        "ok",
        "okay",
        "sure",
        "right",
        "alright",
        "correct",
        "true",
        "false",
        "i",
        "my",
        "the",
        "a",
        "an",
        "hi",
        "hello",
        "hey",
        "sorry",
        "please",
        "thank",
        "thanks",
      ]);

      if (salesStep === "firstName") {
        const words = text.trim().split(/\s+/);
        const firstName = words[0]?.replace(/[^a-zA-Z'-]/g, "");
        // FIX P2: Reject single-word yes/no answers and very short strings
        if (
          firstName &&
          firstName.length >= 2 &&
          !INVALID_NAME_WORDS.has(firstName.toLowerCase())
        ) {
          session.collected._firstName = firstName;
          sessions.set(session.id, session);
          dbg("sales", "detectSalesStepAnswer_firstName", "captured", {
            firstName,
          });
          advanceSalesStep("firstName");
        } else {
          dbg("sales", "detectSalesStepAnswer_firstName", "rejected", {
            firstName,
            reason: "invalid_or_reserved_word",
          });
        }
      } else if (salesStep === "lastName") {
        const words = text.trim().split(/\s+/);
        const lastName = words[words.length - 1]?.replace(/[^a-zA-Z'-]/g, "");
        if (
          lastName &&
          lastName.length >= 2 &&
          !INVALID_NAME_WORDS.has(lastName.toLowerCase())
        ) {
          session.collected._lastName = lastName;
          session.collected.name = `${c._firstName || ""} ${lastName}`.trim();
          session.collected.preferredName = c._firstName || lastName;
          sessions.set(session.id, session);
          dbg("sales", "detectSalesStepAnswer_lastName", "captured", {
            lastName,
            fullName: session.collected.name,
          });
          advanceSalesStep("lastName");
        } else {
          dbg("sales", "detectSalesStepAnswer_lastName", "rejected", {
            lastName,
            reason: "invalid_or_reserved_word",
          });
        }
      } else if (salesStep === "phone") {
        const digits = text.replace(/\D/g, "");
        if (digits.length >= 8) {
          session.collected.phone = digits;
          sessions.set(session.id, session);
          dbg("sales", "detectSalesStepAnswer_phone", "captured", {
            phone: digits,
          });
          advanceSalesStep("phone");
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    //  ElevenLabs Connection Management
    // ═══════════════════════════════════════════════════════════════
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
        // FIX: Send initialization without content to avoid early generation
        // The handshake will trigger generation only when we send actual text
        elWs.send(
          JSON.stringify({
            text: "", // Empty handshake — don't trigger generation until all text arrives
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
          elevenLabsStreaming = true;
          // FIX: Flush any buffered text that arrived before ElevenLabs was ready
          if (textBuffer.length > 0) {
            dbg("support", "elevenLabs_buffer_flush", "sending", {
              bufferLength: textBuffer.length,
              totalChars: textBuffer.reduce((a, b) => a + b.length, 0),
            });
            for (const text of textBuffer) {
              sendTextToElevenLabs(text);
            }
            textBuffer = [];
          }
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
          }
          const isFinal =
            msg.isFinal === true || msg.is_final === true || msg.final === true;
          if (isFinal) {
            console.log(
              `🔊 [EL] TTS generation complete (isFinal) — waiting for client audio_done`,
            );
            elevenLabsStreaming = false;
            socket.emit("audio_stream_complete");
            if (fsmState === FSM_STATE.EMAIL_CAPTURE) {
              socket.emit("email_spelling_ready");
            }
          }
        } catch (err) {
          console.error(`⚠️ [EL] Message parse error:`, err.message);
        }
      });

      elWs.on("error", (err) => {
        console.warn(`⚠️ [EL] ElevenLabs WS error: ${err.message}`);
        elevenLabsStreaming = false;
      });
      elWs.on("close", () => {
        if (elevenLabsWs === elWs) {
          elevenLabsReady = false;
          elevenLabsStreaming = false;
        }
      });

      elevenLabsWs = elWs;
    }

    function interruptElevenLabsStream() {
      elevenLabsStreaming = false;
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
        elevenLabsStreaming = true;
      } catch (e) {
        console.warn("[EL] re-prime failed:", e.message);
        openElevenLabsStream(true);
      }
    }

    function sendTextToElevenLabs(text) {
      if (!text) return;
      if (elevenLabsWs?.readyState === WebSocket.OPEN) {
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
        elevenLabsStreaming = false;
        try {
          if (elevenLabsWs.readyState === WebSocket.CONNECTING)
            elevenLabsWs.terminate();
          else if (elevenLabsWs.readyState === WebSocket.OPEN)
            elevenLabsWs.close();
        } catch (err) {
          console.warn(`⚠️ [EL] Error closing WS: ${err.message}`);
        }
        elevenLabsWs = null;
        elevenLabsReady = false;
        textBuffer = [];
      }
    }

    // ═══════════════ OpenAI Realtime API ════════════════
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
            "\n\nCRITICAL: Always respond in English only." +
            "\n\nFIELD COLLECTION RULE: Collect ONE field per turn. Wait for answer before moving on." +
            "\n\nPACKAGE PRESENTATION RULE (CRITICAL):" +
            "\n- When presenting plans/packages to the customer, you MUST present ALL available options clearly." +
            "\n- ABSOLUTELY DO NOT auto-select or assume which plan the customer wants." +
            "\n- After presenting packages, ask explicitly: 'Which of these plans catches your eye?' or 'Which one would you like to go with?'" +
            "\n- WAIT for the customer to explicitly say WHICH PLAN they choose. Do NOT proceed until they make a clear choice." +
            "\n- If customer doesn't respond, ask again: 'Which plan interests you?' — Do NOT assume or select for them." +
            "\n- Only when customer explicitly says (e.g., 'I'll take the first one' or 'the 100 Mbps plan'), then call extract_call_fields with their selection." +
            "\n\nEMAIL — ABSOLUTE RULES:" +
            "\n1. Email is ALWAYS mutable. Any new email input DISCARDS the previous one completely." +
            "\n2. After parsing, you MUST read back the EXACT parsed email (the local part before @) using ONLY individual letters separated by hyphens." +
            "\n3. CRITICAL: Use the ACTUAL letters from the parsed email. If parsed email is aun@bele.ai, say 'a-u-n' NOT 's-h-a-u-n'. NEVER hallucinate different letters." +
            "\n4. NEVER say 'double X' for repeated letters. Always say each letter separately: l-l not double-l." +
            "\n5. If user corrects ANY part, reconstruct the ENTIRE email from scratch. Never partial-edit." +
            "\n6. Only call any tool with email AFTER the user explicitly says YES to the readback." +
            "\n7. When confirming email, spell it back letter-by-letter: 's-h-a-u-n at b-e-l-e dot a-i' (not phonetic names)." +
            "\n\nEMAIL COLLECTION — VOICE ONLY: Collect email by voice spelling only. Do NOT mention any text input box. Do NOT say 'you can also type it'. Voice spelling is the ONLY method." +
            "\n\nEMAIL DUPLICATE PREVENTION: If [SYSTEM_CONTEXT] shows email_state.value is already set and confirmed, do NOT ask for email again." +
            "\n\nCREATE_TICKET RULE: NEVER call create_ticket if createTicketBlockedForEmail=true in [SYSTEM_CONTEXT]. Only call it when email_state.is_confirmed=true is explicitly shown." +
            "\n\nFIELD EXTRACTION RULE: Before calling create_ticket, you MUST first call extract_call_fields to save any name, phone, or other details the customer just provided. create_ticket does NOT save fields automatically — extract_call_fields must be called first." +
            "\n\nLEAD INTEREST EXTRACTION RULE: When the customer selects a plan (e.g. 'I'll go with the 500/50 plan' or 'the first one'), you MUST immediately call extract_call_fields with leadInterest set to the exact plan name. This is MANDATORY before asking for the website check or any personal details." +
            "\n\nWEBSITE CHECK RULE: In sales flow, ALWAYS ask 'have you had a chance to check out our website and seen the plans or pricing?' AFTER plan is selected and BEFORE collecting any personal details (name/phone/email). Never skip this step." +
            "\n\nCUSTOMER_LOOKUP RULE: NEVER call customer_lookup for a new sales lead. customer_lookup is ONLY for existing customers in support/accounts/relocation flows. If the customer is new (has leadInterest, no customer_id), proceed directly to collect name/phone/email and then call create_ticket." +
            "\n\nEMAIL SPELLING INSTRUCTIONS (ALL FLOWS): When asking for email, say: 'Please spell your email address letter by letter. For the @ symbol, say 'at'. For dots, say 'dot'. For example: s-h-a-u-n at b-e-l-e dot a-i.' Always read back the email using the same format to confirm.";

          openaiWs.send(
            JSON.stringify({
              type: "session.update",
              session: {
                instructions,
                modalities: ["text"],
                input_audio_format: "pcm16",
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.9,
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

    // ═══════════════ OpenAI Event Handler ════════════════
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

          TimerManager.resetSilence();
          TimerManager.clearEmailConfirm();
          TimerManager.clearWatchdog();

          if (isResponseActive) {
            cancelPending = true;
            openaiWs.send(JSON.stringify({ type: "response.cancel" }));
          }

          interruptElevenLabsStream();

          assistantTextBuffer = "";
          lastTtsText = "";
          assistantSpeaking = false;
          lastResponseWasPackage = false;
          emptyResponseCount = 0;
          responseCreatePending = false;
          if (fsmState !== FSM_STATE.EMAIL_CONFIRMATION) {
            pendingPostDoneCreate = false;
            pendingPostDoneHint = null;
          }
          break;
        }

        case "input_audio_buffer.speech_stopped":
          socket.emit("status", "processing");
          break;

        case "conversation.item.input_audio_transcription.completed": {
          if (!event.transcript) break;

          const cleaned = normalizeText(event.transcript);
          if (!cleaned) break;

          console.log(
            `📊 [TRANSCRIPT] raw="${event.transcript}" cleaned="${cleaned}"`,
          );

          TimerManager.clearWatchdog();

          const looksLikeEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(cleaned);
          const digitCount = (cleaned.match(/\d/g) || []).length;
          const looksLikePhone = digitCount >= 6;
          const looksLikeSpelling = looksLikeVoiceEmailSpelling(cleaned);

          const isPurePhoneNumber =
            looksLikePhone && !looksLikeEmail && !looksLikeSpelling;

          const isEmailConfirmResponse =
            fsmState === FSM_STATE.EMAIL_CONFIRMATION;
          const isEmailSpelling =
            fsmState === FSM_STATE.EMAIL_CAPTURE && looksLikeSpelling;

          dbg(
            session.collected?.intent || "unknown",
            "transcript_received",
            "classified",
            {
              cleaned,
              looksLikeEmail,
              looksLikePhone,
              looksLikeSpelling,
              isPurePhoneNumber,
              isEmailConfirmResponse,
              isEmailSpelling,
              fsmState,
              salesStep,
              assistantSpeaking,
              pendingFunctionCalls,
              finalMessageLock,
            },
          );

          if (
            pendingFunctionCalls > 0 ||
            finalMessageLock ||
            session.finalLock
          ) {
            dbg("unknown", "transcript_dropped", "locked", {
              pendingFunctionCalls,
              finalMessageLock,
              sessionFinalLock: session.finalLock,
            });
            break;
          }

          if (assistantSpeaking) {
            dbg(
              session.collected?.intent || "unknown",
              "assistantSpeaking_cleared",
              "user_took_floor",
              { cleaned: cleaned.substring(0, 50) },
            );
            assistantSpeaking = false;
          }

          // Buffer phone for verification
          if (awaitingPhoneVerification && looksLikePhone) {
            const digits = cleaned.replace(/\D/g, "");
            if (digits.length >= 6) {
              rawPhoneBuffer = digits;
              rawPhoneBufferTimestamp = Date.now();
              dbg("support", "phone_verification_buffered", "ok", {
                phone: rawPhoneBuffer,
                timestamp: rawPhoneBufferTimestamp,
              });
            }
          }

          const willRouteToEmail =
            !isPurePhoneNumber &&
            (fsmState === FSM_STATE.EMAIL_CAPTURE ||
              fsmState === FSM_STATE.EMAIL_CONFIRMATION ||
              (salesStep === "email" && (looksLikeEmail || looksLikeSpelling)));

          dbg(
            "sales",
            "transcript_email_routing_decision",
            willRouteToEmail ? "routing_to_email" : "routing_normal",
            {
              isPurePhoneNumber,
              fsmState,
              salesStep,
              looksLikeEmail,
              looksLikeSpelling,
              willRouteToEmail,
              "email_state.value": email_state.value,
              "email_state.is_confirmed": email_state.is_confirmed,
            },
          );

          if (willRouteToEmail) {
            if (
              fsmState !== FSM_STATE.EMAIL_CAPTURE &&
              fsmState !== FSM_STATE.EMAIL_CONFIRMATION
            ) {
              dbg(
                "sales",
                "transcript_activating_email_capture",
                "auto_start",
                {
                  reason: "salesStep=email and input looks like email",
                },
              );
              startEmailCapture();
            }
            const consumed = handleEmailCaptureTranscript(cleaned);
            dbg("sales", "transcript_after_email_handle", "result", {
              consumed,
              fsmState,
              "email_state.value": email_state.value,
              "email_state.is_confirmed": email_state.is_confirmed,
              salesStep,
              createTicketBlockedForEmail,
            });
            if (consumed) {
              socket.emit("user_transcript", cleaned);
              TimerManager.clearSilence();
              break;
            }
          }

          console.log(`👤 User: "${cleaned}"`);
          socket.emit("user_transcript", cleaned);

          const mappedNetwork = mapOrdinalNetworkChoice(cleaned);
          if (mappedNetwork && wasLastMessageNetworkQuestion()) {
            const clarified = `I want ${mappedNetwork}`;
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
            TimerManager.resetSilence();
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
              dbg("sales", "website_check_answered", "done", {
                answer: cleaned,
                websiteCheckDone: true,
              });
              // FIX P1: Initialize sales step machine NOW, before detectSalesStepAnswer runs
              initSalesStepMachine();
            }
          }

          // FIX P1+P2: detectSalesStepAnswer now guards against pre-website-check execution internally
          detectSalesStepAnswer(cleaned);

          session.messages.push({ role: "user", content: cleaned });
          sessions.set(session.id, session);

          TimerManager.resetSilence();
          break;
        }

        case "response.created":
          isResponseActive = true;
          currentResponseId = event.response?.id || null;
          currentResponseHadOutput = false;
          cancelPending = false;
          elevenLabsStreaming = true;
          openElevenLabsStream();
          if (fsmState !== FSM_STATE.EMAIL_CONFIRMATION) {
            assistantSpeaking = true;
          }
          transitionFSM(FSM_STATE.SPEAKING);
          socket.emit("status", "speaking");
          TimerManager.clearWatchdog();
          console.log(`🔊 [FSM] speech_start`);
          break;

        case "response.text.delta":
          if (event.delta) {
            currentResponseHadOutput = true;
            assistantTextBuffer += event.delta;
            socket.emit("assistant_text_delta", event.delta);
            if (elevenLabsReady) sendTextToElevenLabs(event.delta);
            else textBuffer.push(event.delta);
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

            if (detectPlanPresentation(event.text)) {
              lastResponseWasPackage = true;
              transitionFSM(FSM_STATE.PACKAGE_PRESENTATION);
            }

            if (detectPhoneVerificationRequest(event.text)) {
              awaitingPhoneVerification = true;
              rawPhoneBuffer = null;
              rawPhoneBufferTimestamp = 0;
            }

            const emailSpellingDetected = detectEmailSpellingRequest(
              event.text,
            );
            dbg("sales", "response_text_done_email_check", "evaluated", {
              emailSpellingDetected,
              salesStep,
              fsmState,
              "email_state.value": email_state.value,
              "email_state.is_confirmed": email_state.is_confirmed,
              textSnippet: event.text.substring(0, 100),
            });

            if (
              emailSpellingDetected &&
              salesStep === "email" &&
              fsmState !== FSM_STATE.EMAIL_CAPTURE &&
              fsmState !== FSM_STATE.EMAIL_CONFIRMATION
            ) {
              dbg(
                "sales",
                "detectEmailSpellingRequest_TRIGGERED",
                "activating_capture",
                {
                  salesStep,
                  fsmState,
                },
              );
              startEmailCapture();
            } else if (emailSpellingDetected) {
              dbg(
                "sales",
                "detectEmailSpellingRequest_SUPPRESSED",
                "conditions_not_met",
                {
                  salesStep,
                  fsmState,
                  reason:
                    fsmState === FSM_STATE.EMAIL_CAPTURE ||
                    fsmState === FSM_STATE.EMAIL_CONFIRMATION
                      ? "already_in_email_fsm"
                      : "salesStep_not_email",
                },
              );
            }

            if (
              session.collected.leadInterest &&
              session.collected._websiteCheckRequired &&
              !session.collected._websiteCheckAsked &&
              detectWebsiteCheckQuestion(event.text)
            ) {
              session.collected._websiteCheckAsked = true;
              sessions.set(session.id, session);
              dbg("sales", "website_check_question_detected", "marked_asked", {
                websiteCheckAsked: true,
              });
            }
          }
          break;

        case "response.done": {
          isResponseActive = false;
          TimerManager.clearWatchdog();
          console.log(`🔊 [FSM] speech_end`);
          debugState("response_done_snapshot");

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

          dbg(
            session.collected?.intent || "unknown",
            "response_done",
            "analysis",
            {
              hasTextOutput,
              hasFunctionCall,
              pendingFunctionCalls,
              elevenLabsStreaming,
              cancelPending,
              pendingPostDoneCreate,
            },
          );

          if (
            !hasFunctionCall &&
            pendingFunctionCalls === 0 &&
            !elevenLabsStreaming
          ) {
            assistantSpeaking = false;
            dbg(
              "sales",
              "assistantSpeaking_cleared_response_done",
              "no_el_streaming",
              {},
            );
          }

          if (
            !hasFunctionCall &&
            !hasTextOutput &&
            pendingFunctionCalls === 0 &&
            !finalMessageLock
          ) {
            if (cancelPending) {
              console.log(`✅ response.done (cancelled) — no retry`);
              cancelPending = false;
              assistantSpeaking = false;
              transitionFSM(FSM_STATE.LISTENING);
              socket.emit("status", "listening");
              if (pendingPostDoneCreate) {
                pendingPostDoneCreate = false;
                const hint = pendingPostDoneHint;
                pendingPostDoneHint = null;
                setTimeout(() => scheduleResponseCreate(hint), 50);
              }
              break;
            }

            // FIX P3: Don't retry while ElevenLabs is still streaming audio
            if (elevenLabsStreaming) {
              dbg(
                "sales",
                "empty_response_retry_suppressed",
                "el_still_streaming",
                { emptyResponseCount },
              );
              break;
            }

            emptyResponseCount++;
            console.warn(
              `⚠️ EMPTY RESPONSE: attempt ${emptyResponseCount}/${MAX_EMPTY_RETRIES}`,
            );
            if (emptyResponseCount <= MAX_EMPTY_RETRIES) {
              // FIX P3: Use longer exponential backoff to prevent flooding
              const retryDelay = 300 * Math.pow(2, emptyResponseCount - 1);
              assistantSpeaking = false;
              scheduleResponseCreate(null, retryDelay, true);
            } else {
              console.warn(
                `⚠️ Max retries (${MAX_EMPTY_RETRIES}) reached — stopping retry loop`,
              );
              emptyResponseCount = 0;
              assistantSpeaking = false;
              transitionFSM(FSM_STATE.LISTENING);
              socket.emit("status", "listening");
            }
            break;
          }

          emptyResponseCount = 0;

          if (pendingPostDoneCreate && pendingFunctionCalls === 0) {
            if (createTicketBlockedForEmail) {
              dbg("sales", "post_done_create_blocked", "email_not_confirmed", {
                createTicketBlockedForEmail,
                "email_state.is_confirmed": email_state.is_confirmed,
              });
              pendingPostDoneCreate = false;
              const emailHint = buildSalesStepHint() || "";
              pendingPostDoneHint = null;
              setTimeout(() => scheduleResponseCreate(emailHint, 0, true), 50);
              break;
            }
            pendingPostDoneCreate = false;
            const hint = pendingPostDoneHint;
            pendingPostDoneHint = null;
            console.log(`📤 Firing queued post-done response.create`);
            setTimeout(() => scheduleResponseCreate(hint, 0, true), 50);
            break;
          }

          if (!pendingFunctionCalls) {
            if (
              fsmState !== FSM_STATE.EMAIL_CAPTURE &&
              fsmState !== FSM_STATE.EMAIL_CONFIRMATION
            ) {
              transitionFSM(FSM_STATE.LISTENING);
            }
            socket.emit("status", "listening");
          }
          assistantTextBuffer = "";
          currentResponseHadOutput = false;
          break;
        }

        case "response.output_item.added":
          if (event.item?.type === "function_call") {
            const fnName = event.item.name || event.item.function_call?.name;
            dbg(
              session.collected?.intent || "unknown",
              "function_call_added",
              "detected",
              {
                fnName,
                createTicketBlockedForEmail,
                "email_state.is_confirmed": email_state.is_confirmed,
              },
            );
            if (fnName === "create_ticket") {
              if (!createTicketBlockedForEmail) {
                TimerManager.startFinalLock(20000);
              }
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
            transitionFSM(FSM_STATE.TOOL_EXECUTING);
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
          elevenLabsStreaming = false;
          assistantSpeaking = false;
          TimerManager.clearWatchdog();
          transitionFSM(FSM_STATE.LISTENING);
          socket.emit("status", "listening");
          break;
      }
    }

    // ═══════════════ Tool Execution ════════════════
    async function handleFunctionCall(item) {
      const { call_id, name: fn, arguments: argsStr } = item;
      let args = safeParseJSON(argsStr) || {};

      dbg(
        session.collected?.intent || "unknown",
        "handleFunctionCall_ENTRY",
        "called",
        {
          fn,
          argsPreview: JSON.stringify(args).substring(0, 150),
          salesStep,
          "email_state.is_confirmed": email_state.is_confirmed,
          createTicketBlockedForEmail,
          fsmState,
        },
      );

      // Redirect verify_phone for sales (non-verified) flow
      if (
        fn === "verify_phone" &&
        !session.collected._emailVerifiedCustomerId
      ) {
        const llmPhone = args.phone;
        const bufferPhone = rawPhoneBuffer;
        const phoneToSave = llmPhone || bufferPhone;
        rawPhoneBuffer = null;
        rawPhoneBufferTimestamp = 0;
        awaitingPhoneVerification = false;
        if (phoneToSave) {
          session.collected.phone =
            String(phoneToSave).replace(/\D/g, "") || phoneToSave;
          sessions.set(session.id, session);
          if (salesStep === "phone") advanceSalesStep("phone");
          dbg("sales", "verify_phone_redirected_to_save", "saved", {
            phone: session.collected.phone,
            salesStep,
          });
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
          if (
            fsmState !== FSM_STATE.EMAIL_CAPTURE &&
            fsmState !== FSM_STATE.EMAIL_CONFIRMATION
          ) {
            transitionFSM(FSM_STATE.LISTENING);
          }
          scheduleResponseCreate();
        }
        return;
      }

      if (fn === "verify_phone") {
        if (rawPhoneBuffer) {
          const llmPhone = args.phone
            ? String(args.phone).replace(/\D/g, "")
            : null;
          const bufPhone = String(rawPhoneBuffer).replace(/\D/g, "");
          if (
            !llmPhone ||
            llmPhone === bufPhone ||
            bufPhone.length === llmPhone.length
          ) {
            args = { ...args, phone: rawPhoneBuffer };
            dbg("support", "verify_phone_using_buffer", "ok", {
              rawPhoneBuffer,
              llmPhone,
            });
          } else {
            dbg("support", "verify_phone_trusting_llm", "ok", {
              llmPhone,
              discardedBuffer: rawPhoneBuffer,
            });
          }
          rawPhoneBuffer = null;
          rawPhoneBufferTimestamp = 0;
          awaitingPhoneVerification = false;
        }
      }

      console.log(`🔧 Tool: ${fn}`, JSON.stringify(args).substring(0, 200));

      let result;
      socket.emit("status", "processing");
      TimerManager.clearSilence();
      TimerManager.clearEmailConfirm();
      TimerManager.clearWatchdog();

      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
      }

      const toolTimeout = setTimeout(() => {
        console.warn(`⚠️ Tool ${fn} timed out after 30s`);
        pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
        if (pendingFunctionCalls === 0) {
          transitionFSM(FSM_STATE.LISTENING);
          socket.emit("status", "listening");
        }
      }, 30000);

      try {
        result = await execTool(fn, args);
        console.log(
          `🔧 [TOOL-END] ${fn} - result: ${result.substring(0, 200)}`,
        );
      } catch (err) {
        console.error(`🔧 [TOOL-ERROR] ${fn}:`, err.message);
        result = JSON.stringify({ success: false, error: err.message });
      }

      clearTimeout(toolTimeout);

      let systemHint = `[FLOW: ${session.collected?.intent || "unknown"}] Current collected fields: ${JSON.stringify(
        Object.fromEntries(
          Object.entries(session.collected || {}).filter(
            ([k]) => k !== "_registeredPhone" && k !== "_rp",
          ),
        ),
      )}. email_state: { value: "${email_state.value}", is_confirmed: ${email_state.is_confirmed} }. createTicketBlockedForEmail: ${createTicketBlockedForEmail}. fsmState: ${fsmState}.`;

      dbg(session.collected?.intent || "unknown", "tool_executed", fn, {
        salesStep,
        "email_state.value": email_state.value,
        "email_state.is_confirmed": email_state.is_confirmed,
        createTicketBlockedForEmail,
        fsmState,
        result: result.substring(0, 200),
      });

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
            systemHint += `\nTOOL RESULT: ${planCount} plans found on "${networkLabel}". Ask: "Is this for your home or a business?" before showing plans.`;
          } else if (planCount > 0 && !requiresFilter) {
            systemHint += `\nTOOL RESULT: ${planCount} plans found on "${networkLabel}". Present ALL plans NOW. Speak slowly using voice_description fields. End with "Which of these catches your eye?" LOCKED to ${networkLabel}.`;
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

        if (parsedResult?._blocked && parsedResult?.reason === "sales_flow") {
          systemHint += `\nTOOL RESULT: customer_lookup blocked — this is a new sales lead. Do NOT retry customer_lookup. Treat as a new customer. Collect name, phone, email one at a time, then call create_ticket.`;
        } else if (parsedResult?._invalidEmail) {
          systemHint += `\nTOOL RESULT: Email format invalid — missing '@' symbol. Ask customer to spell email again: 'Please spell your email letter by letter, saying 'at' for @ and 'dot' for dots.'`;
        } else if (parsedResult?.success && parsedResult?.customer) {
          systemHint += `\nTOOL RESULT: Email lookup succeeded. Say "Perfect, I can see that account." Then ask for their phone number. When they give it, call verify_phone.`;
          awaitingPhoneVerification = true;
          rawPhoneBuffer = null;
          rawPhoneBufferTimestamp = 0;
        } else {
          systemHint += `\nTOOL RESULT: Customer not found. Ask customer to double-check their email address.`;
        }
      }

      if (fn === "verify_phone") {
        const llmPhone = args.phone
          ? String(args.phone).replace(/\D/g, "")
          : null;
        if (rawPhoneBuffer) {
          const bufPhone = String(rawPhoneBuffer).replace(/\D/g, "");
          // FIX: Always prefer rawPhoneBuffer when it exists — it comes directly from the
          // transcript classification which is more reliable than LLM extraction from garbled speech.
          // Only trust LLM if buffer is stale (> 10s old) AND LLM has a valid full number
          const bufferAge = Date.now() - rawPhoneBufferTimestamp;
          const bufferIsStale = bufferAge > 10000;
          const llmHasFullNumber = llmPhone && llmPhone.length >= 10;

          if (!bufferIsStale || !llmHasFullNumber) {
            // Buffer is fresh OR LLM doesn't have a confident number — use buffer
            args = { ...args, phone: bufPhone };
            dbg("support", "verify_phone_using_buffer", "ok", {
              bufPhone,
              llmPhone,
              bufferAge,
              reason: bufferIsStale ? "llm_incomplete" : "buffer_fresh",
            });
          } else {
            // Buffer is stale AND LLM has a full number — trust LLM
            dbg("support", "verify_phone_trusting_llm", "ok", {
              llmPhone,
              discardedBuffer: bufPhone,
              bufferAge,
            });
          }
          rawPhoneBuffer = null;
          rawPhoneBufferTimestamp = 0;
          awaitingPhoneVerification = false;
        } else if (!llmPhone || llmPhone.length < 6) {
          // No buffer and LLM has no valid number — tell user to repeat
          dbg("support", "verify_phone_no_number", "skipped", { llmPhone });
          // Return early with a soft failure so AI asks again
          const noPhoneResult = JSON.stringify({
            success: false,
            verificationFailed: false,
            message:
              "Could not extract phone number from speech. Ask the customer to repeat their number clearly.",
          });
          if (openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id,
                  output: noPhoneResult,
                },
              }),
            );
          }
          pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
          if (pendingFunctionCalls === 0) scheduleResponseCreate();
          return;
        }
      }

      if (fn === "create_ticket") {
        let parsedResult = null;
        try {
          parsedResult = JSON.parse(result);
        } catch (_) {}

        dbg("sales", "create_ticket_result_processing", "evaluating", {
          success: parsedResult?.success,
          _blocked: parsedResult?._blocked,
          reason: parsedResult?.reason,
          ticket_id: parsedResult?.ticket_id,
          _isSalesTicket: parsedResult?._isSalesTicket,
          "email_state.is_confirmed": email_state.is_confirmed,
          createTicketBlockedForEmail,
        });

        if (
          parsedResult?._blocked &&
          parsedResult?.reason === "email_missing"
        ) {
          TimerManager.releaseFinalLock();
          salesStep = "email";
          createTicketBlockedForEmail = true;
          if (
            fsmState !== FSM_STATE.EMAIL_CAPTURE &&
            fsmState !== FSM_STATE.EMAIL_CONFIRMATION
          ) {
            startEmailCapture();
          } else {
            dbg(
              "sales",
              "create_ticket_BLOCKED_capture_already_active",
              "no_restart",
              {
                fsmState,
              },
            );
          }
          dbg(
            "sales",
            "create_ticket_BLOCKED_email_missing",
            "forcing_email_capture",
            {
              salesStep,
              createTicketBlockedForEmail,
              fsmState,
            },
          );
          systemHint += `\nTOOL RESULT: create_ticket BLOCKED — email not confirmed. salesStep is now "email". Ask for email NOW: "Could I grab your email address? Please spell it letter by letter — for @ say 'at', for dots say 'dot'. Example: s-h-a-u-n at b-e-l-e dot a-i." Do NOT call create_ticket again until email_state.is_confirmed=true.`;
        } else if (parsedResult?.success) {
          salesStep = "done";
          createTicketBlockedForEmail = false;
          TimerManager.releaseFinalLock();
          const ticketId = parsedResult.ticket_id;
          const isSales = parsedResult._isSalesTicket === true || !ticketId;
          dbg("sales", "create_ticket_SUCCESS", "ticket_created", {
            isSales,
            ticketId,
            salesStep,
          });
          if (isSales) {
            systemHint += `\nTOOL RESULT: Sales enquiry submitted. Say: "Awesome, you're all set! I've submitted your enquiry and our sales team will be in touch via email shortly. Is there anything else you'd like to know?"`;
          } else {
            systemHint += `\nTOOL RESULT: Support ticket #${ticketId} created. Say: "Brilliant, all done! I've raised support ticket number ${ticketId} — you'll get details via email shortly. Is there anything else I can help with?"`;
          }
          transitionFSM(FSM_STATE.FINAL);
        } else {
          TimerManager.releaseFinalLock();
          dbg("sales", "create_ticket_FAILED", "error", {
            error: parsedResult?.error,
          });
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
          systemHint += `\nCRITICAL GATE: You MUST ask: "Just out of curiosity — have you had a chance to check out our website and seen the plans or pricing?" WAIT for their answer before collecting name/phone/email.`;
        }
        if (
          c.leadInterest &&
          c._websiteCheckRequired &&
          (c._websiteCheckAsked || c._websiteCheckDone)
        ) {
          systemHint += `\nWEBSITE CHECK DONE: Do NOT ask again. Proceed with order collection.`;
        }
        if (createTicketBlockedForEmail) {
          systemHint += `\nEMAIL CAPTURE IN PROGRESS: email_state.is_confirmed=${email_state.is_confirmed}. Do NOT call create_ticket. Wait for email confirmation.`;
        }
        systemHint += `\nEMAIL STATE: email_state.is_confirmed=${email_state.is_confirmed} email="${email_state.value}" createTicketBlockedForEmail=${createTicketBlockedForEmail}.`;
        if (email_state.is_confirmed && salesStep === "createTicket") {
          systemHint += ` Email is CONFIRMED. Call create_ticket NOW without asking for email again.`;
        }
        // FIX: Remove inner const c — use outer c already declared above
        if (
          salesStep === "createTicket" &&
          email_state.is_confirmed &&
          !createTicketBlockedForEmail &&
          c.phone &&
          c.email &&
          c.leadInterest
        ) {
          systemHint += `\n\nCRITICAL: Do NOT say the order is submitted or complete. You MUST call the create_ticket tool RIGHT NOW. Do not say anything to the user first. Call the tool immediately.`;
        }
        const stepHint = buildSalesStepHint();
        if (stepHint) systemHint += `\n\n${stepHint}`;
      }

      if (openaiWs?.readyState === WebSocket.OPEN) {
        await Promise.resolve();
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

        if (
          fsmState === FSM_STATE.TOOL_EXECUTING &&
          fsmState !== FSM_STATE.EMAIL_CAPTURE &&
          fsmState !== FSM_STATE.EMAIL_CONFIRMATION &&
          fsmState !== FSM_STATE.FINAL
        ) {
          transitionFSM(FSM_STATE.LISTENING);
        }

        console.log(`📤 Tool complete (${fn}) — triggering response.create`);
        scheduleResponseCreate();
      }
    }

    async function execTool(fn, args) {
      if (fn === "extract_call_fields") {
        if (args.email && typeof args.email === "string") {
          const parsed = parseVoiceEmail(args.email);
          dbg(
            session.collected?.intent || "unknown",
            "extract_call_fields_email_parse",
            parsed ? "normalized" : "parse_failed",
            { raw: args.email, parsed },
          );
          if (parsed) {
            args.email = parsed;
          }
        }
        applyExtractionToSession(session, args);
        const c = session.collected || {};

        if (salesStep === "firstName" && (args.preferredName || args.name)) {
          const firstName = (args.preferredName || args.name || "").split(
            " ",
          )[0];
          // FIX P2: Validate firstName from LLM extraction too
          const INVALID_NAME_WORDS = new Set([
            "yes",
            "yeah",
            "yep",
            "no",
            "nope",
            "ok",
            "okay",
            "sure",
            "right",
            "alright",
            "correct",
            "true",
            "false",
            "i",
            "my",
            "the",
            "a",
            "an",
          ]);
          if (
            firstName &&
            firstName.length >= 2 &&
            !INVALID_NAME_WORDS.has(firstName.toLowerCase())
          ) {
            session.collected._firstName = firstName;
            sessions.set(session.id, session);
            dbg("sales", "extract_firstName_captured", "ok", { firstName });
            advanceSalesStep("firstName");
          } else {
            dbg("sales", "extract_firstName_rejected", "invalid_word", {
              firstName,
            });
          }
        }
        if (salesStep === "lastName" && args.name && args.name.includes(" ")) {
          const parts = args.name.split(" ");
          session.collected._lastName = parts[parts.length - 1];
          sessions.set(session.id, session);
          dbg("sales", "extract_lastName_captured", "ok", {
            lastName: session.collected._lastName,
          });
          advanceSalesStep("lastName");
        }
        if (salesStep === "phone" && args.phone) {
          dbg("sales", "extract_phone_captured", "advancing", {
            phone: args.phone,
          });
          advanceSalesStep("phone");
        }

        // FIX P1-D: When LLM extracts leadInterest, ensure salesStep machine initialises
        if (args.leadInterest && !c.leadInterest) {
          session.collected.leadInterest = args.leadInterest;
          session.collected._websiteCheckRequired = true;
          if (session.collected._websiteCheckDone === undefined) {
            session.collected._websiteCheckDone = false;
          }
          sessions.set(session.id, session);
          dbg("sales", "extract_leadInterest_captured", "ok", {
            leadInterest: args.leadInterest,
            salesStep,
            websiteCheckRequired: true,
          });
        }

        if (args.email) {
          const parsedForExtract = parseVoiceEmail(args.email) || args.email;
          // FIX: If email is already confirmed, do NOT call setEmailValue (which resets is_confirmed)
          // Just make sure session.collected.email is set correctly
          if (
            email_state.is_confirmed &&
            email_state.value === parsedForExtract
          ) {
            // Email already confirmed and matches — just ensure session has it, don't reset state
            session.collected.email = parsedForExtract;
            sessions.set(session.id, session);
            dbg(
              "sales",
              "extract_email_already_confirmed_preserved",
              "no_reset",
              {
                email: parsedForExtract,
                "email_state.is_confirmed": email_state.is_confirmed,
              },
            );
          } else if (!email_state.is_confirmed) {
            // Not yet confirmed — safe to set
            setEmailValue(parsedForExtract);
            session.collected.email = parsedForExtract;
            sessions.set(session.id, session);
            dbg("sales", "extract_email_captured_by_llm", "set", {
              email: parsedForExtract,
              salesStep,
              "email_state.is_confirmed": email_state.is_confirmed,
            });
            if (salesStep === "email") {
              socket.emit("email_spelling_confirmation", {
                email: parsedForExtract,
              });
              transitionFSM(FSM_STATE.EMAIL_CONFIRMATION);
              TimerManager.startEmailConfirm();
              dbg("sales", "extract_email_confirmation_wait_setup", "pending", {
                email: parsedForExtract,
                waitingForUserConfirmation: true,
              });
            }
            if (salesStep === "email" && email_state.is_confirmed) {
              advanceSalesStep("email");
            }
          } else {
            // Confirmed but LLM extracted a DIFFERENT email — log and ignore
            dbg(
              "sales",
              "extract_email_ignored_confirmed_mismatch",
              "skipped",
              {
                existing: email_state.value,
                attempted: parsedForExtract,
                reason: "email already confirmed, not overwriting",
              },
            );
          }
        }

        return JSON.stringify({ success: true });
      }

      if (fn === "customer_lookup") {
        const isSalesFlow =
          !!session.collected?.leadInterest &&
          !session.collected?._emailVerifiedCustomerId;
        if (isSalesFlow) {
          dbg("sales", "customer_lookup_BLOCKED", "sales_flow_new_lead", {
            leadInterest: session.collected.leadInterest,
          });
          return JSON.stringify({
            success: false,
            _blocked: true,
            reason: "sales_flow",
            message:
              "New sales lead — customer lookup not performed. Treat as new customer. Collect name, phone, email, then call create_ticket.",
          });
        }

        const lookupArgs = { ...(args || {}) };
        delete lookupArgs.phone;
        if (!lookupArgs.email && !lookupArgs.name) {
          return JSON.stringify({
            success: false,
            message: "Email is required for customer lookup",
          });
        }

        if (lookupArgs.email && typeof lookupArgs.email === "string") {
          const parsed = parseVoiceEmail(lookupArgs.email);
          if (parsed) {
            dbg("support", "customer_lookup_email_normalized", "ok", {
              raw: lookupArgs.email,
              parsed,
            });
            lookupArgs.email = parsed;
          } else {
            dbg("support", "customer_lookup_email_parse_failed", "invalid", {
              email: lookupArgs.email,
            });
            return JSON.stringify({
              success: false,
              _invalidEmail: true,
              message:
                "Invalid email format — could not parse. Ask customer to spell email letter by letter, saying 'at' for @ and 'dot' for dots.",
            });
          }
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
          delete session.collected.email;
          delete session.collected._emailVerifiedCustomerId;
          email_state.value = "";
          email_state.is_confirmed = false;
          sessions.set(session.id, session);
          dbg("support", "customer_lookup_not_found", "email_cleared", {
            email: lookupArgs.email,
          });
          return JSON.stringify({
            ...result,
            _emailCleared: true,
            message:
              "No account found with that email. Please check and try again.",
          });
        } catch (e) {
          return JSON.stringify({ success: false, error: e.message });
        }
      }

      if (fn === "verify_phone") {
        const { phone } = args || {};
        if (!phone)
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "No phone number provided.",
          });
        const emailCustomerId = session.collected._emailVerifiedCustomerId;
        if (!emailCustomerId)
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "Email verification must be completed first.",
          });
        const registeredPhone =
          session.collected._registeredPhone || session.collected._rp;
        if (!registeredPhone) {
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "No phone number registered on this account.",
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
        if (normalizedInput !== normalizedRegistered) {
          dbg("support", "verify_phone_FAILED", "mismatch", {
            inputNormalized: normalizedInput,
            registeredNormalized: normalizedRegistered,
          });
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "Phone number does not match the registered number.",
          });
        }
        session.collected._phoneVerified = true;
        sessions.set(session.id, session);
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

        dbg("sales", "execTool_create_ticket_GUARD_CHECK", "evaluating", {
          isSupportTicket,
          "collected.email": collected.email || "MISSING",
          "email_state.value": email_state.value,
          "email_state.is_confirmed": email_state.is_confirmed,
          createTicketBlockedForEmail,
          salesStep,
          hasCustomerId,
          hasLeadInterest,
          fsmState,
        });

        if (
          !isSupportTicket &&
          (!collected.email || !email_state.is_confirmed)
        ) {
          dbg(
            "sales",
            "execTool_create_ticket_BLOCKED",
            "email_not_confirmed",
            {
              reason: `isSupportTicket=${isSupportTicket} collected.email="${collected.email || "MISSING"}" email_state.is_confirmed=${email_state.is_confirmed}`,
              action: "forcing_salesStep=email + startEmailCapture",
            },
          );
          salesStep = "email";
          createTicketBlockedForEmail = true;
          TimerManager.releaseFinalLock();
          finalMessageLock = false;
          session.finalLock = false;
          if (
            fsmState !== FSM_STATE.EMAIL_CAPTURE &&
            fsmState !== FSM_STATE.EMAIL_CONFIRMATION
          ) {
            startEmailCapture();
          } else {
            dbg(
              "sales",
              "execTool_create_ticket_BLOCKED_capture_already_active",
              "no_restart",
              {
                fsmState,
              },
            );
          }
          return JSON.stringify({
            success: false,
            _blocked: true,
            reason: "email_missing",
            message:
              "SALES STEP [email]: Ask for email by voice spelling mode. Do NOT retry create_ticket until email_state.is_confirmed=true.",
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
        if (fa.message?.message) fa.message.message += detailsBlock;
        else if (detailsBlock) fa.message = { message: detailsBlock.trim() };

        let ticketResult;
        try {
          if (isSupportTicket) {
            const r = await splynx.request(
              "POST",
              "admin/support/tickets",
              objectToUrlEncoded(fa),
            );
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
          dbg("sales", "execTool_create_ticket_SUCCESS", "submitted", {
            isSupportTicket,
            ticket_id: ticketResult.ticket_id,
            email_sent: ticketResult.email_sent,
          });
        } catch (err) {
          dbg("sales", "execTool_create_ticket_ERROR", "failed", {
            error: err.message,
          });
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

    // ═══════════════ Client Audio → OpenAI ════════════════
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

    socket.on("audio_done", () => {
      console.log(`🔊 [FSM] Client audio_done — browser playback complete`);
      assistantSpeaking = false;

      dbg(
        session.collected?.intent || "unknown",
        "audio_done",
        "playback_complete",
        {
          fsmState,
          salesStep,
          "email_state.is_confirmed": email_state.is_confirmed,
          lastResponseWasPackage,
        },
      );

      if (
        fsmState !== FSM_STATE.EMAIL_CAPTURE &&
        fsmState !== FSM_STATE.EMAIL_CONFIRMATION &&
        fsmState !== FSM_STATE.FINAL
      ) {
        transitionFSM(FSM_STATE.LISTENING);
      }

      const isPackage = lastResponseWasPackage;
      lastResponseWasPackage = false;
      console.log(
        `⏱️  [TMgr] TTS finished → silence timer starting (${isPackage ? "20s package" : "15s normal"})`,
      );
      TimerManager.startSilence(isPackage);
    });

    // ═══════════════ Structured Input (email/phone typed by user) ══
    socket.on("structured_input", (payload) => {
      if (!payload || !payload.field || !payload.value) return;
      const { field, value } = payload;

      if (field === "email") {
        dbg("sales", "structured_input_email", "received", {
          value,
          salesStep,
          "email_state.is_confirmed": email_state.is_confirmed,
          createTicketBlockedForEmail,
        });

        setEmailValue(value);
        confirmEmail();
        if (salesStep === "email") advanceSalesStep("email");
        createTicketBlockedForEmail = false;
        resetEmailCapture();
        awaitingStructuredInput = false;
        structuredInputField = null;

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
          const salesHint = buildSalesStepHint() || "";
          const hint = `Customer email confirmed via typed input: ${value}. email_state.is_confirmed=true. createTicketBlockedForEmail=false. ${salesHint} Proceed immediately.`;
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

        socket.emit("structured_input_accepted", { field, value });
        socket.emit("status", "listening");
        return;
      }

      dbg(
        session.collected?.intent || "unknown",
        "structured_input_other",
        "received",
        { field, value },
      );

      TimerManager.clearSilence();
      awaitingStructuredInput = false;
      structuredInputField = null;

      const userMessage = `My ${field} is ${value}`;
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

    // ═══════════════ Cleanup ════════════════
    socket.on("disconnect", () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
      dbg(session?.collected?.intent || "unknown", "disconnect", "cleanup", {
        "email_state.value": email_state.value,
        "email_state.is_confirmed": email_state.is_confirmed,
        collected: JSON.stringify(session?.collected || {}),
      });
      TimerManager.clearAll();
      closeElevenLabsWs();
      if (openaiWs)
        try {
          openaiWs.close();
        } catch (_) {}
      sessions.delete(session.id);
    });

    // ═══════════════ Boot ════════════════
    (async () => {
      try {
        console.log("⏳ Connecting OpenAI Realtime...");
        dbg("init", "connect", "pending", { sessionId: session.id });
        await connectOpenAI();
        console.log(
          "✅ OpenAI connected! ElevenLabs pre-warmed. Waiting 200ms...",
        );
        socket.emit("connections_ready");
        await new Promise((r) => setTimeout(r, 200));

        if (!session.hasGreeted) {
          session.hasGreeted = true;
          dbg("init", "greeting", "sending", { sessionId: session.id });
          if (openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({ type: "response.create" }));
          } else {
            console.warn(
              `⚠️ OpenAI WS not open for greeting (state: ${openaiWs?.readyState})`,
            );
          }
          sessions.set(session.id, session);
        } else {
          transitionFSM(FSM_STATE.LISTENING);
          socket.emit("status", "listening");
        }
      } catch (err) {
        console.error("❌ Connection failed:", err.message);
        socket.emit("error_msg", "Failed to connect to AI services");
      }
    })();
  });
}
