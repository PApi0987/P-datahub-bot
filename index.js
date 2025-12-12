import express from "express";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const API_KEY = process.env.CDH_API_KEY;
const BASE_URL = process.env.BASE_URL;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const bot = new TelegramBot(TOKEN, { webHook: true });
bot.setWebHook(`${WEBHOOK_URL}/webhook/${TOKEN}`);

const app = express();
app.use(express.json());

// ================= CHEAPDATAHUB API FUNCTION ================= //
async function cheapDataHub(endpoint, body = {}) {
    try {
        const res = await axios.post(
            `${BASE_URL}/${endpoint}`,
            body,
            {
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );
        return res.data;
    } catch (err) {
        console.log(err.response?.data || err);
        return { status: "error", message: "API request failed" };
    }
}

// ==================== TELEGRAM COMMANDS ==================== //

// Start command
bot.onText(/\/start/, msg => {
    bot.sendMessage(
        msg.chat.id,
        `🔥 *Welcome to CheapDataHub Bot*  
Services Available:
- Airtime Topup  
- Data  
- Cable (DSTV / GOTV)  
- Electricity  
- Meter verification  

Use:
/airtime  
/data  
/cable  
/electric  
`,
        { parse_mode: "Markdown" }
    );
});

/* ---------------- Airtime ---------------- */
/*
Command: /airtime 08123456789 500 mtn
*/
bot.onText(/\/airtime (.+) (.+) (.+)/, async (msg, match) => {
    const phone = match[1];
    const amount = match[2];
    const network = match[3]; // mtn, glo, airtel, 9mobile

    const response = await cheapDataHub("airtime/purchase", {
        network,
        amount,
        phone
    });

    bot.sendMessage(msg.chat.id, `Airtime: ${response.message}`);
});

/* ---------------- Data ---------------- */
/*
Command: /data 08123456789 mtn-1gb
*/
bot.onText(/\/data (.+) (.+)/, async (msg, match) => {
    const phone = match[1];
    const plan = match[2]; // example: mtn-1gb

    const response = await cheapDataHub("data/purchase", {
        plan,
        phone
    });

    bot.sendMessage(msg.chat.id, `Data: ${response.message}`);
});

/* ---------------- Cable ---------------- */
/*
Verify IUC number:
Command: /iuc 1234567890
*/
bot.onText(/\/iuc (.+)/, async (msg, match) => {
    const iuc = match[1];

    const response = await cheapDataHub("cable/verify", { iuc });

    bot.sendMessage(msg.chat.id, `Verification: ${response.message}`);
});

/*
Purchase cable:
Command: /cable 1234567890 gotv-max 1000
*/
bot.onText(/\/cable (.+) (.+) (.+)/, async (msg, match) => {
    const iuc = match[1];
    const plan = match[2];
    const amount = match[3];

    const response = await cheapDataHub("cable/purchase", {
        iuc,
        plan,
        amount
    });

    bot.sendMessage(msg.chat.id, `Cable: ${response.message}`);
});

/* ---------------- Electricity ---------------- */
/*
Verify meter:
Command: /verify 12345678901 phed
*/
bot.onText(/\/verify (.+) (.+)/, async (msg, match) => {
    const meter = match[1];
    const disco = match[2];

    const response = await cheapDataHub("electricity/verify", {
        meter,
        disco
    });

    bot.sendMessage(msg.chat.id, `Meter Verification: ${response.message}`);
});

/*
Buy token:
Command: /electric 12345678901 2000 phed
*/
bot.onText(/\/electric (.+) (.+) (.+)/, async (msg, match) => {
    const meter = match[1];
    const amount = match[2];
    const disco = match[3];

    const response = await cheapDataHub("electricity/purchase", {
        meter,
        amount,
        disco
    });

    bot.sendMessage(msg.chat.id, `Electricity: ${response.message}`);
});

// Webhook listener
app.post(`/webhook/${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Render port handler
app.listen(3000, () => console.log("Bot running..."));
