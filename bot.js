/**
 * WhatsApp Bot Script with Web QR Interface
 * Run with: node bot.js
 * Access at: http://localhost:8600
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const qrcode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

// --- SERVER SETUP ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 8600; // Port set to 8601

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

// --- CLIENT EVENTS ---

// Generate QR and send to Web Interface
client.on('qr', (qr) => {
    console.log('QR Code received. Generating for web...');
    // Convert QR string to Data URL for image display
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('Error generating QR', err);
            return;
        }
        // Send QR to the frontend
        io.emit('qr', url);
        io.emit('message', 'QR Code Received. Please Scan.');
    });
});

client.on('ready', () => {
    console.log('✅ WhatsApp bot is ready!');
    io.emit('ready', 'Bot is Ready!');
    io.emit('message', 'Bot is Connected and Ready!');
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
    io.emit('message', 'Authenticated! Getting ready...');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
    io.emit('message', 'Auth Failure. Please restart.');
});

// --- BOT LOGIC ---

// Allowed domains
const WHITELISTED_DOMAINS = [
    "cloudnet.one",
    "buy.cloudnet.one",
    "game.cloudnet.one",
    "cloudnet-movies.store",
    "t.me/jnrgamestore",
    "t.me/cloudnetv2ray",
    "youtube.com",
    "mediafire.com",
    "whatsapp.com",
    "t.me",
    "cpaid.rf.gd",
    "https://chat.whatsapp.com/HcET43uhapP8YwbnAhk0yI"
];

// Banned words list
const BANNED_WORDS = [
    "fuck", "shit", "bitch", "asshole", "nigga", "wtf", "pussy",
    "rape", "dick", "slut", "sex", "boobs", "cock", "porn",
    "පකයා", "අම්මට", "ගණිකාව", "කමක් නෑ", "කලුකතා"
];

// Link checker
function containsExternalLink(message) {
    const regex = /(https?:\/\/[^\s]+)/g;
    const matches = message.match(regex);
    if (matches) {
        for (let link of matches) {
            try {
                const domain = new URL(link).hostname.replace('www.', '');
                if (!WHITELISTED_DOMAINS.includes(domain)) {
                    return true;
                }
            } catch (_) { }
        }
    }
    return false;
}

// Bad word checker
function containsBadWords(message) {
    const text = message.toLowerCase();
    return BANNED_WORDS.some(word => text.includes(word));
}

// Message listener
client.on('message', async (message) => {
    // Convert message to lowercase for easy comparison
    const text = message.body.toLowerCase();

    // Delete non-whitelisted links
    if (containsExternalLink(message.body)) {
        try {
            await message.delete(true);
            const contact = await message.getContact();
            console.log(`❌ Deleted forbidden link from @${contact.number}`);
            const msg = `🛑 @${contact.number} ඔබගේ පණිවිඩය ඉවත් කරන ලදී. අවසර නොමැති ලින්ක්ස් යොමු කිරීමෙන් වලකින්න.`;
            await client.sendMessage(message.from, msg, { mentions: [contact] });
            return;
        } catch (err) {
            console.log("⚠️ Error deleting link:", err.message);
        }
    }

    // Delete bad word messages
    if (containsBadWords(message.body)) {
        try {
            await message.delete(true);
            const contact = await message.getContact();
            console.log(`❌ Deleted bad word from @${contact.number}`);
            const msg = `⚠️ @${contact.number} ඔබගේ පණිවිඩය ඉවත් කරන ලදී. කරුණාකර අපහාසජනක වචන භාවිතය වලක්වන්න.`;
            await client.sendMessage(message.from, msg, { mentions: [contact] });
            return;
        } catch (err) {
            console.log("⚠️ Error deleting bad word:", err.message);
        }
    }

    // Helper reply function
    const replyWithMention = async (msgText) => {
        const chat = await message.getChat();
        if (chat.isGroup) {
            const contact = await message.getContact();
            await client.sendMessage(message.from, `@${contact.number} ${msgText}`, {
                mentions: [contact],
                quotedMessageId: message.id._serialized
            });
        } else {
            await message.reply(msgText);
        }
    };

    // New command to send a random meme
    if (text === '!meme') {
        // NOTE: Ensure this path exists on the machine running the bot
        const memeFolder = 'C:\\Users\\jnr\\Pictures\\meme';

        try {
            // Check if folder exists
            if (!fs.existsSync(memeFolder)) {
                await message.reply('Meme folder path not found on server.');
                return;
            }

            // Read all files in the directory
            const files = fs.readdirSync(memeFolder);

            // Filter for image files
            const imageFiles = files.filter(file => {
                const extension = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.gif'].includes(extension);
            });

            if (imageFiles.length === 0) {
                await message.reply('Sorry, there are no images in the meme folder.');
                return;
            }

            // Select a random image from the list
            const randomImage = imageFiles[Math.floor(Math.random() * imageFiles.length)];
            const imagePath = path.join(memeFolder, randomImage);

            // Create and send the media object
            const media = MessageMedia.fromFilePath(imagePath);
            await client.sendMessage(message.from, media, { caption: 'Here is a random meme for you!' });
            console.log(`✅ Sent random meme from: ${imagePath}`);

        } catch (error) {
            console.error('❌ Failed to send meme:', error);
            await message.reply('Sorry, I could not access the meme folder or send the image. Please check the folder path and permissions.');
        }
        return;
    }

    // --- YOUR CUSTOM COMMANDS ---
    if (text === 'hi' || text === 'hello' || text === 'h' || text === 'hy' || text === 'hey') {
        replyWithMention(`
            Hi! 👋 Welcome to BetaCloudX. How can we help you today? 😊

හායි! 👋 BetaCloudX වෙත සාදරයෙන් පිළිගනිමු 😊
ඔබට අද අපෙන් කෙසේ උදව් කළ හැකිද? 💻✨

 *•Hi*
 *•Service*
 *•Contact*
 *•Group*
 *•Peyment Method*
 *•Owner*


> *BetaCloudX*`);
    }

    if (text === 'live walata' || text === 'live karanna') {
        replyWithMention(' 🤔 ඔයා ලයිව් කරනවද ?');
    }

    if (text === '😓' || text === '😭') {
        replyWithMention('🫠 ඇයි දුකෙන් වගේ');
    }

    if (text === 'ado') {
        replyWithMention('ඇයි dow');
    }

    if (text === 'mm') {
        replyWithMention('බකමූනෙක්ද ඔයා 🤦‍♂️');
    }

    if (text === 'gn all') {
        replyWithMention('අනේ ඉන්න යන්න එපා 😗');
    }

    if (text === 'aula' || text === 'awla' || text === 'awula' || text === 'aul' || text === 'ado aula') {
        replyWithMention('ඇයි අවුල මොකක්ද මටත් කියන්නකෝ');
    }

    if (text === 'ai') {
        replyWithMention('ඇයි බන් 🥲');
    }

    if (text === 'mk') {
        replyWithMention('මුකුත් නෑ හලෝ ඔහේ ඉන්නව ඉතින් මමත් 😎 ');
    }

    if (text === 'gm' || text === 'good morning') {
        replyWithMention('Good Morning! ☀️ ඔබට සුභ උදෑසනක් වේවා! 😊');
    }

    if (text === 'good night') {
        replyWithMention('Good night! 🌙 ඔබට සුභ රාත්‍රියක් වේවා! 😊');
    }

    if (text === 'bye') {
        replyWithMention('👋 බායි නැවත හමුවෙමු 😊');
    }

    // FIX: changed 'service' (already correct)
    if (text === 'service') {
        replyWithMention(`*BetaCloudX Service List 👇*

*•Whatsapp Permanent Band🪀*

*•Android Reset Virus⚠️*

*•Free Fire TopUp💎*

*•Fack Number method♾️*

*•InShot Pro Mod Apk🆕*

*•Car Parking Multiply Mod Apk🆕*

*•Traffic Racer Russian Mod Apk🆕*

*•Traffic Rider Mod apk🆕*`);
    }

    if (text === '1') {
        replyWithMention(` *Whatsapp Permanent Band👇*

Rs.1500

Contact The Owner

https://wa.me/94753603639


> *BetaCloudX*
            `);
    }

    if (text === '2') {
        replyWithMention(` *Android Reset Virus👇*

Rs.600


Contact The Owner

https://wa.me/94753603639


> *BetaCloudX*
            `);
    }

    if (text === '3') {
        replyWithMention(` *Free Fire TopUp👇*


Contact The Owner

https://wa.me/94753603639


> *BetaCloudX*
            `);
    }

    if (text === '4') {
        replyWithMention(` *Fack Number method👇*

Rs.1500


Contact The Owner

https://wa.me/94753603639


> *BetaCloudX*
            `);
    }

    if (text === '5') {
        replyWithMention(` *InShot Pro Mod👇*

Rs.300


Contact The Owner

https://wa.me/94753603639


> *BetaCloudX*
            `);
    }

    if (text === '6') {
        replyWithMention(` *Car Parking Multiply Mod👇*

Rs.400


Contact The Owner

https://wa.me/94753603639


> *BetaCloudX*
            `);
    }

    if (text === '7') {
        replyWithMention(` *Traffic Racer Russian Mod👇*

Rs.300


Contact The Owner

https://wa.me/94753603639


> *BetaCloudX*
            `);
    }

    if (text === '8') {
        replyWithMention(` *Car Parking Multiply Mod👇*

Rs.400


Contact The Owner

https://wa.me/94753603639


> *BetaCloudX*
            `);
    }

    // FIX: Changed 'Contact' to 'contact'
    if (text === 'contact') {
        replyWithMention(`*•Owner And Admin👇*

Owner - INDUWARA

+94753603639

Admin - BetaCloudX

+94766893639


> *BetaCloudX* `);
    }

    // FIX: Changed 'Group' to 'group'
    if (text === 'group') {
        replyWithMention(`*Group👇*

*•BetaCloudX Chat Group*

https://chat.whatsapp.com/Hhu5FAMgHstFaL0JoDDiez?mode=hqrc


> *BetaCloudX*`);
    }

    // FIX: Changed 'Peyment Method' to 'peyment method'
    if (text === 'peyment method' || text === 'payment method' || text === 'payment' || text === 'pay' || text === 'how to pay') {
        replyWithMention(`*Peyment Method👇*


*Pay On Bank ✅*

*Account Name* : *M.P.L.P.Pathirana*

*Account Number* : 102453392941 

*Bank Name* : SAMPATH BANK PLC

*Pay On Ez Cash ✅*

*Number* *0773608163*


> *BetaCloudX* `);
    }

    // FIX: Changed 'Owner' to 'owner'
    if (text === 'owner' || text === 'admin') {
        replyWithMention(`*•Owner And Admin👇*

Owner - INDUWARA

+94753603639

Admin - BetaCloudX

+94766893639


> *BetaCloudX*`);
    }

});

// START SERVER
// Using 0.0.0.0 to listen on all IPs, including localhost and 127.0.8.1
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n===================================================`);
    console.log(`✅ Web Server Running on: http://localhost:${PORT}`);
    console.log(`📱 Scan the QR code by opening the link above!`);
    console.log(`===================================================\n`);
    client.initialize();
});