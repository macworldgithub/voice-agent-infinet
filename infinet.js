// import express from "express";
// import multer from "multer";
// import fs from "fs";
// import path from "path";
// import cors from "cors";
// import dotenv from "dotenv";
// import ffmpeg from "fluent-ffmpeg";
// import ffmpegStatic from "ffmpeg-static";
// import OpenAI from "openai";
// import axios from "axios";
// import crypto from "crypto";
// dotenv.config();
// if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
// const PORT = process.env.PORT || 3003;
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// if (!OPENAI_API_KEY) {
//   console.error("Please set OPENAI_API_KEY in your environment or .env");
//   process.exit(1);
// }
// const app = express();
// app.use(cors());
// app.use(express.json());
// app.use(express.static("public"));
// const upload = multer({ dest: "uploads/" });
// const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
// const sessions = new Map();
// const BRAND = "InfiNET Broadband";
// // ────────────────────────────────────────────────
// // SPLYNX CONFIG & CLIENT
// // ────────────────────────────────────────────────
// const CONFIG = {
//   SPLYNX_BASE_URL: 'https://infinetbroadband-portal.com.au/api/2.0/',
//   API_KEY: '107c483d15e930b41b8d70affdd08632',
//   API_SECRET: '9b8b46ce928bea980a8d092a288372e0',
//   USE_ACCESS_TOKEN: true,
// };
// class SplynxApiClient {
//   constructor(config) {
//     this.baseUrl = config.SPLYNX_BASE_URL;
//     this.apiKey = config.API_KEY;
//     this.apiSecret = config.API_SECRET;
//     this.accessToken = null;
//     this.accessTokenExpiration = 0;
//     this.refreshToken = null;
//     this.refreshTokenExpiration = 0;
//     this.useAccessToken = config.USE_ACCESS_TOKEN !== false;
//   }
//   generateSignature(nonce) {
//     const data = nonce + this.apiKey;
//     const hmac = crypto.createHmac('sha256', this.apiSecret);
//     hmac.update(data);
//     return hmac.digest('hex').toUpperCase();
//   }
//   getSignatureAuthHeader() {
//     const nonce = Math.round(Date.now() / 1000 * 100);
//     const signature = this.generateSignature(nonce);
//     const params = { key: this.apiKey, nonce, signature };
//     return `Splynx-EA (${new URLSearchParams(params).toString()})`;
//   }
//   async generateAccessToken() {
//     try {
//       const nonce = Math.floor(Date.now() / 1000);
//       const response = await axios.post(
//         `${this.baseUrl}admin/auth/tokens`,
//         {
//           auth_type: 'api_key',
//           key: this.apiKey,
//           nonce,
//           signature: this.generateSignature(nonce),
//         },
//         { headers: { 'Content-Type': 'application/json' } }
//       );
//       const data = response.data;
//       this.accessToken = data.access_token;
//       this.accessTokenExpiration = data.access_token_expiration;
//       this.refreshToken = data.refresh_token;
//       this.refreshTokenExpiration = data.refresh_token_expiration;
//       console.log('✅ Splynx Access token generated');
//       return data;
//     } catch (err) {
//       console.error('Token generation failed:', err.response?.data || err.message);
//       throw err;
//     }
//   }
//   async renewAccessToken() {
//     if (!this.refreshToken) throw new Error('No refresh token available');
//     try {
//       const response = await axios.get(
//         `${this.baseUrl}admin/auth/tokens/${this.refreshToken}`,
//         {
//           headers: { Authorization: `Splynx-EA (access_token=${this.accessToken})` },
//         }
//       );
//       const data = response.data;
//       this.accessToken = data.access_token;
//       this.accessTokenExpiration = data.access_token_expiration;
//       this.refreshToken = data.refresh_token;
//       this.refreshTokenExpiration = data.refresh_token_expiration;
//       console.log('✅ Splynx Access token renewed');
//       return data;
//     } catch (err) {
//       console.error('Token renew failed:', err.response?.data || err.message);
//       throw err;
//     }
//   }
//   isTokenExpired(bufferSeconds = 30) {
//     return Date.now() / 1000 + bufferSeconds > this.accessTokenExpiration;
//   }
//   async request(method, endpoint, data = null, params = {}) {
//     let headers = { 'Content-Type': 'application/json' };
//     if (this.useAccessToken && this.accessToken) {
//       if (this.isTokenExpired()) {
//         console.log('Token expired → renewing...');
//         await this.renewAccessToken();
//       }
//       headers.Authorization = `Splynx-EA (access_token=${this.accessToken})`;
//     } else {
//       headers.Authorization = this.getSignatureAuthHeader();
//     }
//     const url = `${this.baseUrl}${endpoint}`;
//     try {
//       const config = { method, url, headers, params, ...(data && { data }) };
//       const response = await axios(config);
//       return response.data;
//     } catch (err) {
//       if (err.response?.status === 401) {
//         console.warn('401 → retrying after renew...');
//         await this.renewAccessToken();
//         return this.request(method, endpoint, data, params);
//       }
//       console.error(`[${method}] ${endpoint} failed:`, err.response?.data || err.message);
//       throw err.response?.data || err;
//     }
//   }
//   async listInternetTariffs(params = {}) {
//     return this.request('GET', 'admin/tariffs/internet', null, params);
//   }
// }
// const splynx = new SplynxApiClient(CONFIG);
// (async () => {
//   try {
//     if (CONFIG.USE_ACCESS_TOKEN) {
//       await splynx.generateAccessToken();
//     }
//   } catch (err) {
//     console.error('Initial Splynx token generation failed. Some calls may fail.');
//   }
// })();
// app.use(async (req, res, next) => {
//   try {
//     if (CONFIG.USE_ACCESS_TOKEN && !splynx.accessToken) {
//       await splynx.generateAccessToken();
//     }
//     next();
//   } catch (err) {
//     console.error('Splynx middleware error:', err.message);
//     next();
//   }
// });
// // ────────────────────────────────────────────────
// // LOCATIONS
// // ────────────────────────────────────────────────
// const LOCATIONS = [
//   { id: 1, name: "Queensland" },
//   { id: 2, name: "Victoria" },
//   { id: 3, name: "New South Wales" },
//   { id: 4, name: "Tasmania" },
//   { id: 5, name: "Western Australia" },
//   { id: 6, name: "South Australia" },
//   { id: 7, name: "Northern Territory" },
//   { id: 8, name: "ACT" }
// ];
// // ────────────────────────────────────────────────
// // FULL KNOWLEDGE BASE
// // ────────────────────────────────────────────────
// const KB = `
// Knowledge base for InfiNET Broadband (use this to answer customer calls and chats concisely):
// - Greeting / Routing:
//   "Thanks for calling InfiNET Broadband, how may we help you? Would it be sales, support, or accounts?"
//   If caller says sales/support/accounts, proceed accordingly and collect structured fields.
// - Payment & Portal:
//   "Did you know you can update your payment method via the customer portal?"
//   If the customer does not have portal access, tell them: "If you don’t have access to the customer portal, please email support@infinetbroadband.com.au and our team will issue you the login credentials."
// - Support contact:
//   "If you are having issues with your Internet service please email support@infinetbroadband.com.au and our support team will be able to assist you."
// - Plan change / Upgrade:
//   "Did you want to upgrade or change the internet plan you are on? Please just email support@infinetbroadband.com.au and our support team will be able to assist you."
// - Outstanding / Overdue invoice:
//   "Do you have an outstanding or overdue invoice? If so, just login to the customer portal to manually pay this. You can also log a support ticket via support@infinetbroadband.com.au and our accounts team will be able to assist you."
// - Payment details changed / lost card / new bank:
//   "Have your payment details changed, lost a card, or changed bank details? Just login to the customer portal to update this manually, or you can also log a support ticket via support@infinetbroadband.com.au and our accounts team will be able to assist you."
// - Cannot login to portal:
//   "Not able to login to the customer portal? Just email support@infinetbroadband.com.au and our accounts team will be able to assist."
// - NBN vs OptiComm:
//   "Both NBN and OptiComm deliver fibre internet in Australia. The main difference is availability: NBN is the national wholesale network while OptiComm is a private fibre network available in selected estates and buildings. Both offer similar speeds. InfiNET Broadband can connect you to either depending on what's available at your address."
// - Opticomm Free to Air TV issue:
//   "Infinet Broadband does not support your free to air television service. Please contact Opticomm directly — you can visit https://online.telco.opticomm.com.au/television-fault Thank you, goodbye."
// - Common Qs to answer concisely:
//   * Can I use my own or existing modem (BYO Modem) on the NBN & Opticomm Internet services?
//     - Answer: Yes, you can bring your own compatible modem. If you’re unsure, our support team can help check compatibility. We also offer modems for purchase if you prefer a hassle-free setup.
//   * Do you offer unlimited data on NBN & OptiComm Internet?
//     - Answer: Yes, all of our NBN and OptiComm internet plans come with unlimited data. Stream, work, and play without worrying about data limits or excess charges.
//   * How fast is NBN compared to OptiComm?
//     - Answer: Speeds depend on your chosen plan. Both NBN and OptiComm can deliver speeds from 25 Mbps up to 1,000 Mbps in some areas. OptiComm may offer higher speeds in certain fibre-enabled estates, while NBN is more widely available across Australia.
//   * How long does setup take to setup NBN or Opticomm?
//     - Answer: In most cases, either NBN or OptiComm services can be activated within 30mins to 3 hours if your premises has already been connected. If your premise has never been connected before (new home or building) a tech visit is required, it may take a little longer as some new homes required an NTD (Network Termination Device) to be installed and this requires an onsite tech visit to be booked in by one of our team members. Our team will guide you through every step.
//   * How do I check if my home has OptiComm?
//     - Answer: They can check OptiComm coverage on the OptiComm website or ask InfiNET and we'll confirm quickly.
// - Tone:
//   * Always concise and professional.
//   * Ask for remaining missing info in a single concise message.
// - Contact info to use:
//   * support@infinetbroadband.com.au
// Additional Knowledge Base – Concise Version
// Payment Setup & Manual Payment
// Customer portal: https://infinetbroadband-portal.com.au/
// To set up recurring payment (Direct Debit or Credit/Debit Card):
// 1. Log in → Finance → Select payment method
// 2. Credit/Debit Card: Add card details → Save and allow future charges
// 3. Direct Debit: Add bank details → Save and allow future charges
// → Future invoices auto-debit on due date.
// To manually pay an outstanding/overdue invoice (when auto-payment fails):
// 1. Log in → Dashboard or Finance/Documents
// 2. Select invoice/document (use dropdown to filter types)
// 3. Click ✓ → Choose Credit Card or Direct Debit → Pay
// → Marks invoice PAID once cleared.
// NBN FTTP Upgrade (from March 2022 onward)
// • Upgrades eligible FTTN / FTTC premises to FTTP (direct fibre to premises)
// • $0 standard installation if signing to eligible high-speed plan (min 100/20 Mbps)
// • Non-standard installs may incur costs (NBN advises & seeks approval first)
// • Contact InfiNET to check eligibility → we handle the request
// Key NBN Technologies – Summary
// • FTTP (Fibre to the Premises): Fibre direct to home. Requires NTD inside + utility box outside. Best speeds/reliability.
// • FTTN (Fibre to the Node): Fibre to street node → copper to home. Uses DSL port on modem.
// • FTTC (Fibre to the Curb): Fibre to pit/DPU → short copper to home. Uses NCD + ethernet to router WAN.
// • FTTB (Fibre to the Building): Fibre to building comms room → copper to unit/apartment. DSL modem.
// • HFC (Hybrid Fibre Coaxial): Uses existing cable TV coax. Coax to NTD → ethernet to router WAN.
// • Fixed Wireless: Radio from tower (up to ~14 km) → outdoor antenna → NTD inside.
// • Satellite (Sky Muster): Satellite dish → indoor modem/NTD.
// Modem/Router Connection – General Rules
// • FTTP / FTTC / HFC / Fixed Wireless / Satellite / OptiComm: Connect router WAN port to NBN NTD/NCD UNI-D port (ethernet cable). NBN-ready router required.
// • FTTN / FTTB: Connect DSL port to phone wall socket (VDSL/ADSL modem required).
// Service Classes – Quick Overview (NBN)
// Higher class = more infrastructure already in place → faster activation
// FTTP / FTTB / FTTC / HFC
// • 0 = Future serviceable, not ready yet (pre-order possible)
// • 1 = Serviceable, no equipment yet → book install
// • 2 = External installed, internal pending → book install
// • 3 = Fully installed → activate 1–5 days
// FTTN similar but uses Class 10–13 (copper-based readiness)
// Fixed Wireless: Class 4–6
// Satellite: Class 7–9
// OptiComm FTTP Classes
// • 0 = Future, not ready
// • 1 = Serviceable, no equipment → contact OptiComm directly first
// • 2 = External done, internal pending → order + pay new connection fee ($330–$550 inc GST first time only)
// • 3 = Fully installed → activate 1–2 days
// • 5 = Fully installed + New Development Fee $300 inc GST (first time)
// TP-Link VX230v Router (InfiNET supplied – pre-configured plug & play)
// If factory reset → must reconfigure:
// LEDs (left to right): Power, DSL, Internet, 2.4G, 5G, WAN, LAN1–3, WPS, USB, Phone
// Access admin portal: http://tplinkmodem.net or http://192.168.1.1
// (Initial password: contact InfiNET if reset)
// Quick Setup after reset:
// • Region & Time Zone
// • ISP = Other
// • Connection: EWAN (FTTP/FTTC/HFC/OptiComm) or VDSL (FTTN/FTTB)
// • Use settings supplied by InfiNET at activation
// • Wireless: leave default or customise later
// • Run connection test
// Change settings later: Internet tab (EWAN/DSL) or Wireless tab (SSID/password).
// Mesh Wi-Fi (HX220/510 extenders):
// • Wireless: Add via Network Map → place near VX230 (flashing blue) → auto-pair
// • Ethernet backhaul: Connect HX WAN → VX230 LAN → auto-detects
// VoIP (if subscribed):
// Telephony → Telephone Number → Add/Modify → enter InfiNET-provided VoIP credentials
// General Advice
// • Check address/technology: Use InfiNET “Check your Address” tool or ask support
// • Unsure about modem compatibility, settings, VoIP, etc. → email support@infinetbroadband.com.au
// --- Consolidated FAQs, Hardware, Security & Plans (Residential & Business) ---
// - Common Residential FAQs (answer concisely):
//   * What NBN speed for streaming? For HD, NBN 25 usually enough; 4K or multiple devices recommend NBN 50+.
//   * Keep landline with NBN? Yes, via VoIP (port existing number on most plans).
//   * BYO modem on NBN/OptiComm? Yes if compatible; support can check; we offer hassle-free options.
//   * NBN installation time? 2–10 business days typical; pre-connected: 30 mins–3 hrs; new may need tech/NTD.
//   * Move house? Transfer plan; we check availability and re-activate.
//   * Unlimited data? Yes on all plans.
//   * OptiComm check? OptiComm site or ask us.
//   * OptiComm vs NBN speed? Similar tiers; OptiComm (FTTP) often more consistent.
// - Hope Island Resort (HIR) FAQs:
//   * HIR Internet: Private high-speed (fibre + HFC) in Hope Island Resort, up to 1000 Mbps, fail-over, no connection fees/contracts.
//   * Tech: FTTP/HFC (varies); ultra-fast available.
//   * BYO modem: Yes, most compatible.
//   * Speeds: Up to 1000 Mbps.
// - NBN Fixed Wireless FAQs:
//   * What it is: Tower radio to antenna + box; free standard install.
//   * Good for remote? Yes, improved reliability.
//   * Speeds: Vary by location/congestion/equipment.
// - NBN Sky Muster FAQs:
//   * What it is: Satellite for remote; dish + modem; free install.
//   * Speeds: Up to 100/5 wholesale (varies; latency typical).
//   * Good option: Yes for no fixed line.
//   * Switch: Address eligibility dependent.
// - Residential VoIP FAQs:
//   * VoIP: Internet calls; cheaper, no rental.
//   * Keep number: Yes, port most free.
//   * Works with: NBN/OptiComm.
// - Residential Hardware:
//   * TP-Link VX230v AX1800: $179 (WiFi 6, VoIP, pre-configured).
//   * VX230v + HX510 Mesh: 1-pack $318, 2-pack $459.
//   * HX510 Mesh AP: 1-pack $159, 2-pack $299.
//   * VX420 4G failover: $319 (not FTTB/FTTN).
// - Residential Security:
//   * Basic: $9.95/m (Anti-Virus, patching, remote).
//   * Bronze: $19.95/m (+ Web Protection, 1 session/m).
//   * Silver: $44.95/m (+ 3 sessions/m).
//   * Gold: $65.95/m (+ Unlimited support, DNS, reporting).
// - Residential Plans (intro discounts new customers; confirm address):
//   NBN (unlimited, no contract, month-to-month):
//   - 25/10 Basic: $59/m ($5 off 3m, then $64) – FTTC/FTTN/FTTB/FTTP/HFC
//   - 50/20 Standard: $74/m ($5 off 3m, then $79)
//   - 100/20 Fast: $84/m ($5 off 3m, then $89)
//   - 500/50 Faster: $84/m ($5 off 3m, then $89) – FTTP/HFC
//   - 750/50 Superfast: $99/m ($10 off 3m, then $109) – FTTP/HFC
//   - 1000/100 Ultrafast: $109/m ($10 off 3m, then $119) – FTTP/HFC
//   OptiComm (FTTP, reliable fibre):
//   - 25/10: $64/m ($5 off 3m, then $69)
//   - 50/20: $74/m ($5 off 3m, then $79)
//   - 100/20: $84/m ($5 off 3m, then $89) – limited capacity
//   - 500/50: $79/m ($10 off 3m, then $89)
//   - 750/50: $89/m ($10 off 3m, then $99)
//   - 1000/100: $99/m ($10 off 3m, then $109)
//   Hope Island Resort:
//   - 25/10: $44/m ($15 off 3m, then $59)
//   - 50/20: $49/m ($15 off 3m, then $64)
//   - 250/50: $64/m ($15 off 3m, then $79)
//   - 500/50: $64/m ($15 off 3m, then $79) – free upgrade if needed
//   - 750/50: $74/m ($15 off 3m, then $89)
//   - 1000/100: $84/m ($15 off 3m, then $99)
//   Fixed Wireless:
//   - 25/10: $59/m
//   - 75/10: $89/m
//   - 200/20: $99/m
//   - 400/40: $109/m (eligible areas)
//   Sky Muster:
//   - 25/5: $59/m
//   - 50/5: $69/m
//   - 100/5: $99/m
// - Business Plans & FAQs:
//   * NBN Business: Static IP, priority support, higher uploads.
//   - 50/20: $89/m
//   - 100/40: $109/m
//   - 250/100: $149/m (FTTP/HFC)
//   - 500/200: $189/m (FTTP/HFC)
//   - 1000/400: $239/m (FTTP/HFC)
//   * OptiComm Business: Static IP; fee waiver possible (24m $0/12m $45/else $99; new dev $330 not waived).
//   - 50/20: $79/m ($10 off 3m, then $89)
//   - 100/40: $99/m ($10 off 3m, then $109)
//   - 250/100: $139/m ($10 off 3m, then $149)
//   - 500/200: $169/m ($10 off 3m, then $179)
//   - 1000/400: $189/m ($10 off 3m, then $199)
//   * HIR Business:
//   - 250/100: $109/m
//   - 500/200: $119/m
//   - 1000/400: $139/m
//   * Business VoIP/Cloud PBX: Extensions, CRM integration, etc.
//   - VoIP 30: $30/m (PAYG)
//   - VoIP 50: $50/m (unlimited local/national/mobile)
//   - Extra extensions: $10/m (1-10), $8/m (>10)
// - General Advice (expanded):
//   * Address/technology check: InfiNET tool or email support@infinetbroadband.com.au.
//   * Head Office: Level 15, Corporate Centre One, 2 Corporate Court, Bundall, QLD 4217.
//   * Phone: 1300 101 414.
// Always advise customers to check current pricing and availability via the address checker or support@infinetbroadband.com.au as promotions may change.
// `;
// // ────────────────────────────────────────────────
// // SYSTEM PROMPT + TOOLS (UPDATED SALES FLOW)
// // ────────────────────────────────────────────────
// const SYSTEM_PROMPT = `
// You are a concise, professional voice/chat assistant for ${BRAND}.
// Handle four call types / chat intents: support, sales, general, account.
// STRICT RULES:
// - ALWAYS reply in English.
// - Keep replies short and focused; ask for remaining missing info concisely.
// - Collect structured fields when appropriate and do not re-ask for already collected fields.
// - If the user has a preferredName in collected fields, ALWAYS address them warmly by that name in every response.
// - Do NOT say anything like "we will connect you to a sales agent", "transferring you to support", "handover to human", "I'll put you through" or similar phrases.
// - When enough information is collected per the flow below, reply with the exact "ticket raised" message and stop collecting.
// - Use the Knowledge base below to answer questions concisely.
// INITIAL FLOW - follow these steps exactly:
// 1. After the initial greeting and collecting preferredName, ask: "Are you a new InfiNET customer or an existing one?"
// 2. If they say new (or similar), ask: "Would you like to learn more about InfiNET Broadband, or how may I assist you with our services today?"
//    - If they want to know more, explain briefly: "InfiNET Broadband is a reliable provider of high-speed internet services in Australia, offering NBN, OptiComm, and other technologies with unlimited data plans." Then proceed to sales flow by asking: "How can I help you with our services today?"
//    - If they choose help or sales, proceed directly to sales flow.
// 3. If they say existing (or similar), ask: "How may we help you today? Would it be sales, support, or accounts?"
// 4. Based on their intent, proceed to the corresponding flow. If they are not an existing customer and choose support or accounts, politely explain: "Support and accounts are for existing customers. If you're interested in our services, let's proceed with sales." and switch to sales flow.
// SALES FLOW - follow these steps exactly (for new or interested users):
// 1. Ask: "Great! Are you interested in residential or business plans?"
// 2. After they reply (residential or business) → Ask: "Would you like NBN or OptiComm plans?"
// 3. After they reply (NBN or OptiComm) → Ask: "To check the best plans for you, what's your full address (street, suburb, state and postcode)?"
// 4. Immediately call the check_address_availability tool with the address.
// 5. After tool result → Show available NBN and OptiComm plans concisely (use live data only). Highlight or note plans matching their NBN/OptiComm preference and residential/business choice.
// 6. Ask: "Which plan interests you? Please reply with the plan title or speed (e.g. 100/20 Fast)."
// 7. After they select a plan → Confirm and collect remaining: email, and confirm address if not already collected.
// 8. Use extract_call_fields to capture leadInterest as the selected plan title/speed.
// 9. When ALL details collected → Reply exactly: "Thank you [preferredName]! I have raised a short ticket for our sales team. An agent will contact you shortly to finalize your plan and setup."
// SUPPORT FLOW (for existing customers only):
// - Answer any question (including generic issues like "my internet is not working", "modem issue", speeds, setup, etc.) using the Knowledge base.
// - If the issue cannot be fully resolved in chat or the user wants further help → Ask for remaining: email, issueSummary if not already collected.
// - Then reply exactly: "Thank you [preferredName]! I have raised a support ticket. Our team will contact you shortly."
// ACCOUNTS FLOW (billing/financing, for existing customers only):
// - Answer any billing or payment questions using the Knowledge base (portal, overdue invoices, update payment method, etc.).
// - For any specific issue → Please provide your accountNumber or email and issueSummary if not already collected.
// - Then reply exactly: "Thank you [preferredName]! I have raised a ticket for our accounts team. They will contact you shortly regarding your billing query."
// GENERAL: Answer using the Knowledge base. If needed, ask clarifying questions concisely.
// TOOL USAGE (CRITICAL):
// - When the customer asks about plans, pricing, speeds, upgrades or "what plans do you have?": call the get_internet_plans tool.
// - When the customer asks about availability at their address or you reach step 4 in the sales flow: call check_address_availability with the full address.
// - The tool results will be injected into the conversation. ALWAYS use the live tool data for plans and availability (never rely on old hardcoded KB plans).
// - After a tool result, continue the flow concisely using the live data.
// - Call extract_call_fields whenever the user provides any personal info or intent.
// Knowledge base for InfiNET Broadband (use this to answer customer calls and chats concisely):
// ${KB}
// Locations (states) with IDs:
// ${LOCATIONS.map(l => `${l.id}: ${l.name}`).join("\n")}
// `;
// const extractFunction = {
//   name: "extract_call_fields",
//   description: "Extract fields from user message: intent (support/sales/general/account), issueSummary, preferredName (what they want to be called), email, priority, callbackRequest (boolean), timeline, leadInterest, accountNumber. Omit fields not present.",
//   parameters: {
//     type: "object",
//     properties: {
//       intent: { type: "string", enum: ["support", "sales", "general", "account"] },
//       issueSummary: { type: "string" },
//       preferredName: { type: "string" },
//       email: { type: "string" },
//       priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
//       callbackRequest: { type: "boolean" },
//       timeline: { type: "string" },
//       leadInterest: { type: "string" },
//       accountNumber: { type: "string" },
//     },
//     required: [],
//   },
// };
// const getPlansTool = {
//   name: "get_internet_plans",
//   description: "Fetch the latest live internet tariff plans (prices, speeds, availability). ALWAYS call this for any plan/pricing/speed question.",
//   parameters: { type: "object", properties: {}, required: [] }
// };
// const checkAvailabilityTool = {
//   name: "check_address_availability",
//   description: "Check which plans are available at a customer's address. Requires full address.",
//   parameters: {
//     type: "object",
//     properties: {
//       address: { type: "string", description: "Full address including street, suburb, state and postcode if possible" }
//     },
//     required: ["address"]
//   }
// };
// const tools = [extractFunction, getPlansTool, checkAvailabilityTool];
// // ────────────────────────────────────────────────
// // HELPER FUNCTIONS
// // ────────────────────────────────────────────────
// function mkSession(sessionId) {
//   const id = sessionId || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
//   const session = {
//     id,
//     collected: {},
//     messages: [{ role: "system", content: SYSTEM_PROMPT }],
//     lastSeen: new Date().toISOString(),
//   };
//   sessions.set(id, session);
//   return session;
// }
// function normalizeText(t) {
//   if (!t) return "";
//   return t.toString().replace(/\u200B/g, "").replace(/\s+/g, " ").trim();
// }
// function safeParseJSON(s) {
//   try { return JSON.parse(s); } catch (e) { return null; }
// }
// function numbersToInt(obj) {
//   const out = {};
//   for (const k of Object.keys(obj || {})) {
//     const v = obj[k];
//     if (typeof v === "number") out[k] = Math.round(v);
//     else out[k] = v;
//   }
//   return out;
// }
// async function convertToWav(inputPath) {
//   const out = inputPath + ".converted.wav";
//   return new Promise((resolve, reject) => {
//     ffmpeg(inputPath)
//       .outputOptions(["-ar 16000", "-ac 1", "-vn"])
//       .toFormat("wav")
//       .on("end", () => resolve(out))
//       .on("error", (err) => reject(err))
//       .save(out);
//   });
// }
// async function streamToBuffer(body) {
//   if (!body) return Buffer.from("");
//   if (Buffer.isBuffer(body)) return body;
//   if (body.arrayBuffer) {
//     const ab = await body.arrayBuffer();
//     return Buffer.from(ab);
//   }
//   if (body.pipe) {
//     const chunks = [];
//     return new Promise((resolve, reject) => {
//       body.on("data", (c) => chunks.push(Buffer.from(c)));
//       body.on("end", () => resolve(Buffer.concat(chunks)));
//       body.on("error", (err) => reject(err));
//     });
//   }
//   return Buffer.from(JSON.stringify(body));
// }
// function applyExtractionToSession(session, parsed) {
//   const extractionResult = numbersToInt(parsed || {});
//   for (const [k, v] of Object.entries(extractionResult)) {
//     if (v !== undefined && v !== null) session.collected[k] = v;
//   }
//   session.lastSeen = new Date().toISOString();
//   sessions.set(session.id, session);
//   return extractionResult;
// }
// async function makeTTS(text) {
//   try {
//     const tts = await openai.audio.speech.create({
//       model: "gpt-4o-mini-tts",
//       voice: "cedar",
//       input: text,
//       format: "mp3",
//     });
//     const buf = await streamToBuffer(tts);
//     return buf;
//   } catch (err) {
//     console.warn("TTS failed:", err?.message || err);
//     return null;
//   }
// }
// async function fetchTariffs() {
//   try {
//     const data = await splynx.listInternetTariffs();
//     return Array.isArray(data) ? data : [];
//   } catch (err) {
//     console.error("Failed to fetch internet tariffs from Splynx:", err.message);
//     return [];
//   }
// }
// async function determineLocationId(address) {
//   if (!address) return null;
//   const prompt = `You are an expert at identifying Australian states from addresses.
// Reply with EXACTLY one of these state names (nothing else):
// Queensland
// Victoria
// New South Wales
// Tasmania
// Western Australia
// South Australia
// Northern Territory
// ACT
// If the address does not clearly indicate any state, reply "Unknown".
// Address: ${address}`;
//   try {
//     const resp = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: [{ role: "user", content: prompt }],
//       temperature: 0,
//       max_tokens: 20,
//     });
//     let stateName = resp.choices[0].message.content.trim();
//     if (stateName === "Unknown") return null;
//     const nameMap = { QLD: "Queensland", VIC: "Victoria", NSW: "New South Wales", TAS: "Tasmania", WA: "Western Australia", SA: "South Australia", NT: "Northern Territory", ACT: "ACT" };
//     if (nameMap[stateName]) stateName = nameMap[stateName];
//     const loc = LOCATIONS.find(l => l.name.toLowerCase() === stateName.toLowerCase());
//     return loc ? loc.id : null;
//   } catch (err) {
//     console.error("Location determination failed:", err.message);
//     return null;
//   }
// }
// // ────────────────────────────────────────────────
// // AGENT ENDPOINTS
// // ────────────────────────────────────────────────
// app.post("/api/chat/init", async (req, res) => {
//   try {
//     const session = mkSession();
//     const greeting = `Hi there! Welcome to InfiNET Broadband. Could you please share your name to get started?`;
//     session.messages.push({ role: "assistant", content: greeting });
//     sessions.set(session.id, session);
//     // const ttsBuf = await makeTTS(greeting);
//     // const audioBase64 = ttsBuf ? ttsBuf.toString("base64") : null;
//     return res.json({ sessionId: session.id, text: greeting });
//   } catch (err) {
//     console.error("chat init err", err);
//     return res.status(500).json({ error: err?.message || "server error" });
//   }
// });
// app.post("/api/voice", upload.single("audio"), async (req, res) => {
//   const incomingSessionId = (req.body && req.body.sessionId) || req.query.sessionId || req.headers["x-session-id"] || null;
//   if (!req.file) return res.status(400).json({ error: "Missing audio file (multipart field 'audio')" });
//   const uploadedPath = path.resolve(req.file.path);
//   let convertedPath = null;
//   try {
//     const session = incomingSessionId && sessions.has(incomingSessionId) ? sessions.get(incomingSessionId) : mkSession(incomingSessionId);
//     const origName = (req.file.originalname || "").toLowerCase();
//     const mimetype = (req.file.mimetype || "").toLowerCase();
//     const looksLikeWav = origName.endsWith(".wav") || mimetype === "audio/wav" || mimetype === "audio/wave" || mimetype === "audio/x-wav";
//     if (looksLikeWav) {
//       convertedPath = uploadedPath;
//     } else {
//       convertedPath = await convertToWav(uploadedPath);
//     }
//     const transcriptionResp = await openai.audio.transcriptions.create({
//       file: fs.createReadStream(convertedPath),
//       model: "gpt-4o-mini-transcribe",
//     });
//     const userTextRaw = normalizeText(transcriptionResp?.text || "");
//     if (!userTextRaw) {
//       const prompt = "Sorry, I didn't catch that — could you please repeat briefly?";
//       const ttsBuf = await makeTTS(prompt);
//       session.lastSeen = new Date().toISOString();
//       sessions.set(session.id, session);
//       return res.json({ sessionId: session.id, text: prompt, audioBase64: ttsBuf ? ttsBuf.toString("base64") : null });
//     }
//     session.messages.push({ role: "user", content: userTextRaw });
//     let assistantText = null;
//     const firstCompletion = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: session.messages,
//       functions: tools,
//       function_call: "auto",
//       temperature: 0.0,
//       max_tokens: 300,
//     });
//     const firstMsg = firstCompletion.choices?.[0]?.message;
//     if (firstMsg?.function_call) {
//       const funcName = firstMsg.function_call.name;
//       const args = safeParseJSON(firstMsg.function_call.arguments) || {};
//       session.messages.push(firstMsg);
//       if (funcName === "extract_call_fields") {
//         applyExtractionToSession(session, args);
//       } else if (funcName === "get_internet_plans") {
//         const tariffs = await fetchTariffs();
//         const toolContent = JSON.stringify({
//           success: true,
//           plans: tariffs.map(t => ({
//             id: t.id,
//             title: t.title,
//             price: parseFloat(t.price),
//             download: `${(t.speed_download / 1000)} Mbps`,
//             upload: `${(t.speed_upload / 1000)} Mbps`,
//             available_for_locations: t.available_for_locations || []
//           }))
//         });
//         session.messages.push({ role: "function", name: funcName, content: toolContent });
//       } else if (funcName === "check_address_availability") {
//         const { address } = args;
//         let toolContent;
//         if (!address) {
//           toolContent = JSON.stringify({ error: "Address is required" });
//         } else {
//           const locId = await determineLocationId(address);
//           const tariffs = await fetchTariffs();
//           const availablePlans = locId
//             ? tariffs.filter(t => t.available_for_locations && t.available_for_locations.includes(locId))
//             : [];
//           toolContent = JSON.stringify({
//             success: true,
//             address,
//             locationId: locId,
//             locationName: LOCATIONS.find(l => l.id === locId)?.name || "Unknown",
//             availablePlans: availablePlans.map(p => ({
//               title: p.title,
//               price: parseFloat(p.price),
//               download: `${(p.speed_download / 1000)} Mbps`,
//               upload: `${(p.speed_upload / 1000)} Mbps`
//             }))
//           });
//         }
//         session.messages.push({ role: "function", name: funcName, content: toolContent });
//       }
//       const collectedSummary = `CollectedFields: ${JSON.stringify(session.collected || {})}.`;
//       const followupSystem = `You are a concise assistant for ISP CRM. Use collected fields and ask for remaining missing info concisely. Use the tool results above for accurate plans and availability.`;
//       const finalMessages = [
//         { role: "system", content: followupSystem },
//         ...session.messages,
//         { role: "system", content: collectedSummary },
//       ];
//       const finalResp = await openai.chat.completions.create({
//         model: "gpt-4o-mini",
//         messages: finalMessages,
//         temperature: 0.0,
//         max_tokens: 350,
//       });
//       assistantText = finalResp.choices?.[0]?.message?.content?.trim() || "Thanks — I have your details.";
//       session.messages.push({ role: "assistant", content: assistantText });
//     } else if (firstMsg?.content) {
//       assistantText = firstMsg.content;
//       session.messages.push({ role: "assistant", content: assistantText });
//     }
//     const ttsBuf = await makeTTS(assistantText);
//     session.lastSeen = new Date().toISOString();
//     sessions.set(session.id, session);
//     return res.json({ sessionId: session.id, text: assistantText, audioBase64: ttsBuf ? ttsBuf.toString("base64") : null });
//   } catch (err) {
//     console.error("voice error:", err);
//     return res.status(500).json({ error: err?.message || "server error" });
//   } finally {
//     try { if (uploadedPath && fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath); } catch (_) {}
//     try { if (convertedPath && convertedPath !== uploadedPath && fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath); } catch (_) {}
//   }
// });
// app.post("/api/chat/message", async (req, res) => {
//   try {
//     const { sessionId, message } = req.body;
//     if (!message) return res.status(400).json({ error: "Missing message" });
//     const session = sessionId && sessions.has(sessionId) ? sessions.get(sessionId) : mkSession(sessionId);
//     session.messages.push({ role: "user", content: message });
//     let assistantText = null;
//     const firstCompletion = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: session.messages,
//       functions: tools,
//       function_call: "auto",
//       temperature: 0.0,
//       max_tokens: 300,
//     });
//     const firstMsg = firstCompletion.choices?.[0]?.message;
//     if (firstMsg?.function_call) {
//       const funcName = firstMsg.function_call.name;
//       const args = safeParseJSON(firstMsg.function_call.arguments) || {};
//       session.messages.push(firstMsg);
//       if (funcName === "extract_call_fields") {
//         applyExtractionToSession(session, args);
//       } else if (funcName === "get_internet_plans") {
//         const tariffs = await fetchTariffs();
//         const toolContent = JSON.stringify({
//           success: true,
//           plans: tariffs.map(t => ({
//             id: t.id,
//             title: t.title,
//             price: parseFloat(t.price),
//             download: `${(t.speed_download / 1000)} Mbps`,
//             upload: `${(t.speed_upload / 1000)} Mbps`,
//             available_for_locations: t.available_for_locations || []
//           }))
//         });
//         session.messages.push({ role: "function", name: funcName, content: toolContent });
//       } else if (funcName === "check_address_availability") {
//         const { address } = args;
//         let toolContent;
//         if (!address) {
//           toolContent = JSON.stringify({ error: "Address is required" });
//         } else {
//           const locId = await determineLocationId(address);
//           const tariffs = await fetchTariffs();
//           const availablePlans = locId
//             ? tariffs.filter(t => t.available_for_locations && t.available_for_locations.includes(locId))
//             : [];
//           toolContent = JSON.stringify({
//             success: true,
//             address,
//             locationId: locId,
//             locationName: LOCATIONS.find(l => l.id === locId)?.name || "Unknown",
//             availablePlans: availablePlans.map(p => ({
//               title: p.title,
//               price: parseFloat(p.price),
//               download: `${(p.speed_download / 1000)} Mbps`,
//               upload: `${(p.speed_upload / 1000)} Mbps`
//             }))
//           });
//         }
//         session.messages.push({ role: "function", name: funcName, content: toolContent });
//       }
//       const collectedSummary = `CollectedFields: ${JSON.stringify(session.collected || {})}.`;
//       const followupSystem = `You are a concise assistant for ISP CRM. Use collected fields and ask for remaining missing info concisely. Use the tool results above for accurate plans and availability.`;
//       const finalMessages = [
//         { role: "system", content: followupSystem },
//         ...session.messages,
//         { role: "system", content: collectedSummary },
//       ];
//       const finalResp = await openai.chat.completions.create({
//         model: "gpt-4o-mini",
//         messages: finalMessages,
//         temperature: 0.0,
//         max_tokens: 350,
//       });
//       assistantText = finalResp.choices?.[0]?.message?.content?.trim() || "Thanks — I have your details.";
//       session.messages.push({ role: "assistant", content: assistantText });
//     } else if (firstMsg?.content) {
//       assistantText = firstMsg.content;
//       session.messages.push({ role: "assistant", content: assistantText });
//     }
//     session.lastSeen = new Date().toISOString();
//     sessions.set(session.id, session);
//     return res.json({ sessionId: session.id, text: assistantText, collected: session.collected });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: err?.message || "server error" });
//   }
// });
// // ────────────────────────────────────────────────
// // SPLYNX PROXY ROUTES
// // ────────────────────────────────────────────────
// app.get('/health', (req, res) => {
//   res.json({
//     status: 'ok',
//     splynx: {
//       hasToken: !!splynx.accessToken,
//       tokenExpires: splynx.accessTokenExpiration ? new Date(splynx.accessTokenExpiration * 1000).toISOString() : null,
//     },
//   });
// });
// app.get('/api/customers', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customer', null, { limit: 10, offset: 0 })); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customers', details: err }); }
// });
// app.get('/api/customer/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Customer not found' }); }
// });
// app.get('/api/online', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customers-online')); }
//   catch (err) { res.status(500).json({ error: 'Failed to get online customers' }); }
// });
// app.get('/api/traffic/:serviceId', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/fup/usage/${req.params.serviceId}?with_texts=true`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get traffic usage' }); }
// });
// app.get('/api/tariffs/internet', async (req, res) => {
//   try { res.json(await splynx.listInternetTariffs(req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list internet tariffs' }); }
// });
// app.get('/api/tariffs/internet/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/tariffs/internet/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get tariff' }); }
// });
// app.post('/api/tariffs/internet', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/tariffs/internet', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create tariff' }); }
// });
// app.put('/api/tariffs/internet/:id', async (req, res) => {
//   try { res.json(await splynx.request('PUT', `admin/tariffs/internet/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update tariff' }); }
// });
// app.delete('/api/tariffs/internet/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/tariffs/internet/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete tariff' });
//   }
// });
// app.get('/api/locations', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/administration/locations', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list locations' }); }
// });
// app.get('/api/locations/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/administration/locations/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Location not found' }); }
// });
// app.post('/api/locations', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/administration/locations', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create location' }); }
// });
// app.put('/api/locations/:id', async (req, res) => {
//   try { res.json(await splynx.request('PUT', `admin/administration/locations/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update location' }); }
// });
// app.delete('/api/locations/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/administration/locations/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete location' });
//   }
// });
// app.get('/api/administrators', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/administration/administrators', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list administrators' }); }
// });
// app.get('/api/administrators/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/administration/administrators/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Admin not found' }); }
// });
// app.get('/api/partners', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/administration/partners', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list partners' }); }
// });
// app.get('/api/partners/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/administration/partners/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Partner not found' }); }
// });
// app.all(/^\/api\/.*/, async (req, res) => {
//   try {
//     let endpoint = req.path.replace(/^\/api\//, '');
//     if (!endpoint) return res.status(400).json({ error: 'Missing endpoint after /api/' });
//     const data = await splynx.request(
//       req.method,
//       endpoint,
//       req.method !== 'GET' && req.method !== 'HEAD' ? req.body : null,
//       req.query
//     );
//     if (req.method === 'DELETE') {
//       res.status(204).send();
//     } else {
//       res.json(data);
//     }
//   } catch (err) {
//     const status = err?.response?.status || 500;
//     res.status(status).json({
//       error: 'Splynx proxy error',
//       message: err.message || 'Request failed',
//       details: err
//     });
//   }
// });
// // ────────────────────────────────────────────────
// // START SERVER
// // ────────────────────────────────────────────────
// app.listen(PORT, () => {
//   console.log(`✅ InfiNET Agent + Full Splynx Integration running on http://localhost:${PORT}`);
//   console.log(` • First message: "Hello, thank you for contacting InfiNET Broadband. I am your AI assistant. Nice to meet you."`);
//   console.log(` • SALES FLOW now includes NBN / OptiComm question after residential/business`);
//   console.log(` • Full working code - no syntax errors`);
// });
// import express from "express";
// import multer from "multer";
// import fs from "fs";
// import path from "path";
// import cors from "cors";
// import dotenv from "dotenv";
// import ffmpeg from "fluent-ffmpeg";
// import ffmpegStatic from "ffmpeg-static";
// import OpenAI from "openai";
// import axios from "axios";
// import crypto from "crypto";
// import FormData from "form-data";
// dotenv.config();
// if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
// const PORT = process.env.PORT || 3003;
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// if (!OPENAI_API_KEY) {
//   console.error("Please set OPENAI_API_KEY in your environment or .env");
//   process.exit(1);
// }
// const app = express();
// app.use(cors());
// app.use(express.json());
// app.use(express.static("public"));
// const upload = multer({ dest: "uploads/" });
// const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
// const sessions = new Map();
// const BRAND = "InfiNET Broadband";
// // ────────────────────────────────────────────────
// // SPLYNX CONFIG & CLIENT
// // ────────────────────────────────────────────────
// const CONFIG = {
//   SPLYNX_BASE_URL: 'https://infinetbroadband-portal.com.au/api/2.0/',
//   API_KEY: '107c483d15e930b41b8d70affdd08632',
//   API_SECRET: '9b8b46ce928bea980a8d092a288372e0',
//   USE_ACCESS_TOKEN: true,
// };
// class SplynxApiClient {
//   constructor(config) {
//     this.baseUrl = config.SPLYNX_BASE_URL;
//     this.apiKey = config.API_KEY;
//     this.apiSecret = config.API_SECRET;
//     this.accessToken = null;
//     this.accessTokenExpiration = 0;
//     this.refreshToken = null;
//     this.refreshTokenExpiration = 0;
//     this.useAccessToken = config.USE_ACCESS_TOKEN !== false;
//   }
//   generateSignature(nonce) {
//     const data = nonce + this.apiKey;
//     const hmac = crypto.createHmac('sha256', this.apiSecret);
//     hmac.update(data);
//     return hmac.digest('hex').toUpperCase();
//   }
//   getSignatureAuthHeader() {
//     const nonce = Math.round(Date.now() / 1000 * 100);
//     const signature = this.generateSignature(nonce);
//     const params = { key: this.apiKey, nonce, signature };
//     return `Splynx-EA (${new URLSearchParams(params).toString()})`;
//   }
//   async generateAccessToken() {
//     try {
//       const nonce = Math.floor(Date.now() / 1000);
//       const response = await axios.post(
//         `${this.baseUrl}admin/auth/tokens`,
//         {
//           auth_type: 'api_key',
//           key: this.apiKey,
//           nonce,
//           signature: this.generateSignature(nonce),
//         },
//         { headers: { 'Content-Type': 'application/json' } }
//       );
//       const data = response.data;
//       this.accessToken = data.access_token;
//       this.accessTokenExpiration = data.access_token_expiration;
//       this.refreshToken = data.refresh_token;
//       this.refreshTokenExpiration = data.refresh_token_expiration;
//       console.log('✅ Splynx Access token generated');
//       return data;
//     } catch (err) {
//       console.error('Token generation failed:', err.response?.data || err.message);
//       throw err;
//     }
//   }
//   async renewAccessToken() {
//     if (!this.refreshToken) throw new Error('No refresh token available');
//     try {
//       const response = await axios.get(
//         `${this.baseUrl}admin/auth/tokens/${this.refreshToken}`,
//         {
//           headers: { Authorization: `Splynx-EA (access_token=${this.accessToken})` },
//         }
//       );
//       const data = response.data;
//       this.accessToken = data.access_token;
//       this.accessTokenExpiration = data.access_token_expiration;
//       this.refreshToken = data.refresh_token;
//       this.refreshTokenExpiration = data.refresh_token_expiration;
//       console.log('✅ Splynx Access token renewed');
//       return data;
//     } catch (err) {
//       console.error('Token renew failed:', err.response?.data || err.message);
//       throw err;
//     }
//   }
//   isTokenExpired(bufferSeconds = 30) {
//     return Date.now() / 1000 + bufferSeconds > this.accessTokenExpiration;
//   }
//   async request(method, endpoint, data = null, params = {}) {
//     let headers = {};
//     if (data && !(data instanceof FormData)) {
//       headers['Content-Type'] = 'application/json';
//     }
//     if (this.useAccessToken && this.accessToken) {
//       if (this.isTokenExpired()) {
//         console.log('Token expired → renewing...');
//         await this.renewAccessToken();
//       }
//       headers.Authorization = `Splynx-EA (access_token=${this.accessToken})`;
//     } else {
//       headers.Authorization = this.getSignatureAuthHeader();
//     }
//     const url = `${this.baseUrl}${endpoint}`;
//     console.log(`Making [${method}] to ${endpoint} with data:`, data ? (data instanceof FormData ? 'FormData object' : data) : 'no data');
//     try {
//       const config = { method, url, headers, params, ...(data && { data }) };
//       const response = await axios(config);
//       return response.data;
//     } catch (err) {
//       if (err.response?.status === 401) {
//         console.warn('401 → retrying after renew...');
//         await this.renewAccessToken();
//         return this.request(method, endpoint, data, params);
//       }
//       console.error(`[${method}] ${endpoint} failed with data:`, data ? (data instanceof FormData ? 'FormData object' : data) : 'no data', 'error:', err.response?.data || err.message);
//       throw err.response?.data || err;
//     }
//   }
//   async listInternetTariffs(params = {}) {
//     return this.request('GET', 'admin/tariffs/internet', null, params);
//   }
// }
// const splynx = new SplynxApiClient(CONFIG);
// (async () => {
//   try {
//     if (CONFIG.USE_ACCESS_TOKEN) {
//       await splynx.generateAccessToken();
//     }
//   } catch (err) {
//     console.error('Initial Splynx token generation failed. Some calls may fail.');
//   }
// })();
// app.use(async (req, res, next) => {
//   try {
//     if (CONFIG.USE_ACCESS_TOKEN && !splynx.accessToken) {
//       await splynx.generateAccessToken();
//     }
//     next();
//   } catch (err) {
//     console.error('Splynx middleware error:', err.message);
//     next();
//   }
// });
// // ────────────────────────────────────────────────
// // LOCATIONS
// // ────────────────────────────────────────────────
// const LOCATIONS = [
//   { id: 1, name: "Queensland" },
//   { id: 2, name: "Victoria" },
//   { id: 3, name: "New South Wales" },
//   { id: 4, name: "Tasmania" },
//   { id: 5, name: "Western Australia" },
//   { id: 6, name: "South Australia" },
//   { id: 7, name: "Northern Territory" },
//   { id: 8, name: "ACT" }
// ];
// // ────────────────────────────────────────────────
// // FULL KNOWLEDGE BASE
// // ────────────────────────────────────────────────
// const KB = `
// Knowledge base for InfiNET Broadband (use this to answer customer calls and chats concisely):
// - Greeting / Routing:
//   "Thanks for calling InfiNET Broadband, how may we help you? Would it be sales, support, or accounts?"
//   If caller says sales/support/accounts, proceed accordingly and collect structured fields.
// - Payment & Portal:
//   "Did you know you can update your payment method via the customer portal?"
//   If the customer does not have portal access, tell them: "If you don’t have access to the customer portal, please email support@infinetbroadband.com.au and our team will issue you the login credentials."
// - Support contact:
//   "If you are having issues with your Internet service please email support@infinetbroadband.com.au and our support team will be able to assist you."
// - Plan change / Upgrade:
//   "Did you want to upgrade or change the internet plan you are on? Please just email support@infinetbroadband.com.au and our support team will be able to assist you."
// - Outstanding / Overdue invoice:
//   "Do you have an outstanding or overdue invoice? If so, just login to the customer portal to manually pay this. You can also log a support ticket via support@infinetbroadband.com.au and our accounts team will be able to assist you."
// - Payment details changed / lost card / new bank:
//   "Have your payment details changed, lost a card, or changed bank details? Just login to the customer portal to update this manually, or you can also log a support ticket via support@infinetbroadband.com.au and our accounts team will be able to assist you."
// - Cannot login to portal:
//   "Not able to login to the customer portal? Just email support@infinetbroadband.com.au and our accounts team will be able to assist."
// - NBN vs OptiComm:
//   "Both NBN and OptiComm deliver fibre internet in Australia. The main difference is availability: NBN is the national wholesale network while OptiComm is a private fibre network available in selected estates and buildings. Both offer similar speeds. InfiNET Broadband can connect you to either depending on what's available at your address."
// - Opticomm Free to Air TV issue:
//   "Infinet Broadband does not support your free to air television service. Please contact Opticomm directly — you can visit https://online.telco.opticomm.com.au/television-fault Thank you, goodbye."
// - Common Qs to answer concisely:
//   * Can I use my own or existing modem (BYO Modem) on the NBN & Opticomm Internet services?
//     - Answer: Yes, you can bring your own compatible modem. If you’re unsure, our support team can help check compatibility. We also offer modems for purchase if you prefer a hassle-free setup.
//   * Do you offer unlimited data on NBN & OptiComm Internet?
//     - Answer: Yes, all of our NBN and OptiComm internet plans come with unlimited data. Stream, work, and play without worrying about data limits or excess charges.
//   * How fast is NBN compared to OptiComm?
//     - Answer: Speeds depend on your chosen plan. Both NBN and OptiComm can deliver speeds from 25 Mbps up to 1,000 Mbps in some areas. OptiComm may offer higher speeds in certain fibre-enabled estates, while NBN is more widely available across Australia.
//   * How long does setup take to setup NBN or Opticomm?
//     - Answer: In most cases, either NBN or OptiComm services can be activated within 30mins to 3 hours if your premises has already been connected. If your premise has never been connected before (new home or building) a tech visit is required, it may take a little longer as some new homes required an NTD (Network Termination Device) to be installed and this requires an onsite tech visit to be booked in by one of our team members. Our team will guide you through every step.
//   * How do I check if my home has OptiComm?
//     - Answer: They can check OptiComm coverage on the OptiComm website or ask InfiNET and we'll confirm quickly.
// - Tone:
//   * Always concise and professional.
//   * Ask for remaining missing info in a single concise message.
// - Contact info to use:
//   * support@infinetbroadband.com.au
// Additional Knowledge Base – Concise Version
// Payment Setup & Manual Payment
// Customer portal: https://infinetbroadband-portal.com.au/
// To set up recurring payment (Direct Debit or Credit/Debit Card):
// 1. Log in → Finance → Select payment method
// 2. Credit/Debit Card: Add card details → Save and allow future charges
// 3. Direct Debit: Add bank details → Save and allow future charges
// → Future invoices auto-debit on due date.
// To manually pay an outstanding/overdue invoice (when auto-payment fails):
// 1. Log in → Dashboard or Finance/Documents
// 2. Select invoice/document (use dropdown to filter types)
// 3. Click ✓ → Choose Credit Card or Direct Debit → Pay
// → Marks invoice PAID once cleared.
// NBN FTTP Upgrade (from March 2022 onward)
// • Upgrades eligible FTTN / FTTC premises to FTTP (direct fibre to premises)
// • $0 standard installation if signing to eligible high-speed plan (min 100/20 Mbps)
// • Non-standard installs may incur costs (NBN advises & seeks approval first)
// • Contact InfiNET to check eligibility → we handle the request
// Key NBN Technologies – Summary
// • FTTP (Fibre to the Premises): Fibre direct to home. Requires NTD inside + utility box outside. Best speeds/reliability.
// • FTTN (Fibre to the Node): Fibre to street node → copper to home. Uses DSL port on modem.
// • FTTC (Fibre to the Curb): Fibre to pit/DPU → short copper to home. Uses NCD + ethernet to router WAN.
// • FTTB (Fibre to the Building): Fibre to building comms room → copper to unit/apartment. DSL modem.
// • HFC (Hybrid Fibre Coaxial): Uses existing cable TV coax. Coax to NTD → ethernet to router WAN.
// • Fixed Wireless: Radio from tower (up to ~14 km) → outdoor antenna → NTD inside.
// • Satellite (Sky Muster): Satellite dish → indoor modem/NTD.
// Modem/Router Connection – General Rules
// • FTTP / FTTC / HFC / Fixed Wireless / Satellite / OptiComm: Connect router WAN port to NBN NTD/NCD UNI-D port (ethernet cable). NBN-ready router required.
// • FTTN / FTTB: Connect DSL port to phone wall socket (VDSL/ADSL modem required).
// Service Classes – Quick Overview (NBN)
// Higher class = more infrastructure already in place → faster activation
// FTTP / FTTB / FTTC / HFC
// • 0 = Future serviceable, not ready yet (pre-order possible)
// • 1 = Serviceable, no equipment yet → book install
// • 2 = External installed, internal pending → book install
// • 3 = Fully installed → activate 1–5 days
// FTTN similar but uses Class 10–13 (copper-based readiness)
// Fixed Wireless: Class 4–6
// Satellite: Class 7–9
// OptiComm FTTP Classes
// • 0 = Future, not ready
// • 1 = Serviceable, no equipment → contact OptiComm directly first
// • 2 = External done, internal pending → order + pay new connection fee ($330–$550 inc GST first time only)
// • 3 = Fully installed → activate 1–2 days
// • 5 = Fully installed + New Development Fee $300 inc GST (first time)
// TP-Link VX230v Router (InfiNET supplied – pre-configured plug & play)
// If factory reset → must reconfigure:
// LEDs (left to right): Power, DSL, Internet, 2.4G, 5G, WAN, LAN1–3, WPS, USB, Phone
// Access admin portal: http://tplinkmodem.net or http://192.168.1.1
// (Initial password: contact InfiNET if reset)
// Quick Setup after reset:
// • Region & Time Zone
// • ISP = Other
// • Connection: EWAN (FTTP/FTTC/HFC/OptiComm) or VDSL (FTTN/FTTB)
// • Use settings supplied by InfiNET at activation
// • Wireless: leave default or customise later
// • Run connection test
// Change settings later: Internet tab (EWAN/DSL) or Wireless tab (SSID/password).
// Mesh Wi-Fi (HX220/510 extenders):
// • Wireless: Add via Network Map → place near VX230 (flashing blue) → auto-pair
// • Ethernet backhaul: Connect HX WAN → VX230 LAN → auto-detects
// VoIP (if subscribed):
// Telephony → Telephone Number → Add/Modify → enter InfiNET-provided VoIP credentials
// General Advice
// • Check address/technology: Use InfiNET “Check your Address” tool or ask support
// • Unsure about modem compatibility, settings, VoIP, etc. → email support@infinetbroadband.com.au
// --- Consolidated FAQs, Hardware, Security & Plans (Residential & Business) ---
// - Common Residential FAQs (answer concisely):
//   * What NBN speed for streaming? For HD, NBN 25 usually enough; 4K or multiple devices recommend NBN 50+.
//   * Keep landline with NBN? Yes, via VoIP (port existing number on most plans).
//   * BYO modem on NBN/OptiComm? Yes if compatible; support can check; we offer hassle-free options.
//   * NBN installation time? 2–10 business days typical; pre-connected: 30 mins–3 hrs; new may need tech/NTD.
//   * Move house? Transfer plan; we check availability and re-activate.
//   * Unlimited data? Yes on all plans.
//   * OptiComm check? OptiComm site or ask us.
//   * OptiComm vs NBN speed? Similar tiers; OptiComm (FTTP) often more consistent.
// - Hope Island Resort (HIR) FAQs:
//   * HIR Internet: Private high-speed (fibre + HFC) in Hope Island Resort, up to 1000 Mbps, fail-over, no connection fees/contracts.
//   * Tech: FTTP/HFC (varies); ultra-fast available.
//   * BYO modem: Yes, most compatible.
//   * Speeds: Up to 1000 Mbps.
// - NBN Fixed Wireless FAQs:
//   * What it is: Tower radio to antenna + box; free standard install.
//   * Good for remote? Yes, improved reliability.
//   * Speeds: Vary by location/congestion/equipment.
// - NBN Sky Muster FAQs:
//   * What it is: Satellite for remote; dish + modem; free install.
//   * Speeds: Up to 100/5 wholesale (varies; latency typical).
//   * Good option: Yes for no fixed line.
//   * Switch: Address eligibility dependent.
// - Residential VoIP FAQs:
//   * VoIP: Internet calls; cheaper, no rental.
//   * Keep number: Yes, port most free.
//   * Works with: NBN/OptiComm.
// - Residential Hardware:
//   * TP-Link VX230v AX1800: $179 (WiFi 6, VoIP, pre-configured).
//   * VX230v + HX510 Mesh: 1-pack $318, 2-pack $459.
//   * HX510 Mesh AP: 1-pack $159, 2-pack $299.
//   * VX420 4G failover: $319 (not FTTB/FTTN).
// - Residential Security:
//   * Basic: $9.95/m (Anti-Virus, patching, remote).
//   * Bronze: $19.95/m (+ Web Protection, 1 session/m).
//   * Silver: $44.95/m (+ 3 sessions/m).
//   * Gold: $65.95/m (+ Unlimited support, DNS, reporting).
// - Residential Plans (intro discounts new customers; confirm address):
//   NBN (unlimited, no contract, month-to-month):
//   - 25/10 Basic: $59/m ($5 off 3m, then $64) – FTTC/FTTN/FTTB/FTTP/HFC
//   - 50/20 Standard: $74/m ($5 off 3m, then $79)
//   - 100/20 Fast: $84/m ($5 off 3m, then $89)
//   - 500/50 Faster: $84/m ($5 off 3m, then $89) – FTTP/HFC
//   - 750/50 Superfast: $99/m ($10 off 3m, then $109) – FTTP/HFC
//   - 1000/100 Ultrafast: $109/m ($10 off 3m, then $119) – FTTP/HFC
//   OptiComm (FTTP, reliable fibre):
//   - 25/10: $64/m ($5 off 3m, then $69)
//   - 50/20: $74/m ($5 off 3m, then $79)
//   - 100/20: $84/m ($5 off 3m, then $89) – limited capacity
//   - 500/50: $79/m ($10 off 3m, then $89)
//   - 750/50: $89/m ($10 off 3m, then $99)
//   - 1000/100: $99/m ($10 off 3m, then $109)
//   Hope Island Resort:
//   - 25/10: $44/m ($15 off 3m, then $59)
//   - 50/20: $49/m ($15 off 3m, then $64)
//   - 250/50: $64/m ($15 off 3m, then $79)
//   - 500/50: $64/m ($15 off 3m, then $79) – free upgrade if needed
//   - 750/50: $74/m ($15 off 3m, then $89)
//   - 1000/100: $84/m ($15 off 3m, then $99)
//   Fixed Wireless:
//   - 25/10: $59/m
//   - 75/10: $89/m
//   - 200/20: $99/m
//   - 400/40: $109/m (eligible areas)
//   Sky Muster:
//   - 25/5: $59/m
//   - 50/5: $69/m
//   - 100/5: $99/m
// - Business Plans & FAQs:
//   * NBN Business: Static IP, priority support, higher uploads.
//   - 50/20: $89/m
//   - 100/40: $109/m
//   - 250/100: $149/m (FTTP/HFC)
//   - 500/200: $189/m (FTTP/HFC)
//   - 1000/400: $239/m (FTTP/HFC)
//   * OptiComm Business: Static IP; fee waiver possible (24m $0/12m $45/else $99; new dev $330 not waived).
//   - 50/20: $79/m ($10 off 3m, then $89)
//   - 100/40: $99/m ($10 off 3m, then $109)
//   - 250/100: $139/m ($10 off 3m, then $149)
//   - 500/200: $169/m ($10 off 3m, then $179)
//   - 1000/400: $189/m ($10 off 3m, then $199)
//   * HIR Business:
//   - 250/100: $109/m
//   - 500/200: $119/m
//   - 1000/400: $139/m
//   * Business VoIP/Cloud PBX: Extensions, CRM integration, etc.
//   - VoIP 30: $30/m (PAYG)
//   - VoIP 50: $50/m (unlimited local/national/mobile)
//   - Extra extensions: $10/m (1-10), $8/m (>10)
// - General Advice (expanded):
//   * Address/technology check: InfiNET tool or email support@infinetbroadband.com.au.
//   * Head Office: Level 15, Corporate Centre One, 2 Corporate Court, Bundall, QLD 4217.
//   * Phone: 1300 101 414.
// Always advise customers to check current pricing and availability via the address checker or support@infinetbroadband.com.au as promotions may change.
// `;
// // ────────────────────────────────────────────────
// // SYSTEM PROMPT + TOOLS (UPDATED SALES FLOW)
// // ────────────────────────────────────────────────
// const SYSTEM_PROMPT = `
// You are a concise, professional voice/chat assistant for ${BRAND}.
// Handle four call types / chat intents: support, sales, general, account.
// STRICT RULES:
// - ALWAYS reply in English.
// - Keep replies short and focused; ask for remaining missing info concisely.
// - Collect structured fields when appropriate and do not re-ask for already collected fields.
// - If the user has a preferredName in collected fields, ALWAYS address them warmly by that name in every response.
// - Do NOT say anything like "we will connect you to a sales agent", "transferring you to support", "handover to human", "I'll put you through" or similar phrases.
// - When enough information is collected per the flow below, call the create_ticket tool with appropriate parameters (generate subject based on the conversation, use issueSummary or leadInterest in the message body).
// - After create_ticket succeeds, reply with the exact message including the ticket ID: "Thank you [preferredName]! I have raised a ticket #[ticket_id]. Our team will contact you shortly."
// - Use the Knowledge base below to answer questions concisely.
// - For support issues, if issueSummary is not collected, ask: "Please provide a brief description of the issue."
// - Use get_ticket_types, get_ticket_groups, get_ticket_statuses if you need IDs for types, groups, statuses when creating tickets.
// INITIAL FLOW - follow these steps exactly:
// 1. After the initial greeting and collecting preferredName, ask: "Are you a new InfiNET customer or an existing one?"
// 2. If they say new (or similar), ask: "Would you like to learn more about InfiNET Broadband, or how may I assist you with our services today?"
//    - If they want to know more, explain briefly: "InfiNET Broadband is a reliable provider of high-speed internet services in Australia, offering NBN, OptiComm, and other technologies with unlimited data plans." Then proceed to sales flow by asking: "How can I help you with our services today?"
//    - If they choose help or sales, proceed directly to sales flow.
// 3. If they say existing (or similar), ask: "How may we help you today? Would it be sales, support, or accounts?"
// 4. Based on their intent, proceed to the corresponding flow. If they are not an existing customer and choose support or accounts, politely explain: "Support and accounts are for existing customers. If you're interested in our services, let's proceed with sales." and switch to sales flow.
// SALES FLOW - follow these steps exactly (for new or interested users):
// 1. Ask: "Great! Are you interested in residential or business plans?"
// 2. After they reply (residential or business) → Ask: "Would you like NBN or OptiComm plans?"
// 3. After they reply (NBN or OptiComm) → Ask: "To check the best plans for you, what's your full address (street, suburb, state and postcode)?"
// 4. Immediately call the check_address_availability tool with the address.
// 5. After tool result → Show available NBN and OptiComm plans concisely (use live data only). Highlight or note plans matching their NBN/OptiComm preference and residential/business choice.
// 6. Ask: "Which plan interests you? Please reply with the plan title or speed (e.g. 100/20 Fast)."
// 7. After they select a plan → Confirm and collect remaining: email, and confirm address if not already collected.
// 8. Use extract_call_fields to capture leadInterest as the selected plan title/speed.
// 9. When ALL details collected (preferredName, email, leadInterest, address) → Call create_ticket with subject like "Sales Inquiry for [leadInterest]", message body including all collected details, lead_id: 0 if new, reporter_type: 'api', priority: 'medium', type_id: appropriate from get_ticket_types (e.g., for sales).
// SUPPORT FLOW (for existing customers only):
// - Answer any question (including generic issues like "my internet is not working", "modem issue", speeds, setup, etc.) using the Knowledge base.
// - If the issue cannot be fully resolved in chat or the user wants further help → Ask for remaining: accountNumber, email, issueSummary if not already collected. For issueSummary, ask for brief description if missing.
// - When ALL details collected (preferredName, accountNumber, email, issueSummary) → Call create_ticket with customer_id: accountNumber, subject based on issueSummary (e.g., "Support: [brief summary]"), message: full issueSummary and details, reporter_type: 'api', priority from collected or 'medium', type_id for support.
// ACCOUNTS FLOW (billing/financing, for existing customers only):
// - Answer any billing or payment questions using the Knowledge base (portal, overdue invoices, update payment method, etc.).
// - For any specific issue → Please provide your accountNumber or email and issueSummary if not already collected.
// - When ALL details collected → Call create_ticket with customer_id: accountNumber, subject: "Accounts Query: [brief summary]", message: issueSummary, reporter_type: 'api', priority: 'medium', type_id for accounts.
// GENERAL: Answer using the Knowledge base. If needed, ask clarifying questions concisely.
// TOOL USAGE (CRITICAL):
// - When the customer asks about plans, pricing, speeds, upgrades or "what plans do you have?": call the get_internet_plans tool.
// - When the customer asks about availability at their address or you reach step 4 in the sales flow: call check_address_availability with the full address.
// - The tool results will be injected into the conversation. ALWAYS use the live tool data for plans and availability (never rely on old hardcoded KB plans).
// - After a tool result, continue the flow concisely using the live data.
// - Call extract_call_fields whenever the user provides any personal info or intent.
// Knowledge base for InfiNET Broadband (use this to answer customer calls and chats concisely):
// ${KB}
// Locations (states) with IDs:
// ${LOCATIONS.map(l => `${l.id}: ${l.name}`).join("\n")}
// `;
// const extractFunction = {
//   name: "extract_call_fields",
//   description: "Extract fields from user message: intent (support/sales/general/account), issueSummary, preferredName (what they want to be called), email, priority, callbackRequest (boolean), timeline, leadInterest, accountNumber. Omit fields not present.",
//   parameters: {
//     type: "object",
//     properties: {
//       intent: { type: "string", enum: ["support", "sales", "general", "account"] },
//       issueSummary: { type: "string" },
//       preferredName: { type: "string" },
//       email: { type: "string" },
//       priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
//       callbackRequest: { type: "boolean" },
//       timeline: { type: "string" },
//       leadInterest: { type: "string" },
//       accountNumber: { type: "string" },
//     },
//     required: [],
//   },
// };
// const getPlansTool = {
//   name: "get_internet_plans",
//   description: "Fetch the latest live internet tariff plans (prices, speeds, availability). ALWAYS call this for any plan/pricing/speed question.",
//   parameters: { type: "object", properties: {}, required: [] }
// };
// const checkAvailabilityTool = {
//   name: "check_address_availability",
//   description: "Check which plans are available at a customer's address. Requires full address.",
//   parameters: {
//     type: "object",
//     properties: {
//       address: { type: "string", description: "Full address including street, suburb, state and postcode if possible" }
//     },
//     required: ["address"]
//   }
// };
// const createTicketTool = {
//   name: "create_ticket",
//   description: "Create a new ticket in Splynx. Use this when ready to raise a ticket based on the flow.",
//   parameters: {
//     type: "object",
//     properties: {
//       customer_id: { type: "number" },
//       incoming_customer_id: { type: "number" },
//       lead_id: { type: "number" },
//       reporter_id: { type: "number" },
//       reporter_type: { type: "string", enum: ["admin", "customer", "api", "incoming", "none"] },
//       hidden: { type: "boolean" },
//       assign_to: { type: "number" },
//       status_id: { type: "number" },
//       group_id: { type: "number" },
//       type_id: { type: "number" },
//       task_id: { type: "number" },
//       subject: { type: "string" },
//       priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
//       star: { type: "boolean" },
//       unread_by_customer: { type: "boolean" },
//       unread_by_admin: { type: "boolean" },
//       closed: { type: "boolean" },
//       source: { type: "string", enum: ["administration", "api", "portal", "widget", "incoming"] },
//       trash: { type: "number" },
//       shareable: { type: "number" },
//       note: { type: "string" },
//       watching: { type: "number" },
//       related_account_id: { type: "number" },
//       related_account_type: { type: "string", enum: ["none", "main", "sub"] },
//       hidden_from_related_account: { type: "number" },
//       unread_by_related_account: { type: "number" },
//       watchers: { type: "array", items: { type: "number" } },
//       moduleLabels: { type: "array", items: { type: "number" } },
//       message: {
//         type: "object",
//         properties: {
//           message: { type: "string" },
//           hide_for_customer: { type: "boolean" },
//           mail_to: { type: "string" },
//           smsTo: { type: "array", items: { type: "string" } },
//           mail_cc: { type: "string" },
//           mail_bcc: { type: "string" },
//         }
//       }
//     },
//     required: ["subject", "priority"]
//   }
// };
// const getTicketTypesTool = {
//   name: "get_ticket_types",
//   description: "Fetch the list of ticket types.",
//   parameters: { type: "object", properties: {}, required: [] }
// };
// const getTicketGroupsTool = {
//   name: "get_ticket_groups",
//   description: "Fetch the list of ticket groups.",
//   parameters: { type: "object", properties: {}, required: [] }
// };
// const getTicketStatusesTool = {
//   name: "get_ticket_statuses",
//   description: "Fetch the list of ticket statuses.",
//   parameters: { type: "object", properties: {}, required: [] }
// };
// const tools = [extractFunction, getPlansTool, checkAvailabilityTool, createTicketTool, getTicketTypesTool, getTicketGroupsTool, getTicketStatusesTool];
// // ────────────────────────────────────────────────
// // HELPER FUNCTIONS
// // ────────────────────────────────────────────────
// function mkSession(sessionId) {
//   const id = sessionId || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
//   const session = {
//     id,
//     collected: {},
//     messages: [{ role: "system", content: SYSTEM_PROMPT }],
//     lastSeen: new Date().toISOString(),
//   };
//   sessions.set(id, session);
//   return session;
// }
// function normalizeText(t) {
//   if (!t) return "";
//   return t.toString().replace(/\u200B/g, "").replace(/\s+/g, " ").trim();
// }
// function safeParseJSON(s) {
//   try { return JSON.parse(s); } catch (e) { return null; }
// }
// function numbersToInt(obj) {
//   const out = {};
//   for (const k of Object.keys(obj || {})) {
//     const v = obj[k];
//     if (typeof v === "number") out[k] = Math.round(v);
//     else out[k] = v;
//   }
//   return out;
// }
// async function convertToWav(inputPath) {
//   const out = inputPath + ".converted.wav";
//   return new Promise((resolve, reject) => {
//     ffmpeg(inputPath)
//       .outputOptions(["-ar 16000", "-ac 1", "-vn"])
//       .toFormat("wav")
//       .on("end", () => resolve(out))
//       .on("error", (err) => reject(err))
//       .save(out);
//   });
// }
// async function streamToBuffer(body) {
//   if (!body) return Buffer.from("");
//   if (Buffer.isBuffer(body)) return body;
//   if (body.arrayBuffer) {
//     const ab = await body.arrayBuffer();
//     return Buffer.from(ab);
//   }
//   if (body.pipe) {
//     const chunks = [];
//     return new Promise((resolve, reject) => {
//       body.on("data", (c) => chunks.push(Buffer.from(c)));
//       body.on("end", () => resolve(Buffer.concat(chunks)));
//       body.on("error", (err) => reject(err));
//     });
//   }
//   return Buffer.from(JSON.stringify(body));
// }
// function applyExtractionToSession(session, parsed) {
//   const extractionResult = numbersToInt(parsed || {});
//   for (const [k, v] of Object.entries(extractionResult)) {
//     if (v !== undefined && v !== null) session.collected[k] = v;
//   }
//   session.lastSeen = new Date().toISOString();
//   sessions.set(session.id, session);
//   return extractionResult;
// }
// async function makeTTS(text) {
//   try {
//     const tts = await openai.audio.speech.create({
//       model: "gpt-4o-mini-tts",
//       voice: "cedar",
//       input: text,
//       format: "mp3",
//     });
//     const buf = await streamToBuffer(tts);
//     return buf;
//   } catch (err) {
//     console.warn("TTS failed:", err?.message || err);
//     return null;
//   }
// }
// async function fetchTariffs() {
//   try {
//     const data = await splynx.listInternetTariffs();
//     return Array.isArray(data) ? data : [];
//   } catch (err) {
//     console.error("Failed to fetch internet tariffs from Splynx:", err.message);
//     return [];
//   }
// }
// async function determineLocationId(address) {
//   if (!address) return null;
//   const prompt = `You are an expert at identifying Australian states from addresses.
// Reply with EXACTLY one of these state names (nothing else):
// Queensland
// Victoria
// New South Wales
// Tasmania
// Western Australia
// South Australia
// Northern Territory
// ACT
// If the address does not clearly indicate any state, reply "Unknown".
// Address: ${address}`;
//   try {
//     const resp = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: [{ role: "user", content: prompt }],
//       temperature: 0,
//       max_tokens: 20,
//     });
//     let stateName = resp.choices[0].message.content.trim();
//     if (stateName === "Unknown") return null;
//     const nameMap = { QLD: "Queensland", VIC: "Victoria", NSW: "New South Wales", TAS: "Tasmania", WA: "Western Australia", SA: "South Australia", NT: "Northern Territory", ACT: "ACT" };
//     if (nameMap[stateName]) stateName = nameMap[stateName];
//     const loc = LOCATIONS.find(l => l.name.toLowerCase() === stateName.toLowerCase());
//     return loc ? loc.id : null;
//   } catch (err) {
//     console.error("Location determination failed:", err.message);
//     return null;
//   }
// }
// function objectToFormData(obj, form = new FormData(), namespace = '') {
//   for (const property in obj) {
//     if (obj.hasOwnProperty(property)) {
//       const formKey = namespace ? `${namespace}[${property}]` : property;
//       if (typeof obj[property] === 'object' && !(obj[property] instanceof File) && !Array.isArray(obj[property])) {
//         objectToFormData(obj[property], form, formKey);
//       } else if (Array.isArray(obj[property])) {
//         obj[property].forEach((item) => {
//           const arrayKey = `${formKey}[]`;
//           if (typeof item === 'object' && !(item instanceof File)) {
//             objectToFormData(item, form, arrayKey);
//           } else {
//             form.append(arrayKey, item);
//           }
//         });
//       } else {
//         form.append(formKey, obj[property]);
//       }
//     }
//   }
//   return form;
// }
// // ────────────────────────────────────────────────
// // AGENT ENDPOINTS
// // ────────────────────────────────────────────────
// app.post("/api/chat/init", async (req, res) => {
//   try {
//     const session = mkSession();
//     const greeting = `Hi there! Welcome to InfiNET Broadband. Could you please share your name to get started?`;
//     session.messages.push({ role: "assistant", content: greeting });
//     sessions.set(session.id, session);
//     // const ttsBuf = await makeTTS(greeting);
//     // const audioBase64 = ttsBuf ? ttsBuf.toString("base64") : null;
//     return res.json({ sessionId: session.id, text: greeting });
//   } catch (err) {
//     console.error("chat init err", err);
//     return res.status(500).json({ error: err?.message || "server error" });
//   }
// });
// app.post("/api/voice", upload.single("audio"), async (req, res) => {
//   const incomingSessionId = (req.body && req.body.sessionId) || req.query.sessionId || req.headers["x-session-id"] || null;
//   if (!req.file) return res.status(400).json({ error: "Missing audio file (multipart field 'audio')" });
//   const uploadedPath = path.resolve(req.file.path);
//   let convertedPath = null;
//   try {
//     const session = incomingSessionId && sessions.has(incomingSessionId) ? sessions.get(incomingSessionId) : mkSession(incomingSessionId);
//     const origName = (req.file.originalname || "").toLowerCase();
//     const mimetype = (req.file.mimetype || "").toLowerCase();
//     const looksLikeWav = origName.endsWith(".wav") || mimetype === "audio/wav" || mimetype === "audio/wave" || mimetype === "audio/x-wav";
//     if (looksLikeWav) {
//       convertedPath = uploadedPath;
//     } else {
//       convertedPath = await convertToWav(uploadedPath);
//     }
//     const transcriptionResp = await openai.audio.transcriptions.create({
//       file: fs.createReadStream(convertedPath),
//       model: "gpt-4o-mini-transcribe",
//     });
//     const userTextRaw = normalizeText(transcriptionResp?.text || "");
//     if (!userTextRaw) {
//       const prompt = "Sorry, I didn't catch that — could you please repeat briefly?";
//       const ttsBuf = await makeTTS(prompt);
//       session.lastSeen = new Date().toISOString();
//       sessions.set(session.id, session);
//       return res.json({ sessionId: session.id, text: prompt, audioBase64: ttsBuf ? ttsBuf.toString("base64") : null });
//     }
//     session.messages.push({ role: "user", content: userTextRaw });
//     let assistantText = null;
//     const firstCompletion = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: session.messages,
//       functions: tools,
//       function_call: "auto",
//       temperature: 0.0,
//       max_tokens: 300,
//     });
//     const firstMsg = firstCompletion.choices?.[0]?.message;
//     if (firstMsg?.function_call) {
//       const funcName = firstMsg.function_call.name;
//       const args = safeParseJSON(firstMsg.function_call.arguments) || {};
//       session.messages.push(firstMsg);
//       let toolContent;
//       if (funcName === "extract_call_fields") {
//         applyExtractionToSession(session, args);
//         toolContent = JSON.stringify({ success: true });
//       } else if (funcName === "get_internet_plans") {
//         const tariffs = await fetchTariffs();
//         toolContent = JSON.stringify({
//           success: true,
//           plans: tariffs.map(t => ({
//             id: t.id,
//             title: t.title,
//             price: parseFloat(t.price),
//             download: `${(t.speed_download / 1000)} Mbps`,
//             upload: `${(t.speed_upload / 1000)} Mbps`,
//             available_for_locations: t.available_for_locations || []
//           }))
//         });
//       } else if (funcName === "check_address_availability") {
//         const { address } = args;
//         if (!address) {
//           toolContent = JSON.stringify({ error: "Address is required" });
//         } else {
//           const locId = await determineLocationId(address);
//           const tariffs = await fetchTariffs();
//           const availablePlans = locId
//             ? tariffs.filter(t => t.available_for_locations && t.available_for_locations.includes(locId))
//             : [];
//           toolContent = JSON.stringify({
//             success: true,
//             address,
//             locationId: locId,
//             locationName: LOCATIONS.find(l => l.id === locId)?.name || "Unknown",
//             availablePlans: availablePlans.map(p => ({
//               title: p.title,
//               price: parseFloat(p.price),
//               download: `${(p.speed_download / 1000)} Mbps`,
//               upload: `${(p.speed_upload / 1000)} Mbps`
//             }))
//           });
//         }
//       } else if (funcName === "create_ticket") {
//         try {
//           let fixedArgs = {...args};
//           if (typeof fixedArgs.message === 'string') {
//             fixedArgs.message = { message: fixedArgs.message };
//           }
//           const formData = objectToFormData(fixedArgs);
//           console.log('Creating ticket with args:', JSON.stringify(fixedArgs));
//           const response = await splynx.request('POST', 'admin/support/tickets', formData);
//           toolContent = JSON.stringify({ success: true, ticket_id: response.id });
//         } catch (err) {
//           console.error('Create ticket failed with args:', JSON.stringify(args), 'error:', err);
//           toolContent = JSON.stringify({ success: false, error: err.message || 'Failed to create ticket' });
//         }
//       } else if (funcName === "get_ticket_types") {
//         try {
//           const types = await splynx.request('GET', 'admin/support/tickets-types');
//           toolContent = JSON.stringify({ success: true, types });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       } else if (funcName === "get_ticket_groups") {
//         try {
//           const groups = await splynx.request('GET', 'admin/support/tickets-groups');
//           toolContent = JSON.stringify({ success: true, groups });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       } else if (funcName === "get_ticket_statuses") {
//         try {
//           const statuses = await splynx.request('GET', 'admin/support/tickets-statuses');
//           toolContent = JSON.stringify({ success: true, statuses });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       }
//       session.messages.push({ role: "function", name: funcName, content: toolContent });
//       const collectedSummary = `CollectedFields: ${JSON.stringify(session.collected || {})}.`;
//       const followupSystem = `You are a concise assistant for ISP CRM. Use collected fields and ask for remaining missing info concisely. Use the tool results above for accurate plans and availability.`;
//       const finalMessages = [
//         { role: "system", content: followupSystem },
//         ...session.messages,
//         { role: "system", content: collectedSummary },
//       ];
//       const finalResp = await openai.chat.completions.create({
//         model: "gpt-4o-mini",
//         messages: finalMessages,
//         temperature: 0.0,
//         max_tokens: 350,
//       });
//       assistantText = finalResp.choices?.[0]?.message?.content?.trim() || "Thanks — I have your details.";
//       session.messages.push({ role: "assistant", content: assistantText });
//     } else if (firstMsg?.content) {
//       assistantText = firstMsg.content;
//       session.messages.push({ role: "assistant", content: assistantText });
//     }
//     const ttsBuf = await makeTTS(assistantText);
//     session.lastSeen = new Date().toISOString();
//     sessions.set(session.id, session);
//     return res.json({ sessionId: session.id, text: assistantText, audioBase64: ttsBuf ? ttsBuf.toString("base64") : null });
//   } catch (err) {
//     console.error("voice error:", err);
//     return res.status(500).json({ error: err?.message || "server error" });
//   } finally {
//     try { if (uploadedPath && fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath); } catch (_) {}
//     try { if (convertedPath && convertedPath !== uploadedPath && fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath); } catch (_) {}
//   }
// });
// app.post("/api/chat/message", async (req, res) => {
//   try {
//     const { sessionId, message } = req.body;
//     if (!message) return res.status(400).json({ error: "Missing message" });
//     const session = sessionId && sessions.has(sessionId) ? sessions.get(sessionId) : mkSession(sessionId);
//     session.messages.push({ role: "user", content: message });
//     let assistantText = null;
//     const firstCompletion = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: session.messages,
//       functions: tools,
//       function_call: "auto",
//       temperature: 0.0,
//       max_tokens: 300,
//     });
//     const firstMsg = firstCompletion.choices?.[0]?.message;
//     if (firstMsg?.function_call) {
//       const funcName = firstMsg.function_call.name;
//       const args = safeParseJSON(firstMsg.function_call.arguments) || {};
//       session.messages.push(firstMsg);
//       let toolContent;
//       if (funcName === "extract_call_fields") {
//         applyExtractionToSession(session, args);
//         toolContent = JSON.stringify({ success: true });
//       } else if (funcName === "get_internet_plans") {
//         const tariffs = await fetchTariffs();
//         toolContent = JSON.stringify({
//           success: true,
//           plans: tariffs.map(t => ({
//             id: t.id,
//             title: t.title,
//             price: parseFloat(t.price),
//             download: `${(t.speed_download / 1000)} Mbps`,
//             upload: `${(t.speed_upload / 1000)} Mbps`,
//             available_for_locations: t.available_for_locations || []
//           }))
//         });
//       } else if (funcName === "check_address_availability") {
//         const { address } = args;
//         if (!address) {
//           toolContent = JSON.stringify({ error: "Address is required" });
//         } else {
//           const locId = await determineLocationId(address);
//           const tariffs = await fetchTariffs();
//           const availablePlans = locId
//             ? tariffs.filter(t => t.available_for_locations && t.available_for_locations.includes(locId))
//             : [];
//           toolContent = JSON.stringify({
//             success: true,
//             address,
//             locationId: locId,
//             locationName: LOCATIONS.find(l => l.id === locId)?.name || "Unknown",
//             availablePlans: availablePlans.map(p => ({
//               title: p.title,
//               price: parseFloat(p.price),
//               download: `${(p.speed_download / 1000)} Mbps`,
//               upload: `${(p.speed_upload / 1000)} Mbps`
//             }))
//           });
//         }
//       } else if (funcName === "create_ticket") {
//         try {
//           let fixedArgs = {...args};
//           if (typeof fixedArgs.message === 'string') {
//             fixedArgs.message = { message: fixedArgs.message };
//           }
//           const formData = objectToFormData(fixedArgs);
//           console.log('Creating ticket with args:', JSON.stringify(fixedArgs));
//           const response = await splynx.request('POST', 'admin/support/tickets', formData);
//           toolContent = JSON.stringify({ success: true, ticket_id: response.id });
//         } catch (err) {
//           console.error('Create ticket failed with args:', JSON.stringify(args), 'error:', err);
//           toolContent = JSON.stringify({ success: false, error: err.message || 'Failed to create ticket' });
//         }
//       } else if (funcName === "get_ticket_types") {
//         try {
//           const types = await splynx.request('GET', 'admin/support/tickets-types');
//           toolContent = JSON.stringify({ success: true, types });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       } else if (funcName === "get_ticket_groups") {
//         try {
//           const groups = await splynx.request('GET', 'admin/support/tickets-groups');
//           toolContent = JSON.stringify({ success: true, groups });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       } else if (funcName === "get_ticket_statuses") {
//         try {
//           const statuses = await splynx.request('GET', 'admin/support/tickets-statuses');
//           toolContent = JSON.stringify({ success: true, statuses });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       }
//       session.messages.push({ role: "function", name: funcName, content: toolContent });
//       const collectedSummary = `CollectedFields: ${JSON.stringify(session.collected || {})}.`;
//       const followupSystem = `You are a concise assistant for ISP CRM. Use collected fields and ask for remaining missing info concisely. Use the tool results above for accurate plans and availability.`;
//       const finalMessages = [
//         { role: "system", content: followupSystem },
//         ...session.messages,
//         { role: "system", content: collectedSummary },
//       ];
//       const finalResp = await openai.chat.completions.create({
//         model: "gpt-4o-mini",
//         messages: finalMessages,
//         temperature: 0.0,
//         max_tokens: 350,
//       });
//       assistantText = finalResp.choices?.[0]?.message?.content?.trim() || "Thanks — I have your details.";
//       session.messages.push({ role: "assistant", content: assistantText });
//     } else if (firstMsg?.content) {
//       assistantText = firstMsg.content;
//       session.messages.push({ role: "assistant", content: assistantText });
//     }
//     session.lastSeen = new Date().toISOString();
//     sessions.set(session.id, session);
//     return res.json({ sessionId: session.id, text: assistantText, collected: session.collected });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: err?.message || "server error" });
//   }
// });
// // ────────────────────────────────────────────────
// // SPLYNX PROXY ROUTES
// // ────────────────────────────────────────────────
// app.get('/health', (req, res) => {
//   res.json({
//     status: 'ok',
//     splynx: {
//       hasToken: !!splynx.accessToken,
//       tokenExpires: splynx.accessTokenExpiration ? new Date(splynx.accessTokenExpiration * 1000).toISOString() : null,
//     },
//   });
// });
// app.get('/api/customers', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customer', null, { limit: 10, offset: 0 })); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customers', details: err }); }
// });
// app.get('/api/customer/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Customer not found' }); }
// });
// app.get('/api/online', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customers-online')); }
//   catch (err) { res.status(500).json({ error: 'Failed to get online customers' }); }
// });
// app.get('/api/traffic/:serviceId', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/fup/usage/${req.params.serviceId}?with_texts=true`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get traffic usage' }); }
// });
// app.get('/api/tariffs/internet', async (req, res) => {
//   try { res.json(await splynx.listInternetTariffs(req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list internet tariffs' }); }
// });
// app.get('/api/tariffs/internet/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/tariffs/internet/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get tariff' }); }
// });
// app.post('/api/tariffs/internet', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/tariffs/internet', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create tariff' }); }
// });
// app.put('/api/tariffs/internet/:id', async (req, res) => {
//   try { res.json(await splynx.request('PUT', `admin/tariffs/internet/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update tariff' }); }
// });
// app.delete('/api/tariffs/internet/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/tariffs/internet/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete tariff' });
//   }
// });
// app.get('/api/locations', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/administration/locations', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list locations' }); }
// });
// app.get('/api/locations/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/administration/locations/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Location not found' }); }
// });
// app.post('/api/locations', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/administration/locations', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create location' }); }
// });
// app.put('/api/locations/:id', async (req, res) => {
//   try { res.json(await splynx.request('PUT', `admin/administration/locations/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update location' }); }
// });
// app.delete('/api/locations/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/administration/locations/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete location' });
//   }
// });
// app.get('/api/administrators', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/administration/administrators', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list administrators' }); }
// });
// app.get('/api/administrators/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/administration/administrators/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Admin not found' }); }
// });
// app.get('/api/partners', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/administration/partners', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list partners' }); }
// });
// app.get('/api/partners/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/administration/partners/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Partner not found' }); }
// });
// // Tickets APIs integration
// app.post('/api/admin/support/tickets', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/support/tickets', req.body)); } // Note: Files not supported in this JSON proxy; use multipart if needed
//   catch (err) { res.status(500).json({ error: 'Failed to create ticket' }); }
// });
// app.get('/api/admin/support/tickets', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/tickets', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list tickets' }); }
// });
// app.get('/api/admin/support/tickets/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/tickets/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket' }); }
// });
// app.put('/api/admin/support/tickets/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/support/tickets/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update ticket' }); }
// });
// app.delete('/api/admin/support/tickets/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/support/tickets/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete ticket' });
//   }
// });
// app.post('/api/admin/support/ticket-messages', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/support/ticket-messages', req.body)); } // Note: Files not supported
//   catch (err) { res.status(500).json({ error: 'Failed to create ticket message' }); }
// });
// app.get('/api/admin/support/ticket-messages', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/ticket-messages', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket messages' }); }
// });
// app.get('/api/admin/support/ticket-messages/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/ticket-messages/${req.params.id}`, null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket message' }); }
// });
// app.put('/api/admin/support/ticket-messages/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/support/ticket-messages/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update ticket message' }); }
// });
// app.delete('/api/admin/support/ticket-messages/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/support/ticket-messages/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete ticket message' });
//   }
// });
// app.get('/api/admin/support/tickets-statuses', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/tickets-statuses', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket statuses' }); }
// });
// app.get('/api/admin/support/tickets-statuses/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/tickets-statuses/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket status' }); }
// });
// app.get('/api/admin/support/tickets-groups', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/tickets-groups', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket groups' }); }
// });
// app.get('/api/admin/support/tickets-groups/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/tickets-groups/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket group' }); }
// });
// app.get('/api/admin/support/tickets-types', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/tickets-types', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket types' }); }
// });
// app.get('/api/admin/support/tickets-types/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/tickets-types/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket type' }); }
// });
// app.get('/api/admin/support/ticket-attachments', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/ticket-attachments', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket attachments' }); }
// });
// app.get('/api/admin/support/ticket-attachments/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/ticket-attachments/${req.params.id}`, null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket attachment' }); }
// });
// app.post('/api/admin/support/ticket-attachments', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/support/ticket-attachments', req.body)); } // Note: Files not supported
//   catch (err) { res.status(500).json({ error: 'Failed to create ticket attachment' }); }
// });
// app.delete('/api/admin/support/ticket-attachments/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/support/ticket-attachments/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete ticket attachment' });
//   }
// });
// app.get('/api/admin/support/ticket-feedbacks', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/ticket-feedbacks', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket feedbacks' }); }
// });
// app.post('/api/admin/support/ticket-feedbacks', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/support/ticket-feedbacks', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create ticket feedbacks' }); }
// });
// app.get('/api/admin/support/ticket-feedbacks/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/ticket-feedbacks/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket feedback' }); }
// });
// app.put('/api/admin/support/ticket-feedbacks/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/support/ticket-feedbacks/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update ticket feedback' }); }
// });
// app.delete('/api/admin/support/ticket-feedbacks/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/support/ticket-feedbacks/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete ticket feedback' });
//   }
// });
// app.all(/^\/api\/.*/, async (req, res) => {
//   try {
//     let endpoint = req.path.replace(/^\/api\//, '');
//     if (!endpoint) return res.status(400).json({ error: 'Missing endpoint after /api/' });
//     const data = await splynx.request(
//       req.method,
//       endpoint,
//       req.method !== 'GET' && req.method !== 'HEAD' ? req.body : null,
//       req.query
//     );
//     if (req.method === 'DELETE') {
//       res.status(204).send();
//     } else {
//       res.json(data);
//     }
//   } catch (err) {
//     const status = err?.response?.status || 500;
//     res.status(status).json({
//       error: 'Splynx proxy error',
//       message: err.message || 'Request failed',
//       details: err
//     });
//   }
// });
// // ────────────────────────────────────────────────
// // START SERVER
// // ────────────────────────────────────────────────
// app.listen(PORT, () => {
//   console.log(`✅ InfiNET Agent + Full Splynx Integration running on http://localhost:${PORT}`);
//   console.log(` • First message: "Hello, thank you for contacting InfiNET Broadband. I am your AI assistant. Nice to meet you."`);
//   console.log(` • SALES FLOW now includes NBN / OptiComm question after residential/business`);
//   console.log(` • Full working code - no syntax errors`);
// });
// import express from "express";
// import multer from "multer";
// import fs from "fs";
// import path from "path";
// import cors from "cors";
// import dotenv from "dotenv";
// import ffmpeg from "fluent-ffmpeg";
// import ffmpegStatic from "ffmpeg-static";
// import OpenAI from "openai";
// import axios from "axios";
// import crypto from "crypto";
// import FormData from "form-data";
// dotenv.config();
// if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
// const PORT = process.env.PORT || 3003;
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// if (!OPENAI_API_KEY) {
//   console.error("Please set OPENAI_API_KEY in your environment or .env");
//   process.exit(1);
// }
// const app = express();
// app.use(cors());
// app.use(express.json());
// app.use(express.static("public"));
// const upload = multer({ dest: "uploads/" });
// const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
// const sessions = new Map();
// const BRAND = "InfiNET Broadband";
// // ────────────────────────────────────────────────
// // SPLYNX CONFIG & CLIENT
// // ────────────────────────────────────────────────
// const CONFIG = {
//   SPLYNX_BASE_URL: 'https://infinetbroadband-portal.com.au/api/2.0/',
//   API_KEY: '107c483d15e930b41b8d70affdd08632',
//   API_SECRET: '9b8b46ce928bea980a8d092a288372e0',
//   USE_ACCESS_TOKEN: true,
// };
// class SplynxApiClient {
//   constructor(config) {
//     this.baseUrl = config.SPLYNX_BASE_URL;
//     this.apiKey = config.API_KEY;
//     this.apiSecret = config.API_SECRET;
//     this.accessToken = null;
//     this.accessTokenExpiration = 0;
//     this.refreshToken = null;
//     this.refreshTokenExpiration = 0;
//     this.useAccessToken = config.USE_ACCESS_TOKEN !== false;
//   }
//   generateSignature(nonce) {
//     const data = nonce + this.apiKey;
//     const hmac = crypto.createHmac('sha256', this.apiSecret);
//     hmac.update(data);
//     return hmac.digest('hex').toUpperCase();
//   }
//   getSignatureAuthHeader() {
//     const nonce = Math.round(Date.now() / 1000 * 100);
//     const signature = this.generateSignature(nonce);
//     const params = { key: this.apiKey, nonce, signature };
//     return `Splynx-EA (${new URLSearchParams(params).toString()})`;
//   }
//   async generateAccessToken() {
//     try {
//       const nonce = Math.floor(Date.now() / 1000);
//       const response = await axios.post(
//         `${this.baseUrl}admin/auth/tokens`,
//         {
//           auth_type: 'api_key',
//           key: this.apiKey,
//           nonce,
//           signature: this.generateSignature(nonce),
//         },
//         { headers: { 'Content-Type': 'application/json' } }
//       );
//       const data = response.data;
//       this.accessToken = data.access_token;
//       this.accessTokenExpiration = data.access_token_expiration;
//       this.refreshToken = data.refresh_token;
//       this.refreshTokenExpiration = data.refresh_token_expiration;
//       console.log('✅ Splynx Access token generated');
//       return data;
//     } catch (err) {
//       console.error('Token generation failed:', err.response?.data || err.message);
//       throw err;
//     }
//   }
//   async renewAccessToken() {
//     if (!this.refreshToken) throw new Error('No refresh token available');
//     try {
//       const response = await axios.get(
//         `${this.baseUrl}admin/auth/tokens/${this.refreshToken}`,
//         {
//           headers: { Authorization: `Splynx-EA (access_token=${this.accessToken})` },
//         }
//       );
//       const data = response.data;
//       this.accessToken = data.access_token;
//       this.accessTokenExpiration = data.access_token_expiration;
//       this.refreshToken = data.refresh_token;
//       this.refreshTokenExpiration = data.refresh_token_expiration;
//       console.log('✅ Splynx Access token renewed');
//       return data;
//     } catch (err) {
//       console.error('Token renew failed:', err.response?.data || err.message);
//       throw err;
//     }
//   }
//   isTokenExpired(bufferSeconds = 30) {
//     return Date.now() / 1000 + bufferSeconds > this.accessTokenExpiration;
//   }
//   async request(method, endpoint, data = null, params = {}) {
//     let headers = {};
//     if (data && !(data instanceof FormData)) {
//       headers['Content-Type'] = 'application/json';
//     }
//     if (this.useAccessToken && this.accessToken) {
//       if (this.isTokenExpired()) {
//         console.log('Token expired → renewing...');
//         await this.renewAccessToken();
//       }
//       headers.Authorization = `Splynx-EA (access_token=${this.accessToken})`;
//     } else {
//       headers.Authorization = this.getSignatureAuthHeader();
//     }
//     const url = `${this.baseUrl}${endpoint}`;
//     console.log(`Making [${method}] to ${endpoint} with data:`, data ? (data instanceof FormData ? 'FormData object' : data) : 'no data');
//     try {
//       const config = { method, url, headers, params, ...(data && { data }) };
//       const response = await axios(config);
//       return response.data;
//     } catch (err) {
//       if (err.response?.status === 401) {
//         console.warn('401 → retrying after renew...');
//         await this.renewAccessToken();
//         return this.request(method, endpoint, data, params);
//       }
//       console.error(`[${method}] ${endpoint} failed with data:`, data ? (data instanceof FormData ? 'FormData object' : data) : 'no data', 'error:', err.response?.data || err.message);
//       throw err.response?.data || err;
//     }
//   }
//   async listInternetTariffs(params = {}) {
//     return this.request('GET', 'admin/tariffs/internet', null, params);
//   }
//   async searchCustomers(searchParams) {
//     return this.request('GET', 'admin/customers/customer', null, searchParams);
//   }
//   async getCustomerTariffs(customerId, params = {}) {
//     return this.request('GET', `admin/customers/customer-tariffs/${customerId}`, null, params);
//   }
// }
// const splynx = new SplynxApiClient(CONFIG);
// (async () => {
//   try {
//     if (CONFIG.USE_ACCESS_TOKEN) {
//       await splynx.generateAccessToken();
//     }
//   } catch (err) {
//     console.error('Initial Splynx token generation failed. Some calls may fail.');
//   }
// })();
// app.use(async (req, res, next) => {
//   try {
//     if (CONFIG.USE_ACCESS_TOKEN && !splynx.accessToken) {
//       await splynx.generateAccessToken();
//     }
//     next();
//   } catch (err) {
//     console.error('Splynx middleware error:', err.message);
//     next();
//   }
// });
// // ────────────────────────────────────────────────
// // LOCATIONS
// // ────────────────────────────────────────────────
// const LOCATIONS = [
//   { id: 1, name: "Queensland" },
//   { id: 2, name: "Victoria" },
//   { id: 3, name: "New South Wales" },
//   { id: 4, name: "Tasmania" },
//   { id: 5, name: "Western Australia" },
//   { id: 6, name: "South Australia" },
//   { id: 7, name: "Northern Territory" },
//   { id: 8, name: "ACT" }
// ];
// // ────────────────────────────────────────────────
// // FULL KNOWLEDGE BASE
// // ────────────────────────────────────────────────
// const KB = `
// Knowledge base for InfiNET Broadband (use this to answer customer calls and chats concisely):
// - Greeting / Routing:
//   "Thanks for calling InfiNET Broadband, how may we help you? Would it be sales, support, or accounts?"
//   If caller says sales/support/accounts, proceed accordingly and collect structured fields.
// - Payment & Portal:
//   "Did you know you can update your payment method via the customer portal?"
//   If the customer does not have portal access, tell them: "If you don’t have access to the customer portal, please email support@infinetbroadband.com.au and our team will issue you the login credentials."
// - Support contact:
//   "If you are having issues with your Internet service please email support@infinetbroadband.com.au and our support team will be able to assist you."
// - Plan change / Upgrade:
//   "Did you want to upgrade or change the internet plan you are on? Please just email support@infinetbroadband.com.au and our support team will be able to assist you."
// - Outstanding / Overdue invoice:
//   "Do you have an outstanding or overdue invoice? If so, just login to the customer portal to manually pay this. You can also log a support ticket via support@infinetbroadband.com.au and our accounts team will be able to assist you."
// - Payment details changed / lost card / new bank:
//   "Have your payment details changed, lost a card, or changed bank details? Just login to the customer portal to update this manually, or you can also log a support ticket via support@infinetbroadband.com.au and our accounts team will be able to assist you."
// - Cannot login to portal:
//   "Not able to login to the customer portal? Just email support@infinetbroadband.com.au and our accounts team will be able to assist."
// - NBN vs OptiComm:
//   "Both NBN and OptiComm deliver fibre internet in Australia. The main difference is availability: NBN is the national wholesale network while OptiComm is a private fibre network available in selected estates and buildings. Both offer similar speeds. InfiNET Broadband can connect you to either depending on what's available at your address."
// - Opticomm Free to Air TV issue:
//   "Infinet Broadband does not support your free to air television service. Please contact Opticomm directly — you can visit https://online.telco.opticomm.com.au/television-fault Thank you, goodbye."
// - Common Qs to answer concisely:
//   * Can I use my own or existing modem (BYO Modem) on the NBN & Opticomm Internet services?
//     - Answer: Yes, you can bring your own compatible modem. If you’re unsure, our support team can help check compatibility. We also offer modems for purchase if you prefer a hassle-free setup.
//   * Do you offer unlimited data on NBN & OptiComm Internet?
//     - Answer: Yes, all of our NBN and OptiComm internet plans come with unlimited data. Stream, work, and play without worrying about data limits or excess charges.
//   * How fast is NBN compared to OptiComm?
//     - Answer: Speeds depend on your chosen plan. Both NBN and OptiComm can deliver speeds from 25 Mbps up to 1,000 Mbps in some areas. OptiComm may offer higher speeds in certain fibre-enabled estates, while NBN is more widely available across Australia.
//   * How long does setup take to setup NBN or Opticomm?
//     - Answer: In most cases, either NBN or OptiComm services can be activated within 30mins to 3 hours if your premises has already been connected. If your premise has never been connected before (new home or building) a tech visit is required, it may take a little longer as some new homes required an NTD (Network Termination Device) to be installed and this requires an onsite tech visit to be booked in by one of our team members. Our team will guide you through every step.
//   * How do I check if my home has OptiComm?
//     - Answer: They can check OptiComm coverage on the OptiComm website or ask InfiNET and we'll confirm quickly.
// - Tone:
//   * Always concise and professional.
//   * Ask for remaining missing info in a single concise message.
// - Contact info to use:
//   * support@infinetbroadband.com.au
// Additional Knowledge Base – Concise Version
// Payment Setup & Manual Payment
// Customer portal: https://infinetbroadband-portal.com.au/
// To set up recurring payment (Direct Debit or Credit/Debit Card):
// 1. Log in → Finance → Select payment method
// 2. Credit/Debit Card: Add card details → Save and allow future charges
// 3. Direct Debit: Add bank details → Save and allow future charges
// → Future invoices auto-debit on due date.
// To manually pay an outstanding/overdue invoice (when auto-payment fails):
// 1. Log in → Dashboard or Finance/Documents
// 2. Select invoice/document (use dropdown to filter types)
// 3. Click ✓ → Choose Credit Card or Direct Debit → Pay
// → Marks invoice PAID once cleared.
// NBN FTTP Upgrade (from March 2022 onward)
// • Upgrades eligible FTTN / FTTC premises to FTTP (direct fibre to premises)
// • $0 standard installation if signing to eligible high-speed plan (min 100/20 Mbps)
// • Non-standard installs may incur costs (NBN advises & seeks approval first)
// • Contact InfiNET to check eligibility → we handle the request
// Key NBN Technologies – Summary
// • FTTP (Fibre to the Premises): Fibre direct to home. Requires NTD inside + utility box outside. Best speeds/reliability.
// • FTTN (Fibre to the Node): Fibre to street node → copper to home. Uses DSL port on modem.
// • FTTC (Fibre to the Curb): Fibre to pit/DPU → short copper to home. Uses NCD + ethernet to router WAN.
// • FTTB (Fibre to the Building): Fibre to building comms room → copper to unit/apartment. DSL modem.
// • HFC (Hybrid Fibre Coaxial): Uses existing cable TV coax. Coax to NTD → ethernet to router WAN.
// • Fixed Wireless: Radio from tower (up to ~14 km) → outdoor antenna → NTD inside.
// • Satellite (Sky Muster): Satellite dish → indoor modem/NTD.
// Modem/Router Connection – General Rules
// • FTTP / FTTC / HFC / Fixed Wireless / Satellite / OptiComm: Connect router WAN port to NBN NTD/NCD UNI-D port (ethernet cable). NBN-ready router required.
// • FTTN / FTTB: Connect DSL port to phone wall socket (VDSL/ADSL modem required).
// Service Classes – Quick Overview (NBN)
// Higher class = more infrastructure already in place → faster activation
// FTTP / FTTB / FTTC / HFC
// • 0 = Future serviceable, not ready yet (pre-order possible)
// • 1 = Serviceable, no equipment yet → book install
// • 2 = External installed, internal pending → book install
// • 3 = Fully installed → activate 1–5 days
// FTTN similar but uses Class 10–13 (copper-based readiness)
// Fixed Wireless: Class 4–6
// Satellite: Class 7–9
// OptiComm FTTP Classes
// • 0 = Future, not ready
// • 1 = Serviceable, no equipment → contact OptiComm directly first
// • 2 = External done, internal pending → order + pay new connection fee ($330–$550 inc GST first time only)
// • 3 = Fully installed → activate 1–2 days
// • 5 = Fully installed + New Development Fee $300 inc GST (first time)
// TP-Link VX230v Router (InfiNET supplied – pre-configured plug & play)
// If factory reset → must reconfigure:
// LEDs (left to right): Power, DSL, Internet, 2.4G, 5G, WAN, LAN1–3, WPS, USB, Phone
// Access admin portal: http://tplinkmodem.net or http://192.168.1.1
// (Initial password: contact InfiNET if reset)
// Quick Setup after reset:
// • Region & Time Zone
// • ISP = Other
// • Connection: EWAN (FTTP/FTTC/HFC/OptiComm) or VDSL (FTTN/FTTB)
// • Use settings supplied by InfiNET at activation
// • Wireless: leave default or customise later
// • Run connection test
// Change settings later: Internet tab (EWAN/DSL) or Wireless tab (SSID/password).
// Mesh Wi-Fi (HX220/510 extenders):
// • Wireless: Add via Network Map → place near VX230 (flashing blue) → auto-pair
// • Ethernet backhaul: Connect HX WAN → VX230 LAN → auto-detects
// VoIP (if subscribed):
// Telephony → Telephone Number → Add/Modify → enter InfiNET-provided VoIP credentials
// General Advice
// • Check address/technology: Use InfiNET “Check your Address” tool or ask support
// • Unsure about modem compatibility, settings, VoIP, etc. → email support@infinetbroadband.com.au
// --- Consolidated FAQs, Hardware, Security & Plans (Residential & Business) ---
// - Common Residential FAQs (answer concisely):
//   * What NBN speed for streaming? For HD, NBN 25 usually enough; 4K or multiple devices recommend NBN 50+.
//   * Keep landline with NBN? Yes, via VoIP (port existing number on most plans).
//   * BYO modem on NBN/OptiComm? Yes if compatible; support can check; we offer hassle-free options.
//   * NBN installation time? 2–10 business days typical; pre-connected: 30 mins–3 hrs; new may need tech/NTD.
//   * Move house? Transfer plan; we check availability and re-activate.
//   * Unlimited data? Yes on all plans.
//   * OptiComm check? OptiComm site or ask us.
//   * OptiComm vs NBN speed? Similar tiers; OptiComm (FTTP) often more consistent.
// - Hope Island Resort (HIR) FAQs:
//   * HIR Internet: Private high-speed (fibre + HFC) in Hope Island Resort, up to 1000 Mbps, fail-over, no connection fees/contracts.
//   * Tech: FTTP/HFC (varies); ultra-fast available.
//   * BYO modem: Yes, most compatible.
//   * Speeds: Up to 1000 Mbps.
// - NBN Fixed Wireless FAQs:
//   * What it is: Tower radio to antenna + box; free standard install.
//   * Good for remote? Yes, improved reliability.
//   * Speeds: Vary by location/congestion/equipment.
// - NBN Sky Muster FAQs:
//   * What it is: Satellite for remote; dish + modem; free install.
//   * Speeds: Up to 100/5 wholesale (varies; latency typical).
//   * Good option: Yes for no fixed line.
//   * Switch: Address eligibility dependent.
// - Residential VoIP FAQs:
//   * VoIP: Internet calls; cheaper, no rental.
//   * Keep number: Yes, port most free.
//   * Works with: NBN/OptiComm.
// - Residential Hardware:
//   * TP-Link VX230v AX1800: $179 (WiFi 6, VoIP, pre-configured).
//   * VX230v + HX510 Mesh: 1-pack $318, 2-pack $459.
//   * HX510 Mesh AP: 1-pack $159, 2-pack $299.
//   * VX420 4G failover: $319 (not FTTB/FTTN).
// - Residential Security:
//   * Basic: $9.95/m (Anti-Virus, patching, remote).
//   * Bronze: $19.95/m (+ Web Protection, 1 session/m).
//   * Silver: $44.95/m (+ 3 sessions/m).
//   * Gold: $65.95/m (+ Unlimited support, DNS, reporting).
// - Residential Plans (intro discounts new customers; confirm address):
//   NBN (unlimited, no contract, month-to-month):
//   - 25/10 Basic: $59/m ($5 off 3m, then $64) – FTTC/FTTN/FTTB/FTTP/HFC
//   - 50/20 Standard: $74/m ($5 off 3m, then $79)
//   - 100/20 Fast: $84/m ($5 off 3m, then $89)
//   - 500/50 Faster: $84/m ($5 off 3m, then $89) – FTTP/HFC
//   - 750/50 Superfast: $99/m ($10 off 3m, then $109) – FTTP/HFC
//   - 1000/100 Ultrafast: $109/m ($10 off 3m, then $119) – FTTP/HFC
//   OptiComm (FTTP, reliable fibre):
//   - 25/10: $64/m ($5 off 3m, then $69)
//   - 50/20: $74/m ($5 off 3m, then $79)
//   - 100/20: $84/m ($5 off 3m, then $89) – limited capacity
//   - 500/50: $79/m ($10 off 3m, then $89)
//   - 750/50: $89/m ($10 off 3m, then $99)
//   - 1000/100: $99/m ($10 off 3m, then $109)
//   Hope Island Resort:
//   - 25/10: $44/m ($15 off 3m, then $59)
//   - 50/20: $49/m ($15 off 3m, then $64)
//   - 250/50: $64/m ($15 off 3m, then $79)
//   - 500/50: $64/m ($15 off 3m, then $79) – free upgrade if needed
//   - 750/50: $74/m ($15 off 3m, then $89)
//   - 1000/100: $84/m ($15 off 3m, then $99)
//   Fixed Wireless:
//   - 25/10: $59/m
//   - 75/10: $89/m
//   - 200/20: $99/m
//   - 400/40: $109/m (eligible areas)
//   Sky Muster:
//   - 25/5: $59/m
//   - 50/5: $69/m
//   - 100/5: $99/m
// - Business Plans & FAQs:
//   * NBN Business: Static IP, priority support, higher uploads.
//   - 50/20: $89/m
//   - 100/40: $109/m
//   - 250/100: $149/m (FTTP/HFC)
//   - 500/200: $189/m (FTTP/HFC)
//   - 1000/400: $239/m (FTTP/HFC)
//   * OptiComm Business: Static IP; fee waiver possible (24m $0/12m $45/else $99; new dev $330 not waived).
//   - 50/20: $79/m ($10 off 3m, then $89)
//   - 100/40: $99/m ($10 off 3m, then $109)
//   - 250/100: $139/m ($10 off 3m, then $149)
//   - 500/200: $169/m ($10 off 3m, then $179)
//   - 1000/400: $189/m ($10 off 3m, then $199)
//   * HIR Business:
//   - 250/100: $109/m
//   - 500/200: $119/m
//   - 1000/400: $139/m
//   * Business VoIP/Cloud PBX: Extensions, CRM integration, etc.
//   - VoIP 30: $30/m (PAYG)
//   - VoIP 50: $50/m (unlimited local/national/mobile)
//   - Extra extensions: $10/m (1-10), $8/m (>10)
// - General Advice (expanded):
//   * Address/technology check: InfiNET tool or email support@infinetbroadband.com.au.
//   * Head Office: Level 15, Corporate Centre One, 2 Corporate Court, Bundall, QLD 4217.
//   * Phone: 1300 101 414.
// Always advise customers to check current pricing and availability via the address checker or support@infinetbroadband.com.au as promotions may change.
// `;
// // ────────────────────────────────────────────────
// // SYSTEM PROMPT + TOOLS (UPDATED SALES FLOW)
// // ────────────────────────────────────────────────
// const SYSTEM_PROMPT = `
// You are a concise, professional voice/chat assistant for ${BRAND}.
// Handle four call types / chat intents: support, sales, general, account.
// STRICT RULES:
// - ALWAYS reply in English.
// - Keep replies short and focused; ask for remaining missing info concisely.
// - Collect structured fields when appropriate and do not re-ask for already collected fields.
// - If the user has a preferredName in collected fields, ALWAYS address them warmly by that name in every response.
// - Do NOT say anything like "we will connect you to a sales agent", "transferring you to support", "handover to human", "I'll put you through" or similar phrases.
// - When enough information is collected per the flow below, call the create_ticket tool with appropriate parameters (generate subject based on the conversation, use issueSummary or leadInterest in the message body).
// - After create_ticket succeeds, reply with the exact message including the ticket ID: "Thank you [preferredName]! I have raised a ticket #[ticket_id]. Our team will contact you shortly."
// - Use the Knowledge base below to answer questions concisely.
// - For support issues, if issueSummary is not collected, ask: "Please provide a brief description of the issue."
// - Use get_ticket_types, get_ticket_groups, get_ticket_statuses if you need IDs for types, groups, statuses when creating tickets.
// - To verify existing customers or lookup account, use the customer_lookup tool with name, email, or phone. If multiple matches, ask for more details. If no match, politely say you can't find the account and switch to sales flow if appropriate. NEVER create tickets for non-customers.
// - For existing customer flows (support/accounts), ask for name, email, or phone to lookup the account. Use the looked up customer_id for tickets.
// INITIAL FLOW - follow these steps exactly:
// 1. After the initial greeting and collecting preferredName, ask: "Are you a new InfiNET customer or an existing one?"
// 2. If they say new (or similar), ask: "Would you like to learn more about InfiNET Broadband, or how may I assist you with our services today?"
//    - If they want to know more, explain briefly: "InfiNET Broadband is a reliable provider of high-speed internet services in Australia, offering NBN, OptiComm, and other technologies with unlimited data plans." Then proceed to sales flow by asking: "How can I help you with our services today?"
//    - If they choose help or sales, proceed directly to sales flow.
// 3. If they say existing (or similar), ask: "How may we help you today? Would it be sales, support, or accounts?"
// 4. Based on their intent, proceed to the corresponding flow. If they are not an existing customer and choose support or accounts, politely explain: "Support and accounts are for existing customers. If you're interested in our services, let's proceed with sales." and switch to sales flow.
// SALES FLOW - follow these steps exactly (for new or interested users):
// 1. Ask: "Great! Are you interested in residential or business plans?"
// 2. After they reply (residential or business) → Ask: "Would you like NBN or OptiComm plans?"
// 3. After they reply (NBN or OptiComm) → Ask: "To check the best plans for you, what's your full address (street, suburb, state and postcode)?"
// 4. Immediately call the check_address_availability tool with the address.
// 5. After tool result → Show available NBN and OptiComm plans concisely (use live data only). Highlight or note plans matching their NBN/OptiComm preference and residential/business choice.
// 6. Ask: "Which plan interests you? Please reply with the plan title or speed (e.g. 100/20 Fast)."
// 7. After they select a plan → Confirm and collect remaining: email, and confirm address if not already collected.
// 8. Use extract_call_fields to capture leadInterest as the selected plan title/speed.
// 9. When ALL details collected (preferredName, email, leadInterest, address) → Call create_ticket with subject like "Sales Inquiry for [leadInterest]", message body including all collected details, lead_id: 0 if new, reporter_type: 'api', priority: 'medium', type_id: appropriate from get_ticket_types (e.g., for sales).
// SUPPORT FLOW (for existing customers only):
// - First, ask for name, email, or phone, then call customer_lookup to get customer_id and services.
// - If not found, say "Sorry, I couldn't find your account. Are you sure you're an existing customer?" and switch to sales if needed.
// - Answer any question (including generic issues like "my internet is not working", "modem issue", speeds, setup, etc.) using the Knowledge base.
// - If the issue cannot be fully resolved in chat or the user wants further help → Ask for remaining: issueSummary if not already collected. For issueSummary, ask for brief description if missing.
// - When ALL details collected (preferredName, customer_id from lookup, email, issueSummary) → Call create_ticket with customer_id, subject based on issueSummary (e.g., "Support: [brief summary]"), message: full issueSummary and details, reporter_type: 'api', priority from collected or 'medium', type_id for support.
// ACCOUNTS FLOW (billing/financing, for existing customers only):
// - First, ask for name, email, or phone, then call customer_lookup to get customer_id and services.
// - If not found, say "Sorry, I couldn't find your account. Are you sure you're an existing customer?" and switch to sales if needed.
// - Answer any billing or payment questions using the Knowledge base (portal, overdue invoices, update payment method, etc.).
// - For any specific issue → Please provide issueSummary if not already collected.
// - When ALL details collected → Call create_ticket with customer_id, subject: "Accounts Query: [brief summary]", message: issueSummary, reporter_type: 'api', priority: 'medium', type_id for accounts.
// GENERAL: Answer using the Knowledge base. If needed, ask clarifying questions concisely.
// TOOL USAGE (CRITICAL):
// - When the customer asks about plans, pricing, speeds, upgrades or "what plans do you have?": call the get_internet_plans tool.
// - When the customer asks about availability at their address or you reach step 4 in the sales flow: call check_address_availability with the full address.
// - To lookup customer by name, email, or phone: call customer_lookup with at least one of name, email, phone. Returns customer details and services if found.
// - The tool results will be injected into the conversation. ALWAYS use the live tool data for plans and availability (never rely on old hardcoded KB plans).
// - After a tool result, continue the flow concisely using the live data.
// - Call extract_call_fields whenever the user provides any personal info or intent.
// Knowledge base for InfiNET Broadband (use this to answer customer calls and chats concisely):
// ${KB}
// Locations (states) with IDs:
// ${LOCATIONS.map(l => `${l.id}: ${l.name}`).join("\n")}
// `;
// const extractFunction = {
//   name: "extract_call_fields",
//   description: "Extract fields from user message: intent (support/sales/general/account), issueSummary, preferredName (what they want to be called), email, priority, callbackRequest (boolean), timeline, leadInterest, accountNumber, name, phone. Omit fields not present.",
//   parameters: {
//     type: "object",
//     properties: {
//       intent: { type: "string", enum: ["support", "sales", "general", "account"] },
//       issueSummary: { type: "string" },
//       preferredName: { type: "string" },
//       email: { type: "string" },
//       priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
//       callbackRequest: { type: "boolean" },
//       timeline: { type: "string" },
//       leadInterest: { type: "string" },
//       accountNumber: { type: "string" },
//       name: { type: "string" },
//       phone: { type: "string" },
//     },
//     required: [],
//   },
// };
// const getPlansTool = {
//   name: "get_internet_plans",
//   description: "Fetch the latest live internet tariff plans (prices, speeds, availability). ALWAYS call this for any plan/pricing/speed question.",
//   parameters: { type: "object", properties: {}, required: [] }
// };
// const checkAvailabilityTool = {
//   name: "check_address_availability",
//   description: "Check which plans are available at a customer's address. Requires full address.",
//   parameters: {
//     type: "object",
//     properties: {
//       address: { type: "string", description: "Full address including street, suburb, state and postcode if possible" }
//     },
//     required: ["address"]
//   }
// };
// const customerLookupTool = {
//   name: "customer_lookup",
//   description: "Lookup customer by name, email, or phone to verify existing customer and get account details and services. Provide at least one.",
//   parameters: {
//     type: "object",
//     properties: {
//       name: { type: "string" },
//       email: { type: "string" },
//       phone: { type: "string" }
//     },
//     required: []
//   }
// };
// const createTicketTool = {
//   name: "create_ticket",
//   description: "Create a new ticket in Splynx. Use this when ready to raise a ticket based on the flow.",
//   parameters: {
//     type: "object",
//     properties: {
//       customer_id: { type: "number" },
//       incoming_customer_id: { type: "number" },
//       lead_id: { type: "number" },
//       reporter_id: { type: "number" },
//       reporter_type: { type: "string", enum: ["admin", "customer", "api", "incoming", "none"] },
//       hidden: { type: "boolean" },
//       assign_to: { type: "number" },
//       status_id: { type: "number" },
//       group_id: { type: "number" },
//       type_id: { type: "number" },
//       task_id: { type: "number" },
//       subject: { type: "string" },
//       priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
//       star: { type: "boolean" },
//       unread_by_customer: { type: "boolean" },
//       unread_by_admin: { type: "boolean" },
//       closed: { type: "boolean" },
//       source: { type: "string", enum: ["administration", "api", "portal", "widget", "incoming"] },
//       trash: { type: "number" },
//       shareable: { type: "number" },
//       note: { type: "string" },
//       watching: { type: "number" },
//       related_account_id: { type: "number" },
//       related_account_type: { type: "string", enum: ["none", "main", "sub"] },
//       hidden_from_related_account: { type: "number" },
//       unread_by_related_account: { type: "number" },
//       watchers: { type: "array", items: { type: "number" } },
//       moduleLabels: { type: "array", items: { type: "number" } },
//       message: {
//         type: "object",
//         properties: {
//           message: { type: "string" },
//           hide_for_customer: { type: "boolean" },
//           mail_to: { type: "string" },
//           smsTo: { type: "array", items: { type: "string" } },
//           mail_cc: { type: "string" },
//           mail_bcc: { type: "string" },
//         }
//       }
//     },
//     required: ["subject", "priority"]
//   }
// };
// const getTicketTypesTool = {
//   name: "get_ticket_types",
//   description: "Fetch the list of ticket types.",
//   parameters: { type: "object", properties: {}, required: [] }
// };
// const getTicketGroupsTool = {
//   name: "get_ticket_groups",
//   description: "Fetch the list of ticket groups.",
//   parameters: { type: "object", properties: {}, required: [] }
// };
// const getTicketStatusesTool = {
//   name: "get_ticket_statuses",
//   description: "Fetch the list of ticket statuses.",
//   parameters: { type: "object", properties: {}, required: [] }
// };
// const tools = [extractFunction, getPlansTool, checkAvailabilityTool, customerLookupTool, createTicketTool, getTicketTypesTool, getTicketGroupsTool, getTicketStatusesTool];
// // ────────────────────────────────────────────────
// // HELPER FUNCTIONS
// // ────────────────────────────────────────────────
// function mkSession(sessionId) {
//   const id = sessionId || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
//   const session = {
//     id,
//     collected: {},
//     messages: [{ role: "system", content: SYSTEM_PROMPT }],
//     lastSeen: new Date().toISOString(),
//   };
//   sessions.set(id, session);
//   return session;
// }
// function normalizeText(t) {
//   if (!t) return "";
//   return t.toString().replace(/\u200B/g, "").replace(/\s+/g, " ").trim();
// }
// function safeParseJSON(s) {
//   try { return JSON.parse(s); } catch (e) { return null; }
// }
// function numbersToInt(obj) {
//   const out = {};
//   for (const k of Object.keys(obj || {})) {
//     const v = obj[k];
//     if (typeof v === "number") out[k] = Math.round(v);
//     else out[k] = v;
//   }
//   return out;
// }
// async function convertToWav(inputPath) {
//   const out = inputPath + ".converted.wav";
//   return new Promise((resolve, reject) => {
//     ffmpeg(inputPath)
//       .outputOptions(["-ar 16000", "-ac 1", "-vn"])
//       .toFormat("wav")
//       .on("end", () => resolve(out))
//       .on("error", (err) => reject(err))
//       .save(out);
//   });
// }
// async function streamToBuffer(body) {
//   if (!body) return Buffer.from("");
//   if (Buffer.isBuffer(body)) return body;
//   if (body.arrayBuffer) {
//     const ab = await body.arrayBuffer();
//     return Buffer.from(ab);
//   }
//   if (body.pipe) {
//     const chunks = [];
//     return new Promise((resolve, reject) => {
//       body.on("data", (c) => chunks.push(Buffer.from(c)));
//       body.on("end", () => resolve(Buffer.concat(chunks)));
//       body.on("error", (err) => reject(err));
//     });
//   }
//   return Buffer.from(JSON.stringify(body));
// }
// function applyExtractionToSession(session, parsed) {
//   const extractionResult = numbersToInt(parsed || {});
//   for (const [k, v] of Object.entries(extractionResult)) {
//     if (v !== undefined && v !== null) session.collected[k] = v;
//   }
//   session.lastSeen = new Date().toISOString();
//   sessions.set(session.id, session);
//   return extractionResult;
// }
// async function makeTTS(text) {
//   try {
//     const tts = await openai.audio.speech.create({
//       model: "gpt-4o-mini-tts",
//       voice: "cedar",
//       input: text,
//       format: "mp3",
//     });
//     const buf = await streamToBuffer(tts);
//     return buf;
//   } catch (err) {
//     console.warn("TTS failed:", err?.message || err);
//     return null;
//   }
// }
// async function fetchTariffs() {
//   try {
//     const data = await splynx.listInternetTariffs();
//     return Array.isArray(data) ? data : [];
//   } catch (err) {
//     console.error("Failed to fetch internet tariffs from Splynx:", err.message);
//     return [];
//   }
// }
// async function determineLocationId(address) {
//   if (!address) return null;
//   const prompt = `You are an expert at identifying Australian states from addresses.
// Reply with EXACTLY one of these state names (nothing else):
// Queensland
// Victoria
// New South Wales
// Tasmania
// Western Australia
// South Australia
// Northern Territory
// ACT
// If the address does not clearly indicate any state, reply "Unknown".
// Address: ${address}`;
//   try {
//     const resp = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: [{ role: "user", content: prompt }],
//       temperature: 0,
//       max_tokens: 20,
//     });
//     let stateName = resp.choices[0].message.content.trim();
//     if (stateName === "Unknown") return null;
//     const nameMap = { QLD: "Queensland", VIC: "Victoria", NSW: "New South Wales", TAS: "Tasmania", WA: "Western Australia", SA: "South Australia", NT: "Northern Territory", ACT: "ACT" };
//     if (nameMap[stateName]) stateName = nameMap[stateName];
//     const loc = LOCATIONS.find(l => l.name.toLowerCase() === stateName.toLowerCase());
//     return loc ? loc.id : null;
//   } catch (err) {
//     console.error("Location determination failed:", err.message);
//     return null;
//   }
// }
// async function customerLookup({ name, email, phone }) {
//   const main_attributes = {};
//   if (name) main_attributes.name = name;
//   if (email) main_attributes.email = email;
//   if (phone) main_attributes.phone = phone;
//   const searchParams = { main_attributes };
//   const customers = await splynx.searchCustomers(searchParams);
//   if (!customers || customers.length === 0) {
//     return { success: false, message: "No customer found" };
//   }
//   if (customers.length > 1) {
//     return { success: true, multiple: true, customers };
//   }
//   const customer = customers[0];
//   let services = [];
//   try {
//     services = await splynx.getCustomerTariffs(customer.id);
//   } catch (err) {
//     console.error('Failed to get tariffs for customer', customer.id, err);
//   }
//   return { success: true, customer, services };
// }
// function objectToFormData(obj, form = new FormData(), namespace = '') {
//   for (const property in obj) {
//     if (obj.hasOwnProperty(property)) {
//       const formKey = namespace ? `${namespace}[${property}]` : property;
//       if (typeof obj[property] === 'object' && !(obj[property] instanceof File) && !Array.isArray(obj[property])) {
//         objectToFormData(obj[property], form, formKey);
//       } else if (Array.isArray(obj[property])) {
//         obj[property].forEach((item) => {
//           const arrayKey = `${formKey}[]`;
//           if (typeof item === 'object' && !(item instanceof File)) {
//             objectToFormData(item, form, arrayKey);
//           } else {
//             form.append(arrayKey, item);
//           }
//         });
//       } else {
//         form.append(formKey, obj[property]);
//       }
//     }
//   }
//   return form;
// }
// // ────────────────────────────────────────────────
// // AGENT ENDPOINTS
// // ────────────────────────────────────────────────
// app.post("/api/chat/init", async (req, res) => {
//   try {
//     const session = mkSession();
//     const greeting = `Hi there! Welcome to InfiNET Broadband. Could you please share your name to get started?`;
//     session.messages.push({ role: "assistant", content: greeting });
//     sessions.set(session.id, session);
//     // const ttsBuf = await makeTTS(greeting);
//     // const audioBase64 = ttsBuf ? ttsBuf.toString("base64") : null;
//     return res.json({ sessionId: session.id, text: greeting });
//   } catch (err) {
//     console.error("chat init err", err);
//     return res.status(500).json({ error: err?.message || "server error" });
//   }
// });
// app.post("/api/voice", upload.single("audio"), async (req, res) => {
//   const incomingSessionId = (req.body && req.body.sessionId) || req.query.sessionId || req.headers["x-session-id"] || null;
//   if (!req.file) return res.status(400).json({ error: "Missing audio file (multipart field 'audio')" });
//   const uploadedPath = path.resolve(req.file.path);
//   let convertedPath = null;
//   try {
//     const session = incomingSessionId && sessions.has(incomingSessionId) ? sessions.get(incomingSessionId) : mkSession(incomingSessionId);
//     const origName = (req.file.originalname || "").toLowerCase();
//     const mimetype = (req.file.mimetype || "").toLowerCase();
//     const looksLikeWav = origName.endsWith(".wav") || mimetype === "audio/wav" || mimetype === "audio/wave" || mimetype === "audio/x-wav";
//     if (looksLikeWav) {
//       convertedPath = uploadedPath;
//     } else {
//       convertedPath = await convertToWav(uploadedPath);
//     }
//     const transcriptionResp = await openai.audio.transcriptions.create({
//       file: fs.createReadStream(convertedPath),
//       model: "gpt-4o-mini-transcribe",
//     });
//     const userTextRaw = normalizeText(transcriptionResp?.text || "");
//     if (!userTextRaw) {
//       const prompt = "Sorry, I didn't catch that — could you please repeat briefly?";
//       const ttsBuf = await makeTTS(prompt);
//       session.lastSeen = new Date().toISOString();
//       sessions.set(session.id, session);
//       return res.json({ sessionId: session.id, text: prompt, audioBase64: ttsBuf ? ttsBuf.toString("base64") : null });
//     }
//     session.messages.push({ role: "user", content: userTextRaw });
//     let assistantText = null;
//     const firstCompletion = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: session.messages,
//       functions: tools,
//       function_call: "auto",
//       temperature: 0.0,
//       max_tokens: 300,
//     });
//     const firstMsg = firstCompletion.choices?.[0]?.message;
//     if (firstMsg?.function_call) {
//       const funcName = firstMsg.function_call.name;
//       const args = safeParseJSON(firstMsg.function_call.arguments) || {};
//       session.messages.push(firstMsg);
//       let toolContent;
//       if (funcName === "extract_call_fields") {
//         applyExtractionToSession(session, args);
//         toolContent = JSON.stringify({ success: true });
//       } else if (funcName === "get_internet_plans") {
//         const tariffs = await fetchTariffs();
//         toolContent = JSON.stringify({
//           success: true,
//           plans: tariffs.map(t => ({
//             id: t.id,
//             title: t.title,
//             price: parseFloat(t.price),
//             download: `${(t.speed_download / 1000)} Mbps`,
//             upload: `${(t.speed_upload / 1000)} Mbps`,
//             available_for_locations: t.available_for_locations || []
//           }))
//         });
//       } else if (funcName === "check_address_availability") {
//         const { address } = args;
//         if (!address) {
//           toolContent = JSON.stringify({ error: "Address is required" });
//         } else {
//           const locId = await determineLocationId(address);
//           const tariffs = await fetchTariffs();
//           const availablePlans = locId
//             ? tariffs.filter(t => t.available_for_locations && t.available_for_locations.includes(locId))
//             : [];
//           toolContent = JSON.stringify({
//             success: true,
//             address,
//             locationId: locId,
//             locationName: LOCATIONS.find(l => l.id === locId)?.name || "Unknown",
//             availablePlans: availablePlans.map(p => ({
//               title: p.title,
//               price: parseFloat(p.price),
//               download: `${(p.speed_download / 1000)} Mbps`,
//               upload: `${(p.speed_upload / 1000)} Mbps`
//             }))
//           });
//         }
//       } else if (funcName === "customer_lookup") {
//         try {
//           const lookupResult = await customerLookup(args);
//           toolContent = JSON.stringify(lookupResult);
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       } else if (funcName === "create_ticket") {
//         try {
//           let fixedArgs = {...args};
//           if (typeof fixedArgs.message === 'string') {
//             fixedArgs.message = { message: fixedArgs.message };
//           }
//           const formData = objectToFormData(fixedArgs);
//           console.log('Creating ticket with args:', JSON.stringify(fixedArgs));
//           const response = await splynx.request('POST', 'admin/support/tickets', formData);
//           toolContent = JSON.stringify({ success: true, ticket_id: response.id });
//         } catch (err) {
//           console.error('Create ticket failed with args:', JSON.stringify(args), 'error:', err);
//           toolContent = JSON.stringify({ success: false, error: err.message || 'Failed to create ticket' });
//         }
//       } else if (funcName === "get_ticket_types") {
//         try {
//           const types = await splynx.request('GET', 'admin/support/tickets-types');
//           toolContent = JSON.stringify({ success: true, types });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       } else if (funcName === "get_ticket_groups") {
//         try {
//           const groups = await splynx.request('GET', 'admin/support/tickets-groups');
//           toolContent = JSON.stringify({ success: true, groups });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       } else if (funcName === "get_ticket_statuses") {
//         try {
//           const statuses = await splynx.request('GET', 'admin/support/tickets-statuses');
//           toolContent = JSON.stringify({ success: true, statuses });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       }
//       session.messages.push({ role: "function", name: funcName, content: toolContent });
//       const collectedSummary = `CollectedFields: ${JSON.stringify(session.collected || {})}.`;
//       const followupSystem = `You are a concise assistant for ISP CRM. Use collected fields and ask for remaining missing info concisely. Use the tool results above for accurate plans and availability.`;
//       const finalMessages = [
//         { role: "system", content: followupSystem },
//         ...session.messages,
//         { role: "system", content: collectedSummary },
//       ];
//       const finalResp = await openai.chat.completions.create({
//         model: "gpt-4o-mini",
//         messages: finalMessages,
//         temperature: 0.0,
//         max_tokens: 350,
//       });
//       assistantText = finalResp.choices?.[0]?.message?.content?.trim() || "Thanks — I have your details.";
//       session.messages.push({ role: "assistant", content: assistantText });
//     } else if (firstMsg?.content) {
//       assistantText = firstMsg.content;
//       session.messages.push({ role: "assistant", content: assistantText });
//     }
//     const ttsBuf = await makeTTS(assistantText);
//     session.lastSeen = new Date().toISOString();
//     sessions.set(session.id, session);
//     return res.json({ sessionId: session.id, text: assistantText, audioBase64: ttsBuf ? ttsBuf.toString("base64") : null });
//   } catch (err) {
//     console.error("voice error:", err);
//     return res.status(500).json({ error: err?.message || "server error" });
//   } finally {
//     try { if (uploadedPath && fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath); } catch (_) {}
//     try { if (convertedPath && convertedPath !== uploadedPath && fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath); } catch (_) {}
//   }
// });
// app.post("/api/chat/message", async (req, res) => {
//   try {
//     const { sessionId, message } = req.body;
//     if (!message) return res.status(400).json({ error: "Missing message" });
//     const session = sessionId && sessions.has(sessionId) ? sessions.get(sessionId) : mkSession(sessionId);
//     session.messages.push({ role: "user", content: message });
//     let assistantText = null;
//     const firstCompletion = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: session.messages,
//       functions: tools,
//       function_call: "auto",
//       temperature: 0.0,
//       max_tokens: 300,
//     });
//     const firstMsg = firstCompletion.choices?.[0]?.message;
//     if (firstMsg?.function_call) {
//       const funcName = firstMsg.function_call.name;
//       const args = safeParseJSON(firstMsg.function_call.arguments) || {};
//       session.messages.push(firstMsg);
//       let toolContent;
//       if (funcName === "extract_call_fields") {
//         applyExtractionToSession(session, args);
//         toolContent = JSON.stringify({ success: true });
//       } else if (funcName === "get_internet_plans") {
//         const tariffs = await fetchTariffs();
//         toolContent = JSON.stringify({
//           success: true,
//           plans: tariffs.map(t => ({
//             id: t.id,
//             title: t.title,
//             price: parseFloat(t.price),
//             download: `${(t.speed_download / 1000)} Mbps`,
//             upload: `${(t.speed_upload / 1000)} Mbps`,
//             available_for_locations: t.available_for_locations || []
//           }))
//         });
//       } else if (funcName === "check_address_availability") {
//         const { address } = args;
//         if (!address) {
//           toolContent = JSON.stringify({ error: "Address is required" });
//         } else {
//           const locId = await determineLocationId(address);
//           const tariffs = await fetchTariffs();
//           const availablePlans = locId
//             ? tariffs.filter(t => t.available_for_locations && t.available_for_locations.includes(locId))
//             : [];
//           toolContent = JSON.stringify({
//             success: true,
//             address,
//             locationId: locId,
//             locationName: LOCATIONS.find(l => l.id === locId)?.name || "Unknown",
//             availablePlans: availablePlans.map(p => ({
//               title: p.title,
//               price: parseFloat(p.price),
//               download: `${(p.speed_download / 1000)} Mbps`,
//               upload: `${(p.speed_upload / 1000)} Mbps`
//             }))
//           });
//         }
//       } else if (funcName === "customer_lookup") {
//         try {
//           const lookupResult = await customerLookup(args);
//           toolContent = JSON.stringify(lookupResult);
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       } else if (funcName === "create_ticket") {
//         try {
//           let fixedArgs = {...args};
//           if (typeof fixedArgs.message === 'string') {
//             fixedArgs.message = { message: fixedArgs.message };
//           }
//           const formData = objectToFormData(fixedArgs);
//           console.log('Creating ticket with args:', JSON.stringify(fixedArgs));
//           const response = await splynx.request('POST', 'admin/support/tickets', formData);
//           toolContent = JSON.stringify({ success: true, ticket_id: response.id });
//         } catch (err) {
//           console.error('Create ticket failed with args:', JSON.stringify(args), 'error:', err);
//           toolContent = JSON.stringify({ success: false, error: err.message || 'Failed to create ticket' });
//         }
//       } else if (funcName === "get_ticket_types") {
//         try {
//           const types = await splynx.request('GET', 'admin/support/tickets-types');
//           toolContent = JSON.stringify({ success: true, types });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       } else if (funcName === "get_ticket_groups") {
//         try {
//           const groups = await splynx.request('GET', 'admin/support/tickets-groups');
//           toolContent = JSON.stringify({ success: true, groups });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       } else if (funcName === "get_ticket_statuses") {
//         try {
//           const statuses = await splynx.request('GET', 'admin/support/tickets-statuses');
//           toolContent = JSON.stringify({ success: true, statuses });
//         } catch (err) {
//           toolContent = JSON.stringify({ success: false, error: err.message });
//         }
//       }
//       session.messages.push({ role: "function", name: funcName, content: toolContent });
//       const collectedSummary = `CollectedFields: ${JSON.stringify(session.collected || {})}.`;
//       const followupSystem = `You are a concise assistant for ISP CRM. Use collected fields and ask for remaining missing info concisely. Use the tool results above for accurate plans and availability.`;
//       const finalMessages = [
//         { role: "system", content: followupSystem },
//         ...session.messages,
//         { role: "system", content: collectedSummary },
//       ];
//       const finalResp = await openai.chat.completions.create({
//         model: "gpt-4o-mini",
//         messages: finalMessages,
//         temperature: 0.0,
//         max_tokens: 350,
//       });
//       assistantText = finalResp.choices?.[0]?.message?.content?.trim() || "Thanks — I have your details.";
//       session.messages.push({ role: "assistant", content: assistantText });
//     } else if (firstMsg?.content) {
//       assistantText = firstMsg.content;
//       session.messages.push({ role: "assistant", content: assistantText });
//     }
//     session.lastSeen = new Date().toISOString();
//     sessions.set(session.id, session);
//     return res.json({ sessionId: session.id, text: assistantText, collected: session.collected });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: err?.message || "server error" });
//   }
// });
// // ────────────────────────────────────────────────
// // SPLYNX PROXY ROUTES
// // ────────────────────────────────────────────────
// app.get('/health', (req, res) => {
//   res.json({
//     status: 'ok',
//     splynx: {
//       hasToken: !!splynx.accessToken,
//       tokenExpires: splynx.accessTokenExpiration ? new Date(splynx.accessTokenExpiration * 1000).toISOString() : null,
//     },
//   });
// });
// app.get('/api/customers', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customer', null, { limit: 10, offset: 0 })); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customers', details: err }); }
// });
// app.post('/api/customers', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/customers/customer', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create customer' }); }
// });
// app.get('/api/customer/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Customer not found' }); }
// });
// app.put('/api/customer/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/customers/customer/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update customer' }); }
// });
// app.delete('/api/customer/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/customers/customer/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete customer' });
//   }
// });
// app.get('/api/customer/:customer_id/logs-changes', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer/${req.params.customer_id}/logs-changes`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer logs changes' }); }
// });
// app.get('/api/customer/:customer_id/logs-changes--first-activation', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer/${req.params.customer_id}/logs-changes--first-activation`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer first activation' }); }
// });
// app.get('/api/customer/:customer_id/logs-changes--last-activation', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer/${req.params.customer_id}/logs-changes--last-activation`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer last activation' }); }
// });
// app.get('/api/customer-cap/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer-cap/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer cap' }); }
// });
// app.put('/api/customer-cap/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/customers/customer-cap/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update customer cap' }); }
// });
// app.get('/api/customer-bonus-traffic-counter', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customer-bonus-traffic-counter', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch bonus traffic counters' }); }
// });
// app.post('/api/customer-bonus-traffic-counter', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/customers/customer-bonus-traffic-counter', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create bonus traffic counter' }); }
// });
// app.get('/api/customer-bonus-traffic-counter/:service_id--:date', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer-bonus-traffic-counter/${req.params.service_id}--${req.params.date}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch bonus traffic counter' }); }
// });
// app.put('/api/customer-bonus-traffic-counter/:service_id--:date', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/customers/customer-bonus-traffic-counter/${req.params.service_id}--${req.params.date}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update bonus traffic counter' }); }
// });
// app.delete('/api/customer-bonus-traffic-counter/:service_id--:date', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/customers/customer-bonus-traffic-counter/${req.params.service_id}--${req.params.date}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete bonus traffic counter' });
//   }
// });
// app.get('/api/customer-billing-info/:customer_id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/billing-info/${req.params.customer_id}`, null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer billing info' }); }
// });
// app.get('/api/customer-payment-accounts', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customer-payment-accounts', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer payment accounts' }); }
// });
// app.get('/api/customer-payment-account-data', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customer-payment-account-data', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer payment account data' }); }
// });
// app.get('/api/customer-payment-accounts-by-id', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customer-payment-accounts', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer payment accounts by id' }); }
// });
// app.put('/api/customer-payment-accounts-by-id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', 'admin/customers/customer-payment-accounts', req.body, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update customer payment account' }); }
// });
// app.delete('/api/customer-payment-accounts-by-id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', 'admin/customers/customer-payment-accounts', null, req.query);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete customer payment account' });
//   }
// });
// app.get('/api/customer-statistics', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customer-statistics', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer statistics' }); }
// });
// app.get('/api/customer-statistics/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer-statistics/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer statistic' }); }
// });
// app.get('/api/customer-traffic-counter', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customer-traffic-counter', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer traffic counters' }); }
// });
// app.post('/api/customer-traffic-counter', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/customers/customer-traffic-counter', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create customer traffic counter' }); }
// });
// app.get('/api/customer-traffic-counter/:service_id--:date', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer-traffic-counter/${req.params.service_id}--${req.params.date}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer traffic counter' }); }
// });
// app.put('/api/customer-traffic-counter/:service_id--:date', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/customers/customer-traffic-counter/${req.params.service_id}--${req.params.date}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update customer traffic counter' }); }
// });
// app.delete('/api/customer-traffic-counter/:service_id--:date', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/customers/customer-traffic-counter/${req.params.service_id}--${req.params.date}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete customer traffic counter' });
//   }
// });
// app.get('/api/customer-billing/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer-billing/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer billing' }); }
// });
// app.put('/api/customer-billing/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/customers/customer-billing/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update customer billing' }); }
// });
// app.get('/api/customers-search', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customer', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to search customers' }); }
// });
// app.get('/api/online', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customers-online')); }
//   catch (err) { res.status(500).json({ error: 'Failed to get online customers' }); }
// });
// app.post('/api/online', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/customers/customers-online', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to set customer online' }); }
// });
// app.get('/api/online/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customers-online/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch online customer' }); }
// });
// app.put('/api/online/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/customers/customers-online/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update online customer' }); }
// });
// app.delete('/api/online/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/customers/customers-online/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to remove online customer' });
//   }
// });
// app.put('/api/online/:id/kill', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/customers/customers-online/${req.params.id}--kill`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to disconnect online customer' }); }
// });
// app.get('/api/customer-documents/:customer_id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer-documents/${req.params.customer_id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer documents' }); }
// });
// app.post('/api/customer-documents', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/customers/customer-documents', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create customer document' }); }
// });
// app.post('/api/customer-documents/:id/upload', upload.single('file'), async (req, res) => {
//   try {
//     const formData = new FormData();
//     formData.append('file', fs.createReadStream(req.file.path));
//     const response = await splynx.request('POST', `admin/customers/customer-documents/${req.params.id}--upload`, formData);
//     res.status(202).json(response);
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to upload customer document' });
//   } finally {
//     if (req.file && req.file.path) fs.unlinkSync(req.file.path);
//   }
// });
// app.put('/api/customer-documents/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/customers/customer-documents/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update customer document' }); }
// });
// app.delete('/api/customer-documents/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/customers/customer-documents/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete customer document' });
//   }
// });
// app.get('/api/download/customer_documents/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/config/download/customer_documents--${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to download customer document' }); }
// });
// app.post('/api/send-documents', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/customers/send-documents', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to send documents' }); }
// });
// app.get('/api/cap-history/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/cap-history/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch cap history' }); }
// });
// app.post('/api/customer-notes', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/customers/customer-notes', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create customer comment' }); }
// });
// app.get('/api/customer-notes', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/customer-notes', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer comments' }); }
// });
// app.get('/api/customer-notes/:customer_id--:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/customer-notes/${req.params.customer_id}--${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch customer comment' }); }
// });
// app.get('/api/prepaid-cards-series', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/prepaid-cards-series', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch prepaid cards series' }); }
// });
// app.post('/api/prepaid-cards-series', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/customers/prepaid-cards-series', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create prepaid cards series' }); }
// });
// app.get('/api/prepaid-cards-series/:serie_id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/prepaid-cards-series/${req.params.serie_id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch prepaid cards series' }); }
// });
// app.put('/api/prepaid-cards-series/:serie_id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/customers/prepaid-cards-series/${req.params.serie_id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update prepaid cards series' }); }
// });
// app.delete('/api/prepaid-cards-series/:serie_id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/customers/prepaid-cards-series/${req.params.serie_id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete prepaid cards series' });
//   }
// });
// app.get('/api/prepaid-cards', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/prepaid-cards', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch prepaid cards' }); }
// });
// app.get('/api/prepaid-cards/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/prepaid-cards/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch prepaid card' }); }
// });
// app.put('/api/prepaid-cards/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/customers/prepaid-cards/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update prepaid card' }); }
// });
// app.delete('/api/prepaid-cards/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/customers/prepaid-cards/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete prepaid card' });
//   }
// });
// app.get('/api/prepaid-cards-statistics', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/customers/prepaid-cards-statistics', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch prepaid cards statistics' }); }
// });
// app.get('/api/prepaid-cards-statistics/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/customers/prepaid-cards-statistics/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to fetch prepaid card statistic' }); }
// });
// app.post('/api/reset-password-request', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'portal/profile/reset-password-request', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to request password reset' }); }
// });
// app.post('/api/reset-password-confirm', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'portal/profile/reset-password-confirm', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to confirm password reset' }); }
// });
// app.get('/api/traffic/:serviceId', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/fup/usage/${req.params.serviceId}?with_texts=true`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get traffic usage' }); }
// });
// app.get('/api/tariffs/internet', async (req, res) => {
//   try { res.json(await splynx.listInternetTariffs(req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list internet tariffs' }); }
// });
// app.get('/api/tariffs/internet/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/tariffs/internet/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get tariff' }); }
// });
// app.post('/api/tariffs/internet', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/tariffs/internet', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create tariff' }); }
// });
// app.put('/api/tariffs/internet/:id', async (req, res) => {
//   try { res.json(await splynx.request('PUT', `admin/tariffs/internet/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update tariff' }); }
// });
// app.delete('/api/tariffs/internet/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/tariffs/internet/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete tariff' });
//   }
// });
// app.get('/api/locations', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/administration/locations', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list locations' }); }
// });
// app.get('/api/locations/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/administration/locations/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Location not found' }); }
// });
// app.post('/api/locations', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/administration/locations', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create location' }); }
// });
// app.put('/api/locations/:id', async (req, res) => {
//   try { res.json(await splynx.request('PUT', `admin/administration/locations/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update location' }); }
// });
// app.delete('/api/locations/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/administration/locations/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete location' });
//   }
// });
// app.get('/api/administrators', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/administration/administrators', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list administrators' }); }
// });
// app.get('/api/administrators/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/administration/administrators/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Admin not found' }); }
// });
// app.get('/api/partners', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/administration/partners', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list partners' }); }
// });
// app.get('/api/partners/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/administration/partners/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Partner not found' }); }
// });
// // Tickets APIs integration
// app.post('/api/admin/support/tickets', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/support/tickets', req.body)); } // Note: Files not supported in this JSON proxy; use multipart if needed
//   catch (err) { res.status(500).json({ error: 'Failed to create ticket' }); }
// });
// app.get('/api/admin/support/tickets', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/tickets', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list tickets' }); }
// });
// app.get('/api/admin/support/tickets/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/tickets/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket' }); }
// });
// app.put('/api/admin/support/tickets/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/support/tickets/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update ticket' }); }
// });
// app.delete('/api/admin/support/tickets/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/support/tickets/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete ticket' });
//   }
// });
// app.post('/api/admin/support/ticket-messages', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/support/ticket-messages', req.body)); } // Note: Files not supported
//   catch (err) { res.status(500).json({ error: 'Failed to create ticket message' }); }
// });
// app.get('/api/admin/support/ticket-messages', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/ticket-messages', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket messages' }); }
// });
// app.get('/api/admin/support/ticket-messages/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/ticket-messages/${req.params.id}`, null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket message' }); }
// });
// app.put('/api/admin/support/ticket-messages/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/support/ticket-messages/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update ticket message' }); }
// });
// app.delete('/api/admin/support/ticket-messages/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/support/ticket-messages/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete ticket message' });
//   }
// });
// app.get('/api/admin/support/tickets-statuses', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/tickets-statuses', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket statuses' }); }
// });
// app.get('/api/admin/support/tickets-statuses/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/tickets-statuses/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket status' }); }
// });
// app.get('/api/admin/support/tickets-groups', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/tickets-groups', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket groups' }); }
// });
// app.get('/api/admin/support/tickets-groups/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/tickets-groups/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket group' }); }
// });
// app.get('/api/admin/support/tickets-types', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/tickets-types', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket types' }); }
// });
// app.get('/api/admin/support/tickets-types/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/tickets-types/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket type' }); }
// });
// app.get('/api/admin/support/ticket-attachments', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/ticket-attachments', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket attachments' }); }
// });
// app.get('/api/admin/support/ticket-attachments/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/ticket-attachments/${req.params.id}`, null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket attachment' }); }
// });
// app.post('/api/admin/support/ticket-attachments', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/support/ticket-attachments', req.body)); } // Note: Files not supported
//   catch (err) { res.status(500).json({ error: 'Failed to create ticket attachment' }); }
// });
// app.delete('/api/admin/support/ticket-attachments/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/support/ticket-attachments/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete ticket attachment' });
//   }
// });
// app.get('/api/admin/support/ticket-feedbacks', async (req, res) => {
//   try { res.json(await splynx.request('GET', 'admin/support/ticket-feedbacks', null, req.query)); }
//   catch (err) { res.status(500).json({ error: 'Failed to list ticket feedbacks' }); }
// });
// app.post('/api/admin/support/ticket-feedbacks', async (req, res) => {
//   try { res.status(201).json(await splynx.request('POST', 'admin/support/ticket-feedbacks', req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to create ticket feedbacks' }); }
// });
// app.get('/api/admin/support/ticket-feedbacks/:id', async (req, res) => {
//   try { res.json(await splynx.request('GET', `admin/support/ticket-feedbacks/${req.params.id}`)); }
//   catch (err) { res.status(500).json({ error: 'Failed to get ticket feedback' }); }
// });
// app.put('/api/admin/support/ticket-feedbacks/:id', async (req, res) => {
//   try { res.status(202).json(await splynx.request('PUT', `admin/support/ticket-feedbacks/${req.params.id}`, req.body)); }
//   catch (err) { res.status(500).json({ error: 'Failed to update ticket feedback' }); }
// });
// app.delete('/api/admin/support/ticket-feedbacks/:id', async (req, res) => {
//   try {
//     await splynx.request('DELETE', `admin/support/ticket-feedbacks/${req.params.id}`);
//     res.status(204).send();
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to delete ticket feedback' });
//   }
// });
// app.all(/^\/api\/.*/, async (req, res) => {
//   try {
//     let endpoint = req.path.replace(/^\/api\//, '');
//     if (!endpoint) return res.status(400).json({ error: 'Missing endpoint after /api/' });
//     const data = await splynx.request(
//       req.method,
//       endpoint,
//       req.method !== 'GET' && req.method !== 'HEAD' ? req.body : null,
//       req.query
//     );
//     if (req.method === 'DELETE') {
//       res.status(204).send();
//     } else {
//       res.json(data);
//     }
//   } catch (err) {
//     const status = err?.response?.status || 500;
//     res.status(status).json({
//       error: 'Splynx proxy error',
//       message: err.message || 'Request failed',
//       details: err
//     });
//   }
// });
// // ────────────────────────────────────────────────
// // START SERVER
// // ────────────────────────────────────────────────
// app.listen(PORT, () => {
//   console.log(`✅ InfiNET Agent + Full Splynx Integration running on http://localhost:${PORT}`);
//   console.log(` • First message: "Hello, thank you for contacting InfiNET Broadband. I am your AI assistant. Nice to meet you."`);
//   console.log(` • SALES FLOW now includes NBN / OptiComm question after residential/business`);
//   console.log(` • Full working code - no syntax errors`);
// });


// async function customerLookup({ name, email, phone }) {
//   const main_attributes = {};
//   if (name) main_attributes.name = name;
//   if (email) main_attributes.email = email;
//   if (email) main_attributes.login = email;
//   if (phone) main_attributes.phone = phone;

//   const searchParams = { main_attributes };
//   console.log("Customer lookup with params:", searchParams);
//   const customers = await splynx.searchCustomers(searchParams);
//   if (!customers || customers.length === 0) {
//     return { success: false, message: "No customer found" };
//   }
//   if (customers.length > 1) {
//     return { success: true, multiple: true, customers };
//   }
//   const customer = customers[0];
//   let services = [];
//   try {
//     services = await splynx.getCustomerTariffs(customer.id);
//   } catch (err) {
//     console.error("Failed to get tariffs for customer", customer.id, err);
//   }
//   return { success: true, customer, services };
// }

// async function customerLookup({ name, email, phone }) {
//   const searchParams = { main_attributes: {} };
  
//   // Always include name if provided (it's safe and doesn't conflict)
//   if (name) {
//     searchParams.main_attributes.name = name;
//   }

//   let customers = [];
//   let usedField = null;

//   // ────────────────────────────────────────────────
//   // EMAIL SEQUENCE: main.email → login
//   // ────────────────────────────────────────────────
//   if (email) {
//     // Step 1: Try main_attributes.email first
//     searchParams.main_attributes.email = email;
//     usedField = "main.email";

//     console.log(`[Lookup 1] Trying main.email = ${email}`);
//     console.log("Params:", JSON.stringify(searchParams, null, 2));

//     try {
//       customers = await splynx.searchCustomers(searchParams);
//     } catch (err) {
//       console.error("Main email lookup failed:", err.message);
//     }

//     // Clean up so next step doesn't carry over
//     delete searchParams.main_attributes.email;

//     // Step 2: If nothing found → try login
//     if (!customers || customers.length === 0) {
//       searchParams.main_attributes.login = email;
//       usedField = "main.login";

//       console.log(`[Lookup 2] No match on main.email → trying main.login = ${email}`);
//       console.log("Params:", JSON.stringify(searchParams, null, 2));

//       try {
//         customers = await splynx.searchCustomers(searchParams);
//       } catch (err) {
//         console.error("Login lookup failed:", err.message);
//       }

//       delete searchParams.main_attributes.login;
//     }
//   }

//   // ────────────────────────────────────────────────
//   // PHONE SEQUENCE: main.phone → additional.phone_number
//   // ────────────────────────────────────────────────
//   if (phone && (!customers || customers.length === 0)) {
//     // Step 1: Try main_attributes.phone
//     searchParams.main_attributes.phone = phone;
//     usedField = "main.phone";

//     console.log(`[Lookup 3] Trying main.phone = ${phone}`);
//     console.log("Params:", JSON.stringify(searchParams, null, 2));

//     try {
//       customers = await splynx.searchCustomers(searchParams);
//     } catch (err) {
//       console.error("Main phone lookup failed:", err.message);
//     }

//     delete searchParams.main_attributes.phone;

//     // Step 2: If still nothing → try additional_attributes.phone_number
//     if (!customers || customers.length === 0) {
//       searchParams.additional_attributes = { phone_number: phone };
//       usedField = "additional.phone_number";

//       console.log(`[Lookup 4] No match on main.phone → trying additional.phone_number = ${phone}`);
//       console.log("Params:", JSON.stringify(searchParams, null, 2));

//       try {
//         customers = await splynx.searchCustomers(searchParams);
//       } catch (err) {
//         console.error("Additional phone_number lookup failed:", err.message);
//       }
//     }
//   }

//   // ────────────────────────────────────────────────
//   // Final result handling
//   // ────────────────────────────────────────────────
//   if (!customers || customers.length === 0) {
//     console.log(`No customer found for email: ${email || "none"}, phone: ${phone || "none"}`);
//     return { success: false, message: "No customer found" };
//   }

//   if (customers.length > 1) {
//     console.log(`Multiple customers found (${customers.length}) using ${usedField || "name"}`);
//     return { success: true, multiple: true, customers };
//   }

//   const customer = customers[0];
//   console.log(`Found customer #${customer.id} using ${usedField || "name"}`);

//   let services = [];
//   try {
//     services = await splynx.getCustomerTariffs(customer.id);
//   } catch (err) {
//     console.error("Failed to get tariffs for customer", customer.id, err);
//   }

//   return { success: true, customer, services };
// }


//latest
// const SYSTEM_PROMPT = `
// You are a concise, professional voice/chat assistant for ${BRAND}.
// Handle four call types / chat intents: support, sales, general, account.
// STRICT RULES:
// - ALWAYS reply in English.
// - Keep replies short and focused; ask for remaining missing info concisely.
// - Collect structured fields when appropriate and do not re-ask for already collected fields.
// - If the user has a preferredName in collected fields, ALWAYS address them warmly by that name in every response.
// - Do NOT say anything like "we will connect you to a sales agent", "transferring you to support", "handover to human", "I'll put you through" or similar phrases.
// - When enough information is collected per the flow below, call the create_ticket tool with appropriate parameters (generate subject based on the conversation, use issueSummary or leadInterest in the message body).
// - After create_ticket succeeds, reply with the exact message including the ticket ID: "Thank you [preferredName]! I have raised a ticket for you. You will receive the ticket details via email shortly. Our team will contact you shortly."
// - Use the Knowledge base below to answer questions concisely.
// - For support issues, if issueSummary is not collected, ask: "Please provide a brief description of the issue." Once a basic description is provided, immediately ask for additional high-level details to help our support team (e.g. "Any more details like when it started, symptoms, or error messages?"). Combine everything into the final issueSummary.
// - Use get_ticket_types, get_ticket_groups, get_ticket_statuses if you need IDs for types, groups, statuses when creating tickets.
// - To verify existing customers or lookup account, use the customer_lookup tool with name, email, or phone. If multiple matches, ask for more details. If no match, politely say you can't find the account and switch to sales flow if appropriate. NEVER create tickets for non-customers.
// - For existing customer flows (support/accounts), ask for name, email, or phone to lookup the account. Use the looked up customer_id for tickets.
// INITIAL FLOW - follow these steps exactly:
// 1. After the initial greeting and collecting preferredName, ask: "Are you a new InfiNET customer or an existing one?"
// 2. If they say new (or similar), ask: "Would you like to learn more about InfiNET Broadband, or how may I assist you with our services today?"
//    - If they want to know more, explain briefly: "InfiNET Broadband is a reliable provider of high-speed internet services in Australia, offering NBN, OptiComm, and other technologies with unlimited data plans." Then proceed to sales flow by asking: "How can I help you with our services today?"
//    - If they choose help or sales, proceed directly to sales flow.
// 3. If they say existing (or similar), ask: "How may we help you today? Would it be sales, support, or accounts?"
// 4. Based on their intent, proceed to the corresponding flow. If they are not an existing customer and choose support or accounts, politely explain: "Support and accounts are for existing customers. If you're interested in our services, let's proceed with sales." and switch to sales flow.
// SALES FLOW - follow these steps exactly (for new or interested users):
// NOTE: If the user is existing and mentions moving, relocation, or shifting, when asking for the address in step 3, say "provide the new property address" instead of "full address".
// 1. Ask: "Great! Are you interested in residential or business plans?"
// 2. After they reply (residential or business) → Ask: "Would you like NBN or OptiComm plans?"
// 3. After they reply (NBN or OptiComm) → Ask: "To check the best plans for you, what's your full address (street, suburb, state and postcode)?"
// 4. Immediately call the check_address_availability tool with the address.
// 5. After tool result → Show available NBN and OptiComm plans concisely (use live data only), numbered as 1., 2., etc. (e.g. "1. [Plan Title] – [speed]"). Highlight or note plans matching their NBN/OptiComm preference and residential/business choice. Briefly add: "Select the plan by replying with the number (e.g. 1), title or speed."
// 6. Ask: "Which plan interests you? Please reply with the plan number, title or speed (e.g. 1 or 100/20 Fast)."
// 7. After they select a plan → Confirm and collect remaining: email, and confirm address if not already collected.
// 8. Use extract_call_fields to capture leadInterest as the selected plan title/speed.
// 9. When ALL details collected (preferredName, email, leadInterest, address) → Call create_ticket with subject like "Sales Inquiry for [leadInterest]", message body including all collected details, lead_id: 0 if new, reporter_type: 'api', priority: 'medium', type_id: appropriate from get_ticket_types (e.g., for sales).
// SUPPORT FLOW (for existing customers only):
// - First, ask for name, email, or phone, then call customer_lookup to get customer_id and services.
// - If not found, say "Sorry, I couldn't find your account. Are you sure you're an existing customer?" and switch to sales if needed.
// - Answer any question (including generic issues like "my internet is not working", "modem issue", speeds, setup, etc.) using the Knowledge base.
// - If the issue cannot be fully resolved in chat or the user wants further help → Ask for issueSummary (brief description) if not already collected, then immediately ask for any additional high-level details around the issue to help our support team (e.g. "Any more details like when it started, symptoms, or error messages?"). Combine all responses into the final issueSummary.
// - When ALL details collected (preferredName, customer_id from lookup, email, issueSummary) → Call create_ticket with customer_id, subject based on issueSummary (e.g., "Support: [brief summary]"), message: full issueSummary and details, reporter_type: 'api', priority from collected or 'medium', type_id for support.
// ACCOUNTS FLOW (billing/financing, for existing customers only):
// - First, ask for name, email, or phone, then call customer_lookup to get customer_id and services.
// - If not found, say "Sorry, I couldn't find your account. Are you sure you're an existing customer?" and switch to sales if needed.
// - Answer any billing or payment questions using the Knowledge base (portal, overdue invoices, update payment method, etc.).
// - Specifically for "pay a bill" or any question about paying over the phone: Reply concisely: "We can take payments or update payment details over the phone. Please call 1300 101 414 to proceed. Would you like help with anything else regarding your bill?"
// - For any specific issue → Please provide issueSummary if not already collected.
// - When ALL details collected → Call create_ticket with customer_id, subject: "Accounts Query: [brief summary]", message: issueSummary, reporter_type: 'api', priority: 'medium', type_id for accounts.
// GENERAL: Answer using the Knowledge base. If needed, ask clarifying questions concisely.
// TOOL USAGE (CRITICAL):
// - When the customer asks about plans, pricing, speeds, upgrades or "what plans do you have?": call the get_internet_plans tool.
// - When the customer asks about availability at their address or you reach step 4 in the sales flow: call check_address_availability with the full address.
// - To lookup customer by name, email, or phone: call customer_lookup with at least one of name, email, phone. Returns customer details and services if found.
// - The tool results will be injected into the conversation. ALWAYS use the live tool data for plans and availability (never rely on old hardcoded KB plans).
// - After a tool result, continue the flow concisely using the live data.
// - Call extract_call_fields whenever the user provides any personal info or intent.
// Knowledge base for InfiNET Broadband (use this to answer customer calls and chats concisely):
// ${KB}
// Locations (states) with IDs:
// ${LOCATIONS.map((l) => `${l.id}: ${l.name}`).join("\n")}
// `;
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
  console.warn("⚠️ SMTP_PASS not set in .env — email notifications will be DISABLED");
}

async function sendTicketEmail(ticketId, ticketArgs, collectedFields, isSupportTicket = false) {
  if (!process.env.SMTP_PASS) return;
  const recipient = isSupportTicket ? "support@infinetbroadband.com.au" : "sales@infinetbroadband.com.au";
  const type = isSupportTicket ? "Support" : "Sales";
  const subject = `New ${type} Enquiry — Ticket #${ticketId} — ${ticketArgs.subject || "Inquiry"}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>New ${type} Enquiry Received</h2>
  <p><strong>Ticket ID:</strong> ${ticketId}</p>
  <p><strong>Subject:</strong> ${ticketArgs.subject || "N/A"}</p>
  <p><strong>Priority:</strong> ${ticketArgs.priority || "medium"}</p>
  ${ticketArgs.customer_id ? `<p><strong>Customer ID:</strong> ${ticketArgs.customer_id}</p>` : `<p><strong>New Lead (no customer ID)</strong></p>`}
  <h3>Message Body</h3>
  <p>${(ticketArgs.message && (ticketArgs.message.message || ticketArgs.message)) || "No additional message provided"}</p>
  <hr>
  <p><small>This is an automated email from the InfiNET Broadband AI Assistant.<br>
  View ticket: https://infinetbroadband-portal.com.au/admin/support/tickets/${ticketId}</small></p>
</body>
</html>`;
  try {
    await transporter.sendMail({
      from: '"InfiNET AI Assistant" <noreply@infinetbroadband.com.au>',
      to: ["karimjawwad09@gmail.com", recipient],
      subject,
      html,
    });
    console.log(`📧 Email notification sent for ticket #${ticketId}`);
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
      console.error("Token generation failed:", err.response?.data || err.message);
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
  * Move house? Transfer plan; we check availability and re-activate.
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
Always advise customers to check current pricing and availability via the address checker or support@infinetbroadband.com.au as promotions may change.
`;

const SYSTEM_PROMPT = `
You are a concise, professional voice/chat assistant for ${BRAND}.
Handle four call types / chat intents: support, sales, general, account.

STRICT RULES:
- ALWAYS reply in English.
- Keep replies short and focused; ask for remaining missing info concisely.
- Collect structured fields when appropriate and do not re-ask for already collected fields.
- If the user has a preferredName in collected fields, ALWAYS address them warmly by that name in every response.
- Do NOT say anything like "we will connect you to a sales agent", "transferring you to support", "handover to human", "I'll put you through" or similar phrases.
- When enough information is collected per the flow below, call the create_ticket tool with appropriate parameters (generate subject based on the conversation, use issueSummary or leadInterest in the message body).
- After create_ticket succeeds, reply with the exact message including the ticket ID: "Thank you [preferredName]! I have raised a ticket for you. You will receive the ticket details via email shortly. Our team will contact you shortly."
- Use the Knowledge base below to answer questions concisely.
- For support issues, if issueSummary is not collected, ask: "Please provide a brief description of the issue." Once a basic description is provided, immediately ask for additional high-level details to help our support team (e.g. "Any more details like when it started, symptoms, or error messages?"). Combine everything into the final issueSummary.
- Use get_ticket_types, get_ticket_groups, get_ticket_statuses if you need IDs for types, groups, statuses when creating tickets.
- To verify existing customers or lookup account, use the customer_lookup tool with name, email, or phone. If multiple matches, ask for more details. If no match, politely say you can't find the account and switch to sales flow if appropriate. NEVER create tickets for non-customers.
- For existing customer flows (support/accounts), ask for name, email, or phone to lookup the account. Use the looked up customer_id for tickets.

NEW SERVICE HANDLING (CRITICAL – ONLY ACTIVE SERVICES):
- customer_lookup returns services: { internet: [], voice: [], recurring: [] } filtered to status === 'active' ONLY.
- When account lookup succeeds: DO NOT show or mention any services/plans automatically.
- Services are shown ONLY when user specifically asks about "current plan", "my plan", "what plan am I on?", "services", "packages", "plan details", OR wants to CHANGE/UPGRADE ("change plan", "upgrade", "switch plan", "other plans", "plan change").
- When user asks "which plan am I on?", "what plan do I have?", "my current service", "plan details":
  → Reply: "You are currently on the [title] plan – $[price]/month (XX Mbps down / YY Mbps up)."
- When user asks to CHANGE / UPGRADE plan:
  1. Identify current active internet service title.
  2. Respond EXACTLY: "I can see that you are on [title], on the [network] network."
     (Network logic: title contains "HIR" or "Hope Island" → HIR; contains "OptiComm" → OptiComm; else NBN)
  3. Then provide other plans available for that exact network (use get_internet_plans or check_address_availability).
  4. Show numbered list and ask: "Which one would you like to switch to? Reply with the plan number, title or speed."
  5. Once selected → follow sales flow and create_ticket with subject "Plan Change Request".

INITIAL FLOW - follow these steps exactly:
1. After the initial greeting and collecting preferredName, ask: "Are you a new InfiNET customer or an existing one?"
2. If they say new (or similar), ask: "Would you like to learn more about InfiNET Broadband, or how may I assist you with our services today?"
   - If they want to know more, explain briefly: "InfiNET Broadband is a reliable provider of high-speed internet services in Australia, offering NBN, OptiComm, and other technologies with unlimited data plans." Then proceed to sales flow by asking: "How can I help you with our services today?"
   - If they choose help or sales, proceed directly to sales flow.
3. If they say existing (or similar), ask: "How may we help you today? Would it be sales, support, accounts, other, or moving/relocating?"
4. Based on their intent, proceed to the corresponding flow:
   - sales / moving-relocating → SALES FLOW (for moving/relocating, when you reach address step 3 say "provide the new property address")
   - support → SUPPORT FLOW
   - accounts → ACCOUNTS FLOW
   - other → GENERAL flow: ask concisely "Could you please give me a bit more detail on how we can assist?" then answer using KB or create ticket if needed
   If they are not an existing customer and choose support or accounts, politely explain: "Support and accounts are for existing customers. If you're interested in our services (or moving), let's proceed with sales." and switch to sales flow.

SALES FLOW - follow these steps exactly (for new or interested users):
NOTE: If the user is existing and mentions moving, relocation, or shifting, when asking for the address in step 3, say "provide the new property address" instead of "full address".
1. Ask: "Great! Are you interested in residential or business plans?"
2. After they reply (residential or business) → Ask: "Would you like NBN or OptiComm plans?"
3. After they reply (NBN or OptiComm) → Ask: "To check the best plans for you, what's your full address (street, suburb, state and postcode)?"
4. Immediately call the check_address_availability tool with the address.
5. After tool result → Show available NBN and OptiComm plans concisely (use live data only), numbered as 1., 2., etc. (e.g. "1. [Plan Title] – [speed]"). Highlight or note plans matching their NBN/OptiComm preference and residential/business choice. Briefly add: "Select the plan by replying with the number (e.g. 1), title or speed."
6. Ask: "Which plan interests you? Please reply with the plan number, title or speed (e.g. 1 or 100/20 Fast)."
7. After they select a plan → Confirm and collect remaining: email, and confirm address if not already collected.
8. Use extract_call_fields to capture leadInterest as the selected plan title/speed.
9. When ALL details collected (preferredName, email, leadInterest, address) → Call create_ticket with subject like "Sales Inquiry for [leadInterest]", message body including all collected details, lead_id: 0 if new, reporter_type: 'api', priority: 'medium', type_id: appropriate from get_ticket_types (e.g., for sales).

SUPPORT FLOW (for existing customers only):
- First, ask for name, email, or phone, then call customer_lookup to get customer_id and services.
- If not found, say "Sorry, I couldn't find your account. Are you sure you're an existing customer?" and switch to sales if needed.
- Answer any question using the Knowledge base.
- If the issue cannot be fully resolved → Ask for issueSummary then additional details. Combine into final issueSummary.
- When ALL details collected (preferredName, customer_id, email, issueSummary) → Call create_ticket with customer_id, subject based on issueSummary, message: full issueSummary, reporter_type: 'api', priority: 'medium', type_id for support.

ACCOUNTS FLOW (billing/financing, for existing customers only):
- First, ask for name, email, or phone, then call customer_lookup to get customer_id and services.
- If not found, say "Sorry, I couldn't find your account. Are you sure you're an existing customer?" and switch to sales if needed.
- Answer any billing or payment questions using the Knowledge base.
- Specifically for "pay a bill" or any question about paying over the phone: Reply concisely: "We can take payments or update payment details over the phone. Please call 1300 101 414 to proceed. Would you like help with anything else regarding your bill?"
- For any specific issue → Provide issueSummary if not collected.
- When ALL details collected → Call create_ticket with customer_id, subject: "Accounts Query: [brief summary]", message: issueSummary, reporter_type: 'api', priority: 'medium', type_id for accounts.

GENERAL: Answer using the Knowledge base. If needed, ask clarifying questions concisely.

TOOL USAGE (CRITICAL):
- When the customer asks about plans, pricing, speeds, upgrades or "what plans do you have?": call the get_internet_plans tool.
- When the customer asks about availability at their address or you reach step 4 in the sales flow: call check_address_availability with the full address.
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
  description: "Extract fields from user message: intent (support/sales/general/account), issueSummary, preferredName (what they want to be called), email, priority, callbackRequest (boolean), timeline, leadInterest, accountNumber, name, phone. Omit fields not present.",
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

async function makeTTS(text) {
  try {
    const tts = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "cedar",
      input: text,
      format: "mp3",
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
      model: "gpt-4o-mini-transcribe",
    });
    const userTextRaw = normalizeText(transcriptionResp?.text || "");
    if (!userTextRaw) {
      const prompt = "Sorry, I didn't catch that — could you please repeat briefly?";
      const ttsBuf = await makeTTS(prompt);
      session.lastSeen = new Date().toISOString();
      sessions.set(session.id, session);
      return res.json({ sessionId: session.id, text: prompt, audioBase64: ttsBuf ? ttsBuf.toString("base64") : null });
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
          toolContent = JSON.stringify({ success: true, ticket_id: response.id });
          const isSupportTicket = !!(fixedArgs.customer_id && parseInt(fixedArgs.customer_id) > 0);
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
    });
  } catch (err) {
    console.error("voice error:", err);
    return res.status(500).json({ error: err?.message || "server error" });
  } finally {
    try {
      if (uploadedPath && fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    } catch (_) {}
    try {
      if (convertedPath && convertedPath !== uploadedPath && fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath);
    } catch (_) {}
  }
});

app.post("/api/chat/message", async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!message) return res.status(400).json({ error: "Missing message" });
    const session = sessionId && sessions.has(sessionId) ? sessions.get(sessionId) : mkSession(sessionId);
    session.messages.push({ role: "user", content: message });
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
          toolContent = JSON.stringify({ success: true, ticket_id: response.id });
          const isSupportTicket = !!(fixedArgs.customer_id && parseInt(fixedArgs.customer_id) > 0);
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
    session.lastSeen = new Date().toISOString();
    sessions.set(session.id, session);
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

// ==================== FULL SPLYNX PROXY ROUTES ====================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    splynx: {
      hasToken: !!splynx.accessToken,
      tokenExpires: splynx.accessTokenExpiration ? new Date(splynx.accessTokenExpiration * 1000).toISOString() : null,
    },
  });
});

app.get("/api/customers", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/customers/customer", null, { limit: 10, offset: 0 }));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customers", details: err });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    res.status(201).json(await splynx.request("POST", "admin/customers/customer", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to create customer" });
  }
});

app.get("/api/customer/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Customer not found" });
  }
});

app.put("/api/customer/:id", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", `admin/customers/customer/${req.params.id}`, req.body));
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
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/logs-changes`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer logs changes" });
  }
});

app.get("/api/customer/:customer_id/logs-changes--first-activation", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/logs-changes--first-activation`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer first activation" });
  }
});

app.get("/api/customer/:customer_id/logs-changes--last-activation", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/logs-changes--last-activation`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer last activation" });
  }
});

app.get("/api/customer-cap/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer-cap/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer cap" });
  }
});

app.put("/api/customer-cap/:id", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", `admin/customers/customer-cap/${req.params.id}`, req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to update customer cap" });
  }
});

app.get("/api/customer-bonus-traffic-counter", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/customers/customer-bonus-traffic-counter", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bonus traffic counters" });
  }
});

app.post("/api/customer-bonus-traffic-counter", async (req, res) => {
  try {
    res.status(201).json(await splynx.request("POST", "admin/customers/customer-bonus-traffic-counter", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to create bonus traffic counter" });
  }
});

app.get("/api/customer-bonus-traffic-counter/:service_id--:date", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer-bonus-traffic-counter/${req.params.service_id}--${req.params.date}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bonus traffic counter" });
  }
});

app.put("/api/customer-bonus-traffic-counter/:service_id--:date", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", `admin/customers/customer-bonus-traffic-counter/${req.params.service_id}--${req.params.date}`, req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to update bonus traffic counter" });
  }
});

app.delete("/api/customer-bonus-traffic-counter/:service_id--:date", async (req, res) => {
  try {
    await splynx.request("DELETE", `admin/customers/customer-bonus-traffic-counter/${req.params.service_id}--${req.params.date}`);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete bonus traffic counter" });
  }
});

app.get("/api/customer-billing-info/:customer_id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/billing-info/${req.params.customer_id}`, null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer billing info" });
  }
});

app.get("/api/customer-payment-accounts", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/customers/customer-payment-accounts", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer payment accounts" });
  }
});

app.get("/api/customer-payment-account-data", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/customers/customer-payment-account-data", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer payment account data" });
  }
});

app.get("/api/customer-payment-accounts-by-id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/customers/customer-payment-accounts", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer payment accounts by id" });
  }
});

app.put("/api/customer-payment-accounts-by-id", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", "admin/customers/customer-payment-accounts", req.body, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to update customer payment account" });
  }
});

app.delete("/api/customer-payment-accounts-by-id", async (req, res) => {
  try {
    await splynx.request("DELETE", "admin/customers/customer-payment-accounts", null, req.query);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete customer payment account" });
  }
});

app.get("/api/customer-statistics", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/customers/customer-statistics", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer statistics" });
  }
});

app.get("/api/customer-statistics/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer-statistics/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer statistic" });
  }
});

app.get("/api/customer-traffic-counter", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/customers/customer-traffic-counter", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer traffic counters" });
  }
});

app.post("/api/customer-traffic-counter", async (req, res) => {
  try {
    res.status(201).json(await splynx.request("POST", "admin/customers/customer-traffic-counter", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to create customer traffic counter" });
  }
});

app.get("/api/customer-traffic-counter/:service_id--:date", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer-traffic-counter/${req.params.service_id}--${req.params.date}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer traffic counter" });
  }
});

app.put("/api/customer-traffic-counter/:service_id--:date", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", `admin/customers/customer-traffic-counter/${req.params.service_id}--${req.params.date}`, req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to update customer traffic counter" });
  }
});

app.delete("/api/customer-traffic-counter/:service_id--:date", async (req, res) => {
  try {
    await splynx.request("DELETE", `admin/customers/customer-traffic-counter/${req.params.service_id}--${req.params.date}`);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete customer traffic counter" });
  }
});

app.get("/api/customer-billing/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer-billing/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer billing" });
  }
});

app.put("/api/customer-billing/:id", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", `admin/customers/customer-billing/${req.params.id}`, req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to update customer billing" });
  }
});

app.get("/api/customers-search", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/customers/customer", null, req.query));
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
    res.status(201).json(await splynx.request("POST", "admin/customers/customers-online", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to set customer online" });
  }
});

app.get("/api/online/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customers-online/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch online customer" });
  }
});

app.put("/api/online/:id", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", `admin/customers/customers-online/${req.params.id}`, req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to update online customer" });
  }
});

app.delete("/api/online/:id", async (req, res) => {
  try {
    await splynx.request("DELETE", `admin/customers/customers-online/${req.params.id}`);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to remove online customer" });
  }
});

app.put("/api/online/:id/kill", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", `admin/customers/customers-online/${req.params.id}--kill`, req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to disconnect online customer" });
  }
});

app.get("/api/customer-documents/:customer_id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer-documents/${req.params.customer_id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer documents" });
  }
});

app.post("/api/customer-documents", async (req, res) => {
  try {
    res.status(201).json(await splynx.request("POST", "admin/customers/customer-documents", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to create customer document" });
  }
});

app.post("/api/customer-documents/:id/upload", upload.single("file"), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(req.file.path));
    const response = await splynx.request("POST", `admin/customers/customer-documents/${req.params.id}--upload`, formData);
    res.status(202).json(response);
  } catch (err) {
    res.status(500).json({ error: "Failed to upload customer document" });
  } finally {
    if (req.file && req.file.path) fs.unlinkSync(req.file.path);
  }
});

app.put("/api/customer-documents/:id", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", `admin/customers/customer-documents/${req.params.id}`, req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to update customer document" });
  }
});

app.delete("/api/customer-documents/:id", async (req, res) => {
  try {
    await splynx.request("DELETE", `admin/customers/customer-documents/${req.params.id}`);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete customer document" });
  }
});

app.get("/api/download/customer_documents/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/config/download/customer_documents--${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to download customer document" });
  }
});

app.post("/api/send-documents", async (req, res) => {
  try {
    res.status(201).json(await splynx.request("POST", "admin/customers/send-documents", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to send documents" });
  }
});

app.get("/api/cap-history/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/cap-history/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch cap history" });
  }
});

app.post("/api/customer-notes", async (req, res) => {
  try {
    res.status(201).json(await splynx.request("POST", "admin/customers/customer-notes", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to create customer comment" });
  }
});

app.get("/api/customer-notes", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/customers/customer-notes", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer comments" });
  }
});

app.get("/api/customer-notes/:customer_id--:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer-notes/${req.params.customer_id}--${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer comment" });
  }
});

// GROUP SERVICES
app.get("/api/customer/:customer_id/internet-services", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/internet-services`, null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer internet services" });
  }
});

app.get("/api/customer/:customer_id/internet-services--:service_id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/internet-services--${req.params.service_id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch internet service" });
  }
});

app.get("/api/customer/:customer_id/geo-internet-service--:service_id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/geo-internet-service--${req.params.service_id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch internet service geo data" });
  }
});

app.get("/api/customer/:customer_id/geo-voice-service--:service_id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/geo-voice-service--${req.params.service_id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch voice service geo data" });
  }
});

app.get("/api/customer/:customer_id/geo-recurring-service--:service_id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/geo-recurring-service--${req.params.service_id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recurring service geo data" });
  }
});

app.get("/api/customer/:customer_id/voice-services", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/voice-services`, null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer voice services" });
  }
});

app.get("/api/customer/:customer_id/voice-services--:service_id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/voice-services--${req.params.service_id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch voice service" });
  }
});

app.get("/api/customer/:customer_id/recurring-services", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/recurring-services`, null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer recurring services" });
  }
});

app.get("/api/customer/:customer_id/recurring-services--:service_id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/recurring-services--${req.params.service_id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recurring service" });
  }
});

app.get("/api/customer/:customer_id/bundle-services", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/bundle-services`, null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer bundle services" });
  }
});

app.get("/api/customer/:customer_id/bundle-services--:service_id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer/${req.params.customer_id}/bundle-services--${req.params.service_id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bundle service" });
  }
});

app.get("/api/customer-tariffs/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/customers/customer-tariffs/${req.params.id}`, null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer tariffs" });
  }
});

app.get("/api/portal/services/start/:service_id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `portal/services/start/${req.params.service_id}`, null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to start service" });
  }
});

app.get("/api/portal/services/stop/:service_id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `portal/services/stop/${req.params.service_id}`, null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to stop service" });
  }
});

app.get("/api/traffic/:serviceId", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/fup/usage/${req.params.serviceId}?with_texts=true`));
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
    res.json(await splynx.request("GET", `admin/tariffs/internet/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to get tariff" });
  }
});

app.get("/api/locations", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/administration/locations", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to list locations" });
  }
});

app.get("/api/locations/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/administration/locations/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Location not found" });
  }
});

app.get("/api/administrators", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/administration/administrators", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to list administrators" });
  }
});

app.get("/api/administrators/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/administration/administrators/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Admin not found" });
  }
});

app.get("/api/partners", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/administration/partners", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to list partners" });
  }
});

app.get("/api/partners/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/administration/partners/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Partner not found" });
  }
});

// Tickets APIs
app.post("/api/admin/support/tickets", async (req, res) => {
  try {
    res.status(201).json(await splynx.request("POST", "admin/support/tickets", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

app.get("/api/admin/support/tickets", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/support/tickets", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to list tickets" });
  }
});

app.get("/api/admin/support/tickets/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/support/tickets/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket" });
  }
});

app.put("/api/admin/support/tickets/:id", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", `admin/support/tickets/${req.params.id}`, req.body));
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
    res.status(201).json(await splynx.request("POST", "admin/support/ticket-messages", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to create ticket message" });
  }
});

app.get("/api/admin/support/ticket-messages", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/support/ticket-messages", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket messages" });
  }
});

app.get("/api/admin/support/ticket-messages/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/support/ticket-messages/${req.params.id}`, null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket message" });
  }
});

app.put("/api/admin/support/ticket-messages/:id", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", `admin/support/ticket-messages/${req.params.id}`, req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to update ticket message" });
  }
});

app.delete("/api/admin/support/ticket-messages/:id", async (req, res) => {
  try {
    await splynx.request("DELETE", `admin/support/ticket-messages/${req.params.id}`);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete ticket message" });
  }
});

app.get("/api/admin/support/tickets-statuses", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/support/tickets-statuses", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket statuses" });
  }
});

app.get("/api/admin/support/tickets-statuses/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/support/tickets-statuses/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket status" });
  }
});

app.get("/api/admin/support/tickets-groups", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/support/tickets-groups", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket groups" });
  }
});

app.get("/api/admin/support/tickets-groups/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/support/tickets-groups/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket group" });
  }
});

app.get("/api/admin/support/tickets-types", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/support/tickets-types", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket types" });
  }
});

app.get("/api/admin/support/tickets-types/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/support/tickets-types/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket type" });
  }
});

app.get("/api/admin/support/ticket-attachments", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/support/ticket-attachments", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket attachments" });
  }
});

app.get("/api/admin/support/ticket-attachments/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/support/ticket-attachments/${req.params.id}`, null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket attachment" });
  }
});

app.post("/api/admin/support/ticket-attachments", async (req, res) => {
  try {
    res.status(201).json(await splynx.request("POST", "admin/support/ticket-attachments", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to create ticket attachment" });
  }
});

app.delete("/api/admin/support/ticket-attachments/:id", async (req, res) => {
  try {
    await splynx.request("DELETE", `admin/support/ticket-attachments/${req.params.id}`);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete ticket attachment" });
  }
});

app.get("/api/admin/support/ticket-feedbacks", async (req, res) => {
  try {
    res.json(await splynx.request("GET", "admin/support/ticket-feedbacks", null, req.query));
  } catch (err) {
    res.status(500).json({ error: "Failed to list ticket feedbacks" });
  }
});

app.post("/api/admin/support/ticket-feedbacks", async (req, res) => {
  try {
    res.status(201).json(await splynx.request("POST", "admin/support/ticket-feedbacks", req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to create ticket feedbacks" });
  }
});

app.get("/api/admin/support/ticket-feedbacks/:id", async (req, res) => {
  try {
    res.json(await splynx.request("GET", `admin/support/ticket-feedbacks/${req.params.id}`));
  } catch (err) {
    res.status(500).json({ error: "Failed to get ticket feedback" });
  }
});

app.put("/api/admin/support/ticket-feedbacks/:id", async (req, res) => {
  try {
    res.status(202).json(await splynx.request("PUT", `admin/support/ticket-feedbacks/${req.params.id}`, req.body));
  } catch (err) {
    res.status(500).json({ error: "Failed to update ticket feedback" });
  }
});

app.delete("/api/admin/support/ticket-feedbacks/:id", async (req, res) => {
  try {
    await splynx.request("DELETE", `admin/support/ticket-feedbacks/${req.params.id}`);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete ticket feedback" });
  }
});

app.all(/^\/api\/.*/, async (req, res) => {
  try {
    let endpoint = req.path.replace(/^\/api\//, "");
    if (!endpoint) return res.status(400).json({ error: "Missing endpoint after /api/" });
    const data = await splynx.request(
      req.method,
      endpoint,
      req.method !== "GET" && req.method !== "HEAD" ? req.body : null,
      req.query
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
  console.log(`✅ InfiNET Agent + Full Splynx Integration + SparkPost Email running on http://localhost:${PORT}`);
  console.log(` • Services shown = ACTIVE ONLY`);
  console.log(` • No automatic service display on lookup`);
  console.log(` • Plan change uses exact “I can see that you are on X, on the HIR/NBN/OptiComm network” response`);
});