// Creanimasi Hub — Telegram Bot untuk laporan harian tim
// Token disimpan di env var TELEGRAM_BOT_TOKEN

const { Pool } = require('pg');

const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const DB_URL  = process.env.DATABASE_URL;
const API_URL = `https://api.telegram.org/bot${TOKEN}`;

if (!TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN tidak di-set'); process.exit(1); }

const pool = new Pool({ connectionString: DB_URL });

// ── PARSER LAPORAN ─────────────────────────────────────────────────────────────
function parseLaporan(text) {
  const lines  = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const result = {
    nama: '', akun: '', tanggal: null,
    jam_mulai: null, jam_selesai: null, aktivitas: '',
    yang_didapat: '', impresi: '', click: '', cr: '',
    chat_masuk: '', order_masuk: '', complete_order: '',
    active_order: 0, detail_order: {},
    raw_text: text,
  };

  let section = 'header';
  const sectionBuffer = { yang_didapat: [], capaian: [], chat_masuk: [], order: [], complete_order: [] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lc   = line.toLowerCase();

    // ── Header: nama anggota (baris 1)
    if (i === 0 && !lc.startsWith('akun') && !lc.startsWith('nama')) {
      result.nama = line; continue;
    }

    // ── Akun: Creanimasi / Jelia / Creillustra
    if (lc.startsWith('akun:') || lc.startsWith('akun :')) {
      result.akun = line.replace(/akun\s*:/i, '').trim(); continue;
    }

    // ── Tanggal (Rabu, 4 Juni 2026)
    if (/^(senin|selasa|rabu|kamis|jumat|sabtu|minggu),?\s+\d/i.test(line)) {
      try {
        const parts = line.replace(/^[a-z]+,?\s*/i, '').trim();
        const bulanMap = { januari:0,februari:1,maret:2,april:3,mei:4,juni:5,
          juli:6,agustus:7,september:8,oktober:9,november:10,desember:11 };
        const [tgl, bln, thn] = parts.split(/\s+/);
        const bulanIdx = bulanMap[bln?.toLowerCase()];
        if (bulanIdx !== undefined) result.tanggal = new Date(parseInt(thn), bulanIdx, parseInt(tgl));
      } catch {}
      continue;
    }

    // ── Jam kerja: 09.00-16.30: aktivitas
    const jamMatch = line.match(/^(\d{1,2}[.:]\d{2})\s*[-–]\s*(\d{1,2}[.:]\d{2})\s*[:.]?\s*(.*)/);
    if (jamMatch) {
      result.jam_mulai  = jamMatch[1].replace('.', ':');
      result.jam_selesai = jamMatch[2].replace('.', ':');
      result.aktivitas  = jamMatch[3] || '';
      section = 'aktivitas'; continue;
    }

    // ── Section markers
    if (lc.includes('yang di dapat') || lc.includes('yang didapat') || lc === 'yang di dapat hari ini:') {
      section = 'yang_didapat'; continue;
    }
    if (lc.includes('capaian hari ini') || lc === 'capaian:') {
      section = 'capaian'; continue;
    }
    if (lc.startsWith('chat masuk') || lc === 'chat masuk:') {
      section = 'chat_masuk'; continue;
    }
    if (/^complete order\s*:/i.test(line) || lc === 'complete order :' || lc === 'complete order:') {
      section = 'complete_order'; continue;
    }
    if (/^order\s*:/i.test(line) || lc === 'order :') {
      section = 'order'; continue;
    }

    // ── Isi per section
    if (section === 'yang_didapat') {
      sectionBuffer.yang_didapat.push(line); continue;
    }

    if (section === 'capaian') {
      const impresi = line.match(/impresi\s*[=:]\s*(.+)/i);
      const click   = line.match(/click\s*[=:]\s*(.+)/i);
      const cr      = line.match(/cr\s*[=:]\s*(.+)/i);
      if (impresi)  result.impresi = impresi[1].trim();
      else if (click) result.click = click[1].trim();
      else if (cr)    result.cr    = cr[1].trim();
      else sectionBuffer.capaian.push(line);
      continue;
    }

    if (section === 'chat_masuk') {
      sectionBuffer.chat_masuk.push(line); continue;
    }

    if (section === 'order') {
      sectionBuffer.order.push(line); continue;
    }

    if (section === 'complete_order') {
      sectionBuffer.complete_order.push(line); continue;
    }

    // ── Detail order (active order N, ar filter: 1, dst)
    const activeMatch = line.match(/active\s+order\s+(\d+)/i);
    if (activeMatch) { result.active_order = parseInt(activeMatch[1]); section = 'detail_order'; continue; }

    if (section === 'detail_order') {
      const m = line.match(/^(.+?)\s*[=:]\s*(\d+)/);
      if (m) result.detail_order[m[1].trim().toLowerCase()] = parseInt(m[2]);
      continue;
    }
  }

  // Gabungkan buffer sections
  result.yang_didapat  = sectionBuffer.yang_didapat.join('\n').trim();
  result.chat_masuk    = sectionBuffer.chat_masuk.join('\n').trim();
  result.order_masuk   = sectionBuffer.order.join('\n').trim();
  result.complete_order = sectionBuffer.complete_order.join('\n').trim();

  return result;
}

// ── SIMPAN KE DB ───────────────────────────────────────────────────────────────
async function simpanLaporan(data, telegramUser) {
  const tgl = data.tanggal
    ? `${data.tanggal.getFullYear()}-${String(data.tanggal.getMonth()+1).padStart(2,'0')}-${String(data.tanggal.getDate()).padStart(2,'0')}`
    : new Date().toISOString().slice(0,10);

  const r = await pool.query(`
    INSERT INTO laporan_harian
      (nama, akun, tanggal, jam_mulai, jam_selesai, aktivitas,
       yang_didapat, impresi, click, cr, chat_masuk,
       order_masuk, complete_order, active_order, detail_order, raw_text, telegram_user)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING id
  `, [
    data.nama, data.akun, tgl,
    data.jam_mulai, data.jam_selesai, data.aktivitas,
    data.yang_didapat, data.impresi, data.click, data.cr,
    data.chat_masuk, data.order_masuk, data.complete_order,
    data.active_order, JSON.stringify(data.detail_order),
    data.raw_text, telegramUser,
  ]);
  return r.rows[0].id;
}

// ── KIRIM PESAN TELEGRAM ───────────────────────────────────────────────────────
async function sendMessage(chatId, text, parseMode = 'HTML') {
  const fetch = (await import('node-fetch')).default;
  await fetch(`${API_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
}

// ── HANDLE UPDATE DARI TELEGRAM ────────────────────────────────────────────────
async function handleUpdate(update) {
  const msg = update.message || update.channel_post;
  if (!msg?.text) return;

  const chatId    = msg.chat.id;
  const text      = msg.text.trim();
  const fromUser  = msg.from?.username || msg.from?.first_name || 'unknown';

  // Abaikan command
  if (text.startsWith('/')) {
    if (text === '/start' || text === '/help') {
      await sendMessage(chatId,
        `👋 <b>Creanimasi Hub Bot</b>\n\nKirim laporan harian kamu langsung ke sini atau forward dari grup.\n\nFormat:\n<code>Nama Lengkap\nAkun: Creanimasi\nRabu, 4 Juni 2026\n09.00-16.30: aktivitas...\n\nyang di dapat hari ini:\n...\n\nCapaian hari ini:\nImpresi = 14k\nClick = 164\nCr = 0,03%\n\nChat Masuk:\n...\n\nactive order 10\nar filter: 1</code>`
      );
    }
    return;
  }

  // Coba parse sebagai laporan
  const parsed = parseLaporan(text);

  if (!parsed.nama) {
    await sendMessage(chatId,
      '⚠️ Format laporan tidak dikenali. Pastikan baris pertama adalah nama kamu.\n\nKirim /help untuk melihat format yang benar.'
    );
    return;
  }

  try {
    const id = await simpanLaporan(parsed, fromUser);
    const tglStr = parsed.tanggal
      ? parsed.tanggal.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' })
      : 'hari ini';

    await sendMessage(chatId,
      `✅ <b>Laporan berhasil dicatat!</b>\n\n` +
      `👤 <b>${parsed.nama}</b>\n` +
      `🏢 Akun: ${parsed.akun || '-'}\n` +
      `📅 ${tglStr}\n` +
      `⏰ ${parsed.jam_mulai || '-'} – ${parsed.jam_selesai || '-'}\n` +
      `📊 Active order: ${parsed.active_order}\n` +
      (parsed.impresi ? `👁 Impresi: ${parsed.impresi} | Click: ${parsed.click} | CR: ${parsed.cr}\n` : '') +
      `\n🔗 Lihat di hub.creanimasi.com/laporan-harian (ID: #${id})`
    );

    console.log(`[BOT] ✅ Laporan #${id} dari ${parsed.nama} (${fromUser}) disimpan`);
  } catch (err) {
    console.error('[BOT] ❌ Gagal simpan:', err.message);
    await sendMessage(chatId, `❌ Gagal menyimpan laporan: ${err.message}`);
  }
}

// ── POLLING (long polling) ─────────────────────────────────────────────────────
let offset = 0;

async function poll() {
  const fetch = (await import('node-fetch')).default;
  try {
    const r = await fetch(`${API_URL}/getUpdates?timeout=30&offset=${offset}`);
    const data = await r.json();

    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        await handleUpdate(update).catch(e => console.error('[BOT] Handle error:', e.message));
      }
    }
  } catch (e) {
    console.error('[BOT] Poll error:', e.message);
  }
  setTimeout(poll, 1000);
}

console.log('[BOT] 🚀 Creanimasi Hub Bot starting...');
poll();
