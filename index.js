/**
 * Advanced CheapDataHub Bot
 * Services: Data, Airtime, Cable, Electricity
 * Features: Wallet, transactions, small markup for profit, full data plans
 *
 * Env variables:
 * BOT_TOKEN, CDH_API_KEY, BASE_URL=https://www.cheapdatahub.ng/api/v1, WEBHOOK_URL
 */

import express from "express";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import fs from "fs";
import bodyParser from "body-parser";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CDH_API_KEY = process.env.CDH_API_KEY;
const BASE_URL = process.env.BASE_URL || "https://www.cheapdatahub.ng/api/v1";
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!BOT_TOKEN || !CDH_API_KEY || !WEBHOOK_URL) {
  console.error("Set BOT_TOKEN, CDH_API_KEY, WEBHOOK_URL env vars");
  process.exit(1);
}

/* ---------------- Express ---------------- */
const app = express();
app.use(bodyParser.json());

/* ---------------- Telegram Bot ---------------- */
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
bot.setWebHook(`${WEBHOOK_URL}/webhook/${BOT_TOKEN}`);

/* ---------------- Wallet & Transactions ---------------- */
let wallets = {};
let transactions = [];

try { wallets = JSON.parse(fs.readFileSync("wallets.json")) } catch(e) {}
try { transactions = JSON.parse(fs.readFileSync("transactions.json")) } catch(e) {}

function saveWallets() { fs.writeFileSync("wallets.json", JSON.stringify(wallets,null,2)) }
function saveTransactions() { fs.writeFileSync("transactions.json", JSON.stringify(transactions,null,2)) }

/* ---------------- CheapDataHub API ---------------- */
async function cdhPost(endpoint, body = {}) {
  try {
    const res = await axios.post(`${BASE_URL}/${endpoint}`, body, {
      headers: { Authorization: `Token ${CDH_API_KEY}`, "Content-Type": "application/json" },
      timeout: 20000
    });
    return res.data;
  } catch (err) {
    console.error("CDH Error:", err.response?.data || err.message);
    return { status: "false", message: "CDH API error" };
  }
}

/* ---------------- Plans & Providers ---------------- */
const mobileProviders = [
  { id: 1, name: "mtn" }, { id: 2, name: "glo" }, { id: 3, name: "airtel" }, { id: 4, name: "9mobile" }
];

const dataPlans = [
  { id: 13, provider: "airtel", size: "500MB", price: 495 },
  { id: 14, provider: "airtel", size: "1.5GB", price: 600 },
  { id: 15, provider: "airtel", size: "1GB", price: 790 },
  { id: 17, provider: "airtel", size: "2GB", price: 1485 },
  { id: 18, provider: "airtel", size: "3GB", price: 1999 },
  { id: 19, provider: "airtel", size: "4GB", price: 2599 },
  { id: 20, provider: "airtel", size: "8GB", price: 3100 },
  { id: 21, provider: "airtel", size: "10GB", price: 4099 },
  { id: 42, provider: "glo", size: "200MB", price: 95 },
  { id: 35, provider: "glo", size: "500MB", price: 230 },
  { id: 36, provider: "glo", size: "1GB", price: 430 },
  { id: 41, provider: "glo", size: "1GB", price: 490 },
  { id: 37, provider: "glo", size: "3GB", price: 1299 },
  { id: 38, provider: "glo", size: "5GB", price: 2199 },
  { id: 39, provider: "glo", size: "10GB", price: 4399 },
  { id: 43, provider: "mtn", size: "110MB", price: 99 },
  { id: 44, provider: "mtn", size: "500MB", price: 390 },
  { id: 45, provider: "mtn", size: "1GB", price: 455 },
  { id: 46, provider: "mtn", size: "1GB", price: 560 },
  { id: 47, provider: "mtn", size: "2GB", price: 930 },
  { id: 48, provider: "mtn", size: "2GB", price: 1199 },
  { id: 49, provider: "mtn", size: "3GB", price: 1399 },
  { id: 50, provider: "mtn", size: "5GB", price: 2099 },
  { id: 51, provider: "mtn", size: "75GB", price: 17999 }
];

const cableProviders = [
  { id: 1, name: "GOTV" }, { id: 2, name: "DSTV" }, { id: 3, name: "STARTIMES" }
];

const electricityDiscos = [
  { id: 1, name: "Abuja Electric AEDC" },
  { id: 2, name: "Eko Electric (EKEDC)" },
  { id: 3, name: "Ibadan Electric (IBEDC)" },
  { id: 4, name: "Ikeja Electric (IKEDC)" },
  { id: 5, name: "Kaduna Electric" },
  { id: 6, name: "Port Harcourt Electric" },
  { id: 7, name: "Jos Electricity Distribution PLC (JEDplc)" },
  { id: 8, name: "Enugu Electric" },
  { id: 9, name: "Yola Electric" },
  { id: 10, name: "Benin Electric" }
];

/* ---------------- Telegram Commands ---------------- */
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🔥 Welcome to Advanced CheapDataHub Bot 🔥
Wallet system enabled.
Commands:
/wallet → check balance
/fund <amount> → fund wallet
/plans → list data plans
/providers → list mobile/cable/electric providers
/airtime <phone> <provider> <amount>
/data <phone> <bundle_id>
/cable <iuc> <plan_id> <phone>
/verify <meter> <disco>
/electric <meter> <amount> <disco>
/transactions → last 10 transactions`);
});

/* ---------------- Wallet ---------------- */
bot.onText(/\/wallet/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `💰 Wallet: ₦${wallets[chatId] || 0}`);
});

bot.onText(/\/fund (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const amount = Number(match[1]);
  if (!amount || amount <= 0) return bot.sendMessage(chatId, "Enter valid amount.");
  wallets[chatId] = (wallets[chatId] || 0) + amount;
  saveWallets();
  bot.sendMessage(chatId, `✅ Wallet funded: ₦${amount}\nBalance: ₦${wallets[chatId]}`);
});

bot.onText(/\/transactions/, (msg) => {
  const chatId = msg.chat.id;
  const userTx = transactions.filter(t => t.user==chatId).slice(-10).reverse();
  if (!userTx.length) return bot.sendMessage(chatId,"No transactions yet.");
  const text = userTx.map(t=>`#${t.id} | ${t.service} | ₦${t.amount} | ${t.status}`).join("\n");
  bot.sendMessage(chatId, `📜 Last transactions:\n${text}`);
});

/* ---------------- Plans & Providers ---------------- */
bot.onText(/\/plans/, (msg) => {
  const chatId = msg.chat.id;
  const text = dataPlans.map(p=>`${p.id} | ${p.provider} | ${p.size} | ₦${p.price}`).join("\n");
  bot.sendMessage(chatId, `📶 Data Plans:\n${text}`);
});

bot.onText(/\/providers/, (msg) => {
  const chatId = msg.chat.id;
  const text = `Mobile: ${mobileProviders.map(p=>p.name).join(", ")}\nCable: ${cableProviders.map(p=>p.name).join(", ")}\nElectric: ${electricityDiscos.map(p=>p.name).join(", ")}`;
  bot.sendMessage(chatId, text);
});

/* ---------------- Airtime ---------------- */
bot.onText(/\/airtime (.+) (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const phone = match[1]; const provider = match[2].toLowerCase(); let amount = Number(match[3]);
  if (!phone || !provider || !amount) return bot.sendMessage(chatId,"Invalid command");

  const markup = 50; const sellingPrice = amount + markup;
  if ((wallets[chatId]||0) < sellingPrice) return bot.sendMessage(chatId,`❌ Insufficient balance. Need ₦${sellingPrice}`);

  const provider_id = mobileProviders.find(p=>p.name==provider)?.id || 1;
  const res = await cdhPost("resellers/airtime/purchase/", { provider_id, phone_number: phone, amount });

  wallets[chatId]-=sellingPrice; saveWallets();
  const tx={id:Date.now(),user:chatId,service:"airtime",amount:sellingPrice,status:res.message};
  transactions.push(tx); saveTransactions();

  bot.sendMessage(chatId,`💸 Airtime purchased!\nAPI: ${res.message}\nCharged: ₦${sellingPrice}\nBalance: ₦${wallets[chatId]}`);
});

/* ---------------- Data ---------------- */
bot.onText(/\/data (.+) (.+)/, async (msg, match) => {
  const chatId=msg.chat.id; const phone=match[1]; const bundle_id=Number(match[2]);
  const plan = dataPlans.find(p=>p.id==bundle_id); if(!plan) return bot.sendMessage(chatId,"Plan not found");

  const markup = 50; const sellingPrice=plan.price+markup;
  if((wallets[chatId]||0)<sellingPrice) return bot.sendMessage(chatId,`❌ Insufficient balance. Need ₦${sellingPrice}`);

  const res = await cdhPost("resellers/data/purchase/", { bundle_id, phone_number: phone });

  wallets[chatId]-=sellingPrice; saveWallets();
  const tx={id:Date.now(),user:chatId,service:"data",amount:sellingPrice,status:res.message};
  transactions.push(tx); saveTransactions();

  bot.sendMessage(chatId,`💸 Data purchased!\nAPI: ${res.message}\nCharged: ₦${sellingPrice}\nBalance: ₦${wallets[chatId]}`);
});

/* ---------------- Cable ---------------- */
bot.onText(/\/cable (.+) (.+) (.+)/, async (msg, match)=>{
  const chatId=msg.chat.id; const iuc=match[1]; const plan_id=match[2]; const phone=match[3];
  const markup=100; const sellingPrice=1000+markup; // Example, adjust later
  if((wallets[chatId]||0)<sellingPrice) return bot.sendMessage(chatId,`❌ Insufficient balance`);

  const res=await cdhPost("resellers/cable/purchase/",{plan_id,cardnumber:iuc,phone});
  wallets[chatId]-=sellingPrice; saveWallets();
  const tx={id:Date.now(),user:chatId,service:"cable",amount:sellingPrice,status:res.message};
  transactions.push(tx); saveTransactions();
  bot.sendMessage(chatId,`💸 Cable purchased!\nAPI: ${res.message}\nCharged: ₦${sellingPrice}\nBalance: ₦${wallets[chatId]}`);
});

/* ---------------- Electricity ---------------- */
bot.onText(/\/verify (.+) (.+)/, async (msg, match)=>{
  const chatId=msg.chat.id; const meter=match[1]; const disco=match[2];
  const res=await cdhPost("resellers/electricity/verify/",{meter,disco});
  bot.sendMessage(chatId,`Meter verify: ${res.message}`);
});

bot.onText(/\/electric (.+) (.+) (.+)/, async (msg, match)=>{
  const chatId=msg.chat.id; const meter=match[1]; const amount=Number(match[2]); const disco=match[3];
  const markup=50; const sellingPrice=amount+markup;
  if((wallets[chatId]||0)<sellingPrice) return bot.sendMessage(chatId,`❌ Insufficient balance. Need ₦${sellingPrice}`);
  const res=await cdhPost("resellers/electricity/purchase/",{meter,amount,disco});
  wallets[chatId]-=sellingPrice; saveWallets();
  const tx={id:Date.now(),user:chatId,service:"electricity",amount:sellingPrice,status:res.message};
  transactions.push(tx); saveTransactions();
  bot.sendMessage(chatId,`💸 Electricity purchased!\nAPI: ${res.message}\nCharged: ₦${sellingPrice}\nBalance: ₦${wallets[chatId]}`);
});

/* ---------------- Webhook ---------------- */
app.post(`/webhook/${BOT_TOKEN}`,(req,res)=>{bot.processUpdate(req.body);res.sendStatus(200);});
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`Bot running on port ${PORT}`));
