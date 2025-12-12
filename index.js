import express from "express";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const API_KEY = process.env.CHEAPDATAHUB_API_KEY;
const BASE_URL = process.env.BASE_URL;

const bot = new TelegramBot(TOKEN, { webHook: true });

bot.setWebHook(`${WEBHOOK_URL}/webhook/${TOKEN}`);

const app = express();
app.use(express.json());

// ========= CHEAPDATAHUB API WRAPPER ========= //
async function apiRequest(endpoint, data = {}) {
    try {
        const res = await axios.post(
            `${BASE_URL}/${endpoint}`,
            data,
            {
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );
        return res.data;
    } catch (err) {
        console.log(err.response?.data || err);
        return { status: "error", message: "API error" };
    }
}

// ========== TELEGRAM BOT COMMANDS ========== //
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `🔥 *Welcome to Cheap Services Bot*  
You can buy:
- Airtime
- Data
- Cable TV (GOTV/DSTV)
- Electricity

Use the menu to continue.`,
        { parse_mode: "Markdown" }
    );
});

// Airtime
bot.onText(/\/airtime (.+) (.+)/, async (msg, match) => {
    const phone = match[1];
    const amount = match[2];

    const result = await apiRequest("airtime", {
        network: "MTN",
        amount,
        phone
    });

    bot.sendMessage(msg.chat.id, `Airtime Status: ${result.message}`);
});

// Data (Example: /data 08123456789 mtn-1gb)
bot.onText(/\/data (.+) (.+)/, async (msg, match) => {
    const phone = match[1];
    const plan = match[2];

    const result = await apiRequest("data", {
        plan,
        phone
    });

    bot.sendMessage(msg.chat.id, `Data status: ${result.message}`);
});

// Electricity
bot.onText(/\/electric (.+) (.+)/, async (msg, match) => {
    const meter = match[1];
    const amount = match[2];

    const result = await apiRequest("electricity", {
        meter,
        amount,
        disco: "PHED"
    });

    bot.sendMessage(msg.chat.id, `Electricity Status: ${result.message}`);
});

// Webhook route
app.post(`/webhook/${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Render port
app.listen(3000, () => console.log("Bot running on Render"));
