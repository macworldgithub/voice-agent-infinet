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
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

if (!OPENAI_API_KEY) { console.error("❌ Please set OPENAI_API_KEY in your .env file"); process.exit(1); }
if (!ELEVENLABS_API_KEY) { console.error("❌ Please set ELEVENLABS_API_KEY in your .env file"); process.exit(1); }

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.sparkpostmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: { user: process.env.SMTP_USER || "SMTP_Injection", pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});
if (!process.env.SMTP_PASS) console.warn("⚠️ SMTP_PASS not set — email notifications DISABLED");

async function sendTicketEmail(ticketId, ticketArgs, collectedFields, isSupportTicket = false) {
  if (!process.env.SMTP_PASS) {
    console.warn("⚠️ SMTP_PASS not set — skipping email");
    return { sent: false, reason: "SMTP not configured" };
  }
  const recipient = isSupportTicket ? "support@infinetbroadband.com.au" : "sales@infinetbroadband.com.au";
  const type = isSupportTicket ? "Support" : "Sales";
  const referenceLine = ticketId ? `<p><strong>Ticket:</strong> ${ticketId}</p>` : `<p><strong>Reference:</strong> New ${type.toLowerCase()} enquiry</p>`;
  const subject = `New ${type} Enquiry ${ticketId ? `— Ticket #${ticketId}` : ""} — ${ticketArgs.subject || "Inquiry"}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;line-height:1.6;">
    <h2>New ${type} Enquiry Received</h2>
    ${referenceLine}
    <p><strong>Subject:</strong> ${ticketArgs.subject || "N/A"}</p>
    <p><strong>Priority:</strong> ${ticketArgs.priority || "medium"}</p>
    ${ticketArgs.customer_id ? `<p><strong>Customer ID:</strong> ${ticketArgs.customer_id}</p>` : `<p><strong>New Lead (no customer ID)</strong></p>`}
    ${collectedFields?.preferredName ? `<p><strong>Name:</strong> ${collectedFields.preferredName}</p>` : ""}
    ${collectedFields?.email ? `<p><strong>Email:</strong> ${collectedFields.email}</p>` : ""}
    ${collectedFields?.phone ? `<p><strong>Phone:</strong> ${collectedFields.phone}</p>` : ""}
    ${collectedFields?.address ? `<p><strong>Address:</strong> ${collectedFields.address}</p>` : ""}
    <h3>Message Body</h3>
    <p>${(ticketArgs.message && (ticketArgs.message.message || ticketArgs.message)) || "No additional message"}</p>
    <hr>
    <p><small>Automated email from InfiNET Broadband AI Assistant.<br>
    ${isSupportTicket && ticketId ? `View ticket: https://infinetbroadband-portal.com.au/admin/support/tickets/${ticketId}` : `This is a ${type.toLowerCase()} enquiry — to be followed up manually.`}
    </small></p>
  </body></html>`;
  try {
    const recipients = ["karimjawwad09@gmail.com", recipient];
    console.log(`📧 Attempting to send ${type} email to: ${recipients.join(", ")}`);
    await transporter.sendMail({ from: '"InfiNET AI Assistant" <noreply@infinetbroadband.com.au>', to: recipients, subject, html });
    console.log(`✅ 📧 Email SENT for ${type.toLowerCase()} enquiry${ticketId ? ` #${ticketId}` : ""}`);
    return { sent: true };
  } catch (err) {
    console.error(`❌ 📧 Email FAILED for ${type.toLowerCase()} enquiry:`, err.message, err.code || "", err.response || "");
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

try { dns.setDefaultResultOrder("ipv4first"); } catch (_) { }

class SplynxApiClient {
  constructor(config) {
    this.baseUrl = config.SPLYNX_BASE_URL; this.apiKey = config.API_KEY;
    this.apiSecret = config.API_SECRET; this.accessToken = null;
    this.accessTokenExpiration = 0; this.refreshToken = null;
    this.refreshTokenExpiration = 0; this.useAccessToken = config.USE_ACCESS_TOKEN !== false;
  }
  generateSignature(nonce) { const hmac = crypto.createHmac("sha256", this.apiSecret); hmac.update(nonce + this.apiKey); return hmac.digest("hex").toUpperCase(); }
  getSignatureAuthHeader() { const nonce = Math.round((Date.now() / 1000) * 100); return `Splynx-EA (${new URLSearchParams({ key: this.apiKey, nonce, signature: this.generateSignature(nonce) }).toString()})`; }
  async generateAccessToken() {
    const nonce = Math.floor(Date.now() / 1000);
    const response = await axios.post(`${this.baseUrl}admin/auth/tokens`, { auth_type: "api_key", key: this.apiKey, nonce, signature: this.generateSignature(nonce) }, { headers: { "Content-Type": "application/json" } });
    const d = response.data; this.accessToken = d.access_token; this.accessTokenExpiration = d.access_token_expiration; this.refreshToken = d.refresh_token; this.refreshTokenExpiration = d.refresh_token_expiration;
    console.log("✅ Splynx Access token generated"); return d;
  }
  async renewAccessToken() {
    if (!this.refreshToken) throw new Error("No refresh token");
    const response = await axios.get(`${this.baseUrl}admin/auth/tokens/${this.refreshToken}`, { headers: { Authorization: `Splynx-EA (access_token=${this.accessToken})` } });
    const d = response.data; this.accessToken = d.access_token; this.accessTokenExpiration = d.access_token_expiration; this.refreshToken = d.refresh_token; this.refreshTokenExpiration = d.refresh_token_expiration;
    console.log("✅ Splynx Access token renewed"); return d;
  }
  isTokenExpired(buf = 30) { return Date.now() / 1000 + buf > this.accessTokenExpiration; }
  async request(method, endpoint, data = null, params = {}) {
    let headers = {};
    if (data) { if (typeof data.getHeaders === "function") Object.assign(headers, data.getHeaders()); else if (data instanceof URLSearchParams) headers["Content-Type"] = "application/x-www-form-urlencoded"; else headers["Content-Type"] = "application/json"; }
    if (this.useAccessToken && this.accessToken) { if (this.isTokenExpired()) await this.renewAccessToken(); headers.Authorization = `Splynx-EA (access_token=${this.accessToken})`; } else { headers.Authorization = this.getSignatureAuthHeader(); }
    try {
      const config = { method, url: `${this.baseUrl}${endpoint}`, headers, params, timeout: 15000, ...(data && { data: data instanceof URLSearchParams ? data.toString() : data }) };
      return (await axios(config)).data;
    } catch (err) { if (err.response?.status === 401) { await this.renewAccessToken(); return this.request(method, endpoint, data, params); } throw err.response?.data || err; }
  }
  async searchCustomers(p) { return this.request("GET", "admin/customers/customer", null, p); }
  async getCustomerInternetServices(id, p = {}) { return this.request("GET", `admin/customers/customer/${id}/internet-services`, null, p); }
  async getCustomerVoiceServices(id, p = {}) { return this.request("GET", `admin/customers/customer/${id}/voice-services`, null, p); }
  async getCustomerRecurringServices(id, p = {}) { return this.request("GET", `admin/customers/customer/${id}/recurring-services`, null, p); }
  async listInternetTariffs(p = {}) { return this.request("GET", "admin/tariffs/internet", null, p); }
}

const splynx = new SplynxApiClient(CONFIG);
(async () => { try { if (CONFIG.USE_ACCESS_TOKEN) await splynx.generateAccessToken(); } catch (e) { console.error("Initial Splynx token failed."); } })();
app.use(async (req, res, next) => { try { if (CONFIG.USE_ACCESS_TOKEN && !splynx.accessToken) await splynx.generateAccessToken(); next(); } catch (e) { next(); } });

const LOCATIONS = [
  { id: 1, name: "Queensland" }, { id: 2, name: "Victoria" }, { id: 3, name: "New South Wales" }, { id: 4, name: "Tasmania" },
  { id: 5, name: "Western Australia" }, { id: 6, name: "South Australia" }, { id: 7, name: "Northern Territory" }, { id: 8, name: "ACT" },
];

const KB = `
Knowledge base for InfiNET Broadband:
- Greeting / Routing: "Thanks for calling InfiNET Broadband, how may we help you today? Would it be sales, support, accounts, other, or moving/relocating?"
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
  - 25/10 Basic: $59/m ($5 off 3m, then $64)
  - 50/20 Standard: $74/m ($5 off 3m, then $79)
  - 100/20 Fast: $84/m ($5 off 3m, then $89)
  - 500/50 Faster: $84/m ($5 off 3m, then $89) – FTTP/HFC only
  - 750/50 Superfast: $99/m ($10 off 3m, then $109) – FTTP/HFC only
  - 1000/100 Ultrafast: $109/m ($10 off 3m, then $119) – FTTP/HFC only
  OptiComm:
  - 25/10: $64/m ($5 off 3m, then $69)
  - 50/20: $74/m ($5 off 3m, then $79)
  - 100/20: $84/m ($5 off 3m, then $89)
  - 500/50: $79/m ($10 off 3m, then $89)
  - 750/50: $89/m ($10 off 3m, then $99)
  - 1000/100: $99/m ($10 off 3m, then $109)
  Hope Island Resort:
  - 25/10: $44/m ($15 off 3m, then $59)
  - 50/20: $49/m ($15 off 3m, then $64)
  - 250/50: $64/m ($15 off 3m, then $79)
  - 500/50: $64/m ($15 off 3m, then $79)
  - 750/50: $74/m ($15 off 3m, then $89)
  - 1000/100: $84/m ($15 off 3m, then $99)
  Fixed Wireless: 25/10: $59/m | 75/10: $89/m | 200/20: $99/m | 400/40: $109/m
  Sky Muster: 25/5: $59/m | 50/5: $69/m | 100/5: $99/m
- Business Plans:
  NBN Business: 50/20: $89/m | 100/40: $109/m | 250/100: $149/m | 500/200: $189/m | 1000/400: $239/m
  OptiComm Business: 50/20: $79/m ($10 off 3m) | 100/40: $99/m ($10 off 3m) | 250/100: $139/m ($10 off 3m) | 500/200: $169/m ($10 off 3m) | 1000/400: $189/m ($10 off 3m)
  HIR Business: 250/100: $109/m | 500/200: $119/m | 1000/400: $139/m
  Business VoIP: VoIP 30: $30/m (PAYG) | VoIP 50: $50/m (unlimited)
- Hardware: TP-Link VX230v: $179 | VX230v+HX510 Mesh 1-pack: $318, 2-pack: $459 | HX510 1-pack: $159, 2-pack: $299 | VX420 4G failover: $319
- Security: Basic $9.95/m | Bronze $19.95/m | Silver $44.95/m | Gold $65.95/m
`;

const SYSTEM_PROMPT = `
You are a concise, professional voice/chat assistant for ${BRAND}.
Handle five call types: support, sales, general, account, moving-relocating.

STRICT RULES:
- ALWAYS reply in English.
- Greet ONLY at session start: "Hi there! Welcome to InfiNET Broadband. Could you please share your name to get started?"
- Keep replies short. Collect structured fields. Don't re-ask collected fields.
- Address user by preferredName when known.
- Do NOT say "transferring", "connect to agent", "handover to human" etc.
- CRITICAL: Before calling create_ticket say: "Please wait a moment while I process your request."
- After create_ticket success for EXISTING customers (support/accounts/relocation): "Thank you \${preferredName}! I have raised a support ticket for you. You will receive the ticket details via email shortly. Our team will contact you shortly."
- After create_ticket success for NEW customers (sales): "Thank you \${preferredName}! Your inquiry has been submitted successfully. Our sales team will contact you shortly via email."
- IMPORTANT: For sales inquiries (new customers), do NOT mention any ticket number or ticket ID. Just say the inquiry was submitted.
- For support: collect issueSummary with follow-up details.
- Use customer_lookup for existing customers.

CONVERSATION FLOW MOMENTUM:
- Never repeat same question. Accept partial answers. Confirm and move on.
- On [SILENCE_NUDGE]: assume default, confirm, move to NEXT step.
- When UI shows input box: wait silently for typed input.
- Keep responses under 3 sentences unless listing plans.
- Pattern: Ask → Interpret → Confirm → Next step IMMEDIATELY.

INITIAL FLOW:
1. Get name → ask "Are you a new or existing customer?" → extract_call_fields customerType.
2. New → SALES FLOW. Existing → ask support/accounts/moving.

SALES FLOW:
1. "Is this for a residential or business connection?" → save residentialPreference.
2. "First option is NBN. Second option is Opticomm. Which one would you prefer?" → save networkPreference.
3. "Could you please provide the full address?" (input box appears) → save address.
4. Say "Let me check the latest plans for you." Then IMMEDIATELY call the get_internet_plans tool to fetch live pricing from our system.
5. After get_internet_plans returns, present the plans as a numbered list:
   "Here are our current plans:
   1. [Plan Title] — $[Price]/month | [Download] down / [Upload] up
   2. ...
   Which plan would you like? Just say the number."
6. User selects by number → save leadInterest.
7. "Could you please provide your email address?" (input box) → save email.
8. "Please wait a moment..." → create_ticket with sales inquiry details (reporter_type: "api", NO customer_id).
9. After success: "Thank you \${preferredName}! Your inquiry has been submitted. Our sales team will contact you shortly via email."

SUPPORT FLOW:
- Ask email (input box) → customer_lookup → "Found your account, describe the issue" → collect issueSummary → create_ticket.

ACCOUNTS FLOW:
- Ask email → customer_lookup → answer billing Qs from KB → collect issue → create_ticket.
- For phone payments: "Please call 1300 101 414."

RELOCATION FLOW (existing customers, moving/relocating):
1. Ask: "Could you please provide your email address so I can look up your account?" (input box appears)
2. Call customer_lookup with the email.
3. After successful lookup, IMMEDIATELY list the customer's active services from the lookup result:
   "Found your account, \${preferredName}. Here are your current active services:
   1. [Service name/plan] — [speed/details]
   2. ...
   Which service would you like to terminate for the move?"
   If the customer has only ONE active service, still list it and confirm: "I can see you have [service name]. We'll arrange the termination for this one. What date would you like it terminated?"
4. After they pick the service to terminate, ask: "What date would you like to terminate this service?"
5. Ask: "Is the new connection for residential or business?"
6. Ask: "First option is NBN. Second option is Opticomm. Which one would you prefer?"
7. Ask: "Could you please provide the new address?" (input box appears)
8. Call get_internet_plans for latest plans → show matching plans as numbered list → user selects.
9. Ask: "What date would you prefer for the new connection?"
10. "Please wait a moment..." → create_ticket with all relocation details (customer_id, old service, termination date, new address, new plan, connection date).

PLANS DISPLAY RULE:
- Always determine residential/business THEN NBN/OptiComm.
- ALWAYS call get_internet_plans tool to fetch latest live plans from Splynx. Never hardcode or assume prices.
- Show plans as a numbered list. All unlimited data, no contract.
- Mention introductory discounts from the KB where applicable.

TOOL USAGE:
- extract_call_fields for identification info (Name, Email, Address, Phone) or before tickets.
- Plans: ALWAYS call get_internet_plans to fetch the latest live tariffs from Splynx before showing plans. Use the KB only for supplementary info like intro discounts and technology notes.
- customer_lookup for existing customers.
- "First option NBN, Second option Opticomm" — if user says "first/1/one" → NBN, "second/2/two" → Opticomm.

Knowledge base:
${KB}
Locations: ${LOCATIONS.map(l => l.id + ": " + l.name).join(", ")}
`;

const extractFunction = {
  name: "extract_call_fields",
  description: "Extract fields: intent, issueSummary, preferredName, email, priority, callbackRequest, timeline, leadInterest, accountNumber, name, phone, address, terminationDate, connectionDate, serviceToTerminate, customerType, residentialPreference, networkPreference. Omit absent fields.",
  parameters: {
    type: "object",
    properties: {
      intent: { type: "string", enum: ["support", "sales", "general", "account"] },
      issueSummary: { type: "string" }, preferredName: { type: "string" },
      email: { type: "string" }, priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
      callbackRequest: { type: "boolean" }, timeline: { type: "string" },
      leadInterest: { type: "string" }, accountNumber: { type: "string" },
      name: { type: "string" }, phone: { type: "string" }, address: { type: "string" },
      terminationDate: { type: "string" }, connectionDate: { type: "string" },
      serviceToTerminate: { type: "string" },
      customerType: { type: "string", enum: ["new", "existing"] },
      residentialPreference: { type: "string", enum: ["residential", "business"] },
      networkPreference: { type: "string", enum: ["NBN", "Opticomm"] },
    },
    required: [],
  },
};

const getPlansTool = {
  name: "get_internet_plans",
  description: "Fetch the latest live internet tariff plans from Splynx. Use this when the customer asks about available plans, pricing, or speeds. Returns real-time plan data including title, price, download and upload speeds.",
  parameters: { type: "object", properties: {}, required: [] },
};

const customerLookupTool = { name: "customer_lookup", description: "Lookup customer by name, email, or phone.", parameters: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" } }, required: [] } };

const createTicketTool = {
  name: "create_ticket", description: "Create ticket in Splynx.",
  parameters: {
    type: "object", properties: {
      customer_id: { type: "number" }, reporter_type: { type: "string", enum: ["admin", "customer", "api", "incoming", "none"] },
      subject: { type: "string" }, priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
      type_id: { type: "number" }, group_id: { type: "number" }, status_id: { type: "number" },
      message: { type: "object", properties: { message: { type: "string" }, hide_for_customer: { type: "boolean" } } },
    }, required: ["subject", "priority"]
  },
};

const getTicketTypesTool = { name: "get_ticket_types", description: "Fetch ticket types.", parameters: { type: "object", properties: {}, required: [] } };
const getTicketGroupsTool = { name: "get_ticket_groups", description: "Fetch ticket groups.", parameters: { type: "object", properties: {}, required: [] } };
const getTicketStatusesTool = { name: "get_ticket_statuses", description: "Fetch ticket statuses.", parameters: { type: "object", properties: {}, required: [] } };

const tools = [extractFunction, getPlansTool, customerLookupTool, createTicketTool, getTicketTypesTool, getTicketGroupsTool, getTicketStatusesTool];

// ==================== HELPERS ====================
function mkSession(sessionId) {
  const id = sessionId || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session = { id, collected: {}, messages: [{ role: "system", content: SYSTEM_PROMPT }], lastSeen: new Date().toISOString(), hasGreeted: false };
  sessions.set(id, session); return session;
}
function normalizeText(t) { return (t || "").toString().replace(/\u200B/g, "").replace(/\s+/g, " ").trim(); }
function mapOrdinalNetworkChoice(text) {
  const t = (text || "").toLowerCase();
  if (/\bnbn\b/.test(t) || /\b(opti\s*comm|opticomm)\b/.test(t)) return null;
  if (/\b(first|1st|option\s*1|option\s*one|number\s*1)\b/.test(t)) return "NBN";
  if (/\b(second|2nd|option\s*2|option\s*two|number\s*2)\b/.test(t)) return "Opticomm";
  return null;
}
function safeParseJSON(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function numbersToInt(obj) { const out = {}; for (const k of Object.keys(obj || {})) { const v = obj[k]; out[k] = typeof v === "number" ? Math.round(v) : v; } return out; }
async function convertToWav(p) { const out = p + ".converted.wav"; return new Promise((res, rej) => { ffmpeg(p).outputOptions(["-ar 16000", "-ac 1", "-vn"]).toFormat("wav").on("end", () => res(out)).on("error", rej).save(out); }); }
function applyExtractionToSession(session, parsed) { const r = numbersToInt(parsed || {}); for (const [k, v] of Object.entries(r)) { if (v !== undefined && v !== null) session.collected[k] = v; } session.lastSeen = new Date().toISOString(); sessions.set(session.id, session); return r; }

async function fetchTariffs() {
  try {
    const data = await splynx.listInternetTariffs();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Failed to fetch internet tariffs from Splynx:", err.message);
    return [];
  }
}

async function customerLookup({ name, email, phone }) {
  const main_attributes = {}; if (name) main_attributes.name = name; if (email) main_attributes.login = email; if (phone) main_attributes.phone = phone;
  const customers = await splynx.searchCustomers({ main_attributes });
  if (!customers || customers.length === 0) return { success: false, message: "No customer found" };
  if (customers.length > 1) return { success: true, multiple: true, customers };
  const customer = customers[0]; let services = { internet: [], voice: [], recurring: [] };
  try {
    services.internet = (await splynx.getCustomerInternetServices(customer.id)).filter(s => s.status === 'active');
    services.voice = (await splynx.getCustomerVoiceServices(customer.id)).filter(s => s.status === 'active');
    services.recurring = (await splynx.getCustomerRecurringServices(customer.id)).filter(s => s.status === 'active');
  } catch (e) { console.error("Failed to get services:", e); }
  return { success: true, customer, services };
}

function objectToUrlEncoded(obj, params = new URLSearchParams(), ns = "") {
  for (const p in obj) {
    if (!obj.hasOwnProperty(p)) continue; const fk = ns ? `${ns}[${p}]` : p; const v = obj[p]; if (v === undefined || v === null) continue;
    if (typeof v === "object" && !Array.isArray(v)) { objectToUrlEncoded(v, params, fk); } else if (Array.isArray(v)) { v.forEach(i => params.append(`${fk}[]`, i)); } else { params.append(fk, typeof v === "boolean" ? (v ? "1" : "0") : String(v)); }
  } return params;
}

async function makeTTS(text) {
  if (!text?.trim()) return null;
  try {
    const r = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, { text: text.trim(), model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.0, use_speaker_boost: true } },
      { headers: { Accept: "audio/mpeg", "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" }, responseType: "arraybuffer" });
    return Buffer.from(r.data);
  } catch (e) { console.warn("TTS failed:", e?.message); return null; }
}

// ==================== TOOL HANDLER ====================
async function handleToolCall(session, funcName, args) {
  if (funcName === "extract_call_fields") { applyExtractionToSession(session, args); return JSON.stringify({ success: true }); }
  if (funcName === "customer_lookup") { try { return JSON.stringify(await customerLookup(args)); } catch (e) { return JSON.stringify({ success: false, error: e.message }); } }
  if (funcName === "get_internet_plans") {
    try {
      const tariffs = await fetchTariffs();
      return JSON.stringify({
        success: true,
        plans: tariffs.map((t) => ({
          id: t.id, title: t.title, price: parseFloat(t.price),
          download: `${t.speed_download / 1000} Mbps`,
          upload: `${t.speed_upload / 1000} Mbps`,
          available_for_locations: t.available_for_locations || [],
        })),
      });
    } catch (err) {
      return JSON.stringify({ success: false, error: err.message });
    }
  }
  if (funcName === "create_ticket") {
    let fa = { ...args }; if (typeof fa.message === "string") fa.message = { message: fa.message };

    const collected = session.collected || {};
    // Simple rule: if customer_id exists → Support. No customer_id → Sales.
    const hasCustomerId = !!(fa.customer_id || collected.customer_id);
    const isSupportTicket = hasCustomerId;

    try {
      if (isSupportTicket) {
        // SUPPORT/ACCOUNTS/RELOCATION: Create Splynx ticket + send Support email
        console.log(`📝 Creating SUPPORT ticket in Splynx: subject="${fa.subject}" customer_id=${fa.customer_id}`);
        const r = await splynx.request("POST", "admin/support/tickets", objectToUrlEncoded(fa));
        console.log(`✅ Splynx ticket created: ID=${r.id}`);
        const emailResult = await sendTicketEmail(r.id, fa, collected, true);
        return JSON.stringify({ success: true, ticket_id: r.id, email_sent: emailResult.sent, email_error: emailResult.reason || null });
      } else {
        // SALES: Email only, NO Splynx ticket
        console.log(`📧 SALES inquiry — sending email only (no Splynx ticket): subject="${fa.subject}"`);
        const emailResult = await sendTicketEmail(null, fa, collected, false);
        return JSON.stringify({ success: true, message: "Sales inquiry submitted successfully", email_sent: emailResult.sent, email_error: emailResult.reason || null });
      }
    } catch (err) {
      console.error("❌ Create ticket/email failed:", err.message || err);
      return JSON.stringify({ success: false, error: err.message || "Failed to process request" });
    }
  }
  if (funcName === "get_ticket_types") return JSON.stringify({ success: true, types: await splynx.request("GET", "admin/support/tickets-types") });
  if (funcName === "get_ticket_groups") return JSON.stringify({ success: true, groups: await splynx.request("GET", "admin/support/tickets-groups") });
  if (funcName === "get_ticket_statuses") return JSON.stringify({ success: true, statuses: await splynx.request("GET", "admin/support/tickets-statuses") });
  return JSON.stringify({ error: `Unknown tool: ${funcName}` });
}

async function processWithTools(session) {
  const comp = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: session.messages, functions: tools, function_call: "auto", temperature: 0.0, max_tokens: 300 });
  const msg = comp.choices?.[0]?.message;
  if (msg?.function_call) {
    const fn = msg.function_call.name; const args = safeParseJSON(msg.function_call.arguments) || {};
    session.messages.push(msg);
    let toolContent;
    try { toolContent = await handleToolCall(session, fn, args); } catch (e) { toolContent = JSON.stringify({ success: false, error: e.message }); }
    session.messages.push({ role: "function", name: fn, content: toolContent });
    const finalMessages = [{ role: "system", content: "You are a concise assistant for ISP CRM. Use collected fields and KB. Ask for remaining info concisely." }, ...session.messages, { role: "system", content: `CollectedFields: ${JSON.stringify(session.collected || {})}.` }];
    const finalResp = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: finalMessages, temperature: 0.0, max_tokens: 350 });
    const text = finalResp.choices?.[0]?.message?.content?.trim() || "Thanks — I have your details.";
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
    const greeting = "Hi there! Welcome to InfiNET Broadband. Could you please share your name to get started?";
    session.messages.push({ role: "assistant", content: greeting }); sessions.set(session.id, session);
    const ttsBuf = await makeTTS(greeting);
    return res.json({ sessionId: session.id, text: greeting, audioBase64: ttsBuf ? ttsBuf.toString("base64") : null });
  } catch (e) { return res.status(500).json({ error: e?.message }); }
});

app.post("/api/voice", upload.single("audio"), async (req, res) => {
  const sid = req.body?.sessionId || req.query.sessionId || req.headers["x-session-id"] || null;
  if (!req.file) return res.status(400).json({ error: "Missing audio" });
  const up = path.resolve(req.file.path); let cp = null;
  try {
    const session = sid && sessions.has(sid) ? sessions.get(sid) : mkSession(sid);
    const orig = (req.file.originalname || "").toLowerCase(); const mime = (req.file.mimetype || "").toLowerCase();
    const isWav = orig.endsWith(".wav") || mime === "audio/wav" || mime === "audio/wave";
    cp = isWav ? up : await convertToWav(up);
    const tr = await openai.audio.transcriptions.create({ file: fs.createReadStream(cp), model: "whisper-1" });
    let userText = normalizeText(tr?.text || "");
    const mapped = mapOrdinalNetworkChoice(userText); if (mapped) userText = mapped;
    if (!userText) { const p = "Sorry, I didn't catch that — could you please repeat?"; return res.json({ sessionId: session.id, text: p, audioBase64: (await makeTTS(p))?.toString("base64") || null, userText: null }); }
    session.messages.push({ role: "user", content: userText });
    const assistantText = await processWithTools(session);
    const ttsBuf = await makeTTS(assistantText);
    session.lastSeen = new Date().toISOString(); sessions.set(session.id, session);
    return res.json({ sessionId: session.id, text: assistantText, audioBase64: ttsBuf ? ttsBuf.toString("base64") : null, userText });
  } catch (e) { console.error("voice error:", e); return res.status(500).json({ error: e?.message }); }
  finally { try { if (up && fs.existsSync(up)) fs.unlinkSync(up); } catch (_) { } try { if (cp && cp !== up && fs.existsSync(cp)) fs.unlinkSync(cp); } catch (_) { } }
});

app.post("/api/voice/structured-input", async (req, res) => {
  try {
    const { sessionId, field, value } = req.body || {};
    if (!sessionId || !field || !value) return res.status(400).json({ error: "Missing params" });
    if (!["email", "phone", "address"].includes(field)) return res.status(400).json({ error: "Invalid field" });
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    session.collected[field] = value;
    const userMsg = field === "email" ? `My email is ${value}` : field === "phone" ? `My phone number is ${value}` : `My address is ${value}`;
    session.messages.push({ role: "user", content: userMsg });
    const assistantText = await processWithTools(session);
    const ttsBuf = await makeTTS(assistantText);
    session.lastSeen = new Date().toISOString(); sessions.set(session.id, session);
    return res.json({ sessionId: session.id, text: assistantText, audioBase64: ttsBuf ? ttsBuf.toString("base64") : null, userText: userMsg, collected: session.collected });
  } catch (e) { console.error("structured-input error:", e); return res.status(500).json({ error: e?.message }); }
});

app.get("/", (req, res) => { res.send(`<h1 style="text-align:center;margin-top:100px;font-family:sans-serif;color:#00bfff">✅ InfiNET AI Backend is running!</h1>`); });

// ==================== SERVER ====================
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: "*" }, maxHttpBufferSize: 1e7 });

setupRealtimeVoice(io, {
  OPENAI_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID,
  SYSTEM_PROMPT, LOCATIONS, tools,
  mkSession, sessions, normalizeText, safeParseJSON,
  applyExtractionToSession, fetchTariffs, customerLookup, objectToUrlEncoded,
  splynx, sendTicketEmail,
});

httpServer.listen(PORT, () => {
  console.log(`🚀 InfiNET Broadband AI Server running on port ${PORT}`);
  console.log(`🎤 Realtime API + ElevenLabs • Ultra-low latency mode`);
  console.log(`🔌 Socket.IO ready for voice clients`);
});