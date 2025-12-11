import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import TelegramBot from "node-telegram-bot-api";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static("public")); // serve UI files

const token = process.env.BOT_TOKEN;
const webhookURL = process.env.WEBHOOK_URL;
const port = process.env.PORT || 3000;

// BOT (No polling)
const bot = new TelegramBot(token, { webHook: { port } });

// Set webhook automatically
if (webhookURL) {
    bot.setWebHook(`${webhookURL}/webhook/${token}`);
    console.log("Webhook active:", `${webhookURL}/webhook/${token}`);
}

// Webhook route
app.post(`/webhook/${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// ------ Backend API for Dashboard ------

// Example GET API: Bot stats
app.get("/api/stats", (req, res) => {
    res.json({
        status: "running",
        bot: "connected",
        uptime: process.uptime(),
    });
});

// Example POST API: Send message to a user
app.post("/api/send", async (req, res) => {
    const { chatId, text } = req.body;
    try {
        await bot.sendMessage(chatId, text);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ------ Telegram Bot Logic ------
bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.toLowerCase() || "";

    if (text === "/start") {
        return bot.sendMessage(chatId, "Welcome! The bot + dashboard is running! 🚀");
    }

    bot.sendMessage(chatId, `Echo: ${msg.text}`);
});

// ------ Serve dashboard UI ------
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

// Start server
app.listen(port, () => {
    console.log("Server running on:", port);
});
