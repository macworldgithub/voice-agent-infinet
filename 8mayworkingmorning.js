import WebSocket from "ws";

// ═══════════════════════════════════════════════════════════════════════════
//  DEBUG LOGGER
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
//  VOICE EMAIL PARSER
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

function parseVoiceEmail(transcript) {
  if (!transcript) return null;
  let raw = transcript.toLowerCase().trim();
  const directEmail = raw.match(/\b([^\s@]+@[^\s@]+\.[^\s@]{2,})\b/);
  if (directEmail) return directEmail[1].toLowerCase();
  raw = raw.replace(/(?<![a-z0-9])([a-z])(?:-([a-z]))+(?![a-z0-9])/gi, (m) =>
    m.toLowerCase().split("-").join(" "),
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
  for (const [spoken, actual] of Object.entries(DOMAIN_SHORTCUTS)) {
    const re = new RegExp(`\\b${spoken.replace(/\./g, "\\.")}\\b`, "gi");
    raw = raw.replace(re, actual);
  }
  const tokens = raw.split(/\s+/).filter(Boolean);
  const parts = [];
  for (const tok of tokens) {
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
      if (NATO_MAP[tok] !== null) parts.push(NATO_MAP[tok]);
      continue;
    }
    if (/^[a-z]{2,6}(\.[a-z]{2,6})?$/.test(tok)) {
      parts.push(tok);
      continue;
    }
    parts.push(tok);
  }
  let email = parts
    .join("")
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
  const hasAt = words.includes("at"),
    hasDot =
      words.includes("dot") ||
      words.includes("period") ||
      words.includes("stop");
  const singleLetterCount = words.filter((w) => /^[a-z]$/.test(w)).length;
  if (hasAt && hasDot && singleLetterCount >= 2) return true;
  const hyphenCount = (lower.match(/\b[a-z]-[a-z]\b/g) || []).length;
  if (hyphenCount >= 2 && hasAt) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
export function setupRealtimeVoice(io, deps) {
  const {
    OPENAI_API_KEY,
    ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID,
    SYSTEM_PROMPT,
    tools,
    mkSession,
    sessions,
    normalizeText,
    normalizePhone,
    safeParseJSON,
    applyExtractionToSession,
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

    // ── ElevenLabs state ─────────────────────────────────────────────────
    let elevenLabsWs = null;
    let elevenLabsReady = false;
    let textBuffer = [];
    let elevenLabsStreaming = false;
    let elevenLabsStreamingTimeout = null;
    // FIX ISSUE 2: repriming flag prevents text being sent before re-prime flushes
    let elevenLabsRepriming = false;

    function safeSetElevenLabsStreaming(val) {
      if (elevenLabsStreamingTimeout) {
        clearTimeout(elevenLabsStreamingTimeout);
        elevenLabsStreamingTimeout = null;
      }
      elevenLabsStreaming = val;
      if (val) {
        elevenLabsStreamingTimeout = setTimeout(() => {
          if (elevenLabsStreaming) {
            console.warn(`⚠️ [EL] streaming force-cleared after 15s`);
            elevenLabsStreaming = false;
            assistantSpeaking = false;
          }
        }, 15000);
      }
    }

    // ── General state ─────────────────────────────────────────────────────
    let assistantTextBuffer = "";
    let pendingFunctionCalls = 0;
    let isResponseActive = false;
    let assistantSpeaking = false;
    let awaitingStructuredInput = false;
    const PCM_SAMPLE_RATE = 16000;
    let lastAssistantText = "";
    let emptyResponseCount = 0;
    const MAX_EMPTY_RETRIES = 3;
    let cancelPending = false;
    let currentResponseHadOutput = false;
    let pendingPostDoneCreate = false;
    let pendingPostDoneHint = null;
    let salesStep = null;
    let lastResponseWasPackage = false;
    let finalMessageLock = false;

    // ── Email confirmation state ──────────────────────────────────────────
    let pendingEmailConfirmation = null; // { raw, parsed }
    let emailConfirmationAsked = false;

    // ── Phone verification buffer ─────────────────────────────────────────
    let rawPhoneBuffer = null;
    let rawPhoneBufferTimestamp = 0;
    let awaitingPhoneVerification = false;

    // ── Response-create gate ──────────────────────────────────────────────
    let responseCreatePending = false;

    // FIX ISSUE 1: prevent double-fire of auto-ticket trigger
    let autoTicketScheduled = false;

    // ═══════════════════════════════════════════════════════════════════════
    //  DEBUG
    // ═══════════════════════════════════════════════════════════════════════
    function debugState(label = "snapshot") {
      const c = session.collected || {};
      dbg(c.intent || "unknown", label, "snapshot", {
        salesStep,
        pendingFunctionCalls,
        isResponseActive,
        assistantSpeaking,
        elReady: elevenLabsReady,
        elRepriming: elevenLabsRepriming,
        elStreaming: elevenLabsStreaming,
        email: c.email || "",
        phone: c.phone || "",
        _first: c._firstName || "",
        _emailDone: c._emailStepComplete || false,
        pendingEmail: pendingEmailConfirmation?.parsed || "",
        emailConfirmationAsked,
        autoTicketScheduled,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TIMER MANAGER
    // ═══════════════════════════════════════════════════════════════════════
    const TimerManager = (() => {
      let _st = null,
        _ft = null,
        _wt = null;
      const SNORM = 15000,
        SPKG = 20000,
        WDOG = 8000;
      const clrS = () => {
        if (_st) {
          clearTimeout(_st);
          _st = null;
        }
      };
      const clrF = () => {
        if (_ft) {
          clearTimeout(_ft);
          _ft = null;
        }
      };
      const clrW = () => {
        if (_wt) {
          clearTimeout(_wt);
          _wt = null;
        }
      };
      return {
        startSilence(pkg = false) {
          clrS();
          if (
            assistantSpeaking ||
            pendingFunctionCalls > 0 ||
            awaitingStructuredInput ||
            finalMessageLock ||
            session.finalLock ||
            elevenLabsStreaming
          )
            return;
          const ms = pkg ? SPKG : SNORM;
          console.log(`⏱️ Silence START ${ms / 1000}s`);
          _st = setTimeout(() => {
            _st = null;
            if (
              assistantSpeaking ||
              pendingFunctionCalls > 0 ||
              awaitingStructuredInput ||
              finalMessageLock ||
              session.finalLock ||
              elevenLabsStreaming
            )
              return;
            const nudge = pkg
              ? "[CRITICAL_SILENCE_NUDGE] User has NOT responded after plans presented. DO NOT auto-select. Ask: 'Which plan would you like?' and WAIT."
              : "[SILENCE_NUDGE] User has not responded. REPEAT your last question. Do NOT move forward.";
            if (openaiWs?.readyState === WebSocket.OPEN) {
              openaiWs.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "user",
                    content: [{ type: "input_text", text: nudge }],
                  },
                }),
              );
              scheduleResponseCreate();
            }
          }, ms);
        },
        resetSilence() {
          clrS();
        },
        clearSilence: clrS,
        startWatchdog() {
          clrW();
          _wt = setTimeout(() => {
            _wt = null;
            if (
              !isResponseActive &&
              pendingFunctionCalls === 0 &&
              openaiWs?.readyState === WebSocket.OPEN
            ) {
              console.warn(`⚠️ Watchdog fired`);
              openaiWs.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "user",
                    content: [
                      {
                        type: "input_text",
                        text: "[SYSTEM_CONTEXT]: Please respond immediately.",
                      },
                    ],
                  },
                }),
              );
              scheduleResponseCreate(null, 0, true);
            }
          }, WDOG);
        },
        clearWatchdog: clrW,
        startFinalLock(ms = 15000, cb) {
          clrF();
          finalMessageLock = true;
          session.finalLock = true;
          clrS();
          console.log(`🔒 finalLock ON (${ms}ms)`);
          _ft = setTimeout(() => {
            _ft = null;
            finalMessageLock = false;
            session.finalLock = false;
            console.log("🔓 finalLock auto-released");
            socket.emit("status", "listening");
            if (cb) cb();
          }, ms);
        },
        releaseFinalLock() {
          if (!finalMessageLock && !session.finalLock) return;
          finalMessageLock = false;
          session.finalLock = false;
          clrF();
          console.log("🔓 finalLock released");
        },
        clearAll() {
          clrS();
          clrF();
          clrW();
        },
        get hasSilenceTimer() {
          return _st !== null;
        },
      };
    })();

    // ═══════════════════════════════════════════════════════════════════════
    //  SALES STEP MACHINE
    // ═══════════════════════════════════════════════════════════════════════
    function initSalesStepMachine() {
      if (salesStep !== null) return;
      const c = session.collected || {};
      if (!c.leadInterest || !c._websiteCheckDone) return;
      const hasFirst =
        c._firstName ||
        c.preferredName ||
        (c.name && c.name.trim().length >= 2);
      const hasLast =
        c._lastName || (c.name && c.name.trim().split(/\s+/).length >= 2);
      if (!hasFirst) salesStep = "firstName";
      else if (!hasLast) salesStep = "lastName";
      else if (!c.phone) salesStep = "phone";
      else if (!c.email || !c._emailStepComplete) salesStep = "email";
      else salesStep = "createTicket";
      dbg("sales", "initSalesStepMachine", "init", { salesStep });
      // FIX ISSUE 1: auto-fire ticket if we land here with all details already present
      if (salesStep === "createTicket") scheduleAutoTicket();
    }

    // ─── FIX ISSUE 1: Auto-ticket trigger ────────────────────────────────
    // When salesStep reaches "createTicket", the agent must fire the ticket
    // WITHOUT waiting for user voice input. This function does that.
    function scheduleAutoTicket() {
      if (autoTicketScheduled) return;
      const c = session.collected || {};
      if (salesStep !== "createTicket") return;
      const hasName = c._firstName || c.name || c.preferredName;
      if (!hasName || !c.phone || !c.email || !c.leadInterest) {
        dbg("sales", "scheduleAutoTicket", "skipped", {
          hasName: !!hasName,
          phone: !!c.phone,
          email: !!c.email,
          plan: !!c.leadInterest,
        });
        return;
      }
      autoTicketScheduled = true;
      dbg("sales", "scheduleAutoTicket", "SCHEDULED", {
        name: c._firstName || c.name,
        phone: c.phone,
        email: c.email,
        plan: c.leadInterest,
      });
      // Small delay: let any in-flight response.done processing settle first
      setTimeout(() => {
        if (
          salesStep !== "createTicket" ||
          session.finalLock ||
          finalMessageLock ||
          isResponseActive
        ) {
          // If a response is already active (e.g. LLM already acknowledged the email),
          // queue for after it completes rather than dropping it
          if (isResponseActive) {
            pendingPostDoneCreate = true;
            pendingPostDoneHint =
              `All details collected. Say "Perfect, just a moment while I get that submitted for you..." ` +
              `then IMMEDIATELY call create_ticket. Do NOT ask any more questions.`;
          } else {
            autoTicketScheduled = false;
          }
          return;
        }
        if (openaiWs?.readyState !== WebSocket.OPEN) {
          autoTicketScheduled = false;
          return;
        }
        const hint = buildSalesStepHint() || "";
        console.log("🎟️ AUTO-TICKET: firing automatically");
        openaiWs.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    `[SYSTEM_CONTEXT]: ${hint}\n\n` +
                    `All required details are now collected (name, phone, email, plan). ` +
                    `Say something warm like "Perfect, just bear with me a moment while I get that submitted for you..." ` +
                    `then IMMEDIATELY call create_ticket. Do NOT wait for user input. Do NOT ask any more questions.`,
                },
              ],
            },
          }),
        );
        scheduleResponseCreate(null, 0, true);
      }, 500);
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
        c._emailStepComplete
      ) {
        salesStep = "createTicket";
      } else {
        salesStep = next;
      }
      dbg("sales", "advanceSalesStep", "advanced", {
        from: completedStep,
        to: salesStep,
      });
      // FIX ISSUE 1: auto-trigger ticket as soon as step becomes createTicket
      if (salesStep === "createTicket") scheduleAutoTicket();
    }

    function buildSalesStepHint() {
      const c = session.collected || {};
      const _log = (label, val) => {
        dbg("sales", "hint", label, {
          salesStep,
          val: String(val || "").substring(0, 100),
        });
        return val;
      };

      if (
        c.leadInterest &&
        c._websiteCheckRequired &&
        !c._websiteCheckDone &&
        !c._websiteCheckAsked
      )
        return _log(
          "website_check_unasked",
          `SALES STEP [website_check]: MUST ask "Just out of curiosity — have you had a chance to check out our website and seen the plans or pricing?" before collecting name/phone/email.`,
        );
      if (
        c.leadInterest &&
        c._websiteCheckRequired &&
        c._websiteCheckAsked &&
        !c._websiteCheckDone
      )
        return _log(
          "website_check_pending",
          `SALES STEP [website_check_pending]: Already asked. DO NOT ask again. Wait for answer.`,
        );

      if (salesStep === null && c.leadInterest && c._websiteCheckDone)
        initSalesStepMachine();
      if (!salesStep || salesStep === "done") return _log("done", null);

      const name = c._firstName || c.preferredName || "";
      switch (salesStep) {
        case "firstName": {
          if (c.preferredName || (c.name && c.name.trim().length >= 2)) {
            const d = c.preferredName || c.name.trim().split(/\s+/)[0];
            const INV = new Set([
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
            if (d && d.length >= 2 && !INV.has(d.toLowerCase())) {
              session.collected._firstName = d;
              sessions.set(session.id, session);
              advanceSalesStep("firstName");
              return buildSalesStepHint();
            }
          }
          return _log(
            "firstName",
            `[FLOW:sales][STEP:firstName][STATUS:pending] Ask ONLY for first name.`,
          );
        }
        case "lastName": {
          if (
            !c._lastName &&
            c.name &&
            c.name.trim().split(/\s+/).length >= 2
          ) {
            const parts = c.name.trim().split(/\s+/);
            const d = parts[parts.length - 1];
            const INV = new Set([
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
            if (d && d.length >= 2 && !INV.has(d.toLowerCase())) {
              session.collected._lastName = d;
              sessions.set(session.id, session);
              advanceSalesStep("lastName");
              return buildSalesStepHint();
            }
          }
          return _log(
            "lastName",
            `[FLOW:sales][STEP:lastName][STATUS:pending] Have first name (${c._firstName || "?"}). Ask ONLY for last name.`,
          );
        }
        case "phone":
          return _log(
            "phone",
            `[FLOW:sales][STEP:phone][STATUS:pending] Have name (${name}). Ask ONLY for mobile number.`,
          );
        case "email": {
          if (c._emailStepComplete) {
            advanceSalesStep("email");
            return buildSalesStepHint();
          }
          if (emailConfirmationAsked && pendingEmailConfirmation)
            return _log(
              "email_wait",
              `[FLOW:sales][STEP:email][STATUS:awaiting_confirmation] Already read back "${pendingEmailConfirmation.parsed}". WAIT for YES or NO. Do NOT re-ask.`,
            );
          return _log(
            "email_ask",
            `[FLOW:sales][STEP:email][STATUS:pending] Ask for email letter by letter. Read back letter-by-letter. Ask "Is that correct?" Only proceed after YES.`,
          );
        }
        case "createTicket": {
          const miss = [];
          if (!c._firstName && !c.name && !c.preferredName) miss.push("name");
          if (!c.phone) miss.push("phone");
          if (!c.email) miss.push("email");
          if (!c.leadInterest) miss.push("plan");
          if (miss.length > 0) {
            if (!c.phone) salesStep = "phone";
            else if (!c.email || !c._emailStepComplete) salesStep = "email";
            autoTicketScheduled = false;
            return buildSalesStepHint();
          }
          return _log(
            "createTicket",
            `[FLOW:sales][STEP:create_ticket][STATUS:execute]\n` +
              `Name: ${c._firstName || ""} ${c._lastName || ""} | Phone: ${c.phone} | Email: ${c.email} | Plan: ${c.leadInterest}\n` +
              `Say "Perfect, just bear with me a moment while I get that submitted for you..." ` +
              `then IMMEDIATELY call create_ticket. Do NOT ask any more questions.`,
          );
        }
        default:
          return _log("unknown", null);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SCHEDULE RESPONSE CREATE
    // ═══════════════════════════════════════════════════════════════════════
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
      if (responseCreatePending && !force) return;
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
        const combined = [contextHint, salesHint].filter(Boolean).join("\n\n");
        if (combined)
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [
                  { type: "input_text", text: `[SYSTEM_CONTEXT]: ${combined}` },
                ],
              },
            }),
          );
        console.log("📤 response.create");
        openaiWs.send(JSON.stringify({ type: "response.create" }));
        TimerManager.startWatchdog();
      };
      if (delayMs > 0) setTimeout(send, delayMs);
      else send();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  DETECTION HELPERS
    // ═══════════════════════════════════════════════════════════════════════
    function detectPhoneVerificationRequest(text) {
      if (!text) return false;
      const l = text.toLowerCase(),
        c = session.collected || {};
      if (!c._emailVerifiedCustomerId || c._phoneVerified) return false;
      return (
        l.includes("phone") ||
        l.includes("contact number") ||
        l.includes("mobile number") ||
        l.includes("number on the account")
      );
    }
    function mapOrdinalNetworkChoice(text) {
      const t = (text || "").toLowerCase().trim();
      if (/\bnbn\b/.test(t) || /\b(opti\s*comm|opticomm)\b/.test(t))
        return null;
      if (/\b(first|1st|one|1|option\s*1|the\s*first)\b/.test(t)) return "NBN";
      if (/\b(second|2nd|two|2|option\s*2|the\s*second|to)\b/.test(t))
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
            t.includes("nbn or opticomm")
          );
        }
        if (msgs[i].role === "user") break;
      }
      return false;
    }
    function detectPlanPresentation(text) {
      if (!text) return false;
      const l = text.toLowerCase();
      return (
        (l.includes("mbps") && (l.includes("$") || l.includes("per month"))) ||
        l.includes("catches your eye") ||
        l.includes("here are the plans")
      );
    }
    function detectWebsiteCheckQuestion(text) {
      if (!text) return false;
      const l = text.toLowerCase();
      return (
        l.includes("check out our website") ||
        l.includes("visited our website") ||
        l.includes("had a chance to check out") ||
        l.includes("seen the plans or pricing") ||
        (l.includes("website") &&
          (l.includes("plans") || l.includes("pricing")))
      );
    }
    function detectWebsiteCheckAnswer(text) {
      if (!text) return false;
      const l = text.toLowerCase().trim();
      if (
        /\b(yes|yeah|yep|yup|i have|i did|already|looked|checked|seen|saw|visited)\b/.test(
          l,
        )
      )
        return true;
      if (/\b(no|nope|not yet|haven't|didn't|i haven't|i didn't)\b/.test(l))
        return true;
      return false;
    }
    function wasLastAssistantMessageWebsiteCheck() {
      const msgs = session.messages || [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant")
          return detectWebsiteCheckQuestion(msgs[i].content || "");
        if (msgs[i].role === "user") break;
      }
      return false;
    }
    function detectEmailReadbackQuestion(text) {
      if (!text) return false;
      const l = text.toLowerCase();
      return (
        (l.includes("is that correct") ||
          l.includes("correct?") ||
          l.includes("is that right")) &&
        l.includes("at") &&
        (l.includes("dot") || l.includes("."))
      );
    }
    function detectEmailConfirmation(text) {
      if (!text) return null;
      const l = text.toLowerCase().trim();
      if (
        /\b(yes|yeah|yep|yup|correct|that's right|that is correct|perfect|looks good|confirmed|confirm)\b/.test(
          l,
        )
      )
        return "yes";
      if (
        /\b(no|nope|wrong|incorrect|that's wrong|change it|try again|re-spell|different)\b/.test(
          l,
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
        salesStep === "email"
      )
        return;
      const c = session.collected || {};
      if (!c._websiteCheckDone) return;
      const INV = new Set([
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
        const f = text
          .trim()
          .split(/\s+/)[0]
          ?.replace(/[^a-zA-Z'-]/g, "");
        if (f && f.length >= 2 && !INV.has(f.toLowerCase())) {
          session.collected._firstName = f;
          sessions.set(session.id, session);
          advanceSalesStep("firstName");
        }
      } else if (salesStep === "lastName") {
        const words = text.trim().split(/\s+/);
        const l = words[words.length - 1]?.replace(/[^a-zA-Z'-]/g, "");
        if (l && l.length >= 2 && !INV.has(l.toLowerCase())) {
          session.collected._lastName = l;
          session.collected.name = `${c._firstName || ""} ${l}`.trim();
          session.collected.preferredName = c._firstName || l;
          sessions.set(session.id, session);
          advanceSalesStep("lastName");
        }
      } else if (salesStep === "phone") {
        const d = text.replace(/\D/g, "");
        if (d.length >= 8) {
          session.collected.phone = d;
          sessions.set(session.id, session);
          advanceSalesStep("phone");
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ELEVENLABS — persistent connection with re-prime buffering
    // ═══════════════════════════════════════════════════════════════════════
    function openElevenLabsStream(force = false) {
      if (
        !force &&
        elevenLabsWs &&
        (elevenLabsWs.readyState === WebSocket.OPEN ||
          elevenLabsWs.readyState === WebSocket.CONNECTING)
      )
        return;
      closeElevenLabsWs();
      const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_flash_v2_5&output_format=pcm_16000`;
      const elWs = new WebSocket(wsUrl);
      elWs.on("open", () => {
        console.log(`✅ [EL] Connected`);
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
          elevenLabsRepriming = false;
          console.log(
            `✅ [EL] Ready, flushing ${textBuffer.length} buffered items`,
          );
          if (textBuffer.length > 0) {
            for (const t of textBuffer) sendTextToElevenLabs(t);
            textBuffer = [];
          }
        }
      });
      elWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio)
            socket.emit("audio_chunk_pcm", {
              sampleRate: PCM_SAMPLE_RATE,
              audio: msg.audio,
            });
          if (
            msg.isFinal === true ||
            msg.is_final === true ||
            msg.final === true
          ) {
            safeSetElevenLabsStreaming(false);
            socket.emit("audio_stream_complete");
          }
        } catch (e) {
          console.error(`⚠️ [EL] parse:`, e.message);
        }
      });
      elWs.on("error", (err) => {
        console.warn(`⚠️ [EL] error: ${err.message}`);
        elevenLabsStreaming = false;
        elevenLabsReady = false;
        elevenLabsRepriming = false;
        if (elevenLabsWs === elWs)
          setTimeout(() => {
            if (elevenLabsWs === elWs || !elevenLabsWs)
              openElevenLabsStream(true);
          }, 500);
      });
      elWs.on("close", (code) => {
        if (elevenLabsWs === elWs) {
          elevenLabsReady = false;
          elevenLabsStreaming = false;
          elevenLabsRepriming = false;
          setTimeout(() => {
            if (!elevenLabsReady && elevenLabsWs === elWs)
              openElevenLabsStream(true);
          }, 200);
        }
      });
      elevenLabsWs = elWs;
    }

    // ─── FIX ISSUE 2: interruptElevenLabsStream ──────────────────────────
    // Problem: After an interrupt, interruptElevenLabsStream() re-primed the EL
    // stream and set elevenLabsReady=true synchronously. But the new response's
    // text.delta events could arrive within the same JS tick, before EL has
    // actually processed the re-prime frame. Those deltas were buffered but the
    // buffer flush never happened because elevenLabsReady was already true.
    //
    // Fix: Set elevenLabsRepriming=true DURING re-prime. sendTextToElevenLabs()
    // buffers text when elevenLabsRepriming=true. After 80ms (enough for EL to
    // process the frame), mark ready and flush the buffer.
    function interruptElevenLabsStream() {
      safeSetElevenLabsStreaming(false);
      textBuffer = []; // discard any in-flight text from cancelled response

      if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) {
        console.warn(`[EL] Not open during interrupt — reconnecting`);
        elevenLabsReady = false;
        elevenLabsRepriming = false;
        openElevenLabsStream(true);
        return;
      }

      // Mark repriming so any text arriving during this window is buffered
      elevenLabsReady = false;
      elevenLabsRepriming = true;
      console.log(`🔄 [EL] Interrupt: sending re-prime frame`);

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
        // After 80ms EL has processed the re-prime; mark ready and flush buffered text
        setTimeout(() => {
          if (elevenLabsRepriming) {
            elevenLabsRepriming = false;
            elevenLabsReady = true;
            console.log(
              `✅ [EL] Re-prime complete. Flushing ${textBuffer.length} buffered items`,
            );
            if (textBuffer.length > 0) {
              const toFlush = [...textBuffer];
              textBuffer = [];
              for (const t of toFlush) sendTextToElevenLabs(t);
            }
          }
        }, 80);
      } catch (e) {
        console.warn("[EL] re-prime failed:", e.message);
        elevenLabsRepriming = false;
        elevenLabsReady = false;
        openElevenLabsStream(true);
      }
    }

    function sendTextToElevenLabs(text) {
      if (!text) return;
      // FIX ISSUE 2: Buffer if not ready OR currently repriming
      if (
        !elevenLabsWs ||
        elevenLabsWs.readyState !== WebSocket.OPEN ||
        !elevenLabsReady ||
        elevenLabsRepriming
      ) {
        textBuffer.push(text);
        return;
      }
      elevenLabsWs.send(JSON.stringify({ text, try_trigger_generation: true }));
    }

    function flushElevenLabsStream() {
      if (
        elevenLabsWs?.readyState === WebSocket.OPEN &&
        elevenLabsReady &&
        !elevenLabsRepriming
      )
        elevenLabsWs.send(JSON.stringify({ text: " ", flush: true }));
    }

    function closeElevenLabsWs() {
      if (elevenLabsWs) {
        elevenLabsStreaming = false;
        elevenLabsReady = false;
        elevenLabsRepriming = false;
        try {
          if (elevenLabsWs.readyState === WebSocket.CONNECTING)
            elevenLabsWs.terminate();
          else if (elevenLabsWs.readyState === WebSocket.OPEN)
            elevenLabsWs.close(1000);
        } catch (_) {}
        elevenLabsWs = null;
        textBuffer = [];
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  OPENAI REALTIME CONNECTION
    // ═══════════════════════════════════════════════════════════════════════
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
          console.log("✅ [WS-1] OpenAI connected");
          const instructions =
            SYSTEM_PROMPT +
            "\n\nCRITICAL: Always respond in English only." +
            "\n\nFIELD COLLECTION: ONE field per turn. Wait for answer before proceeding." +
            "\n\nPACKAGE RULE: Present ALL options. NEVER auto-select. Ask 'Which catches your eye?' and WAIT." +
            "\n\nEMAIL FLOW: Spell letter by letter → read back letter-by-letter → 'Is that correct?' → YES → call extract_call_fields ONCE → do NOT call it again with same email." +
            "\n\nAUTO-TICKET: When you receive [SYSTEM_CONTEXT] saying all details are collected, say something warm then IMMEDIATELY call create_ticket without asking any further questions.";
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
            const d = JSON.parse(raw.toString());
            if (!resolved) {
              resolved = true;
              resolve();
            }
            handleOpenAIEvent(d);
          } catch (e) {
            console.error("[WS-1] parse:", e.message);
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

    // ═══════════════════════════════════════════════════════════════════════
    //  OPENAI EVENT HANDLER
    // ═══════════════════════════════════════════════════════════════════════
    let lastEventLog = "";
    function handleOpenAIEvent(event) {
      if (event.type !== lastEventLog) {
        console.log(`📡 ${event.type}`);
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
            if (openaiWs?.readyState === WebSocket.OPEN)
              openaiWs.send(
                JSON.stringify({ type: "input_audio_buffer.clear" }),
              );
            break;
          }
          console.log(`🎙️ INTERRUPT`);
          socket.emit("status", "user_speaking");
          socket.emit("interrupt");
          socket.emit("audio_interrupt");
          TimerManager.resetSilence();
          TimerManager.clearWatchdog();
          if (isResponseActive) {
            cancelPending = true;
            openaiWs.send(JSON.stringify({ type: "response.cancel" }));
          }
          // FIX ISSUE 2: interrupt now uses re-prime buffering
          interruptElevenLabsStream();
          assistantTextBuffer = "";
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
          console.log(`📊 TRANSCRIPT: "${cleaned}"`);
          TimerManager.clearWatchdog();
          if (pendingFunctionCalls > 0 || finalMessageLock || session.finalLock)
            break;
          if (assistantSpeaking) assistantSpeaking = false;

          if (
            awaitingPhoneVerification &&
            (cleaned.match(/\d/g) || []).length >= 6
          ) {
            const d = cleaned.replace(/\D/g, "");
            if (d.length >= 6) {
              rawPhoneBuffer = d;
              rawPhoneBufferTimestamp = Date.now();
            }
          }

          console.log(`👤 User: "${cleaned}"`);
          socket.emit("user_transcript", cleaned);

          // ── Email confirmation gate ─────────────────────────────────────
          if (
            salesStep === "email" &&
            emailConfirmationAsked &&
            pendingEmailConfirmation
          ) {
            const conf = detectEmailConfirmation(cleaned);
            dbg("sales", "email_conf_check", conf || "ambiguous", {
              cleaned: cleaned.substring(0, 50),
              pending: pendingEmailConfirmation.parsed,
            });
            if (conf === "yes") {
              const confirmed = pendingEmailConfirmation.parsed;
              session.collected.email = confirmed;
              session.collected._emailStepComplete = true;
              pendingEmailConfirmation = null;
              emailConfirmationAsked = false;
              sessions.set(session.id, session);
              dbg("sales", "email_YES", "advancing", { email: confirmed });
              advanceSalesStep("email");
              session.messages.push({ role: "user", content: cleaned });
              sessions.set(session.id, session);
              TimerManager.resetSilence();
              const nextHint = buildSalesStepHint() || "Proceed to next step.";
              scheduleResponseCreate(
                `Email confirmed as "${confirmed}". _emailStepComplete=true. ` +
                  `Do NOT call extract_call_fields with this email again. Do NOT ask about email. ${nextHint}`,
              );
              break;
            } else if (conf === "no") {
              pendingEmailConfirmation = null;
              emailConfirmationAsked = false;
              delete session.collected.email;
              delete session.collected._emailStepComplete;
              sessions.set(session.id, session);
              session.messages.push({ role: "user", content: cleaned });
              sessions.set(session.id, session);
              TimerManager.resetSilence();
              scheduleResponseCreate(
                `Email REJECTED. Say "No worries" and ask them to re-spell from the beginning.`,
              );
              break;
            }
          }

          // ── Network ordinal ─────────────────────────────────────────────
          const mappedNet = mapOrdinalNetworkChoice(cleaned);
          if (mappedNet && wasLastMessageNetworkQuestion()) {
            const txt = `I want ${mappedNet}`;
            session.collected.networkPreference = mappedNet;
            session.messages.push({ role: "user", content: txt });
            sessions.set(session.id, session);
            if (openaiWs?.readyState === WebSocket.OPEN) {
              openaiWs.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "user",
                    content: [{ type: "input_text", text: txt }],
                  },
                }),
              );
              scheduleResponseCreate();
            }
            TimerManager.resetSilence();
            break;
          }

          // ── Website check answer ────────────────────────────────────────
          if (
            session.collected._websiteCheckRequired &&
            !session.collected._websiteCheckDone &&
            detectWebsiteCheckAnswer(cleaned) &&
            wasLastAssistantMessageWebsiteCheck()
          ) {
            session.collected._websiteCheckDone = true;
            sessions.set(session.id, session);
            dbg("sales", "website_check", "done", { answer: cleaned });
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
          currentResponseHadOutput = false;
          cancelPending = false;
          // FIX ISSUE 2: set EL streaming but do NOT reset elevenLabsReady/elevenLabsRepriming
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
            // FIX ISSUE 2: buffers automatically if elevenLabsRepriming=true
            sendTextToElevenLabs(event.delta);
          }
          break;

        case "response.text.done":
          if (event.text) {
            currentResponseHadOutput = true;
            const nNorm = event.text
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, "")
              .trim();
            const lNorm = lastAssistantText
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, "")
              .trim();
            const isDup =
              nNorm.length > 20 &&
              lNorm.length > 20 &&
              (nNorm === lNorm ||
                nNorm.includes(lNorm) ||
                lNorm.includes(nNorm));
            if (isDup) {
              assistantTextBuffer = "";
              break;
            }
            lastAssistantText = event.text;
            console.log(`🤖 AI: "${event.text.substring(0, 100)}..."`);
            session.messages.push({ role: "assistant", content: event.text });
            sessions.set(session.id, session);
            socket.emit("assistant_text_done", event.text);

            // Detect leadInterest from AI text if LLM skipped tool call
            if (!session.collected.leadInterest) {
              const pm =
                event.text.match(
                  /\bOptiComm\s+[\w\s]+(?:Residential|Business|plan)\b/i,
                ) ||
                event.text.match(
                  /\bNBN\s+[\w\s]+(?:Residential|Business|plan|Mbps)\b/i,
                );
              if (pm) {
                session.collected.leadInterest = pm[0].trim();
                session.collected._websiteCheckRequired = true;
                if (session.collected._websiteCheckDone === undefined)
                  session.collected._websiteCheckDone = false;
                sessions.set(session.id, session);
              }
            }
            flushElevenLabsStream();
            if (detectPlanPresentation(event.text))
              lastResponseWasPackage = true;
            if (detectPhoneVerificationRequest(event.text)) {
              awaitingPhoneVerification = true;
              rawPhoneBuffer = null;
              rawPhoneBufferTimestamp = 0;
            }
            // Track when AI asks website check
            if (
              session.collected._websiteCheckRequired &&
              !session.collected._websiteCheckDone &&
              !session.collected._websiteCheckAsked &&
              detectWebsiteCheckQuestion(event.text)
            ) {
              session.collected._websiteCheckAsked = true;
              sessions.set(session.id, session);
            }
            // Track email readback
            if (
              salesStep === "email" &&
              !session.collected._emailStepComplete &&
              detectEmailReadbackQuestion(event.text) &&
              pendingEmailConfirmation
            ) {
              emailConfirmationAsked = true;
              dbg("sales", "email_readback", "awaiting", {
                pending: pendingEmailConfirmation.parsed,
              });
            }
          }
          break;

        case "response.done": {
          isResponseActive = false;
          TimerManager.clearWatchdog();
          debugState("response_done");
          const oi = event.response?.output || [];
          const hasText =
            oi.some(
              (i) =>
                i.type === "message" &&
                i.content?.some((c) => c.type === "text" && c.text?.trim()),
            ) || currentResponseHadOutput;
          const hasFn = oi.some((i) => i.type === "function_call");
          if (!hasFn && pendingFunctionCalls === 0 && !elevenLabsStreaming)
            assistantSpeaking = false;

          if (
            !hasFn &&
            !hasText &&
            pendingFunctionCalls === 0 &&
            !finalMessageLock
          ) {
            if (cancelPending) {
              cancelPending = false;
              assistantSpeaking = false;
              socket.emit("status", "listening");
              if (pendingPostDoneCreate) {
                pendingPostDoneCreate = false;
                const h = pendingPostDoneHint;
                pendingPostDoneHint = null;
                setTimeout(() => scheduleResponseCreate(h), 50);
              }
              break;
            }
            if (elevenLabsStreaming) break;
            emptyResponseCount++;
            if (emptyResponseCount <= MAX_EMPTY_RETRIES) {
              assistantSpeaking = false;
              scheduleResponseCreate(
                null,
                300 * Math.pow(2, emptyResponseCount - 1),
                true,
              );
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
            const h = pendingPostDoneHint;
            pendingPostDoneHint = null;
            setTimeout(() => scheduleResponseCreate(h, 0, true), 50);
            break;
          }
          if (!pendingFunctionCalls) socket.emit("status", "listening");
          assistantTextBuffer = "";
          currentResponseHadOutput = false;
          break;
        }

        case "response.output_item.added":
          if (event.item?.type === "function_call") {
            const fn = event.item.name || event.item.function_call?.name;
            if (fn === "create_ticket") {
              TimerManager.startFinalLock(20000);
              if (openaiWs?.readyState === WebSocket.OPEN)
                openaiWs.send(
                  JSON.stringify({ type: "input_audio_buffer.clear" }),
                );
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
          console.error("[WS-1] error:", JSON.stringify(event.error));
          socket.emit("error_msg", event.error?.message || "AI error");
          isResponseActive = false;
          pendingFunctionCalls = 0;
          emptyResponseCount = 0;
          responseCreatePending = false;
          pendingPostDoneCreate = false;
          elevenLabsStreaming = false;
          assistantSpeaking = false;
          TimerManager.clearWatchdog();
          socket.emit("status", "listening");
          break;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  HANDLE FUNCTION CALL
    // ═══════════════════════════════════════════════════════════════════════
    async function handleFunctionCall(item) {
      const { call_id, name: fn, arguments: argsStr } = item;
      let args = safeParseJSON(argsStr) || {};
      dbg(
        session.collected?.intent || "unknown",
        "handleFunctionCall",
        "called",
        { fn, args: JSON.stringify(args).substring(0, 150), salesStep },
      );

      // Redirect verify_phone for new sales customers
      if (
        fn === "verify_phone" &&
        !session.collected._emailVerifiedCustomerId
      ) {
        const phoneToSave = args.phone || rawPhoneBuffer;
        rawPhoneBuffer = null;
        rawPhoneBufferTimestamp = 0;
        awaitingPhoneVerification = false;
        if (phoneToSave) {
          session.collected.phone =
            String(phoneToSave).replace(/\D/g, "") || phoneToSave;
          sessions.set(session.id, session);
          if (salesStep === "phone") advanceSalesStep("phone");
        }
        if (openaiWs?.readyState === WebSocket.OPEN)
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id,
                output: JSON.stringify({ success: true, _redirected: true }),
              },
            }),
          );
        pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
        if (
          pendingFunctionCalls === 0 &&
          openaiWs?.readyState === WebSocket.OPEN
        ) {
          const hint = buildSalesStepHint() || "";
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `[SYSTEM_CONTEXT]: Phone saved. ${hint} Proceed immediately.`,
                  },
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
          const lp = args.phone ? String(args.phone).replace(/\D/g, "") : null;
          const bp = String(rawPhoneBuffer).replace(/\D/g, "");
          const age = Date.now() - rawPhoneBufferTimestamp;
          if (age <= 10000 || !lp || lp.length < 10)
            args = { ...args, phone: bp };
          rawPhoneBuffer = null;
          rawPhoneBufferTimestamp = 0;
          awaitingPhoneVerification = false;
        } else if (
          !args.phone ||
          String(args.phone).replace(/\D/g, "").length < 6
        ) {
          if (openaiWs?.readyState === WebSocket.OPEN)
            openaiWs.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id,
                  output: JSON.stringify({
                    success: false,
                    verificationFailed: false,
                    message:
                      "Could not extract phone. Ask customer to repeat clearly.",
                  }),
                },
              }),
            );
          pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
          if (pendingFunctionCalls === 0) scheduleResponseCreate();
          return;
        }
      }

      console.log(`🔧 Tool: ${fn}`, JSON.stringify(args).substring(0, 200));
      socket.emit("status", "processing");
      TimerManager.clearSilence();
      TimerManager.clearWatchdog();
      if (openaiWs?.readyState === WebSocket.OPEN)
        openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));

      const ttimer = setTimeout(() => {
        console.warn(`⚠️ Tool ${fn} timed out`);
        pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
        if (pendingFunctionCalls === 0) socket.emit("status", "listening");
      }, 30000);

      let result;
      try {
        result = await execTool(fn, args);
        console.log(`🔧 DONE ${fn}: ${result.substring(0, 200)}`);
      } catch (e) {
        console.error(`🔧 ERR ${fn}:`, e.message);
        result = JSON.stringify({ success: false, error: e.message });
      }
      clearTimeout(ttimer);

      let sysHint = `[FLOW:${session.collected?.intent || "unknown"}] Collected: ${JSON.stringify(
        Object.fromEntries(
          Object.entries(session.collected || {}).filter(
            ([k]) => k !== "_registeredPhone" && k !== "_rp",
          ),
        ),
      )}.`;

      if (fn === "check_address_availability") {
        let pr = null;
        try {
          pr = JSON.parse(result);
        } catch (_) {}
        if (pr) {
          const net = pr.network || "network",
            cnt = Array.isArray(pr.availablePlans)
              ? pr.availablePlans.length
              : 0;
          if (pr.orderable === false)
            sysHint += `\nNot serviceable. Tell customer.`;
          else if (cnt > 0 && pr.requiresResidentialFilter)
            sysHint += `\n${cnt} plans on "${net}". Ask "Home or business?" first.`;
          else if (cnt > 0)
            sysHint += `\n${cnt} plans on "${net}". Present ALL NOW using voice_description fields. End with "Which catches your eye?" LOCKED to ${net}.`;
          else sysHint += `\nNo plans. Tell customer.`;
          if (session.networkShown)
            sysHint += `\nNETWORK LOCK: ${session.networkShown} ONLY.`;
        }
      }

      if (fn === "customer_lookup") {
        let pr = null;
        try {
          pr = JSON.parse(result);
        } catch (_) {}
        if (pr?._blocked && pr?.reason === "sales_flow")
          sysHint += `\nNew lead — new customer. Collect name/phone/email then create_ticket.`;
        else if (pr?._invalidEmail)
          sysHint += `\nInvalid email. Ask to spell whole email from scratch.`;
        else if (pr?.success && pr?.customer) {
          sysHint += `\nEmail found. Say "Perfect, I can see that account." Ask for phone. Call verify_phone.`;
          awaitingPhoneVerification = true;
          rawPhoneBuffer = null;
          rawPhoneBufferTimestamp = 0;
        } else sysHint += `\nNot found. Ask to re-spell email.`;
      }

      if (fn === "create_ticket") {
        let pr = null;
        try {
          pr = JSON.parse(result);
        } catch (_) {}
        // FIX ISSUE 1: reset autoTicketScheduled so it can re-fire if needed
        autoTicketScheduled = false;
        if (pr?._blocked && pr?.reason === "email_missing") {
          TimerManager.releaseFinalLock();
          salesStep = "email";
          sysHint += `\ncreate_ticket BLOCKED — email missing. Ask for email NOW.`;
        } else if (pr?.success) {
          salesStep = "done";
          TimerManager.releaseFinalLock();
          if (pr._isSalesTicket)
            sysHint += `\nSales submitted. Say "Awesome, you're all set! Our sales team will be in touch via email shortly. Is there anything else I can help you with?"`;
          else
            sysHint += `\nTicket #${pr.ticket_id} raised. Say "Brilliant, all done! Ticket raised and you'll get details via email. Is there anything else I can help with?"`;
        } else {
          TimerManager.releaseFinalLock();
          sysHint += `\nTicket FAILED: ${pr?.error || "unknown"}. Apologise and suggest 1300 101 414.`;
        }
      }

      if (fn === "extract_call_fields") {
        const c = session.collected || {};
        if (c._emailStepComplete)
          sysHint += `\nEMAIL CONFIRMED (_emailStepComplete=true). Do NOT ask about email. Do NOT call extract_call_fields with email again.`;
        else if (pendingEmailConfirmation && salesStep === "email")
          sysHint += `\nEMAIL PARSED as "${pendingEmailConfirmation.parsed}". Read back letter-by-letter. Ask "Is that correct?" Wait for YES.`;
        const gate =
          c.leadInterest &&
          c._websiteCheckRequired &&
          !c._websiteCheckAsked &&
          !c._websiteCheckDone;
        if (gate) sysHint += `\nMUST ask website check first.`;
        if (
          c.leadInterest &&
          c._websiteCheckRequired &&
          (c._websiteCheckAsked || c._websiteCheckDone)
        )
          sysHint += `\nWebsite check done. Proceed with order.`;
        // FIX ISSUE 1: if we're at createTicket, prime the auto-fire
        if (
          salesStep === "createTicket" &&
          c.phone &&
          c.email &&
          c.leadInterest
        ) {
          sysHint += `\n\nAll details collected. Say something warm then IMMEDIATELY call create_ticket. Do NOT wait for user input.`;
        }
        const sh = buildSalesStepHint();
        if (sh) sysHint += `\n\n${sh}`;
      }

      if (fn === "send_portal_login_email")
        sysHint += `\nPortal login email sent. Tell customer team will be in touch.`;

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
                  text: `[SYSTEM_CONTEXT]: ${sysHint}\n\nRespond immediately.`,
                },
              ],
            },
          }),
        );
        console.log(`📤 Tool complete (${fn}) → response.create`);
        scheduleResponseCreate();
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  EXEC TOOL
    // ═══════════════════════════════════════════════════════════════════════
    async function execTool(fn, args) {
      if (fn === "extract_call_fields") {
        if (args.email && typeof args.email === "string") {
          const p = parseVoiceEmail(args.email);
          if (p) args.email = p;
        }
        applyExtractionToSession(session, args);
        const c = session.collected || {};
        if (salesStep === "firstName" && (args.preferredName || args.name)) {
          const f = (args.preferredName || args.name || "").split(" ")[0];
          const INV = new Set([
            "yes",
            "yeah",
            "yep",
            "no",
            "nope",
            "ok",
            "okay",
            "sure",
            "right",
            "correct",
            "i",
            "my",
            "the",
            "a",
            "an",
          ]);
          if (f && f.length >= 2 && !INV.has(f.toLowerCase())) {
            session.collected._firstName = f;
            sessions.set(session.id, session);
            advanceSalesStep("firstName");
          }
        }
        if (salesStep === "lastName" && args.name && args.name.includes(" ")) {
          const pts = args.name.split(" ");
          session.collected._lastName = pts[pts.length - 1];
          sessions.set(session.id, session);
          advanceSalesStep("lastName");
        }
        if (salesStep === "phone" && args.phone) advanceSalesStep("phone");
        if (args.leadInterest && !c.leadInterest) {
          session.collected.leadInterest = args.leadInterest;
          session.collected._websiteCheckRequired = true;
          if (session.collected._websiteCheckDone === undefined)
            session.collected._websiteCheckDone = false;
          sessions.set(session.id, session);
        }
        // Email guard — do not re-enter if step already complete
        if (args.email) {
          const parsed = parseVoiceEmail(args.email) || args.email;
          if (session.collected._emailStepComplete) {
            dbg("sales", "extract_email_GUARDED", "no_op", {
              reason: "_emailStepComplete=true",
            });
          } else if (salesStep === "email") {
            session.collected.email = parsed;
            sessions.set(session.id, session);
            if (!pendingEmailConfirmation) {
              pendingEmailConfirmation = { raw: args.email, parsed };
              emailConfirmationAsked = false;
              dbg("sales", "email_pending", "new", { parsed });
            } else if (pendingEmailConfirmation.parsed !== parsed) {
              pendingEmailConfirmation = { raw: args.email, parsed };
              emailConfirmationAsked = false;
              dbg("sales", "email_pending", "updated", { parsed });
            } else dbg("sales", "email_same_SKIPPED", "no_op", { parsed });
          }
        }
        return JSON.stringify({ success: true });
      }

      if (fn === "customer_lookup") {
        const isSales =
          !!session.collected?.leadInterest &&
          !session.collected?._emailVerifiedCustomerId;
        if (isSales)
          return JSON.stringify({
            success: false,
            _blocked: true,
            reason: "sales_flow",
          });
        const la = { ...(args || {}) };
        delete la.phone;
        if (!la.email && !la.name)
          return JSON.stringify({ success: false, message: "Email required" });
        if (la.email && typeof la.email === "string") {
          const p = parseVoiceEmail(la.email);
          if (p) la.email = p;
          else
            return JSON.stringify({
              success: false,
              _invalidEmail: true,
              message: "Invalid email",
            });
        }
        try {
          const r = await customerLookup(la);
          if (r.success && r.customer) {
            session.collected._emailVerifiedCustomerId = r.customer.id;
            session.collected._registeredPhone =
              r.customer.phone || r.customer.phone_mobile || null;
            session.collected._rp = session.collected._registeredPhone;
            session.collected._phoneVerified = false;
            session.collected.customer_id = r.customer.id;
            sessions.set(session.id, session);
            const safe = { ...r, customer: { ...r.customer } };
            delete safe.customer.phone;
            delete safe.customer.phone_mobile;
            delete safe.customer.mobile;
            delete safe.customer.phone2;
            return JSON.stringify(safe);
          }
          delete session.collected.email;
          delete session.collected._emailVerifiedCustomerId;
          sessions.set(session.id, session);
          return JSON.stringify({
            ...r,
            _emailCleared: true,
            message: "No account found.",
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
            message: "No phone",
          });
        const eid = session.collected._emailVerifiedCustomerId;
        if (!eid)
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "Email required first",
          });
        const reg = session.collected._registeredPhone || session.collected._rp;
        if (!reg)
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "No phone on account",
          });
        const norm =
          normalizePhone && typeof normalizePhone === "function"
            ? normalizePhone
            : (p) =>
                String(p || "")
                  .replace(/\D/g, "")
                  .replace(/^61(\d{9})$/, "0$1");
        if (norm(phone) !== norm(reg))
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "Phone mismatch",
          });
        session.collected._phoneVerified = true;
        sessions.set(session.id, session);
        return JSON.stringify({
          success: true,
          verified: true,
          customer_id: eid,
        });
      }

      if (fn === "check_address_availability") {
        try {
          if (args.address) session.collected.address = args.address;
          return await checkAddressAvailability(args, session);
        } catch (e) {
          return JSON.stringify({
            success: false,
            error: e.message,
            address: args.address,
          });
        }
      }

      if (fn === "create_ticket") {
        let fa = { ...args };
        if (typeof fa.message === "string")
          fa.message = { message: fa.message };
        const col = session.collected || {};
        const hasCid = !!(fa.customer_id || col.customer_id);
        const hasLead = !!(col.leadInterest || fa.leadInterest);
        const isSupport = hasCid && !hasLead;
        if (!isSupport && !col.email) {
          salesStep = "email";
          TimerManager.releaseFinalLock();
          finalMessageLock = false;
          session.finalLock = false;
          autoTicketScheduled = false;
          return JSON.stringify({
            success: false,
            _blocked: true,
            reason: "email_missing",
          });
        }
        const lines = [];
        const fullName =
          [col._firstName, col._lastName].filter(Boolean).join(" ") ||
          col.name ||
          col.preferredName;
        if (fullName) lines.push(`Name: ${fullName}`);
        if (col.email) lines.push(`Email: ${col.email}`);
        if (col.phone) lines.push(`Phone: ${col.phone}`);
        if (col.address) lines.push(`Address: ${col.address}`);
        if (col.networkPreference)
          lines.push(`Network: ${col.networkPreference}`);
        if (col.residentialPreference)
          lines.push(`Type: ${col.residentialPreference}`);
        if (col.leadInterest || fa.leadInterest)
          lines.push(`Selected Plan: ${col.leadInterest || fa.leadInterest}`);
        const block =
          lines.length > 0
            ? `\n\n--- Customer Details ---\n${lines.join("\n")}`
            : "";
        if (fa.message?.message) fa.message.message += block;
        else if (block) fa.message = { message: block.trim() };
        let res;
        try {
          if (isSupport) {
            const r = await splynx.request(
              "POST",
              "admin/support/tickets",
              objectToUrlEncoded(fa),
            );
            const er = await sendTicketEmail(r.id, fa, col, true);
            res = {
              success: true,
              ticket_id: r.id,
              email_sent: er.sent,
              _isSalesTicket: false,
              _ticketCompleted: true,
            };
          } else {
            const er = await sendTicketEmail(null, fa, col, false);
            res = {
              success: true,
              message: "Sales inquiry submitted",
              email_sent: er.sent,
              _isSalesTicket: true,
              _ticketCompleted: true,
            };
          }
        } catch (e) {
          res = { success: false, error: e.message, _ticketCompleted: true };
        }
        return JSON.stringify(res);
      }

      if (fn === "send_portal_login_email") {
        const col = session.collected || {};
        const lines = [];
        if (col.preferredName || col.name)
          lines.push(`Name: ${col.preferredName || col.name}`);
        if (col.email) lines.push(`Email: ${col.email}`);
        if (col.phone) lines.push(`Phone: ${col.phone}`);
        if (col.customer_id) lines.push(`Customer ID: ${col.customer_id}`);
        lines.push("Issue: Portal login assistance");
        const ea = {
          subject: "Support - Portal Login",
          priority: "medium",
          message: {
            message: `${args.message || "Portal login request"}\n\n--- Customer Details ---\n${lines.join("\n")}`,
          },
          customer_id: col.customer_id || null,
        };
        try {
          const er = await sendTicketEmail(null, ea, col, true);
          return JSON.stringify({ success: true, email_sent: er.sent });
        } catch (e) {
          return JSON.stringify({ success: false, error: e.message });
        }
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

    // ═══════════════════════════════════════════════════════════════════════
    //  CLIENT AUDIO → OPENAI
    // ═══════════════════════════════════════════════════════════════════════
    let lastAudioLog = 0;
    socket.on("audio_chunk", (b64) => {
      if (
        awaitingStructuredInput ||
        pendingFunctionCalls > 0 ||
        session.finalLock ||
        finalMessageLock
      )
        return;
      const now = Date.now();
      if (now - lastAudioLog > 2000) {
        console.log(
          `🎤 [${socket.id}] [OpenAI:${["CONNECTING", "OPEN", "CLOSING", "CLOSED"][openaiWs?.readyState] || "?"}]`,
        );
        lastAudioLog = now;
      }
      if (openaiWs?.readyState === WebSocket.OPEN)
        openaiWs.send(
          JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }),
        );
    });

    socket.on("audio_done", () => {
      console.log(`🔊 audio_done — playback complete`);
      assistantSpeaking = false;
      elevenLabsStreaming = false;
      const pkg = lastResponseWasPackage;
      lastResponseWasPackage = false;
      TimerManager.startSilence(pkg);
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  STRUCTURED INPUT
    // ═══════════════════════════════════════════════════════════════════════
    socket.on("structured_input", (payload) => {
      if (!payload || !payload.field || !payload.value) return;
      const { field, value } = payload;
      if (field === "email") {
        const pe = parseVoiceEmail(value) || value;
        session.collected.email = pe;
        session.collected._emailStepComplete = true;
        pendingEmailConfirmation = null;
        emailConfirmationAsked = false;
        sessions.set(session.id, session);
        if (salesStep === "email") advanceSalesStep("email");
        awaitingStructuredInput = false;
        const msg = `My email is ${pe}`;
        session.messages.push({ role: "user", content: msg });
        sessions.set(session.id, session);
        socket.emit("user_transcript", msg);
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: msg }],
              },
            }),
          );
          const hint = buildSalesStepHint() || "";
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `[SYSTEM_CONTEXT]: Email confirmed via typed input: ${pe}. _emailStepComplete=true. Do NOT ask about email. ${hint}`,
                  },
                ],
              },
            }),
          );
          scheduleResponseCreate();
        }
        socket.emit("structured_input_accepted", { field, value: pe });
        socket.emit("status", "listening");
        return;
      }
      TimerManager.clearSilence();
      awaitingStructuredInput = false;
      const msg = `My ${field} is ${value}`;
      session.messages.push({ role: "user", content: msg });
      sessions.set(session.id, session);
      socket.emit("user_transcript", msg);
      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: msg }],
            },
          }),
        );
        scheduleResponseCreate();
      }
      socket.emit("structured_input_accepted", { field, value });
      socket.emit("status", "listening");
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  CLEANUP
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    //  BOOT
    // ═══════════════════════════════════════════════════════════════════════
    (async () => {
      try {
        console.log("⏳ Connecting OpenAI Realtime...");
        await connectOpenAI();
        console.log("✅ OpenAI connected. Waiting for ElevenLabs...");
        socket.emit("connections_ready");
        let elWait = 0;
        while (!elevenLabsReady && elWait < 3000) {
          await new Promise((r) => setTimeout(r, 100));
          elWait += 100;
        }
        if (!elevenLabsReady)
          console.warn(`⚠️ ElevenLabs not ready after ${elWait}ms`);
        else console.log(`✅ ElevenLabs ready after ${elWait}ms`);
        if (!session.hasGreeted) {
          session.hasGreeted = true;
          if (openaiWs?.readyState === WebSocket.OPEN)
            openaiWs.send(JSON.stringify({ type: "response.create" }));
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
