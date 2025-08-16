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

      // Robust quoted-message finder to avoid false "Please reply..." prompts
      const findQuoted = (msg) => {
        // 1) Common shape: m.quoted.message
        if (msg.quoted && msg.quoted.message) return msg.quoted;

        // 2) extendedTextMessage.contextInfo.quotedMessage (Baileys/older shapes)
        const ext = msg.message?.extendedTextMessage?.contextInfo;
        if (ext && ext.quotedMessage) {
          return { message: ext.quotedMessage, key: ext.stanzaId ? { id: ext.stanzaId } : ext, participant: ext.participant };
        }

        // 3) image/video message contextInfo
        const imgCtx = msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo;
        if (imgCtx && imgCtx.quotedMessage) {
          return { message: imgCtx.quotedMessage, key: imgCtx.stanzaId ? { id: imgCtx.stanzaId } : imgCtx, participant: imgCtx.participant };
        }

        // 4) fallback: some libs attach quoted in different fields
        if (msg.contextInfo && msg.contextInfo.quotedMessage) {
          return { message: msg.contextInfo.quotedMessage, key: msg.contextInfo, participant: msg.contextInfo.participant };
        }

        return null;
      };

      const quoted = findQuoted(m);
      if (!quoted || !quoted.message) {
        return await reply("🍁 *Please reply to a view-once (⭕) image or video with `.vv`!*"); 
      }

      // unwrap view-once for multiple protocol shapes
      let q = quoted.message;
      if (q.viewOnceMessageV2) {
        q = q.viewOnceMessageV2.message || q.viewOnceMessageV2;
      } else if (q.viewOnceMessage && q.viewOnceMessage.message) {
        q = q.viewOnceMessage.message;
      }

      // Detect type
      const isImage = !!q.imageMessage;
      const isVideo = !!q.videoMessage;
      if (!isImage && !isVideo) {
        return await reply("❌ *This is not an image or video!*"); 
      }

      // Download media (try multiple fallbacks)
      let buffer = null;
      try {
        if (typeof malvin.downloadMediaMessage === "function") {
          try {
            buffer = await malvin.downloadMediaMessage({ message: q });
          } catch (_) {
            buffer = await malvin.downloadMediaMessage(q).catch(() => null);
          }
        }
        if (!buffer && malvin.downloadContentFromMessage) {
          const stream = await malvin.downloadContentFromMessage(q, isImage ? "image" : "video");
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          buffer = Buffer.concat(chunks);
        }
      } catch (err) {
        console.error("vv download error:", err);
      }

      if (!buffer) {
        return await reply("❌ *Failed to download the media!*"); 
      }

      // Caption (use original if present, otherwise default)
      const capVO = "👀 *View-Once message recovered!* Now you can see it again 🌸✨";
      const caption = q.imageMessage?.caption || q.videoMessage?.caption || capVO;

      // Prepare output and send
      const out = isImage
        ? { image: buffer, caption, mimetype: q.imageMessage?.mimetype || "image/jpeg" }
        : { video: buffer, caption, mimetype: q.videoMessage?.mimetype || "video/mp4" };

      await malvin.sendMessage(from, out, { quoted: mek });

    } catch (e) {
      console.error("❌ .vv error:", e);
      try { await reply("❌ *An error occurred while processing `.vv`!*"); } catch {}
    }
  }
);
