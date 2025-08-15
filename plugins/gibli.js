const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: 'imgg',
    fromMe: false,
    desc: 'Generate a free anime-style image without API key',
    category: 'tools',
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    try {
        const prompt = args.join(' ') || 'anime girl, fantasy, cinematic lighting';
        await reply(`🎨 Generating your free anime-style image...\nPrompt: *${prompt}*`);

        // Free endpoint that generates random anime-style images
        const imageUrl = `https://thisanimedoesnotexist.ai/api?random=${Math.floor(Math.random()*10000)}`;

        // Download the image
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');

        // Send image to user
        await conn.sendMessage(mek.key.remoteJid, {
            image: buffer,
            caption: `✨ *Free Anime-style Image* ✨\nPrompt: ${prompt}`
        }, { quoted: mek });

    } catch (error) {
        console.error(error);
        reply('❌ Failed to generate image. Try again later.');
    }
});
