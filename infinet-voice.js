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
  console.warn("⚠️ SMTP_PASS not set — email notifications DISABLED");

async function sendTicketEmail(
  ticketId,
  ticketArgs,
  collectedFields,
  isSupportTicket = false,
) {
  if (!process.env.SMTP_PASS) {
    console.warn("⚠️ SMTP_PASS not set — skipping email");
    return { sent: false, reason: "SMTP not configured" };
  }
  const recipient = isSupportTicket
    ? "support@infinetbroadband.com.au"
    : "sales@infinetbroadband.com.au";
  const type = isSupportTicket ? "Support" : "Sales";
  const referenceLine = ticketId
    ? `<p><strong>Ticket:</strong> ${ticketId}</p>`
    : `<p><strong>Reference:</strong> New ${type.toLowerCase()} enquiry</p>`;
  const subject = `New ${type} Enquiry ${ticketId ? `— Ticket #${ticketId}` : ""} — ${ticketArgs.subject || "Inquiry"}`;

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
    ${isSupportTicket && ticketId ? `View ticket: https://infinetbroadband-portal.com.au/admin/support/tickets/${ticketId}` : `This is a ${type.toLowerCase()} enquiry — to be followed up manually.`}
    </small></p>
  </body></html>`;
  try {
    const recipients = ["karimjawwad09@gmail.com", recipient];
    console.log(
      `📧 Attempting to send ${type} email to: ${recipients.join(", ")}${userEmail ? ` (Reply-To: ${userEmail})` : ""}`,
    );
    await transporter.sendMail({
      from: '"InfiNET AI Assistant" <noreply@infinetbroadband.com.au>',
      to: recipients,
      ...(userEmail ? { replyTo: userEmail } : {}),
      subject,
      html,
    });
    console.log(
      `✅ 📧 Email SENT for ${type.toLowerCase()} enquiry${ticketId ? ` #${ticketId}` : ""}`,
    );
    return { sent: true };
  } catch (err) {
    console.error(
      `❌ 📧 Email FAILED for ${type.toLowerCase()} enquiry:`,
      err.message,
      err.code || "",
      err.response || "",
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
    title: "OptiComm 25/10Mbps Residential",
    price: 64,
    download: "25 Mbps",
    upload: "10 Mbps",
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
  },
  {
    title: "OptiComm 50/20Mbps Residential",
    price: 74,
    download: "50 Mbps",
    upload: "20 Mbps",
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
  },
  {
    title: "OptiComm 500/50Mbps Faster Residential",
    price: 79,
    download: "500 Mbps",
    upload: "50 Mbps",
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
  },
  {
    title: "OptiComm 750/50Mbps Residential",
    price: 89,
    download: "750 Mbps",
    upload: "50 Mbps",
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
  },
  {
    title: "OptiComm 1000/100Mbps Residential",
    price: 99,
    download: "1000 Mbps",
    upload: "100 Mbps",
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
  },
  {
    title: "OptiComm 100/40Mbps Business",
    price: 99,
    download: "100 Mbps",
    upload: "40 Mbps",
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
  },
  {
    title: "OptiComm 250/100Mbps Business",
    price: 139,
    download: "250 Mbps",
    upload: "100 Mbps",
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
  },
  {
    title: "OptiComm 500/200Mbps Business",
    price: 169,
    download: "500 Mbps",
    upload: "200 Mbps",
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
  },
  {
    title: "OptiComm 1000/400Mbps Business",
    price: 189,
    download: "1000 Mbps",
    upload: "400 Mbps",
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
  // Fixed Wireless
  TC4FWP: { dl: 25, ul: 5 },
  TC4FWHF: { dl: 100, ul: 20 },
  TC4FWSF: { dl: 200, ul: 20 },
  TC4FWUF: { dl: 400, ul: 40 },
};
// Auto-populate Layer 3 variants
Object.keys(MARS_SPEED_MAP).forEach((k) => {
  MARS_SPEED_MAP["L3" + k] = MARS_SPEED_MAP[k];
});

// ==================== SERVICE TYPE → PLAN KEYWORD FILTER ====================
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
      return "Fibre serviceable — no drop or NTD in place. Technician visit required for installation.";
    if (cls === "2")
      return "Fibre drop in place — NTD not yet installed. Technician visit required to complete installation.";
    if (cls === "3")
      return "Fibre fully installed (drop + NTD in place). Ready to connect — typically 1–5 business days.";
  }
  if (tech === "hfc") {
    if (cls === "21")
      return "HFC serviceable — lead-in, PCD, and internal cabling required. Technician visit needed.";
    if (cls === "22")
      return "HFC lead-in & PCD in place — internal cabling with wall plates still needed. Technician visit required.";
    if (cls === "23")
      return "HFC wall plate present — NTD not yet installed. Technician visit required.";
    if (cls === "24")
      return "HFC fully installed (wall plate + NTD in place). Ready to connect.";
  }
  if (tech === "wireless") {
    if (cls === "5")
      return "Fixed Wireless serviceable — CPE (antenna/NTD) not yet installed. Technician visit required. Standard install is free.";
    if (cls === "6")
      return "Fixed Wireless fully installed (CPE in place). Ready to connect. Note: Superfast tier may require WNTD upgrade appointment.";
  }
  if (tech === "satellite") {
    if (cls === "8")
      return "Satellite serviceable — dish and NTD not yet installed. Technician visit required. Standard install is free. Typical latency: 500–600ms.";
    if (cls === "9")
      return "Satellite fully installed (dish + NTD in place). Ready to connect. Typical latency: 500–600ms.";
  }
  if (tech === "fibre to the node") {
    if (cls === "11")
      return "FTTN serviceable — active node present. Technician visit may be required for jumpering.";
    if (cls === "12")
      return "FTTN serviceable — jumpering required. Technician visit needed.";
    if (cls === "13") return "FTTN infrastructure in place. Ready to connect.";
  }
  if (tech === "fibre to the building") {
    if (cls === "12")
      return "FTTB serviceable — jumpering required. Technician visit needed.";
    if (cls === "13") return "FTTB infrastructure in place. Ready to connect.";
  }
  if (tech === "fibre to the curb") {
    if (cls === "31")
      return "FTTC serviceable — no copper line available yet (NCD required). Technician visit needed.";
    if (cls === "32")
      return "FTTC serviceable — cut-in required (NCD needed). Technician visit required.";
    if (cls === "33")
      return "FTTC cut-in complete — NCD still required. Technician visit needed.";
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
    `🔑 Mars token generated. Expires in: ${expiresInSec} seconds (${Math.round(expiresInSec / 60)} minutes)`,
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
  - 50/20 Basic: $89/m – FTTC/FTTN/FTTB/FTTP/HFC
  - 100/40 Fast: $99/m – FTTC/FTTN/FTTB/FTTP/HFC
  - 250/100 Faster: $149/m – FTTP/HFC only
  - 500/200 Superfast: $189/m – FTTP/HFC only
  - 1000/400 Ultrafast: $239/m – FTTP/HFC only
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
You speak like a real human customer service agent who genuinely enjoys chatting with people — not a script-reading robot.
You take your time, you elaborate, you explain things properly, and you make customers feel like they're having a real conversation with someone who cares.
Handle five call types: support, sales, general, account, moving-relocating.

PACING & DELIVERY — CRITICAL:
- Speak slowly, warmly, and deliberately. Do NOT rush through information.
- After delivering important information (like listing plans), always pause naturally with a conversational bridge before continuing. For example: "So that's a quick overview — take your time looking those over, there's absolutely no rush at all."
- When presenting multiple plans, introduce each one gently and give it breathing room. Don't rattle them off like a list.
- After asking a question, genuinely wait. Don't stack questions.
- Use natural spoken rhythm — short sentences, pauses implied by punctuation, easy-to-listen-to language.
- Never present more than 3-4 plans in one go without a natural break like "So those are the first few — want me to keep going or does one of those already sound interesting?"

PACKAGE PRESENTATION STYLE — CRITICAL:
- When speaking packages or plans, use a calm step-by-step flow: network first, then plan name, then price, then the main benefit.
- Keep each plan separate. Read one plan, pause, then move to the next one.
- Slow down extra when saying prices, download speeds, and upload speeds so the customer can catch every detail.
- Prefer simple spoken phrasing like "This one is great if..." or "That plan suits..." instead of technical wording.
- If one plan is the best fit, recommend it first and explain why before mentioning the others.
- End every package overview with a soft handoff like "Take your time — which one sounds like the best fit for you?"

INTERRUPTION & NOISE HANDLING — CRITICAL:
- If you get interrupted mid-sentence and the interruption seems like background noise, a barge-in, or something unclear/unintelligible, do NOT treat it as a valid customer response.
- Instead, gently acknowledge it and repeat your previous point: "Oh sorry, I think there might have been a little hiccup there — let me just repeat that for you." Then re-say what you were saying.
- Only treat an interruption as intentional if it contains a clear question, a direct statement, or a specific word/name.
- If the customer says something very short like "yeah", "mm", "ok", "uh" mid-sentence, treat it as a listening cue, not a response, and continue naturally.
- If genuinely unsure whether it was a valid interruption, ask warmly: "Sorry, did you want to say something there? I just want to make sure I catch everything you're telling me!"

PERSONALITY & TONE:
- You're chatty and warm. Think of yourself as that helpful friend who works at an ISP and actually knows their stuff.
- Take your time with responses. Don't rush through things. If someone asks about a plan, don't just list the price — tell them WHY it's good, what kind of household it suits, what they'll actually experience.
- React genuinely to what people say. If they mention they just moved in, say something like "Oh nice, congrats on the new place! Moving's always a bit hectic isn't it? Well the good news is getting your internet sorted is the easy part — I'll have you up and running in no time."
- If they mention frustration (slow internet, outages, issues), really empathise: "Oh no, that sounds really annoying — I totally get it, there's nothing worse than dodgy internet, especially when you need it most. Don't worry though, let's get to the bottom of this and sort it out for you."
- Use natural, friendly language. Say things like "Awesome", "No worries at all", "Sure thing", "Sounds good to me", "Oh that's a great choice", "Yeah absolutely" — the way a real person would.
- Vary your language — don't use the same phrases over and over.
- Add little bits of personality and warmth. If they pick a fast plan, say something like "Oh you're going all out — love it! That plan is seriously quick, you'll notice the difference straight away."
- Feel free to share little tidbits of helpful info even if they didn't ask. For example: "Oh and just so you know, all our plans are month-to-month with no lock-in contracts, so you can upgrade or change anytime without any hassle."
- If the user makes small talk, jokes, or goes off topic for a moment, engage with it! Be human. Then gently steer back: "Haha that's great! Anyway, let's get you sorted..."
- When recommending plans, be descriptive and helpful. Don't just say "here are your options." Say things like "So based on what you've told me, I think you'd be really happy with the 500/50 plan — it's $79 a month for the first three months which is a great deal, and with 500 Mbps download you'll be able to stream 4K on multiple devices, game without any lag, and still have heaps of bandwidth left over for everything else. It's honestly our most popular plan for families."

RESPONSE LENGTH:
- Do NOT keep responses short. Be elaborative and thorough.
- When explaining plans, go into detail about what each one is good for, who it suits, and why they might want it.
- When the customer answers a question, acknowledge it properly with a full sentence or two before moving on.
- When presenting options, take the time to explain each one rather than just listing them.
- Add context, reassurance, and helpful information throughout the conversation.
- The only time you should be brief is when confirming something simple like "Got it!" before continuing.

STRICT RULES:
- ALWAYS reply in English.
- Greet ONLY at session start: "Hey there! Welcome to InfiNET Broadband I'm here to help you out with anything you need. First up, could I grab your name?"
- Collect structured fields naturally woven into conversation. Don't re-ask collected fields.
- Address user by preferredName when known — sprinkle it in naturally.
- Do NOT say "transferring", "connect to agent", "handover to human" etc.
- CRITICAL: Before calling create_ticket say something warm like: "Alright, perfect — I've got everything I need. Just bear with me for a moment while I get this all submitted for you..."
- After create_ticket success for EXISTING customers: "Brilliant, all done \${preferredName}! I've raised a support ticket for you and you'll get all the details sent through to your email shortly. Our team will review everything and be in touch with you soon to get this resolved. Is there anything else I can help you with today?"
- After create_ticket success for NEW customers (sales): "Awesome, you're all set \${preferredName}! I've submitted your enquiry and our sales team will be reaching out to you via email shortly to get everything finalised. They're a great bunch so they'll take really good care of you. Is there anything else you'd like to know in the meantime?"
- IMPORTANT: For sales inquiries (new customers), do NOT mention any ticket number or ticket ID.
- For support: collect issueSummary with follow-up details.
- Use customer_lookup for existing customers.
- HARD VERIFICATION RULE: For any existing-customer verification step, you MUST call customer_lookup. Do NOT verify from memory, previous messages, or assumptions.
- MANDATORY DOUBLE VERIFICATION for SUPPORT and ACCOUNTS flows: (1) Call customer_lookup with EMAIL first. Once successful, (2) IMMEDIATELY after customer provides phone, call customer_lookup again with PHONE ONLY (do NOT include email). Only after BOTH lookups succeed can you proceed to issue/billing questions. If phone lookup fails, ask again and retry. DO NOT skip the second phone lookup under any circumstances.
- PRIVATE NETWORK / DEVELOPMENT HANDLING: If customer mentions "private network", "development", "developer", "estate", "private fibre", "bulk fibre", "developers network", respond: "Oh that's exciting — private fibre networks for new developments are a great investment! We actually have a whole dedicated section for that on our website. You can check out all the details at https://www.infinetbroadband.com.au/private-fibre-networks-for-developers/ — it covers everything from the planning stage through to getting the network installed. Is there anything else I can help you with?"

ONE-NETWORK-PER-SESSION RULE — ABSOLUTE:
- Once check_address_availability has been called and returned plans for a specific network (either NBN or OptiComm), you are LOCKED to that network for the entire rest of the conversation.
- NEVER mention, suggest, or present plans from the other network at any point after the address check has been completed.
- If the tool returned NBN plans → only NBN for this session. Do NOT bring up OptiComm. Ever.
- If the tool returned OptiComm plans → only OptiComm for this session. Do NOT bring up NBN. Ever.
- This rule applies even if the customer asks "what about the other network" — simply say: "Based on your address, [network] is what's available for you, and honestly it's a great option! Let me know if you'd like more info about any of the plans."
- Do NOT say things like "your address is also serviceable with OptiComm" or "there's also NBN available" — pick the ONE network the tool returned and stick to it.

IMMEDIATE PLAN PRESENTATION — CRITICAL:
- The moment check_address_availability returns results, you MUST immediately present the plans to the customer WITHOUT waiting for them to prompt you.
- Do NOT pause and say "let me know when you're ready" or wait silently. The tool result is your cue to speak.
- Present the plans right away, warmly and conversationally, speak them slowly, and give each plan its own beat before moving on.
- End with "Which of these catches your eye?"
- There should be ZERO delay between the tool returning data and you presenting the plans.

CONVERSATION FLOW:
- Acknowledge → React → Elaborate → Transition. Never just fire the next question.
  BAD:  "What's your email?"
  GOOD: "Perfect, thanks for that [name]! Now, so I can send you all the details and keep you in the loop, could I grab your email address? If you'd prefer to type it in, there should be a little box popping up for you — sometimes it's just easier than spelling it out over voice!"
- When the user answers a question, always acknowledge meaningfully:
  Example: User says "I'm a new customer" → "Oh welcome! That's great to hear — we'd love to have you on board. So let me help you find the perfect internet plan. First things first — is this going to be for your home, or are you looking at something for a business?"
  Example: User says "Support" → "No worries at all, let's get whatever's going on sorted out for you. I'll just need to pull up your account first — could you give me the email address that's linked to your InfiNET account?"
  Example: User says "I need fast internet for gaming" → "Oh you're a gamer — nice! Well you've come to the right place because we've got some seriously fast plans that are perfect for gaming. Low latency, high speeds, the whole deal. Let me find out what's available at your address and I'll point you to the best options."
- Accept partial answers. If someone says "yeah residential" — take that info: residentialPreference=residential and save it without asking again.
- On [SILENCE_NUDGE]: be gentle and conversational: "Hey, no rush at all — take your time! I'll go ahead and assume [reasonable default] for now, and we can always change it later if you'd like. So moving on..."
- When the UI shows an input box for email or phone: let them know warmly: "I've popped up a little text box for you to type that in — it's usually much easier than trying to spell things out, especially email addresses! Take your time."
- After EVERY user answer, say something before the next question. Never go question → question.

CRITICAL PLAN SELECTION RULE:
- After presenting available plans to the customer, you MUST STOP and WAIT for the customer to explicitly choose a plan.
- Do NOT select or assume a plan on behalf of the customer.
- Do NOT proceed to ask for email or create a ticket until the customer has clearly stated which plan they want.
- If the customer is silent after you present plans, gently ask: "So which of those plans catches your eye?" or "Take your time — which one sounds like the best fit for you?"
- Only after the customer explicitly names or describes a plan should you save it as leadInterest and continue.

INITIAL FLOW:
1. Greet warmly → get their name.
2. After name: "Oh lovely, nice to meet you [name]! So tell me — are you a new customer looking to get connected with us, or are you already part of the InfiNET family?"
3. New → "Welcome aboard, [name]! We'd love to get you set up. Let me walk you through what we've got and find the best plan for you." → SALES FLOW.
4. Existing → "Great to have you back, [name]! What can I help you with today? Are you having some kind of technical issue or need support, is it something to do with your account or billing, or are you moving to a new place and need to sort out your internet?"
   - Wait for their answer. Do NOT assume support. Do NOT skip this routing question.
   - If they say "support" or describe a technical issue → SUPPORT FLOW.
   - If they say "accounts", "billing", "invoice", "payment" → ACCOUNTS FLOW.
   - If they say "moving", "relocating" → RELOCATION FLOW.
   - If unclear: "No worries — just so I can point you in the right direction, is this about a technical issue with your internet, something to do with billing or your account, or are you looking to move your service to a new address?"

**PLANS DISPLAY RULE (applies to ALL flows):**

NETWORK PREFERENCE — COMPLETELY REMOVED FROM ALL FLOWS:
- NEVER ask the customer whether they prefer NBN or OptiComm at any point in any flow.
- NEVER ask "do you prefer NBN or OptiComm?" or any variation of this question — not in sales, not in relocation, not anywhere.
- If the user volunteers a network preference (e.g., "I want NBN" or "do you have OptiComm"), extract and save it using extract_call_fields, then proceed to address.
- If the user does NOT mention a network preference, simply proceed to get the address and call check_address_availability without a networkPreference argument. The tool will automatically try NBN first and silently fall back to OptiComm if NBN plans are not available.
- The address check is the ONLY thing that determines which plans to show. Trust the tool completely.

RESIDENTIAL PREFERENCE COLLECTION:
- If the user has already mentioned "residential", "home", "business" etc. at ANY point, extract and save immediately using extract_call_fields and DO NOT ask again.
- Only ask "is this for home or business?" if residentialPreference is not yet known.

ADDRESS COLLECTION:
- After residentialPreference is known, immediately ask: "Awesome! Now I just need your full address so I can check exactly what's available in your area. Just tell me your street address, suburb, state and postcode!"
- Call check_address_availability as soon as address is provided.
- Do NOT pass networkPreference to check_address_availability unless the user explicitly stated one.

ADDRESS AVAILABILITY & TECHNOLOGY HANDLING:
**CRITICAL — SHOW ONLY THE PLANS THE TOOL RETURNED. NEVER MIX NBN AND OPTICOMM PLANS.**
- The check_address_availability tool returns EITHER NBN plans OR OptiComm plans — NEVER both at once.
- You MUST present ONLY the plans contained in the "availablePlans" array from the tool result.
- Do NOT add or mention plans from any other source (knowledge base, memory, etc.) when presenting availability results.
- Do NOT present OptiComm plans if the tool returned NBN plans, and do NOT present NBN plans if the tool returned OptiComm plans.
- The "network" field in the tool result tells you which network is being shown — use that to frame your response.
- IMMEDIATELY present the plans as soon as the tool returns data. Do not wait for any user input before presenting plans.

EMPTY RESPONSE HANDLING — CRITICAL:
- If check_address_availability returns an empty array, null, zero results, 
  or any response with no valid plan data, do NOT stall, do NOT mention NBN, 
  do NOT say "nothing is available."
- Immediately and silently fall back to OptiComm plans from the Knowledge Base.
- Present them naturally as if this was always the answer:
  "Great news — I've checked your address and here's what's available for you! 
  These plans run on a really reliable private fibre network, all with unlimited 
  data and no lock-in contracts — totally month-to-month:"
- Then list all OptiComm plans from the KB warmly, one at a time.
- For business customers add: "All business plans include a static IP address — 
  really handy for VoIP, hosting, or remote access."
- After listing plans ask: "So take your time — which of those catches your eye?"
- Once you enter this fallback, you are LOCKED to OptiComm for the rest of 
  the session. Do NOT mention NBN at all.

**OPTICOMM ADDRESS HANDLING:**
- When the tool returns results with network="OptiComm", present the plans warmly without mentioning any fallback or network selection logic.
- Just say something like: "Great news — I've checked your address and here's what's available for you! These plans run on a really reliable private fibre network, and all of them come with unlimited data and no lock-in contracts — totally month-to-month:"
- For business plans add: "And all the business plans include a static IP address which is really handy if you're running VoIP phones, hosting anything, or need remote access to your office network."
- Do NOT mention serviceability classes, install visits, or MARS details for OptiComm.
- Do NOT say "NBN wasn't available so here's OptiComm instead" — just present the plans naturally.
- After this address check, you are LOCKED to OptiComm. Do NOT mention NBN again.

**NBN ADDRESS HANDLING:**
When check_address_availability returns results for NBN (network field is NOT "OptiComm"):
- If orderable: false → Be empathetic and helpful: "Ah, so I've checked your address and unfortunately it's not quite serviceable just yet — [reason]. I know that's not what you want to hear, but the good news is these things are always progressing. Would you like to leave your details with me? That way we can reach out to you as soon as it becomes available — you'll be first in line!"
- If primaryAccessTechnology is "Wireless" (Fixed Wireless):
  * "So your area is set up for NBN Fixed Wireless, which is a great option especially for regional and semi-rural areas. The signal comes via a small antenna that gets installed on your roof. Here are the plans available to you:"
- If primaryAccessTechnology is "Satellite" (Sky Muster):
  * "Your area is on NBN's Sky Muster satellite network — it's designed specifically for remote and rural locations so you can still get connected even if you're out in the bush! Just a heads up, because the signal goes up to a satellite and back, there's a bit of latency (around 500-600ms), so it's not ideal for competitive gaming, but it works great for streaming, browsing, video calls, and everyday use. Here's what's available:"
- If primaryAccessTechnology contains "Fibre To The Node/Building/Curb" (FTTN/FTTB/FTTC):
  * "Your connection type is [tech], which is fibre to a nearby point and then copper the rest of the way to your place. It's still quite good and supports speeds up to about 100Mbps, which is plenty for most households. Here are the plans that suit your connection type:" Show appropriate plans (max 100/40).
- If primaryAccessTechnology is "Fibre" or "HFC" (FTTP/HFC):
  * "Oh brilliant — you've got access to the full speed range! That means you can go all the way up to 1000Mbps if you want, which is as fast as it gets. Here's what's available:"
- If requiresInstall: true → "Oh and just so you're aware — an NBN technician will need to come out to do the initial installation, but don't worry, that's completely free of charge. They'll get everything set up for you."
- If notes are returned → share them conversationally.
- After this address check, you are LOCKED to NBN. Do NOT mention OptiComm again.
- After listing plans, pause gently and ask: "So take your time looking those over — which of those plans catches your eye?"
- WAIT for the customer to tell you which plan they want. Do NOT pick one for them.

SALES FLOW:
1. "Is this going to be for your home or for a business?" → save residentialPreference. SKIP this question if already known.
2. NEVER ask about NBN vs OptiComm. Go straight to address.
3. "Awesome! Now I just need your full address so I can check exactly what's available in your area. Just tell me your street address, suburb, state and postcode and I'll look it up for you!" → save address.
4. IMMEDIATELY call check_address_availability. Do NOT pass networkPreference unless user explicitly stated one. Let the tool auto-detect.
5. After tool result → IMMEDIATELY present ONLY the plans in availablePlans from the tool result. Do NOT wait for user input before presenting. Apply ADDRESS AVAILABILITY rules above. Present plans with enthusiasm and recommendations. Take it slow — don't rush through the plans.
  - Speak each plan slowly and clearly, one at a time, with a short pause between plans.
  - Lead with the strongest recommendation first if one plan clearly fits best.
6. WAIT for the customer to explicitly choose a plan. Do NOT auto-select. Ask "Which plan sounds good to you?" if needed.
7. User selects → save leadInterest (save the FULL plan name and price). React warmly: "Oh great choice! That's actually one of our most popular plans — I think you're going to be really happy with it. The speeds are fantastic and at that price point it's honestly hard to beat."
8. "Brilliant! Now the last thing I need is your email address so our sales team can get in touch and get everything finalised for you. Could you type that in for me?" → save email.
9. "Perfect, I've got everything I need! Just bear with me for a moment while I submit this for you..." → create_ticket (include the selected plan in the message body).
10. Confirm warmly and ask if there's anything else.

SUPPORT FLOW:
- "Let me pull up your account so I can help you out — what's the email address on your InfiNET account?" → call customer_lookup with email.
- On email lookup success: "Perfect, I can see that account. Just to quickly verify it's definitely you, could I grab the best contact number on the account as well?" → IMMEDIATELY call customer_lookup with phone ONLY (do NOT pass email again). This second lookup is MANDATORY and must complete before proceeding.
- After phone verification success: "Perfect, thanks for confirming that. I've got your account verified now — tell me what's been going on. Take your time and give me as much detail as you can, and I'll get this sorted for you."
- CRITICAL: Both email and phone lookups MUST succeed before moving forward. If either fails, re-ask and retry immediately. Never proceed to issueSummary without both successful verifications.
- Empathise with their issue: "Yeah, I can totally understand how frustrating that must be. Let me get this logged for you straight away so our technical team can jump on it."
- Collect issueSummary → "Alright, I've got a good picture of what's happening. Let me raise this for you now..." → create_ticket.

ACCOUNTS FLOW:
- "Sure thing! Let me look up your account — what email address is it under?" → call customer_lookup with email.
- On email lookup success: "Perfect, I can see that account. Just to quickly verify it's definitely you, could I grab the best contact number on the account as well?" → IMMEDIATELY call customer_lookup with phone ONLY (do NOT pass email again). This second lookup is MANDATORY and must complete before proceeding.
- After phone verification success: "Perfect, thanks for confirming that — your account's all verified. What can I help with today: updating payment details, paying an outstanding invoice, portal login access, phone payment, or a payment extension?"
- CRITICAL: Both email and phone lookups MUST succeed before moving forward. If either fails, re-ask and retry immediately. Never proceed to resolution paths without both successful verifications.
- ACCOUNTS RESOLUTION PATHS (use the matching one naturally):
  1. UPDATE PAYMENT DETAILS: "You can update your payment method through our customer portal at https://infinetbroadband-portal.com.au/, or use this step-by-step link: https://www.infinetbroadband.com.au/set-up-a-payment-method/."
  2. PAY OUTSTANDING INVOICE: "You can pay through our customer portal at https://infinetbroadband-portal.com.au/, or use this payment page: https://www.infinetbroadband.com.au/manually-paying-an-invoice/."
  3. CANNOT LOGIN TO PORTAL: Ask "Would you like me to send an email to support so they can sort you out?" → If yes, call send_portal_login_email (email only, no ticket number).
  4. PHONE PAYMENT: "For payments over the phone, please call 1300 101 414 and the team will process it for you."
  5. PAYMENT EXTENSION: "Please let us know the date you'll be paying, and we'll raise a ticket for you." → extract paymentDate → Confirm: "Great, I've noted that you'll be paying by [paymentDate]. I'll raise a ticket for you now." → create_ticket with paymentDate included.

RELOCATION FLOW:
1. "Oh exciting, you're on the move! Let's make sure your internet comes with you. What's the email on your account?" → customer_lookup.
2. List their active services in a friendly way: "So looking at your account, I can see you've got [services]. Which of these do you want to bring along to the new place? And is there anything you'd like to cancel?"
3. "Is the new place going to be residential or business?" → save residentialPreference. SKIP if already known.
4. NEVER ask about NBN vs OptiComm. Go straight to address.
5. "When are you looking to disconnect the old place? And when do you need the new connection up and running?"
6. "And what's the address of the new place?" → call check_address_availability WITHOUT passing networkPreference (let the tool auto-detect unless user stated a preference earlier in conversation).
7. After tool result → IMMEDIATELY present ONLY the plans in availablePlans from the tool result. Do NOT wait for user input. Show matching plans with recommendations — present them slowly and warmly → WAIT for user to choose → user selects → "Awesome, let me put all of this together for you..." → create_ticket with all relocation details.

TOOL USAGE:
- extract_call_fields for all personal info. If user says something like "residential" or "business", extract residentialPreference immediately.
- check_address_availability when address is collected. ONLY pass networkPreference if user explicitly stated "NBN" or "OptiComm" at some point. Otherwise omit it — the tool auto-detects.
- get_internet_plans ONLY as fallback if check_address_availability is not applicable.
- customer_lookup for existing customers is mandatory for verification. In SUPPORT FLOW and ACCOUNTS FLOW, do double verification: first by email, then by phone ONLY (no email in second lookup) before proceeding.
- IMPORTANT: When calling create_ticket, ALWAYS include the selected plan (leadInterest) in the message body so it appears in the email.

HANDLING EDGE CASES:
- If user asks something outside your scope: "That's a great question! It's a little outside what I can directly help with from here, but I'd definitely recommend getting in touch with our support team at support@infinetbroadband.com.au — they'll be able to sort that out for you in no time. Is there anything else I can help with in the meantime?"
- If user seems confused: "Hey, no worries at all! This stuff can be a bit confusing sometimes. Let me break it down for you in simple terms..."
- If user changes their mind: "Oh absolutely, no problem at all! Let's switch things up." Adapt without starting over.
- If user asks "how much" without context: "Great question! So the price depends on a few things like the speed you're after and whether it's for home or business. Let me walk you through it — first up, is this for a residential connection or a business one?"
- If user says thank you / goodbye: "You're so welcome, [name]! It was really great chatting with you. If you ever need anything in the future, don't hesitate to get in touch — we're always here. Have a wonderful day!"

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
    "Check which plans are available at a customer's address. If networkPreference is 'OptiComm', returns hardcoded OptiComm plans immediately. If networkPreference is 'NBN', calls MARS API for NBN plans. If networkPreference is not provided, tries NBN via MARS first — if MARS errors, returns no data, or address is not orderable, automatically falls back to OptiComm hardcoded plans silently. Requires address; networkPreference and residentialPreference are optional. IMPORTANT: Only pass networkPreference if the customer explicitly stated a preference for NBN or OptiComm. Otherwise omit it entirely.",
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
          "Only pass this if user explicitly said they want 'NBN' or 'OptiComm'. Omit if they said nothing about network type.",
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
  description: "Lookup customer by name, email, or phone.",
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
    // FIX #2: Track which network was shown so we never cross-pollinate
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
  for (const [k, v] of Object.entries(r)) {
    if (v !== undefined && v !== null) session.collected[k] = v;
  }
  session.lastSeen = new Date().toISOString();
  sessions.set(session.id, session);
  return r;
}

// ==================== INTERRUPTION DETECTION ====================
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
// FIX #1: Any MARS error at any stage (token, search, SQ) falls back to OptiComm silently.
// FIX #2: networkShown is stored on the session so the model is reminded not to cross-pollinate.
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

  const resPref = (
    residentialPreference ||
    session.collected?.residentialPreference ||
    "residential"
  ).toLowerCase();
  const isBusiness = resPref === "business";

  // ── OPTICOMM helper ──
  const getOpticommResult = () => {
    const plans = isBusiness
      ? OPTICOMM_BUSINESS_PLANS
      : OPTICOMM_RESIDENTIAL_PLANS;
    console.log(
      `OptiComm plans (${isBusiness ? "business" : "residential"}): ${plans.length}`,
    );
    // Record which network was shown on the session
    if (session) session.networkShown = "OptiComm";
    return {
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
    };
  };

  // ── EXPLICIT OPTICOMM ──
  if (isOpticomm) {
    console.log(
      `OptiComm address check (explicit preference, no MARS): ${address}`,
    );
    return JSON.stringify(getOpticommResult());
  }

  // ── NBN (explicit or auto-detect) ──
  // FIX #1: Wrap the ENTIRE NBN block in try/catch — any error at any point
  // (token fetch, address search, service qualification, tariff fetch) falls
  // back to OptiComm silently when there is no explicit NBN preference.
  try {
    let marsCandidates = [];
    try {
      marsCandidates = await marsAddressSearch(address);
    } catch (marsSearchErr) {
      // MARS address search failed
      if (noPreference) {
        console.warn(
          `MARS address search failed at ${address}, falling back to OptiComm silently:`,
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
        // MARS service qualification failed
        if (noPreference) {
          console.warn(
            `MARS service qualification failed at ${address}, falling back to OptiComm silently:`,
            marsSqErr.message,
          );
          return JSON.stringify(getOpticommResult());
        }
        console.warn(
          "MARS service qualification failed (NBN explicit):",
          marsSqErr.message,
        );
        marsSq = null;
      }
    }

    // If MARS returned no location candidates at all → fall back to OptiComm silently
    if (!locId && noPreference) {
      console.log(
        `MARS returned no location candidates for ${address}, falling back to OptiComm silently`,
      );
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
        console.log(`NBN NOT orderable: ${address} | Reason: ${reason}`);
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
      // No preference → silently fall back to OptiComm
      console.log(
        `NBN not orderable at ${address}, falling back to OptiComm silently`,
      );
      return JSON.stringify(getOpticommResult());
    }

    let allTariffs = [];
    try {
      allTariffs = await fetchTariffs();
    } catch (tariffErr) {
      if (noPreference) {
        console.warn(
          `Tariff fetch failed at ${address}, falling back to OptiComm silently:`,
          tariffErr.message,
        );
        return JSON.stringify(getOpticommResult());
      }
      throw tariffErr;
    }

    const availablePlans = filterTariffsByMarsAvailability(
      allTariffs,
      virtutelSpeeds,
      serviceType,
    );

    // If no NBN plans matched and user had no explicit preference → fall back to OptiComm silently
    if (availablePlans.length === 0 && noPreference) {
      console.log(
        `No NBN plans matched at ${address}, falling back to OptiComm silently`,
      );
      return JSON.stringify(getOpticommResult());
    }

    const needsInstall = requiresInstallVisit(serviceabilityClass);
    const readinessDescription = getServiceabilityDescription(
      primaryAccessTechnology,
      serviceabilityClass,
      serviceabilityStatus,
    );

    // Record that NBN was shown on this session
    if (session) session.networkShown = "NBN";

    console.log(
      `NBN address check: ${address} | locId: ${locId} | tech: ${primaryAccessTechnology} | class: ${serviceabilityClass} | status: ${serviceabilityStatus} | serviceType: ${serviceType} | MARS speeds: ${virtutelSpeeds.length} | Matched plans: ${availablePlans.length} | requiresInstall: ${needsInstall}`,
    );

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
  } catch (err) {
    // Catch-all: If NBN lookup itself errors and no explicit preference → silently fall back to OptiComm
    if (noPreference) {
      console.warn(
        `NBN lookup catch-all at ${address}, falling back to OptiComm silently:`,
        err.message,
      );
      return JSON.stringify(getOpticommResult());
    }
    console.error(
      "check_address_availability (NBN explicit) error:",
      err.message,
    );
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
      const supportIntent =
        String(session?.collected?.intent || "").toLowerCase() === "support";
      const accountIntent =
        String(session?.collected?.intent || "").toLowerCase() === "account";
      const hasPhone =
        typeof lookupArgs.phone === "string" && !!lookupArgs.phone.trim();
      const hasEmail =
        typeof lookupArgs.email === "string" && !!lookupArgs.email.trim();

      if ((supportIntent || accountIntent) && hasPhone && hasEmail) {
        delete lookupArgs.email;
        console.log("🔐 Verification lookup forced to phone-only");
      }

      return JSON.stringify(await customerLookup(lookupArgs));
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
    // Payment extension requests always go to Support (not Sales)
    const hasPaymentExtension = !!(collected.paymentDate || fa.paymentDate || (fa.subject && fa.subject.toLowerCase().includes("payment extension")));
    const isSupportTicket = hasCustomerId || hasPaymentExtension;

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
    if (collected.leadInterest || fa.leadInterest)
      detailLines.push(
        `Selected Plan: ${collected.leadInterest || fa.leadInterest}`,
      );
    if (collected.paymentDate)
      detailLines.push(
        `Customer requested payment extension until: ${collected.paymentDate}`,
      );

    const detailsBlock =
      detailLines.length > 0
        ? `\n\n--- Customer Details ---\n${detailLines.join("\n")}`
        : "";

    if (fa.message?.message) {
      fa.message.message += detailsBlock;
    } else if (detailsBlock) {
      fa.message = { message: detailsBlock.trim() };
    }

    try {
      if (isSupportTicket) {
        console.log(
          `📝 Creating SUPPORT ticket in Splynx: subject="${fa.subject}" customer_id=${fa.customer_id}`,
        );
        const r = await splynx.request(
          "POST",
          "admin/support/tickets",
          objectToUrlEncoded(fa),
        );
        console.log(`✅ Splynx ticket created: ID=${r.id}`);
        const emailResult = await sendTicketEmail(r.id, fa, collected, true);
        return JSON.stringify({
          success: true,
          ticket_id: r.id,
          email_sent: emailResult.sent,
          email_error: emailResult.reason || null,
        });
      } else {
        console.log(
          `📧 SALES inquiry — sending email only (no Splynx ticket): subject="${fa.subject}"`,
        );
        const emailResult = await sendTicketEmail(null, fa, collected, false);
        return JSON.stringify({
          success: true,
          message: "Sales inquiry submitted successfully",
          email_sent: emailResult.sent,
          email_error: emailResult.reason || null,
        });
      }
    } catch (err) {
      console.error("❌ Create ticket/email failed:", err.message || err);
      return JSON.stringify({
        success: false,
        error: err.message || "Failed to process request",
      });
    }
  }
  if (funcName === "send_portal_login_email") {
    const collected = session.collected || {};
    const hasCustomerId = !!collected.customer_id;

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
      console.log(`📧 Sending portal login assistance email to support@`);
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
      console.error("❌ Portal login email failed:", err.message || err);
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

    // ── Build the context hint for the final response ──
    let plansPresentationHint = "";
    if (fn === "check_address_availability") {
      let parsedResult = null;
      try {
        parsedResult = JSON.parse(toolContent);
      } catch (_) {}
      if (parsedResult) {
        const networkLabel = parsedResult.network || "the available network";
        const planCount = Array.isArray(parsedResult.availablePlans)
          ? parsedResult.availablePlans.length
          : 0;

        if (parsedResult.orderable === false) {
          plansPresentationHint = `
TOOL RESULT INSTRUCTION: The address check returned orderable=false — no plans are available at this address via NBN.
Tell the customer empathetically and offer to take their details for when it becomes available.
Do NOT present any OptiComm or NBN plans from your knowledge base.`;
        } else if (planCount > 0) {
          // FIX #2 + FIX #3: Lock to the returned network and instruct IMMEDIATE presentation
          plansPresentationHint = `
TOOL RESULT INSTRUCTION: The address check returned ${planCount} plans on the "${networkLabel}" network.
CRITICAL — IMMEDIATE PRESENTATION REQUIRED: Present these plans RIGHT NOW without waiting for any user input. Do not ask "are you ready?" or pause. Speak immediately, slowly, and one plan at a time.
CRITICAL — ONE NETWORK LOCK: You are now LOCKED to "${networkLabel}" for this entire session. Do NOT mention ${networkLabel === "OptiComm" ? "NBN" : "OptiComm"} at any point ever again in this conversation.
CRITICAL — ONLY THESE PLANS: Present ONLY these ${planCount} plans from the tool result's "availablePlans" array. Do NOT add plans from memory or the knowledge base.
Present the plans warmly and conversationally as per the system prompt, then wait for the customer to choose.`;
        } else {
          plansPresentationHint = `
TOOL RESULT INSTRUCTION: The address check returned no available plans.
Tell the customer no plans are currently available at this address and offer to help them in another way.
Do NOT invent or present plans from your knowledge base.`;
        }
      }
    }

    // ── Final response generation using the FULL system prompt ──
    const networkLockReminder = session.networkShown
      ? `\nNETWORK LOCK REMINDER: You already showed ${session.networkShown} plans to this customer. Do NOT mention ${session.networkShown === "OptiComm" ? "NBN" : "OptiComm"} for any reason for the rest of this conversation.`
      : "";

    const finalMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...session.messages,
      {
        role: "system",
        content: `Current collected fields: ${JSON.stringify(session.collected || {})}.${networkLockReminder}${plansPresentationHint}`,
      },
    ];

    const finalResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: finalMessages,
      temperature: 0.0,
      max_tokens: 700,
    });
    const text =
      finalResp.choices?.[0]?.message?.content?.trim() ||
      "Thanks — I have your details.";
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
      "Hey there! Welcome to InfiNET Broadband — great to have you! I'm the InfiNET assistant and I'm here to help you out with anything you need. First up, could I grab your name?";
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

    // ── Interruption / noise filtering ──
    const lastAssistantMsg = [...session.messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (lastAssistantMsg && userText) {
      const { isValid, isListeningCue } = classifyInterruption(userText);
      if (isListeningCue) {
        console.log(
          `🎙️ Listening cue detected ("${userText}"), ignoring as input`,
        );
        const repeatMsg = "Sorry, I didn't catch that — please go ahead.";
        return res.json({
          sessionId: session.id,
          text: repeatMsg,
          audioBase64: (await makeTTS(repeatMsg))?.toString("base64") || null,
          userText,
        });
      }
      if (!isValid && userText.split(/\s+/).length < 3) {
        console.log(
          `🎙️ Likely noise barge-in ("${userText}"), repeating last message`,
        );
        const repeatPrefix =
          "Oh sorry, I think there might have been a little hiccup — let me just repeat that. ";
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
      const p = "Sorry, I didn't catch that — could you please repeat?";
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
  console.log(`🚀 InfiNET Broadband AI Server running on port ${PORT}`);
  console.log(`🎤 Realtime API + ElevenLabs • Ultra-low latency mode`);
  console.log(`🔌 Socket.IO ready for voice clients`);
  console.log(` • OptiComm plans = HARDCODED (no MARS API call)`);
  console.log(
    ` • NBN plans filtered by MARS virtutelSpeedsAvailable + serviceType`,
  );
  console.log(
    ` • check_address_availability auto-detects network (NBN first → OptiComm fallback)`,
  );
  console.log(` • Interruption/noise filtering enabled`);
  console.log(` • FIX: MARS errors at any stage → silent OptiComm fallback`);
  console.log(` • FIX: One-network-per-session lock (no cross-pollination)`);
  console.log(` • FIX: Plans presented immediately on tool return, no delay`);
});

/*
================================================================================
COMPLETE BOT FLOW DOCUMENTATION
================================================================================

All 5 flows below. OptiComm plans are hardcoded in OPTICOMM_RESIDENTIAL_PLANS
and OPTICOMM_BUSINESS_PLANS. NBN plans come from Splynx tariffs filtered via
MARS API. If MARS fails at any point (token, search, SQ, tariff fetch) and the
customer didn't explicitly ask for NBN, the bot silently shows OptiComm plans.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLOW 1 — SALES (New Customer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Bot greets → asks for name
2. Customer gives name → bot saves preferredName, asks new or existing
3. Customer says "new" → customerType=new saved
4. Bot asks "home or business?" (skip if already mentioned)
5. Customer answers → residentialPreference saved
6. Bot asks for full address (street, suburb, state, postcode)
7. Customer gives address → bot immediately calls check_address_availability
   ├─ MARS succeeds + NBN plans found → show NBN plans, lock session to NBN
   ├─ MARS succeeds + no NBN plans → silently show OptiComm plans, lock to OptiComm
   ├─ MARS address rejected → silently show OptiComm plans, lock to OptiComm
   └─ MARS errors at ANY stage → silently show OptiComm plans, lock to OptiComm
8. Bot IMMEDIATELY presents plans (no waiting) with enthusiasm
9. Bot asks "which plan catches your eye?" then WAITS for customer to choose
10. Customer picks a plan → leadInterest saved, bot reacts warmly
11. Bot asks for email address (shows text input box)
12. Customer provides email → email saved
13. Bot says "just a moment while I submit this" → calls create_ticket
    ├─ No customer_id → sales email only to sales@infinetbroadband.com.au
    └─ Email includes name, email, address, selected plan
14. Bot confirms: "You're all set! Sales team will be in touch shortly."
15. Asks if anything else needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLOW 2 — SUPPORT (Existing Customer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Bot greets → asks for name
2. Customer gives name → asks new or existing
3. Customer says "existing" → asks "support, accounts, or moving?"
4. Customer says "support" or describes a tech issue
5. Bot asks for account email → calls customer_lookup
   ├─ Found → bot says "found your account" and asks what's going on
   └─ Not found → asks to try a different email or phone number
6. Customer describes the issue → bot empathises, asks follow-up questions
7. issueSummary collected with enough detail
8. Bot says "let me raise this for you now" → calls create_ticket
   ├─ customer_id present → creates Splynx ticket + sends email to support@
   └─ Email includes customer details and issue summary
9. Bot confirms: "Ticket raised! Team will be in touch shortly."
10. Asks if anything else needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLOW 3 — ACCOUNTS / BILLING (Existing Customer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Bot greets → asks for name
2. Customer gives name → asks new or existing
3. Customer says "existing" → asks "support, accounts, or moving?"
4. Customer says "accounts", "billing", "payment", "invoice"
5. Bot asks for account email → calls customer_lookup
6. Bot verifies with phone number (phone ONLY, no email re-sent) → customer_lookup with phone
7. After verification, bot asks naturally what they need help with (payment details, outstanding invoice, portal login access, phone payment, or payment extension).
8. FIVE PATHS:
  a) UPDATE PAYMENT DETAILS: Bot provides portal link first, then specific guide link (https://www.infinetbroadband.com.au/set-up-a-payment-method/)
  b) PAY OUTSTANDING INVOICE: Bot provides portal link first, then specific payment link (https://www.infinetbroadband.com.au/manually-paying-an-invoice/)
  c) CAN'T LOGIN TO PORTAL: Bot asks "Would you like me to send an email to support so they can sort you out?" → If yes: call send_portal_login_email (email only, NO ticket created)
  d) PHONE PAYMENT: Bot gives phone payment option on 1300 101 414
  e) PAYMENT EXTENSION: Bot asks for payment date → creates support ticket + sends email with "Customer requested payment extension until: [date]"
9. Asks if anything else needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLOW 4 — RELOCATION (Existing Customer Moving)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Bot greets → asks for name
2. Customer gives name → asks new or existing
3. Customer says "existing" → asks "support, accounts, or moving?"
4. Customer says "moving" or "relocating"
5. Bot asks for account email → calls customer_lookup
6. Bot lists active services found on the account
7. Asks which services to keep / cancel → serviceToTerminate saved
8. Asks "is the new place residential or business?" (skip if known)
9. Asks for disconnect date (old address) → terminationDate saved
10. Asks for connection date (new address) → connectionDate saved
11. Asks for new address → calls check_address_availability
    ├─ Same fallback logic as SALES FLOW (NBN → OptiComm on failure)
    └─ Session locked to whichever network is returned
12. Bot IMMEDIATELY presents plans, waits for customer to choose
13. Customer picks plan → leadInterest saved
14. Bot says "let me put this all together" → calls create_ticket with:
    - old service termination details
    - new address + connection date
    - selected plan
    - all collected fields
15. Bot confirms and asks if anything else

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLOW 5 — GENERAL ENQUIRY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Bot greets → asks for name
2. Customer asks a general question (pricing, modems, coverage, etc.)
3. Bot answers from KB with warm, conversational responses:
   - "What modems do you sell?" → lists hardware with prices
   - "Do you have contracts?" → no lock-in, month to month
   - "What's the difference between NBN and OptiComm?" → explains both
   - "Do you cover [suburb]?" → asks for address, runs check_address_availability
   - "Private fibre for developers?" → sends to dedicated URL
   - "Security packages?" → lists Basic/Bronze/Silver/Gold
4. If question is out of scope → refers to support@infinetbroadband.com.au
5. No ticket unless customer specifically asks for follow-up

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY BEHAVIOURS ACROSS ALL FLOWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• ONE NETWORK PER SESSION: Once check_address_availability returns (NBN or
  OptiComm), that network is locked for the entire session. The other network
  is never mentioned again. This is enforced in:
  (a) session.networkShown flag on the session object
  (b) networkLockReminder injected into every subsequent LLM call
  (c) plansPresentationHint in the tool result instruction
  (d) System prompt rules (ONE-NETWORK-PER-SESSION RULE section)

• IMMEDIATE PLAN PRESENTATION: When check_address_availability returns data,
  the TOOL RESULT INSTRUCTION tells the LLM to present plans immediately
  without waiting for any user input. No "should I continue?" pauses.

• MARS ERROR HANDLING: Errors are caught at 4 levels:
  (a) getMarsAccessToken() failure → catch → OptiComm fallback
  (b) marsAddressSearch() failure → inner try/catch → OptiComm fallback
  (c) marsServiceQualification() failure → inner try/catch → OptiComm fallback
  (d) fetchTariffs() failure → inner try/catch → OptiComm fallback
  (e) Outer catch-all for any other unexpected error → OptiComm fallback
  All fallbacks are silent (no mention to customer of NBN failing).

• NEVER ASK ABOUT NBN vs OPTICOMM: The bot never asks the customer which
  network they prefer. Address check auto-detects. If user volunteers a
  preference ("I want NBN" / "do you have OptiComm"), it's extracted and
  passed to the tool. Otherwise the tool decides.

• PLAN SELECTION: Bot never assumes or pre-selects a plan. Always waits for
  explicit customer confirmation before saving leadInterest.

• SALES vs SUPPORT EMAIL ROUTING:
  - New customer (no customer_id) → sales email only, no Splynx ticket
  - Existing customer (customer_id present) → Splynx ticket + support email

================================================================================
*/
