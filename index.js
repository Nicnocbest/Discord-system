require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on("ready", () => {
  console.log("Bot ist online");
});

// ---------- OAUTH ----------

app.get("/", (req, res) => {
  const authUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${process.env.REDIRECT_URI}&scope=identify%20guilds.join`;
  res.send(`<a href="${authUrl}">Login with Discord</a>`);
});

app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;

    const tokenRes = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.REDIRECT_URI
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token } = tokenRes.data;

    const userRes = await axios.get(
      "https://discord.com/api/users/@me",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    let users = [];
    if (fs.existsSync("users.json")) {
      users = JSON.parse(fs.readFileSync("users.json"));
    }

    if (!users.find(u => u.id === userRes.data.id)) {
      users.push({
        id: userRes.data.id,
        access_token
      });
      fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
    }

    res.send("Du bist registriert!");
  } catch (err) {
    console.log(err.response?.data || err.message);
    res.send("Fehler bei Auth");
  }
});

// ---------- DJOIN ----------

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!djoin")) return;

  const args = message.content.split(" ");
  const guildId = args[1];
  if (!guildId) return message.reply("Guild ID fehlt.");

  const users = JSON.parse(fs.readFileSync("users.json"));

  for (const user of users) {
    try {
      await axios.put(
        `https://discord.com/api/guilds/${guildId}/members/${user.id}`,
        { access_token: user.access_token },
        {
          headers: {
            Authorization: `Bot ${process.env.BOT_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
    } catch (err) {
      console.log("JOIN ERROR:");
      console.log(err.response?.data || err.message);
    }
  }

  message.reply("Join Versuch abgeschlossen.");
});

client.login(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server läuft"));
