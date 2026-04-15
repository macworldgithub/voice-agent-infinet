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
dotenv.config();
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
const PORT = process.env.PORT || 3003;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MARS_BASE_URL = "https://mars.as24516.net/api/v1";
const MARS_CLIENT_ID = process.env.MARS_CLIENT_ID;
const MARS_CLIENT_SECRET = process.env.MARS_CLIENT_SECRET;
if (!OPENAI_API_KEY) {
  console.error("Please set OPENAI_API_KEY in your environment or .env");
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
  console.warn(
    "⚠️ SMTP_PASS not set in .env — email notifications will be DISABLED",
  );
}
async function sendTicketEmail(
  ticketId,
  ticketArgs,
  collectedFields,
  isSupportTicket = false,
) {
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
      : `<p><strong>New Lead (no customer ID)</strong></p>`
    }
  <h3>Message Body</h3>
  <p>${(ticketArgs.message && (ticketArgs.message.message || ticketArgs.message)) || "No additional message provided"}</p>
  <hr>
  <p><small>This is an automated email from the InfiNET Broadband AI Assistant.<br>
  ${isSupportTicket && ticketId
      ? `View ticket: https://infinetbroadband-portal.com.au/admin/support/tickets/${ticketId}`
      : `This is a ${type.toLowerCase()} enquiry — to be followed up manually.`
    }
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
    console.log(
      `📧 Email notification sent for ${type.toLowerCase()} enquiry${ticketId ? ` #${ticketId}` : ""}`,
    );
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
// ==================== HARDCODED OPTICOMM PLANS ====================
// These are used instead of MARS API when the customer selects OptiComm
const OPTICOMM_RESIDENTIAL_PLANS = [
  {
    title: "OptiComm 25/10Mbps Residential",
    price: 64,
    download: "25 Mbps",
    upload: "10 Mbps",
    intro_price: 64,
    ongoing_price: 69,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month", "Reliable Fast Fibre"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 1080p", "Web browsing & Social Media"],
  },
  {
    title: "OptiComm 50/20Mbps Residential",
    price: 74,
    download: "50 Mbps",
    upload: "20 Mbps",
    intro_price: 74,
    ongoing_price: 79,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month", "Reliable Fast Fibre"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 1080p", "Web browsing & Social Media", "Some Gaming Applications"],
  },
  {
    title: "OptiComm 100/20Mbps Residential",
    price: 84,
    download: "100 Mbps",
    upload: "20 Mbps",
    intro_price: 84,
    ongoing_price: 89,
    discount: "$5 off for 3 months",
    note: "For communities with limited capacity of 100Mbps",
    features: ["Unlimited Data", "No Contract", "Month to Month", "Reliable Fast Fibre"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 4K", "Web browsing & Social Media", "Fast Downloading", "Gaming", "Low latency"],
  },
  {
    title: "OptiComm 500/50Mbps Faster Residential",
    price: 79,
    download: "500 Mbps",
    upload: "50 Mbps",
    intro_price: 79,
    ongoing_price: 89,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month", "Reliable Fast Fibre"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 4K", "Web browsing & Social Media", "Super Fast Downloading", "All Gaming Applications", "Low latency"],
  },
  {
    title: "OptiComm 750/50Mbps Residential",
    price: 89,
    download: "750 Mbps",
    upload: "50 Mbps",
    intro_price: 89,
    ongoing_price: 99,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month", "Reliable Fast Fibre"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 4K", "Web browsing & Social Media", "Super Fast Downloading", "All Gaming Applications", "Low latency"],
  },
  {
    title: "OptiComm 1000/100Mbps Residential",
    price: 99,
    download: "1000 Mbps",
    upload: "100 Mbps",
    intro_price: 99,
    ongoing_price: 109,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month", "Reliable Fast Fibre"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 4K", "Web browsing & Social Media", "Super Fast Uploads/Downloads", "All Gaming Applications", "Low latency"],
  },
];
const OPTICOMM_BUSINESS_PLANS = [
  {
    title: "OptiComm 50/20Mbps Business",
    price: 79,
    download: "50 Mbps",
    upload: "20 Mbps",
    intro_price: 79,
    ongoing_price: 89,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contracts", "Month to Month", "Includes Static IP"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 4K", "Web browsing & Social Media", "Some Gaming Applications", "Low latency"],
  },
  {
    title: "OptiComm 100/40Mbps Business",
    price: 99,
    download: "100 Mbps",
    upload: "40 Mbps",
    intro_price: 99,
    ongoing_price: 109,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contracts", "Month to Month", "Includes Static IP"],
    suitable_for: ["Business IP Phones (VoIP Services)", "Video Calls / Teams", "Streaming HD Video + 4K", "Web browsing & Social Media", "Moderate Uploads/Downloads", "All Gaming Applications", "Low latency"],
  },
  {
    title: "OptiComm 250/100Mbps Business",
    price: 139,
    download: "250 Mbps",
    upload: "100 Mbps",
    intro_price: 139,
    ongoing_price: 149,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contracts", "Month to Month", "Includes Static IP"],
    suitable_for: ["Business IP Phones (VoIP Services)", "Video Calls / Teams", "Streaming HD Video + 4K", "Web browsing & Social Media", "Super Fast Uploads/Downloads", "All Gaming Applications", "Low latency"],
  },
  {
    title: "OptiComm 500/200Mbps Business",
    price: 169,
    download: "500 Mbps",
    upload: "200 Mbps",
    intro_price: 169,
    ongoing_price: 179,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contracts", "Month to Month", "Includes Static IP"],
    suitable_for: ["Business IP Phones (VoIP Services)", "Video Calls / Teams", "Streaming HD Video + 4K", "Web browsing & Social Media", "Super Fast Uploads/Downloads", "All Gaming Applications", "Low latency"],
  },
  {
    title: "OptiComm 1000/400Mbps Business",
    price: 189,
    download: "1000 Mbps",
    upload: "400 Mbps",
    intro_price: 189,
    ongoing_price: 199,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contracts", "Month to Month", "Includes Static IP"],
    suitable_for: ["Business IP Phones (VoIP Services)", "Video Calls / Teams", "Streaming HD Video + 4K", "Web browsing & Social Media", "Super Fast Uploads/Downloads", "All Gaming Applications", "Low latency"],
  },
];
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
      const data = response.data;
      this.accessToken = data.access_token;
      this.accessTokenExpiration = data.access_token_expiration;
      this.refreshToken = data.refresh_token;
      this.refreshTokenExpiration = data.refresh_token_expiration;
      console.log("✅ Splynx Access token generated");
      return data;
    } catch (err) {
      console.error(
        "Token generation failed:",
        err.response?.data || err.message,
      );
      throw err;
    }
  }
  async renewAccessToken() {
    if (!this.refreshToken) throw new Error("No refresh token available");
    try {
      const response = await axios.get(
        `${this.baseUrl}admin/auth/tokens/${this.refreshToken}`,
        {
          headers: {
            Authorization: `Splynx-EA (access_token=${this.accessToken})`,
          },
        },
      );
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
        ...(data && {
          data: data instanceof URLSearchParams ? data.toString() : data,
        }),
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
    return this.request(
      "GET",
      `admin/customers/customer/${customerId}/internet-services`,
      null,
      params,
    );
  }
  async getCustomerVoiceServices(customerId, params = {}) {
    return this.request(
      "GET",
      `admin/customers/customer/${customerId}/voice-services`,
      null,
      params,
    );
  }
  async getCustomerRecurringServices(customerId, params = {}) {
    return this.request(
      "GET",
      `admin/customers/customer/${customerId}/recurring-services`,
      null,
      params,
    );
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
    if (CONFIG.USE_ACCESS_TOKEN && !splynx.accessToken)
      await splynx.generateAccessToken();
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
  If the customer does not have portal access, tell them: "If you don't have access to the customer portal, please email support@infinetbroadband.com.au and our team will issue you the login credentials."
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
    - Answer: Yes, you can bring your own compatible modem. If you're unsure, our support team can help check compatibility. We also offer modems for purchase if you prefer a hassle-free setup.
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
• Check address/technology: Use InfiNET "Check your Address" tool or ask support
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
  - 50/20 Standard: $74/m ($5 off 3m, then $79) – FTTC/FTTN/FTTB/FTTP/HFC
  - 100/20 Fast: $84/m ($5 off 3m, then $89) – FTTC/FTTN/FTTB/FTTP/HFC
  - 500/50 Faster: $84/m ($5 off 3m, then $89) – FTTP/HFC only
  - 750/50 Superfast: $89/m ($10 off 3m, then $99) – FTTP/HFC only
  - 1000/100 Ultrafast: $99/m ($10 off 3m, then $109) – FTTP/HFC only
  OptiComm Residential (FTTP, reliable fibre):
  - 25/10: $64/m ($5 off 3m, then $69)
  - 50/20: $74/m ($5 off 3m, then $79)
  - 100/20: $84/m ($5 off 3m, then $89) – for communities with limited capacity of 100Mbps
  - 500/50 Faster: $79/m ($10 off 3m, then $89)
  - 750/50: $89/m ($10 off 3m, then $99)
  - 1000/100: $99/m ($10 off 3m, then $109)
  Hope Island Resort Residential:
  - 25/10 Basic: $44/m ($15 off 3m, then $59)
  - 50/20 Standard: $49/m ($15 off 3m, then $64)
  - 250/50 Fast: $64/m ($15 off 3m, then $79)
  - 500/50 Home Fast: $64/m ($15 off 3m, then $79) – free modem upgrade if required
  - 750/50 Superfast: $74/m ($15 off 3m, then $89) – free modem upgrade if required
  - 1000/100 Ultrafast: $84/m ($15 off 3m, then $99) – free modem upgrade if required
  NBN Fixed Wireless (no contract, month-to-month, free NBN setup):
  - 25/5 Standard: $59/m
  - 100/20 Plus: $89/m
  - 200/20 HomeFast: $99/m
  - 400/40 SuperFast: $109/m (eligible areas only)
  NBN Sky Muster Plus Satellite (no contract, month-to-month, free NBN installation):
  - 25/5 Basic: $59/m
  - 50/5 Fast: $69/m
  - 100/5 Ultra: $99/m
- Business Plans & FAQs:
  * NBN Business (static IP, unlimited, no contract, month-to-month):
  - 50/20 Basic: $89/m – FTTC/FTTN/FTTB/FTTP/HFC
  - 100/40 Fast: $99/m – FTTC/FTTN/FTTB/FTTP/HFC
  - 250/100 Faster: $149/m – FTTP/HFC only
  - 500/200 Superfast: $189/m – FTTP/HFC only
  - 1000/400 Ultrafast: $239/m – FTTP/HFC only
  * OptiComm Business (static IP included; fee waiver possible — 24m $0/12m $45/else $99; new dev $330 not waived):
  - 50/20: $79/m ($10 off 3m, then $89)
  - 100/40: $99/m ($10 off 3m, then $109)
  - 250/100: $139/m ($10 off 3m, then $149)
  - 500/200: $169/m ($10 off 3m, then $179)
  - 1000/400: $189/m ($10 off 3m, then $199)
  * Hope Island Resort Business:
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
- Keep replies short and focused; ask for remaining missing info concisely.
- Collect structured fields when appropriate and do not re-ask for already collected fields.
- If the user has a preferredName in collected fields, ALWAYS address them warmly by that name in every response.
- Do NOT say anything like "we will connect you to a sales agent", "transferring you to support", "handover to human", "I'll put you through" or similar phrases.
- When enough information is collected per the flow below, call the create_ticket tool with appropriate parameters (generate subject based on the conversation, use issueSummary or leadInterest in the message body).
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
ADDRESS AVAILABILITY & TECHNOLOGY HANDLING (CRITICAL):
**OPTICOMM ADDRESS HANDLING:**
- When networkPreference is "OptiComm" and check_address_availability is called, the tool will return hardcoded OptiComm plans without calling MARS. It returns orderable: true, primaryAccessTechnology: "OptiComm Fibre", and a list of availablePlans filtered by residentialPreference.
- For OptiComm, simply present the plans and note: "OptiComm provides reliable fibre internet. All plans include unlimited data, no contract, and month-to-month terms."
- For OptiComm business plans, note: "All business plans include a Static IP address."
- Do NOT mention serviceability classes, install visits, or MARS details for OptiComm.
**NBN ADDRESS HANDLING:**
When check_address_availability returns results for NBN, follow these rules based on the response:
- If orderable: false → Tell the customer: "Unfortunately, [address] is not yet serviceable for a new connection. Reason: [message]. Would you like to leave your details so we can follow up when it becomes available?"
- If primaryAccessTechnology is "Wireless" (Fixed Wireless, service classes 4–6):
  * Class 4 (Rejected): Not orderable — inform customer.
  * Class 5 (Serviceable - Shortfall, CPE not installed): Can order but technician visit required for antenna/CPE installation. Standard install is free.
  * Class 6 (Serviceable, CPE installed): Ready to connect quickly. Note: if NTD upgrade note present, mention a WNTD upgrade appointment may be required for Superfast tier.
  * Show Fixed Wireless plans only (ignore NBN fibre plans).
  * Skip the "NBN or OptiComm?" question — just ask "residential or business?".
- If primaryAccessTechnology is "Satellite" (Sky Muster, service classes 7–9):
  * Class 7 (Rejected): Not orderable.
  * Class 8 (Serviceable - Shortfall, NTD not installed): Can order, satellite dish + NTD installation required (free standard install). Mention typical latency of 500–600ms.
  * Class 9 (Serviceable, NTD installed): Ready to connect. Mention typical latency.
  * Show Sky Muster plans only.
  * Skip the "NBN or OptiComm?" question — just ask "residential or business?".
- If primaryAccessTechnology contains "Fibre To The Node" or "Fibre To The Building" or "Fibre To The Curb" (FTTN/FTTB/FTTC, service classes 10–13, 30–34):
  * Class 10 (Rejected): Not orderable.
  * Class 11 (FTTN active node, Serviceable - Shortfall): Can order. Technician visit may be needed.
  * Class 12 (jumpering required / cut-in required): Can order, requires jumpering/cut-in work by technician.
  * Class 13 (infrastructure in place): Ready to connect. NTD/infrastructure already in place.
  * Show FTTN/FTTB/FTTC-appropriate NBN plans (max 100/40 speeds). Do NOT show 500/50 or higher as these require FTTP/HFC.
  * Note: FTTC class 31 has no copper line yet (NCD required); 32–33 have copper (NCD required); 34 is fully ready.
- If primaryAccessTechnology is "Fibre" or "HFC" (FTTP/HFC, service classes 0–3, 20–24):
  * Class 0 or 20 (Rejected/Plan Pending): Not orderable.
  * Class 1 or 21 (no drop/lead-in): Serviceable - Shortfall. Technician visit required.
  * Class 2 or 22–23 (drop in place or partial HFC): Serviceable - Shortfall. Partial install done, further work needed.
  * Class 3 or 24 (fully installed): Ready to connect quickly (1–5 business days).
  * Full speed range available (including 1000/400 for FTTP; HFC max 1000/100).
- If requiresInstall: true → Always mention: "Please note an NBN technician visit will be required to complete the connection. Standard installation is free."
- If the tool returns notes (e.g. WNTD upgrade required for Fixed Wireless Superfast) → relay those notes to the customer.
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
   - EXCEPTION: If address check already determined the technology is Fixed Wireless or Satellite, skip this question and proceed directly to step 3.
3. After they reply → Ask: "To check the best plans for you, what's your full address (street, suburb, state and postcode)?"
4. Immediately call the check_address_availability tool with the address.
5. After tool result → Apply ADDRESS AVAILABILITY & TECHNOLOGY HANDLING rules above. Show ONLY available plans matching BOTH collected preferences concisely (use live data only), numbered as 1., 2., etc. Briefly add: "Select the plan by replying with the number (e.g. 1), title or speed."
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
13. After tool result → Apply ADDRESS AVAILABILITY & TECHNOLOGY HANDLING rules. Show ONLY available plans matching BOTH collected preferences numbered: "Plans available at new address:\n1. ...\nWhich plan would you like for the new connection? Reply with number, title or speed."
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
// ==================== MARS SPEED MAPPING ====================
// Maps MARS virtutelSpeedsAvailable codes → { dl, ul } in Mbps
const MARS_SPEED_MAP = {
  // FTTP / HFC / FTTC / FTTB / FTTN — Layer 2 Aggregation
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
  // Fixed Wireless — Layer 2 Aggregation
  TC4FWP: { dl: 25, ul: 5 }, // FW Basic/Standard 25/5
  TC4FWHF: { dl: 100, ul: 20 }, // FW Plus 100/20
  TC4FWSF: { dl: 200, ul: 20 }, // FW HomeFast 200/20
  TC4FWUF: { dl: 400, ul: 40 }, // FW SuperFast 400/40
};
// Auto-populate Layer 3 variants (same speeds as Layer 2)
Object.keys(MARS_SPEED_MAP).forEach((k) => {
  MARS_SPEED_MAP["L3" + k] = MARS_SPEED_MAP[k];
});
// ==================== SERVICE TYPE → PLAN KEYWORD FILTER ====================
// Maps MARS serviceType to title keywords used in Splynx tariff names
const SERVICE_TYPE_KEYWORDS = {
  nsas: ["sky", "satellite", "muster"], // Sky Muster
  nwas: ["wireless", "fixed wireless", "fw "], // Fixed Wireless
  // nfas / nhas / ncas → NBN fibre/copper/HFC — no keyword restriction needed
};
/**
 * Determine if a plan title matches a given technology context.
 * Returns true if the plan is appropriate for the serviceType.
 */
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
  // For nfas/nhas/ncas → exclude satellite and wireless plans
  return (
    !title.includes("sky") &&
    !title.includes("satellite") &&
    !title.includes("muster") &&
    !title.includes("wireless") &&
    !title.includes("fw ")
  );
}
/**
 * Filter Splynx tariffs to only those whose speed matches at least one
 * code in the MARS virtutelSpeedsAvailable array.
 * Also applies serviceType-based keyword filtering.
 * Falls back gracefully if MARS returns no speed data.
 */
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
    if (serviceType && !isPlanMatchingServiceType(t.title, serviceType)) {
      return false;
    }
    if (availableSpeeds.size > 0) {
      const dl = Math.round(t.speed_download / 1000);
      const ul = Math.round(t.speed_upload / 1000);
      return availableSpeeds.has(`${dl}/${ul}`);
    }
    return true;
  });
}
/**
 * Determine if a serviceability class requires an NBN technician installation visit.
 */
function requiresInstallVisit(serviceabilityClass) {
  const installRequired = new Set([
    "1", "2", "5", "8", "21", "22", "23", "31", "32", "33", "11", "12",
  ]);
  return installRequired.has(String(serviceabilityClass));
}
/**
 * Derive a human-readable description of the connection readiness
 * based on primary access technology and serviceability class.
 */
function getServiceabilityDescription(
  primaryAccessTechnology,
  serviceabilityClass,
  serviceabilityStatus,
) {
  const cls = String(serviceabilityClass);
  const tech = (primaryAccessTechnology || "").toLowerCase();
  if (serviceabilityStatus === "Rejected") {
    return "Not currently orderable at this address.";
  }
  if (tech === "fibre") {
    if (cls === "1") return "Fibre serviceable — no drop or NTD in place. Technician visit required for installation.";
    if (cls === "2") return "Fibre drop in place — NTD not yet installed. Technician visit required to complete installation.";
    if (cls === "3") return "Fibre fully installed (drop + NTD in place). Ready to connect — typically 1–5 business days.";
  }
  if (tech === "hfc") {
    if (cls === "21") return "HFC serviceable — lead-in, PCD, and internal cabling required. Technician visit needed.";
    if (cls === "22") return "HFC lead-in & PCD in place — internal cabling with wall plates still needed. Technician visit required.";
    if (cls === "23") return "HFC wall plate present — NTD not yet installed. Technician visit required.";
    if (cls === "24") return "HFC fully installed (wall plate + NTD in place). Ready to connect.";
  }
  if (tech === "wireless") {
    if (cls === "5") return "Fixed Wireless serviceable — CPE (antenna/NTD) not yet installed. Technician visit required. Standard install is free.";
    if (cls === "6") return "Fixed Wireless fully installed (CPE in place). Ready to connect. Note: Superfast tier may require WNTD upgrade appointment.";
  }
  if (tech === "satellite") {
    if (cls === "8") return "Satellite serviceable — dish and NTD not yet installed. Technician visit required. Standard install is free. Typical latency: 500–600ms.";
    if (cls === "9") return "Satellite fully installed (dish + NTD in place). Ready to connect. Typical latency: 500–600ms.";
  }
  if (tech === "fibre to the node") {
    if (cls === "11") return "FTTN serviceable — active node present. Technician visit may be required for jumpering.";
    if (cls === "12") return "FTTN serviceable — jumpering required. Technician visit needed.";
    if (cls === "13") return "FTTN infrastructure in place. Ready to connect.";
  }
  if (tech === "fibre to the building") {
    if (cls === "12") return "FTTB serviceable — jumpering required. Technician visit needed.";
    if (cls === "13") return "FTTB infrastructure in place. Ready to connect.";
  }
  if (tech === "fibre to the curb") {
    if (cls === "31") return "FTTC serviceable — no copper line available yet (NCD required). Technician visit needed.";
    if (cls === "32") return "FTTC serviceable — cut-in required (NCD needed). Technician visit required.";
    if (cls === "33") return "FTTC cut-in complete — NCD still required. Technician visit needed.";
    if (cls === "34") return "FTTC infrastructure fully in place. Ready to connect.";
  }
  return serviceabilityStatus || "Serviceable";
}
const extractFunction = {
  name: "extract_call_fields",
  description:
    "Extract fields from user message: intent (support/sales/general/account), issueSummary, preferredName (what they want to be called), email, priority, callbackRequest (boolean), timeline, leadInterest, accountNumber, name, phone, terminationDate, connectionDate, serviceToTerminate. Omit fields not present.",
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
  description:
    "Fetch the latest live internet tariff plans (prices, speeds, availability). ALWAYS call this for any plan/pricing/speed question.",
  parameters: { type: "object", properties: {}, required: [] },
};
const checkAvailabilityTool = {
  name: "check_address_availability",
  description:
    "Check which plans are available at a customer's address. Requires full address. For OptiComm, returns hardcoded plans without calling MARS. For NBN, calls MARS API to determine serviceability and available plans.",
  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description:
          "Full address including street, suburb, state and postcode if possible",
      },
      networkPreference: {
        type: "string",
        description: "The network preference collected from the customer: 'OptiComm' or 'NBN'",
      },
      residentialPreference: {
        type: "string",
        description: "The plan type preference collected from the customer: 'residential' or 'business'",
      },
    },
    required: ["address"],
  },
};
const customerLookupTool = {
  name: "customer_lookup",
  description:
    "Lookup customer by name, email, or phone to verify existing customer and get account details and ACTIVE services only. Provide at least one.",
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
  description:
    "Create a new ticket in Splynx. Use this when ready to raise a ticket based on the flow.",
  parameters: {
    type: "object",
    properties: {
      customer_id: { type: "number" },
      incoming_customer_id: { type: "number" },
      lead_id: { type: "number" },
      reporter_id: { type: "number" },
      reporter_type: {
        type: "string",
        enum: ["admin", "customer", "api", "incoming", "none"],
      },
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
      source: {
        type: "string",
        enum: ["administration", "api", "portal", "widget", "incoming"],
      },
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
  const id =
    sessionId || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session = {
    id,
    collected: {},
    messages: [{ role: "system", content: SYSTEM_PROMPT }],
    lastSeen: new Date().toISOString(),
  };
  sessions.set(id, session);
  return session;
}
function normalizeText(t) {
  if (!t) return "";
  return t
    .toString()
    .replace(/\u200B/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
    const msg =
      data.vt_error_desc || data.vt_short_error || "Token request failed";
    throw new Error(`Mars token error: ${msg}`);
  }
  marsAccessToken = data.access_token;
  const expiresInSec =
    typeof data.expires_in === "number" ? data.expires_in : 0;
  marsAccessTokenExpiresAtMs = Date.now() + Math.max(0, expiresInSec) * 1000;
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
    const msg =
      data.vt_error_desc || data.vt_short_error || "Address search failed";
    throw new Error(`Mars locations error: ${msg}`);
  }
  const candidates = Array.isArray(data.responseData) ? data.responseData : [];
  return candidates;
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
async function makeTTS(text) {
  try {
    const tts = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "cedar",
      input: text,
      format: "mp3",
      instructions:
        "MANDATORY: Speak in a natural Australian accent only. Do not use any other accent or regional variant.",
    });
    const buf = await streamToBuffer(tts);
    return buf;
  } catch (err) {
    console.warn("TTS failed:", err?.message || err);
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
// UPDATED CUSTOMER LOOKUP – ONLY ACTIVE SERVICES
async function customerLookup({ name, email, phone }) {
  const main_attributes = {};
  if (name) main_attributes.name = name;
  if (email) main_attributes.login = email;
  if (phone) main_attributes.phone = phone;
  const searchParams = { main_attributes };
  console.log("Customer lookup with params:", searchParams);
  const customers = await splynx.searchCustomers(searchParams);
  if (!customers || customers.length === 0) {
    return { success: false, message: "No customer found" };
  }
  if (customers.length > 1) {
    return { success: true, multiple: true, customers };
  }
  const customer = customers[0];
  let services = { internet: [], voice: [], recurring: [] };
  try {
    let allInternet = await splynx.getCustomerInternetServices(customer.id);
    services.internet = allInternet.filter((s) => s.status === "active");
    let allVoice = await splynx.getCustomerVoiceServices(customer.id);
    services.voice = allVoice.filter((s) => s.status === "active");
    let allRecurring = await splynx.getCustomerRecurringServices(customer.id);
    services.recurring = allRecurring.filter((s) => s.status === "active");
    console.log("Customer services fetched (ACTIVE ONLY):", services);
  } catch (err) {
    console.error("Failed to get services for customer", customer.id, err);
  }
  return { success: true, customer, services };
}
function objectToUrlEncoded(
  obj,
  params = new URLSearchParams(),
  namespace = "",
) {
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
      const valStr =
        typeof value === "boolean" ? (value ? "1" : "0") : String(value);
      params.append(formKey, valStr);
    }
  }
  return params;
}
// ==================== SHARED TOOL HANDLER ====================
async function handleToolCall(funcName, args, session) {
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
        download: `${Math.round(t.speed_download / 1000)} Mbps`,
        upload: `${Math.round(t.speed_upload / 1000)} Mbps`,
        available_for_locations: t.available_for_locations || [],
      })),
    });
  } else if (funcName === "check_address_availability") {
    const { address, networkPreference, residentialPreference } = args;
    if (!address) {
      toolContent = JSON.stringify({ error: "Address is required" });
    } else {
      // ==================== OPTICOMM: SKIP MARS, USE HARDCODED PLANS ====================
      // Determine if OptiComm was selected — check both the tool args and the session collected fields
      const netPref = (
        networkPreference ||
        session.collected?.networkPreference ||
        ""
      ).toLowerCase();
      const isOpticomm = netPref === "opticomm" || netPref === "opti comm";
      if (isOpticomm) {
        // Use residentialPreference from args or session
        const resPref = (
          residentialPreference ||
          session.collected?.residentialPreference ||
          "residential"
        ).toLowerCase();
        const isBusiness = resPref === "business";
        const plans = isBusiness
          ? OPTICOMM_BUSINESS_PLANS
          : OPTICOMM_RESIDENTIAL_PLANS;
        console.log(
          `OptiComm address check (no MARS): ${address} | type: ${resPref} | plans: ${plans.length}`,
        );
        toolContent = JSON.stringify({
          success: true,
          orderable: true,
          address,
          network: "OptiComm",
          primaryAccessTechnology: "OptiComm Fibre",
          serviceType: "opticomm",
          requiresInstall: false,
          readinessDescription:
            "OptiComm Fibre is available at this address. Activation is typically within 1–2 business days for fully installed premises.",
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
            ...(p.note ? { note: p.note } : {}),
          })),
        });
      } else {
        // ==================== NBN: USE MARS API AS BEFORE ====================
        try {
          const marsCandidates = await marsAddressSearch(address);
          const locId = marsCandidates?.[0]?.id || null;
          let marsSq = null;
          try {
            if (locId) marsSq = await marsServiceQualification(locId);
          } catch (e) {
            console.warn("MARS service qualification failed:", e.message);
            marsSq = null;
          }
          const serviceabilityStatus =
            marsSq?.siteRestriction?.serviceabilityStatus || null;
          const serviceabilityClass =
            marsSq?.siteRestriction?.supportingTechnology
              ?.serviceabilityClass || null;
          const primaryAccessTechnology =
            marsSq?.siteRestriction?.supportingTechnology
              ?.primaryAccessTechnology || null;
          const serviceType = marsSq?.serviceType || null;
          const virtutelSpeeds = marsSq?.virtutelSpeedsAvailable || [];
          const marsNotes = marsSq?.siteRestriction?.notes || [];
          const serviceabilityClassReason =
            marsSq?.siteRestriction?.supportingTechnology
              ?.serviceabilityClassReason || null;
          if (serviceabilityStatus === "Rejected") {
            const reason =
              serviceabilityClassReason ||
              `This address is planned to be serviced in the future but is not yet orderable.`;
            console.log(
              `Address NOT orderable: ${address} | class: ${serviceabilityClass} | tech: ${primaryAccessTechnology} | reason: ${reason}`,
            );
            toolContent = JSON.stringify({
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
          } else {
            const allTariffs = await fetchTariffs();
            const availablePlans = filterTariffsByMarsAvailability(
              allTariffs,
              virtutelSpeeds,
              serviceType,
            );
            const needsInstall = requiresInstallVisit(serviceabilityClass);
            const readinessDescription = getServiceabilityDescription(
              primaryAccessTechnology,
              serviceabilityClass,
              serviceabilityStatus,
            );
            console.log(
              `NBN address check: ${address} | locId: ${locId} | tech: ${primaryAccessTechnology} | class: ${serviceabilityClass} | status: ${serviceabilityStatus} | serviceType: ${serviceType} | MARS speeds: ${virtutelSpeeds.length} | Matched plans: ${availablePlans.length} | requiresInstall: ${needsInstall}`,
            );
            toolContent = JSON.stringify({
              success: true,
              orderable: true,
              address,
              locationId: locId,
              serviceabilityStatus,
              serviceabilityClass,
              primaryAccessTechnology,
              serviceType,
              requiresInstall: needsInstall,
              readinessDescription,
              notes: marsNotes,
              availablePlans: availablePlans.map((p) => ({
                title: p.title,
                price: parseFloat(p.price),
                download: `${Math.round(p.speed_download / 1000)} Mbps`,
                upload: `${Math.round(p.speed_upload / 1000)} Mbps`,
              })),
              mars: {
                candidates: marsCandidates,
                virtutelSpeedsAvailable: virtutelSpeeds,
                serviceType,
                supportingTechnology:
                  marsSq?.siteRestriction?.supportingTechnology || null,
              },
            });
          }
        } catch (err) {
          console.error("check_address_availability (NBN) error:", err.message);
          toolContent = JSON.stringify({
            success: false,
            error: err.message,
            address,
          });
        }
      }
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
      const isSupportTicket = !!fixedArgs?.customer_id;
      let ticketId = null;
      let referenceText = "Pending";
      if (isSupportTicket) {
        const urlEncoded = objectToUrlEncoded(fixedArgs);
        console.log(
          "Creating support ticket with args:",
          JSON.stringify(fixedArgs),
        );
        const response = await splynx.request(
          "POST",
          "admin/support/tickets",
          urlEncoded,
        );
        ticketId = response.id;
        referenceText = `Ticket #${ticketId}`;
      } else {
        console.log("Sales enquiry received — no Splynx ticket created.");
      }
      toolContent = JSON.stringify({
        success: true,
        ticket_id: ticketId,
        is_support_ticket: isSupportTicket,
        reference: referenceText,
      });
      await sendTicketEmail(
        ticketId,
        fixedArgs,
        session.collected,
        isSupportTicket,
      );
    } catch (err) {
      console.error(
        "Create ticket handler failed with args:",
        JSON.stringify(args),
        "error:",
        err,
      );
      toolContent = JSON.stringify({
        success: false,
        error: err.message || "Failed to process ticket/enquiry",
      });
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
      const groups = await splynx.request(
        "GET",
        "admin/support/tickets-groups",
      );
      toolContent = JSON.stringify({ success: true, groups });
    } catch (err) {
      toolContent = JSON.stringify({ success: false, error: err.message });
    }
  } else if (funcName === "get_ticket_statuses") {
    try {
      const statuses = await splynx.request(
        "GET",
        "admin/support/tickets-statuses",
      );
      toolContent = JSON.stringify({ success: true, statuses });
    } catch (err) {
      toolContent = JSON.stringify({ success: false, error: err.message });
    }
  }
  return toolContent;
}
// ==================== SHARED CHAT PROCESSING ====================
async function processChat(session, userMessage) {
  session.messages.push({ role: "user", content: userMessage });
  const firstCompletion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: session.messages,
    functions: tools,
    function_call: "auto",
    temperature: 0.0,
    max_tokens: 300,
  });
  const firstMsg = firstCompletion.choices?.[0]?.message;
  let assistantText = null;
  if (firstMsg?.function_call) {
    const funcName = firstMsg.function_call.name;
    const args = safeParseJSON(firstMsg.function_call.arguments) || {};
    session.messages.push(firstMsg);
    const toolContent = await handleToolCall(funcName, args, session);
    session.messages.push({
      role: "function",
      name: funcName,
      content: toolContent,
    });
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
    assistantText =
      finalResp.choices?.[0]?.message?.content?.trim() ||
      "Thanks — I have your details.";
    session.messages.push({ role: "assistant", content: assistantText });
  } else if (firstMsg?.content) {
    assistantText = firstMsg.content;
    session.messages.push({ role: "assistant", content: assistantText });
  }
  session.lastSeen = new Date().toISOString();
  sessions.set(session.id, session);
  return assistantText;
}
// ==================== AGENT ENDPOINTS ====================
app.post("/api/chat/init", async (req, res) => {
  try {
    const session = mkSession();
    const greeting = `Hi there! Welcome to InfiNET Broadband. Could you please share your name to get started?`;
    session.messages.push({ role: "assistant", content: greeting });
    sessions.set(session.id, session);
    return res.json({ sessionId: session.id, text: greeting });
  } catch (err) {
    console.error("chat init err", err);
    return res.status(500).json({ error: err?.message || "server error" });
  }
});
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
    console.error("voice-chat init err", err);
    return res.status(500).json({ error: err?.message || "server error" });
  }
});
app.post("/api/voice", upload.single("audio"), async (req, res) => {
  const incomingSessionId =
    (req.body && req.body.sessionId) ||
    req.query.sessionId ||
    req.headers["x-session-id"] ||
    null;
  if (!req.file)
    return res
      .status(400)
      .json({ error: "Missing audio file (multipart field 'audio')" });
  const uploadedPath = path.resolve(req.file.path);
  let convertedPath = null;
  try {
    const session =
      incomingSessionId && sessions.has(incomingSessionId)
        ? sessions.get(incomingSessionId)
        : mkSession(incomingSessionId);
    const origName = (req.file.originalname || "").toLowerCase();
    const mimetype = (req.file.mimetype || "").toLowerCase();
    const looksLikeWav =
      origName.endsWith(".wav") ||
      mimetype === "audio/wav" ||
      mimetype === "audio/wave" ||
      mimetype === "audio/x-wav";
    if (looksLikeWav) {
      convertedPath = uploadedPath;
    } else {
      convertedPath = await convertToWav(uploadedPath);
    }
    const transcriptionResp = await openai.audio.transcriptions.create({
      file: fs.createReadStream(convertedPath),
      model: "gpt-4o-mini-transcribe",
    });
    const userTextRaw = normalizeText(transcriptionResp?.text || "");
    if (!userTextRaw) {
      const prompt =
        "Sorry, I didn't catch that — could you please repeat briefly?";
      const ttsBuf = await makeTTS(prompt);
      session.lastSeen = new Date().toISOString();
      sessions.set(session.id, session);
      return res.json({
        sessionId: session.id,
        text: prompt,
        audioBase64: ttsBuf ? ttsBuf.toString("base64") : null,
      });
    }
    const assistantText = await processChat(session, userTextRaw);
    const ttsBuf = await makeTTS(assistantText);
    return res.json({
      sessionId: session.id,
      text: assistantText,
      audioBase64: ttsBuf ? ttsBuf.toString("base64") : null,
    });
  } catch (err) {
    console.error("voice error:", err);
    return res.status(500).json({ error: err?.message || "server error" });
  } finally {
    try {
      if (uploadedPath && fs.existsSync(uploadedPath))
        fs.unlinkSync(uploadedPath);
    } catch (_) { }
    try {
      if (
        convertedPath &&
        convertedPath !== uploadedPath &&
        fs.existsSync(convertedPath)
      )
        fs.unlinkSync(convertedPath);
    } catch (_) { }
  }
});
app.post("/api/chat/message", async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!message) return res.status(400).json({ error: "Missing message" });
    const session =
      sessionId && sessions.has(sessionId)
        ? sessions.get(sessionId)
        : mkSession(sessionId);
    const assistantText = await processChat(session, message);
    return res.json({
      sessionId: session.id,
      text: assistantText,
      collected: session.collected,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || "server error" });
  }
});
// ==================== HEALTH CHECK ====================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    splynx: {
      hasToken: !!splynx.accessToken,
      tokenExpires: splynx.accessTokenExpiration
        ? new Date(splynx.accessTokenExpiration * 1000).toISOString()
        : null,
    },
  });
});
// ==================== FULL SPLYNX PROXY ROUTES ====================
app.get("/api/customers", async (req, res) => {
  try {
    res.json(
      await splynx.request("GET", "admin/customers/customer", null, {
        limit: 10,
        offset: 0,
      }),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customers", details: err });
  }
});
app.post("/api/customers", async (req, res) => {
  try {
    res
      .status(201)
      .json(await splynx.request("POST", "admin/customers/customer", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to create customer" });
  }
});
app.get("/api/customer/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request("GET", `admin/customers/customer/${req.params.id}`),
    );
  } catch (err) {
    res.status(500).json({ error: "Customer not found" });
  }
});
app.put("/api/customer/:id", async (req, res) => {
  try {
    res
      .status(202)
      .json(
        await splynx.request(
          "PUT",
          `admin/customers/customer/${req.params.id}`,
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to update customer" });
  }
});
app.delete("/api/customer/:id", async (req, res) => {
  try {
    await splynx.request("DELETE", `admin/customers/customer/${req.params.id}`);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete customer" });
  }
});
app.get("/api/customer/:customer_id/logs-changes", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customer/${req.params.customer_id}/logs-changes`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer logs changes" });
  }
});
app.get(
  "/api/customer/:customer_id/logs-changes--first-activation",
  async (req, res) => {
    try {
      res.json(
        await splynx.request(
          "GET",
          `admin/customers/customer/${req.params.customer_id}/logs-changes--first-activation`,
        ),
      );
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to fetch customer first activation" });
    }
  },
);
app.get(
  "/api/customer/:customer_id/logs-changes--last-activation",
  async (req, res) => {
    try {
      res.json(
        await splynx.request(
          "GET",
          `admin/customers/customer/${req.params.customer_id}/logs-changes--last-activation`,
        ),
      );
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to fetch customer last activation" });
    }
  },
);
app.get("/api/customer-cap/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customer-cap/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer cap" });
  }
});
app.put("/api/customer-cap/:id", async (req, res) => {
  try {
    res
      .status(202)
      .json(
        await splynx.request(
          "PUT",
          `admin/customers/customer-cap/${req.params.id}`,
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to update customer cap" });
  }
});
app.get("/api/customer-bonus-traffic-counter", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/customers/customer-bonus-traffic-counter",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bonus traffic counters" });
  }
});
app.post("/api/customer-bonus-traffic-counter", async (req, res) => {
  try {
    res
      .status(201)
      .json(
        await splynx.request(
          "POST",
          "admin/customers/customer-bonus-traffic-counter",
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to create bonus traffic counter" });
  }
});
app.get(
  "/api/customer-bonus-traffic-counter/:service_id--:date",
  async (req, res) => {
    try {
      res.json(
        await splynx.request(
          "GET",
          `admin/customers/customer-bonus-traffic-counter/${req.params.service_id}--${req.params.date}`,
        ),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch bonus traffic counter" });
    }
  },
);
app.put(
  "/api/customer-bonus-traffic-counter/:service_id--:date",
  async (req, res) => {
    try {
      res
        .status(202)
        .json(
          await splynx.request(
            "PUT",
            `admin/customers/customer-bonus-traffic-counter/${req.params.service_id}--${req.params.date}`,
            req.body,
          ),
        );
    } catch (err) {
      res.status(500).json({ error: "Failed to update bonus traffic counter" });
    }
  },
);
app.delete(
  "/api/customer-bonus-traffic-counter/:service_id--:date",
  async (req, res) => {
    try {
      await splynx.request(
        "DELETE",
        `admin/customers/customer-bonus-traffic-counter/${req.params.service_id}--${req.params.date}`,
      );
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to delete bonus traffic counter" });
    }
  },
);
app.get("/api/customer-billing-info/:customer_id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/billing-info/${req.params.customer_id}`,
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer billing info" });
  }
});
app.get("/api/customer-payment-accounts", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/customers/customer-payment-accounts",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch customer payment accounts" });
  }
});
app.get("/api/customer-payment-account-data", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/customers/customer-payment-account-data",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch customer payment account data" });
  }
});
app.get("/api/customer-payment-accounts-by-id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/customers/customer-payment-accounts",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch customer payment accounts by id" });
  }
});
app.put("/api/customer-payment-accounts-by-id", async (req, res) => {
  try {
    res
      .status(202)
      .json(
        await splynx.request(
          "PUT",
          "admin/customers/customer-payment-accounts",
          req.body,
          req.query,
        ),
      );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to update customer payment account" });
  }
});
app.delete("/api/customer-payment-accounts-by-id", async (req, res) => {
  try {
    await splynx.request(
      "DELETE",
      "admin/customers/customer-payment-accounts",
      null,
      req.query,
    );
    res.status(204).send();
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to delete customer payment account" });
  }
});
app.get("/api/customer-statistics", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/customers/customer-statistics",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer statistics" });
  }
});
app.get("/api/customer-statistics/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customer-statistics/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer statistic" });
  }
});
app.get("/api/customer-traffic-counter", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/customers/customer-traffic-counter",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch customer traffic counters" });
  }
});
app.post("/api/customer-traffic-counter", async (req, res) => {
  try {
    res
      .status(201)
      .json(
        await splynx.request(
          "POST",
          "admin/customers/customer-traffic-counter",
          req.body,
        ),
      );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to create customer traffic counter" });
  }
});
app.get(
  "/api/customer-traffic-counter/:service_id--:date",
  async (req, res) => {
    try {
      res.json(
        await splynx.request(
          "GET",
          `admin/customers/customer-traffic-counter/${req.params.service_id}--${req.params.date}`,
        ),
      );
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to fetch customer traffic counter" });
    }
  },
);
app.put(
  "/api/customer-traffic-counter/:service_id--:date",
  async (req, res) => {
    try {
      res
        .status(202)
        .json(
          await splynx.request(
            "PUT",
            `admin/customers/customer-traffic-counter/${req.params.service_id}--${req.params.date}`,
            req.body,
          ),
        );
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to update customer traffic counter" });
    }
  },
);
app.delete(
  "/api/customer-traffic-counter/:service_id--:date",
  async (req, res) => {
    try {
      await splynx.request(
        "DELETE",
        `admin/customers/customer-traffic-counter/${req.params.service_id}--${req.params.date}`,
      );
      res.status(204).send();
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to delete customer traffic counter" });
    }
  },
);
app.get("/api/customer-billing/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customer-billing/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer billing" });
  }
});
app.put("/api/customer-billing/:id", async (req, res) => {
  try {
    res
      .status(202)
      .json(
        await splynx.request(
          "PUT",
          `admin/customers/customer-billing/${req.params.id}`,
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to update customer billing" });
  }
});
app.get("/api/customers-search", async (req, res) => {
  try {
    res.json(
      await splynx.request("GET", "admin/customers/customer", null, req.query),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to search customers" });
  }
});
app.get("/api/online", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/customers/customers-online"));
  } catch (err) {
    res.status(500).json({ error: "Failed to get online customers" });
  }
});
app.post("/api/online", async (req, res) => {
  try {
    res
      .status(201)
      .json(
        await splynx.request(
          "POST",
          "admin/customers/customers-online",
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to set customer online" });
  }
});
app.get("/api/online/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customers-online/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch online customer" });
  }
});
app.put("/api/online/:id", async (req, res) => {
  try {
    res
      .status(202)
      .json(
        await splynx.request(
          "PUT",
          `admin/customers/customers-online/${req.params.id}`,
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to update online customer" });
  }
});
app.delete("/api/online/:id", async (req, res) => {
  try {
    await splynx.request(
      "DELETE",
      `admin/customers/customers-online/${req.params.id}`,
    );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to remove online customer" });
  }
});
app.put("/api/online/:id/kill", async (req, res) => {
  try {
    res
      .status(202)
      .json(
        await splynx.request(
          "PUT",
          `admin/customers/customers-online/${req.params.id}--kill`,
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to disconnect online customer" });
  }
});
app.get("/api/customer-documents/:customer_id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customer-documents/${req.params.customer_id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer documents" });
  }
});
app.post("/api/customer-documents", async (req, res) => {
  try {
    res
      .status(201)
      .json(
        await splynx.request(
          "POST",
          "admin/customers/customer-documents",
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to create customer document" });
  }
});
app.post(
  "/api/customer-documents/:id/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      const formData = new FormData();
      formData.append("file", fs.createReadStream(req.file.path));
      const response = await splynx.request(
        "POST",
        `admin/customers/customer-documents/${req.params.id}--upload`,
        formData,
      );
      res.status(202).json(response);
    } catch (err) {
      res.status(500).json({ error: "Failed to upload customer document" });
    } finally {
      if (req.file && req.file.path) fs.unlinkSync(req.file.path);
    }
  },
);
app.put("/api/customer-documents/:id", async (req, res) => {
  try {
    res
      .status(202)
      .json(
        await splynx.request(
          "PUT",
          `admin/customers/customer-documents/${req.params.id}`,
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to update customer document" });
  }
});
app.delete("/api/customer-documents/:id", async (req, res) => {
  try {
    await splynx.request(
      "DELETE",
      `admin/customers/customer-documents/${req.params.id}`,
    );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete customer document" });
  }
});
app.get("/api/download/customer_documents/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/config/download/customer_documents--${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to download customer document" });
  }
});
app.post("/api/send-documents", async (req, res) => {
  try {
    res
      .status(201)
      .json(
        await splynx.request(
          "POST",
          "admin/customers/send-documents",
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to send documents" });
  }
});
app.get("/api/cap-history/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/cap-history/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch cap history" });
  }
});
app.post("/api/customer-notes", async (req, res) => {
  try {
    res
      .status(201)
      .json(
        await splynx.request(
          "POST",
          "admin/customers/customer-notes",
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to create customer comment" });
  }
});
app.get("/api/customer-notes", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/customers/customer-notes",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer comments" });
  }
});
app.get("/api/customer-notes/:customer_id--:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customer-notes/${req.params.customer_id}--${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer comment" });
  }
});
app.get("/api/customer/:customer_id/internet-services", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customer/${req.params.customer_id}/internet-services`,
        null,
        req.query,
      ),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch customer internet services" });
  }
});
app.get(
  "/api/customer/:customer_id/internet-services--:service_id",
  async (req, res) => {
    try {
      res.json(
        await splynx.request(
          "GET",
          `admin/customers/customer/${req.params.customer_id}/internet-services--${req.params.service_id}`,
        ),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch internet service" });
    }
  },
);
app.get(
  "/api/customer/:customer_id/geo-internet-service--:service_id",
  async (req, res) => {
    try {
      res.json(
        await splynx.request(
          "GET",
          `admin/customers/customer/${req.params.customer_id}/geo-internet-service--${req.params.service_id}`,
        ),
      );
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to fetch internet service geo data" });
    }
  },
);
app.get(
  "/api/customer/:customer_id/geo-voice-service--:service_id",
  async (req, res) => {
    try {
      res.json(
        await splynx.request(
          "GET",
          `admin/customers/customer/${req.params.customer_id}/geo-voice-service--${req.params.service_id}`,
        ),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch voice service geo data" });
    }
  },
);
app.get(
  "/api/customer/:customer_id/geo-recurring-service--:service_id",
  async (req, res) => {
    try {
      res.json(
        await splynx.request(
          "GET",
          `admin/customers/customer/${req.params.customer_id}/geo-recurring-service--${req.params.service_id}`,
        ),
      );
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to fetch recurring service geo data" });
    }
  },
);
app.get("/api/customer/:customer_id/voice-services", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customer/${req.params.customer_id}/voice-services`,
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer voice services" });
  }
});
app.get(
  "/api/customer/:customer_id/voice-services--:service_id",
  async (req, res) => {
    try {
      res.json(
        await splynx.request(
          "GET",
          `admin/customers/customer/${req.params.customer_id}/voice-services--${req.params.service_id}`,
        ),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch voice service" });
    }
  },
);
app.get("/api/customer/:customer_id/recurring-services", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customer/${req.params.customer_id}/recurring-services`,
        null,
        req.query,
      ),
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch customer recurring services" });
  }
});
app.get(
  "/api/customer/:customer_id/recurring-services--:service_id",
  async (req, res) => {
    try {
      res.json(
        await splynx.request(
          "GET",
          `admin/customers/customer/${req.params.customer_id}/recurring-services--${req.params.service_id}`,
        ),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch recurring service" });
    }
  },
);
app.get("/api/customer/:customer_id/bundle-services", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customer/${req.params.customer_id}/bundle-services`,
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer bundle services" });
  }
});
app.get(
  "/api/customer/:customer_id/bundle-services--:service_id",
  async (req, res) => {
    try {
      res.json(
        await splynx.request(
          "GET",
          `admin/customers/customer/${req.params.customer_id}/bundle-services--${req.params.service_id}`,
        ),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch bundle service" });
    }
  },
);
app.get("/api/customer-tariffs/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/customers/customer-tariffs/${req.params.id}`,
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer tariffs" });
  }
});
app.get("/api/portal/services/start/:service_id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `portal/services/start/${req.params.service_id}`,
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to start service" });
  }
});
app.get("/api/portal/services/stop/:service_id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `portal/services/stop/${req.params.service_id}`,
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to stop service" });
  }
});
app.get("/api/traffic/:serviceId", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/fup/usage/${req.params.serviceId}?with_texts=true`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to get traffic usage" });
  }
});
app.get("/api/tariffs/internet", async (req, res) => {
  try {
    res.json(await splynx.listInternetTariffs(req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to list internet tariffs" });
  }
});
app.get("/api/tariffs/internet/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request("GET", `admin/tariffs/internet/${req.params.id}`),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to get tariff" });
  }
});
app.get("/api/locations", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/administration/locations",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list locations" });
  }
});
app.get("/api/locations/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/administration/locations/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Location not found" });
  }
});
app.get("/api/administrators", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/administration/administrators",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list administrators" });
  }
});
app.get("/api/administrators/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/administration/administrators/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Admin not found" });
  }
});
app.get("/api/partners", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/administration/partners",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list partners" });
  }
});
app.get("/api/partners/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/administration/partners/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Partner not found" });
  }
});
// Tickets APIs
app.post("/api/admin/support/tickets", async (req, res) => {
  try {
    res
      .status(201)
      .json(await splynx.request("POST", "admin/support/tickets", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to create ticket" });
  }
});
app.get("/api/admin/support/tickets", async (req, res) => {
  try {
    res.json(
      await splynx.request("GET", "admin/support/tickets", null, req.query),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list tickets" });
  }
});
app.get("/api/admin/support/tickets/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request("GET", `admin/support/tickets/${req.params.id}`),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket" });
  }
});
app.put("/api/admin/support/tickets/:id", async (req, res) => {
  try {
    res
      .status(202)
      .json(
        await splynx.request(
          "PUT",
          `admin/support/tickets/${req.params.id}`,
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to update ticket" });
  }
});
app.delete("/api/admin/support/tickets/:id", async (req, res) => {
  try {
    await splynx.request("DELETE", `admin/support/tickets/${req.params.id}`);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});
app.post("/api/admin/support/ticket-messages", async (req, res) => {
  try {
    res
      .status(201)
      .json(
        await splynx.request("POST", "admin/support/ticket-messages", req.body),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to create ticket message" });
  }
});
app.get("/api/admin/support/ticket-messages", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/support/ticket-messages",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket messages" });
  }
});
app.get("/api/admin/support/ticket-messages/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/support/ticket-messages/${req.params.id}`,
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket message" });
  }
});
app.put("/api/admin/support/ticket-messages/:id", async (req, res) => {
  try {
    res
      .status(202)
      .json(
        await splynx.request(
          "PUT",
          `admin/support/ticket-messages/${req.params.id}`,
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to update ticket message" });
  }
});
app.delete("/api/admin/support/ticket-messages/:id", async (req, res) => {
  try {
    await splynx.request(
      "DELETE",
      `admin/support/ticket-messages/${req.params.id}`,
    );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete ticket message" });
  }
});
app.get("/api/admin/support/tickets-statuses", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/support/tickets-statuses",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket statuses" });
  }
});
app.get("/api/admin/support/tickets-statuses/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/support/tickets-statuses/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket status" });
  }
});
app.get("/api/admin/support/tickets-groups", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/support/tickets-groups",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket groups" });
  }
});
app.get("/api/admin/support/tickets-groups/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/support/tickets-groups/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket group" });
  }
});
app.get("/api/admin/support/tickets-types", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/support/tickets-types",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket types" });
  }
});
app.get("/api/admin/support/tickets-types/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/support/tickets-types/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket type" });
  }
});
app.get("/api/admin/support/ticket-attachments", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/support/ticket-attachments",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket attachments" });
  }
});
app.get("/api/admin/support/ticket-attachments/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/support/ticket-attachments/${req.params.id}`,
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket attachment" });
  }
});
app.post("/api/admin/support/ticket-attachments", async (req, res) => {
  try {
    res
      .status(201)
      .json(
        await splynx.request(
          "POST",
          "admin/support/ticket-attachments",
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to create ticket attachment" });
  }
});
app.delete("/api/admin/support/ticket-attachments/:id", async (req, res) => {
  try {
    await splynx.request(
      "DELETE",
      `admin/support/ticket-attachments/${req.params.id}`,
    );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete ticket attachment" });
  }
});
app.get("/api/admin/support/ticket-feedbacks", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        "admin/support/ticket-feedbacks",
        null,
        req.query,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket feedbacks" });
  }
});
app.post("/api/admin/support/ticket-feedbacks", async (req, res) => {
  try {
    res
      .status(201)
      .json(
        await splynx.request(
          "POST",
          "admin/support/ticket-feedbacks",
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to create ticket feedbacks" });
  }
});
app.get("/api/admin/support/ticket-feedbacks/:id", async (req, res) => {
  try {
    res.json(
      await splynx.request(
        "GET",
        `admin/support/ticket-feedbacks/${req.params.id}`,
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket feedback" });
  }
});
app.put("/api/admin/support/ticket-feedbacks/:id", async (req, res) => {
  try {
    res
      .status(202)
      .json(
        await splynx.request(
          "PUT",
          `admin/support/ticket-feedbacks/${req.params.id}`,
          req.body,
        ),
      );
  } catch (err) {
    res.status(500).json({ error: "Failed to update ticket feedback" });
  }
});
app.delete("/api/admin/support/ticket-feedbacks/:id", async (req, res) => {
  try {
    await splynx.request(
      "DELETE",
      `admin/support/ticket-feedbacks/${req.params.id}`,
    );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete ticket feedback" });
  }
});
// Catch-all Splynx proxy
app.all(/^\/api\/.*/, async (req, res) => {
  try {
    let endpoint = req.path.replace(/^\/api\//, "");
    if (!endpoint)
      return res.status(400).json({ error: "Missing endpoint after /api/" });
    const data = await splynx.request(
      req.method,
      endpoint,
      req.method !== "GET" && req.method !== "HEAD" ? req.body : null,
      req.query,
    );
    if (req.method === "DELETE") {
      res.status(204).send();
    } else {
      res.json(data);
    }
  } catch (err) {
    const status = err?.response?.status || 500;
    res.status(status).json({
      error: "Splynx proxy error",
      message: err.message || "Request failed",
      details: err,
    });
  }
});
app.listen(PORT, () => {
  console.log(
    `✅ InfiNET Agent + Full Splynx Integration + SparkPost Email running on http://localhost:${PORT}`,
  );
  console.log(` • Services shown = ACTIVE ONLY`);
  console.log(` • OptiComm plans = HARDCODED (no MARS API call)`);
  console.log(` • NBN plans filtered by MARS virtutelSpeedsAvailable + serviceType`);
  console.log(` • Non-orderable addresses (Rejected) blocked with reason`);
  console.log(` • Fixed Wireless speed codes updated: TC4FWP=25/5, TC4FWHF=100/20, TC4FWSF=200/20, TC4FWUF=400/40`);
  console.log(` • Satellite/Wireless plans keyword-filtered`);
  console.log(` • Install requirements surfaced per service class`);
  console.log(` • Human-readable readiness descriptions per class`);
  console.log(` • KB updated: NBN 750/50=$89→$99, 1000/100=$99→$109 ongoing; FW speeds corrected; HIR plans updated`);
});