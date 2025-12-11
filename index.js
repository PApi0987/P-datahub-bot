import express from "express";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// === BOT (Polling Mode - No Webhook Needed) ===
const token = process.env.BOT_TOKEN;

if (!token) {
    console.error("❌ BOT_TOKEN is missing!");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

bot.on("message", (msg) => {
    bot.sendMessage(msg.chat.id, "Bot is active 24/7 on Render 🚀");
});

// API test
app.get("/", (req, res) => {
    res.send("Bot is running with polling ✔");
});

// Start server
app.listen(port, () => {
    console.log("Server started on port", port);
});
