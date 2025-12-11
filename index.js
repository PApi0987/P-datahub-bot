import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const API_BASE = "https://www.cheapdatahub.ng/api/v1/";
const API_KEY = "a4f6861f372802c679d43631b73a2bcef4e06f8e";

// Home route
app.get("/", (req, res) => {
  res.send("Plex-Hub bot is active");
});

// Airtime purchase
app.post("/airtime", async (req, res) => {
  try {
    let { provider_id, phone_number, amount } = req.body;

    amount = amount + 40;

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

// Electricity
app.post("/electricity", async (req, res) => {
  try {
    let { disco_id, meter_number, amount } = req.body;

    amount = amount + 300;

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

// Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
