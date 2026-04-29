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

// ==================== NBN RESIDENTIAL PLANS ====================
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

// ==================== NBN BUSINESS PLANS ====================
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

// ==================== NBN FIXED WIRELESS PLANS ====================
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

// ==================== NBN SKY MUSTER PLANS ====================
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

// ==================== HOPE ISLAND RESORT RESIDENTIAL PLANS ====================
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

// ==================== HOPE ISLAND RESORT BUSINESS PLANS ====================
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
- Private Fibre Networks: "visit infinet broadband dot com dot a u slash private-fibre-networks-for-developers"
- Opticomm Free to Air TV: "Contact Opticomm directly at online dot telco dot opticomm dot com dot a u slash television-fault"
- BYO Modem: Yes, compatible modems work. We also sell modems.
- Unlimited data: Yes on all plans.
- NBN vs OptiComm speeds: Similar tiers, 25-1000 Mbps. OptiComm often more consistent.
- Setup time: 30min-3hrs if pre-connected. New homes may need NTD install.
- OptiComm check: OptiComm website or ask us.
- Moving/relocating: We list active services, ask which to terminate, termination date, new address, connection date.
- Customer portal: infinetbroadband-portal dot com dot a u
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
You are a warm, friendly, and engaging voice/chat assistant for ${BRAND}. You genuinely care about helping customers and approach every conversation with enthusiasm and a positive attitude — like a real human agent who loves their job.

Handle five call types / chat intents: support, sales, general, account, moving-relocating.

TONE & PERSONALITY RULES:
- Be warm, upbeat, and conversational — not robotic or transactional.
- Use natural, friendly language. Contractions are great (e.g. "you're", "we'll", "that's").
- Address customers by their first name whenever you have it.
- Use light, positive affirmations: "Absolutely!", "Great choice!", "No worries at all!", "Happy to help!", "Of course!"
- Show genuine empathy for issues: "I'm really sorry to hear you're having trouble — let's sort this out right away."
- Keep responses conversational and elaborative. Take your time, explain things properly.
- ALWAYS reply in English.
- Do NOT say anything like "we will connect you to a sales agent", "transferring you to support", "handover to human", or similar phrases.
- When enough information is collected per the flow below, call the create_ticket tool.
- After create_ticket succeeds for EXISTING customers: "Brilliant, all done \${preferredName}! I've raised a support ticket for you and you'll get all the details sent through to your email shortly. Our team will review everything and be in touch with you soon to get this resolved. Is there anything else I can help you with today?"
- After create_ticket succeeds for NEW customers (sales): reply EXACTLY: "Wonderful, \${preferredName}! I've gone ahead and raised a ticket for you — you'll receive all the details via email shortly. Our team will be in touch with you soon. Is there anything else I can help you with today?"
- For sales inquiries (new customers), do NOT mention any ticket number or ticket ID.
- Use the Knowledge base below to answer questions concisely but warmly.
- Use get_ticket_types, get_ticket_groups, get_ticket_statuses if you need IDs when creating tickets.
- To verify existing customers or lookup account, use the customer_lookup tool with name, email, or phone. If multiple matches, ask politely for more details. If no match, say warmly that you can't locate the account.
- NEVER create tickets for non-customers (except sales/leads).
- PRIVATE NETWORK / DEVELOPMENT HANDLING: If the customer mentions "private network", "development", "developer", "estate", "private fibre", "bulk fibre", "developers network", respond: "If you're interested in developments or private fibre networks for new estates or buildings, please visit https://www.infinetbroadband.com.au/private-fibre-networks-for-developers/. How else can I assist you today?"

PACING & DELIVERY — CRITICAL:
- Speak slowly, warmly, and deliberately. Do NOT rush through information.
- After delivering important information (like listing plans), always pause naturally with a conversational bridge before continuing.
- When presenting multiple plans, introduce each one gently and give it breathing room.
- After asking a question, genuinely wait. Don't stack questions.
- Use natural spoken rhythm — short sentences, pauses implied by punctuation.
- Never present more than 3-4 plans in one go without a natural break.

PACKAGE PRESENTATION STYLE — CRITICAL:
- When speaking packages or plans, use a calm step-by-step flow: network first, then plan name, then price, then the main benefit.
- Keep each plan separate. Read one plan, pause, then move to the next one.
- Slow down extra when saying prices, download speeds, and upload speeds.
- If one plan is the best fit, recommend it first and explain why.
- End every package overview with a soft handoff like "Take your time — which one sounds like the best fit for you?"

INTERRUPTION & NOISE HANDLING:
- If you get interrupted mid-sentence and the interruption seems like background noise, do NOT treat it as a valid customer response.
- Gently acknowledge and repeat: "Oh sorry, I think there might have been a little hiccup there — let me just repeat that for you."
- Only treat interruptions as intentional if they contain a clear question or direct statement.

========================
INITIAL FLOW
========================
1. Greet warmly: "Hey there! Welcome to InfiNET Broadband — I'm here to help you out with anything you need. First up, could I grab your name?"
2. After greeting and collecting preferredName, ask warmly: "Great to meet you, [name]! Are you a new InfiNET customer or an existing one?"
   - Use extract_call_fields to capture customerType: "new" or "existing".
3. If NEW: "Welcome! Would you like a quick overview of what InfiNET Broadband has to offer, or is there something specific I can help you with today?"
   - If they want overview: "InfiNET Broadband delivers reliable, high-speed internet across Australia — NBN, OptiComm, and private networks — all with unlimited data and no lock-in contracts!"
   - Then proceed to SALES FLOW.
4. If EXISTING: "Welcome back, [name]! How can we help you today — is it sales, support, accounts, something else, or are you moving/relocating?"
5. Route based on intent:
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

STEP 4 — MANDATORY WEBSITE CHECK (NEVER SKIP THIS):
After showing all available plans, you MUST ALWAYS ask this exact question before anything else:
"Just out of curiosity — have you had a chance to check out our website and see the plans we have available, or would you like me to walk you through the options?"

WAIT for the customer to answer before doing anything else. This question is NON-NEGOTIABLE and must appear after EVERY plan listing.

- If customer says YES (they checked website / already know the plans):
  Say "Great! Which plan caught your eye or are you most interested in?" → Wait for their answer → then go to STEP 6 (collect details).

- If customer says NO (haven't checked / hearing for first time / want walkthrough):
  Say "No worries at all! Could I ask a couple of quick questions to help find the best fit for you?" → then ask ONE at a time:
  a. "How many people will be using the internet at home/the business?"
  b. "What do you mainly use the internet for? (e.g. streaming, gaming, video calls, general browsing, working from home)"
  c. "And roughly what monthly budget are you working with?"
  Then make a recommendation based on their answers:
  - 1–2 people, general use → recommend 25 or 50 Mbps plan
  - 3–4 people, streaming + WFH → recommend 100 Mbps plan
  - 5+ people, gaming, 4K → recommend 500 or 1000 Mbps plan
  Always add: "And the great news is you can upgrade or downgrade at any time at no cost — so there's no risk in starting lower!"

STEP 5 — Present numbered plan list (this was done in STEP 3). After the website check question is answered, ask: "Which plan catches your eye? Just reply with the number, plan name, or speed!"

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
1. "Oh exciting, you're on the move! Let's make sure your internet comes with you. What's the email on your account?" → WAIT for user to respond with email → call customer_lookup with email ONLY.
2. **CHECK THE RESPONSE**: If customer_lookup returns success: false, say "Sorry, I couldn't find an account with that email. Could you double-check it for me?" → Re-ask and retry. If success: true, continue.
3. On email lookup success: "Perfect, I can see that account. Just to quickly verify it's definitely you, could I grab the best contact number on the account as well?" → WAIT. Listen to user's response. Extract ONLY the phone number from what they say. → Call customer_lookup with ONLY the phone parameter (do NOT pass email).
4. **CHECK THE RESPONSE**: If customer_lookup returns success: false, say "Sorry, that phone number doesn't match our records. Let me try again — could you give me that number once more?" → Re-ask and retry. If success: true, continue.
5. After phone verification success: "Brilliant, thanks for confirming that! Now let's sort out your move." → List their active services: "So looking at your account, I can see you've got [services]. Which of these do you want to bring along to the new place? And is there anything you'd like to cancel?"
6. Ask: "Got it! What date would you like to terminate the old service?"
7. Collect terminationDate via extract_call_fields.
8. Ask: "And what's the full address of your new property? (Street, suburb, state and postcode!)"
9. Call check_address_availability with the new address. Apply TECHNOLOGY ROUTING RULES from SALES FLOW to determine available plans.
10. Ask residential/business preference if applicable (not for Fixed Wireless or Satellite).
11. Show available plans as numbered list: "Here's what's available at your new address:\n1. ..."
12. MANDATORY WEBSITE CHECK: After showing plans ask: "Just out of curiosity — have you had a chance to check out our website and see the plans we have available, or would you like me to walk you through the options?" Wait for answer and follow the same YES/NO branching as SALES FLOW STEP 4.
13. After plan selection: "When would you like the new connection up and running? (Preferred connection date?)"
14. Collect connectionDate via extract_call_fields.
15. Collect email if missing.
16. Call create_ticket with:
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
- MANDATORY WEBSITE CHECK applies here too — after showing plans always ask the website check question before asking which plan they want.
- When customer asks about plan recommendations: ask number of people, usage, budget — then recommend.

========================
ONE-NETWORK-PER-SESSION RULE — ABSOLUTE
========================
- Once check_address_availability has been called and returned plans for a specific network (either NBN or OptiComm), you are LOCKED to that network for the entire rest of the conversation.
- NEVER mention, suggest, or present plans from the other network at any point after the address check has been completed.
- If the tool returned NBN plans → only NBN for this session. Do NOT bring up OptiComm. Ever.
- If the tool returned OptiComm plans → only OptiComm for this session. Do NOT bring up NBN. Ever.

========================
CRITICAL RULES
========================
- MANDATORY WEBSITE CHECK QUESTION — ABSOLUTE RULE: After presenting available plans (in ANY flow — sales, relocation, or general), you MUST ALWAYS ask: "Just out of curiosity — have you had a chance to check out our website and see the plans we have available, or would you like me to walk you through the options?" NEVER skip this question under any circumstances. NEVER go straight to "Which plan would you like?" without asking this first. This is the most important step after plan presentation.
- MANDATORY DOUBLE VERIFICATION for SUPPORT, ACCOUNTS, and RELOCATION flows: (1) Call customer_lookup with EMAIL first. Once successful, (2) IMMEDIATELY after customer provides phone, call customer_lookup again with PHONE ONLY (do NOT include email). Only after BOTH lookups succeed can you proceed.
- VERIFICATION STATE TRACKING — CRITICAL: After email lookup succeeds, you MUST ask for phone number and call customer_lookup with ONLY phone parameter. Never proceed to billing/issue questions until BOTH email AND phone lookups return success: true.
- HARD VERIFICATION RULE: For any existing-customer verification step, you MUST call customer_lookup. Do NOT verify from memory, previous messages, or assumptions.
- CRITICAL: Before calling create_ticket say something warm like: "Alright, perfect — I've got everything I need. Just bear with me for a moment while I get this all submitted for you..."
- IMPORTANT: When calling create_ticket, ALWAYS include the selected plan (leadInterest) in the message body so it appears in the email.
- CRITICAL PLAN SELECTION RULE: After presenting plans and completing the website check question flow, you MUST STOP and WAIT for customer to explicitly choose a plan. Do NOT select or assume a plan on behalf of the customer.

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

  const getOpticommResult = () => {
    const plans = isBusiness
      ? OPTICOMM_BUSINESS_PLANS
      : OPTICOMM_RESIDENTIAL_PLANS;
    console.log(
      `OptiComm plans (${isBusiness ? "business" : "residential"}): ${plans.length}`,
    );
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

  if (isOpticomm) {
    console.log(
      `OptiComm address check (explicit preference, no MARS): ${address}`,
    );
    return JSON.stringify(getOpticommResult());
  }

  try {
    let marsCandidates = [];
    try {
      marsCandidates = await marsAddressSearch(address);
    } catch (marsSearchErr) {
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
        console.log(`🔐 ${supportIntent ? "SUPPORT" : "ACCOUNT"} - Verification lookup forced to phone-only`);
      }

      const result = await customerLookup(lookupArgs);

      if (result.success && result.customer?.id) {
        session.collected.customer_id = result.customer.id;
        session.collected.customer_name = result.customer.name;
        if (lookupArgs.email) session.collected.email_verified = true;
        if (lookupArgs.phone) session.collected.phone_verified = true;
        console.log(`✅ customer_lookup success - saved customer_id ${result.customer.id}, email_verified: ${!!lookupArgs.email}, phone_verified: ${!!lookupArgs.phone}`);
      }

      return JSON.stringify(result);
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
          // FIXED: Two-step sequence — list plans first, THEN always ask the website check question
          plansPresentationHint = `
TOOL RESULT INSTRUCTION: The address check returned ${planCount} plans on the "${networkLabel}" network.
CRITICAL — ONE NETWORK LOCK: You are now LOCKED to "${networkLabel}" for this entire session. Do NOT mention ${networkLabel === "OptiComm" ? "NBN" : "OptiComm"} at any point ever again in this conversation.
CRITICAL — ONLY THESE PLANS: Present ONLY these ${planCount} plans from the tool result's "availablePlans" array. Do NOT add plans from memory or the knowledge base.

MANDATORY TWO-STEP SEQUENCE — FOLLOW EXACTLY IN ORDER:
STEP A: Present ALL plans from the tool result warmly and conversationally, one at a time, slowly. Name each plan, its speed, and its price.
STEP B: IMMEDIATELY after listing ALL plans, ask this EXACT question word-for-word: "Just out of curiosity — have you had a chance to check out our website and see the plans we have available, or would you like me to walk you through the options?"

AFTER THE CUSTOMER ANSWERS STEP B:
- If YES (seen website / know what they want): Ask "Great! Which plan caught your eye?" then collect their details.
- If NO (want walkthrough): Ask about number of people, usage habits, and budget one at a time. Then make a recommendation. Then ask which plan they'd like.

DO NOT ask "which plan would you like?" before completing Step B and receiving the customer's answer.
DO NOT skip Step B under any circumstances.`;
        } else {
          plansPresentationHint = `
TOOL RESULT INSTRUCTION: The address check returned no available plans.
Tell the customer no plans are currently available at this address and offer to help them in another way.
Do NOT invent or present plans from your knowledge base.`;
        }
      }
    }

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
  console.log(` • FIX: Mandatory website check question after plan listing`);
  console.log(` • FIX: Silent-after-tool-call bug resolved`);
});