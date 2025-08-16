const { cmd } = require("../command");

cmd(
  {
    pattern: "vv",
    react: "👀",
    desc: "Reply to a view-once image/video to resend it (robust download)",
    category: "fun",
    filename: __filename,
    fromMe: false,
  },
  async (malvin, mek, m, { reply }) => {
    try {
      const from = mek.key.remoteJid;

      // robust quoted finder (handles multiple shapes)
      const findQuoted = (msg) => {
        if (msg.quoted && msg.quoted.message) return msg.quoted;
        const ext = msg.message?.extendedTextMessage?.contextInfo;
        if (ext && ext.quotedMessage) return { message: ext.quotedMessage, key: ext.stanzaId ? { id: ext.stanzaId } : ext, participant: ext.participant };
        const imgCtx = msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo;
        if (imgCtx && imgCtx.quotedMessage) return { message: imgCtx.quotedMessage, key: imgCtx.stanzaId ? { id: imgCtx.stanzaId } : imgCtx, participant: imgCtx.participant };
        if (msg.contextInfo && msg.contextInfo.quotedMessage) return { message: msg.contextInfo.quotedMessage, key: msg.contextInfo, participant: msg.contextInfo.participant };
        return null;
      };

      const quoted = findQuoted(m);
      if (!quoted || !quoted.message) {
        return await reply("🍁 *Please reply to a view-once (⭕) image or video with `.vv`!*");
      }

      // unwrap wrappers until we get the media-level message
      let q = quoted.message;

      // some messages are wrapped in ephemeralMessage
      if (q.ephemeralMessage && q.ephemeralMessage.message) q = q.ephemeralMessage.message;

      // view-once v2
      if (q.viewOnceMessageV2) q = q.viewOnceMessageV2.message || q.viewOnceMessageV2;

      // view-once v1
      if (q.viewOnceMessage && q.viewOnceMessage.message) q = q.viewOnceMessage.message;

      // sometimes quoted message itself is nested inside extendedTextMessage
      if (q.extendedTextMessage && q.extendedTextMessage.contextInfo && q.extendedTextMessage.contextInfo.quotedMessage) {
        q = q.extendedTextMessage.contextInfo.quotedMessage;
      }

      // find which media key is present
      const mediaKey = q.imageMessage ? "imageMessage" : q.videoMessage ? "videoMessage" : q.documentMessage ? "documentMessage" : q.stickerMessage ? "stickerMessage" : null;
      if (!mediaKey) {
        return await reply("❌ *This is not an image/video/document/sticker message!*"); 
      }

      // Prepare a message object suitable for different download helpers
      // Some helpers expect the wrapper (q), others expect { [mediaKey]: q[mediaKey] } or the inner media object.
      const mediaWrapper = q;
      const mediaObject = q[mediaKey];

      // Attempt multiple download methods
      let buffer = null;
      let debug = { attempted: [], mediaKey, hasMediaObject: !!mediaObject, hasWrapper: !!mediaWrapper };

      try {
        // 1) common helper: downloadMediaMessage({ message: ... })
        if (!buffer && typeof malvin.downloadMediaMessage === "function") {
          debug.attempted.push("downloadMediaMessage({ message: q })");
          try {
            buffer = await malvin.downloadMediaMessage({ message: mediaWrapper });
          } catch (err1) {
            debug.err1 = err1 && err1.message ? err1.message : String(err1);
            // fallback: downloadMediaMessage(q)
            debug.attempted.push("downloadMediaMessage(q)");
            try {
              buffer = await malvin.downloadMediaMessage(mediaWrapper);
            } catch (err2) {
              debug.err2 = err2 && err2.message ? err2.message : String(err2);
            }
          }
        }

        // 2) some libs expose downloadAndSaveMediaMessage or downloadAndSaveMediaMessageToFile
        if (!buffer && typeof malvin.downloadAndSaveMediaMessage === "function") {
          debug.attempted.push("downloadAndSaveMediaMessage");
          try {
            const res = await malvin.downloadAndSaveMediaMessage(mediaWrapper);
            // if it returns a path or buffer
            if (Buffer.isBuffer(res)) buffer = res;
            else if (typeof res === "string") {
              // try read file if FS available (some hosts)
              const fs = require("fs");
              buffer = fs.readFileSync(res);
            }
          } catch (err) {
            debug.err_downloadAndSave = err && err.message ? err.message : String(err);
          }
        }

        // 3) downloadContentFromMessage (Baileys style) — supports async iterable/stream
        if (!buffer && typeof malvin.downloadContentFromMessage === "function") {
          debug.attempted.push("downloadContentFromMessage(mediaWrapper, type)");
          try {
            const type = mediaKey === "imageMessage" ? "image" : mediaKey === "videoMessage" ? "video" : (mediaKey === "documentMessage" ? "document" : "sticker");
            const stream = await malvin.downloadContentFromMessage(mediaWrapper, type);
            // stream may be an async iterable
            const chunks = [];
            // If stream is Node Readable
            if (stream && typeof stream.on === "function" && typeof stream.read === "function") {
              // convert readable to buffer
              await new Promise((resolve, reject) => {
                const bufs = [];
                stream.on("data", (c) => bufs.push(c));
                stream.on("end", () => {
                  buffer = Buffer.concat(bufs);
                  resolve();
                });
                stream.on("error", (e) => reject(e));
              });
            } else if (stream && typeof stream[Symbol.asyncIterator] === "function") {
              for await (const chunk of stream) chunks.push(chunk);
              buffer = Buffer.concat(chunks);
            } else if (Array.isArray(stream)) {
              buffer = Buffer.concat(stream);
            }
          } catch (err) {
            debug.err_downloadContent = err && err.message ? err.message : String(err);
          }
        }

        // 4) last resort: if mediaObject has url or direct data (rare)
        if (!buffer && mediaObject) {
          // if mediaObject has direct url field (rare in some libs)
          if (mediaObject.url) {
            debug.attempted.push("mediaObject.url (not recommended)");
            try {
              // try built-in fetch if available or proxy through malvin.fetch? keep simple:
              const https = require("https");
              buffer = await new Promise((resolve, reject) => {
                const chunks = [];
                https.get(mediaObject.url, (res) => {
                  res.on("data", (c) => chunks.push(c));
                  res.on("end", () => resolve(Buffer.concat(chunks)));
                }).on("error", (e) => reject(e));
              });
            } catch (err) {
              debug.err_url = err && err.message ? err.message : String(err);
            }
          }
        }
      } catch (errAll) {
        debug.err_all = errAll && errAll.message ? errAll.message : String(errAll);
      }

      if (!buffer) {
        console.error("vv: download failed debug:", JSON.stringify(debug, null, 2));
        return await reply("❌ *Failed to download the media!* (check bot logs for debug info)");
      }

      // send back using original caption if present
      const caption = mediaObject?.caption || mediaWrapper?.caption || "👀 View-Once message recovered!";
      const out = mediaKey === "imageMessage"
        ? { image: buffer, caption, mimetype: mediaObject?.mimetype || "image/jpeg" }
        : mediaKey === "videoMessage"
          ? { video: buffer, caption, mimetype: mediaObject?.mimetype || "video/mp4" }
          : mediaKey === "documentMessage"
            ? { document: buffer, fileName: mediaObject?.fileName || "file", mimetype: mediaObject?.mimetype || "application/octet-stream", caption }
            : { sticker: buffer, mimetype: mediaObject?.mimetype || "image/webp" };

      await malvin.sendMessage(from, out, { quoted: mek });

    } catch (e) {
      console.error("❌ .vv unexpected error:", e);
      try { await reply("❌ *An unexpected error occurred while processing `.vv` — check logs.*"); } catch {}
    }
  }
);
