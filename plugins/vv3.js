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

      if (!m.quoted || !m.quoted.message) {
        return await reply("🍁 *Please reply to a view-once (⭕) image or video with `.vv`!*"); 
      }

      // unwrap view-once for multiple protocol shapes
      let q = m.quoted.message;
      if (q.viewOnceMessageV2) {
        q = q.viewOnceMessageV2.message || q.viewOnceMessageV2;
      } else if (q.viewOnceMessage && q.viewOnceMessage.message) {
        q = q.viewOnceMessage.message;
      }

      // Detect type
      const isImage = !!q.imageMessage;
      const isVideo = !!q.videoMessage;
      if (!isImage && !isVideo) {
        return await reply("❌ *This reply is not an image or video!*"); 
      }

      // Download media (try both calling styles)
      let buffer;
      try {
        // some bots use conn.downloadMediaMessage({ message: q })
        if (typeof malvin.downloadMediaMessage === "function") {
          try {
            buffer = await malvin.downloadMediaMessage({ message: q });
          } catch (_) {
            // fallback: some versions accept the message directly
            buffer = await malvin.downloadMediaMessage(q).catch(() => null);
          }
        }
        // as a last fallback, try downloadContentFromMessage (Baileys internals)
        if (!buffer && malvin.downloadContentFromMessage) {
          const stream = await malvin.downloadContentFromMessage(q, isImage ? "image" : "video");
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          buffer = Buffer.concat(chunks);
        }
      } catch (err) {
        console.error("vv download error (all attempts):", err);
      }

      if (!buffer) {
        return await reply("❌ *Failed to download the media!*"); 
      }

      // Captions
      const capVO = "👀 *View-Once message recovered!* Now you can see it again 🌸✨";
      const capNormal = q.imageMessage?.caption || q.videoMessage?.caption || "👀 Here’s the media you sent, sent back to you 🌸✨";
      const caption = q.imageMessage?.caption || q.videoMessage?.caption || capVO;

      // Prepare output
      const out = isImage
        ? { image: buffer, caption, mimetype: q.imageMessage?.mimetype || "image/jpeg" }
        : { video: buffer, caption, mimetype: q.videoMessage?.mimetype || "video/mp4" };

      // Send it back
      await malvin.sendMessage(from, out, { quoted: mek });

    } catch (e) {
      console.error("❌ .vv error:", e);
      try { await reply("❌ *An error occurred while processing `.vv` — check logs!*"); } catch {}
    }
  }
);
