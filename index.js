// index.js — P-DataHub Bot (Inline Buttons Edition)
// Full Telegram bot + Express server (inline buttons, purchase flows, plans, balance, admin notify)

import express from "express";
import axios from "axios";
import TelegramBot from "node-telegram-bot-api";
import path from "path";
import { fileURLToPath } from "url";

// -------------------- file path setup --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- express setup --------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// -------------------- config from env --------------------
const PORT = process.env.PORT || 10000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || process.env.BOT_TOKEN || "";
const API_BASE = (process.env.API_BASE || "https://www.cheapdatahub.ng/api/v1/").replace(/\/+$/, "") + "/";
const API_KEY = process.env.CHEAPDATA_API_KEY || "";
const AUTH_SCHEME = process.env.AUTH_SCHEME || "Token"; // or "Bearer"
const ADMIN_ID = process.env.ADMIN_ID ? String(process.env.ADMIN_ID) : null;
const PROFIT_AIRTIME = Number(process.env.DISCOUNT_AIRTIME || 40);
const PROFIT_DATA = Number(process.env.DISCOUNT_DATA || 70);
const PROFIT_CABLE = Number(process.env.DISCOUNT_CABLE || 500);
const PROFIT_ELECT = Number(process.env.DISCOUNT_ELECTRICITY || 300);

// quick check
if (!TELEGRAM_TOKEN) {
  console.error("Missing TELEGRAM_TOKEN environment variable. Bot will not start.");
}
if (!API_KEY) {
  console.warn("Warning: CHEAPDATA_API_KEY not set. API calls will fail until you set it.");
}

// -------------------- cheapdatahub helper --------------------
async function cheapPost(path, payload = {}) {
  const url = (API_BASE + path).replace(/\/{2,}/g, "/");
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

async function cheapGet(path, params = {}) {
  const url = (API_BASE + path).replace(/\/{2,}/g, "/");
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

// -------------------- telegram bot setup --------------------
let bot = null;
if (TELEGRAM_TOKEN) {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true, request: { timeout: 30000 } });

  // Utility: send admin message if admin set
  async function notifyAdmin(text) {
    if (!ADMIN_ID) return;
    try {
      await bot.sendMessage(ADMIN_ID, `🔔 Admin notify:\n${text}`);
    } catch (e) {
      console.error("Failed to notify admin:", e.message || e);
    }
  }

  // Build main inline menu
  function mainMenu(chatId, text = "Choose a service:") {
    const keyboard = {
      inline_keyboard: [
        [{ text: "📱 Airtime", callback_data: "svc_airtime" }, { text: "📶 Data", callback_data: "svc_data" }],
        [{ text: "📺 Cable TV", callback_data: "svc_cable" }, { text: "⚡ Electricity", callback_data: "svc_electricity" }],
        [{ text: "🧾 Plans", callback_data: "svc_plans" }, { text: "💳 Balance", callback_data: "svc_balance" }],
      ],
    };
    return bot.sendMessage(chatId, text, { reply_markup: keyboard });
  }

  // When user sends /start or plain text
  bot.onText(/\/start/, (msg) => mainMenu(msg.chat.id, `Welcome ${msg.from.first_name || "there"} — P-DataHub bot!`));
  bot.onText(/\/menu/, (msg) => mainMenu(msg.chat.id));

  // /plans command — fetch data plans (best-effort)
  bot.onText(/\/plans/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, "Fetching plans… please wait.");
    // try plausible endpoints
    const candidates = ["resellers/data/plans/", "resellers/data/products/", "resellers/data/"];
    for (const p of candidates) {
      const r = await cheapGet(p);
      if (r.ok && r.data) {
        // try to format result
        let text = "📄 Available plans:\n";
        try {
          const items = Array.isArray(r.data) ? r.data : (r.data.data || r.data.products || r.data.plans || []);
          for (let i = 0; i < Math.min(items.length, 20); i++) {
            const it = items[i];
            const id = it.id ?? it.plan_id ?? it.bundle_id ?? i;
            const name = it.name || it.plan || it.title || `${it.size || ""} ${it.amount || ""}`;
            const price = it.price || it.amount || it.sell_price || "";
            text += `\n• ID ${id}: ${name} ${price ? `– ₦${price}` : ""}`;
          }
        } catch (e) {
          text = JSON.stringify(r.data).slice(0, 2000);
        }
        return bot.sendMessage(chatId, text);
      }
    }
    bot.sendMessage(chatId, "Sorry — couldn't fetch plans. Try again later.");
  });

  // /balance command — try to call a balance endpoint (best-effort)
  bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, "Checking balance…");
    // common candidate endpoints
    const candidates = ["resellers/wallet/balance/", "resellers/wallet/", "wallet/"];
    for (const p of candidates) {
      const r = await cheapGet(p);
      if (r.ok) {
        return bot.sendMessage(chatId, `Balance: ${JSON.stringify(r.data)}`);
      }
    }
    bot.sendMessage(chatId, "Unable to fetch balance (endpoint not found or key restricted).");
  });

  // handle inline callback queries (menu buttons)
  bot.on("callback_query", async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const msgId = callbackQuery.message.message_id;

    // show submenus / prompt for input via reply message
    if (data === "svc_airtime") {
      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(chatId, "Send airtime in format:\n`airtime <amount> <phone>`\nExample: `airtime 500 08012345678`", { parse_mode: "Markdown" });
      return;
    }
    if (data === "svc_data") {
      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(chatId, "Send data in format:\n`data <plan_id> <phone>`\nExample: `data 34 08012345678`", { parse_mode: "Markdown" });
      return;
    }
    if (data === "svc_cable") {
      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(chatId, "Send cable purchase in format:\n`cable <plan_id> <iuc_or_card_no> <phone>`");
      return;
    }
    if (data === "svc_electricity") {
      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.sendMessage(chatId, "Send electricity in format:\n`electricity <disco_id> <meter_number> <amount> <phone>`");
      return;
    }
    if (data === "svc_plans") {
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.emit("text", { chat: { id: chatId }, text: "/plans" }); // re-use /plans handler
    }
    if (data === "svc_balance") {
      await bot.answerCallbackQuery(callbackQuery.id);
      return bot.emit("text", { chat: { id: chatId }, text: "/balance" });
    }

    // fallback
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Unknown action" });
  });

  // generic message listener for typed commands
  bot.on("message", async (msg) => {
    // ignore non-text
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // quick helpers to parse
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    // ---------- AIRTIME ----------
    if (cmd === "airtime") {
      if (parts.length < 3) {
        return bot.sendMessage(chatId, "Format: `airtime <amount> <phone>`", { parse_mode: "Markdown" });
      }
      const amountRaw = Number(parts[1]);
      const phone = parts[2];
      if (Number.isNaN(amountRaw) || amountRaw <= 0) return bot.sendMessage(chatId, "Invalid amount.");
      const customerPrice = amountRaw + PROFIT_AIRTIME;

      // ask confirmation with inline buttons
      const kb = {
        inline_keyboard: [
          [{ text: `Confirm — Pay ₦${customerPrice}`, callback_data: `confirm_air|${amountRaw}|${phone}` }],
          [{ text: "Cancel", callback_data: "cancel" }],
        ],
      };
      return bot.sendMessage(chatId, `You will charge customer ₦${customerPrice} (profit ₦${PROFIT_AIRTIME}). Confirm?`, { reply_markup: kb });
    }

    // ---------- DATA ----------
    if (cmd === "data") {
      if (parts.length < 3) return bot.sendMessage(chatId, "Format: `data <plan_id> <phone>`");
      const plan_id = parts[1];
      const phone = parts[2];
      const kb = {
        inline_keyboard: [
          [{ text: `Confirm purchase`, callback_data: `confirm_data|${plan_id}|${phone}` }],
          [{ text: "Cancel", callback_data: "cancel" }],
        ],
      };
      return bot.sendMessage(chatId, `Confirm data purchase: plan ${plan_id} for ${phone}?`, { reply_markup: kb });
    }

    // ---------- CABLE ----------
    if (cmd === "cable") {
      if (parts.length < 4) return bot.sendMessage(chatId, "Format: `cable <plan_id> <iuc> <phone>`");
      const plan_id = parts[1], iuc = parts[2], phone = parts[3];
      const kb = { inline_keyboard: [[{ text: "Confirm cable", callback_data: `confirm_cable|${plan_id}|${iuc}|${phone}` }, { text: "Cancel", callback_data: "cancel" }]] };
      return bot.sendMessage(chatId, `Confirm cable purchase: plan ${plan_id}, IUC ${iuc} for ${phone}?`, { reply_markup: kb });
    }

    // ---------- ELECTRICITY ----------
    if (cmd === "electricity") {
      if (parts.length < 5) return bot.sendMessage(chatId, "Format: `electricity <disco_id> <meter_no> <amount> <phone>`");
      const disco_id = parts[1], meter = parts[2], amt = Number(parts[3]), phone = parts[4];
      if (Number.isNaN(amt) || amt <= 0) return bot.sendMessage(chatId, "Invalid amount.");
      const customerPrice = amt + PROFIT_ELECT;
      const kb = { inline_keyboard: [[{ text: `Confirm — Pay ₦${customerPrice}`, callback_data: `confirm_elec|${disco_id}|${meter}|${amt}|${phone}` }, { text: "Cancel", callback_data: "cancel" }]] };
      return bot.sendMessage(chatId, `You will charge customer ₦${customerPrice} (profit ₦${PROFIT_ELECT}). Confirm?`, { reply_markup: kb });
    }

    // ignore other messages (we already handle /start and /plans above)
  });

  // handle confirmations via callback_data
  bot.on("callback_query", async (q) => {
    const data = q.data;
    const chatId = q.message.chat.id;
    await bot.answerCallbackQuery(q.id).catch(() => {});
    if (data === "cancel") {
      return bot.sendMessage(chatId, "Operation cancelled.");
    }

    // confirm airtime
    if (data.startsWith("confirm_air|")) {
      try {
        const [, amountRaw, phone] = data.split("|");
        const amount = Number(amountRaw);
        // call API
        const apiRes = await cheapPost("resellers/airtime/purchase/", { provider_id: 1, phone_number: phone, amount });
        if (apiRes.ok) {
          await bot.sendMessage(chatId, `✅ Airtime successful:\n${JSON.stringify(apiRes.data)}`);
          await notifyAdmin(`Airtime: ₦${amount} to ${phone}\nResult: ${JSON.stringify(apiRes.data)}`);
        } else {
          await bot.sendMessage(chatId, `❌ Airtime failed: ${JSON.stringify(apiRes.error)}`);
        }
      } catch (e) {
        await bot.sendMessage(chatId, `Error: ${e.message || e}`);
      }
      return;
    }

    // confirm data
    if (data.startsWith("confirm_data|")) {
      try {
        const [, plan_id, phone] = data.split("|");
        const apiRes = await cheapPost("resellers/data/purchase/", { bundle_id: plan_id, phone_number: phone });
        if (apiRes.ok) {
          await bot.sendMessage(chatId, `✅ Data successful:\n${JSON.stringify(apiRes.data)}`);
          await notifyAdmin(`Data: plan ${plan_id} to ${phone}\nResult: ${JSON.stringify(apiRes.data)}`);
        } else {
          await bot.sendMessage(chatId, `❌ Data failed: ${JSON.stringify(apiRes.error)}`);
        }
      } catch (e) {
        await bot.sendMessage(chatId, `Error: ${e.message || e}`);
      }
      return;
    }

    // confirm cable
    if (data.startsWith("confirm_cable|")) {
      try {
        const [, plan_id, iuc, phone] = data.split("|");
        const apiRes = await cheapPost("resellers/cable/purchase/", { plan_id, cardnumber: iuc, phone });
        if (apiRes.ok) {
          await bot.sendMessage(chatId, `✅ Cable successful:\n${JSON.stringify(apiRes.data)}`);
          await notifyAdmin(`Cable: plan ${plan_id}, iuc ${iuc} to ${phone}\nResult: ${JSON.stringify(apiRes.data)}`);
        } else {
          await bot.sendMessage(chatId, `❌ Cable failed: ${JSON.stringify(apiRes.error)}`);
        }
      } catch (e) {
        await bot.sendMessage(chatId, `Error: ${e.message || e}`);
      }
      return;
    }

    // confirm electricity
    if (data.startsWith("confirm_elec|")) {
      try {
        const [, disco_id, meter, amtRaw, phone] = data.split("|");
        const amt = Number(amtRaw);
        const apiRes = await cheapPost("resellers/electricity/purchase/", { disco_id: Number(disco_id), meter_number: meter, amount: amt, phone, meter_type: "prepaid" });
        if (apiRes.ok) {
          await bot.sendMessage(chatId, `✅ Electricity successful:\n${JSON.stringify(apiRes.data)}`);
          await notifyAdmin(`Electricity: ₦${amt} to meter ${meter}\nResult: ${JSON.stringify(apiRes.data)}`);
        } else {
          await bot.sendMessage(chatId, `❌ Electricity failed: ${JSON.stringify(apiRes.error)}`);
        }
      } catch (e) {
        await bot.sendMessage(chatId, `Error: ${e.message || e}`);
      }
      return;
    }
  });
}

// -------------------- Express endpoints (same flows) --------------------

// Health / home
app.get("/", (req, res) => res.send("PDataHub Bot API is active"));

// Airtime POST
app.post("/airtime", async (req, res) => {
  try {
    const { provider_id = 1, phone_number, amount } = req.body;
    const payload = { provider_id, phone_number, amount };
    const r = await cheapPost("resellers/airtime/purchase/", payload);
    return res.json(r.ok ? r.data : { error: r.error, status: r.status || 500 });
  } catch (e) {
    return res.json({ error: e.message || e });
  }
});

// Data POST
app.post("/data", async (req, res) => {
  try {
    const { plan_id, phone_number } = req.body;
    const payload = { bundle_id: plan_id, phone_number };
    const r = await cheapPost("resellers/data/purchase/", payload);
    return res.json(r.ok ? r.data : { error: r.error, status: r.status || 500 });
  } catch (e) {
    return res.json({ error: e.message || e });
  }
});

// Cable POST
app.post("/cable", async (req, res) => {
  try {
    const { plan_id, cardnumber, phone } = req.body;
    const r = await cheapPost("resellers/cable/purchase/", { plan_id, cardnumber, phone });
    return res.json(r.ok ? r.data : { error: r.error, status: r.status || 500 });
  } catch (e) {
    return res.json({ error: e.message || e });
  }
});

// Electricity POST
app.post("/electricity", async (req, res) => {
  try {
    const { disco_id, meter_number, amount, phone } = req.body;
    const payload = { disco_id, meter_number, amount, phone, meter_type: "prepaid" };
    const r = await cheapPost("resellers/electricity/purchase/", payload);
    return res.json(r.ok ? r.data : { error: r.error, status: r.status || 500 });
  } catch (e) {
    return res.json({ error: e.message || e });
  }
});

// -------------------- start server --------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
