const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const OWNER_ID = parseInt(process.env.OWNER_ID);
const WEB_URL = process.env.WEB_URL || 'https://zexzo-simpanfoto.vercel.app';

// ============ FUNGSI DATABASE VIA API ============
async function callApi(endpoint, method = 'GET', body = null) {
  const token = process.env.API_TOKEN || 'rahasia';
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${WEB_URL}/api/bot/${endpoint}`, options);
  return res.json();
}

// ============ COMMAND OWNER ============

// /start - Mulai bot
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  if (userId === OWNER_ID) {
    await ctx.reply(`✅ Bot aktif, Bos!\n\n📋 *Daftar Command Owner:*\n/listuser - Lihat semua user\n/delfoto [link] - Hapus foto dari link\n/mt - Maintenance ON\n/offmt - Maintenance OFF\n/bc [pesan] - Broadcast ke semua user\n/backup - Backup database\n\n📱 *Website:* ${WEB_URL}`, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(`✅ Bot aktif!\n\nKirim foto/video ke bot ini, nanti akan diteruskan ke owner.\n\n📱 *Website:* ${WEB_URL}`, { parse_mode: 'Markdown' });
  }
});

// /listuser - Lihat semua user (owner only)
bot.command('listuser', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Command ini hanya untuk owner!');
  
  await ctx.reply('📋 *Mengambil daftar user...*', { parse_mode: 'Markdown' });
  
  try {
    const users = await callApi('users', 'GET');
    if (users.length === 0) {
      return ctx.reply('Belum ada user yang terdaftar.');
    }
    let message = `📋 *DAFTAR USER* (${users.length} user)\n\n`;
    users.forEach((u, i) => {
      message += `${i+1}. @${u.username} | ${u.email}\n   📅 ${new Date(u.created_at).toLocaleDateString()}\n\n`;
    });
    if (message.length > 4000) {
      await ctx.replyWithDocument({ source: Buffer.from(message), filename: 'users.txt' });
    } else {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    ctx.reply('❌ Gagal mengambil daftar user!');
  }
});

// /delfoto [link] - Hapus foto dari link grup (owner only)
bot.command('delfoto', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Command ini hanya untuk owner!');
  
  const args = ctx.message.text.split(' ');
  const link = args[1];
  if (!link) {
    return ctx.reply('⚠️ Format: /delfoto https://t.me/grup/123');
  }
  
  // Extract message_id dari link
  const messageId = parseInt(link.split('/').pop());
  if (isNaN(messageId)) {
    return ctx.reply('❌ Link tidak valid!');
  }
  
  await ctx.reply(`🗑️ *Menghapus foto...*`, { parse_mode: 'Markdown' });
  
  try {
    const result = await callApi('delete-media', 'POST', { messageId, link });
    if (result.success) {
      ctx.reply('✅ Foto berhasil dihapus dari database!');
    } else {
      ctx.reply('❌ Gagal menghapus foto!');
    }
  } catch (error) {
    ctx.reply('❌ Error: ' + error.message);
  }
});

// /mt - Maintenance mode ON (owner only)
bot.command('mt', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Command ini hanya untuk owner!');
  
  await callApi('maintenance', 'POST', { active: true });
  ctx.reply('🔧 *MAINTENANCE MODE AKTIF*\n\nWebsite tidak bisa diakses sementara!\n\nGunakan /offmt untuk menonaktifkan.', { parse_mode: 'Markdown' });
});

// /offmt - Maintenance mode OFF (owner only)
bot.command('offmt', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Command ini hanya untuk owner!');
  
  await callApi('maintenance', 'POST', { active: false });
  ctx.reply('✅ *MAINTENANCE MODE NONAKTIF*\n\nWebsite sudah bisa diakses kembali!', { parse_mode: 'Markdown' });
});

// /bc [pesan] - Broadcast ke semua user (owner only)
bot.command('bc', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Command ini hanya untuk owner!');
  
  const message = ctx.message.text.replace('/bc ', '').trim();
  if (!message) {
    return ctx.reply('⚠️ Format: /bc [pesan broadcast]');
  }
  
  await ctx.reply(`📢 *Mengirim broadcast...*\n\nPesan: ${message}`, { parse_mode: 'Markdown' });
  
  try {
    const result = await callApi('broadcast', 'POST', { message });
    if (result.success) {
      ctx.reply(`✅ Broadcast berhasil dikirim ke semua user!\n\n📢 *Pesan:* ${message}`, { parse_mode: 'Markdown' });
    } else {
      ctx.reply('❌ Gagal mengirim broadcast!');
    }
  } catch (error) {
    ctx.reply('❌ Error: ' + error.message);
  }
});

// /backup - Backup database (owner only)
bot.command('backup', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Command ini hanya untuk owner!');
  
  await ctx.reply('📀 *Mengambil backup database...*', { parse_mode: 'Markdown' });
  
  try {
    const backup = await callApi('backup', 'GET');
    const backupText = JSON.stringify(backup, null, 2);
    await ctx.replyWithDocument({ 
      source: Buffer.from(backupText), 
      filename: `backup_${Date.now()}.json` 
    });
    ctx.reply('✅ Backup berhasil dikirim!');
  } catch (error) {
    ctx.reply('❌ Gagal mengambil backup!');
  }
});

// ============ HANDLE MEDIA DARI USER ============

// Handle foto dari user
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  const photo = ctx.message.photo.pop();
  const fileId = photo.file_id;
  const caption = ctx.message.caption || 'Tidak ada deskripsi';
  
  // Kirim ke owner
  await bot.telegram.sendPhoto(OWNER_ID, fileId, {
    caption: `📸 *Foto dari*: @${username}\n📝 *Deskripsi*: ${caption}\n🆔 *User ID*: ${userId}`,
    parse_mode: 'Markdown'
  });
  
  // Balas ke user
  ctx.reply(`✅ Foto sudah diteruskan ke owner, Bos!\n\n📝 *Deskripsi:* ${caption}`);
});

// Handle video dari user
bot.on('video', async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  const video = ctx.message.video;
  const fileId = video.file_id;
  const caption = ctx.message.caption || 'Tidak ada deskripsi';
  
  // Kirim ke owner
  await bot.telegram.sendVideo(OWNER_ID, fileId, {
    caption: `🎬 *Video dari*: @${username}\n📝 *Deskripsi*: ${caption}\n🆔 *User ID*: ${userId}`,
    parse_mode: 'Markdown'
  });
  
  // Balas ke user
  ctx.reply(`✅ Video sudah diteruskan ke owner, Bos!\n\n📝 *Deskripsi:* ${caption}`);
});

// Handle pesan teks dari user
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  const text = ctx.message.text;
  
  // Jangan balas command
  if (text.startsWith('/')) return;
  
  // Kirim ke owner
  await bot.telegram.sendMessage(OWNER_ID, 
    `💬 *Pesan dari*: @${username}\n📝 *Isi*: ${text}\n🆔 *User ID*: ${userId}`,
    { parse_mode: 'Markdown' }
  );
  
  // Balas ke user
  ctx.reply(`✅ Pesan sudah diteruskan ke owner!\n\n📝 *Pesan:* ${text}`);
});

// ============ ERROR HANDLER ============
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('⚠️ Terjadi kesalahan, coba lagi nanti.');
});

// ============ WEBHOOK UNTUK VERCE L ============
export default async (req, res) => {
  try {
    await bot.handleUpdate(req.body, res);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
};

// Set webhook
if (process.env.NODE_ENV === 'production') {
  const webhookUrl = `https://${process.env.VERCEL_URL}/api/bot`;
  bot.telegram.setWebhook(webhookUrl).then(() => {
    console.log(`✅ Webhook set to ${webhookUrl}`);
  }).catch(console.error);
}
