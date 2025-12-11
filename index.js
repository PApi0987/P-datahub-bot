import express from "express";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const URL = process.env.RENDER_EXTERNAL_URL;  // Render automatically provides this
const PORT = process.env.PORT || 3000;

// SAFETY CHECK
if (!TOKEN) {
    console.error("❌ BOT_TOKEN missing in Render environment!");
    process.exit(1);
}
if (!URL) {
    console.error("❌ RENDER_EXTERNAL_URL missing! Add it in Render Env Variables");
    process.exit(1);
}

// ---------------------- INIT BOT -----------------------
const bot = new TelegramBot(TOKEN, { webHook: true });

// Set webhook to Render URL
const webhookPath = `/webhook/${TOKEN}`;
const webhookURL = `${URL}${webhookPath}`;

await bot.setWebHook(webhookURL);
console.log("✅ Webhook set:", webhookURL);

// ---------------------- EXPRESS ------------------------
const app = express();
app.use(express.json());

// Telegram sends updates here
app.post(webhookPath, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// ---------------------- BOT COMMANDS --------------------
bot.on("message", (msg) => {
    const chatId = msg.chat.id;

    // Example reply
    bot.sendMessage(chatId, "🚀 Your bot is LIVE on Render using WEBHOOK!");
});

// ---------------------- ROOT URL ------------------------
app.get("/", (req, res) => {
    res.send("🚀 Telegram Bot Running — Webhook Active!");
});

// ---------------------- START SERVER --------------------
app.listen(PORT, () => {
    console.log(`🌍 Server running on port ${PORT}`);
});
