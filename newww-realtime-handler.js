// import WebSocket from "ws";
// // ═══════════════════════════════════════════════════════════════════════════
// //  VOICE EMAIL CAPTURE — NATO PHONETIC PARSER + ASSEMBLER
// // ═══════════════════════════════════════════════════════════════════════════
// const NATO_MAP = {
//   alpha: "a",
//   alfa: "a",
//   bravo: "b",
//   charlie: "c",
//   delta: "d",
//   echo: "e",
//   foxtrot: "f",
//   golf: "g",
//   hotel: "h",
//   india: "i",
//   juliet: "j",
//   juliett: "j",
//   kilo: "k",
//   lima: "l",
//   mike: "m",
//   november: "n",
//   oscar: "o",
//   papa: "p",
//   quebec: "q",
//   romeo: "r",
//   sierra: "s",
//   tango: "t",
//   uniform: "u",
//   victor: "v",
//   whiskey: "w",
//   xray: "x",
//   "x-ray": "x",
//   yankee: "y",
//   zulu: "z",
//   ay: "a",
//   bee: "b",
//   see: "c",
//   sea: "c",
//   dee: "d",
//   ee: "e",
//   ef: "f",
//   eff: "f",
//   gee: "g",
//   aitch: "h",
//   haitch: "h",
//   jay: "j",
//   kay: "k",
//   el: "l",
//   em: "m",
//   en: "n",
//   oh: "o",
//   pee: "p",
//   cue: "q",
//   queue: "q",
//   are: "r",
//   ar: "r",
//   ess: "s",
//   es: "s",
//   tee: "t",
//   you: "u",
//   vee: "v",
//   double: null,
//   ex: "x",
//   why: "y",
//   wye: "y",
//   zee: "z",
//   zed: "z",
//   zero: "0",
//   one: "1",
//   two: "2",
//   to: "2",
//   too: "2",
//   three: "3",
//   four: "4",
//   for: "4",
//   five: "5",
//   six: "6",
//   seven: "7",
//   eight: "8",
//   nine: "9",
//   at: "@",
//   "at sign": "@",
//   dot: ".",
//   period: ".",
//   full: null,
//   stop: ".",
//   dash: "-",
//   hyphen: "-",
//   minus: "-",
//   underscore: "_",
//   "under score": "_",
//   plus: "+",
//   hash: "#",
//   hashtag: "#",
//   pound: "#",
//   com: "com",
//   net: "net",
//   org: "org",
//   edu: "edu",
//   gov: "gov",
//   io: "io",
//   co: "co",
//   au: "au",
//   uk: "uk",
//   us: "us",
//   ca: "ca",
//   nz: "nz",
// };

// const DOMAIN_SHORTCUTS = {
//   gmail: "gmail.com",
//   "gmail dot com": "gmail.com",
//   "google mail": "gmail.com",
//   yahoo: "yahoo.com",
//   "yahoo dot com": "yahoo.com",
//   hotmail: "hotmail.com",
//   "hotmail dot com": "hotmail.com",
//   outlook: "outlook.com",
//   "outlook dot com": "outlook.com",
//   icloud: "icloud.com",
//   "icloud dot com": "icloud.com",
//   live: "live.com",
//   "live dot com": "live.com",
//   protonmail: "protonmail.com",
//   "proton mail": "protonmail.com",
//   bigpond: "bigpond.com",
//   "bigpond dot com": "bigpond.com",
//   optusnet: "optusnet.com.au",
//   tpg: "tpg.com.au",
//   bele: "bele.ai",
// };

// function parseVoiceEmail(transcript) {
//   if (!transcript) return null;
//   let raw = transcript.toLowerCase().trim();

//   const directEmail = raw.match(/\b([^\s@]+@[^\s@]+\.[^\s@]{2,})\b/);
//   if (directEmail) return directEmail[1].toLowerCase();

//   raw = raw
//     .replace(/\bfull\s+stop\b/gi, " dot ")
//     .replace(/\bat\s+sign\b/gi, " at ")
//     .replace(/\bunder\s+score\b/gi, " underscore ")
//     // "double u" → "w" but every other "double X" → "X X"
//     .replace(/\bdouble\s+u\b/gi, " w ")
//     .replace(/\bdouble\s+([a-z])\b/gi, (_, ch) => ` ${ch} ${ch} `)
//     .replace(/\bcomma\b/gi, "")
//     .replace(/[,;'"]/g, " ")
//     .replace(/\s{2,}/g, " ")
//     .trim();

//   let domainReplaced = raw;
//   for (const [spoken, actual] of Object.entries(DOMAIN_SHORTCUTS)) {
//     const re = new RegExp(`\\b${spoken.replace(/\./g, "\\.")}\\b`, "gi");
//     domainReplaced = domainReplaced.replace(re, actual);
//   }
//   raw = domainReplaced;

//   const tokens = raw.split(/\s+/).filter(Boolean);
//   const parts = [];

//   for (let i = 0; i < tokens.length; i++) {
//     const tok = tokens[i];
//     if (/^[a-z0-9._@+-]+\.[a-z]{2,}$/.test(tok)) {
//       parts.push(tok);
//       continue;
//     }
//     if (/^[a-z]$/.test(tok) || /^\d$/.test(tok)) {
//       parts.push(tok);
//       continue;
//     }
//     if (/^\d{2,}$/.test(tok)) {
//       parts.push(tok);
//       continue;
//     }
//     if (NATO_MAP.hasOwnProperty(tok)) {
//       const val = NATO_MAP[tok];
//       if (val !== null) parts.push(val);
//       continue;
//     }
//     if (/^[a-z]{2,6}(\.[a-z]{2,6})?$/.test(tok)) {
//       parts.push(tok);
//       continue;
//     }
//     parts.push(tok);
//   }

//   let email = parts.join("");
//   email = email
//     .replace(/@+/g, "@")
//     .replace(/\.{2,}/g, ".")
//     .replace(/^[.\-_]+/, "")
//     .replace(/[.\-_]+@/, "@")
//     .replace(/@[.\-_]+/, "@")
//     .replace(/[.\-_]+$/, "");

//   if (!email.includes("@")) return null;
//   const [local, domain] = email.split("@");
//   if (!local || local.length < 1) return null;
//   if (!domain || !domain.includes(".")) return null;
//   if (domain.endsWith(".")) return null;

//   return email.toLowerCase();
// }

// function looksLikeVoiceEmailSpelling(text) {
//   if (!text) return false;
//   const lower = text.toLowerCase().trim();
//   if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(lower)) return true;
//   if (
//     /\bat\s+(gmail|yahoo|hotmail|outlook|icloud|bigpond|optusnet|tpg|live|proton)/.test(
//       lower,
//     )
//   )
//     return true;
//   const natoCount = (
//     lower.match(
//       /\b(alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliet|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|xray|yankee|zulu)\b/gi,
//     ) || []
//   ).length;
//   if (natoCount >= 2 && /\bat\b/.test(lower)) return true;
//   const words = lower.split(/\s+/);
//   const hasAt = words.includes("at");
//   const hasDot =
//     words.includes("dot") || words.includes("period") || words.includes("stop");
//   const singleLetterCount = words.filter((w) => /^[a-z]$/.test(w)).length;
//   if (hasAt && hasDot && singleLetterCount >= 2) return true;
//   return false;
// }

// // ═══════════════════════════════════════════════════════════════════════════
// //  FSM STATES
// // ═══════════════════════════════════════════════════════════════════════════
// const FSM_STATE = {
//   IDLE: "IDLE",
//   SPEAKING: "SPEAKING",
//   LISTENING: "LISTENING",
//   EMAIL_CAPTURE: "EMAIL_CAPTURE",
//   EMAIL_CONFIRMATION: "EMAIL_CONFIRMATION",
//   PACKAGE_PRESENTATION: "PACKAGE_PRESENTATION",
//   TOOL_EXECUTING: "TOOL_EXECUTING",
//   FINAL: "FINAL",
// };

// // ═══════════════════════════════════════════════════════════════════════════
// export function setupRealtimeVoice(io, deps) {
//   const {
//     OPENAI_API_KEY,
//     ELEVENLABS_API_KEY,
//     ELEVENLABS_VOICE_ID,
//     SYSTEM_PROMPT,
//     LOCATIONS,
//     tools,
//     mkSession,
//     sessions,
//     normalizeText,
//     normalizePhone,
//     safeParseJSON,
//     applyExtractionToSession,
//     fetchTariffs,
//     customerLookup,
//     objectToUrlEncoded,
//     splynx,
//     sendTicketEmail,
//     checkAddressAvailability,
//   } = deps;

//   const realtimeTools = tools.map((t) => ({
//     type: "function",
//     name: t.name,
//     description: t.description,
//     parameters: t.parameters,
//   }));

//   io.on("connection", (socket) => {
//     console.log(`🔌 Voice client connected: ${socket.id}`);
//     console.log(`📊 [DEBUG] New connection - initializing handlers`);

//     // ═══════════════════════════════════════════════════════════════
//     //  FIX (Issue 4 — Session Hoisting): Session MUST be created at
//     //  the TOP of the connection handler so all closures below can
//     //  reference it safely. The original code had `const session =
//     //  mkSession()` at the BOTTOM (in the Boot section), but every
//     //  closure above it (setEmailValue, confirmEmail, transitionFSM,
//     //  TimerManager, etc.) referenced `session` — this worked only
//     //  because of JS hoisting of `var` semantics in the original
//     //  commented-out code, but the active code used `const` which
//     //  would cause a TDZ (Temporal Dead Zone) ReferenceError.
//     // ═══════════════════════════════════════════════════════════════
//     const session = mkSession();

//     let openaiWs = null;

//     // ─── ElevenLabs state ─────────────────────────────────────────
//     let elevenLabsWs = null;
//     let elevenLabsReady = false;
//     let textBuffer = [];
//     let elevenLabsStreaming = false;

//     let assistantTextBuffer = "";
//     let pendingFunctionCalls = 0;
//     let lastTtsText = "";
//     let isResponseActive = false;
//     let assistantSpeaking = false;
//     let awaitingStructuredInput = false;
//     let structuredInputField = null;

//     const PCM_SAMPLE_RATE = 16000;
//     let lastAssistantText = "";

//     let emptyResponseCount = 0;
//     const MAX_EMPTY_RETRIES = 3;

//     let cancelPending = false;

//     let currentResponseId = null;
//     let currentResponseHadOutput = false;

//     let pendingPostDoneCreate = false;
//     let pendingPostDoneHint = null;

//     let salesStep = null;

//     // Track whether plans were presented so audio_done uses correct timer
//     let lastResponseWasPackage = false;

//     // ═══════════════════════════════════════════════════════════════
//     //  FIX 1 (Issue 1): UNIFIED EMAIL STATE — single source of truth.
//     //  All writes go through setEmailValue() which hard-overwrites
//     //  and resets confirmation state on every new input.
//     // ═══════════════════════════════════════════════════════════════
//     const email_state = {
//       value: "", // always the LATEST parsed/typed email
//       is_confirmed: false, // true ONLY after explicit user YES
//     };

//     function setEmailValue(newEmail) {
//       const prev = email_state.value;
//       email_state.value = newEmail;
//       email_state.is_confirmed = false; // reset confirmation on ANY new input
//       console.log(
//         `[FLOW: ${session?.collected?.intent || "unknown"}][STEP: email_capture][STATUS: overwrite][DATA: prev="${prev}" next="${newEmail}" confirmed=false]`,
//       );
//     }

//     function confirmEmail() {
//       email_state.is_confirmed = true;
//       // FIX (Issue 4): Always sync email_state.value → session
//       session.collected.email = email_state.value;
//       sessions.set(session.id, session);
//       console.log(
//         `[FLOW: ${session?.collected?.intent || "unknown"}][STEP: email_confirmed][STATUS: success][DATA: email="${email_state.value}" is_confirmed=true session_synced=true]`,
//       );
//     }

//     // ═══════════════════════════════════════════════════════════════
//     //  FINITE STATE MACHINE
//     // ═══════════════════════════════════════════════════════════════
//     let fsmState = FSM_STATE.IDLE;

//     function transitionFSM(newState) {
//       const prev = fsmState;
//       fsmState = newState;
//       console.log(
//         `[FLOW: ${session?.collected?.intent || "unknown"}][STEP: fsm_transition][STATUS: ok][DATA: from="${prev}" to="${newState}"]`,
//       );
//       socket.emit("fsm_state", newState);
//     }

//     // ═══════════════════════════════════════════════════════════════
//     //  FIX (Issue 3 — debugState): Define the debugState helper that
//     //  was called in response.done but never declared, causing a
//     //  ReferenceError crash every time a response completed.
//     // ═══════════════════════════════════════════════════════════════
//     function debugState() {
//       const c = session.collected || {};
//       console.log(
//         `[DEBUG_STATE] fsm=${fsmState} salesStep=${salesStep} emailMode=${emailCaptureMode} ` +
//           `emailConfirmAsked=${emailCaptureConfirmAsked} emailValue="${email_state.value}" ` +
//           `emailConfirmed=${email_state.is_confirmed} ticketBlocked=${createTicketBlockedForEmail} ` +
//           `pendingFn=${pendingFunctionCalls} responseActive=${isResponseActive} ` +
//           `speaking=${assistantSpeaking} elStreaming=${elevenLabsStreaming} ` +
//           `intent=${c.intent || "none"} leadInterest=${c.leadInterest || "none"} ` +
//           `websiteCheckDone=${c._websiteCheckDone || false}`,
//       );
//     }

//     // ═══════════════════════════════════════════════════════════════
//     //  CENTRAL TIMER MANAGER
//     //
//     //  FIX (Issue 1 / Fix P5): Silence timer starts ONLY from audio_done
//     //  (client signals TTS playback finished). Never from response.done or
//     //  isFinal. This prevents the timer from firing while audio is still
//     //  being played to the user.
//     // ═══════════════════════════════════════════════════════════════
//     const TimerManager = (() => {
//       let _silenceTimer = null;
//       let _emailConfirmTimer = null;
//       let _finalMessageTimer = null;
//       let _watchdogTimer = null;

//       // 15s normal, 20s after package presentation
//       const SILENCE_NORMAL_MS = 15000;
//       const SILENCE_PACKAGE_MS = 20000;
//       const EMAIL_CONFIRM_MS = 30000;
//       const WATCHDOG_MS = 8000; // max wait before recovery response

//       function _clearSilence() {
//         if (_silenceTimer) {
//           clearTimeout(_silenceTimer);
//           _silenceTimer = null;
//           console.log(`⏱️  [TMgr] Silence timer CLEARED`);
//         }
//       }
//       function _clearEmailConfirm() {
//         if (_emailConfirmTimer) {
//           clearTimeout(_emailConfirmTimer);
//           _emailConfirmTimer = null;
//           console.log(`⏱️  [TMgr] Email confirm timer CLEARED`);
//         }
//       }
//       function _clearFinalMessage() {
//         if (_finalMessageTimer) {
//           clearTimeout(_finalMessageTimer);
//           _finalMessageTimer = null;
//         }
//       }
//       function _clearWatchdog() {
//         if (_watchdogTimer) {
//           clearTimeout(_watchdogTimer);
//           _watchdogTimer = null;
//         }
//       }

//       return {
//         // FIX (P5): ONLY called from audio_done. Duration determined by isPackage flag.
//         startSilence(isPackage = false) {
//           _clearSilence();
//           console.log(
//             `⏱️  [TMgr] startSilence called - isPackage=${isPackage}`,
//           );

//           // Guard: suppress in non-LISTENING states
//           if (
//             fsmState === FSM_STATE.EMAIL_CAPTURE ||
//             fsmState === FSM_STATE.EMAIL_CONFIRMATION ||
//             fsmState === FSM_STATE.SPEAKING ||
//             fsmState === FSM_STATE.TOOL_EXECUTING ||
//             fsmState === FSM_STATE.FINAL
//           ) {
//             console.log(
//               `⏱️  [TMgr] Silence timer suppressed (FSM: ${fsmState})`,
//             );
//             return;
//           }
//           if (emailCaptureMode) {
//             console.log(
//               `⏱️  [TMgr] Silence timer suppressed (emailCaptureMode)`,
//             );
//             return;
//           }
//           if (awaitingStructuredInput) return;
//           if (finalMessageLock || session.finalLock) return;
//           if (pendingFunctionCalls > 0) return;
//           if (elevenLabsStreaming) {
//             console.log(`⏱️  [TMgr] Silence timer suppressed (EL streaming)`);
//             return;
//           }
//           if (assistantSpeaking) return;

//           const timeoutMs = isPackage ? SILENCE_PACKAGE_MS : SILENCE_NORMAL_MS;
//           console.log(
//             `⏱️  [TMgr] Silence timer START: ${timeoutMs / 1000}s (${isPackage ? "package" : "normal"}) [FSM: ${fsmState}]`,
//           );

//           _silenceTimer = setTimeout(() => {
//             _silenceTimer = null;
//             // Re-check guards at fire time
//             if (emailCaptureMode) return;
//             if (fsmState === FSM_STATE.EMAIL_CAPTURE) return;
//             if (fsmState === FSM_STATE.EMAIL_CONFIRMATION) return;
//             if (fsmState === FSM_STATE.SPEAKING) return;
//             if (fsmState === FSM_STATE.TOOL_EXECUTING) return;
//             if (fsmState === FSM_STATE.FINAL) return;
//             if (awaitingStructuredInput) return;
//             if (finalMessageLock || session.finalLock) return;
//             if (pendingFunctionCalls > 0) return;
//             if (assistantSpeaking) return;
//             if (elevenLabsStreaming) return;

//             const nudgeText = isPackage
//               ? "[SILENCE_NUDGE] The user has not responded after you presented plans. Do NOT select a plan for them. Simply ask them gently which plan they'd like to go with."
//               : "[SILENCE_NUDGE] The user has not responded. REPEAT your last question. Do NOT move forward.";

//             console.log(
//               `⏰ [TMgr] Silence fired (${timeoutMs / 1000}s) — nudging AI`,
//             );
//             if (openaiWs?.readyState === WebSocket.OPEN) {
//               openaiWs.send(
//                 JSON.stringify({
//                   type: "conversation.item.create",
//                   item: {
//                     type: "message",
//                     role: "user",
//                     content: [{ type: "input_text", text: nudgeText }],
//                   },
//                 }),
//               );
//               scheduleResponseCreate();
//             }
//           }, timeoutMs);
//         },

//         resetSilence() {
//           _clearSilence();
//           console.log(`⏱️  [TMgr] User input detected → timer reset`);
//         },

//         clearSilence: _clearSilence,

//         startEmailConfirm() {
//           _clearEmailConfirm();
//           console.log(
//             `⏱️  [TMgr] Email confirm timer START (${EMAIL_CONFIRM_MS / 1000}s)`,
//           );
//           _emailConfirmTimer = setTimeout(() => {
//             _emailConfirmTimer = null;
//             if (!emailCaptureMode || !emailCaptureConfirmAsked) return;
//             console.log(`⏰ [TMgr] Email confirm timeout — re-asking`);
//             if (openaiWs?.readyState === WebSocket.OPEN) {
//               openaiWs.send(
//                 JSON.stringify({
//                   type: "conversation.item.create",
//                   item: {
//                     type: "message",
//                     role: "user",
//                     content: [
//                       {
//                         type: "input_text",
//                         text: `[SYSTEM_CONTEXT]: The customer hasn't responded to the email confirmation. Re-read the email back: "${email_state.value}" — spell each letter individually with hyphens, say "at" for @, say "dot" for full stops. Never say "double X". Ask again if it's correct.`,
//                       },
//                     ],
//                   },
//                 }),
//               );
//               scheduleResponseCreate();
//             }
//           }, EMAIL_CONFIRM_MS);
//         },

//         clearEmailConfirm: _clearEmailConfirm,

//         // Watchdog — if no response within WATCHDOG_MS after a response.create, recover
//         startWatchdog() {
//           _clearWatchdog();
//           _watchdogTimer = setTimeout(() => {
//             _watchdogTimer = null;
//             if (!isResponseActive && pendingFunctionCalls === 0) {
//               console.warn(
//                 `⚠️ [TMgr] Watchdog fired — agent stuck, triggering recovery`,
//               );
//               if (openaiWs?.readyState === WebSocket.OPEN) {
//                 openaiWs.send(
//                   JSON.stringify({
//                     type: "conversation.item.create",
//                     item: {
//                       type: "message",
//                       role: "user",
//                       content: [
//                         {
//                           type: "input_text",
//                           text: "[SYSTEM_CONTEXT]: Please respond immediately to the last user message.",
//                         },
//                       ],
//                     },
//                   }),
//                 );
//                 scheduleResponseCreate(null, 0, true);
//               }
//             }
//           }, WATCHDOG_MS);
//         },

//         clearWatchdog: _clearWatchdog,

//         startFinalLock(durationMs = 15000, onRelease) {
//           _clearFinalMessage();
//           finalMessageLock = true;
//           session.finalLock = true;
//           _clearSilence();
//           console.log(`🔒 [TMgr] Final message lock ON (${durationMs}ms)`);
//           _finalMessageTimer = setTimeout(() => {
//             _finalMessageTimer = null;
//             finalMessageLock = false;
//             session.finalLock = false;
//             console.log("🔓 [TMgr] Final message lock auto-released");
//             socket.emit("status", "listening");
//             if (onRelease) onRelease();
//           }, durationMs);
//         },

//         releaseFinalLock() {
//           if (!finalMessageLock && !session.finalLock) return;
//           finalMessageLock = false;
//           session.finalLock = false;
//           _clearFinalMessage();
//           console.log("🔓 [TMgr] Final message lock released");
//         },

//         clearAll() {
//           _clearSilence();
//           _clearEmailConfirm();
//           _clearFinalMessage();
//           _clearWatchdog();
//         },

//         get hasSilenceTimer() {
//           return _silenceTimer !== null;
//         },
//         get hasEmailConfirmTimer() {
//           return _emailConfirmTimer !== null;
//         },
//       };
//     })();

//     // ─── Final message lock flags ──────────────────────────────────
//     let finalMessageLock = false;

//     // ═══════════════════════════════════════════════════════════════
//     //  EMAIL CAPTURE STATE
//     //
//     //  KEY INVARIANTS (FIX Issue 1 / P1):
//     //  - email_state.value is ALWAYS the latest parsed email.
//     //  - On any new input, setEmailValue() hard-overwrites it AND
//     //    resets is_confirmed=false.
//     //  - emailCaptureBuffer is FULLY cleared on every retry/correction
//     //    so stale fragments never bleed into the next parse cycle.
//     //  - createTicketBlockedForEmail stays true until confirmEmail()
//     //    is called (is_confirmed=true). (FIX Issue 4 / P4)
//     // ═══════════════════════════════════════════════════════════════
//     let emailCaptureMode = false;
//     let emailCaptureBuffer = [];
//     let emailCaptureAttempt = 0;
//     const EMAIL_MAX_ATTEMPTS = 3;
//     let emailCaptureConfirmPending = null;
//     let emailCaptureConfirmAsked = false;

//     // FIX (Issue 4 / P4): Block create_ticket until email_state.is_confirmed === true
//     let createTicketBlockedForEmail = false;

//     function startEmailCapture() {
//       if (emailCaptureMode) {
//         console.log(
//           `[FLOW: sales][STEP: email_capture][STATUS: skipped][DATA: reason=already_active]`,
//         );
//         return; // idempotent
//       }
//       console.log(
//         `[FLOW: sales][STEP: email_capture][STATUS: starting][DATA: attempt=1 maxAttempts=${EMAIL_MAX_ATTEMPTS}]`,
//       );
//       emailCaptureMode = true;
//       emailCaptureBuffer = [];
//       emailCaptureAttempt = 0;
//       emailCaptureConfirmPending = null;
//       emailCaptureConfirmAsked = false;
//       // Reset email_state on every fresh capture start
//       email_state.value = "";
//       email_state.is_confirmed = false;
//       createTicketBlockedForEmail = true;

//       TimerManager.clearSilence();
//       TimerManager.clearEmailConfirm();

//       transitionFSM(FSM_STATE.EMAIL_CAPTURE);
//       console.log(
//         `[FLOW: sales][STEP: email_capture][STATUS: active][DATA: buffer=[] blocked=true]`,
//       );
//       socket.emit("email_spelling_mode", { active: true, attempt: 1 });
//     }

//     function resetEmailCapture() {
//       emailCaptureMode = false;
//       emailCaptureBuffer = [];
//       emailCaptureConfirmPending = null;
//       emailCaptureConfirmAsked = false;
//       TimerManager.clearEmailConfirm();
//       transitionFSM(FSM_STATE.LISTENING);
//       socket.emit("email_spelling_mode", { active: false });
//       console.log(
//         `[FLOW: sales][STEP: email_capture][STATUS: reset][DATA: mode=false]`,
//       );
//     }

//     function handleEmailCaptureTranscript(text) {
//       if (!emailCaptureMode) {
//         console.log(
//           `[FLOW: sales][STEP: email_capture][STATUS: skipped][DATA: reason=not_in_capture_mode]`,
//         );
//         return false;
//       }

//       const cleaned = normalizeText(text);
//       if (!cleaned) {
//         console.log(
//           `[FLOW: sales][STEP: email_capture][STATUS: skipped][DATA: reason=empty_transcript]`,
//         );
//         return true;
//       }

//       console.log(
//         `[FLOW: sales][STEP: email_capture][STATUS: processing][DATA: attempt=${emailCaptureAttempt + 1} input="${cleaned}" bufferLen=${emailCaptureBuffer.length}]`,
//       );
//       console.log(
//         `[FLOW: sales][STEP: email_capture][STATUS: debug][DATA: confirmPending=${emailCaptureConfirmPending} confirmAsked=${emailCaptureConfirmAsked}]`,
//       );

//       // ── Phase 2: Waiting for YES/NO confirmation ────────────────
//       if (emailCaptureConfirmPending && emailCaptureConfirmAsked) {
//         console.log(
//           `[FLOW: sales][STEP: email_confirmation][STATUS: awaiting][DATA: email="${emailCaptureConfirmPending}" input="${cleaned}"]`,
//         );
//         TimerManager.clearEmailConfirm();

//         const lower = cleaned.toLowerCase().trim();
//         const isYes =
//           /\b(yes|yeah|yep|yup|correct|that'?s right|that is correct|right|confirm|confirmed|affirmative|go ahead|sounds good)\b/.test(
//             lower,
//           );
//         const isNo =
//           /\b(no|nope|wrong|incorrect|that'?s wrong|not right|try again|redo|different|change|mistake)\b/.test(
//             lower,
//           );

//         if (isYes) {
//           const confirmedEmail = emailCaptureConfirmPending;
//           console.log(
//             `[FLOW: sales][STEP: email_confirmation][STATUS: success][DATA: email="${confirmedEmail}" userSaid="yes"]`,
//           );

//           // FIX (Issue 1 / P1+P4): Hard overwrite then confirm — this is the ONLY place
//           // is_confirmed becomes true, so ticket creation is only unblocked here.
//           setEmailValue(confirmedEmail);
//           confirmEmail(); // sets is_confirmed=true AND syncs to session.collected.email

//           console.log(
//             `[FLOW: sales][STEP: email_confirmed][STATUS: locked][DATA: email="${confirmedEmail}" is_confirmed=true createTicketBlocked=false]`,
//           );

//           // FIX (Issue 4 / P4): Unblock create_ticket ONLY after email_state.is_confirmed=true
//           createTicketBlockedForEmail = false;

//           if (salesStep === "email") advanceSalesStep("email");

//           const userMsg = `My email address is ${confirmedEmail}`;
//           session.messages.push({ role: "user", content: userMsg });
//           sessions.set(session.id, session);
//           socket.emit("user_transcript", userMsg);

//           resetEmailCapture();

//           if (openaiWs?.readyState === WebSocket.OPEN) {
//             openaiWs.send(
//               JSON.stringify({
//                 type: "conversation.item.create",
//                 item: {
//                   type: "message",
//                   role: "user",
//                   content: [{ type: "input_text", text: userMsg }],
//                 },
//               }),
//             );
//             const salesHint = buildSalesStepHint() || "";
//             const hint = `The customer has confirmed their email address as ${confirmedEmail}. email_state.is_confirmed=true. createTicketBlockedForEmail=false. ${salesHint} Proceed to the next step immediately. If all required details are collected (name, phone, email, plan), call create_ticket NOW.`;
//             console.log(
//               `[FLOW: sales][STEP: create_ticket_trigger][STATUS: pending][DATA: email="${confirmedEmail}" allReady=true]`,
//             );
//             openaiWs.send(
//               JSON.stringify({
//                 type: "conversation.item.create",
//                 item: {
//                   type: "message",
//                   role: "user",
//                   content: [
//                     { type: "input_text", text: `[SYSTEM_CONTEXT]: ${hint}` },
//                   ],
//                 },
//               }),
//             );
//             scheduleResponseCreate();
//           }
//           return true;
//         }

//         if (isNo) {
//           console.log(
//             `[FLOW: sales][STEP: email_confirmation][STATUS: rejected][DATA: email="${emailCaptureConfirmPending}" userSaid="no"]`,
//           );
//           emailCaptureAttempt++;
//           emailCaptureConfirmPending = null;
//           emailCaptureConfirmAsked = false;

//           // FIX (P1): FULL reset — discard ALL state from previous attempt
//           emailCaptureBuffer = [];
//           email_state.value = "";
//           email_state.is_confirmed = false;
//           createTicketBlockedForEmail = true; // re-block until re-confirmed
//           console.log(
//             `[FLOW: sales][STEP: email_capture][STATUS: retry][DATA: attempt=${emailCaptureAttempt}/${EMAIL_MAX_ATTEMPTS} bufferCleared=true confirmed=false]`,
//           );

//           if (emailCaptureAttempt >= EMAIL_MAX_ATTEMPTS) {
//             console.warn(
//               `[FLOW: sales][STEP: email_capture][STATUS: max_retries][DATA: attempts=${EMAIL_MAX_ATTEMPTS}]`,
//             );
//             createTicketBlockedForEmail = false;
//             resetEmailCapture();
//             if (openaiWs?.readyState === WebSocket.OPEN) {
//               openaiWs.send(
//                 JSON.stringify({
//                   type: "conversation.item.create",
//                   item: {
//                     type: "message",
//                     role: "user",
//                     content: [
//                       {
//                         type: "input_text",
//                         text: `[SYSTEM_CONTEXT]: Email capture has failed after ${EMAIL_MAX_ATTEMPTS} attempts. Tell the customer you're having trouble capturing the email by voice and ask them to call 1300 101 414 or email support@infinetbroadband.com.au to complete their order. Be apologetic and warm.`,
//                       },
//                     ],
//                   },
//                 }),
//               );
//               scheduleResponseCreate();
//             }
//             return true;
//           }

//           socket.emit("email_spelling_mode", {
//             active: true,
//             attempt: emailCaptureAttempt + 1,
//           });

//           if (openaiWs?.readyState === WebSocket.OPEN) {
//             openaiWs.send(
//               JSON.stringify({
//                 type: "conversation.item.create",
//                 item: {
//                   type: "message",
//                   role: "user",
//                   content: [
//                     {
//                       type: "input_text",
//                       text: `[SYSTEM_CONTEXT]: The customer said the email was wrong. This is attempt ${emailCaptureAttempt + 1} of ${EMAIL_MAX_ATTEMPTS}. Ask them to spell the COMPLETE email again from the beginning, one letter at a time. Remind them: for @ use 'at', for . use 'dot'. Spell each letter individually — never say "double X". Be patient and encouraging.`,
//                     },
//                   ],
//                 },
//               }),
//             );
//             scheduleResponseCreate();
//           }
//           return true;
//         }

//         // Ambiguous — treat as re-spell
//         console.log(
//           `[FLOW: sales][STEP: email_confirmation][STATUS: ambiguous][DATA: input="${cleaned}" treating_as=re_spell]`,
//         );
//         emailCaptureConfirmPending = null;
//         emailCaptureConfirmAsked = false;
//         transitionFSM(FSM_STATE.EMAIL_CAPTURE);
//         // Fall through to Phase 1
//       }

//       // ── Phase 1: Parse the spoken email ─────────────────────────
//       const looksLikeDomainCorrection =
//         /^www\.[a-z0-9_-]+\.(com|ai|co|net|org|au|io)/i.test(cleaned) ||
//         (/^[a-z0-9_-]+\s+(dot|point)\s+(com|ai|co|net|org|au|io)/i.test(
//           cleaned,
//         ) &&
//           !cleaned.includes("@"));

//       if (looksLikeDomainCorrection && emailCaptureBuffer.length > 0) {
//         console.log(
//           `[FLOW: sales][STEP: email_capture][STATUS: domain_correction][DATA: bufferCleared=true]`,
//         );
//         // Full reset on domain correction
//         emailCaptureBuffer = [];
//         emailCaptureConfirmPending = null;
//         emailCaptureConfirmAsked = false;
//         email_state.value = "";
//         email_state.is_confirmed = false;
//         createTicketBlockedForEmail = true;
//       }

//       emailCaptureBuffer.push(cleaned);
//       const combinedTranscript = emailCaptureBuffer.join(" ");
//       console.log(
//         `[FLOW: sales][STEP: email_capture][STATUS: parsing][DATA: combined="${combinedTranscript}" bufferLen=${emailCaptureBuffer.length}]`,
//       );
//       const parsed = parseVoiceEmail(combinedTranscript);
//       console.log(
//         `[FLOW: sales][STEP: email_capture][STATUS: parse_result][DATA: parsed="${parsed}" raw="${combinedTranscript}"]`,
//       );

//       if (!parsed) {
//         console.log(
//           `[FLOW: sales][STEP: email_capture][STATUS: parse_failed][DATA: combined="${combinedTranscript}"]`,
//         );
//         if (combinedTranscript.split(/\s+/).length < 3) {
//           console.log(
//             `[FLOW: sales][STEP: email_capture][STATUS: waiting][DATA: reason=buffer_too_short]`,
//           );
//           return true;
//         }
//         if (openaiWs?.readyState === WebSocket.OPEN) {
//           openaiWs.send(
//             JSON.stringify({
//               type: "conversation.item.create",
//               item: {
//                 type: "message",
//                 role: "user",
//                 content: [
//                   {
//                     type: "input_text",
//                     text: `[SYSTEM_CONTEXT]: The customer is spelling their email but I couldn't parse it fully. Heard: "${combinedTranscript}". Ask them to repeat from the beginning, one letter at a time. For @ use 'at', for . use 'dot'. Be warm and patient.`,
//                   },
//                 ],
//               },
//             }),
//           );
//           scheduleResponseCreate();
//         }
//         // Clear buffer so the next attempt starts fresh
//         emailCaptureBuffer = [];
//         return true;
//       }

//       // Hard overwrite — latest parsed email is always the truth
//       setEmailValue(parsed);
//       emailCaptureConfirmPending = parsed;
//       emailCaptureConfirmAsked = true;

//       console.log(
//         `[FLOW: sales][STEP: email_capture][STATUS: parsed_ok][DATA: email="${parsed}" requesting_confirmation=true]`,
//       );
//       socket.emit("email_spelling_confirmation", { email: parsed });

//       transitionFSM(FSM_STATE.EMAIL_CONFIRMATION);
//       TimerManager.startEmailConfirm();

//       if (openaiWs?.readyState === WebSocket.OPEN) {
//         openaiWs.send(
//           JSON.stringify({
//             type: "conversation.item.create",
//             item: {
//               type: "message",
//               role: "user",
//               content: [
//                 {
//                   type: "input_text",
//                   text: `[SYSTEM_CONTEXT]: I parsed the customer's spoken email as: "${parsed}". Read this email address back clearly. MANDATORY FORMAT: spell the local part (before @) using individual letters separated by hyphens. Example: if local part is "shaun" say "s-h-a-u-n". Never say "double X" even for repeated letters — always say each letter separately (e.g. "l-l" not "double l"). Then say "at". Then say the domain with "dot" between parts. Full example for john.doe@gmail.com: "I've got j-o-h-n dot d-o-e at g-m-a-i-l dot c-o-m — is that correct?" Wait for yes or no only.`,
//                 },
//               ],
//             },
//           }),
//         );
//         scheduleResponseCreate();
//       }

//       return true;
//     }

//     // ─── Sales step machine ────────────────────────────────────────
//     function initSalesStepMachine() {
//       if (salesStep !== null) return;
//       const c = session.collected || {};

//       // Website check must be DONE before initialising step machine
//       if (c.leadInterest && c._websiteCheckDone) {
//         if (!c._firstName) salesStep = "firstName";
//         else if (!c._lastName) salesStep = "lastName";
//         else if (!c.phone) salesStep = "phone";
//         else if (!c.email || !email_state.is_confirmed) salesStep = "email";
//         else salesStep = "createTicket";
//         console.log(
//           `[FLOW: sales][STEP: init_step_machine][STATUS: ok][DATA: startStep="${salesStep}" websiteCheckDone=true]`,
//         );
//       } else {
//         console.log(
//           `[FLOW: sales][STEP: init_step_machine][STATUS: blocked][DATA: leadInterest=${!!c.leadInterest} websiteCheckDone=${!!c._websiteCheckDone}]`,
//         );
//       }
//     }

//     function advanceSalesStep(completedStep) {
//       const c = session.collected || {};
//       if (salesStep !== completedStep) return;
//       const order = [
//         "firstName",
//         "lastName",
//         "phone",
//         "email",
//         "createTicket",
//         "done",
//       ];
//       const idx = order.indexOf(completedStep);
//       if (idx === -1) return;
//       const next = order[idx + 1];
//       if (!next) {
//         salesStep = "done";
//         return;
//       }
//       if (next === "lastName" && c._lastName) {
//         advanceSalesStep("lastName");
//         return;
//       }
//       if (next === "phone" && c.phone) {
//         advanceSalesStep("phone");
//         return;
//       }
//       if (next === "email" && c.email && email_state.is_confirmed) {
//         advanceSalesStep("email");
//         return;
//       }
//       if (
//         next === "createTicket" &&
//         c._firstName &&
//         c._lastName &&
//         c.phone &&
//         c.email &&
//         email_state.is_confirmed
//       ) {
//         salesStep = "createTicket";
//       } else {
//         salesStep = next;
//       }
//       console.log(
//         `[FLOW: sales][STEP: advance_step][STATUS: ok][DATA: from="${completedStep}" to="${salesStep}"]`,
//       );
//     }

//     function buildSalesStepHint() {
//       const c = session.collected || {};

//       // FIX (Issue 2): Website check gate — ALWAYS inject before any detail collection
//       if (c.leadInterest && c._websiteCheckRequired && !c._websiteCheckDone) {
//         if (!c._websiteCheckAsked) {
//           console.log(
//             `[FLOW: sales][STEP: website_check][STATUS: not_asked][DATA: websiteCheckRequired=true websiteCheckDone=false]`,
//           );
//           return `SALES STEP [website_check]: You MUST ask: "Just out of curiosity — have you had a chance to check out our website and seen the plans or pricing?" Do NOT proceed to collect name, phone, or email until this question is asked and answered. websiteCheckAsked=${c._websiteCheckAsked} websiteCheckDone=${c._websiteCheckDone}`;
//         } else {
//           console.log(
//             `[FLOW: sales][STEP: website_check][STATUS: asked_awaiting_answer][DATA: websiteCheckAsked=true websiteCheckDone=false]`,
//           );
//           return `SALES STEP [website_check]: Website check already asked. Wait for customer answer. Do NOT proceed to name/phone/email yet. websiteCheckDone=${c._websiteCheckDone}`;
//         }
//       }

//       if (
//         salesStep === null &&
//         c.leadInterest &&
//         (c._websiteCheckDone || c._websiteCheckAsked)
//       ) {
//         initSalesStepMachine();
//       }

//       if (!salesStep || salesStep === "done") return null;

//       const name = c._firstName || c.preferredName || "";

//       switch (salesStep) {
//         case "firstName":
//           return `[FLOW: sales][STEP: firstName][STATUS: pending] Ask ONLY for the customer's first name. Say something like "Could I start with your first name?" Say NOTHING else.`;

//         case "lastName":
//           return `[FLOW: sales][STEP: lastName][STATUS: pending] You have their first name (${c._firstName || "collected"}). Ask ONLY for their last name. Say something like "And your last name?"`;

//         case "phone":
//           return `[FLOW: sales][STEP: phone][STATUS: pending] You have their name (${name}). Ask ONLY for their mobile phone number. Say something like "What's the best mobile number for you?"`;

//         case "email":
//           // If email already confirmed, skip
//           if (email_state.value && email_state.is_confirmed) {
//             console.log(
//               `[FLOW: sales][STEP: email][STATUS: already_confirmed][DATA: email="${email_state.value}" skipping=true]`,
//             );
//             advanceSalesStep("email");
//             return buildSalesStepHint();
//           }
//           // If capture already active, don't re-ask
//           if (emailCaptureMode) {
//             return `[FLOW: sales][STEP: email][STATUS: capture_active] Email capture is already in progress. Do NOT ask for email again. Wait for the customer to finish spelling their email. emailCaptureMode=true confirmAsked=${emailCaptureConfirmAsked}`;
//           }
//           // FIX (Issue 2): No mention of text input box — voice only
//           return `[FLOW: sales][STEP: email][STATUS: pending] Ask for email: "Could I grab your email address? Please spell it letter by letter — for at the rate say 'at', for dots say 'dot'. Example: j-o-h-n dot d-o-e at g-m-a-i-l dot c-o-m. Take your time." Then STOP and wait.`;

//         case "createTicket": {
//           // FIX (Issue 4 / P4): Never trigger if email not confirmed
//           if (createTicketBlockedForEmail) {
//             console.log(
//               `[FLOW: sales][STEP: create_ticket][STATUS: blocked][DATA: reason=email_not_confirmed is_confirmed=${email_state.is_confirmed}]`,
//             );
//             return `[FLOW: sales][STEP: email][STATUS: capture_required] Email not yet confirmed. Do NOT call create_ticket. email_state.is_confirmed=${email_state.is_confirmed} createTicketBlockedForEmail=true. Ask for email NOW using VOICE SPELLING MODE.`;
//           }

//           const missing = [];
//           if (!c._firstName && !c.name && !c.preferredName)
//             missing.push("name");
//           if (!c.phone) missing.push("phone");
//           if (!c.email) missing.push("email");
//           if (!c.leadInterest) missing.push("selected plan");

//           if (missing.length > 0) {
//             console.log(
//               `[FLOW: sales][STEP: create_ticket][STATUS: missing_fields][DATA: missing=${JSON.stringify(missing)}]`,
//             );
//             if (!c.phone) salesStep = "phone";
//             else if (!c.email) salesStep = "email";
//             return buildSalesStepHint();
//           }

//           console.log(
//             `[FLOW: sales][STEP: create_ticket][STATUS: ready][DATA: name="${c._firstName} ${c._lastName}" phone="${c.phone}" email="${c.email}" plan="${c.leadInterest}"]`,
//           );
//           return `[FLOW: sales][STEP: create_ticket][STATUS: execute] ALL required details collected:
// - Name: ${c._firstName || ""} ${c._lastName || ""} / ${c.name || ""}
// - Phone: ${c.phone}
// - Email: ${c.email}
// - Plan: ${c.leadInterest}
// - Address: ${c.address || "provided earlier"}
// - email_state.is_confirmed: true

// STEP 1: Call extract_call_fields to save any recently collected details.
// STEP 2: THEN call create_ticket IMMEDIATELY. Do NOT say anything to the user first. CALL THE TOOLS.`;
//         }

//         default:
//           return null;
//       }
//     }

//     // ─── Raw phone buffer ──────────────────────────────────────────
//     let rawPhoneBuffer = null;
//     let awaitingPhoneVerification = false;

//     // ─── Single pending response.create gate ──────────────────────
//     let responseCreatePending = false;

//     function scheduleResponseCreate(
//       contextHint = null,
//       delayMs = 0,
//       force = false,
//     ) {
//       if (isResponseActive && !force) {
//         if (contextHint) pendingPostDoneHint = contextHint;
//         pendingPostDoneCreate = true;
//         console.log(`⏳ scheduleResponseCreate queued for post-done`);
//         return;
//       }

//       if (responseCreatePending && !force) {
//         console.log(`⏭️  scheduleResponseCreate skipped (pending already)`);
//         return;
//       }
//       responseCreatePending = true;

//       const send = () => {
//         responseCreatePending = false;
//         if (openaiWs?.readyState !== WebSocket.OPEN) return;
//         if (isResponseActive && !force) {
//           pendingPostDoneCreate = true;
//           if (contextHint) pendingPostDoneHint = contextHint;
//           return;
//         }

//         const salesHint = buildSalesStepHint();
//         const combinedHint = [contextHint, salesHint]
//           .filter(Boolean)
//           .join("\n\n");

//         if (combinedHint) {
//           openaiWs.send(
//             JSON.stringify({
//               type: "conversation.item.create",
//               item: {
//                 type: "message",
//                 role: "user",
//                 content: [
//                   {
//                     type: "input_text",
//                     text: `[SYSTEM_CONTEXT]: ${combinedHint}`,
//                   },
//                 ],
//               },
//             }),
//           );
//         }

//         console.log("📤 Sending response.create to OpenAI");
//         openaiWs.send(JSON.stringify({ type: "response.create" }));

//         // Start watchdog ONLY after the actual send
//         TimerManager.startWatchdog();
//       };

//       if (delayMs > 0) {
//         setTimeout(send, delayMs);
//       } else {
//         send();
//       }
//     }

//     // ─── Detection helpers ─────────────────────────────────────────
//     function detectPhoneVerificationRequest(text) {
//       if (!text) return false;
//       const lower = text.toLowerCase();
//       const c = session.collected || {};
//       if (!c._emailVerifiedCustomerId) return false;
//       if (c._phoneVerified) return false;
//       return (
//         lower.includes("phone") ||
//         lower.includes("contact number") ||
//         lower.includes("mobile number") ||
//         lower.includes("number on the account")
//       );
//     }

//     function mapOrdinalNetworkChoice(text) {
//       const t = (text || "").toLowerCase().trim();
//       if (/\bnbn\b/.test(t) || /\b(opti\s*comm|opticomm)\b/.test(t))
//         return null;
//       if (
//         /\b(first|1st|one|1|option\s*1|option\s*one|number\s*1|the\s*first)\b/.test(
//           t,
//         )
//       )
//         return "NBN";
//       if (
//         /\b(second|2nd|two|2|option\s*2|option\s*two|number\s*2|the\s*second|to)\b/.test(
//           t,
//         )
//       )
//         return "Opticomm";
//       return null;
//     }

//     function wasLastMessageNetworkQuestion() {
//       const msgs = session.messages || [];
//       for (let i = msgs.length - 1; i >= 0; i--) {
//         if (msgs[i].role === "assistant") {
//           const t = (msgs[i].content || "").toLowerCase();
//           return (
//             (t.includes("nbn") && t.includes("opticomm")) ||
//             (t.includes("first option") && t.includes("second option")) ||
//             t.includes("nbn or opticomm") ||
//             t.includes("which one would you prefer")
//           );
//         }
//         if (msgs[i].role === "user") break;
//       }
//       return false;
//     }

//     function detectPlanPresentation(text) {
//       if (!text) return false;
//       const lower = text.toLowerCase();
//       return (
//         (lower.includes("mbps") &&
//           (lower.includes("$") ||
//             lower.includes("per month") ||
//             lower.includes("/m"))) ||
//         (lower.includes("plan") && lower.includes("available")) ||
//         lower.includes("here are the plans") ||
//         lower.includes("which of those plans") ||
//         lower.includes("catches your eye")
//       );
//     }

//     function detectWebsiteCheckQuestion(text) {
//       if (!text) return false;
//       const lower = text.toLowerCase();
//       return (
//         lower.includes("check out our website") ||
//         lower.includes("visited our website") ||
//         lower.includes("had a chance to check out") ||
//         lower.includes("seen the plans or pricing") ||
//         lower.includes("look at the plans or pricing") ||
//         (lower.includes("website") &&
//           (lower.includes("plans") || lower.includes("pricing")))
//       );
//     }

//     function detectWebsiteCheckAnswer(text) {
//       if (!text) return false;
//       const lower = text.toLowerCase().trim();
//       if (
//         /\b(yes|yeah|yep|yup|i have|i did|already|looked|checked|seen|saw|visited)\b/.test(
//           lower,
//         )
//       )
//         return true;
//       if (
//         /\b(no|nope|not yet|haven't|didn't|i haven't|i didn't|no i haven't)\b/.test(
//           lower,
//         )
//       )
//         return true;
//       return false;
//     }

//     // FIX (Issue 2): detectEmailSpellingRequest used with restrictive guard
//     function detectEmailSpellingRequest(text) {
//       if (!text) return false;
//       const lower = text.toLowerCase();
//       return (
//         (lower.includes("spell") && lower.includes("email")) ||
//         (lower.includes("one letter at a time") && lower.includes("email")) ||
//         (lower.includes("nato") && lower.includes("email")) ||
//         (lower.includes("say 'at'") && lower.includes("email")) ||
//         (lower.includes("i'm listening") && lower.includes("email"))
//       );
//     }

//     function detectSalesStepAnswer(text) {
//       if (!salesStep || salesStep === "done" || salesStep === "createTicket")
//         return;
//       const c = session.collected || {};

//       if (salesStep === "firstName") {
//         const words = text.trim().split(/\s+/);
//         const firstName = words[0];
//         if (firstName && firstName.length > 1) {
//           session.collected._firstName = firstName;
//           sessions.set(session.id, session);
//           console.log(
//             `[FLOW: sales][STEP: firstName][STATUS: captured][DATA: firstName="${firstName}"]`,
//           );
//           advanceSalesStep("firstName");
//         }
//       } else if (salesStep === "lastName") {
//         const words = text.trim().split(/\s+/);
//         const lastName = words[words.length - 1];
//         if (lastName && lastName.length > 1) {
//           session.collected._lastName = lastName;
//           session.collected.name = `${c._firstName || ""} ${lastName}`.trim();
//           session.collected.preferredName = c._firstName || lastName;
//           sessions.set(session.id, session);
//           console.log(
//             `[FLOW: sales][STEP: lastName][STATUS: captured][DATA: lastName="${lastName}" fullName="${session.collected.name}"]`,
//           );
//           advanceSalesStep("lastName");
//         }
//       } else if (salesStep === "phone") {
//         const digits = text.replace(/\D/g, "");
//         if (digits.length >= 8) {
//           session.collected.phone = digits;
//           sessions.set(session.id, session);
//           console.log(
//             `[FLOW: sales][STEP: phone][STATUS: captured][DATA: phone="${digits}"]`,
//           );
//           advanceSalesStep("phone");
//         }
//       }
//     }

//     // ═══════════════════════════════════════════════════════════════
//     //  ElevenLabs Connection Management
//     // ═══════════════════════════════════════════════════════════════
//     function openElevenLabsStream(force = false) {
//       if (
//         !force &&
//         elevenLabsWs &&
//         (elevenLabsWs.readyState === WebSocket.OPEN ||
//           elevenLabsWs.readyState === WebSocket.CONNECTING)
//       ) {
//         return;
//       }
//       closeElevenLabsWs();

//       const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_flash_v2_5&output_format=pcm_16000`;
//       const elWs = new WebSocket(wsUrl);

//       elWs.on("open", () => {
//         console.log(`✅ [EL] ElevenLabs WebSocket connected`);
//         elWs.send(
//           JSON.stringify({
//             text: " ",
//             voice_settings: {
//               stability: 0.4,
//               similarity_boost: 0.75,
//               speed: 1.1,
//             },
//             xi_api_key: ELEVENLABS_API_KEY,
//           }),
//         );
//         if (elevenLabsWs === elWs) {
//           elevenLabsReady = true;
//           elevenLabsStreaming = true;
//           for (const text of textBuffer) {
//             sendTextToElevenLabs(text);
//           }
//           textBuffer = [];
//         }
//       });

//       elWs.on("message", (data) => {
//         try {
//           const msg = JSON.parse(data.toString());
//           if (msg.audio) {
//             socket.emit("audio_chunk_pcm", {
//               sampleRate: PCM_SAMPLE_RATE,
//               audio: msg.audio,
//             });
//           }

//           const isFinal =
//             msg.isFinal === true || msg.is_final === true || msg.final === true;

//           if (isFinal) {
//             // FIX (P5): isFinal = ElevenLabs finished GENERATING chunks.
//             // Do NOT start silence timer here. Wait for client audio_done.
//             console.log(
//               `🔊 [EL] TTS generation complete (isFinal) — waiting for client audio_done`,
//             );
//             elevenLabsStreaming = false;
//             assistantSpeaking = false;
//             // Emit for frontend — frontend fires audio_done when playback finishes
//             socket.emit("audio_stream_complete");

//             if (emailCaptureMode && !emailCaptureConfirmAsked) {
//               socket.emit("email_spelling_ready");
//             }
//           }
//         } catch (err) {
//           console.error(`⚠️ [EL] Message parse error:`, err.message);
//         }
//       });

//       elWs.on("error", (err) => {
//         console.warn(`⚠️ [EL] ElevenLabs WS error: ${err.message}`);
//         elevenLabsStreaming = false;
//       });

//       elWs.on("close", () => {
//         if (elevenLabsWs === elWs) {
//           elevenLabsReady = false;
//           elevenLabsStreaming = false;
//         }
//       });

//       elevenLabsWs = elWs;
//     }

//     function interruptElevenLabsStream() {
//       elevenLabsStreaming = false;
//       if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) {
//         openElevenLabsStream(true);
//         return;
//       }
//       try {
//         elevenLabsWs.send(JSON.stringify({ text: "" }));
//       } catch (e) {
//         console.warn("[EL] interrupt flush failed:", e.message);
//       }
//       try {
//         elevenLabsWs.send(
//           JSON.stringify({
//             text: " ",
//             voice_settings: {
//               stability: 0.4,
//               similarity_boost: 0.75,
//               speed: 1.1,
//             },
//             xi_api_key: ELEVENLABS_API_KEY,
//           }),
//         );
//         elevenLabsReady = true;
//         elevenLabsStreaming = true;
//       } catch (e) {
//         console.warn("[EL] re-prime failed:", e.message);
//         openElevenLabsStream(true);
//       }
//     }

//     function sendTextToElevenLabs(text) {
//       if (!text) return;
//       if (elevenLabsWs?.readyState === WebSocket.OPEN) {
//         elevenLabsWs.send(
//           JSON.stringify({ text, try_trigger_generation: true }),
//         );
//       }
//     }

//     function flushElevenLabsStream() {
//       if (elevenLabsWs?.readyState === WebSocket.OPEN) {
//         elevenLabsWs.send(JSON.stringify({ text: "" }));
//       }
//     }

//     function closeElevenLabsWs() {
//       if (elevenLabsWs) {
//         elevenLabsStreaming = false;
//         try {
//           if (elevenLabsWs.readyState === WebSocket.CONNECTING)
//             elevenLabsWs.terminate();
//           else if (elevenLabsWs.readyState === WebSocket.OPEN)
//             elevenLabsWs.close();
//         } catch (err) {
//           console.warn(`⚠️ [EL] Error closing WS: ${err.message}`);
//         }
//         elevenLabsWs = null;
//         elevenLabsReady = false;
//         textBuffer = [];
//       }
//     }

//     // ═══════════════ OpenAI Realtime API ════════════════
//     function connectOpenAI() {
//       return new Promise((resolve, reject) => {
//         openaiWs = new WebSocket(
//           "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview",
//           {
//             headers: {
//               Authorization: `Bearer ${OPENAI_API_KEY}`,
//               "OpenAI-Beta": "realtime=v1",
//             },
//           },
//         );

//         openaiWs.on("open", () => {
//           console.log("✅ [WS-1] OpenAI Realtime connected");
//           const instructions =
//             SYSTEM_PROMPT +
//             "\n\nCRITICAL: Always respond in English only." +
//             "\n\nFIELD COLLECTION RULE: Collect ONE field per turn. Wait for answer before moving on." +
//             // FIX (Issue 1 / P1+P2): Explicit email mutability rules in system prompt
//             "\n\nEMAIL — ABSOLUTE RULES:" +
//             "\n1. Email is ALWAYS mutable. Any new email input DISCARDS the previous one completely." +
//             "\n2. After parsing, you MUST read back the EXACT parsed email (the local part before @) using ONLY individual letters separated by hyphens." +
//             "\n3. CRITICAL: Use the ACTUAL letters from the parsed email. If parsed email is aun@bele.ai, say 'a-u-n' NOT 's-h-a-u-n'. NEVER hallucinate different letters." +
//             "\n4. NEVER say 'double X' for repeated letters. Always say each letter separately: l-l not double-l." +
//             "\n5. If user corrects ANY part, reconstruct the ENTIRE email from scratch. Never partial-edit." +
//             "\n6. Only call any tool with email AFTER the user explicitly says YES to the readback." +
//             // FIX (Issue 2): Guard against re-triggering email capture — voice only, no text box
//             "\n\nEMAIL COLLECTION — VOICE ONLY: Collect email by voice spelling only. Do NOT mention any text input box. Do NOT say 'you can also type it'. Voice spelling is the ONLY method." +
//             "\n\nEMAIL DUPLICATE PREVENTION: If [SYSTEM_CONTEXT] shows emailCaptureMode=true or email_state.value is already set, do NOT ask for email again." +
//             // FIX (Issue 4 / P4): Explicit create_ticket guard
//             "\n\nCREATE_TICKET RULE: NEVER call create_ticket if createTicketBlockedForEmail=true in [SYSTEM_CONTEXT]. Only call it when email_state.is_confirmed=true is explicitly shown." +
//             "\n\nFIELD EXTRACTION RULE: Before calling create_ticket, you MUST first call extract_call_fields to save any name, phone, or other details the customer just provided. create_ticket does NOT save fields automatically — extract_call_fields must be called first." +
//             // FIX (Issue 2): Explicit website check rule in instructions
//             "\n\nWEBSITE CHECK RULE: In sales flow, ALWAYS ask 'have you had a chance to check out our website and seen the plans or pricing?' AFTER plan is selected and BEFORE collecting any personal details (name/phone/email). Never skip this step." +
//             // FIX (Issue 3): Block customer_lookup in sales flow
//             "\n\nCUSTOMER_LOOKUP RULE: NEVER call customer_lookup for a new sales lead. customer_lookup is ONLY for existing customers in support/accounts/relocation flows. If the customer is new (has leadInterest, no customer_id), proceed directly to collect name/phone/email and then call create_ticket." +
//             // FIX: Email spelling instructions for ALL flows (sales and support)
//             "\n\nEMAIL SPELLING INSTRUCTIONS (ALL FLOWS): When asking for email, say: 'Please spell your email address letter by letter. For the at the rate symbol, say 'at'. For dots, say 'dot'. For example: j-o-h-n dot d-o-e at g-m-a-i-l dot c-o-m.' Always read back the email using the same format to confirm.";

//           openaiWs.send(
//             JSON.stringify({
//               type: "session.update",
//               session: {
//                 instructions,
//                 modalities: ["text"],
//                 input_audio_format: "pcm16",
//                 turn_detection: {
//                   type: "server_vad",
//                   threshold: 0.8,
//                   prefix_padding_ms: 300,
//                   silence_duration_ms: 1500,
//                 },
//                 tools: realtimeTools,
//                 tool_choice: "auto",
//                 input_audio_transcription: { model: "whisper-1" },
//               },
//             }),
//           );

//           openElevenLabsStream();
//         });

//         let resolved = false;
//         openaiWs.on("message", (raw) => {
//           try {
//             const data = JSON.parse(raw.toString());
//             if (!resolved) {
//               resolved = true;
//               resolve();
//             }
//             handleOpenAIEvent(data);
//           } catch (e) {
//             console.error("[WS-1] parse error:", e.message);
//           }
//         });

//         openaiWs.on("error", (err) => {
//           console.error("[WS-1] error:", err.message);
//           if (!resolved) {
//             resolved = true;
//             reject(err);
//           }
//         });
//         openaiWs.on("close", (code) => {
//           console.log(`[WS-1] closed (${code})`);
//           closeElevenLabsWs();
//         });
//       });
//     }

//     // ═══════════════ OpenAI Event Handler ════════════════
//     let lastEventLog = "";

//     function handleOpenAIEvent(event) {
//       if (event.type !== lastEventLog) {
//         console.log(`📡 [WS-1] Event: ${event.type}`);
//         lastEventLog = event.type;
//       }

//       switch (event.type) {
//         case "session.created":
//           break;

//         case "session.updated":
//           console.log("✅ [WS-1] Session configured");
//           break;

//         case "input_audio_buffer.speech_started": {
//           if (
//             awaitingStructuredInput ||
//             pendingFunctionCalls > 0 ||
//             session.finalLock ||
//             finalMessageLock
//           ) {
//             console.log(`🔇 Speech ignored (locked)`);
//             if (openaiWs?.readyState === WebSocket.OPEN) {
//               openaiWs.send(
//                 JSON.stringify({ type: "input_audio_buffer.clear" }),
//               );
//             }
//             break;
//           }

//           console.log(`🎙️ USER INTERRUPTED -> Stopping AI Voice`);
//           socket.emit("status", "user_speaking");
//           socket.emit("interrupt");
//           socket.emit("audio_interrupt");

//           // FIX (P5): User speaks → cancel/reset ALL timers immediately
//           TimerManager.resetSilence();
//           TimerManager.clearEmailConfirm();
//           TimerManager.clearWatchdog();

//           if (isResponseActive) {
//             cancelPending = true;
//             openaiWs.send(JSON.stringify({ type: "response.cancel" }));
//           }

//           interruptElevenLabsStream();

//           assistantTextBuffer = "";
//           lastTtsText = "";
//           assistantSpeaking = false;
//           lastResponseWasPackage = false;
//           emptyResponseCount = 0;
//           responseCreatePending = false;
//           // Only reset pendingPostDone if NOT in email confirmation phase
//           // (user interrupting to say "yes" must not lose confirmation state)
//           if (!emailCaptureConfirmAsked) {
//             pendingPostDoneCreate = false;
//             pendingPostDoneHint = null;
//           }
//           break;
//         }

//         case "input_audio_buffer.speech_stopped":
//           socket.emit("status", "processing");
//           break;

//         case "conversation.item.input_audio_transcription.completed": {
//           if (!event.transcript) break;

//           const cleaned = normalizeText(event.transcript);
//           if (!cleaned) break;

//           console.log(
//             `📊 [TRANSCRIPT] raw="${event.transcript}" cleaned="${cleaned}"`,
//           );

//           // Cancel watchdog — got a transcript, agent is not stuck
//           TimerManager.clearWatchdog();

//           const looksLikeEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(cleaned);
//           const digitCount = (cleaned.match(/\d/g) || []).length;
//           const looksLikePhone = digitCount >= 6;

//           // ═══════════════════════════════════════════════════════════
//           // FIX (Issue 1 — isPurePhoneNumber): The original code
//           // referenced `isPurePhoneNumber` which was NEVER DECLARED,
//           // causing a ReferenceError crash on every transcript that
//           // reached the email capture block. We now properly declare
//           // it: a transcript is a "pure phone number" if it's mostly
//           // digits (≥6) and does NOT look like an email. This prevents
//           // phone number input from being misrouted into email capture.
//           // ═══════════════════════════════════════════════════════════
//           const isPurePhoneNumber =
//             looksLikePhone &&
//             !looksLikeEmail &&
//             !looksLikeVoiceEmailSpelling(cleaned);

//           // ─────────────────────────────────────────────────────────
//           // FIX (Issue 1 — THE CORE FIX): Allow email confirmation YES/NO
//           // through even during assistantSpeaking. Without this fix the
//           // "yes" the user says to confirm the email is dropped and the
//           // system loops forever asking for email.
//           //
//           // isEmailConfirmResponse is true when:
//           //   - emailCaptureMode is true (we are in email capture)
//           //   - emailCaptureConfirmAsked is true (AI has already read
//           //     back the parsed email and is waiting for yes/no)
//           //
//           // The race condition in the original code was that
//           // emailCaptureConfirmAsked was checked AFTER the guard that
//           // dropped the transcript. Now we evaluate it FIRST and use it
//           // as a bypass condition for the assistantSpeaking gate.
//           // ─────────────────────────────────────────────────────────
//           const isEmailConfirmResponse =
//             emailCaptureMode && emailCaptureConfirmAsked;
//           // Also allow email spelling through — the user may be spelling while AI is still starting TTS
//           const isEmailSpelling =
//             emailCaptureMode &&
//             !emailCaptureConfirmAsked &&
//             looksLikeVoiceEmailSpelling(cleaned);

//           if (
//             assistantSpeaking &&
//             !(looksLikeEmail || looksLikePhone) &&
//             !isEmailConfirmResponse &&
//             !isEmailSpelling
//           ) {
//             console.log(
//               `🔇 Ignoring transcript during assistant speech (not email confirm or spelling)`,
//             );
//             break;
//           }

//           if (isEmailSpelling) {
//             console.log(
//               `[FLOW: sales][STEP: email_capture][STATUS: allowing_through_during_speech][DATA: input="${cleaned}"]`,
//             );
//           }

//           if (isEmailConfirmResponse) {
//             console.log(
//               `[FLOW: sales][STEP: email_confirmation][STATUS: processing][DATA: input="${cleaned}" allowedDuringAssistantSpeech=true]`,
//             );
//           }

//           if (awaitingPhoneVerification && looksLikePhone) {
//             const digits = cleaned.replace(/\D/g, "");
//             if (digits.length >= 6) {
//               rawPhoneBuffer = digits;
//               console.log(
//                 `[FLOW: support][STEP: phone_verification][STATUS: buffered][DATA: phone="${rawPhoneBuffer}"]`,
//               );
//             }
//           }

//           console.log(
//             `[FLOW: ${session?.collected?.intent || "unknown"}][STEP: transcript][STATUS: ok][DATA: emailMode=${emailCaptureMode} salesStep=${salesStep} looksEmail=${looksLikeEmail} looksSpelling=${looksLikeVoiceEmailSpelling(cleaned)} isPurePhone=${isPurePhoneNumber}]`,
//           );

//           // ═══════════════════════════════════════════════════════════
//           // FIX (Issue 2 — Duplicate email capture block): The original
//           // code had TWO nearly identical blocks that both checked
//           // `emailCaptureMode || (salesStep === "email" && ...)` and
//           // called handleEmailCaptureTranscript(). This caused the email
//           // transcript to be processed TWICE — once routing into capture
//           // and once falling through to be sent as a regular user message
//           // to OpenAI, which confused the LLM. We now have a SINGLE
//           // unified block that handles all email capture routing.
//           // ═══════════════════════════════════════════════════════════
//           if (
//             !isPurePhoneNumber &&
//             (emailCaptureMode ||
//               (salesStep === "email" &&
//                 (looksLikeEmail || looksLikeVoiceEmailSpelling(cleaned))))
//           ) {
//             if (!emailCaptureMode) {
//               startEmailCapture();
//             }
//             const consumed = handleEmailCaptureTranscript(cleaned);
//             if (consumed) {
//               socket.emit("user_transcript", cleaned);
//               TimerManager.clearSilence();
//               break;
//             }
//           }

//           console.log(`👤 User: "${cleaned}"`);
//           socket.emit("user_transcript", cleaned);

//           const mappedNetwork = mapOrdinalNetworkChoice(cleaned);
//           if (mappedNetwork && wasLastMessageNetworkQuestion()) {
//             const clarified = `I want ${mappedNetwork}`;
//             session.collected.networkPreference = mappedNetwork;
//             session.messages.push({ role: "user", content: clarified });
//             sessions.set(session.id, session);
//             if (openaiWs?.readyState === WebSocket.OPEN) {
//               openaiWs.send(
//                 JSON.stringify({
//                   type: "conversation.item.create",
//                   item: {
//                     type: "message",
//                     role: "user",
//                     content: [{ type: "input_text", text: clarified }],
//                   },
//                 }),
//               );
//               scheduleResponseCreate();
//             }
//             TimerManager.resetSilence();
//             break;
//           }

//           if (
//             session.collected._websiteCheckRequired &&
//             !session.collected._websiteCheckDone &&
//             detectWebsiteCheckAnswer(cleaned)
//           ) {
//             const lastAiMsg = [...(session.messages || [])]
//               .reverse()
//               .find((m) => m.role === "assistant");
//             if (
//               lastAiMsg &&
//               detectWebsiteCheckQuestion(lastAiMsg.content || "")
//             ) {
//               session.collected._websiteCheckDone = true;
//               sessions.set(session.id, session);
//               console.log(
//                 `[FLOW: sales][STEP: website_check][STATUS: answered][DATA: answer="${cleaned}" websiteCheckDone=true]`,
//               );
//               initSalesStepMachine();
//             }
//           }

//           detectSalesStepAnswer(cleaned);

//           session.messages.push({ role: "user", content: cleaned });
//           sessions.set(session.id, session);

//           // FIX (P5): Reset silence timer on user input
//           TimerManager.resetSilence();
//           break;
//         }

//         case "response.created":
//           isResponseActive = true;
//           currentResponseId = event.response?.id || null;
//           currentResponseHadOutput = false;
//           cancelPending = false;
//           elevenLabsStreaming = true;
//           openElevenLabsStream();
//           // Do NOT set assistantSpeaking=true if we're waiting for email confirmation YES/NO
//           // This prevents the user's "yes" from being dropped by the assistantSpeaking guard
//           if (!(emailCaptureMode && emailCaptureConfirmAsked)) {
//             assistantSpeaking = true;
//           }
//           transitionFSM(FSM_STATE.SPEAKING);
//           socket.emit("status", "speaking");
//           TimerManager.clearWatchdog();
//           console.log(`🔊 [FSM] speech_start`);
//           break;

//         case "response.text.delta":
//           if (event.delta) {
//             currentResponseHadOutput = true;
//             assistantTextBuffer += event.delta;
//             socket.emit("assistant_text_delta", event.delta);
//             if (elevenLabsReady) sendTextToElevenLabs(event.delta);
//             else textBuffer.push(event.delta);
//           }
//           break;

//         case "response.text.done":
//           if (event.text) {
//             currentResponseHadOutput = true;
//             const newTextNorm = event.text
//               .toLowerCase()
//               .replace(/[^a-z0-9\s]/g, "")
//               .trim();
//             const lastTextNorm = lastAssistantText
//               .toLowerCase()
//               .replace(/[^a-z0-9\s]/g, "")
//               .trim();
//             const isDuplicate =
//               newTextNorm.length > 20 &&
//               lastTextNorm.length > 20 &&
//               (newTextNorm === lastTextNorm ||
//                 newTextNorm.includes(lastTextNorm) ||
//                 lastTextNorm.includes(newTextNorm));

//             if (isDuplicate) {
//               console.log(`🔁 DUPLICATE response detected — skipping`);
//               assistantTextBuffer = "";
//               break;
//             }

//             lastAssistantText = event.text;
//             console.log(`🤖 AI: "${event.text.substring(0, 100)}..."`);
//             session.messages.push({ role: "assistant", content: event.text });
//             sessions.set(session.id, session);
//             socket.emit("assistant_text_done", event.text);

//             flushElevenLabsStream();

//             if (detectPlanPresentation(event.text)) {
//               lastResponseWasPackage = true;
//               transitionFSM(FSM_STATE.PACKAGE_PRESENTATION);
//               console.log(
//                 `[FLOW: sales][STEP: plan_presentation][STATUS: detected][DATA: isPackage=true timer=20s]`,
//               );
//             }

//             if (detectPhoneVerificationRequest(event.text)) {
//               awaitingPhoneVerification = true;
//               rawPhoneBuffer = null;
//             }

//             // FIX (Issue 2 / P2): Only activate email capture if:
//             // 1. AI asked for email spelling
//             // 2. salesStep is "email"
//             // 3. NOT already in capture mode
//             // 4. NOT already in confirmation phase
//             if (
//               detectEmailSpellingRequest(event.text) &&
//               salesStep === "email" &&
//               !emailCaptureMode &&
//               !emailCaptureConfirmPending &&
//               !emailCaptureConfirmAsked
//             ) {
//               console.log(
//                 `[FLOW: sales][STEP: email_capture][STATUS: activating][DATA: reason=ai_asked_for_email_spelling]`,
//               );
//               startEmailCapture();
//             }

//             // FIX (Issue 2): Track website check question asked
//             if (
//               session.collected.leadInterest &&
//               session.collected._websiteCheckRequired &&
//               !session.collected._websiteCheckAsked &&
//               detectWebsiteCheckQuestion(event.text)
//             ) {
//               session.collected._websiteCheckAsked = true;
//               sessions.set(session.id, session);
//               console.log(
//                 `[FLOW: sales][STEP: website_check][STATUS: asked][DATA: websiteCheckAsked=true]`,
//               );
//             }
//           }
//           break;

//         case "response.done": {
//           isResponseActive = false;
//           // Clear watchdog on response done
//           TimerManager.clearWatchdog();
//           console.log(`🔊 [FSM] speech_end`);
//           // FIX (Issue 3 — debugState): Now properly defined above
//           debugState();

//           const outputItems = event.response?.output || [];
//           const hasTextOutput =
//             outputItems.some(
//               (item) =>
//                 item.type === "message" &&
//                 item.content?.some((c) => c.type === "text" && c.text?.trim()),
//             ) || currentResponseHadOutput;
//           const hasFunctionCall = outputItems.some(
//             (item) => item.type === "function_call",
//           );

//           if (
//             !hasFunctionCall &&
//             !hasTextOutput &&
//             pendingFunctionCalls === 0 &&
//             !finalMessageLock
//           ) {
//             if (cancelPending) {
//               console.log(`✅ response.done (cancelled) — no retry`);
//               cancelPending = false;
//               transitionFSM(FSM_STATE.LISTENING);
//               socket.emit("status", "listening");
//               if (pendingPostDoneCreate) {
//                 pendingPostDoneCreate = false;
//                 const hint = pendingPostDoneHint;
//                 pendingPostDoneHint = null;
//                 setTimeout(() => scheduleResponseCreate(hint), 50);
//               }
//               break;
//             }

//             emptyResponseCount++;
//             console.warn(
//               `⚠️ EMPTY RESPONSE: attempt ${emptyResponseCount}/${MAX_EMPTY_RETRIES}`,
//             );
//             if (emptyResponseCount <= MAX_EMPTY_RETRIES) {
//               const retryDelay = 150 * Math.pow(2, emptyResponseCount - 1);
//               scheduleResponseCreate(null, retryDelay, true);
//             } else {
//               console.warn(
//                 `⚠️ Max retries (${MAX_EMPTY_RETRIES}) reached — stopping retry loop`,
//               );
//               emptyResponseCount = 0;
//               transitionFSM(FSM_STATE.LISTENING);
//               socket.emit("status", "listening");
//             }
//             break;
//           }

//           emptyResponseCount = 0;

//           // FIX (Issue 5 / P5): Debounce create_ticket — pendingPostDoneCreate
//           // must NEVER fire if createTicketBlockedForEmail=true
//           if (pendingPostDoneCreate && pendingFunctionCalls === 0) {
//             // Guard: if we have a pending post-done and email is still blocked,
//             // inject the email capture hint instead of firing immediately
//             if (createTicketBlockedForEmail) {
//               console.log(
//                 `[FLOW: sales][STEP: response_done][STATUS: post_done_blocked][DATA: reason=email_not_confirmed createTicketBlockedForEmail=true]`,
//               );
//               pendingPostDoneCreate = false;
//               const emailHint = buildSalesStepHint() || "";
//               pendingPostDoneHint = null;
//               setTimeout(() => scheduleResponseCreate(emailHint, 0, true), 50);
//               break;
//             }
//             pendingPostDoneCreate = false;
//             const hint = pendingPostDoneHint;
//             pendingPostDoneHint = null;
//             console.log(`📤 Firing queued post-done response.create`);
//             setTimeout(() => scheduleResponseCreate(hint, 0, true), 50);
//             break;
//           }

//           if (!pendingFunctionCalls) {
//             // FIX (P5): Do NOT call TimerManager.startSilence() here.
//             // Silence timer ONLY starts from audio_done event.
//             if (
//               fsmState !== FSM_STATE.EMAIL_CAPTURE &&
//               fsmState !== FSM_STATE.EMAIL_CONFIRMATION
//             ) {
//               transitionFSM(FSM_STATE.LISTENING);
//             }
//             socket.emit("status", "listening");
//           }
//           assistantTextBuffer = "";
//           currentResponseHadOutput = false;
//           break;
//         }

//         case "response.output_item.added":
//           if (event.item?.type === "function_call") {
//             const fnName = event.item.name || event.item.function_call?.name;
//             if (fnName === "create_ticket") {
//               // FIX (Issue 5 / P5): Only start final lock if email is NOT blocked
//               if (!createTicketBlockedForEmail) {
//                 TimerManager.startFinalLock(20000);
//               }
//               if (openaiWs?.readyState === WebSocket.OPEN) {
//                 openaiWs.send(
//                   JSON.stringify({ type: "input_audio_buffer.clear" }),
//                 );
//               }
//             }
//           }
//           break;

//         case "response.output_item.done":
//           if (event.item?.type === "function_call") {
//             pendingFunctionCalls++;
//             transitionFSM(FSM_STATE.TOOL_EXECUTING);
//             handleFunctionCall(event.item);
//           }
//           break;

//         case "error":
//           console.error("[WS-1] OpenAI error:", JSON.stringify(event.error));
//           socket.emit("error_msg", event.error?.message || "AI error");
//           if (isResponseActive) isResponseActive = false;
//           if (pendingFunctionCalls > 0) pendingFunctionCalls = 0;
//           emptyResponseCount = 0;
//           responseCreatePending = false;
//           pendingPostDoneCreate = false;
//           elevenLabsStreaming = false;
//           TimerManager.clearWatchdog();
//           transitionFSM(FSM_STATE.LISTENING);
//           socket.emit("status", "listening");
//           break;
//       }
//     }

//     // ═══════════════ Tool Execution ════════════════
//     async function handleFunctionCall(item) {
//       const { call_id, name: fn, arguments: argsStr } = item;
//       let args = safeParseJSON(argsStr) || {};

//       // Guard: verify_phone must NEVER run in sales flow
//       if (
//         fn === "verify_phone" &&
//         !session.collected._emailVerifiedCustomerId
//       ) {
//         console.log(
//           `[FLOW: sales][STEP: verify_phone][STATUS: blocked][DATA: reason=sales_flow_no_customer_id]`,
//         );
//         const phoneToSave = args.phone || rawPhoneBuffer;
//         rawPhoneBuffer = null;
//         awaitingPhoneVerification = false;
//         if (phoneToSave) {
//           session.collected.phone =
//             String(phoneToSave).replace(/\D/g, "") || phoneToSave;
//           sessions.set(session.id, session);
//           if (salesStep === "phone") advanceSalesStep("phone");
//           console.log(
//             `[FLOW: sales][STEP: phone][STATUS: saved][DATA: phone="${session.collected.phone}"]`,
//           );
//         }
//         const fakeResult = JSON.stringify({
//           success: true,
//           _redirected: true,
//           message: "Phone number saved.",
//         });
//         if (openaiWs?.readyState === WebSocket.OPEN) {
//           openaiWs.send(
//             JSON.stringify({
//               type: "conversation.item.create",
//               item: {
//                 type: "function_call_output",
//                 call_id,
//                 output: fakeResult,
//               },
//             }),
//           );
//         }
//         pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
//         if (
//           pendingFunctionCalls === 0 &&
//           openaiWs?.readyState === WebSocket.OPEN
//         ) {
//           const salesHint = buildSalesStepHint() || "";
//           const hint = `Phone number has been saved. ${salesHint}\n\nIMPORTANT: Respond immediately — proceed to the next step.`;
//           openaiWs.send(
//             JSON.stringify({
//               type: "conversation.item.create",
//               item: {
//                 type: "message",
//                 role: "user",
//                 content: [
//                   { type: "input_text", text: `[SYSTEM_CONTEXT]: ${hint}` },
//                 ],
//               },
//             }),
//           );
//           if (
//             fsmState !== FSM_STATE.EMAIL_CAPTURE &&
//             fsmState !== FSM_STATE.EMAIL_CONFIRMATION
//           ) {
//             transitionFSM(FSM_STATE.LISTENING);
//           }
//           scheduleResponseCreate();
//         }
//         return;
//       }

//       if (fn === "verify_phone" && rawPhoneBuffer) {
//         console.log(
//           `[FLOW: support][STEP: verify_phone][STATUS: override][DATA: llmPhone="${args.phone}" bufferPhone="${rawPhoneBuffer}"]`,
//         );
//         args = { ...args, phone: rawPhoneBuffer };
//         rawPhoneBuffer = null;
//         awaitingPhoneVerification = false;
//       }

//       console.log(`🔧 Tool: ${fn}`, JSON.stringify(args).substring(0, 200));

//       let result;
//       socket.emit("status", "processing");
//       TimerManager.clearSilence();
//       TimerManager.clearEmailConfirm();
//       TimerManager.clearWatchdog();

//       if (openaiWs?.readyState === WebSocket.OPEN) {
//         openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
//       }

//       const toolTimeout = setTimeout(() => {
//         console.warn(`⚠️ Tool ${fn} timed out after 30s`);
//         pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
//         if (pendingFunctionCalls === 0) {
//           transitionFSM(FSM_STATE.LISTENING);
//           socket.emit("status", "listening");
//         }
//       }, 30000);

//       try {
//         result = await execTool(fn, args);
//         console.log(
//           `🔧 [TOOL-END] ${fn} - result: ${result.substring(0, 200)}`,
//         );
//       } catch (err) {
//         console.error(`🔧 [TOOL-ERROR] ${fn}:`, err.message);
//         result = JSON.stringify({ success: false, error: err.message });
//       }

//       clearTimeout(toolTimeout);

//       // FIX (Issue 4 / P4): Build system hint with explicit email_state context in EVERY tool response
//       let systemHint = `[FLOW: ${session.collected?.intent || "unknown"}] Current collected fields: ${JSON.stringify(
//         Object.fromEntries(
//           Object.entries(session.collected || {}).filter(
//             ([k]) => k !== "_registeredPhone" && k !== "_rp",
//           ),
//         ),
//       )}. email_state: { value: "${email_state.value}", is_confirmed: ${email_state.is_confirmed} }. createTicketBlockedForEmail: ${createTicketBlockedForEmail}. emailCaptureMode: ${emailCaptureMode}.`;

//       if (fn === "check_address_availability") {
//         let parsedResult = null;
//         try {
//           parsedResult = JSON.parse(result);
//         } catch (_) {}
//         if (parsedResult) {
//           const networkLabel = parsedResult.network || "the available network";
//           const planCount = Array.isArray(parsedResult.availablePlans)
//             ? parsedResult.availablePlans.length
//             : 0;
//           const requiresFilter =
//             parsedResult.requiresResidentialFilter === true;
//           if (parsedResult.orderable === false) {
//             systemHint += `\nTOOL RESULT: Address not serviceable. Tell customer empathetically and offer to take their details.`;
//           } else if (planCount > 0 && requiresFilter) {
//             systemHint += `\nTOOL RESULT: ${planCount} plans found on "${networkLabel}". Ask: "Is this for your home or a business?" before showing plans.`;
//           } else if (planCount > 0 && !requiresFilter) {
//             systemHint += `\nTOOL RESULT: ${planCount} plans found on "${networkLabel}". Present ALL plans NOW. Speak slowly using voice_description fields. End with "Which of these catches your eye?" LOCKED to ${networkLabel}.`;
//           } else {
//             systemHint += `\nTOOL RESULT: No plans returned. Tell customer and offer alternative help.`;
//           }
//           if (session.networkShown) {
//             systemHint += `\nNETWORK LOCK: Only ${session.networkShown} — NEVER mention ${session.networkShown === "OptiComm" ? "NBN" : "OptiComm"} again.`;
//           }
//         }
//       }

//       if (fn === "customer_lookup") {
//         let parsedResult = null;
//         try {
//           parsedResult = JSON.parse(result);
//         } catch (_) {}

//         // FIX (Issue 3): If blocked (sales flow), instruct AI to treat as new customer
//         if (parsedResult?._blocked && parsedResult?.reason === "sales_flow") {
//           console.log(
//             `[FLOW: sales][STEP: customer_lookup][STATUS: blocked_hint][DATA: reason=sales_flow]`,
//           );
//           systemHint += `\nTOOL RESULT: customer_lookup blocked — this is a new sales lead. Do NOT retry customer_lookup. Treat as a new customer. Collect name, phone, email one at a time, then call create_ticket.`;
//         } else if (parsedResult?._invalidEmail) {
//           // FIX: Handle invalid email format (missing @) in support flow
//           console.log(
//             `[FLOW: support][STEP: customer_lookup][STATUS: invalid_email_hint][DATA: email_parse_failed=true]`,
//           );
//           systemHint += `\nTOOL RESULT: Email format invalid — missing '@' symbol. Ask customer to spell email again: 'Please spell your email letter by letter, saying 'at' for @ and 'dot' for dots.'`;
//         } else if (parsedResult?.success && parsedResult?.customer) {
//           systemHint += `\nTOOL RESULT: Email lookup succeeded. Say "Perfect, I can see that account." Then ask for their phone number. When they give it, call verify_phone.`;
//           awaitingPhoneVerification = true;
//           rawPhoneBuffer = null;
//         } else {
//           systemHint += `\nTOOL RESULT: Customer not found. Ask customer to double-check their email address.`;
//         }
//       }

//       if (fn === "verify_phone") {
//         let parsedResult = null;
//         try {
//           parsedResult = JSON.parse(result);
//         } catch (_) {}
//         if (parsedResult?.verificationFailed) {
//           awaitingPhoneVerification = true;
//           rawPhoneBuffer = null;
//           systemHint += `\nTOOL RESULT: Phone verification FAILED. Tell customer: "That phone number doesn't match what we have on file. Could you double-check?" Do NOT proceed.`;
//         } else if (parsedResult?.success && parsedResult?.verified) {
//           awaitingPhoneVerification = false;
//           rawPhoneBuffer = null;
//           systemHint += `\nTOOL RESULT: Phone verification PASSED. Say "Perfect, thanks for confirming — your account's all verified now." then ask what they need help with.`;
//         } else {
//           systemHint += `\nTOOL RESULT: Verification error — ${parsedResult?.message || "unknown"}. Tell customer to email support@infinetbroadband.com.au.`;
//         }
//       }

//       if (fn === "create_ticket") {
//         let parsedResult = null;
//         try {
//           parsedResult = JSON.parse(result);
//         } catch (_) {}

//         if (
//           parsedResult?._blocked &&
//           parsedResult?.reason === "email_missing"
//         ) {
//           // FIX (Issue 1+4 / P4): Ticket blocked — force salesStep=email BEFORE scheduling
//           // response so AI doesn't try create_ticket again immediately
//           TimerManager.releaseFinalLock();
//           salesStep = "email";
//           createTicketBlockedForEmail = true;
//           if (!emailCaptureMode && !emailCaptureConfirmAsked) {
//             startEmailCapture();
//           } else if (emailCaptureMode) {
//             console.log(
//               `[FLOW: sales][STEP: create_ticket][STATUS: handle_fn_capture_already_active][DATA: confirmAsked=${emailCaptureConfirmAsked}]`,
//             );
//           }
//           console.log(
//             `[FLOW: sales][STEP: create_ticket][STATUS: blocked][DATA: reason=email_not_confirmed salesStep_forced_to=email captureStarted=true]`,
//           );
//           systemHint += `\nTOOL RESULT: create_ticket BLOCKED — email not confirmed. salesStep is now "email". Ask for email NOW: "Could I grab your email address? Please spell it letter by letter — for @ say 'at', for dots say 'dot'. Example: j-o-h-n dot d-o-e at g-m-a-i-l dot c-o-m." Do NOT call create_ticket again until email_state.is_confirmed=true.`;
//         } else if (parsedResult?.success) {
//           salesStep = "done";
//           createTicketBlockedForEmail = false;
//           TimerManager.releaseFinalLock();
//           const ticketId = parsedResult.ticket_id;
//           const isSales = parsedResult._isSalesTicket === true || !ticketId;
//           console.log(
//             `[FLOW: sales][STEP: create_ticket][STATUS: success][DATA: isSales=${isSales} ticketId=${ticketId}]`,
//           );
//           if (isSales) {
//             systemHint += `\nTOOL RESULT: Sales enquiry submitted. Say: "Awesome, you're all set! I've submitted your enquiry and our sales team will be in touch via email shortly. Is there anything else you'd like to know?"`;
//           } else {
//             systemHint += `\nTOOL RESULT: Support ticket #${ticketId} created. Say: "Brilliant, all done! I've raised support ticket number ${ticketId} — you'll get details via email shortly. Is there anything else I can help with?"`;
//           }
//           transitionFSM(FSM_STATE.FINAL);
//         } else {
//           TimerManager.releaseFinalLock();
//           console.log(
//             `[FLOW: sales][STEP: create_ticket][STATUS: failed][DATA: error="${parsedResult?.error}"]`,
//           );
//           systemHint += `\nTOOL RESULT: Ticket FAILED — ${parsedResult?.error || "unknown error"}. Apologise and suggest calling 1300 101 414 or emailing support@infinetbroadband.com.au.`;
//         }
//       }

//       if (fn === "send_portal_login_email") {
//         systemHint += `\nTOOL RESULT: Portal login email sent. Tell customer the request was sent and team will be in touch.`;
//       }

//       if (fn === "extract_call_fields") {
//         const c = session.collected || {};
//         // FIX (Issue 2): Website check gate in extract_call_fields hint too
//         const shouldGate =
//           c.leadInterest &&
//           c._websiteCheckRequired &&
//           !c._websiteCheckAsked &&
//           !c._websiteCheckDone;
//         if (shouldGate) {
//           console.log(
//             `[FLOW: sales][STEP: website_check][STATUS: gating][DATA: leadInterest="${c.leadInterest}" websiteCheckDone=false]`,
//           );
//           systemHint += `\nCRITICAL GATE: You MUST ask: "Just out of curiosity — have you had a chance to check out our website and seen the plans or pricing?" WAIT for their answer before collecting name/phone/email.`;
//         }
//         if (
//           c.leadInterest &&
//           c._websiteCheckRequired &&
//           (c._websiteCheckAsked || c._websiteCheckDone)
//         ) {
//           systemHint += `\nWEBSITE CHECK DONE: Do NOT ask again. Proceed with order collection.`;
//         }
//         if (createTicketBlockedForEmail) {
//           systemHint += `\nEMAIL CAPTURE IN PROGRESS: email_state.is_confirmed=${email_state.is_confirmed}. Do NOT call create_ticket. Wait for email confirmation.`;
//         }
//         const stepHint = buildSalesStepHint();
//         if (stepHint) systemHint += `\n\n${stepHint}`;
//       }

//       if (openaiWs?.readyState === WebSocket.OPEN) {
//         await Promise.resolve();
//         openaiWs.send(
//           JSON.stringify({
//             type: "conversation.item.create",
//             item: { type: "function_call_output", call_id, output: result },
//           }),
//         );
//       }

//       pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);

//       if (
//         pendingFunctionCalls === 0 &&
//         openaiWs?.readyState === WebSocket.OPEN
//       ) {
//         openaiWs.send(
//           JSON.stringify({
//             type: "conversation.item.create",
//             item: {
//               type: "message",
//               role: "user",
//               content: [
//                 {
//                   type: "input_text",
//                   text: `[SYSTEM_CONTEXT]: ${systemHint}\n\nIMPORTANT: Respond immediately based on the tool result above.`,
//                 },
//               ],
//             },
//           }),
//         );

//         if (
//           fsmState === FSM_STATE.TOOL_EXECUTING &&
//           fsmState !== FSM_STATE.EMAIL_CAPTURE &&
//           fsmState !== FSM_STATE.EMAIL_CONFIRMATION &&
//           fsmState !== FSM_STATE.FINAL
//         ) {
//           transitionFSM(FSM_STATE.LISTENING);
//         }

//         console.log(`📤 Tool complete (${fn}) — triggering response.create`);
//         scheduleResponseCreate();
//       }
//     }

//     async function execTool(fn, args) {
//       if (fn === "extract_call_fields") {
//         // FIX: Parse/normalize email in ALL flows using parseVoiceEmail
//         if (args.email && typeof args.email === "string") {
//           const parsed = parseVoiceEmail(args.email);
//           if (parsed) {
//             console.log(
//               `[FLOW: ${session.collected?.intent || "unknown"}][STEP: email_parse][STATUS: normalized][DATA: raw="${args.email}" parsed="${parsed}"]`,
//             );
//             args.email = parsed;
//           } else {
//             console.log(
//               `[FLOW: ${session.collected?.intent || "unknown"}][STEP: email_parse][STATUS: failed][DATA: raw="${args.email}"]`,
//             );
//           }
//         }
//         applyExtractionToSession(session, args);
//         const c = session.collected || {};
//         if (salesStep === "firstName" && (args.preferredName || args.name)) {
//           const firstName = (args.preferredName || args.name || "").split(
//             " ",
//           )[0];
//           if (firstName) {
//             session.collected._firstName = firstName;
//             sessions.set(session.id, session);
//             advanceSalesStep("firstName");
//           }
//         }
//         if (salesStep === "lastName" && args.name && args.name.includes(" ")) {
//           const parts = args.name.split(" ");
//           session.collected._lastName = parts[parts.length - 1];
//           sessions.set(session.id, session);
//           advanceSalesStep("lastName");
//         }
//         if (salesStep === "phone" && args.phone) advanceSalesStep("phone");

//         // If LLM extracts email via extract_call_fields, use setEmailValue (hard overwrite)
//         if (args.email) {
//           setEmailValue(args.email);
//           session.collected.email = args.email;
//           sessions.set(session.id, session);
//           console.log(
//             `[FLOW: sales][STEP: email_capture][STATUS: extracted_by_llm][DATA: email="${args.email}"]`,
//           );
//           if (salesStep === "email") advanceSalesStep("email");
//         }

//         return JSON.stringify({ success: true });
//       }

//       if (fn === "customer_lookup") {
//         // ─────────────────────────────────────────────────────────
//         // FIX (Issue 3): Block customer_lookup in sales flow.
//         // Sales = has leadInterest but no _emailVerifiedCustomerId
//         // (i.e. not a returning existing customer doing support).
//         // ─────────────────────────────────────────────────────────
//         const isSalesFlow =
//           !!session.collected?.leadInterest &&
//           !session.collected?._emailVerifiedCustomerId;
//         if (isSalesFlow) {
//           console.log(
//             `[FLOW: sales][STEP: customer_lookup][STATUS: blocked][DATA: reason=sales_flow_new_lead leadInterest="${session.collected.leadInterest}"]`,
//           );
//           return JSON.stringify({
//             success: false,
//             _blocked: true,
//             reason: "sales_flow",
//             message:
//               "New sales lead — customer lookup not performed. Treat as new customer. Collect name, phone, email, then call create_ticket.",
//           });
//         }

//         const lookupArgs = { ...(args || {}) };
//         delete lookupArgs.phone;
//         if (!lookupArgs.email && !lookupArgs.name) {
//           return JSON.stringify({
//             success: false,
//             message: "Email is required for customer lookup",
//           });
//         }

//         // FIX: Parse/normalize email before lookup using parseVoiceEmail
//         if (lookupArgs.email && typeof lookupArgs.email === "string") {
//           const parsed = parseVoiceEmail(lookupArgs.email);
//           if (parsed) {
//             console.log(
//               `[FLOW: support][STEP: customer_lookup][STATUS: email_normalized][DATA: raw="${lookupArgs.email}" parsed="${parsed}"]`,
//             );
//             lookupArgs.email = parsed;
//           } else {
//             console.log(
//               `[FLOW: support][STEP: customer_lookup][STATUS: parse_failed][DATA: email="${lookupArgs.email}"]`,
//             );
//             // Return invalid email error if parse fails
//             return JSON.stringify({
//               success: false,
//               _invalidEmail: true,
//               message:
//                 "Invalid email format — could not parse. Ask customer to spell email letter by letter, saying 'at' for @ and 'dot' for dots.",
//             });
//           }
//         }

//         console.log(
//           `[FLOW: support][STEP: customer_lookup][STATUS: executing][DATA: email="${lookupArgs.email}"]`,
//         );
//         try {
//           const result = await customerLookup(lookupArgs);
//           if (result.success && result.customer) {
//             session.collected._emailVerifiedCustomerId = result.customer.id;
//             session.collected._registeredPhone =
//               result.customer.phone || result.customer.phone_mobile || null;
//             session.collected._rp = session.collected._registeredPhone;
//             session.collected._phoneVerified = false;
//             session.collected.customer_id = result.customer.id;
//             sessions.set(session.id, session);
//             console.log(
//               `[FLOW: support][STEP: customer_lookup][STATUS: found][DATA: customerId="${result.customer.id}"]`,
//             );
//             const safeResult = { ...result };
//             if (safeResult.customer) {
//               safeResult.customer = { ...safeResult.customer };
//               delete safeResult.customer.phone;
//               delete safeResult.customer.phone_mobile;
//               delete safeResult.customer.mobile;
//               delete safeResult.customer.phone2;
//             }
//             return JSON.stringify(safeResult);
//           }
//           // Clear email state on lookup failure so re-capture starts fresh
//           delete session.collected.email;
//           delete session.collected._emailVerifiedCustomerId;
//           email_state.value = "";
//           email_state.is_confirmed = false;
//           sessions.set(session.id, session);
//           console.log(
//             `[FLOW: support][STEP: customer_lookup][STATUS: not_found][DATA: email="${lookupArgs.email}"]`,
//           );
//           return JSON.stringify({
//             ...result,
//             _emailCleared: true,
//             message:
//               "No account found with that email. Please check and try again.",
//           });
//         } catch (e) {
//           return JSON.stringify({ success: false, error: e.message });
//         }
//       }

//       if (fn === "verify_phone") {
//         const { phone } = args || {};
//         if (!phone)
//           return JSON.stringify({
//             success: false,
//             verificationFailed: true,
//             message: "No phone number provided.",
//           });
//         const emailCustomerId = session.collected._emailVerifiedCustomerId;
//         if (!emailCustomerId)
//           return JSON.stringify({
//             success: false,
//             verificationFailed: true,
//             message: "Email verification must be completed first.",
//           });
//         const registeredPhone =
//           session.collected._registeredPhone || session.collected._rp;
//         if (!registeredPhone) {
//           return JSON.stringify({
//             success: false,
//             verificationFailed: true,
//             message: "No phone number registered on this account.",
//           });
//         }
//         const normalize =
//           normalizePhone && typeof normalizePhone === "function"
//             ? normalizePhone
//             : (p) =>
//                 String(p || "")
//                   .replace(/\D/g, "")
//                   .replace(/^61(\d{9})$/, "0$1");
//         const normalizedInput = normalize(phone);
//         const normalizedRegistered = normalize(registeredPhone);
//         if (normalizedInput !== normalizedRegistered) {
//           console.log(
//             `[FLOW: support][STEP: verify_phone][STATUS: failed][DATA: mismatch=true]`,
//           );
//           return JSON.stringify({
//             success: false,
//             verificationFailed: true,
//             message: "Phone number does not match the registered number.",
//           });
//         }
//         session.collected._phoneVerified = true;
//         sessions.set(session.id, session);
//         console.log(
//           `[FLOW: support][STEP: verify_phone][STATUS: passed][DATA: customerId="${emailCustomerId}"]`,
//         );
//         return JSON.stringify({
//           success: true,
//           verified: true,
//           customer_id: emailCustomerId,
//         });
//       }

//       if (fn === "check_address_availability") {
//         try {
//           if (args.address) session.collected.address = args.address;
//           return await checkAddressAvailability(args, session);
//         } catch (err) {
//           return JSON.stringify({
//             success: false,
//             error: err.message,
//             address: args.address,
//           });
//         }
//       }

//       if (fn === "create_ticket") {
//         let fa = { ...args };
//         if (typeof fa.message === "string")
//           fa.message = { message: fa.message };
//         const collected = session.collected || {};
//         const hasCustomerId = !!(fa.customer_id || collected.customer_id);
//         const hasLeadInterest = !!(collected.leadInterest || fa.leadInterest);
//         const isSupportTicket = hasCustomerId && !hasLeadInterest;

//         // FIX (Issue 1+4 / P4): Block create_ticket if email not confirmed in sales flow
//         // Check BOTH session.collected.email AND email_state.is_confirmed
//         if (
//           !isSupportTicket &&
//           (!collected.email || !email_state.is_confirmed)
//         ) {
//           console.warn(
//             `[FLOW: sales][STEP: create_ticket][STATUS: blocked][DATA: email="${collected.email}" is_confirmed=${email_state.is_confirmed} reason=email_not_confirmed]`,
//           );
//           // Force salesStep back to email immediately so next response re-asks
//           salesStep = "email";
//           createTicketBlockedForEmail = true;
//           TimerManager.releaseFinalLock();
//           finalMessageLock = false;
//           session.finalLock = false;
//           // Only start capture if not already in confirmation phase
//           // (re-starting resets emailCaptureConfirmAsked which kills in-flight confirmations)
//           if (!emailCaptureMode && !emailCaptureConfirmAsked) {
//             startEmailCapture();
//           } else if (emailCaptureMode) {
//             console.log(
//               `[FLOW: sales][STEP: create_ticket][STATUS: capture_already_active][DATA: confirmAsked=${emailCaptureConfirmAsked}]`,
//             );
//           }
//           return JSON.stringify({
//             success: false,
//             _blocked: true,
//             reason: "email_missing",
//             message:
//               "SALES STEP [email]: Ask for email by voice spelling mode. Do NOT retry create_ticket until email_state.is_confirmed=true.",
//           });
//         }

//         const detailLines = [];
//         const fullName =
//           [collected._firstName, collected._lastName]
//             .filter(Boolean)
//             .join(" ") ||
//           collected.name ||
//           collected.preferredName;
//         if (fullName) detailLines.push(`Name: ${fullName}`);
//         if (collected.email) detailLines.push(`Email: ${collected.email}`);
//         if (collected.phone) detailLines.push(`Phone: ${collected.phone}`);
//         if (collected.address)
//           detailLines.push(`Address: ${collected.address}`);
//         if (collected.networkPreference)
//           detailLines.push(`Network: ${collected.networkPreference}`);
//         if (collected.residentialPreference)
//           detailLines.push(`Type: ${collected.residentialPreference}`);
//         if (collected.leadInterest || fa.leadInterest)
//           detailLines.push(
//             `Selected Plan: ${collected.leadInterest || fa.leadInterest}`,
//           );

//         const detailsBlock =
//           detailLines.length > 0
//             ? `\n\n--- Customer Details ---\n${detailLines.join("\n")}`
//             : "";
//         if (fa.message?.message) fa.message.message += detailsBlock;
//         else if (detailsBlock) fa.message = { message: detailsBlock.trim() };

//         let ticketResult;
//         try {
//           if (isSupportTicket) {
//             console.log(
//               `[FLOW: support][STEP: create_ticket][STATUS: creating][DATA: subject="${fa.subject}" customerId="${fa.customer_id}"]`,
//             );
//             const r = await splynx.request(
//               "POST",
//               "admin/support/tickets",
//               objectToUrlEncoded(fa),
//             );
//             console.log(
//               `[FLOW: support][STEP: create_ticket][STATUS: success][DATA: ticketId="${r.id}"]`,
//             );
//             const emailResult = await sendTicketEmail(
//               r.id,
//               fa,
//               collected,
//               true,
//             );
//             ticketResult = {
//               success: true,
//               ticket_id: r.id,
//               email_sent: emailResult.sent,
//               email_error: emailResult.reason || null,
//               _isSalesTicket: false,
//               _ticketCompleted: true,
//             };
//           } else {
//             console.log(
//               `[FLOW: sales][STEP: create_ticket][STATUS: sending_email][DATA: subject="${fa.subject}"]`,
//             );
//             const emailResult = await sendTicketEmail(
//               null,
//               fa,
//               collected,
//               false,
//             );
//             ticketResult = {
//               success: true,
//               message: "Sales inquiry submitted successfully",
//               email_sent: emailResult.sent,
//               email_error: emailResult.reason || null,
//               _isSalesTicket: true,
//               _ticketCompleted: true,
//             };
//           }
//         } catch (err) {
//           console.error(
//             `[FLOW: unknown][STEP: create_ticket][STATUS: error][DATA: error="${err.message}"]`,
//           );
//           ticketResult = {
//             success: false,
//             error: err.message || "Failed to process request",
//             _ticketCompleted: true,
//           };
//         }

//         return JSON.stringify(ticketResult);
//       }

//       if (fn === "get_ticket_types")
//         return JSON.stringify({
//           success: true,
//           types: await splynx.request("GET", "admin/support/tickets-types"),
//         });
//       if (fn === "get_ticket_groups")
//         return JSON.stringify({
//           success: true,
//           groups: await splynx.request("GET", "admin/support/tickets-groups"),
//         });
//       if (fn === "get_ticket_statuses")
//         return JSON.stringify({
//           success: true,
//           statuses: await splynx.request(
//             "GET",
//             "admin/support/tickets-statuses",
//           ),
//         });

//       return JSON.stringify({ error: `Unknown tool: ${fn}` });
//     }

//     // ═══════════════ Client Audio → OpenAI ════════════════
//     let lastAudioLog = 0;
//     socket.on("audio_chunk", (b64) => {
//       const shouldSuppress =
//         awaitingStructuredInput ||
//         pendingFunctionCalls > 0 ||
//         session.finalLock ||
//         finalMessageLock;
//       if (shouldSuppress) return;
//       const now = Date.now();
//       if (now - lastAudioLog > 2000) {
//         const state =
//           ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][openaiWs?.readyState] ||
//           "UNKNOWN";
//         console.log(`🎤 [${socket.id}] [OpenAI: ${state}]`);
//         lastAudioLog = now;
//       }
//       if (openaiWs?.readyState === WebSocket.OPEN) {
//         openaiWs.send(
//           JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }),
//         );
//       }
//     });

//     // ═══════════════════════════════════════════════════════════════
//     //  FIX (P5): audio_done — THE ONLY PLACE silence timer starts.
//     //
//     //  Frontend emits this after browser has finished playing ALL
//     //  PCM audio chunks (TTS playback complete). Timer starts here,
//     //  AFTER the user has fully heard the AI response.
//     //
//     //  Duration: 15s normal, 20s after package presentation.
//     //  This is the ONLY call to TimerManager.startSilence() in the
//     //  entire codebase. There is no call in response.done or isFinal.
//     // ═══════════════════════════════════════════════════════════════
//     socket.on("audio_done", () => {
//       console.log(`🔊 [FSM] Client audio_done — browser playback complete`);
//       assistantSpeaking = false;

//       if (
//         fsmState !== FSM_STATE.EMAIL_CAPTURE &&
//         fsmState !== FSM_STATE.EMAIL_CONFIRMATION &&
//         fsmState !== FSM_STATE.FINAL
//       ) {
//         transitionFSM(FSM_STATE.LISTENING);
//       }

//       // Read isPackage flag at playback-complete time, then reset it
//       const isPackage = lastResponseWasPackage;
//       lastResponseWasPackage = false;
//       console.log(
//         `⏱️  [TMgr] TTS finished → silence timer starting (${isPackage ? "20s package" : "15s normal"})`,
//       );
//       TimerManager.startSilence(isPackage);
//     });

//     // ═══════════════ Structured Input (email/phone typed by user) ══
//     socket.on("structured_input", (payload) => {
//       if (!payload || !payload.field || !payload.value) return;
//       const { field, value } = payload;

//       if (field === "email") {
//         console.log(
//           `[FLOW: sales][STEP: email_capture][STATUS: structured_input][DATA: email="${value}"]`,
//         );
//         // Hard overwrite then confirm
//         setEmailValue(value);
//         confirmEmail(); // sets is_confirmed=true AND syncs to session.collected.email
//         if (salesStep === "email") advanceSalesStep("email");
//         // FIX (Issue 4 / P4): Unblock ONLY after confirmEmail() (is_confirmed=true)
//         createTicketBlockedForEmail = false;
//         resetEmailCapture();
//         awaitingStructuredInput = false;
//         structuredInputField = null;

//         const userMessage = `My email is ${value}`;
//         session.messages.push({ role: "user", content: userMessage });
//         sessions.set(session.id, session);
//         socket.emit("user_transcript", userMessage);

//         if (openaiWs?.readyState === WebSocket.OPEN) {
//           openaiWs.send(
//             JSON.stringify({
//               type: "conversation.item.create",
//               item: {
//                 type: "message",
//                 role: "user",
//                 content: [{ type: "input_text", text: userMessage }],
//               },
//             }),
//           );
//           const salesHint = buildSalesStepHint() || "";
//           const hint = `Customer email confirmed via typed input: ${value}. email_state.is_confirmed=true. createTicketBlockedForEmail=false. ${salesHint} Proceed immediately.`;
//           openaiWs.send(
//             JSON.stringify({
//               type: "conversation.item.create",
//               item: {
//                 type: "message",
//                 role: "user",
//                 content: [
//                   { type: "input_text", text: `[SYSTEM_CONTEXT]: ${hint}` },
//                 ],
//               },
//             }),
//           );
//           scheduleResponseCreate();
//         }

//         socket.emit("structured_input_accepted", { field, value });
//         socket.emit("status", "listening");
//         return;
//       }

//       console.log(
//         `[FLOW: unknown][STEP: structured_input][STATUS: ok][DATA: field="${field}" value="${value}"]`,
//       );
//       TimerManager.clearSilence();
//       awaitingStructuredInput = false;
//       structuredInputField = null;

//       const userMessage = `My ${field} is ${value}`;
//       session.messages.push({ role: "user", content: userMessage });
//       sessions.set(session.id, session);
//       socket.emit("user_transcript", userMessage);

//       if (openaiWs?.readyState === WebSocket.OPEN) {
//         openaiWs.send(
//           JSON.stringify({
//             type: "conversation.item.create",
//             item: {
//               type: "message",
//               role: "user",
//               content: [{ type: "input_text", text: userMessage }],
//             },
//           }),
//         );
//         scheduleResponseCreate();
//       }

//       socket.emit("structured_input_accepted", { field, value });
//       socket.emit("status", "listening");
//     });

//     // ═══════════════ Cleanup ════════════════
//     socket.on("disconnect", () => {
//       console.log(`🔌 Disconnected: ${socket.id}`);
//       console.log(
//         `[FLOW: ${session?.collected?.intent || "unknown"}][STEP: disconnect][STATUS: cleanup][DATA: email="${email_state.value}" confirmed=${email_state.is_confirmed} collected=${JSON.stringify(session?.collected || {})}]`,
//       );
//       TimerManager.clearAll();
//       closeElevenLabsWs();
//       if (openaiWs)
//         try {
//           openaiWs.close();
//         } catch (_) {}
//       sessions.delete(session.id);
//     });

//     // ═══════════════ Boot ════════════════
//     // NOTE: Session is already created at the TOP of this connection handler.
//     // This is intentional — see "FIX (Issue 4 — Session Hoisting)" comment above.

//     (async () => {
//       try {
//         console.log("⏳ Connecting OpenAI Realtime...");
//         console.log(
//           `[FLOW: init][STEP: connect][STATUS: pending][DATA: sessionId="${session.id}"]`,
//         );
//         await connectOpenAI();
//         console.log(
//           "✅ OpenAI connected! ElevenLabs pre-warmed. Waiting 200ms...",
//         );
//         socket.emit("connections_ready");
//         await new Promise((r) => setTimeout(r, 200));

//         if (!session.hasGreeted) {
//           session.hasGreeted = true;
//           console.log(
//             `[FLOW: init][STEP: greeting][STATUS: sending][DATA: sessionId="${session.id}"]`,
//           );
//           if (openaiWs?.readyState === WebSocket.OPEN) {
//             openaiWs.send(JSON.stringify({ type: "response.create" }));
//           } else {
//             console.warn(
//               `⚠️ OpenAI WS not open for greeting (state: ${openaiWs?.readyState})`,
//             );
//           }
//           sessions.set(session.id, session);
//         } else {
//           transitionFSM(FSM_STATE.LISTENING);
//           socket.emit("status", "listening");
//         }
//       } catch (err) {
//         console.error("❌ Connection failed:", err.message);
//         socket.emit("error_msg", "Failed to connect to AI services");
//       }
//     })();
//   });
// }
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import OpenAI from "openai";
import axios from "axios";
import crypto from "crypto";
import nodemailer from "nodemailer";
import http from "http";
import dns from "dns";
import { Server as SocketIOServer } from "socket.io";
import WebSocket from "ws";
import { setupRealtimeVoice } from "./realtime-handler.js";

dotenv.config();
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

const PORT = process.env.PORT || 3004;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

// ==================== MARS API CONFIG ====================
const MARS_BASE_URL = "https://mars.as24516.net/api/v1";
const MARS_CLIENT_ID = process.env.MARS_CLIENT_ID;
const MARS_CLIENT_SECRET = process.env.MARS_CLIENT_SECRET;

if (!OPENAI_API_KEY) {
  console.error("❌ Please set OPENAI_API_KEY in your .env file");
  process.exit(1);
}
if (!ELEVENLABS_API_KEY) {
  console.error("❌ Please set ELEVENLABS_API_KEY in your .env file");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.sparkpostmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "SMTP_Injection",
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});
if (!process.env.SMTP_PASS)
  console.warn("⚠️ SMTP_PASS not set - email notifications DISABLED");

async function sendTicketEmail(
  ticketId,
  ticketArgs,
  collectedFields,
  isSupportTicket = false,
) {
  console.log(
    `📧 [sendTicketEmail] Starting email send - ticketId=${ticketId}, type=${isSupportTicket ? "Support" : "Sales"}`,
  );
  console.log(
    `📧 [DEBUG] collectedFields:`,
    JSON.stringify(collectedFields).substring(0, 200),
  );
  console.log(
    `📧 [DEBUG] ticketArgs:`,
    JSON.stringify(ticketArgs).substring(0, 200),
  );

  if (!process.env.SMTP_PASS) {
    console.warn("⚠️ SMTP_PASS not set - skipping email");
    console.log(`📧 [DEBUG] SMTP_PASS is empty/undefined`);
    return { sent: false, reason: "SMTP not configured" };
  }
  const recipient = isSupportTicket
    ? "support@infinetbroadband.com.au"
    : "sales@infinetbroadband.com.au";
  console.log(`📧 [DEBUG] SMTP configured, recipient=${recipient}`);
  const type = isSupportTicket ? "Support" : "Sales";
  const referenceLine = ticketId
    ? `<p><strong>Ticket:</strong> ${ticketId}</p>`
    : `<p><strong>Reference:</strong> New ${type.toLowerCase()} enquiry</p>`;
  const subject = `New ${type} Enquiry ${ticketId ? `- Ticket #${ticketId}` : ""} - ${ticketArgs.subject || "Inquiry"}`;

  const selectedPlan =
    collectedFields?.leadInterest || ticketArgs.leadInterest || null;
  const selectedPlanHtml = selectedPlan
    ? `<p><strong>Selected Plan:</strong> ${selectedPlan}</p>`
    : "";

  const userEmail = collectedFields?.email || null;
  const address = collectedFields?.address || ticketArgs.address || null;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;line-height:1.6;">
    <h2>New ${type} Enquiry Received</h2>
    ${referenceLine}
    <p><strong>Subject:</strong> ${ticketArgs.subject || "N/A"}</p>
    <p><strong>Priority:</strong> ${ticketArgs.priority || "medium"}</p>
    ${ticketArgs.customer_id ? `<p><strong>Customer ID:</strong> ${ticketArgs.customer_id}</p>` : `<p><strong>New Lead (no customer ID)</strong></p>`}
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 16px;margin:12px 0;">
      <h3 style="margin:0 0 8px 0;color:#0369a1;">Customer Contact Details</h3>
      ${collectedFields?.preferredName || collectedFields?.name ? `<p style="margin:4px 0;"><strong>Name:</strong> ${collectedFields.preferredName || collectedFields.name}</p>` : ""}
      ${userEmail ? `<p style="margin:4px 0;"><strong>Email:</strong> <a href="mailto:${userEmail}">${userEmail}</a></p>` : '<p style="margin:4px 0;color:#dc2626;"><strong>Email:</strong> Not provided</p>'}
      ${collectedFields?.phone ? `<p style="margin:4px 0;"><strong>Phone:</strong> ${collectedFields.phone}</p>` : ""}
      ${address ? `<p style="margin:4px 0;"><strong>Address:</strong> ${address}</p>` : ""}
    </div>
    ${selectedPlanHtml}
    ${collectedFields?.networkPreference ? `<p><strong>Network:</strong> ${collectedFields.networkPreference}</p>` : ""}
    ${collectedFields?.residentialPreference ? `<p><strong>Type:</strong> ${collectedFields.residentialPreference}</p>` : ""}
    <h3>Message Body</h3>
    <p>${(ticketArgs.message && (ticketArgs.message.message || ticketArgs.message)) || "No additional message"}</p>
    <hr>
    <p><small>Automated email from InfiNET Broadband AI Assistant.<br>
    ${isSupportTicket && ticketId ? `View ticket: https://infinetbroadband-portal.com.au/admin/support/tickets/${ticketId}` : `This is a ${type.toLowerCase()} enquiry - to be followed up manually.`}
    </small></p>
  </body></html>`;
  try {
    const recipients = ["karimjawwad09@gmail.com", recipient];
    console.log(
      `📧 [sendTicketEmail] Attempting to send ${type} email to: ${recipients.join(", ")}${userEmail ? ` (Reply-To: ${userEmail})` : ""}`,
    );
    console.log(`📧 [DEBUG] Email subject: "${subject}"`);
    console.log(`📧 [DEBUG] Recipients: ${recipients.length} addresses`);
    console.log(`📧 [DEBUG] Reply-To: ${userEmail || "NONE"}`);
    await transporter.sendMail({
      from: '"InfiNET AI Assistant" <noreply@infinetbroadband.com.au>',
      to: recipients,
      ...(userEmail ? { replyTo: userEmail } : {}),
      subject,
      html,
    });
    console.log(
      `📧 Email SENT for ${type.toLowerCase()} enquiry${ticketId ? ` #${ticketId}` : ""}`,
    );
    console.log(`📧 [DEBUG] Email send success`);
    return { sent: true };
  } catch (err) {
    console.error(
      `📧 Email FAILED for ${type.toLowerCase()} enquiry:`,
      err.message,
      err.code || "",
      err.response || "",
    );
    console.error(
      `📧 [DEBUG] Email error details - code: ${err.code}, response: ${JSON.stringify(err.response).substring(0, 100)}`,
    );
    return { sent: false, reason: err.message };
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const upload = multer({ dest: "uploads/" });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const sessions = new Map();
const BRAND = "InfiNET Broadband";

const CONFIG = {
  SPLYNX_BASE_URL: "https://infinetbroadband-portal.com.au/api/2.0/",
  API_KEY: "107c483d15e930b41b8d70affdd08632",
  API_SECRET: "9b8b46ce928bea980a8d092a288372e0",
  USE_ACCESS_TOKEN: true,
};

try {
  dns.setDefaultResultOrder("ipv4first");
} catch (_) {}

// ==================== HARDCODED OPTICOMM PLANS ====================
const OPTICOMM_RESIDENTIAL_PLANS = [
  {
    title: "OptiComm twenty-five by ten Megabits per second Residential",
    price: 64,
    download: "25 Megabits per second",
    upload: "10 Megabits per second",
    intro_price: 64,
    ongoing_price: 69,
    discount: "$5 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Reliable Fast Fibre",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Web browsing & Social Media",
    ],
    voice_description:
      "Our entry-level OptiComm plan gives you 25 megabits down and 10 up - perfect for everyday browsing, HD streaming, and video calls. It's just 64 dollars a month for the first three months, then 69 dollars ongoing. No contracts, unlimited data, and you can cancel anytime.",
  },
  {
    title: "OptiComm fifty by twenty Megabits per second Residential",
    price: 74,
    download: "50 Megabits per second",
    upload: "20 Megabits per second",
    intro_price: 74,
    ongoing_price: 79,
    discount: "$5 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Reliable Fast Fibre",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Web browsing & Social Media",
      "Some Gaming Applications",
    ],
    voice_description:
      "Our standard OptiComm plan with 50 megabits down and 20 up. Great for households that stream on a few devices, work from home occasionally, and do some light gaming. Seventy four dollars for the first three months, then seventy nine dollars. Unlimited data, no contract lock-ins.",
  },
  {
    title: "OptiComm one hundred by twenty Megabits per second Residential",
    price: 84,
    download: "100 Megabits per second",
    upload: "20 Megabits per second",
    intro_price: 84,
    ongoing_price: 89,
    discount: "$5 off for 3 months",
    note: "For communities with limited capacity of 100Mbps",
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Reliable Fast Fibre",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Web browsing & Social Media",
      "Fast Downloading",
      "Gaming",
      "Low latency",
    ],
    voice_description:
      "Our fast OptiComm plan with 100 megabits down and 20 up. Ideal for busy families streaming 4K, gaming online, and downloading large files. Eighty four dollars for the first three months, then eighty nine dollars. Perfect for communities where 100 megabits is the top speed available.",
  },
  {
    title:
      "OptiComm five hundred by fifty Megabits per second Faster Residential",
    price: 79,
    download: "500 Megabits per second",
    upload: "50 Megabits per second",
    intro_price: 79,
    ongoing_price: 89,
    discount: "$10 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Reliable Fast Fibre",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Web browsing & Social Media",
      "Super Fast Downloading",
      "All Gaming Applications",
      "Low latency",
    ],
    voice_description:
      "This is our popular mid-range option with 500 megabits download and 50 up. Great for busy households - you can stream 4K on multiple devices, download large files in seconds, and game online without lag. Just 79 dollars for the first three months, then 89 dollars. Same deal - unlimited data, no lock-in contracts.",
  },
  {
    title:
      "OptiComm seven hundred fifty by fifty Megabits per second Residential",
    price: 89,
    download: "750 Megabits per second",
    upload: "50 Megabits per second",
    intro_price: 89,
    ongoing_price: 99,
    discount: "$10 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Reliable Fast Fibre",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Web browsing & Social Media",
      "Super Fast Downloading",
      "All Gaming Applications",
      "Low latency",
    ],
    voice_description:
      "Our high-speed OptiComm plan with 750 megabits down and 50 up. Built for power users - multiple 4K streams, competitive gaming, and huge downloads all at once. Eighty nine dollars for three months, then ninety nine dollars. No contracts, unlimited data.",
  },
  {
    title:
      "OptiComm one thousand by one hundred Megabits per second Residential",
    price: 99,
    download: "1000 Megabits per second",
    upload: "100 Megabits per second",
    intro_price: 99,
    ongoing_price: 109,
    discount: "$10 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Reliable Fast Fibre",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Web browsing & Social Media",
      "Super Fast Uploads/Downloads",
      "All Gaming Applications",
      "Low latency",
    ],
    voice_description:
      "Our ultra-fast OptiComm plan with 1000 megabits down and 100 up. This is our flagship residential plan - handles anything from 4K streaming on many devices to pro-level gaming and massive file transfers. Ninety nine dollars for three months, then one hundred nine dollars. Unlimited data, cancel anytime.",
  },
];

const OPTICOMM_BUSINESS_PLANS = [
  {
    title: "OptiComm fifty by twenty Megabits per second Business",
    price: 79,
    download: "50 Megabits per second",
    upload: "20 Megabits per second",
    intro_price: 79,
    ongoing_price: 89,
    discount: "$10 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contracts",
      "Month to Month",
      "Includes Static IP",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Web browsing & Social Media",
      "Some Gaming Applications",
      "Low latency",
    ],
    voice_description:
      "Our entry-level OptiComm business plan with 50 megabits down and 20 up. Perfect for small offices, VoIP phones, and video conferencing. Seventy nine dollars for three months, then eighty nine dollars. Includes a static IP address, unlimited data, no contracts.",
  },
  {
    title: "OptiComm one hundred by forty Megabits per second Business",
    price: 99,
    download: "100 Megabits per second",
    upload: "40 Megabits per second",
    intro_price: 99,
    ongoing_price: 109,
    discount: "$10 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contracts",
      "Month to Month",
      "Includes Static IP",
    ],
    suitable_for: [
      "Business IP Phones (VoIP Services)",
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Web browsing & Social Media",
      "Moderate Uploads/Downloads",
      "All Gaming Applications",
      "Low latency",
    ],
    voice_description:
      "Our standard business plan with 100 megabits down and 40 up. Great for offices with multiple staff, cloud backups, and regular video meetings. Ninety nine dollars for three months, then one hundred nine dollars. Includes static IP, unlimited data, no lock-in contracts.",
  },
  {
    title:
      "OptiComm two hundred fifty by one hundred Megabits per second Business",
    price: 139,
    download: "250 Megabits per second",
    upload: "100 Megabits per second",
    intro_price: 139,
    ongoing_price: 149,
    discount: "$10 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contracts",
      "Month to Month",
      "Includes Static IP",
    ],
    suitable_for: [
      "Business IP Phones (VoIP Services)",
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Web browsing & Social Media",
      "Super Fast Uploads/Downloads",
      "All Gaming Applications",
      "Low latency",
    ],
    voice_description:
      "Our fast business plan with 250 megabits down and 100 up. Excellent for growing businesses with heavy file sharing, video conferencing, and cloud applications. One hundred thirty nine dollars for three months, then one hundred forty nine dollars. Static IP included, unlimited data.",
  },
  {
    title: "OptiComm five hundred by two hundred Megabits per second Business",
    price: 169,
    download: "500 Megabits per second",
    upload: "200 Megabits per second",
    intro_price: 169,
    ongoing_price: 179,
    discount: "$10 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contracts",
      "Month to Month",
      "Includes Static IP",
    ],
    suitable_for: [
      "Business IP Phones (VoIP Services)",
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Web browsing & Social Media",
      "Super Fast Uploads/Downloads",
      "All Gaming Applications",
      "Low latency",
    ],
    voice_description:
      "Our high-speed business plan with 500 megabits down and 200 up. Built for demanding offices - large file transfers, multiple HD video streams, and serious cloud workloads. One hundred sixty nine dollars for three months, then one hundred seventy nine dollars. Static IP, unlimited data, no contracts.",
  },
  {
    title: "OptiComm one thousand by four hundred Megabits per second Business",
    price: 189,
    download: "1000 Megabits per second",
    upload: "400 Megabits per second",
    intro_price: 189,
    ongoing_price: 199,
    discount: "$10 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contracts",
      "Month to Month",
      "Includes Static IP",
    ],
    suitable_for: [
      "Business IP Phones (VoIP Services)",
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Web browsing & Social Media",
      "Super Fast Uploads/Downloads",
      "All Gaming Applications",
      "Low latency",
    ],
    voice_description:
      "Our flagship business plan with 1000 megabits down and 400 up. The ultimate package for data-heavy businesses - massive uploads, unlimited video calls, and enterprise-grade performance. One hundred eighty nine dollars for three months, then one hundred ninety nine dollars. Static IP included, unlimited data, no lock-in contracts.",
  },
];

// ==================== NBN RESIDENTIAL PLANS ====================
const NBN_RESIDENTIAL_PLANS = [
  {
    title: "NBN twenty-five by ten Megabits per second Basic",
    download: "25 Megabits per second",
    upload: "10 Megabits per second",
    intro_price: 59,
    ongoing_price: 64,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Web browsing & Social Media",
    ],
    voice_description:
      "Our basic NBN plan with 25 megabits down and 10 up. Perfect for everyday browsing, emails, and HD streaming. Fifty nine dollars for the first three months, then sixty four dollars. Unlimited data, no contracts, month-to-month flexibility.",
  },
  {
    title: "NBN fifty by twenty Megabits per second Standard",
    download: "50 Megabits per second",
    upload: "20 Megabits per second",
    intro_price: 74,
    ongoing_price: 79,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Web browsing & Social Media",
    ],
    voice_description:
      "Our standard NBN plan with 50 megabits down and 20 up. Great for households streaming on multiple devices and working from home. Seventy four dollars for three months, then seventy nine dollars. Unlimited data, no lock-in contracts.",
  },
  {
    title: "NBN one hundred by twenty Megabits per second Fast",
    download: "100 Megabits per second",
    upload: "20 Megabits per second",
    intro_price: 84,
    ongoing_price: 89,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Web browsing & Social Media",
      "Fast Downloading",
      "Gaming",
    ],
    voice_description:
      "Our fast NBN plan with 100 megabits down and 20 up. Ideal for busy families with 4K streaming, gaming, and multiple users online at once. Eighty four dollars for three months, then eighty nine dollars. Unlimited data, cancel anytime.",
  },
  {
    title: "NBN five hundred by fifty Megabits per second Faster",
    download: "500 Megabits per second",
    upload: "50 Megabits per second",
    intro_price: 84,
    ongoing_price: 89,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Super Fast Downloading",
      "All Gaming Applications",
      "Low latency",
    ],
    voice_description:
      "Our faster NBN plan with 500 megabits down and 50 up. Excellent for heavy usage - 4K streaming, large downloads, competitive gaming, and busy households. Eighty four dollars for three months, then eighty nine dollars. Unlimited data, no contracts.",
  },
  {
    title: "NBN seven hundred fifty by fifty Megabits per second Superfast",
    download: "750 Megabits per second",
    upload: "50 Megabits per second",
    intro_price: 89,
    ongoing_price: 99,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Super Fast Downloading",
      "All Gaming Applications",
      "Low latency",
    ],
    voice_description:
      "Our super-fast NBN plan with 750 megabits down and 50 up. Built for power users - multiple 4K streams, serious gaming, and huge downloads. Eighty nine dollars for three months, then ninety nine dollars. Unlimited data, no lock-in contracts.",
  },
  {
    title: "NBN one thousand by one hundred Megabits per second Ultrafast",
    download: "1000 Megabits per second",
    upload: "100 Megabits per second",
    intro_price: 99,
    ongoing_price: 109,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Super Fast Uploads/Downloads",
      "All Gaming Applications",
      "Low latency",
    ],
    voice_description:
      "Our ultra-fast NBN plan with 1000 megabits down and 100 up. The top-tier NBN option - handles anything from 4K streaming on many devices to pro-level gaming and massive file transfers. Ninety nine dollars for three months, then one hundred nine dollars. Unlimited data, no contracts.",
  },
];

// ==================== NBN BUSINESS PLANS ====================
const NBN_BUSINESS_PLANS = [
  {
    title: "NBN Business fifty by twenty Megabits per second Basic",
    download: "50 Megabits per second",
    upload: "20 Megabits per second",
    price: 89,
    intro_price: 89,
    ongoing_price: 89,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD + 4K",
      "Web browsing & Social Media",
    ],
    voice_description:
      "Our basic NBN business plan with 50 megabits down and 20 up. Perfect for small offices, VoIP phones, and video conferencing. Eighty nine dollars per month, flat rate. Includes static IP address, unlimited data, no contracts.",
  },
  {
    title: "NBN Business one hundred by forty Megabits per second Fast",
    download: "100 Megabits per second",
    upload: "40 Megabits per second",
    price: 99,
    intro_price: 99,
    ongoing_price: 99,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: [
      "VoIP / Business IP Phones",
      "Video Calls / Teams",
      "Streaming HD + 4K",
      "Moderate Uploads/Downloads",
      "All Gaming",
    ],
    voice_description:
      "Our standard business plan with 100 megabits down and 40 up. Great for offices with multiple staff, cloud backups, and regular video meetings. Ninety nine dollars per month. Includes static IP, unlimited data, no lock-in contracts.",
  },
  {
    title:
      "NBN Business two hundred fifty by one hundred Megabits per second Faster",
    download: "250 Megabits per second",
    upload: "100 Megabits per second",
    price: 149,
    intro_price: 149,
    ongoing_price: 149,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: [
      "VoIP / Business IP Phones",
      "Video Calls / Teams",
      "Streaming HD + 4K",
      "Super Fast Uploads/Downloads",
      "All Gaming",
    ],
    voice_description:
      "Our fast business plan with 250 megabits down and 100 up. Excellent for growing businesses with heavy file sharing, video conferencing, and cloud applications. One hundred forty nine dollars per month. Static IP included, unlimited data.",
  },
  {
    title:
      "NBN Business five hundred by two hundred Megabits per second Superfast",
    download: "500 Megabits per second",
    upload: "200 Megabits per second",
    price: 189,
    intro_price: 189,
    ongoing_price: 189,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: [
      "VoIP / Business IP Phones",
      "Video Calls / Teams",
      "Streaming HD + 4K",
      "Super Fast Uploads/Downloads",
      "All Gaming",
    ],
    voice_description:
      "Our high-speed business plan with 500 megabits down and 200 up. Built for demanding offices - large file transfers, multiple HD video streams, and serious cloud workloads. One hundred eighty nine dollars per month. Static IP, unlimited data, no contracts.",
  },
  {
    title:
      "NBN Business one thousand by four hundred Megabits per second Ultrafast",
    download: "1000 Megabits per second",
    upload: "400 Megabits per second",
    price: 239,
    intro_price: 239,
    ongoing_price: 239,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: [
      "VoIP / Business IP Phones",
      "Video Calls / Teams",
      "Streaming HD + 4K",
      "Super Fast Uploads/Downloads",
      "All Gaming",
    ],
    voice_description:
      "Our flagship NBN business plan with 1000 megabits down and 400 up. The ultimate package for data-heavy businesses - massive uploads, unlimited video calls, and enterprise-grade performance. Two hundred thirty nine dollars per month. Static IP included, unlimited data, no lock-in contracts.",
  },
];

// ==================== NBN FIXED WIRELESS PLANS ====================
const NBN_FIXED_WIRELESS_PLANS = [
  {
    title:
      "NBN twenty-five by five Megabits per second Fixed Wireless Standard",
    download: "25 Megabits per second",
    upload: "5 Megabits per second",
    price: 59,
    intro_price: 59,
    ongoing_price: 59,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Setup",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Emails, Web browsing & Social Media",
    ],
    voice_description:
      "Our standard Fixed Wireless plan with 25 megabits down and 5 up. Ideal for rural areas with wireless tower coverage. Great for everyday browsing, emails, and HD streaming. Fifty nine dollars per month, free NBN setup included. Unlimited data, no contracts.",
  },
  {
    title: "NBN one hundred by twenty Megabits per second Fixed Wireless Plus",
    download: "100 Megabits per second",
    upload: "20 Megabits per second",
    price: 89,
    intro_price: 89,
    ongoing_price: 89,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Setup",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p + 4K",
      "Web browsing & Social Media",
      "Fast Downloading",
      "All Gaming Applications",
    ],
    voice_description:
      "Our plus Fixed Wireless plan with 100 megabits down and 20 up. Excellent for rural households streaming 4K, gaming online, and working from home. Eighty nine dollars per month, free NBN setup. Unlimited data, no lock-in contracts.",
  },
  {
    title:
      "NBN two hundred by twenty Megabits per second Fixed Wireless HomeFast",
    download: "200 Megabits per second",
    upload: "20 Megabits per second",
    price: 99,
    intro_price: 99,
    ongoing_price: 99,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Setup",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p + 4K",
      "Web browsing & Social Media",
      "Fast Downloading",
      "All Gaming Applications",
    ],
    voice_description:
      "Our home fast Fixed Wireless plan with 200 megabits down and 20 up. Great for busy rural households with multiple devices streaming, gaming, and downloading. Ninety nine dollars per month, free NBN setup included. Unlimited data, no contracts.",
  },
  {
    title:
      "NBN four hundred by forty Megabits per second Fixed Wireless SuperFast",
    download: "400 Megabits per second",
    upload: "40 Megabits per second",
    price: 109,
    intro_price: 109,
    ongoing_price: 109,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Setup",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p + 4K",
      "Web browsing & Social Media",
      "Super Fast Uploads/Downloads",
      "All Gaming Applications",
    ],
    note: "Available in eligible areas only",
    voice_description:
      "Our super-fast Fixed Wireless plan with 400 megabits down and 40 up. Our fastest wireless option for eligible rural areas - handles 4K streaming, competitive gaming, and large downloads. One hundred nine dollars per month, free NBN setup. Unlimited data, no contracts.",
  },
];

// ==================== NBN SKY MUSTER PLANS ====================
const NBN_SKYMUSTER_PLANS = [
  {
    title: "NBN Sky Muster Plus twenty-five by five Megabits per second Basic",
    download: "25 Megabits per second",
    upload: "5 Megabits per second",
    price: 59,
    intro_price: 59,
    ongoing_price: 59,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Installation",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Web browsing & Social Media",
    ],
    note: "Typical latency 500-600ms",
    voice_description:
      "Our basic Sky Muster satellite plan with 25 megabits down and 5 up. Designed for remote areas with no other coverage. Great for browsing, emails, and HD streaming. Fifty nine dollars per month, free satellite installation. Please note - typical latency is 500 to 600 milliseconds due to satellite distance. Unlimited data, no contracts.",
  },
  {
    title: "NBN Sky Muster Plus fifty by five Megabits per second Fast",
    download: "50 Megabits per second",
    upload: "5 Megabits per second",
    price: 69,
    intro_price: 69,
    ongoing_price: 69,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Installation",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Web browsing & Social Media",
      "Some Gaming Applications",
    ],
    note: "Typical latency 500-600ms",
    voice_description:
      "Our fast Sky Muster satellite plan with 50 megabits down and 5 up. Better for remote households that stream and need more bandwidth. Sixty nine dollars per month, free satellite installation. Typical latency is 500 to 600 milliseconds. Unlimited data, no contracts.",
  },
  {
    title: "NBN Sky Muster Plus one hundred by five Megabits per second Ultra",
    download: "100 Megabits per second",
    upload: "5 Megabits per second",
    price: 99,
    intro_price: 99,
    ongoing_price: 99,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Installation",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p + 4K",
      "Web browsing & Social Media",
      "Super Fast Uploads/Downloads",
      "All Gaming Applications",
    ],
    note: "Typical latency 500-600ms",
    voice_description:
      "Our ultra Sky Muster satellite plan with 100 megabits down and 5 up. The fastest satellite option for remote areas - handles 4K streaming and gaming. Ninety nine dollars per month, free installation. Please note typical latency of 500 to 600 milliseconds due to satellite distance. Unlimited data, no contracts.",
  },
];

// ==================== HOPE ISLAND RESORT RESIDENTIAL PLANS ====================
const HIR_RESIDENTIAL_PLANS = [
  {
    title: "HIR twenty-five by ten Megabits per second Basic",
    download: "25 Megabits per second",
    upload: "10 Megabits per second",
    intro_price: 44,
    ongoing_price: 59,
    discount: "$15 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["General browsing", "Video Calls", "HD Streaming"],
    voice_description:
      "Our basic Hope Island Resort plan with 25 megabits down and 10 up. Perfect for everyday browsing, video calls, and HD streaming. Forty four dollars for three months, then fifty nine dollars. Huge savings compared to regular NBN. Unlimited data, no contracts.",
  },
  {
    title: "HIR fifty by twenty Megabits per second Standard",
    download: "50 Megabits per second",
    upload: "20 Megabits per second",
    intro_price: 49,
    ongoing_price: 64,
    discount: "$15 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["Video Calls", "HD Streaming", "Web browsing"],
    voice_description:
      "Our standard Hope Island Resort plan with 50 megabits down and 20 up. Great for streaming on multiple devices and working from home. Forty nine dollars for three months, then sixty four dollars. Exclusive resort pricing. Unlimited data, no lock-in contracts.",
  },
  {
    title: "HIR two hundred fifty by fifty Megabits per second Fast",
    download: "250 Megabits per second",
    upload: "50 Megabits per second",
    intro_price: 64,
    ongoing_price: 79,
    discount: "$15 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["Video Calls", "4K Streaming", "Fast Downloading", "Gaming"],
    voice_description:
      "Our fast Hope Island Resort plan with 250 megabits down and 50 up. Excellent for 4K streaming, gaming, and busy households. Sixty four dollars for three months, then seventy nine dollars. Free modem upgrade if needed. Unlimited data, no contracts.",
  },
  {
    title: "HIR five hundred by fifty Megabits per second Home Fast",
    download: "500 Megabits per second",
    upload: "50 Megabits per second",
    intro_price: 64,
    ongoing_price: 79,
    discount: "$15 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free modem upgrade if required",
    ],
    suitable_for: [
      "Video Calls",
      "4K Streaming",
      "Super Fast Downloading",
      "All Gaming",
    ],
    voice_description:
      "Our home fast Hope Island Resort plan with 500 megabits down and 50 up. Built for power users - multiple 4K streams, competitive gaming, and huge downloads. Sixty four dollars for three months, then seventy nine dollars. Free modem upgrade included. Unlimited data, no contracts.",
  },
  {
    title: "HIR seven hundred fifty by fifty Megabits per second Superfast",
    download: "750 Megabits per second",
    upload: "50 Megabits per second",
    intro_price: 74,
    ongoing_price: 89,
    discount: "$15 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free modem upgrade if required",
    ],
    suitable_for: [
      "Video Calls",
      "4K Streaming",
      "Super Fast Downloading",
      "All Gaming",
      "Low latency",
    ],
    voice_description:
      "Our super-fast Hope Island Resort plan with 750 megabits down and 50 up. Handles multiple 4K streams, serious gaming, and heavy usage with ease. Seventy four dollars for three months, then eighty nine dollars. Free modem upgrade if needed. Unlimited data, no contracts.",
  },
  {
    title: "HIR one thousand by one hundred Megabits per second Ultrafast",
    download: "1000 Megabits per second",
    upload: "100 Megabits per second",
    intro_price: 84,
    ongoing_price: 99,
    discount: "$15 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free modem upgrade if required",
    ],
    suitable_for: [
      "Video Calls",
      "4K Streaming",
      "Super Fast Uploads/Downloads",
      "All Gaming",
      "Low latency",
    ],
    voice_description:
      "Our ultra-fast Hope Island Resort plan with 1000 megabits down and 100 up. The flagship resort plan - handles anything from many 4K devices to pro-level gaming and massive transfers. Eighty four dollars for three months, then ninety nine dollars. Free modem upgrade included. Unlimited data, no contracts.",
  },
];

// ==================== HOPE ISLAND RESORT BUSINESS PLANS ====================
const HIR_BUSINESS_PLANS = [
  {
    title: "HIR Business two hundred fifty by one hundred Megabits per second",
    download: "250 Megabits per second",
    upload: "100 Megabits per second",
    price: 109,
    intro_price: 109,
    ongoing_price: 109,
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "VoIP",
      "Video Calls",
      "4K Streaming",
      "Fast Uploads/Downloads",
    ],
    voice_description:
      "Our business plan for Hope Island Resort with 250 megabits down and 100 up. Perfect for small offices, VoIP phones, and video conferencing. One hundred nine dollars per month flat rate. Unlimited data, no contracts, exclusive resort pricing.",
  },
  {
    title: "HIR Business five hundred by two hundred Megabits per second",
    download: "500 Megabits per second",
    upload: "200 Megabits per second",
    price: 119,
    intro_price: 119,
    ongoing_price: 119,
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "VoIP",
      "Video Calls",
      "4K Streaming",
      "Super Fast Uploads/Downloads",
    ],
    voice_description:
      "Our fast business plan for Hope Island Resort with 500 megabits down and 200 up. Excellent for growing businesses with heavy file sharing and video conferencing. One hundred nineteen dollars per month. Unlimited data, no lock-in contracts.",
  },
  {
    title: "HIR Business one thousand by four hundred Megabits per second",
    download: "1000 Megabits per second",
    upload: "400 Megabits per second",
    price: 139,
    intro_price: 139,
    ongoing_price: 139,
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "VoIP",
      "Video Calls",
      "4K Streaming",
      "Ultra Fast Uploads/Downloads",
      "All Gaming",
    ],
    voice_description:
      "Our flagship business plan for Hope Island Resort with 1000 megabits down and 400 up. Ultimate package for data-heavy businesses - massive uploads, unlimited video calls, enterprise performance. One hundred thirty nine dollars per month. Unlimited data, no contracts, exclusive resort pricing.",
  },
];

// ==================== MARS SPEED MAPPING ====================
const MARS_SPEED_MAP = {
  TC425D5U: { dl: 25, ul: 5 },
  TC425D10U: { dl: 25, ul: 10 },
  TC450D20U: { dl: 50, ul: 20 },
  TC4100D20U: { dl: 100, ul: 20 },
  TC4100D40U: { dl: 100, ul: 40 },
  TC4250D25U: { dl: 250, ul: 25 },
  TC4250D100U: { dl: 250, ul: 100 },
  TC4500D50U: { dl: 500, ul: 50 },
  TC4500D200U: { dl: 500, ul: 200 },
  TC4750D50U: { dl: 750, ul: 50 },
  TC41000D50U: { dl: 1000, ul: 50 },
  TC41000D100U: { dl: 1000, ul: 100 },
  TC41000D400U: { dl: 1000, ul: 400 },
  TC4FWP: { dl: 25, ul: 5 },
  TC4FWHF: { dl: 100, ul: 20 },
  TC4FWSF: { dl: 200, ul: 20 },
  TC4FWUF: { dl: 400, ul: 40 },
};
Object.keys(MARS_SPEED_MAP).forEach((k) => {
  MARS_SPEED_MAP["L3" + k] = MARS_SPEED_MAP[k];
});

function isPlanMatchingServiceType(planTitle, serviceType) {
  const title = (planTitle || "").toLowerCase();
  if (serviceType === "nsas") {
    return (
      title.includes("sky") ||
      title.includes("satellite") ||
      title.includes("muster")
    );
  }
  if (serviceType === "nwas") {
    return (
      title.includes("wireless") ||
      title.includes("fixed wireless") ||
      title.includes("fw ")
    );
  }
  return (
    !title.includes("sky") &&
    !title.includes("satellite") &&
    !title.includes("muster") &&
    !title.includes("wireless") &&
    !title.includes("fw ")
  );
}

function filterTariffsByMarsAvailability(
  tariffs,
  virtutelSpeedsAvailable,
  serviceType,
) {
  const availableSpeeds = new Set();
  if (
    Array.isArray(virtutelSpeedsAvailable) &&
    virtutelSpeedsAvailable.length > 0
  ) {
    for (const code of virtutelSpeedsAvailable) {
      const mapped = MARS_SPEED_MAP[code];
      if (mapped) availableSpeeds.add(`${mapped.dl}/${mapped.ul}`);
    }
  }
  return tariffs.filter((t) => {
    if (serviceType && !isPlanMatchingServiceType(t.title, serviceType))
      return false;
    if (availableSpeeds.size > 0) {
      const dl = Math.round(t.speed_download / 1000);
      const ul = Math.round(t.speed_upload / 1000);
      return availableSpeeds.has(`${dl}/${ul}`);
    }
    return true;
  });
}

function requiresInstallVisit(serviceabilityClass) {
  const installRequired = new Set([
    "1",
    "2",
    "5",
    "8",
    "21",
    "22",
    "23",
    "31",
    "32",
    "33",
    "11",
    "12",
  ]);
  return installRequired.has(String(serviceabilityClass));
}

function getServiceabilityDescription(
  primaryAccessTechnology,
  serviceabilityClass,
  serviceabilityStatus,
) {
  const cls = String(serviceabilityClass);
  const tech = (primaryAccessTechnology || "").toLowerCase();
  if (serviceabilityStatus === "Rejected")
    return "Not currently orderable at this address.";
  if (tech === "fibre") {
    if (cls === "1")
      return "Fibre serviceable - no drop or NTD in place. Technician visit required for installation.";
    if (cls === "2")
      return "Fibre drop in place - NTD not yet installed. Technician visit required to complete installation.";
    if (cls === "3")
      return "Fibre fully installed (drop + NTD in place). Ready to connect - typically 1-5 business days.";
  }
  if (tech === "hfc") {
    if (cls === "21")
      return "HFC serviceable - lead-in, PCD, and internal cabling required. Technician visit needed.";
    if (cls === "22")
      return "HFC lead-in & PCD in place - internal cabling with wall plates still needed. Technician visit required.";
    if (cls === "23")
      return "HFC wall plate present - NTD not yet installed. Technician visit required.";
    if (cls === "24")
      return "HFC fully installed (wall plate + NTD in place). Ready to connect.";
  }
  if (tech === "wireless") {
    if (cls === "5")
      return "Fixed Wireless serviceable - CPE (antenna/NTD) not yet installed. Technician visit required. Standard install is free.";
    if (cls === "6")
      return "Fixed Wireless fully installed (CPE in place). Ready to connect. Note: Superfast tier may require WNTD upgrade appointment.";
  }
  if (tech === "satellite") {
    if (cls === "8")
      return "Satellite serviceable - dish and NTD not yet installed. Technician visit required. Standard install is free. Typical latency: 500-600ms.";
    if (cls === "9")
      return "Satellite fully installed (dish + NTD in place). Ready to connect. Typical latency: 500-600ms.";
  }
  if (tech === "fibre to the node") {
    if (cls === "11")
      return "FTTN serviceable - active node present. Technician visit may be required for jumpering.";
    if (cls === "12")
      return "FTTN serviceable - jumpering required. Technician visit needed.";
    if (cls === "13") return "FTTN infrastructure in place. Ready to connect.";
  }
  if (tech === "fibre to the building") {
    if (cls === "12")
      return "FTTB serviceable - jumpering required. Technician visit needed.";
    if (cls === "13") return "FTTB infrastructure in place. Ready to connect.";
  }
  if (tech === "fibre to the curb") {
    if (cls === "31")
      return "FTTC serviceable - no copper line available yet (NCD required). Technician visit needed.";
    if (cls === "32")
      return "FTTC serviceable - cut-in required (NCD needed). Technician visit required.";
    if (cls === "33")
      return "FTTC cut-in complete - NCD still required. Technician visit needed.";
    if (cls === "34")
      return "FTTC infrastructure fully in place. Ready to connect.";
  }
  return serviceabilityStatus || "Serviceable";
}

// ==================== MARS API FUNCTIONS ====================
let marsAccessToken = null;
let marsAccessTokenExpiresAtMs = 0;

async function getMarsAccessToken() {
  if (
    marsAccessToken &&
    marsAccessTokenExpiresAtMs &&
    Date.now() < marsAccessTokenExpiresAtMs - 30_000
  ) {
    return marsAccessToken;
  }
  if (!MARS_CLIENT_ID || !MARS_CLIENT_SECRET) {
    throw new Error(
      "Mars credentials missing: set MARS_CLIENT_ID and MARS_CLIENT_SECRET in environment/.env",
    );
  }
  const resp = await axios.post(
    `${MARS_BASE_URL}/oauth/tokens`,
    {
      client_id: MARS_CLIENT_ID,
      client_secret: MARS_CLIENT_SECRET,
      audience: "mars.as24516.net",
      grant_type: "client_credentials",
    },
    { headers: { "Content-Type": "application/json" } },
  );
  const data = resp?.data || {};
  if (!data.vt_success || !data.access_token) {
    throw new Error(
      `Mars token error: ${data.vt_error_desc || data.vt_short_error || "Token request failed"}`,
    );
  }
  marsAccessToken = data.access_token;
  const expiresInSec =
    typeof data.expires_in === "number" ? data.expires_in : 0;
  marsAccessTokenExpiresAtMs = Date.now() + Math.max(0, expiresInSec) * 1000;
  console.log(
    `Mars token generated. Expires in: ${expiresInSec} seconds (${Math.round(expiresInSec / 60)} minutes)`,
  );
  return marsAccessToken;
}

async function marsAddressSearch(address) {
  const token = await getMarsAccessToken();
  const resp = await axios.post(
    `${MARS_BASE_URL}/locations`,
    { unstructured: { address, fuzzy: false } },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );
  console.log("Mars locations response:", resp?.data);
  const data = resp?.data || {};
  if (!data.vt_success) {
    throw new Error(
      `Mars locations error: ${data.vt_error_desc || data.vt_short_error || "Address search failed"}`,
    );
  }
  return Array.isArray(data.responseData) ? data.responseData : [];
}

async function marsServiceQualification(locationId) {
  const token = await getMarsAccessToken();
  const resp = await axios.get(
    `${MARS_BASE_URL}/service-qualifications/${encodeURIComponent(locationId)}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );
  console.log("Mars service qualification response:", resp?.data);
  return resp?.data;
}

// ==================== SPLYNX CLIENT ====================
class SplynxApiClient {
  constructor(config) {
    this.baseUrl = config.SPLYNX_BASE_URL;
    this.apiKey = config.API_KEY;
    this.apiSecret = config.API_SECRET;
    this.accessToken = null;
    this.accessTokenExpiration = 0;
    this.refreshToken = null;
    this.refreshTokenExpiration = 0;
    this.useAccessToken = config.USE_ACCESS_TOKEN !== false;
  }
  generateSignature(nonce) {
    const hmac = crypto.createHmac("sha256", this.apiSecret);
    hmac.update(nonce + this.apiKey);
    return hmac.digest("hex").toUpperCase();
  }
  getSignatureAuthHeader() {
    const nonce = Math.round((Date.now() / 1000) * 100);
    return `Splynx-EA (${new URLSearchParams({ key: this.apiKey, nonce, signature: this.generateSignature(nonce) }).toString()})`;
  }
  async generateAccessToken() {
    const nonce = Math.floor(Date.now() / 1000);
    const response = await axios.post(
      `${this.baseUrl}admin/auth/tokens`,
      {
        auth_type: "api_key",
        key: this.apiKey,
        nonce,
        signature: this.generateSignature(nonce),
      },
      { headers: { "Content-Type": "application/json" } },
    );
    const d = response.data;
    this.accessToken = d.access_token;
    this.accessTokenExpiration = d.access_token_expiration;
    this.refreshToken = d.refresh_token;
    this.refreshTokenExpiration = d.refresh_token_expiration;
    console.log("✅ Splynx Access token generated");
    return d;
  }
  async renewAccessToken() {
    if (!this.refreshToken) throw new Error("No refresh token");
    const response = await axios.get(
      `${this.baseUrl}admin/auth/tokens/${this.refreshToken}`,
      {
        headers: {
          Authorization: `Splynx-EA (access_token=${this.accessToken})`,
        },
      },
    );
    const d = response.data;
    this.accessToken = d.access_token;
    this.accessTokenExpiration = d.access_token_expiration;
    this.refreshToken = d.refresh_token;
    this.refreshTokenExpiration = d.refresh_token_expiration;
    console.log("✅ Splynx Access token renewed");
    return d;
  }
  isTokenExpired(buf = 30) {
    return Date.now() / 1000 + buf > this.accessTokenExpiration;
  }
  async request(method, endpoint, data = null, params = {}) {
    let headers = {};
    if (data) {
      if (typeof data.getHeaders === "function")
        Object.assign(headers, data.getHeaders());
      else if (data instanceof URLSearchParams)
        headers["Content-Type"] = "application/x-www-form-urlencoded";
      else headers["Content-Type"] = "application/json";
    }
    if (this.useAccessToken && this.accessToken) {
      if (this.isTokenExpired()) await this.renewAccessToken();
      headers.Authorization = `Splynx-EA (access_token=${this.accessToken})`;
    } else {
      headers.Authorization = this.getSignatureAuthHeader();
    }
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers,
        params,
        timeout: 15000,
        ...(data && {
          data: data instanceof URLSearchParams ? data.toString() : data,
        }),
      };
      return (await axios(config)).data;
    } catch (err) {
      if (err.response?.status === 401) {
        await this.renewAccessToken();
        return this.request(method, endpoint, data, params);
      }
      throw err.response?.data || err;
    }
  }
  async searchCustomers(p) {
    return this.request("GET", "admin/customers/customer", null, p);
  }
  async getCustomerInternetServices(id, p = {}) {
    return this.request(
      "GET",
      `admin/customers/customer/${id}/internet-services`,
      null,
      p,
    );
  }
  async getCustomerVoiceServices(id, p = {}) {
    return this.request(
      "GET",
      `admin/customers/customer/${id}/voice-services`,
      null,
      p,
    );
  }
  async getCustomerRecurringServices(id, p = {}) {
    return this.request(
      "GET",
      `admin/customers/customer/${id}/recurring-services`,
      null,
      p,
    );
  }
  async listInternetTariffs(p = {}) {
    return this.request("GET", "admin/tariffs/internet", null, p);
  }
}

const splynx = new SplynxApiClient(CONFIG);
(async () => {
  try {
    if (CONFIG.USE_ACCESS_TOKEN) await splynx.generateAccessToken();
  } catch (e) {
    console.error("Initial Splynx token failed.");
  }
})();
app.use(async (req, res, next) => {
  try {
    if (CONFIG.USE_ACCESS_TOKEN && !splynx.accessToken)
      await splynx.generateAccessToken();
    next();
  } catch (e) {
    next();
  }
});

const LOCATIONS = [
  { id: 1, name: "Queensland" },
  { id: 2, name: "Victoria" },
  { id: 3, name: "New South Wales" },
  { id: 4, name: "Tasmania" },
  { id: 5, name: "Western Australia" },
  { id: 6, name: "South Australia" },
  { id: 7, name: "Northern Territory" },
  { id: 8, name: "ACT" },
];

const KB = `
Knowledge base for InfeNET Broadband:
- Greeting / Routing: "Thanks for calling InfeNET Broadband, how may we help you today? Would it be sales, support, accounts, other, or moving/relocating?"
- Payment & Portal: "Did you know you can update your payment method via the customer portal?" If no access: "email support@infinetbroadband.com.au for login credentials."
- Support contact: "email support@infinetbroadband.com.au"
- Plan change / Upgrade: "email support@infinetbroadband.com.au"
- Outstanding / Overdue invoice: "login to customer portal or email support@infinetbroadband.com.au"
- Payment details changed: "login to customer portal or email support@infinetbroadband.com.au"
- Cannot login to portal: "email support@infinetbroadband.com.au"
- NBN vs OptiComm: "Both deliver fibre internet. NBN is the national network, OptiComm is private fibre in selected estates. InfiNET connects you to either."
- Private Fibre Networks: "visit https://www.infinetbroadband.com.au/private-fibre-networks-for-developers/"
- Opticomm Free to Air TV: "Contact Opticomm directly at https://online.telco.opticomm.com.au/television-fault"
- BYO Modem: Yes, compatible modems work. We also sell modems.
- Unlimited data: Yes on all plans.
- NBN vs OptiComm speeds: Similar tiers, 25-1000 Mbps. OptiComm often more consistent.
- Setup time: 30min-3hrs if pre-connected. New homes may need NTD install.
- OptiComm check: OptiComm website or ask us.
- Moving/relocating: We list active services, ask which to terminate, termination date, new address, connection date.
- Customer portal: https://infinetbroadband-portal.com.au/
- Head Office: Level 15, Corporate Centre One, 2 Corporate Court, Bundall, QLD 4217
- Phone: 1300 101 414
- Residential Plans (intro discounts for new customers, unlimited data, no contract):
  NBN:
  - 25/10 Basic: $59/m ($5 off 3m, then $64) - FTTC/FTTN/FTTB/FTTP/HFC
  - 50/20 Standard: $74/m ($5 off 3m, then $79) - FTTC/FTTN/FTTB/FTTP/HFC
  - 100/20 Fast: $84/m ($5 off 3m, then $89) - FTTC/FTTN/FTTB/FTTP/HFC
  - 500/50 Faster: $84/m ($5 off 3m, then $89) - FTTP/HFC only
  - 750/50 Superfast: $89/m ($10 off 3m, then $99) - FTTP/HFC only
  - 1000/100 Ultrafast: $99/m ($10 off 3m, then $109) - FTTP/HFC only
  OptiComm Residential (FTTP, reliable fibre):
  - 25/10: $64/m ($5 off 3m, then $69)
  - 50/20: $74/m ($5 off 3m, then $79)
  - 100/20: $84/m ($5 off 3m, then $89) - for communities with limited capacity of 100Mbps
  - 500/50 Faster: $79/m ($10 off 3m, then $89)
  - 750/50: $89/m ($10 off 3m, then $99)
  - 1000/100: $99/m ($10 off 3m, then $109)
  Hope Island Resort Residential:
  - 25/10 Basic: $44/m ($15 off 3m, then $59)
  - 50/20 Standard: $49/m ($15 off 3m, then $64)
  - 250/50 Fast: $64/m ($15 off 3m, then $79)
  - 500/50 Home Fast: $64/m ($15 off 3m, then $79)
  - 750/50 Superfast: $74/m ($15 off 3m, then $89)
  - 1000/100 Ultrafast: $84/m ($15 off 3m, then $99)
  NBN Fixed Wireless (no contract, month-to-month, free NBN setup):
  - 25/5 Standard: $59/m
  - 100/20 Plus: $89/m
  - 200/20 HomeFast: $99/m
  - 400/40 SuperFast: $109/m (eligible areas only)
  NBN Sky Muster Plus Satellite (no contract, month-to-month, free NBN installation):
  - 25/5 Basic: $59/m
  - 50/5 Fast: $69/m
  - 100/5 Ultra: $99/m
- Business Plans:
  NBN Business (static IP, unlimited, no contract):
  - 50/20 Basic: $89/m - FTTC/FTTN/FTTB/FTTP/HFC
  - 100/40 Fast: $99/m - FTTC/FTTN/FTTB/FTTP/HFC
  - 250/100 Faster: $149/m - FTTP/HFC only
  - 500/200 Superfast: $189/m - FTTP/HFC only
  - 1000/400 Ultrafast: $239/m - FTTP/HFC only
  OptiComm Business (static IP included):
  - 50/20: $79/m ($10 off 3m, then $89)
  - 100/40: $99/m ($10 off 3m, then $109)
  - 250/100: $139/m ($10 off 3m, then $149)
  - 500/200: $169/m ($10 off 3m, then $179)
  - 1000/400: $189/m ($10 off 3m, then $199)
  HIR Business: 250/100: $109/m | 500/200: $119/m | 1000/400: $139/m
  Business VoIP: VoIP 30: $30/m (PAYG) | VoIP 50: $50/m (unlimited)
- Hardware: TP-Link VX230v: $179 | VX230v+HX510 Mesh 1-pack: $318, 2-pack: $459 | HX510 1-pack: $159, 2-pack: $299 | VX420 4G failover: $319
- Security: Basic $9.95/m | Bronze $19.95/m | Silver $44.95/m | Gold $65.95/m
`;

// ==================== SYSTEM PROMPT ====================
const SYSTEM_PROMPT = `
You are a friendly, talkative, and naturally conversational voice/chat assistant for ${BRAND}.
You speak like a real human customer service agent who genuinely enjoys chatting with people - not a script-reading robot.
You take your time, you elaborate, you explain things properly, and you make customers feel like they're having a real conversation with someone who cares.
Handle five call types: support, sales, general, account, moving-relocating.

PACING & DELIVERY - CRITICAL:
- Speak slowly, warmly, and deliberately. Do NOT rush through information.
- After delivering important information (like listing plans), always pause naturally with a conversational bridge before continuing. For example: "So that's a quick overview - take your time looking those over, there's absolutely no rush at all."
- When presenting multiple plans, introduce each one gently and give it breathing room. Don't rattle them off like a list.
- After asking a question, genuinely wait. Don't stack questions.
- Use natural spoken rhythm - short sentences, pauses implied by punctuation, easy-to-listen-to language.
- Never present more than 3-4 plans in one go without a natural break like "So those are the first few - want me to keep going or does one of those already sound interesting?"

PACKAGE PRESENTATION STYLE - CRITICAL:
- When speaking packages or plans, use a calm step-by-step flow: network first, then plan name, then price, then the main benefit.
- Keep each plan separate. Read one plan, pause, then move to the next one.
- Slow down extra when saying prices, download speeds, and upload speeds so the customer can catch every detail.
- Prefer simple spoken phrasing like "This one is great if..." or "That plan suits..." instead of technical wording.
- WHEN READING SPEEDS AND TECHNICAL TERMS — SPEAK NATURALLY:
  * "Mbps" → say "megabits per second" — never spell out M-B-P-S
  * "25/10" → say "25 download, 10 upload" or "25 by 10" — never say "25 slash 10"
  * "1000/100" → say "1000 download, 100 upload" or "a thousand by a hundred"
  * Plan names like "25/10Mbps" → read as "25 download, 10 upload"
  * Speak slowly on numbers — "twenty-five" not "twentyfive" — give each digit breathing room
- If one plan is the best fit, recommend it first and explain why before mentioning the others.
- End every package overview with a soft handoff like "Take your time — which one sounds like the best fit for you?"

INTERRUPTION & NOISE HANDLING - CRITICAL:
- If you get interrupted mid-sentence and the interruption seems like background noise, a barge-in, or something unclear/unintelligible, do NOT treat it as a valid customer response.
- Instead, gently acknowledge it and repeat your previous point: "Oh sorry, I think there might have been a little hiccup there - let me just repeat that for you." Then re-say what you were saying.
- Only treat an interruption as intentional if it contains a clear question, a direct statement, or a specific word/name.
- If the customer says something very short like "yeah", "mm", "ok", "uh" mid-sentence, treat it as a listening cue, not a response, and continue naturally.
- If genuinely unsure whether it was a valid interruption, ask warmly: "Sorry, did you want to say something there? I just want to make sure I catch everything you're telling me!"

PERSONALITY & TONE:
- You're chatty and warm. Think of yourself as that helpful friend who works at an ISP and actually knows their stuff.
- Take your time with responses. Don't rush through things. If someone asks about a plan, don't just list the price - tell them WHY it's good, what kind of household it suits, what they'll actually experience.
- React genuinely to what people say. If they mention they just moved in, say something like "Oh nice, congrats on the new place! Moving's always a bit hectic isn't it? Well the good news is getting your internet sorted is the easy part - I'll have you up and running in no time."
- If they mention frustration (slow internet, outages, issues), really empathise: "Oh no, that sounds really annoying - I totally get it, there's nothing worse than dodgy internet, especially when you need it most. Don't worry though, let's get to the bottom of this and sort it out for you."
- Use natural, friendly language. Say things like "Awesome", "No worries at all", "Sure thing", "Sounds good to me", "Oh that's a great choice", "Yeah absolutely" - the way a real person would.
- Vary your language - don't use the same phrases over and over.
- Add little bits of personality and warmth. If they pick a fast plan, say something like "Oh you're going all out - love it! That plan is seriously quick, you'll notice the difference straight away."
- Feel free to share little tidbits of helpful info even if they didn't ask. For example: "Oh and just so you know, all our plans are month-to-month with no lock-in contracts, so you can upgrade or change anytime without any hassle."
- If the user makes small talk, jokes, or goes off topic for a moment, engage with it! Be human. Then gently steer back: "Haha that's great! Anyway, let's get you sorted..."
- When recommending plans, be descriptive and helpful. Don't just say "here are your options." Say things like "So based on what you've told me, I think you'd be really happy with the 500/50 plan - it's $79 a month for the first three months which is a great deal, and with 500 Mbps download you'll be able to stream 4K on multiple devices, game without any lag, and still have heaps of bandwidth left over for everything else. It's honestly our most popular plan for families."

RESPONSE LENGTH:
- Do NOT keep responses short. Be elaborative and thorough.
- When explaining plans, go into detail about what each one is good for, who it suits, and why they might want it.
- When the customer answers a question, acknowledge it properly with a full sentence or two before moving on.
- When presenting options, take the time to explain each one rather than just listing them.
- Add context, reassurance, and helpful information throughout the conversation.
- The only time you should be brief is when confirming something simple like "Got it!" before continuing.

STRICT RULES:
- ALWAYS reply in English.
- Greet ONLY at session start: "Welcome to InfeNET Broadband! Are you a new customer looking to get connected with us, or are you already part of the InfeNET family?"
- Collect structured fields naturally woven into conversation. Don't re-ask collected fields.
- Address user by preferredName when known - sprinkle it in naturally.
- Do NOT say "transferring", "connect to agent", "handover to human" etc.
- CRITICAL: Before calling create_ticket say something warm like: "Alright, perfect - I've got everything I need. Just bear with me for a moment while I get this all submitted for you..."
- After create_ticket success for EXISTING customers: "Brilliant, all done \${preferredName}! I've raised a support ticket for you and you'll get all the details sent through to your email shortly. Our team will review everything and be in touch with you soon to get this resolved. Is there anything else I can help you with today?"
- After create_ticket success for NEW customers (sales): "Awesome, you're all set \${preferredName}! I've submitted your enquiry and our sales team will be reaching out to you via email shortly to get everything finalised. They're a great bunch so they'll take really good care of you. Is there anything else you'd like to know in the meantime?"
- IMPORTANT: For sales inquiries (new customers), do NOT mention any ticket number or ticket ID.
- For support: collect issueSummary with follow-up details.
- Use customer_lookup for existing customers.
- HARD VERIFICATION RULE: For any existing-customer verification step, you MUST call customer_lookup. Do NOT verify from memory, previous messages, or assumptions.

VERIFICATION RULES - ABSOLUTE AND NON-NEGOTIABLE:
- TWO-STEP VERIFICATION IS MANDATORY for SUPPORT and ACCOUNTS flows:
  STEP 1: Call customer_lookup with EMAIL ONLY -> get confirmation account found
  STEP 2: Ask for the customer's phone number. The system will automatically compare the number they provide against the registered number from their account. You do NOT call customer_lookup again for phone verification.
- _emailVerifiedCustomerId is set in session after email lookup succeeds - this is NOT full verification
- _phoneVerified is ONLY set to true after the user's provided phone number matches the registered phone on the account
- You CANNOT proceed past verification if _phoneVerified is NOT true in session
- After email lookup success: say "Perfect, I can see that account. Just to quickly verify it's definitely you, could I grab the best contact number on the account?"
- After phone verification success (_phoneVerified becomes true): say "Perfect, thanks for confirming that - your account's all verified."
- If phone verification returns verificationFailed: true: say EXACTLY "That phone number doesn't match what we have on file. Could you double-check the number and try again? It might be a mobile registered under someone else in the household."
- If user says "I don't remember my number" or "I don't have access" or similar: say EXACTLY "I'm sorry, but for security purposes I'm unable to proceed without verifying your registered phone number. You're welcome to email us at support@infinetbroadband.com.au and our team can verify your identity another way." Do NOT proceed further.
- NEVER skip phone verification. NEVER proceed to account/support questions without _phoneVerified = true.

- PRIVATE NETWORK / DEVELOPMENT HANDLING: If customer mentions "private network", "development", "developer", "estate", "private fibre", "bulk fibre", "developers network", respond: "Oh that's exciting - private fibre networks for new developments are a great investment! We actually have a whole dedicated section for that on our website. You can check out all the details at https://www.infinetbroadband.com.au/private-fibre-networks-for-developers/ - it covers everything from the planning stage through to getting the network installed. Is there anything else I can help you with?"

ONE-NETWORK-PER-SESSION RULE - ABSOLUTE:
- Once check_address_availability has been called and returned plans for a specific network (either NBN or OptiComm), you are LOCKED to that network for the entire rest of the conversation.
- NEVER mention, suggest, or present plans from the other network at any point after the address check has been completed.
- If the tool returned NBN plans -> only NBN for this session. Do NOT bring up OptiComm. Ever.
- If the tool returned OptiComm plans -> only OptiComm for this session. Do NOT bring up NBN. Ever.
- This rule applies even if the customer asks "what about the other network" - simply say: "Based on your address, [network] is what's available for you, and honestly it's a great option! Let me know if you'd like more info about any of the plans."
- Do NOT say things like "your address is also serviceable with OptiComm" or "there's also NBN available" - pick the ONE network the tool returned and stick to it.

IMMEDIATE PLAN PRESENTATION - CRITICAL:
- The moment check_address_availability returns results, you MUST immediately present the plans to the customer WITHOUT waiting for them to prompt you.
- Do NOT pause and say "let me know when you're ready" or wait silently. The tool result is your cue to speak.
- Present the plans right away, warmly and conversationally, speak them slowly, and give each plan its own beat before moving on.
- **CRITICAL: For each plan, you MUST read the exact voice_description field provided in the availablePlans array. Do NOT improvise or summarize - read the voice_description word-for-word as it is pre-written for natural speech.**
- If the customer indicates they want home/residential plans, read ALL voice_descriptions for the available residential plans in order.
- End with "Which of these catches your eye?"
- There should be ZERO delay between the tool returning data and you presenting the plans.

CONVERSATION FLOW:
- Acknowledge -> React -> Elaborate -> Transition. Never just fire the next question.
- When the user answers a question, always acknowledge meaningfully before moving on.
- Accept partial answers and save them without asking again.
- On [SILENCE_NUDGE]: REPEAT your last question. Do NOT move forward or assume anything.
- After EVERY user answer, say something before the next question. Never go question -> question.

CRITICAL PLAN SELECTION RULE:
- After presenting available plans to the customer, you MUST STOP and WAIT for the customer to explicitly choose a plan.
- Do NOT select or assume a plan on behalf of the customer.
- Do NOT proceed to ask for email or create a ticket until the customer has clearly stated which plan they want.
- If the customer is silent after you present plans, gently ask: "So which of those plans catches your eye?" or "Take your time - which one sounds like the best fit for you?"
- Only after the customer explicitly names or describes a plan should you save it as leadInterest and continue.

WEBSITE VISIT CHECK - MANDATORY IN SALES FLOW:
- After the customer explicitly selects a plan (leadInterest is set), you MUST ask this question EVERY TIME without exception:
  "Just out of curiosity - have you had a chance to check out our website and had a look at the plans or pricing there?"
- WAIT for their answer before continuing.
- If YES -> proceed directly to collecting order details (name, mobile, email, address confirmation)
- If NO -> ask needs assessment questions ONE BY ONE, then collect order details
- This question MUST be asked. Do NOT skip it. Do NOT assume YES. Do NOT proceed to order collection without asking it.

INITIAL FLOW - SALES CALL FLOW (MUST FOLLOW EXACTLY):
1. Greet: "Welcome to InfeNET Broadband! Are you a new customer looking to get connected with us, or are you already part of the InfeNET family?"
2. If NEW: Collect address -> call check_address_availability -> ask home/business if needed -> show plans -> wait for selection -> ask website check -> collect details one by one -> call create_ticket
3. If EXISTING: Route to support/accounts/relocation flow

SUPPORT FLOW:
- Collect email (tell user: 'Please spell your email letter by letter. For at the rate say at, for dot say dot.) -> call customer_lookup -> ask phone -> call verify_phone -> collect issue -> create_ticket

ACCOUNTS FLOW:
- Collect email (tell user: 'Please spell your email letter by letter. For at the rate say at, for dot say dot.') -> call customer_lookup -> ask phone -> call verify_phone -> resolve account query
- ACCOUNTS RESOLUTION PATHS:
  1. UPDATE PAYMENT DETAILS: Portal link + https://www.infinetbroadband.com.au/set-up-a-payment-method/
  2. PAY OUTSTANDING INVOICE: Portal link + https://www.infinetbroadband.com.au/manually-paying-an-invoice/
  3. CANNOT LOGIN TO PORTAL: Ask if they want email to support -> call send_portal_login_email
  4. PHONE PAYMENT: "Please call 1300 101 414 and the team will process it for you."
  5. PAYMENT EXTENSION: Collect paymentDate -> create_ticket
SERVICE LISTING RULE: When asked "what services are on my account?" or similar:
- List ONLY: service type, plan name, status
- Format: "You have [Internet/Voice/Recurring] - [plan name] - [active/inactive]"
- NO descriptions, benefits, upselling, or extra commentary
- Example: "You have internet - OptiComm 500/50Mbps - active, and a voice service - VoIP 50 - active."
- Stop after listing. Ask: "Is there anything specific you'd like help with today?"

RELOCATION FLOW:
- Collect email (tell user: 'Please spell your email letter by letter. For at the rate say at, for dot say dot. Example: j-o-h-n dot d-o-e at g-m-a-i-l dot c-o-m') -> call customer_lookup -> ask phone -> call verify_phone -> list services -> collect new address -> check availability -> show plans -> create_ticket

TOOL USAGE:
- extract_call_fields for all personal info.
- check_address_availability when address is collected.
- customer_lookup for existing customers - email lookup ONLY.
- verify_phone after email lookup succeeds and user provides phone number.

SALES DETAIL COLLECTION - ONE FIELD AT A TIME (ABSOLUTE RULE):
After the customer selects a plan AND the website check is done, collect details STRICTLY one field per turn:
  STEP 1 -> Ask for FIRST NAME only. "Could I start with your first name?"
  STEP 2 -> Ask for LAST NAME only. "And your last name?"
  STEP 3 -> Ask for PHONE only. "What's the best mobile number for you?"
  STEP 4 -> Ask for EMAIL only. you must take it on voice and ask it letter by letter.
  STEP 5 -> ALL fields collected? CALL create_ticket IMMEDIATELY. Do NOT say "you're all set" before calling the tool.

Do NOT batch questions. ONE field per message. Wait for the customer to answer before asking the next.
If [SYSTEM_CONTEXT] specifies which field to ask next, follow it EXACTLY.

- IMPORTANT: When calling create_ticket, ALWAYS include the selected plan (leadInterest) in the message body.

Knowledge base:
${KB}
Locations: ${LOCATIONS.map((l) => l.id + ": " + l.name).join(", ")}
`;

const extractFunction = {
  name: "extract_call_fields",
  description:
    "Extract fields: intent, issueSummary, preferredName, email, priority, callbackRequest, timeline, leadInterest, accountNumber, name, phone, address, terminationDate, connectionDate, serviceToTerminate, customerType, residentialPreference, networkPreference, paymentDate. Omit absent fields.",
  parameters: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["support", "sales", "general", "account"],
      },
      issueSummary: { type: "string" },
      preferredName: { type: "string" },
      email: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
      callbackRequest: { type: "boolean" },
      timeline: { type: "string" },
      leadInterest: { type: "string" },
      accountNumber: { type: "string" },
      name: { type: "string" },
      phone: { type: "string" },
      address: { type: "string" },
      terminationDate: { type: "string" },
      connectionDate: { type: "string" },
      serviceToTerminate: { type: "string" },
      customerType: { type: "string", enum: ["new", "existing"] },
      residentialPreference: {
        type: "string",
        enum: ["residential", "business"],
      },
      networkPreference: { type: "string", enum: ["NBN", "Opticomm"] },
      paymentDate: { type: "string" },
    },
    required: [],
  },
};

const getPlansTool = {
  name: "get_internet_plans",
  description:
    "Fetch the latest live internet tariff plans from Splynx. Use as fallback when check_address_availability is not applicable.",
  parameters: { type: "object", properties: {}, required: [] },
};

const checkAvailabilityTool = {
  name: "check_address_availability",
  description:
    "Check which plans are available at a customer's address. If networkPreference is 'OptiComm', returns hardcoded OptiComm plans immediately. If networkPreference is 'NBN', calls MARS API for NBN plans. If networkPreference is not provided, tries NBN via MARS first - if MARS errors, returns no data, or address is not orderable, automatically falls back to OptiComm hardcoded plans silently. Requires address; networkPreference and residentialPreference are optional.",
  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description:
          "Full address including street, suburb, state and postcode",
      },
      networkPreference: {
        type: "string",
        description:
          "Only pass this if user explicitly said they want 'NBN' or 'OptiComm'.",
      },
      residentialPreference: {
        type: "string",
        description: "Plan type: 'residential' or 'business'",
      },
    },
    required: ["address"],
  },
};

const customerLookupTool = {
  name: "customer_lookup",
  description:
    "Lookup customer by email ONLY (step 1 of verification). ONLY call this with email.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: {
        type: "string",
        description: "Email address to look up the customer account",
      },
    },
    required: [],
  },
};

const verifyPhoneTool = {
  name: "verify_phone",
  description:
    "Verify a customer's phone number against their registered number on file. Call this AFTER customer_lookup succeeds and the user has provided their phone number verbally.",
  parameters: {
    type: "object",
    properties: {
      phone: {
        type: "string",
        description: "The phone number provided by the customer",
      },
    },
    required: ["phone"],
  },
};

const createTicketTool = {
  name: "create_ticket",
  description: "Create ticket in Splynx.",
  parameters: {
    type: "object",
    properties: {
      customer_id: { type: "number" },
      reporter_type: {
        type: "string",
        enum: ["admin", "customer", "api", "incoming", "none"],
      },
      subject: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
      type_id: { type: "number" },
      group_id: { type: "number" },
      status_id: { type: "number" },
      message: {
        type: "object",
        properties: {
          message: { type: "string" },
          hide_for_customer: { type: "boolean" },
        },
      },
    },
    required: ["subject", "priority"],
  },
};

const getTicketTypesTool = {
  name: "get_ticket_types",
  description: "Fetch ticket types.",
  parameters: { type: "object", properties: {}, required: [] },
};
const getTicketGroupsTool = {
  name: "get_ticket_groups",
  description: "Fetch ticket groups.",
  parameters: { type: "object", properties: {}, required: [] },
};
const getTicketStatusesTool = {
  name: "get_ticket_statuses",
  description: "Fetch ticket statuses.",
  parameters: { type: "object", properties: {}, required: [] },
};

const sendPortalLoginEmailTool = {
  name: "send_portal_login_email",
  description:
    "Send email to support for customer unable to login to portal. No ticket created.",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Optional additional message from customer",
      },
    },
    required: [],
  },
};

const tools = [
  extractFunction,
  getPlansTool,
  checkAvailabilityTool,
  customerLookupTool,
  verifyPhoneTool,
  createTicketTool,
  sendPortalLoginEmailTool,
  getTicketTypesTool,
  getTicketGroupsTool,
  getTicketStatusesTool,
];

// ==================== HELPERS ====================
function mkSession(sessionId) {
  const id =
    sessionId || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session = {
    id,
    collected: {},
    messages: [{ role: "system", content: SYSTEM_PROMPT }],
    lastSeen: new Date().toISOString(),
    hasGreeted: false,
    networkShown: null,
  };
  sessions.set(id, session);
  return session;
}

function normalizeText(t) {
  return (t || "")
    .toString()
    .replace(/\u200B/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("61") && digits.length === 11) {
    digits = "0" + digits.slice(2);
  }
  if (digits.startsWith("610") && digits.length === 12) {
    digits = "0" + digits.slice(3);
  }
  return digits;
}

function mapOrdinalNetworkChoice(text) {
  const t = (text || "").toLowerCase().trim();
  if (/\bnbn\b/.test(t) || /\b(opti\s*comm|opticomm)\b/.test(t)) return null;
  if (
    /\b(first|1st|one|1|option\s*1|option\s*one|number\s*1|the\s*first)\b/.test(
      t,
    )
  )
    return "NBN";
  if (
    /\b(second|2nd|two|2|to|option\s*2|option\s*two|number\s*2|the\s*second)\b/.test(
      t,
    )
  )
    return "Opticomm";
  return null;
}

function safeParseJSON(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

function numbersToInt(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) {
    const v = obj[k];
    out[k] = typeof v === "number" ? Math.round(v) : v;
  }
  return out;
}

async function convertToWav(p) {
  const out = p + ".converted.wav";
  return new Promise((res, rej) => {
    ffmpeg(p)
      .outputOptions(["-ar 16000", "-ac 1", "-vn"])
      .toFormat("wav")
      .on("end", () => res(out))
      .on("error", rej)
      .save(out);
  });
}

function applyExtractionToSession(session, parsed) {
  const r = numbersToInt(parsed || {});
  const hadLeadInterest = !!session.collected.leadInterest;

  for (const [k, v] of Object.entries(r)) {
    if (v !== undefined && v !== null) session.collected[k] = v;
  }

  if (!hadLeadInterest && session.collected.leadInterest) {
    session.collected._websiteCheckRequired = true;
    if (session.collected._websiteCheckDone === undefined) {
      session.collected._websiteCheckDone = false;
    }
    console.log(
      `Plan selected: ${session.collected.leadInterest} - website check REQUIRED`,
    );
  }

  session.lastSeen = new Date().toISOString();
  sessions.set(session.id, session);
  return r;
}

function classifyInterruption(text) {
  const t = (text || "").trim().toLowerCase();
  if (!t || t.length < 2) return { isValid: false, isListeningCue: false };
  const listeningCues =
    /^(yeah|yes|yep|yup|mm|mmm|hmm|uh|uh huh|ok|okay|sure|right|gotcha|got it|i see|alright|cool)\.?$/;
  if (listeningCues.test(t)) return { isValid: false, isListeningCue: true };
  if (t.replace(/[^a-z]/g, "").length < 3)
    return { isValid: false, isListeningCue: false };
  const hasIntent =
    /\b(what|how|why|when|where|which|who|can|do|is|are|i want|i need|i have|i'd like|please|could you|would you|tell me|help|the|my|a |an )\b/.test(
      t,
    );
  if (hasIntent) return { isValid: true, isListeningCue: false };
  const wordCount = t.split(/\s+/).filter((w) => w.length > 1).length;
  if (wordCount >= 3) return { isValid: true, isListeningCue: false };
  return { isValid: false, isListeningCue: false };
}

async function fetchTariffs() {
  try {
    const data = await splynx.listInternetTariffs();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Failed to fetch internet tariffs from Splynx:", err.message);
    return [];
  }
}

// ==================== CUSTOMER LOOKUP ====================
async function customerLookup({ name, email, phone }) {
  const main_attributes = {};
  if (name) main_attributes.name = name;
  if (email) main_attributes.login = email;
  if (phone) main_attributes.phone = phone;
  const customers = await splynx.searchCustomers({ main_attributes });
  if (!customers || customers.length === 0)
    return { success: false, message: "No customer found" };
  if (customers.length > 1) return { success: true, multiple: true, customers };
  const customer = customers[0];
  let services = { internet: [], voice: [], recurring: [] };
  try {
    services.internet = (
      await splynx.getCustomerInternetServices(customer.id)
    ).filter((s) => s.status === "active");
    services.voice = (
      await splynx.getCustomerVoiceServices(customer.id)
    ).filter((s) => s.status === "active");
    services.recurring = (
      await splynx.getCustomerRecurringServices(customer.id)
    ).filter((s) => s.status === "active");
  } catch (e) {
    console.error("Failed to get services:", e);
  }
  return { success: true, customer, services };
}

function objectToUrlEncoded(obj, params = new URLSearchParams(), ns = "") {
  for (const p in obj) {
    if (!obj.hasOwnProperty(p)) continue;
    const fk = ns ? `${ns}[${p}]` : p;
    const v = obj[p];
    if (v === undefined || v === null) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      objectToUrlEncoded(v, params, fk);
    } else if (Array.isArray(v)) {
      v.forEach((i) => params.append(`${fk}[]`, i));
    } else {
      params.append(fk, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
    }
  }
  return params;
}

async function makeTTS(text) {
  if (!text?.trim()) return null;
  try {
    const r = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        text: text.trim(),
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.85,
          style: 0.0,
          use_speaker_boost: true,
        },
      },
      {
        headers: {
          Accept: "audio/mpeg",
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      },
    );
    return Buffer.from(r.data);
  } catch (e) {
    console.warn("TTS failed:", e?.message);
    return null;
  }
}

// ==================== CHECK ADDRESS AVAILABILITY ====================
async function checkAddressAvailability(args, session) {
  const { address, networkPreference, residentialPreference } = args;
  if (!address) return JSON.stringify({ error: "Address is required" });

  const netPref = (
    networkPreference ||
    session.collected?.networkPreference ||
    ""
  ).toLowerCase();
  const isOpticomm = netPref === "opticomm" || netPref === "opti comm";
  const isNBN = netPref === "nbn";
  const noPreference = !isOpticomm && !isNBN;

  const rawResPref =
    residentialPreference || session.collected?.residentialPreference;
  const resPref = rawResPref ? rawResPref.toLowerCase() : null;
  const isBusiness = resPref === "business";
  const hasExplicitPreference =
    resPref === "business" || resPref === "residential";

  const getOpticommResult = () => {
    let plans;
    let requiresResFilter;
    if (hasExplicitPreference) {
      plans = isBusiness ? OPTICOMM_BUSINESS_PLANS : OPTICOMM_RESIDENTIAL_PLANS;
      requiresResFilter = false;
    } else {
      plans = [...OPTICOMM_RESIDENTIAL_PLANS, ...OPTICOMM_BUSINESS_PLANS];
      requiresResFilter = true;
    }
    if (session) session.networkShown = "OptiComm";
    return {
      success: true,
      orderable: true,
      address,
      network: "OptiComm",
      primaryAccessTechnology: "OptiComm Fibre",
      serviceType: "opticomm",
      requiresInstall: false,
      requiresResidentialFilter: requiresResFilter,
      readinessDescription:
        "OptiComm Fibre is available at this address. Activation is typically within 1-2 business days for fully installed premises.",
      notes: [],
      availablePlans: plans.map((p) => ({
        title: p.title,
        price: p.intro_price,
        ongoing_price: p.ongoing_price,
        discount: p.discount,
        download: p.download,
        upload: p.upload,
        features: p.features,
        suitable_for: p.suitable_for,
        voice_description: p.voice_description,
        ...(p.note ? { note: p.note } : {}),
      })),
    };
  };

  if (isOpticomm) {
    return JSON.stringify(getOpticommResult());
  }

  try {
    let marsCandidates = [];
    try {
      marsCandidates = await marsAddressSearch(address);
    } catch (marsSearchErr) {
      if (noPreference) {
        console.warn(
          `MARS address search failed, falling back to OptiComm:`,
          marsSearchErr.message,
        );
        return JSON.stringify(getOpticommResult());
      }
      throw marsSearchErr;
    }

    const locId = marsCandidates?.[0]?.id || null;

    let marsSq = null;
    if (locId) {
      try {
        marsSq = await marsServiceQualification(locId);
      } catch (marsSqErr) {
        if (noPreference) {
          console.warn(
            `MARS SQ failed, falling back to OptiComm:`,
            marsSqErr.message,
          );
          return JSON.stringify(getOpticommResult());
        }
        marsSq = null;
      }
    }

    if (!locId && noPreference) {
      return JSON.stringify(getOpticommResult());
    }

    const serviceabilityStatus =
      marsSq?.siteRestriction?.serviceabilityStatus || null;
    const serviceabilityClass =
      marsSq?.siteRestriction?.supportingTechnology?.serviceabilityClass ||
      null;
    const primaryAccessTechnology =
      marsSq?.siteRestriction?.supportingTechnology?.primaryAccessTechnology ||
      null;
    const serviceType = marsSq?.serviceType || null;
    const virtutelSpeeds = marsSq?.virtutelSpeedsAvailable || [];
    const marsNotes = marsSq?.siteRestriction?.notes || [];
    const serviceabilityClassReason =
      marsSq?.siteRestriction?.supportingTechnology
        ?.serviceabilityClassReason || null;

    if (serviceabilityStatus === "Rejected") {
      if (isNBN) {
        const reason =
          serviceabilityClassReason ||
          "This address is planned to be serviced in the future but is not yet orderable.";
        return JSON.stringify({
          success: true,
          orderable: false,
          address,
          locationId: locId,
          serviceabilityStatus,
          serviceabilityClass,
          primaryAccessTechnology,
          serviceType,
          message: reason,
          availablePlans: [],
          mars: {
            candidates: marsCandidates,
            virtutelSpeedsAvailable: virtutelSpeeds,
            serviceType,
            supportingTechnology:
              marsSq?.siteRestriction?.supportingTechnology || null,
          },
        });
      }
      return JSON.stringify(getOpticommResult());
    }

    let allTariffs = [];
    try {
      allTariffs = await fetchTariffs();
    } catch (tariffErr) {
      if (noPreference) {
        return JSON.stringify(getOpticommResult());
      }
      throw tariffErr;
    }

    const needsInstall = requiresInstallVisit(serviceabilityClass);
    const readinessDescription = getServiceabilityDescription(
      primaryAccessTechnology,
      serviceabilityClass,
      serviceabilityStatus,
    );
    const techLower = (primaryAccessTechnology || "").toLowerCase();
    const svcTypeLower = (serviceType || "").toLowerCase();

    let plansToReturn = [];
    let networkName = "NBN";
    let techCategory = "";
    let requiresResFilter = false;

    if (
      address.toLowerCase().includes("hope island") ||
      locId?.includes("HIR")
    ) {
      techCategory = "HIR";
      networkName = "HIR";
      if (hasExplicitPreference) {
        plansToReturn = isBusiness ? HIR_BUSINESS_PLANS : HIR_RESIDENTIAL_PLANS;
        requiresResFilter = false;
      } else {
        plansToReturn = [...HIR_RESIDENTIAL_PLANS, ...HIR_BUSINESS_PLANS];
        requiresResFilter = true;
      }
    } else if (svcTypeLower === "nsas" || techLower === "satellite") {
      techCategory = "SkyMuster";
      networkName = "NBN SkyMuster";
      plansToReturn = NBN_SKYMUSTER_PLANS;
      requiresResFilter = false;
    } else if (
      svcTypeLower === "nwas" ||
      techLower === "wireless" ||
      techLower === "fixed wireless"
    ) {
      techCategory = "FixedWireless";
      networkName = "NBN Fixed Wireless";
      plansToReturn = NBN_FIXED_WIRELESS_PLANS;
      requiresResFilter = false;
    } else if (svcTypeLower === "nfas" || svcTypeLower.startsWith("nf")) {
      techCategory = "NBNFibre";
      networkName = "NBN";
      const isFttnFttbFttc =
        techLower.includes("fibre to the node") ||
        techLower.includes("fibre to the building") ||
        techLower.includes("fibre to the curb") ||
        techLower.includes("fttn") ||
        techLower.includes("fttb") ||
        techLower.includes("fttc");
      if (isFttnFttbFttc) {
        techCategory = "NBN_FTTN";
        if (hasExplicitPreference) {
          const nbnPlans = isBusiness
            ? NBN_BUSINESS_PLANS
            : NBN_RESIDENTIAL_PLANS;
          plansToReturn = nbnPlans.filter((p) => parseInt(p.download) <= 100);
          requiresResFilter = false;
        } else {
          const residentialPlans = NBN_RESIDENTIAL_PLANS.filter(
            (p) => parseInt(p.download) <= 100,
          );
          const businessPlans = NBN_BUSINESS_PLANS.filter(
            (p) => parseInt(p.download) <= 100,
          );
          plansToReturn = [...residentialPlans, ...businessPlans];
          requiresResFilter = true;
        }
      } else {
        if (hasExplicitPreference) {
          const nbnPlans = isBusiness
            ? NBN_BUSINESS_PLANS
            : NBN_RESIDENTIAL_PLANS;
          if (virtutelSpeeds.length > 0) {
            const availableSpeeds = new Set();
            for (const code of virtutelSpeeds) {
              const mapped = MARS_SPEED_MAP[code];
              if (mapped) availableSpeeds.add(`${mapped.dl}/${mapped.ul}`);
            }
            plansToReturn = nbnPlans.filter((p) =>
              availableSpeeds.has(
                `${parseInt(p.download)}/${parseInt(p.upload)}`,
              ),
            );
          } else {
            plansToReturn = nbnPlans;
          }
          requiresResFilter = false;
        } else {
          let residentialPlans = [...NBN_RESIDENTIAL_PLANS];
          let businessPlans = [...NBN_BUSINESS_PLANS];
          if (virtutelSpeeds.length > 0) {
            const availableSpeeds = new Set();
            for (const code of virtutelSpeeds) {
              const mapped = MARS_SPEED_MAP[code];
              if (mapped) availableSpeeds.add(`${mapped.dl}/${mapped.ul}`);
            }
            residentialPlans = residentialPlans.filter((p) =>
              availableSpeeds.has(
                `${parseInt(p.download)}/${parseInt(p.upload)}`,
              ),
            );
            businessPlans = businessPlans.filter((p) =>
              availableSpeeds.has(
                `${parseInt(p.download)}/${parseInt(p.upload)}`,
              ),
            );
          }
          plansToReturn = [...residentialPlans, ...businessPlans];
          requiresResFilter = true;
        }
      }
    } else {
      techCategory = "NBN_Other";
      networkName = "NBN";
      plansToReturn = filterTariffsByMarsAvailability(
        allTariffs,
        virtutelSpeeds,
        serviceType,
      );
      requiresResFilter = true;
    }

    if (plansToReturn.length === 0 && noPreference) {
      return JSON.stringify(getOpticommResult());
    }

    if (session) session.networkShown = networkName;

    const formattedPlans = plansToReturn.map((p) => ({
      title: p.title,
      price: p.intro_price || p.price,
      ongoing_price: p.ongoing_price || p.price,
      voice_description: p.voice_description,
      discount: p.discount || null,
      download: p.download,
      upload: p.upload,
      features: p.features || [],
      suitable_for: p.suitable_for || [],
      note: p.note || null,
    }));

    return JSON.stringify({
      success: true,
      orderable: true,
      address,
      locationId: locId,
      serviceabilityStatus,
      serviceabilityClass,
      primaryAccessTechnology,
      serviceType,
      requiresInstall: needsInstall,
      requiresResidentialFilter: requiresResFilter,
      readinessDescription,
      notes: marsNotes,
      technologyCategory: techCategory,
      network: networkName,
      availablePlans: formattedPlans,
      mars: {
        candidates: marsCandidates,
        virtutelSpeedsAvailable: virtutelSpeeds,
        serviceType,
        supportingTechnology:
          marsSq?.siteRestriction?.supportingTechnology || null,
      },
    });
  } catch (err) {
    if (noPreference) {
      console.warn(
        `NBN lookup catch-all at ${address}, falling back to OptiComm:`,
        err.message,
      );
      return JSON.stringify(getOpticommResult());
    }
    return JSON.stringify({ success: false, error: err.message, address });
  }
}

// ==================== TOOL HANDLER ====================
async function handleToolCall(session, funcName, args) {
  if (funcName === "extract_call_fields") {
    applyExtractionToSession(session, args);
    return JSON.stringify({ success: true });
  }

  if (funcName === "customer_lookup") {
    try {
      const lookupArgs = { ...(args || {}) };
      delete lookupArgs.phone;
      if (!lookupArgs.email && !lookupArgs.name) {
        return JSON.stringify({
          success: false,
          message: "Email is required for customer lookup",
        });
      }
      const result = await customerLookup(lookupArgs);
      if (result.success && result.customer) {
        session.collected._emailVerifiedCustomerId = result.customer.id;
        session.collected._registeredPhone =
          result.customer.phone || result.customer.phone_mobile || null;
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
          delete safeResult.customer.cell;
          delete safeResult.customer.telephone;
        }
        return JSON.stringify(safeResult);
      }
      return JSON.stringify(result);
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  if (funcName === "verify_phone") {
    try {
      const emailCustomerId = session.collected._emailVerifiedCustomerId;
      if (!emailCustomerId) {
        return JSON.stringify({
          success: false,
          verificationFailed: true,
          message: "Email verification must be completed first.",
        });
      }
      const userProvidedPhone = session.collected.phone || args?.phone;
      if (!userProvidedPhone) {
        return JSON.stringify({
          success: false,
          verificationFailed: true,
          message: "No phone number provided.",
        });
      }
      const registeredPhone = session.collected._registeredPhone;
      if (!registeredPhone) {
        return JSON.stringify({
          success: false,
          verificationFailed: true,
          message:
            "No phone number is registered on this account. Please contact support via email.",
        });
      }
      const normalizedInput = normalizePhone(userProvidedPhone);
      const normalizedRegistered = normalizePhone(registeredPhone);
      if (normalizedInput !== normalizedRegistered) {
        return JSON.stringify({
          success: false,
          verificationFailed: true,
          message:
            "Phone number does not match the registered number on this account.",
        });
      }
      session.collected._phoneVerified = true;
      sessions.set(session.id, session);
      return JSON.stringify({
        success: true,
        verified: true,
        customer_id: emailCustomerId,
        message: "Phone number verified successfully.",
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  if (funcName === "get_internet_plans") {
    try {
      const tariffs = await fetchTariffs();
      return JSON.stringify({
        success: true,
        plans: tariffs.map((t) => ({
          id: t.id,
          title: t.title,
          price: parseFloat(t.price),
          download: `${t.speed_download / 1000} Mbps`,
          upload: `${t.speed_upload / 1000} Mbps`,
          available_for_locations: t.available_for_locations || [],
        })),
      });
    } catch (err) {
      return JSON.stringify({ success: false, error: err.message });
    }
  }

  if (funcName === "check_address_availability") {
    if (args.address) session.collected.address = args.address;
    return await checkAddressAvailability(args, session);
  }

  if (funcName === "create_ticket") {
    let fa = { ...args };
    if (typeof fa.message === "string") fa.message = { message: fa.message };
    const collected = session.collected || {};
    const hasCustomerId = !!(fa.customer_id || collected.customer_id);
    const hasLeadInterest = !!collected.leadInterest;
    const hasPaymentExtension = !!(
      collected.paymentDate ||
      (fa.subject && fa.subject.toLowerCase().includes("payment extension"))
    );
    const isSupportTicket =
      (hasCustomerId && !hasLeadInterest) || hasPaymentExtension;

    const detailLines = [];
    if (collected.preferredName || collected.name)
      detailLines.push(`Name: ${collected.preferredName || collected.name}`);
    if (collected.email) detailLines.push(`Email: ${collected.email}`);
    if (collected.phone) detailLines.push(`Phone: ${collected.phone}`);
    if (collected.address) detailLines.push(`Address: ${collected.address}`);
    if (collected.networkPreference)
      detailLines.push(`Network: ${collected.networkPreference}`);
    if (collected.residentialPreference)
      detailLines.push(`Type: ${collected.residentialPreference}`);
    if (collected.leadInterest)
      detailLines.push(`Selected Plan: ${collected.leadInterest}`);
    if (collected.paymentDate)
      detailLines.push(
        `Customer requested payment extension until: ${collected.paymentDate}`,
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
        const emailResult = await sendTicketEmail(r.id, fa, collected, true);
        ticketResult = {
          success: true,
          ticket_id: r.id,
          email_sent: emailResult.sent,
          email_error: emailResult.reason || null,
        };
      } else {
        const emailResult = await sendTicketEmail(null, fa, collected, false);
        ticketResult = {
          success: true,
          message: "Sales inquiry submitted successfully",
          email_sent: emailResult.sent,
          email_error: emailResult.reason || null,
        };
      }
    } catch (err) {
      ticketResult = {
        success: false,
        error: err.message || "Failed to process request",
      };
    }
    ticketResult._ticketCompleted = true;
    ticketResult._isSalesTicket = !isSupportTicket;
    return JSON.stringify(ticketResult);
  }

  if (funcName === "send_portal_login_email") {
    const collected = session.collected || {};
    const detailLines = [];
    if (collected.preferredName || collected.name)
      detailLines.push(`Name: ${collected.preferredName || collected.name}`);
    if (collected.email) detailLines.push(`Email: ${collected.email}`);
    if (collected.phone) detailLines.push(`Phone: ${collected.phone}`);
    if (collected.customer_id)
      detailLines.push(`Customer ID: ${collected.customer_id}`);
    detailLines.push(
      "Issue: Customer unable to login to portal - please provide login credentials or reset access",
    );
    const detailsBlock = `\n\n--- Customer Details ---\n${detailLines.join("\n")}`;
    const messageBody = `${args.message || "Customer requested assistance with portal login"}${detailsBlock}`;
    const emailArgs = {
      subject: "Support - Portal Login Assistance",
      priority: "medium",
      message: { message: messageBody },
      customer_id: collected.customer_id || null,
    };
    try {
      const emailResult = await sendTicketEmail(
        null,
        emailArgs,
        collected,
        true,
      );
      return JSON.stringify({
        success: true,
        email_sent: emailResult.sent,
        email_error: emailResult.reason || null,
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err.message || "Failed to send email",
      });
    }
  }

  if (funcName === "get_ticket_types")
    return JSON.stringify({
      success: true,
      types: await splynx.request("GET", "admin/support/tickets-types"),
    });
  if (funcName === "get_ticket_groups")
    return JSON.stringify({
      success: true,
      groups: await splynx.request("GET", "admin/support/tickets-groups"),
    });
  if (funcName === "get_ticket_statuses")
    return JSON.stringify({
      success: true,
      statuses: await splynx.request("GET", "admin/support/tickets-statuses"),
    });
  return JSON.stringify({ error: `Unknown tool: ${funcName}` });
}

// ==================== PROCESS WITH TOOLS ====================
async function processWithTools(session) {
  const comp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: session.messages,
    functions: tools,
    function_call: "auto",
    temperature: 0.0,
    max_tokens: 600,
  });
  const msg = comp.choices?.[0]?.message;
  if (msg?.function_call) {
    const fn = msg.function_call.name;
    const args = safeParseJSON(msg.function_call.arguments) || {};
    session.messages.push(msg);
    let toolContent;
    try {
      toolContent = await handleToolCall(session, fn, args);
    } catch (e) {
      toolContent = JSON.stringify({ success: false, error: e.message });
    }
    session.messages.push({ role: "function", name: fn, content: toolContent });

    const contextHint = `Current collected fields: ${JSON.stringify(session.collected || {})}.`;
    const finalMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...session.messages,
      { role: "system", content: contextHint },
    ];

    const finalResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: finalMessages,
      temperature: 0.0,
      max_tokens: 700,
    });
    const text =
      finalResp.choices?.[0]?.message?.content?.trim() ||
      "Thanks - I have your details.";
    session.messages.push({ role: "assistant", content: text });
    return text;
  } else if (msg?.content) {
    session.messages.push({ role: "assistant", content: msg.content });
    return msg.content;
  }
  return "I'm here to help. Could you repeat that?";
}

// ==================== ENDPOINTS ====================
app.post("/api/voice-chat/init", async (req, res) => {
  try {
    const session = mkSession();
    const greeting =
      "Welcome to InfiNET Broadband! Are you a new customer looking to get connected with us, or are you already part of the InfiNET family?";
    session.messages.push({ role: "assistant", content: greeting });
    sessions.set(session.id, session);
    const ttsBuf = await makeTTS(greeting);
    return res.json({
      sessionId: session.id,
      text: greeting,
      audioBase64: ttsBuf ? ttsBuf.toString("base64") : null,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message });
  }
});

app.post("/api/voice", upload.single("audio"), async (req, res) => {
  const sid =
    req.body?.sessionId ||
    req.query.sessionId ||
    req.headers["x-session-id"] ||
    null;
  if (!req.file) return res.status(400).json({ error: "Missing audio" });
  const up = path.resolve(req.file.path);
  let cp = null;
  try {
    const session =
      sid && sessions.has(sid) ? sessions.get(sid) : mkSession(sid);
    const orig = (req.file.originalname || "").toLowerCase();
    const mime = (req.file.mimetype || "").toLowerCase();
    const isWav =
      orig.endsWith(".wav") || mime === "audio/wav" || mime === "audio/wave";
    cp = isWav ? up : await convertToWav(up);
    const tr = await openai.audio.transcriptions.create({
      file: fs.createReadStream(cp),
      model: "whisper-1",
    });
    let userText = normalizeText(tr?.text || "");

    const lastAssistantMsg = [...session.messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (lastAssistantMsg && userText) {
      const { isValid, isListeningCue } = classifyInterruption(userText);
      if (isListeningCue) {
        const repeatMsg = "Sorry, I didn't catch that - please go ahead.";
        return res.json({
          sessionId: session.id,
          text: repeatMsg,
          audioBase64: (await makeTTS(repeatMsg))?.toString("base64") || null,
          userText,
        });
      }
      if (!isValid && userText.split(/\s+/).length < 3) {
        const repeatPrefix =
          "Oh sorry, I think there might have been a little hiccup - let me just repeat that. ";
        const repeatText = repeatPrefix + lastAssistantMsg.content;
        return res.json({
          sessionId: session.id,
          text: repeatText,
          audioBase64: (await makeTTS(repeatText))?.toString("base64") || null,
          userText,
        });
      }
    }

    const mapped = mapOrdinalNetworkChoice(userText);
    if (mapped) userText = mapped;
    if (!userText) {
      const p = "Sorry, I didn't catch that - could you please repeat?";
      return res.json({
        sessionId: session.id,
        text: p,
        audioBase64: (await makeTTS(p))?.toString("base64") || null,
        userText: null,
      });
    }
    session.messages.push({ role: "user", content: userText });
    const assistantText = await processWithTools(session);
    const ttsBuf = await makeTTS(assistantText);
    session.lastSeen = new Date().toISOString();
    sessions.set(session.id, session);
    return res.json({
      sessionId: session.id,
      text: assistantText,
      audioBase64: ttsBuf ? ttsBuf.toString("base64") : null,
      userText,
    });
  } catch (e) {
    console.error("voice error:", e);
    return res.status(500).json({ error: e?.message });
  } finally {
    try {
      if (up && fs.existsSync(up)) fs.unlinkSync(up);
    } catch (_) {}
    try {
      if (cp && cp !== up && fs.existsSync(cp)) fs.unlinkSync(cp);
    } catch (_) {}
  }
});

app.post("/api/voice/structured-input", async (req, res) => {
  try {
    const { sessionId, field, value } = req.body || {};
    if (!sessionId || !field || !value)
      return res.status(400).json({ error: "Missing params" });
    if (!["email", "phone"].includes(field))
      return res.status(400).json({ error: "Invalid field" });
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    session.collected[field] = value;
    const userMsg =
      field === "email"
        ? `My email is ${value}`
        : `My phone number is ${value}`;
    session.messages.push({ role: "user", content: userMsg });
    const assistantText = await processWithTools(session);
    const ttsBuf = await makeTTS(assistantText);
    session.lastSeen = new Date().toISOString();
    sessions.set(session.id, session);
    return res.json({
      sessionId: session.id,
      text: assistantText,
      audioBase64: ttsBuf ? ttsBuf.toString("base64") : null,
      userText: userMsg,
      collected: session.collected,
    });
  } catch (e) {
    console.error("structured-input error:", e);
    return res.status(500).json({ error: e?.message });
  }
});

app.get("/", (req, res) => {
  res.send(
    `<h1 style="text-align:center;margin-top:100px;font-family:sans-serif;color:#00bfff">✅ InfiNET AI Backend is running!</h1>`,
  );
});

// ==================== SERVER ====================
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e7,
});

setupRealtimeVoice(io, {
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
  classifyInterruption,
  OPTICOMM_RESIDENTIAL_PLANS,
  OPTICOMM_BUSINESS_PLANS,
  MARS_SPEED_MAP,
  filterTariffsByMarsAvailability,
  requiresInstallVisit,
  getServiceabilityDescription,
  marsAddressSearch,
  marsServiceQualification,
});

httpServer.listen(PORT, () => {
  console.log(`InfiNET Broadband AI Server running on port ${PORT}`);
  console.log(`Realtime API + ElevenLabs Ultra-low latency mode`);
  console.log(`Socket.IO ready for voice clients`);
});
