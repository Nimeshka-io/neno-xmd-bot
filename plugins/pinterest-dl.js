const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "pindl",
    alias: ["pinterestdl", "pin", "pins", "pindownload"],
    desc: "Download media from Pinterest",
    category: "DWLD",
    filename: __filename
}, async (conn, mek, m, { args, quoted, from, reply }) => {
    try {
        if (args.length < 1) {
            return reply('❎ Please provide a valid Pinterest URL.');
        }

        const pinterestUrl = args[0];
        const response = await axios.get(`https://api.giftedtech.web.id/api/download/pinterestdl?apikey=gifted&url=${encodeURIComponent(pinterestUrl)}`);

        if (!response.data.success) {
            return reply('❎ Failed to retrieve data from Pinterest.');
        }

        const media = response.data.result.media;
        const description = response.data.result.description || 'No description available';
        const title = response.data.result.title || 'No title provided';

        const videoUrl = media.find(item => item.type.includes('720p'))?.download_url || media[0].download_url;

        const caption = `
╭━〔 *🎯 PINTEREST DOWNLOADER* 〕━
┃ 🔖 *Title* : ${title}
┃ 📽️ *Type* : ${media[0].type}
┃ 📝 *Description* : ${description}
┃ 💎 *Source* : Pinterest
╰━━━━━━━━━━━━━━━━━━━━

🔧 Powered by *zed*
        `.trim();

        if (videoUrl) {
            await conn.sendMessage(from, { video: { url: videoUrl }, caption }, { quoted: mek });
        } else {
            const imageUrl = media.find(item => item.type === 'Thumbnail')?.download_url;
            await conn.sendMessage(from, { image: { url: imageUrl }, caption }, { quoted: mek });
        }

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ An error occurred while processing your request.');
    }
});
