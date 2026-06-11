// ══════════════════════════════════════════════════
// CREANIMASI INTERNAL HUB — Backend API Routes
// Tambahkan ke server Node.js CRM_Creanimasi yang ada
// File: routes/hub.routes.js
// ══════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const hubPool = pool;
const JWT_SECRET = process.env.HUB_JWT_SECRET;
if (!JWT_SECRET) throw new Error('HUB_JWT_SECRET environment variable tidak di-set');

// ── HELPER ────────────────────────────────────────
const query = (text, params) => pool.query(text, params);

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token tidak ada' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid' });
  }
}

// Ekstrak pesan asli member dari catatan_mentor (pisahkan dari admin reply)
function extractPesanMember(cm) {
  if (!cm) return '';
  const SEP = '\n[ADMIN_REPLY]\n';
  const idx = cm.indexOf(SEP);
  if (idx !== -1) return cm.slice(0, idx).trim();
  if (cm.startsWith('[ADMIN_REPLY]')) return ''; // reply tanpa pesan asli (record lama)
  return cm.trim();
}

function extractReplyAdmin(cm) {
  if (!cm) return '';
  const SEP = '\n[ADMIN_REPLY]\n';
  const idx = cm.indexOf(SEP);
  if (idx !== -1) return cm.slice(idx + SEP.length).trim();
  if (cm.startsWith('[ADMIN_REPLY]\n')) return cm.slice('[ADMIN_REPLY]\n'.length).trim();
  if (cm.startsWith('[ADMIN_REPLY] ')) return cm.slice('[ADMIN_REPLY] '.length).trim(); // format lama
  return '';
}

// ── AUTH ──────────────────────────────────────────

// POST /api/hub/auth/login
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  try {
    const result = await query(
      `SELECT * FROM hub_users WHERE username = $1 AND aktif = TRUE`, [username]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Username atau password salah' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Username atau password salah' });

    const timR = await pool.query(`SELECT divisi FROM tim WHERE nama = $1 LIMIT 1`, [user.nama]);
    const divisi = timR.rows[0]?.divisi || null;

    const token = jwt.sign(
      { id: user.id, nama: user.nama, username: user.username, role: user.role, divisi },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ success: true, token, user: { id: user.id, nama: user.nama, username: user.username, role: user.role, divisi, tema: user.tema || 'dark' } });
  } catch (err) {
    res.status(500).json({ error: 'Gagal login' });
  }
});

// ── GLOBAL AUTH GUARD ─────────────────────────────
// Semua route wajib login KECUALI /auth/login
router.use((req, res, next) => {
  if (req.path === '/auth/login') return next(); // hanya login yang boleh tanpa token
  return authMiddleware(req, res, next);
});

// GET /api/hub/auth/me
router.get('/auth/me', async (req, res) => {
  try {
    const r = await hubPool.query('SELECT tema FROM hub_users WHERE id=$1', [req.user.id]);
    const tema = r.rows[0]?.tema || 'dark';
    res.json({ success: true, user: { ...req.user, tema } });
  } catch {
    res.json({ success: true, user: req.user });
  }
});

// PATCH /api/hub/auth/password — ganti password
router.patch('/auth/password', authMiddleware, async (req, res) => {
  const { password_lama, password_baru } = req.body;
  if (!password_lama || !password_baru)
    return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
  if (password_baru.length < 8)
    return res.status(400).json({ error: 'Password baru minimal 8 karakter' });
  try {
    const result = await query(`SELECT * FROM hub_users WHERE id = $1`, [req.user.id]);
    const user = result.rows[0];
    const match = await bcrypt.compare(password_lama, user.password);
    if (!match) return res.status(400).json({ error: 'Password lama salah' });
    const hashed = await bcrypt.hash(password_baru, 10);
    await query(`UPDATE hub_users SET password = $1 WHERE id = $2`, [hashed, req.user.id]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Gagal mengubah password' }); }
});

// GET /api/hub/profiling/me — profiling terbaru milik user yang login
router.get('/profiling/me', authMiddleware, async (req, res) => {
  const TABLE_MAP = { Admin:'profiling_admin', PM:'profiling_pm', Illustrator:'profiling_illustrator', Rigger:'profiling_rigger', '3D Modeler':'profiling_3d' };
  const DIVISI_MAP = { admin:'Admin', pm:'PM', illustrator:'Illustrator', rigger:'Rigger', '3d':'3D Modeler' };
  try {
    // Cari di semua tabel berdasarkan nama user
    const nama = req.user.nama;
    for (const [, table] of Object.entries(TABLE_MAP)) {
      const r = await query(`SELECT * FROM ${table} WHERE nama = $1 ORDER BY created_at DESC LIMIT 1`, [nama]);
      if (r.rows.length > 0) return res.json({ success: true, data: r.rows[0] });
    }
    res.json({ success: true, data: null });
  } catch { res.status(500).json({ error: 'Gagal mengambil profiling' }); }
});

// ── JURNAL MINGGUAN ───────────────────────────────

// POST /api/hub/jurnal — simpan jurnal baru
router.post('/jurnal', async (req, res) => {
  try {
    const {
      divisi, level_karier, tanggal_jurnal,
      pencapaian_1, pencapaian_2, pencapaian_3,
      hambatan, pelajaran, target_depan,
      mood, skor_karya, skor_waktu, skor_komunikasi, skor_skill,
      catatan_mentor
    } = req.body;

    const nama = req.user.nama;
    if (!mood) {
      return res.status(400).json({ error: 'Mood wajib diisi' });
    }

    const result = await query(
      `INSERT INTO jurnal_mingguan
        (nama, divisi, level_karier, tanggal_jurnal,
         pencapaian_1, pencapaian_2, pencapaian_3,
         hambatan, pelajaran, target_depan,
         mood, skor_karya, skor_waktu, skor_komunikasi, skor_skill,
         catatan_mentor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [nama, divisi, level_karier, tanggal_jurnal || new Date(),
       pencapaian_1, pencapaian_2, pencapaian_3,
       hambatan, pelajaran, target_depan,
       mood, skor_karya, skor_waktu, skor_komunikasi, skor_skill,
       catatan_mentor]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error POST /jurnal:', err);
    res.status(500).json({ error: 'Gagal menyimpan jurnal' });
  }
});

// GET /api/hub/jurnal — semua jurnal (untuk dashboard)
router.get('/jurnal', async (req, res) => {
  try {
    const { nama, limit = 50 } = req.query;
    const cap = Math.min(parseInt(limit) || 50, 200);
    let q = `SELECT * FROM jurnal_mingguan`;
    const params = [];
    if (nama) {
      q += ` WHERE nama = $1`;
      params.push(nama);
    }
    q += ` ORDER BY tanggal_jurnal DESC, created_at DESC LIMIT $${params.length + 1}`;
    params.push(cap);

    const result = await query(q, params);
    res.json({ success: true, data: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data jurnal' });
  }
});

// GET /api/hub/jurnal/stats — statistik untuk dashboard
router.get('/jurnal/stats', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM v_jurnal_stats ORDER BY nama`);
    const mingguIni = result.rows.filter(r => r.isi_minggu_ini).length;
    const belum = (await query(`SELECT DISTINCT nama FROM profiling_admin UNION SELECT nama FROM profiling_pm UNION SELECT nama FROM profiling_illustrator UNION SELECT nama FROM profiling_rigger UNION SELECT nama FROM profiling_3d`)).rowCount - mingguIni;

    res.json({
      success: true,
      stats: result.rows,
      total_isi: mingguIni,
      total_belum: Math.max(0, belum),
      avg_mood: result.rows.length
        ? Math.round(result.rows.reduce((s, r) => s + parseFloat(r.avg_mood || 0), 0) / result.rows.length * 10) / 10
        : 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil statistik jurnal' });
  }
});

// ── PROFILING ─────────────────────────────────────

// POST /api/hub/profiling/:divisi — simpan profiling
router.post('/profiling/:divisi', async (req, res) => {
  const { divisi } = req.params;
  const TABLE_MAP = {
    admin: 'profiling_admin',
    pm: 'profiling_pm',
    illustrator: 'profiling_illustrator',
    rigger: 'profiling_rigger',
    '3d': 'profiling_3d',
  };

  const table = TABLE_MAP[divisi.toLowerCase()];
  if (!table) return res.status(400).json({ error: 'Divisi tidak valid' });

  try {
    // Hanya izinkan nama kolom yang aman: huruf kecil, angka, underscore saja
    const fields = Object.keys(req.body).filter(k =>
      k !== 'id' && k !== 'created_at' && /^[a-z][a-z0-9_]*$/.test(k)
    );
    if (fields.length === 0) return res.status(400).json({ error: 'Tidak ada field valid yang dikirim' });
    const values = fields.map(f => req.body[f]);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

    const result = await query(
      `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})
       ON CONFLICT DO NOTHING RETURNING *`,
      values
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(`Error POST /profiling/${divisi}:`, err);
    res.status(500).json({ error: 'Gagal menyimpan profiling' });
  }
});

// GET /api/hub/profiling/all — semua profiling untuk dashboard
router.get('/profiling/all', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM v_profiling_all ORDER BY divisi, nama`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data profiling' });
  }
});

// GET /api/hub/profiling/:divisi — profiling per divisi
router.get('/profiling/:divisi', async (req, res) => {
  const TABLE_MAP = {
    admin: 'profiling_admin', pm: 'profiling_pm',
    illustrator: 'profiling_illustrator', rigger: 'profiling_rigger', '3d': 'profiling_3d'
  };
  const table = TABLE_MAP[req.params.divisi.toLowerCase()];
  if (!table) return res.status(400).json({ error: 'Divisi tidak valid' });

  try {
    const result = await query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data profiling' });
  }
});

// ── REWARD ────────────────────────────────────────

// POST /api/hub/reward — catat reward baru
router.post('/reward', async (req, res) => {
  try {
    const { tanggal, nama, kategori, trigger, bentuk, nominal, catatan } = req.body;
    const result = await query(
      `INSERT INTO reward_tracking (tanggal, nama, kategori, trigger, bentuk, nominal, catatan)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tanggal || new Date(), nama, kategori, trigger, bentuk, nominal || 0, catatan]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan reward' });
  }
});

// GET /api/hub/reward — semua reward
router.get('/reward', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM reward_tracking ORDER BY tanggal DESC`);
    const totalBulanIni = await query(
      `SELECT COALESCE(SUM(nominal),0) as total FROM reward_tracking
       WHERE DATE_TRUNC('month', tanggal) = DATE_TRUNC('month', NOW())`
    );
    res.json({
      success: true,
      data: result.rows,
      total_bulan_ini: parseInt(totalBulanIni.rows[0].total)
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data reward' });
  }
});

// PATCH /api/hub/reward/:id/status — update status reward
router.patch('/reward/:id/status', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  try {
    const result = await query(
      `UPDATE reward_tracking SET status = $1 WHERE id = $2 RETURNING *`,
      [req.body.status, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal update status reward' });
  }
});

// ── SKB ───────────────────────────────────────────

// POST /api/hub/skb — submit SKB baru
router.post('/skb', async (req, res) => {
  try {
    const {
      tipe, nama, divisi, level, judul, deskripsi,
      latar_belakang, tujuan, output, timeline,
      kebutuhan, risiko, ukuran_sukses, komitmen
    } = req.body;

    if (!judul || !nama || !tipe) {
      return res.status(400).json({ error: 'Tipe, nama, dan judul wajib diisi' });
    }

    const result = await query(
      `INSERT INTO skb (tipe, nama, divisi, level, judul, deskripsi,
         latar_belakang, tujuan, output, timeline, kebutuhan,
         risiko, ukuran_sukses, komitmen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [tipe, nama, divisi, level, judul, deskripsi,
       latar_belakang, tujuan, output, timeline, kebutuhan,
       risiko, ukuran_sukses, komitmen]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan SKB' });
  }
});

// GET /api/hub/skb — semua SKB
router.get('/skb', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM skb ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data SKB' });
  }
});

// PATCH /api/hub/skb/:id — update status SKB
router.patch('/skb/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  try {
    const { status, catatan_review, reviewer } = req.body;
    const result = await query(
      `UPDATE skb SET status=$1, catatan_review=$2, reviewer=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [status, catatan_review, reviewer, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal update SKB' });
  }
});

// ── MANAJEMEN TIM ─────────────────────────────────

// Auto-migration: tambah kolom profiling ke tabel tim + backfill 11 anggota awal
pool.query(`
  ALTER TABLE tim
    ADD COLUMN IF NOT EXISTS status     VARCHAR(50)  DEFAULT 'Aktif',
    ADD COLUMN IF NOT EXISTS kriteria   INT          DEFAULT 3,
    ADD COLUMN IF NOT EXISTS kepuasan   INT          DEFAULT 7,
    ADD COLUMN IF NOT EXISTS bergabung  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS semangat   TEXT         DEFAULT '-',
    ADD COLUMN IF NOT EXISTS energi     TEXT         DEFAULT '-',
    ADD COLUMN IF NOT EXISTS target     TEXT         DEFAULT '-',
    ADD COLUMN IF NOT EXISTS memimpin   VARCHAR(100) DEFAULT 'Belum tertarik saat ini',
    ADD COLUMN IF NOT EXISTS skill      INT          DEFAULT 3,
    ADD COLUMN IF NOT EXISTS komunikasi INT          DEFAULT 3,
    ADD COLUMN IF NOT EXISTS mentor     VARCHAR(100) DEFAULT '-'
`).then(() => pool.query(`UPDATE tim SET bergabung = TO_CHAR(created_at, 'DD/MM/YYYY') WHERE bergabung IS NULL`))
  .then(() => pool.query(`
    UPDATE tim SET status=d.status, kriteria=d.kriteria, kepuasan=d.kepuasan, bergabung=d.bergabung,
      semangat=d.semangat, energi=d.energi, target=d.target, memimpin=d.memimpin,
      skill=d.skill, komunikasi=d.komunikasi, mentor=d.mentor
    FROM (VALUES
      ('Ariel Tegar','Aktif',5,10,'21/09/2025','Mencapai tujuan dan impian awal','Handle klien awam teknis','Memiliki beberapa unit usaha sendiri','Ya, sangat tertarik',4,5,'-'),
      ('Ryan Cavallera','Aktif',4,8,'25/04/2025','Mendapatkan ilmu baru dan bonus','Revisi berulang, komplain klien','Memimpin 1 tim dengan 2 akun marketplace','Ya, sangat tertarik',4,5,'-'),
      ('Nanda Cahya Bintang','Probation',3,5,'27/03/2026','Uang dan pemahaman baru','Sinyal dan device ngelag','Tempat yang lebih tinggi lagi','Ya, sangat tertarik',3,4,'Ariel Tegar'),
      ('Dina Syavina','Aktif',3,7,'30/08/2023','Uang','Ngomong sama orang','Admin studio sendiri','Mungkin kalau sudah siap',3,2,'-'),
      ('Tsania Lathifa','Probation',4,7,'02/03/2026','Gajian dan ketemu teman-teman','Ngerti mood orang lain','Berkembang skill dan karier','Ya, sangat tertarik',4,5,'Dina Syavina'),
      ('Ahmad Fathurrahman','Aktif',4,8,'05/01/2025','Lingkungan dan pikiran tenang','Revisi tanpa kejelasan','Menetap dan kembangkan skill','Mungkin kalau sudah siap',5,4,'-'),
      ('Raynar Harits','Aktif',3,7,'13/04/2025','Lingkungan','Jobdesk yang over','Masih di Semarang karena kuliah','Mungkin kalau sudah siap',3,4,'-'),
      ('Aditya Tri Prakoso','Aktif',3,7,'21/06/2025','Uang','Ngelag dan internet lemot','Improve skill, punya passive income','Ya, sangat tertarik',4,3,'-'),
      ('Noval Faqihudin Zaky','Aktif',3,8,'01/01/2025','Entertain dan ketemu teman','Revisi yang sudah lewat stepnya','Illustrator yang lebih baik','Mungkin kalau sudah siap',4,5,'-'),
      ('Galang Ramadhan','Aktif',2,8,'24/02/2025','Mendengarkan musik','Membersihkan dapur','Di sini (Creanimasi)','Belum tertarik saat ini',3,5,'-'),
      ('Ridho Ramadhan','Aktif',2,5,'04/03/2025','Instruksi jelas','Tidak ada instruksi','Intel Arc B580','Mungkin kalau sudah siap',4,3,'-')
    ) AS d(nama,status,kriteria,kepuasan,bergabung,semangat,energi,target,memimpin,skill,komunikasi,mentor)
    WHERE tim.nama = d.nama AND tim.kriteria = 3 AND tim.skill = 3 AND tim.komunikasi = 3 AND tim.kepuasan = 7
  `)).catch(e => console.error('tim profiling migration error:', e.message));

// GET /api/hub/tim — semua anggota aktif
router.get('/tim', async (req, res) => {
  try {
    const { semua } = req.query;
    const q = semua
      ? `SELECT * FROM tim ORDER BY divisi, nama`
      : `SELECT * FROM tim WHERE aktif = TRUE ORDER BY divisi, nama`;
    const result = await query(q);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data tim' });
  }
});

// POST /api/hub/tim — tambah anggota baru
router.post('/tim', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  try {
    const { nama, divisi, level, tipe } = req.body;
    if (!nama || !divisi) return res.status(400).json({ error: 'Nama dan divisi wajib diisi' });
    const result = await query(
      `INSERT INTO tim (nama, divisi, level, tipe) VALUES ($1,$2,$3,$4) RETURNING *`,
      [nama, divisi, level || '', tipe || '']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah anggota tim' });
  }
});

// PATCH /api/hub/tim/:id — edit anggota
router.patch('/tim/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  try {
    const { nama, divisi, level, tipe, aktif } = req.body;
    const result = await query(
      `UPDATE tim SET nama=$1, divisi=$2, level=$3, tipe=$4, aktif=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [nama, divisi, level, tipe, aktif !== undefined ? aktif : true, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate data tim' });
  }
});

// DELETE /api/hub/tim/:id — nonaktifkan anggota (soft delete)
router.delete('/tim/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  try {
    const result = await query(
      `UPDATE tim SET aktif=FALSE, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menonaktifkan anggota' });
  }
});

// PATCH /api/hub/tim/:id/aktifkan — aktifkan kembali anggota nonaktif
router.patch('/tim/:id/aktifkan', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  try {
    const result = await query(
      `UPDATE tim SET aktif=TRUE, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengaktifkan anggota' });
  }
});

// POST /api/hub/tim/:id/buat-akun — buat akun login untuk anggota yang belum punya akses
router.post('/tim/:id/buat-akun', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi' });
  if (password.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter' });
  try {
    const timR = await query('SELECT nama FROM tim WHERE id=$1', [req.params.id]);
    if (!timR.rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
    const nama = timR.rows[0].nama;

    const exists = await query('SELECT id FROM hub_users WHERE nama=$1 OR username=$2', [nama, username]);
    if (exists.rows.length) return res.status(409).json({ error: 'Anggota ini sudah punya akun atau username sudah dipakai' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO hub_users (nama, username, password, role) VALUES ($1,$2,$3,$4) RETURNING id, nama, username, role`,
      [nama, username, hashed, role === 'admin' ? 'admin' : 'member']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal membuat akun' });
  }
});

// ── MODUL PROGRESS ───────────────────────────────

// GET /api/hub/modul — semua progress (bisa filter ?modul_id=admin)
router.get('/modul', async (req, res) => {
  try {
    const { modul_id } = req.query;
    let q = `SELECT * FROM modul_progress`;
    const params = [];
    if (modul_id) { q += ` WHERE modul_id = $1`; params.push(modul_id); }
    q += ` ORDER BY modul_id, nama`;
    const result = await query(q, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data modul' });
  }
});

// PATCH /api/hub/modul/:nama/:modul_id — update done untuk satu anggota
router.patch('/modul/:nama/:modul_id', async (req, res) => {
  try {
    const { done } = req.body;
    const result = await query(
      `UPDATE modul_progress SET done = $1, updated_at = NOW()
       WHERE nama = $2 AND modul_id = $3 RETURNING *`,
      [done, req.params.nama, req.params.modul_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Data tidak ditemukan' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal update progress modul' });
  }
});

// ── DASHBOARD STATS ───────────────────────────────

// GET /api/hub/dashboard — ringkasan untuk dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [jurnal, profiling, reward, skb] = await Promise.all([
      query(`SELECT COUNT(*) as total,
               SUM(CASE WHEN tanggal_jurnal >= CURRENT_DATE-7 THEN 1 ELSE 0 END) as minggu_ini,
               ROUND(AVG(CASE WHEN tanggal_jurnal >= CURRENT_DATE-7 THEN mood END),1) as avg_mood
             FROM jurnal_mingguan`),
      query(`SELECT COUNT(*) as total FROM v_profiling_all`),
      query(`SELECT COALESCE(SUM(nominal),0) as total_bulan_ini
             FROM reward_tracking
             WHERE DATE_TRUNC('month',tanggal)=DATE_TRUNC('month',NOW())`),
      query(`SELECT status, COUNT(*) as total FROM skb GROUP BY status`),
    ]);

    res.json({
      success: true,
      jurnal: {
        total: parseInt(jurnal.rows[0].total),
        minggu_ini: parseInt(jurnal.rows[0].minggu_ini || 0),
        avg_mood: parseFloat(jurnal.rows[0].avg_mood || 0),
      },
      profiling: { total: parseInt(profiling.rows[0].total) },
      reward: { total_bulan_ini: parseInt(reward.rows[0].total_bulan_ini) },
      skb: skb.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil statistik dashboard' });
  }
});

// ── WORKSHOP KEHADIRAN ────────────────────────────────────────────────────────
router.get('/workshop', authMiddleware, async (req, res) => {
  try {
    const result = await hubPool.query(
      'SELECT nama, layer_id, sesi_idx, hadir FROM workshop_kehadiran ORDER BY nama, layer_id, sesi_idx'
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data workshop' });
  }
});

router.patch('/workshop/:nama/:layer_id/:sesi_idx', authMiddleware, async (req, res) => {
  const { nama, layer_id, sesi_idx } = req.params;
  if (req.user.role !== 'admin' && req.user.nama !== nama)
    return res.status(403).json({ error: 'Tidak bisa update kehadiran orang lain' });
  const { hadir } = req.body;
  try {
    await hubPool.query(`
      INSERT INTO workshop_kehadiran (nama, layer_id, sesi_idx, hadir, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (nama, layer_id, sesi_idx)
      DO UPDATE SET hadir = $4, updated_at = NOW()
    `, [nama, layer_id, parseInt(sesi_idx), hadir]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal update kehadiran' });
  }
});

// ── FRIDAY WIN ────────────────────────────────────────────────────────────────
router.get('/friday-win', authMiddleware, async (req, res) => {
  try {
    const result = await hubPool.query('SELECT * FROM friday_win ORDER BY tanggal DESC, id DESC LIMIT 20');
    res.json({ data: result.rows });
  } catch { res.status(500).json({ error: 'Gagal mengambil Friday Win' }); }
});

router.post('/friday-win', authMiddleware, async (req, res) => {
  const { tanggal, headline, penerima, pesan } = req.body;
  try {
    const r = await hubPool.query(
      `INSERT INTO friday_win (tanggal, posted_by, headline, penerima, pesan)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tanggal || new Date().toISOString().slice(0,10), req.user?.nama || 'Admin', headline, penerima, pesan]
    );
    res.json({ data: r.rows[0] });
  } catch { res.status(500).json({ error: 'Gagal simpan Friday Win' }); }
});

router.delete('/friday-win/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  try {
    await hubPool.query('DELETE FROM friday_win WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal hapus' }); }
});

// ── SESI 1-ON-1 ───────────────────────────────────────────────────────────────
router.get('/sesi-1on1', authMiddleware, async (req, res) => {
  try {
    const result = await hubPool.query('SELECT * FROM sesi_1on1 ORDER BY tanggal DESC, id DESC');
    res.json({ data: result.rows });
  } catch { res.status(500).json({ error: 'Gagal mengambil sesi 1-on-1' }); }
});

router.post('/sesi-1on1', authMiddleware, async (req, res) => {
  const { tanggal, anggota, tipe, durasi_menit, ringkasan, tindak_lanjut, mood_sebelum, mood_sesudah } = req.body;
  try {
    const r = await hubPool.query(
      `INSERT INTO sesi_1on1 (tanggal, anggota, tipe, durasi_menit, ringkasan, tindak_lanjut, mood_sebelum, mood_sesudah, host)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tanggal, anggota, tipe, durasi_menit||30, ringkasan, tindak_lanjut, mood_sebelum, mood_sesudah, req.user?.nama||'Admin']
    );
    res.json({ data: r.rows[0] });
  } catch { res.status(500).json({ error: 'Gagal simpan sesi 1-on-1' }); }
});

// PATCH /api/hub/tim/:id/reset-password — admin reset password member
router.patch('/tim/:id/reset-password', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { password_baru } = req.body;
  // Jika tidak ada password_baru, generate temp password acak
  const pw = password_baru || Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase();
  try {
    const timR = await hubPool.query('SELECT nama FROM tim WHERE id=$1', [req.params.id]);
    if (!timR.rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
    const nama = timR.rows[0].nama;
    const hashed = await bcrypt.hash(pw, 10);
    const r = await hubPool.query('UPDATE hub_users SET password=$1 WHERE nama=$2 RETURNING username', [hashed, nama]);
    if (!r.rows.length) return res.status(404).json({ error: 'User tidak ditemukan di hub_users' });
    res.json({ ok: true, username: r.rows[0].username, password_temp: pw });
  } catch { res.status(500).json({ error: 'Gagal reset password' }); }
});

// ── REVENUE BULANAN ───────────────────────────────────────────────────────────
router.get('/revenue', authMiddleware, async (req, res) => {
  const { bulan, tahun } = req.query;
  try {
    let q = 'SELECT * FROM revenue_bulanan';
    const p = [];
    if (bulan && tahun) { q += ' WHERE bulan=$1 AND tahun=$2'; p.push(bulan, tahun); }
    q += ' ORDER BY tahun DESC, bulan DESC, nama';
    const r = await hubPool.query(q, p);
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil revenue' }); }
});

router.post('/revenue', authMiddleware, async (req, res) => {
  const { bulan, tahun, nama, jumlah, target, catatan } = req.body;
  try {
    const r = await hubPool.query(`
      INSERT INTO revenue_bulanan (bulan, tahun, nama, jumlah, target, catatan, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      ON CONFLICT (nama, bulan, tahun)
      DO UPDATE SET jumlah=$4, target=$5, catatan=$6, updated_at=NOW()
      RETURNING *
    `, [bulan, tahun, nama, jumlah||0, target||0, catatan]);
    res.json({ data: r.rows[0] });
  } catch { res.status(500).json({ error: 'Gagal simpan revenue' }); }
});

// ── MODUL TOPIK ───────────────────────────────────────────────────────────────
router.get('/modul-topik', authMiddleware, async (req, res) => {
  const { nama } = req.query;
  try {
    let q = 'SELECT * FROM modul_topik';
    const p = [];
    if (nama) { q += ' WHERE nama=$1'; p.push(nama); }
    const r = await hubPool.query(q, p);
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil modul topik' }); }
});

router.patch('/modul-topik/:nama/:modul_id/:topik_idx', authMiddleware, async (req, res) => {
  const { nama, modul_id, topik_idx } = req.params;
  if (req.user.role !== 'admin' && req.user.nama !== nama)
    return res.status(403).json({ error: 'Tidak bisa update progress orang lain' });
  const { selesai } = req.body;
  try {
    await hubPool.query(`
      INSERT INTO modul_topik (nama, modul_id, topik_idx, selesai, updated_at)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (nama, modul_id, topik_idx)
      DO UPDATE SET selesai=$4, updated_at=NOW()
    `, [nama, modul_id, parseInt(topik_idx), selesai]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal update topik' }); }
});

// ── TEMA USER ─────────────────────────────────────────────────────────────────
router.patch('/auth/tema', authMiddleware, async (req, res) => {
  const { tema } = req.body;
  try {
    await hubPool.query('UPDATE hub_users SET tema=$1 WHERE id=$2', [tema, req.user.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal simpan tema' }); }
});

// ── UPDATE PROFIL MEMBER ──────────────────────────────────────────────────────
router.patch('/profil/update', authMiddleware, async (req, res) => {
  const { semangat_kerja, penguras_energi, target_1_tahun } = req.body;
  const nama = req.user.nama;
  const TABLE_MAP = { Admin:'profiling_admin', PM:'profiling_pm', Illustrator:'profiling_illustrator', Rigger:'profiling_rigger', '3D Modeler':'profiling_3d' };
  try {
    // Cari divisi user dari TIM (atau bisa dari profiling)
    // Coba update semua tabel berdasarkan nama
    let updated = false;
    for (const [, table] of Object.entries(TABLE_MAP)) {
      const exists = await hubPool.query(`SELECT id FROM ${table} WHERE nama=$1 LIMIT 1`, [nama]);
      if (exists.rows.length > 0) {
        await hubPool.query(`UPDATE ${table} SET semangat_kerja=$1, penguras_energi=$2, target_1_tahun=$3 WHERE nama=$4`, [semangat_kerja, penguras_energi, target_1_tahun, nama]);
        updated = true; break;
      }
    }
    res.json({ ok: true, updated });
  } catch { res.status(500).json({ error: 'Gagal update profil' }); }
});

// ── REVENUE HISTORY (6 bulan terakhir per admin) ─────────────────────────────
router.get('/revenue/history', authMiddleware, async (req, res) => {
  try {
    const r = await hubPool.query(`
      SELECT nama, bulan, tahun, jumlah, target
      FROM revenue_bulanan
      WHERE (tahun * 12 + bulan) >= (EXTRACT(YEAR FROM NOW())::int * 12 + EXTRACT(MONTH FROM NOW())::int - 5)
      ORDER BY tahun, bulan, nama
    `);
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil history revenue' }); }
});

// ── ADMIN REPLY JURNAL ────────────────────────────────────────────────────────
router.patch('/jurnal/:id/reply', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { reply } = req.body;
  try {
    // Simpan reply ke catatan_mentor sambil pertahankan pesan asli member.
    // Format: "pesan_member\n[ADMIN_REPLY]\nreply_admin"
    // Jika sudah ada reply sebelumnya, timpa bagian reply saja.
    const r = await hubPool.query(
      `UPDATE jurnal_mingguan
       SET catatan_mentor =
         CASE
           WHEN catatan_mentor IS NULL OR catatan_mentor = '' OR catatan_mentor LIKE '[ADMIN_REPLY]%'
           THEN '[ADMIN_REPLY]' || chr(10) || $1
           WHEN catatan_mentor LIKE '%' || chr(10) || '[ADMIN_REPLY]' || chr(10) || '%'
           THEN regexp_replace(catatan_mentor, chr(10) || '\\[ADMIN_REPLY\\]' || chr(10) || '.*$', chr(10) || '[ADMIN_REPLY]' || chr(10) || $1)
           ELSE catatan_mentor || chr(10) || '[ADMIN_REPLY]' || chr(10) || $1
         END
       WHERE id = $2 RETURNING id, nama`,
      [reply, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Jurnal tidak ditemukan' });
    res.json({ ok: true, data: r.rows[0] });
  } catch { res.status(500).json({ error: 'Gagal simpan reply' }); }
});

// ── MANAJEMEN NAMA TOPIK MODUL ─────────────────────────────────────────────────
router.get('/modul-topik-nama', authMiddleware, async (req, res) => {
  try {
    const r = await hubPool.query('SELECT modul_id, topik_idx, nama FROM modul_topik_nama ORDER BY modul_id, topik_idx');
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil nama topik' }); }
});

router.patch('/modul-topik-nama/:modul_id/:topik_idx', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { modul_id, topik_idx } = req.params;
  const { nama } = req.body;
  if (!nama?.trim()) return res.status(400).json({ error: 'Nama tidak boleh kosong' });
  try {
    await hubPool.query(`
      INSERT INTO modul_topik_nama (modul_id, topik_idx, nama, updated_at, updated_by)
      VALUES ($1, $2, $3, NOW(), $4)
      ON CONFLICT (modul_id, topik_idx) DO UPDATE SET nama=$3, updated_at=NOW(), updated_by=$4
    `, [modul_id, parseInt(topik_idx), nama.trim(), req.user.nama]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal update nama topik' }); }
});

// ── REAL-TIME PRESENCE ────────────────────────────────────────────────────────
// In-memory store: { userId: { nama, username, role, lastSeen } }
const onlineUsers = new Map();
// SSE clients: Set of res objects
const sseClients  = new Set();

// Saat startup: load user yang last_seen dalam 2 menit terakhir dari DB
// Ini memastikan user yang sudah login tidak langsung logout saat server restart
(async () => {
  try {
    const r = await hubPool.query(`
      SELECT id, nama, username, role, last_seen
      FROM hub_users
      WHERE last_seen >= NOW() - INTERVAL '2 minutes' AND aktif = TRUE
    `);
    r.rows.forEach(u => {
      onlineUsers.set(u.id, {
        nama: u.nama, username: u.username, role: u.role,
        lastSeen: new Date(u.last_seen).getTime()
      });
    });
    if (r.rows.length > 0)
      console.log(`[Presence] Restored ${r.rows.length} online user(s) from DB`);
  } catch (e) {
    console.log('[Presence] Could not restore from DB:', e.message);
  }
})();

// Broadcast daftar online ke semua SSE clients
function broadcastPresence() {
  const now     = Date.now();
  const cutoff  = 2 * 60 * 1000; // 2 menit = offline
  const online  = [];
  onlineUsers.forEach((u, id) => {
    if (now - u.lastSeen <= cutoff) {
      online.push({ id, nama: u.nama, username: u.username, role: u.role });
    } else {
      onlineUsers.delete(id);
    }
  });
  const payload = `data: ${JSON.stringify(online)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(payload); } catch { sseClients.delete(client); }
  });
}

// PATCH /api/hub/auth/heartbeat — user kirim tanda masih aktif (tiap 30 detik)
router.patch('/auth/heartbeat', authMiddleware, async (req, res) => {
  const { id, nama, username, role } = req.user;
  onlineUsers.set(id, { nama, username, role, lastSeen: Date.now() });
  // Update last_seen ke DB juga (untuk history)
  try { await hubPool.query('UPDATE hub_users SET last_seen=NOW() WHERE id=$1', [id]); } catch {}
  broadcastPresence();
  res.json({ ok: true, online: onlineUsers.size });
});

// DELETE /api/hub/auth/heartbeat — user logout, tandai offline
router.delete('/auth/heartbeat', authMiddleware, (req, res) => {
  onlineUsers.delete(req.user.id);
  broadcastPresence();
  res.json({ ok: true });
});

// GET /api/hub/presence — SSE stream siapa yang online
// Terima token dari query param (karena EventSource tidak support custom headers)
router.get('/presence', (req, res) => {
  const token = req.query.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token tidak ada' });
  try {
    const decoded = require('jsonwebtoken').verify(token, JWT_SECRET);
    req.user = decoded;
  } catch { return res.status(401).json({ error: 'Token tidak valid' }); }
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering
  });
  res.flushHeaders();

  // Tambah client ke set
  sseClients.add(res);

  // Kirim state awal
  const now    = Date.now();
  const cutoff = 2 * 60 * 1000;
  const online = [];
  onlineUsers.forEach((u, id) => {
    if (now - u.lastSeen <= cutoff)
      online.push({ id, nama: u.nama, username: u.username, role: u.role });
  });
  res.write(`data: ${JSON.stringify(online)}\n\n`);

  // Heartbeat SSE agar koneksi tidak timeout
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 25000);

  // Cleanup saat client disconnect
  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(res);
  });
});

// GET /api/hub/presence/snapshot — simple list tanpa SSE (untuk polling fallback)
router.get('/presence/snapshot', authMiddleware, (req, res) => {
  const now    = Date.now();
  const cutoff = 2 * 60 * 1000;
  const online = [];
  onlineUsers.forEach((u, id) => {
    if (now - u.lastSeen <= cutoff)
      online.push({ id, nama: u.nama, username: u.username, role: u.role });
  });
  res.json({ data: online });
});

// Bersihkan user yang tidak aktif setiap menit
setInterval(() => {
  const now = Date.now(), cutoff = 2 * 60 * 1000;
  let changed = false;
  onlineUsers.forEach((u, id) => {
    if (now - u.lastSeen > cutoff) { onlineUsers.delete(id); changed = true; }
  });
  if (changed) broadcastPresence();
}, 60000);

// ── PERFORMA HISTORIS ─────────────────────────────────────────────────────────
// GET /api/hub/performa — semua anggota (admin) atau diri sendiri (member)
router.get('/performa', authMiddleware, async (req, res) => {
  const { periode = 'minggu', limit = 12 } = req.query;
  const isAdmin = req.user.role === 'admin';

  const groupBy = periode === 'bulan'
    ? `DATE_TRUNC('month', tanggal_jurnal)`
    : `DATE_TRUNC('week',  tanggal_jurnal)`;

  const labelFmt = periode === 'bulan'
    ? `TO_CHAR(DATE_TRUNC('month', tanggal_jurnal), 'Mon YY')`
    : `TO_CHAR(DATE_TRUNC('week',  tanggal_jurnal), 'DD Mon')`;

  try {
    const whereNama = isAdmin ? '' : `WHERE nama = $1`;
    const params    = isAdmin ? [parseInt(limit)] : [req.user.nama, parseInt(limit)];
    const limitIdx  = isAdmin ? 1 : 2;

    const q = `
      SELECT nama, label, periode_date,
             avg_mood, avg_karya, avg_waktu, avg_komunikasi, avg_skill,
             skor_total, jumlah_jurnal
      FROM (
        SELECT
          nama,
          ${labelFmt}                                AS label,
          ${groupBy}                                 AS periode_date,
          ROUND(AVG(mood)::numeric,           1)    AS avg_mood,
          ROUND(AVG(skor_karya)::numeric,     1)    AS avg_karya,
          ROUND(AVG(skor_waktu)::numeric,     1)    AS avg_waktu,
          ROUND(AVG(skor_komunikasi)::numeric,1)    AS avg_komunikasi,
          ROUND(AVG(skor_skill)::numeric,     1)    AS avg_skill,
          ROUND(
            (AVG(mood)/10 + AVG(skor_karya)/5 + AVG(skor_waktu)/5 +
             AVG(skor_komunikasi)/5 + AVG(skor_skill)/5) / 5 * 100
          ::numeric, 0)                              AS skor_total,
          COUNT(*)::int                              AS jumlah_jurnal,
          ROW_NUMBER() OVER (PARTITION BY nama ORDER BY ${groupBy} DESC) AS rn
        FROM jurnal_mingguan
        ${whereNama}
        GROUP BY nama, ${groupBy}
      ) sub
      WHERE rn <= $${limitIdx}
      ORDER BY nama, periode_date ASC
    `;

    const result = await hubPool.query(q, params);

    // Kelompokkan per nama
    const byNama = {};
    result.rows.forEach(row => {
      if (!byNama[row.nama]) byNama[row.nama] = [];
      byNama[row.nama].push({
        label:         row.label,
        periode_date:  row.periode_date,
        avg_mood:      parseFloat(row.avg_mood) || 0,
        avg_karya:     parseFloat(row.avg_karya) || 0,
        avg_waktu:     parseFloat(row.avg_waktu) || 0,
        avg_komunikasi:parseFloat(row.avg_komunikasi) || 0,
        avg_skill:     parseFloat(row.avg_skill) || 0,
        skor_total:    parseFloat(row.skor_total) || 0,
        jumlah_jurnal: row.jumlah_jurnal,
      });
    });

    // Balik urutan supaya chart dari lama ke baru
    Object.keys(byNama).forEach(k => byNama[k].reverse());

    res.json({ data: byNama, periode });
  } catch (err) {
    console.error('GET /performa error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil data performa' });
  }
});

// ── LAPORAN HARIAN ────────────────────────────────────────────────────────────
router.get('/laporan-harian', authMiddleware, async (req, res) => {
  const { dari, sampai, nama, limit = 50 } = req.query;
  const isAdmin = req.user.role === 'admin';
  try {
    const cap = Math.min(parseInt(limit) || 50, 200);
    let q = 'SELECT * FROM laporan_harian WHERE 1=1';
    const p = [];
    if (!isAdmin) { q += ` AND nama = $${p.length+1}`; p.push(req.user.nama); }
    else if (nama) { q += ` AND nama ILIKE $${p.length+1}`; p.push(`%${nama}%`); }
    if (dari)   { q += ` AND tanggal >= $${p.length+1}`; p.push(dari); }
    if (sampai) { q += ` AND tanggal <= $${p.length+1}`; p.push(sampai); }
    q += ` ORDER BY tanggal DESC, created_at DESC LIMIT $${p.length+1}`;
    p.push(cap);
    const r = await hubPool.query(q, p);
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil laporan harian' }); }
});

router.delete('/laporan-harian/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { id } = req.params;
  try {
    const r = await hubPool.query('DELETE FROM laporan_harian WHERE id=$1 RETURNING id', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Record tidak ditemukan' });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal hapus laporan harian' }); }
});

router.get('/laporan-harian/stats', authMiddleware, async (req, res) => {
  const { dari, sampai } = req.query;
  const isAdmin = req.user.role === 'admin';
  try {
    const params = [dari || null, sampai || null];
    let namaFilter = '';
    if (!isAdmin) { namaFilter = `AND nama = $3`; params.push(req.user.nama); }
    const r = await hubPool.query(`
      SELECT
        nama,
        COUNT(*)::int                          AS total_hari,
        ROUND(AVG(active_order)::numeric, 1)   AS avg_order,
        SUM(active_order)::int                 AS total_order,
        MAX(tanggal)                           AS terakhir_lapor
      FROM laporan_harian
      WHERE ($1::date IS NULL OR tanggal >= $1)
        AND ($2::date IS NULL OR tanggal <= $2)
        ${namaFilter}
      GROUP BY nama ORDER BY nama
    `, params);
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil stats' }); }
});

// GET /laporan-harian/grafik?dari=YYYY-MM-DD&sampai=YYYY-MM-DD
router.get('/laporan-harian/grafik', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { dari, sampai } = req.query;
  try {
    const r = await hubPool.query(`
      SELECT akun, tanggal, nama, active_order, impresi, click, cr, detail_order
      FROM laporan_harian
      WHERE akun IS NOT NULL AND akun != ''
        AND ($1::date IS NULL OR tanggal >= $1)
        AND ($2::date IS NULL OR tanggal <= $2)
      ORDER BY akun, tanggal ASC
    `, [dari || null, sampai || null]);
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil grafik' }); }
});

// ── ANALISA SDM OTOMATIS ──────────────────────────────────────────────────────
// GET /api/hub/laporan-sdm-analisa?tanggal=YYYY-MM-DD
// Ambil jurnal minggu ini + 1-on-1 terbaru per anggota → buat narasi SDM
router.get('/laporan-sdm-analisa', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });

  const { tanggal } = req.query;
  const tgl    = tanggal ? new Date(tanggal) : new Date();
  // Range: 7 hari sebelum tanggal laporan
  const start  = new Date(tgl); start.setDate(start.getDate() - 7);
  const end    = tgl;

  try {
    // Jurnal minggu ini
    const jurnalR = await hubPool.query(`
      SELECT DISTINCT ON (nama)
        nama, tanggal_jurnal, mood, skor_karya, skor_waktu, skor_komunikasi, skor_skill,
        pencapaian_1, pencapaian_2, pencapaian_3, hambatan, pelajaran, target_depan, catatan_mentor
      FROM jurnal_mingguan
      WHERE tanggal_jurnal BETWEEN $1 AND $2
      ORDER BY nama, tanggal_jurnal DESC
    `, [start.toISOString().slice(0,10), end.toISOString().slice(0,10)]);

    // Jurnal minggu SEBELUMNYA (untuk perbandingan tren)
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
    const prevR = await hubPool.query(`
      SELECT DISTINCT ON (nama)
        nama, mood, skor_karya, skor_waktu, skor_komunikasi, skor_skill
      FROM jurnal_mingguan
      WHERE tanggal_jurnal BETWEEN $1 AND $2
      ORDER BY nama, tanggal_jurnal DESC
    `, [prevStart.toISOString().slice(0,10), start.toISOString().slice(0,10)]);

    // Sesi 1-on-1 minggu ini
    const sesiR = await hubPool.query(`
      SELECT anggota, tipe, ringkasan, tindak_lanjut, mood_sebelum, mood_sesudah
      FROM sesi_1on1
      WHERE tanggal BETWEEN $1 AND $2
      ORDER BY tanggal DESC
    `, [start.toISOString().slice(0,10), end.toISOString().slice(0,10)]);

    // Susun map
    const jurnalMap = {};
    jurnalR.rows.forEach(j => { jurnalMap[j.nama] = j; });
    const prevMap = {};
    prevR.rows.forEach(j => { prevMap[j.nama] = j; });
    const sesiMap = {};
    sesiR.rows.forEach(s => { sesiMap[s.anggota] = s; });

    // Ambil daftar anggota dari DB tim
    const timR = await hubPool.query('SELECT nama, divisi, level FROM tim WHERE aktif=TRUE ORDER BY divisi, nama');

    // Generate narasi per anggota
    const hasil = timR.rows.map(anggota => {
      const j    = jurnalMap[anggota.nama];
      const prev = prevMap[anggota.nama];
      const sesi = sesiMap[anggota.nama];
      const bagian = [];

      if (!j) {
        // Tidak isi jurnal minggu ini
        bagian.push(`${anggota.nama.split(' ')[0]} tidak mengisi jurnal minggu ini.`);
      } else {
        // Tren mood
        const moodLabel = j.mood >= 8 ? 'sangat baik' : j.mood >= 6 ? 'cukup baik' : j.mood >= 4 ? 'sedang' : 'rendah';
        let moodTren = '';
        if (prev) {
          const delta = j.mood - prev.mood;
          if (delta > 1)       moodTren = `, naik ${delta} poin dari minggu lalu`;
          else if (delta < -1) moodTren = `, turun ${Math.abs(delta)} poin dari minggu lalu — perlu perhatian`;
          else                 moodTren = `, stabil dari minggu lalu`;
        }
        bagian.push(`Mood minggu ini ${j.mood}/10 (${moodLabel}${moodTren}).`);

        // Pencapaian
        const pencapaian = [j.pencapaian_1, j.pencapaian_2, j.pencapaian_3].filter(Boolean);
        if (pencapaian.length > 0) {
          bagian.push(`Pencapaian: ${pencapaian.slice(0,2).join('; ')}.`);
        }

        // Hambatan
        if (j.hambatan?.trim()) {
          bagian.push(`Hambatan: ${j.hambatan}.`);
        }

        // Pelajaran/insight
        if (j.pelajaran?.trim()) {
          bagian.push(`Insight: ${j.pelajaran}.`);
        }

        // Target minggu depan
        if (j.target_depan?.trim()) {
          bagian.push(`Target: ${j.target_depan}.`);
        }

        // Skor performa — flag yang menonjol
        const skor = [];
        if (prev) {
          if (j.skor_skill > prev.skor_skill)   skor.push(`skill membaik (${prev.skor_skill}→${j.skor_skill})`);
          if (j.skor_karya < prev.skor_karya)   skor.push(`kualitas karya perlu perhatian (${prev.skor_karya}→${j.skor_karya})`);
          if (j.skor_waktu < prev.skor_waktu)   skor.push(`manajemen waktu menurun`);
          if (j.skor_komunikasi > (prev.skor_komunikasi + 1)) skor.push(`komunikasi meningkat`);
        }
        if (j.skor_karya <= 2) skor.push('kualitas karya rendah minggu ini');
        if (skor.length > 0)   bagian.push(`Catatan performa: ${skor.join(', ')}.`);

        // Pesan untuk mentor/secondline
        const pesanMember = extractPesanMember(j.catatan_mentor);
        if (pesanMember) {
          bagian.push(`Pesan: "${pesanMember}".`);
        }
      }

      // Sesi 1-on-1 minggu ini
      if (sesi) {
        let sesiTeks = `Ada sesi 1-on-1 (${sesi.tipe})`;
        if (sesi.ringkasan) sesiTeks += `: ${sesi.ringkasan}`;
        if (sesi.tindak_lanjut) sesiTeks += `. Tindak lanjut: ${sesi.tindak_lanjut}`;
        if (sesi.mood_sebelum && sesi.mood_sesudah) {
          const delta = sesi.mood_sesudah - sesi.mood_sebelum;
          sesiTeks += `. Mood ${delta >= 0 ? 'naik' : 'turun'} dari ${sesi.mood_sebelum} → ${sesi.mood_sesudah}`;
        }
        bagian.push(sesiTeks + '.');
      }

      return {
        nama:    anggota.nama,
        divisi:  anggota.divisi,
        catatan: bagian.join(' '),
        isi_jurnal: !!j,
        mood:    j?.mood || null,
      };
    });

    res.json({ data: hasil, periode: { dari: start.toISOString().slice(0,10), sampai: end.toISOString().slice(0,10) } });
  } catch (err) {
    console.error('GET /laporan-sdm-analisa:', err.message);
    res.status(500).json({ error: 'Gagal generate analisa SDM' });
  }
});

// ── LAPORAN MINGGUAN ──────────────────────────────────────────────────────────

// GET /api/hub/laporan-mingguan — daftar semua laporan
router.get('/laporan-mingguan', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  try {
    const r = await hubPool.query(
      `SELECT id, tanggal, judul, kas, dibuat_oleh, created_at
       FROM laporan_mingguan ORDER BY tanggal DESC`
    );
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil laporan' }); }
});

// GET /api/hub/laporan-mingguan/:id — detail + akun + SDM
router.get('/laporan-mingguan/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  try {
    const [laporan, akun, sdm] = await Promise.all([
      hubPool.query('SELECT * FROM laporan_mingguan WHERE id=$1', [req.params.id]),
      hubPool.query('SELECT * FROM laporan_akun WHERE laporan_id=$1 ORDER BY id', [req.params.id]),
      hubPool.query('SELECT * FROM laporan_sdm WHERE laporan_id=$1 ORDER BY nama', [req.params.id]),
    ]);
    if (!laporan.rows.length) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    res.json({ data: { ...laporan.rows[0], akun: akun.rows, sdm: sdm.rows } });
  } catch { res.status(500).json({ error: 'Gagal ambil detail laporan' }); }
});

// POST /api/hub/laporan-mingguan — buat laporan baru
router.post('/laporan-mingguan', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { tanggal, judul, kas, marketing, produksi, akun = [], sdm = [] } = req.body;
  if (!tanggal) return res.status(400).json({ error: 'Tanggal wajib diisi' });
  try {
    // Insert laporan header
    const r = await hubPool.query(
      `INSERT INTO laporan_mingguan (tanggal, judul, kas, marketing, produksi, dibuat_oleh)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tanggal, judul || 'Creanimasi', kas || 0, marketing, produksi, req.user.nama]
    );
    const id = r.rows[0].id;

    // Insert akun keuangan
    for (const a of akun) {
      await hubPool.query(
        `INSERT INTO laporan_akun (laporan_id, nama_akun, available_withdraw, payment_clearing, active_order, total_withdraw)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, a.nama_akun, a.available_withdraw||0, a.payment_clearing||0, a.active_order||0, a.total_withdraw||0]
      );
    }

    // Insert SDM notes
    for (const s of sdm) {
      if (s.catatan?.trim()) {
        await hubPool.query(
          `INSERT INTO laporan_sdm (laporan_id, nama, catatan) VALUES ($1,$2,$3)`,
          [id, s.nama, s.catatan]
        );
      }
    }

    res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Laporan untuk tanggal & judul ini sudah ada' });
    res.status(500).json({ error: 'Gagal buat laporan' });
  }
});

// PUT /api/hub/laporan-mingguan/:id — update laporan
router.put('/laporan-mingguan/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { tanggal, judul, kas, marketing, produksi, akun = [], sdm = [] } = req.body;
  const id = req.params.id;
  try {
    await hubPool.query(
      `UPDATE laporan_mingguan SET tanggal=$1, judul=$2, kas=$3, marketing=$4, produksi=$5
       WHERE id=$6`,
      [tanggal, judul, kas||0, marketing, produksi, id]
    );

    // Replace akun dan SDM
    await hubPool.query('DELETE FROM laporan_akun WHERE laporan_id=$1', [id]);
    await hubPool.query('DELETE FROM laporan_sdm  WHERE laporan_id=$1', [id]);

    for (const a of akun) {
      await hubPool.query(
        `INSERT INTO laporan_akun (laporan_id, nama_akun, available_withdraw, payment_clearing, active_order, total_withdraw)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, a.nama_akun, a.available_withdraw||0, a.payment_clearing||0, a.active_order||0, a.total_withdraw||0]
      );
    }
    for (const s of sdm) {
      if (s.catatan?.trim()) {
        await hubPool.query(
          `INSERT INTO laporan_sdm (laporan_id, nama, catatan) VALUES ($1,$2,$3)`,
          [id, s.nama, s.catatan]
        );
      }
    }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal update laporan' }); }
});

// DELETE /api/hub/laporan-mingguan/:id
router.delete('/laporan-mingguan/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  try {
    await hubPool.query('DELETE FROM laporan_mingguan WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal hapus laporan' }); }
});

// ── LAPORAN ADMIN MINGGUAN ────────────────────────
// Auto-create table on first run
pool.query(`
  CREATE TABLE IF NOT EXISTS laporan_admin_mingguan (
    id                  SERIAL PRIMARY KEY,
    tanggal             DATE NOT NULL,
    akun                VARCHAR(200) NOT NULL,
    periode             VARCHAR(200),
    gigs_tags           JSONB DEFAULT '[]',
    order_queue         JSONB DEFAULT '{}',
    flow_new_order      INT DEFAULT 0,
    flow_complete_order INT DEFAULT 0,
    gigs_utama          JSONB DEFAULT '[]',
    screenshots         JSONB DEFAULT '{}',
    todo_list           JSONB DEFAULT '[]',
    kendala_list        JSONB DEFAULT '[]',
    catatan             TEXT,
    dibuat_oleh         VARCHAR(200),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(e => console.error('laporan_admin_mingguan migration error:', e.message));

async function isAdminOrMarket(req) {
  if (req.user.role === 'admin') return true;
  try {
    const r = await pool.query('SELECT id FROM tim WHERE nama=$1 AND divisi=$2 LIMIT 1', [req.user.nama, 'Admin']);
    return r.rows.length > 0;
  } catch { return false; }
}

// GET /api/hub/laporan-admin — semua laporan (list)
router.get('/laporan-admin', authMiddleware, async (req, res) => {
  if (!await isAdminOrMarket(req)) return res.status(403).json({ error: 'Akses ditolak' });
  try {
    const r = await pool.query(
      `SELECT id, tanggal, akun, periode, dibuat_oleh, created_at
       FROM laporan_admin_mingguan ORDER BY tanggal DESC, created_at DESC`
    );
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil laporan' }); }
});

// GET /api/hub/laporan-admin/:id — detail laporan
router.get('/laporan-admin/:id', authMiddleware, async (req, res) => {
  if (!await isAdminOrMarket(req)) return res.status(403).json({ error: 'Akses ditolak' });
  try {
    const r = await pool.query('SELECT * FROM laporan_admin_mingguan WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    const row = r.rows[0];
    res.json({ data: { ...row, ...row.screenshots } });
  } catch { res.status(500).json({ error: 'Gagal ambil laporan' }); }
});

// POST /api/hub/laporan-admin — buat laporan baru
router.post('/laporan-admin', authMiddleware, async (req, res) => {
  if (!await isAdminOrMarket(req)) return res.status(403).json({ error: 'Akses ditolak' });
  const {
    tanggal, akun, periode,
    gigs_tags, order_queue, flow_new_order, flow_complete_order,
    gigs_utama, todo_list, kendala_list, catatan,
    screenshot_account_status, screenshot_earnings, screenshot_active_gigs,
    screenshot_weekly_gigs_score, screenshot_weekly_overview, screenshot_yearly_overview,
    screenshot_total_impressions, screenshot_fiverr_ads, screenshot_porto_baru,
  } = req.body;
  if (!tanggal || !akun) return res.status(400).json({ error: 'Tanggal dan akun wajib diisi' });
  const screenshots = {
    screenshot_account_status:    screenshot_account_status    || [],
    screenshot_earnings:          screenshot_earnings          || [],
    screenshot_active_gigs:       screenshot_active_gigs       || [],
    screenshot_weekly_gigs_score: screenshot_weekly_gigs_score || [],
    screenshot_weekly_overview:   screenshot_weekly_overview   || [],
    screenshot_yearly_overview:   screenshot_yearly_overview   || [],
    screenshot_total_impressions: screenshot_total_impressions || [],
    screenshot_fiverr_ads:        screenshot_fiverr_ads        || [],
    screenshot_porto_baru:        screenshot_porto_baru        || [],
  };
  try {
    const r = await pool.query(
      `INSERT INTO laporan_admin_mingguan
        (tanggal, akun, periode, gigs_tags, order_queue, flow_new_order, flow_complete_order,
         gigs_utama, screenshots, todo_list, kendala_list, catatan, dibuat_oleh)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, tanggal, akun, dibuat_oleh`,
      [tanggal, akun, periode||'', JSON.stringify(gigs_tags||[]), JSON.stringify(order_queue||{}),
       flow_new_order||0, flow_complete_order||0, JSON.stringify(gigs_utama||[]),
       JSON.stringify(screenshots), JSON.stringify(todo_list||[]),
       JSON.stringify(kendala_list||[]), catatan||'', req.user.nama]
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (e) { res.status(500).json({ error: 'Gagal simpan laporan: ' + e.message }); }
});

// PUT /api/hub/laporan-admin/:id — update laporan
router.put('/laporan-admin/:id', authMiddleware, async (req, res) => {
  if (!await isAdminOrMarket(req)) return res.status(403).json({ error: 'Akses ditolak' });
  const {
    tanggal, akun, periode,
    gigs_tags, order_queue, flow_new_order, flow_complete_order,
    gigs_utama, todo_list, kendala_list, catatan,
    screenshot_account_status, screenshot_earnings, screenshot_active_gigs,
    screenshot_weekly_gigs_score, screenshot_weekly_overview, screenshot_yearly_overview,
    screenshot_total_impressions, screenshot_fiverr_ads, screenshot_porto_baru,
  } = req.body;
  const screenshots = {
    screenshot_account_status:    screenshot_account_status    || [],
    screenshot_earnings:          screenshot_earnings          || [],
    screenshot_active_gigs:       screenshot_active_gigs       || [],
    screenshot_weekly_gigs_score: screenshot_weekly_gigs_score || [],
    screenshot_weekly_overview:   screenshot_weekly_overview   || [],
    screenshot_yearly_overview:   screenshot_yearly_overview   || [],
    screenshot_total_impressions: screenshot_total_impressions || [],
    screenshot_fiverr_ads:        screenshot_fiverr_ads        || [],
    screenshot_porto_baru:        screenshot_porto_baru        || [],
  };
  try {
    await pool.query(
      `UPDATE laporan_admin_mingguan SET
        tanggal=$1, akun=$2, periode=$3, gigs_tags=$4, order_queue=$5,
        flow_new_order=$6, flow_complete_order=$7, gigs_utama=$8, screenshots=$9,
        todo_list=$10, kendala_list=$11, catatan=$12, updated_at=NOW()
       WHERE id=$13`,
      [tanggal, akun, periode||'', JSON.stringify(gigs_tags||[]), JSON.stringify(order_queue||{}),
       flow_new_order||0, flow_complete_order||0, JSON.stringify(gigs_utama||[]),
       JSON.stringify(screenshots), JSON.stringify(todo_list||[]),
       JSON.stringify(kendala_list||[]), catatan||'', req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Gagal update: ' + e.message }); }
});

// DELETE /api/hub/laporan-admin/:id
router.delete('/laporan-admin/:id', authMiddleware, async (req, res) => {
  if (!await isAdminOrMarket(req)) return res.status(403).json({ error: 'Akses ditolak' });
  try {
    await pool.query('DELETE FROM laporan_admin_mingguan WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal hapus' }); }
});

module.exports = router;
