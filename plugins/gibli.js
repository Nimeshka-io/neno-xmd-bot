// plugins/ai-image.js
const { cmd } = require('../command');
const axios = require('axios');

cmd({
  pattern: 'imgg',
  fromMe: false,
  desc: 'Generate a Ghibli-style image from your text prompt.',
  category: 'tools',
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    const prompt = args.join(' ') || 'Ghibli style landscape 🌸';

    await reply('🎨 Generating your Ghibli-style image... This may take a few seconds.');

    // Free API endpoint: Replit DALL·E Mini
    const response = await axios.post('https://api.replit.com/v1/dalle-mini/generate', {
      prompt: prompt
    });

    const imageUrl = response.data.image_url;
    if (!imageUrl) return reply('❌ Failed to generate image.');

    await conn.sendMessage(mek.key.remoteJid, {
      image: { url: imageUrl },
      caption: `✨ Here is your Ghibli-style image for:\n"${prompt}"`
    }, { quoted: mek });

  } catch (err) {
    console.error('AI Image Generate Error:', err);
    reply('❌ Error generating image. Try again later.');
  }
});
