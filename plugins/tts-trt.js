const axios = require('axios');
const config = require('../config');
const { cmd, commands } = require('../command');
const googleTTS = require('google-tts-api');

// 📘 TRANSLATE COMMAND
cmd({
    pattern: "trt",
    alias: ["translate"],
    desc: "🌍 Translate text into any language",
    react: "⚡",
    category: "other",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        const args = q.split(' ');
        if (args.length < 2) {
            return reply("❗ Please provide a language code and the text to translate.\n\nExample:\n.translate fr Hello, how are you?");
        }

        const targetLang = args[0];
        const textToTranslate = args.slice(1).join(' ');

        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=en|${targetLang}`;
        const response = await axios.get(url);
        const translation = response.data.responseData.translatedText;

        const translationMessage = `╭─「 🌍 *TRANSLATION* 」─╮
🔤 *Original:* ${textToTranslate}
🔠 *Translated:* ${translation}
🌐 *Language:* ${targetLang.toUpperCase()}
╰──────────────────────╯`;

        return reply(translationMessage);
    } catch (e) {
        console.error("Translation Error:", e);
        return reply("⚠️ An error occurred while translating your text. Please try again later.");
    }
});

// 🔊 TEXT-TO-SPEECH COMMAND
cmd({
    pattern: "tts",
    desc: "Convert text to speech",
    category: "download",
    react: "🗣️",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❗ Please provide the text you want to convert to speech.");

        const url = googleTTS.getAudioUrl(q, {
            lang: 'hi-IN', // You can change to 'en', 'fr', etc.
            slow: false,
            host: 'https://translate.google.com',
        });

        await conn.sendMessage(from, {
            audio: { url },
            mimetype: 'audio/mpeg',
            ptt: true
        }, { quoted: mek });

    } catch (error) {
        console.error("TTS Error:", error);
        reply("❌ Failed to convert text to speech.");
    }
});
