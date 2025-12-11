import express from "express";
import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";

const TOKEN = process.env.BOT_TOKEN;
const URL = process.env.RENDER_EXTERNAL_URL;

const bot = new TelegramBot(TOKEN, { webHook: true });
bot.setWebHook(`${URL}/webhook/${TOKEN}`);

const app = express();
app.use(express.json());

// Webhook endpoint
app.post(`/webhook/${TOKEN}`, async (req, res) => {
  const update = req.body;

  if (update.message && update.message.text) {
    const chatId = update.message.chat.id;
    const userMsg = update.message.text;

    try {
      // Send the message to your API
      const response = await fetch("https://your-api.com/endpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg })
      });

      const data = await response.json();

      // Send API response back to Telegram user
      await bot.sendMessage(chatId, data.reply || "No reply from API.");
    } catch (err) {
      console.error("API error:", err);
      await bot.sendMessage(chatId, "Oops! Something went wrong with the API.");
    }
  }

  res.sendStatus(200); // Telegram requires 200 OK
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
});
