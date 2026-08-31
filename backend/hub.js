require('dotenv').config({ override: true, path: require('path').join(__dirname, '.env') });
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

    const token = jwt.sign(
      { id: user.id, nama: user.nama, username: user.username, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ success: true, token, user: { id: user.id, nama: user.nama, username: user.username, role: user.role, tema: user.tema || 'dark' } });
  } catch (err) {
    res.status(500).json({ error: 'Gagal login' });
  }
});

// ── GLOBAL AUTH GUARD ─────────────────────────────
// Semua route wajib login KECUALI /auth/login dan /presence (SSE pakai token via query param)
router.use((req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/presence') return next();
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

// Auto-migrate kolom request_1on1
;(async () => {
  try {
    await pool.query(`ALTER TABLE jurnal_mingguan ADD COLUMN IF NOT EXISTS request_1on1 BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE jurnal_mingguan ADD COLUMN IF NOT EXISTS catatan_request TEXT`);
    await pool.query(`
      CREATE OR REPLACE VIEW v_jurnal_stats AS
      SELECT
        nama,
        COUNT(*)                                                                    AS total_jurnal,
        ROUND(AVG(mood), 1)                                                         AS avg_mood,
        ROUND(AVG(skor_karya), 1)                                                   AS avg_skor_karya,
        ROUND(AVG(skor_skill), 1)                                                   AS avg_skor_skill,
        MAX(tanggal_jurnal)                                                         AS jurnal_terakhir,
        (MAX(tanggal_jurnal) >= DATE_TRUNC('week', CURRENT_DATE))                   AS isi_minggu_ini
      FROM jurnal_mingguan
      GROUP BY nama
    `);
  } catch (e) { console.error('Migration startup:', e.message); }
})();

// POST /api/hub/jurnal — simpan jurnal baru
router.post('/jurnal', authMiddleware, async (req, res) => {
  try {
    const {
      divisi, level_karier, tanggal_jurnal,
      pencapaian_1, pencapaian_2, pencapaian_3,
      hambatan, pelajaran, target_depan,
      mood, skor_karya, skor_waktu, skor_komunikasi, skor_skill,
      catatan_mentor, request_1on1, catatan_request
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
         catatan_mentor, request_1on1, catatan_request)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [nama, divisi, level_karier, tanggal_jurnal || new Date(),
       pencapaian_1, pencapaian_2, pencapaian_3,
       hambatan, pelajaran, target_depan,
       mood, skor_karya, skor_waktu, skor_komunikasi, skor_skill,
       catatan_mentor, request_1on1 || false, catatan_request || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error POST /jurnal:', err);
    res.status(500).json({ error: 'Gagal menyimpan jurnal' });
  }
});

// GET /api/hub/jurnal — semua jurnal (untuk dashboard)
router.get('/jurnal', authMiddleware, async (req, res) => {
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
router.get('/jurnal/stats', authMiddleware, async (req, res) => {
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

// Kolom umum yang ada di semua tabel profiling_*
const PROFILING_COMMON_COLUMNS = [
  'nama', 'usia', 'tanggal_bergabung', 'domisili', 'level_karier',
  'produktif_waktu', 'gaya_kerja', 'respons_feedback', 'deadline_mepet',
  'skor_kerja_tim',
  'semangat_kerja', 'penguras_energi', 'target_1_tahun',
  'skill_ingin_dikuasai', 'tertarik_memimpin', 'alasan_bergabung',
  'ingin_diubah', 'kepuasan_diri',
];

// Kolom khusus per divisi (lihat database/schema.sql)
const PROFILING_DIVISI_COLUMNS = {
  admin: [
    'platform_dikuasai', 'skill_copywriting', 'skor_komunikasi', 'pengalaman_komplain',
    'bisa_konten_sosmed', 'tools_desain',
  ],
  pm: [
    'tools_project', 'pengalaman_koordinasi', 'skill_komunikasi',
    'skor_komunikasi_klien', 'prioritas_project', 'bahasa_dikuasai',
  ],
  illustrator: [
    'software_utama', 'skill_level_csp', 'spesialisasi',
    'waktu_1_karakter', 'kapasitas_paralel', 'link_portofolio', 'skor_komunikasi',
  ],
  rigger: [
    'software_rigging', 'skill_level_live2d', 'bisa_physics_expr',
    'pengalaman_project', 'waktu_rigging', 'link_portofolio', 'skor_komunikasi',
  ],
  '3d': [
    'software_3d', 'skill_level_blender', 'jenis_output',
    'bisa_vrm_export', 'bisa_3d_print', 'pernah_ar_filter', 'waktu_vrm', 'skor_komunikasi',
  ],
};

// Hitung skor 0-100 dari skill/komunikasi/kriteria (0-5) + kepuasan (1-10), sama seperti calcScore() di Tim.jsx
function hitungSkorTim({ skill, komunikasi, kriteria, kepuasan }) {
  return Math.round(((skill + komunikasi + kriteria) / 15 + kepuasan / 10) / 2 * 100);
}

// Klasifikasikan tipe anggota dari skor & komponen, sinkron dengan kategori di halaman Tim
function hitungTipeTim({ skill, komunikasi, kriteria, kepuasan }) {
  if (skill >= 4 && komunikasi <= 2) return 'Silent Expert';
  const skor = hitungSkorTim({ skill, komunikasi, kriteria, kepuasan });
  if (skor >= 75) return 'Rising Star';
  if (skor >= 55) return 'High Potential';
  return 'At Risk';
}

// Pemetaan field profiling -> kolom skor di tabel tim (untuk kartu Tim)
// tim.skill & tim.komunikasi: skala 0-5, tim.kriteria: skala 0-5, tim.kepuasan: skala 1-10
const PROFILING_TO_TIM_SKOR = {
  admin:       { skill: 'skill_copywriting', komunikasi: 'skor_komunikasi' },
  pm:          { skill: 'skill_komunikasi', komunikasi: 'skor_komunikasi_klien' },
  illustrator: { skill: 'skill_level_csp', komunikasi: 'skor_komunikasi' },
  rigger:      { skill: 'skill_level_live2d', komunikasi: 'skor_komunikasi' },
  '3d':        { skill: 'skill_level_blender', komunikasi: 'skor_komunikasi' },
};

// POST /api/hub/profiling/:divisi — simpan profiling
router.post('/profiling/:divisi', authMiddleware, async (req, res) => {
  const { divisi } = req.params;
  const TABLE_MAP = {
    admin: 'profiling_admin',
    pm: 'profiling_pm',
    illustrator: 'profiling_illustrator',
    rigger: 'profiling_rigger',
    '3d': 'profiling_3d',
  };

  const divisiKey = divisi.toLowerCase();
  const table = TABLE_MAP[divisiKey];
  if (!table) return res.status(400).json({ error: 'Divisi tidak valid' });

  try {
    // Hanya izinkan kolom yang benar-benar ada di tabel divisi ini
    const allowedColumns = [...PROFILING_COMMON_COLUMNS, ...PROFILING_DIVISI_COLUMNS[divisiKey]];
    const fields = Object.keys(req.body).filter(k => allowedColumns.includes(k));
    if (fields.length === 0) return res.status(400).json({ error: 'Tidak ada field valid yang dikirim' });
    // String kosong tidak valid utk kolom numerik (SMALLINT/INTEGER) -> ubah ke NULL
    const values = fields.map(f => (req.body[f] === '' ? null : req.body[f]));
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

    const result = await query(
      `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})
       ON CONFLICT DO NOTHING RETURNING *`,
      values
    );

    // Sinkronkan skor ke tabel tim agar kartu Tim ikut update
    // Gunakan req.user.nama (dari JWT) — bukan req.body.nama — agar tidak bisa dispoof
    const namaUser = req.user.nama;
    const skorMap = PROFILING_TO_TIM_SKOR[divisiKey];
    if (result.rows[0] && namaUser) {
      const skillVal      = req.body[skorMap.skill];
      const komunikasiVal = req.body[skorMap.komunikasi];
      const kriteriaVal   = req.body.skor_kerja_tim;
      const kepuasanVal   = req.body.kepuasan_diri;

      const setClauses = [];
      const setValues  = [];
      if (skillVal      != null) { setValues.push(skillVal);      setClauses.push(`skill = $${setValues.length}`); }
      if (komunikasiVal != null) { setValues.push(komunikasiVal); setClauses.push(`komunikasi = $${setValues.length}`); }
      if (kriteriaVal   != null) { setValues.push(kriteriaVal);   setClauses.push(`kriteria = $${setValues.length}`); }
      if (kepuasanVal   != null) { setValues.push(kepuasanVal);   setClauses.push(`kepuasan = $${setValues.length}`); }

      if (setClauses.length > 0) {
        setValues.push(namaUser);
        const timR = await query(
          `UPDATE tim SET ${setClauses.join(', ')} WHERE nama = $${setValues.length}
           RETURNING skill, komunikasi, kriteria, kepuasan`,
          setValues
        );

        if (timR.rows[0]) {
          const tipeBaru = hitungTipeTim(timR.rows[0]);
          await query(`UPDATE tim SET tipe = $1 WHERE nama = $2`, [tipeBaru, namaUser]);
        }
      }
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(`Error POST /profiling/${divisi}:`, err);
    res.status(500).json({ error: 'Gagal menyimpan profiling' });
  }
});

// GET /api/hub/profiling/all — semua profiling untuk dashboard
router.get('/profiling/all', authMiddleware, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM v_profiling_all ORDER BY divisi, nama`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data profiling' });
  }
});

// GET /api/hub/profiling/:divisi — profiling per divisi
router.get('/profiling/:divisi', authMiddleware, async (req, res) => {
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
router.post('/reward', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang dapat mencatat reward' });
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
router.get('/reward', authMiddleware, async (req, res) => {
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
router.patch('/reward/:id/status', authMiddleware, async (req, res) => {
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
router.post('/skb', authMiddleware, async (req, res) => {
  try {
    const {
      tipe, divisi, level, judul, deskripsi,
      latar_belakang, tujuan, output, timeline,
      kebutuhan, risiko, ukuran_sukses, komitmen
    } = req.body;

    // Nama selalu dari JWT — admin bisa override via req.body.nama jika perlu mengajukan atas nama orang lain
    const nama = req.user.role === 'admin' && req.body.nama ? req.body.nama : req.user.nama;

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
router.get('/skb', authMiddleware, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM skb ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data SKB' });
  }
});

// PATCH /api/hub/skb/:id — update status SKB
router.patch('/skb/:id', authMiddleware, async (req, res) => {
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

// ── MANAJEMEN TIM (Kelola Anggota) ───────────────────────────────────────────

// Startup migration — jalankan sekali, aman dengan IF NOT EXISTS
(async () => {
  try {
    await hubPool.query("ALTER TABLE tim ADD COLUMN IF NOT EXISTS entitas VARCHAR(50) DEFAULT 'Creanimasi Studio'");
    await hubPool.query("ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS tim_id INTEGER REFERENCES tim(id)");
    await hubPool.query("UPDATE hub_users u SET tim_id = t.id FROM tim t WHERE t.nama = u.nama AND u.tim_id IS NULL");
  } catch (e) { /* column may already exist */ }
})();

// GET /api/hub/tim
router.get('/tim', authMiddleware, async (req, res) => {
  try {
    const { semua, entitas } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (!semua) { where += ' AND t.aktif = TRUE'; }
    if (entitas) { params.push(entitas); where += ` AND t.entitas = $${params.length}`; }
    const q = `
      SELECT t.*, u.username, u.role, u.id as user_id
      FROM tim t
      LEFT JOIN hub_users u ON u.tim_id = t.id OR (u.tim_id IS NULL AND u.nama = t.nama)
      ${where}
      ORDER BY t.entitas, t.divisi, t.nama
    `;
    const result = await hubPool.query(q, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data tim' });
  }
});

// POST /api/hub/tim — tambah anggota + buat akun sekaligus
router.post('/tim', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { nama, divisi, level, tipe, entitas, username, password, role } = req.body;
  if (!nama || !divisi || !entitas || !username || !password)
    return res.status(400).json({ error: 'Nama, divisi, entitas, username, dan password wajib diisi' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  const client = await hubPool.connect();
  try {
    await client.query('BEGIN');
    const timR = await client.query(
      'INSERT INTO tim (nama, divisi, level, tipe, entitas) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [nama, divisi, level || '', tipe || '', entitas]
    );
    const timId = timR.rows[0].id;
    const hashed = await bcrypt.hash(password, 10);
    const userR = await client.query(
      'INSERT INTO hub_users (nama, username, password, role, aktif, tim_id) VALUES ($1,$2,$3,$4,TRUE,$5) RETURNING id, username, role',
      [nama, username.toLowerCase().trim(), hashed, role || 'member', timId]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { ...timR.rows[0], username: userR.rows[0].username, role: userR.rows[0].role } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Username sudah digunakan' });
    res.status(500).json({ error: 'Gagal menambah anggota' });
  } finally {
    client.release();
  }
});

// PATCH /api/hub/tim/:id — edit data anggota + akun
router.patch('/tim/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { nama, divisi, level, tipe, aktif, entitas, username, role } = req.body;
  if (!nama || !divisi || !entitas)
    return res.status(400).json({ error: 'Nama, divisi, dan entitas wajib diisi' });
  const client = await hubPool.connect();
  try {
    await client.query('BEGIN');
    const timR = await client.query(
      'UPDATE tim SET nama=$1, divisi=$2, level=$3, tipe=$4, aktif=$5, entitas=$6, updated_at=NOW() WHERE id=$7 RETURNING *',
      [nama, divisi, level || '', tipe || '', aktif !== undefined ? aktif : true, entitas, req.params.id]
    );
    if (!timR.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Anggota tidak ditemukan' }); }
    let userInfo = {};
    if (username || role) {
      const userR = await client.query(
        'UPDATE hub_users SET nama=$1, username=COALESCE($2, username), role=COALESCE($3, role) WHERE tim_id=$4 OR (tim_id IS NULL AND nama=$1) RETURNING username, role',
        [nama, username ? username.toLowerCase().trim() : null, role || null, req.params.id]
      );
      if (userR.rows.length) userInfo = { username: userR.rows[0].username, role: userR.rows[0].role };
    }
    await client.query('COMMIT');
    res.json({ success: true, data: { ...timR.rows[0], ...userInfo } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Username sudah digunakan' });
    res.status(500).json({ error: 'Gagal update anggota' });
  } finally {
    client.release();
  }
});

// DELETE /api/hub/tim/:id — nonaktifkan anggota + akun
router.delete('/tim/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const client = await hubPool.connect();
  try {
    await client.query('BEGIN');
    const timR = await client.query('UPDATE tim SET aktif=FALSE, updated_at=NOW() WHERE id=$1 RETURNING *', [req.params.id]);
    if (!timR.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Anggota tidak ditemukan' }); }
    await client.query('UPDATE hub_users SET aktif=FALSE WHERE tim_id=$1 OR (tim_id IS NULL AND nama=$2)', [req.params.id, timR.rows[0].nama]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch { await client.query('ROLLBACK'); res.status(500).json({ error: 'Gagal nonaktifkan anggota' }); }
  finally { client.release(); }
});

// PATCH /api/hub/tim/:id/aktifkan — aktifkan kembali
router.patch('/tim/:id/aktifkan', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const client = await hubPool.connect();
  try {
    await client.query('BEGIN');
    const timR = await client.query('UPDATE tim SET aktif=TRUE, updated_at=NOW() WHERE id=$1 RETURNING *', [req.params.id]);
    if (!timR.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Anggota tidak ditemukan' }); }
    await client.query('UPDATE hub_users SET aktif=TRUE WHERE tim_id=$1 OR (tim_id IS NULL AND nama=$2)', [req.params.id, timR.rows[0].nama]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch { await client.query('ROLLBACK'); res.status(500).json({ error: 'Gagal mengaktifkan anggota' }); }
  finally { client.release(); }
});

// ── DASHBOARD STATS ───────────────────────────────

// GET /api/hub/dashboard — ringkasan untuk dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const [jurnal, profiling, reward, skb] = await Promise.all([
      query(`SELECT COUNT(*) as total,
               COUNT(DISTINCT CASE WHEN tanggal_jurnal >= DATE_TRUNC('week', CURRENT_DATE) THEN nama END) as minggu_ini,
               ROUND(AVG(CASE WHEN tanggal_jurnal >= DATE_TRUNC('week', CURRENT_DATE) THEN mood END),1) as avg_mood
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

// ── ABSENSI TIM ───────────────────────────────────────────────────────────────

// Startup migration — idempotent
(async () => {
  try {
    await hubPool.query(`
      CREATE TABLE IF NOT EXISTS absensi_sesi (
        id         SERIAL PRIMARY KEY,
        label      VARCHAR(200) NOT NULL,
        tanggal    DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await hubPool.query(`
      CREATE TABLE IF NOT EXISTS absensi_kehadiran (
        id         SERIAL PRIMARY KEY,
        sesi_id    INTEGER NOT NULL REFERENCES absensi_sesi(id) ON DELETE CASCADE,
        nama       VARCHAR(100) NOT NULL,
        status     VARCHAR(20) NOT NULL DEFAULT 'tidak_hadir'
                     CHECK (status IN ('hadir','terlambat','izin','sakit','tidak_hadir')),
        catatan    TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (sesi_id, nama)
      )
    `);
    await hubPool.query(`
      CREATE INDEX IF NOT EXISTS idx_absensi_kehadiran_sesi_id ON absensi_kehadiran (sesi_id)
    `);
  } catch (e) { /* tables may already exist */ }
})();

// GET /api/hub/absensi/sesi — list semua sesi, newest first
router.get('/absensi/sesi', authMiddleware, async (req, res) => {
  try {
    const r = await hubPool.query(
      'SELECT * FROM absensi_sesi ORDER BY tanggal DESC, id DESC'
    );
    res.json({ success: true, data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal mengambil sesi absensi' }); }
});

// GET /api/hub/absensi/sesi/:id — detail sesi + kehadiran
router.get('/absensi/sesi/:id', authMiddleware, async (req, res) => {
  try {
    const sesiR = await hubPool.query('SELECT * FROM absensi_sesi WHERE id=$1', [req.params.id]);
    if (!sesiR.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    const keR = await hubPool.query(
      'SELECT nama, status, catatan FROM absensi_kehadiran WHERE sesi_id=$1 ORDER BY nama',
      [req.params.id]
    );
    res.json({ success: true, data: { ...sesiR.rows[0], kehadiran: keR.rows } });
  } catch { res.status(500).json({ error: 'Gagal mengambil detail absensi' }); }
});

// POST /api/hub/absensi/sesi — buat sesi baru + auto-populate semua anggota aktif
router.post('/absensi/sesi', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { label, tanggal } = req.body;
  if (!label || !tanggal) return res.status(400).json({ error: 'Label dan tanggal wajib diisi' });
  const client = await hubPool.connect();
  try {
    await client.query('BEGIN');
    const sesiR = await client.query(
      'INSERT INTO absensi_sesi (label, tanggal) VALUES ($1, $2) RETURNING *',
      [label, tanggal]
    );
    const sesiId = sesiR.rows[0].id;
    const timR = await client.query('SELECT nama FROM tim WHERE aktif = TRUE ORDER BY nama');
    if (timR.rows.length > 0) {
      const vals = timR.rows.map((_, i) => `($1, $${i + 2}, 'tidak_hadir', NOW())`).join(', ');
      const params = [sesiId, ...timR.rows.map(r => r.nama)];
      await client.query(
        `INSERT INTO absensi_kehadiran (sesi_id, nama, status, updated_at) VALUES ${vals} ON CONFLICT DO NOTHING`,
        params
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: sesiR.rows[0], anggota: timR.rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Gagal membuat sesi absensi' });
  } finally {
    client.release();
  }
});

// PATCH /api/hub/absensi/:sesi_id/:nama — upsert status 1 anggota
router.patch('/absensi/:sesi_id/:nama', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { sesi_id, nama } = req.params;
  const { status, catatan } = req.body;
  const VALID = ['hadir', 'terlambat', 'izin', 'sakit', 'tidak_hadir'];
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Status tidak valid' });
  try {
    await hubPool.query(`
      INSERT INTO absensi_kehadiran (sesi_id, nama, status, catatan, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (sesi_id, nama)
      DO UPDATE SET status=$3, catatan=$4, updated_at=NOW()
    `, [parseInt(sesi_id), nama, status, catatan || null]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal update absensi' }); }
});

// PUT /api/hub/absensi/sesi/:id — edit label/tanggal sesi
router.put('/absensi/sesi/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { label, tanggal } = req.body;
  if (!label?.trim() || !tanggal) return res.status(400).json({ error: 'Label dan tanggal wajib diisi' });
  try {
    const r = await hubPool.query(
      'UPDATE absensi_sesi SET label=$1, tanggal=$2 WHERE id=$3 RETURNING *',
      [label.trim(), tanggal, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    res.json({ ok: true, data: r.rows[0] });
  } catch { res.status(500).json({ error: 'Gagal update sesi' }); }
});

// DELETE /api/hub/absensi/sesi/:id — hapus sesi (cascade ke kehadiran)
router.delete('/absensi/sesi/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const r = await hubPool.query('DELETE FROM absensi_sesi WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal hapus sesi' }); }
});

// ── LAPORAN BULANAN ───────────────────────────────────────────────────────────
// GET /api/hub/laporan-bulanan?bulan=2026-07
// Mengembalikan agregat per anggota untuk bulan tertentu
router.get('/laporan-bulanan', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { bulan } = req.query; // format: YYYY-MM
  if (!bulan || !/^\d{4}-\d{2}$/.test(bulan)) return res.status(400).json({ error: 'Parameter bulan wajib (format: YYYY-MM)' });

  const [tahun, bln] = bulan.split('-').map(Number);
  const tglAwal = new Date(tahun, bln - 1, 1);
  const tglAkhir = new Date(tahun, bln, 0, 23, 59, 59); // akhir bulan

  try {
    const [jurnalR, absensiSesiR, skbR, sesi1on1R, workshopR, rewardR] = await Promise.all([
      hubPool.query(
        `SELECT nama, tanggal_jurnal, mood, skor_karya, skor_waktu, skor_komunikasi, skor_skill, catatan_mentor
         FROM jurnal_mingguan
         WHERE tanggal_jurnal >= $1 AND tanggal_jurnal <= $2
         ORDER BY nama, tanggal_jurnal`,
        [tglAwal, tglAkhir]
      ),
      hubPool.query(
        `SELECT s.id, s.tanggal, k.nama, k.status
         FROM absensi_sesi s
         JOIN absensi_kehadiran k ON k.sesi_id = s.id
         WHERE s.tanggal >= $1 AND s.tanggal <= $2`,
        [tglAwal, tglAkhir]
      ),
      hubPool.query(
        `SELECT nama, status, created_at FROM skb
         WHERE created_at >= $1 AND created_at <= $2`,
        [tglAwal, tglAkhir]
      ),
      hubPool.query(
        `SELECT anggota as nama, tanggal FROM sesi_1on1
         WHERE tanggal >= $1 AND tanggal <= $2`,
        [tglAwal, tglAkhir]
      ),
      hubPool.query('SELECT nama, hadir FROM workshop_kehadiran'),
      hubPool.query(
        `SELECT nama, nominal, kategori FROM reward_tracking
         WHERE tanggal >= $1 AND tanggal <= $2`,
        [tglAwal, tglAkhir]
      ),
    ]);

    // Hitung total sesi absensi unik bulan ini
    const sesiIds = [...new Set(absensiSesiR.rows.map(r => r.id))];
    const totalSesiAbsensi = sesiIds.length;

    // Total sesi workshop (semua layer × sesi, tidak per bulan karena tidak ada tanggal)
    const totalSesiWorkshop = [...new Set(workshopR.rows.map(r => `${r.layer_id}_${r.sesi_idx}`))].length;

    // Grup per nama
    const namaSet = new Set([
      ...jurnalR.rows.map(r => r.nama),
      ...absensiSesiR.rows.map(r => r.nama),
      ...skbR.rows.map(r => r.nama),
      ...sesi1on1R.rows.map(r => r.nama),
      ...workshopR.rows.map(r => r.nama),
      ...rewardR.rows.map(r => r.nama),
    ]);

    const laporan = [...namaSet].sort().map(nama => {
      // Jurnal
      const jurnal = jurnalR.rows.filter(r => r.nama === nama);
      const jmlJurnal = jurnal.length;
      const avgMood      = jmlJurnal ? +(jurnal.reduce((s,r) => s + (r.mood||0), 0) / jmlJurnal).toFixed(1) : null;
      const avgKarya     = jmlJurnal ? +(jurnal.reduce((s,r) => s + (r.skor_karya||0), 0) / jmlJurnal).toFixed(1) : null;
      const avgWaktu     = jmlJurnal ? +(jurnal.reduce((s,r) => s + (r.skor_waktu||0), 0) / jmlJurnal).toFixed(1) : null;
      const avgKomunikasi= jmlJurnal ? +(jurnal.reduce((s,r) => s + (r.skor_komunikasi||0), 0) / jmlJurnal).toFixed(1) : null;
      const avgSkill     = jmlJurnal ? +(jurnal.reduce((s,r) => s + (r.skor_skill||0), 0) / jmlJurnal).toFixed(1) : null;
      const avgKinerja   = (avgKarya && avgWaktu && avgKomunikasi && avgSkill)
        ? +((avgKarya + avgWaktu + avgKomunikasi + avgSkill) / 4).toFixed(1) : null;
      const catatanMentor = jurnal.filter(r => r.catatan_mentor).at(-1)?.catatan_mentor || null;

      // Absensi
      const absensi = absensiSesiR.rows.filter(r => r.nama === nama);
      const hadirCount = absensi.filter(r => r.status === 'hadir' || r.status === 'terlambat').length;
      const terlambatCount = absensi.filter(r => r.status === 'terlambat').length;
      const pctAbsensi = totalSesiAbsensi > 0 ? Math.round(hadirCount / totalSesiAbsensi * 100) : null;

      // Workshop
      const ws = workshopR.rows.filter(r => r.nama === nama);
      const wsHadir = ws.filter(r => r.hadir).length;
      const pctWorkshop = totalSesiWorkshop > 0 ? Math.round(wsHadir / totalSesiWorkshop * 100) : null;

      // SKB
      const skb = skbR.rows.filter(r => r.nama === nama);
      const skbDisetujui = skb.filter(r => r.status === 'disetujui' || r.status === 'selesai').length;

      // 1-on-1
      const sesi1on1 = sesi1on1R.rows.filter(r => r.nama === nama);
      const tgl1on1Terakhir = sesi1on1.at(-1)?.tanggal || null;

      // Reward
      const reward = rewardR.rows.filter(r => r.nama === nama);
      const totalReward = reward.reduce((s,r) => s + Number(r.nominal||0), 0);

      // Status kesehatan (badge)
      let status = 'baik';
      if (pctAbsensi !== null && pctAbsensi < 70) status = 'risiko';
      else if ((avgMood !== null && avgMood < 3) || (pctAbsensi !== null && pctAbsensi < 80)) status = 'perhatian';

      return {
        nama, jmlJurnal,
        avgMood, avgKinerja, avgKarya, avgWaktu, avgKomunikasi, avgSkill,
        catatanMentor,
        totalSesiAbsensi, hadirCount, terlambatCount, pctAbsensi,
        totalSesiWorkshop, wsHadir, pctWorkshop,
        skbTotal: skb.length, skbDisetujui,
        sesi1on1Total: sesi1on1.length, tgl1on1Terakhir,
        totalReward, reward,
        status,
      };
    });

    res.json({ success: true, data: { bulan, laporan } });
  } catch (err) {
    console.error('Laporan bulanan error:', err);
    res.status(500).json({ error: 'Gagal membuat laporan bulanan' });
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


// POST /api/hub/tim/:id/buat-akun — buat akun login untuk anggota yang belum punya
router.post('/tim/:id/buat-akun', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { username, password, role } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: 'Username wajib diisi' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter' });
  try {
    const timR = await hubPool.query('SELECT * FROM tim WHERE id=$1', [req.params.id]);
    if (!timR.rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
    const { nama } = timR.rows[0];
    // Cek sudah punya akun belum
    const existing = await hubPool.query('SELECT id FROM hub_users WHERE tim_id=$1 OR nama=$2', [req.params.id, nama]);
    if (existing.rows.length) return res.status(409).json({ error: 'Anggota sudah punya akun login' });
    const hashed = await bcrypt.hash(password, 10);
    const r = await hubPool.query(
      'INSERT INTO hub_users (nama, username, password, role, aktif, tim_id) VALUES ($1,$2,$3,$4,TRUE,$5) RETURNING id, username, role',
      [nama, username.trim().toLowerCase(), hashed, role || 'member', req.params.id]
    );
    res.status(201).json({ ok: true, data: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username sudah digunakan' });
    res.status(500).json({ error: 'Gagal membuat akun' });
  }
});

// PATCH /api/hub/tim/:id/reset-password
router.patch('/tim/:id/reset-password', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  const { password_baru } = req.body;
  if (!password_baru || !password_baru.trim())
    return res.status(400).json({ error: 'Password baru wajib diisi' });
  if (password_baru.trim().length < 8)
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  try {
    const timR = await hubPool.query('SELECT nama FROM tim WHERE id=$1', [req.params.id]);
    if (!timR.rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
    const nama = timR.rows[0].nama;
    const hashed = await bcrypt.hash(password_baru.trim(), 10);
    const r = await hubPool.query(
      'UPDATE hub_users SET password=$1 WHERE (tim_id=$2 OR (tim_id IS NULL AND nama=$3)) RETURNING username',
      [hashed, req.params.id, nama]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'User tidak ditemukan' });
    res.json({ ok: true, username: r.rows[0].username });
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
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang dapat mencatat revenue' });
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
    // Simpan reply ke kolom catatan_mentor (repurpose untuk admin reply)
    // Prefix dengan marker agar bisa dibedakan dari catatan member
    const r = await hubPool.query(
      `UPDATE jurnal_mingguan SET catatan_mentor = $1 WHERE id = $2 RETURNING id, nama`,
      [`[ADMIN_REPLY] ${reply}`, req.params.id]
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
        if (j.catatan_mentor?.trim() && !j.catatan_mentor.startsWith('[ADMIN_REPLY]')) {
          bagian.push(`Pesan: "${j.catatan_mentor}".`);
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
// Tabel laporan_admin_mingguan didefinisikan di database/schema.sql

const LAPORAN_ADMIN_SCREENSHOT_FIELDS = [
  'screenshot_account_status', 'screenshot_earnings', 'screenshot_active_gigs',
  'screenshot_weekly_gigs_score', 'screenshot_weekly_overview', 'screenshot_yearly_overview',
  'screenshot_total_impressions', 'screenshot_fiverr_ads', 'screenshot_porto_baru',
];

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
    res.json({ data: r.rows[0] });
  } catch { res.status(500).json({ error: 'Gagal ambil laporan' }); }
});

// POST /api/hub/laporan-admin — buat laporan baru
router.post('/laporan-admin', authMiddleware, async (req, res) => {
  if (!await isAdminOrMarket(req)) return res.status(403).json({ error: 'Akses ditolak' });
  const {
    tanggal, akun, periode,
    gigs_tags, order_queue, flow_new_order, flow_complete_order,
    gigs_utama, todo_list, kendala_list, catatan,
  } = req.body;
  if (!tanggal || !akun) return res.status(400).json({ error: 'Tanggal dan akun wajib diisi' });
  const screenshotCols = LAPORAN_ADMIN_SCREENSHOT_FIELDS;
  const screenshotVals = screenshotCols.map(f => JSON.stringify(req.body[f] || []));
  try {
    const r = await pool.query(
      `INSERT INTO laporan_admin_mingguan
        (tanggal, akun, periode, gigs_tags, order_queue, flow_new_order, flow_complete_order,
         gigs_utama, todo_list, kendala_list, catatan, dibuat_oleh, ${screenshotCols.join(', ')})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING id, tanggal, akun, dibuat_oleh`,
      [tanggal, akun, periode||'', JSON.stringify(gigs_tags||[]), JSON.stringify(order_queue||{}),
       flow_new_order||0, flow_complete_order||0, JSON.stringify(gigs_utama||[]),
       JSON.stringify(todo_list||[]), JSON.stringify(kendala_list||[]), catatan||'', req.user.nama,
       ...screenshotVals]
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Laporan untuk akun dan tanggal ini sudah ada' });
    res.status(500).json({ error: 'Gagal simpan laporan: ' + e.message });
  }
});

// PUT /api/hub/laporan-admin/:id — update laporan
router.put('/laporan-admin/:id', authMiddleware, async (req, res) => {
  if (!await isAdminOrMarket(req)) return res.status(403).json({ error: 'Akses ditolak' });
  const {
    tanggal, akun, periode,
    gigs_tags, order_queue, flow_new_order, flow_complete_order,
    gigs_utama, todo_list, kendala_list, catatan,
  } = req.body;
  const screenshotCols = LAPORAN_ADMIN_SCREENSHOT_FIELDS;
  const screenshotSets = screenshotCols.map((f, i) => `${f}=$${13 + i}`);
  const screenshotVals = screenshotCols.map(f => JSON.stringify(req.body[f] || []));
  try {
    const result = await pool.query(
      `UPDATE laporan_admin_mingguan SET
        tanggal=$1, akun=$2, periode=$3, gigs_tags=$4, order_queue=$5,
        flow_new_order=$6, flow_complete_order=$7, gigs_utama=$8,
        todo_list=$9, kendala_list=$10, catatan=$11, ${screenshotSets.join(', ')}
       WHERE id=$12`,
      [tanggal, akun, periode||'', JSON.stringify(gigs_tags||[]), JSON.stringify(order_queue||{}),
       flow_new_order||0, flow_complete_order||0, JSON.stringify(gigs_utama||[]),
       JSON.stringify(todo_list||[]), JSON.stringify(kendala_list||[]), catatan||'',
       req.params.id, ...screenshotVals]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Laporan untuk akun dan tanggal ini sudah ada' });
    res.status(500).json({ error: 'Gagal update: ' + e.message });
  }
});

// DELETE /api/hub/laporan-admin/:id
router.delete('/laporan-admin/:id', authMiddleware, async (req, res) => {
  if (!await isAdminOrMarket(req)) return res.status(403).json({ error: 'Akses ditolak' });
  try {
    await pool.query('DELETE FROM laporan_admin_mingguan WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal hapus' }); }
});

// ── META ADS ──────────────────────────────────────────────────────────────────

// Startup migration — idempotent
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meta_ads_brands (
        id              SERIAL PRIMARY KEY,
        nama            VARCHAR(100) NOT NULL UNIQUE,
        ad_account_id   VARCHAR(50)  NOT NULL,
        pixel_id        VARCHAR(50),
        aktif           BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ  DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meta_ads_insights (
        id              SERIAL PRIMARY KEY,
        brand_id        INTEGER      NOT NULL REFERENCES meta_ads_brands(id) ON DELETE CASCADE,
        tanggal         DATE         NOT NULL,
        spend           NUMERIC(12,2) NOT NULL DEFAULT 0,
        klik            INTEGER      NOT NULL DEFAULT 0,
        impresi         INTEGER      NOT NULL DEFAULT 0,
        reach           INTEGER      NOT NULL DEFAULT 0,
        cpm             NUMERIC(10,4),
        ctr             NUMERIC(8,4),
        purchase_value  NUMERIC(12,2),
        purchase_count  INTEGER,
        synced_at       TIMESTAMPTZ  DEFAULT NOW(),
        UNIQUE (brand_id, tanggal)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meta_ads_reports (
        id              SERIAL PRIMARY KEY,
        brand_id        INTEGER      NOT NULL REFERENCES meta_ads_brands(id) ON DELETE CASCADE,
        tanggal         DATE         NOT NULL,
        jumlah_order    INTEGER      NOT NULL DEFAULT 0,
        omzet           NUMERIC(12,2) NOT NULL DEFAULT 0,
        hpp_persen      NUMERIC(5,2) NOT NULL DEFAULT 0,
        catatan         TEXT,
        created_by      VARCHAR(100),
        updated_at      TIMESTAMPTZ  DEFAULT NOW(),
        UNIQUE (brand_id, tanggal)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meta_ads_thresholds (
        id              SERIAL PRIMARY KEY,
        brand_id        INTEGER      NOT NULL REFERENCES meta_ads_brands(id) ON DELETE CASCADE UNIQUE,
        max_spend_harian NUMERIC(12,2),
        min_roas        NUMERIC(8,4),
        updated_at      TIMESTAMPTZ  DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_meta_insights_brand_tgl ON meta_ads_insights (brand_id, tanggal)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_meta_reports_brand_tgl  ON meta_ads_reports  (brand_id, tanggal)`);
    // Tambah kolom kurs_usd dan hpp_default ke meta_ads_brands
    await pool.query(`ALTER TABLE meta_ads_brands ADD COLUMN IF NOT EXISTS kurs_usd NUMERIC(12,2) NOT NULL DEFAULT 16000`);
    await pool.query(`ALTER TABLE meta_ads_brands ADD COLUMN IF NOT EXISTS hpp_default NUMERIC(5,2) NOT NULL DEFAULT 0`);
    // Hapus hpp_persen dari meta_ads_reports (tidak lagi dipakai per-hari)
    // Tidak drop kolom agar data lama aman — cukup abaikan di logic baru
  } catch (e) { console.error('Meta Ads migration:', e.message); }
})();

// ── META ADS HELPER ──────────────────────────────────────────────────────────

async function syncMetaInsights(brandId, adAccountId, tanggal) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error('META_ACCESS_TOKEN tidak di-set');

  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const fields = 'spend,clicks,impressions,reach,cpm,ctr,actions,action_values';
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights` +
    `?fields=${fields}&time_range={"since":"${tanggal}","until":"${tanggal}"}` +
    `&time_increment=1&level=account&access_token=${token}`;

  const fetch = require('node-fetch');
  const resp = await fetch(url);
  const json = await resp.json();
  if (json.error) throw new Error(json.error.message);

  const row = (json.data || [])[0];
  if (!row) return null;

  const findAction = (actions, type) =>
    Number((actions || []).find(a => a.action_type === type)?.value || 0);
  const findValue = (vals, type) =>
    Number((vals || []).find(a => a.action_type === type)?.value || 0);

  const data = {
    spend:          Number(row.spend          || 0),
    klik:           Number(row.clicks         || 0),
    impresi:        Number(row.impressions    || 0),
    reach:          Number(row.reach          || 0),
    cpm:            Number(row.cpm            || 0),
    ctr:            Number(row.ctr            || 0),
    purchase_count: findAction(row.actions,       'purchase'),
    purchase_value: findValue (row.action_values, 'purchase'),
  };

  await pool.query(`
    INSERT INTO meta_ads_insights
      (brand_id, tanggal, spend, klik, impresi, reach, cpm, ctr, purchase_value, purchase_count, synced_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
    ON CONFLICT (brand_id, tanggal) DO UPDATE SET
      spend=$3, klik=$4, impresi=$5, reach=$6, cpm=$7, ctr=$8,
      purchase_value=$9, purchase_count=$10, synced_at=NOW()
  `, [brandId, tanggal, data.spend, data.klik, data.impresi, data.reach,
      data.cpm, data.ctr, data.purchase_value, data.purchase_count]);

  return data;
}

// ── META ADS ENDPOINTS ────────────────────────────────────────────────────────

// GET /api/hub/meta-ads/brands
router.get('/meta-ads/brands', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const r = await pool.query('SELECT id, nama, ad_account_id, pixel_id, aktif, kurs_usd, hpp_default FROM meta_ads_brands ORDER BY nama');
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil brands' }); }
});

// PUT /api/hub/meta-ads/brands/:id/settings — update kurs USD dan HPP default
router.put('/meta-ads/brands/:id/settings', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { kurs_usd, hpp_default } = req.body;
  if (kurs_usd == null || hpp_default == null) return res.status(400).json({ error: 'kurs_usd dan hpp_default wajib' });
  try {
    await pool.query(
      `UPDATE meta_ads_brands SET kurs_usd=$1, hpp_default=$2 WHERE id=$3`,
      [Number(kurs_usd), Number(hpp_default), req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Gagal update settings: ' + e.message }); }
});

// POST /api/hub/meta-ads/brands
router.post('/meta-ads/brands', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { nama, ad_account_id, pixel_id } = req.body;
  if (!nama || !ad_account_id) return res.status(400).json({ error: 'nama dan ad_account_id wajib' });
  try {
    const r = await pool.query(
      `INSERT INTO meta_ads_brands (nama, ad_account_id, pixel_id) VALUES ($1,$2,$3) RETURNING *`,
      [nama, ad_account_id, pixel_id || null]
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Brand sudah ada' });
    res.status(500).json({ error: 'Gagal simpan brand' });
  }
});

// PUT /api/hub/meta-ads/brands/:id
router.put('/meta-ads/brands/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { nama, ad_account_id, pixel_id, aktif } = req.body;
  try {
    await pool.query(
      `UPDATE meta_ads_brands SET nama=$1, ad_account_id=$2, pixel_id=$3, aktif=$4 WHERE id=$5`,
      [nama, ad_account_id, pixel_id || null, aktif !== false, req.params.id]
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal update brand' }); }
});

// GET /api/hub/meta-ads/insights?brand_id=&bulan=YYYY-MM
router.get('/meta-ads/insights', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { brand_id, bulan } = req.query;
  try {
    let whereClause = '';
    const params = [];
    if (brand_id) { params.push(brand_id); whereClause += ` AND i.brand_id=$${params.length}`; }
    if (bulan)    { params.push(bulan + '-01'); whereClause += ` AND DATE_TRUNC('month', i.tanggal)=DATE_TRUNC('month', $${params.length}::date)`; }
    const r = await pool.query(`
      SELECT i.id, i.brand_id, i.tanggal::text, i.spend, i.klik, i.impresi, i.reach, i.cpm, i.ctr, i.purchase_value, i.purchase_count, i.synced_at,
             b.nama AS brand_nama, b.ad_account_id, b.kurs_usd, b.hpp_default,
             r.jumlah_order, r.omzet,
             ROUND(r.omzet / NULLIF(b.kurs_usd, 0), 2) AS omzet_usd,
             b.hpp_default AS hpp_persen,
             ROUND(r.omzet - (r.omzet * b.hpp_default / 100) - i.spend, 2) AS profit_bersih,
             CASE WHEN i.spend > 0 THEN ROUND(r.omzet / i.spend, 4) END   AS roas_aktual
      FROM meta_ads_insights i
      JOIN meta_ads_brands b ON b.id = i.brand_id
      LEFT JOIN meta_ads_reports r ON r.brand_id = i.brand_id AND r.tanggal = i.tanggal
      WHERE 1=1 ${whereClause}
      ORDER BY i.tanggal DESC
    `, params);
    res.json({ data: r.rows });
  } catch (e) { res.status(500).json({ error: 'Gagal ambil insights: ' + e.message }); }
});

// POST /api/hub/meta-ads/report — input manual order/omzet (dalam USD, dikonversi ke IDR)
router.post('/meta-ads/report', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { brand_id, tanggal, jumlah_order, omzet_usd, catatan } = req.body;
  if (!brand_id || !tanggal) return res.status(400).json({ error: 'brand_id dan tanggal wajib' });
  try {
    const br = await pool.query('SELECT kurs_usd, hpp_default FROM meta_ads_brands WHERE id=$1', [brand_id]);
    const kurs = Number(br.rows[0]?.kurs_usd || 16000);
    const hppDefault = Number(br.rows[0]?.hpp_default || 0);
    const omzetIdr = Number(omzet_usd || 0) * kurs;
    const r = await pool.query(`
      INSERT INTO meta_ads_reports (brand_id, tanggal, jumlah_order, omzet, hpp_persen, catatan, created_by, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (brand_id, tanggal) DO UPDATE SET
        jumlah_order=$3, omzet=$4, hpp_persen=$5, catatan=$6, updated_at=NOW()
      RETURNING *
    `, [brand_id, tanggal, jumlah_order || 0, omzetIdr, hppDefault, catatan || null, req.user.nama]);
    res.json({ data: r.rows[0], kurs_dipakai: kurs });
  } catch (e) { res.status(500).json({ error: 'Gagal simpan report: ' + e.message }); }
});

// GET /api/hub/meta-ads/laporan?bulan=YYYY-MM&brand_id=
router.get('/meta-ads/laporan', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { bulan, brand_id } = req.query;
  const bulanParam = bulan || new Date().toISOString().slice(0, 7);
  try {
    const params = [bulanParam + '-01'];
    let brandFilter = '';
    if (brand_id) { params.push(brand_id); brandFilter = ` AND b.id=$${params.length}`; }
    const r = await pool.query(`
      SELECT
        b.id AS brand_id, b.nama AS brand_nama,
        COALESCE(SUM(i.spend), 0)::NUMERIC(12,2)          AS total_spend,
        COALESCE(SUM(i.klik), 0)                           AS total_klik,
        COALESCE(SUM(i.impresi), 0)                        AS total_impresi,
        COALESCE(AVG(i.cpm), 0)::NUMERIC(10,4)             AS avg_cpm,
        COALESCE(AVG(i.ctr), 0)::NUMERIC(8,4)              AS avg_ctr,
        COALESCE(SUM(r.jumlah_order), 0)                   AS total_order,
        COALESCE(SUM(r.omzet), 0)::NUMERIC(12,2)           AS total_omzet,
        COALESCE(AVG(r.hpp_persen), 0)::NUMERIC(5,2)       AS avg_hpp_persen,
        COALESCE(
          SUM(r.omzet - (r.omzet * r.hpp_persen / 100)) - SUM(i.spend), 0
        )::NUMERIC(12,2)                                   AS total_profit_bersih,
        CASE WHEN SUM(i.spend) > 0
          THEN ROUND(SUM(r.omzet) / SUM(i.spend), 4) END  AS roas
      FROM meta_ads_brands b
      LEFT JOIN meta_ads_insights i
        ON i.brand_id = b.id AND DATE_TRUNC('month', i.tanggal) = DATE_TRUNC('month', $1::date)
      LEFT JOIN meta_ads_reports r
        ON r.brand_id = b.id AND r.tanggal = i.tanggal
      WHERE b.aktif = TRUE ${brandFilter}
      GROUP BY b.id, b.nama
      ORDER BY b.nama
    `, params);
    res.json({ data: r.rows });
  } catch (e) { res.status(500).json({ error: 'Gagal ambil laporan: ' + e.message }); }
});

// POST /api/hub/meta-ads/sync/:brandId — sync data dari Meta API untuk tanggal tertentu
router.post('/meta-ads/sync/:brandId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { tanggal } = req.body;
  const tgl = tanggal || new Date().toISOString().slice(0, 10);
  try {
    const br = await pool.query('SELECT * FROM meta_ads_brands WHERE id=$1 AND aktif=TRUE', [req.params.brandId]);
    if (!br.rows.length) return res.status(404).json({ error: 'Brand tidak ditemukan' });
    const brand = br.rows[0];
    const data = await syncMetaInsights(brand.id, brand.ad_account_id, tgl);
    if (!data) return res.json({ ok: true, message: 'Tidak ada data dari Meta untuk tanggal ini' });
    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ error: 'Gagal sync: ' + e.message }); }
});

// POST /api/hub/meta-ads/sync-range/:brandId — sync range tanggal
router.post('/meta-ads/sync-range/:brandId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { dari, sampai } = req.body;
  if (!dari || !sampai) return res.status(400).json({ error: 'Perlu dari & sampai' });
  try {
    const br = await pool.query('SELECT * FROM meta_ads_brands WHERE id=$1 AND aktif=TRUE', [req.params.brandId]);
    if (!br.rows.length) return res.status(404).json({ error: 'Brand tidak ditemukan' });
    const brand = br.rows[0];
    const start = new Date(dari), end = new Date(sampai);
    if (start > end) return res.status(400).json({ error: 'Tanggal dari harus sebelum sampai' });
    const results = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const tgl = d.toISOString().slice(0, 10);
      try {
        const data = await syncMetaInsights(brand.id, brand.ad_account_id, tgl);
        results.push({ tanggal: tgl, ok: true, data });
      } catch (e) {
        results.push({ tanggal: tgl, ok: false, error: e.message });
      }
    }
    const ok = results.filter(r => r.ok).length;
    res.json({ ok: true, total: results.length, berhasil: ok, gagal: results.length - ok, results });
  } catch (e) { res.status(500).json({ error: 'Gagal sync range: ' + e.message }); }
});

// POST /api/hub/meta-ads/sync-all — sync semua brand aktif (dipanggil cron)
router.post('/meta-ads/sync-all', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const tgl = req.body.tanggal || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  try {
    const brands = await pool.query('SELECT * FROM meta_ads_brands WHERE aktif=TRUE');
    const results = await Promise.allSettled(
      brands.rows.map(b => syncMetaInsights(b.id, b.ad_account_id, tgl))
    );
    const summary = results.map((r, i) => ({
      brand: brands.rows[i].nama,
      status: r.status,
      error: r.reason?.message,
    }));
    res.json({ ok: true, tanggal: tgl, summary });
  } catch (e) { res.status(500).json({ error: 'Gagal sync all: ' + e.message }); }
});

// ── AI INSIGHT ───────────────────────────────────────────────────────────────

// POST /api/hub/ai/insight-ads
router.post('/ai/insight-ads', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { bulan, brand_id } = req.body;
  if (!bulan) return res.status(400).json({ error: 'Perlu bulan (YYYY-MM)' });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY tidak di-set' });

  try {
    const brandFilter = brand_id ? 'AND i.brand_id = $2' : '';
    const params = brand_id ? [bulan + '-01', brand_id] : [bulan + '-01'];
    const r = await pool.query(`
      SELECT
        b.nama AS brand,
        i.tanggal::text,
        i.spend, i.klik, i.impresi, i.ctr, i.cpm,
        rep.jumlah_order, rep.omzet, rep.hpp_persen,
        CASE WHEN rep.omzet IS NOT NULL AND i.spend > 0
          THEN ROUND((rep.omzet - rep.omzet * COALESCE(rep.hpp_persen,0)/100 - i.spend)::numeric, 0)
          ELSE NULL END AS profit_bersih,
        CASE WHEN i.spend > 0 AND rep.omzet IS NOT NULL
          THEN ROUND((rep.omzet / i.spend)::numeric, 2)
          ELSE NULL END AS roas
      FROM meta_ads_insights i
      JOIN meta_ads_brands b ON b.id = i.brand_id
      LEFT JOIN meta_ads_reports rep ON rep.brand_id = i.brand_id AND rep.tanggal = i.tanggal
      WHERE DATE_TRUNC('month', i.tanggal) = DATE_TRUNC('month', $1::date) ${brandFilter}
      ORDER BY i.tanggal DESC
    `, params);

    if (!r.rows.length) return res.status(404).json({ error: 'Tidak ada data untuk periode ini' });

    const totalSpend   = r.rows.reduce((s, x) => s + Number(x.spend || 0), 0);
    const totalKlik    = r.rows.reduce((s, x) => s + Number(x.klik || 0), 0);
    const totalOrder   = r.rows.reduce((s, x) => s + Number(x.jumlah_order || 0), 0);
    const totalOmzet   = r.rows.reduce((s, x) => s + Number(x.omzet || 0), 0);
    const avgCtr       = r.rows.reduce((s, x) => s + Number(x.ctr || 0), 0) / r.rows.length;
    const avgCpm       = r.rows.reduce((s, x) => s + Number(x.cpm || 0), 0) / r.rows.length;
    const totalProfit  = r.rows.reduce((s, x) => s + Number(x.profit_bersih || 0), 0);
    const roas         = totalSpend > 0 && totalOmzet > 0 ? (totalOmzet / totalSpend).toFixed(2) : null;

    const topCtr  = [...r.rows].sort((a,b) => Number(b.ctr||0) - Number(a.ctr||0)).slice(0,3);
    const lowCtr  = [...r.rows].sort((a,b) => Number(a.ctr||0) - Number(b.ctr||0)).slice(0,3);
    const topSpend = [...r.rows].sort((a,b) => Number(b.spend||0) - Number(a.spend||0)).slice(0,3);

    const ringkasan = `
Data Iklan Meta Ads — ${bulan}
Brand: ${[...new Set(r.rows.map(x => x.brand))].join(', ')}
Jumlah hari data: ${r.rows.length}

RINGKASAN BULAN INI:
- Total Spend: Rp ${totalSpend.toLocaleString('id-ID')}
- Total Klik: ${totalKlik.toLocaleString('id-ID')}
- Total Order: ${totalOrder}
- Total Omzet: Rp ${totalOmzet.toLocaleString('id-ID')}
- Total Profit Bersih: Rp ${totalProfit.toLocaleString('id-ID')}
- ROAS: ${roas ? roas + 'x' : 'belum ada data omzet'}
- Rata-rata CTR: ${avgCtr.toFixed(2)}%
- Rata-rata CPM: Rp ${Math.round(avgCpm).toLocaleString('id-ID')}

HARI CTR TERTINGGI:
${topCtr.map(x => `- ${x.tanggal}: CTR ${Number(x.ctr).toFixed(2)}%, Spend Rp ${Number(x.spend).toLocaleString('id-ID')}, Klik ${x.klik}`).join('\n')}

HARI CTR TERENDAH:
${lowCtr.map(x => `- ${x.tanggal}: CTR ${Number(x.ctr).toFixed(2)}%, Spend Rp ${Number(x.spend).toLocaleString('id-ID')}, Klik ${x.klik}`).join('\n')}

HARI SPEND TERTINGGI:
${topSpend.map(x => `- ${x.tanggal}: Spend Rp ${Number(x.spend).toLocaleString('id-ID')}, Klik ${x.klik}, CTR ${Number(x.ctr).toFixed(2)}%`).join('\n')}
`.trim();

    const fetch = require('node-fetch');
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'groq/compound-mini',
        messages: [
          { role: 'system', content: 'Kamu adalah analis marketing digital yang ahli dalam Meta Ads. Berikan analisis dalam Bahasa Indonesia yang ringkas, actionable, dan mudah dipahami oleh pemilik bisnis. Gunakan emoji secukupnya untuk memperjelas poin. Format dengan heading dan bullet points.' },
          { role: 'user', content: `Analisis data iklan Meta Ads berikut dan berikan:\n1. Evaluasi performa bulan ini (positif & negatif)\n2. Insight dari hari-hari dengan CTR terbaik dan terburuk\n3. Rekomendasi konkret untuk bulan depan\n4. Kesimpulan singkat\n\n${ringkasan}` }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });
    const groqJson = await groqRes.json();
    if (groqJson.error) throw new Error(groqJson.error.message);
    const rawInsight = groqJson.choices?.[0]?.message?.content || 'Tidak ada insight';
    const insight = rawInsight.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    res.json({ ok: true, insight, ringkasan });
  } catch (e) { res.status(500).json({ error: 'Gagal generate insight: ' + e.message }); }
});

// POST /api/hub/ai/chat — AI assistant dengan konteks data hub
router.post('/ai/chat', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { pesan, riwayat } = req.body;
  if (!pesan) return res.status(400).json({ error: 'Pesan kosong' });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY tidak di-set' });

  try {
    const now = new Date();
    const bulanIni = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const tglIni   = now.toISOString().slice(0,10);

    // Ambil snapshot data dari semua modul
    const [tim, jurnal, absensi, ads, reward, skb, revenue, profil, sesi1on1] = await Promise.all([
      pool.query(`SELECT nama, divisi, level, tipe, status, kriteria, kepuasan, semangat, energi FROM tim WHERE aktif=TRUE ORDER BY nama`).catch(() => ({ rows: [] })),
      pool.query(`SELECT nama, tanggal_jurnal::text, mood, skor_karya, skor_waktu, skor_komunikasi, skor_skill, catatan_mentor, hambatan, pencapaian_1 FROM jurnal_mingguan ORDER BY tanggal_jurnal DESC LIMIT 30`).catch(() => ({ rows: [] })),
      pool.query(`SELECT s.label AS nama_sesi, s.tanggal::text, a.nama, a.status FROM absensi_sesi s JOIN absensi_kehadiran a ON a.sesi_id=s.id WHERE s.tanggal >= NOW()-INTERVAL '30 days' ORDER BY s.tanggal DESC LIMIT 60`).catch(() => ({ rows: [] })),
      pool.query(`SELECT b.nama AS brand, i.tanggal::text, i.spend, i.klik, i.ctr, i.impresi, i.cpm, rep.jumlah_order, rep.omzet, rep.hpp_persen FROM meta_ads_insights i JOIN meta_ads_brands b ON b.id=i.brand_id LEFT JOIN meta_ads_reports rep ON rep.brand_id=i.brand_id AND rep.tanggal=i.tanggal WHERE DATE_TRUNC('month',i.tanggal)=DATE_TRUNC('month',$1::date) ORDER BY i.tanggal DESC`, [tglIni]).catch(() => ({ rows: [] })),
      pool.query(`SELECT nama, jenis_reward, poin, bulan::text FROM reward_tracking ORDER BY created_at DESC LIMIT 20`).catch(() => ({ rows: [] })),
      pool.query(`SELECT nama, judul, status, created_at::text FROM skb ORDER BY created_at DESC LIMIT 20`).catch(() => ({ rows: [] })),
      pool.query(`SELECT nama, bulan, tahun, jumlah, target, catatan FROM revenue_bulanan ORDER BY tahun DESC, bulan DESC LIMIT 20`).catch(() => ({ rows: [] })),
      pool.query(`SELECT t.nama, t.divisi, p.skor_teknis, p.skor_komunikasi, p.created_at::text FROM tim t LEFT JOIN LATERAL (SELECT skor_teknis, skor_komunikasi, created_at FROM profiling_illustrator WHERE nama=t.nama UNION ALL SELECT skor_teknis, skor_komunikasi, created_at FROM profiling_rigger WHERE nama=t.nama UNION ALL SELECT skor_teknis, skor_komunikasi, created_at FROM profiling_pm WHERE nama=t.nama UNION ALL SELECT skor_teknis, skor_komunikasi, created_at FROM profiling_3d WHERE nama=t.nama ORDER BY created_at DESC LIMIT 1) p ON TRUE WHERE t.aktif=TRUE`).catch(() => ({ rows: [] })),
      pool.query(`SELECT anggota, tipe, tanggal::text, ringkasan, tindak_lanjut, mood_sebelum, mood_sesudah FROM sesi_1on1 ORDER BY tanggal DESC LIMIT 10`).catch(() => ({ rows: [] })),
    ]);

    const totalAdsSpend = ads.rows.reduce((s,r) => s + Number(r.spend||0), 0);
    const totalAdsOmzet = ads.rows.reduce((s,r) => s + Number(r.omzet||0), 0);
    const totalAdsKlik  = ads.rows.reduce((s,r) => s + Number(r.klik||0), 0);
    const mingguLalu = new Date(Date.now()-7*86400000).toISOString().slice(0,10);
    const belumJurnal = tim.rows.filter(t => !jurnal.rows.some(j => j.nama===t.nama && j.tanggal_jurnal >= mingguLalu)).map(t=>t.nama);

    const konteks = `
Kamu adalah AI assistant internal Creanimasi Studio — studio VTuber model, ilustrasi anime, VRM, AR filter, 3D print.
PENTING: Selalu jawab dalam Bahasa Indonesia. Jangan gunakan bahasa lain.
PENTING: Jawab langsung, padat, dan to the point. Gunakan format poin-poin atau tabel jika perlu, tapi tetap ringkas. Maksimal 350 kata per jawaban.
Tanggal hari ini: ${tglIni}
Owner: Mas Kholed. Tim aktif: ${tim.rows.length} orang.

DATA TIM AKTIF (${tim.rows.length} anggota):
${tim.rows.map(t => `- ${t.nama} | ${t.divisi} | ${t.level} | Tipe: ${t.tipe||'-'} | Status: ${t.status||'-'}`).join('\n')}

JURNAL MINGGUAN (${jurnal.rows.length} entri terbaru):
${jurnal.rows.slice(0,15).map(j => `- ${j.nama} | ${j.tanggal_jurnal?.slice(0,10)} | mood:${j.mood||'-'} karya:${j.skor_karya||'-'} waktu:${j.skor_waktu||'-'} komunikasi:${j.skor_komunikasi||'-'} skill:${j.skor_skill||'-'}`).join('\n')}
Belum isi jurnal minggu ini (${mingguLalu} s/d ${tglIni}): ${belumJurnal.length > 0 ? belumJurnal.join(', ') : 'semua sudah isi'}

ABSENSI 30 HARI TERAKHIR (${absensi.rows.length} record):
${absensi.rows.slice(0,25).map(a => `- ${a.nama_sesi} (${a.tanggal?.slice(0,10)}): ${a.nama} — ${a.status}`).join('\n')}

META ADS BULAN INI (${bulanIni}):
Total Spend: Rp ${totalAdsSpend.toLocaleString('id-ID')}
Total Omzet: Rp ${totalAdsOmzet.toLocaleString('id-ID')}
Total Klik: ${totalAdsKlik}
ROAS: ${totalAdsSpend > 0 && totalAdsOmzet > 0 ? (totalAdsOmzet/totalAdsSpend).toFixed(2)+'x' : 'belum ada data omzet'}
Data: ${ads.rows.length} hari tercatat
${ads.rows.slice(0,7).map(a => `- ${a.tanggal?.slice(0,10)} [${a.brand}]: spend Rp${Number(a.spend||0).toLocaleString('id-ID')}, klik ${a.klik}, CTR ${Number(a.ctr||0).toFixed(2)}%, CPM ${Number(a.cpm||0).toFixed(0)}, order ${a.jumlah_order||0}, omzet Rp${Number(a.omzet||0).toLocaleString('id-ID')}`).join('\n')}

SESI 1-ON-1 TERBARU:
${sesi1on1.rows.length > 0 ? sesi1on1.rows.map(s => `- ${s.anggota} (${s.tipe}, ${s.tanggal?.slice(0,10)}): mood ${s.mood_sebelum}→${s.mood_sesudah} | ${s.ringkasan}`).join('\n') : 'Belum ada sesi 1-on-1'}

REWARD TERBARU:
${reward.rows.length > 0 ? reward.rows.slice(0,10).map(r => `- ${r.nama}: ${r.jenis_reward} (${r.poin} poin) — ${r.bulan}`).join('\n') : 'Belum ada data reward'}

SKB (Skill & Kompetensi Berbasis):
${skb.rows.length > 0 ? skb.rows.slice(0,10).map(s => `- ${s.nama}: "${s.judul}" — ${s.status} (${s.created_at?.slice(0,10)})`).join('\n') : 'Belum ada data SKB'}

REVENUE BULANAN:
${revenue.rows.length > 0 ? revenue.rows.map(r => `- ${r.nama} (${r.bulan}/${r.tahun}): Rp${Number(r.jumlah||0).toLocaleString('id-ID')} dari target Rp${Number(r.target||0).toLocaleString('id-ID')}`).join('\n') : 'Belum ada data revenue'}

PROFILING TERAKHIR:
${profil.rows.filter(p=>p.skor_teknis).map(p => `- ${p.nama} (${p.divisi}): teknis ${p.skor_teknis}, komunikasi ${p.skor_komunikasi}`).join('\n') || 'Belum ada data profiling'}
`.trim();

    const messages = [
      { role: 'system', content: konteks },
      ...(riwayat || []).slice(-6),
      { role: 'user', content: pesan },
    ];

    const fetch = require('node-fetch');
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({ model: 'groq/compound-mini', messages, temperature: 0.6, max_tokens: 800 }),
    });
    const groqJson = await groqRes.json();
    if (groqJson.error) throw new Error(groqJson.error.message);
    const rawJawaban = groqJson.choices?.[0]?.message?.content || '';
    const jawaban = rawJawaban.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    res.json({ ok: true, jawaban });
  } catch (e) { res.status(500).json({ error: 'Gagal: ' + e.message }); }
});

// ── CRON: daily sync jam 07:00 WIB (00:00 UTC) ───────────────────────────────
try {
  const cron = require('node-cron');
  cron.schedule('0 0 * * *', async () => {
    const tgl = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    console.log(`[Meta Ads Cron] Sync kemarin: ${tgl}`);
    try {
      const brands = await pool.query('SELECT * FROM meta_ads_brands WHERE aktif=TRUE');
      for (const b of brands.rows) {
        try {
          await syncMetaInsights(b.id, b.ad_account_id, tgl);
          console.log(`[Meta Ads Cron] OK: ${b.nama}`);
        } catch (e) {
          console.error(`[Meta Ads Cron] FAIL ${b.nama}: ${e.message}`);
        }
      }
    } catch (e) { console.error('[Meta Ads Cron] Error:', e.message); }
  });
  console.log('[Meta Ads Cron] Terjadwal: setiap hari 07:00 WIB');
} catch { /* node-cron belum terinstall — skip */ }

module.exports = router;

// Standalone server entry point (dijalankan langsung via PM2)
if (require.main === module) {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use('/api/hub', router);
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Creanimasi Hub running on port ${PORT}`));
}
