const { cmd } = require("../command");
const fs = require("fs");
const https = require("https");

cmd(
  {
    pattern: "vv",
    react: "👀",
    desc: "Robust view-once recovery (try many download methods)",
    category: "fun",
    filename: __filename,
    fromMe: false,
  },
  async (malvin, mek, m, { reply }) => {
    try {
      const from = mek.key.remoteJid;

      // 1) quoted finder (simple + extended)
      const findQuoted = (msg) => {
        if (msg.quoted && msg.quoted.message) return msg.quoted;
        const ext = msg.message?.extendedTextMessage?.contextInfo;
        if (ext && ext.quotedMessage) return { message: ext.quotedMessage, key: ext.stanzaId ? { id: ext.stanzaId } : ext, participant: ext.participant };
        const ctx = msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo;
        if (ctx && ctx.quotedMessage) return { message: ctx.quotedMessage, key: ctx.stanzaId ? { id: ctx.stanzaId } : ctx, participant: ctx.participant };
        if (msg.contextInfo && msg.contextInfo.quotedMessage) return { message: msg.contextInfo.quotedMessage, key: msg.contextInfo, participant: msg.contextInfo.participant };
        return null;
      };

      const quoted = findQuoted(m);
      if (!quoted || !quoted.message) {
        return await reply("🍁 Please reply to a view-once (⭕) image or video with `.vv`!");
      }

      // 2) unwrap common wrappers
      let q = quoted.message;
      if (q.ephemeralMessage && q.ephemeralMessage.message) q = q.ephemeralMessage.message;
      if (q.viewOnceMessageV2) q = q.viewOnceMessageV2.message || q.viewOnceMessageV2;
      if (q.viewOnceMessage && q.viewOnceMessage.message) q = q.viewOnceMessage.message;
      if (q.extendedTextMessage && q.extendedTextMessage.contextInfo && q.extendedTextMessage.contextInfo.quotedMessage) {
        q = q.extendedTextMessage.contextInfo.quotedMessage;
      }

      // 3) deep search to find any media key and mediaObject
      function deepFindMedia(obj) {
        if (!obj || typeof obj !== "object") return null;
        const keys = ["imageMessage", "videoMessage", "documentMessage", "stickerMessage"];
        for (const k of keys) {
          if (obj[k]) return { wrapper: obj, key: k, media: obj[k] };
        }
        for (const k of Object.keys(obj)) {
          if (obj[k] && typeof obj[k] === "object") {
            const r = deepFindMedia(obj[k]);
            if (r) return r;
          }
        }
        return null;
      }

      const found = deepFindMedia(q) || deepFindMedia(quoted.message) || null;
      if (!found) {
        return await reply("❌ මේ reply එකේ මැදිහත් වුන media object එක හදුනාගත නොහැක. (Not an image/video?)");
      }

      const mediaWrapper = found.wrapper;
      const mediaKey = found.key;
      const mediaObject = found.media;

      // 4) Try multiple download strategies
      let buffer = null;
      const debug = { attempts: [], mediaKey, hasMime: !!mediaObject.mimetype, mediaFields: Object.keys(mediaObject || {}) };

      // helper to fetch URL via https (if mediaObject.url exists)
      const fetchUrl = (url) => new Promise((resolve, reject) => {
        try {
          const bufs = [];
          https.get(url, (res) => {
            res.on("data", (c) => bufs.push(c));
            res.on("end", () => resolve(Buffer.concat(bufs)));
            res.on("error", (e) => reject(e));
          }).on("error", (e) => reject(e));
        } catch (err) { reject(err); }
      });

      try {
        // attempt 1: malvin.downloadMediaMessage({ message: wrapper })
        if (!buffer && typeof malvin.downloadMediaMessage === "function") {
          debug.attempts.push("downloadMediaMessage({ message: mediaWrapper })");
          try { buffer = await malvin.downloadMediaMessage({ message: mediaWrapper }); } catch (e) { debug.err1 = e && e.message; }
        }

        // attempt 2: malvin.downloadMediaMessage(mediaWrapper) (alternate signature)
        if (!buffer && typeof malvin.downloadMediaMessage === "function") {
          debug.attempts.push("downloadMediaMessage(mediaWrapper)");
          try { buffer = await malvin.downloadMediaMessage(mediaWrapper); } catch (e) { debug.err2 = e && e.message; }
        }

        // attempt 3: downloadContentFromMessage(mediaWrapper, type)
        if (!buffer && typeof malvin.downloadContentFromMessage === "function") {
          const type = mediaKey === "imageMessage" ? "image" : mediaKey === "videoMessage" ? "video" : (mediaKey === "documentMessage" ? "document" : "sticker");
          debug.attempts.push("downloadContentFromMessage");
          try {
            const stream = await malvin.downloadContentFromMessage(mediaWrapper, type);
            const chunks = [];
            if (stream && typeof stream.on === "function") {
              buffer = await new Promise((res, rej) => {
                const bufs = [];
                stream.on("data", (c) => bufs.push(c));
                stream.on("end", () => res(Buffer.concat(bufs)));
                stream.on("error", (err) => rej(err));
              });
            } else if (stream && typeof stream[Symbol.asyncIterator] === "function") {
              for await (const c of stream) chunks.push(c);
              buffer = Buffer.concat(chunks);
            } else if (Array.isArray(stream)) {
              buffer = Buffer.concat(stream);
            }
          } catch (e) { debug.err3 = e && e.message; }
        }

        // attempt 4: downloadAndSaveMediaMessage or downloadAndSaveMediaMessageToFile
        if (!buffer && typeof malvin.downloadAndSaveMediaMessage === "function") {
          debug.attempts.push("downloadAndSaveMediaMessage");
          try {
            const res = await malvin.downloadAndSaveMediaMessage(mediaWrapper);
            if (Buffer.isBuffer(res)) buffer = res;
            else if (typeof res === "string" && fs.existsSync(res)) buffer = fs.readFileSync(res);
          } catch (e) { debug.err4 = e && e.message; }
        }

        // attempt 5: try using the inner media object directly
        if (!buffer) {
          debug.attempts.push("attempt using inner media object shapes");
          try {
            // some libs expect { imageMessage: mediaObject } etc.
            const pseudo = { message: { [mediaKey]: mediaObject } };
            if (typeof malvin.downloadMediaMessage === "function") {
              buffer = await malvin.downloadMediaMessage(pseudo).catch(() => null);
            }
            if (!buffer && typeof malvin.downloadContentFromMessage === "function") {
              const type = mediaKey === "imageMessage" ? "image" : mediaKey === "videoMessage" ? "video" : "document";
              const stream = await malvin.downloadContentFromMessage(pseudo.message, type).catch(() => null);
              if (stream) {
                const chunks = [];
                if (typeof stream.on === "function") {
                  buffer = await new Promise((res, rej) => {
                    const bufs = [];
                    stream.on("data", (c) => bufs.push(c));
                    stream.on("end", () => res(Buffer.concat(bufs)));
                    stream.on("error", (err) => rej(err));
                  });
                } else if (typeof stream[Symbol.asyncIterator] === "function") {
                  for await (const c of stream) chunks.push(c);
                  buffer = Buffer.concat(chunks);
                }
              }
            }
          } catch (e) { debug.err5 = e && e.message; }
        }

        // attempt 6: if mediaObject.url available -> fetch via https
        if (!buffer && mediaObject && mediaObject.url) {
          debug.attempts.push("fetch mediaObject.url via https");
          try { buffer = await fetchUrl(mediaObject.url); } catch (e) { debug.err6 = e && e.message; }
        }

        // attempt 7: try using quoted.message wrapper (some environments expect that)
        if (!buffer) {
          debug.attempts.push("final fallback: downloadMediaMessage({ message: quoted.message })");
          try { buffer = await malvin.downloadMediaMessage({ message: quoted.message }).catch(() => null); } catch (e) { debug.err7 = e && e.message; }
        }
      } catch (errAll) {
        debug.errAll = errAll && errAll.message;
      }

      // if still no buffer -> log debug and reply
      if (!buffer) {
        console.error("vv download failed debug:", JSON.stringify(debug, null, 2));
        // also log shapes to help troubleshooting
        try {
          console.error("vv: mediaWrapper keys:", Object.keys(mediaWrapper || {}));
          console.error("vv: mediaObject keys:", Object.keys(mediaObject || {}));
          console.error("vv: quoted.message keys:", Object.keys(quoted.message || {}));
        } catch (x) { /* ignore */ }
        return await reply("❌ Failed to download the full media (check bot logs for download debug).");
      }

      // success -> send back
      const caption = mediaObject.caption || mediaWrapper.caption || "👀 View-Once recovered!";
      let out;
      if (mediaKey === "imageMessage") out = { image: buffer, caption, mimetype: mediaObject.mimetype || "image/jpeg" };
      else if (mediaKey === "videoMessage") out = { video: buffer, caption, mimetype: mediaObject.mimetype || "video/mp4" };
      else if (mediaKey === "documentMessage") out = { document: buffer, fileName: mediaObject.fileName || "file", mimetype: mediaObject.mimetype || "application/octet-stream", caption };
      else out = { sticker: buffer };

      await malvin.sendMessage(from, out, { quoted: mek });

    } catch (e) {
      console.error(".vv unexpected error:", e);
      try { await reply("❌ `.vv` ක්‍රියාත්මක කිරීමේදී අනපේක්ෂිත දෝෂයක් සිදු විය. ලොග් පරීක්ෂා කරන්න."); } catch {}
    }
  }
);
