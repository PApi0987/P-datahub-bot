/**
 * P-DataHub — Advanced Backend (Telegram Bot + REST API + Website)
 * Supports:
 *  - Full website (HTML/JS frontend inside /public)
 *  - Structured REST API
 *  - Better error handling
 *  - Logging
 *  - CORS for frontend usage
 *  - Wallet system
 *  - CheapDataHub Integration
 */

const express = require("express");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const fs = require("fs").promises;
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");

dotenv.config();

const app = express();

// ----------- MIDDLEWARE -----------
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));

// ----------- STATIC WEBSITE -----------
app.use(express.static(path.join(__dirname, "public"))); 
// → Any HTML, CSS, JS in /public becomes a full website

// ----------- ENV CONFIG -----------
const PORT = Number(process.env.PORT || 8000);
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "";
const API_BASE = (process.env.API_BASE || "https://www.cheapdatahub.ng/api/v1/")
  .replace(/\/+$/, "") + "/";
const API_KEY = process.env.CHEAPDATA_API_KEY || "";
const AUTH_SCHEME = process.env.AUTH_SCHEME || "Token";
const ADMIN_ID = String(process.env.ADMIN_ID || "");

// PROFIT CONFIG
const PROFIT = {
  airtime: Number(process.env.PROFIT_AIRTIME || 40),
  data: Number(process.env.PROFIT_DATA || 70),
  cable: Number(process.env.PROFIT_CABLE || 500),
  electricity: Number(process.env.PROFIT_ELECT || 300),
};

// ----------- WALLET FILE -----------
const WALLET_FILE = path.join(__dirname, "wallet.json");

// ----------- WALLET FUNCTIONS -----------
async function loadWallets() {
  try {
    const raw = await fs.readFile(WALLET_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

async function saveWallets(obj) {
  await fs.writeFile(WALLET_FILE, JSON.stringify(obj, null, 2));
}

async function getBalance(uid) {
  const w = await loadWallets();
  return Number(w[uid] || 0);
}

async function credit(uid, amount) {
  const w = await loadWallets();
  w[uid] = Number(w[uid] || 0) + Number(amount);
  await saveWallets(w);
  return w[uid];
}

async function debit(uid, amount) {
  const w = await loadWallets();
  const bal = Number(w[uid] || 0);

  if (bal < amount) return null;

  w[uid] = bal - amount;
  await saveWallets(w);
  return w[uid];
}

// ----------- CHEAPDATAHUB API CLIENT -----------
async function cheapPost(endpoint, payload = {}) {
  try {
    const res = await axios.post(API_BASE + endpoint, payload, {
      headers: {
        Authorization: `${AUTH_SCHEME} ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err.response?.data || err.message };
  }
}

async function cheapGet(endpoint) {
  try {
    const res = await axios.get(API_BASE + endpoint, {
      headers: { Authorization: `${AUTH_SCHEME} ${API_KEY}` },
    });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err.response?.data || err.message };
  }
}

// ----------- TELEGRAM BOT -----------
let bot = null;

if (TELEGRAM_TOKEN) {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

  // Main Menu
  function mainMenu(chatId, text = "Choose a service:") {
    return bot.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📱 Airtime", callback_data: "svc_airtime" },
           { text: "📶 Data", callback_data: "svc_data" }],
          [{ text: "📺 Cable", callback_data: "svc_cable" },
           { text: "⚡ Electricity", callback_data: "svc_electricity" }],
          [{ text: "💳 Wallet", callback_data: "svc_wallet" },
           { text: "🧾 Plans", callback_data: "svc_plans" }],
        ],
      },
    });
  }

  bot.onText(/\/start/, msg => mainMenu(msg.chat.id, `Welcome ${msg.from.first_name}!`));
  bot.onText(/\/menu/, msg => mainMenu(msg.chat.id));

  bot.onText(/\/wallet/, async msg => {
    const bal = await getBalance(String(msg.from.id));
    bot.sendMessage(msg.chat.id, `💳 Wallet Balance: ₦${bal}`);
  });

  // Admin credit
  bot.onText(/\/credit (.+)/, async (msg, match) => {
    if (String(msg.from.id) !== ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, "❌ Unauthorized");
    }
    const [userId, amount] = match[1].split(/\s+/);
    await credit(userId, Number(amount));
    bot.sendMessage(msg.chat.id, `✔ Credited ₦${amount} to ${userId}`);
  });

  // NOTE: You can add your callback handlers here (same logic you had before)
}

// ----------- REST API ENDPOINTS -----------

// Home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Wallet balance
app.get("/api/wallet/:uid", async (req, res) => {
  const bal = await getBalance(req.params.uid);
  res.json({ balance: bal });
});

// API Purchase routes
app.post("/api/airtime", async (req, res) => {
  const r = await cheapPost("resellers/airtime/purchase/", req.body);
  res.json(r);
});

app.post("/api/data", async (req, res) => {
  const r = await cheapPost("resellers/data/purchase/", req.body);
  res.json(r);
});

app.post("/api/cable", async (req, res) => {
  const r = await cheapPost("resellers/cable/purchase/", req.body);
  res.json(r);
});

app.post("/api/electricity", async (req, res) => {
  const r = await cheapPost("resellers/electricity/purchase/", req.body);
  res.json(r);
});

// ----------- 404 HANDLER -----------
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ----------- START SERVER -----------
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
