const { cmd } = require("../command");

cmd(
  {
    pattern: "vv",
    react: "🧩",
    desc: "Reply to a view-once image/video to resend it (deep media extraction)",
    category: "fun",
    filename: __filename,
    fromMe: false,
  },
  async (malvin, mek, m, { reply }) => {
    try {
      const from = mek.key.remoteJid;

      // robust quoted finder
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
        return await reply("🍁 Please reply to a view-once (⭕) image or video with `.vv`!");
      }

      // Unwrap common wrappers (ephemeral, viewOnce v1/v2, extendedText)
      let q = quoted.message;
      if (q.ephemeralMessage && q.ephemeralMessage.message) q = q.ephemeralMessage.message;
      if (q.viewOnceMessageV2) q = q.viewOnceMessageV2.message || q.viewOnceMessageV2;
      if (q.viewOnceMessage && q.viewOnceMessage.message) q = q.viewOnceMessage.message;
      if (q.extendedTextMessage && q.extendedTextMessage.contextInfo && q.extendedTextMessage.contextInfo.quotedMessage) {
        q = q.extendedTextMessage.contextInfo.quotedMessage;
      }

      // Recursively search for the deepest media object that likely contains the real file
      function findDeepMedia(obj, depth = 0) {
        if (!obj || typeof obj !== "object") return null;
        // media keys in priority order
        const mediaKeys = ["imageMessage", "videoMessage", "documentMessage", "stickerMessage"];
        for (const key of mediaKeys) {
          if (obj[key]) {
            const media = obj[key];
            // Heuristic: prefer objects that have mimetype, fileLength, fileSha256 or url (not only jpegThumbnail)
            const hasRealFile = !!(media.mimetype || media.fileLength || media.fileSha256 || media.url || media.fileSha || media.directPath);
            if (hasRealFile) {
              return { wrapper: obj, mediaKey: key, mediaObject: media, depth };
            }
            // If this media only has a thumbnail, keep searching inside (some libs nest)
            // also check children of this media object (rare)
            const nested = findDeepMedia(media, depth + 1);
            if (nested) return nested;
            // continue — maybe a sibling deeper in obj has a better media
          }
        }
        // if none of direct media keys had a 'real' file, check nested objects recursively
        for (const k of Object.keys(obj)) {
          // avoid infinite recursion on prototypes
          if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
          const child = obj[k];
          if (child && typeof child === "object") {
            const res = findDeepMedia(child, depth + 1);
            if (res) return res;
          }
        }
        return null;
      }

      const found = findDeepMedia(q);
      // If not found, fallback to top-level detection (older shapes)
      let mediaWrapper, mediaKey, mediaObject;
      if (found) {
        mediaWrapper = found.wrapper;
        mediaKey = found.mediaKey;
        mediaObject = found.mediaObject;
      } else {
        // fallback: simple detection
        mediaKey = q.imageMessage ? "imageMessage" : q.videoMessage ? "videoMessage" : q.documentMessage ? "documentMessage" : q.stickerMessage ? "stickerMessage" : null;
        mediaWrapper = q;
        mediaObject = mediaKey ? q[mediaKey] : null;
      }

      if (!mediaKey || !mediaObject) {
        return await reply("❌ This reply does not contain an image/video/document/sticker.");
      }

      // Debug log so you see which object we used
      console.error("vv: using mediaKey=", mediaKey, "hasMime=", !!mediaObject.mimetype, "hasFileLength=", !!mediaObject.fileLength);

      // Try download from multiple helpers but always prefer using the wrapper that we found
      let buffer = null;
      const debug = { attempts: [] };

      // 1) malvin.downloadMediaMessage({ message: wrapper })
      try {
        if (typeof malvin.downloadMediaMessage === "function") {
          debug.attempts.push("downloadMediaMessage({ message: wrapper })");
          buffer = await malvin.downloadMediaMessage({ message: mediaWrapper }).catch(() => null);
        }
      } catch (e) {
        debug.last = e && e.message;
      }

      // 2) fallback downloadMediaMessage(wrapper)
      if (!buffer && typeof malvin.downloadMediaMessage === "function") {
        try {
          debug.attempts.push("downloadMediaMessage(wrapper)");
          buffer = await malvin.downloadMediaMessage(mediaWrapper).catch(() => null);
        } catch (e) { debug.last2 = e && e.message; }
      }

      // 3) downloadContentFromMessage(wrapper, type)
      if (!buffer && typeof malvin.downloadContentFromMessage === "function") {
        try {
          const type = mediaKey === "imageMessage" ? "image" : mediaKey === "videoMessage" ? "video" : (mediaKey === "documentMessage" ? "document" : "sticker");
          debug.attempts.push("downloadContentFromMessage");
          const stream = await malvin.downloadContentFromMessage(mediaWrapper, type);
          const chunks = [];
          if (stream && typeof stream.on === "function" && typeof stream.read === "function") {
            // node readable stream
            buffer = await new Promise((resolve, reject) => {
              const bufs = [];
              stream.on("data", (c) => bufs.push(c));
              stream.on("end", () => resolve(Buffer.concat(bufs)));
              stream.on("error", (e) => reject(e));
            });
          } else if (stream && typeof stream[Symbol.asyncIterator] === "function") {
            for await (const chunk of stream) chunks.push(chunk);
            buffer = Buffer.concat(chunks);
          } else if (Array.isArray(stream)) {
            buffer = Buffer.concat(stream);
          }
        } catch (e) {
          debug.last3 = e && e.message;
        }
      }

      // if still only thumbnail: try using the `quoted` wrapper instead of inner wrapper (some libs expect different shape)
      if (!buffer) {
        try {
          debug.attempts.push("final fallback: try quoted.message wrapper");
          buffer = await malvin.downloadMediaMessage({ message: quoted.message }).catch(() => null);
        } catch (e) { debug.lastFallback = e && e.message; }
      }

      if (!buffer) {
        console.error("vv download debug:", JSON.stringify(debug, null, 2));
        return await reply("❌ Failed to download the full media (bot logs contain download debug).");
      }

      // prepare send object using the mediaKey we actually used
      const caption = mediaObject.caption || mediaWrapper.caption || "👀 View-Once message recovered";
      let out;
      if (mediaKey === "imageMessage") out = { image: buffer, caption, mimetype: mediaObject.mimetype || "image/jpeg" };
      else if (mediaKey === "videoMessage") out = { video: buffer, caption, mimetype: mediaObject.mimetype || "video/mp4" };
      else if (mediaKey === "documentMessage") out = { document: buffer, fileName: mediaObject.fileName || "file", mimetype: mediaObject.mimetype || "application/octet-stream", caption };
      else out = { sticker: buffer };

      await malvin.sendMessage(from, out, { quoted: mek });

    } catch (err) {
      console.error(".vv unexpected error:", err);
      try { await reply("❌ An unexpected error occurred while processing `.vv`. Check bot logs."); } catch {}
    }
  }
);
