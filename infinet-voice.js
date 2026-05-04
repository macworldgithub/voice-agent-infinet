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
  console.error("âŒ Please set OPENAI_API_KEY in your .env file");
  process.exit(1);
}
if (!ELEVENLABS_API_KEY) {
  console.error("âŒ Please set ELEVENLABS_API_KEY in your .env file");
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
  console.warn("âš ï¸ SMTP_PASS not set - email notifications DISABLED");

async function sendTicketEmail(
  ticketId,
  ticketArgs,
  collectedFields,
  isSupportTicket = false,
) {
  if (!process.env.SMTP_PASS) {
    console.warn("âš ï¸ SMTP_PASS not set - skipping email");
    return { sent: false, reason: "SMTP not configured" };
  }
  const recipient = isSupportTicket
    ? "support@infinetbroadband.com.au"
    : "sales@infinetbroadband.com.au";
  const type = isSupportTicket ? "Support" : "Sales";
  const referenceLine = ticketId
    ? `<p><strong>Ticket:</strong> ${ticketId}</p>`
    : `<p><strong>Reference:</strong> New ${type.toLowerCase()} enquiry</p>`;
  const subject = `New ${type} Enquiry ${ticketId ? `- Ticket #${ticketId}` : ""} - ${ticketArgs.subject || "Inquiry"}`;

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
    ${isSupportTicket && ticketId ? `View ticket: https://infinetbroadband-portal.com.au/admin/support/tickets/${ticketId}` : `This is a ${type.toLowerCase()} enquiry - to be followed up manually.`}
    </small></p>
  </body></html>`;
  try {
    const recipients = ["karimjawwad09@gmail.com", recipient];
    console.log(
      `Attempting to send ${type} email to: ${recipients.join(", ")}${userEmail ? ` (Reply-To: ${userEmail})` : ""}`,
    );
    await transporter.sendMail({
      from: '"InfiNET AI Assistant" <noreply@infinetbroadband.com.au>',
      to: recipients,
      ...(userEmail ? { replyTo: userEmail } : {}),
      subject,
      html,
    });
    console.log(
      `Email SENT for ${type.toLowerCase()} enquiry${ticketId ? ` #${ticketId}` : ""}`,
    );
    return { sent: true };
  } catch (err) {
    console.error(
      `Email FAILED for ${type.toLowerCase()} enquiry:`,
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
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Web browsing & Social Media",
    ],
  },
  {
    title: "NBN 50/20Mbps Standard",
    download: "50 Mbps",
    upload: "20 Mbps",
    intro_price: 74,
    ongoing_price: 79,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Web browsing & Social Media",
    ],
  },
  {
    title: "NBN 100/20Mbps Fast",
    download: "100 Mbps",
    upload: "20 Mbps",
    intro_price: 84,
    ongoing_price: 89,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Web browsing & Social Media",
      "Fast Downloading",
      "Gaming",
    ],
  },
  {
    title: "NBN 500/50Mbps Faster",
    download: "500 Mbps",
    upload: "50 Mbps",
    intro_price: 84,
    ongoing_price: 89,
    discount: "$5 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Super Fast Downloading",
      "All Gaming Applications",
      "Low latency",
    ],
  },
  {
    title: "NBN 750/50Mbps Superfast",
    download: "750 Mbps",
    upload: "50 Mbps",
    intro_price: 89,
    ongoing_price: 99,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Super Fast Downloading",
      "All Gaming Applications",
      "Low latency",
    ],
  },
  {
    title: "NBN 1000/100Mbps Ultrafast",
    download: "1000 Mbps",
    upload: "100 Mbps",
    intro_price: 99,
    ongoing_price: 109,
    discount: "$10 off for 3 months",
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 4K",
      "Super Fast Uploads/Downloads",
      "All Gaming Applications",
      "Low latency",
    ],
  },
];

// ==================== NBN BUSINESS PLANS ====================
const NBN_BUSINESS_PLANS = [
  {
    title: "NBN Business 50/20Mbps Basic",
    download: "50 Mbps",
    upload: "20 Mbps",
    price: 89,
    intro_price: 89,
    ongoing_price: 89,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD + 4K",
      "Web browsing & Social Media",
    ],
  },
  {
    title: "NBN Business 100/40Mbps Fast",
    download: "100 Mbps",
    upload: "40 Mbps",
    price: 99,
    intro_price: 99,
    ongoing_price: 99,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: [
      "VoIP / Business IP Phones",
      "Video Calls / Teams",
      "Streaming HD + 4K",
      "Moderate Uploads/Downloads",
      "All Gaming",
    ],
  },
  {
    title: "NBN Business 250/100Mbps Faster",
    download: "250 Mbps",
    upload: "100 Mbps",
    price: 149,
    intro_price: 149,
    ongoing_price: 149,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: [
      "VoIP / Business IP Phones",
      "Video Calls / Teams",
      "Streaming HD + 4K",
      "Super Fast Uploads/Downloads",
      "All Gaming",
    ],
  },
  {
    title: "NBN Business 500/200Mbps Superfast",
    download: "500 Mbps",
    upload: "200 Mbps",
    price: 189,
    intro_price: 189,
    ongoing_price: 189,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: [
      "VoIP / Business IP Phones",
      "Video Calls / Teams",
      "Streaming HD + 4K",
      "Super Fast Uploads/Downloads",
      "All Gaming",
    ],
  },
  {
    title: "NBN Business 1000/400Mbps Ultrafast",
    download: "1000 Mbps",
    upload: "400 Mbps",
    price: 239,
    intro_price: 239,
    ongoing_price: 239,
    features: ["Unlimited Data", "No Contract", "Month to Month", "Static IP"],
    suitable_for: [
      "VoIP / Business IP Phones",
      "Video Calls / Teams",
      "Streaming HD + 4K",
      "Super Fast Uploads/Downloads",
      "All Gaming",
    ],
  },
];

// ==================== NBN FIXED WIRELESS PLANS ====================
const NBN_FIXED_WIRELESS_PLANS = [
  {
    title: "NBN 25/5Mbps Fixed Wireless Standard",
    download: "25 Mbps",
    upload: "5 Mbps",
    price: 59,
    intro_price: 59,
    ongoing_price: 59,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Setup",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Emails, Web browsing & Social Media",
    ],
  },
  {
    title: "NBN 100/20Mbps Fixed Wireless Plus",
    download: "100 Mbps",
    upload: "20 Mbps",
    price: 89,
    intro_price: 89,
    ongoing_price: 89,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Setup",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p + 4K",
      "Web browsing & Social Media",
      "Fast Downloading",
      "All Gaming Applications",
    ],
  },
  {
    title: "NBN 200/20Mbps Fixed Wireless HomeFast",
    download: "200 Mbps",
    upload: "20 Mbps",
    price: 99,
    intro_price: 99,
    ongoing_price: 99,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Setup",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p + 4K",
      "Web browsing & Social Media",
      "Fast Downloading",
      "All Gaming Applications",
    ],
  },
  {
    title: "NBN 400/40Mbps Fixed Wireless SuperFast",
    download: "400 Mbps",
    upload: "40 Mbps",
    price: 109,
    intro_price: 109,
    ongoing_price: 109,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Setup",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p + 4K",
      "Web browsing & Social Media",
      "Super Fast Uploads/Downloads",
      "All Gaming Applications",
    ],
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
    intro_price: 59,
    ongoing_price: 59,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Installation",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Web browsing & Social Media",
    ],
    note: "Typical latency 500-600ms",
  },
  {
    title: "NBN Sky Muster Plus 50/5Mbps Fast",
    download: "50 Mbps",
    upload: "5 Mbps",
    price: 69,
    intro_price: 69,
    ongoing_price: 69,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Installation",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p",
      "Web browsing & Social Media",
      "Some Gaming Applications",
    ],
    note: "Typical latency 500-600ms",
  },
  {
    title: "NBN Sky Muster Plus 100/5Mbps Ultra",
    download: "100 Mbps",
    upload: "5 Mbps",
    price: 99,
    intro_price: 99,
    ongoing_price: 99,
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free NBN Installation",
    ],
    suitable_for: [
      "Video Calls / Teams",
      "Streaming HD Video + 1080p + 4K",
      "Web browsing & Social Media",
      "Super Fast Uploads/Downloads",
      "All Gaming Applications",
    ],
    note: "Typical latency 500-600ms",
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
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free modem upgrade if required",
    ],
    suitable_for: [
      "Video Calls",
      "4K Streaming",
      "Super Fast Downloading",
      "All Gaming",
    ],
  },
  {
    title: "HIR 750/50Mbps Superfast",
    download: "750 Mbps",
    upload: "50 Mbps",
    intro_price: 74,
    ongoing_price: 89,
    discount: "$15 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free modem upgrade if required",
    ],
    suitable_for: [
      "Video Calls",
      "4K Streaming",
      "Super Fast Downloading",
      "All Gaming",
      "Low latency",
    ],
  },
  {
    title: "HIR 1000/100Mbps Ultrafast",
    download: "1000 Mbps",
    upload: "100 Mbps",
    intro_price: 84,
    ongoing_price: 99,
    discount: "$15 off for 3 months",
    features: [
      "Unlimited Data",
      "No Contract",
      "Month to Month",
      "Free modem upgrade if required",
    ],
    suitable_for: [
      "Video Calls",
      "4K Streaming",
      "Super Fast Uploads/Downloads",
      "All Gaming",
      "Low latency",
    ],
  },
];

// ==================== HOPE ISLAND RESORT BUSINESS PLANS ====================
const HIR_BUSINESS_PLANS = [
  {
    title: "HIR Business 250/100Mbps",
    download: "250 Mbps",
    upload: "100 Mbps",
    price: 109,
    intro_price: 109,
    ongoing_price: 109,
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "VoIP",
      "Video Calls",
      "4K Streaming",
      "Fast Uploads/Downloads",
    ],
  },
  {
    title: "HIR Business 500/200Mbps",
    download: "500 Mbps",
    upload: "200 Mbps",
    price: 119,
    intro_price: 119,
    ongoing_price: 119,
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "VoIP",
      "Video Calls",
      "4K Streaming",
      "Super Fast Uploads/Downloads",
    ],
  },
  {
    title: "HIR Business 1000/400Mbps",
    download: "1000 Mbps",
    upload: "400 Mbps",
    price: 139,
    intro_price: 139,
    ongoing_price: 139,
    features: ["Unlimited Data", "No Contract", "Month to Month"],
    suitable_for: [
      "VoIP",
      "Video Calls",
      "4K Streaming",
      "Ultra Fast Uploads/Downloads",
      "All Gaming",
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
  TC4FWP: { dl: 25, ul: 5 },
  TC4FWHF: { dl: 100, ul: 20 },
  TC4FWSF: { dl: 200, ul: 20 },
  TC4FWUF: { dl: 400, ul: 40 },
};
Object.keys(MARS_SPEED_MAP).forEach((k) => {
  MARS_SPEED_MAP["L3" + k] = MARS_SPEED_MAP[k];
});

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
      return "Fibre serviceable - no drop or NTD in place. Technician visit required for installation.";
    if (cls === "2")
      return "Fibre drop in place - NTD not yet installed. Technician visit required to complete installation.";
    if (cls === "3")
      return "Fibre fully installed (drop + NTD in place). Ready to connect - typically 1-5 business days.";
  }
  if (tech === "hfc") {
    if (cls === "21")
      return "HFC serviceable - lead-in, PCD, and internal cabling required. Technician visit needed.";
    if (cls === "22")
      return "HFC lead-in & PCD in place - internal cabling with wall plates still needed. Technician visit required.";
    if (cls === "23")
      return "HFC wall plate present - NTD not yet installed. Technician visit required.";
    if (cls === "24")
      return "HFC fully installed (wall plate + NTD in place). Ready to connect.";
  }
  if (tech === "wireless") {
    if (cls === "5")
      return "Fixed Wireless serviceable - CPE (antenna/NTD) not yet installed. Technician visit required. Standard install is free.";
    if (cls === "6")
      return "Fixed Wireless fully installed (CPE in place). Ready to connect. Note: Superfast tier may require WNTD upgrade appointment.";
  }
  if (tech === "satellite") {
    if (cls === "8")
      return "Satellite serviceable - dish and NTD not yet installed. Technician visit required. Standard install is free. Typical latency: 500-600ms.";
    if (cls === "9")
      return "Satellite fully installed (dish + NTD in place). Ready to connect. Typical latency: 500-600ms.";
  }
  if (tech === "fibre to the node") {
    if (cls === "11")
      return "FTTN serviceable - active node present. Technician visit may be required for jumpering.";
    if (cls === "12")
      return "FTTN serviceable - jumpering required. Technician visit needed.";
    if (cls === "13") return "FTTN infrastructure in place. Ready to connect.";
  }
  if (tech === "fibre to the building") {
    if (cls === "12")
      return "FTTB serviceable - jumpering required. Technician visit needed.";
    if (cls === "13") return "FTTB infrastructure in place. Ready to connect.";
  }
  if (tech === "fibre to the curb") {
    if (cls === "31")
      return "FTTC serviceable - no copper line available yet (NCD required). Technician visit needed.";
    if (cls === "32")
      return "FTTC serviceable - cut-in required (NCD needed). Technician visit required.";
    if (cls === "33")
      return "FTTC cut-in complete - NCD still required. Technician visit needed.";
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
    `Mars token generated. Expires in: ${expiresInSec} seconds (${Math.round(expiresInSec / 60)} minutes)`,
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
    console.log("âœ… Splynx Access token generated");
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
    console.log("âœ… Splynx Access token renewed");
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
Knowledge base for InfeNET Broadband:
- Greeting / Routing: "Thanks for calling InfeNET Broadband, how may we help you today? Would it be sales, support, accounts, other, or moving/relocating?"
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
  - 25/10 Basic: $59/m ($5 off 3m, then $64) - FTTC/FTTN/FTTB/FTTP/HFC
  - 50/20 Standard: $74/m ($5 off 3m, then $79) - FTTC/FTTN/FTTB/FTTP/HFC
  - 100/20 Fast: $84/m ($5 off 3m, then $89) - FTTC/FTTN/FTTB/FTTP/HFC
  - 500/50 Faster: $84/m ($5 off 3m, then $89) - FTTP/HFC only
  - 750/50 Superfast: $89/m ($10 off 3m, then $99) - FTTP/HFC only
  - 1000/100 Ultrafast: $99/m ($10 off 3m, then $109) - FTTP/HFC only
  OptiComm Residential (FTTP, reliable fibre):
  - 25/10: $64/m ($5 off 3m, then $69)
  - 50/20: $74/m ($5 off 3m, then $79)
  - 100/20: $84/m ($5 off 3m, then $89) - for communities with limited capacity of 100Mbps
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
  - 50/20 Basic: $89/m - FTTC/FTTN/FTTB/FTTP/HFC
  - 100/40 Fast: $99/m - FTTC/FTTN/FTTB/FTTP/HFC
  - 250/100 Faster: $149/m - FTTP/HFC only
  - 500/200 Superfast: $189/m - FTTP/HFC only
  - 1000/400 Ultrafast: $239/m - FTTP/HFC only
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
You speak like a real human customer service agent who genuinely enjoys chatting with people - not a script-reading robot.
You take your time, you elaborate, you explain things properly, and you make customers feel like they're having a real conversation with someone who cares.
Handle five call types: support, sales, general, account, moving-relocating.

PACING & DELIVERY - CRITICAL:
- Speak slowly, warmly, and deliberately. Do NOT rush through information.
- After delivering important information (like listing plans), always pause naturally with a conversational bridge before continuing. For example: "So that's a quick overview - take your time looking those over, there's absolutely no rush at all."
- When presenting multiple plans, introduce each one gently and give it breathing room. Don't rattle them off like a list.
- After asking a question, genuinely wait. Don't stack questions.
- Use natural spoken rhythm - short sentences, pauses implied by punctuation, easy-to-listen-to language.
- Never present more than 3-4 plans in one go without a natural break like "So those are the first few - want me to keep going or does one of those already sound interesting?"

PACKAGE PRESENTATION STYLE - CRITICAL:
- When speaking packages or plans, use a calm step-by-step flow: network first, then plan name, then price, then the main benefit.
- Keep each plan separate. Read one plan, pause, then move to the next one.
- Slow down extra when saying prices, download speeds, and upload speeds so the customer can catch every detail.
- Prefer simple spoken phrasing like "This one is great if..." or "That plan suits..." instead of technical wording.
- WHEN READING SPEEDS AND TECHNICAL TERMS — SPEAK NATURALLY:
  * "Mbps" → say "megabits per second" — never spell out M-B-P-S
  * "25/10" → say "25 download, 10 upload" or "25 by 10" — never say "25 slash 10"
  * "1000/100" → say "1000 download, 100 upload" or "a thousand by a hundred"
  * Plan names like "25/10Mbps" → read as "25 download, 10 upload"
  * Speak slowly on numbers — "twenty-five" not "twentyfive" — give each digit breathing room
- If one plan is the best fit, recommend it first and explain why before mentioning the others.
- End every package overview with a soft handoff like "Take your time — which one sounds like the best fit for you?"

INTERRUPTION & NOISE HANDLING - CRITICAL:
- If you get interrupted mid-sentence and the interruption seems like background noise, a barge-in, or something unclear/unintelligible, do NOT treat it as a valid customer response.
- Instead, gently acknowledge it and repeat your previous point: "Oh sorry, I think there might have been a little hiccup there - let me just repeat that for you." Then re-say what you were saying.
- Only treat an interruption as intentional if it contains a clear question, a direct statement, or a specific word/name.
- If the customer says something very short like "yeah", "mm", "ok", "uh" mid-sentence, treat it as a listening cue, not a response, and continue naturally.
- If genuinely unsure whether it was a valid interruption, ask warmly: "Sorry, did you want to say something there? I just want to make sure I catch everything you're telling me!"

PERSONALITY & TONE:
- You're chatty and warm. Think of yourself as that helpful friend who works at an ISP and actually knows their stuff.
- Take your time with responses. Don't rush through things. If someone asks about a plan, don't just list the price - tell them WHY it's good, what kind of household it suits, what they'll actually experience.
- React genuinely to what people say. If they mention they just moved in, say something like "Oh nice, congrats on the new place! Moving's always a bit hectic isn't it? Well the good news is getting your internet sorted is the easy part - I'll have you up and running in no time."
- If they mention frustration (slow internet, outages, issues), really empathise: "Oh no, that sounds really annoying - I totally get it, there's nothing worse than dodgy internet, especially when you need it most. Don't worry though, let's get to the bottom of this and sort it out for you."
- Use natural, friendly language. Say things like "Awesome", "No worries at all", "Sure thing", "Sounds good to me", "Oh that's a great choice", "Yeah absolutely" - the way a real person would.
- Vary your language - don't use the same phrases over and over.
- Add little bits of personality and warmth. If they pick a fast plan, say something like "Oh you're going all out - love it! That plan is seriously quick, you'll notice the difference straight away."
- Feel free to share little tidbits of helpful info even if they didn't ask. For example: "Oh and just so you know, all our plans are month-to-month with no lock-in contracts, so you can upgrade or change anytime without any hassle."
- If the user makes small talk, jokes, or goes off topic for a moment, engage with it! Be human. Then gently steer back: "Haha that's great! Anyway, let's get you sorted..."
- When recommending plans, be descriptive and helpful. Don't just say "here are your options." Say things like "So based on what you've told me, I think you'd be really happy with the 500/50 plan - it's $79 a month for the first three months which is a great deal, and with 500 Mbps download you'll be able to stream 4K on multiple devices, game without any lag, and still have heaps of bandwidth left over for everything else. It's honestly our most popular plan for families."

RESPONSE LENGTH:
- Do NOT keep responses short. Be elaborative and thorough.
- When explaining plans, go into detail about what each one is good for, who it suits, and why they might want it.
- When the customer answers a question, acknowledge it properly with a full sentence or two before moving on.
- When presenting options, take the time to explain each one rather than just listing them.
- Add context, reassurance, and helpful information throughout the conversation.
- The only time you should be brief is when confirming something simple like "Got it!" before continuing.

STRICT RULES:
- ALWAYS reply in English.
- Greet ONLY at session start: "Welcome to InfeNET Broadband! Are you a new customer looking to get connected with us, or are you already part of the InfeNET family?"
- Collect structured fields naturally woven into conversation. Don't re-ask collected fields.
- Address user by preferredName when known - sprinkle it in naturally.
- Do NOT say "transferring", "connect to agent", "handover to human" etc.
- CRITICAL: Before calling create_ticket say something warm like: "Alright, perfect - I've got everything I need. Just bear with me for a moment while I get this all submitted for you..."
- After create_ticket success for EXISTING customers: "Brilliant, all done \${preferredName}! I've raised a support ticket for you and you'll get all the details sent through to your email shortly. Our team will review everything and be in touch with you soon to get this resolved. Is there anything else I can help you with today?"
- After create_ticket success for NEW customers (sales): "Awesome, you're all set \${preferredName}! I've submitted your enquiry and our sales team will be reaching out to you via email shortly to get everything finalised. They're a great bunch so they'll take really good care of you. Is there anything else you'd like to know in the meantime?"
- IMPORTANT: For sales inquiries (new customers), do NOT mention any ticket number or ticket ID.
- For support: collect issueSummary with follow-up details.
- Use customer_lookup for existing customers.
- HARD VERIFICATION RULE: For any existing-customer verification step, you MUST call customer_lookup. Do NOT verify from memory, previous messages, or assumptions.

VERIFICATION RULES - ABSOLUTE AND NON-NEGOTIABLE:
- TWO-STEP VERIFICATION IS MANDATORY for SUPPORT and ACCOUNTS flows:
  STEP 1: Call customer_lookup with EMAIL ONLY -> get confirmation account found
  STEP 2: Ask for the customer's phone number. The system will automatically compare the number they provide against the registered number from their account. You do NOT call customer_lookup again for phone verification.
- _emailVerifiedCustomerId is set in session after email lookup succeeds - this is NOT full verification
- _phoneVerified is ONLY set to true after the user's provided phone number matches the registered phone on the account
- You CANNOT proceed past verification if _phoneVerified is NOT true in session
- After email lookup success: say "Perfect, I can see that account. Just to quickly verify it's definitely you, could I grab the best contact number on the account?"
- After phone verification success (_phoneVerified becomes true): say "Perfect, thanks for confirming that - your account's all verified."
- If phone verification returns verificationFailed: true: say EXACTLY "That phone number doesn't match what we have on file. Could you double-check the number and try again? It might be a mobile registered under someone else in the household."
- If user says "I don't remember my number" or "I don't have access" or similar: say EXACTLY "I'm sorry, but for security purposes I'm unable to proceed without verifying your registered phone number. You're welcome to email us at support@infinetbroadband.com.au and our team can verify your identity another way." Do NOT proceed further.
- NEVER skip phone verification. NEVER proceed to account/support questions without _phoneVerified = true.

- PRIVATE NETWORK / DEVELOPMENT HANDLING: If customer mentions "private network", "development", "developer", "estate", "private fibre", "bulk fibre", "developers network", respond: "Oh that's exciting - private fibre networks for new developments are a great investment! We actually have a whole dedicated section for that on our website. You can check out all the details at https://www.infinetbroadband.com.au/private-fibre-networks-for-developers/ - it covers everything from the planning stage through to getting the network installed. Is there anything else I can help you with?"

ONE-NETWORK-PER-SESSION RULE - ABSOLUTE:
- Once check_address_availability has been called and returned plans for a specific network (either NBN or OptiComm), you are LOCKED to that network for the entire rest of the conversation.
- NEVER mention, suggest, or present plans from the other network at any point after the address check has been completed.
- If the tool returned NBN plans -> only NBN for this session. Do NOT bring up OptiComm. Ever.
- If the tool returned OptiComm plans -> only OptiComm for this session. Do NOT bring up NBN. Ever.
- This rule applies even if the customer asks "what about the other network" - simply say: "Based on your address, [network] is what's available for you, and honestly it's a great option! Let me know if you'd like more info about any of the plans."
- Do NOT say things like "your address is also serviceable with OptiComm" or "there's also NBN available" - pick the ONE network the tool returned and stick to it.

IMMEDIATE PLAN PRESENTATION - CRITICAL:
- The moment check_address_availability returns results, you MUST immediately present the plans to the customer WITHOUT waiting for them to prompt you.
- Do NOT pause and say "let me know when you're ready" or wait silently. The tool result is your cue to speak.
- Present the plans right away, warmly and conversationally, speak them slowly, and give each plan its own beat before moving on.
- End with "Which of these catches your eye?"
- There should be ZERO delay between the tool returning data and you presenting the plans.

CONVERSATION FLOW:
- Acknowledge -> React -> Elaborate -> Transition. Never just fire the next question.
- When the user answers a question, always acknowledge meaningfully before moving on.
- Accept partial answers and save them without asking again.
- On [SILENCE_NUDGE]: REPEAT your last question. Do NOT move forward or assume anything.
- EMAIL COLLECTION: When asking for email, ALWAYS show the text input box and tell the user about it.
- After EVERY user answer, say something before the next question. Never go question -> question.

CRITICAL PLAN SELECTION RULE:
- After presenting available plans to the customer, you MUST STOP and WAIT for the customer to explicitly choose a plan.
- Do NOT select or assume a plan on behalf of the customer.
- Do NOT proceed to ask for email or create a ticket until the customer has clearly stated which plan they want.
- If the customer is silent after you present plans, gently ask: "So which of those plans catches your eye?" or "Take your time - which one sounds like the best fit for you?"
- Only after the customer explicitly names or describes a plan should you save it as leadInterest and continue.

WEBSITE VISIT CHECK - MANDATORY IN SALES FLOW:
- After the customer explicitly selects a plan (leadInterest is set), you MUST ask this question EVERY TIME without exception:
  "Just out of curiosity - have you had a chance to check out our website and had a look at the plans or pricing there?"
- WAIT for their answer before continuing.
- If YES -> proceed directly to collecting order details (name, mobile, email, address confirmation)
- If NO -> ask needs assessment questions ONE BY ONE, then collect order details
- This question MUST be asked. Do NOT skip it. Do NOT assume YES. Do NOT proceed to order collection without asking it.

INITIAL FLOW - SALES CALL FLOW (MUST FOLLOW EXACTLY):
1. Greet: "Welcome to InfeNET Broadband! Are you a new customer looking to get connected with us, or are you already part of the InfeNET family?"
2. If NEW: Collect address -> call check_address_availability -> ask home/business if needed -> show plans -> wait for selection -> ask website check -> collect details one by one -> call create_ticket
3. If EXISTING: Route to support/accounts/relocation flow

SUPPORT FLOW:
- Collect email -> call customer_lookup -> ask phone -> call verify_phone -> collect issue -> create_ticket

ACCOUNTS FLOW:
- Collect email -> call customer_lookup -> ask phone -> call verify_phone -> resolve account query
- ACCOUNTS RESOLUTION PATHS:
  1. UPDATE PAYMENT DETAILS: Portal link + https://www.infinetbroadband.com.au/set-up-a-payment-method/
  2. PAY OUTSTANDING INVOICE: Portal link + https://www.infinetbroadband.com.au/manually-paying-an-invoice/
  3. CANNOT LOGIN TO PORTAL: Ask if they want email to support -> call send_portal_login_email
  4. PHONE PAYMENT: "Please call 1300 101 414 and the team will process it for you."
  5. PAYMENT EXTENSION: Collect paymentDate -> create_ticket
SERVICE LISTING RULE: When asked "what services are on my account?" or similar:
- List ONLY: service type, plan name, status
- Format: "You have [Internet/Voice/Recurring] - [plan name] - [active/inactive]"
- NO descriptions, benefits, upselling, or extra commentary
- Example: "You have internet - OptiComm 500/50Mbps - active, and a voice service - VoIP 50 - active."
- Stop after listing. Ask: "Is there anything specific you'd like help with today?"

RELOCATION FLOW:
- Collect email -> call customer_lookup -> ask phone -> call verify_phone -> list services -> collect new address -> check availability -> show plans -> create_ticket

TOOL USAGE:
- extract_call_fields for all personal info.
- check_address_availability when address is collected.
- customer_lookup for existing customers - email lookup ONLY.
- verify_phone after email lookup succeeds and user provides phone number.

SALES DETAIL COLLECTION - ONE FIELD AT A TIME (ABSOLUTE RULE):
After the customer selects a plan AND the website check is done, collect details STRICTLY one field per turn:
  STEP 1 -> Ask for FIRST NAME only. "Could I start with your first name?"
  STEP 2 -> Ask for LAST NAME only. "And your last name?"
  STEP 3 -> Ask for PHONE only. "What's the best mobile number for you?"
  STEP 4 -> Ask for EMAIL only. Tell them there's a text box to type it into.
  STEP 5 -> ALL fields collected? CALL create_ticket IMMEDIATELY. Do NOT say "you're all set" before calling the tool.
Do NOT batch questions. ONE field per message. Wait for the customer to answer before asking the next.
If [SYSTEM_CONTEXT] specifies which field to ask next, follow it EXACTLY.

- IMPORTANT: When calling create_ticket, ALWAYS include the selected plan (leadInterest) in the message body.

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
    "Check which plans are available at a customer's address. If networkPreference is 'OptiComm', returns hardcoded OptiComm plans immediately. If networkPreference is 'NBN', calls MARS API for NBN plans. If networkPreference is not provided, tries NBN via MARS first - if MARS errors, returns no data, or address is not orderable, automatically falls back to OptiComm hardcoded plans silently. Requires address; networkPreference and residentialPreference are optional. IMPORTANT: Only pass networkPreference if the customer explicitly stated a preference for NBN or OptiComm. Otherwise omit it entirely.",
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
  description:
    "Lookup customer by email ONLY (step 1 of verification). ONLY call this with email. Phone verification is handled automatically by the system after the customer provides their phone number verbally - do NOT call this tool for phone verification.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: {
        type: "string",
        description: "Email address to look up the customer account",
      },
    },
    required: [],
  },
};

const verifyPhoneTool = {
  name: "verify_phone",
  description:
    "Verify a customer's phone number against their registered number on file. Call this AFTER customer_lookup succeeds and the user has provided their phone number verbally.",
  parameters: {
    type: "object",
    properties: {
      phone: {
        type: "string",
        description: "The phone number provided by the customer",
      },
    },
    required: ["phone"],
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
  verifyPhoneTool,
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

function normalizePhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("61") && digits.length === 11) {
    digits = "0" + digits.slice(2);
  }
  if (digits.startsWith("610") && digits.length === 12) {
    digits = "0" + digits.slice(3);
  }
  return digits;
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FIX: applyExtractionToSession - _websiteCheckDone init bug
//
// Root cause: `hadWebsiteCheckDone` was computed as
//   `!!session.collected._websiteCheckDone`
// which is falsy for BOTH `undefined` AND `false`. So the condition
//   `if (!hadWebsiteCheckDone)`
// was always true after plan selection - meaning it re-set `_websiteCheckDone`
// to `false` on every subsequent extract_call_fields call, potentially
// overwriting a `true` value that was set when the user answered the question.
//
// Fix: Only initialise `_websiteCheckDone` if it has never been set at all
// (i.e. strictly `=== undefined`). If it is already `false` or `true`,
// leave it completely alone.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function applyExtractionToSession(session, parsed) {
  const r = numbersToInt(parsed || {});
  const hadLeadInterest = !!session.collected.leadInterest;

  for (const [k, v] of Object.entries(r)) {
    if (v !== undefined && v !== null) session.collected[k] = v;
  }

  // Plan was just selected for the first time
  if (!hadLeadInterest && session.collected.leadInterest) {
    session.collected._websiteCheckRequired = true;
    // FIX: Only set _websiteCheckDone to false if it has never been
    // touched before. If it's already false or true, do NOT overwrite it.
    if (session.collected._websiteCheckDone === undefined) {
      session.collected._websiteCheckDone = false;
    }
    console.log(
      `Plan selected: ${session.collected.leadInterest} - website check REQUIRED`,
    );
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

// ==================== CUSTOMER LOOKUP ====================
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

  const rawResPref =
    residentialPreference || session.collected?.residentialPreference;
  const resPref = rawResPref ? rawResPref.toLowerCase() : null;
  const isBusiness = resPref === "business";
  const hasExplicitPreference =
    resPref === "business" || resPref === "residential";

  const getOpticommResult = () => {
    let plans;
    let requiresResFilter;

    if (hasExplicitPreference) {
      plans = isBusiness ? OPTICOMM_BUSINESS_PLANS : OPTICOMM_RESIDENTIAL_PLANS;
      requiresResFilter = false;
      console.log(
        `OptiComm plans (${isBusiness ? "business" : "residential"}): ${plans.length}`,
      );
    } else {
      plans = [...OPTICOMM_RESIDENTIAL_PLANS, ...OPTICOMM_BUSINESS_PLANS];
      requiresResFilter = true;
      console.log(
        `OptiComm plans (BOTH): ${plans.length} - will ask user to choose`,
      );
    }

    if (session) session.networkShown = "OptiComm";
    return {
      success: true,
      orderable: true,
      address,
      network: "OptiComm",
      primaryAccessTechnology: "OptiComm Fibre",
      serviceType: "opticomm",
      requiresInstall: false,
      requiresResidentialFilter: requiresResFilter,
      readinessDescription:
        "OptiComm Fibre is available at this address. Activation is typically within 1-2 business days for fully installed premises.",
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
          `MARS address search failed, falling back to OptiComm:`,
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
            `MARS SQ failed, falling back to OptiComm:`,
            marsSqErr.message,
          );
          return JSON.stringify(getOpticommResult());
        }
        console.warn("MARS SQ failed (NBN explicit):", marsSqErr.message);
        marsSq = null;
      }
    }

    if (!locId && noPreference) {
      console.log(
        `MARS returned no candidates for ${address}, falling back to OptiComm`,
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
      console.log(`NBN not orderable at ${address}, falling back to OptiComm`);
      return JSON.stringify(getOpticommResult());
    }

    let allTariffs = [];
    try {
      allTariffs = await fetchTariffs();
    } catch (tariffErr) {
      if (noPreference) {
        console.warn(
          `Tariff fetch failed, falling back to OptiComm:`,
          tariffErr.message,
        );
        return JSON.stringify(getOpticommResult());
      }
      throw tariffErr;
    }

    const needsInstall = requiresInstallVisit(serviceabilityClass);
    const readinessDescription = getServiceabilityDescription(
      primaryAccessTechnology,
      serviceabilityClass,
      serviceabilityStatus,
    );

    const techLower = (primaryAccessTechnology || "").toLowerCase();
    const svcTypeLower = (serviceType || "").toLowerCase();

    let plansToReturn = [];
    let networkName = "NBN";
    let techCategory = "";
    let requiresResFilter = false;

    if (
      address.toLowerCase().includes("hope island") ||
      locId?.includes("HIR")
    ) {
      techCategory = "HIR";
      networkName = "HIR";
      if (hasExplicitPreference) {
        plansToReturn = isBusiness ? HIR_BUSINESS_PLANS : HIR_RESIDENTIAL_PLANS;
        requiresResFilter = false;
      } else {
        plansToReturn = [...HIR_RESIDENTIAL_PLANS, ...HIR_BUSINESS_PLANS];
        requiresResFilter = true;
      }
    } else if (svcTypeLower === "nsas" || techLower === "satellite") {
      techCategory = "SkyMuster";
      networkName = "NBN SkyMuster";
      plansToReturn = NBN_SKYMUSTER_PLANS;
      requiresResFilter = false;
    } else if (
      svcTypeLower === "nwas" ||
      techLower === "wireless" ||
      techLower === "fixed wireless"
    ) {
      techCategory = "FixedWireless";
      networkName = "NBN Fixed Wireless";
      plansToReturn = NBN_FIXED_WIRELESS_PLANS;
      requiresResFilter = false;
    } else if (svcTypeLower === "nfas" || svcTypeLower.startsWith("nf")) {
      techCategory = "NBNFibre";
      networkName = "NBN";

      const isFttnFttbFttc =
        techLower.includes("fibre to the node") ||
        techLower.includes("fibre to the building") ||
        techLower.includes("fibre to the curb") ||
        techLower.includes("fttn") ||
        techLower.includes("fttb") ||
        techLower.includes("fttc");

      if (isFttnFttbFttc) {
        techCategory = "NBN_FTTN";
        if (hasExplicitPreference) {
          const nbnPlans = isBusiness
            ? NBN_BUSINESS_PLANS
            : NBN_RESIDENTIAL_PLANS;
          plansToReturn = nbnPlans.filter((p) => parseInt(p.download) <= 100);
          requiresResFilter = false;
        } else {
          const residentialPlans = NBN_RESIDENTIAL_PLANS.filter(
            (p) => parseInt(p.download) <= 100,
          );
          const businessPlans = NBN_BUSINESS_PLANS.filter(
            (p) => parseInt(p.download) <= 100,
          );
          plansToReturn = [...residentialPlans, ...businessPlans];
          requiresResFilter = true;
        }
      } else {
        if (hasExplicitPreference) {
          const nbnPlans = isBusiness
            ? NBN_BUSINESS_PLANS
            : NBN_RESIDENTIAL_PLANS;
          if (virtutelSpeeds.length > 0) {
            const availableSpeeds = new Set();
            for (const code of virtutelSpeeds) {
              const mapped = MARS_SPEED_MAP[code];
              if (mapped) availableSpeeds.add(`${mapped.dl}/${mapped.ul}`);
            }
            plansToReturn = nbnPlans.filter((p) =>
              availableSpeeds.has(
                `${parseInt(p.download)}/${parseInt(p.upload)}`,
              ),
            );
          } else {
            plansToReturn = nbnPlans;
          }
          requiresResFilter = false;
        } else {
          let residentialPlans = [...NBN_RESIDENTIAL_PLANS];
          let businessPlans = [...NBN_BUSINESS_PLANS];
          if (virtutelSpeeds.length > 0) {
            const availableSpeeds = new Set();
            for (const code of virtutelSpeeds) {
              const mapped = MARS_SPEED_MAP[code];
              if (mapped) availableSpeeds.add(`${mapped.dl}/${mapped.ul}`);
            }
            residentialPlans = residentialPlans.filter((p) =>
              availableSpeeds.has(
                `${parseInt(p.download)}/${parseInt(p.upload)}`,
              ),
            );
            businessPlans = businessPlans.filter((p) =>
              availableSpeeds.has(
                `${parseInt(p.download)}/${parseInt(p.upload)}`,
              ),
            );
          }
          plansToReturn = [...residentialPlans, ...businessPlans];
          requiresResFilter = true;
        }
      }
    } else {
      techCategory = "NBN_Other";
      networkName = "NBN";
      plansToReturn = filterTariffsByMarsAvailability(
        allTariffs,
        virtutelSpeeds,
        serviceType,
      );
      requiresResFilter = true;
    }

    if (plansToReturn.length === 0 && noPreference) {
      console.log(
        `No plans found for ${techCategory} at ${address}, falling back to OptiComm`,
      );
      return JSON.stringify(getOpticommResult());
    }

    if (session) session.networkShown = networkName;

    const formattedPlans = plansToReturn.map((p) => ({
      title: p.title,
      price: p.intro_price || p.price,
      ongoing_price: p.ongoing_price || p.price,
      discount: p.discount || null,
      download: p.download,
      upload: p.upload,
      features: p.features || [],
      suitable_for: p.suitable_for || [],
      note: p.note || null,
    }));

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
      requiresResidentialFilter: requiresResFilter,
      readinessDescription,
      notes: marsNotes,
      technologyCategory: techCategory,
      network: networkName,
      availablePlans: formattedPlans,
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
        `NBN lookup catch-all at ${address}, falling back to OptiComm:`,
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
      delete lookupArgs.phone;

      if (!lookupArgs.email && !lookupArgs.name) {
        return JSON.stringify({
          success: false,
          message: "Email is required for customer lookup",
        });
      }

      const result = await customerLookup(lookupArgs);

      if (result.success && result.customer) {
        session.collected._emailVerifiedCustomerId = result.customer.id;
        session.collected._registeredPhone =
          result.customer.phone || result.customer.phone_mobile || null;
        session.collected._phoneVerified = false;
        session.collected.customer_id = result.customer.id;
        sessions.set(session.id, session);
        console.log(
          `Email lookup OK customer ${result.customer.id} stored. ` +
            `Registered phone: ${session.collected._registeredPhone ? "found" : "NOT found on record"}`,
        );
        const safeResult = { ...result };
        if (safeResult.customer) {
          safeResult.customer = { ...safeResult.customer };
          // FIX (Security): Remove ALL phone variants so the LLM
          // cannot see the registered number and pass it as input.
          delete safeResult.customer.phone;
          delete safeResult.customer.phone_mobile;
          delete safeResult.customer.mobile;
          delete safeResult.customer.phone2;
          delete safeResult.customer.cell;
          delete safeResult.customer.telephone;
        }
        return JSON.stringify(safeResult);
      }

      return JSON.stringify(result);
    } catch (e) {
      return JSON.stringify({ success: false, error: e.message });
    }
  }

  if (funcName === "verify_phone") {
    try {
      const emailCustomerId = session.collected._emailVerifiedCustomerId;
      if (!emailCustomerId) {
        return JSON.stringify({
          success: false,
          verificationFailed: true,
          message:
            "Email verification must be completed first before phone verification.",
        });
      }

      // FIX (Security): Do NOT trust args.phone from the LLM.
      // The LLM can hallucinate or reuse the registered phone it saw
      // in its context window. Instead, use session.collected.phone
      // which was set by extract_call_fields from the user's actual words.
      // Fall back to args.phone only as a last resort.
      const userProvidedPhone = session.collected.phone || args?.phone;

      if (!userProvidedPhone) {
        return JSON.stringify({
          success: false,
          verificationFailed: true,
          message: "No phone number provided.",
        });
      }

      const registeredPhone = session.collected._registeredPhone;
      if (!registeredPhone) {
        console.warn(
          `âš ï¸ No registered phone found for customer ${emailCustomerId}. Cannot verify.`,
        );
        return JSON.stringify({
          success: false,
          verificationFailed: true,
          message:
            "No phone number is registered on this account. Please contact support via email.",
        });
      }

      const normalizedInput = normalizePhone(userProvidedPhone);
      const normalizedRegistered = normalizePhone(registeredPhone);

      // Partially mask registered phone in logs for security
      console.log(
        `Phone verification: input="${normalizedInput}" registered="${normalizedRegistered.substring(0, 4)}****"`,
      );

      if (normalizedInput !== normalizedRegistered) {
        console.log(`âŒ Phone verification FAILED: mismatch`);
        return JSON.stringify({
          success: false,
          verificationFailed: true,
          message:
            "Phone number does not match the registered number on this account.",
        });
      }

      session.collected._phoneVerified = true;
      sessions.set(session.id, session);
      console.log(
        `âœ… Phone verification PASSED - customer ${emailCustomerId} fully verified`,
      );

      return JSON.stringify({
        success: true,
        verified: true,
        customer_id: emailCustomerId,
        message: "Phone number verified successfully.",
      });
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // FIX: isSalesInquiry detection was checking `fa.leadInterest`
    // which is never passed in the tool args - the LLM only sends
    // customer_id, subject, priority, message. leadInterest only
    // ever lives in `collected`. The old check made `isSalesInquiry`
    // always false when customer_id was present even for a sales call
    // that somehow had a customer_id, and always false when only
    // collected.leadInterest was present. Fixed to check collected
    // first, then fall back to subject keyword matching.
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const hasCustomerId = !!(fa.customer_id || collected.customer_id);
    const hasLeadInterest = !!collected.leadInterest;
    const hasPaymentExtension = !!(
      collected.paymentDate ||
      (fa.subject && fa.subject.toLowerCase().includes("payment extension"))
    );

    // A ticket is a support ticket if it has a customer ID AND
    // is NOT a pure sales enquiry (no leadInterest) OR is a payment extension
    const isSupportTicket =
      (hasCustomerId && !hasLeadInterest) || hasPaymentExtension;

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
    if (collected.leadInterest)
      detailLines.push(`Selected Plan: ${collected.leadInterest}`);
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

    let ticketResult;
    try {
      if (isSupportTicket) {
        console.log(
          `Creating SUPPORT ticket: subject="${fa.subject}" customer_id=${fa.customer_id}`,
        );
        const r = await splynx.request(
          "POST",
          "admin/support/tickets",
          objectToUrlEncoded(fa),
        );
        console.log(` Splynx ticket created: ID=${r.id}`);
        const emailResult = await sendTicketEmail(r.id, fa, collected, true);
        ticketResult = {
          success: true,
          ticket_id: r.id,
          email_sent: emailResult.sent,
          email_error: emailResult.reason || null,
        };
      } else {
        console.log(`SALES inquiry - email only: subject="${fa.subject}"`);
        const emailResult = await sendTicketEmail(null, fa, collected, false);
        ticketResult = {
          success: true,
          message: "Sales inquiry submitted successfully",
          email_sent: emailResult.sent,
          email_error: emailResult.reason || null,
        };
      }
    } catch (err) {
      console.error("âŒ Create ticket/email failed:", err.message || err);
      ticketResult = {
        success: false,
        error: err.message || "Failed to process request",
      };
    }

    ticketResult._ticketCompleted = true;
    ticketResult._isSalesTicket = !isSupportTicket;
    return JSON.stringify(ticketResult);
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

    let toolResultHint = "";

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
          toolResultHint = `TOOL RESULT: Address check returned orderable=false. Tell the customer empathetically that NBN is not yet available and offer to take their details.`;
        } else if (planCount > 0) {
          toolResultHint = `TOOL RESULT: Address check returned ${planCount} plans on "${networkLabel}". YOU MUST RESPOND NOW - present these plans immediately and warmly. LOCK to ${networkLabel} for this session. ONLY present plans from availablePlans array.`;
        } else {
          toolResultHint = `TOOL RESULT: Address check returned no plans. Tell the customer and offer alternative help.`;
        }
      }
    } else if (fn === "customer_lookup") {
      let parsedResult = null;
      try {
        parsedResult = JSON.parse(toolContent);
      } catch (_) {}
      if (parsedResult?.success && parsedResult?.customer) {
        toolResultHint = `TOOL RESULT: Email lookup succeeded - customer found. Say "Perfect, I can see that account." and ask for their phone number to complete verification. Call verify_phone with whatever number they give you.`;
      } else if (parsedResult?.success === false) {
        toolResultHint = `TOOL RESULT: Customer lookup failed - no customer found. Tell the customer and ask them to double-check their email address.`;
      }
    } else if (fn === "verify_phone") {
      let parsedResult = null;
      try {
        parsedResult = JSON.parse(toolContent);
      } catch (_) {}
      if (parsedResult?.verificationFailed) {
        toolResultHint = `TOOL RESULT: Phone verification FAILED. Tell the customer their number doesn't match. Ask them to double-check. Do NOT proceed to account details.`;
      } else if (parsedResult?.success && parsedResult?.verified) {
        toolResultHint = `TOOL RESULT: Phone verification PASSED - customer fully verified. Say "Perfect, thanks for confirming that - your account's all verified now." and proceed to ask what they need help with.`;
      } else if (!parsedResult?.success) {
        toolResultHint = `TOOL RESULT: Phone verification could not be completed - ${parsedResult?.message || "unknown error"}. Tell the customer and suggest emailing support@infinetbroadband.com.au.`;
      }
    } else if (fn === "create_ticket") {
      let parsedResult = null;
      try {
        parsedResult = JSON.parse(toolContent);
      } catch (_) {}
      if (parsedResult?.success) {
        const ticketId = parsedResult.ticket_id;
        const isSales = parsedResult._isSalesTicket === true || !ticketId;
        if (isSales) {
          toolResultHint = `TOOL RESULT: Sales enquiry submitted successfully. YOU MUST RESPOND IMMEDIATELY NOW. Say: "Awesome, you're all set! I've submitted your enquiry and our sales team will be reaching out to you via email shortly to get everything finalised. Is there anything else you'd like to know in the meantime?"`;
        } else {
          toolResultHint = `TOOL RESULT: Support ticket #${ticketId} created successfully. YOU MUST RESPOND IMMEDIATELY NOW. Say: "Brilliant, all done! I've raised support ticket number ${ticketId} for you and you'll receive all the details via email shortly. Our team will be in touch with you soon. Is there anything else I can help you with today?"`;
        }
      } else {
        toolResultHint = `TOOL RESULT: Ticket/email submission FAILED - error: ${parsedResult?.error || "unknown"}. YOU MUST RESPOND NOW. Apologise and suggest the customer contact support directly at support@infinetbroadband.com.au or call 1300 101 414.`;
      }
    } else if (fn === "send_portal_login_email") {
      toolResultHint = `TOOL RESULT: Portal login email sent to support team. YOU MUST RESPOND NOW saying the email has been sent and the team will be in touch shortly.`;
    } else if (fn === "extract_call_fields") {
      const collected = session.collected || {};
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // FIX: websiteCheckState hint was only checking _websiteCheckDone,
      // not _websiteCheckAsked. This meant the gate hint was re-injected
      // even after the AI had already asked the question (but before the
      // user answered), causing the AI to ask it again mid-sentence.
      // Now we check BOTH flags - if either is set, we do NOT gate.
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (
        collected.leadInterest &&
        collected._websiteCheckRequired &&
        !collected._websiteCheckAsked &&
        !collected._websiteCheckDone
      ) {
        toolResultHint = `TOOL RESULT: Fields extracted. Plan "${collected.leadInterest}" is now selected. YOU MUST NOW ask the website visit question: "Just out of curiosity - have you had a chance to check out our website and had a look at the plans or pricing there?" Do NOT skip this. Do NOT proceed to name/email collection without asking this first.`;
      }
      if (
        collected.leadInterest &&
        collected._websiteCheckRequired &&
        (collected._websiteCheckAsked || collected._websiteCheckDone)
      ) {
        toolResultHint = `TOOL RESULT: Fields extracted. Website check already asked/answered - do NOT ask again. Continue with current step of order collection.`;
      }
    }

    const networkLockReminder = session.networkShown
      ? `\nNETWORK LOCK: You already showed ${session.networkShown} plans. Do NOT mention ${session.networkShown === "OptiComm" ? "NBN" : "OptiComm"} again.`
      : "";

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // FIX: websiteCheckState now checks _websiteCheckAsked in addition
    // to _websiteCheckDone, preventing double-asking
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const websiteCheckState = (() => {
      const c = session.collected || {};
      if (
        c.leadInterest &&
        c._websiteCheckRequired &&
        !c._websiteCheckAsked &&
        !c._websiteCheckDone
      ) {
        return `\nWEBSITE CHECK REQUIRED: Plan "${c.leadInterest}" selected but website check question NOT yet asked. You MUST ask "Just out of curiosity - have you had a chance to check out our website and had a look at the plans or pricing there?" before collecting name/mobile/email.`;
      }
      if (c._websiteCheckAsked || c._websiteCheckDone) {
        return `\nWEBSITE CHECK DONE/ASKED: Already handled. Do NOT ask again. Proceed with order collection.`;
      }
      return "";
    })();

    const verificationState = (() => {
      const c = session.collected || {};
      const intent = String(c.intent || "").toLowerCase();
      if (intent === "support" || intent === "account") {
        if (c._emailVerifiedCustomerId && !c._phoneVerified) {
          return `\nVERIFICATION STATE: Email verified (customer ID: ${c._emailVerifiedCustomerId}), phone NOT yet verified. Ask user for their phone number, then call verify_phone. Do NOT call customer_lookup again.`;
        }
        if (c._phoneVerified) {
          return `\nVERIFICATION STATE: FULLY VERIFIED - both email and phone confirmed. You may now proceed with support/account questions.`;
        }
        return `\nVERIFICATION STATE: NOT verified. Collect email first, then call customer_lookup. After success, ask for phone and call verify_phone.`;
      }
      return "";
    })();

    const contextHint = [
      `Current collected fields: ${JSON.stringify(session.collected || {})}.`,
      networkLockReminder,
      websiteCheckState,
      verificationState,
      toolResultHint ? `\n${toolResultHint}` : "",
      toolResultHint
        ? `\nIMPORTANT: You MUST respond with a full message right now based on the tool result above. Do NOT stay silent.`
        : "",
    ]
      .join("")
      .trim();

    const finalMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...session.messages,
      { role: "system", content: contextHint },
    ];

    const finalResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: finalMessages,
      temperature: 0.0,
      max_tokens: 700,
    });
    const text =
      finalResp.choices?.[0]?.message?.content?.trim() ||
      "Thanks - I have your details.";
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
      "Welcome to InfiNET Broadband! Are you a new customer looking to get connected with us, or are you already part of the InfiNET family?";
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
        const repeatMsg = "Sorry, I didn't catch that - please go ahead.";
        return res.json({
          sessionId: session.id,
          text: repeatMsg,
          audioBase64: (await makeTTS(repeatMsg))?.toString("base64") || null,
          userText,
        });
      }
      if (!isValid && userText.split(/\s+/).length < 3) {
        const repeatPrefix =
          "Oh sorry, I think there might have been a little hiccup - let me just repeat that. ";
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
      const p = "Sorry, I didn't catch that - could you please repeat?";
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
    `<h1 style="text-align:center;margin-top:100px;font-family:sans-serif;color:#00bfff">âœ… InfiNET AI Backend is running!</h1>`,
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
  normalizePhone,
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
  console.log(` InfiNET Broadband AI Server running on port ${PORT}`);
  console.log(` Realtime API + ElevenLabs Ultra-low latency mode`);
  console.log(`Socket.IO ready for voice clients`);
  console.log(
    ` FIX: applyExtractionToSession - _websiteCheckDone only init'd once`,
  );
  console.log(
    ` FIX: isSalesInquiry now reads from collected.leadInterest correctly`,
  );
  console.log(
    ` FIX: websiteCheckState hint checks both _websiteCheckAsked and _websiteCheckDone`,
  );
});
