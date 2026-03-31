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
import FormData from "form-data";
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

if (!process.env.SMTP_PASS) {
  console.warn("⚠️ SMTP_PASS not set in .env — email notifications will be DISABLED");
}

async function sendTicketEmail(ticketId, ticketArgs, collectedFields, isSupportTicket = false) {
  if (!process.env.SMTP_PASS) return;

  const recipient = isSupportTicket
    ? "support@infinetbroadband.com.au"
    : "sales@infinetbroadband.com.au";

  const type = isSupportTicket ? "Support" : "Sales";

  const referenceLine = ticketId
    ? `<p><strong>Ticket / Reference:</strong> ${ticketId}</p>`
    : `<p><strong>Reference:</strong> New ${type.toLowerCase()} enquiry (no ticket ID yet)</p>`;

  const subject = `New ${type} Enquiry ${ticketId ? `— Ticket #${ticketId}` : ""} — ${ticketArgs.subject || "Inquiry"}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>New ${type} Enquiry Received</h2>
  ${referenceLine}
  <p><strong>Subject:</strong> ${ticketArgs.subject || "N/A"}</p>
  <p><strong>Priority:</strong> ${ticketArgs.priority || "medium"}</p>
  ${ticketArgs.customer_id
      ? `<p><strong>Customer ID:</strong> ${ticketArgs.customer_id}</p>`
      : `<p><strong>New Lead (no customer ID)</strong></p>`}
  <h3>Message Body</h3>
  <p>${(ticketArgs.message && (ticketArgs.message.message || ticketArgs.message)) || "No additional message provided"}</p>
  <hr>
  <p><small>This is an automated email from the InfiNET Broadband AI Assistant.<br>
  ${isSupportTicket && ticketId
      ? `View ticket: https://infinetbroadband-portal.com.au/admin/support/tickets/${ticketId}`
      : `This is a ${type.toLowerCase()} enquiry — to be followed up manually.`}
  </small></p>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: '"InfiNET AI Assistant" <noreply@infinetbroadband.com.au>',
      to: ["karimjawwad09@gmail.com", recipient],
      subject,
      html,
    });
    console.log(`📧 Email notification sent for ${type.toLowerCase()} enquiry${ticketId ? ` #${ticketId}` : ""}`);
  } catch (err) {
    console.error("Failed to send ticket email:", err.message);
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

console.log("🔧 Splynx base URL:", CONFIG.SPLYNX_BASE_URL);

try {
  dns.setDefaultResultOrder("ipv4first");
} catch (_) { }

(async () => {
  try {
    const host = new URL(CONFIG.SPLYNX_BASE_URL).hostname;
    const res = await dns.promises.lookup(host, { all: true });
    console.log("🔎 Splynx DNS lookup:", host, res);
  } catch (e) {
    console.error("🔎 Splynx DNS lookup failed:", e?.message || e, { code: e?.code, hostname: e?.hostname });
  }
})();

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
    const data = nonce + this.apiKey;
    const hmac = crypto.createHmac("sha256", this.apiSecret);
    hmac.update(data);
    return hmac.digest("hex").toUpperCase();
  }

  getSignatureAuthHeader() {
    const nonce = Math.round((Date.now() / 1000) * 100);
    const signature = this.generateSignature(nonce);
    const params = { key: this.apiKey, nonce, signature };
    return `Splynx-EA (${new URLSearchParams(params).toString()})`;
  }

  async generateAccessToken() {
    try {
      const nonce = Math.floor(Date.now() / 1000);
      const response = await axios.post(`${this.baseUrl}admin/auth/tokens`, {
        auth_type: "api_key",
        key: this.apiKey,
        nonce,
        signature: this.generateSignature(nonce),
      }, { headers: { "Content-Type": "application/json" } });
      const data = response.data;
      this.accessToken = data.access_token;
      this.accessTokenExpiration = data.access_token_expiration;
      this.refreshToken = data.refresh_token;
      this.refreshTokenExpiration = data.refresh_token_expiration;
      console.log("✅ Splynx Access token generated");
      return data;
    } catch (err) {
      const extra = {
        code: err?.code,
        hostname: err?.hostname,
        syscall: err?.syscall,
        address: err?.address,
        port: err?.port,
      };
      console.error("Token generation failed:", err.response?.data || err.message, extra);
      throw err;
    }
  }

  async renewAccessToken() {
    if (!this.refreshToken) throw new Error("No refresh token available");
    try {
      const response = await axios.get(`${this.baseUrl}admin/auth/tokens/${this.refreshToken}`, {
        headers: { Authorization: `Splynx-EA (access_token=${this.accessToken})` },
      });
      const data = response.data;
      this.accessToken = data.access_token;
      this.accessTokenExpiration = data.access_token_expiration;
      this.refreshToken = data.refresh_token;
      this.refreshTokenExpiration = data.refresh_token_expiration;
      console.log("✅ Splynx Access token renewed");
      return data;
    } catch (err) {
      console.error("Token renew failed:", err.response?.data || err.message);
      throw err;
    }
  }

  isTokenExpired(bufferSeconds = 30) {
    return Date.now() / 1000 + bufferSeconds > this.accessTokenExpiration;
  }

  async request(method, endpoint, data = null, params = {}) {
    let headers = {};
    if (data) {
      if (typeof data.getHeaders === "function") {
        Object.assign(headers, data.getHeaders());
      } else if (data instanceof URLSearchParams) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
      } else {
        headers["Content-Type"] = "application/json";
      }
    }
    if (this.useAccessToken && this.accessToken) {
      if (this.isTokenExpired()) await this.renewAccessToken();
      headers.Authorization = `Splynx-EA (access_token=${this.accessToken})`;
    } else {
      headers.Authorization = this.getSignatureAuthHeader();
    }
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const config = {
        method,
        url,
        headers,
        params,
        timeout: 15000,
        ...(data && { data: data instanceof URLSearchParams ? data.toString() : data }),
      };
      const response = await axios(config);
      return response.data;
    } catch (err) {
      if (err.response?.status === 401) {
        await this.renewAccessToken();
        return this.request(method, endpoint, data, params);
      }
      throw err.response?.data || err;
    }
  }

  async listInternetTariffs(params = {}) {
    return this.request("GET", "admin/tariffs/internet", null, params);
  }

  async searchCustomers(searchParams) {
    return this.request("GET", "admin/customers/customer", null, searchParams);
  }

  async getCustomerInternetServices(customerId, params = {}) {
    return this.request("GET", `admin/customers/customer/${customerId}/internet-services`, null, params);
  }

  async getCustomerVoiceServices(customerId, params = {}) {
    return this.request("GET", `admin/customers/customer/${customerId}/voice-services`, null, params);
  }

  async getCustomerRecurringServices(customerId, params = {}) {
    return this.request("GET", `admin/customers/customer/${customerId}/recurring-services`, null, params);
  }
}

const splynx = new SplynxApiClient(CONFIG);

(async () => {
  try {
    if (CONFIG.USE_ACCESS_TOKEN) await splynx.generateAccessToken();
  } catch (err) {
    console.error("Initial Splynx token generation failed.");
  }
})();

app.use(async (req, res, next) => {
  try {
    if (CONFIG.USE_ACCESS_TOKEN && !splynx.accessToken) await splynx.generateAccessToken();
    next();
  } catch (err) {
    console.error("Splynx middleware error:", err.message);
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
Knowledge base for InfiNET Broadband (use this to answer customer calls and chats concisely):
- Greeting / Routing:
  "Thanks for calling InfiNET Broadband, how may we help you today ? Would it be sales, support, accounts, other, or moving/relocating?"
  If caller says sales/support/accounts/other/moving-relocating, proceed accordingly and collect structured fields.
- Payment & Portal:
  "Did you know you can update your payment method via the customer portal?"
  If the customer does not have portal access, tell them: "If you don’t have access to the customer portal, please email support@infinetbroadband.com.au and our team will issue you the login credentials."
- Support contact:
  "If you are having issues with your Internet service please email support@infinetbroadband.com.au and our support team will be able to assist you."
- Plan change / Upgrade:
  "Did you want to upgrade or change the internet plan you are on? Please just email support@infinetbroadband.com.au and our support team will be able to assist you."
- Outstanding / Overdue invoice:
  "Do you have an outstanding or overdue invoice? If so, just login to the customer portal to manually pay this. You can also log a support ticket via support@infinetbroadband.com.au and our accounts team will be able to assist you."
- Payment details changed / lost card / new bank:
  "Have your payment details changed, lost a card, or changed bank details? Just login to the customer portal to update this manually, or you can also log a support ticket via support@infinetbroadband.com.au and our accounts team will be able to assist you."
- Cannot login to portal:
  "Not able to login to the customer portal? Just email support@infinetbroadband.com.au and our accounts team will be able to assist."
- NBN vs OptiComm:
  "Both NBN and OptiComm deliver fibre internet in Australia. The main difference is availability: NBN is the national wholesale network while OptiComm is a private fibre network available in selected estates and buildings. Both offer similar speeds. InfiNET Broadband can connect you to either depending on what's available at your address."
- Private Fibre Networks for Developers:
  "If you're interested in developments or private fibre networks for new estates or buildings, please visit https://www.infinetbroadband.com.au/private-fibre-networks-for-developers/. How else can I assist you today?"
- Opticomm Free to Air TV issue:
  "Infinet Broadband does not support your free to air television service. Please contact Opticomm directly — you can visit https://online.telco.opticomm.com.au/television-fault Thank you, goodbye."
- Common Qs to answer concisely:
  * Can I use my own or existing modem (BYO Modem) on the NBN & Opticomm Internet services?
    - Answer: Yes, you can bring your own compatible modem. If you’re unsure, our support team can help check compatibility. We also offer modems for purchase if you prefer a hassle-free setup.
  * Do you offer unlimited data on NBN & OptiComm Internet?
    - Answer: Yes, all of our NBN and OptiComm internet plans come with unlimited data. Stream, work, and play without worrying about data limits or excess charges.
  * How fast is NBN compared to OptiComm?
    - Answer: Speeds depend on your chosen plan. Both NBN and OptiComm can deliver speeds from 25 Mbps up to 1,000 Mbps in some areas. OptiComm may offer higher speeds in certain fibre-enabled estates, while NBN is more widely available across Australia.
  * How long does setup take to setup NBN or Opticomm?
    - Answer: In most cases, either NBN or OptiComm services can be activated within 30mins to 3 hours if your premises has already been connected. If your premise has never been connected before (new home or building) a tech visit is required, it may take a little longer as some new homes required an NTD (Network Termination Device) to be installed and this requires an onsite tech visit to be booked in by one of our team members. Our team will guide you through every step.
  * How do I check if my home has OptiComm?
    - Answer: They can check OptiComm coverage on the OptiComm website or ask InfiNET and we'll confirm quickly.
- Tone:
  * Always concise and professional.
  * Ask for remaining missing info in a single concise message.
- Contact info to use:
  * support@infinetbroadband.com.au
Additional Knowledge Base – Concise Version
Payment Setup & Manual Payment
Customer portal: https://infinetbroadband-portal.com.au/
To set up recurring payment (Direct Debit or Credit/Debit Card):
1. Log in → Finance → Select payment method
2. Credit/Debit Card: Add card details → Save and allow future charges
3. Direct Debit: Add bank details → Save and allow future charges
→ Future invoices auto-debit on due date.
To manually pay an outstanding/overdue invoice (when auto-payment fails):
1. Log in → Dashboard or Finance/Documents
2. Select invoice/document (use dropdown to filter types)
3. Click ✓ → Choose Credit Card or Direct Debit → Pay
→ Marks invoice PAID once cleared.
NBN FTTP Upgrade (from March 2022 onward)
• Upgrades eligible FTTN / FTTC premises to FTTP (direct fibre to premises)
• $0 standard installation if signing to eligible high-speed plan (min 100/20 Mbps)
• Non-standard installs may incur costs (NBN advises & seeks approval first)
• Contact InfiNET to check eligibility → we handle the request
Key NBN Technologies – Summary
• FTTP (Fibre to the Premises): Fibre direct to home. Requires NTD inside + utility box outside. Best speeds/reliability.
• FTTN (Fibre to the Node): Fibre to street node → copper to home. Uses DSL port on modem.
• FTTC (Fibre to the Curb): Fibre to pit/DPU → short copper to home. Uses NCD + ethernet to router WAN.
• FTTB (Fibre to the Building): Fibre to building comms room → copper to unit/apartment. DSL modem.
• HFC (Hybrid Fibre Coaxial): Uses existing cable TV coax. Coax to NTD → ethernet to router WAN.
• Fixed Wireless: Radio from tower (up to ~14 km) → outdoor antenna → NTD inside.
• Satellite (Sky Muster): Satellite dish → indoor modem/NTD.
Modem/Router Connection – General Rules
• FTTP / FTTC / HFC / Fixed Wireless / Satellite / OptiComm: Connect router WAN port to NBN NTD/NCD UNI-D port (ethernet cable). NBN-ready router required.
• FTTN / FTTB: Connect DSL port to phone wall socket (VDSL/ADSL modem required).
Service Classes – Quick Overview (NBN)
Higher class = more infrastructure already in place → faster activation
FTTP / FTTB / FTTC / HFC
• 0 = Future serviceable, not ready yet (pre-order possible)
• 1 = Serviceable, no equipment yet → book install
• 2 = External installed, internal pending → book install
• 3 = Fully installed → activate 1–5 days
FTTN similar but uses Class 10–13 (copper-based readiness)
Fixed Wireless: Class 4–6
Satellite: Class 7–9
OptiComm FTTP Classes
• 0 = Future, not ready
• 1 = Serviceable, no equipment → contact OptiComm directly first
• 2 = External done, internal pending → order + pay new connection fee ($330–$550 inc GST first time only)
• 3 = Fully installed → activate 1–2 days
• 5 = Fully installed + New Development Fee $300 inc GST (first time)
TP-Link VX230v Router (InfiNET supplied – pre-configured plug & play)
If factory reset → must reconfigure:
LEDs (left to right): Power, DSL, Internet, 2.4G, 5G, WAN, LAN1–3, WPS, USB, Phone
Access admin portal: http://tplinkmodem.net or http://192.168.1.1
(Initial password: contact InfiNET if reset)
Quick Setup after reset:
• Region & Time Zone
• ISP = Other
• Connection: EWAN (FTTP/FTTC/HFC/OptiComm) or VDSL (FTTN/FTTB)
• Use settings supplied by InfiNET at activation
• Wireless: leave default or customise later
• Run connection test
Change settings later: Internet tab (EWAN/DSL) or Wireless tab (SSID/password).
Mesh Wi-Fi (HX220/510 extenders):
• Wireless: Add via Network Map → place near VX230 (flashing blue) → auto-pair
• Ethernet backhaul: Connect HX WAN → VX230 LAN → auto-detects
VoIP (if subscribed):
Telephony → Telephone Number → Add/Modify → enter InfiNET-provided VoIP credentials
General Advice
• Check address/technology: Use InfiNET “Check your Address” tool or ask support
• Unsure about modem compatibility, settings, VoIP, etc. → email support@infinetbroadband.com.au
--- Consolidated FAQs, Hardware, Security & Plans (Residential & Business) ---
- Common Residential FAQs (answer concisely):
  * What NBN speed for streaming? For HD, NBN 25 usually enough; 4K or multiple devices recommend NBN 50+.
  * Keep landline with NBN? Yes, via VoIP (port existing number on most plans).
  * BYO modem on NBN/OptiComm? Yes if compatible; support can check; we offer hassle-free options.
  * NBN installation time? 2–10 business days typical; pre-connected: 30 mins–3 hrs; new may need tech/NTD.
  * Moving / relocating to a new property?
    - Answer: Absolutely. We'll list your current active services if multiple, ask which to terminate, your termination date, new address, and preferred connection date. Then check availability and create a sales inquiry ticket.
  * Unlimited data? Yes on all plans.
  * OptiComm check? OptiComm site or ask us.
  * OptiComm vs NBN speed? Similar tiers; OptiComm (FTTP) often more consistent.
- Hope Island Resort (HIR) FAQs:
  * HIR Internet: Private high-speed (fibre + HFC) in Hope Island Resort, up to 1000 Mbps, fail-over, no connection fees/contracts.
  * Tech: FTTP/HFC (varies); ultra-fast available.
  * BYO modem: Yes, most compatible.
  * Speeds: Up to 1000 Mbps.
- NBN Fixed Wireless FAQs:
  * What it is: Tower radio to antenna + box; free standard install.
  * Good for remote? Yes, improved reliability.
  * Speeds: Vary by location/congestion/equipment.
- NBN Sky Muster FAQs:
  * What it is: Satellite for remote; dish + modem; free install.
  * Speeds: Up to 100/5 wholesale (varies; latency typical).
  * Good option: Yes for no fixed line.
  * Switch: Address eligibility dependent.
- Residential VoIP FAQs:
  * VoIP: Internet calls; cheaper, no rental.
  * Keep number: Yes, port most free.
  * Works with: NBN/OptiComm.
- Residential Hardware:
  * TP-Link VX230v AX1800: $179 (WiFi 6, VoIP, pre-configured).
  * VX230v + HX510 Mesh: 1-pack $318, 2-pack $459.
  * HX510 Mesh AP: 1-pack $159, 2-pack $299.
  * VX420 4G failover: $319 (not FTTB/FTTN).
- Residential Security:
  * Basic: $9.95/m (Anti-Virus, patching, remote).
  * Bronze: $19.95/m (+ Web Protection, 1 session/m).
  * Silver: $44.95/m (+ 3 sessions/m).
  * Gold: $65.95/m (+ Unlimited support, DNS, reporting).
- Residential Plans (intro discounts new customers; confirm address):
  NBN (unlimited, no contract, month-to-month):
  - 25/10 Basic: $59/m ($5 off 3m, then $64) – FTTC/FTTN/FTTB/FTTP/HFC
  - 50/20 Standard: $74/m ($5 off 3m, then $79)
  - 100/20 Fast: $84/m ($5 off 3m, then $89)
  - 500/50 Faster: $84/m ($5 off 3m, then $89) – FTTP/HFC
  - 750/50 Superfast: $99/m ($10 off 3m, then $109) – FTTP/HFC
  - 1000/100 Ultrafast: $109/m ($10 off 3m, then $119) – FTTP/HFC
  OptiComm (FTTP, reliable fibre):
  - 25/10: $64/m ($5 off 3m, then $69)
  - 50/20: $74/m ($5 off 3m, then $79)
  - 100/20: $84/m ($5 off 3m, then $89) – limited capacity
  - 500/50: $79/m ($10 off 3m, then $89)
  - 750/50: $89/m ($10 off 3m, then $99)
  - 1000/100: $99/m ($10 off 3m, then $109)
  Hope Island Resort:
  - 25/10: $44/m ($15 off 3m, then $59)
  - 50/20: $49/m ($15 off 3m, then $64)
  - 250/50: $64/m ($15 off 3m, then $79)
  - 500/50: $64/m ($15 off 3m, then $79) – free upgrade if needed
  - 750/50: $74/m ($15 off 3m, then $89)
  - 1000/100: $84/m ($15 off 3m, then $99)
  Fixed Wireless:
  - 25/10: $59/m
  - 75/10: $89/m
  - 200/20: $99/m
  - 400/40: $109/m (eligible areas)
  Sky Muster:
  - 25/5: $59/m
  - 50/5: $69/m
  - 100/5: $99/m
- Business Plans & FAQs:
  * NBN Business: Static IP, priority support, higher uploads.
  - 50/20: $89/m
  - 100/40: $109/m
  - 250/100: $149/m (FTTP/HFC)
  - 500/200: $189/m (FTTP/HFC)
  - 1000/400: $239/m (FTTP/HFC)
  * OptiComm Business: Static IP; fee waiver possible (24m $0/12m $45/else $99; new dev $330 not waived).
  - 50/20: $79/m ($10 off 3m, then $89)
  - 100/40: $99/m ($10 off 3m, then $109)
  - 250/100: $139/m ($10 off 3m, then $149)
  - 500/200: $169/m ($10 off 3m, then $179)
  - 1000/400: $189/m ($10 off 3m, then $199)
  * HIR Business:
  - 250/100: $109/m
  - 500/200: $119/m
  - 1000/400: $139/m
  * Business VoIP/Cloud PBX: Extensions, CRM integration, etc.
  - VoIP 30: $30/m (PAYG)
  - VoIP 50: $50/m (unlimited local/national/mobile)
  - Extra extensions: $10/m (1-10), $8/m (>10)
- General Advice (expanded):
  * Address/technology check: InfiNET tool or email support@infinetbroadband.com.au.
  * Head Office: Level 15, Corporate Centre One, 2 Corporate Court, Bundall, QLD 4217.
  * Phone: 1300 101 414.
- Relocation and Moving House:
  * Relocating service: For existing customers, confirm which active service to terminate (list if multiple), provide termination date for old service and desired connection date + new address for new service.
  * Process: We check availability at new address, select plan, and raise sales inquiry ticket. Team will coordinate dates to minimize downtime.
  * Multiple services/properties: We fetch and list all active internet/voice/recurring services for confirmation.
  * Common Q: "Can I keep the same plan when moving?"
    - Answer: Yes, if available at new address; otherwise, we'll show suitable alternatives.
Always advise customers to check current pricing and availability via the address checker or support@infinetbroadband.com.au as promotions may change.
`;

const SYSTEM_PROMPT = `
You are a concise, professional voice/chat assistant for ${BRAND}.
Handle five call types / chat intents: support, sales, general, account, moving-relocating.

STRICT RULES:
- ALWAYS reply in English.
- START the conversation immediately with: "Hi there! Welcome to InfiNET Broadband. Could you please share your name to get started?"
- Keep replies short and focused; ask for remaining missing info concisely.
- Collect structured fields when appropriate and do not re-ask for already collected fields.
- If the user has a preferredName in collected fields, ALWAYS address them warmly by that name in every response.
- Do NOT say anything like "we will connect you to a sales agent", "transferring you to support", "handover to human", "I'll put you through" or similar phrases.
- When enough information is collected per the flow below, call the create_ticket tool with appropriate parameters (generate subject based on the conversation, use issueSummary or leadInterest in the message body).
- IMPORTANT: Once a tool (like address lookup, customer lookup, or plans) returns a result, you MUST proceed with your summary or next question IMMEDIATELY without waiting for further user input.
- After create_ticket succeeds, reply with the exact message including the ticket ID: "Thank you \${preferredName}! I have raised a ticket for you. You will receive the ticket details via email shortly. Our team will contact you shortly."
- Use the Knowledge base below to answer questions concisely.
- For support issues, if issueSummary is not collected, ask: "Please provide a brief description of the issue." Once a basic description is provided, immediately ask for additional high-level details to help our support team (e.g. "Any more details like when it started, issues, or error messages?"). Combine everything into the final issueSummary.
- Use get_ticket_types, get_ticket_groups, get_ticket_statuses if you need IDs for types, groups, statuses when creating tickets.
- To verify existing customers or lookup account, use the customer_lookup tool with name, email, or phone. If multiple matches, ask for more details. If no match, politely say you can't find the account and switch to sales flow if appropriate. NEVER create tickets for non-customers.
- For existing customer flows (support/accounts/relocation), ask for name, email, or phone to lookup the account. Use the looked up customer_id for tickets.
- PRIVATE NETWORK / DEVELOPMENT HANDLING: At any point in the conversation, if the customer mentions "private network", "development", "developer", "estate", "private fibre", "bulk fibre", "developers network", or similar terms, immediately respond with the exact message: "If you're interested in developments or private fibre networks for new estates or buildings, please visit https://www.infinetbroadband.com.au/private-fibre-networks-for-developers/. How else can I assist you today?" and continue the current flow.

**STRICT PLANS DISPLAY RULE (applies to ALL flows and situations):** 
Before showing or listing ANY plans (from get_internet_plans, check_address_availability, KB, or any other source), you MUST ALWAYS ask the two preferences **one question at a time** in separate responses:

1. First ask exactly: "Are you interested in residential or business plans?"
   - Wait for their reply and use extract_call_fields to capture residentialPreference ("residential" or "business").

2. ONLY after they have answered the first question, ask exactly in the next response: "Would you like NBN or OptiComm plans?"
   - Wait for their reply and use extract_call_fields to capture networkPreference ("NBN" or "OptiComm").

ONLY AFTER BOTH preferences are collected may you call any plan-related tool and display plans. When displaying plans, show ONLY the plans that exactly match BOTH collected preferences. Never show NBN and OptiComm plans together in the same list. This rule overrides everything else.

NEW SERVICE HANDLING (CRITICAL – ONLY ACTIVE SERVICES):
- customer_lookup returns services: { internet: [], voice: [], recurring: [] } filtered to status === 'active' ONLY.
- When account lookup succeeds: DO NOT show or mention any services/plans automatically.
- Services are shown ONLY when user specifically asks about "current plan", "my plan", "what plan am I on?", "services", "packages", "plan details", OR wants to CHANGE/UPGRADE OR in RELOCATION FLOW.
- When user asks "which plan am I on?", "what plan do I have?", "my current service", "plan details":
  → Reply: "You are currently on the [title] plan – $[price]/month (XX Mbps down / YY Mbps up)."
- When user asks to CHANGE / UPGRADE plan:
  1. Identify current active internet service title.
  2. Respond EXACTLY: "I can see that you are on [title], on the [network] network."
     (Network logic: title contains "HIR" or "Hope Island" → HIR; contains "OptiComm" → OptiComm; else NBN)
  3. Then follow the STRICT PLANS DISPLAY RULE.
  4. After both preferences collected, provide matching plans.
  5. Show numbered list (matching preferences only) and ask: "Which one would you like to switch to?"
  6. Once selected → follow sales flow and create_ticket with subject "Plan Change Request".

INITIAL FLOW - follow these steps exactly:
1. After the initial greeting and collecting preferredName, ask: "Are you a new InfiNET customer or an existing one?"
2. If they say new (or similar), ask: "Would you like a quick overview of InfiNET Broadband, or how can I assist you today?"
   - If they want to know more, explain briefly: "InfiNET Broadband provides reliable high-speed internet across Australia, including NBN, OptiComm, and other technologies, with unlimited data plans." Then proceed to sales flow.
   - If they choose help or sales, proceed directly to sales flow.
3. If they say existing (or similar), ask: "How may we help you today? Would it be sales, support, accounts, other, or moving/relocating?"
4. Based on their intent, proceed to the corresponding flow:
   - sales → SALES FLOW
   - moving-relocating → RELOCATION FLOW
   - support → SUPPORT FLOW
   - accounts → ACCOUNTS FLOW
   - other → GENERAL flow: ask concisely "Could you please give me a bit more detail on how we can assist?" then answer using KB or create ticket if needed
   If they are not an existing customer and choose support or accounts, politely explain: "Support and accounts are for existing customers. If you're interested in our services (or moving), let's proceed with sales." and switch to sales flow.

SALES FLOW - follow these steps exactly (for new customers or general sales interest, NOT relocation):
1. Ask exactly: "Great! Are you interested in residential or business plans?"
2. After they reply → Ask exactly: "Would you like NBN or OptiComm plans?"
3. After they reply → Ask: "To check the best plans for you, what's your full address (street, suburb, state and postcode)?"
4. Immediately call the check_address_availability tool with the address.
5. After tool result → Show ONLY the available plans matching BOTH collected preferences concisely (use live data only), numbered as 1., 2., etc. Briefly add: "Select the plan by replying with the number (e.g. 1), title or speed."
6. Ask: "Which plan interests you? Please reply with the plan number, title or speed."
7. After they select a plan → Confirm and collect remaining: email, and confirm address if not already collected.
8. Use extract_call_fields to capture leadInterest as the selected plan title/speed.
9. When ALL details collected (preferredName, email, leadInterest, address, residentialPreference, networkPreference) → Call create_ticket with subject like "Sales Inquiry for [leadInterest]", message body including all collected details, lead_id: 0 if new, reporter_type: 'api', priority: 'medium', type_id: appropriate from get_ticket_types.

RELOCATION FLOW - follow these steps exactly (ONLY for existing customers who selected moving/relocating):
1. Ask for name, email, or phone if not collected, then immediately call customer_lookup tool.
2. After successful lookup: List active services concisely: "You have these active services:\n1. [title from internet/voice/recurring] ...\nWhich service do you want to relocate/terminate? Reply with the number or title."
3. Once user replies, use extract_call_fields to capture serviceToTerminate.
4. Ask exactly: "For the new service, are you interested in residential or business plans?"
5. After they reply → use extract_call_fields to capture residentialPreference, then ask exactly: "Would you like NBN or OptiComm plans?"
6. After they reply → use extract_call_fields to capture networkPreference.
7. Ask: "What is the desired termination date for the old service? (YYYY-MM-DD or 15 April 2026)"
8. Collect terminationDate via extract_call_fields.
9. Ask: "What is the desired connection date for the new service? (YYYY-MM-DD)"
10. Collect connectionDate via extract_call_fields.
11. Ask: "What's the new property address (street, suburb, state and postcode)?"
12. Call check_address_availability with the new address.
13. After tool result → Show ONLY available plans matching BOTH collected preferences numbered: "Plans available at new address:\n1. ...\nWhich plan would you like for the new connection? Reply with number, title or speed."
14. After selection, set leadInterest = selected plan title/speed.
15. Collect email if missing.
16. When ALL details collected (preferredName, customer_id, email, leadInterest, address (new), terminationDate, connectionDate, serviceToTerminate, residentialPreference, networkPreference) → Call create_ticket with:
    - customer_id (looked-up ID)
    - subject: "Relocation Request — [leadInterest]"
    - message: { message: "Relocation from \${preferredName}:\nOld service to terminate: \${serviceToTerminate} on \${terminationDate}\nNew address: \${address}\nNew connection date: \${connectionDate}\nNew plan: \${leadInterest}\nResidential/Business: \${residentialPreference}\nNetwork: \${networkPreference}\nFull conversation summary." }
    - priority: "medium"
    - reporter_type: "api"
    - lead_id: 0 (but customer_id present)
    After success, reply EXACTLY: "Thank you \${preferredName}! I have raised sales inquiry ticket for you. You will receive the details via email shortly. Our team will contact you shortly."

SUPPORT FLOW (for existing customers only):
- First, ask for name, email, or phone if not collected, then immediately call customer_lookup tool to get customer_id and services.
- After successful lookup: Reply EXACTLY: "Found your account successfully, \${preferredName}. Please provide a brief description of the issue you're facing."
- Do NOT list or mention any active services automatically (this is not for support flow).
- If issueSummary is not collected, ask: "Please provide a brief description of the issue." Once a basic description is provided, immediately ask for additional high-level details to help our support team (e.g. "Any more details like when it started, affected devices, error messages, or speed test results?").
- Combine everything into the final issueSummary.
- When ALL details collected (preferredName, customer_id, email, issueSummary) → Call create_ticket with customer_id, subject based on issueSummary, message: full issueSummary, reporter_type: 'api', priority: 'medium', type_id for support.

ACCOUNTS FLOW (billing/financing, for existing customers only):
- First, ask for name, email, or phone, then call customer_lookup to get customer_id and services.
- If not found, say "Sorry, I couldn't find your account. Are you sure you're an existing customer?" and switch to sales if needed.
- Answer any billing or payment questions using the Knowledge base.
- Specifically for "pay a bill" or any question about paying over the phone: Reply concisely: "We can take payments or update payment details over the phone. Please call 1300 101 414 to proceed. Would you like help with anything else regarding your bill?"
- For any specific issue → Provide issueSummary if not collected.
- When ALL details collected → Call create_ticket with customer_id, subject: "Accounts Query: [brief summary]", message: issueSummary, reporter_type: 'api', priority: 'medium', type_id for accounts.

GENERAL: Answer using the Knowledge base. If needed, ask clarifying questions concisely. When the customer asks about plans, pricing, speeds, upgrades or "what plans do you have?": Follow the STRICT PLANS DISPLAY RULE (ask residential/business first, then NBN/OptiComm), then call the get_internet_plans tool. After result, show ONLY matching plans.

TOOL USAGE (CRITICAL):
- When the customer answers the "new or existing" question (first step of INITIAL FLOW), ALWAYS use extract_call_fields to capture customerType: "new" or "existing".
- For new customers → sales@ email will be used. For existing customers → support@ email will be used.
- When the customer asks about availability at their address or you reach step 4 in the sales flow or step 12 in relocation flow: call check_address_availability with the full address.
- To lookup customer by name, email, or phone: call customer_lookup with at least one of name, email, phone. Returns customer details and ACTIVE services only.
- The tool results will be injected into the conversation. ALWAYS use the live tool data for plans and availability (never rely on old hardcoded KB plans).
- After a tool result, continue the flow concisely using the live data.
- Call extract_call_fields whenever the user provides any personal info or intent.

Knowledge base for InfiNET Broadband (use this to answer customer calls and chats concisely):
${KB}
Locations (states) with IDs:
${LOCATIONS.map((l) => `${l.id}: ${l.name}`).join("\n")}
`;

const extractFunction = {
  name: "extract_call_fields",
  description: "Extract fields from user message: intent (support/sales/general/account), issueSummary, preferredName (what they want to be called), email, priority, callbackRequest (boolean), timeline, leadInterest, accountNumber, name, phone, terminationDate, connectionDate, serviceToTerminate. Omit fields not present.",
  parameters: {
    type: "object",
    properties: {
      intent: { type: "string", enum: ["support", "sales", "general", "account"] },
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
      terminationDate: { type: "string" },
      connectionDate: { type: "string" },
      serviceToTerminate: { type: "string" },
      customerType: { type: "string", enum: ["new", "existing"] },
    },
    required: [],
  },
};

const getPlansTool = {
  name: "get_internet_plans",
  description: "Fetch the latest live internet tariff plans (prices, speeds, availability). ALWAYS call this for any plan/pricing/speed question.",
  parameters: { type: "object", properties: {}, required: [] },
};

const checkAvailabilityTool = {
  name: "check_address_availability",
  description: "Check which plans are available at a customer's address. Requires full address.",
  parameters: {
    type: "object",
    properties: {
      address: { type: "string", description: "Full address including street, suburb, state and postcode if possible" },
    },
    required: ["address"],
  },
};

const customerLookupTool = {
  name: "customer_lookup",
  description: "Lookup customer by name, email, or phone to verify existing customer and get account details and ACTIVE services only. Provide at least one.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
    },
    required: [],
  },
};

const createTicketTool = {
  name: "create_ticket",
  description: "Create a new ticket in Splynx. Use this when ready to raise a ticket based on the flow.",
  parameters: {
    type: "object",
    properties: {
      customer_id: { type: "number" },
      incoming_customer_id: { type: "number" },
      lead_id: { type: "number" },
      reporter_id: { type: "number" },
      reporter_type: { type: "string", enum: ["admin", "customer", "api", "incoming", "none"] },
      hidden: { type: "boolean" },
      assign_to: { type: "number" },
      status_id: { type: "number" },
      group_id: { type: "number" },
      type_id: { type: "number" },
      task_id: { type: "number" },
      subject: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
      star: { type: "boolean" },
      unread_by_customer: { type: "boolean" },
      unread_by_admin: { type: "boolean" },
      closed: { type: "boolean" },
      source: { type: "string", enum: ["administration", "api", "portal", "widget", "incoming"] },
      trash: { type: "number" },
      shareable: { type: "number" },
      note: { type: "string" },
      watching: { type: "number" },
      related_account_id: { type: "number" },
      related_account_type: { type: "string", enum: ["none", "main", "sub"] },
      hidden_from_related_account: { type: "number" },
      unread_by_related_account: { type: "number" },
      watchers: { type: "array", items: { type: "number" } },
      moduleLabels: { type: "array", items: { type: "number" } },
      message: {
        type: "object",
        properties: {
          message: { type: "string" },
          hide_for_customer: { type: "boolean" },
          mail_to: { type: "string" },
          smsTo: { type: "array", items: { type: "string" } },
          mail_cc: { type: "string" },
          mail_bcc: { type: "string" },
        },
      },

    },
    required: ["subject", "priority"],
  },
};

const getTicketTypesTool = {
  name: "get_ticket_types",
  description: "Fetch the list of ticket types.",
  parameters: { type: "object", properties: {}, required: [] },
};

const getTicketGroupsTool = {
  name: "get_ticket_groups",
  description: "Fetch the list of ticket groups.",
  parameters: { type: "object", properties: {}, required: [] },
};

const getTicketStatusesTool = {
  name: "get_ticket_statuses",
  description: "Fetch the list of ticket statuses.",
  parameters: { type: "object", properties: {}, required: [] },
};

const tools = [
  extractFunction,
  getPlansTool,
  checkAvailabilityTool,
  customerLookupTool,
  createTicketTool,
  getTicketTypesTool,
  getTicketGroupsTool,
  getTicketStatusesTool,
];

// ==================== HELPER FUNCTIONS ====================
function mkSession(sessionId) {
  const id = sessionId || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session = {
    id,
    collected: {},
    messages: [{ role: "system", content: SYSTEM_PROMPT }],
    lastSeen: new Date().toISOString(),
    hasGreeted: false,
  };
  sessions.set(id, session);
  return session;
}

function normalizeText(t) {
  if (!t) return "";
  return t.toString().replace(/\u200B/g, "").replace(/\s+/g, " ").trim();
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
    if (typeof v === "number") out[k] = Math.round(v);
    else out[k] = v;
  }
  return out;
}

async function convertToWav(inputPath) {
  const out = inputPath + ".converted.wav";
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(["-ar 16000", "-ac 1", "-vn"])
      .toFormat("wav")
      .on("end", () => resolve(out))
      .on("error", (err) => reject(err))
      .save(out);
  });
}

async function streamToBuffer(body) {
  if (!body) return Buffer.from("");
  if (Buffer.isBuffer(body)) return body;
  if (body.arrayBuffer) {
    const ab = await body.arrayBuffer();
    return Buffer.from(ab);
  }
  if (body.pipe) {
    const chunks = [];
    return new Promise((resolve, reject) => {
      body.on("data", (c) => chunks.push(Buffer.from(c)));
      body.on("end", () => resolve(Buffer.concat(chunks)));
      body.on("error", (err) => reject(err));
    });
  }
  return Buffer.from(JSON.stringify(body));
}

function applyExtractionToSession(session, parsed) {
  const extractionResult = numbersToInt(parsed || {});
  for (const [k, v] of Object.entries(extractionResult)) {
    if (v !== undefined && v !== null) session.collected[k] = v;
  }
  session.lastSeen = new Date().toISOString();
  sessions.set(session.id, session);
  return extractionResult;
}

async function customerLookup({ name, email, phone }) {
  const main_attributes = {};
  if (name) main_attributes.name = name;
  if (email) main_attributes.login = email;
  if (phone) main_attributes.phone = phone;
  const searchParams = { main_attributes };
  console.log("Customer lookup with params:", searchParams);
  const customers = await splynx.searchCustomers(searchParams);
  console.log("Customer lookup result:", customers);
  if (!customers || customers.length === 0) {
    return { success: false, message: "No customer found" };
  }
  if (customers.length > 1) {
    return { success: true, multiple: true, customers };
  }
  const customer = customers[0];
  console.log("Selected customer:", customer);
  let services = { internet: [], voice: [], recurring: [] };
  try {
    let allInternet = await splynx.getCustomerInternetServices(customer.id);
    services.internet = allInternet.filter(s => s.status === 'active');

    let allVoice = await splynx.getCustomerVoiceServices(customer.id);
    services.voice = allVoice.filter(s => s.status === 'active');

    let allRecurring = await splynx.getCustomerRecurringServices(customer.id);
    services.recurring = allRecurring.filter(s => s.status === 'active');

    console.log("Customer services fetched (ACTIVE ONLY):", services);
  } catch (err) {
    console.error("Failed to get services for customer", customer.id, err);
  }
  return { success: true, customer, services };
}

function objectToUrlEncoded(obj, params = new URLSearchParams(), namespace = "") {
  for (const property in obj) {
    if (!obj.hasOwnProperty(property)) continue;
    const formKey = namespace ? `${namespace}[${property}]` : property;
    const value = obj[property];
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      objectToUrlEncoded(value, params, formKey);
    } else if (Array.isArray(value)) {
      value.forEach((item) => params.append(`${formKey}[]`, item));
    } else {
      const valStr = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
      params.append(formKey, valStr);
    }
  }
  return params;
}

// ==================== ELEVENLABS TTS (MINIMUM DELAY) ====================
async function makeTTS(text) {
  if (!text || text.trim() === "") return null;
  try {
    const response = await axios.post(
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
      }
    );
    console.log("✅ ElevenLabs TTS (turbo_v2_5) generated");
    return Buffer.from(response.data);
  } catch (err) {
    console.warn("ElevenLabs TTS failed:", err?.response?.data || err?.message || err);
    return null;
  }
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

async function determineLocationId(address) {
  if (!address) return null;
  const prompt = `You are an expert at identifying Australian states from addresses.
Reply with EXACTLY one of these state names (nothing else):
Queensland
Victoria
New South Wales
Tasmania
Western Australia
South Australia
Northern Territory
ACT
If the address does not clearly indicate any state, reply "Unknown".
Address: ${address}`;
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 20,
    });
    let stateName = resp.choices[0].message.content.trim();
    if (stateName === "Unknown") return null;
    const nameMap = {
      QLD: "Queensland",
      VIC: "Victoria",
      NSW: "New South Wales",
      TAS: "Tasmania",
      WA: "Western Australia",
      SA: "South Australia",
      NT: "Northern Territory",
      ACT: "ACT",
    };
    if (nameMap[stateName]) stateName = nameMap[stateName];
    const loc = LOCATIONS.find((l) => l.name.toLowerCase() === stateName.toLowerCase());
    return loc ? loc.id : null;
  } catch (err) {
    console.error("Location determination failed:", err.message);
    return null;
  }
}

// ==================== API ENDPOINTS ====================
app.post("/api/voice-chat/init", async (req, res) => {
  try {
    const session = mkSession();
    const greeting = `Hi there! Welcome to InfiNET Broadband. Could you please share your name to get started?`;
    session.messages.push({ role: "assistant", content: greeting });
    sessions.set(session.id, session);
    const ttsBuf = await makeTTS(greeting);
    const audioBase64 = ttsBuf ? ttsBuf.toString("base64") : null;
    return res.json({ sessionId: session.id, text: greeting, audioBase64 });
  } catch (err) {
    console.error("chat init err", err);
    return res.status(500).json({ error: err?.message || "server error" });
  }
});

app.post("/api/voice", upload.single("audio"), async (req, res) => {
  const incomingSessionId = (req.body && req.body.sessionId) || req.query.sessionId || req.headers["x-session-id"] || null;
  if (!req.file) return res.status(400).json({ error: "Missing audio file (multipart field 'audio')" });
  const uploadedPath = path.resolve(req.file.path);
  let convertedPath = null;
  try {
    const session = incomingSessionId && sessions.has(incomingSessionId) ? sessions.get(incomingSessionId) : mkSession(incomingSessionId);
    const origName = (req.file.originalname || "").toLowerCase();
    const mimetype = (req.file.mimetype || "").toLowerCase();
    const looksLikeWav = origName.endsWith(".wav") || mimetype === "audio/wav" || mimetype === "audio/wave" || mimetype === "audio/x-wav";
    if (looksLikeWav) {
      convertedPath = uploadedPath;
    } else {
      convertedPath = await convertToWav(uploadedPath);
    }
    const transcriptionResp = await openai.audio.transcriptions.create({
      file: fs.createReadStream(convertedPath),
      model: "whisper-1",
    });
    const userTextRaw = normalizeText(transcriptionResp?.text || "");
    if (!userTextRaw) {
      const prompt = "Sorry, I didn't catch that — could you please repeat briefly?";
      const ttsBuf = await makeTTS(prompt);
      session.lastSeen = new Date().toISOString();
      sessions.set(session.id, session);
      return res.json({
        sessionId: session.id,
        text: prompt,
        audioBase64: ttsBuf ? ttsBuf.toString("base64") : null,
        userText: null
      });
    }
    session.messages.push({ role: "user", content: userTextRaw });
    let assistantText = null;
    const firstCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: session.messages,
      functions: tools,
      function_call: "auto",
      temperature: 0.0,
      max_tokens: 300,
    });
    const firstMsg = firstCompletion.choices?.[0]?.message;
    if (firstMsg?.function_call) {
      const funcName = firstMsg.function_call.name;
      const args = safeParseJSON(firstMsg.function_call.arguments) || {};
      session.messages.push(firstMsg);
      let toolContent;
      if (funcName === "extract_call_fields") {
        applyExtractionToSession(session, args);
        toolContent = JSON.stringify({ success: true });
      } else if (funcName === "get_internet_plans") {
        const tariffs = await fetchTariffs();
        toolContent = JSON.stringify({
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
      } else if (funcName === "check_address_availability") {
        const { address } = args;
        if (!address) {
          toolContent = JSON.stringify({ error: "Address is required" });
        } else {
          const locId = await determineLocationId(address);
          const tariffs = await fetchTariffs();
          const availablePlans = locId
            ? tariffs.filter((t) => t.available_for_locations && t.available_for_locations.includes(locId))
            : [];
          toolContent = JSON.stringify({
            success: true,
            address,
            locationId: locId,
            locationName: LOCATIONS.find((l) => l.id === locId)?.name || "Unknown",
            availablePlans: availablePlans.map((p) => ({
              title: p.title,
              price: parseFloat(p.price),
              download: `${p.speed_download / 1000} Mbps`,
              upload: `${p.speed_upload / 1000} Mbps`,
            })),
          });
        }
      } else if (funcName === "customer_lookup") {
        try {
          const lookupResult = await customerLookup(args);
          toolContent = JSON.stringify(lookupResult);
        } catch (err) {
          toolContent = JSON.stringify({ success: false, error: err.message });
        }
      } else if (funcName === "create_ticket") {
        try {
          let fixedArgs = { ...args };
          if (typeof fixedArgs.message === "string") {
            fixedArgs.message = { message: fixedArgs.message };
          }
          const urlEncoded = objectToUrlEncoded(fixedArgs);
          console.log("Creating ticket with args:", JSON.stringify(fixedArgs));
          const response = await splynx.request("POST", "admin/support/tickets", urlEncoded);
          const isSupportTicket = session.collected.customerType === "existing";
          toolContent = JSON.stringify({ success: true, ticket_id: response.id });
          await sendTicketEmail(response.id, fixedArgs, session.collected, isSupportTicket);
        } catch (err) {
          console.error("Create ticket failed with args:", JSON.stringify(args), "error:", err);
          toolContent = JSON.stringify({ success: false, error: err.message || "Failed to create ticket" });
        }
      } else if (funcName === "get_ticket_types") {
        try {
          const types = await splynx.request("GET", "admin/support/tickets-types");
          toolContent = JSON.stringify({ success: true, types });
        } catch (err) {
          toolContent = JSON.stringify({ success: false, error: err.message });
        }
      } else if (funcName === "get_ticket_groups") {
        try {
          const groups = await splynx.request("GET", "admin/support/tickets-groups");
          toolContent = JSON.stringify({ success: true, groups });
        } catch (err) {
          toolContent = JSON.stringify({ success: false, error: err.message });
        }
      } else if (funcName === "get_ticket_statuses") {
        try {
          const statuses = await splynx.request("GET", "admin/support/tickets-statuses");
          toolContent = JSON.stringify({ success: true, statuses });
        } catch (err) {
          toolContent = JSON.stringify({ success: false, error: err.message });
        }
      }
      session.messages.push({ role: "function", name: funcName, content: toolContent });
      const collectedSummary = `CollectedFields: ${JSON.stringify(session.collected || {})}.`;
      const followupSystem = `You are a concise assistant for ISP CRM. Use collected fields and ask for remaining missing info concisely. Use the tool results above for accurate plans and availability.`;
      const finalMessages = [
        { role: "system", content: followupSystem },
        ...session.messages,
        { role: "system", content: collectedSummary },
      ];
      const finalResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: finalMessages,
        temperature: 0.0,
        max_tokens: 350,
      });
      assistantText = finalResp.choices?.[0]?.message?.content?.trim() || "Thanks — I have your details.";
      session.messages.push({ role: "assistant", content: assistantText });
    } else if (firstMsg?.content) {
      assistantText = firstMsg.content;
      session.messages.push({ role: "assistant", content: assistantText });
    }
    const ttsBuf = await makeTTS(assistantText);
    session.lastSeen = new Date().toISOString();
    sessions.set(session.id, session);
    return res.json({
      sessionId: session.id,
      text: assistantText,
      audioBase64: ttsBuf ? ttsBuf.toString("base64") : null,
      userText: userTextRaw
    });
  } catch (err) {
    console.error("voice error:", err);
    return res.status(500).json({ error: err?.message || "server error" });
  } finally {
    try {
      if (uploadedPath && fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    } catch (_) { }
    try {
      if (convertedPath && convertedPath !== uploadedPath && fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath);
    } catch (_) { }
  }
});

// ==================== STRUCTURED INPUT (HTTP fallback) ====================
app.post("/api/voice/structured-input", async (req, res) => {
  try {
    const { sessionId, type, field, value } = req.body || {};
    if (!sessionId || !field || !value) {
      return res.status(400).json({ error: "Missing sessionId, field, or value" });
    }
    if (!["email", "phone"].includes(field)) {
      return res.status(400).json({ error: "Field must be 'email' or 'phone'" });
    }
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Save to collected fields
    session.collected[field] = value;

    // Inject as user message
    const userMessage = field === "email" ? `My email is ${value}` : `My phone number is ${value}`;
    session.messages.push({ role: "user", content: userMessage });

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: session.messages,
      functions: tools,
      function_call: "auto",
      temperature: 0.0,
      max_tokens: 300,
    });
    const msg = completion.choices?.[0]?.message;
    let assistantText = null;

    if (msg?.function_call) {
      const funcName = msg.function_call.name;
      const args = safeParseJSON(msg.function_call.arguments) || {};
      session.messages.push(msg);
      let toolContent;

      if (funcName === "extract_call_fields") {
        applyExtractionToSession(session, args);
        toolContent = JSON.stringify({ success: true });
      } else if (funcName === "customer_lookup") {
        try { toolContent = JSON.stringify(await customerLookup(args)); }
        catch (err) { toolContent = JSON.stringify({ success: false, error: err.message }); }
      } else if (funcName === "create_ticket") {
        try {
          let fixedArgs = { ...args };
          if (typeof fixedArgs.message === "string") fixedArgs.message = { message: fixedArgs.message };
          const urlEncoded = objectToUrlEncoded(fixedArgs);
          const response = await splynx.request("POST", "admin/support/tickets", urlEncoded);
          const isSupportTicket = session.collected.customerType === "existing";
          toolContent = JSON.stringify({ success: true, ticket_id: response.id });
          await sendTicketEmail(response.id, fixedArgs, session.collected, isSupportTicket);
        } catch (err) {
          toolContent = JSON.stringify({ success: false, error: err.message || "Failed to create ticket" });
        }
      } else {
        toolContent = JSON.stringify({ error: `Unhandled tool: ${funcName}` });
      }

      session.messages.push({ role: "function", name: funcName, content: toolContent });
      const collectedSummary = `CollectedFields: ${JSON.stringify(session.collected || {})}.`;
      const followupSystem = `You are a concise assistant for ISP CRM. Use collected fields and ask for remaining missing info concisely.`;
      const finalMessages = [
        { role: "system", content: followupSystem },
        ...session.messages,
        { role: "system", content: collectedSummary },
      ];
      const finalResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: finalMessages,
        temperature: 0.0,
        max_tokens: 350,
      });
      assistantText = finalResp.choices?.[0]?.message?.content?.trim() || "Thanks — I have your details.";
      session.messages.push({ role: "assistant", content: assistantText });
    } else if (msg?.content) {
      assistantText = msg.content;
      session.messages.push({ role: "assistant", content: assistantText });
    }

    const ttsBuf = await makeTTS(assistantText);
    session.lastSeen = new Date().toISOString();
    sessions.set(session.id, session);

    return res.json({
      sessionId: session.id,
      text: assistantText,
      audioBase64: ttsBuf ? ttsBuf.toString("base64") : null,
      userText: userMessage,
      collected: session.collected,
    });
  } catch (err) {
    console.error("structured-input error:", err);
    return res.status(500).json({ error: err?.message || "server error" });
  }
});

app.get("/", (req, res) => {
  res.send(`<h1 style="text-align:center;margin-top:100px;font-family:sans-serif;color:#00bfff">✅ InfiNET AI Backend is running!<br><br>Open index.html in your browser.</h1>`);
});

// ==================== HTTP SERVER + SOCKET.IO + REALTIME VOICE ====================
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
  safeParseJSON,
  applyExtractionToSession,
  fetchTariffs,
  determineLocationId,
  customerLookup,
  objectToUrlEncoded,
  splynx,
  sendTicketEmail,
});

httpServer.listen(PORT, () => {
  console.log(`🚀 InfiNET Broadband AI Server running on port ${PORT}`);
  console.log(`🎤 Realtime API + ElevenLabs WebSocket • Ultra-low latency mode`);
  console.log(`🔌 Socket.IO ready for voice clients`);
});