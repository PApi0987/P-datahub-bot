// ------------------------------------------------------
// IMPORTS
// ------------------------------------------------------
import express from "express";
import axios from "axios";
import TelegramBot from "node-telegram-bot-api";
import path from "path";
import { fileURLToPath } from "url";

// ------------------------------------------------------
// FILE PATH SETUP (required for public folder)
// ------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------------------------------
// EXPRESS SETUP
// ------------------------------------------------------
const app = express();
app.use(express.json());

// Serve frontend website
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------
// API CONFIG
// ------------------------------------------------------
const API_BASE = "https://www.cheapdatahub.ng/api/v1/";
const API_KEY = process.env.CHEAPDATA_API_KEY;   // your secret key

// ------------------------------------------------------
// TELEGRAM BOT SETUP
// ------------------------------------------------------
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

let bot = null;
if (TELEGRAM_TOKEN) {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.toLowerCase();

    if (text === "/start") {
      bot.sendMessage(
        chatId,
        "Welcome to *Plex-Hub Bot* 🎉\n\nUse commands:\n" +
        "`airtime amount phone`\n" +
        "Example: `airtime 500 09012345678`",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Airtime command
    if (text.startsWith("airtime")) {
      try {
        const parts = text.split(" ");
        const amount = parseInt(parts[1]);
        const phone = parts[2];

        const response = await axios.post(
          API_BASE + "resellers/airtime/purchase/",
          {
            provider_id: 1,
            phone_number: phone,
            amount: amount + 40, // gain
          },
          {
            headers: {
              Authorization: `Token ${API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        bot.sendMessage(chatId, "Airtime Response:\n" + JSON.stringify(response.data, null, 2));
      } catch (err) {
        bot.sendMessage(chatId, "Error: " + err.message);
      }
    }
  });
}

// ------------------------------------------------------
// ROUTES (API ENDPOINTS)
// ------------------------------------------------------

// Home route
app.get("/", (req, res) => {
  res.send("Plex-Hub bot is active");
});

// Airtime purchase
app.post("/airtime", async (req, res) => {
  try {
    let { provider_id, phone_number, amount } = req.body;

    amount = amount + 40; // gain

    const response = await axios.post(
      API_BASE + "resellers/airtime/purchase/",
      { provider_id, phone_number, amount },
      {
        headers: {
          Authorization: `Token ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// Cable subscription
app.post("/cable", async (req, res) => {
  try {
    let { plan_id, cardnumber, phone } = req.body;

    const response = await axios.post(
      API_BASE + "resellers/cable/purchase/",
      { plan_id, cardnumber, phone },
      {
        headers: {
          Authorization: `Token ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// Electricity purchase
app.post("/electricity", async (req, res) => {
  try {
    let { disco_id, meter_number, amount } = req.body;

    amount = amount + 300; // gain

    const response = await axios.post(
      API_BASE + "resellers/electricity/purchase/",
      { disco_id, meter_number, amount },
      {
        headers: {
          Authorization: `Token ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ------------------------------------------------------
// SERVER START
// ------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
