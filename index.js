const { Telegraf } = require('telegraf');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = process.env.OWNER_ID; // Tumhari Telegram ID

if (!BOT_TOKEN) {
  console.log("BOT_TOKEN env variable missing!");
}

const bot = new Telegraf(BOT_TOKEN);
let waSock = null;

async function startWhatsApp(chatId) {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  waSock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  waSock.ev.on('creds.update', saveCreds);

  waSock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
      await bot.telegram.sendMessage(chatId, `WhatsApp QR aaya hai, isko scan karo:\n\n\`\`${qr}\`\`\``, { parse_mode: 'Markdown' });
      await bot.telegram.sendMessage(chatId, "WhatsApp > Linked Devices > Link a Device se scan karo");
    }
    if (connection === 'open') {
      await bot.telegram.sendMessage(chatId, "✅ WhatsApp Linked! Ab saare messages Telegram par aayenge.");
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      if (shouldReconnect) startWhatsApp(chatId);
      else await bot.telegram.sendMessage(chatId, "❌ WhatsApp logout ho gaya. /link dobara bhejo");
    }
  });

  waSock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.pushName || msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "[Media/File]";
    await bot.telegram.sendMessage(chatId, `📩 *${from}*:\n${text}`, { parse_mode: 'Markdown' });
  });
}

bot.start((ctx) => ctx.reply("Bot On Hai!\n/link - WhatsApp connect karne ke liye\n/status - check karne ke liye"));
bot.command('link', (ctx) => {
  ctx.reply("QR generate ho raha hai...");
  startWhatsApp(ctx.chat.id);
});
bot.command('status', (ctx) => {
  ctx.reply(waSock ? "WhatsApp Connected ✅" : "Not Connected ❌ - /link bhejo");
});

bot.launch();
console.log("Telegram Bot Started");
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
