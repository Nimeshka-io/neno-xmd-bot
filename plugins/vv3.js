const { cmd } = require("../command");

cmd(
  {
    pattern: "vv",
    react: "👀",
    desc: "Reply to a view-once image/video to resend it (getdp style)",
    category: "fun",
    filename: __filename,
    fromMe: false,
  },
  async (malvin, mek, m, { reply }) => {
    try {
      const from = mek.key.remoteJid;

      // Must reply to something
      if (!m.quoted || !m.quoted.message) {
        return reply("🍁 *Please reply to a view-once (⭕) image or video with `.vv`!*");
      }

      const q = m.quoted.message;

      // Detect type (image or video)
      const isImage = !!q.imageMessage;
      const isVideo = !!q.videoMessage;
      if (!isImage && !isVideo) {
        return reply("❌ *This reply is not an image or video!*");
      }

      // View-once flag detection
      const isVO =
        q?.imageMessage?.viewOnce === true ||
        q?.videoMessage?.viewOnce === true ||
        (m.quoted?.viewOnce === true);

      // Download media
      let buffer;
      try {
        buffer = await malvin.downloadMediaMessage(m.quoted);
      } catch (err) {
        console.error("vv download error:", err);
        return reply("❌ *Failed to download the media!*");
      }
      if (!buffer) {
        return reply("❌ *Media buffer is empty!*");
      }

      // Captions
      const capVO = "👀 *View-Once message recovered!* Now you can see it again 🌸✨";
      const capNormal = "👀 Here’s the media you sent, sent back to you 🌸✨";
      const caption = (m.quoted?.message?.caption && m.quoted.message.caption.trim().length)
        ? m.quoted.message.caption
        : (isVO ? capVO : capNormal);

      // Prepare output
      const out = isImage
        ? { image: buffer, caption, mimetype: q.mimetype || "image/jpeg" }
        : { video: buffer, caption, mimetype: q.mimetype || "video/mp4" };

      // Send it back
      await malvin.sendMessage(from, out, { quoted: mek });

    } catch (e) {
      console.error("❌ .vv error:", e);
      reply("❌ *An error occurred while processing `.vv` — please try again later!*");
    }
  }
);
