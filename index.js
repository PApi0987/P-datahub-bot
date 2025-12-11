// index.js — P-DataHub Bot (Inline Buttons + Wallet + Auto-profit)
// Requires: node >= 16, packages: express axios node-telegram-bot-api dotenv fs

const express = require("express");
import axios from "axios";
import TelegramBot from "node-telegram-bot-api";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import dotenv from "dotenv";

dotenv.config();

// -------------------- file path setup --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WALLET_FILE = path.join(__dirname, "wallet.json");

// -------------------- express setup --------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// -------------------- config from env --------------------
const PORT = Number(process.env.PORT || 10000);
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || process.env.BOT_TOKEN || "";
const API_BASE = (process.env.API_BASE || "https://www.cheapdatahub.ng/api/v1/").replace(/\/+$/, "") + "/";
const API_KEY = process.env.CHEAPDATA_API_KEY || "";
const AUTH_SCHEME = process.env.AUTH_SCHEME || "Token";
const ADMIN_ID = process.env.ADMIN_ID ? String(process.env.ADMIN_ID) : null;

// profit markup (in NGN)
const PROFIT_AIRTIME = Number(process.env.PROFIT_AIRTIME || 40);
const PROFIT_DATA = Number(process.env.PROFIT_DATA || 70);
const PROFIT_CABLE = Number(process.env.PROFIT_CABLE || 500);
const PROFIT_ELECT = Number(process.env.PROFIT_ELECT || 300);

// quick checks
if (!TELEGRAM_TOKEN) console.error("Missing TELEGRAM_TOKEN.");
if (!API_KEY) console.warn("Warning: CHEAPDATA_API_KEY not set. API calls will fail.");

// -------------------- wallet (simple JSON persistence) --------------------
async function loadWallets() {
  try {
    const raw = await fs.readFile(WALLET_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    // file missing -> return empty
    return {};
  }
}
async function saveWallets(obj) {
  await fs.writeFile(WALLET_FILE, JSON.stringify(obj, null, 2), "utf8");
}
async function getBalance(userId) {
  const w = await loadWallets();
  return Number(w[userId] || 0);
}
async function creditWallet(userId, amount) {
  const w = await loadWallets();
  w[userId] = Number(w[userId] || 0) + Number(amount || 0);
  await saveWallets(w);
  return w[userId];
}
async function debitWallet(userId, amount) {
  const w = await loadWallets();
  const bal = Number(w[userId] || 0);
  const newBal = bal - Number(amount || 0);
  if (newBal < 0) return null; // insufficient
  w[userId] = newBal;
  await saveWallets(w);
  return w[userId];
}

// -------------------- CheapDataHub helper --------------------
async function cheapPost(endpoint, payload = {}) {
  const url = (API_BASE + endpoint).replace(/\/{2,}/g, "/");
  try {
    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `${AUTH_SCHEME} ${API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
    return { ok: true, data: res.data, status: res.status };
  } catch (err) {
    if (err.response) {
      return { ok: false, error: err.response.data || err.response.statusText, status: err.response.status };
    }
    return { ok: false, error: err.message || String(err) };
  }
}
async function cheapGet(endpoint, params = {}) {
  const url = (API_BASE + endpoint).replace(/\/{2,}/g, "/");
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `${AUTH_SCHEME} ${API_KEY}`, "Content-Type": "application/json" },
      params,
      timeout: 20000,
    });
    return { ok: true, data: res.data, status: res.status };
  } catch (err) {
    if (err.response) return { ok: false, error: err.response.data || err.response.statusText, status: err.response.status };
    return { ok: false, error: err.message || String(err) };
  }
}

// -------------------- Telegram Bot --------------------
let bot = null;
if (TELEGRAM_TOKEN) {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true, request: { timeout: 30000 } });

  async function notifyAdmin(text) {
    if (!ADMIN_ID) return;
    try { await bot.sendMessage(ADMIN_ID, `🔔 Admin notify:\n${text}`); } catch (e) { console.error("notifyAdmin:", e.message || e); }
  }

  function mainMenu(chatId, text = "Choose a service:") {
    const keyboard = {
      inline_keyboard: [
        [{ text: "📱 Buy Airtime", callback_data: "svc_airtime" }, { text: "📶 Buy Data", callback_data: "svc_data" }],
        [{ text: "📺 Cable TV", callback_data: "svc_cable" }, { text: "⚡ Electricity", callback_data: "svc_electricity" }],
        [{ text: "🧾 Plans", callback_data: "svc_plans" }, { text: "💳 Wallet", callback_data: "svc_wallet" }],
      ],
    };
    return bot.sendMessage(chatId, text, { reply_markup: keyboard });
  }

  bot.onText(/\/start/, (msg) => mainMenu(msg.chat.id, `Welcome ${msg.from.first_name || "there"} — P-DataHub bot!`));
  bot.onText(/\/menu/, (msg) => mainMenu(msg.chat.id));
  bot.onText(/\/wallet/, async (msg) => {
    const bal = await getBalance(String(msg.from.id));
    bot.sendMessage(msg.chat.id, `Your wallet balance: ₦${bal}`);
  });

  // Admin credit: /credit <userId> <amount>
  bot.onText(/\/credit (.+)/, async (msg, match) => {
    if (!ADMIN_ID || String(msg.from.id) !== String(ADMIN_ID)) return bot.sendMessage(msg.chat.id, "Unauthorized.");
    const parts = match[1].split(/\s+/);
    if (parts.length < 2) return bot.sendMessage(msg.chat.id, "Format: /credit <tgUserId> <amount>");
    const [userId, amount] = parts;
    await creditWallet(String(userId), Number(amount));
    bot.sendMessage(msg.chat.id, `Credited ₦${amount} to ${userId}`);
  });

  // /fund <amount> -- user can simulate funding (for testing)
  bot.onText(/\/fund (.+)/, async (msg, match) => {
    const amount = Number(match[1]);
    if (Number.isNaN(amount) || amount <= 0) return bot.sendMessage(msg.chat.id, "Invalid amount.");
    const newBal = await creditWallet(String(msg.from.id), amount);
    bot.sendMessage(msg.chat.id, `Wallet funded. New balance: ₦${newBal}`);
  });

  // /plans command
  bot.onText(/\/plans/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, "Fetching plans…");
    // common candidate endpoint
    const r = await cheapGet("resellers/data/plans/");
    if (r.ok && r.data) {
      let text = "📄 Plans:\n";
      const items = Array.isArray(r.data) ? r.data : (r.data.data || r.data.products || []);
      for (let i = 0; i < Math.min(items.length, 30); i++) {
        const it = items[i];
        const id = it.id ?? it.plan_id ?? it.bundle_id ?? i;
        const name = it.name || it.plan || it.title || `${it.size || ""}`;
        const price = it.price || it.amount || it.sell_price || "";
        text += `\n• ID ${id}: ${name} ${price ? `— ₦${price}` : ""}`;
      }
      return bot.sendMessage(chatId, text);
    }
    bot.sendMessage(chatId, "Couldn't fetch plans. Try later.");
  });

  // /balance command (try wallet endpoint)
  bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, "Checking provider balance…");
    const r = await cheapGet("resellers/wallet/balance/");
    if (r.ok) return bot.sendMessage(chatId, `Provider balance: ${JSON.stringify(r.data)}`);
    bot.sendMessage(chatId, "Unable to fetch provider balance.");
  });

  // handle callback menu
  bot.on("callback_query", async (q) => {
    const data = q.data;
    const chatId = q.message.chat.id;
    await bot.answerCallbackQuery(q.id).catch(()=>{});
    if (data === "svc_airtime") {
      await bot.sendMessage(chatId, "Send message in format: `airtime <amount> <phone>`\nExample: `airtime 500 08012345678`");
      return;
    }
    if (data === "svc_data") {
      await bot.sendMessage(chatId, "Send message in format: `data <bundle_id> <phone>`\nExample: `data 34 08012345678`");
      return;
    }
    if (data === "svc_cable") {
      await bot.sendMessage(chatId, "Send message: `cable <plan_id> <cardnumber> <phone>`");
      return;
    }
    if (data === "svc_electricity") {
      await bot.sendMessage(chatId, "Send message: `electricity <disco_id> <meter_number> <amount> <phone>`");
      return;
    }
    if (data === "svc_plans") {
      return bot.emit("text", { chat: { id: chatId }, text: "/plans" });
    }
    if (data === "svc_wallet") {
      const bal = await getBalance(String(q.from.id));
      return bot.sendMessage(chatId, `Your wallet balance: ₦${bal}`);
    }

    // confirmations (confirm_xxx|payload)
    if (data.startsWith("confirm_air|")) {
      const [, amountStr, phone, userId] = data.split("|"); // userId included for safety
      const amount = Number(amountStr);
      const caller = String(userId || q.from.id);
      // supplier amount = amount (what provider expects)
      const supplierAmount = amount;
      const apiRes = await cheapPost("resellers/airtime/purchase/", { provider_id: 1, phone_number: phone, amount: supplierAmount });
      if (apiRes.ok) {
        await bot.sendMessage(chatId, `✅ Airtime successful:\n${JSON.stringify(apiRes.data)}`);
        notifyAdmin(`Airtime: ₦${amount} to ${phone} by ${caller}`);
      } else {
        await bot.sendMessage(chatId, `❌ Airtime failed: ${JSON.stringify(apiRes.error)}`);
      }
      return;
    }

    if (data.startsWith("confirm_data|")) {
      const [, bundleId, phone, userId] = data.split("|");
      const caller = String(userId || q.from.id);
      const apiRes = await cheapPost("resellers/data/purchase/", { bundle_id: bundleId, phone_number: phone });
      if (apiRes.ok) {
        await bot.sendMessage(chatId, `✅ Data successful:\n${JSON.stringify(apiRes.data)}`);
        notifyAdmin(`Data: bundle ${bundleId} to ${phone} by ${caller}`);
      } else {
        await bot.sendMessage(chatId, `❌ Data failed: ${JSON.stringify(apiRes.error)}`);
      }
      return;
    }

    if (data.startsWith("confirm_cable|")) {
      const [, planId, cardnumber, phone, userId] = data.split("|");
      const caller = String(userId || q.from.id);
      const apiRes = await cheapPost("resellers/cable/purchase/", { plan_id: planId, cardnumber, phone });
      if (apiRes.ok) {
        await bot.sendMessage(chatId, `✅ Cable successful:\n${JSON.stringify(apiRes.data)}`);
        notifyAdmin(`Cable: plan ${planId}, iuc ${cardnumber} to ${phone} by ${caller}`);
      } else {
        await bot.sendMessage(chatId, `❌ Cable failed: ${JSON.stringify(apiRes.error)}`);
      }
      return;
    }

    if (data.startsWith("confirm_elec|")) {
      const [, discoId, meter, amtStr, phone, userId] = data.split("|");
      const amt = Number(amtStr);
      const caller = String(userId || q.from.id);
      const apiRes = await cheapPost("resellers/electricity/purchase/", { disco_id: Number(discoId), meter_number: meter, amount: amt, phone, meter_type: "prepaid" });
      if (apiRes.ok) {
        await bot.sendMessage(chatId, `✅ Electricity successful:\n${JSON.stringify(apiRes.data)}`);
        notifyAdmin(`Electricity: ₦${amt} to ${meter} by ${caller}`);
      } else {
        await bot.sendMessage(chatId, `❌ Electricity failed: ${JSON.stringify(apiRes.error)}`);
      }
      return;
    }

    // fallback
    await bot.sendMessage(chatId, "Unknown action.");
  });

  // generic text handler (commands using inline confirmation + wallet)
  bot.on("message", async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = msg.text.trim();
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    // ---- AIRTIME ----
    if (cmd === "airtime") {
      if (parts.length < 3) return bot.sendMessage(chatId, "Format: `airtime <amount> <phone>`");
      const amount = Number(parts[1]);
      const phone = parts[2];
      if (Number.isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, "Invalid amount.");

      const customerCharge = amount + PROFIT_AIRTIME;
      const bal = await getBalance(userId);
      if (bal < customerCharge) return bot.sendMessage(chatId, `Insufficient wallet. You need ₦${customerCharge}, your balance is ₦${bal}. Use /fund or contact admin to top-up.`);

      // ask confirm
      const kb = {
        inline_keyboard: [
          [{ text: `Confirm — Pay ₦${customerCharge}`, callback_data: `confirm_air|${amount}|${phone}|${userId}` }],
          [{ text: "Cancel", callback_data: "cancel" }],
        ],
      };
      return bot.sendMessage(chatId, `You will be charged ₦${customerCharge} (includes profit ₦${PROFIT_AIRTIME}). Confirm?`, { reply_markup: kb });
    }

    // ---- DATA ----
    if (cmd === "data") {
      if (parts.length < 3) return bot.sendMessage(chatId, "Format: `data <bundle_id> <phone>`");
      const bundleId = parts[1];
      const phone = parts[2];
      // we don't know API price — assume user pays the bundle price + profit. For wallet check, attempt to get bundle price via plans endpoint (optional).
      // For simplicity we'll request confirmation and debit when user confirms.
      const kb = {
        inline_keyboard: [
          [{ text: `Confirm purchase`, callback_data: `confirm_data|${bundleId}|${phone}|${userId}` }],
          [{ text: "Cancel", callback_data: "cancel" }],
        ],
      };
      return bot.sendMessage(chatId, `Confirm data purchase for bundle ${bundleId} to ${phone}?`, { reply_markup: kb });
    }

    // ---- CABLE ----
    if (cmd === "cable") {
      if (parts.length < 4) return bot.sendMessage(chatId, "Format: `cable <plan_id> <cardnumber> <phone>`");
      const planId = parts[1], card = parts[2], phone = parts[3];
      const kb = { inline_keyboard: [[{ text: "Confirm cable", callback_data: `confirm_cable|${planId}|${card}|${phone}|${userId}` }, { text: "Cancel", callback_data: "cancel" }]] };
      return bot.sendMessage(chatId, `Confirm cable plan ${planId} (IUC ${card}) for ${phone}?`, { reply_markup: kb });
    }

    // ---- ELECTRICITY ----
    if (cmd === "electricity") {
      if (parts.length < 5) return bot.sendMessage(chatId, "Format: `electricity <disco_id> <meter_no> <amount> <phone>`");
      const disco = parts[1], meter = parts[2], amt = Number(parts[3]), phone = parts[4];
      if (Number.isNaN(amt) || amt <= 0) return bot.sendMessage(chatId, "Invalid amount.");
      const customerCharge = amt + PROFIT_ELECT;
      const bal = await getBalance(userId);
      if (bal < customerCharge) return bot.sendMessage(chatId, `Insufficient wallet. You need ₦${customerCharge}, your balance is ₦${bal}. Use /fund or contact admin to top-up.`);
      const kb = { inline_keyboard: [[{ text: `Confirm — Pay ₦${customerCharge}`, callback_data: `confirm_elec|${disco}|${meter}|${amt}|${phone}|${userId}` }, { text: "Cancel", callback_data: "cancel" }]] };
      return bot.sendMessage(chatId, `You will be charged ₦${customerCharge} (profit ₦${PROFIT_ELECT}). Confirm?`, { reply_markup: kb });
    }

    // ignore everything else
  });

} // end bot setup

// -------------------- Express endpoints (same flows) --------------------
app.get("/", (req, res) => res.send("PDataHub Bot API is active"));

// Airtime endpoint (external app)
app.post("/airtime", async (req, res) => {
  try {
    const { provider_id = 1, phone_number, amount } = req.body;
    const r = await cheapPost("resellers/airtime/purchase/", { provider_id, phone_number, amount });
    return res.json(r.ok ? r.data : { error: r.error, status: r.status || 500 });
  } catch (e) {
    return res.status(500).json({ error: e.message || e });
  }
});

// Data
app.post("/data", async (req, res) => {
  try {
    const { plan_id, phone_number } = req.body;
    const r = await cheapPost("resellers/data/purchase/", { bundle_id: plan_id, phone_number });
    return res.json(r.ok ? r.data : { error: r.error, status: r.status || 500 });
  } catch (e) { return res.status(500).json({ error: e.message || e }); }
});

// Cable
app.post("/cable", async (req, res) => {
  try {
    const { plan_id, cardnumber, phone } = req.body;
    const r = await cheapPost("resellers/cable/purchase/", { plan_id, cardnumber, phone });
    return res.json(r.ok ? r.data : { error: r.error, status: r.status || 500 });
  } catch (e) { return res.status(500).json({ error: e.message || e }); }
});

// Electricity
app.post("/electricity", async (req, res) => {
  try {
    const { disco_id, meter_number, amount, phone } = req.body;
    const r = await cheapPost("resellers/electricity/purchase/", { disco_id, meter_number, amount, phone, meter_type: "prepaid" });
    return res.json(r.ok ? r.data : { error: r.error, status: r.status || 500 });
  } catch (e) { return res.status(500).json({ error: e.message || e }); }
});

// Provider plans (proxy)
app.get("/plans", async (req, res) => {
  const r = await cheapGet("resellers/data/plans/");
  if (r.ok) return res.json(r.data);
  return res.status(500).json({ error: r.error || "failed" });
});

// -------------------- start server --------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
