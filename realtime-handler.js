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
//     //  UNIFIED EMAIL STATE
//     // ═══════════════════════════════════════════════════════════════
//     const email_state = {
//       value: "",
//       is_confirmed: false,
//     };

//     function setEmailValue(newEmail) {
//       const prev = email_state.value;
//       email_state.value = newEmail;
//       email_state.is_confirmed = false;
//       console.log(
//         `[FLOW: ${session?.collected?.intent || "unknown"}][STEP: email_capture][STATUS: overwrite][DATA: prev="${prev}" next="${newEmail}" confirmed=false]`,
//       );
//     }

//     function confirmEmail() {
//       email_state.is_confirmed = true;
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

//     function debugState() {
//       const c = session.collected || {};
//       console.log(
//         `[DEBUG_STATE] fsm=${fsmState} salesStep=${salesStep} emailMode=${emailCaptureMode} ` +
//         `emailConfirmAsked=${emailCaptureConfirmAsked} emailValue="${email_state.value}" ` +
//         `emailConfirmed=${email_state.is_confirmed} ticketBlocked=${createTicketBlockedForEmail} ` +
//         `pendingFn=${pendingFunctionCalls} responseActive=${isResponseActive} ` +
//         `speaking=${assistantSpeaking} elStreaming=${elevenLabsStreaming} ` +
//         `intent=${c.intent || "none"} leadInterest=${c.leadInterest || "none"} ` +
//         `websiteCheckDone=${c._websiteCheckDone || false}`,
//       );
//     }

//     // ═══════════════════════════════════════════════════════════════
//     //  CENTRAL TIMER MANAGER
//     // ═══════════════════════════════════════════════════════════════
//     const TimerManager = (() => {
//       let _silenceTimer = null;
//       let _emailConfirmTimer = null;
//       let _finalMessageTimer = null;
//       let _watchdogTimer = null;

//       const SILENCE_NORMAL_MS = 15000;
//       const SILENCE_PACKAGE_MS = 20000;
//       const EMAIL_CONFIRM_MS = 30000;
//       const WATCHDOG_MS = 8000;

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
//         startSilence(isPackage = false) {
//           _clearSilence();
//           console.log(
//             `⏱️  [TMgr] startSilence called - isPackage=${isPackage}`,
//           );

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
//     // ═══════════════════════════════════════════════════════════════
//     let emailCaptureMode = false;
//     let emailCaptureBuffer = [];
//     let emailCaptureAttempt = 0;
//     const EMAIL_MAX_ATTEMPTS = 3;
//     let emailCaptureConfirmPending = null;
//     let emailCaptureConfirmAsked = false;

//     let createTicketBlockedForEmail = false;

//     function startEmailCapture() {
//       if (emailCaptureMode) {
//         console.log(
//           `[FLOW: sales][STEP: email_capture][STATUS: skipped][DATA: reason=already_active]`,
//         );
//         return;
//       }
//       console.log(
//         `[FLOW: sales][STEP: email_capture][STATUS: starting][DATA: attempt=1 maxAttempts=${EMAIL_MAX_ATTEMPTS}]`,
//       );
//       emailCaptureMode = true;
//       emailCaptureBuffer = [];
//       emailCaptureAttempt = 0;
//       emailCaptureConfirmPending = null;
//       emailCaptureConfirmAsked = false;
//       // FIX: Only reset email_state if it doesn't already have a valid value
//       // (LLM may have already extracted it via extract_call_fields)
//       if (!email_state.value) {
//         email_state.value = "";
//         email_state.is_confirmed = false;
//       }
//       createTicketBlockedForEmail = true;

//       TimerManager.clearSilence();
//       TimerManager.clearEmailConfirm();

//       transitionFSM(FSM_STATE.EMAIL_CAPTURE);
//       console.log(
//         `[FLOW: sales][STEP: email_capture][STATUS: active][DATA: buffer=[] blocked=true emailValue="${email_state.value}"]`,
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

//           setEmailValue(confirmedEmail);
//           confirmEmail();

//           console.log(
//             `[FLOW: sales][STEP: email_confirmed][STATUS: locked][DATA: email="${confirmedEmail}" is_confirmed=true createTicketBlocked=false]`,
//           );

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

//           emailCaptureBuffer = [];
//           email_state.value = "";
//           email_state.is_confirmed = false;
//           createTicketBlockedForEmail = true;
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
//         emailCaptureBuffer = [];
//         return true;
//       }

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
//                   text: `[SYSTEM_CONTEXT]: I parsed the customer's spoken email as: "${parsed}". Read this email address back clearly. MANDATORY FORMAT: spell the local part (before @) using individual letters separated by hyphens. Example: if local part is "shaun" say "s-h-a-u-n". Never say "double X" even for repeated letters — always say each letter separately (e.g. "l-l" not "double l"). Then say "at". Then say the domain with "dot" between parts. Full example for shaun@bele.ai: "I've got s-h-a-u-n at b-e-l-e dot a-i — is that correct?" Wait for yes or no only.`,
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
//           if (email_state.value && email_state.is_confirmed) {
//             console.log(
//               `[FLOW: sales][STEP: email][STATUS: already_confirmed][DATA: email="${email_state.value}" skipping=true]`,
//             );
//             advanceSalesStep("email");
//             return buildSalesStepHint();
//           }
//           if (emailCaptureMode) {
//             return `[FLOW: sales][STEP: email][STATUS: capture_active] Email capture is already in progress. Do NOT ask for email again. Wait for the customer to finish spelling their email. emailCaptureMode=true confirmAsked=${emailCaptureConfirmAsked}`;
//           }
//           return `[FLOW: sales][STEP: email][STATUS: pending] Ask for email: "Could I grab your email address? Please spell it letter by letter — for @ say 'at', for dots say 'dot'. Example: s-h-a-u-n at b-e-l-e dot a-i. Take your time." Then STOP and wait.`;

//         case "createTicket": {
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
//             console.log(
//               `🔊 [EL] TTS generation complete (isFinal) — waiting for client audio_done`,
//             );
//             elevenLabsStreaming = false;
//             // FIX: Do NOT clear assistantSpeaking here — wait for audio_done
//             // (was: assistantSpeaking = false; which is removed)
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
//             "\n\nEMAIL — ABSOLUTE RULES:" +
//             "\n1. Email is ALWAYS mutable. Any new email input DISCARDS the previous one completely." +
//             "\n2. After parsing, you MUST read back the EXACT parsed email (the local part before @) using ONLY individual letters separated by hyphens." +
//             "\n3. CRITICAL: Use the ACTUAL letters from the parsed email. If parsed email is aun@bele.ai, say 'a-u-n' NOT 's-h-a-u-n'. NEVER hallucinate different letters." +
//             "\n4. NEVER say 'double X' for repeated letters. Always say each letter separately: l-l not double-l." +
//             "\n5. If user corrects ANY part, reconstruct the ENTIRE email from scratch. Never partial-edit." +
//             "\n6. Only call any tool with email AFTER the user explicitly says YES to the readback." +
//             "\n\nEMAIL COLLECTION — VOICE ONLY: Collect email by voice spelling only. Do NOT mention any text input box. Do NOT say 'you can also type it'. Voice spelling is the ONLY method." +
//             "\n\nEMAIL DUPLICATE PREVENTION: If [SYSTEM_CONTEXT] shows emailCaptureMode=true or email_state.value is already set, do NOT ask for email again." +
//             "\n\nCREATE_TICKET RULE: NEVER call create_ticket if createTicketBlockedForEmail=true in [SYSTEM_CONTEXT]. Only call it when email_state.is_confirmed=true is explicitly shown." +
//             "\n\nFIELD EXTRACTION RULE: Before calling create_ticket, you MUST first call extract_call_fields to save any name, phone, or other details the customer just provided. create_ticket does NOT save fields automatically — extract_call_fields must be called first." +
//             "\n\nWEBSITE CHECK RULE: In sales flow, ALWAYS ask 'have you had a chance to check out our website and seen the plans or pricing?' AFTER plan is selected and BEFORE collecting any personal details (name/phone/email). Never skip this step." +
//             "\n\nCUSTOMER_LOOKUP RULE: NEVER call customer_lookup for a new sales lead. customer_lookup is ONLY for existing customers in support/accounts/relocation flows. If the customer is new (has leadInterest, no customer_id), proceed directly to collect name/phone/email and then call create_ticket." +
//             "\n\nEMAIL SPELLING INSTRUCTIONS (ALL FLOWS): When asking for email, say: 'Please spell your email address letter by letter. For the @ symbol, say 'at'. For dots, say 'dot'. For example: s-h-a-u-n at b-e-l-e dot a-i.' Always read back the email using the same format to confirm.";

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

//           TimerManager.clearWatchdog();

//           const looksLikeEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(cleaned);
//           const digitCount = (cleaned.match(/\d/g) || []).length;
//           const looksLikePhone = digitCount >= 6;

//           const isPurePhoneNumber = looksLikePhone && !looksLikeEmail && !looksLikeVoiceEmailSpelling(cleaned);

//           const isEmailConfirmResponse =
//             emailCaptureMode && emailCaptureConfirmAsked;
//           const isEmailSpelling =
//             emailCaptureMode &&
//             !emailCaptureConfirmAsked &&
//             looksLikeVoiceEmailSpelling(cleaned);

//           // ═══════════════════════════════════════════════════════════
//           // FIX (CRITICAL — Root Cause #1 & #2):
//           //
//           // The original guard `if (assistantSpeaking && ...)` was dropping
//           // ALL transcripts that arrived while assistantSpeaking=true.
//           //
//           // The problem: OpenAI's VAD detects user speech, commits the audio
//           // buffer, and sends the transcript via this event. But the transcript
//           // often arrives AFTER response.done but BEFORE the client emits
//           // audio_done (which is the only place assistantSpeaking was reset
//           // to false in the original code).
//           //
//           // This means: user says "I am a new customer" → VAD commits it →
//           // transcript arrives → but assistantSpeaking is still true from the
//           // greeting → transcript DROPPED → flow stalls.
//           //
//           // The fix: If the transcript arrived via OpenAI's committed audio
//           // (speech_started → speech_stopped → committed → transcription),
//           // it is ALWAYS a legitimate user turn. OpenAI's VAD already validated
//           // it. We should NEVER drop it.
//           //
//           // We keep the guard ONLY for cases where we truly want to suppress:
//           // - Tool execution in progress
//           // - Final message lock active
//           //
//           // The `assistantSpeaking` guard is REMOVED for transcripts because
//           // the speech_started handler already cancels the response and
//           // interrupts ElevenLabs. By the time the transcript arrives, the
//           // user has already taken the floor.
//           // ═══════════════════════════════════════════════════════════
//           if (pendingFunctionCalls > 0 || finalMessageLock || session.finalLock) {
//             console.log(
//               `🔇 Ignoring transcript (locked: pendingFn=${pendingFunctionCalls} finalLock=${finalMessageLock})`,
//             );
//             break;
//           }

//           // FIX: Since we no longer drop transcripts during assistantSpeaking,
//           // we need to ensure assistantSpeaking is cleared when processing
//           // a legitimate user transcript (the user has taken the floor).
//           if (assistantSpeaking) {
//             console.log(`🔄 [FIX] User transcript received while assistantSpeaking=true — clearing assistantSpeaking (user took the floor)`);
//             assistantSpeaking = false;
//           }

//           if (isEmailSpelling) {
//             console.log(
//               `[FLOW: sales][STEP: email_capture][STATUS: allowing_through][DATA: input="${cleaned}"]`,
//             );
//           }

//           if (isEmailConfirmResponse) {
//             console.log(
//               `[FLOW: sales][STEP: email_confirmation][STATUS: processing][DATA: input="${cleaned}"]`,
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
//           TimerManager.clearWatchdog();
//           console.log(`🔊 [FSM] speech_end`);
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

//           // ═══════════════════════════════════════════════════════════
//           // FIX (Root Cause #2 — assistantSpeaking lifecycle):
//           //
//           // When response.done fires and there are NO pending function
//           // calls and we have text output, the AI has finished generating.
//           // If ElevenLabs is NOT streaming (no audio to play), we should
//           // clear assistantSpeaking immediately. Otherwise the next
//           // transcript will be dropped.
//           //
//           // For cases where ElevenLabs IS streaming, audio_done will
//           // handle clearing assistantSpeaking.
//           // ═══════════════════════════════════════════════════════════
//           if (!hasFunctionCall && pendingFunctionCalls === 0 && !elevenLabsStreaming) {
//             assistantSpeaking = false;
//             console.log(`🔄 [FIX] response.done: No EL streaming, cleared assistantSpeaking`);
//           }

//           if (
//             !hasFunctionCall &&
//             !hasTextOutput &&
//             pendingFunctionCalls === 0 &&
//             !finalMessageLock
//           ) {
//             if (cancelPending) {
//               console.log(`✅ response.done (cancelled) — no retry`);
//               cancelPending = false;
//               assistantSpeaking = false; // FIX: Clear on cancel too
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
//               // FIX: Clear assistantSpeaking before retry so transcripts aren't dropped
//               assistantSpeaking = false;
//               scheduleResponseCreate(null, retryDelay, true);
//             } else {
//               console.warn(
//                 `⚠️ Max retries (${MAX_EMPTY_RETRIES}) reached — stopping retry loop`,
//               );
//               emptyResponseCount = 0;
//               assistantSpeaking = false; // FIX: Clear on max retries
//               transitionFSM(FSM_STATE.LISTENING);
//               socket.emit("status", "listening");
//             }
//             break;
//           }

//           emptyResponseCount = 0;

//           if (pendingPostDoneCreate && pendingFunctionCalls === 0) {
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
//           assistantSpeaking = false; // FIX: Clear on error
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

//         if (parsedResult?._blocked && parsedResult?.reason === "sales_flow") {
//           console.log(
//             `[FLOW: sales][STEP: customer_lookup][STATUS: blocked_hint][DATA: reason=sales_flow]`,
//           );
//           systemHint += `\nTOOL RESULT: customer_lookup blocked — this is a new sales lead. Do NOT retry customer_lookup. Treat as a new customer. Collect name, phone, email one at a time, then call create_ticket.`;
//         } else if (parsedResult?._invalidEmail) {
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
//           systemHint += `\nTOOL RESULT: create_ticket BLOCKED — email not confirmed. salesStep is now "email". Ask for email NOW: "Could I grab your email address? Please spell it letter by letter — for @ say 'at', for dots say 'dot'. Example: s-h-a-u-n at b-e-l-e dot a-i." Do NOT call create_ticket again until email_state.is_confirmed=true.`;
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

//         if (
//           !isSupportTicket &&
//           (!collected.email || !email_state.is_confirmed)
//         ) {
//           console.warn(
//             `[FLOW: sales][STEP: create_ticket][STATUS: blocked][DATA: email="${collected.email}" is_confirmed=${email_state.is_confirmed} reason=email_not_confirmed]`,
//           );
//           salesStep = "email";
//           createTicketBlockedForEmail = true;
//           TimerManager.releaseFinalLock();
//           finalMessageLock = false;
//           session.finalLock = false;
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
//         setEmailValue(value);
//         confirmEmail();
//         if (salesStep === "email") advanceSalesStep("email");
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
import WebSocket from "ws";
// ═══════════════════════════════════════════════════════════════════════════
//  VOICE EMAIL CAPTURE — NATO PHONETIC PARSER + ASSEMBLER
// ═══════════════════════════════════════════════════════════════════════════
const NATO_MAP = {
  alpha: "a",
  alfa: "a",
  bravo: "b",
  charlie: "c",
  delta: "d",
  echo: "e",
  foxtrot: "f",
  golf: "g",
  hotel: "h",
  india: "i",
  juliet: "j",
  juliett: "j",
  kilo: "k",
  lima: "l",
  mike: "m",
  november: "n",
  oscar: "o",
  papa: "p",
  quebec: "q",
  romeo: "r",
  sierra: "s",
  tango: "t",
  uniform: "u",
  victor: "v",
  whiskey: "w",
  xray: "x",
  "x-ray": "x",
  yankee: "y",
  zulu: "z",
  ay: "a",
  bee: "b",
  see: "c",
  sea: "c",
  dee: "d",
  ee: "e",
  ef: "f",
  eff: "f",
  gee: "g",
  aitch: "h",
  haitch: "h",
  jay: "j",
  kay: "k",
  el: "l",
  em: "m",
  en: "n",
  oh: "o",
  pee: "p",
  cue: "q",
  queue: "q",
  are: "r",
  ar: "r",
  ess: "s",
  es: "s",
  tee: "t",
  you: "u",
  vee: "v",
  double: null,
  ex: "x",
  why: "y",
  wye: "y",
  zee: "z",
  zed: "z",
  zero: "0",
  one: "1",
  two: "2",
  to: "2",
  too: "2",
  three: "3",
  four: "4",
  for: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  at: "@",
  "at sign": "@",
  dot: ".",
  period: ".",
  full: null,
  stop: ".",
  dash: "-",
  hyphen: "-",
  minus: "-",
  underscore: "_",
  "under score": "_",
  plus: "+",
  hash: "#",
  hashtag: "#",
  pound: "#",
  com: "com",
  net: "net",
  org: "org",
  edu: "edu",
  gov: "gov",
  io: "io",
  co: "co",
  au: "au",
  uk: "uk",
  us: "us",
  ca: "ca",
  nz: "nz",
};

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

function parseVoiceEmail(transcript) {
  if (!transcript) return null;
  let raw = transcript.toLowerCase().trim();

  const directEmail = raw.match(/\b([^\s@]+@[^\s@]+\.[^\s@]{2,})\b/);
  if (directEmail) return directEmail[1].toLowerCase();

  raw = raw
    .replace(/\bfull\s+stop\b/gi, " dot ")
    .replace(/\bat\s+sign\b/gi, " at ")
    .replace(/\bunder\s+score\b/gi, " underscore ")
    // "double u" → "w" but every other "double X" → "X X"
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
    /\bat\s+(gmail|yahoo|hotmail|outlook|icloud|bigpond|optusnet|tpg|live|proton)/.test(
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

    // Track whether plans were presented so audio_done uses correct timer
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
      console.log(
        `[FLOW: ${session?.collected?.intent || "unknown"}][STEP: email_capture][STATUS: overwrite][DATA: prev="${prev}" next="${newEmail}" confirmed=false]`,
      );
    }

    function confirmEmail() {
      email_state.is_confirmed = true;
      session.collected.email = email_state.value;
      sessions.set(session.id, session);
      console.log(
        `[FLOW: ${session?.collected?.intent || "unknown"}][STEP: email_confirmed][STATUS: success][DATA: email="${email_state.value}" is_confirmed=true session_synced=true]`,
      );
    }

    // ═══════════════════════════════════════════════════════════════
    //  FINITE STATE MACHINE
    // ═══════════════════════════════════════════════════════════════
    let fsmState = FSM_STATE.IDLE;

    function transitionFSM(newState) {
      const prev = fsmState;
      fsmState = newState;
      console.log(
        `[FLOW: ${session?.collected?.intent || "unknown"}][STEP: fsm_transition][STATUS: ok][DATA: from="${prev}" to="${newState}"]`,
      );
      socket.emit("fsm_state", newState);
    }

    function debugState() {
      const c = session.collected || {};
      console.log(
        `[DEBUG_STATE] fsm=${fsmState} salesStep=${salesStep} emailMode=${emailCaptureMode} ` +
        `emailConfirmAsked=${emailCaptureConfirmAsked} emailValue="${email_state.value}" ` +
        `emailConfirmed=${email_state.is_confirmed} ticketBlocked=${createTicketBlockedForEmail} ` +
        `pendingFn=${pendingFunctionCalls} responseActive=${isResponseActive} ` +
        `speaking=${assistantSpeaking} elStreaming=${elevenLabsStreaming} ` +
        `intent=${c.intent || "none"} leadInterest=${c.leadInterest || "none"} ` +
        `websiteCheckDone=${c._websiteCheckDone || false}`,
      );
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
          if (emailCaptureMode) {
            console.log(
              `⏱️  [TMgr] Silence timer suppressed (emailCaptureMode)`,
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
            if (emailCaptureMode) return;
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
              ? "[SILENCE_NUDGE] The user has not responded after you presented plans. Do NOT select a plan for them. Simply ask them gently which plan they'd like to go with."
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
            if (!emailCaptureMode || !emailCaptureConfirmAsked) return;
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
    //  EMAIL CAPTURE STATE
    // ═══════════════════════════════════════════════════════════════
    let emailCaptureMode = false;
    let emailCaptureBuffer = [];
    let emailCaptureAttempt = 0;
    const EMAIL_MAX_ATTEMPTS = 3;
    let emailCaptureConfirmPending = null;
    let emailCaptureConfirmAsked = false;

    let createTicketBlockedForEmail = false;

    function startEmailCapture() {
      if (emailCaptureMode) {
        console.log(
          `[FLOW: sales][STEP: email_capture][STATUS: skipped][DATA: reason=already_active]`,
        );
        return;
      }
      console.log(
        `[FLOW: sales][STEP: email_capture][STATUS: starting][DATA: attempt=1 maxAttempts=${EMAIL_MAX_ATTEMPTS}]`,
      );
      emailCaptureMode = true;
      emailCaptureBuffer = [];
      emailCaptureAttempt = 0;
      emailCaptureConfirmPending = null;
      emailCaptureConfirmAsked = false;
      // FIX: Only reset email_state if it doesn't already have a valid value
      // (LLM may have already extracted it via extract_call_fields)
      if (!email_state.value) {
        email_state.value = "";
        email_state.is_confirmed = false;
      }
      createTicketBlockedForEmail = true;

      TimerManager.clearSilence();
      TimerManager.clearEmailConfirm();

      transitionFSM(FSM_STATE.EMAIL_CAPTURE);
      console.log(
        `[FLOW: sales][STEP: email_capture][STATUS: active][DATA: buffer=[] blocked=true emailValue="${email_state.value}"]`,
      );
      socket.emit("email_spelling_mode", { active: true, attempt: 1 });
    }

    function resetEmailCapture() {
      emailCaptureMode = false;
      emailCaptureBuffer = [];
      emailCaptureConfirmPending = null;
      emailCaptureConfirmAsked = false;
      TimerManager.clearEmailConfirm();
      transitionFSM(FSM_STATE.LISTENING);
      socket.emit("email_spelling_mode", { active: false });
      console.log(
        `[FLOW: sales][STEP: email_capture][STATUS: reset][DATA: mode=false]`,
      );
    }

    function handleEmailCaptureTranscript(text) {
      if (!emailCaptureMode) {
        console.log(
          `[FLOW: sales][STEP: email_capture][STATUS: skipped][DATA: reason=not_in_capture_mode]`,
        );
        return false;
      }

      const cleaned = normalizeText(text);
      if (!cleaned) {
        console.log(
          `[FLOW: sales][STEP: email_capture][STATUS: skipped][DATA: reason=empty_transcript]`,
        );
        return true;
      }

      console.log(
        `[FLOW: sales][STEP: email_capture][STATUS: processing][DATA: attempt=${emailCaptureAttempt + 1} input="${cleaned}" bufferLen=${emailCaptureBuffer.length}]`,
      );
      console.log(
        `[FLOW: sales][STEP: email_capture][STATUS: debug][DATA: confirmPending=${emailCaptureConfirmPending} confirmAsked=${emailCaptureConfirmAsked}]`,
      );

      // ── Phase 2: Waiting for YES/NO confirmation ────────────────
      if (emailCaptureConfirmPending && emailCaptureConfirmAsked) {
        console.log(
          `[FLOW: sales][STEP: email_confirmation][STATUS: awaiting][DATA: email="${emailCaptureConfirmPending}" input="${cleaned}"]`,
        );
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

        if (isYes) {
          const confirmedEmail = emailCaptureConfirmPending;
          console.log(
            `[FLOW: sales][STEP: email_confirmation][STATUS: success][DATA: email="${confirmedEmail}" userSaid="yes"]`,
          );

          setEmailValue(confirmedEmail);
          confirmEmail();

          console.log(
            `[FLOW: sales][STEP: email_confirmed][STATUS: locked][DATA: email="${confirmedEmail}" is_confirmed=true createTicketBlocked=false]`,
          );

          createTicketBlockedForEmail = false;

          if (salesStep === "email") advanceSalesStep("email");

          const userMsg = `My email address is ${confirmedEmail}`;
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
            const salesHint = buildSalesStepHint() || "";
            const hint = `The customer has confirmed their email address as ${confirmedEmail}. email_state.is_confirmed=true. createTicketBlockedForEmail=false. ${salesHint} Proceed to the next step immediately. If all required details are collected (name, phone, email, plan), call create_ticket NOW.`;
            console.log(
              `[FLOW: sales][STEP: create_ticket_trigger][STATUS: pending][DATA: email="${confirmedEmail}" allReady=true]`,
            );
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
          return true;
        }

        if (isNo) {
          console.log(
            `[FLOW: sales][STEP: email_confirmation][STATUS: rejected][DATA: email="${emailCaptureConfirmPending}" userSaid="no"]`,
          );
          emailCaptureAttempt++;
          emailCaptureConfirmPending = null;
          emailCaptureConfirmAsked = false;

          emailCaptureBuffer = [];
          email_state.value = "";
          email_state.is_confirmed = false;
          createTicketBlockedForEmail = true;
          console.log(
            `[FLOW: sales][STEP: email_capture][STATUS: retry][DATA: attempt=${emailCaptureAttempt}/${EMAIL_MAX_ATTEMPTS} bufferCleared=true confirmed=false]`,
          );

          if (emailCaptureAttempt >= EMAIL_MAX_ATTEMPTS) {
            console.warn(
              `[FLOW: sales][STEP: email_capture][STATUS: max_retries][DATA: attempts=${EMAIL_MAX_ATTEMPTS}]`,
            );
            createTicketBlockedForEmail = false;
            resetEmailCapture();
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
                        text: `[SYSTEM_CONTEXT]: Email capture has failed after ${EMAIL_MAX_ATTEMPTS} attempts. Tell the customer you're having trouble capturing the email by voice and ask them to call 1300 101 414 or email support@infinetbroadband.com.au to complete their order. Be apologetic and warm.`,
                      },
                    ],
                  },
                }),
              );
              scheduleResponseCreate();
            }
            return true;
          }

          socket.emit("email_spelling_mode", {
            active: true,
            attempt: emailCaptureAttempt + 1,
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
                      text: `[SYSTEM_CONTEXT]: The customer said the email was wrong. This is attempt ${emailCaptureAttempt + 1} of ${EMAIL_MAX_ATTEMPTS}. Ask them to spell the COMPLETE email again from the beginning, one letter at a time. Remind them: for @ use 'at', for . use 'dot'. Spell each letter individually — never say "double X". Be patient and encouraging.`,
                    },
                  ],
                },
              }),
            );
            scheduleResponseCreate();
          }
          return true;
        }

        // Ambiguous — treat as re-spell
        console.log(
          `[FLOW: sales][STEP: email_confirmation][STATUS: ambiguous][DATA: input="${cleaned}" treating_as=re_spell]`,
        );
        emailCaptureConfirmPending = null;
        emailCaptureConfirmAsked = false;
        transitionFSM(FSM_STATE.EMAIL_CAPTURE);
        // Fall through to Phase 1
      }

      // ── Phase 1: Parse the spoken email ─────────────────────────
      const looksLikeDomainCorrection =
        /^www\.[a-z0-9_-]+\.(com|ai|co|net|org|au|io)/i.test(cleaned) ||
        (/^[a-z0-9_-]+\s+(dot|point)\s+(com|ai|co|net|org|au|io)/i.test(
          cleaned,
        ) &&
          !cleaned.includes("@"));

      if (looksLikeDomainCorrection && emailCaptureBuffer.length > 0) {
        console.log(
          `[FLOW: sales][STEP: email_capture][STATUS: domain_correction][DATA: bufferCleared=true]`,
        );
        emailCaptureBuffer = [];
        emailCaptureConfirmPending = null;
        emailCaptureConfirmAsked = false;
        email_state.value = "";
        email_state.is_confirmed = false;
        createTicketBlockedForEmail = true;
      }

      emailCaptureBuffer.push(cleaned);
      const combinedTranscript = emailCaptureBuffer.join(" ");
      console.log(
        `[FLOW: sales][STEP: email_capture][STATUS: parsing][DATA: combined="${combinedTranscript}" bufferLen=${emailCaptureBuffer.length}]`,
      );
      const parsed = parseVoiceEmail(combinedTranscript);
      console.log(
        `[FLOW: sales][STEP: email_capture][STATUS: parse_result][DATA: parsed="${parsed}" raw="${combinedTranscript}"]`,
      );

      if (!parsed) {
        console.log(
          `[FLOW: sales][STEP: email_capture][STATUS: parse_failed][DATA: combined="${combinedTranscript}"]`,
        );
        if (combinedTranscript.split(/\s+/).length < 3) {
          console.log(
            `[FLOW: sales][STEP: email_capture][STATUS: waiting][DATA: reason=buffer_too_short]`,
          );
          return true;
        }
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
                    text: `[SYSTEM_CONTEXT]: The customer is spelling their email but I couldn't parse it fully. Heard: "${combinedTranscript}". Ask them to repeat from the beginning, one letter at a time. For @ use 'at', for . use 'dot'. Be warm and patient.`,
                  },
                ],
              },
            }),
          );
          scheduleResponseCreate();
        }
        emailCaptureBuffer = [];
        return true;
      }

      setEmailValue(parsed);
      emailCaptureConfirmPending = parsed;
      emailCaptureConfirmAsked = true;

      console.log(
        `[FLOW: sales][STEP: email_capture][STATUS: parsed_ok][DATA: email="${parsed}" requesting_confirmation=true]`,
      );
      socket.emit("email_spelling_confirmation", { email: parsed });

      transitionFSM(FSM_STATE.EMAIL_CONFIRMATION);
      TimerManager.startEmailConfirm();

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
                  text: `[SYSTEM_CONTEXT]: I parsed the customer's spoken email as: "${parsed}". Read this email address back clearly. MANDATORY FORMAT: spell the local part (before @) using individual letters separated by hyphens. Example: if local part is "shaun" say "s-h-a-u-n". Never say "double X" even for repeated letters — always say each letter separately (e.g. "l-l" not "double l"). Then say "at". Then say the domain with "dot" between parts. Full example for shaun@bele.ai: "I've got s-h-a-u-n at b-e-l-e dot a-i — is that correct?" Wait for yes or no only.`,
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
      if (salesStep !== null) return;
      const c = session.collected || {};

      if (c.leadInterest && c._websiteCheckDone) {
        if (!c._firstName) salesStep = "firstName";
        else if (!c._lastName) salesStep = "lastName";
        else if (!c.phone) salesStep = "phone";
        else if (!c.email || !email_state.is_confirmed) salesStep = "email";
        else salesStep = "createTicket";
        console.log(
          `[FLOW: sales][STEP: init_step_machine][STATUS: ok][DATA: startStep="${salesStep}" websiteCheckDone=true]`,
        );
      } else {
        console.log(
          `[FLOW: sales][STEP: init_step_machine][STATUS: blocked][DATA: leadInterest=${!!c.leadInterest} websiteCheckDone=${!!c._websiteCheckDone}]`,
        );
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
      if (next === "email" && c.email && email_state.is_confirmed) {
        advanceSalesStep("email");
        return;
      }
      if (
        next === "createTicket" &&
        c._firstName &&
        c._lastName &&
        c.phone &&
        c.email &&
        email_state.is_confirmed
      ) {
        salesStep = "createTicket";
      } else {
        salesStep = next;
      }
      console.log(
        `[FLOW: sales][STEP: advance_step][STATUS: ok][DATA: from="${completedStep}" to="${salesStep}"]`,
      );
    }

    function buildSalesStepHint() {
      const c = session.collected || {};

      if (c.leadInterest && c._websiteCheckRequired && !c._websiteCheckDone) {
        if (!c._websiteCheckAsked) {
          console.log(
            `[FLOW: sales][STEP: website_check][STATUS: not_asked][DATA: websiteCheckRequired=true websiteCheckDone=false]`,
          );
          return `SALES STEP [website_check]: You MUST ask: "Just out of curiosity — have you had a chance to check out our website and seen the plans or pricing?" Do NOT proceed to collect name, phone, or email until this question is asked and answered. websiteCheckAsked=${c._websiteCheckAsked} websiteCheckDone=${c._websiteCheckDone}`;
        } else {
          console.log(
            `[FLOW: sales][STEP: website_check][STATUS: asked_awaiting_answer][DATA: websiteCheckAsked=true websiteCheckDone=false]`,
          );
          return `SALES STEP [website_check]: Website check already asked. Wait for customer answer. Do NOT proceed to name/phone/email yet. websiteCheckDone=${c._websiteCheckDone}`;
        }
      }

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
          return `[FLOW: sales][STEP: firstName][STATUS: pending] Ask ONLY for the customer's first name. Say something like "Could I start with your first name?" Say NOTHING else.`;

        case "lastName":
          return `[FLOW: sales][STEP: lastName][STATUS: pending] You have their first name (${c._firstName || "collected"}). Ask ONLY for their last name. Say something like "And your last name?"`;

        case "phone":
          return `[FLOW: sales][STEP: phone][STATUS: pending] You have their name (${name}). Ask ONLY for their mobile phone number. Say something like "What's the best mobile number for you?"`;

        case "email":
          if (email_state.value && email_state.is_confirmed) {
            console.log(
              `[FLOW: sales][STEP: email][STATUS: already_confirmed][DATA: email="${email_state.value}" skipping=true]`,
            );
            advanceSalesStep("email");
            return buildSalesStepHint();
          }
          if (emailCaptureMode) {
            return `[FLOW: sales][STEP: email][STATUS: capture_active] Email capture is already in progress. Do NOT ask for email again. Wait for the customer to finish spelling their email. emailCaptureMode=true confirmAsked=${emailCaptureConfirmAsked}`;
          }
          return `[FLOW: sales][STEP: email][STATUS: pending] Ask for email: "Could I grab your email address? Please spell it letter by letter — for @ say 'at', for dots say 'dot'. Example: s-h-a-u-n at b-e-l-e dot a-i. Take your time." Then STOP and wait.`;

        case "createTicket": {
          if (createTicketBlockedForEmail) {
            console.log(
              `[FLOW: sales][STEP: create_ticket][STATUS: blocked][DATA: reason=email_not_confirmed is_confirmed=${email_state.is_confirmed}]`,
            );
            return `[FLOW: sales][STEP: email][STATUS: capture_required] Email not yet confirmed. Do NOT call create_ticket. email_state.is_confirmed=${email_state.is_confirmed} createTicketBlockedForEmail=true. Ask for email NOW using VOICE SPELLING MODE.`;
          }

          const missing = [];
          if (!c._firstName && !c.name && !c.preferredName)
            missing.push("name");
          if (!c.phone) missing.push("phone");
          if (!c.email) missing.push("email");
          if (!c.leadInterest) missing.push("selected plan");

          if (missing.length > 0) {
            console.log(
              `[FLOW: sales][STEP: create_ticket][STATUS: missing_fields][DATA: missing=${JSON.stringify(missing)}]`,
            );
            if (!c.phone) salesStep = "phone";
            else if (!c.email) salesStep = "email";
            return buildSalesStepHint();
          }

          console.log(
            `[FLOW: sales][STEP: create_ticket][STATUS: ready][DATA: name="${c._firstName} ${c._lastName}" phone="${c.phone}" email="${c.email}" plan="${c.leadInterest}"]`,
          );
          return `[FLOW: sales][STEP: create_ticket][STATUS: execute] ALL required details collected:
- Name: ${c._firstName || ""} ${c._lastName || ""} / ${c.name || ""}
- Phone: ${c.phone}
- Email: ${c.email}
- Plan: ${c.leadInterest}
- Address: ${c.address || "provided earlier"}
- email_state.is_confirmed: true

STEP 1: Call extract_call_fields to save any recently collected details.
STEP 2: THEN call create_ticket IMMEDIATELY. Do NOT say anything to the user first. CALL THE TOOLS.`;
        }

        default:
          return null;
      }
    }

    // ─── Raw phone buffer ──────────────────────────────────────────
    let rawPhoneBuffer = null;
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
        console.log(`⏳ scheduleResponseCreate queued for post-done`);
        return;
      }

      if (responseCreatePending && !force) {
        console.log(`⏭️  scheduleResponseCreate skipped (pending already)`);
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
          console.log(
            `[FLOW: sales][STEP: firstName][STATUS: captured][DATA: firstName="${firstName}"]`,
          );
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
          console.log(
            `[FLOW: sales][STEP: lastName][STATUS: captured][DATA: lastName="${lastName}" fullName="${session.collected.name}"]`,
          );
          advanceSalesStep("lastName");
        }
      } else if (salesStep === "phone") {
        const digits = text.replace(/\D/g, "");
        if (digits.length >= 8) {
          session.collected.phone = digits;
          sessions.set(session.id, session);
          console.log(
            `[FLOW: sales][STEP: phone][STATUS: captured][DATA: phone="${digits}"]`,
          );
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
          elevenLabsStreaming = true;
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
          }

          const isFinal =
            msg.isFinal === true || msg.is_final === true || msg.final === true;

          if (isFinal) {
            console.log(
              `🔊 [EL] TTS generation complete (isFinal) — waiting for client audio_done`,
            );
            elevenLabsStreaming = false;
            // FIX: Do NOT clear assistantSpeaking here — wait for audio_done
            // (was: assistantSpeaking = false; which is removed)
            socket.emit("audio_stream_complete");

            if (emailCaptureMode && !emailCaptureConfirmAsked) {
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
            "\n\nEMAIL — ABSOLUTE RULES:" +
            "\n1. Email is ALWAYS mutable. Any new email input DISCARDS the previous one completely." +
            "\n2. After parsing, you MUST read back the EXACT parsed email (the local part before @) using ONLY individual letters separated by hyphens." +
            "\n3. CRITICAL: Use the ACTUAL letters from the parsed email. If parsed email is aun@bele.ai, say 'a-u-n' NOT 's-h-a-u-n'. NEVER hallucinate different letters." +
            "\n4. NEVER say 'double X' for repeated letters. Always say each letter separately: l-l not double-l." +
            "\n5. If user corrects ANY part, reconstruct the ENTIRE email from scratch. Never partial-edit." +
            "\n6. Only call any tool with email AFTER the user explicitly says YES to the readback." +
            "\n\nEMAIL COLLECTION — VOICE ONLY: Collect email by voice spelling only. Do NOT mention any text input box. Do NOT say 'you can also type it'. Voice spelling is the ONLY method." +
            "\n\nEMAIL DUPLICATE PREVENTION: If [SYSTEM_CONTEXT] shows emailCaptureMode=true or email_state.value is already set, do NOT ask for email again." +
            "\n\nCREATE_TICKET RULE: NEVER call create_ticket if createTicketBlockedForEmail=true in [SYSTEM_CONTEXT]. Only call it when email_state.is_confirmed=true is explicitly shown." +
            "\n\nFIELD EXTRACTION RULE: Before calling create_ticket, you MUST first call extract_call_fields to save any name, phone, or other details the customer just provided. create_ticket does NOT save fields automatically — extract_call_fields must be called first." +
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
          if (!emailCaptureConfirmAsked) {
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

          const isPurePhoneNumber = looksLikePhone && !looksLikeEmail && !looksLikeVoiceEmailSpelling(cleaned);

          const isEmailConfirmResponse =
            emailCaptureMode && emailCaptureConfirmAsked;
          const isEmailSpelling =
            emailCaptureMode &&
            !emailCaptureConfirmAsked &&
            looksLikeVoiceEmailSpelling(cleaned);

          // ═══════════════════════════════════════════════════════════
          // FIX (CRITICAL — Root Cause #1 & #2):
          //
          // The original guard `if (assistantSpeaking && ...)` was dropping
          // ALL transcripts that arrived while assistantSpeaking=true.
          //
          // The problem: OpenAI's VAD detects user speech, commits the audio
          // buffer, and sends the transcript via this event. But the transcript
          // often arrives AFTER response.done but BEFORE the client emits
          // audio_done (which is the only place assistantSpeaking was reset
          // to false in the original code).
          //
          // This means: user says "I am a new customer" → VAD commits it →
          // transcript arrives → but assistantSpeaking is still true from the
          // greeting → transcript DROPPED → flow stalls.
          //
          // The fix: If the transcript arrived via OpenAI's committed audio
          // (speech_started → speech_stopped → committed → transcription),
          // it is ALWAYS a legitimate user turn. OpenAI's VAD already validated
          // it. We should NEVER drop it.
          //
          // We keep the guard ONLY for cases where we truly want to suppress:
          // - Tool execution in progress
          // - Final message lock active
          //
          // The `assistantSpeaking` guard is REMOVED for transcripts because
          // the speech_started handler already cancels the response and
          // interrupts ElevenLabs. By the time the transcript arrives, the
          // user has already taken the floor.
          // ═══════════════════════════════════════════════════════════
          if (pendingFunctionCalls > 0 || finalMessageLock || session.finalLock) {
            console.log(
              `🔇 Ignoring transcript (locked: pendingFn=${pendingFunctionCalls} finalLock=${finalMessageLock})`,
            );
            break;
          }

          // FIX: Since we no longer drop transcripts during assistantSpeaking,
          // we need to ensure assistantSpeaking is cleared when processing
          // a legitimate user transcript (the user has taken the floor).
          if (assistantSpeaking) {
            console.log(`🔄 [FIX] User transcript received while assistantSpeaking=true — clearing assistantSpeaking (user took the floor)`);
            assistantSpeaking = false;
          }

          if (isEmailSpelling) {
            console.log(
              `[FLOW: sales][STEP: email_capture][STATUS: allowing_through][DATA: input="${cleaned}"]`,
            );
          }

          if (isEmailConfirmResponse) {
            console.log(
              `[FLOW: sales][STEP: email_confirmation][STATUS: processing][DATA: input="${cleaned}"]`,
            );
          }

          if (awaitingPhoneVerification && looksLikePhone) {
            const digits = cleaned.replace(/\D/g, "");
            if (digits.length >= 6) {
              rawPhoneBuffer = digits;
              console.log(
                `[FLOW: support][STEP: phone_verification][STATUS: buffered][DATA: phone="${rawPhoneBuffer}"]`,
              );
            }
          }

          console.log(
            `[FLOW: ${session?.collected?.intent || "unknown"}][STEP: transcript][STATUS: ok][DATA: emailMode=${emailCaptureMode} salesStep=${salesStep} looksEmail=${looksLikeEmail} looksSpelling=${looksLikeVoiceEmailSpelling(cleaned)} isPurePhone=${isPurePhoneNumber}]`,
          );

          if (
            !isPurePhoneNumber &&
            (emailCaptureMode ||
              (salesStep === "email" &&
                (looksLikeEmail || looksLikeVoiceEmailSpelling(cleaned))))
          ) {
            if (!emailCaptureMode) {
              startEmailCapture();
            }
            const consumed = handleEmailCaptureTranscript(cleaned);
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
              console.log(
                `[FLOW: sales][STEP: website_check][STATUS: answered][DATA: answer="${cleaned}" websiteCheckDone=true]`,
              );
              initSalesStepMachine();
            }
          }

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
          if (!(emailCaptureMode && emailCaptureConfirmAsked)) {
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
              console.log(
                `[FLOW: sales][STEP: plan_presentation][STATUS: detected][DATA: isPackage=true timer=20s]`,
              );
            }

            if (detectPhoneVerificationRequest(event.text)) {
              awaitingPhoneVerification = true;
              rawPhoneBuffer = null;
            }

            if (
              detectEmailSpellingRequest(event.text) &&
              salesStep === "email" &&
              !emailCaptureMode &&
              !emailCaptureConfirmPending &&
              !emailCaptureConfirmAsked
            ) {
              console.log(
                `[FLOW: sales][STEP: email_capture][STATUS: activating][DATA: reason=ai_asked_for_email_spelling]`,
              );
              startEmailCapture();
            }

            if (
              session.collected.leadInterest &&
              session.collected._websiteCheckRequired &&
              !session.collected._websiteCheckAsked &&
              detectWebsiteCheckQuestion(event.text)
            ) {
              session.collected._websiteCheckAsked = true;
              sessions.set(session.id, session);
              console.log(
                `[FLOW: sales][STEP: website_check][STATUS: asked][DATA: websiteCheckAsked=true]`,
              );
            }
          }
          break;

        case "response.done": {
          isResponseActive = false;
          TimerManager.clearWatchdog();
          console.log(`🔊 [FSM] speech_end`);
          debugState();

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

          // ═══════════════════════════════════════════════════════════
          // FIX (Root Cause #2 — assistantSpeaking lifecycle):
          //
          // When response.done fires and there are NO pending function
          // calls and we have text output, the AI has finished generating.
          // If ElevenLabs is NOT streaming (no audio to play), we should
          // clear assistantSpeaking immediately. Otherwise the next
          // transcript will be dropped.
          //
          // For cases where ElevenLabs IS streaming, audio_done will
          // handle clearing assistantSpeaking.
          // ═══════════════════════════════════════════════════════════
          if (!hasFunctionCall && pendingFunctionCalls === 0 && !elevenLabsStreaming) {
            assistantSpeaking = false;
            console.log(`🔄 [FIX] response.done: No EL streaming, cleared assistantSpeaking`);
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
              assistantSpeaking = false; // FIX: Clear on cancel too
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

            emptyResponseCount++;
            console.warn(
              `⚠️ EMPTY RESPONSE: attempt ${emptyResponseCount}/${MAX_EMPTY_RETRIES}`,
            );
            if (emptyResponseCount <= MAX_EMPTY_RETRIES) {
              const retryDelay = 150 * Math.pow(2, emptyResponseCount - 1);
              // FIX: Clear assistantSpeaking before retry so transcripts aren't dropped
              assistantSpeaking = false;
              scheduleResponseCreate(null, retryDelay, true);
            } else {
              console.warn(
                `⚠️ Max retries (${MAX_EMPTY_RETRIES}) reached — stopping retry loop`,
              );
              emptyResponseCount = 0;
              assistantSpeaking = false; // FIX: Clear on max retries
              transitionFSM(FSM_STATE.LISTENING);
              socket.emit("status", "listening");
            }
            break;
          }

          emptyResponseCount = 0;

          if (pendingPostDoneCreate && pendingFunctionCalls === 0) {
            if (createTicketBlockedForEmail) {
              console.log(
                `[FLOW: sales][STEP: response_done][STATUS: post_done_blocked][DATA: reason=email_not_confirmed createTicketBlockedForEmail=true]`,
              );
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
          assistantSpeaking = false; // FIX: Clear on error
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

      if (
        fn === "verify_phone" &&
        !session.collected._emailVerifiedCustomerId
      ) {
        console.log(
          `[FLOW: sales][STEP: verify_phone][STATUS: blocked][DATA: reason=sales_flow_no_customer_id]`,
        );
        const phoneToSave = args.phone || rawPhoneBuffer;
        rawPhoneBuffer = null;
        awaitingPhoneVerification = false;
        if (phoneToSave) {
          session.collected.phone =
            String(phoneToSave).replace(/\D/g, "") || phoneToSave;
          sessions.set(session.id, session);
          if (salesStep === "phone") advanceSalesStep("phone");
          console.log(
            `[FLOW: sales][STEP: phone][STATUS: saved][DATA: phone="${session.collected.phone}"]`,
          );
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

      if (fn === "verify_phone" && rawPhoneBuffer) {
        console.log(
          `[FLOW: support][STEP: verify_phone][STATUS: override][DATA: llmPhone="${args.phone}" bufferPhone="${rawPhoneBuffer}"]`,
        );
        args = { ...args, phone: rawPhoneBuffer };
        rawPhoneBuffer = null;
        awaitingPhoneVerification = false;
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
      )}. email_state: { value: "${email_state.value}", is_confirmed: ${email_state.is_confirmed} }. createTicketBlockedForEmail: ${createTicketBlockedForEmail}. emailCaptureMode: ${emailCaptureMode}.`;

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
          console.log(
            `[FLOW: sales][STEP: customer_lookup][STATUS: blocked_hint][DATA: reason=sales_flow]`,
          );
          systemHint += `\nTOOL RESULT: customer_lookup blocked — this is a new sales lead. Do NOT retry customer_lookup. Treat as a new customer. Collect name, phone, email one at a time, then call create_ticket.`;
        } else if (parsedResult?._invalidEmail) {
          console.log(
            `[FLOW: support][STEP: customer_lookup][STATUS: invalid_email_hint][DATA: email_parse_failed=true]`,
          );
          systemHint += `\nTOOL RESULT: Email format invalid — missing '@' symbol. Ask customer to spell email again: 'Please spell your email letter by letter, saying 'at' for @ and 'dot' for dots.'`;
        } else if (parsedResult?.success && parsedResult?.customer) {
          systemHint += `\nTOOL RESULT: Email lookup succeeded. Say "Perfect, I can see that account." Then ask for their phone number. When they give it, call verify_phone.`;
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
          systemHint += `\nTOOL RESULT: Phone verification FAILED. Tell customer: "That phone number doesn't match what we have on file. Could you double-check?" Do NOT proceed.`;
        } else if (parsedResult?.success && parsedResult?.verified) {
          awaitingPhoneVerification = false;
          rawPhoneBuffer = null;
          systemHint += `\nTOOL RESULT: Phone verification PASSED. Say "Perfect, thanks for confirming — your account's all verified now." then ask what they need help with.`;
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
          TimerManager.releaseFinalLock();
          salesStep = "email";
          createTicketBlockedForEmail = true;
          if (!emailCaptureMode && !emailCaptureConfirmAsked) {
            startEmailCapture();
          } else if (emailCaptureMode) {
            console.log(
              `[FLOW: sales][STEP: create_ticket][STATUS: handle_fn_capture_already_active][DATA: confirmAsked=${emailCaptureConfirmAsked}]`,
            );
          }
          console.log(
            `[FLOW: sales][STEP: create_ticket][STATUS: blocked][DATA: reason=email_not_confirmed salesStep_forced_to=email captureStarted=true]`,
          );
          systemHint += `\nTOOL RESULT: create_ticket BLOCKED — email not confirmed. salesStep is now "email". Ask for email NOW: "Could I grab your email address? Please spell it letter by letter — for @ say 'at', for dots say 'dot'. Example: s-h-a-u-n at b-e-l-e dot a-i." Do NOT call create_ticket again until email_state.is_confirmed=true.`;
        } else if (parsedResult?.success) {
          salesStep = "done";
          createTicketBlockedForEmail = false;
          TimerManager.releaseFinalLock();
          const ticketId = parsedResult.ticket_id;
          const isSales = parsedResult._isSalesTicket === true || !ticketId;
          console.log(
            `[FLOW: sales][STEP: create_ticket][STATUS: success][DATA: isSales=${isSales} ticketId=${ticketId}]`,
          );
          if (isSales) {
            systemHint += `\nTOOL RESULT: Sales enquiry submitted. Say: "Awesome, you're all set! I've submitted your enquiry and our sales team will be in touch via email shortly. Is there anything else you'd like to know?"`;
          } else {
            systemHint += `\nTOOL RESULT: Support ticket #${ticketId} created. Say: "Brilliant, all done! I've raised support ticket number ${ticketId} — you'll get details via email shortly. Is there anything else I can help with?"`;
          }
          transitionFSM(FSM_STATE.FINAL);
        } else {
          TimerManager.releaseFinalLock();
          console.log(
            `[FLOW: sales][STEP: create_ticket][STATUS: failed][DATA: error="${parsedResult?.error}"]`,
          );
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
          console.log(
            `[FLOW: sales][STEP: website_check][STATUS: gating][DATA: leadInterest="${c.leadInterest}" websiteCheckDone=false]`,
          );
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
          if (parsed) {
            console.log(
              `[FLOW: ${session.collected?.intent || "unknown"}][STEP: email_parse][STATUS: normalized][DATA: raw="${args.email}" parsed="${parsed}"]`,
            );
            args.email = parsed;
          } else {
            console.log(
              `[FLOW: ${session.collected?.intent || "unknown"}][STEP: email_parse][STATUS: failed][DATA: raw="${args.email}"]`,
            );
          }
        }
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
        if (salesStep === "phone" && args.phone) advanceSalesStep("phone");

        if (args.email) {
          setEmailValue(args.email);
          session.collected.email = args.email;
          sessions.set(session.id, session);
          console.log(
            `[FLOW: sales][STEP: email_capture][STATUS: extracted_by_llm][DATA: email="${args.email}"]`,
          );
          if (salesStep === "email") advanceSalesStep("email");
        }

        return JSON.stringify({ success: true });
      }

      if (fn === "customer_lookup") {
        const isSalesFlow =
          !!session.collected?.leadInterest &&
          !session.collected?._emailVerifiedCustomerId;
        if (isSalesFlow) {
          console.log(
            `[FLOW: sales][STEP: customer_lookup][STATUS: blocked][DATA: reason=sales_flow_new_lead leadInterest="${session.collected.leadInterest}"]`,
          );
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
            console.log(
              `[FLOW: support][STEP: customer_lookup][STATUS: email_normalized][DATA: raw="${lookupArgs.email}" parsed="${parsed}"]`,
            );
            lookupArgs.email = parsed;
          } else {
            console.log(
              `[FLOW: support][STEP: customer_lookup][STATUS: parse_failed][DATA: email="${lookupArgs.email}"]`,
            );
            return JSON.stringify({
              success: false,
              _invalidEmail: true,
              message:
                "Invalid email format — could not parse. Ask customer to spell email letter by letter, saying 'at' for @ and 'dot' for dots.",
            });
          }
        }

        console.log(
          `[FLOW: support][STEP: customer_lookup][STATUS: executing][DATA: email="${lookupArgs.email}"]`,
        );
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
              `[FLOW: support][STEP: customer_lookup][STATUS: found][DATA: customerId="${result.customer.id}"]`,
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
          delete session.collected.email;
          delete session.collected._emailVerifiedCustomerId;
          email_state.value = "";
          email_state.is_confirmed = false;
          sessions.set(session.id, session);
          console.log(
            `[FLOW: support][STEP: customer_lookup][STATUS: not_found][DATA: email="${lookupArgs.email}"]`,
          );
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
          console.log(
            `[FLOW: support][STEP: verify_phone][STATUS: failed][DATA: mismatch=true]`,
          );
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "Phone number does not match the registered number.",
          });
        }
        session.collected._phoneVerified = true;
        sessions.set(session.id, session);
        console.log(
          `[FLOW: support][STEP: verify_phone][STATUS: passed][DATA: customerId="${emailCustomerId}"]`,
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

        if (
          !isSupportTicket &&
          (!collected.email || !email_state.is_confirmed)
        ) {
          console.warn(
            `[FLOW: sales][STEP: create_ticket][STATUS: blocked][DATA: email="${collected.email}" is_confirmed=${email_state.is_confirmed} reason=email_not_confirmed]`,
          );
          salesStep = "email";
          createTicketBlockedForEmail = true;
          TimerManager.releaseFinalLock();
          finalMessageLock = false;
          session.finalLock = false;
          if (!emailCaptureMode && !emailCaptureConfirmAsked) {
            startEmailCapture();
          } else if (emailCaptureMode) {
            console.log(
              `[FLOW: sales][STEP: create_ticket][STATUS: capture_already_active][DATA: confirmAsked=${emailCaptureConfirmAsked}]`,
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
            console.log(
              `[FLOW: support][STEP: create_ticket][STATUS: creating][DATA: subject="${fa.subject}" customerId="${fa.customer_id}"]`,
            );
            const r = await splynx.request(
              "POST",
              "admin/support/tickets",
              objectToUrlEncoded(fa),
            );
            console.log(
              `[FLOW: support][STEP: create_ticket][STATUS: success][DATA: ticketId="${r.id}"]`,
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
            console.log(
              `[FLOW: sales][STEP: create_ticket][STATUS: sending_email][DATA: subject="${fa.subject}"]`,
            );
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
          console.error(
            `[FLOW: unknown][STEP: create_ticket][STATUS: error][DATA: error="${err.message}"]`,
          );
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
        console.log(
          `[FLOW: sales][STEP: email_capture][STATUS: structured_input][DATA: email="${value}"]`,
        );
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

      console.log(
        `[FLOW: unknown][STEP: structured_input][STATUS: ok][DATA: field="${field}" value="${value}"]`,
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
      console.log(
        `[FLOW: ${session?.collected?.intent || "unknown"}][STEP: disconnect][STATUS: cleanup][DATA: email="${email_state.value}" confirmed=${email_state.is_confirmed} collected=${JSON.stringify(session?.collected || {})}]`,
      );
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
        console.log(
          `[FLOW: init][STEP: connect][STATUS: pending][DATA: sessionId="${session.id}"]`,
        );
        await connectOpenAI();
        console.log(
          "✅ OpenAI connected! ElevenLabs pre-warmed. Waiting 200ms...",
        );
        socket.emit("connections_ready");
        await new Promise((r) => setTimeout(r, 200));

        if (!session.hasGreeted) {
          session.hasGreeted = true;
          console.log(
            `[FLOW: init][STEP: greeting][STATUS: sending][DATA: sessionId="${session.id}"]`,
          );
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