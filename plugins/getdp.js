const { cmd } = require("../command");

cmd(
  {
    pattern: "getdp",
    react: "👀",
    desc: "Get and send the other person's WhatsApp profile picture",
    category: "main",
    filename: __filename,
    fromMe: false,
  },
  async (malvin, mek, m, { reply }) => {
    try {
      const from = mek.key.remoteJid;
      await malvin.sendPresenceUpdate("recording", from);

      // Get the target JID:
      // 1️⃣ If replying, use the sender of the quoted message
      // 2️⃣ Else, in private/group chat, use the other person (not bot / not self)
      let targetJid;
      if (m.quoted) {
        targetJid = m.quoted.sender;
      } else if (from.endsWith("@g.us")) {
        // In group chat, pick the first non-bot participant other than yourself
        const participants = m.message?.key?.participant ? [m.message.key.participant] : [];
        targetJid = participants.find(jid => jid !== malvin.user.id) || from;
      } else {
        // Private chat, the other person
        targetJid = from;
      }

      // Fetch DP URL
      let dpUrl;
      try {
        dpUrl = await malvin.profilePictureUrl(targetJid, "image");
        if (!dpUrl) throw new Error("No DP found");
      } catch (err) {
        return reply("❌ This user has no profile picture!");
      }

      // Send DP image with cute caption
      await malvin.sendMessage(
        from,
        {
          image: { url: dpUrl },
          caption: `👀 Here’s their DP! 🌸✨\nStay cute and sparkling 🩵💖`
        },
        { quoted: mek }
      );

    } catch (e) {
      console.error("❌ Error in .getdp command:", e);
      reply("❌ Could not fetch the DP!");
    }
  }
);
