import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const token = process.env.BOT_TOKEN;
const url = process.env.WEBHOOK_URL;
const port = process.env.PORT || 3000;

// Telegram bot (do NOT bind a port!)
const bot = new TelegramBot(token, { webHook: true });

// Set webhook
bot.setWebHook(`${url}/bot${token}`);

// Handle Telegram updates
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Bot logic
bot.on("message", (msg) => {
  bot.sendMessage(msg.chat.id, "Bot is running on Render! 🚀");
});

// Root page
app.get("/", (req, res) => {
  res.send("Plex Hub Bot is LIVE ✔️");
});

// Start Express server only ONCE
app.listen(port, () => {
  console.log("Server running on port " + port);
});
