const { conn } = require('../connection'); // your bot connection

conn.ev.on('messages.delete', async (m) => {
    try {
        // m contains the deleted message(s)
        for (const msg of m) {
            // Ignore bot's own messages
            if (msg.key.fromMe) continue;

            const from = msg.key.remoteJid;
            const deletedMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'Unknown content';

            await conn.sendMessage(from, {
                text: `⚠️ A user deleted a message!\nDeleted content: ${deletedMsg}`
            });
        }
    } catch (err) {
        console.error('Error detecting deleted message:', err);
    }
});
