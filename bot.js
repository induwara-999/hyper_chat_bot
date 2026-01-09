const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const qrcode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 8600;

app.use(express.static(path.join(__dirname, 'public')));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    qrcode.toDataURL(qr, (err, url) => {
        if (!err) io.emit('qr', url);
    });
});

client.on('ready', () => {
    console.log('✅ Bot is Ready!');
    io.emit('ready', 'Bot is Connected!');
});

const WHITELISTED_DOMAINS = ["cloudnet.one", "youtube.com", "t.me", "whatsapp.com"];
const BANNED_WORDS = ["fuck", "shit", "bitch", "පකයා", "අම්මට"];

client.on('message', async (message) => {
    const text = message.body.toLowerCase();

    // Bad words/Links check
    if (BANNED_WORDS.some(word => text.includes(word))) {
        await message.delete(true);
        return;
    }

    // Commands
    if (text === 'hi' || text === 'hello') {
        message.reply('Hi! 👋 Welcome to BetaCloudX. Type *Service* to see what we offer.');
    }

    if (text === 'service') {
        message.reply("*BetaCloudX Services:*\n1. WhatsApp Band\n2. Android Reset Virus\n3. Free Fire TopUp\n\nType the number for more info.");
    }

    if (text === '1') {
        message.reply("WhatsApp Permanent Band: Rs.1500. Contact: https://wa.me/94753603639");
    }
    
    // Add more commands here as per your original list
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    client.initialize();
});
