require('dotenv').config(); // Load .env variables
const { cmd } = require('../command');
const axios = require('axios');

const HF_API_KEY = process.env.HF_API_KEY; // Read API key from .env
const HF_MODEL = 'prompthero/openjourney'; // Ghibli-style AI model

cmd({
    pattern: 'imgg',
    fromMe: false,
    desc: 'Generate a Ghibli-style AI image from text prompt.',
    category: 'tools',
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    try {
        if (!HF_API_KEY) return reply('❌ Hugging Face API Key not found. Please set it in .env file.');
        
        const prompt = args.join(' ') || 'Studio Ghibli style fantasy landscape, cinematic lighting, anime art';
        await reply(`🎨 Generating your Ghibli-style image...\nPrompt: *${prompt}*`);

        const response = await axios.post(
            `https://api-inference.huggingface.co/models/${HF_MODEL}`,
            { inputs: prompt },
            {
                headers: {
                    'Authorization': `Bearer ${HF_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        if (response.status !== 200) {
            return reply(`❌ Error: ${response.statusText}`);
        }

        await conn.sendMessage(mek.key.remoteJid, {
            image: response.data,
            caption: `✨ *Studio Ghibli Style Image* ✨\nPrompt: ${prompt}`
        }, { quoted: mek });

    } catch (error) {
        console.error(error);
        reply('❌ Failed to generate image. Try again later.');
    }
});
