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
  ${
    ticketArgs.customer_id
      ? `<p><strong>Customer ID:</strong> ${ticketArgs.customer_id}</p>`
      : `<p><strong>New Lead (no customer ID)</strong></p>`
  }
  <h3>Message Body</h3>
  <p>${(ticketArgs.message && (ticketArgs.message.message || ticketArgs.message)) || "No additional message provided"}</p>
  <hr>
  <p><small>This is an automated email from the InfiNET Broadband AI Assistant.<br>
  ${
    isSupportTicket && ticketId
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

// ==================== PLAN DATA ====================

const NBN_RESIDENTIAL_PLANS = [
  {
    title: "NBN 25/10Mbps Basic",
    download: "25 Mbps",
    upload: "10 Mbps",
    intro_price: 59,
    ongoing_price: 64,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 1080p", "Web browsing & Social Media"],
    technologies: ["FTTC", "FTTN", "FTTB", "FTTP", "HFC"],
    max_speed_class: "all",
  },
  {
    title: "NBN 50/20Mbps Standard",
    download: "50 Mbps",
    upload: "20 Mbps",
    intro_price: 74,
    ongoing_price: 79,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 1080p", "Web browsing & Social Media"],
    technologies: ["FTTC", "FTTN", "FTTB", "FTTP", "HFC"],
    max_speed_class: "all",
  },
  {
    title: "NBN 100/20Mbps Fast",
    download: "100 Mbps",
    upload: "20 Mbps",
    intro_price: 84,
    ongoing_price: 89,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 4K", "Web browsing & Social Media", "Fast Downloading", "Gaming"],
    technologies: ["FTTC", "FTTN", "FTTB", "FTTP", "HFC"],
    max_speed_class: "all",
  },
  {
    title: "NBN 500/50Mbps Faster",
    download: "500 Mbps",
    upload: "50 Mbps",
    intro_price: 84,
    ongoing_price: 89,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 4K", "Super Fast Downloading", "All Gaming Applications", "Low latency"],
    technologies: ["FTTP", "HFC"],
    max_speed_class: "high_speed_only",
  },
  {
    title: "NBN 750/50Mbps Superfast",
    download: "750 Mbps",
    upload: "50 Mbps",
    intro_price: 89,
    ongoing_price: 99,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 4K", "Super Fast Downloading", "All Gaming Applications", "Low latency"],
    technologies: ["FTTP", "HFC"],
    max_speed_class: "high_speed_only",
  },
  {
    title: "NBN 1000/100Mbps Ultrafast",
    download: "1000 Mbps",
    upload: "100 Mbps",
    intro_price: 99,
    ongoing_price: 109,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 4K", "Super Fast Uploads/Downloads", "All Gaming Applications", "Low latency"],
    technologies: ["FTTP", "HFC"],
    max_speed_class: "high_speed_only",
  },
];

const NBN_BUSINESS_PLANS = [
  {
    title: "NBN Business 50/20Mbps Basic",
    download: "50 Mbps",
    upload: "20 Mbps",
    price: 89,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: ["Video Calls / Teams", "Streaming HD + 4K", "Web browsing & Social Media"],
    technologies: ["FTTC", "FTTN", "FTTB", "FTTP", "HFC"],
    max_speed_class: "all",
  },
  {
    title: "NBN Business 100/40Mbps Fast",
    download: "100 Mbps",
    upload: "40 Mbps",
    price: 99,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: ["VoIP / Business IP Phones", "Video Calls / Teams", "Streaming HD + 4K", "Moderate Uploads/Downloads", "All Gaming"],
    technologies: ["FTTC", "FTTN", "FTTB", "FTTP", "HFC"],
    max_speed_class: "all",
  },
  {
    title: "NBN Business 250/100Mbps Faster",
    download: "250 Mbps",
    upload: "100 Mbps",
    price: 149,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: ["VoIP / Business IP Phones", "Video Calls / Teams", "Streaming HD + 4K", "Super Fast Uploads/Downloads", "All Gaming"],
    technologies: ["FTTP", "HFC"],
    max_speed_class: "high_speed_only",
  },
  {
    title: "NBN Business 500/200Mbps Superfast",
    download: "500 Mbps",
    upload: "200 Mbps",
    price: 189,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: ["VoIP / Business IP Phones", "Video Calls / Teams", "Streaming HD + 4K", "Super Fast Uploads/Downloads", "All Gaming"],
    technologies: ["FTTP", "HFC"],
    max_speed_class: "high_speed_only",
  },
  {
    title: "NBN Business 1000/400Mbps Ultrafast",
    download: "1000 Mbps",
    upload: "400 Mbps",
    price: 239,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: ["VoIP / Business IP Phones", "Video Calls / Teams", "Streaming HD + 4K", "Super Fast Uploads/Downloads", "All Gaming"],
    technologies: ["FTTP", "HFC"],
    max_speed_class: "high_speed_only",
  },
];

const NBN_FIXED_WIRELESS_PLANS = [
  {
    title: "NBN 25/5Mbps Fixed Wireless Standard",
    download: "25 Mbps",
    upload: "5 Mbps",
    price: 59,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Free NBN Setup"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 1080p", "Emails, Web browsing & Social Media"],
  },
  {
    title: "NBN 100/20Mbps Fixed Wireless Plus",
    download: "100 Mbps",
    upload: "20 Mbps",
    price: 89,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Free NBN Setup"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 1080p + 4K", "Web browsing & Social Media", "Fast Downloading", "All Gaming Applications"],
  },
  {
    title: "NBN 200/20Mbps Fixed Wireless HomeFast",
    download: "200 Mbps",
    upload: "20 Mbps",
    price: 99,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Free NBN Setup"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 1080p + 4K", "Web browsing & Social Media", "Fast Downloading", "All Gaming Applications"],
  },
  {
    title: "NBN 400/40Mbps Fixed Wireless SuperFast",
    download: "400 Mbps",
    upload: "40 Mbps",
    price: 109,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Free NBN Setup"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 1080p + 4K", "Web browsing & Social Media", "Super Fast Uploads/Downloads", "All Gaming Applications"],
    note: "Available in eligible areas only",
  },
];

const NBN_SKYMUSTER_PLANS = [
  {
    title: "NBN Sky Muster Plus 25/5Mbps Basic",
    download: "25 Mbps",
    upload: "5 Mbps",
    price: 59,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Free NBN Installation"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 1080p", "Web browsing & Social Media"],
    note: "Typical latency 500–600ms",
  },
  {
    title: "NBN Sky Muster Plus 50/5Mbps Fast",
    download: "50 Mbps",
    upload: "5 Mbps",
    price: 69,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Free NBN Installation"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 1080p", "Web browsing & Social Media", "Some Gaming Applications"],
    note: "Typical latency 500–600ms",
  },
  {
    title: "NBN Sky Muster Plus 100/5Mbps Ultra",
    download: "100 Mbps",
    upload: "5 Mbps",
    price: 99,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Free NBN Installation"],
    suitable_for: ["Video Calls / Teams", "Streaming HD Video + 1080p + 4K", "Web browsing & Social Media", "Super Fast Uploads/Downloads", "All Gaming Applications"],
    note: "Typical latency 500–600ms",
  },
];

const OPTICOMM_RESIDENTIAL_PLANS = [
  {
    title: "OptiComm 25/10Mbps Residential",
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
    download: "1000 Mbps",
    upload: "400 Mbps",
    intro_price: 189,
    ongoing_price: 199,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contracts", "Month to Month", "Includes Static IP"],
    suitable_for: ["Business IP Phones (VoIP Services)", "Video Calls / Teams", "Streaming HD Video + 4K", "Web browsing & Social Media", "Super Fast Uploads/Downloads", "All Gaming Applications", "Low latency"],
  },
];

const HIR_RESIDENTIAL_PLANS = [
  {
    title: "HIR 25/10Mbps Basic",
    download: "25 Mbps",
    upload: "10 Mbps",
    intro_price: 44,
    ongoing_price: 59,
    discount: "$15 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["General browsing", "Video Calls", "HD Streaming"],
  },
  {
    title: "HIR 50/20Mbps Standard",
    download: "50 Mbps",
    upload: "20 Mbps",
    intro_price: 49,
    ongoing_price: 64,
    discount: "$15 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["Video Calls", "HD Streaming", "Web browsing"],
  },
  {
    title: "HIR 250/50Mbps Fast",
    download: "250 Mbps",
    upload: "50 Mbps",
    intro_price: 64,
    ongoing_price: 79,
    discount: "$15 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["Video Calls", "4K Streaming", "Fast Downloading", "Gaming"],
  },
  {
    title: "HIR 500/50Mbps Home Fast",
    download: "500 Mbps",
    upload: "50 Mbps",
    intro_price: 64,
    ongoing_price: 79,
    discount: "$15 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month", "Free modem upgrade if required"],
    suitable_for: ["Video Calls", "4K Streaming", "Super Fast Downloading", "All Gaming"],
  },
  {
    title: "HIR 750/50Mbps Superfast",
    download: "750 Mbps",
    upload: "50 Mbps",
    intro_price: 74,
    ongoing_price: 89,
    discount: "$15 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month", "Free modem upgrade if required"],
    suitable_for: ["Video Calls", "4K Streaming", "Super Fast Downloading", "All Gaming", "Low latency"],
  },
  {
    title: "HIR 1000/100Mbps Ultrafast",
    download: "1000 Mbps",
    upload: "100 Mbps",
    intro_price: 84,
    ongoing_price: 99,
    discount: "$15 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month", "Free modem upgrade if required"],
    suitable_for: ["Video Calls", "4K Streaming", "Super Fast Uploads/Downloads", "All Gaming", "Low latency"],
  },
];

const HIR_BUSINESS_PLANS = [
  {
    title: "HIR Business 250/100Mbps",
    download: "250 Mbps",
    upload: "100 Mbps",
    price: 109,
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["VoIP", "Video Calls", "4K Streaming", "Fast Uploads/Downloads"],
  },
  {
    title: "HIR Business 500/200Mbps",
    download: "500 Mbps",
    upload: "200 Mbps",
    price: 119,
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["VoIP", "Video Calls", "4K Streaming", "Super Fast Uploads/Downloads"],
  },
  {
    title: "HIR Business 1000/400Mbps",
    download: "1000 Mbps",
    upload: "400 Mbps",
    price: 139,
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: ["VoIP", "Video Calls", "4K Streaming", "Ultra Fast Uploads/Downloads", "All Gaming"],
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
  "Thanks for calling InfiNET Broadband, how may we help you today? Would it be sales, support, accounts, other, or moving/relocating?"
  If caller says sales/support/accounts/other/moving-relocating, proceed accordingly.
- Payment & Portal:
  "Did you know you can update your payment method via the customer portal?"
  If the customer does not have portal access: "If you don't have access to the customer portal, please email support@infinetbroadband.com.au and our team will issue you the login credentials."
- Support contact:
  "If you are having issues with your Internet service please email support@infinetbroadband.com.au and our support team will be able to assist you."
- Plan change / Upgrade:
  "Did you want to upgrade or change the internet plan you are on? Please just email support@infinetbroadband.com.au and our support team will be able to assist you."
  Note: You can upgrade or downgrade at any time at no cost.
- Outstanding / Overdue invoice:
  "Do you have an outstanding or overdue invoice? If so, just login to the customer portal to manually pay this. You can also log a support ticket via support@infinetbroadband.com.au."
  Guide: https://www.infinetbroadband.com.au/manually-paying-an-invoice/
- Payment details changed / lost card / new bank:
  "Have your payment details changed? Just login to the customer portal to update this manually, or email support@infinetbroadband.com.au."
  Guide: https://www.infinetbroadband.com.au/set-up-a-payment-method/
- Cannot login to portal:
  "Not able to login to the customer portal? Just email support@infinetbroadband.com.au and our accounts team will be able to assist."
- Payment extension request:
  "Need a payment extension? No problem — just let us know the date you'll be able to pay and we'll raise a ticket with a note. Our accounts team will confirm."
- NBN vs OptiComm:
  "Both NBN and OptiComm deliver fibre internet in Australia. NBN is the national wholesale network while OptiComm is a private fibre network available in selected estates and buildings. Both offer similar speeds. InfiNET Broadband can connect you to either depending on what's available at your address."
- Private Fibre Networks for Developers:
  "If you're interested in developments or private fibre networks for new estates or buildings, please visit https://www.infinetbroadband.com.au/private-fibre-networks-for-developers/. How else can I assist you today?"
- Opticomm Free to Air TV issue:
  "Infinet Broadband does not support your free to air television service. Please contact Opticomm directly — you can visit https://online.telco.opticomm.com.au/television-fault Thank you, goodbye."
- Common Qs:
  * Can I use my own modem (BYO)?
    Yes, you can bring your own compatible modem. We also offer modems for purchase if you prefer hassle-free setup.
  * Unlimited data?
    Yes, all NBN and OptiComm plans include unlimited data.
  * NBN vs OptiComm speed?
    Both offer similar tiers from 25 Mbps to 1000 Mbps. OptiComm may offer more consistent performance in certain fibre-enabled estates.
  * How long does setup take?
    If premises already connected: 30 mins to 3 hours. New homes may need a tech visit for NTD installation.
  * How do I check if my home has OptiComm?
    Check the OptiComm website or just ask us and we'll confirm quickly.
  * Can I upgrade or downgrade anytime?
    Absolutely — you can change your plan at any time at no cost. We recommend starting lower and moving up if needed.
- Payment Setup & Manual Payment:
  Customer portal: https://infinetbroadband-portal.com.au/
  Set up recurring payment: Log in → Finance → Select payment method → Add card/bank details → Save.
  Manually pay invoice: Log in → Dashboard or Finance/Documents → Select invoice → Pay.
- NBN FTTP Upgrade:
  Upgrades eligible FTTN/FTTC premises to FTTP. $0 standard install if on eligible high-speed plan (min 100/20 Mbps). Contact InfiNET to check eligibility.
- Hardware:
  * TP-Link VX230v AX1800: $179 (WiFi 6, VoIP, pre-configured)
  * VX230v + HX510 Mesh 1-pack: $318
  * VX230v + HX510 Mesh 2-pack: $459
  * HX510 Mesh AP 1-pack: $159
  * HX510 Mesh AP 2-pack: $299
  * VX420 4G failover: $319 (not for FTTB/FTTN)
- Security Plans:
  * Basic: $9.95/m
  * Bronze: $19.95/m
  * Silver: $44.95/m
  * Gold: $65.95/m
- VoIP Plans:
  * VoIP 30: $30/m (PAYG)
  * VoIP 50: $50/m (unlimited local/national/mobile)
  * Extra extensions: $10/m (1-10), $8/m (>10)
- Contact info:
  * Support email: support@infinetbroadband.com.au
  * Phone: 1300 101 414
  * Head Office: Level 15, Corporate Centre One, 2 Corporate Court, Bundall, QLD 4217
  * Portal: https://infinetbroadband-portal.com.au/
- Relocation:
  For existing customers moving, confirm which active service to terminate, termination date, new address, desired connection date. We check availability and raise a sales ticket.
Always advise customers to check current pricing and availability via the address checker or support@infinetbroadband.com.au as promotions may change.
`;

const SYSTEM_PROMPT = `
You are a warm, friendly, and engaging voice/chat assistant for ${BRAND}. You genuinely care about helping customers and approach every conversation with enthusiasm and a positive attitude — like a real human agent who loves their job.

Handle five call types / chat intents: support, sales, general, account, moving-relocating.

TONE & PERSONALITY RULES:
- Be warm, upbeat, and conversational — not robotic or transactional.
- Use natural, friendly language. Contractions are great (e.g. "you're", "we'll", "that's").
- Address customers by their first name whenever you have it.
- Use light, positive affirmations: "Absolutely!", "Great choice!", "No worries at all!", "Happy to help!", "Of course!"
- Show genuine empathy for issues: "I'm really sorry to hear you're having trouble — let's sort this out right away."
- Keep responses conversational and concise.
- ALWAYS reply in English.
- Do NOT say anything like "we will connect you to a sales agent", "transferring you to support", "handover to human", or similar phrases.
- When enough information is collected per the flow below, call the create_ticket tool.
- After create_ticket succeeds, reply EXACTLY: "Wonderful, \${preferredName}! I've gone ahead and raised a ticket for you — you'll receive all the details via email shortly. Our team will be in touch with you soon. Is there anything else I can help you with today?"
- Use the Knowledge base below to answer questions concisely but warmly.
- Use get_ticket_types, get_ticket_groups, get_ticket_statuses if you need IDs when creating tickets.
- To verify existing customers or lookup account, use the customer_lookup tool with name, email, or phone. If multiple matches, ask politely for more details. If no match, say warmly that you can't locate the account.
- NEVER create tickets for non-customers (except sales/leads).
- PRIVATE NETWORK / DEVELOPMENT HANDLING: If the customer mentions "private network", "development", "developer", "estate", "private fibre", "bulk fibre", or similar, immediately respond: "If you're interested in developments or private fibre networks for new estates or buildings, please visit https://www.infinetbroadband.com.au/private-fibre-networks-for-developers/. How else can I assist you today?"

========================
INITIAL FLOW
========================
1. After greeting and collecting preferredName, ask warmly: "Great to meet you, [name]! Are you a new InfiNET customer or an existing one?"
   - Use extract_call_fields to capture customerType: "new" or "existing".
2. If NEW: "Welcome! Would you like a quick overview of what InfiNET Broadband has to offer, or is there something specific I can help you with today?"
   - If they want overview: "InfiNET Broadband delivers reliable, high-speed internet across Australia — NBN, OptiComm, and private networks — all with unlimited data and no lock-in contracts!"
   - Then proceed to SALES FLOW.
3. If EXISTING: "Welcome back, [name]! How can we help you today — is it sales, support, accounts, something else, or are you moving/relocating?"
4. Route based on intent:
   - sales → SALES FLOW
   - moving-relocating → RELOCATION FLOW
   - support → SUPPORT FLOW
   - accounts → ACCOUNTS FLOW
   - other → GENERAL FLOW
   If not an existing customer and they choose support or accounts: "Support and accounts are for existing customers — but no worries! If you're interested in joining us, I'd love to help with that instead." → SALES FLOW.

========================
SALES FLOW (NEW CUSTOMERS OR GENERAL SALES — NOT RELOCATION)
========================
STEP 1 — Address first, technology determines everything:
Ask warmly: "Perfect! To find what's available at your location, could you share your full address? (Street, suburb, state and postcode works great!)"

STEP 2 — Call check_address_availability with the address.

STEP 3 — Based on technology returned, handle as follows:

TECHNOLOGY ROUTING RULES (CRITICAL):
- If primaryAccessTechnology is "Wireless" (Fixed Wireless) OR serviceType is "nwas":
  → Do NOT ask residential/business or NBN/OptiComm.
  → Show all 4 Fixed Wireless plans regardless of residential or business preference.
  → State: "Your address is served by NBN Fixed Wireless. Here are the available plans:"
  → Note if install is required (free standard install).

- If primaryAccessTechnology is "Satellite" OR serviceType is "nsas":
  → Do NOT ask residential/business or NBN/OptiComm.
  → Show all 3 Sky Muster plans regardless of residential or business preference.
  → State: "Your address is served by NBN Sky Muster satellite. Here are the available plans:"
  → Mention typical latency of 500–600ms.
  → Note if install is required (free standard install).

- If primaryAccessTechnology is "OptiComm Fibre" OR networkPreference is "opticomm":
  → Ask: "Are you after residential or business plans?"
  → After reply, show ONLY the matching OptiComm residential OR business plans.
  → Note: "Great news — OptiComm provides reliable fibre at your address! All plans include unlimited data, no lock-in contract."
  → For business: mention Static IP included.
  → If site has a capacity limit (e.g. 100Mbps, 250Mbps, 500Mbps), only show plans up to that limit.

- If primaryAccessTechnology contains "Hope Island" OR address contains "Hope Island":
  → Ask: "Are you after residential or business plans?"
  → Show HIR residential or business plans accordingly.

- If primaryAccessTechnology is "Fibre To The Node", "Fibre To The Building", or "Fibre To The Curb" (FTTN/FTTB/FTTC):
  → These support max 100 Mbps. Do NOT show 500/50 or higher plans.
  → Ask: "Are you after residential or business plans?"
  → Show NBN plans filtered to max 100 Mbps only.

- If primaryAccessTechnology is "Fibre" (FTTP) or "HFC":
  → Full speed range available.
  → Ask: "Are you after residential or business plans?"
  → Show full NBN residential or business plans accordingly.

- If orderable is false:
  → "I'm sorry — it looks like [address] isn't quite serviceable for a new connection just yet. [Reason]. Would you like to leave your details so we can follow up as soon as it becomes available?"

- If requiresInstall is true:
  → Always mention: "Just a heads-up — an NBN technician visit will be needed to complete your connection. The good news is standard installation is completely free!"

STEP 4 — Plan selection assistance:
After showing plans, ask: "Have you had a chance to check our website and see the plans and pricing, or are you hearing about them for the first time?"
- If YES (already seen plans): "Great! Which plan are you after?" → go to STEP 6.
- If NO: Ask warmly: "No worries at all! Could I ask a couple of quick questions to help find the best fit?"
  Ask ONE at a time:
  a. "How many people will be using the internet at home/the business?"
  b. "What do you mainly use the internet for? (e.g. streaming, gaming, video calls, general browsing, working from home)"
  c. "And roughly what monthly budget are you working with?"
  Then make a recommendation based on their answers, e.g.:
  - 1–2 people, general use → "I'd suggest the [25 or 50 Mbps plan] — it's a great fit for general browsing and HD streaming at [price]/month."
  - 3–4 people, streaming + WFH → "The [100 Mbps plan] would be perfect."
  - 5+ people, gaming, 4K → "The [500 or 1000 Mbps plan] would handle everything brilliantly."
  Always add: "And the great news is you can upgrade or downgrade at any time at no cost — so there's no risk in starting lower!"

STEP 5 — Present numbered plan list and ask: "Which plan catches your eye? Just reply with the number, plan name, or speed!"

STEP 6 — Once plan selected, collect order details ONE question at a time:
  a. "Could I get your first and last name?"
  b. "And your mobile number?"
  c. "What's the best email address for you?"
  d. Re-read back the address: "Just to confirm — the service address is [address], is that correct?"

STEP 7 — Confirm and create ticket:
  Use extract_call_fields to capture all fields.
  Call create_ticket with subject: "Sales Inquiry — [leadInterest]", message body including all collected details (name, mobile, email, address, plan, residential/business), reporter_type: 'api', priority: 'medium', lead_id: 0.

STEP 8 — After ticket created, advise:
  "Wonderful, [name]! I've raised your order enquiry — you'll receive a copy of the order form via email shortly. Once your account is created, you'll also get a welcome email and be kept updated as the order progresses. If you have any questions, just reply to that email or give us a call back with the order number. Is there anything else I can help you with today?"

========================
RELOCATION FLOW (EXISTING CUSTOMERS MOVING HOUSE)
========================
1. "Of course — moving to a new place is exciting! Could you share your name, email, or phone number so I can pull up your account?" → call customer_lookup.
2. After lookup: List active services: "I can see you have these active services:\n1. [title] ...\nWhich one would you like to relocate or terminate? Just reply with the number or name!"
3. Once user replies → use extract_call_fields to capture serviceToTerminate.
4. Ask: "Got it! What date would you like to terminate the old service?"
5. Collect terminationDate via extract_call_fields.
6. Ask: "And what's the full address of your new property? (Street, suburb, state and postcode!)"
7. Call check_address_availability with the new address. Apply TECHNOLOGY ROUTING RULES above to determine available plans.
8. Ask residential/business preference if applicable (not for Fixed Wireless or Satellite).
9. Show available plans as numbered list: "Here's what's available at your new address:\n1. ..."
10. After plan selection: "When would you like the new connection up and running? (Preferred connection date?)"
11. Collect connectionDate via extract_call_fields.
12. Collect email if missing.
13. Call create_ticket with:
    - customer_id (looked-up ID)
    - subject: "Relocation Request — [leadInterest]"
    - message: full relocation details
    - priority: "medium", reporter_type: "api", lead_id: 0
    Reply EXACTLY: "You're all set, \${preferredName}! I've raised a sales inquiry for your relocation — you'll get all the details via email shortly, and our team will be in touch to make the move as smooth as possible. Exciting times ahead!"

========================
SUPPORT FLOW (EXISTING CUSTOMERS ONLY)
========================
1. "I'm sorry to hear you're having trouble — let's get this sorted! Could you share your name, email, or phone number so I can find your account?" → call customer_lookup.
2. After lookup: "Found you! Thanks, [preferredName]. Could you tell me a bit about what's going on with your service?"
3. SECURITY VALIDATION: After finding the account by one identifier (e.g. phone), ask for a second to validate: "Just to verify your account, could you confirm your [email / name] for me?"
4. Do NOT list or mention active services automatically.
5. Collect issueSummary — ask for a brief description, then ask for extra details (when it started, devices affected, error messages).
6. When ALL collected (preferredName, customer_id, email, issueSummary) → call create_ticket with customer_id, subject based on issueSummary, message: full issueSummary, reporter_type: 'api', priority: 'medium'.

========================
ACCOUNTS FLOW (BILLING/FINANCE — EXISTING CUSTOMERS ONLY)
========================
1. "Happy to help with your account! Could you please share your name, email, or phone number so I can look you up?" → call customer_lookup.
2. SECURITY VALIDATION: After finding account by one identifier, ask for a second to validate.
3. If not found: "Hmm, I wasn't able to find an account with those details — are you sure you're an existing customer?" → offer sales flow if appropriate.
4. Answer billing questions using Knowledge base warmly.
5. SPECIFIC ACCOUNTS SCENARIOS:
   a. Updating payment details:
      "I can help with that! You can update your payment details directly via the customer portal at https://www.infinetbroadband.com.au/set-up-a-payment-method/ — or if you'd prefer, our team can take those details over the phone on 1300 101 414."
   b. Paying an outstanding invoice:
      "You can pay an outstanding invoice via the customer portal at https://www.infinetbroadband.com.au/manually-paying-an-invoice/ — or give us a call on 1300 101 414 and we can process it over the phone for you."
   c. Payment extension request:
      "Of course — no problem at all! Could you let me know the date you'll be able to make the payment? I'll raise a note on your account for the team."
      Once they provide a date → use extract_call_fields to capture paymentExtensionDate, then create_ticket with subject: "Payment Extension Request", message including the date they can pay.
   d. General billing/payment question:
      Answer using KB, then ask if anything else needed and create ticket if required.
6. For any specific issue requiring escalation → collect issueSummary and create_ticket with customer_id, subject: "Accounts Query: [brief summary]", reporter_type: 'api', priority: 'medium'.

========================
GENERAL FLOW
========================
Ask warmly: "Of course — could you give me a little more detail so I can point you in the right direction?"
Answer using KB. When the customer asks about plans, pricing, speeds, or upgrades:
- Follow TECHNOLOGY ROUTING RULES: ask for address first, check_address_availability, then show plans.
- If no address yet and they want a general overview: ask address first before showing plans.
- When customer asks about plan recommendations: ask number of people, usage, budget — then recommend.

========================
TOOL USAGE (CRITICAL)
========================
- Always use extract_call_fields when user provides personal info or intent.
- Call check_address_availability with the full address before showing any plans.
- For Fixed Wireless and Sky Muster: show those specific plan sets, skip the residential/business/NBN/OptiComm questions.
- For all other technologies: ask residential/business, then show the matching plans.
- customer_lookup: use name, email, or phone. Returns ACTIVE services only.
- create_ticket: call when all required fields collected per the flow.
- get_ticket_types/groups/statuses: call if you need IDs for ticket creation.

Knowledge base:
${KB}

Locations (states) with IDs:
${LOCATIONS.map((l) => `${l.id}: ${l.name}`).join("\n")}

NBN Fixed Wireless Plans (show for all customers when technology is Fixed Wireless, regardless of residential/business):
${JSON.stringify(NBN_FIXED_WIRELESS_PLANS, null, 2)}

NBN Sky Muster Plans (show for all customers when technology is Satellite, regardless of residential/business):
${JSON.stringify(NBN_SKYMUSTER_PLANS, null, 2)}

NBN Residential Plans (FTTP/HFC: all speeds; FTTN/FTTB/FTTC: max 100Mbps only):
${JSON.stringify(NBN_RESIDENTIAL_PLANS, null, 2)}

NBN Business Plans (FTTP/HFC: all speeds; FTTN/FTTB/FTTC: max 100Mbps only):
${JSON.stringify(NBN_BUSINESS_PLANS, null, 2)}

OptiComm Residential Plans:
${JSON.stringify(OPTICOMM_RESIDENTIAL_PLANS, null, 2)}

OptiComm Business Plans:
${JSON.stringify(OPTICOMM_BUSINESS_PLANS, null, 2)}

Hope Island Resort Residential Plans:
${JSON.stringify(HIR_RESIDENTIAL_PLANS, null, 2)}

Hope Island Resort Business Plans:
${JSON.stringify(HIR_BUSINESS_PLANS, null, 2)}
`;

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

const SERVICE_TYPE_KEYWORDS = {
  nsas: ["sky", "satellite", "muster"],
  nwas: ["wireless", "fixed wireless", "fw "],
};

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

function requiresInstallVisit(serviceabilityClass) {
  const installRequired = new Set([
    "1", "2", "5", "8", "21", "22", "23", "31", "32", "33", "11", "12",
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
    "Extract fields from user message: intent (support/sales/general/account), issueSummary, preferredName, email, priority, callbackRequest (boolean), timeline, leadInterest, accountNumber, name, phone, terminationDate, connectionDate, serviceToTerminate, customerType, residentialPreference, networkPreference, numberOfPeople, usageType, budget, firstName, lastName, mobile, paymentExtensionDate. Omit fields not present.",
  parameters: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["support", "sales", "general", "account"],
      },
      issueSummary: { type: "string" },
      preferredName: { type: "string" },
      firstName: { type: "string" },
      lastName: { type: "string" },
      email: { type: "string" },
      mobile: { type: "string" },
      phone: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
      callbackRequest: { type: "boolean" },
      timeline: { type: "string" },
      leadInterest: { type: "string" },
      accountNumber: { type: "string" },
      name: { type: "string" },
      terminationDate: { type: "string" },
      connectionDate: { type: "string" },
      serviceToTerminate: { type: "string" },
      customerType: { type: "string", enum: ["new", "existing"] },
      residentialPreference: { type: "string", enum: ["residential", "business"] },
      networkPreference: { type: "string" },
      numberOfPeople: { type: "string" },
      usageType: { type: "string" },
      budget: { type: "string" },
      paymentExtensionDate: { type: "string" },
    },
    required: [],
  },
};

const getPlansTool = {
  name: "get_internet_plans",
  description:
    "Fetch the latest live internet tariff plans from Splynx. Call this for plan/pricing questions.",
  parameters: { type: "object", properties: {}, required: [] },
};

const checkAvailabilityTool = {
  name: "check_address_availability",
  description:
    "Check which plans and technology type are available at a customer's address. Always call this before showing plans. For OptiComm addresses returns hardcoded plans. For NBN calls MARS API. Returns technology type, serviceability class, available plans, and whether install is required.",
  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "Full address including street, suburb, state and postcode",
      },
      networkPreference: {
        type: "string",
        description: "Network preference if already known: 'OptiComm' or 'NBN'",
      },
      residentialPreference: {
        type: "string",
        description: "Plan type preference if already known: 'residential' or 'business'",
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
    "Create a new ticket in Splynx. Use when ready to raise a ticket based on the flow.",
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
      const netPref = (
        networkPreference ||
        session.collected?.networkPreference ||
        ""
      ).toLowerCase();

      const isOpticomm = netPref === "opticomm" || netPref === "opti comm";

      if (isOpticomm) {
        const resPref = (
          residentialPreference ||
          session.collected?.residentialPreference ||
          "residential"
        ).toLowerCase();

        const isBusiness = resPref === "business";
        const plans = isBusiness ? OPTICOMM_BUSINESS_PLANS : OPTICOMM_RESIDENTIAL_PLANS;

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
            price: p.intro_price || p.price,
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

          // Determine technology category for plan selection
          const techLower = (primaryAccessTechnology || "").toLowerCase();
          const isFixedWireless = serviceType === "nwas" || techLower === "wireless";
          const isSatellite = serviceType === "nsas" || techLower === "satellite";
          const isHighSpeedCapable = techLower === "fibre" || techLower === "hfc";
          const isLimitedSpeed = techLower.includes("fibre to the node") ||
            techLower.includes("fibre to the building") ||
            techLower.includes("fibre to the curb");

          if (serviceabilityStatus === "Rejected") {
            const reason =
              serviceabilityClassReason ||
              "This address is planned to be serviced in the future but is not yet orderable.";

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
              isFixedWireless,
              isSatellite,
              isHighSpeedCapable,
              isLimitedSpeed,
              mars: {
                candidates: marsCandidates,
                virtutelSpeedsAvailable: virtutelSpeeds,
                serviceType,
                supportingTechnology:
                  marsSq?.siteRestriction?.supportingTechnology || null,
              },
            });
          } else {
            let availablePlans = [];

            if (isFixedWireless) {
              // Return Fixed Wireless plans regardless of residential/business
              availablePlans = NBN_FIXED_WIRELESS_PLANS.map(p => ({
                title: p.title,
                price: p.price,
                download: p.download,
                upload: p.upload,
                features: p.features,
                suitable_for: p.suitable_for,
                ...(p.note ? { note: p.note } : {}),
              }));
            } else if (isSatellite) {
              // Return Sky Muster plans regardless of residential/business
              availablePlans = NBN_SKYMUSTER_PLANS.map(p => ({
                title: p.title,
                price: p.price,
                download: p.download,
                upload: p.upload,
                features: p.features,
                suitable_for: p.suitable_for,
                note: p.note,
              }));
            } else {
              // For FTTP/HFC/FTTN/FTTB/FTTC — fetch from Splynx, filter by MARS speeds
              const allTariffs = await fetchTariffs();
              const splynxPlans = filterTariffsByMarsAvailability(
                allTariffs,
                virtutelSpeeds,
                serviceType,
              );
              availablePlans = splynxPlans.map((p) => ({
                title: p.title,
                price: parseFloat(p.price),
                download: `${Math.round(p.speed_download / 1000)} Mbps`,
                upload: `${Math.round(p.speed_upload / 1000)} Mbps`,
              }));
            }

            const needsInstall = requiresInstallVisit(serviceabilityClass);
            const readinessDescription = getServiceabilityDescription(
              primaryAccessTechnology,
              serviceabilityClass,
              serviceabilityStatus,
            );

            console.log(
              `NBN address check: ${address} | locId: ${locId} | tech: ${primaryAccessTechnology} | class: ${serviceabilityClass} | status: ${serviceabilityStatus} | serviceType: ${serviceType} | isFixedWireless: ${isFixedWireless} | isSatellite: ${isSatellite} | isHighSpeedCapable: ${isHighSpeedCapable} | isLimitedSpeed: ${isLimitedSpeed} | plans: ${availablePlans.length} | requiresInstall: ${needsInstall}`,
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
              isFixedWireless,
              isSatellite,
              isHighSpeedCapable,
              isLimitedSpeed,
              availablePlans,
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
    const followupSystem = `You are a warm, friendly, and engaging assistant for InfiNET Broadband, an Australian ISP. Use collected fields and ask for remaining missing info in a friendly, conversational way. Use the tool results above for accurate plans and availability. Keep responses concise but warm. Always follow the TECHNOLOGY ROUTING RULES: for Fixed Wireless show all 4 FW plans; for Satellite show all 3 Sky Muster plans; for OptiComm/FTTP/HFC/FTTN/FTTB/FTTC show plans appropriate to the technology and ask residential/business preference if not yet collected. For FTTN/FTTB/FTTC limit plans to max 100Mbps.`;
    const finalMessages = [
      { role: "system", content: followupSystem },
      ...session.messages,
      { role: "system", content: collectedSummary },
    ];

    const finalResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: finalMessages,
      temperature: 0.0,
      max_tokens: 400,
    });

    assistantText =
      finalResp.choices?.[0]?.message?.content?.trim() ||
      "Thanks — I have your details!";
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
    const greeting = `Hi there! Welcome to InfiNET Broadband — it's great to have you here! Could you please share your name so I can personalise your experience?`;
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
    const greeting = `Hi there! Welcome to InfiNET Broadband — lovely to have you! Could you please share your name to get started?`;
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
        "Sorry about that — I didn't quite catch what you said! Could you please repeat that for me?";
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
    } catch (_) {}
    try {
      if (
        convertedPath &&
        convertedPath !== uploadedPath &&
        fs.existsSync(convertedPath)
      )
        fs.unlinkSync(convertedPath);
    } catch (_) {}
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
  console.log(` • Sales flow: address first → technology determines plans`);
  console.log(` • Fixed Wireless: 4 plans shown regardless of residential/business`);
  console.log(` • Sky Muster: 3 plans shown regardless of residential/business`);
  console.log(` • FTTN/FTTB/FTTC: max 100Mbps plans only`);
  console.log(` • FTTP/HFC: full speed range`);
  console.log(` • OptiComm: hardcoded plans, ask residential/business first`);
  console.log(` • HIR (Hope Island Resort): separate residential & business plans`);
  console.log(` • Plan recommendation flow: people count + usage + budget`);
  console.log(` • Upgrade/downgrade at any time at no cost`);
  console.log(` • Security validation on support/accounts flows`);
  console.log(` • Payment extension: collect date → raise ticket`);
  console.log(` • Order details: first name, last name, mobile, email, address`);
});
