const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const token = process.env.BOT_TOKEN;
const webhookURL = process.env.WEBHOOK_URL;
const port = process.env.PORT || 3000;

// Fix for __dirname in CommonJS
const __dirname = path.resolve();

// BOT (No polling)
const bot = new TelegramBot(token, { webHook: { port } });

// SET WEBHOOK
if (webhookURL) {
    bot.setWebHook(`${webhookURL}/webhook/${token}`);
    console.log("Webhook active:", `${webhookURL}/webhook/${token}`);
}

// WEBHOOK ROUTE
app.post(`/webhook/${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// ---- API for Dashboard ----
app.get("/api/stats", (req, res) => {
    res.json({
        status: "running",
        bot: "connected",
        uptime: process.uptime(),
    });
});

app.post("/api/send", async (req, res) => {
    const { chatId, text } = req.body;
    try {
        await bot.sendMessage(chatId, text);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// ---- Bot Logic ----
bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.toLowerCase() || "";

    if (text === "/start") {
        return bot.sendMessage(chatId, "Bot + dashboard is running 🚀");
    }

    bot.sendMessage(chatId, `Echo: ${msg.text}`);
});

// ---- Serve UI ----
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

// ---- Start Server ----
app.listen(port, () => {
    console.log("Server running on", port);
});
