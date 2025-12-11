import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.BOT_TOKEN;
const url = process.env.WEBHOOK_URL;
const port = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// BOT (no polling, pure webhook)
const bot = new TelegramBot(token, { webHook: { port: port } });

// Set webhook
bot.setWebHook(`${url}/bot${token}`);

// Telegram webhook route
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.on("message", (msg) => {
  bot.sendMessage(msg.chat.id, "Bot is working on Render! 🚀");
});

// Dashboard homepage
app.get("/", (req, res) => {
  res.send("Plex Hub Bot is running ✔️");
});

app.listen(port, () => console.log("Server running on port " + port));
