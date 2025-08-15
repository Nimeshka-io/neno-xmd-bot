const { cmd } = require("../command");

cmd(
  {
    pattern: "vvv",
    react: "👀",
    desc: "Reply to a view-once or normal image/video to resend it",
    category: "fun",
    filename: __filename,
    fromMe: false,
  },
  async (malvin, mek, m, { reply }) => {
    try {
      const from = mek.key.remoteJid;

      // Must reply to a message
      if (!m.quoted) return reply("❌ Reply to an image or video with `.vv`!");

      const quotedMsg = m.quoted.message;

      let type = null;

      // Check if it's image or video (view-once or normal)
      if (quotedMsg?.imageMessage) type = "image";
      else if (quotedMsg?.videoMessage) type = "video";

      if (!type) return reply("❌ This is not an image or video!");

      // Download the media
      const buffer = await malvin.downloadMediaMessage(m.quoted);

      // Send it back with a cute caption
      await malvin.sendMessage(
        from,
        {
          [type]: buffer,
          caption: `👀 Look! I saved your ${type}! 🌸🩵✨`,
          mimetype: type === "video" ? "video/mp4" : undefined,
        },
        { quoted: mek }
      );

    } catch (e) {
      console.error("❌ Error in .vv plugin:", e);
      reply("❌ Failed to resend the media!");
    }
  }
);
