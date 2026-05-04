/**
 * email-parser.js
 * ═══════════════════════════════════════════════════════════════════
 * Voice-based email address parser.
 *
 * Handles:
 *   • NATO phonetic alphabet  (alpha → a, bravo → b, …)
 *   • Common phonetic variants (apple → a, boy → b, …)
 *   • Single spoken letters   ("a", "b", …)
 *   • Digit words             (one → 1, two → 2, …)
 *   • Symbol words            (at → @, dot → ., underscore → _, …)
 *   • Noise / filler words    (space, hyphen spoken as "dash", etc.)
 *   • Normalization + RFC-style validation
 *
 * Main exports:
 *   parseVoiceEmail(transcript)  → { email, confidence, issues }
 *   validateEmail(email)         → boolean
 *   humanReadableEmail(email)    → string  ("john dot doe at gmail dot com")
 *   isLikelyEmailTranscript(txt) → boolean
 * ═══════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────
//  NATO phonetic alphabet + common voice variants → single character
// ─────────────────────────────────────────────────────────────────
const PHONETIC_TO_CHAR = {
  // ── NATO ─────────────────────────────────────────────────────
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

  // ── Common spoken alternatives ────────────────────────────────
  apple: "a",
  amsterdam: "a",
  andrew: "a",
  baker: "b",
  banana: "b",
  boy: "b",
  bob: "b",
  cat: "c",
  canada: "c",
  chicago: "c",
  dog: "d",
  david: "d",
  denmark: "d",
  edward: "e",
  england: "e",
  easy: "e",
  frank: "f",
  france: "f",
  florida: "f",
  fox: "f",
  george: "g",
  germany: "g",
  green: "g",
  henry: "h",
  harry: "h",
  ivan: "i",
  italy: "i",
  igloo: "i",
  john: "j",
  japan: "j",
  king: "k",
  kevin: "k",
  london: "l",
  lucy: "l",
  larry: "l",
  mary: "m",
  mark: "m",
  margaret: "m",
  nancy: "n",
  norway: "n",
  nora: "n",
  oliver: "o",
  orange: "o",
  ohio: "o",
  peter: "p",
  paul: "p",
  paris: "p",
  queen: "q",
  robert: "r",
  roger: "r",
  richard: "r",
  sam: "s",
  sugar: "s",
  susan: "s",
  sydney: "s",
  tom: "t",
  texas: "t",
  tommy: "t",
  uncle: "u",
  umbrella: "u",
  victoria: "v",
  violet: "v",
  william: "w",
  washington: "w",
  walter: "w",
  wales: "w",
  xavier: "x",
  yellow: "y",
  york: "y",
  zebra: "z",
  zero: "z",

  // ── Extra spoken letter helpers ───────────────────────────────
  as: "a", // "a as in apple" → strip "as in" then "apple"
};

// ─────────────────────────────────────────────────────────────────
//  Digit words → numeric character
// ─────────────────────────────────────────────────────────────────
const DIGIT_WORDS = {
  zero: "0",
  oh: "0",
  nought: "0",
  one: "1",
  won: "1",
  two: "2",
  to: "2",
  too: "2",
  three: "3",
  four: "4",
  for: "4",
  fore: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  ate: "8",
  nine: "9",
};

// ─────────────────────────────────────────────────────────────────
//  Symbol words → symbol character
// ─────────────────────────────────────────────────────────────────
const SYMBOL_WORDS = {
  at: "@",
  "at sign": "@",
  "at symbol": "@",
  "@": "@",
  dot: ".",
  period: ".",
  point: ".",
  full: ".", // "full stop"
  stop: ".", // "full stop" → "stop" left after "full"
  underscore: "_",
  "under score": "_",
  under: "_",
  dash: "-",
  hyphen: "-",
  minus: "-",
  plus: "+",
  hash: "#",
  hashtag: "#",
  pound: "#",
  slash: "/", // rare but possible
};

// ─────────────────────────────────────────────────────────────────
//  Words / filler to ignore entirely
// ─────────────────────────────────────────────────────────────────
const FILLER_WORDS = new Set([
  "my",
  "email",
  "address",
  "is",
  "the",
  "it",
  "a",
  "an",
  "and",
  "for",
  "me",
  "i",
  "would",
  "like",
  "to",
  "give",
  "you",
  "so",
  "as",
  "in",
  "of",
  "letter",
  "character",
  "symbol",
  "number",
  "capital",
  "lowercase",
  "upper",
  "lower",
  "space",
  "blank", // spoken "space" between letters → ignore
  "please",
  "okay",
  "ok",
  "right",
  "yeah",
  "so",
  "that",
  "s",
  "its",
  "that's",
]);

/**
 * Pre-process the raw ASR transcript:
 *   1. Lowercase
 *   2. Expand multi-word symbol phrases before tokenising
 *   3. Strip "as in" / "for" connectors ("b as in bravo" → "bravo")
 */
function preprocess(text) {
  let t = (text || "").toLowerCase().trim();

  // ── Expand multi-word phrases ─────────────────────────────────
  t = t.replace(/at\s+sign/g, "at");
  t = t.replace(/at\s+symbol/g, "at");
  t = t.replace(/under\s+score/g, "underscore");
  t = t.replace(/full\s+stop/g, "dot");
  t = t.replace(/x\s*-\s*ray/g, "xray");

  // ── Remove "as in" / "for" connectors ────────────────────────
  //  "b as in bravo"   → "b bravo"     (both resolve to b, deduplicate later)
  //  "b for bravo"     → "b bravo"
  t = t.replace(/\b(\w)\s+as\s+in\s+/g, "$1 ");
  t = t.replace(/\b(\w)\s+for\s+/g, "$1 ");

  // ── Strip punctuation except @, ., _, -, + ───────────────────
  t = t.replace(/[^a-z0-9@._\-+ ]/g, " ");

  // ── Collapse whitespace ───────────────────────────────────────
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

/**
 * Resolve a single token to its email character (or null).
 */
function resolveToken(token) {
  const t = token.toLowerCase().trim();
  if (!t) return null;

  // Already a single ascii letter or digit
  if (/^[a-z0-9]$/.test(t)) return t;

  // Already an email-valid symbol
  if (["@", ".", "_", "-", "+"].includes(t)) return t;

  // Symbol words
  if (SYMBOL_WORDS[t] !== undefined) return SYMBOL_WORDS[t];

  // Digit words
  if (DIGIT_WORDS[t] !== undefined) return DIGIT_WORDS[t];

  // Phonetic alphabet
  if (PHONETIC_TO_CHAR[t] !== undefined) return PHONETIC_TO_CHAR[t];

  // Filler → ignore
  if (FILLER_WORDS.has(t)) return null;

  // Multi-character token that looks like an inline email fragment
  // e.g. "gmail" or "yahoo" or "hotmail" — pass through as-is
  if (/^[a-z0-9]+$/.test(t) && t.length > 1) return t;

  return null;
}

/**
 * After resolving all tokens into a raw string, normalise it:
 *   - Lowercase
 *   - Remove spaces
 *   - Collapse duplicate dots / ats
 *   - Trim leading/trailing dots from local part and domain
 */
function normalise(raw) {
  let s = raw.toLowerCase().replace(/\s+/g, "");

  // Collapse consecutive dots (e.g. "dot dot" artefact)
  s = s.replace(/\.{2,}/g, ".");

  // Collapse consecutive @
  s = s.replace(/@{2,}/g, "@");

  // Remove leading/trailing dots from entire string
  s = s.replace(/^\.+|\.+$/g, "");

  // Remove dot immediately before or after @
  s = s.replace(/\.@/g, "@").replace(/@\./g, "@");

  return s;
}

/**
 * Detect and eliminate consecutive-duplicate characters that
 * arise when the user says the same phonetic word twice
 * (e.g. "november november" → "n" not "nn", but "nn" is valid
 *  in email so we only de-dup when the token resolves to the
 *  same single char consecutively AND it's a letter, not a digit).
 *
 * We are intentionally conservative: only deduplicate when there
 * are 3+ consecutive identical letters, which almost certainly
 * means a repeat artefact.
 */
function deduplicateArtefacts(chars) {
  const result = [];
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    // Count run length
    let j = i + 1;
    while (j < chars.length && chars[j] === c) j++;
    const runLen = j - i;

    if (/[a-z]/.test(c) && runLen >= 3) {
      // Likely artefact — keep just one
      result.push(c);
    } else {
      // Keep the run as-is
      for (let k = i; k < j; k++) result.push(chars[k]);
    }
    i = j;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Parse a voice transcript into an email address.
 *
 * @param {string} transcript  Raw ASR transcript from Whisper
 * @returns {{ email: string, confidence: number, issues: string[] }}
 *
 * confidence: 0–1
 *   1.0  = fully valid, has @ and .tld
 *   0.7  = has @ but missing dot in domain
 *   0.4  = no @ found but looks like address
 *   0.0  = could not parse at all
 */
export function parseVoiceEmail(transcript) {
  const issues = [];

  const preprocessed = preprocess(transcript);
  const tokens = preprocessed.split(/\s+/);

  const resolved = [];
  for (const token of tokens) {
    const ch = resolveToken(token);
    if (ch !== null) resolved.push(ch);
  }

  const deduped = deduplicateArtefacts(resolved);
  const raw = deduped.join("");
  const email = normalise(raw);

  // ── Confidence scoring ────────────────────────────────────────
  let confidence = 0;
  const hasAt = email.includes("@");
  const hasDot = email.includes(".");
  const parts = email.split("@");
  const localPart = parts[0] || "";
  const domainPart = parts[1] || "";

  if (hasAt && hasDot && localPart.length >= 1 && domainPart.includes(".")) {
    confidence = 1.0;
  } else if (hasAt && localPart.length >= 1 && domainPart.length >= 1) {
    confidence = 0.7;
    issues.push("Domain appears to be missing a dot (e.g. '.com')");
  } else if (hasAt) {
    confidence = 0.5;
    issues.push("Missing domain after @");
  } else if (hasDot && localPart.length >= 3) {
    confidence = 0.3;
    issues.push("Missing @ symbol — did the user say 'at'?");
  } else if (email.length >= 3) {
    confidence = 0.1;
    issues.push("Could not identify @ or domain structure");
  } else {
    confidence = 0;
    issues.push("Failed to parse any recognisable email structure");
  }

  return { email, confidence, issues };
}

/**
 * Basic RFC-5321-style email validation.
 * Intentionally lenient — catches obviously broken addresses.
 */
export function validateEmail(email) {
  if (!email || typeof email !== "string") return false;
  const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
}

/**
 * Convert a parsed email address into a spoken confirmation string.
 * e.g. "john.doe@gmail.com" → "john dot doe at gmail dot com"
 */
export function humanReadableEmail(email) {
  if (!email) return "";
  return email
    .replace(/\./g, " dot ")
    .replace(/@/g, " at ")
    .replace(/_/g, " underscore ")
    .replace(/-/g, " dash ")
    .replace(/\+/g, " plus ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Quick heuristic to detect whether a voice transcript is
 * likely attempting to spell out an email address.
 */
export function isLikelyEmailTranscript(text) {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Contains "at" followed by known domain words
  if (
    /\bat\b.{0,30}\b(gmail|yahoo|hotmail|outlook|icloud|live|me|apple)\b/i.test(
      lower,
    )
  )
    return true;

  // Contains "dot com" / "dot net" / "dot org" / "dot au" etc.
  if (/\bdot\s+(com|net|org|edu|gov|au|co|io|info|biz)\b/i.test(lower))
    return true;

  // Contains phonetic letter sequences (3+ distinct phonetic words)
  const phoneticCount = lower
    .split(/\s+/)
    .filter((w) => PHONETIC_TO_CHAR[w]).length;
  if (phoneticCount >= 3) return true;

  // Obvious inline email fragment
  if (/\b[a-z0-9]+\s+at\s+[a-z0-9]+\s+dot\b/i.test(lower)) return true;

  return false;
}

/**
 * Simple helper: given a raw confidence value and attempt count,
 * decide what action to take.
 *
 * Returns:
 *   "accept"  — confidence high enough, email looks valid
 *   "confirm" — confidence medium, present to user for confirmation
 *   "retry"   — confidence too low, ask user to repeat
 *   "fallback"— exhausted retries, show text input box
 */
export function decideEmailAction(confidence, attemptNumber, maxAttempts = 3) {
  if (confidence >= 0.9) return "accept"; // near-perfect parse
  if (confidence >= 0.6 && attemptNumber <= maxAttempts) return "confirm";
  if (attemptNumber < maxAttempts) return "retry";
  return "fallback";
}
