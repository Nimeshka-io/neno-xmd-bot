const { cmd } = require("../command");

cmd(
  {
    pattern: "vv",
    react: "👀",
    desc: "Reply to a view-once image or video to resend it",
    category: "fun",
    filename: __filename,
    fromMe: false,
  },
  async (malvin, mek, m, { reply }) => {
    try {
      const from = mek.key.remoteJid;

      // Must reply to a message
      if (!m.quoted) return reply("❌ Reply to a view-once image or video with `.vv`!");

      const quotedMsg = m.quoted.message;

      // Check if it's a view-once image or video
      let type = null;
      if (quotedMsg?.imageMessage?.viewOnce) type = "image";
      else if (quotedMsg?.videoMessage?.viewOnce) type = "video";

      if (!type) return reply("❌ This is not a view-once image or video!");

      // Download the media
      const buffer = await malvin.downloadMediaMessage(m.quoted);

      // Send it back with a cute caption
      await malvin.sendMessage(
        from,
        {
          [type]: buffer,
          caption: `👀 Look! I saved your view-once ${type}! 🌸🩵✨`,
          mimetype: type === "video" ? "video/mp4" : undefined,
        },
        { quoted: mek }
      );

    } catch (e) {
      console.error("❌ Error in .vv view-once plugin:", e);
      reply("❌ Failed to resend the view-once media!");
    }
  }
);
