const moment = require("moment-timezone");
const config = require('../config');
const { cmd, commands } = require('../command');

const delay = ms => new Promise(res => setTimeout(res, ms));

cmd({
  pattern: "ping",
  desc: "Check bot's response time.",
  category: "main",
  react: "🍂",
  filename: __filename
},
async (conn, mek, m, { from, reply }) => {
  try {
    const loadingSteps = [
      "⚡️ 10%",
      "⚡️ 30%",
      "⚡️ 50%",
      "⚡️ 80%",
      "🔭 100%",
      "🔭 ANDROMEDA INITIALIZING..."
    ];

    let msg = await conn.sendMessage(from, { text: "🔁" }, { quoted: mek });

    for (let i = 0; i < loadingSteps.length; i++) {
      await delay(250); // plus rapide mais fluide
      await conn.sendMessage(from, {
        text: loadingSteps[i],
        edit: msg.key
      });
    }

    const startTime = Date.now();
    await delay(200);
    const endTime = Date.now();
    const ping = endTime - startTime;

    await delay(300); // petite pause pour l'effet
    await conn.sendMessage(from, {
      text: `
╭━━ *📡 SPEED LOGS: ━━
┃ ⚙️ *Bot* : *NENO ZED*
┃ ⚡ *Ping* : ${ping} ms
┃ ⏱️ *Checked at* : ${moment().format("HH:mm:ss")}
╰━━━━━━━━━━━━━━━━━━━
`.trim(),
      edit: msg.key
    });

  } catch (e) {
    console.error("Erreur Ping:", e);
    await reply("❌ Une erreur est survenue lors du test.");
  }
});
