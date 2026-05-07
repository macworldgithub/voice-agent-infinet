// import WebSocket from "ws";

// // ═══════════════════════════════════════════════════════════════════════════
// //  DEBUG LOGGER — structured, timestamped, flow-aware
// // ═══════════════════════════════════════════════════════════════════════════
// function dbg(flow, step, status, data = {}) {
//   const ts = new Date().toISOString();
//   const dataParts = Object.entries(data)
//     .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
//     .join(" ");
//   console.log(
//     `[${ts}][FLOW:${flow}][STEP:${step}][STATUS:${status}] ${dataParts}`,
//   );
// }

// // ═══════════════════════════════════════════════════════════════════════════
// //  VOICE EMAIL CAPTURE — NATO PHONETIC PARSER + ASSEMBLER
// // ═══════════════════════════════════════════════════════════════════════════
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

// const NATO_MAP = {
//   zero: "0", one: "1", two: "2", three: "3", four: "4",
//   five: "5", six: "6", seven: "7", eight: "8", nine: "9",
//   niner: "9", dash: "-", hyphen: "-", underscore: "_", plus: "+",
// };

// function stripEmailFillers(text) {
//   if (!text) return text;
//   return (
//     text
//       .replace(
//         /\b(of\s+ai|for\s+example|for\s+instance|listen\s*,?|go\s+ahead|spelling\s+mode|letter\s+by\s+letter)\b/gi,
//         " ",
//       )
//       .replace(
//         /\b(okay|ok|my email(?: address| is)?|the email(?: address| is)?|email is|address is|it'?s|it is|so|well|right|sure|actually|basically|i think|i believe|let me|let's see|umm?|uh+|hmm?|ah+)\b/gi,
//         " ",
//       )
//       .replace(/\s{2,}/g, " ")
//       .trim()
//   );
// }

// function parseVoiceEmail(transcript) {
//   if (!transcript) return null;
//   let raw = transcript.toLowerCase().trim();

//   const directEmail = raw.match(/\b([^\s@]+@[^\s@]+\.[^\s@]{2,})\b/);
//   if (directEmail) return directEmail[1].toLowerCase();

//   // Expand hyphenated spelled-out letter sequences FIRST
//   raw = raw.replace(
//     /(?<![a-z0-9])([a-z])(?:-([a-z]))+(?![a-z0-9])/gi,
//     (match) => match.toLowerCase().split("-").join(" "),
//   );

//   raw = raw
//     .replace(/\bfull\s+stop\b/gi, " dot ")
//     .replace(/\bat\s+sign\b/gi, " at ")
//     .replace(/\bunder\s+score\b/gi, " underscore ")
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
//     if (tok === "at") { parts.push("@"); continue; }
//     if (tok === "dot" || tok === "period" || tok === "point") { parts.push("."); continue; }
//     if (/^[a-z0-9._@+-]+\.[a-z]{2,}$/.test(tok)) { parts.push(tok); continue; }
//     if (/^[a-z]$/.test(tok) || /^\d$/.test(tok)) { parts.push(tok); continue; }
//     if (/^\d{2,}$/.test(tok)) { parts.push(tok); continue; }
//     if (NATO_MAP.hasOwnProperty(tok)) {
//       const val = NATO_MAP[tok];
//       if (val !== null) parts.push(val);
//       continue;
//     }
//     if (/^[a-z]{2,6}(\.[a-z]{2,6})?$/.test(tok)) { parts.push(tok); continue; }
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
//     /\bat\s+(gmail|yahoo|hotmail|outlook|icloud|bigpond|optusnet|tpg|live|proton|bele)/.test(lower)
//   ) return true;
//   const natoCount = (
//     lower.match(
//       /\b(alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliet|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|xray|yankee|zulu)\b/gi,
//     ) || []
//   ).length;
//   if (natoCount >= 2 && /\bat\b/.test(lower)) return true;
//   const words = lower.split(/\s+/);
//   const hasAt = words.includes("at");
//   const hasDot = words.includes("dot") || words.includes("period") || words.includes("stop");
//   const singleLetterCount = words.filter((w) => /^[a-z]$/.test(w)).length;
//   if (hasAt && hasDot && singleLetterCount >= 2) return true;
//   const hyphenSpellingCount = (lower.match(/\b[a-z]-[a-z]\b/g) || []).length;
//   if (hyphenSpellingCount >= 2 && hasAt) return true;
//   return false;
// }

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

//     const session = mkSession();
//     let openaiWs = null;

//     let elevenLabsWs = null;
//     let elevenLabsReady = false;
//     let textBuffer = [];
//     let elevenLabsStreaming = false;
//     let elevenLabsInitialized = false;
//     let elevenLabsStreamingTimeout = null;

//     function safeSetElevenLabsStreaming(val) {
//       if (elevenLabsStreamingTimeout) { clearTimeout(elevenLabsStreamingTimeout); elevenLabsStreamingTimeout = null; }
//       elevenLabsStreaming = val;
//       if (val) {
//         elevenLabsStreamingTimeout = setTimeout(() => {
//           if (elevenLabsStreaming) {
//             console.warn(`⚠️ [EL] elevenLabsStreaming force-cleared after 15s safety timeout`);
//             elevenLabsStreaming = false;
//             assistantSpeaking = false;
//           }
//         }, 15000);
//       }
//     }

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

//     let lastResponseWasPackage = false;

//     // ─── Email confirmation state ──────────────────────────────────
//     // FIX: pendingEmailConfirmation tracks the email waiting for user YES/NO.
//     // _emailStepComplete (on session.collected) prevents re-entry after YES.
//     let pendingEmailConfirmation = null; // { raw: string, parsed: string }
//     let emailConfirmationAsked = false;

//     // ═══════════════════════════════════════════════════════════════
//     //  DEBUG STATE
//     // ═══════════════════════════════════════════════════════════════
//     function debugState(label = "state_snapshot") {
//       const c = session.collected || {};
//       dbg(c.intent || "unknown", label, "snapshot", {
//         salesStep,
//         pendingFunctionCalls,
//         isResponseActive,
//         assistantSpeaking,
//         elevenLabsStreaming,
//         elevenLabsReady,
//         intent: c.intent || "none",
//         leadInterest: c.leadInterest || "none",
//         websiteCheckDone: c._websiteCheckDone || false,
//         websiteCheckAsked: c._websiteCheckAsked || false,
//         "collected.email": c.email || "",
//         "collected.phone": c.phone || "",
//         _firstName: c._firstName || "",
//         _lastName: c._lastName || "",
//         _emailStepComplete: c._emailStepComplete || false,
//         pendingEmailConfirmation: pendingEmailConfirmation?.parsed || "",
//         emailConfirmationAsked,
//       });
//     }

//     // ═══════════════════════════════════════════════════════════════
//     //  CENTRAL TIMER MANAGER
//     // ═══════════════════════════════════════════════════════════════
//     const TimerManager = (() => {
//       let _silenceTimer = null;
//       let _finalMessageTimer = null;
//       let _watchdogTimer = null;

//       const SILENCE_NORMAL_MS = 15000;
//       const SILENCE_PACKAGE_MS = 20000;
//       const WATCHDOG_MS = 8000;

//       function _clearSilence() {
//         if (_silenceTimer) {
//           clearTimeout(_silenceTimer);
//           _silenceTimer = null;
//           console.log(`⏱️  [TMgr] Silence timer CLEARED`);
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
//           if (assistantSpeaking) { return; }
//           if (pendingFunctionCalls > 0) { return; }
//           if (awaitingStructuredInput) return;
//           if (finalMessageLock || session.finalLock) return;
//           if (elevenLabsStreaming) { return; }

//           const timeoutMs = isPackage ? SILENCE_PACKAGE_MS : SILENCE_NORMAL_MS;
//           console.log(`⏱️  [TMgr] Silence timer START: ${timeoutMs / 1000}s`);

//           _silenceTimer = setTimeout(() => {
//             _silenceTimer = null;
//             if (awaitingStructuredInput) return;
//             if (finalMessageLock || session.finalLock) return;
//             if (pendingFunctionCalls > 0) return;
//             if (assistantSpeaking) return;
//             if (elevenLabsStreaming) return;

//             const nudgeText = isPackage
//               ? "[CRITICAL_SILENCE_NUDGE] User has NOT responded after you presented plans. ABSOLUTELY DO NOT auto-select or assume a plan. User MUST explicitly tell you which plan they want. Ask clearly: 'Which of these plans would you like to go with?' and WAIT for their explicit choice."
//               : "[SILENCE_NUDGE] The user has not responded. REPEAT your last question. Do NOT move forward.";

//             console.log(`⏰ [TMgr] Silence fired — nudging AI`);
//             if (openaiWs?.readyState === WebSocket.OPEN) {
//               openaiWs.send(JSON.stringify({
//                 type: "conversation.item.create",
//                 item: {
//                   type: "message",
//                   role: "user",
//                   content: [{ type: "input_text", text: nudgeText }],
//                 },
//               }));
//               scheduleResponseCreate();
//             }
//           }, timeoutMs);
//         },

//         resetSilence() { _clearSilence(); },
//         clearSilence: _clearSilence,

//         startWatchdog() {
//           _clearWatchdog();
//           _watchdogTimer = setTimeout(() => {
//             _watchdogTimer = null;
//             if (!isResponseActive && pendingFunctionCalls === 0) {
//               console.warn(`⚠️ [TMgr] Watchdog fired — agent stuck`);
//               if (openaiWs?.readyState === WebSocket.OPEN) {
//                 openaiWs.send(JSON.stringify({
//                   type: "conversation.item.create",
//                   item: {
//                     type: "message",
//                     role: "user",
//                     content: [{ type: "input_text", text: "[SYSTEM_CONTEXT]: Please respond immediately to the last user message." }],
//                   },
//                 }));
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
//           _clearFinalMessage();
//           _clearWatchdog();
//         },

//         get hasSilenceTimer() { return _silenceTimer !== null; },
//       };
//     })();

//     let finalMessageLock = false;

//     // ─── Sales step machine ────────────────────────────────────────
//     function initSalesStepMachine() {
//       if (salesStep !== null) { return; }
//       const c = session.collected || {};

//       if (c.leadInterest && c._websiteCheckDone) {
//         const hasFirstName = c._firstName || c.preferredName || (c.name && c.name.trim().length >= 2);
//         const hasLastName = c._lastName || (c.name && c.name.trim().split(/\s+/).length >= 2);

//         if (!hasFirstName) salesStep = "firstName";
//         else if (!hasLastName) salesStep = "lastName";
//         else if (!c.phone) salesStep = "phone";
//         // FIX BUG 1: Use _emailStepComplete as the authoritative "email done" signal
//         else if (!c.email || !c._emailStepComplete) salesStep = "email";
//         else salesStep = "createTicket";

//         dbg("sales", "initSalesStepMachine", "initialized", { startStep: salesStep });
//       }
//     }

//     function advanceSalesStep(completedStep) {
//       const c = session.collected || {};
//       if (salesStep !== completedStep) { return; }

//       const order = ["firstName", "lastName", "phone", "email", "createTicket", "done"];
//       const idx = order.indexOf(completedStep);
//       if (idx === -1) { return; }
//       const next = order[idx + 1];
//       if (!next) { salesStep = "done"; return; }

//       if (next === "lastName" && c._lastName) { salesStep = "lastName"; advanceSalesStep("lastName"); return; }
//       if (next === "phone" && c.phone) { salesStep = "phone"; advanceSalesStep("phone"); return; }
//       // FIX BUG 1: Skip email step if _emailStepComplete is set
//       if (next === "email" && (c.email && c._emailStepComplete)) { salesStep = "email"; advanceSalesStep("email"); return; }

//       const hasName =
//         (c._firstName && c._lastName) ||
//         (c.name && c.name.trim().split(/\s+/).length >= 2) ||
//         (c._firstName && c.name) ||
//         c.preferredName;

//       // FIX BUG 1: Check _emailStepComplete for createTicket gate
//       if (next === "createTicket" && hasName && c.phone && c.email && c._emailStepComplete) {
//         salesStep = "createTicket";
//       } else {
//         salesStep = next;
//       }

//       dbg("sales", "advanceSalesStep_RESULT", "advanced", { from: completedStep, to: salesStep });
//     }

//     function buildSalesStepHint() {
//       const c = session.collected || {};

//       const _logAndReturn = (label, val) => {
//         dbg("sales", "buildSalesStepHint_RETURN", label, {
//           salesStep,
//           hint: String(val || "").substring(0, 150),
//         });
//         return val;
//       };

//       if (
//         c.leadInterest &&
//         c._websiteCheckRequired &&
//         !c._websiteCheckDone &&
//         !c._websiteCheckAsked
//       ) {
//         return _logAndReturn(
//           "website_check_not_asked",
//           `SALES STEP [website_check]: You MUST ask: "Just out of curiosity — have you had a chance to check out our website and seen the plans or pricing?" Do NOT proceed to collect name, phone, or email until this question is asked and answered.`,
//         );
//       }

//       if (
//         c.leadInterest &&
//         c._websiteCheckRequired &&
//         c._websiteCheckAsked &&
//         !c._websiteCheckDone
//       ) {
//         return _logAndReturn(
//           "website_check_asked_awaiting_answer",
//           `SALES STEP [website_check_pending]: Website check was already asked. DO NOT ask again. Wait for customer to answer.`,
//         );
//       }

//       if (salesStep === null && c.leadInterest && c._websiteCheckDone) {
//         initSalesStepMachine();
//       }

//       if (!salesStep || salesStep === "done") {
//         return _logAndReturn("null_no_salesstep", null);
//       }

//       const name = c._firstName || c.preferredName || "";

//       switch (salesStep) {
//         case "firstName": {
//           if (c.preferredName || (c.name && c.name.trim().length >= 2)) {
//             const derivedFirst = c.preferredName || c.name.trim().split(/\s+/)[0];
//             const INVALID = new Set(["yes","yeah","no","nope","ok","okay","i","my","the","a","an","hi","hello"]);
//             if (derivedFirst && derivedFirst.length >= 2 && !INVALID.has(derivedFirst.toLowerCase())) {
//               session.collected._firstName = derivedFirst;
//               sessions.set(session.id, session);
//               advanceSalesStep("firstName");
//               return buildSalesStepHint();
//             }
//           }
//           return _logAndReturn(
//             "step_firstName",
//             `[FLOW: sales][STEP: firstName][STATUS: pending] Ask ONLY for the customer's first name. Say something like "Could I start with your first name?" Say NOTHING else.`,
//           );
//         }

//         case "lastName": {
//           if (!c._lastName && c.name && c.name.trim().split(/\s+/).length >= 2) {
//             const parts = c.name.trim().split(/\s+/);
//             const derivedLast = parts[parts.length - 1];
//             const INVALID = new Set(["yes","yeah","no","nope","ok","okay","i","my","the","a","an"]);
//             if (derivedLast && derivedLast.length >= 2 && !INVALID.has(derivedLast.toLowerCase())) {
//               session.collected._lastName = derivedLast;
//               sessions.set(session.id, session);
//               advanceSalesStep("lastName");
//               return buildSalesStepHint();
//             }
//           }
//           return _logAndReturn(
//             "step_lastName",
//             `[FLOW: sales][STEP: lastName][STATUS: pending] You have their first name (${c._firstName || "collected"}). Ask ONLY for their last name.`,
//           );
//         }

//         case "phone":
//           return _logAndReturn(
//             "step_phone",
//             `[FLOW: sales][STEP: phone][STATUS: pending] You have their name (${name}). Ask ONLY for their mobile phone number.`,
//           );

//         case "email": {
//           // ── FIX BUG 1: If email step is fully confirmed, skip immediately
//           if (c._emailStepComplete) {
//             dbg("sales", "buildSalesStepHint_email", "already_confirmed_skipping", {
//               email: c.email,
//               _emailStepComplete: true,
//             });
//             advanceSalesStep("email");
//             return buildSalesStepHint();
//           }

//           // ── FIX BUG 1: If email awaiting confirmation, do not re-ask
//           if (emailConfirmationAsked && pendingEmailConfirmation) {
//             return _logAndReturn(
//               "step_email_awaiting_confirmation",
//               `[FLOW: sales][STEP: email][STATUS: awaiting_confirmation] You already read the email back as "${pendingEmailConfirmation.parsed}". WAIT for the user to say YES or NO. Do NOT ask for the email again. Do NOT re-read it. Just wait.`,
//             );
//           }

//           return _logAndReturn(
//             "step_email_ask",
//             `[FLOW: sales][STEP: email][STATUS: pending] Ask for email: "Could I grab your email address? Please spell it letter by letter — for at the rate say 'at', for dots say 'dot'. Example: john dot doe at gmail dot com." Then read it back letter-by-letter and ask "Is that correct?" Only proceed after user confirms YES.`,
//           );
//         }

//         case "createTicket": {
//           const missing = [];
//           if (!c._firstName && !c.name && !c.preferredName) missing.push("name");
//           if (!c.phone) missing.push("phone");
//           if (!c.email) missing.push("email");
//           if (!c.leadInterest) missing.push("selected plan");

//           if (missing.length > 0) {
//             if (!c.phone) salesStep = "phone";
//             else if (!c.email || !c._emailStepComplete) salesStep = "email";
//             return buildSalesStepHint();
//           }

//           return _logAndReturn(
//             "step_createTicket_execute",
//             `[FLOW: sales][STEP: create_ticket][STATUS: execute] ALL required details collected:
// - Name: ${c._firstName || ""} ${c._lastName || ""} / ${c.name || ""}
// - Phone: ${c.phone}
// - Email: ${c.email}
// - Plan: ${c.leadInterest}
// - Address: ${c.address || "provided earlier"}

// STEP 1: Call extract_call_fields to save any recently collected details.
// STEP 2: THEN call create_ticket IMMEDIATELY. Do NOT say anything to the user first. CALL THE TOOLS.`,
//           );
//         }

//         default:
//           return _logAndReturn("unknown_step", null);
//       }
//     }

//     // ─── Raw phone buffer ──────────────────────────────────────────
//     let rawPhoneBuffer = null;
//     let rawPhoneBufferTimestamp = 0;
//     let awaitingPhoneVerification = false;

//     // ─── Single pending response.create gate ──────────────────────
//     let responseCreatePending = false;

//     function scheduleResponseCreate(contextHint = null, delayMs = 0, force = false) {
//       if (isResponseActive && !force) {
//         if (contextHint) pendingPostDoneHint = contextHint;
//         pendingPostDoneCreate = true;
//         return;
//       }
//       if (responseCreatePending && !force) { return; }
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
//         const combinedHint = [contextHint, salesHint].filter(Boolean).join("\n\n");

//         if (combinedHint) {
//           openaiWs.send(JSON.stringify({
//             type: "conversation.item.create",
//             item: {
//               type: "message",
//               role: "user",
//               content: [{ type: "input_text", text: `[SYSTEM_CONTEXT]: ${combinedHint}` }],
//             },
//           }));
//         }

//         console.log("📤 Sending response.create to OpenAI");
//         openaiWs.send(JSON.stringify({ type: "response.create" }));
//         TimerManager.startWatchdog();
//       };

//       if (delayMs > 0) setTimeout(send, delayMs);
//       else send();
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
//       if (/\bnbn\b/.test(t) || /\b(opti\s*comm|opticomm)\b/.test(t)) return null;
//       if (/\b(first|1st|one|1|option\s*1|option\s*one|number\s*1|the\s*first)\b/.test(t)) return "NBN";
//       if (/\b(second|2nd|two|2|option\s*2|option\s*two|number\s*2|the\s*second|to)\b/.test(t)) return "Opticomm";
//       return null;
//     }

//     function wasLastMessageNetworkQuestion() {
//       const msgs = session.messages || [];
//       for (let i = msgs.length - 1; i >= 0; i--) {
//         if (msgs[i].role === "assistant") {
//           const t = (msgs[i].content || "").toLowerCase();
//           return (
//             (t.includes("nbn") && t.includes("opticomm")) ||
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
//         (lower.includes("mbps") && (lower.includes("$") || lower.includes("per month") || lower.includes("/m"))) ||
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
//         (lower.includes("website") && (lower.includes("plans") || lower.includes("pricing")))
//       );
//     }

//     function detectWebsiteCheckAnswer(text) {
//       if (!text) return false;
//       const lower = text.toLowerCase().trim();
//       if (/\b(yes|yeah|yep|yup|i have|i did|already|looked|checked|seen|saw|visited)\b/.test(lower)) return true;
//       if (/\b(no|nope|not yet|haven't|didn't|i haven't|i didn't|no i haven't)\b/.test(lower)) return true;
//       return false;
//     }

//     function wasLastAssistantMessageWebsiteCheck() {
//       const msgs = session.messages || [];
//       for (let i = msgs.length - 1; i >= 0; i--) {
//         if (msgs[i].role === "assistant") {
//           return detectWebsiteCheckQuestion(msgs[i].content || "");
//         }
//         if (msgs[i].role === "user") break;
//       }
//       return false;
//     }

//     // ── FIX BUG original: Detect when AI reads email back asking for confirmation
//     function detectEmailReadbackQuestion(text) {
//       if (!text) return false;
//       const lower = text.toLowerCase();
//       return (
//         (lower.includes("is that correct") || lower.includes("correct?") || lower.includes("is that right") || lower.includes("shall i use")) &&
//         lower.includes("at") &&
//         (lower.includes("dot") || lower.includes("."))
//       );
//     }

//     // ── Detect user confirming email (YES) or rejecting (NO)
//     function detectEmailConfirmation(text) {
//       if (!text) return null;
//       const lower = text.toLowerCase().trim();
//       if (/\b(yes|yeah|yep|yup|correct|that's right|that is correct|that's correct|perfect|looks good|confirmed|confirm)\b/.test(lower)) return "yes";
//       if (/\b(no|nope|wrong|incorrect|that's wrong|that is wrong|change it|try again|re-spell|different)\b/.test(lower)) return "no";
//       return null;
//     }

//     function detectSalesStepAnswer(text) {
//       if (!salesStep || salesStep === "done" || salesStep === "createTicket") return;

//       const c = session.collected || {};
//       if (!c._websiteCheckDone) { return; }

//       const INVALID_NAME_WORDS = new Set([
//         "yes","yeah","yep","no","nope","ok","okay","sure","right","alright",
//         "correct","true","false","i","my","the","a","an","hi","hello","hey",
//         "sorry","please","thank","thanks",
//       ]);

//       if (salesStep === "firstName") {
//         const words = text.trim().split(/\s+/);
//         const firstName = words[0]?.replace(/[^a-zA-Z'-]/g, "");
//         if (firstName && firstName.length >= 2 && !INVALID_NAME_WORDS.has(firstName.toLowerCase())) {
//           session.collected._firstName = firstName;
//           sessions.set(session.id, session);
//           advanceSalesStep("firstName");
//         }
//       } else if (salesStep === "lastName") {
//         const words = text.trim().split(/\s+/);
//         const lastName = words[words.length - 1]?.replace(/[^a-zA-Z'-]/g, "");
//         if (lastName && lastName.length >= 2 && !INVALID_NAME_WORDS.has(lastName.toLowerCase())) {
//           session.collected._lastName = lastName;
//           session.collected.name = `${c._firstName || ""} ${lastName}`.trim();
//           session.collected.preferredName = c._firstName || lastName;
//           sessions.set(session.id, session);
//           advanceSalesStep("lastName");
//         }
//       } else if (salesStep === "phone") {
//         const digits = text.replace(/\D/g, "");
//         if (digits.length >= 8) {
//           session.collected.phone = digits;
//           sessions.set(session.id, session);
//           advanceSalesStep("phone");
//         }
//       }
//       // NOTE: email step is handled exclusively via pendingEmailConfirmation flow — not here
//     }

//     // ═══════════════════════════════════════════════════════════════
//     //  ElevenLabs — persistent single connection
//     // ═══════════════════════════════════════════════════════════════
//     function openElevenLabsStream(force = false) {
//       if (
//         !force &&
//         elevenLabsWs &&
//         (elevenLabsWs.readyState === WebSocket.OPEN || elevenLabsWs.readyState === WebSocket.CONNECTING)
//       ) { return; }

//       closeElevenLabsWs();

//       const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_flash_v2_5&output_format=pcm_16000`;
//       const elWs = new WebSocket(wsUrl);

//       elWs.on("open", () => {
//         console.log(`✅ [EL] ElevenLabs WebSocket connected`);
//         elWs.send(JSON.stringify({
//           text: " ",
//           voice_settings: { stability: 0.4, similarity_boost: 0.75, speed: 1.1 },
//           xi_api_key: ELEVENLABS_API_KEY,
//         }));

//         if (elevenLabsWs === elWs) {
//           elevenLabsReady = true;
//           elevenLabsInitialized = true;
//           if (textBuffer.length > 0) {
//             for (const text of textBuffer) sendTextToElevenLabs(text);
//             textBuffer = [];
//           }
//         }
//       });

//       elWs.on("message", (data) => {
//         try {
//           const msg = JSON.parse(data.toString());
//           if (msg.audio) {
//             socket.emit("audio_chunk_pcm", { sampleRate: PCM_SAMPLE_RATE, audio: msg.audio });
//           }
//           const isFinal = msg.isFinal === true || msg.is_final === true || msg.final === true;
//           if (isFinal) {
//             safeSetElevenLabsStreaming(false);
//             socket.emit("audio_stream_complete");
//           }
//         } catch (err) {
//           console.error(`⚠️ [EL] Message parse error:`, err.message);
//         }
//       });

//       elWs.on("error", (err) => {
//         console.warn(`⚠️ [EL] WS error: ${err.message}`);
//         elevenLabsStreaming = false;
//         elevenLabsReady = false;
//         if (elevenLabsWs === elWs) {
//           setTimeout(() => { if (elevenLabsWs === elWs || !elevenLabsWs) openElevenLabsStream(true); }, 500);
//         }
//       });

//       elWs.on("close", (code) => {
//         if (elevenLabsWs === elWs) {
//           elevenLabsReady = false;
//           elevenLabsStreaming = false;
//           setTimeout(() => { if (!elevenLabsReady && elevenLabsWs === elWs) openElevenLabsStream(true); }, 200);
//         }
//       });

//       elevenLabsWs = elWs;
//     }

//     function interruptElevenLabsStream() {
//       safeSetElevenLabsStreaming(false);
//       textBuffer = [];
//       if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) {
//         openElevenLabsStream(true);
//         return;
//       }
//       try {
//         elevenLabsWs.send(JSON.stringify({
//           text: " ",
//           voice_settings: { stability: 0.4, similarity_boost: 0.75, speed: 1.1 },
//           xi_api_key: ELEVENLABS_API_KEY,
//         }));
//         elevenLabsReady = true;
//         elevenLabsStreaming = false;
//       } catch (e) {
//         elevenLabsReady = false;
//         openElevenLabsStream(true);
//       }
//     }

//     function sendTextToElevenLabs(text) {
//       if (!text) return;
//       if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) { textBuffer.push(text); return; }
//       if (!elevenLabsReady) { textBuffer.push(text); return; }
//       elevenLabsWs.send(JSON.stringify({ text, try_trigger_generation: true }));
//     }

//     function flushElevenLabsStream() {
//       if (elevenLabsWs?.readyState === WebSocket.OPEN && elevenLabsReady) {
//         elevenLabsWs.send(JSON.stringify({ text: " ", flush: true }));
//       }
//     }

//     function closeElevenLabsWs() {
//       if (elevenLabsWs) {
//         elevenLabsStreaming = false;
//         elevenLabsReady = false;
//         try {
//           if (elevenLabsWs.readyState === WebSocket.CONNECTING) elevenLabsWs.terminate();
//           else if (elevenLabsWs.readyState === WebSocket.OPEN) elevenLabsWs.close(1000);
//         } catch (err) { /* ignore */ }
//         elevenLabsWs = null;
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
//             "\n\nPACKAGE PRESENTATION RULE (CRITICAL):" +
//             "\n- When presenting plans/packages to the customer, present ALL available options clearly." +
//             "\n- ABSOLUTELY DO NOT auto-select or assume which plan the customer wants." +
//             "\n- After presenting packages, ask explicitly: 'Which of these plans catches your eye?'" +
//             "\n- WAIT for the customer to explicitly say WHICH PLAN they choose." +
//             "\n\nEMAIL COLLECTION FLOW:" +
//             "\n1. Ask for email spelling letter by letter." +
//             "\n2. Parse and read back letter-by-letter: 'So that's s-h-a-u-n at b-e-l-e dot a-i — is that right?'" +
//             "\n3. Wait for YES or NO. If YES → call extract_call_fields with the email ONCE. If NO → ask to re-spell." +
//             "\n4. After extract_call_fields confirms email saved, do NOT call it again with the same email." +
//             "\n5. NEVER use NATO names when reading back. Spell s-h-a-u-n not sierra-hotel-alpha-uniform-november.";

//           openaiWs.send(JSON.stringify({
//             type: "session.update",
//             session: {
//               instructions,
//               modalities: ["text"],
//               input_audio_format: "pcm16",
//               turn_detection: {
//                 type: "server_vad",
//                 threshold: 0.9,
//                 prefix_padding_ms: 300,
//                 silence_duration_ms: 1500,
//               },
//               tools: realtimeTools,
//               tool_choice: "auto",
//               input_audio_transcription: { model: "whisper-1" },
//             },
//           }));

//           openElevenLabsStream();
//         });

//         let resolved = false;
//         openaiWs.on("message", (raw) => {
//           try {
//             const data = JSON.parse(raw.toString());
//             if (!resolved) { resolved = true; resolve(); }
//             handleOpenAIEvent(data);
//           } catch (e) { console.error("[WS-1] parse error:", e.message); }
//         });

//         openaiWs.on("error", (err) => {
//           if (!resolved) { resolved = true; reject(err); }
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
//         case "session.updated":
//           break;

//         case "input_audio_buffer.speech_started": {
//           if (awaitingStructuredInput || pendingFunctionCalls > 0 || session.finalLock || finalMessageLock) {
//             if (openaiWs?.readyState === WebSocket.OPEN) {
//               openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
//             }
//             break;
//           }

//           console.log(`🎙️ USER INTERRUPTED -> Stopping AI Voice`);
//           socket.emit("status", "user_speaking");
//           socket.emit("interrupt");
//           socket.emit("audio_interrupt");

//           TimerManager.resetSilence();
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
//           pendingPostDoneCreate = false;
//           pendingPostDoneHint = null;
//           break;
//         }

//         case "input_audio_buffer.speech_stopped":
//           socket.emit("status", "processing");
//           break;

//         case "conversation.item.input_audio_transcription.completed": {
//           if (!event.transcript) break;

//           const cleaned = normalizeText(event.transcript);
//           if (!cleaned) break;

//           console.log(`📊 [TRANSCRIPT] "${cleaned}"`);

//           TimerManager.clearWatchdog();

//           const looksLikeEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(cleaned);
//           const digitCount = (cleaned.match(/\d/g) || []).length;
//           const looksLikePhone = digitCount >= 6;
//           const looksLikeSpelling = looksLikeVoiceEmailSpelling(cleaned);
//           const isPurePhoneNumber = looksLikePhone && !looksLikeEmail && !looksLikeSpelling;

//           if (pendingFunctionCalls > 0 || finalMessageLock || session.finalLock) { break; }

//           if (assistantSpeaking) { assistantSpeaking = false; }

//           if (awaitingPhoneVerification && looksLikePhone) {
//             const digits = cleaned.replace(/\D/g, "");
//             if (digits.length >= 6) {
//               rawPhoneBuffer = digits;
//               rawPhoneBufferTimestamp = Date.now();
//             }
//           }

//           console.log(`👤 User: "${cleaned}"`);
//           socket.emit("user_transcript", cleaned);

//           // ══════════════════════════════════════════════════════════
//           // FIX BUG 1 & 3: Handle email confirmation FIRST, before
//           // anything else. This is the authoritative gate — once user
//           // says YES here, we set _emailStepComplete and never re-ask.
//           // ══════════════════════════════════════════════════════════
//           if (salesStep === "email" && emailConfirmationAsked && pendingEmailConfirmation) {
//             const confirmationResult = detectEmailConfirmation(cleaned);
//             dbg("sales", "email_confirmation_check", confirmationResult || "not_a_confirmation", {
//               cleaned: cleaned.substring(0, 60),
//               pendingEmail: pendingEmailConfirmation.parsed,
//             });

//             if (confirmationResult === "yes") {
//               const confirmedEmail = pendingEmailConfirmation.parsed;
//               // FIX BUG 1: Set _emailStepComplete BEFORE clearing state so guard fires
//               session.collected.email = confirmedEmail;
//               session.collected._emailStepComplete = true;
//               pendingEmailConfirmation = null;
//               emailConfirmationAsked = false;
//               sessions.set(session.id, session);
//               dbg("sales", "email_confirmed_YES", "advancing", {
//                 email: confirmedEmail,
//                 _emailStepComplete: true,
//               });
//               advanceSalesStep("email");
//               session.messages.push({ role: "user", content: cleaned });
//               sessions.set(session.id, session);
//               TimerManager.resetSilence();
//               // FIX BUG 3: Tell LLM NOT to call extract_call_fields again
//               const nextStepHint = buildSalesStepHint() || "Proceed to the next step.";
//               scheduleResponseCreate(
//                 `Email confirmed and saved as "${confirmedEmail}". ` +
//                 `_emailStepComplete=true. Do NOT call extract_call_fields with this email again. ` +
//                 `Do NOT ask about email again. ${nextStepHint}`
//               );
//               break;

//             } else if (confirmationResult === "no") {
//               // User rejected — clear confirmation state and ask to re-spell
//               pendingEmailConfirmation = null;
//               emailConfirmationAsked = false;
//               // Also clear the tentatively saved email so LLM re-asks
//               delete session.collected.email;
//               delete session.collected._emailStepComplete;
//               sessions.set(session.id, session);
//               dbg("sales", "email_confirmed_NO", "clearing_and_re_asking", {});
//               session.messages.push({ role: "user", content: cleaned });
//               sessions.set(session.id, session);
//               TimerManager.resetSilence();
//               scheduleResponseCreate(
//                 `Email was REJECTED by user. Say "No worries, let me take that again" ` +
//                 `and ask them to re-spell their email letter by letter from the beginning.`
//               );
//               break;
//             }
//             // Not a clear yes/no — fall through to normal handling but don't advance
//           }

//           const mappedNetwork = mapOrdinalNetworkChoice(cleaned);
//           if (mappedNetwork && wasLastMessageNetworkQuestion()) {
//             const clarified = `I want ${mappedNetwork}`;
//             session.collected.networkPreference = mappedNetwork;
//             session.messages.push({ role: "user", content: clarified });
//             sessions.set(session.id, session);
//             if (openaiWs?.readyState === WebSocket.OPEN) {
//               openaiWs.send(JSON.stringify({
//                 type: "conversation.item.create",
//                 item: {
//                   type: "message",
//                   role: "user",
//                   content: [{ type: "input_text", text: clarified }],
//                 },
//               }));
//               scheduleResponseCreate();
//             }
//             TimerManager.resetSilence();
//             break;
//           }

//           // FIX BUG 2 (partial): Website check detection uses last assistant message
//           // (wasLastAssistantMessageWebsiteCheck) — the `cleaned` variable IS in scope
//           // here so detectWebsiteCheckAnswer(cleaned) is correct in this handler.
//           if (
//             session.collected._websiteCheckRequired &&
//             !session.collected._websiteCheckDone &&
//             detectWebsiteCheckAnswer(cleaned) &&
//             wasLastAssistantMessageWebsiteCheck()
//           ) {
//             session.collected._websiteCheckDone = true;
//             sessions.set(session.id, session);
//             dbg("sales", "website_check_answered", "done", { answer: cleaned });
//             initSalesStepMachine();
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
//           safeSetElevenLabsStreaming(true);
//           assistantSpeaking = true;
//           socket.emit("status", "speaking");
//           TimerManager.clearWatchdog();
//           break;

//         case "response.text.delta":
//           if (event.delta) {
//             currentResponseHadOutput = true;
//             assistantTextBuffer += event.delta;
//             socket.emit("assistant_text_delta", event.delta);
//             sendTextToElevenLabs(event.delta);
//           }
//           break;

//         case "response.text.done":
//           if (event.text) {
//             currentResponseHadOutput = true;
//             const newTextNorm = event.text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
//             const lastTextNorm = lastAssistantText.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
//             const isDuplicate =
//               newTextNorm.length > 20 &&
//               lastTextNorm.length > 20 &&
//               (newTextNorm === lastTextNorm || newTextNorm.includes(lastTextNorm) || lastTextNorm.includes(newTextNorm));

//             if (isDuplicate) {
//               assistantTextBuffer = "";
//               break;
//             }

//             lastAssistantText = event.text;
//             console.log(`🤖 AI: "${event.text.substring(0, 100)}..."`);
//             session.messages.push({ role: "assistant", content: event.text });
//             sessions.set(session.id, session);
//             socket.emit("assistant_text_done", event.text);

//             // Detect leadInterest from AI text if LLM skipped extract_call_fields
//             if (!session.collected.leadInterest) {
//               const planMatch =
//                 event.text.match(/\bOptiComm\s+[\w\s]+(?:Residential|Business|plan)\b/i) ||
//                 event.text.match(/\bNBN\s+[\w\s]+(?:Residential|Business|plan|Mbps)\b/i);
//               if (planMatch) {
//                 const detectedPlan = planMatch[0].trim();
//                 session.collected.leadInterest = detectedPlan;
//                 session.collected._websiteCheckRequired = true;
//                 if (session.collected._websiteCheckDone === undefined) {
//                   session.collected._websiteCheckDone = false;
//                 }
//                 sessions.set(session.id, session);
//               }
//             }

//             flushElevenLabsStream();

//             if (detectPlanPresentation(event.text)) {
//               lastResponseWasPackage = true;
//             }

//             if (detectPhoneVerificationRequest(event.text)) {
//               awaitingPhoneVerification = true;
//               rawPhoneBuffer = null;
//               rawPhoneBufferTimestamp = 0;
//             }

//             // ── FIX BUG 2: Track website check question from AI OUTPUT text,
//             //    NOT from `cleaned` (which is undefined in this scope).
//             //    We detect when the AI has just ASKED the question.
//             if (
//               session.collected._websiteCheckRequired &&
//               !session.collected._websiteCheckDone &&
//               !session.collected._websiteCheckAsked &&
//               detectWebsiteCheckQuestion(event.text)
//             ) {
//               session.collected._websiteCheckAsked = true;
//               sessions.set(session.id, session);
//               dbg("sales", "website_check_question_detected_from_ai_output", "marked_asked", {
//                 aiText: event.text.substring(0, 80),
//               });
//             }

//             // ── FIX BUG 1: Detect when AI is reading email back asking for confirmation.
//             //    Only set emailConfirmationAsked if we actually have a pending email
//             //    AND the email step is not already complete.
//             if (
//               salesStep === "email" &&
//               !session.collected._emailStepComplete &&
//               detectEmailReadbackQuestion(event.text) &&
//               pendingEmailConfirmation
//             ) {
//               emailConfirmationAsked = true;
//               dbg("sales", "email_readback_detected", "awaiting_confirmation", {
//                 pendingEmail: pendingEmailConfirmation.parsed,
//               });
//             }
//           }
//           break;

//         case "response.done": {
//           isResponseActive = false;
//           TimerManager.clearWatchdog();
//           debugState("response_done_snapshot");

//           const outputItems = event.response?.output || [];
//           const hasTextOutput =
//             outputItems.some(
//               (item) =>
//                 item.type === "message" &&
//                 item.content?.some((c) => c.type === "text" && c.text?.trim()),
//             ) || currentResponseHadOutput;
//           const hasFunctionCall = outputItems.some((item) => item.type === "function_call");

//           if (!hasFunctionCall && pendingFunctionCalls === 0 && !elevenLabsStreaming) {
//             assistantSpeaking = false;
//           }

//           if (!hasFunctionCall && !hasTextOutput && pendingFunctionCalls === 0 && !finalMessageLock) {
//             if (cancelPending) {
//               cancelPending = false;
//               assistantSpeaking = false;
//               socket.emit("status", "listening");
//               if (pendingPostDoneCreate) {
//                 pendingPostDoneCreate = false;
//                 const hint = pendingPostDoneHint;
//                 pendingPostDoneHint = null;
//                 setTimeout(() => scheduleResponseCreate(hint), 50);
//               }
//               break;
//             }

//             if (elevenLabsStreaming) { break; }

//             emptyResponseCount++;
//             if (emptyResponseCount <= MAX_EMPTY_RETRIES) {
//               const retryDelay = 300 * Math.pow(2, emptyResponseCount - 1);
//               assistantSpeaking = false;
//               scheduleResponseCreate(null, retryDelay, true);
//             } else {
//               emptyResponseCount = 0;
//               assistantSpeaking = false;
//               socket.emit("status", "listening");
//             }
//             break;
//           }

//           emptyResponseCount = 0;

//           if (pendingPostDoneCreate && pendingFunctionCalls === 0) {
//             pendingPostDoneCreate = false;
//             const hint = pendingPostDoneHint;
//             pendingPostDoneHint = null;
//             setTimeout(() => scheduleResponseCreate(hint, 0, true), 50);
//             break;
//           }

//           if (!pendingFunctionCalls) socket.emit("status", "listening");
//           assistantTextBuffer = "";
//           currentResponseHadOutput = false;
//           break;
//         }

//         case "response.output_item.added":
//           if (event.item?.type === "function_call") {
//             const fnName = event.item.name || event.item.function_call?.name;
//             if (fnName === "create_ticket") {
//               TimerManager.startFinalLock(20000);
//               if (openaiWs?.readyState === WebSocket.OPEN) {
//                 openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
//               }
//             }
//           }
//           break;

//         case "response.output_item.done":
//           if (event.item?.type === "function_call") {
//             pendingFunctionCalls++;
//             handleFunctionCall(event.item);
//           }
//           break;

//         case "error":
//           console.error("[WS-1] OpenAI error:", JSON.stringify(event.error));
//           socket.emit("error_msg", event.error?.message || "AI error");
//           isResponseActive = false;
//           pendingFunctionCalls = 0;
//           emptyResponseCount = 0;
//           responseCreatePending = false;
//           pendingPostDoneCreate = false;
//           elevenLabsStreaming = false;
//           assistantSpeaking = false;
//           TimerManager.clearWatchdog();
//           socket.emit("status", "listening");
//           break;
//       }
//     }

//     // ═══════════════ Tool Execution ════════════════
//     async function handleFunctionCall(item) {
//       const { call_id, name: fn, arguments: argsStr } = item;
//       let args = safeParseJSON(argsStr) || {};

//       dbg(session.collected?.intent || "unknown", "handleFunctionCall_ENTRY", "called", {
//         fn,
//         argsPreview: JSON.stringify(args).substring(0, 150),
//         salesStep,
//       });

//       // Redirect verify_phone for sales (non-verified) flow
//       if (fn === "verify_phone" && !session.collected._emailVerifiedCustomerId) {
//         const llmPhone = args.phone;
//         const bufferPhone = rawPhoneBuffer;
//         const phoneToSave = llmPhone || bufferPhone;
//         rawPhoneBuffer = null;
//         rawPhoneBufferTimestamp = 0;
//         awaitingPhoneVerification = false;
//         if (phoneToSave) {
//           session.collected.phone = String(phoneToSave).replace(/\D/g, "") || phoneToSave;
//           sessions.set(session.id, session);
//           if (salesStep === "phone") advanceSalesStep("phone");
//         }
//         const fakeResult = JSON.stringify({ success: true, _redirected: true, message: "Phone number saved." });
//         if (openaiWs?.readyState === WebSocket.OPEN) {
//           openaiWs.send(JSON.stringify({
//             type: "conversation.item.create",
//             item: { type: "function_call_output", call_id, output: fakeResult },
//           }));
//         }
//         pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
//         if (pendingFunctionCalls === 0 && openaiWs?.readyState === WebSocket.OPEN) {
//           const salesHint = buildSalesStepHint() || "";
//           const hint = `Phone number has been saved. ${salesHint}\n\nProceed to the next step immediately.`;
//           openaiWs.send(JSON.stringify({
//             type: "conversation.item.create",
//             item: {
//               type: "message",
//               role: "user",
//               content: [{ type: "input_text", text: `[SYSTEM_CONTEXT]: ${hint}` }],
//             },
//           }));
//           scheduleResponseCreate();
//         }
//         return;
//       }

//       if (fn === "verify_phone") {
//         if (rawPhoneBuffer) {
//           const llmPhone = args.phone ? String(args.phone).replace(/\D/g, "") : null;
//           const bufPhone = String(rawPhoneBuffer).replace(/\D/g, "");
//           const bufferAge = Date.now() - rawPhoneBufferTimestamp;
//           const bufferIsStale = bufferAge > 10000;
//           const llmHasFullNumber = llmPhone && llmPhone.length >= 10;
//           if (!bufferIsStale || !llmHasFullNumber) {
//             args = { ...args, phone: bufPhone };
//           }
//           rawPhoneBuffer = null;
//           rawPhoneBufferTimestamp = 0;
//           awaitingPhoneVerification = false;
//         } else if (!args.phone || String(args.phone).replace(/\D/g, "").length < 6) {
//           const noPhoneResult = JSON.stringify({
//             success: false,
//             verificationFailed: false,
//             message: "Could not extract phone number from speech. Ask the customer to repeat their number clearly.",
//           });
//           if (openaiWs?.readyState === WebSocket.OPEN) {
//             openaiWs.send(JSON.stringify({
//               type: "conversation.item.create",
//               item: { type: "function_call_output", call_id, output: noPhoneResult },
//             }));
//           }
//           pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
//           if (pendingFunctionCalls === 0) scheduleResponseCreate();
//           return;
//         }
//       }

//       console.log(`🔧 Tool: ${fn}`, JSON.stringify(args).substring(0, 200));

//       let result;
//       socket.emit("status", "processing");
//       TimerManager.clearSilence();
//       TimerManager.clearWatchdog();

//       if (openaiWs?.readyState === WebSocket.OPEN) {
//         openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
//       }

//       const toolTimeout = setTimeout(() => {
//         console.warn(`⚠️ Tool ${fn} timed out after 30s`);
//         pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
//         if (pendingFunctionCalls === 0) socket.emit("status", "listening");
//       }, 30000);

//       try {
//         result = await execTool(fn, args);
//         console.log(`🔧 [TOOL-END] ${fn} - result: ${result.substring(0, 200)}`);
//       } catch (err) {
//         console.error(`🔧 [TOOL-ERROR] ${fn}:`, err.message);
//         result = JSON.stringify({ success: false, error: err.message });
//       }

//       clearTimeout(toolTimeout);

//       let systemHint = `[FLOW: ${session.collected?.intent || "unknown"}] Current collected fields: ${JSON.stringify(
//         Object.fromEntries(
//           Object.entries(session.collected || {}).filter(([k]) => k !== "_registeredPhone" && k !== "_rp"),
//         ),
//       )}.`;

//       if (fn === "check_address_availability") {
//         let parsedResult = null;
//         try { parsedResult = JSON.parse(result); } catch (_) {}
//         if (parsedResult) {
//           const networkLabel = parsedResult.network || "the available network";
//           const planCount = Array.isArray(parsedResult.availablePlans) ? parsedResult.availablePlans.length : 0;
//           const requiresFilter = parsedResult.requiresResidentialFilter === true;
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
//             systemHint += `\nNETWORK LOCK: Only ${session.networkShown} — NEVER mention the other network again.`;
//           }
//         }
//       }

//       if (fn === "customer_lookup") {
//         let parsedResult = null;
//         try { parsedResult = JSON.parse(result); } catch (_) {}

//         if (parsedResult?._blocked && parsedResult?.reason === "sales_flow") {
//           systemHint += `\nTOOL RESULT: customer_lookup blocked — new sales lead. Treat as new customer. Collect name, phone, email one at a time, then call create_ticket.`;
//         } else if (parsedResult?._invalidEmail) {
//           systemHint += `\nTOOL RESULT: Email format invalid. Ask customer to spell the whole email from scratch, letter by letter.`;
//         } else if (parsedResult?.success && parsedResult?.customer) {
//           systemHint += `\nTOOL RESULT: Email lookup succeeded. Say "Perfect, I can see that account." Then ask for phone number. When they give it, call verify_phone.`;
//           awaitingPhoneVerification = true;
//           rawPhoneBuffer = null;
//           rawPhoneBufferTimestamp = 0;
//         } else {
//           systemHint += `\nTOOL RESULT: Customer not found. Ask customer to re-spell their email from scratch.`;
//         }
//       }

//       if (fn === "create_ticket") {
//         let parsedResult = null;
//         try { parsedResult = JSON.parse(result); } catch (_) {}

//         if (parsedResult?._blocked && parsedResult?.reason === "email_missing") {
//           TimerManager.releaseFinalLock();
//           salesStep = "email";
//           systemHint += `\nTOOL RESULT: create_ticket BLOCKED — email missing. Ask for email NOW by voice spelling. Read back letter-by-letter. Confirm YES before proceeding.`;
//         } else if (parsedResult?.success) {
//           salesStep = "done";
//           TimerManager.releaseFinalLock();
//           const ticketId = parsedResult.ticket_id;
//           const isSales = parsedResult._isSalesTicket === true || !ticketId;
//           if (isSales) {
//             systemHint += `\nTOOL RESULT: Sales enquiry submitted. Say: "Awesome, you're all set! Our sales team will be in touch via email shortly."`;
//           } else {
//             systemHint += `\nTOOL RESULT: Support ticket #${ticketId} created. Say: "Brilliant, all done! Ticket #${ticketId} raised — details sent via email."`;
//           }
//         } else {
//           TimerManager.releaseFinalLock();
//           systemHint += `\nTOOL RESULT: Ticket FAILED — ${parsedResult?.error || "unknown error"}. Apologise and suggest calling 1300 101 414.`;
//         }
//       }

//       if (fn === "extract_call_fields") {
//         const c = session.collected || {};

//         const shouldGate =
//           c.leadInterest &&
//           c._websiteCheckRequired &&
//           !c._websiteCheckAsked &&
//           !c._websiteCheckDone;
//         if (shouldGate) {
//           systemHint += `\nCRITICAL GATE: You MUST ask about website check first before collecting any other details.`;
//         }
//         if (c.leadInterest && c._websiteCheckRequired && (c._websiteCheckAsked || c._websiteCheckDone)) {
//           systemHint += `\nWEBSITE CHECK DONE: Do NOT ask again. Proceed with order collection.`;
//         }

//         if (salesStep === "createTicket" && c.phone && c.email && c.leadInterest) {
//           systemHint += `\n\nCRITICAL: Call create_ticket RIGHT NOW. Do not say anything to the user first.`;
//         }

//         // ── FIX BUG 1+3: If email is already complete, tell LLM not to re-process it
//         if (c._emailStepComplete) {
//           systemHint += `\nEMAIL ALREADY CONFIRMED (_emailStepComplete=true). Do NOT ask about email again. Do NOT call extract_call_fields with email again.`;
//         } else if (pendingEmailConfirmation && salesStep === "email") {
//           systemHint += `\nEMAIL PARSED as "${pendingEmailConfirmation.parsed}". Read it back letter-by-letter and ask "Is that correct?" Do NOT proceed until user says YES.`;
//         }

//         const stepHint = buildSalesStepHint();
//         if (stepHint) systemHint += `\n\n${stepHint}`;
//       }

//       if (fn === "send_portal_login_email") {
//         systemHint += `\nTOOL RESULT: Portal login email sent. Tell customer the request was sent and team will be in touch.`;
//       }

//       if (openaiWs?.readyState === WebSocket.OPEN) {
//         await Promise.resolve();
//         openaiWs.send(JSON.stringify({
//           type: "conversation.item.create",
//           item: { type: "function_call_output", call_id, output: result },
//         }));
//       }

//       pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);

//       if (pendingFunctionCalls === 0 && openaiWs?.readyState === WebSocket.OPEN) {
//         openaiWs.send(JSON.stringify({
//           type: "conversation.item.create",
//           item: {
//             type: "message",
//             role: "user",
//             content: [{
//               type: "input_text",
//               text: `[SYSTEM_CONTEXT]: ${systemHint}\n\nIMPORTANT: Respond immediately based on the tool result above.`,
//             }],
//           },
//         }));

//         console.log(`📤 Tool complete (${fn}) — triggering response.create`);
//         scheduleResponseCreate();
//       }
//     }

//     async function execTool(fn, args) {
//       if (fn === "extract_call_fields") {
//         // Parse email via voice parser before saving
//         if (args.email && typeof args.email === "string") {
//           const parsed = parseVoiceEmail(args.email);
//           if (parsed) args.email = parsed;
//         }

//         applyExtractionToSession(session, args);
//         const c = session.collected || {};

//         if (salesStep === "firstName" && (args.preferredName || args.name)) {
//           const firstName = (args.preferredName || args.name || "").split(" ")[0];
//           const INVALID_NAME_WORDS = new Set(["yes","yeah","yep","no","nope","ok","okay","sure","right","alright","correct","true","false","i","my","the","a","an"]);
//           if (firstName && firstName.length >= 2 && !INVALID_NAME_WORDS.has(firstName.toLowerCase())) {
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
//         if (salesStep === "phone" && args.phone) {
//           advanceSalesStep("phone");
//         }

//         if (args.leadInterest && !c.leadInterest) {
//           session.collected.leadInterest = args.leadInterest;
//           session.collected._websiteCheckRequired = true;
//           if (session.collected._websiteCheckDone === undefined) {
//             session.collected._websiteCheckDone = false;
//           }
//           sessions.set(session.id, session);
//         }

//         // ══════════════════════════════════════════════════════════
//         // FIX BUG 1: Guard email re-entry with _emailStepComplete.
//         // If user already said YES to this email, do NOT reset
//         // pendingEmailConfirmation. This is the core loop-breaker.
//         // ══════════════════════════════════════════════════════════
//         if (args.email) {
//           const parsedForExtract = parseVoiceEmail(args.email) || args.email;

//           if (session.collected._emailStepComplete) {
//             // Email already confirmed by user — ignore any further LLM extractions
//             dbg("sales", "extract_email_GUARDED_step_complete", "no_op", {
//               parsedForExtract,
//               savedEmail: session.collected.email,
//               reason: "_emailStepComplete=true, not resetting confirmation state",
//             });
//             // Do NOT overwrite, do NOT create pendingEmailConfirmation
//           } else if (salesStep === "email") {
//             // Email step is active — save and set up confirmation
//             session.collected.email = parsedForExtract;
//             sessions.set(session.id, session);

//             if (!pendingEmailConfirmation) {
//               // First time parsing this email
//               pendingEmailConfirmation = { raw: args.email, parsed: parsedForExtract };
//               emailConfirmationAsked = false;
//               dbg("sales", "email_saved_awaiting_confirmation", "new", { parsed: parsedForExtract });
//             } else if (pendingEmailConfirmation.parsed !== parsedForExtract) {
//               // Email was re-spelled with a different value (correction)
//               pendingEmailConfirmation = { raw: args.email, parsed: parsedForExtract };
//               emailConfirmationAsked = false;
//               dbg("sales", "email_updated_new_value", "updated", { parsed: parsedForExtract });
//             } else {
//               // Same email extracted again — do NOT reset emailConfirmationAsked
//               dbg("sales", "email_same_as_pending_SKIPPED", "no_op", {
//                 parsed: parsedForExtract,
//                 emailConfirmationAsked,
//                 reason: "same email, preserving confirmation state",
//               });
//             }
//           }
//         }

//         return JSON.stringify({ success: true });
//       }

//       if (fn === "customer_lookup") {
//         const isSalesFlow =
//           !!session.collected?.leadInterest &&
//           !session.collected?._emailVerifiedCustomerId;
//         if (isSalesFlow) {
//           return JSON.stringify({
//             success: false,
//             _blocked: true,
//             reason: "sales_flow",
//             message: "New sales lead — treat as new customer. Collect name, phone, email, then call create_ticket.",
//           });
//         }

//         const lookupArgs = { ...(args || {}) };
//         delete lookupArgs.phone;
//         if (!lookupArgs.email && !lookupArgs.name) {
//           return JSON.stringify({ success: false, message: "Email is required for customer lookup" });
//         }

//         if (lookupArgs.email && typeof lookupArgs.email === "string") {
//           const parsed = parseVoiceEmail(lookupArgs.email);
//           if (parsed) {
//             lookupArgs.email = parsed;
//           } else {
//             return JSON.stringify({
//               success: false,
//               _invalidEmail: true,
//               message: "Invalid email format — ask customer to spell the whole email from scratch.",
//             });
//           }
//         }

//         try {
//           const result = await customerLookup(lookupArgs);
//           if (result.success && result.customer) {
//             session.collected._emailVerifiedCustomerId = result.customer.id;
//             session.collected._registeredPhone = result.customer.phone || result.customer.phone_mobile || null;
//             session.collected._rp = session.collected._registeredPhone;
//             session.collected._phoneVerified = false;
//             session.collected.customer_id = result.customer.id;
//             sessions.set(session.id, session);
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
//           sessions.set(session.id, session);
//           return JSON.stringify({
//             ...result,
//             _emailCleared: true,
//             message: "No account found with that email. Please check and try again.",
//           });
//         } catch (e) {
//           return JSON.stringify({ success: false, error: e.message });
//         }
//       }

//       if (fn === "verify_phone") {
//         const { phone } = args || {};
//         if (!phone) return JSON.stringify({ success: false, verificationFailed: true, message: "No phone number provided." });
//         const emailCustomerId = session.collected._emailVerifiedCustomerId;
//         if (!emailCustomerId) return JSON.stringify({ success: false, verificationFailed: true, message: "Email verification must be completed first." });
//         const registeredPhone = session.collected._registeredPhone || session.collected._rp;
//         if (!registeredPhone) {
//           return JSON.stringify({ success: false, verificationFailed: true, message: "No phone number registered on this account." });
//         }
//         const normalize = normalizePhone && typeof normalizePhone === "function"
//           ? normalizePhone
//           : (p) => String(p || "").replace(/\D/g, "").replace(/^61(\d{9})$/, "0$1");
//         const normalizedInput = normalize(phone);
//         const normalizedRegistered = normalize(registeredPhone);
//         if (normalizedInput !== normalizedRegistered) {
//           return JSON.stringify({ success: false, verificationFailed: true, message: "Phone number does not match." });
//         }
//         session.collected._phoneVerified = true;
//         sessions.set(session.id, session);
//         return JSON.stringify({ success: true, verified: true, customer_id: emailCustomerId });
//       }

//       if (fn === "check_address_availability") {
//         try {
//           if (args.address) session.collected.address = args.address;
//           return await checkAddressAvailability(args, session);
//         } catch (err) {
//           return JSON.stringify({ success: false, error: err.message, address: args.address });
//         }
//       }

//       if (fn === "create_ticket") {
//         let fa = { ...args };
//         if (typeof fa.message === "string") fa.message = { message: fa.message };
//         const collected = session.collected || {};
//         const hasCustomerId = !!(fa.customer_id || collected.customer_id);
//         const hasLeadInterest = !!(collected.leadInterest || fa.leadInterest);
//         const isSupportTicket = hasCustomerId && !hasLeadInterest;

//         if (!isSupportTicket && !collected.email) {
//           salesStep = "email";
//           TimerManager.releaseFinalLock();
//           finalMessageLock = false;
//           session.finalLock = false;
//           return JSON.stringify({
//             success: false,
//             _blocked: true,
//             reason: "email_missing",
//             message: "Ask for email by voice spelling. Read back letter-by-letter and confirm with user before proceeding.",
//           });
//         }

//         const detailLines = [];
//         const fullName =
//           [collected._firstName, collected._lastName].filter(Boolean).join(" ") ||
//           collected.name ||
//           collected.preferredName;
//         if (fullName) detailLines.push(`Name: ${fullName}`);
//         if (collected.email) detailLines.push(`Email: ${collected.email}`);
//         if (collected.phone) detailLines.push(`Phone: ${collected.phone}`);
//         if (collected.address) detailLines.push(`Address: ${collected.address}`);
//         if (collected.networkPreference) detailLines.push(`Network: ${collected.networkPreference}`);
//         if (collected.residentialPreference) detailLines.push(`Type: ${collected.residentialPreference}`);
//         if (collected.leadInterest || fa.leadInterest) detailLines.push(`Selected Plan: ${collected.leadInterest || fa.leadInterest}`);

//         const detailsBlock = detailLines.length > 0
//           ? `\n\n--- Customer Details ---\n${detailLines.join("\n")}`
//           : "";
//         if (fa.message?.message) fa.message.message += detailsBlock;
//         else if (detailsBlock) fa.message = { message: detailsBlock.trim() };

//         let ticketResult;
//         try {
//           if (isSupportTicket) {
//             const r = await splynx.request("POST", "admin/support/tickets", objectToUrlEncoded(fa));
//             const emailResult = await sendTicketEmail(r.id, fa, collected, true);
//             ticketResult = { success: true, ticket_id: r.id, email_sent: emailResult.sent, _isSalesTicket: false, _ticketCompleted: true };
//           } else {
//             const emailResult = await sendTicketEmail(null, fa, collected, false);
//             ticketResult = { success: true, message: "Sales inquiry submitted successfully", email_sent: emailResult.sent, _isSalesTicket: true, _ticketCompleted: true };
//           }
//         } catch (err) {
//           ticketResult = { success: false, error: err.message || "Failed to process request", _ticketCompleted: true };
//         }

//         return JSON.stringify(ticketResult);
//       }

//       if (fn === "get_ticket_types")
//         return JSON.stringify({ success: true, types: await splynx.request("GET", "admin/support/tickets-types") });
//       if (fn === "get_ticket_groups")
//         return JSON.stringify({ success: true, groups: await splynx.request("GET", "admin/support/tickets-groups") });
//       if (fn === "get_ticket_statuses")
//         return JSON.stringify({ success: true, statuses: await splynx.request("GET", "admin/support/tickets-statuses") });

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
//         const state = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][openaiWs?.readyState] || "UNKNOWN";
//         console.log(`🎤 [${socket.id}] [OpenAI: ${state}]`);
//         lastAudioLog = now;
//       }
//       if (openaiWs?.readyState === WebSocket.OPEN) {
//         openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
//       }
//     });

//     socket.on("audio_done", () => {
//       console.log(`🔊 [FSM] Client audio_done — browser playback complete`);
//       assistantSpeaking = false;
//       elevenLabsStreaming = false;

//       const isPackage = lastResponseWasPackage;
//       lastResponseWasPackage = false;
//       TimerManager.startSilence(isPackage);
//     });

//     // ═══════════════ Structured Input ══════════════════
//     socket.on("structured_input", (payload) => {
//       if (!payload || !payload.field || !payload.value) return;
//       const { field, value } = payload;

//       if (field === "email") {
//         const parsedEmail = parseVoiceEmail(value) || value;
//         session.collected.email = parsedEmail;
//         // FIX BUG 1: Typed email is pre-verified — mark complete immediately
//         session.collected._emailStepComplete = true;
//         pendingEmailConfirmation = null;
//         emailConfirmationAsked = false;
//         sessions.set(session.id, session);
//         if (salesStep === "email") advanceSalesStep("email");

//         awaitingStructuredInput = false;
//         structuredInputField = null;

//         const userMessage = `My email is ${parsedEmail}`;
//         session.messages.push({ role: "user", content: userMessage });
//         sessions.set(session.id, session);
//         socket.emit("user_transcript", userMessage);

//         if (openaiWs?.readyState === WebSocket.OPEN) {
//           openaiWs.send(JSON.stringify({
//             type: "conversation.item.create",
//             item: {
//               type: "message",
//               role: "user",
//               content: [{ type: "input_text", text: userMessage }],
//             },
//           }));
//           const salesHint = buildSalesStepHint() || "";
//           const hint =
//             `Customer email confirmed via typed input: ${parsedEmail}. _emailStepComplete=true. ` +
//             `Do NOT ask about email again. Do NOT call extract_call_fields with email. ${salesHint}`;
//           openaiWs.send(JSON.stringify({
//             type: "conversation.item.create",
//             item: {
//               type: "message",
//               role: "user",
//               content: [{ type: "input_text", text: `[SYSTEM_CONTEXT]: ${hint}` }],
//             },
//           }));
//           scheduleResponseCreate();
//         }

//         socket.emit("structured_input_accepted", { field, value: parsedEmail });
//         socket.emit("status", "listening");
//         return;
//       }

//       TimerManager.clearSilence();
//       awaitingStructuredInput = false;
//       structuredInputField = null;

//       const userMessage = `My ${field} is ${value}`;
//       session.messages.push({ role: "user", content: userMessage });
//       sessions.set(session.id, session);
//       socket.emit("user_transcript", userMessage);

//       if (openaiWs?.readyState === WebSocket.OPEN) {
//         openaiWs.send(JSON.stringify({
//           type: "conversation.item.create",
//           item: {
//             type: "message",
//             role: "user",
//             content: [{ type: "input_text", text: userMessage }],
//           },
//         }));
//         scheduleResponseCreate();
//       }

//       socket.emit("structured_input_accepted", { field, value });
//       socket.emit("status", "listening");
//     });

//     // ═══════════════ Cleanup ════════════════
//     socket.on("disconnect", () => {
//       console.log(`🔌 Disconnected: ${socket.id}`);
//       TimerManager.clearAll();
//       closeElevenLabsWs();
//       if (openaiWs) try { openaiWs.close(); } catch (_) {}
//       sessions.delete(session.id);
//     });

//     // ═══════════════ Boot ════════════════
//     (async () => {
//       try {
//         console.log("⏳ Connecting OpenAI Realtime...");
//         await connectOpenAI();
//         console.log("✅ OpenAI connected! Waiting for ElevenLabs...");
//         socket.emit("connections_ready");

//         let elWaitMs = 0;
//         while (!elevenLabsReady && elWaitMs < 3000) {
//           await new Promise(r => setTimeout(r, 100));
//           elWaitMs += 100;
//         }
//         if (!elevenLabsReady) {
//           console.warn(`⚠️ ElevenLabs not ready after ${elWaitMs}ms — proceeding anyway`);
//         }

//         if (!session.hasGreeted) {
//           session.hasGreeted = true;
//           if (openaiWs?.readyState === WebSocket.OPEN) {
//             openaiWs.send(JSON.stringify({ type: "response.create" }));
//           }
//           sessions.set(session.id, session);
//         } else {
//           socket.emit("status", "listening");
//         }
//       } catch (err) {
//         console.error("❌ Connection failed:", err.message);
//         socket.emit("error_msg", "Failed to connect to AI services");
//       }
//     })();
//   });
// }
/////////////////////////////////////////////////////////////////////////////
// import WebSocket from "ws";
// // ═══════════════════════════════════════════════════════════════════════════
// //  DEBUG LOGGER — structured, timestamped, flow-aware
// // ═══════════════════════════════════════════════════════════════════════════
// function dbg(flow, step, status, data = {}) {
//   const ts = new Date().toISOString();
//   const dataParts = Object.entries(data)
//     .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
//     .join(" ");
//   console.log(
//     `[${ts}][FLOW:${flow}][STEP:${step}][STATUS:${status}] ${dataParts}`,
//   );
// }

// // ═══════════════════════════════════════════════════════════════════════════
// //  VOICE EMAIL CAPTURE — NATO PHONETIC PARSER + ASSEMBLER
// // ═══════════════════════════════════════════════════════════════════════════
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

// const NATO_MAP = {
//   zero: "0",
//   one: "1",
//   two: "2",
//   three: "3",
//   four: "4",
//   five: "5",
//   six: "6",
//   seven: "7",
//   eight: "8",
//   nine: "9",
//   niner: "9",
//   dash: "-",
//   hyphen: "-",
//   underscore: "_",
//   plus: "+",
// };

// function stripEmailFillers(text) {
//   if (!text) return text;
//   return text
//     .replace(
//       /\b(of\s+ai|for\s+example|for\s+instance|listen\s*,?|go\s+ahead|spelling\s+mode|letter\s+by\s+letter)\b/gi,
//       " ",
//     )
//     .replace(
//       /\b(okay|ok|my email(?: address| is)?|the email(?: address| is)?|email is|address is|it'?s|it is|so|well|right|sure|actually|basically|i think|i believe|let me|let's see|umm?|uh+|hmm?|ah+)\b/gi,
//       " ",
//     )
//     .replace(/\s{2,}/g, " ")
//     .trim();
// }

// function parseVoiceEmail(transcript) {
//   if (!transcript) return null;
//   let raw = transcript.toLowerCase().trim();

//   const directEmail = raw.match(/\b([^\s@]+@[^\s@]+\.[^\s@]{2,})\b/);
//   if (directEmail) return directEmail[1].toLowerCase();

//   raw = raw.replace(
//     /(?<![a-z0-9])([a-z])(?:-([a-z]))+(?![a-z0-9])/gi,
//     (match) => match.toLowerCase().split("-").join(" "),
//   );

//   raw = raw
//     .replace(/\bfull\s+stop\b/gi, " dot ")
//     .replace(/\bat\s+sign\b/gi, " at ")
//     .replace(/\bunder\s+score\b/gi, " underscore ")
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
//     if (tok === "at") {
//       parts.push("@");
//       continue;
//     }
//     if (tok === "dot" || tok === "period" || tok === "point") {
//       parts.push(".");
//       continue;
//     }
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
//     /\bat\s+(gmail|yahoo|hotmail|outlook|icloud|bigpond|optusnet|tpg|live|proton|bele)/.test(
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
//   const hyphenSpellingCount = (lower.match(/\b[a-z]-[a-z]\b/g) || []).length;
//   if (hyphenSpellingCount >= 2 && hasAt) return true;
//   return false;
// }

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

//     const session = mkSession();
//     let openaiWs = null;

//     let elevenLabsWs = null;
//     let elevenLabsReady = false;
//     let textBuffer = [];
//     let elevenLabsStreaming = false;
//     let elevenLabsInitialized = false;
//     let elevenLabsStreamingTimeout = null;

//     function safeSetElevenLabsStreaming(val) {
//       if (elevenLabsStreamingTimeout) {
//         clearTimeout(elevenLabsStreamingTimeout);
//         elevenLabsStreamingTimeout = null;
//       }
//       elevenLabsStreaming = val;
//       if (val) {
//         elevenLabsStreamingTimeout = setTimeout(() => {
//           if (elevenLabsStreaming) {
//             console.warn(
//               `⚠️ [EL] elevenLabsStreaming force-cleared after 15s safety timeout`,
//             );
//             elevenLabsStreaming = false;
//             assistantSpeaking = false;
//           }
//         }, 15000);
//       }
//     }

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

//     let lastResponseWasPackage = false;

//     // ─── Email confirmation state ──────────────────────────────────
//     let pendingEmailConfirmation = null;
//     let emailConfirmationAsked = false;

//     // ─── Ticket confirmation state (ALL FLOWS) ────────────────────
//     let pendingTicketConfirmation = false;
//     let pendingTicketArgs = null;

//     // ═══════════════════════════════════════════════════════════════
//     //  DEBUG STATE
//     // ═══════════════════════════════════════════════════════════════
//     function debugState(label = "state_snapshot") {
//       const c = session.collected || {};
//       dbg(c.intent || "unknown", label, "snapshot", {
//         salesStep,
//         pendingFunctionCalls,
//         isResponseActive,
//         assistantSpeaking,
//         elevenLabsStreaming,
//         elevenLabsReady,
//         intent: c.intent || "none",
//         leadInterest: c.leadInterest || "none",
//         websiteCheckDone: c._websiteCheckDone || false,
//         websiteCheckAsked: c._websiteCheckAsked || false,
//         "collected.email": c.email || "",
//         "collected.phone": c.phone || "",
//         _firstName: c._firstName || "",
//         _lastName: c._lastName || "",
//         _emailStepComplete: c._emailStepComplete || false,
//         pendingEmailConfirmation: pendingEmailConfirmation?.parsed || "",
//         emailConfirmationAsked,
//         pendingTicketConfirmation,
//         _ticketConfirmed: c._ticketConfirmed || false,
//       });
//     }

//     // ═══════════════════════════════════════════════════════════════
//     //  CENTRAL TIMER MANAGER
//     // ═══════════════════════════════════════════════════════════════
//     const TimerManager = (() => {
//       let _silenceTimer = null;
//       let _finalMessageTimer = null;
//       let _watchdogTimer = null;

//       const SILENCE_NORMAL_MS = 15000;
//       const SILENCE_PACKAGE_MS = 20000;
//       const WATCHDOG_MS = 8000;

//       function _clearSilence() {
//         if (_silenceTimer) {
//           clearTimeout(_silenceTimer);
//           _silenceTimer = null;
//           console.log(`⏱️  [TMgr] Silence timer CLEARED`);
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
//           if (assistantSpeaking) {
//             return;
//           }
//           if (pendingFunctionCalls > 0) {
//             return;
//           }
//           if (awaitingStructuredInput) return;
//           if (finalMessageLock || session.finalLock) return;
//           if (elevenLabsStreaming) {
//             return;
//           }

//           const timeoutMs = isPackage ? SILENCE_PACKAGE_MS : SILENCE_NORMAL_MS;
//           console.log(`⏱️  [TMgr] Silence timer START: ${timeoutMs / 1000}s`);

//           _silenceTimer = setTimeout(() => {
//             _silenceTimer = null;
//             if (awaitingStructuredInput) return;
//             if (finalMessageLock || session.finalLock) return;
//             if (pendingFunctionCalls > 0) return;
//             if (assistantSpeaking) return;
//             if (elevenLabsStreaming) return;

//             const nudgeText = isPackage
//               ? "[CRITICAL_SILENCE_NUDGE] User has NOT responded after you presented plans. ABSOLUTELY DO NOT auto-select or assume a plan. User MUST explicitly tell you which plan they want. Ask clearly: 'Which of these plans would you like to go with?' and WAIT for their explicit choice."
//               : "[SILENCE_NUDGE] The user has not responded. REPEAT your last question. Do NOT move forward.";

//             console.log(`⏰ [TMgr] Silence fired — nudging AI`);
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
//         },
//         clearSilence: _clearSilence,

//         startWatchdog() {
//           _clearWatchdog();
//           _watchdogTimer = setTimeout(() => {
//             _watchdogTimer = null;
//             if (!isResponseActive && pendingFunctionCalls === 0) {
//               console.warn(`⚠️ [TMgr] Watchdog fired — agent stuck`);
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
//           _clearFinalMessage();
//           _clearWatchdog();
//         },

//         get hasSilenceTimer() {
//           return _silenceTimer !== null;
//         },
//       };
//     })();

//     let finalMessageLock = false;

//     // ─── Sales step machine ────────────────────────────────────────
//     function initSalesStepMachine() {
//       if (salesStep !== null) {
//         return;
//       }
//       const c = session.collected || {};

//       if (c.leadInterest && c._websiteCheckDone) {
//         const hasFirstName =
//           c._firstName ||
//           c.preferredName ||
//           (c.name && c.name.trim().length >= 2);
//         const hasLastName =
//           c._lastName || (c.name && c.name.trim().split(/\s+/).length >= 2);

//         if (!hasFirstName) salesStep = "firstName";
//         else if (!hasLastName) salesStep = "lastName";
//         else if (!c.phone) salesStep = "phone";
//         else if (!c.email || !c._emailStepComplete) salesStep = "email";
//         else if (!c._ticketConfirmed) salesStep = "confirmTicket";
//         else salesStep = "createTicket";

//         dbg("sales", "initSalesStepMachine", "initialized", {
//           startStep: salesStep,
//         });
//       }
//     }

//     function advanceSalesStep(completedStep) {
//       const c = session.collected || {};
//       if (salesStep !== completedStep) {
//         return;
//       }

//       const order = [
//         "firstName",
//         "lastName",
//         "phone",
//         "email",
//         "confirmTicket",
//         "createTicket",
//         "done",
//       ];
//       const idx = order.indexOf(completedStep);
//       if (idx === -1) {
//         return;
//       }
//       const next = order[idx + 1];
//       if (!next) {
//         salesStep = "done";
//         return;
//       }

//       if (next === "lastName" && c._lastName) {
//         salesStep = "lastName";
//         advanceSalesStep("lastName");
//         return;
//       }
//       if (next === "phone" && c.phone) {
//         salesStep = "phone";
//         advanceSalesStep("phone");
//         return;
//       }
//       if (next === "email" && c.email && c._emailStepComplete) {
//         salesStep = "email";
//         advanceSalesStep("email");
//         return;
//       }
//       if (next === "confirmTicket" && c._ticketConfirmed) {
//         salesStep = "confirmTicket";
//         advanceSalesStep("confirmTicket");
//         return;
//       }

//       const hasName =
//         (c._firstName && c._lastName) ||
//         (c.name && c.name.trim().split(/\s+/).length >= 2) ||
//         (c._firstName && c.name) ||
//         c.preferredName;

//       if (
//         next === "createTicket" &&
//         hasName &&
//         c.phone &&
//         c.email &&
//         c._emailStepComplete &&
//         c._ticketConfirmed
//       ) {
//         salesStep = "createTicket";
//       } else if (
//         next === "confirmTicket" &&
//         hasName &&
//         c.phone &&
//         c.email &&
//         c._emailStepComplete
//       ) {
//         salesStep = "confirmTicket";
//       } else {
//         salesStep = next;
//       }

//       dbg("sales", "advanceSalesStep_RESULT", "advanced", {
//         from: completedStep,
//         to: salesStep,
//       });
//     }

//     function buildSalesStepHint() {
//       const c = session.collected || {};

//       const _logAndReturn = (label, val) => {
//         dbg("sales", "buildSalesStepHint_RETURN", label, {
//           salesStep,
//           hint: String(val || "").substring(0, 150),
//         });
//         return val;
//       };

//       if (
//         c.leadInterest &&
//         c._websiteCheckRequired &&
//         !c._websiteCheckDone &&
//         !c._websiteCheckAsked
//       ) {
//         return _logAndReturn(
//           "website_check_not_asked",
//           `SALES STEP [website_check]: You MUST ask: "Just out of curiosity — have you had a chance to check out our website and seen the plans or pricing?" Do NOT proceed to collect name, phone, or email until this question is asked and answered.`,
//         );
//       }

//       if (
//         c.leadInterest &&
//         c._websiteCheckRequired &&
//         c._websiteCheckAsked &&
//         !c._websiteCheckDone
//       ) {
//         return _logAndReturn(
//           "website_check_asked_awaiting_answer",
//           `SALES STEP [website_check_pending]: Website check was already asked. DO NOT ask again. Wait for customer to answer.`,
//         );
//       }

//       if (salesStep === null && c.leadInterest && c._websiteCheckDone) {
//         initSalesStepMachine();
//       }

//       if (!salesStep || salesStep === "done") {
//         return _logAndReturn("null_no_salesstep", null);
//       }

//       const name = c._firstName || c.preferredName || "";

//       switch (salesStep) {
//         case "firstName": {
//           if (c.preferredName || (c.name && c.name.trim().length >= 2)) {
//             const derivedFirst =
//               c.preferredName || c.name.trim().split(/\s+/)[0];
//             const INVALID = new Set([
//               "yes",
//               "yeah",
//               "no",
//               "nope",
//               "ok",
//               "okay",
//               "i",
//               "my",
//               "the",
//               "a",
//               "an",
//               "hi",
//               "hello",
//             ]);
//             if (
//               derivedFirst &&
//               derivedFirst.length >= 2 &&
//               !INVALID.has(derivedFirst.toLowerCase())
//             ) {
//               session.collected._firstName = derivedFirst;
//               sessions.set(session.id, session);
//               advanceSalesStep("firstName");
//               return buildSalesStepHint();
//             }
//           }
//           return _logAndReturn(
//             "step_firstName",
//             `[FLOW: sales][STEP: firstName][STATUS: pending] Ask ONLY for the customer's first name. Say something like "Could I start with your first name?" Say NOTHING else.`,
//           );
//         }

//         case "lastName": {
//           if (
//             !c._lastName &&
//             c.name &&
//             c.name.trim().split(/\s+/).length >= 2
//           ) {
//             const parts = c.name.trim().split(/\s+/);
//             const derivedLast = parts[parts.length - 1];
//             const INVALID = new Set([
//               "yes",
//               "yeah",
//               "no",
//               "nope",
//               "ok",
//               "okay",
//               "i",
//               "my",
//               "the",
//               "a",
//               "an",
//             ]);
//             if (
//               derivedLast &&
//               derivedLast.length >= 2 &&
//               !INVALID.has(derivedLast.toLowerCase())
//             ) {
//               session.collected._lastName = derivedLast;
//               sessions.set(session.id, session);
//               advanceSalesStep("lastName");
//               return buildSalesStepHint();
//             }
//           }
//           return _logAndReturn(
//             "step_lastName",
//             `[FLOW: sales][STEP: lastName][STATUS: pending] You have their first name (${c._firstName || "collected"}). Ask ONLY for their last name.`,
//           );
//         }

//         case "phone":
//           return _logAndReturn(
//             "step_phone",
//             `[FLOW: sales][STEP: phone][STATUS: pending] You have their name (${name}). Ask ONLY for their mobile phone number.`,
//           );

//         case "email": {
//           if (c._emailStepComplete) {
//             dbg(
//               "sales",
//               "buildSalesStepHint_email",
//               "already_confirmed_skipping",
//               {
//                 email: c.email,
//                 _emailStepComplete: true,
//               },
//             );
//             advanceSalesStep("email");
//             return buildSalesStepHint();
//           }

//           if (emailConfirmationAsked && pendingEmailConfirmation) {
//             return _logAndReturn(
//               "step_email_awaiting_confirmation",
//               `[FLOW: sales][STEP: email][STATUS: awaiting_confirmation] You already read the email back as "${pendingEmailConfirmation.parsed}". WAIT for the user to say YES or NO. Do NOT ask for the email again. Do NOT re-read it. Just wait.`,
//             );
//           }

//           return _logAndReturn(
//             "step_email_ask",
//             `[FLOW: sales][STEP: email][STATUS: pending] Ask for email: "Could I grab your email address? Please spell it letter by letter — for at the rate say 'at', for dots say 'dot'. Example: john dot doe at gmail dot com." Then read it back letter-by-letter and ask "Is that correct?" Only proceed after user confirms YES.`,
//           );
//         }

//         case "confirmTicket": {
//           const fullName =
//             [c._firstName, c._lastName].filter(Boolean).join(" ") ||
//             c.name ||
//             c.preferredName ||
//             "N/A";
//           return _logAndReturn(
//             "step_confirmTicket",
//             `[FLOW: sales][STEP: confirmTicket][STATUS: pending] ALL details have been collected. Now you MUST summarise and ask for confirmation before creating the ticket.
// Say something like: "Alright, so just to confirm — I have your name as ${fullName}, phone number ${c.phone || "on file"}, email ${c.email || "on file"}, and you're interested in the ${c.leadInterest || "selected plan"}${c.address ? " at " + c.address : ""}. Shall I go ahead and submit this for you?"
// WAIT for the customer to say YES or NO. Do NOT call create_ticket until they confirm.`,
//           );
//         }

//         case "createTicket": {
//           const missing = [];
//           if (!c._firstName && !c.name && !c.preferredName)
//             missing.push("name");
//           if (!c.phone) missing.push("phone");
//           if (!c.email) missing.push("email");
//           if (!c.leadInterest) missing.push("selected plan");

//           if (missing.length > 0) {
//             if (!c.phone) salesStep = "phone";
//             else if (!c.email || !c._emailStepComplete) salesStep = "email";
//             return buildSalesStepHint();
//           }

//           return _logAndReturn(
//             "step_createTicket_execute",
//             `[FLOW: sales][STEP: create_ticket][STATUS: execute] Customer has CONFIRMED they want to proceed. ALL required details collected:
// - Name: ${c._firstName || ""} ${c._lastName || ""} / ${c.name || ""}
// - Phone: ${c.phone}
// - Email: ${c.email}
// - Plan: ${c.leadInterest}
// - Address: ${c.address || "provided earlier"}

// STEP 1: Call extract_call_fields to save any recently collected details.
// STEP 2: THEN call create_ticket IMMEDIATELY. Do NOT say anything to the user first. CALL THE TOOLS.`,
//           );
//         }

//         default:
//           return _logAndReturn("unknown_step", null);
//       }
//     }

//     // ─── Ticket confirmation detection helpers ─────────────────────
//     function detectTicketConfirmation(text) {
//       if (!text) return null;
//       const lower = text.toLowerCase().trim();
//       if (
//         /\b(yes|yeah|yep|yup|sure|go ahead|go for it|submit|do it|please|absolutely|definitely|correct|confirmed|confirm|that's right|sounds good|perfect|let's do it|proceed)\b/.test(
//           lower,
//         )
//       )
//         return "yes";
//       if (
//         /\b(no|nope|wait|hold on|cancel|stop|don't|not yet|change|actually|hang on|let me think)\b/.test(
//           lower,
//         )
//       )
//         return "no";
//       return null;
//     }

//     function detectTicketConfirmationQuestion(text) {
//       if (!text) return false;
//       const lower = text.toLowerCase();
//       return (
//         (lower.includes("shall i") &&
//           (lower.includes("submit") ||
//             lower.includes("go ahead") ||
//             lower.includes("create"))) ||
//         (lower.includes("want me to") &&
//           (lower.includes("submit") ||
//             lower.includes("go ahead") ||
//             lower.includes("create"))) ||
//         (lower.includes("ready to") && lower.includes("submit")) ||
//         (lower.includes("go ahead and") &&
//           (lower.includes("submit") ||
//             lower.includes("create") ||
//             lower.includes("raise"))) ||
//         (lower.includes("should i") &&
//           (lower.includes("submit") ||
//             lower.includes("create") ||
//             lower.includes("raise")))
//       );
//     }

//     // ─── Raw phone buffer ──────────────────────────────────────────
//     let rawPhoneBuffer = null;
//     let rawPhoneBufferTimestamp = 0;
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
//         return;
//       }
//       if (responseCreatePending && !force) {
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

//       if (delayMs > 0) setTimeout(send, delayMs);
//       else send();
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

//     function wasLastAssistantMessageWebsiteCheck() {
//       const msgs = session.messages || [];
//       for (let i = msgs.length - 1; i >= 0; i--) {
//         if (msgs[i].role === "assistant") {
//           return detectWebsiteCheckQuestion(msgs[i].content || "");
//         }
//         if (msgs[i].role === "user") break;
//       }
//       return false;
//     }

//     function detectEmailReadbackQuestion(text) {
//       if (!text) return false;
//       const lower = text.toLowerCase();
//       return (
//         (lower.includes("is that correct") ||
//           lower.includes("correct?") ||
//           lower.includes("is that right") ||
//           lower.includes("shall i use")) &&
//         lower.includes("at") &&
//         (lower.includes("dot") || lower.includes("."))
//       );
//     }

//     function detectEmailConfirmation(text) {
//       if (!text) return null;
//       const lower = text.toLowerCase().trim();
//       if (
//         /\b(yes|yeah|yep|yup|correct|that's right|that is correct|that's correct|perfect|looks good|confirmed|confirm)\b/.test(
//           lower,
//         )
//       )
//         return "yes";
//       if (
//         /\b(no|nope|wrong|incorrect|that's wrong|that is wrong|change it|try again|re-spell|different)\b/.test(
//           lower,
//         )
//       )
//         return "no";
//       return null;
//     }

//     function detectSalesStepAnswer(text) {
//       if (
//         !salesStep ||
//         salesStep === "done" ||
//         salesStep === "createTicket" ||
//         salesStep === "confirmTicket"
//       )
//         return;

//       const c = session.collected || {};
//       if (!c._websiteCheckDone) {
//         return;
//       }

//       const INVALID_NAME_WORDS = new Set([
//         "yes",
//         "yeah",
//         "yep",
//         "no",
//         "nope",
//         "ok",
//         "okay",
//         "sure",
//         "right",
//         "alright",
//         "correct",
//         "true",
//         "false",
//         "i",
//         "my",
//         "the",
//         "a",
//         "an",
//         "hi",
//         "hello",
//         "hey",
//         "sorry",
//         "please",
//         "thank",
//         "thanks",
//       ]);

//       if (salesStep === "firstName") {
//         const words = text.trim().split(/\s+/);
//         const firstName = words[0]?.replace(/[^a-zA-Z'-]/g, "");
//         if (
//           firstName &&
//           firstName.length >= 2 &&
//           !INVALID_NAME_WORDS.has(firstName.toLowerCase())
//         ) {
//           session.collected._firstName = firstName;
//           sessions.set(session.id, session);
//           advanceSalesStep("firstName");
//         }
//       } else if (salesStep === "lastName") {
//         const words = text.trim().split(/\s+/);
//         const lastName = words[words.length - 1]?.replace(/[^a-zA-Z'-]/g, "");
//         if (
//           lastName &&
//           lastName.length >= 2 &&
//           !INVALID_NAME_WORDS.has(lastName.toLowerCase())
//         ) {
//           session.collected._lastName = lastName;
//           session.collected.name = `${c._firstName || ""} ${lastName}`.trim();
//           session.collected.preferredName = c._firstName || lastName;
//           sessions.set(session.id, session);
//           advanceSalesStep("lastName");
//         }
//       } else if (salesStep === "phone") {
//         const digits = text.replace(/\D/g, "");
//         if (digits.length >= 8) {
//           session.collected.phone = digits;
//           sessions.set(session.id, session);
//           advanceSalesStep("phone");
//         }
//       }
//     }

//     // ═══════════════════════════════════════════════════════════════
//     //  ElevenLabs — persistent single connection
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
//           elevenLabsInitialized = true;
//           if (textBuffer.length > 0) {
//             for (const text of textBuffer) sendTextToElevenLabs(text);
//             textBuffer = [];
//           }
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
//             safeSetElevenLabsStreaming(false);
//             socket.emit("audio_stream_complete");
//           }
//         } catch (err) {
//           console.error(`⚠️ [EL] Message parse error:`, err.message);
//         }
//       });

//       elWs.on("error", (err) => {
//         console.warn(`⚠️ [EL] WS error: ${err.message}`);
//         elevenLabsStreaming = false;
//         elevenLabsReady = false;
//         if (elevenLabsWs === elWs) {
//           setTimeout(() => {
//             if (elevenLabsWs === elWs || !elevenLabsWs)
//               openElevenLabsStream(true);
//           }, 500);
//         }
//       });

//       elWs.on("close", (code) => {
//         if (elevenLabsWs === elWs) {
//           elevenLabsReady = false;
//           elevenLabsStreaming = false;
//           setTimeout(() => {
//             if (!elevenLabsReady && elevenLabsWs === elWs)
//               openElevenLabsStream(true);
//           }, 200);
//         }
//       });

//       elevenLabsWs = elWs;
//     }

//     function interruptElevenLabsStream() {
//       safeSetElevenLabsStreaming(false);
//       textBuffer = [];
//       if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) {
//         openElevenLabsStream(true);
//         return;
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
//         elevenLabsStreaming = false;
//       } catch (e) {
//         elevenLabsReady = false;
//         openElevenLabsStream(true);
//       }
//     }

//     function sendTextToElevenLabs(text) {
//       if (!text) return;
//       if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) {
//         textBuffer.push(text);
//         return;
//       }
//       if (!elevenLabsReady) {
//         textBuffer.push(text);
//         return;
//       }
//       elevenLabsWs.send(JSON.stringify({ text, try_trigger_generation: true }));
//     }

//     function flushElevenLabsStream() {
//       if (elevenLabsWs?.readyState === WebSocket.OPEN && elevenLabsReady) {
//         elevenLabsWs.send(JSON.stringify({ text: " ", flush: true }));
//       }
//     }

//     function closeElevenLabsWs() {
//       if (elevenLabsWs) {
//         elevenLabsStreaming = false;
//         elevenLabsReady = false;
//         try {
//           if (elevenLabsWs.readyState === WebSocket.CONNECTING)
//             elevenLabsWs.terminate();
//           else if (elevenLabsWs.readyState === WebSocket.OPEN)
//             elevenLabsWs.close(1000);
//         } catch (err) {
//           /* ignore */
//         }
//         elevenLabsWs = null;
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
//             "\n\nPACKAGE PRESENTATION RULE (CRITICAL):" +
//             "\n- When presenting plans/packages to the customer, present ALL available options clearly." +
//             "\n- ABSOLUTELY DO NOT auto-select or assume which plan the customer wants." +
//             "\n- After presenting packages, ask explicitly: 'Which of these plans catches your eye?'" +
//             "\n- WAIT for the customer to explicitly say WHICH PLAN they choose." +
//             "\n\nTICKET CONFIRMATION RULE (CRITICAL - ALL FLOWS):" +
//             "\n- Before calling create_ticket, you MUST summarise ALL collected details and ask: 'Shall I go ahead and submit this for you?'" +
//             "\n- WAIT for the customer to explicitly say YES before calling create_ticket." +
//             "\n- If customer says NO or wants to change something, ask what they'd like to change." +
//             "\n- This applies to ALL flows: sales, support, accounts, and moving/relocating." +
//             "\n- NEVER call create_ticket without explicit customer confirmation." +
//             "\n\nEMAIL COLLECTION FLOW:" +
//             "\n1. Ask for email spelling letter by letter." +
//             "\n2. Parse and read back letter-by-letter: 'So that's s-h-a-u-n at b-e-l-e dot a-i — is that right?'" +
//             "\n3. Wait for YES or NO. If YES → call extract_call_fields with the email ONCE. If NO → ask to re-spell." +
//             "\n4. After extract_call_fields confirms email saved, do NOT call it again with the same email." +
//             "\n5. NEVER use NATO names when reading back. Spell s-h-a-u-n not sierra-hotel-alpha-uniform-november.";

//           openaiWs.send(
//             JSON.stringify({
//               type: "session.update",
//               session: {
//                 instructions,
//                 modalities: ["text"],
//                 input_audio_format: "pcm16",
//                 turn_detection: {
//                   type: "server_vad",
//                   threshold: 0.9,
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
//         case "session.updated":
//           break;

//         case "input_audio_buffer.speech_started": {
//           if (
//             awaitingStructuredInput ||
//             pendingFunctionCalls > 0 ||
//             session.finalLock ||
//             finalMessageLock
//           ) {
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
//           pendingPostDoneCreate = false;
//           pendingPostDoneHint = null;
//           break;
//         }

//         case "input_audio_buffer.speech_stopped":
//           socket.emit("status", "processing");
//           break;

//         case "conversation.item.input_audio_transcription.completed": {
//           if (!event.transcript) break;

//           const cleaned = normalizeText(event.transcript);
//           if (!cleaned) break;

//           console.log(`📊 [TRANSCRIPT] "${cleaned}"`);

//           TimerManager.clearWatchdog();

//           const looksLikeEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(cleaned);
//           const digitCount = (cleaned.match(/\d/g) || []).length;
//           const looksLikePhone = digitCount >= 6;
//           const looksLikeSpelling = looksLikeVoiceEmailSpelling(cleaned);
//           const isPurePhoneNumber =
//             looksLikePhone && !looksLikeEmail && !looksLikeSpelling;

//           if (
//             pendingFunctionCalls > 0 ||
//             finalMessageLock ||
//             session.finalLock
//           ) {
//             break;
//           }

//           if (assistantSpeaking) {
//             assistantSpeaking = false;
//           }

//           if (awaitingPhoneVerification && looksLikePhone) {
//             const digits = cleaned.replace(/\D/g, "");
//             if (digits.length >= 6) {
//               rawPhoneBuffer = digits;
//               rawPhoneBufferTimestamp = Date.now();
//             }
//           }

//           console.log(`👤 User: "${cleaned}"`);
//           socket.emit("user_transcript", cleaned);

//           // ══════════════════════════════════════════════════════════
//           // TICKET CONFIRMATION CHECK (ALL FLOWS) — runs FIRST
//           // ══════════════════════════════════════════════════════════
//           if (pendingTicketConfirmation) {
//             const ticketConfResult = detectTicketConfirmation(cleaned);
//             dbg(
//               session.collected?.intent || "unknown",
//               "ticket_confirmation_check",
//               ticketConfResult || "not_clear",
//               {
//                 cleaned: cleaned.substring(0, 60),
//               },
//             );

//             if (ticketConfResult === "yes") {
//               session.collected._ticketConfirmed = true;
//               pendingTicketConfirmation = false;
//               sessions.set(session.id, session);
//               dbg("ticket", "ticket_confirmed_YES", "proceeding", {});

//               if (salesStep === "confirmTicket") {
//                 advanceSalesStep("confirmTicket");
//               }

//               session.messages.push({ role: "user", content: cleaned });
//               sessions.set(session.id, session);
//               TimerManager.resetSilence();

//               if (pendingTicketArgs) {
//                 // Re-trigger create_ticket via LLM
//                 const hint = `Customer has CONFIRMED ticket creation. Call create_ticket NOW immediately. Do NOT ask anything else.`;
//                 scheduleResponseCreate(hint);
//               } else {
//                 const nextHint =
//                   buildSalesStepHint() ||
//                   "Customer confirmed. Call create_ticket NOW.";
//                 scheduleResponseCreate(nextHint);
//               }
//               break;
//             } else if (ticketConfResult === "no") {
//               pendingTicketConfirmation = false;
//               pendingTicketArgs = null;
//               delete session.collected._ticketConfirmed;
//               sessions.set(session.id, session);
//               dbg("ticket", "ticket_confirmed_NO", "asking_what_to_change", {});

//               session.messages.push({ role: "user", content: cleaned });
//               sessions.set(session.id, session);
//               TimerManager.resetSilence();
//               scheduleResponseCreate(
//                 `Customer said NO to ticket creation. Ask warmly: "No worries at all! What would you like to change?" Wait for their answer.`,
//               );
//               break;
//             }
//             // Not a clear yes/no — fall through
//           }

//           // ══════════════════════════════════════════════════════════
//           // EMAIL CONFIRMATION CHECK
//           // ══════════════════════════════════════════════════════════
//           if (
//             salesStep === "email" &&
//             emailConfirmationAsked &&
//             pendingEmailConfirmation
//           ) {
//             const confirmationResult = detectEmailConfirmation(cleaned);
//             dbg(
//               "sales",
//               "email_confirmation_check",
//               confirmationResult || "not_a_confirmation",
//               {
//                 cleaned: cleaned.substring(0, 60),
//                 pendingEmail: pendingEmailConfirmation.parsed,
//               },
//             );

//             if (confirmationResult === "yes") {
//               const confirmedEmail = pendingEmailConfirmation.parsed;
//               session.collected.email = confirmedEmail;
//               session.collected._emailStepComplete = true;
//               pendingEmailConfirmation = null;
//               emailConfirmationAsked = false;
//               sessions.set(session.id, session);
//               dbg("sales", "email_confirmed_YES", "advancing", {
//                 email: confirmedEmail,
//                 _emailStepComplete: true,
//               });
//               advanceSalesStep("email");
//               session.messages.push({ role: "user", content: cleaned });
//               sessions.set(session.id, session);
//               TimerManager.resetSilence();
//               const nextStepHint =
//                 buildSalesStepHint() || "Proceed to the next step.";
//               scheduleResponseCreate(
//                 `Email confirmed and saved as "${confirmedEmail}". ` +
//                   `_emailStepComplete=true. Do NOT call extract_call_fields with this email again. ` +
//                   `Do NOT ask about email again. ${nextStepHint}`,
//               );
//               break;
//             } else if (confirmationResult === "no") {
//               pendingEmailConfirmation = null;
//               emailConfirmationAsked = false;
//               delete session.collected.email;
//               delete session.collected._emailStepComplete;
//               sessions.set(session.id, session);
//               dbg("sales", "email_confirmed_NO", "clearing_and_re_asking", {});
//               session.messages.push({ role: "user", content: cleaned });
//               sessions.set(session.id, session);
//               TimerManager.resetSilence();
//               scheduleResponseCreate(
//                 `Email was REJECTED by user. Say "No worries, let me take that again" ` +
//                   `and ask them to re-spell their email letter by letter from the beginning.`,
//               );
//               break;
//             }
//           }

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
//             detectWebsiteCheckAnswer(cleaned) &&
//             wasLastAssistantMessageWebsiteCheck()
//           ) {
//             session.collected._websiteCheckDone = true;
//             sessions.set(session.id, session);
//             dbg("sales", "website_check_answered", "done", { answer: cleaned });
//             initSalesStepMachine();
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
//           safeSetElevenLabsStreaming(true);
//           assistantSpeaking = true;
//           socket.emit("status", "speaking");
//           TimerManager.clearWatchdog();
//           break;

//         case "response.text.delta":
//           if (event.delta) {
//             currentResponseHadOutput = true;
//             assistantTextBuffer += event.delta;
//             socket.emit("assistant_text_delta", event.delta);
//             sendTextToElevenLabs(event.delta);
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
//               assistantTextBuffer = "";
//               break;
//             }

//             lastAssistantText = event.text;
//             console.log(`🤖 AI: "${event.text.substring(0, 100)}..."`);
//             session.messages.push({ role: "assistant", content: event.text });
//             sessions.set(session.id, session);
//             socket.emit("assistant_text_done", event.text);

//             if (!session.collected.leadInterest) {
//               const planMatch =
//                 event.text.match(
//                   /\bOptiComm\s+[\w\s]+(?:Residential|Business|plan)\b/i,
//                 ) ||
//                 event.text.match(
//                   /\bNBN\s+[\w\s]+(?:Residential|Business|plan|Mbps)\b/i,
//                 );
//               if (planMatch) {
//                 const detectedPlan = planMatch[0].trim();
//                 session.collected.leadInterest = detectedPlan;
//                 session.collected._websiteCheckRequired = true;
//                 if (session.collected._websiteCheckDone === undefined) {
//                   session.collected._websiteCheckDone = false;
//                 }
//                 sessions.set(session.id, session);
//               }
//             }

//             flushElevenLabsStream();

//             if (detectPlanPresentation(event.text)) {
//               lastResponseWasPackage = true;
//             }

//             if (detectPhoneVerificationRequest(event.text)) {
//               awaitingPhoneVerification = true;
//               rawPhoneBuffer = null;
//               rawPhoneBufferTimestamp = 0;
//             }

//             if (
//               session.collected._websiteCheckRequired &&
//               !session.collected._websiteCheckDone &&
//               !session.collected._websiteCheckAsked &&
//               detectWebsiteCheckQuestion(event.text)
//             ) {
//               session.collected._websiteCheckAsked = true;
//               sessions.set(session.id, session);
//               dbg(
//                 "sales",
//                 "website_check_question_detected_from_ai_output",
//                 "marked_asked",
//                 {
//                   aiText: event.text.substring(0, 80),
//                 },
//               );
//             }

//             if (
//               salesStep === "email" &&
//               !session.collected._emailStepComplete &&
//               detectEmailReadbackQuestion(event.text) &&
//               pendingEmailConfirmation
//             ) {
//               emailConfirmationAsked = true;
//               dbg("sales", "email_readback_detected", "awaiting_confirmation", {
//                 pendingEmail: pendingEmailConfirmation.parsed,
//               });
//             }

//             // Detect when AI asks ticket confirmation question
//             if (
//               detectTicketConfirmationQuestion(event.text) &&
//               !session.collected._ticketConfirmed
//             ) {
//               pendingTicketConfirmation = true;
//               dbg(
//                 "ticket",
//                 "ticket_confirmation_question_detected",
//                 "awaiting_answer",
//                 {
//                   aiText: event.text.substring(0, 80),
//                 },
//               );
//             }
//           }
//           break;

//         case "response.done": {
//           isResponseActive = false;
//           TimerManager.clearWatchdog();
//           debugState("response_done_snapshot");

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
//             pendingFunctionCalls === 0 &&
//             !elevenLabsStreaming
//           ) {
//             assistantSpeaking = false;
//           }

//           if (
//             !hasFunctionCall &&
//             !hasTextOutput &&
//             pendingFunctionCalls === 0 &&
//             !finalMessageLock
//           ) {
//             if (cancelPending) {
//               cancelPending = false;
//               assistantSpeaking = false;
//               socket.emit("status", "listening");
//               if (pendingPostDoneCreate) {
//                 pendingPostDoneCreate = false;
//                 const hint = pendingPostDoneHint;
//                 pendingPostDoneHint = null;
//                 setTimeout(() => scheduleResponseCreate(hint), 50);
//               }
//               break;
//             }

//             if (elevenLabsStreaming) {
//               break;
//             }

//             emptyResponseCount++;
//             if (emptyResponseCount <= MAX_EMPTY_RETRIES) {
//               const retryDelay = 300 * Math.pow(2, emptyResponseCount - 1);
//               assistantSpeaking = false;
//               scheduleResponseCreate(null, retryDelay, true);
//             } else {
//               emptyResponseCount = 0;
//               assistantSpeaking = false;
//               socket.emit("status", "listening");
//             }
//             break;
//           }

//           emptyResponseCount = 0;

//           if (pendingPostDoneCreate && pendingFunctionCalls === 0) {
//             pendingPostDoneCreate = false;
//             const hint = pendingPostDoneHint;
//             pendingPostDoneHint = null;
//             setTimeout(() => scheduleResponseCreate(hint, 0, true), 50);
//             break;
//           }

//           if (!pendingFunctionCalls) socket.emit("status", "listening");
//           assistantTextBuffer = "";
//           currentResponseHadOutput = false;
//           break;
//         }

//         case "response.output_item.added":
//           if (event.item?.type === "function_call") {
//             const fnName = event.item.name || event.item.function_call?.name;
//             if (fnName === "create_ticket") {
//               TimerManager.startFinalLock(20000);
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
//             handleFunctionCall(event.item);
//           }
//           break;

//         case "error":
//           console.error("[WS-1] OpenAI error:", JSON.stringify(event.error));
//           socket.emit("error_msg", event.error?.message || "AI error");
//           isResponseActive = false;
//           pendingFunctionCalls = 0;
//           emptyResponseCount = 0;
//           responseCreatePending = false;
//           pendingPostDoneCreate = false;
//           elevenLabsStreaming = false;
//           assistantSpeaking = false;
//           // Clear ticket confirmation state on error
//           pendingTicketConfirmation = false;
//           pendingTicketArgs = null;
//           TimerManager.clearWatchdog();
//           socket.emit("status", "listening");
//           break;
//       }
//     }

//     // ═══════════════ Tool Execution ════════════════
//     async function handleFunctionCall(item) {
//       const { call_id, name: fn, arguments: argsStr } = item;
//       let args = safeParseJSON(argsStr) || {};

//       dbg(
//         session.collected?.intent || "unknown",
//         "handleFunctionCall_ENTRY",
//         "called",
//         {
//           fn,
//           argsPreview: JSON.stringify(args).substring(0, 150),
//           salesStep,
//         },
//       );

//       // ══════════════════════════════════════════════════════════════
//       // TICKET CONFIRMATION GATE (ALL FLOWS)
//       // Intercept create_ticket calls if user hasn't confirmed yet
//       // ══════════════════════════════════════════════════════════════
//       if (fn === "create_ticket" && !session.collected._ticketConfirmed) {
//         dbg("ticket", "create_ticket_BLOCKED", "awaiting_confirmation", {
//           argsPreview: JSON.stringify(args).substring(0, 150),
//         });

//         // Store the args for later re-execution
//         pendingTicketArgs = { call_id, args };
//         pendingTicketConfirmation = true;

//         // Release the final lock since we're not creating yet
//         TimerManager.releaseFinalLock();
//         finalMessageLock = false;
//         session.finalLock = false;

//         // Send a fake successful result so LLM doesn't retry
//         const fakeResult = JSON.stringify({
//           success: false,
//           _blocked: true,
//           reason: "confirmation_required",
//           message:
//             "You MUST ask the customer to confirm before creating the ticket. Summarise all details and ask: 'Shall I go ahead and submit this for you?'",
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

//         // Build a summary of collected details for the confirmation prompt
//         const c = session.collected || {};
//         const fullName =
//           [c._firstName, c._lastName].filter(Boolean).join(" ") ||
//           c.name ||
//           c.preferredName ||
//           "";
//         const detailSummary = [
//           fullName ? `Name: ${fullName}` : null,
//           c.phone ? `Phone: ${c.phone}` : null,
//           c.email ? `Email: ${c.email}` : null,
//           c.leadInterest ? `Plan: ${c.leadInterest}` : null,
//           c.address ? `Address: ${c.address}` : null,
//           c.issueSummary ? `Issue: ${c.issueSummary}` : null,
//         ]
//           .filter(Boolean)
//           .join(", ");

//         const confirmHint =
//           `[TICKET CONFIRMATION REQUIRED] create_ticket was blocked because customer has NOT confirmed yet. ` +
//           `You MUST summarise the details (${detailSummary}) and ask: "Shall I go ahead and submit this for you?" ` +
//           `WAIT for the customer to say YES. Do NOT call create_ticket again until they confirm.`;

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
//                     text: `[SYSTEM_CONTEXT]: ${confirmHint}`,
//                   },
//                 ],
//               },
//             }),
//           );
//           scheduleResponseCreate();
//         }
//         return;
//       }

//       // If create_ticket passes the gate (user confirmed), clear pending state
//       if (fn === "create_ticket" && session.collected._ticketConfirmed) {
//         pendingTicketArgs = null;
//         pendingTicketConfirmation = false;
//       }

//       // Redirect verify_phone for sales (non-verified) flow
//       if (
//         fn === "verify_phone" &&
//         !session.collected._emailVerifiedCustomerId
//       ) {
//         const llmPhone = args.phone;
//         const bufferPhone = rawPhoneBuffer;
//         const phoneToSave = llmPhone || bufferPhone;
//         rawPhoneBuffer = null;
//         rawPhoneBufferTimestamp = 0;
//         awaitingPhoneVerification = false;
//         if (phoneToSave) {
//           session.collected.phone =
//             String(phoneToSave).replace(/\D/g, "") || phoneToSave;
//           sessions.set(session.id, session);
//           if (salesStep === "phone") advanceSalesStep("phone");
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
//           const hint = `Phone number has been saved. ${salesHint}\n\nProceed to the next step immediately.`;
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
//         return;
//       }

//       if (fn === "verify_phone") {
//         if (rawPhoneBuffer) {
//           const llmPhone = args.phone
//             ? String(args.phone).replace(/\D/g, "")
//             : null;
//           const bufPhone = String(rawPhoneBuffer).replace(/\D/g, "");
//           const bufferAge = Date.now() - rawPhoneBufferTimestamp;
//           const bufferIsStale = bufferAge > 10000;
//           const llmHasFullNumber = llmPhone && llmPhone.length >= 10;
//           if (!bufferIsStale || !llmHasFullNumber) {
//             args = { ...args, phone: bufPhone };
//           }
//           rawPhoneBuffer = null;
//           rawPhoneBufferTimestamp = 0;
//           awaitingPhoneVerification = false;
//         } else if (
//           !args.phone ||
//           String(args.phone).replace(/\D/g, "").length < 6
//         ) {
//           const noPhoneResult = JSON.stringify({
//             success: false,
//             verificationFailed: false,
//             message:
//               "Could not extract phone number from speech. Ask the customer to repeat their number clearly.",
//           });
//           if (openaiWs?.readyState === WebSocket.OPEN) {
//             openaiWs.send(
//               JSON.stringify({
//                 type: "conversation.item.create",
//                 item: {
//                   type: "function_call_output",
//                   call_id,
//                   output: noPhoneResult,
//                 },
//               }),
//             );
//           }
//           pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
//           if (pendingFunctionCalls === 0) scheduleResponseCreate();
//           return;
//         }
//       }

//       console.log(`🔧 Tool: ${fn}`, JSON.stringify(args).substring(0, 200));

//       let result;
//       socket.emit("status", "processing");
//       TimerManager.clearSilence();
//       TimerManager.clearWatchdog();

//       if (openaiWs?.readyState === WebSocket.OPEN) {
//         openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
//       }

//       const toolTimeout = setTimeout(() => {
//         console.warn(`⚠️ Tool ${fn} timed out after 30s`);
//         pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
//         if (pendingFunctionCalls === 0) socket.emit("status", "listening");
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
//       )}.`;

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
//             systemHint += `\nNETWORK LOCK: Only ${session.networkShown} — NEVER mention the other network again.`;
//           }
//         }
//       }

//       if (fn === "customer_lookup") {
//         let parsedResult = null;
//         try {
//           parsedResult = JSON.parse(result);
//         } catch (_) {}

//         if (parsedResult?._blocked && parsedResult?.reason === "sales_flow") {
//           systemHint += `\nTOOL RESULT: customer_lookup blocked — new sales lead. Treat as new customer. Collect name, phone, email one at a time, then call create_ticket.`;
//         } else if (parsedResult?._invalidEmail) {
//           systemHint += `\nTOOL RESULT: Email format invalid. Ask customer to spell the whole email from scratch, letter by letter.`;
//         } else if (parsedResult?.success && parsedResult?.customer) {
//           systemHint += `\nTOOL RESULT: Email lookup succeeded. Say "Perfect, I can see that account." Then ask for phone number. When they give it, call verify_phone.`;
//           awaitingPhoneVerification = true;
//           rawPhoneBuffer = null;
//           rawPhoneBufferTimestamp = 0;
//         } else {
//           systemHint += `\nTOOL RESULT: Customer not found. Ask customer to re-spell their email from scratch.`;
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
//           systemHint += `\nTOOL RESULT: create_ticket BLOCKED — email missing. Ask for email NOW by voice spelling. Read back letter-by-letter. Confirm YES before proceeding.`;
//         } else if (parsedResult?.success) {
//           salesStep = "done";
//           // Clear ticket confirmation state after success
//           pendingTicketConfirmation = false;
//           pendingTicketArgs = null;
//           TimerManager.releaseFinalLock();
//           const ticketId = parsedResult.ticket_id;
//           const isSales = parsedResult._isSalesTicket === true || !ticketId;
//           if (isSales) {
//             systemHint += `\nTOOL RESULT: Sales enquiry submitted. Say: "Awesome, you're all set! Our sales team will be in touch via email shortly."`;
//           } else {
//             systemHint += `\nTOOL RESULT: Support ticket #${ticketId} created. Say: "Brilliant, all done! Ticket #${ticketId} raised — details sent via email."`;
//           }
//         } else {
//           TimerManager.releaseFinalLock();
//           systemHint += `\nTOOL RESULT: Ticket FAILED — ${parsedResult?.error || "unknown error"}. Apologise and suggest calling 1300 101 414.`;
//         }
//       }

//       if (fn === "extract_call_fields") {
//         const c = session.collected || {};

//         const shouldGate =
//           c.leadInterest &&
//           c._websiteCheckRequired &&
//           !c._websiteCheckAsked &&
//           !c._websiteCheckDone;
//         if (shouldGate) {
//           systemHint += `\nCRITICAL GATE: You MUST ask about website check first before collecting any other details.`;
//         }
//         if (
//           c.leadInterest &&
//           c._websiteCheckRequired &&
//           (c._websiteCheckAsked || c._websiteCheckDone)
//         ) {
//           systemHint += `\nWEBSITE CHECK DONE: Do NOT ask again. Proceed with order collection.`;
//         }

//         if (
//           salesStep === "createTicket" &&
//           c.phone &&
//           c.email &&
//           c.leadInterest &&
//           c._ticketConfirmed
//         ) {
//           systemHint += `\n\nCRITICAL: Customer has CONFIRMED. Call create_ticket RIGHT NOW. Do not say anything to the user first.`;
//         }

//         if (c._emailStepComplete) {
//           systemHint += `\nEMAIL ALREADY CONFIRMED (_emailStepComplete=true). Do NOT ask about email again. Do NOT call extract_call_fields with email again.`;
//         } else if (pendingEmailConfirmation && salesStep === "email") {
//           systemHint += `\nEMAIL PARSED as "${pendingEmailConfirmation.parsed}". Read it back letter-by-letter and ask "Is that correct?" Do NOT proceed until user says YES.`;
//         }

//         const stepHint = buildSalesStepHint();
//         if (stepHint) systemHint += `\n\n${stepHint}`;
//       }

//       if (fn === "send_portal_login_email") {
//         systemHint += `\nTOOL RESULT: Portal login email sent. Tell customer the request was sent and team will be in touch.`;
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

//         console.log(`📤 Tool complete (${fn}) — triggering response.create`);
//         scheduleResponseCreate();
//       }
//     }

//     async function execTool(fn, args) {
//       if (fn === "extract_call_fields") {
//         if (args.email && typeof args.email === "string") {
//           const parsed = parseVoiceEmail(args.email);
//           if (parsed) args.email = parsed;
//         }

//         applyExtractionToSession(session, args);
//         const c = session.collected || {};

//         if (salesStep === "firstName" && (args.preferredName || args.name)) {
//           const firstName = (args.preferredName || args.name || "").split(
//             " ",
//           )[0];
//           const INVALID_NAME_WORDS = new Set([
//             "yes",
//             "yeah",
//             "yep",
//             "no",
//             "nope",
//             "ok",
//             "okay",
//             "sure",
//             "right",
//             "alright",
//             "correct",
//             "true",
//             "false",
//             "i",
//             "my",
//             "the",
//             "a",
//             "an",
//           ]);
//           if (
//             firstName &&
//             firstName.length >= 2 &&
//             !INVALID_NAME_WORDS.has(firstName.toLowerCase())
//           ) {
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
//         if (salesStep === "phone" && args.phone) {
//           advanceSalesStep("phone");
//         }

//         if (args.leadInterest && !c.leadInterest) {
//           session.collected.leadInterest = args.leadInterest;
//           session.collected._websiteCheckRequired = true;
//           if (session.collected._websiteCheckDone === undefined) {
//             session.collected._websiteCheckDone = false;
//           }
//           sessions.set(session.id, session);
//         }

//         if (args.email) {
//           const parsedForExtract = parseVoiceEmail(args.email) || args.email;

//           if (session.collected._emailStepComplete) {
//             dbg("sales", "extract_email_GUARDED_step_complete", "no_op", {
//               parsedForExtract,
//               savedEmail: session.collected.email,
//               reason:
//                 "_emailStepComplete=true, not resetting confirmation state",
//             });
//           } else if (salesStep === "email") {
//             session.collected.email = parsedForExtract;
//             sessions.set(session.id, session);

//             if (!pendingEmailConfirmation) {
//               pendingEmailConfirmation = {
//                 raw: args.email,
//                 parsed: parsedForExtract,
//               };
//               emailConfirmationAsked = false;
//               dbg("sales", "email_saved_awaiting_confirmation", "new", {
//                 parsed: parsedForExtract,
//               });
//             } else if (pendingEmailConfirmation.parsed !== parsedForExtract) {
//               pendingEmailConfirmation = {
//                 raw: args.email,
//                 parsed: parsedForExtract,
//               };
//               emailConfirmationAsked = false;
//               dbg("sales", "email_updated_new_value", "updated", {
//                 parsed: parsedForExtract,
//               });
//             } else {
//               dbg("sales", "email_same_as_pending_SKIPPED", "no_op", {
//                 parsed: parsedForExtract,
//                 emailConfirmationAsked,
//                 reason: "same email, preserving confirmation state",
//               });
//             }
//           }
//         }

//         return JSON.stringify({ success: true });
//       }

//       if (fn === "customer_lookup") {
//         const isSalesFlow =
//           !!session.collected?.leadInterest &&
//           !session.collected?._emailVerifiedCustomerId;
//         if (isSalesFlow) {
//           return JSON.stringify({
//             success: false,
//             _blocked: true,
//             reason: "sales_flow",
//             message:
//               "New sales lead — treat as new customer. Collect name, phone, email, then call create_ticket.",
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
//             lookupArgs.email = parsed;
//           } else {
//             return JSON.stringify({
//               success: false,
//               _invalidEmail: true,
//               message:
//                 "Invalid email format — ask customer to spell the whole email from scratch.",
//             });
//           }
//         }

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
//           sessions.set(session.id, session);
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
//           return JSON.stringify({
//             success: false,
//             verificationFailed: true,
//             message: "Phone number does not match.",
//           });
//         }
//         session.collected._phoneVerified = true;
//         sessions.set(session.id, session);
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

//         if (!isSupportTicket && !collected.email) {
//           salesStep = "email";
//           TimerManager.releaseFinalLock();
//           finalMessageLock = false;
//           session.finalLock = false;
//           return JSON.stringify({
//             success: false,
//             _blocked: true,
//             reason: "email_missing",
//             message:
//               "Ask for email by voice spelling. Read back letter-by-letter and confirm with user before proceeding.",
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
//             const r = await splynx.request(
//               "POST",
//               "admin/support/tickets",
//               objectToUrlEncoded(fa),
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
//               _isSalesTicket: false,
//               _ticketCompleted: true,
//             };
//           } else {
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
//               _isSalesTicket: true,
//               _ticketCompleted: true,
//             };
//           }
//         } catch (err) {
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
//       elevenLabsStreaming = false;

//       const isPackage = lastResponseWasPackage;
//       lastResponseWasPackage = false;
//       TimerManager.startSilence(isPackage);
//     });

//     // ═══════════════ Structured Input ══════════════════
//     socket.on("structured_input", (payload) => {
//       if (!payload || !payload.field || !payload.value) return;
//       const { field, value } = payload;

//       if (field === "email") {
//         const parsedEmail = parseVoiceEmail(value) || value;
//         session.collected.email = parsedEmail;
//         session.collected._emailStepComplete = true;
//         pendingEmailConfirmation = null;
//         emailConfirmationAsked = false;
//         sessions.set(session.id, session);
//         if (salesStep === "email") advanceSalesStep("email");

//         awaitingStructuredInput = false;
//         structuredInputField = null;

//         const userMessage = `My email is ${parsedEmail}`;
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
//           const hint =
//             `Customer email confirmed via typed input: ${parsedEmail}. _emailStepComplete=true. ` +
//             `Do NOT ask about email again. Do NOT call extract_call_fields with email. ${salesHint}`;
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

//         socket.emit("structured_input_accepted", { field, value: parsedEmail });
//         socket.emit("status", "listening");
//         return;
//       }

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
//         await connectOpenAI();
//         console.log("✅ OpenAI connected! Waiting for ElevenLabs...");
//         socket.emit("connections_ready");

//         let elWaitMs = 0;
//         while (!elevenLabsReady && elWaitMs < 3000) {
//           await new Promise((r) => setTimeout(r, 100));
//           elWaitMs += 100;
//         }
//         if (!elevenLabsReady) {
//           console.warn(
//             `⚠️ ElevenLabs not ready after ${elWaitMs}ms — proceeding anyway`,
//           );
//         }

//         if (!session.hasGreeted) {
//           session.hasGreeted = true;
//           if (openaiWs?.readyState === WebSocket.OPEN) {
//             openaiWs.send(JSON.stringify({ type: "response.create" }));
//           }
//           sessions.set(session.id, session);
//         } else {
//           socket.emit("status", "listening");
//         }
//       } catch (err) {
//         console.error("❌ Connection failed:", err.message);
//         socket.emit("error_msg", "Failed to connect to AI services");
//       }
//     })();
//   });
// }
//////////////////////////////////////////
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

const NATO_MAP = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  niner: "9",
  dash: "-",
  hyphen: "-",
  underscore: "_",
  plus: "+",
};

function stripEmailFillers(text) {
  if (!text) return text;
  return text
    .replace(
      /\b(of\s+ai|for\s+example|for\s+instance|listen\s*,?|go\s+ahead|spelling\s+mode|letter\s+by\s+letter)\b/gi,
      " ",
    )
    .replace(
      /\b(okay|ok|my email(?: address| is)?|the email(?: address| is)?|email is|address is|it'?s|it is|so|well|right|sure|actually|basically|i think|i believe|let me|let's see|umm?|uh+|hmm?|ah+)\b/gi,
      " ",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseVoiceEmail(transcript) {
  if (!transcript) return null;
  let raw = transcript.toLowerCase().trim();

  const directEmail = raw.match(/\b([^\s@]+@[^\s@]+\.[^\s@]{2,})\b/);
  if (directEmail) return directEmail[1].toLowerCase();

  raw = raw.replace(
    /(?<![a-z0-9])([a-z])(?:-([a-z]))+(?![a-z0-9])/gi,
    (match) => match.toLowerCase().split("-").join(" "),
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
    if (tok === "at") {
      parts.push("@");
      continue;
    }
    if (tok === "dot" || tok === "period" || tok === "point") {
      parts.push(".");
      continue;
    }
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
  const hyphenSpellingCount = (lower.match(/\b[a-z]-[a-z]\b/g) || []).length;
  if (hyphenSpellingCount >= 2 && hasAt) return true;
  return false;
}

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

    const session = mkSession();
    let openaiWs = null;

    let elevenLabsWs = null;
    let elevenLabsReady = false;
    let textBuffer = [];
    let elevenLabsStreaming = false;
    let elevenLabsInitialized = false;
    let elevenLabsStreamingTimeout = null;

    function safeSetElevenLabsStreaming(val) {
      if (elevenLabsStreamingTimeout) {
        clearTimeout(elevenLabsStreamingTimeout);
        elevenLabsStreamingTimeout = null;
      }
      elevenLabsStreaming = val;
      if (val) {
        elevenLabsStreamingTimeout = setTimeout(() => {
          if (elevenLabsStreaming) {
            console.warn(
              `⚠️ [EL] elevenLabsStreaming force-cleared after 15s safety timeout`,
            );
            elevenLabsStreaming = false;
            assistantSpeaking = false;
          }
        }, 15000);
      }
    }

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

    // ─── Email confirmation state ──────────────────────────────────
    let pendingEmailConfirmation = null;
    let emailConfirmationAsked = false;

    // ─── Ticket confirmation state (ALL FLOWS) ────────────────────
    let pendingTicketConfirmation = false;
    let pendingTicketArgs = null;

    // ═══════════════════════════════════════════════════════════════
    //  DEBUG STATE
    // ═══════════════════════════════════════════════════════════════
    function debugState(label = "state_snapshot") {
      const c = session.collected || {};
      dbg(c.intent || "unknown", label, "snapshot", {
        salesStep,
        pendingFunctionCalls,
        isResponseActive,
        assistantSpeaking,
        elevenLabsStreaming,
        elevenLabsReady,
        intent: c.intent || "none",
        leadInterest: c.leadInterest || "none",
        websiteCheckDone: c._websiteCheckDone || false,
        websiteCheckAsked: c._websiteCheckAsked || false,
        "collected.email": c.email || "",
        "collected.phone": c.phone || "",
        _firstName: c._firstName || "",
        _lastName: c._lastName || "",
        _emailStepComplete: c._emailStepComplete || false,
        pendingEmailConfirmation: pendingEmailConfirmation?.parsed || "",
        emailConfirmationAsked,
        pendingTicketConfirmation,
        _ticketConfirmed: c._ticketConfirmed || false,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    //  CENTRAL TIMER MANAGER
    // ═══════════════════════════════════════════════════════════════
    const TimerManager = (() => {
      let _silenceTimer = null;
      let _finalMessageTimer = null;
      let _watchdogTimer = null;

      const SILENCE_NORMAL_MS = 15000;
      const SILENCE_PACKAGE_MS = 20000;
      const WATCHDOG_MS = 8000;

      function _clearSilence() {
        if (_silenceTimer) {
          clearTimeout(_silenceTimer);
          _silenceTimer = null;
          console.log(`⏱️  [TMgr] Silence timer CLEARED`);
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
          if (assistantSpeaking) {
            return;
          }
          if (pendingFunctionCalls > 0) {
            return;
          }
          if (awaitingStructuredInput) return;
          if (finalMessageLock || session.finalLock) return;
          if (elevenLabsStreaming) {
            return;
          }

          const timeoutMs = isPackage ? SILENCE_PACKAGE_MS : SILENCE_NORMAL_MS;
          console.log(`⏱️  [TMgr] Silence timer START: ${timeoutMs / 1000}s`);

          _silenceTimer = setTimeout(() => {
            _silenceTimer = null;
            if (awaitingStructuredInput) return;
            if (finalMessageLock || session.finalLock) return;
            if (pendingFunctionCalls > 0) return;
            if (assistantSpeaking) return;
            if (elevenLabsStreaming) return;

            const nudgeText = isPackage
              ? "[CRITICAL_SILENCE_NUDGE] User has NOT responded after you presented plans. ABSOLUTELY DO NOT auto-select or assume a plan. User MUST explicitly tell you which plan they want. Ask clearly: 'Which of these plans would you like to go with?' and WAIT for their explicit choice."
              : "[SILENCE_NUDGE] The user has not responded. REPEAT your last question. Do NOT move forward.";

            console.log(`⏰ [TMgr] Silence fired — nudging AI`);
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
        },
        clearSilence: _clearSilence,

        startWatchdog() {
          _clearWatchdog();
          _watchdogTimer = setTimeout(() => {
            _watchdogTimer = null;
            if (!isResponseActive && pendingFunctionCalls === 0) {
              console.warn(`⚠️ [TMgr] Watchdog fired — agent stuck`);
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
          _clearFinalMessage();
          _clearWatchdog();
        },

        get hasSilenceTimer() {
          return _silenceTimer !== null;
        },
      };
    })();

    let finalMessageLock = false;

    // ─── Sales step machine ────────────────────────────────────────
    function initSalesStepMachine() {
      if (salesStep !== null) {
        return;
      }
      const c = session.collected || {};

      if (c.leadInterest && c._websiteCheckDone) {
        const hasFirstName =
          c._firstName ||
          c.preferredName ||
          (c.name && c.name.trim().length >= 2);
        const hasLastName =
          c._lastName || (c.name && c.name.trim().split(/\s+/).length >= 2);

        if (!hasFirstName) salesStep = "firstName";
        else if (!hasLastName) salesStep = "lastName";
        else if (!c.phone) salesStep = "phone";
        else if (!c.email || !c._emailStepComplete) salesStep = "email";
        else if (!c._ticketConfirmed) salesStep = "confirmTicket";
        else salesStep = "createTicket";

        dbg("sales", "initSalesStepMachine", "initialized", {
          startStep: salesStep,
        });
      }
    }

    function advanceSalesStep(completedStep) {
      const c = session.collected || {};
      if (salesStep !== completedStep) {
        return;
      }

      const order = [
        "firstName",
        "lastName",
        "phone",
        "email",
        "confirmTicket",
        "createTicket",
        "done",
      ];
      const idx = order.indexOf(completedStep);
      if (idx === -1) {
        return;
      }
      const next = order[idx + 1];
      if (!next) {
        salesStep = "done";
        return;
      }

      if (next === "lastName" && c._lastName) {
        salesStep = "lastName";
        advanceSalesStep("lastName");
        return;
      }
      if (next === "phone" && c.phone) {
        salesStep = "phone";
        advanceSalesStep("phone");
        return;
      }
      if (next === "email" && c.email && c._emailStepComplete) {
        salesStep = "email";
        advanceSalesStep("email");
        return;
      }
      if (next === "confirmTicket" && c._ticketConfirmed) {
        salesStep = "confirmTicket";
        advanceSalesStep("confirmTicket");
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
        c._emailStepComplete &&
        c._ticketConfirmed
      ) {
        salesStep = "createTicket";
      } else if (
        next === "confirmTicket" &&
        hasName &&
        c.phone &&
        c.email &&
        c._emailStepComplete
      ) {
        salesStep = "confirmTicket";
      } else {
        salesStep = next;
      }

      dbg("sales", "advanceSalesStep_RESULT", "advanced", {
        from: completedStep,
        to: salesStep,
      });
    }

    function buildSalesStepHint() {
      const c = session.collected || {};

      const _logAndReturn = (label, val) => {
        dbg("sales", "buildSalesStepHint_RETURN", label, {
          salesStep,
          hint: String(val || "").substring(0, 150),
        });
        return val;
      };

      if (
        c.leadInterest &&
        c._websiteCheckRequired &&
        !c._websiteCheckDone &&
        !c._websiteCheckAsked
      ) {
        return _logAndReturn(
          "website_check_not_asked",
          `SALES STEP [website_check]: You MUST ask: "Just out of curiosity — have you had a chance to check out our website and seen the plans or pricing?" Do NOT proceed to collect name, phone, or email until this question is asked and answered.`,
        );
      }

      if (
        c.leadInterest &&
        c._websiteCheckRequired &&
        c._websiteCheckAsked &&
        !c._websiteCheckDone
      ) {
        return _logAndReturn(
          "website_check_asked_awaiting_answer",
          `SALES STEP [website_check_pending]: Website check was already asked. DO NOT ask again. Wait for customer to answer.`,
        );
      }

      if (salesStep === null && c.leadInterest && c._websiteCheckDone) {
        initSalesStepMachine();
      }

      if (!salesStep || salesStep === "done") {
        return _logAndReturn("null_no_salesstep", null);
      }

      const name = c._firstName || c.preferredName || "";

      switch (salesStep) {
        case "firstName": {
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
              advanceSalesStep("firstName");
              return buildSalesStepHint();
            }
          }
          return _logAndReturn(
            "step_firstName",
            `[FLOW: sales][STEP: firstName][STATUS: pending] Ask ONLY for the customer's first name. Say something like "Could I start with your first name?" Say NOTHING else.`,
          );
        }

        case "lastName": {
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
              advanceSalesStep("lastName");
              return buildSalesStepHint();
            }
          }
          return _logAndReturn(
            "step_lastName",
            `[FLOW: sales][STEP: lastName][STATUS: pending] You have their first name (${c._firstName || "collected"}). Ask ONLY for their last name.`,
          );
        }

        case "phone":
          return _logAndReturn(
            "step_phone",
            `[FLOW: sales][STEP: phone][STATUS: pending] You have their name (${name}). Ask ONLY for their mobile phone number.`,
          );

        case "email": {
          if (c._emailStepComplete) {
            dbg(
              "sales",
              "buildSalesStepHint_email",
              "already_confirmed_skipping",
              {
                email: c.email,
                _emailStepComplete: true,
              },
            );
            advanceSalesStep("email");
            return buildSalesStepHint();
          }

          if (emailConfirmationAsked && pendingEmailConfirmation) {
            return _logAndReturn(
              "step_email_awaiting_confirmation",
              `[FLOW: sales][STEP: email][STATUS: awaiting_confirmation] You already read the email back as "${pendingEmailConfirmation.parsed}". WAIT for the user to say YES or NO. Do NOT ask for the email again. Do NOT re-read it. Just wait.`,
            );
          }

          return _logAndReturn(
            "step_email_ask",
            `[FLOW: sales][STEP: email][STATUS: pending] Ask for email: "Could I grab your email address? Please spell it letter by letter — for at the rate say 'at', for dots say 'dot'. Example: john dot doe at gmail dot com." Then read it back letter-by-letter and ask "Is that correct?" Only proceed after user confirms YES.`,
          );
        }

        case "confirmTicket": {
          const fullName =
            [c._firstName, c._lastName].filter(Boolean).join(" ") ||
            c.name ||
            c.preferredName ||
            "N/A";
          return _logAndReturn(
            "step_confirmTicket",
            `[FLOW: sales][STEP: confirmTicket][STATUS: pending] ALL details have been collected. Now you MUST summarise and ask for confirmation before creating the ticket.
Say something like: "Alright, so just to confirm — I have your name as ${fullName}, phone number ${c.phone || "on file"}, email ${c.email || "on file"}, and you're interested in the ${c.leadInterest || "selected plan"}${c.address ? " at " + c.address : ""}. Shall I go ahead and submit this for you?"
WAIT for the customer to say YES or NO. Do NOT call create_ticket until they confirm.`,
          );
        }

        case "createTicket": {
          const missing = [];
          if (!c._firstName && !c.name && !c.preferredName)
            missing.push("name");
          if (!c.phone) missing.push("phone");
          if (!c.email) missing.push("email");
          if (!c.leadInterest) missing.push("selected plan");

          if (missing.length > 0) {
            if (!c.phone) salesStep = "phone";
            else if (!c.email || !c._emailStepComplete) salesStep = "email";
            return buildSalesStepHint();
          }

          return _logAndReturn(
            "step_createTicket_execute",
            `[FLOW: sales][STEP: create_ticket][STATUS: execute] Customer has CONFIRMED they want to proceed. ALL required details collected:
- Name: ${c._firstName || ""} ${c._lastName || ""} / ${c.name || ""}
- Phone: ${c.phone}
- Email: ${c.email}
- Plan: ${c.leadInterest}
- Address: ${c.address || "provided earlier"}

STEP 1: Call extract_call_fields to save any recently collected details.
STEP 2: THEN call create_ticket IMMEDIATELY. Do NOT say anything to the user first. CALL THE TOOLS.`,
          );
        }

        default:
          return _logAndReturn("unknown_step", null);
      }
    }

    // ─── Ticket confirmation detection helpers ─────────────────────
    function detectTicketConfirmation(text) {
      if (!text) return null;
      const lower = text.toLowerCase().trim();
      if (
        /\b(yes|yeah|yep|yup|sure|go ahead|go for it|submit|do it|please|absolutely|definitely|correct|confirmed|confirm|that's right|sounds good|perfect|let's do it|proceed)\b/.test(
          lower,
        )
      )
        return "yes";
      if (
        /\b(no|nope|wait|hold on|cancel|stop|don't|not yet|change|actually|hang on|let me think)\b/.test(
          lower,
        )
      )
        return "no";
      return null;
    }

    function detectTicketConfirmationQuestion(text) {
      if (!text) return false;
      const lower = text.toLowerCase();
      return (
        (lower.includes("shall i") &&
          (lower.includes("submit") ||
            lower.includes("go ahead") ||
            lower.includes("create"))) ||
        (lower.includes("want me to") &&
          (lower.includes("submit") ||
            lower.includes("go ahead") ||
            lower.includes("create"))) ||
        (lower.includes("ready to") && lower.includes("submit")) ||
        (lower.includes("go ahead and") &&
          (lower.includes("submit") ||
            lower.includes("create") ||
            lower.includes("raise"))) ||
        (lower.includes("should i") &&
          (lower.includes("submit") ||
            lower.includes("create") ||
            lower.includes("raise")))
      );
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
        return;
      }
      if (responseCreatePending && !force) {
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

      if (delayMs > 0) setTimeout(send, delayMs);
      else send();
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

    function wasLastAssistantMessageWebsiteCheck() {
      const msgs = session.messages || [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          return detectWebsiteCheckQuestion(msgs[i].content || "");
        }
        if (msgs[i].role === "user") break;
      }
      return false;
    }

    function detectEmailReadbackQuestion(text) {
      if (!text) return false;
      const lower = text.toLowerCase();
      return (
        (lower.includes("is that correct") ||
          lower.includes("correct?") ||
          lower.includes("is that right") ||
          lower.includes("shall i use")) &&
        lower.includes("at") &&
        (lower.includes("dot") || lower.includes("."))
      );
    }

    function detectEmailConfirmation(text) {
      if (!text) return null;
      const lower = text.toLowerCase().trim();
      if (
        /\b(yes|yeah|yep|yup|correct|that's right|that is correct|that's correct|perfect|looks good|confirmed|confirm)\b/.test(
          lower,
        )
      )
        return "yes";
      if (
        /\b(no|nope|wrong|incorrect|that's wrong|that is wrong|change it|try again|re-spell|different)\b/.test(
          lower,
        )
      )
        return "no";
      return null;
    }

    function detectSalesStepAnswer(text) {
      if (
        !salesStep ||
        salesStep === "done" ||
        salesStep === "createTicket" ||
        salesStep === "confirmTicket"
      )
        return;

      const c = session.collected || {};
      if (!c._websiteCheckDone) {
        return;
      }

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
        if (
          firstName &&
          firstName.length >= 2 &&
          !INVALID_NAME_WORDS.has(firstName.toLowerCase())
        ) {
          session.collected._firstName = firstName;
          sessions.set(session.id, session);
          advanceSalesStep("firstName");
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
          advanceSalesStep("lastName");
        }
      } else if (salesStep === "phone") {
        const digits = text.replace(/\D/g, "");
        if (digits.length >= 8) {
          session.collected.phone = digits;
          sessions.set(session.id, session);
          advanceSalesStep("phone");
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    //  ElevenLabs — persistent single connection
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
          elevenLabsInitialized = true;
          if (textBuffer.length > 0) {
            for (const text of textBuffer) sendTextToElevenLabs(text);
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
            safeSetElevenLabsStreaming(false);
            socket.emit("audio_stream_complete");
          }
        } catch (err) {
          console.error(`⚠️ [EL] Message parse error:`, err.message);
        }
      });

      elWs.on("error", (err) => {
        console.warn(`⚠️ [EL] WS error: ${err.message}`);
        elevenLabsStreaming = false;
        elevenLabsReady = false;
        if (elevenLabsWs === elWs) {
          setTimeout(() => {
            if (elevenLabsWs === elWs || !elevenLabsWs)
              openElevenLabsStream(true);
          }, 500);
        }
      });

      elWs.on("close", (code) => {
        if (elevenLabsWs === elWs) {
          elevenLabsReady = false;
          elevenLabsStreaming = false;
          setTimeout(() => {
            if (!elevenLabsReady && elevenLabsWs === elWs)
              openElevenLabsStream(true);
          }, 200);
        }
      });

      elevenLabsWs = elWs;
    }

    function interruptElevenLabsStream() {
      safeSetElevenLabsStreaming(false);
      textBuffer = [];
      if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) {
        openElevenLabsStream(true);
        return;
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
        elevenLabsStreaming = false;
      } catch (e) {
        elevenLabsReady = false;
        openElevenLabsStream(true);
      }
    }

    function sendTextToElevenLabs(text) {
      if (!text) return;
      if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) {
        textBuffer.push(text);
        return;
      }
      if (!elevenLabsReady) {
        textBuffer.push(text);
        return;
      }
      elevenLabsWs.send(JSON.stringify({ text, try_trigger_generation: true }));
    }

    function flushElevenLabsStream() {
      if (elevenLabsWs?.readyState === WebSocket.OPEN && elevenLabsReady) {
        elevenLabsWs.send(JSON.stringify({ text: " ", flush: true }));
      }
    }

    function closeElevenLabsWs() {
      if (elevenLabsWs) {
        elevenLabsStreaming = false;
        elevenLabsReady = false;
        try {
          if (elevenLabsWs.readyState === WebSocket.CONNECTING)
            elevenLabsWs.terminate();
          else if (elevenLabsWs.readyState === WebSocket.OPEN)
            elevenLabsWs.close(1000);
        } catch (err) {
          /* ignore */
        }
        elevenLabsWs = null;
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
            "\n- When presenting plans/packages to the customer, present ALL available options clearly." +
            "\n- ABSOLUTELY DO NOT auto-select or assume which plan the customer wants." +
            "\n- After presenting packages, ask explicitly: 'Which of these plans catches your eye?'" +
            "\n- WAIT for the customer to explicitly say WHICH PLAN they choose." +
            "\n\nTICKET CONFIRMATION RULE (CRITICAL - ALL FLOWS):" +
            "\n- Before calling create_ticket, you MUST summarise ALL collected details and ask: 'Shall I go ahead and submit this for you?'" +
            "\n- WAIT for the customer to explicitly say YES before calling create_ticket." +
            "\n- If customer says NO or wants to change something, ask what they'd like to change." +
            "\n- This applies to ALL flows: sales, support, accounts, and moving/relocating." +
            "\n- NEVER call create_ticket without explicit customer confirmation." +
            "\n\nEMAIL COLLECTION FLOW:" +
            "\n1. Ask for email spelling letter by letter." +
            "\n2. Parse and read back letter-by-letter: 'So that's s-h-a-u-n at b-e-l-e dot a-i — is that right?'" +
            "\n3. Wait for YES or NO. If YES → call extract_call_fields with the email ONCE. If NO → ask to re-spell." +
            "\n4. After extract_call_fields confirms email saved, do NOT call it again with the same email." +
            "\n5. NEVER use NATO names when reading back. Spell s-h-a-u-n not sierra-hotel-alpha-uniform-november.";

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
        case "session.updated":
          break;

        case "input_audio_buffer.speech_started": {
          if (
            awaitingStructuredInput ||
            pendingFunctionCalls > 0 ||
            session.finalLock ||
            finalMessageLock
          ) {
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

          console.log(`📊 [TRANSCRIPT] "${cleaned}"`);

          TimerManager.clearWatchdog();

          const looksLikeEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(cleaned);
          const digitCount = (cleaned.match(/\d/g) || []).length;
          const looksLikePhone = digitCount >= 6;
          const looksLikeSpelling = looksLikeVoiceEmailSpelling(cleaned);
          const isPurePhoneNumber =
            looksLikePhone && !looksLikeEmail && !looksLikeSpelling;

          if (
            pendingFunctionCalls > 0 ||
            finalMessageLock ||
            session.finalLock
          ) {
            break;
          }

          if (assistantSpeaking) {
            assistantSpeaking = false;
          }

          if (awaitingPhoneVerification && looksLikePhone) {
            const digits = cleaned.replace(/\D/g, "");
            if (digits.length >= 6) {
              rawPhoneBuffer = digits;
              rawPhoneBufferTimestamp = Date.now();
            }
          }

          console.log(`👤 User: "${cleaned}"`);
          socket.emit("user_transcript", cleaned);

          // ══════════════════════════════════════════════════════════
          // TICKET CONFIRMATION CHECK (ALL FLOWS) — runs FIRST
          // ══════════════════════════════════════════════════════════
          if (pendingTicketConfirmation) {
            const ticketConfResult = detectTicketConfirmation(cleaned);
            dbg(
              session.collected?.intent || "unknown",
              "ticket_confirmation_check",
              ticketConfResult || "not_clear",
              {
                cleaned: cleaned.substring(0, 60),
              },
            );

            if (ticketConfResult === "yes") {
              session.collected._ticketConfirmed = true;
              pendingTicketConfirmation = false;
              sessions.set(session.id, session);
              dbg("ticket", "ticket_confirmed_YES", "proceeding", {});

              if (salesStep === "confirmTicket") {
                advanceSalesStep("confirmTicket");
              }

              session.messages.push({ role: "user", content: cleaned });
              sessions.set(session.id, session);
              TimerManager.resetSilence();

              if (pendingTicketArgs) {
                // Re-trigger create_ticket via LLM
                const hint = `Customer has CONFIRMED ticket creation. Call create_ticket NOW immediately. Do NOT ask anything else.`;
                scheduleResponseCreate(hint);
              } else {
                const nextHint =
                  buildSalesStepHint() ||
                  "Customer confirmed. Call create_ticket NOW.";
                scheduleResponseCreate(nextHint);
              }
              break;
            } else if (ticketConfResult === "no") {
              pendingTicketConfirmation = false;
              pendingTicketArgs = null;
              delete session.collected._ticketConfirmed;
              sessions.set(session.id, session);
              dbg("ticket", "ticket_confirmed_NO", "asking_what_to_change", {});

              session.messages.push({ role: "user", content: cleaned });
              sessions.set(session.id, session);
              TimerManager.resetSilence();
              scheduleResponseCreate(
                `Customer said NO to ticket creation. Ask warmly: "No worries at all! What would you like to change?" Wait for their answer.`,
              );
              break;
            }
            // Not a clear yes/no — fall through
          }

          // ══════════════════════════════════════════════════════════
          // EMAIL CONFIRMATION CHECK
          // ══════════════════════════════════════════════════════════
          if (
            salesStep === "email" &&
            emailConfirmationAsked &&
            pendingEmailConfirmation
          ) {
            const confirmationResult = detectEmailConfirmation(cleaned);
            dbg(
              "sales",
              "email_confirmation_check",
              confirmationResult || "not_a_confirmation",
              {
                cleaned: cleaned.substring(0, 60),
                pendingEmail: pendingEmailConfirmation.parsed,
              },
            );

            if (confirmationResult === "yes") {
              const confirmedEmail = pendingEmailConfirmation.parsed;
              session.collected.email = confirmedEmail;
              session.collected._emailStepComplete = true;
              pendingEmailConfirmation = null;
              emailConfirmationAsked = false;
              sessions.set(session.id, session);
              dbg("sales", "email_confirmed_YES", "advancing", {
                email: confirmedEmail,
                _emailStepComplete: true,
              });
              advanceSalesStep("email");
              session.messages.push({ role: "user", content: cleaned });
              sessions.set(session.id, session);
              TimerManager.resetSilence();
              const nextStepHint =
                buildSalesStepHint() || "Proceed to the next step.";
              scheduleResponseCreate(
                `Email confirmed and saved as "${confirmedEmail}". ` +
                  `_emailStepComplete=true. Do NOT call extract_call_fields with this email again. ` +
                  `Do NOT ask about email again. ${nextStepHint}`,
              );
              break;
            } else if (confirmationResult === "no") {
              pendingEmailConfirmation = null;
              emailConfirmationAsked = false;
              delete session.collected.email;
              delete session.collected._emailStepComplete;
              sessions.set(session.id, session);
              dbg("sales", "email_confirmed_NO", "clearing_and_re_asking", {});
              session.messages.push({ role: "user", content: cleaned });
              sessions.set(session.id, session);
              TimerManager.resetSilence();
              scheduleResponseCreate(
                `Email was REJECTED by user. Say "No worries, let me take that again" ` +
                  `and ask them to re-spell their email letter by letter from the beginning.`,
              );
              break;
            }
          }

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
            detectWebsiteCheckAnswer(cleaned) &&
            wasLastAssistantMessageWebsiteCheck()
          ) {
            session.collected._websiteCheckDone = true;
            sessions.set(session.id, session);
            dbg("sales", "website_check_answered", "done", { answer: cleaned });
            initSalesStepMachine();
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
          safeSetElevenLabsStreaming(true);
          assistantSpeaking = true;
          socket.emit("status", "speaking");
          TimerManager.clearWatchdog();
          break;

        case "response.text.delta":
          if (event.delta) {
            currentResponseHadOutput = true;
            assistantTextBuffer += event.delta;
            socket.emit("assistant_text_delta", event.delta);
            sendTextToElevenLabs(event.delta);
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
              assistantTextBuffer = "";
              break;
            }

            lastAssistantText = event.text;
            console.log(`🤖 AI: "${event.text.substring(0, 100)}..."`);
            session.messages.push({ role: "assistant", content: event.text });
            sessions.set(session.id, session);
            socket.emit("assistant_text_done", event.text);

            if (!session.collected.leadInterest) {
              const planMatch =
                event.text.match(
                  /\bOptiComm\s+[\w\s]+(?:Residential|Business|plan)\b/i,
                ) ||
                event.text.match(
                  /\bNBN\s+[\w\s]+(?:Residential|Business|plan|Mbps)\b/i,
                );
              if (planMatch) {
                const detectedPlan = planMatch[0].trim();
                session.collected.leadInterest = detectedPlan;
                session.collected._websiteCheckRequired = true;
                if (session.collected._websiteCheckDone === undefined) {
                  session.collected._websiteCheckDone = false;
                }
                sessions.set(session.id, session);
              }
            }

            flushElevenLabsStream();

            if (detectPlanPresentation(event.text)) {
              lastResponseWasPackage = true;
            }

            if (detectPhoneVerificationRequest(event.text)) {
              awaitingPhoneVerification = true;
              rawPhoneBuffer = null;
              rawPhoneBufferTimestamp = 0;
            }

            if (
              session.collected._websiteCheckRequired &&
              !session.collected._websiteCheckDone &&
              !session.collected._websiteCheckAsked &&
              detectWebsiteCheckQuestion(event.text)
            ) {
              session.collected._websiteCheckAsked = true;
              sessions.set(session.id, session);
              dbg(
                "sales",
                "website_check_question_detected_from_ai_output",
                "marked_asked",
                {
                  aiText: event.text.substring(0, 80),
                },
              );
            }

            if (
              salesStep === "email" &&
              !session.collected._emailStepComplete &&
              detectEmailReadbackQuestion(event.text) &&
              pendingEmailConfirmation
            ) {
              emailConfirmationAsked = true;
              dbg("sales", "email_readback_detected", "awaiting_confirmation", {
                pendingEmail: pendingEmailConfirmation.parsed,
              });
            }

            // Detect when AI asks ticket confirmation question
            if (
              detectTicketConfirmationQuestion(event.text) &&
              !session.collected._ticketConfirmed
            ) {
              pendingTicketConfirmation = true;
              dbg(
                "ticket",
                "ticket_confirmation_question_detected",
                "awaiting_answer",
                {
                  aiText: event.text.substring(0, 80),
                },
              );
            }
          }
          break;

        case "response.done": {
          isResponseActive = false;
          TimerManager.clearWatchdog();
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

          if (
            !hasFunctionCall &&
            pendingFunctionCalls === 0 &&
            !elevenLabsStreaming
          ) {
            assistantSpeaking = false;
          }

          if (
            !hasFunctionCall &&
            !hasTextOutput &&
            pendingFunctionCalls === 0 &&
            !finalMessageLock
          ) {
            if (cancelPending) {
              cancelPending = false;
              assistantSpeaking = false;
              socket.emit("status", "listening");
              if (pendingPostDoneCreate) {
                pendingPostDoneCreate = false;
                const hint = pendingPostDoneHint;
                pendingPostDoneHint = null;
                setTimeout(() => scheduleResponseCreate(hint), 50);
              }
              break;
            }

            if (elevenLabsStreaming) {
              break;
            }

            emptyResponseCount++;
            if (emptyResponseCount <= MAX_EMPTY_RETRIES) {
              const retryDelay = 300 * Math.pow(2, emptyResponseCount - 1);
              assistantSpeaking = false;
              scheduleResponseCreate(null, retryDelay, true);
            } else {
              emptyResponseCount = 0;
              assistantSpeaking = false;
              socket.emit("status", "listening");
            }
            break;
          }

          emptyResponseCount = 0;

          if (pendingPostDoneCreate && pendingFunctionCalls === 0) {
            pendingPostDoneCreate = false;
            const hint = pendingPostDoneHint;
            pendingPostDoneHint = null;
            setTimeout(() => scheduleResponseCreate(hint, 0, true), 50);
            break;
          }

          if (!pendingFunctionCalls) socket.emit("status", "listening");
          assistantTextBuffer = "";
          currentResponseHadOutput = false;
          break;
        }

        case "response.output_item.added":
          if (event.item?.type === "function_call") {
            const fnName = event.item.name || event.item.function_call?.name;
            if (fnName === "create_ticket") {
              TimerManager.startFinalLock(20000);
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
          isResponseActive = false;
          pendingFunctionCalls = 0;
          emptyResponseCount = 0;
          responseCreatePending = false;
          pendingPostDoneCreate = false;
          elevenLabsStreaming = false;
          assistantSpeaking = false;
          // Clear ticket confirmation state on error
          pendingTicketConfirmation = false;
          pendingTicketArgs = null;
          TimerManager.clearWatchdog();
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
        },
      );

      // ══════════════════════════════════════════════════════════════
      // TICKET CONFIRMATION GATE (ALL FLOWS)
      // Intercept create_ticket calls if user hasn't confirmed yet
      // ══════════════════════════════════════════════════════════════
      if (fn === "create_ticket" && !session.collected._ticketConfirmed) {
        dbg("ticket", "create_ticket_BLOCKED", "awaiting_confirmation", {
          argsPreview: JSON.stringify(args).substring(0, 150),
        });

        // Store the args for later re-execution
        pendingTicketArgs = { call_id, args };
        pendingTicketConfirmation = true;

        // Release the final lock since we're not creating yet
        TimerManager.releaseFinalLock();
        finalMessageLock = false;
        session.finalLock = false;

        // Send a fake successful result so LLM doesn't retry
        const fakeResult = JSON.stringify({
          success: false,
          _blocked: true,
          reason: "confirmation_required",
          message:
            "You MUST ask the customer to confirm before creating the ticket. Summarise all details and ask: 'Shall I go ahead and submit this for you?'",
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

        // Build a summary of collected details for the confirmation prompt
        const c = session.collected || {};
        const fullName =
          [c._firstName, c._lastName].filter(Boolean).join(" ") ||
          c.name ||
          c.preferredName ||
          "";
        const detailSummary = [
          fullName ? `Name: ${fullName}` : null,
          c.phone ? `Phone: ${c.phone}` : null,
          c.email ? `Email: ${c.email}` : null,
          c.leadInterest ? `Plan: ${c.leadInterest}` : null,
          c.address ? `Address: ${c.address}` : null,
          c.issueSummary ? `Issue: ${c.issueSummary}` : null,
        ]
          .filter(Boolean)
          .join(", ");

        const confirmHint =
          `[TICKET CONFIRMATION REQUIRED] create_ticket was blocked because customer has NOT confirmed yet. ` +
          `You MUST summarise the details (${detailSummary}) and ask: "Shall I go ahead and submit this for you?" ` +
          `WAIT for the customer to say YES. Do NOT call create_ticket again until they confirm.`;

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
                    text: `[SYSTEM_CONTEXT]: ${confirmHint}`,
                  },
                ],
              },
            }),
          );
          scheduleResponseCreate();
        }
        return;
      }

      // If create_ticket passes the gate (user confirmed), clear pending state
      if (fn === "create_ticket" && session.collected._ticketConfirmed) {
        pendingTicketArgs = null;
        pendingTicketConfirmation = false;
      }

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
          const hint = `Phone number has been saved. ${salesHint}\n\nProceed to the next step immediately.`;
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

      if (fn === "verify_phone") {
        if (rawPhoneBuffer) {
          const llmPhone = args.phone
            ? String(args.phone).replace(/\D/g, "")
            : null;
          const bufPhone = String(rawPhoneBuffer).replace(/\D/g, "");
          const bufferAge = Date.now() - rawPhoneBufferTimestamp;
          const bufferIsStale = bufferAge > 10000;
          const llmHasFullNumber = llmPhone && llmPhone.length >= 10;
          if (!bufferIsStale || !llmHasFullNumber) {
            args = { ...args, phone: bufPhone };
          }
          rawPhoneBuffer = null;
          rawPhoneBufferTimestamp = 0;
          awaitingPhoneVerification = false;
        } else if (
          !args.phone ||
          String(args.phone).replace(/\D/g, "").length < 6
        ) {
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

      console.log(`🔧 Tool: ${fn}`, JSON.stringify(args).substring(0, 200));

      let result;
      socket.emit("status", "processing");
      TimerManager.clearSilence();
      TimerManager.clearWatchdog();

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
            systemHint += `\nTOOL RESULT: ${planCount} plans found on "${networkLabel}". Ask: "Is this for your home or a business?" before showing plans.`;
          } else if (planCount > 0 && !requiresFilter) {
            systemHint += `\nTOOL RESULT: ${planCount} plans found on "${networkLabel}". Present ALL plans NOW. Speak slowly using voice_description fields. End with "Which of these catches your eye?" LOCKED to ${networkLabel}.`;
          } else {
            systemHint += `\nTOOL RESULT: No plans returned. Tell customer and offer alternative help.`;
          }
          if (session.networkShown) {
            systemHint += `\nNETWORK LOCK: Only ${session.networkShown} — NEVER mention the other network again.`;
          }
        }
      }

      if (fn === "customer_lookup") {
        let parsedResult = null;
        try {
          parsedResult = JSON.parse(result);
        } catch (_) {}

        if (parsedResult?._blocked && parsedResult?.reason === "sales_flow") {
          systemHint += `\nTOOL RESULT: customer_lookup blocked — new sales lead. Treat as new customer. Collect name, phone, email one at a time, then call create_ticket.`;
        } else if (parsedResult?._invalidEmail) {
          systemHint += `\nTOOL RESULT: Email format invalid. Ask customer to spell the whole email from scratch, letter by letter.`;
        } else if (parsedResult?.success && parsedResult?.customer) {
          systemHint += `\nTOOL RESULT: Email lookup succeeded. Say "Perfect, I can see that account." Then ask for phone number. When they give it, call verify_phone.`;
          awaitingPhoneVerification = true;
          rawPhoneBuffer = null;
          rawPhoneBufferTimestamp = 0;
        } else {
          systemHint += `\nTOOL RESULT: Customer not found. Ask customer to re-spell their email from scratch.`;
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
          systemHint += `\nTOOL RESULT: create_ticket BLOCKED — email missing. Ask for email NOW by voice spelling. Read back letter-by-letter. Confirm YES before proceeding.`;
        } else if (parsedResult?.success) {
          salesStep = "done";
          // Clear ticket confirmation state after success
          pendingTicketConfirmation = false;
          pendingTicketArgs = null;
          TimerManager.releaseFinalLock();
          const ticketId = parsedResult.ticket_id;
          const isSales = parsedResult._isSalesTicket === true || !ticketId;
          if (isSales) {
            systemHint += `\nTOOL RESULT: Sales enquiry submitted. Say: "Awesome, you're all set! Our sales team will be in touch via email shortly."`;
          } else {
            systemHint += `\nTOOL RESULT: Support ticket #${ticketId} created. Say: "Brilliant, all done! Ticket #${ticketId} raised — details sent via email."`;
          }
        } else {
          TimerManager.releaseFinalLock();
          systemHint += `\nTOOL RESULT: Ticket FAILED — ${parsedResult?.error || "unknown error"}. Apologise and suggest calling 1300 101 414.`;
        }
      }

      if (fn === "extract_call_fields") {
        const c = session.collected || {};

        const shouldGate =
          c.leadInterest &&
          c._websiteCheckRequired &&
          !c._websiteCheckAsked &&
          !c._websiteCheckDone;
        if (shouldGate) {
          systemHint += `\nCRITICAL GATE: You MUST ask about website check first before collecting any other details.`;
        }
        if (
          c.leadInterest &&
          c._websiteCheckRequired &&
          (c._websiteCheckAsked || c._websiteCheckDone)
        ) {
          systemHint += `\nWEBSITE CHECK DONE: Do NOT ask again. Proceed with order collection.`;
        }

        if (
          salesStep === "createTicket" &&
          c.phone &&
          c.email &&
          c.leadInterest &&
          c._ticketConfirmed
        ) {
          systemHint += `\n\nCRITICAL: Customer has CONFIRMED. Call create_ticket RIGHT NOW. Do not say anything to the user first.`;
        }

        if (c._emailStepComplete) {
          systemHint += `\nEMAIL ALREADY CONFIRMED (_emailStepComplete=true). Do NOT ask about email again. Do NOT call extract_call_fields with email again.`;
        } else if (pendingEmailConfirmation && salesStep === "email") {
          systemHint += `\nEMAIL PARSED as "${pendingEmailConfirmation.parsed}". Read it back letter-by-letter and ask "Is that correct?" Do NOT proceed until user says YES.`;
        }

        const stepHint = buildSalesStepHint();
        if (stepHint) systemHint += `\n\n${stepHint}`;
      }

      if (fn === "send_portal_login_email") {
        systemHint += `\nTOOL RESULT: Portal login email sent. Tell customer the request was sent and team will be in touch.`;
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

        console.log(`📤 Tool complete (${fn}) — triggering response.create`);
        scheduleResponseCreate();
      }
    }

    async function execTool(fn, args) {
      if (fn === "extract_call_fields") {
        if (args.email && typeof args.email === "string") {
          const parsed = parseVoiceEmail(args.email);
          if (parsed) args.email = parsed;
        }

        applyExtractionToSession(session, args);
        const c = session.collected || {};

        if (salesStep === "firstName" && (args.preferredName || args.name)) {
          const firstName = (args.preferredName || args.name || "").split(
            " ",
          )[0];
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

        if (args.leadInterest && !c.leadInterest) {
          session.collected.leadInterest = args.leadInterest;
          session.collected._websiteCheckRequired = true;
          if (session.collected._websiteCheckDone === undefined) {
            session.collected._websiteCheckDone = false;
          }
          sessions.set(session.id, session);
        }

        if (args.email) {
          const parsedForExtract = parseVoiceEmail(args.email) || args.email;

          if (session.collected._emailStepComplete) {
            dbg("sales", "extract_email_GUARDED_step_complete", "no_op", {
              parsedForExtract,
              savedEmail: session.collected.email,
              reason:
                "_emailStepComplete=true, not resetting confirmation state",
            });
          } else if (salesStep === "email") {
            session.collected.email = parsedForExtract;
            sessions.set(session.id, session);

            if (!pendingEmailConfirmation) {
              pendingEmailConfirmation = {
                raw: args.email,
                parsed: parsedForExtract,
              };
              emailConfirmationAsked = false;
              dbg("sales", "email_saved_awaiting_confirmation", "new", {
                parsed: parsedForExtract,
              });
            } else if (pendingEmailConfirmation.parsed !== parsedForExtract) {
              pendingEmailConfirmation = {
                raw: args.email,
                parsed: parsedForExtract,
              };
              emailConfirmationAsked = false;
              dbg("sales", "email_updated_new_value", "updated", {
                parsed: parsedForExtract,
              });
            } else {
              dbg("sales", "email_same_as_pending_SKIPPED", "no_op", {
                parsed: parsedForExtract,
                emailConfirmationAsked,
                reason: "same email, preserving confirmation state",
              });
            }
          }
        }

        return JSON.stringify({ success: true });
      }

      if (fn === "customer_lookup") {
        const isSalesFlow =
          !!session.collected?.leadInterest &&
          !session.collected?._emailVerifiedCustomerId;
        if (isSalesFlow) {
          return JSON.stringify({
            success: false,
            _blocked: true,
            reason: "sales_flow",
            message:
              "New sales lead — treat as new customer. Collect name, phone, email, then call create_ticket.",
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
            lookupArgs.email = parsed;
          } else {
            return JSON.stringify({
              success: false,
              _invalidEmail: true,
              message:
                "Invalid email format — ask customer to spell the whole email from scratch.",
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
          sessions.set(session.id, session);
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
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "Phone number does not match.",
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

        if (!isSupportTicket && !collected.email) {
          salesStep = "email";
          TimerManager.releaseFinalLock();
          finalMessageLock = false;
          session.finalLock = false;
          return JSON.stringify({
            success: false,
            _blocked: true,
            reason: "email_missing",
            message:
              "Ask for email by voice spelling. Read back letter-by-letter and confirm with user before proceeding.",
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
              _isSalesTicket: true,
              _ticketCompleted: true,
            };
          }
        } catch (err) {
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
      elevenLabsStreaming = false;

      const isPackage = lastResponseWasPackage;
      lastResponseWasPackage = false;
      TimerManager.startSilence(isPackage);
    });

    // ═══════════════ Structured Input ══════════════════
    socket.on("structured_input", (payload) => {
      if (!payload || !payload.field || !payload.value) return;
      const { field, value } = payload;

      if (field === "email") {
        const parsedEmail = parseVoiceEmail(value) || value;
        session.collected.email = parsedEmail;
        session.collected._emailStepComplete = true;
        pendingEmailConfirmation = null;
        emailConfirmationAsked = false;
        sessions.set(session.id, session);
        if (salesStep === "email") advanceSalesStep("email");

        awaitingStructuredInput = false;
        structuredInputField = null;

        const userMessage = `My email is ${parsedEmail}`;
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
          const hint =
            `Customer email confirmed via typed input: ${parsedEmail}. _emailStepComplete=true. ` +
            `Do NOT ask about email again. Do NOT call extract_call_fields with email. ${salesHint}`;
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

        socket.emit("structured_input_accepted", { field, value: parsedEmail });
        socket.emit("status", "listening");
        return;
      }

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
        await connectOpenAI();
        console.log("✅ OpenAI connected! Waiting for ElevenLabs...");
        socket.emit("connections_ready");

        let elWaitMs = 0;
        while (!elevenLabsReady && elWaitMs < 3000) {
          await new Promise((r) => setTimeout(r, 100));
          elWaitMs += 100;
        }
        if (!elevenLabsReady) {
          console.warn(
            `⚠️ ElevenLabs not ready after ${elWaitMs}ms — proceeding anyway`,
          );
        }

        if (!session.hasGreeted) {
          session.hasGreeted = true;
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
