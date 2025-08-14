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
    const prompt = args.join(' ') || 'Ghibli style fantasy landscape, Studio Ghibli art, anime, cinematic lighting';

    await reply('🎨 Generating your Ghibli-style image... Please wait.');

    // Use Lexica API (No API key needed)
    const res = await axios.get(`https://lexica.art/api/v1/search?q=${encodeURIComponent(prompt)}`);

    if (!res.data.images || res.data.images.length === 0) {
      return reply('❌ No image found for your prompt.');
    }

    // Pick a random image from results
    const imageUrl = res.data.images[Math.floor(Math.random() * res.data.images.length)].src;

    await conn.sendMessage(mek.key.remoteJid, {
      image: { url: imageUrl },
      caption: `✨ Ghibli-style image for:\n"${prompt}"`
    }, { quoted: mek });

  } catch (err) {
    console.error(err);
    reply('❌ Failed to generate image. Try again later.');
  }
});
