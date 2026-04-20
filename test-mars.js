import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const MARS_BASE_URL = "https://mars.as24516.net/api/v1";
const MARS_CLIENT_ID = process.env.MARS_CLIENT_ID;
const MARS_CLIENT_SECRET = process.env.MARS_CLIENT_SECRET;

let marsAccessToken = null;
let marsAccessTokenExpiresAtMs = 0;

async function getMarsAccessToken() {
  if (marsAccessToken && marsAccessTokenExpiresAtMs && Date.now() < marsAccessTokenExpiresAtMs - 30_000) {
    return marsAccessToken;
  }
  if (!MARS_CLIENT_ID || !MARS_CLIENT_SECRET) {
    throw new Error("Mars credentials missing in .env (MARS_CLIENT_ID, MARS_CLIENT_SECRET)");
  }
  
  console.log("🔑 Requesting Mars Access Token...");
  const resp = await axios.post(`${MARS_BASE_URL}/oauth/tokens`, {
    client_id: MARS_CLIENT_ID,
    client_secret: MARS_CLIENT_SECRET,
    audience: "mars.as24516.net",
    grant_type: "client_credentials",
  }, { headers: { "Content-Type": "application/json" } });

  const data = resp?.data || {};
  if (!data.vt_success || !data.access_token) {
    throw new Error(`Mars token error: ${data.vt_error_desc || data.vt_short_error || "Token request failed"}`);
  }

  marsAccessToken = data.access_token;
  const expiresInSec = typeof data.expires_in === "number" ? data.expires_in : 0;
  marsAccessTokenExpiresAtMs = Date.now() + Math.max(0, expiresInSec) * 1000;
  return marsAccessToken;
}

async function marsAddressSearch(address) {
  const token = await getMarsAccessToken();
  console.log(`🔍 Searching for address: "${address}"...`);
  const resp = await axios.post(`${MARS_BASE_URL}/locations`, { unstructured: { address, fuzzy: false } }, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  return resp?.data;
}

async function marsServiceQualification(locationId) {
  const token = await getMarsAccessToken();
  console.log(`📡 Fetching Service Qualification for: ${locationId}...`);
  const resp = await axios.get(`${MARS_BASE_URL}/service-qualifications/${encodeURIComponent(locationId)}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  return resp?.data;
}

// CLI Execution
const address = process.argv[2] || "100 Elizabeth St, Brisbane City QLD 4000";

(async () => {
  try {
    console.log("hello");
    console.log("--- MARS API STANDALONE TEST ---");
    
    // 1. Search Address
    const searchResult = await marsAddressSearch(address);
    console.log("\n📍 ADDRESS SEARCH RESPONSE:");
    console.log(JSON.stringify(searchResult, null, 2));

    if (searchResult.vt_success && searchResult.responseData?.length > 0) {
      const locId = searchResult.responseData[0].id;
      const formatted = searchResult.responseData[0].formattedAddress;
      console.log(`\n✅ Found Match: ${formatted} (ID: ${locId})`);

      // 2. Service Qualification
      const sqResult = await marsServiceQualification(locId);
      console.log("\n📶 SERVICE QUALIFICATION RESPONSE:");
      console.log(JSON.stringify(sqResult, null, 2));
    } else {
      console.log("\n❌ No matching address found.");
    }

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    if (err.response) {
      console.error("Response Data:", JSON.stringify(err.response.data, null, 2));
    }
  }
})();
