const { cmd } = require("../command");

cmd(
  {
    pattern: "save",
    react: "🤖",
    desc: "Save contact, send vCard + Catbox image + long fancy cute message",
    category: "main",
    filename: __filename,
    fromMe: false,
  },
  async (malvin, mek, m, { reply }) => {
    try {
      const from = mek.key.remoteJid;
      await malvin.sendPresenceUpdate("recording", from);

      let senderName = mek.pushName || (m && m.pushName) || "";
      const displayName = senderName ? `${senderName} neno xmd 🩵` : "neno xmd 🩵";
      let phone = from.split("@")[0];

      // 1️⃣ Send vCard
      const vcard =
        "BEGIN:VCARD\n" +
        "VERSION:3.0\n" +
        `FN:${displayName}\n` +
        `TEL;TYPE=CELL:${phone}\n` +
        `NOTE:Saved via NENO XMD\n` +
        "END:VCARD";

      await malvin.sendMessage(
        from,
        { contacts: { displayName, contacts: [{ vcard }] } },
        { quoted: mek }
      );

      // 2️⃣ Send Catbox image
      await malvin.sendMessage(
        from,
        {
          image: { url: "https://files.catbox.moe/en1jzg.jpg" },
          caption: `🌸 Hi ${senderName || ""}! 🌟\nSaved as *${displayName}* 🩵✨`
        },
        { quoted: mek }
      );

      // 3️⃣ Send long fancy cute message
      const fancyMessage = `✨💖 Hɛʟʟօ ${senderName || ""}! 🌸  
I sᴀᴠᴇᴅ ʏᴏᴜ ɴᴏᴡ 🩵✨  
You sᴀᴠᴇ ᴍᴇ ᴛᴏᴏ? 😝💫  
Welcome to ɴᴇɴᴏ xᴍᴅ family 🌟🎀  
Wishing you lots of smiles 😊, fun 🎉, love ❤️, sparkles ✨, hugs 🤗, and endless happiness 🌸🩵  
Stay cute and amazing forever 💖🌟`;

      await malvin.sendMessage(
        from,
        { text: fancyMessage },
        { quoted: mek }
      );

    } catch (e) {
      console.error("❌ Error in .save command:", e);
      reply("❌ Error while creating/sending contact and image!");
    }
  }
);
