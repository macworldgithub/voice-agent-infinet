import WebSocket from "ws";

// ═══════════════════════════════════════════════════════════════════════════
//  VOICE EMAIL CAPTURE — NATO PHONETIC PARSER + ASSEMBLER
// ═══════════════════════════════════════════════════════════════════════════

const NATO_MAP = {
  // NATO phonetics
  alpha: "a", alfa: "a",
  bravo: "b",
  charlie: "c",
  delta: "d",
  echo: "e",
  foxtrot: "f",
  golf: "g",
  hotel: "h",
  india: "i",
  juliet: "j", juliett: "j",
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
  xray: "x", "x-ray": "x",
  yankee: "y",
  zulu: "z",

  // Common letter names spoken
  ay: "a", bee: "b", see: "c", sea: "c", dee: "d",
  ee: "e", ef: "f", eff: "f", gee: "g", aitch: "h", haitch: "h",
  jay: "j", kay: "k", el: "l", em: "m", en: "n",
  oh: "o", pee: "p", cue: "q", queue: "q", are: "r", ar: "r",
  ess: "s", es: "s", tee: "t", you: "u", vee: "v",
  double: null, // handled specially for "double u"
  ex: "x", why: "y", wye: "y", zee: "z", zed: "z",

  // Digits
  zero: "0", one: "1", two: "2", to: "2", too: "2",
  three: "3", four: "4", for: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9",

  // Special characters
  at: "@", "at sign": "@",
  dot: ".", period: ".", full: null, stop: ".", // "full stop" handled
  dash: "-", hyphen: "-", minus: "-",
  underscore: "_", "under score": "_",
  plus: "+",
  hash: "#", hashtag: "#", pound: "#",

  // Common TLD helpers
  com: "com", net: "net", org: "org", edu: "edu",
  gov: "gov", io: "io", co: "co", au: "au",
  uk: "uk", us: "us", ca: "ca", nz: "nz",
};

// Common domain shortcuts spoken aloud
const DOMAIN_SHORTCUTS = {
  "gmail": "gmail.com",
  "gmail dot com": "gmail.com",
  "google mail": "gmail.com",
  "yahoo": "yahoo.com",
  "yahoo dot com": "yahoo.com",
  "hotmail": "hotmail.com",
  "hotmail dot com": "hotmail.com",
  "outlook": "outlook.com",
  "outlook dot com": "outlook.com",
  "icloud": "icloud.com",
  "icloud dot com": "icloud.com",
  "live": "live.com",
  "live dot com": "live.com",
  "protonmail": "protonmail.com",
  "proton mail": "protonmail.com",
  "bigpond": "bigpond.com",
  "bigpond dot com": "bigpond.com",
  "optusnet": "optusnet.com.au",
  "tpg": "tpg.com.au",
  "bele": "bele.ai"
};

/**
 * Parse a raw spoken transcript into an email address.
 * Handles:
 *  - NATO phonetics: "alpha bravo charlie at gmail dot com" → "abc@gmail.com"
 *  - Single letters: "a b c at gmail dot com" → "abc@gmail.com"
 *  - Mixed spoken: "john dot smith at outlook dot com" → "john.smith@outlook.com"
 *  - Domain shortcuts: "at gmail" → "@gmail.com"
 *  - "double u" → "w"
 *  - "full stop" → "."
 *  - Numbers inline: "john99 at gmail dot com" → "john99@gmail.com"
 * Returns null if parsing fails to produce a plausible email.
 */
function parseVoiceEmail(transcript) {
  if (!transcript) return null;

  let raw = transcript.toLowerCase().trim();

  // 1. Try to detect if this is already a typed/dictated email (e.g. WhisperAI auto-formats it)
  const directEmail = raw.match(/\b([^\s@]+@[^\s@]+\.[^\s@]{2,})\b/);
  if (directEmail) return directEmail[1].toLowerCase();

  // 2. Normalise punctuation artifacts from speech recognition
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

  // 3. Check domain shortcuts before tokenising
  let domainReplaced = raw;
  for (const [spoken, actual] of Object.entries(DOMAIN_SHORTCUTS)) {
    const re = new RegExp(`\\b${spoken.replace(/\./g, "\\.")}\\b`, "gi");
    domainReplaced = domainReplaced.replace(re, actual);
  }
  raw = domainReplaced;

  // 4. Tokenise and resolve each token
  const tokens = raw.split(/\s+/).filter(Boolean);
  const parts = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    // Already resolved (e.g. "gmail.com" from domain shortcut)
    if (/^[a-z0-9._@+-]+\.[a-z]{2,}$/.test(tok)) {
      parts.push(tok);
      continue;
    }

    // Single letter "a"-"z" or digit "0"-"9"
    if (/^[a-z]$/.test(tok) || /^\d$/.test(tok)) {
      parts.push(tok);
      continue;
    }

    // Multi-digit number (e.g. "99", "123")
    if (/^\d{2,}$/.test(tok)) {
      parts.push(tok);
      continue;
    }

    // NATO / word → character
    if (NATO_MAP.hasOwnProperty(tok)) {
      const val = NATO_MAP[tok];
      if (val !== null) {
        // "dot" after "@" means it's a domain separator, add as-is
        parts.push(val);
      }
      // null = handled above (e.g. "full", "double" already pre-processed)
      continue;
    }

    // Might be a TLD like "com.au" or "co.uk" already concatenated
    if (/^[a-z]{2,6}(\.[a-z]{2,6})?$/.test(tok)) {
      parts.push(tok);
      continue;
    }

    // Fall through — append as-is (might be part of local part)
    parts.push(tok);
  }

  // 5. Reconstruct — join, but keep "." and "@" attached
  let email = parts.join("");

  // 6. Clean up artefacts
  email = email
    .replace(/@+/g, "@")        // multiple @ signs
    .replace(/\.{2,}/g, ".")    // multiple dots
    .replace(/^[.\-_]+/, "")   // leading punctuation
    .replace(/[.\-_]+@/, "@")  // punctuation before @
    .replace(/@[.\-_]+/, "@")  // punctuation after @
    .replace(/[.\-_]+$/, "");  // trailing punctuation

  // 7. Validate loosely — must have @ and at least one dot after @
  if (!email.includes("@")) return null;
  const [local, domain] = email.split("@");
  if (!local || local.length < 1) return null;
  if (!domain || !domain.includes(".")) return null;
  if (domain.endsWith(".")) return null;

  return email.toLowerCase();
}

/**
 * Check if a transcript looks like the user is spelling out an email address
 * (voice mode) rather than saying something conversational.
 */
function looksLikeVoiceEmailSpelling(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  // Already contains @ symbol (Whisper auto-detected it)
  if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(lower)) return true;

  // Contains "at" + known domain words
  if (/\bat\s+(gmail|yahoo|hotmail|outlook|icloud|bigpond|optusnet|tpg|live|proton)/.test(lower)) return true;

  // Contains NATO words + "at" or "dot"
  const natoCount = (lower.match(/\b(alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliet|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|xray|yankee|zulu)\b/gi) || []).length;
  if (natoCount >= 2 && /\bat\b/.test(lower)) return true;

  // Pattern: single letters/words spaced with "at" and "dot"
  const words = lower.split(/\s+/);
  const hasAt = words.includes("at");
  const hasDot = words.includes("dot") || words.includes("period") || words.includes("stop");
  const singleLetterCount = words.filter(w => /^[a-z]$/.test(w)).length;
  if (hasAt && hasDot && singleLetterCount >= 2) return true;

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

    // ─── ElevenLabs state ────────────────────────────────────────
    let elevenLabsWs = null;
    let elevenLabsReady = false;
    let textBuffer = [];

    let assistantTextBuffer = "";
    let pendingFunctionCalls = 0;
    let lastTtsText = "";
    let isResponseActive = false;
    let assistantSpeaking = false;
    let awaitingStructuredInput = false;  // kept for legacy non-email structured input
    let structuredInputField = null;

    const PCM_SAMPLE_RATE = 16000;
    let lastAssistantText = "";

    // ─── FIX 5: Retry state at connection scope ──────────────────
    let emptyResponseCount = 0;
    const MAX_EMPTY_RETRIES = 3;

    let cancelPending = false;

    let currentResponseId = null;
    let currentResponseHadOutput = false;

    // ─── FIX 4: Post-done response.create gate ───────────────────
    let pendingPostDoneCreate = false;
    let pendingPostDoneHint = null;

    // ─── FIX 1 & 2: Sales step machine ──────────────────────────
    let salesStep = null;

    // ─── SILENCE TIMER FIX ──────────────────────────────────────
    let lastResponseWasPackage = false;

    // ═══════════════════════════════════════════════════════════════
    //  VOICE EMAIL CAPTURE STATE
    // ═══════════════════════════════════════════════════════════════
    let emailCaptureMode = false;          // we've asked the user to spell email
    let emailCaptureBuffer = [];           // raw transcript chunks collected
    let emailCaptureAttempt = 0;          // how many times we've tried (max 3)
    const EMAIL_MAX_ATTEMPTS = 3;
    let emailCaptureConfirmPending = null; // email string awaiting user confirmation
    let emailCaptureConfirmAsked = false;  // we've sent the "is this right?" question
    let micMutedForInput = false;         // legacy, keep for compat

    /**
     * Start voice email spelling mode.
     * Sends instructions to the user via the AI voice, then signals the
     * frontend to show the "spelling mode" UI (no text box).
     */
    function startEmailCapture() {
      if (emailCaptureMode) return;
      emailCaptureMode = true;
      emailCaptureBuffer = [];
      emailCaptureAttempt = 0;
      emailCaptureConfirmPending = null;
      emailCaptureConfirmAsked = false;

      console.log(`📧 Email capture mode STARTED`);

      // Tell the frontend we're in spelling mode (no input box)
      socket.emit("email_spelling_mode", { active: true, attempt: 1 });
    }

    function resetEmailCapture() {
      emailCaptureMode = false;
      emailCaptureBuffer = [];
      emailCaptureConfirmPending = null;
      emailCaptureConfirmAsked = false;
      socket.emit("email_spelling_mode", { active: false });
      console.log(`📧 Email capture mode RESET`);
    }

    /**
     * Called when the user speaks during email capture mode.
     * Attempts to parse → confirm → retry loop.
     */
    function handleEmailCaptureTranscript(text) {
      if (!emailCaptureMode) return false;

      const cleaned = normalizeText(text);
      if (!cleaned) return true; // consumed but empty

      console.log(`📧 Email capture transcript (attempt ${emailCaptureAttempt + 1}): "${cleaned}"`);

      // ── Phase 2: We're waiting for confirmation ("yes" / "no") ──
      if (emailCaptureConfirmPending && emailCaptureConfirmAsked) {
        const lower = cleaned.toLowerCase().trim();
        const isYes = /\b(yes|yeah|yep|yup|correct|that'?s right|that is correct|right|confirm|confirmed|affirmative|go ahead|sounds good)\b/.test(lower);
        const isNo = /\b(no|nope|wrong|incorrect|that'?s wrong|not right|try again|redo|different|change|mistake)\b/.test(lower);

        if (isYes) {
          // Confirmed! Save the email.
          const confirmedEmail = emailCaptureConfirmPending;
          session.collected.email = confirmedEmail;
          sessions.set(session.id, session);
          console.log(`✅ Email confirmed via voice: ${confirmedEmail}`);

          if (salesStep === "email") {
            advanceSalesStep("email");
          }

          // Inject into conversation as if user typed it
          const userMsg = `My email address is ${confirmedEmail}`;
          session.messages.push({ role: "user", content: userMsg });
          sessions.set(session.id, session);
          socket.emit("user_transcript", userMsg);

          resetEmailCapture();

          // Notify OpenAI about the confirmed email
          if (openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: userMsg }],
              },
            }));
            const salesHint = buildSalesStepHint() || "";
            const hint = `The customer has confirmed their email address as ${confirmedEmail}. ${salesHint} Proceed to the next step immediately.`;
            openaiWs.send(JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: `[SYSTEM_CONTEXT]: ${hint}` }],
              },
            }));
            scheduleResponseCreate();
          }
          return true;
        }

        if (isNo) {
          emailCaptureAttempt++;
          emailCaptureConfirmPending = null;
          emailCaptureConfirmAsked = false;
          emailCaptureBuffer = [];

          if (emailCaptureAttempt >= EMAIL_MAX_ATTEMPTS) {
            // Out of retries — fall back
            console.warn(`📧 Email capture: max retries (${EMAIL_MAX_ATTEMPTS}) reached`);
            resetEmailCapture();
            const fallbackMsg = "I'm sorry, I'm having trouble capturing your email address. Could you please call us on 1300 101 414 or email us at support@infinetbroadband.com.au so we can complete your order?";
            session.messages.push({ role: "user", content: "Email capture failed after multiple attempts" });
            sessions.set(session.id, session);

            if (openaiWs?.readyState === WebSocket.OPEN) {
              openaiWs.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "user",
                  content: [{
                    type: "input_text",
                    text: `[SYSTEM_CONTEXT]: Email capture has failed after ${EMAIL_MAX_ATTEMPTS} attempts. Tell the customer you're having trouble capturing the email by voice and ask them to call 1300 101 414 or email support@infinetbroadband.com.au to complete their order. Be apologetic and warm.`,
                  }],
                },
              }));
              scheduleResponseCreate();
            }
            return true;
          }

          // Retry — ask them to spell again
          console.log(`📧 Email capture: user said no, retrying (attempt ${emailCaptureAttempt + 1}/${EMAIL_MAX_ATTEMPTS})`);
          // CLEAR BUFFER for fresh start
          emailCaptureBuffer = [];
          emailCaptureConfirmPending = null;
          emailCaptureConfirmAsked = false;
          socket.emit("email_spelling_mode", { active: true, attempt: emailCaptureAttempt + 1 });

          if (openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{
                  type: "input_text",
                  text: `[SYSTEM_CONTEXT]: The customer said the email was wrong. This is attempt ${emailCaptureAttempt + 1} of ${EMAIL_MAX_ATTEMPTS}. Ask them to spell it again slowly, one letter at a time. Remind them to say 'at' for @ and 'dot' for a full stop. Be patient and encouraging.`,
                }],
              },
            }));
            scheduleResponseCreate();
          }
          return true;
        }

        // Ambiguous response to confirmation — treat as a new spelling attempt
        console.log(`📧 Ambiguous confirmation response, treating as re-spell`);
        emailCaptureConfirmPending = null;
        emailCaptureConfirmAsked = false;
        // Fall through to Phase 1 to try parsing this as email content
      }

      // ── Phase 1: Parse the spoken email ─────────────────────────
      // Detect domain-only corrections (e.g., "www.vele.ai" or "it's vele dot ai")
      // If user is correcting just the domain part, reset buffer for fresh start
      const looksLikeDomainCorrection = /^www\.[a-z0-9_-]+\.(com|ai|co|net|org|au|io)/i.test(cleaned) ||
        (/^[a-z0-9_-]+\s+(dot|point)\s+(com|ai|co|net|org|au|io)/i.test(cleaned) && !cleaned.includes('@'));
      if (looksLikeDomainCorrection && emailCaptureBuffer.length > 0) {
        console.log(`📧 Detected domain correction: "${cleaned}" — resetting buffer for fresh start`);
        emailCaptureBuffer = [];
        emailCaptureConfirmPending = null;
        emailCaptureConfirmAsked = false;
      }
      // Accumulate buffer (user may spell over multiple utterances)
      emailCaptureBuffer.push(cleaned);
      const combinedTranscript = emailCaptureBuffer.join(" ");

      const parsed = parseVoiceEmail(combinedTranscript);

      if (!parsed) {
        // Can't parse yet — might need more input or clarification
        // Only prompt if they've given something substantial
        if (combinedTranscript.split(/\s+/).length < 3) {
          console.log(`📧 Email buffer too short, waiting for more input`);
          return true; // consumed, wait for more
        }

        // Give them a nudge
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{
                type: "input_text",
                text: `[SYSTEM_CONTEXT]: The customer is spelling their email address but I couldn't fully understand it yet. What I heard was: "${combinedTranscript}". Please ask them to repeat from the beginning, spelling slowly one letter at a time. Remind them: say the letters individually, say 'at' for the @ symbol, say 'dot' for a full stop. Be warm and patient.`,
              }],
            },
          }));
          scheduleResponseCreate();
        }
        // Reset buffer for fresh attempt
        emailCaptureBuffer = [];
        return true;
      }

      // Successfully parsed — ask for confirmation
      emailCaptureConfirmPending = parsed;
      emailCaptureConfirmAsked = true;

      console.log(`📧 Parsed email: "${parsed}" — requesting confirmation`);
      socket.emit("email_spelling_confirmation", { email: parsed });

      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{
              type: "input_text",
              text: `[SYSTEM_CONTEXT]: I parsed the customer's spoken email as: "${parsed}". Read this email address back to them clearly and ask if it's correct. Spell out the local part (before the @) letter by letter, say "at" for @, then say the domain name. For example: if the email is "john.smith@gmail.com" say "I've got j-o-h-n dot s-m-i-t-h at gmail dot com — does that sound right?" Wait for them to say yes or no.`,
            }],
          },
        }));
        scheduleResponseCreate();
      }

      return true;
    }

    // ─── Sales step machine ───────────────────────────────────────
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
      const order = ["firstName", "lastName", "phone", "email", "createTicket", "done"];
      const idx = order.indexOf(completedStep);
      if (idx === -1) return;
      const next = order[idx + 1];
      if (!next) { salesStep = "done"; return; }

      if (next === "lastName" && c._lastName) { advanceSalesStep("lastName"); return; }
      if (next === "phone" && c.phone)         { advanceSalesStep("phone"); return; }
      if (next === "email" && c.email)         { advanceSalesStep("email"); return; }
      if (next === "createTicket" &&
          c._firstName && c._lastName && c.phone && c.email) {
        salesStep = "createTicket";
      } else {
        salesStep = next;
      }
      console.log(`📋 Sales step → ${salesStep}`);
    }

    function buildSalesStepHint() {
      const c = session.collected || {};

      if (salesStep === null && c.leadInterest && (c._websiteCheckDone || c._websiteCheckAsked)) {
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
          return `SALES STEP [email]: You have name and phone. Now ask for their email address using VOICE SPELLING MODE. Say EXACTLY: "And finally, could I grab your email address? Please spell it out for me one letter at a time — say 'at' for the at symbol, and 'dot' for a full stop. You can use NATO phonetics if you like — Alpha for A, Bravo for B, and so on. Take your time, I'm listening." Then STOP and wait. Do NOT ask for anything else. Do NOT mention any text box.`;

        case "createTicket": {
          const missing = [];
          if (!c._firstName && !c.name && !c.preferredName) missing.push("name");
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

    // ─── FIX 3: Raw phone buffer ─────────────────────────────────
    let rawPhoneBuffer = null;
    let awaitingPhoneVerification = false;

    // Plans-presented cooldown
    let plansPresentedAt = 0;
    const PLANS_PRESENTED_COOLDOWN_MS = 60000;

    // ─── Single pending response.create gate ────────────────────
    let responseCreatePending = false;

    function scheduleResponseCreate(contextHint = null, delayMs = 0, force = false) {
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
        const combinedHint = [contextHint, salesHint].filter(Boolean).join("\n\n");

        if (combinedHint) {
          openaiWs.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: `[SYSTEM_CONTEXT]: ${combinedHint}` }],
            },
          }));
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

    // ─── SILENCE TIMER ────────────────────────────────────────────
    let silenceTimer = null;
    const SILENCE_TIMEOUT_MS = 15000;
    const SILENCE_TIMEOUT_PACKAGE_MS = 20000;

    function startSilenceTimer() {
      clearSilenceTimer();

      // Never start timer when in email capture mode
      if (emailCaptureMode) return;
      if (awaitingStructuredInput) return;
      if (finalMessageLock || session.finalLock) return;
      if (pendingFunctionCalls > 0) return;
      if (assistantSpeaking) return;

      const inPlansCooldown = (Date.now() - plansPresentedAt) < PLANS_PRESENTED_COOLDOWN_MS;
      const timeoutMs = inPlansCooldown ? SILENCE_TIMEOUT_PACKAGE_MS : SILENCE_TIMEOUT_MS;

      console.log(`⏱️  Silence timer started: ${timeoutMs / 1000}s (${inPlansCooldown ? "package cooldown" : "normal"})`);

      silenceTimer = setTimeout(() => {
        silenceTimer = null;

        if (emailCaptureMode) return;
        if (awaitingStructuredInput) return;
        if (finalMessageLock || session.finalLock) return;
        if (pendingFunctionCalls > 0) return;
        if (assistantSpeaking) return;

        const stillInPlansCooldown = (Date.now() - plansPresentedAt) < PLANS_PRESENTED_COOLDOWN_MS;
        const nudgeText = stillInPlansCooldown
          ? "[SILENCE_NUDGE] The user has not responded after you presented plans. Do NOT select a plan for them. Simply ask them gently which plan they'd like to go with."
          : "[SILENCE_NUDGE] The user has not responded. REPEAT your last question. Say something like: 'Sorry about that — let me just repeat my last question. [REPEAT THE EXACT SAME QUESTION]'. Do NOT move forward.";

        console.log(`⏰ User silent for ${timeoutMs / 1000}s — nudging AI`);
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: nudgeText }],
            },
          }));
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

    // ─── Structured Input Detection (non-email only now) ─────────
    // Email is now handled entirely via voice — we no longer emit
    // request_structured_input for email. Only kept for future
    // non-email structured inputs if needed.
    function detectNonEmailStructuredInput(text) {
      // Currently no non-email structured inputs — placeholder
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
      if (/\bnbn\b/.test(t) || /\b(opti\s*comm|opticomm)\b/.test(t)) return null;
      if (/\b(first|1st|one|1|option\s*1|option\s*one|number\s*1|the\s*first)\b/.test(t)) return "NBN";
      if (/\b(second|2nd|two|2|option\s*2|option\s*two|number\s*2|the\s*second|to)\b/.test(t)) return "Opticomm";
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
          (lower.includes("$") || lower.includes("per month") || lower.includes("/m"))) ||
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
        (lower.includes("website") && (lower.includes("plans") || lower.includes("pricing")))
      );
    }

    function detectWebsiteCheckAnswer(text) {
      if (!text) return false;
      const lower = text.toLowerCase().trim();
      if (/\b(yes|yeah|yep|yup|i have|i did|already|looked|checked|seen|saw|visited)\b/.test(lower)) return true;
      if (/\b(no|nope|not yet|haven't|didn't|i haven't|i didn't|no i haven't)\b/.test(lower)) return true;
      return false;
    }

    /**
     * Detect if the AI's latest message is asking for email in voice spelling mode.
     * Used to auto-activate emailCaptureMode when the AI asks for email.
     */
    function detectEmailSpellingRequest(text) {
      if (!text) return false;
      const lower = text.toLowerCase();
      return (
        (lower.includes("spell") && lower.includes("email")) ||
        (lower.includes("one letter at a time") && lower.includes("email")) ||
        (lower.includes("nato") && lower.includes("email")) ||
        (lower.includes("alpha") && lower.includes("bravo") && lower.includes("email")) ||
        (lower.includes("say 'at'") && lower.includes("email")) ||
        (lower.includes("i'm listening") && lower.includes("email"))
      );
    }

    function detectSalesStepAnswer(text) {
      if (!salesStep || salesStep === "done" || salesStep === "createTicket") return;
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
      // email step is handled by emailCaptureMode — NOT here
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
        elWs.send(JSON.stringify({
          text: " ",
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.75,
            speed: 1.1,
          },
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
            socket.emit("audio_chunk_pcm", {
              sampleRate: PCM_SAMPLE_RATE,
              audio: msg.audio,
            });
          }

          const isFinal = msg.isFinal === true || msg.is_final === true || msg.final === true;

          if (isFinal) {
            console.log(`🔊 [EL] TTS playback complete (isFinal)`);
            socket.emit("audio_done");
            assistantSpeaking = false;

            // If we just finished speaking a spelling prompt → notify frontend
            if (emailCaptureMode && !emailCaptureConfirmAsked) {
              socket.emit("email_spelling_ready");
            }

            if (!pendingFunctionCalls && !awaitingStructuredInput && !emailCaptureMode && !finalMessageLock && !session.finalLock) {
              startSilenceTimer();
            }

            lastResponseWasPackage = false;
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
        elevenLabsWs.send(JSON.stringify({
          text: " ",
          voice_settings: { stability: 0.4, similarity_boost: 0.75, speed: 1.1 },
          xi_api_key: ELEVENLABS_API_KEY,
        }));
        elevenLabsReady = true;
      } catch (e) {
        console.warn("[EL] re-prime failed:", e.message);
        openElevenLabsStream(true);
      }
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
          {
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "OpenAI-Beta": "realtime=v1",
            },
          }
        );

        openaiWs.on("open", () => {
          console.log("✅ [WS-1] OpenAI Realtime connected");
          const instructions =
            SYSTEM_PROMPT +
            "\n\nCRITICAL: You MUST ALWAYS respond in English only. Never respond in any other language." +
            "\n\nFIELD COLLECTION RULE: When collecting customer details (name, phone, email), you MUST ask for ONE field at a time. Wait for the customer's answer before moving to the next field. The [SYSTEM_CONTEXT] hint will tell you EXACTLY which field to ask for next. Follow it precisely." +
            "\n\nEMAIL COLLECTION — VOICE ONLY: When the sales step requires email, instruct the customer to spell it out one letter at a time. Say 'at' for @, 'dot' for a full stop. You can use NATO phonetics. NEVER tell them to use a text box or type anything. The system will handle parsing their spelling automatically." +
            "\n\nPLAN PRESENTATION — VOICE ONLY: When presenting plans to customers, use the voice_description field from each plan. Speak naturally - say prices as words like 'sixty four dollars' not '$64'. Say speeds as 'twenty five megabits down and ten up' not '25/10 Mbps'. Read the voice_description exactly as provided.";

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
                silence_duration_ms: 1500,
              },
              tools: realtimeTools,
              tool_choice: "auto",
              input_audio_transcription: { model: "whisper-1" },
            },
          }));

          openElevenLabsStream();
        });

        let resolved = false;
        openaiWs.on("message", (raw) => {
          try {
            const data = JSON.parse(raw.toString());
            if (!resolved) { resolved = true; resolve(); }
            handleOpenAIEvent(data);
          } catch (e) {
            console.error("[WS-1] parse error:", e.message);
          }
        });

        openaiWs.on("error", (err) => {
          console.error("[WS-1] error:", err.message);
          if (!resolved) { resolved = true; reject(err); }
        });
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
        case "session.created":
          break;

        case "session.updated":
          console.log("✅ [WS-1] Session configured");
          break;

        case "input_audio_buffer.speech_started": {
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

          const looksLikeEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(cleaned);
          const digitCount = (cleaned.match(/\d/g) || []).length;
          const looksLikePhone = digitCount >= 6;

          if (assistantSpeaking && !(looksLikeEmail || looksLikePhone)) {
            console.log(`🔇 Ignoring transcript during assistant speech`);
            break;
          }

          // ── FIX 3: Capture raw phone BEFORE any LLM processing ──
          if (awaitingPhoneVerification && looksLikePhone) {
            const digits = cleaned.replace(/\D/g, "");
            if (digits.length >= 6) {
              rawPhoneBuffer = digits;
              console.log(`📞 Raw phone captured from transcript: "${rawPhoneBuffer}"`);
            }
          }

          // ── VOICE EMAIL CAPTURE ───────────────────────────────────
          // Check if we're in email capture mode OR if transcript looks like
          // a voice email spelling attempt (Whisper sometimes auto-formats)
          if (emailCaptureMode || (salesStep === "email" && (looksLikeEmail || looksLikeVoiceEmailSpelling(cleaned)))) {
            if (!emailCaptureMode) startEmailCapture();
            const consumed = handleEmailCaptureTranscript(cleaned);
            if (consumed) {
              socket.emit("user_transcript", cleaned);
              clearSilenceTimer();
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
              openaiWs.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "user",
                  content: [{ type: "input_text", text: clarified }],
                },
              }));
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
              .find(m => m.role === "assistant");
            if (lastAiMsg && detectWebsiteCheckQuestion(lastAiMsg.content || "")) {
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
            const newTextNorm = event.text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
            const lastTextNorm = lastAssistantText.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
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
              plansPresentedAt = Date.now();
              lastResponseWasPackage = true;
              console.log(`📋 Plans presented — cooldown activated (${PLANS_PRESENTED_COOLDOWN_MS / 1000}s)`);
            }

            // ── FIX 3: Detect phone verification request ──────────────
            if (detectPhoneVerificationRequest(event.text)) {
              awaitingPhoneVerification = true;
              rawPhoneBuffer = null;
              console.log(`📞 Awaiting phone verification input`);
            }

            // ── VOICE EMAIL: Auto-activate capture when AI asks for email ─
            if (detectEmailSpellingRequest(event.text) && salesStep === "email") {
              console.log(`📧 AI asked for email spelling — activating capture mode`);
              // Slight delay so TTS starts playing first
              setTimeout(() => startEmailCapture(), 500);
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

            // No email structured input detection here — voice only
          }
          break;

        case "response.done": {
          isResponseActive = false;

          const outputItems = event.response?.output || [];
          const hasTextOutput = outputItems.some(
            item => item.type === "message" && item.content?.some(c => c.type === "text" && c.text?.trim())
          ) || currentResponseHadOutput;
          const hasFunctionCall = outputItems.some(item => item.type === "function_call");

          if (!hasFunctionCall && !hasTextOutput && pendingFunctionCalls === 0 && !finalMessageLock) {
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
                `⚠️ response.done with no output (attempt ${emptyResponseCount}/${MAX_EMPTY_RETRIES}) — retrying in ${retryDelay}ms`
              );
              scheduleResponseCreate(null, retryDelay, true);
            } else {
              console.warn(`⚠️ Max retries (${MAX_EMPTY_RETRIES}) reached — stopping retry loop`);
              emptyResponseCount = 0;
              socket.emit("status", "listening");
            }
            break;
          }

          emptyResponseCount = 0;

          if (assistantTextBuffer.trim()) {
            const t = assistantTextBuffer.toLowerCase();
            const confirms = [
              "raised", "ticket details", "details via email",
              "agent will contact", "raised a ticket", "raised sales inquiry",
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
            // Timer starts from ElevenLabs isFinal only
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
          if (isResponseActive) isResponseActive = false;
          if (pendingFunctionCalls > 0) pendingFunctionCalls = 0;
          emptyResponseCount = 0;
          responseCreatePending = false;
          pendingPostDoneCreate = false;
          socket.emit("status", "listening");
          break;
      }
    }

    // ═══════════════ Tool Execution ═══════════════
    async function handleFunctionCall(item) {
      const { call_id, name: fn, arguments: argsStr } = item;
      let args = safeParseJSON(argsStr) || {};

      // ── Guard: verify_phone must NEVER run in sales flow ────────
      if (fn === "verify_phone" && !session.collected._emailVerifiedCustomerId) {
        console.log(`⚠️  verify_phone called in SALES flow — redirecting to save phone`);
        const phoneToSave = args.phone || rawPhoneBuffer;
        rawPhoneBuffer = null;
        awaitingPhoneVerification = false;
        if (phoneToSave) {
          session.collected.phone = String(phoneToSave).replace(/\D/g, "") || phoneToSave;
          sessions.set(session.id, session);
          if (salesStep === "phone") advanceSalesStep("phone");
          console.log(`📋 Sales phone saved: ${session.collected.phone}`);
        }
        const fakeResult = JSON.stringify({ success: true, _redirected: true, message: "Phone number saved." });
        if (openaiWs?.readyState === WebSocket.OPEN) {
          openaiWs.send(JSON.stringify({
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id, output: fakeResult },
          }));
        }
        pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);
        if (pendingFunctionCalls === 0 && openaiWs?.readyState === WebSocket.OPEN) {
          const salesHint = buildSalesStepHint() || "";
          const hint = `Phone number has been saved. ${salesHint}\n\nIMPORTANT: Respond immediately — proceed to the next step.`;
          openaiWs.send(JSON.stringify({
            type: "conversation.item.create",
            item: { type: "message", role: "user", content: [{ type: "input_text", text: `[SYSTEM_CONTEXT]: ${hint}` }] },
          }));
          scheduleResponseCreate();
        }
        return;
      }

      // ── FIX 3: Override phone arg with raw buffer if available ──
      if (fn === "verify_phone" && rawPhoneBuffer) {
        console.log(`📞 FIX 3: Overriding LLM phone arg "${args.phone}" with raw buffer "${rawPhoneBuffer}"`);
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

      // ── Build system hint ────────────────────────────────────
      let systemHint = `Current collected fields: ${JSON.stringify(
        Object.fromEntries(
          Object.entries(session.collected || {}).filter(([k]) => k !== "_registeredPhone" && k !== "_rp")
        )
      )}.`;

      if (fn === "check_address_availability") {
        let parsedResult = null;
        try { parsedResult = JSON.parse(result); } catch (_) {}
        if (parsedResult) {
          const networkLabel = parsedResult.network || "the available network";
          const planCount = Array.isArray(parsedResult.availablePlans) ? parsedResult.availablePlans.length : 0;
          const requiresFilter = parsedResult.requiresResidentialFilter === true;

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
        try { parsedResult = JSON.parse(result); } catch (_) {}
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
        try { parsedResult = JSON.parse(result); } catch (_) {}
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
        try { parsedResult = JSON.parse(result); } catch (_) {}
        if (parsedResult?._blocked && parsedResult?.reason === "email_missing") {
          unlockFinalMessage();
          salesStep = "email";
          systemHint += `
TOOL RESULT: create_ticket was BLOCKED because email has not been collected yet. You MUST ask for the email address NOW using VOICE SPELLING MODE. Say: "I still need your email address. Please spell it out for me one letter at a time — say 'at' for the at symbol, 'dot' for a full stop. Take your time."`;
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
        if (c.leadInterest && c._websiteCheckRequired && (c._websiteCheckAsked || c._websiteCheckDone)) {
          systemHint += `\nWEBSITE CHECK DONE: Do NOT ask again. Proceed with order collection.`;
        }

        const stepHint = buildSalesStepHint();
        if (stepHint) systemHint += `\n\n${stepHint}`;
      }

      // Send function output to OpenAI
      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id, output: result },
        }));
      }

      pendingFunctionCalls = Math.max(0, pendingFunctionCalls - 1);

      if (pendingFunctionCalls === 0 && openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{
              type: "input_text",
              text: `[SYSTEM_CONTEXT]: ${systemHint}\n\nIMPORTANT: Respond immediately based on the tool result above.`,
            }],
          },
        }));

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
          const firstName = (args.preferredName || args.name || "").split(" ")[0];
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
        // email is handled by emailCaptureMode — NOT by extract_call_fields
        // But if it somehow arrives here (e.g. support flow), accept it
        // ALLOW UPDATES: If user provides new email, update it (for corrections)
        if (args.email) {
          session.collected.email = args.email;
          sessions.set(session.id, session);
          if (salesStep === "email") advanceSalesStep("email");
        }

        return JSON.stringify({ success: true });
      }

      if (fn === "customer_lookup") {
        const lookupArgs = { ...(args || {}) };
        delete lookupArgs.phone;

        if (!lookupArgs.email && !lookupArgs.name) {
          return JSON.stringify({ success: false, message: "Email is required for customer lookup" });
        }

        try {
          const result = await customerLookup(lookupArgs);
          if (result.success && result.customer) {
            session.collected._emailVerifiedCustomerId = result.customer.id;
            session.collected._registeredPhone = result.customer.phone || result.customer.phone_mobile || null;
            session.collected._rp = session.collected._registeredPhone;
            session.collected._phoneVerified = false;
            session.collected.customer_id = result.customer.id;
            sessions.set(session.id, session);
            console.log(
              `📧 Email lookup OK — customer ${result.customer.id}. ` +
              `Registered phone: ${session.collected._registeredPhone ? "stored (hidden)" : "NOT on record"}`
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
          // FAILED LOOKUP: Clear email so user can provide correction
          console.log(`📧 Email lookup failed for "${lookupArgs.email}" — clearing for retry`);
          delete session.collected.email;
          delete session.collected._emailVerifiedCustomerId;
          sessions.set(session.id, session);
          return JSON.stringify({ ...result, _emailCleared: true, message: "No account found with that email. Please check and try again, or provide a different email address." });
        } catch (e) {
          return JSON.stringify({ success: false, error: e.message });
        }
      }

      if (fn === "verify_phone") {
        const { phone } = args || {};
        if (!phone) {
          return JSON.stringify({ success: false, verificationFailed: true, message: "No phone number provided." });
        }

        const emailCustomerId = session.collected._emailVerifiedCustomerId;
        if (!emailCustomerId) {
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "Email verification must be completed first.",
          });
        }

        const registeredPhone = session.collected._registeredPhone || session.collected._rp;
        if (!registeredPhone) {
          console.warn(`⚠️ No registered phone for customer ${emailCustomerId}`);
          return JSON.stringify({
            success: false,
            verificationFailed: true,
            message: "No phone number registered on this account. Please contact support via email.",
          });
        }

        const normalize = (normalizePhone && typeof normalizePhone === "function")
          ? normalizePhone
          : (p) => String(p || "").replace(/\D/g, "").replace(/^61(\d{9})$/, "0$1");

        const normalizedInput = normalize(phone);
        const normalizedRegistered = normalize(registeredPhone);

        console.log(`📞 Phone verify: input="${normalizedInput}" registered="${normalizedRegistered.substring(0, 4)}****"`);

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
        console.log(`✅ Phone verification PASSED — customer ${emailCustomerId} fully verified`);
        return JSON.stringify({ success: true, verified: true, customer_id: emailCustomerId });
      }

      if (fn === "check_address_availability") {
        try {
          if (args.address) session.collected.address = args.address;
          return await checkAddressAvailability(args, session);
        } catch (err) {
          console.error("check_address_availability error:", err.message);
          return JSON.stringify({ success: false, error: err.message, address: args.address });
        }
      }

      if (fn === "create_ticket") {
        let fa = { ...args };
        if (typeof fa.message === "string") fa.message = { message: fa.message };

        const collected = session.collected || {};
        const hasCustomerId = !!(fa.customer_id || collected.customer_id);
        const hasLeadInterest = !!(collected.leadInterest || fa.leadInterest);
        const isSupportTicket = hasCustomerId && !hasLeadInterest;

        // ── GUARD: Block sales create_ticket if email is missing ──
        if (!isSupportTicket && !collected.email) {
          console.warn("⚠️  create_ticket BLOCKED — email missing. Forcing email step.");
          salesStep = "email";
          unlockFinalMessage();
          finalMessageLock = false;
          session.finalLock = false;
          // Activate voice email capture
          setTimeout(() => startEmailCapture(), 200);
          return JSON.stringify({
            success: false,
            _blocked: true,
            reason: "email_missing",
            message: "SALES STEP [email]: Ask for email by voice spelling mode.",
          });
        }

        const detailLines = [];
        const fullName = [collected._firstName, collected._lastName].filter(Boolean).join(" ") || collected.name || collected.preferredName;
        if (fullName) detailLines.push(`Name: ${fullName}`);
        if (collected.email) detailLines.push(`Email: ${collected.email}`);
        if (collected.phone) detailLines.push(`Phone: ${collected.phone}`);
        if (collected.address) detailLines.push(`Address: ${collected.address}`);
        if (collected.networkPreference) detailLines.push(`Network: ${collected.networkPreference}`);
        if (collected.residentialPreference) detailLines.push(`Type: ${collected.residentialPreference}`);
        if (collected.leadInterest || fa.leadInterest)
          detailLines.push(`Selected Plan: ${collected.leadInterest || fa.leadInterest}`);

        const detailsBlock = detailLines.length > 0
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
            console.log(`📝 Creating SUPPORT ticket: "${fa.subject}" customer_id=${fa.customer_id}`);
            const r = await splynx.request("POST", "admin/support/tickets", objectToUrlEncoded(fa));
            console.log(`✅ Splynx ticket created: ID=${r.id}`);
            const emailResult = await sendTicketEmail(r.id, fa, collected, true);
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
            const emailResult = await sendTicketEmail(null, fa, collected, false);
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
        return JSON.stringify({ success: true, types: await splynx.request("GET", "admin/support/tickets-types") });
      if (fn === "get_ticket_groups")
        return JSON.stringify({ success: true, groups: await splynx.request("GET", "admin/support/tickets-groups") });
      if (fn === "get_ticket_statuses")
        return JSON.stringify({ success: true, statuses: await splynx.request("GET", "admin/support/tickets-statuses") });

      return JSON.stringify({ error: `Unknown tool: ${fn}` });
    }

    // ═══════════════ Client Audio → OpenAI ═══════════════
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
        const state = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][openaiWs?.readyState] || "UNKNOWN";
        console.log(`🎤 [${socket.id}] [OpenAI: ${state}]`);
        lastAudioLog = now;
      }
      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
      }
    });

    // ═══════════════ Structured Input (non-email legacy) ═══════════════
    socket.on("structured_input", (payload) => {
      if (!payload || !payload.field || !payload.value) return;
      const { field, value } = payload;

      // If email arrives via structured_input (legacy/fallback path), handle it
      if (field === "email") {
        console.log(`📧 Email received via structured_input fallback: "${value}"`);
        session.collected.email = value;
        sessions.set(session.id, session);
        if (salesStep === "email") advanceSalesStep("email");
        resetEmailCapture();
        awaitingStructuredInput = false;
        structuredInputField = null;

        const userMessage = `My email is ${value}`;
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
          const salesHint = buildSalesStepHint() || "";
          const hint = `Customer email confirmed: ${value}. ${salesHint} Proceed immediately.`;
          openaiWs.send(JSON.stringify({
            type: "conversation.item.create",
            item: { type: "message", role: "user", content: [{ type: "input_text", text: `[SYSTEM_CONTEXT]: ${hint}` }] },
          }));
          scheduleResponseCreate();
        }

        socket.emit("structured_input_accepted", { field, value });
        socket.emit("status", "listening");
        return;
      }

      // Non-email structured input (future use)
      console.log(`📋 Structured input received: ${field} = "${value}"`);
      clearSilenceTimer();
      awaitingStructuredInput = false;
      structuredInputField = null;

      const userMessage = `My ${field} is ${value}`;
      session.messages.push({ role: "user", content: userMessage });
      sessions.set(session.id, session);
      socket.emit("user_transcript", userMessage);

      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({
          type: "conversation.item.create",
          item: { type: "message", role: "user", content: [{ type: "input_text", text: userMessage }] },
        }));
        scheduleResponseCreate();
      }

      socket.emit("structured_input_accepted", { field, value });
      socket.emit("status", "listening");
    });

    // ═══════════════ Cleanup ═══════════════
    socket.on("disconnect", () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
      clearSilenceTimer();
      if (finalMessageTimer) {
        clearTimeout(finalMessageTimer);
        finalMessageTimer = null;
      }
      closeElevenLabsWs();
      if (openaiWs) try { openaiWs.close(); } catch (_) {}
      sessions.delete(session.id);
    });

    // ═══════════════ Boot ═══════════════
    (async () => {
      try {
        console.log("⏳ Connecting OpenAI Realtime...");
        await connectOpenAI();
        console.log("✅ OpenAI connected! ElevenLabs pre-warmed. Waiting 200ms...");
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