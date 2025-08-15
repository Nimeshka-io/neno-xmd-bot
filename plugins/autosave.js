const { cmd } = require("../command");

cmd(
  {
    pattern: "save",
    react: "🤖",
    desc: "Save contact and send vCard",
    category: "main",
    filename: __filename,
    fromMe: false,
  },
  async (malvin, mek, m, { reply }) => {
    try {
      const from = mek.key.remoteJid; // e.g. "9477xxxxxxx@c.us"
      await malvin.sendPresenceUpdate("recording", from);

      // get sender push name if available
      let senderName = mek.pushName || (m && m.pushName) || "";

      // build display name: "<original> neno xmd 🩵" or just "neno xmd 🩵" if no name
      const displayName = senderName ? `${senderName} neno xmd 🩵` : "neno xmd 🩵";

      // extract phone (strip @c.us or @s.whatsapp.net)
      let phone = from.split("@")[0];
      // ensure phone has + if it starts with country code like 94 -> +94...
      if (!phone.startsWith("+")) {
        if (phone.length >= 9) {
          phone = phone.startsWith("0") ? phone : phone; // keep as-is (common with green api)
        }
      }

      // create simple vCard (VERSION:3.0)
      const vcard =
        "BEGIN:VCARD\n" +
        "VERSION:3.0\n" +
        `FN:${displayName}\n` +
        `TEL;TYPE=CELL:${phone}\n` +
        `NOTE:Saved via NENO XMD\n` +
        "END:VCARD";

      // send the contact (contacts object format — works with baileys-like sendMessage)
      await malvin.sendMessage(
        from,
        {
          contacts: {
            displayName: displayName,
            contacts: [{ vcard: vcard }],
          },
        },
        { quoted: mek }
      );

      // small delay so contact arrives first
      await new Promise((r) => setTimeout(r, 700));

      // send a nice emoji message
      const friendlyMsg = `💾 Contact saved!\n\nHi ${senderName ? senderName + " " : ""}— I added you as *${displayName}* and sent the vCard. \n\nneno xmd 🩵\n\n✨ Thank you!`;

      await malvin.sendMessage(
        from,
        { text: friendlyMsg },
        { quoted: mek }
      );
    } catch (e) {
      console.error("❌ Error in .save command:", e);
      reply("❌ Error while creating/sending contact. Try again!");
    }
  }
);
