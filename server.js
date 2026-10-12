require("dotenv").config();

console.log("Key length:", (process.env.GEMINI_API_KEY || "").length);
const express = require("express");
const path = require("path");

const Config = {
  ApiKey: process.env.GEMINI_API_KEY,
  Model: "gemini-3.6-flash",
  Port: process.env.PORT || 3000,
  MaxRetries: 8,
  RetryDelayMs: 2000
};

const App = express();
App.use(express.json({ limit: "15mb" }));
App.use(express.static(__dirname));

const Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

App.post("/api/analyze", async (req, res) => {
  const { prompt, imageBase64, mimeType } = req.body;

  if (!Config.ApiKey) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY in .env" });
  }

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]
      }
    ],
    generationConfig: { responseMimeType: "application/json" }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${Config.Model}:generateContent?key=${Config.ApiKey}`;

  for (let attempt = 1; attempt <= Config.MaxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      const Busy = response.status === 429 || response.status === 503;
      if (Busy && attempt < Config.MaxRetries) {
        console.log(`Model busy (${response.status}), retry ${attempt}/${Config.MaxRetries}`);
        await Sleep(Config.RetryDelayMs * attempt);
        continue;
      }

      if (!response.ok) console.log("Gemini error:", JSON.stringify(data, null, 2));
      return res.status(response.status).json(data);
    } catch (error) {
      console.error(error);
      if (attempt === Config.MaxRetries) {
        return res.status(500).json({ error: "Server failed to reach Gemini" });
      }
      await Sleep(Config.RetryDelayMs * attempt);
    }
  }
});

App.listen(Config.Port, () => {
  console.log(`Fridge Helper running at http://localhost:${Config.Port}`);
});