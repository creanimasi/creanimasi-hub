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
const rateLimit = require('express-rate-limit');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const hubPool = pool;
const JWT_SECRET = process.env.HUB_JWT_SECRET;
if (!JWT_SECRET) throw new Error('HUB_JWT_SECRET environment variable tidak di-set');

// Handler di file ini banyak yang menelan error (`catch {}`) sehingga 500 di
// produksi tidak meninggalkan jejak. Semua error query dicatat di satu tempat.
{
  const rawQuery = pool.query.bind(pool);
  pool.query = (...args) => {
    const p = rawQuery(...args);
    if (p && typeof p.catch === 'function') {
      p.catch(e => console.error('[DB ERROR]', e.message, '|', String(args[0]?.text || args[0]).replace(/\s+/g, ' ').slice(0, 140)));
    }
    return p;
  };
}

// ── HELPER ────────────────────────────────────────
const query = (text, params) => pool.query(text, params);

// IP klien sebenarnya. Backend ada di belakang Cloudflare → Traefik → nginx dan
// X-Forwarded-For hanya berisi IP proxy, jadi req.ip SAMA untuk semua orang —
// limiter berbasis req.ip berarti satu jatah untuk seluruh tim. Cloudflare selalu
// menimpa CF-Connecting-IP dengan IP klien asli.
function clientIp(req) {
  return req.headers['cf-connecting-ip'] || req.ip;
}

// Percobaan login GAGAL dibatasi dua lapis (yang berhasil tidak dihitung):
// per IP klien, dan per username — supaya brute-force tetap tertahan walau IP dipalsukan.
const loginLimiterIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  keyGenerator: clientIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' },
});
const loginLimiterUser = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => 'u:' + String(req.body?.username || 'anon').toLowerCase().trim().slice(0, 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login untuk akun ini. Coba lagi dalam beberapa menit.' },
});

// Heartbeat & presence berdenyut otomatis (30 dtk sekali per tab) — dipisah dari
// jatah API supaya tidak memakan kuota request yang dipakai user saat bekerja.
const isPresencePath = (req) => req.path === '/auth/heartbeat' || req.path.startsWith('/presence');

// Batasi request umum ke seluruh API (selain login & presence) per klien
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skip: isPresencePath,
  keyGenerator: clientIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
});
const presenceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // normal ≈ 30/15 mnt per tab; ruang untuk beberapa tab + reconnect
  skip: (req) => !isPresencePath(req),
  keyGenerator: clientIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
});

// Role "protected" (Super Admin) — satu-satunya yang boleh mengubah role
// user lain jadi/dari role protected. Menggantikan flag is_superadmin lama;
// req.user.is_protected diisi dari JOIN ke tabel roles saat login/auth/me.
function canManageRoles(user) {
  return user?.is_protected === true;
}

// Status akun & role diambil dari database (bukan dari isi JWT) supaya akun yang
// dinonaktifkan / diturunkan role-nya langsung kehilangan akses, tidak menunggu
// token 7 hari habis. Di-cache 10 detik agar heartbeat tidak membebani database;
// cache dikosongkan setiap ada perubahan user/role (lihat invalidateUserCache).
const userCache = new Map();
const USER_CACHE_MS = 10 * 1000;
function invalidateUserCache() { userCache.clear(); }
async function loadLiveUser(id) {
  const hit = userCache.get(id);
  if (hit && Date.now() - hit.at < USER_CACHE_MS) return hit.data;
  const r = await pool.query(
    `SELECT u.id, u.nama, u.username, u.role, u.aktif, u.role_id, r.key AS role_key, r.is_protected
     FROM hub_users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [id]
  );
  const data = r.rows[0] || null;
  userCache.set(id, { at: Date.now(), data });
  return data;
}

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token tidak ada' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token tidak valid' });
  }
  try {
    const live = await loadLiveUser(payload.id);
    if (!live || !live.aktif) return res.status(401).json({ error: 'Akun tidak aktif atau tidak ditemukan' });
    req.user = {
      ...payload,
      nama: live.nama, username: live.username, role: live.role,
      role_id: live.role_id, role_key: live.role_key, is_protected: !!live.is_protected,
    };
    next();
  } catch (e) {
    console.error('authMiddleware:', e.message);
    res.status(500).json({ error: 'Gagal memeriksa sesi' });
  }
}

// Middleware generik: cek req.user.role_id boleh akses page_key tertentu
// lewat tabel role_page_access. Query fresh tiap request (bukan dari JWT)
// supaya perubahan matriks akses langsung berlaku tanpa perlu re-login.
// Halaman is_baseline (Dashboard, Profil, dst) selalu lolos untuk semua role.
function requirePageAccess(pageKey) {
  return async (req, res, next) => {
    try {
      const h = await hubPool.query('SELECT is_baseline FROM halaman WHERE page_key=$1', [pageKey]);
      if (h.rows[0]?.is_baseline) return next();
      const r = await hubPool.query(
        'SELECT can_access FROM role_page_access WHERE role_id=$1 AND page_key=$2',
        [req.user.role_id, pageKey]
      );
      if (!r.rows[0]?.can_access) return res.status(403).json({ error: 'Anda tidak memiliki akses ke halaman ini' });
      next();
    } catch (e) {
      console.error('requirePageAccess error:', e.message);
      res.status(500).json({ error: 'Gagal memeriksa hak akses' });
    }
  };
}

// Varian khusus /laporan-admin: hari ini bisa diakses admin ATAU siapa pun
// yang divisi tim-nya "Admin" (lihat AdminOrMarketRoute di frontend) — bukan
// murni berbasis role, jadi butuh fallback pengecekan divisi.
function requirePageAccessOrAdminDivisi(pageKey) {
  return async (req, res, next) => {
    try {
      const r = await hubPool.query(
        'SELECT can_access FROM role_page_access WHERE role_id=$1 AND page_key=$2',
        [req.user.role_id, pageKey]
      );
      if (r.rows[0]?.can_access) return next();
      const d = await hubPool.query(
        `SELECT 1 FROM tim t JOIN hub_users u ON u.tim_id = t.id OR (u.tim_id IS NULL AND u.nama = t.nama)
         WHERE u.id = $1 AND t.divisi = 'Admin'`,
        [req.user.id]
      );
      if (d.rows.length) return next();
      return res.status(403).json({ error: 'Anda tidak memiliki akses ke halaman ini' });
    } catch (e) {
      console.error('requirePageAccessOrAdminDivisi error:', e.message);
      res.status(500).json({ error: 'Gagal memeriksa hak akses' });
    }
  };
}

// Cegah kondisi zero-active-super_admin: dipanggil sebelum commit di endpoint
// yang bisa menghapus/nonaktifkan/menurunkan role seseorang.
async function wouldRemoveLastProtectedRole(client, excludeUserId) {
  const r = await client.query(
    `SELECT COUNT(*) FROM hub_users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.aktif = TRUE AND r.is_protected = TRUE AND u.id != $1`,
    [excludeUserId]
  );
  return parseInt(r.rows[0].count, 10) === 0;
}

// Daftar page_key yang boleh diakses sebuah role: baseline + yang di-set TRUE
// di role_page_access. Dipakai saat login/auth/me supaya frontend bisa
// filter nav & routing tanpa nebak-nebak.
async function getPageAccessList(roleId) {
  if (!roleId) return [];
  const r = await hubPool.query(
    `SELECT page_key FROM halaman WHERE is_baseline = TRUE
     UNION
     SELECT page_key FROM role_page_access WHERE role_id = $1 AND can_access = TRUE`,
    [roleId]
  );
  return r.rows.map(x => x.page_key);
}

// Akun Super Admin (role protected) hanya boleh disentuh Super Admin lain —
// edit data, reset password, nonaktifkan. Tanpa ini, siapa pun yang diberi akses
// Master Data bisa reset password Super Admin lalu login sebagai dia.
async function targetIsProtected(db, timId) {
  const r = await db.query(
    `SELECT r.is_protected FROM hub_users u JOIN roles r ON r.id = u.role_id
     WHERE u.tim_id = $1 OR (u.tim_id IS NULL AND u.nama = (SELECT nama FROM tim WHERE id = $1))
     LIMIT 1`, [timId]
  );
  return r.rows[0]?.is_protected === true;
}
const FORBID_PROTECTED = { error: 'Hanya Super Admin yang bisa mengubah akun Super Admin' };

// Turunkan kolom legacy hub_users.role ('admin'|'member') dari role_id baru,
// supaya kode lama yang belum sempat dimigrasi (kalau ada) tetap dapat nilai
// yang masuk akal. super_admin -> 'admin', role lain -> 'member'.
async function legacyRoleFromRoleId(client, roleId) {
  const r = await client.query('SELECT is_protected FROM roles WHERE id=$1', [roleId]);
  return r.rows[0]?.is_protected ? 'admin' : 'member';
}

// ── AUTH ──────────────────────────────────────────

// POST /api/hub/auth/login
router.post('/auth/login', loginLimiterIp, loginLimiterUser, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  try {
    const result = await query(
      `SELECT u.*, r.key AS role_key, r.nama AS role_nama, r.is_protected
       FROM hub_users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE LOWER(u.username) = LOWER($1) AND u.aktif = TRUE`, [String(username).trim()]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Username atau password salah' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Username atau password salah' });

    const pageAccess = await getPageAccessList(user.role_id);
    const payload = {
      id: user.id, nama: user.nama, username: user.username,
      role: user.role, is_superadmin: !!user.is_superadmin,
      role_id: user.role_id, role_key: user.role_key, is_protected: !!user.is_protected,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true, token,
      user: { ...payload, tema: user.tema || 'dark', page_access: pageAccess },
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal login' });
  }
});

// Rate limit untuk semua route lain (di luar /auth/login yang sudah punya limiter sendiri)
router.use(apiLimiter);
router.use(presenceLimiter);

// ── GLOBAL AUTH GUARD ─────────────────────────────
// Semua route wajib login KECUALI /auth/login dan /presence (SSE pakai tiket sekali-pakai via query param)
router.use((req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/presence') return next();
  return authMiddleware(req, res, next);
});

// GET /api/hub/auth/me
router.get('/auth/me', async (req, res) => {
  try {
    const r = await hubPool.query('SELECT tema FROM hub_users WHERE id=$1', [req.user.id]);
    const tema = r.rows[0]?.tema || 'dark';
    const pageAccess = await getPageAccessList(req.user.role_id);
    res.json({ success: true, user: { ...req.user, tema, page_access: pageAccess } });
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

// GET /api/hub/jurnal — semua jurnal (untuk dashboard) atau riwayat milik sendiri
router.get('/jurnal', authMiddleware, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    // Member hanya boleh lihat jurnal miliknya sendiri, apapun query ?nama= yang dikirim
    const nama = isAdmin ? req.query.nama : req.user.nama;
    const { limit = 50 } = req.query;
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

// GET /api/hub/jurnal/stats — statistik untuk dashboard (admin only)
router.get('/jurnal/stats', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
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

// Mapping nama divisi di tabel `tim` → key TABLE_MAP profiling (harus sinkron dengan src/data/constants.js)
const DIVISI_TO_PROFILING_KEY = {
  'Admin': 'admin', 'PM': 'pm', 'Illustrator': 'illustrator',
  'Rigger': 'rigger', '3D Modeler': '3d',
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

  const isAdmin = req.user.role === 'admin';
  // Nama selalu dari JWT — member tidak bisa mengisi/menimpa profiling atas nama orang lain.
  // Admin boleh override via req.body.nama (mis. input data untuk anggota yang belum sempat isi sendiri).
  req.body.nama = (isAdmin && req.body.nama) ? req.body.nama : req.user.nama;

  try {
    if (!isAdmin) {
      // Member hanya boleh mengisi profiling untuk divisinya sendiri
      const timR = await query(`SELECT divisi FROM tim WHERE nama = $1 LIMIT 1`, [req.user.nama]);
      const divisiAsli = timR.rows[0]?.divisi;
      if (DIVISI_TO_PROFILING_KEY[divisiAsli] !== divisiKey) {
        return res.status(403).json({ error: 'Tidak bisa mengisi profiling divisi lain' });
      }
    }

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

// GET /api/hub/profiling/all — semua profiling untuk dashboard (admin only)
router.get('/profiling/all', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  try {
    const result = await query(`SELECT * FROM v_profiling_all ORDER BY divisi, nama`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data profiling' });
  }
});

// GET /api/hub/profiling/:divisi — profiling per divisi (admin only)
router.get('/profiling/:divisi', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
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
router.post('/reward', authMiddleware, requirePageAccess('reward'), async (req, res) => {
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

// GET /api/hub/reward — semua reward (admin only)
router.get('/reward', authMiddleware, requirePageAccess('reward'), async (req, res) => {
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
router.patch('/reward/:id/status', authMiddleware, requirePageAccess('reward'), async (req, res) => {
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

    // Pengaju hanya boleh membuat draft/diajukan; disetujui/ditolak/selesai hanya lewat PATCH admin.
    const status = req.body.status === 'diajukan' ? 'diajukan' : 'draft';

    const result = await query(
      `INSERT INTO skb (tipe, nama, divisi, level, judul, deskripsi,
         latar_belakang, tujuan, output, timeline, kebutuhan,
         risiko, ukuran_sukses, komitmen, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [tipe, nama, divisi, level, judul, deskripsi,
       latar_belakang, tujuan, output, timeline, kebutuhan,
       risiko, ukuran_sukses, komitmen, status]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan SKB' });
  }
});

// GET /api/hub/skb — semua SKB (admin) atau milik sendiri (member)
router.get('/skb', authMiddleware, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const q = isAdmin
      ? `SELECT * FROM skb ORDER BY created_at DESC`
      : `SELECT * FROM skb WHERE nama = $1 ORDER BY created_at DESC`;
    const params = isAdmin ? [] : [req.user.nama];
    const result = await query(q, params);
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

// ── MASTER DATA: ROLE & HAK AKSES HALAMAN ────────────────────────────────────
// Startup migration — idempotent. Menggantikan sistem role biner admin/member
// dengan tabel role generik + registry halaman + matriks akses per role.
// Lihat database/migration_role_access.sql untuk dokumentasi skema ini.
(async () => {
  try {
    await hubPool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        key VARCHAR(30) NOT NULL UNIQUE,
        nama VARCHAR(50) NOT NULL,
        is_protected BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await hubPool.query(`
      CREATE TABLE IF NOT EXISTS halaman (
        id SERIAL PRIMARY KEY,
        page_key VARCHAR(50) NOT NULL UNIQUE,
        nama VARCHAR(100) NOT NULL,
        route_path VARCHAR(100) NOT NULL,
        is_baseline BOOLEAN NOT NULL DEFAULT FALSE,
        urutan INTEGER DEFAULT 0
      )
    `);
    await hubPool.query(`
      CREATE TABLE IF NOT EXISTS role_page_access (
        id SERIAL PRIMARY KEY,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        page_key VARCHAR(50) NOT NULL REFERENCES halaman(page_key) ON DELETE CASCADE,
        can_access BOOLEAN NOT NULL DEFAULT FALSE,
        UNIQUE(role_id, page_key)
      )
    `);
    await hubPool.query('ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)');
    await hubPool.query('ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS email VARCHAR(120)');
    await hubPool.query('ALTER TABLE tim ADD COLUMN IF NOT EXISTS tanggal_lahir DATE');

    // Seed 6 role — key & nama sesuai PRD bagian 4
    const ROLES = [
      ['super_admin',  'Super Admin',  true],
      ['founder',      'Founder',      false],
      ['mentor',       'Mentor',       false],
      ['admin_market', 'Admin Market', false],
      ['pm',           'PM',           false],
      ['anggota',      'Anggota',      false],
    ];
    for (const [key, nama, isProtected] of ROLES) {
      await hubPool.query(
        'INSERT INTO roles (key, nama, is_protected) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING',
        [key, nama, isProtected]
      );
    }

    // Seed registry halaman — 13 baseline (semua role otomatis akses) +
    // 20 halaman admin-tier (diatur lewat role_page_access) sesuai audit
    // routing di src/App.jsx.
    const BASELINE = [
      ['dashboard', 'Dashboard', '/'],
      ['modul', 'Modul Belajar', '/modul'],
      ['jurnal-isi', 'Isi Jurnal', '/jurnal/isi'],
      ['jurnal-riwayat', 'Riwayat Jurnal', '/jurnal/riwayat'],
      ['profil', 'Profil Saya', '/profil'],
      ['profiling', 'Form Profiling', '/profiling'],
      ['sop', 'SOP Brief', '/sop'],
      ['skb', 'Ajukan SKB', '/skb'],
      ['performa', 'Grafik Performa', '/performa'],
    ];
    const ADMIN_TIER = [
      ['tim', 'Direktori Tim', '/tim'],
      ['master-data', 'Master Data', '/master-data'],
      ['jurnal-admin', 'Jurnal (Admin)', '/jurnal'],
      ['kader', 'Kader Potensial', '/kader'],
      ['reward', 'Reward & KPI', '/reward'],
      ['sesi-1on1', 'Sesi 1-on-1', '/1on1'],
      ['workshop', 'Workshop', '/workshop'],
      ['absensi', 'Absensi', '/absensi'],
      ['friday-win', 'Friday Win', '/friday-win'],
      ['aktivitas-tim', 'Aktivitas Tim', '/aktivitas'],
      ['laporan-mentor', 'Lap. Mingguan Mentor', '/laporan-mentor'],
      ['laporan-admin', 'Laporan Mingguan Admin', '/laporan-admin'],
      ['laporan-harian', 'Laporan Harian', '/laporan-harian'],
      ['laporan-bulanan', 'Laporan Bulanan', '/laporan-bulanan'],
      ['ads-performance', 'Ads Performance', '/ads-performance'],
      ['laporan-profit', 'Laporan Profit', '/laporan-profit'],
      ['ai-assistant', 'AI Assistant', '/ai-assistant'],
      ['kalender', 'Kalender', '/kalender'],
      ['rpg-analytics', 'RPG Analytics', '/rpg/analytics'],
      ['rpg-pantau', 'Pantau Anggota', '/rpg/anggota'],
      ['rpg-admin', 'Kelola RPG', '/rpg/kelola'],
      ['tim-kelola-legacy', 'Kelola Tim (legacy)', '/tim/kelola'],
    ];
    for (let i = 0; i < BASELINE.length; i++) {
      const [key, nama, path] = BASELINE[i];
      await hubPool.query(
        'INSERT INTO halaman (page_key, nama, route_path, is_baseline, urutan) VALUES ($1,$2,$3,TRUE,$4) ON CONFLICT (page_key) DO NOTHING',
        [key, nama, path, i]
      );
    }
    for (let i = 0; i < ADMIN_TIER.length; i++) {
      const [key, nama, path] = ADMIN_TIER[i];
      await hubPool.query(
        'INSERT INTO halaman (page_key, nama, route_path, is_baseline, urutan) VALUES ($1,$2,$3,FALSE,$4) ON CONFLICT (page_key) DO NOTHING',
        [key, nama, path, 100 + i]
      );
    }

    // Halaman Guild untuk anggota dulu baseline (semua yang login). Sekarang diatur per role lewat
    // matriks Hak Akses/Role. Urutan langkah menjaga tidak ada jeda tanpa akses: (1) beri SEMUA role
    // akses, (2) baru ubah flag baseline — satu transaksi. ON CONFLICT DO NOTHING → pencabutan yang
    // dilakukan admin sesudahnya TIDAK ditimpa lagi saat server restart. Dibungkus try/catch sendiri:
    // kalau gagal, transaksi di-rollback, flag tetap baseline (semua orang tetap punya akses) dan
    // migrasi lain di bawah tetap jalan.
    const GUILD_MEMBER = [
      ['rpg-character', 'Character Sheet', '/rpg/character'],
      ['rpg-quests', 'Papan Quest', '/rpg/quests'],
      ['rpg-guild', 'Guild Hall', '/rpg/guild'],
      ['rpg-achievements', 'Pencapaian', '/rpg/achievements'],
    ];
    const gc = await hubPool.connect();
    try {
      await gc.query('BEGIN');
      for (let i = 0; i < GUILD_MEMBER.length; i++) {
        const [key, nama, path] = GUILD_MEMBER[i];
        // ada dulu (instalasi baru); baris lama (masih baseline) dibiarkan sampai langkah (2)
        await gc.query(
          'INSERT INTO halaman (page_key, nama, route_path, is_baseline, urutan) VALUES ($1,$2,$3,TRUE,$4) ON CONFLICT (page_key) DO NOTHING',
          [key, nama, path, 90 + i]
        );
      }
      await gc.query(
        `INSERT INTO role_page_access (role_id, page_key, can_access)
         SELECT r.id, k, TRUE FROM roles r CROSS JOIN unnest($1::text[]) AS k
         ON CONFLICT (role_id, page_key) DO NOTHING`,
        [GUILD_MEMBER.map(g => g[0])]
      );
      for (let i = 0; i < GUILD_MEMBER.length; i++) {
        const [key, nama, path] = GUILD_MEMBER[i];
        await gc.query(
          'UPDATE halaman SET is_baseline = FALSE, nama = $2, route_path = $3, urutan = $4 WHERE page_key = $1',
          [key, nama, path, 90 + i]
        );
      }
      // dua halaman admin Guild: samakan nama dengan label sidebar (baris lama di production bernama "RPG Kelola")
      await gc.query("UPDATE halaman SET nama = 'Kelola RPG' WHERE page_key = 'rpg-admin'");
      await gc.query('COMMIT');
    } catch (e) {
      await gc.query('ROLLBACK').catch(() => {});
      console.error('Migration halaman Guild gagal (dibiarkan baseline):', e.message);
    } finally { gc.release(); }

    // Seed matriks role_page_access — nilai awal, semua BISA diedit lewat
    // Tab "Hak Akses/Role" setelah fitur ini live. super_admin selalu penuh,
    // anggota selalu kosong (persis perilaku admin/member lama). Founder/
    // Mentor/Admin Market/PM pakai starting-point wajar per nama role-nya —
    // ilustrasi PRD bag. 6.2 dijadikan acuan, disesuaikan supaya tidak ada
    // role yang kosong total (khususnya Admin Market, contoh di PRD kosong
    // semua — diganti akses ke cluster marketing/ads sesuai nama rolenya).
    const ALL_ADMIN_KEYS = ADMIN_TIER.map(x => x[0]);
    const MATRIX = {
      super_admin: ALL_ADMIN_KEYS,
      anggota: [],
      founder: ['reward', 'laporan-mentor', 'laporan-admin', 'laporan-harian', 'laporan-bulanan', 'ads-performance', 'laporan-profit', 'ai-assistant'],
      mentor: ['tim', 'kader', 'reward', 'jurnal-admin', 'sesi-1on1', 'workshop'],
      admin_market: ['ads-performance', 'laporan-profit', 'ai-assistant'],
      pm: ['tim', 'kader', 'reward', 'jurnal-admin', 'workshop', 'absensi', 'friday-win', 'sesi-1on1', 'aktivitas-tim', 'kalender'],
    };
    const roleIdRes = await hubPool.query('SELECT id, key FROM roles');
    const roleIdByKey = Object.fromEntries(roleIdRes.rows.map(r => [r.key, r.id]));
    for (const [roleKey, allowedKeys] of Object.entries(MATRIX)) {
      const roleId = roleIdByKey[roleKey];
      if (!roleId) continue;
      for (const pageKey of ALL_ADMIN_KEYS) {
        const canAccess = allowedKeys.includes(pageKey);
        await hubPool.query(
          `INSERT INTO role_page_access (role_id, page_key, can_access) VALUES ($1,$2,$3)
           ON CONFLICT (role_id, page_key) DO NOTHING`,
          [roleId, pageKey, canAccess]
        );
      }
    }

    // Tabel yang dulu dibuat manual langsung di production dan tidak tercatat di
    // migrasi manapun (lingkungan baru/dev jadi rusak tanpa ini). Definisi disalin
    // dari skema production apa adanya; IF NOT EXISTS → tidak menyentuh data existing.
    await hubPool.query(`CREATE TABLE IF NOT EXISTS friday_win (
      id SERIAL PRIMARY KEY, tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
      posted_by VARCHAR(100) NOT NULL, headline TEXT NOT NULL,
      penerima VARCHAR(100), pesan TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
    await hubPool.query(`CREATE TABLE IF NOT EXISTS sesi_1on1 (
      id SERIAL PRIMARY KEY, tanggal DATE NOT NULL, anggota VARCHAR(100) NOT NULL,
      tipe VARCHAR(50) NOT NULL, durasi_menit INTEGER DEFAULT 30, ringkasan TEXT,
      tindak_lanjut TEXT, mood_sebelum INTEGER, mood_sesudah INTEGER,
      host VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`);
    await hubPool.query(`CREATE TABLE IF NOT EXISTS workshop_kehadiran (
      id SERIAL PRIMARY KEY, nama VARCHAR(100) NOT NULL, layer_id VARCHAR(20) NOT NULL,
      sesi_idx INTEGER NOT NULL, hadir BOOLEAN DEFAULT FALSE, updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (nama, layer_id, sesi_idx))`);
    await hubPool.query(`CREATE TABLE IF NOT EXISTS revenue_bulanan (
      id SERIAL PRIMARY KEY, bulan INTEGER NOT NULL CHECK (bulan >= 1 AND bulan <= 12),
      tahun INTEGER NOT NULL, nama VARCHAR(100) NOT NULL, jumlah NUMERIC(12,2) DEFAULT 0,
      target NUMERIC(12,2) DEFAULT 0, catatan TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (nama, bulan, tahun))`);
    await hubPool.query(`CREATE TABLE IF NOT EXISTS modul_topik (
      id SERIAL PRIMARY KEY, nama VARCHAR(100) NOT NULL, modul_id VARCHAR(20) NOT NULL,
      topik_idx INTEGER NOT NULL, selesai BOOLEAN DEFAULT FALSE, updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (nama, modul_id, topik_idx))`);
    await hubPool.query(`CREATE TABLE IF NOT EXISTS modul_topik_nama (
      id SERIAL PRIMARY KEY, modul_id VARCHAR(20) NOT NULL, topik_idx INTEGER NOT NULL,
      nama TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW(), updated_by VARCHAR(100),
      UNIQUE (modul_id, topik_idx))`);

    // Backfill hub_users.role_id dari role lama, zero-regression:
    // 'admin' (superadmin ataupun bukan) -> super_admin, 'member' -> anggota.
    // Alasan lengkap ada di database/migration_role_access.sql.
    await hubPool.query(`
      UPDATE hub_users SET role_id = (SELECT id FROM roles WHERE key='super_admin')
      WHERE role_id IS NULL AND role = 'admin'
    `);
    await hubPool.query(`
      UPDATE hub_users SET role_id = (SELECT id FROM roles WHERE key='anggota')
      WHERE role_id IS NULL AND role = 'member'
    `);
  } catch (e) { console.error('Migration role/access startup:', e.message); }
})();

// ── ROLE & HAK AKSES HALAMAN ─────────────────────────────────────────────────

// GET /api/hub/roles — daftar role + jumlah halaman yang bisa diakses
router.get('/roles', authMiddleware, requirePageAccess('master-data'), async (req, res) => {
  try {
    const r = await hubPool.query(`
      SELECT r.id, r.key, r.nama, r.is_protected,
             COUNT(DISTINCT rpa.page_key) FILTER (WHERE rpa.can_access) AS jumlah_halaman,
             COUNT(DISTINCT hu.id) FILTER (WHERE hu.aktif) AS jumlah_pengguna
      FROM roles r
      LEFT JOIN role_page_access rpa ON rpa.role_id = r.id
      LEFT JOIN hub_users hu ON hu.role_id = r.id
      GROUP BY r.id ORDER BY r.id
    `);
    res.json({ success: true, data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal mengambil data role' }); }
});

// GET /api/hub/pages — registry halaman (baseline + admin-tier)
router.get('/pages', authMiddleware, requirePageAccess('master-data'), async (req, res) => {
  try {
    const r = await hubPool.query('SELECT page_key, nama, route_path, is_baseline FROM halaman ORDER BY urutan');
    res.json({ success: true, data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal mengambil data halaman' }); }
});

// GET /api/hub/roles/:id/page-access — matriks akses 1 role (halaman non-baseline saja)
router.get('/roles/:id/page-access', authMiddleware, requirePageAccess('master-data'), async (req, res) => {
  try {
    const r = await hubPool.query(`
      SELECT h.page_key, h.nama, COALESCE(rpa.can_access, FALSE) AS can_access
      FROM halaman h
      LEFT JOIN role_page_access rpa ON rpa.page_key = h.page_key AND rpa.role_id = $1
      WHERE h.is_baseline = FALSE
      ORDER BY h.urutan
    `, [req.params.id]);
    res.json({ success: true, data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal mengambil matriks akses' }); }
});

// PUT /api/hub/roles/:id/page-access — simpan matriks akses 1 role (bulk upsert)
router.put('/roles/:id/page-access', authMiddleware, requirePageAccess('master-data'), async (req, res) => {
  const { access } = req.body; // [{ page_key, can_access }]
  if (!Array.isArray(access)) return res.status(400).json({ error: 'Format data tidak valid' });
  try {
    const roleR = await hubPool.query('SELECT is_protected FROM roles WHERE id=$1', [req.params.id]);
    if (!roleR.rows.length) return res.status(404).json({ error: 'Role tidak ditemukan' });
    // Matriks role Super Admin, dan pemberian akses Master Data ke role lain, hanya
    // boleh diubah Super Admin — akses Master Data setara dengan kontrol atas akun.
    if (!canManageRoles(req.user)) {
      if (roleR.rows[0].is_protected)
        return res.status(403).json({ error: 'Hanya Super Admin yang bisa mengubah akses role Super Admin' });
      if (access.some(a => a.page_key === 'master-data' && a.can_access === true))
        return res.status(403).json({ error: 'Hanya Super Admin yang bisa memberi akses Master Data' });
    }
    // Master Data untuk role protected (Super Admin) tidak boleh dilepas — proteksi
    // ini ditegakkan di server, bukan cuma disembunyikan di UI.
    if (roleR.rows[0].is_protected) {
      const md = access.find(a => a.page_key === 'master-data');
      if (md && md.can_access === false) {
        return res.status(400).json({ error: 'Akses Master Data untuk Super Admin tidak boleh dicabut' });
      }
    }
    for (const { page_key, can_access } of access) {
      await hubPool.query(
        `INSERT INTO role_page_access (role_id, page_key, can_access) VALUES ($1,$2,$3)
         ON CONFLICT (role_id, page_key) DO UPDATE SET can_access = $3`,
        [req.params.id, page_key, !!can_access]
      );
    }
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Gagal menyimpan matriks akses' }); }
});

// GET /api/hub/tim
router.get('/tim', authMiddleware, async (req, res) => {
  try {
    const { semua, entitas } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (!semua) { where += ' AND t.aktif = TRUE'; }
    if (entitas) { params.push(entitas); where += ` AND t.entitas = $${params.length}`; }
    const q = `
      SELECT t.*, u.id as user_id, u.username, u.email, u.role, u.role_id, r.key as role_key, r.nama as role_nama
      FROM tim t
      LEFT JOIN hub_users u ON u.tim_id = t.id OR (u.tim_id IS NULL AND u.nama = t.nama)
      LEFT JOIN roles r ON r.id = u.role_id
      ${where}
      ORDER BY t.entitas, t.divisi, t.nama
    `;
    const result = await hubPool.query(q, params);
    // Endpoint ini dipakai semua user (direktori tim, sidebar). Email & tanggal lahir
    // hanya boleh dilihat pemegang akses Master Data dan pemilik datanya sendiri.
    const canSeePII = (await getPageAccessList(req.user.role_id)).includes('master-data');
    const rows = canSeePII ? result.rows : result.rows.map(r => (
      r.user_id === req.user.id ? r : { ...r, email: null, tanggal_lahir: null }
    ));
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data tim' });
  }
});

// GET /api/hub/akun-tanpa-tim — akun login yang TIDAK tertaut ke baris anggota tim (mis. Super Admin
// pemilik: tim_id NULL dan namanya tidak ada di tabel tim). GET /tim dibangun dari tabel tim sehingga
// akun seperti ini tidak pernah muncul di daftar Manajemen User. Kriteria "tertaut" identik dengan
// join di GET /tim (tim_id, atau nama sama bila tim_id NULL). Hanya pemegang akses Master Data.
router.get('/akun-tanpa-tim', authMiddleware, requirePageAccess('master-data'), async (req, res) => {
  try {
    const r = await hubPool.query(`
      SELECT u.id, u.nama, u.username, u.email, u.aktif, u.role_id, r.key AS role_key, r.nama AS role_nama, u.last_seen
      FROM hub_users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE NOT EXISTS (
        SELECT 1 FROM tim t WHERE t.id = u.tim_id OR (u.tim_id IS NULL AND t.nama = u.nama)
      )
      ORDER BY (r.is_protected IS TRUE) DESC, u.nama`);
    res.json({ success: true, data: r.rows });
  } catch (e) {
    console.error('GET /akun-tanpa-tim:', e.message);
    res.status(500).json({ error: 'Gagal mengambil akun sistem' });
  }
});

// POST /api/hub/tim — tambah anggota + buat akun sekaligus
router.post('/tim', authMiddleware, requirePageAccess('master-data'), async (req, res) => {
  const { nama, divisi, level, tipe, entitas, username, password, role_id, email, tanggal_lahir } = req.body;
  if (!nama || !divisi || !entitas || !username || !password)
    return res.status(400).json({ error: 'Nama, divisi, entitas, username, dan password wajib diisi' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  const client = await hubPool.connect();
  try {
    await client.query('BEGIN');
    if (role_id) {
      const roleR = await client.query('SELECT is_protected FROM roles WHERE id=$1', [role_id]);
      if (roleR.rows[0]?.is_protected && !canManageRoles(req.user)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Hanya Super Admin yang bisa membuat akun Super Admin' });
      }
    }
    const timR = await client.query(
      'INSERT INTO tim (nama, divisi, level, tipe, entitas, tanggal_lahir) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [nama, divisi, level || '', tipe || '', entitas, tanggal_lahir || null]
    );
    const timId = timR.rows[0].id;
    const hashed = await bcrypt.hash(password, 10);
    const defaultRoleId = role_id || (await client.query("SELECT id FROM roles WHERE key='anggota'")).rows[0].id;
    const legacyRole = await legacyRoleFromRoleId(client, defaultRoleId);
    const userR = await client.query(
      'INSERT INTO hub_users (nama, username, password, role, role_id, email, aktif, tim_id) VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7) RETURNING id, username, role, role_id',
      [nama, username.toLowerCase().trim(), hashed, legacyRole, defaultRoleId, email || null, timId]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { ...timR.rows[0], username: userR.rows[0].username, role: userR.rows[0].role, role_id: userR.rows[0].role_id } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Username sudah digunakan' });
    res.status(500).json({ error: 'Gagal menambah anggota' });
  } finally {
    client.release();
  }
});

// PATCH /api/hub/tim/:id — edit data anggota + akun
router.patch('/tim/:id', authMiddleware, requirePageAccess('master-data'), async (req, res) => {
  const { nama, divisi, level, tipe, aktif, entitas, username, role_id, email, tanggal_lahir } = req.body;
  if (!nama || !divisi || !entitas)
    return res.status(400).json({ error: 'Nama, divisi, dan entitas wajib diisi' });
  const client = await hubPool.connect();
  try {
    await client.query('BEGIN');
    if (!canManageRoles(req.user) && await targetIsProtected(client, req.params.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json(FORBID_PROTECTED);
    }
    // aktif & tanggal_lahir yang tidak dikirim (mis. dari "Ubah Role") dibiarkan apa adanya;
    // tanggal_lahir '' / null yang dikirim sengaja = kosongkan.
    const timR = await client.query(
      `UPDATE tim SET nama=$1, divisi=$2, level=$3, tipe=$4, aktif=COALESCE($5::boolean, aktif), entitas=$6,
              tanggal_lahir=CASE WHEN $9::boolean THEN $7::date ELSE tanggal_lahir END, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [nama, divisi, level || '', tipe || '', aktif !== undefined ? aktif : null, entitas, tanggal_lahir || null, req.params.id, tanggal_lahir !== undefined]
    );
    if (!timR.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Anggota tidak ditemukan' }); }

    const curUserR = await client.query(
      'SELECT id, role_id FROM hub_users WHERE tim_id=$1 OR (tim_id IS NULL AND nama=$2) LIMIT 1',
      [req.params.id, nama]
    );
    const currentUser = curUserR.rows[0];

    if (role_id && currentUser) {
      const [targetRoleR, currentRoleR] = await Promise.all([
        client.query('SELECT is_protected FROM roles WHERE id=$1', [role_id]),
        client.query('SELECT is_protected FROM roles WHERE id=$1', [currentUser.role_id]),
      ]);
      const touchesProtected = targetRoleR.rows[0]?.is_protected || currentRoleR.rows[0]?.is_protected;
      if (touchesProtected && !canManageRoles(req.user)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Hanya Super Admin yang bisa mengubah role Super Admin' });
      }
      // Turun dari role protected -> pastikan tidak menyisakan zero Super Admin aktif
      if (currentRoleR.rows[0]?.is_protected && !targetRoleR.rows[0]?.is_protected) {
        if (await wouldRemoveLastProtectedRole(client, currentUser.id)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Tidak bisa mengubah role — minimal harus ada 1 Super Admin aktif' });
        }
      }
    }

    let userInfo = {};
    if (username || role_id || email !== undefined) {
      let legacyRole;
      if (role_id) legacyRole = await legacyRoleFromRoleId(client, role_id);
      const userR = await client.query(
        `UPDATE hub_users SET nama=$1, username=COALESCE($2, username), role=COALESCE($3, role),
                role_id=COALESCE($4, role_id), email=COALESCE($5, email)
         WHERE tim_id=$6 OR (tim_id IS NULL AND nama=$1) RETURNING username, role, role_id, email`,
        [nama, username ? username.toLowerCase().trim() : null, legacyRole || null, role_id || null, email !== undefined ? email : null, req.params.id]
      );
      if (userR.rows.length) userInfo = userR.rows[0];
    }
    await client.query('COMMIT');
    invalidateUserCache();
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
router.delete('/tim/:id', authMiddleware, requirePageAccess('master-data'), async (req, res) => {
  const client = await hubPool.connect();
  try {
    await client.query('BEGIN');
    const userR = await client.query(
      'SELECT id, role_id FROM hub_users WHERE tim_id=$1 LIMIT 1', [req.params.id]
    );
    const targetUser = userR.rows[0];
    if (!canManageRoles(req.user) && await targetIsProtected(client, req.params.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json(FORBID_PROTECTED);
    }
    if (targetUser?.id === req.user.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Tidak bisa menonaktifkan akun sendiri' });
    }
    if (targetUser && await wouldRemoveLastProtectedRole(client, targetUser.id)) {
      const roleR = await client.query('SELECT is_protected FROM roles WHERE id=$1', [targetUser.role_id]);
      if (roleR.rows[0]?.is_protected) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Tidak bisa menonaktifkan — minimal harus ada 1 Super Admin aktif' });
      }
    }
    const timR = await client.query('UPDATE tim SET aktif=FALSE, updated_at=NOW() WHERE id=$1 RETURNING *', [req.params.id]);
    if (!timR.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Anggota tidak ditemukan' }); }
    await client.query('UPDATE hub_users SET aktif=FALSE WHERE tim_id=$1 OR (tim_id IS NULL AND nama=$2)', [req.params.id, timR.rows[0].nama]);
    await client.query('COMMIT');
    invalidateUserCache();
    res.json({ success: true });
  } catch { await client.query('ROLLBACK'); res.status(500).json({ error: 'Gagal nonaktifkan anggota' }); }
  finally { client.release(); }
});

// PATCH /api/hub/tim/:id/aktifkan — aktifkan kembali
router.patch('/tim/:id/aktifkan', authMiddleware, requirePageAccess('master-data'), async (req, res) => {
  const client = await hubPool.connect();
  try {
    await client.query('BEGIN');
    if (!canManageRoles(req.user) && await targetIsProtected(client, req.params.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json(FORBID_PROTECTED);
    }
    const timR = await client.query('UPDATE tim SET aktif=TRUE, updated_at=NOW() WHERE id=$1 RETURNING *', [req.params.id]);
    if (!timR.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Anggota tidak ditemukan' }); }
    await client.query('UPDATE hub_users SET aktif=TRUE WHERE tim_id=$1 OR (tim_id IS NULL AND nama=$2)', [req.params.id, timR.rows[0].nama]);
    await client.query('COMMIT');
    invalidateUserCache();
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
router.get('/workshop', authMiddleware, requirePageAccess('workshop'), async (req, res) => {
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
router.get('/absensi/sesi', authMiddleware, requirePageAccess('absensi'), async (req, res) => {
  try {
    const r = await hubPool.query(
      'SELECT * FROM absensi_sesi ORDER BY tanggal DESC, id DESC'
    );
    res.json({ success: true, data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal mengambil sesi absensi' }); }
});

// GET /api/hub/absensi/sesi/:id — detail sesi + kehadiran
router.get('/absensi/sesi/:id', authMiddleware, requirePageAccess('absensi'), async (req, res) => {
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
router.post('/absensi/sesi', authMiddleware, requirePageAccess('absensi'), async (req, res) => {
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
router.patch('/absensi/:sesi_id/:nama', authMiddleware, requirePageAccess('absensi'), async (req, res) => {
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
router.put('/absensi/sesi/:id', authMiddleware, requirePageAccess('absensi'), async (req, res) => {
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
router.delete('/absensi/sesi/:id', authMiddleware, requirePageAccess('absensi'), async (req, res) => {
  try {
    const r = await hubPool.query('DELETE FROM absensi_sesi WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal hapus sesi' }); }
});

// ── LAPORAN BULANAN ───────────────────────────────────────────────────────────
// GET /api/hub/laporan-bulanan?bulan=2026-07
// Mengembalikan agregat per anggota untuk bulan tertentu
router.get('/laporan-bulanan', authMiddleware, requirePageAccess('laporan-bulanan'), async (req, res) => {
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
router.get('/friday-win', authMiddleware, requirePageAccess('friday-win'), async (req, res) => {
  try {
    const result = await hubPool.query('SELECT * FROM friday_win ORDER BY tanggal DESC, id DESC LIMIT 20');
    res.json({ data: result.rows });
  } catch { res.status(500).json({ error: 'Gagal mengambil Friday Win' }); }
});

router.post('/friday-win', authMiddleware, requirePageAccess('friday-win'), async (req, res) => {
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

router.delete('/friday-win/:id', authMiddleware, requirePageAccess('friday-win'), async (req, res) => {
  try {
    await hubPool.query('DELETE FROM friday_win WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Gagal hapus' }); }
});

// ── SESI 1-ON-1 (admin/mentor only) ────────────────────────────────────────────
router.get('/sesi-1on1', authMiddleware, requirePageAccess('sesi-1on1'), async (req, res) => {
  try {
    const result = await hubPool.query('SELECT * FROM sesi_1on1 ORDER BY tanggal DESC, id DESC');
    res.json({ data: result.rows });
  } catch { res.status(500).json({ error: 'Gagal mengambil sesi 1-on-1' }); }
});

router.post('/sesi-1on1', authMiddleware, requirePageAccess('sesi-1on1'), async (req, res) => {
  const { tanggal, anggota, tipe, durasi_menit, ringkasan, tindak_lanjut, mood_sebelum, mood_sesudah } = req.body;
  try {
    const r = await hubPool.query(
      `INSERT INTO sesi_1on1 (tanggal, anggota, tipe, durasi_menit, ringkasan, tindak_lanjut, mood_sebelum, mood_sesudah, host)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tanggal, anggota, tipe, durasi_menit||30, ringkasan, tindak_lanjut, mood_sebelum === '' ? null : mood_sebelum, mood_sesudah === '' ? null : mood_sesudah, req.user?.nama||'Admin']
    );
    res.json({ data: r.rows[0] });
  } catch { res.status(500).json({ error: 'Gagal simpan sesi 1-on-1' }); }
});


// POST /api/hub/tim/:id/buat-akun — buat akun login untuk anggota yang belum punya
router.post('/tim/:id/buat-akun', authMiddleware, requirePageAccess('master-data'), async (req, res) => {
  const { username, password, role_id, email } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: 'Username wajib diisi' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter' });
  const client = await hubPool.connect();
  try {
    await client.query('BEGIN');
    if (role_id) {
      const roleR = await client.query('SELECT is_protected FROM roles WHERE id=$1', [role_id]);
      if (roleR.rows[0]?.is_protected && !canManageRoles(req.user)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Hanya Super Admin yang bisa membuat akun Super Admin' });
      }
    }
    const timR = await client.query('SELECT * FROM tim WHERE id=$1', [req.params.id]);
    if (!timR.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Anggota tidak ditemukan' }); }
    const { nama } = timR.rows[0];
    const existing = await client.query('SELECT id FROM hub_users WHERE tim_id=$1 OR nama=$2', [req.params.id, nama]);
    if (existing.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Anggota sudah punya akun login' }); }
    const hashed = await bcrypt.hash(password, 10);
    const finalRoleId = role_id || (await client.query("SELECT id FROM roles WHERE key='anggota'")).rows[0].id;
    const legacyRole = await legacyRoleFromRoleId(client, finalRoleId);
    const r = await client.query(
      'INSERT INTO hub_users (nama, username, password, role, role_id, email, aktif, tim_id) VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7) RETURNING id, username, role, role_id',
      [nama, username.trim().toLowerCase(), hashed, legacyRole, finalRoleId, email || null, req.params.id]
    );
    await client.query('COMMIT');
    res.status(201).json({ ok: true, data: r.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Username sudah digunakan' });
    res.status(500).json({ error: 'Gagal membuat akun' });
  } finally {
    client.release();
  }
});

// PATCH /api/hub/tim/:id/reset-password
router.patch('/tim/:id/reset-password', authMiddleware, requirePageAccess('master-data'), async (req, res) => {
  const { password_baru } = req.body;
  if (!password_baru || !password_baru.trim())
    return res.status(400).json({ error: 'Password baru wajib diisi' });
  if (password_baru.trim().length < 8)
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  try {
    const timR = await hubPool.query('SELECT nama FROM tim WHERE id=$1', [req.params.id]);
    if (!timR.rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
    if (!canManageRoles(req.user) && await targetIsProtected(hubPool, req.params.id)) {
      return res.status(403).json(FORBID_PROTECTED);
    }
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

// ── REVENUE BULANAN (admin only) ───────────────────────────────────────────────
router.get('/revenue', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
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
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
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
router.patch('/jurnal/:id/reply', authMiddleware, requirePageAccess('jurnal-admin'), async (req, res) => {
  const { reply } = req.body;
  if (typeof reply !== 'string') return res.status(400).json({ error: 'Reply wajib diisi' });
  try {
    // Reply disimpan di kolom catatan_mentor (repurpose) dengan format "pesan_member\n[ADMIN_REPLY]\nreply";
    // pesan member (bagian sebelum marker) dipertahankan. Format lama "[ADMIN_REPLY] ..." dianggap tanpa pesan member.
    const r = await hubPool.query(
      `UPDATE jurnal_mingguan SET catatan_mentor = CASE
         WHEN COALESCE(catatan_mentor, '') = '' OR catatan_mentor LIKE '[ADMIN_REPLY]%'
           THEN E'[ADMIN_REPLY]\\n' || $1
         ELSE split_part(catatan_mentor, E'\\n[ADMIN_REPLY]\\n', 1) || E'\\n[ADMIN_REPLY]\\n' || $1
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
// Tiket SSE sekali-pakai berumur pendek: ticketId -> { user, expires }
// EventSource tidak bisa kirim header Authorization, jadi JWT asli tidak pernah ikut masuk ke URL/access log —
// klien minta tiket dulu lewat request ber-header biasa, baru pakai tiket itu di query string SSE.
const presenceTickets = new Map();
const PRESENCE_TICKET_TTL = 30 * 1000;

setInterval(() => {
  const now = Date.now();
  presenceTickets.forEach((v, k) => { if (v.expires < now) presenceTickets.delete(k); });
}, 60 * 1000);

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

// GET /api/hub/presence/ticket — tiket sekali-pakai untuk otentikasi SSE (butuh login header biasa)
router.get('/presence/ticket', (req, res) => {
  const ticket = require('crypto').randomBytes(24).toString('hex');
  presenceTickets.set(ticket, { user: req.user, expires: Date.now() + PRESENCE_TICKET_TTL });
  res.json({ ticket });
});

// GET /api/hub/presence — SSE stream siapa yang online
// Otentikasi via tiket sekali-pakai dari /presence/ticket (bukan JWT langsung di query string)
router.get('/presence', (req, res) => {
  const ticketId = req.query.ticket;
  if (!ticketId) return res.status(401).json({ error: 'Tiket tidak ada' });
  const entry = presenceTickets.get(ticketId);
  presenceTickets.delete(ticketId); // sekali pakai
  if (!entry || entry.expires < Date.now()) {
    return res.status(401).json({ error: 'Tiket tidak valid atau kadaluarsa' });
  }
  req.user = entry.user;
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

router.delete('/laporan-harian/:id', authMiddleware, requirePageAccess('laporan-harian'), async (req, res) => {
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
router.get('/laporan-harian/grafik', authMiddleware, requirePageAccess('laporan-harian'), async (req, res) => {
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
router.get('/laporan-sdm-analisa', authMiddleware, requirePageAccess('laporan-mentor'), async (req, res) => {
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
        // Hanya pesan member (sebelum marker balasan admin)
        const pesanMember = (j.catatan_mentor || '').split('\n[ADMIN_REPLY]')[0].trim();
        if (pesanMember && !pesanMember.startsWith('[ADMIN_REPLY]')) {
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
router.get('/laporan-mingguan', authMiddleware, requirePageAccess('laporan-mentor'), async (req, res) => {
  try {
    const r = await hubPool.query(
      `SELECT id, tanggal, judul, kas, dibuat_oleh, created_at
       FROM laporan_mingguan ORDER BY tanggal DESC`
    );
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil laporan' }); }
});

// GET /api/hub/laporan-mingguan/:id — detail + akun + SDM
router.get('/laporan-mingguan/:id', authMiddleware, requirePageAccess('laporan-mentor'), async (req, res) => {
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
router.post('/laporan-mingguan', authMiddleware, requirePageAccess('laporan-mentor'), async (req, res) => {
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
router.put('/laporan-mingguan/:id', authMiddleware, requirePageAccess('laporan-mentor'), async (req, res) => {
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
router.delete('/laporan-mingguan/:id', authMiddleware, requirePageAccess('laporan-mentor'), async (req, res) => {
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

// GET /api/hub/laporan-admin — semua laporan (list)
router.get('/laporan-admin', authMiddleware, requirePageAccessOrAdminDivisi('laporan-admin'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, tanggal, akun, periode, dibuat_oleh, created_at
       FROM laporan_admin_mingguan ORDER BY tanggal DESC, created_at DESC`
    );
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil laporan' }); }
});

// GET /api/hub/laporan-admin/:id — detail laporan
router.get('/laporan-admin/:id', authMiddleware, requirePageAccessOrAdminDivisi('laporan-admin'), async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM laporan_admin_mingguan WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    res.json({ data: r.rows[0] });
  } catch { res.status(500).json({ error: 'Gagal ambil laporan' }); }
});

// POST /api/hub/laporan-admin — buat laporan baru
router.post('/laporan-admin', authMiddleware, requirePageAccessOrAdminDivisi('laporan-admin'), async (req, res) => {
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
    console.error('POST /laporan-admin:', e.message);
    res.status(500).json({ error: 'Gagal simpan laporan' });
  }
});

// PUT /api/hub/laporan-admin/:id — update laporan
router.put('/laporan-admin/:id', authMiddleware, requirePageAccessOrAdminDivisi('laporan-admin'), async (req, res) => {
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
    console.error('PUT /laporan-admin/:id:', e.message);
    res.status(500).json({ error: 'Gagal update laporan' });
  }
});

// DELETE /api/hub/laporan-admin/:id
router.delete('/laporan-admin/:id', authMiddleware, requirePageAccessOrAdminDivisi('laporan-admin'), async (req, res) => {
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
    // Nama env var token Meta per brand (NULL = pakai META_ACCESS_TOKEN). Isi token-nya tetap di env, bukan di DB.
    await pool.query(`ALTER TABLE meta_ads_brands ADD COLUMN IF NOT EXISTS token_env VARCHAR(60)`);
    // Mata uang ad account (IDR/USD/…), terdeteksi otomatis dari Meta saat sync. NULL = belum terdeteksi (dianggap IDR).
    await pool.query(`ALTER TABLE meta_ads_brands ADD COLUMN IF NOT EXISTS mata_uang VARCHAR(10)`);

    // Laporan Ads Mingguan (PDF slide): profil tampilan per brand, isian manual per brand+bulan, dan gambar.
    // Gambar (data URL) disimpan di tabel sendiri & diunggah satu per satu supaya request tetap kecil.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS laporan_ads_profil (
        brand_id    INTEGER PRIMARY KEY REFERENCES meta_ads_brands(id) ON DELETE CASCADE,
        judul       VARCHAR(100),
        ig_handle   VARCHAR(100),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS laporan_ads_bulan (
        id          SERIAL PRIMARY KEY,
        brand_id    INTEGER NOT NULL REFERENCES meta_ads_brands(id) ON DELETE CASCADE,
        bulan       CHAR(7) NOT NULL,
        kpi         JSONB NOT NULL DEFAULT '{}',
        mingguan    JSONB NOT NULL DEFAULT '[]',
        kreatif     JSONB NOT NULL DEFAULT '[]',
        updated_by  VARCHAR(100),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (brand_id, bulan)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS laporan_ads_gambar (
        id          SERIAL PRIMARY KEY,
        brand_id    INTEGER NOT NULL REFERENCES meta_ads_brands(id) ON DELETE CASCADE,
        bulan       CHAR(7),
        minggu      SMALLINT,
        jenis       VARCHAR(12) NOT NULL,
        data        TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_laporan_ads_gambar_brand ON laporan_ads_gambar (brand_id, bulan)`);
    // Periode 4 minggu yang bisa diatur per bulan: [{dari:'YYYY-MM-DD', sampai:'YYYY-MM-DD'} × 4]. NULL = skema bawaan (1–7, 8–14, 15–21, 22–akhir bulan).
    await pool.query(`ALTER TABLE laporan_ads_bulan ADD COLUMN IF NOT EXISTS rentang JSONB`);

    // Riwayat (arsip) PDF Laporan Ads Mingguan. File dipisah dari metadata supaya query daftar tidak menarik BYTEA.
    // Hapus = soft delete (file dibuang, jejak tetap). Angka beku (ringkasan/snapshot) dihitung server saat PDF diunggah.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS laporan_ads_arsip (
        id                     SERIAL PRIMARY KEY,
        brand_id               INTEGER NOT NULL REFERENCES meta_ads_brands(id) ON DELETE CASCADE,
        bulan                  CHAR(7) NOT NULL,
        minggu                 SMALLINT NOT NULL,
        versi                  INTEGER NOT NULL,
        judul                  VARCHAR(100),
        ukuran                 INTEGER NOT NULL,
        jumlah_slide           SMALLINT,
        dibuat_oleh            VARCHAR(100),
        dibuat_pada            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ringkasan              JSONB NOT NULL DEFAULT '{}',
        snapshot               JSONB NOT NULL DEFAULT '{}',
        jumlah_unduh           INTEGER NOT NULL DEFAULT 0,
        terakhir_diunduh_oleh  VARCHAR(100),
        terakhir_diunduh_pada  TIMESTAMPTZ,
        dihapus_pada           TIMESTAMPTZ,
        dihapus_oleh           VARCHAR(100),
        UNIQUE (brand_id, bulan, minggu, versi)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS laporan_ads_arsip_file (
        arsip_id  INTEGER PRIMARY KEY REFERENCES laporan_ads_arsip(id) ON DELETE CASCADE,
        pdf       BYTEA NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS laporan_ads_arsip_log (
        id        SERIAL PRIMARY KEY,
        arsip_id  INTEGER NOT NULL REFERENCES laporan_ads_arsip(id) ON DELETE CASCADE,
        aksi      VARCHAR(10) NOT NULL,
        oleh      VARCHAR(100),
        waktu     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_laporan_ads_arsip_minggu ON laporan_ads_arsip (brand_id, bulan, minggu)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_laporan_ads_arsip_log ON laporan_ads_arsip_log (arsip_id)`);
    // Unggahan PDF berpotongan (sementara): proxy di depan backend membatasi body request (nginx default 1 MB), jadi klien
    // mengirim PDF per potongan kecil lalu server menyusunnya. Baris terbengkalai (>1 jam) dibersihkan saat unggahan baru dimulai.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS laporan_ads_unggahan (
        id          SERIAL PRIMARY KEY,
        brand_id    INTEGER NOT NULL REFERENCES meta_ads_brands(id) ON DELETE CASCADE,
        bulan       CHAR(7) NOT NULL,
        minggu      SMALLINT NOT NULL,
        slide       SMALLINT,
        ukuran      INTEGER NOT NULL,
        user_id     INTEGER,
        dibuat_oleh VARCHAR(100),
        status      VARCHAR(10) NOT NULL DEFAULT 'baru',
        dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS laporan_ads_unggahan_bagian (
        unggahan_id INTEGER NOT NULL REFERENCES laporan_ads_unggahan(id) ON DELETE CASCADE,
        n           SMALLINT NOT NULL,
        data        BYTEA NOT NULL,
        PRIMARY KEY (unggahan_id, n)
      )
    `);
    // Hapus hpp_persen dari meta_ads_reports (tidak lagi dipakai per-hari)
    // Tidak drop kolom agar data lama aman — cukup abaikan di logic baru
  } catch (e) { console.error('Meta Ads migration:', e.message); }
})();

// ── META ADS HELPER ──────────────────────────────────────────────────────────

// Hanya nama env var berawalan META_ACCESS_TOKEN yang boleh dirujuk brand — cegah baca env lain (DB_PASSWORD, JWT_SECRET, dst.)
const META_TOKEN_ENV_RE = /^META_ACCESS_TOKEN[A-Z0-9_]*$/;
const cleanTokenEnv = (v) => {
  const s = String(v || '').trim();
  return s || null;
};

// Spend/CPM di meta_ads_insights disimpan APA ADANYA dalam mata uang ad account. Semua query yang menampilkan
// atau menghitung dengan angka itu mengalikannya dengan ini (alias tabel brand harus `b`):
// akun USD → dikali kurs_usd brand; selain itu (IDR / belum terdeteksi) dianggap sudah Rupiah.
const KURS_KE_IDR = `(CASE WHEN b.mata_uang = 'USD' THEN b.kurs_usd ELSE 1 END)`;

async function syncMetaInsights(brandId, adAccountId, tanggal, tokenEnv) {
  const envName = tokenEnv || 'META_ACCESS_TOKEN';
  if (!META_TOKEN_ENV_RE.test(envName)) throw new Error(`Nama env token tidak valid: ${envName}`);
  const token = process.env[envName];
  if (!token) throw new Error(`${envName} tidak di-set`);

  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const fields = 'spend,clicks,impressions,reach,cpm,ctr,actions,action_values,account_currency';
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

  const mataUang = String(row.account_currency || '').trim().toUpperCase();
  if (mataUang) {
    await pool.query(
      `UPDATE meta_ads_brands SET mata_uang=$1::varchar WHERE id=$2 AND mata_uang IS DISTINCT FROM $1::varchar`,
      [mataUang, brandId]
    );
  }

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
router.get('/meta-ads/brands', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  try {
    const r = await pool.query('SELECT id, nama, ad_account_id, pixel_id, aktif, kurs_usd, hpp_default, token_env, mata_uang FROM meta_ads_brands ORDER BY nama');
    res.json({ data: r.rows });
  } catch { res.status(500).json({ error: 'Gagal ambil brands' }); }
});

// PUT /api/hub/meta-ads/brands/:id/settings — update kurs USD dan HPP default
router.put('/meta-ads/brands/:id/settings', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { kurs_usd, hpp_default } = req.body;
  if (kurs_usd == null || hpp_default == null) return res.status(400).json({ error: 'kurs_usd dan hpp_default wajib' });
  try {
    await pool.query(
      `UPDATE meta_ads_brands SET kurs_usd=$1, hpp_default=$2 WHERE id=$3`,
      [Number(kurs_usd), Number(hpp_default), req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { console.error('Gagal update settings:', e.message); res.status(500).json({ error: 'Gagal update settings' }); }
});

// POST /api/hub/meta-ads/brands
router.post('/meta-ads/brands', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { nama, ad_account_id, pixel_id } = req.body;
  const token_env = cleanTokenEnv(req.body.token_env);
  if (!nama || !ad_account_id) return res.status(400).json({ error: 'nama dan ad_account_id wajib' });
  if (token_env && !META_TOKEN_ENV_RE.test(token_env)) return res.status(400).json({ error: 'Nama env token harus diawali META_ACCESS_TOKEN (huruf besar, angka, underscore)' });
  try {
    const r = await pool.query(
      `INSERT INTO meta_ads_brands (nama, ad_account_id, pixel_id, token_env) VALUES ($1,$2,$3,$4) RETURNING *`,
      [nama, ad_account_id, pixel_id || null, token_env]
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Brand sudah ada' });
    res.status(500).json({ error: 'Gagal simpan brand' });
  }
});

// PUT /api/hub/meta-ads/brands/:id
router.put('/meta-ads/brands/:id', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { nama, ad_account_id, pixel_id, aktif } = req.body;
  const token_env = cleanTokenEnv(req.body.token_env);
  if (!nama || !ad_account_id) return res.status(400).json({ error: 'nama dan ad_account_id wajib' });
  if (token_env && !META_TOKEN_ENV_RE.test(token_env)) return res.status(400).json({ error: 'Nama env token harus diawali META_ACCESS_TOKEN (huruf besar, angka, underscore)' });
  try {
    const r = await pool.query(
      `UPDATE meta_ads_brands SET nama=$1, ad_account_id=$2, pixel_id=$3, aktif=$4, token_env=$5 WHERE id=$6`,
      [nama, ad_account_id, pixel_id || null, aktif !== false, token_env, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Brand tidak ditemukan' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Nama brand sudah dipakai' });
    res.status(500).json({ error: 'Gagal update brand' });
  }
});

// DELETE /api/hub/meta-ads/brands/:id — hapus brand + seluruh insights/report/threshold-nya (ON DELETE CASCADE)
router.delete('/meta-ads/brands/:id', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM meta_ads_brands WHERE id=$1 RETURNING nama', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Brand tidak ditemukan' });
    res.json({ ok: true });
  } catch (e) { console.error('Gagal hapus brand:', e.message); res.status(500).json({ error: 'Gagal hapus brand' }); }
});

// GET /api/hub/meta-ads/insights?brand_id=&bulan=YYYY-MM
router.get('/meta-ads/insights', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { brand_id, bulan } = req.query;
  try {
    let whereClause = '';
    const params = [];
    if (brand_id) { params.push(brand_id); whereClause += ` AND i.brand_id=$${params.length}`; }
    if (bulan)    { params.push(bulan + '-01'); whereClause += ` AND DATE_TRUNC('month', i.tanggal)=DATE_TRUNC('month', $${params.length}::date)`; }
    const r = await pool.query(`
      SELECT i.id, i.brand_id, i.tanggal::text,
             ROUND(i.spend * ${KURS_KE_IDR}, 2) AS spend, i.spend AS spend_asli, b.mata_uang,
             i.klik, i.impresi, i.reach, ROUND(i.cpm * ${KURS_KE_IDR}, 2) AS cpm, i.ctr,
             ROUND(i.purchase_value * ${KURS_KE_IDR}, 2) AS purchase_value, i.purchase_count, i.synced_at,
             b.nama AS brand_nama, b.ad_account_id, b.kurs_usd, b.hpp_default,
             r.jumlah_order, r.omzet, r.catatan AS catatan_report,
             ROUND(r.omzet / NULLIF(b.kurs_usd, 0), 2) AS omzet_usd,
             b.hpp_default AS hpp_persen,
             ROUND(r.omzet - (r.omzet * b.hpp_default / 100) - i.spend * ${KURS_KE_IDR}, 2) AS profit_bersih,
             CASE WHEN i.spend > 0 THEN ROUND(r.omzet / (i.spend * ${KURS_KE_IDR}), 4) END   AS roas_aktual
      FROM meta_ads_insights i
      JOIN meta_ads_brands b ON b.id = i.brand_id
      LEFT JOIN meta_ads_reports r ON r.brand_id = i.brand_id AND r.tanggal = i.tanggal
      WHERE 1=1 ${whereClause}
      ORDER BY i.tanggal DESC
    `, params);
    res.json({ data: r.rows });
  } catch (e) { console.error('Gagal ambil insights:', e.message); res.status(500).json({ error: 'Gagal ambil insights' }); }
});

// POST /api/hub/meta-ads/report — input manual order/omzet (dalam USD, dikonversi ke IDR)
router.post('/meta-ads/report', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
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
  } catch (e) { console.error('Gagal simpan report:', e.message); res.status(500).json({ error: 'Gagal simpan report' }); }
});

// GET /api/hub/meta-ads/laporan?bulan=YYYY-MM&brand_id=
router.get('/meta-ads/laporan', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { bulan, brand_id } = req.query;
  const bulanParam = bulan || new Date().toISOString().slice(0, 7);
  try {
    const params = [bulanParam + '-01'];
    let brandFilter = '';
    if (brand_id) { params.push(brand_id); brandFilter = ` AND b.id=$${params.length}`; }
    const r = await pool.query(`
      SELECT
        b.id AS brand_id, b.nama AS brand_nama,
        COALESCE(SUM(i.spend * ${KURS_KE_IDR}), 0)::NUMERIC(14,2) AS total_spend,
        COALESCE(SUM(i.klik), 0)                           AS total_klik,
        COALESCE(SUM(i.impresi), 0)                        AS total_impresi,
        COALESCE(AVG(i.cpm * ${KURS_KE_IDR}), 0)::NUMERIC(12,4)   AS avg_cpm,
        COALESCE(AVG(i.ctr), 0)::NUMERIC(8,4)              AS avg_ctr,
        COALESCE(SUM(r.jumlah_order), 0)                   AS total_order,
        COALESCE(SUM(r.omzet), 0)::NUMERIC(12,2)           AS total_omzet,
        COALESCE(AVG(r.hpp_persen), 0)::NUMERIC(5,2)       AS avg_hpp_persen,
        COALESCE(
          SUM(r.omzet - (r.omzet * r.hpp_persen / 100)) - SUM(i.spend * ${KURS_KE_IDR}), 0
        )::NUMERIC(14,2)                                   AS total_profit_bersih,
        CASE WHEN SUM(i.spend) > 0
          THEN ROUND(SUM(r.omzet) / SUM(i.spend * ${KURS_KE_IDR}), 4) END  AS roas
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
  } catch (e) { console.error('Gagal ambil laporan:', e.message); res.status(500).json({ error: 'Gagal ambil laporan' }); }
});

// POST /api/hub/meta-ads/sync/:brandId — sync data dari Meta API untuk tanggal tertentu
router.post('/meta-ads/sync/:brandId', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { tanggal } = req.body;
  const tgl = tanggal || new Date().toISOString().slice(0, 10);
  try {
    const br = await pool.query('SELECT * FROM meta_ads_brands WHERE id=$1 AND aktif=TRUE', [req.params.brandId]);
    if (!br.rows.length) return res.status(404).json({ error: 'Brand tidak ditemukan' });
    const brand = br.rows[0];
    const data = await syncMetaInsights(brand.id, brand.ad_account_id, tgl, brand.token_env);
    if (!data) return res.json({ ok: true, message: 'Tidak ada data dari Meta untuk tanggal ini' });
    res.json({ ok: true, data });
  } catch (e) { console.error('Gagal sync:', e.message); res.status(500).json({ error: 'Gagal sync' }); }
});

// POST /api/hub/meta-ads/sync-range/:brandId — sync range tanggal
router.post('/meta-ads/sync-range/:brandId', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
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
        const data = await syncMetaInsights(brand.id, brand.ad_account_id, tgl, brand.token_env);
        results.push({ tanggal: tgl, ok: true, data });
      } catch (e) {
        results.push({ tanggal: tgl, ok: false, error: e.message });
      }
    }
    const ok = results.filter(r => r.ok).length;
    res.json({ ok: true, total: results.length, berhasil: ok, gagal: results.length - ok, results });
  } catch (e) { console.error('Gagal sync range:', e.message); res.status(500).json({ error: 'Gagal sync range' }); }
});

// POST /api/hub/meta-ads/sync-all — sync semua brand aktif (dipanggil cron)
router.post('/meta-ads/sync-all', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const tgl = req.body.tanggal || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  try {
    const brands = await pool.query('SELECT * FROM meta_ads_brands WHERE aktif=TRUE');
    const results = await Promise.allSettled(
      brands.rows.map(b => syncMetaInsights(b.id, b.ad_account_id, tgl, b.token_env))
    );
    const summary = results.map((r, i) => ({
      brand: brands.rows[i].nama,
      status: r.status,
      error: r.reason?.message,
    }));
    res.json({ ok: true, tanggal: tgl, summary });
  } catch (e) { console.error('Gagal sync all:', e.message); res.status(500).json({ error: 'Gagal sync all' }); }
});

// ── LAPORAN ADS MINGGUAN (PDF slide) ─────────────────────────────────────────
// Angka performa dihitung otomatis dari meta_ads_insights + meta_ads_reports per "minggu" tetap:
// M1 = tgl 1–7, M2 = 8–14, M3 = 15–21, M4 = 22–akhir bulan. Sisanya isian manual per brand+bulan.
// Hak akses memakai page key 'ads-performance' (bagian dari modul Ads).

const RE_BULAN  = /^\d{4}-(0[1-9]|1[0-2])$/;
const RE_GAMBAR = /^data:image\/(png|jpe?g|webp);base64,/;
const GAMBAR_MAKS_CHAR = 1_400_000;
const JENIS_GAMBAR = ['maskot', 'kreatif', 'proyek', 'portofolio'];
const GAMBAR_MAKS = { kreatif: 6, proyek: 8, portofolio: 8 }; // per brand+bulan (proyek/portofolio: per minggu)

const laAngka = (v, maks = 1e9) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, maks) : 0; };
const laTeks  = (v, maks = 300) => String(v ?? '').trim().slice(0, maks);
const laDaftar = (v) => (Array.isArray(v) ? v : []).map(x => laTeks(x)).filter(Boolean).slice(0, 20);

function bersihkanLaporanAds({ kpi, mingguan, kreatif }) {
  const k = kpi || {};
  return {
    kpi: { impresi: laAngka(k.impresi), ctr: laAngka(k.ctr, 100), profile_visit: laAngka(k.profile_visit), chat_masuk: laAngka(k.chat_masuk), order: laAngka(k.order) },
    mingguan: Array.from({ length: 4 }, (_, i) => {
      const m = (Array.isArray(mingguan) && mingguan[i]) || {};
      const oq = m.order_queue || {};
      return {
        profile_visit: laAngka(m.profile_visit), chat_masuk: laAngka(m.chat_masuk),
        todo: laDaftar(m.todo), kendala: laDaftar(m.kendala),
        order_queue: { in_progress: laAngka(oq.in_progress), revisi: laAngka(oq.revisi), ready: laAngka(oq.ready) },
        flow_new: laAngka(m.flow_new), flow_complete: laAngka(m.flow_complete),
      };
    }),
    kreatif: (Array.isArray(kreatif) ? kreatif : []).slice(0, GAMBAR_MAKS.kreatif).map(c => ({
      gambar_id: Number.isInteger(Number(c?.gambar_id)) && c?.gambar_id !== null ? Number(c.gambar_id) : null,
      nama: laTeks(c?.nama, 100),
      mingguan: Array.from({ length: 4 }, (_, i) => ({ chat: laAngka(c?.mingguan?.[i]?.chat), order: laAngka(c?.mingguan?.[i]?.order) })),
    })),
  };
}

// ── Periode 4 minggu (rentang tanggal) ────────────────────────────────────────
// Bawaan = 1–7, 8–14, 15–21, 22–akhir bulan. Per bulan bisa diatur bebas (mis. mulai tgl 3, atau melewati akhir bulan)
// selama 4 rentang berurutan & tidak tumpang tindih. Semua tanggal berupa string ISO 'YYYY-MM-DD' (dibandingkan
// leksikografis) supaya bebas masalah zona waktu.
const RE_TGL = /^\d{4}-\d{2}-\d{2}$/;
const BULAN_ID_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const tglValid = (s) => {
  if (!RE_TGL.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // menolak 2026-02-30
};
const tglTambah = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const selisihHari = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
const akhirBulan = (bulan) => { const [y, m] = bulan.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const geserBulan = (bulan, k) => { const [y, m] = bulan.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7); };
const fmtTglId = (s) => `${Number(s.slice(8, 10))} ${BULAN_ID_PENDEK[Number(s.slice(5, 7)) - 1]}`;

function rentangBawaan(bulan) {
  return [
    { dari: bulan + '-01', sampai: bulan + '-07' },
    { dari: bulan + '-08', sampai: bulan + '-14' },
    { dari: bulan + '-15', sampai: bulan + '-21' },
    { dari: bulan + '-22', sampai: akhirBulan(bulan) },
  ];
}
const rentangEfektif = (rec, bulan) => (Array.isArray(rec?.rentang) && rec.rentang.length === 4 ? rec.rentang : rentangBawaan(bulan));

// Validasi periode dari klien → { rentang } bersih atau { error }
function cekRentang(input, bulan) {
  if (!Array.isArray(input) || input.length !== 4) return { error: 'Periode harus berisi tepat 4 minggu' };
  const r = [];
  for (let i = 0; i < 4; i++) {
    const dari = String(input[i]?.dari ?? ''), sampai = String(input[i]?.sampai ?? '');
    if (!tglValid(dari) || !tglValid(sampai)) return { error: `Minggu ${i + 1}: tanggal tidak valid` };
    if (dari > sampai) return { error: `Minggu ${i + 1}: tanggal "dari" harus sebelum atau sama dengan "sampai"` };
    if (selisihHari(dari, sampai) > 30) return { error: `Minggu ${i + 1}: rentang maksimal 31 hari` };
    if (i > 0 && dari <= r[i - 1].sampai) return { error: `Minggu ${i + 1} harus dimulai setelah Minggu ${i} berakhir (tidak boleh tumpang tindih)` };
    r.push({ dari, sampai });
  }
  // pengaman salah ketik (mis. tahun keliru): Minggu 1 harus dekat dengan bulan laporan
  const batasAwal = tglTambah(bulan + '-01', -7), batasAkhir = akhirBulan(bulan);
  if (r[0].dari < batasAwal || r[0].dari > batasAkhir) return { error: `Minggu 1 harus dimulai antara ${batasAwal} dan ${batasAkhir} (sekitar bulan laporan)` };
  return { rentang: r };
}

// Peringatan (tidak memblokir): periode bulan ini menghitung tanggal yang juga dihitung di laporan bulan tetangga
async function peringatanRentang(brandId, bulan, rentang) {
  const r = await pool.query(
    'SELECT bulan, rentang FROM laporan_ads_bulan WHERE brand_id=$1 AND bulan = ANY($2::text[])',
    [brandId, [geserBulan(bulan, -1), geserBulan(bulan, 1)]]
  );
  const pesan = [];
  for (const rec of r.rows) {
    const lain = rentangEfektif(rec, rec.bulan);
    rentang.forEach((a, i) => lain.forEach((b, j) => {
      if (a.dari <= b.sampai && b.dari <= a.sampai) {
        const dari = a.dari > b.dari ? a.dari : b.dari, sampai = a.sampai < b.sampai ? a.sampai : b.sampai;
        pesan.push(`Minggu ${i + 1} bulan ini dan Minggu ${j + 1} laporan ${rec.bulan} sama-sama menghitung ${dari === sampai ? fmtTglId(dari) : `${fmtTglId(dari)}–${fmtTglId(sampai)}`} (terhitung dua kali).`);
      }
    }));
  }
  return pesan;
}

// Saran "lanjutkan dari bulan lalu": Minggu 1 bulan ini dimulai sehari setelah Minggu 4 bulan lalu berakhir.
// Hanya bila bulan lalu memakai periode kustom & titik lanjutnya berbeda dari awal Minggu 1 saat ini.
async function saranLanjutRentang(brandId, bulan, rentangSaatIni) {
  const bulanLalu = geserBulan(bulan, -1);
  const p = await pool.query('SELECT rentang FROM laporan_ads_bulan WHERE brand_id=$1 AND bulan=$2 AND rentang IS NOT NULL', [brandId, bulanLalu]);
  if (!p.rows.length || !Array.isArray(p.rows[0].rentang) || p.rows[0].rentang.length !== 4) return null;
  const mulai = tglTambah(p.rows[0].rentang[3].sampai, 1);
  if (mulai === rentangSaatIni[0].dari) return null;
  if (mulai < tglTambah(bulan + '-01', -7) || mulai > akhirBulan(bulan)) return null;
  return { dari: mulai, dari_bulan: bulanLalu };
}

// Angka otomatis per minggu (M1–M4) untuk satu brand+bulan+periode. Dipakai GET laporan-ads, perhitungan ulang saat
// periode diubah, dan pembekuan angka saat PDF diarsipkan — jadi semuanya PASTI memakai perhitungan yang sama.
async function hitungAngkaLaporanAds(brand, bulan, rentang = rentangBawaan(bulan)) {
  const auto = await pool.query(`
    WITH r AS (
      SELECT dari, sampai, minggu::int AS minggu
      FROM unnest($2::date[], $3::date[]) WITH ORDINALITY AS t(dari, sampai, minggu)
    ), hari AS (
      SELECT r.minggu, x.tanggal
      FROM r
      JOIN LATERAL (
        SELECT tanggal FROM meta_ads_insights WHERE brand_id=$1 AND tanggal BETWEEN r.dari AND r.sampai
        UNION
        SELECT tanggal FROM meta_ads_reports  WHERE brand_id=$1 AND tanggal BETWEEN r.dari AND r.sampai
      ) x ON TRUE
    )
    SELECT h.minggu,
           COALESCE(SUM(i.impresi), 0)::bigint                        AS impresi,
           COALESCE(SUM(i.klik), 0)::bigint                           AS klik,
           COALESCE(SUM(i.spend * ${KURS_KE_IDR}), 0)::numeric(16,2)  AS spend,
           COALESCE(SUM(r.jumlah_order), 0)::int                      AS jumlah_order,
           COALESCE(SUM(r.omzet), 0)::numeric(16,2)                   AS omzet
    FROM hari h
    JOIN meta_ads_brands b ON b.id = $1
    LEFT JOIN meta_ads_insights i ON i.brand_id = b.id AND i.tanggal = h.tanggal
    LEFT JOIN meta_ads_reports  r ON r.brand_id = b.id AND r.tanggal = h.tanggal
    GROUP BY h.minggu
  `, [brand.id, rentang.map(x => x.dari), rentang.map(x => x.sampai)]);

  const hpp = Number(brand.hpp_default || 0);
  const perMinggu = new Map(auto.rows.map(r => [Number(r.minggu), r]));
  return [1, 2, 3, 4].map(m => {
    const r = perMinggu.get(m);
    const impresi = Number(r?.impresi || 0), klik = Number(r?.klik || 0);
    const spend = Number(r?.spend || 0), omzet = Number(r?.omzet || 0);
    return {
      minggu: m, dari: rentang[m - 1].dari, sampai: rentang[m - 1].sampai,
      ada_data: !!r, impresi, klik,
      ctr: impresi > 0 ? (klik / impresi) * 100 : null,
      spend, omzet, jumlah_order: Number(r?.jumlah_order || 0),
      profit: omzet - (omzet * hpp / 100) - spend,
    };
  });
}

// POST /api/hub/meta-ads/laporan-ads/hitung — hitung ulang angka untuk periode yang sedang diedit (tanpa menyimpan)
router.post('/meta-ads/laporan-ads/hitung', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { brand_id, bulan, rentang } = req.body;
  if (!brand_id || !RE_BULAN.test(bulan || '')) return res.status(400).json({ error: 'brand_id dan bulan (YYYY-MM) wajib' });
  const c = cekRentang(rentang ?? rentangBawaan(bulan), bulan);
  if (c.error) return res.status(400).json({ error: c.error });
  try {
    const br = await pool.query('SELECT id, nama, hpp_default, mata_uang FROM meta_ads_brands WHERE id=$1', [brand_id]);
    if (!br.rows.length) return res.status(404).json({ error: 'Brand tidak ditemukan' });
    const [auto, peringatan] = await Promise.all([hitungAngkaLaporanAds(br.rows[0], bulan, c.rentang), peringatanRentang(br.rows[0].id, bulan, c.rentang)]);
    res.json({ data: { auto, rentang: c.rentang, peringatan } });
  } catch (e) { console.error('Gagal hitung angka laporan ads:', e.message); res.status(500).json({ error: 'Gagal menghitung angka' }); }
});

// GET /api/hub/meta-ads/laporan-ads?brand_id=&bulan=YYYY-MM
router.get('/meta-ads/laporan-ads', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { brand_id, bulan } = req.query;
  if (!brand_id || !RE_BULAN.test(bulan || '')) return res.status(400).json({ error: 'brand_id dan bulan (YYYY-MM) wajib' });
  try {
    const br = await pool.query('SELECT id, nama, hpp_default, mata_uang FROM meta_ads_brands WHERE id=$1', [brand_id]);
    if (!br.rows.length) return res.status(404).json({ error: 'Brand tidak ditemukan' });
    const brand = br.rows[0];
    const hpp = Number(brand.hpp_default || 0);

    const bln = await pool.query('SELECT kpi, mingguan, kreatif, rentang FROM laporan_ads_bulan WHERE brand_id=$1 AND bulan=$2', [brand.id, bulan]);
    const rentang = rentangEfektif(bln.rows[0], bulan);

    // ringkas=1 → hanya daftar gambar (id/jenis/minggu) TANPA isinya; isi diambil terpisah lewat GET .../gambar/:id.
    // Tanpa ringkas, isi (data URL base64) ikut dikirim seperti versi lama — dijaga demi kompatibilitas frontend lama.
    const kolomGambar = req.query.ringkas === '1' ? 'id, jenis, minggu' : 'id, jenis, minggu, data';
    const [profil, prev, gambar, angkaAuto, peringatan, saranLanjut] = await Promise.all([
      pool.query('SELECT judul, ig_handle FROM laporan_ads_profil WHERE brand_id=$1', [brand.id]),
      pool.query('SELECT kpi FROM laporan_ads_bulan WHERE brand_id=$1 AND bulan<$2 ORDER BY bulan DESC LIMIT 1', [brand.id, bulan]),
      pool.query(`SELECT ${kolomGambar} FROM laporan_ads_gambar
                  WHERE brand_id=$1 AND (jenis='maskot' OR bulan=$2) ORDER BY id`, [brand.id, bulan]),
      hitungAngkaLaporanAds(brand, bulan, rentang),
      peringatanRentang(brand.id, bulan, rentang),
      saranLanjutRentang(brand.id, bulan, rentang),
    ]);

    res.json({ data: {
      brand: { id: brand.id, nama: brand.nama, mata_uang: brand.mata_uang, hpp_default: hpp },
      profil: { judul: profil.rows[0]?.judul || brand.nama, ig_handle: profil.rows[0]?.ig_handle || '' },
      kpi: bln.rows[0]?.kpi || prev.rows[0]?.kpi || {},
      mingguan: bln.rows[0]?.mingguan || [],
      kreatif: bln.rows[0]?.kreatif || [],
      tersimpan: !!bln.rows[0],
      gambar: gambar.rows,
      auto: angkaAuto,
      rentang,                                  // periode yang berlaku (kustom atau bawaan)
      rentang_kustom: !!bln.rows[0]?.rentang,
      peringatan,                               // tanggal yang terhitung dua kali dengan bulan tetangga
      saran_lanjut: saranLanjut,                // { dari, dari_bulan } atau null
    } });
  } catch (e) { console.error('Gagal ambil laporan ads:', e.message); res.status(500).json({ error: 'Gagal ambil laporan ads' }); }
});

// PUT /api/hub/meta-ads/laporan-ads — simpan profil + isian manual sebulan (gambar lewat endpoint terpisah)
router.put('/meta-ads/laporan-ads', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { brand_id, bulan, profil } = req.body;
  if (!brand_id || !RE_BULAN.test(bulan || '')) return res.status(400).json({ error: 'brand_id dan bulan (YYYY-MM) wajib' });
  try {
    const br = await pool.query('SELECT id FROM meta_ads_brands WHERE id=$1', [brand_id]);
    if (!br.rows.length) return res.status(404).json({ error: 'Brand tidak ditemukan' });
    const bersih = bersihkanLaporanAds(req.body);

    // gambar_id kreatif harus gambar milik brand ini
    const ids = bersih.kreatif.map(c => c.gambar_id).filter(Boolean);
    const sah = new Set(ids.length
      ? (await pool.query(`SELECT id FROM laporan_ads_gambar WHERE brand_id=$1 AND jenis='kreatif' AND id = ANY($2::int[])`, [brand_id, ids])).rows.map(r => r.id)
      : []);
    bersih.kreatif.forEach(c => { if (!sah.has(c.gambar_id)) c.gambar_id = null; });

    // Periode minggu: field tidak dikirim → biarkan yang lama; null → kembali ke bawaan; array → validasi lalu simpan
    const adaRentang = Object.prototype.hasOwnProperty.call(req.body, 'rentang');
    let rentangSimpan = null;
    if (adaRentang && req.body.rentang !== null) {
      const c = cekRentang(req.body.rentang, bulan);
      if (c.error) return res.status(400).json({ error: c.error });
      rentangSimpan = c.rentang;
    }

    await pool.query(`
      INSERT INTO laporan_ads_bulan (brand_id, bulan, kpi, mingguan, kreatif, rentang, updated_by, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (brand_id, bulan) DO UPDATE SET kpi=$3, mingguan=$4, kreatif=$5,
        rentang = CASE WHEN $8::boolean THEN $6::jsonb ELSE laporan_ads_bulan.rentang END,
        updated_by=$7, updated_at=NOW()
    `, [brand_id, bulan, JSON.stringify(bersih.kpi), JSON.stringify(bersih.mingguan), JSON.stringify(bersih.kreatif),
        rentangSimpan ? JSON.stringify(rentangSimpan) : null, req.user.nama, adaRentang]);
    await pool.query(`
      INSERT INTO laporan_ads_profil (brand_id, judul, ig_handle, updated_at) VALUES ($1,$2,$3,NOW())
      ON CONFLICT (brand_id) DO UPDATE SET judul=$2, ig_handle=$3, updated_at=NOW()
    `, [brand_id, laTeks(profil?.judul, 100), laTeks(profil?.ig_handle, 100)]);
    const tersimpan = await pool.query('SELECT rentang FROM laporan_ads_bulan WHERE brand_id=$1 AND bulan=$2', [brand_id, bulan]);
    res.json({ ok: true, peringatan: await peringatanRentang(Number(brand_id), bulan, rentangEfektif(tersimpan.rows[0], bulan)) });
  } catch (e) { console.error('Gagal simpan laporan ads:', e.message); res.status(500).json({ error: 'Gagal simpan laporan ads' }); }
});

// POST /api/hub/meta-ads/laporan-ads/gambar — unggah satu gambar (data URL, sudah dikompres di browser)
router.post('/meta-ads/laporan-ads/gambar', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { brand_id, bulan, minggu, jenis, data } = req.body;
  if (!brand_id) return res.status(400).json({ error: 'brand_id wajib' });
  if (!JENIS_GAMBAR.includes(jenis)) return res.status(400).json({ error: 'jenis gambar tidak valid' });
  if (jenis !== 'maskot' && !RE_BULAN.test(bulan || '')) return res.status(400).json({ error: 'bulan (YYYY-MM) wajib' });
  const perMinggu = jenis === 'proyek' || jenis === 'portofolio';
  if (perMinggu && ![1, 2, 3, 4].includes(Number(minggu))) return res.status(400).json({ error: 'minggu harus 1–4' });
  if (typeof data !== 'string' || !RE_GAMBAR.test(data)) return res.status(400).json({ error: 'Format gambar tidak valid (png/jpg/webp)' });
  if (data.length > GAMBAR_MAKS_CHAR) return res.status(413).json({ error: 'Gambar terlalu besar, kecilkan dulu' });
  try {
    if (jenis === 'maskot') {
      await pool.query(`DELETE FROM laporan_ads_gambar WHERE brand_id=$1 AND jenis='maskot'`, [brand_id]);
    } else {
      const c = await pool.query(
        `SELECT COUNT(*)::int AS n FROM laporan_ads_gambar WHERE brand_id=$1 AND jenis=$2 AND bulan=$3 AND ($4::int IS NULL OR minggu=$4)`,
        [brand_id, jenis, bulan, perMinggu ? Number(minggu) : null]
      );
      if (c.rows[0].n >= GAMBAR_MAKS[jenis]) return res.status(400).json({ error: `Maksimal ${GAMBAR_MAKS[jenis]} gambar untuk bagian ini` });
    }
    const r = await pool.query(
      `INSERT INTO laporan_ads_gambar (brand_id, bulan, minggu, jenis, data) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [brand_id, jenis === 'maskot' ? null : bulan, perMinggu ? Number(minggu) : null, jenis, data]
    );
    res.status(201).json({ data: { id: r.rows[0].id } });
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ error: 'Brand tidak ditemukan' });
    console.error('Gagal simpan gambar laporan ads:', e.message);
    res.status(500).json({ error: 'Gagal simpan gambar' });
  }
});

// GET /api/hub/meta-ads/laporan-ads/gambar/:id — isi satu gambar sebagai BINER (bukan base64: ±25% lebih kecil).
// Gambar tidak pernah berubah per id, jadi boleh di-cache browser selamanya (private: butuh login).
router.get('/meta-ads/laporan-ads/gambar/:id', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    const r = await pool.query('SELECT data FROM laporan_ads_gambar WHERE id=$1', [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Gambar tidak ditemukan' });
    const d = r.rows[0].data;
    const koma = d.indexOf(',');
    const mime = d.slice(5, d.indexOf(';'));                 // "data:image/webp;base64,...." → image/webp (sudah divalidasi saat unggah)
    const buf = Buffer.from(d.slice(koma + 1), 'base64');
    res.set({ 'Content-Type': mime, 'Content-Length': buf.length, 'Cache-Control': 'private, max-age=31536000, immutable' });
    res.end(buf);
  } catch (e) { console.error('Gagal ambil gambar laporan ads:', e.message); res.status(500).json({ error: 'Gagal mengambil gambar' }); }
});

// DELETE /api/hub/meta-ads/laporan-ads/gambar/:id — hapus gambar (kreatif juga dilepas dari daftar kreatif bulannya)
router.delete('/meta-ads/laporan-ads/gambar/:id', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    const r = await pool.query('DELETE FROM laporan_ads_gambar WHERE id=$1 RETURNING brand_id, bulan, jenis', [id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Gambar tidak ditemukan' });
    const g = r.rows[0];
    if (g.jenis === 'kreatif') {
      await pool.query(`
        UPDATE laporan_ads_bulan
        SET kreatif = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(kreatif) e WHERE (e->>'gambar_id')::int IS DISTINCT FROM $3::int), '[]'::jsonb)
        WHERE brand_id=$1 AND bulan=$2
      `, [g.brand_id, g.bulan, id]);
    }
    res.json({ ok: true });
  } catch (e) { console.error('Gagal hapus gambar laporan ads:', e.message); res.status(500).json({ error: 'Gagal hapus gambar' }); }
});

// ── RIWAYAT (ARSIP) PDF LAPORAN ADS ──────────────────────────────────────────
// Setiap PDF yang dibuat dari halaman Laporan Ads Mingguan diunggah ke sini (body mentah application/pdf).
// Angka beku (ringkasan/snapshot) dihitung SERVER dari data tersimpan, bukan dikirim klien. Hanya ARSIP_MAKS_VERSI
// versi terbaru per brand+bulan+minggu yang disimpan; sisanya dihapus otomatis (soft delete, jejak tetap ada).

const ARSIP_MAKS_BYTE = 15 * 1024 * 1024;
const ARSIP_MAKS_VERSI = 3;
const parserPdfMentah = express.raw({ type: 'application/pdf', limit: ARSIP_MAKS_BYTE });
function parserPdf(req, res, next) {
  parserPdfMentah(req, res, (err) => {
    if (!err) return next();
    const terlalu = err.status === 413 || err.type === 'entity.too.large';
    res.status(terlalu ? 413 : 400).json({ error: terlalu ? 'PDF terlalu besar (maks 15 MB)' : 'Gagal membaca PDF' });
  });
}
const catatArsip = (db, arsipId, aksi, oleh) =>
  db.query('INSERT INTO laporan_ads_arsip_log (arsip_id, aksi, oleh) VALUES ($1,$2,$3)', [arsipId, aksi, oleh]);

// Inti penyimpanan arsip — dipakai unggahan sekali-kirim (POST .../arsip) dan unggahan berpotongan (.../arsip/unggahan/:id/selesai).
// Angka beku dihitung dari DB. Mengembalikan null bila brand tidak ada.
async function simpanArsipPdf({ brandId, bulan, minggu, slide, pdf, nama }) {
  const br = await pool.query('SELECT id, nama, hpp_default, mata_uang FROM meta_ads_brands WHERE id=$1', [brandId]);
  if (!br.rows.length) return null;
  const brand = br.rows[0];

  // Potret angka & isian saat ini (sumber: database, bukan klien)
  const bln = await pool.query('SELECT kpi, mingguan, kreatif, rentang FROM laporan_ads_bulan WHERE brand_id=$1 AND bulan=$2', [brand.id, bulan]);
  const rentang = rentangEfektif(bln.rows[0], bulan);
  const [profil, angka] = await Promise.all([
    pool.query('SELECT judul, ig_handle FROM laporan_ads_profil WHERE brand_id=$1', [brand.id]),
    hitungAngkaLaporanAds(brand, bulan, rentang),
  ]);
  const judul = profil.rows[0]?.judul || brand.nama;
  const ringkasan = {
    judul, ig_handle: profil.rows[0]?.ig_handle || '', hpp_default: Number(brand.hpp_default || 0), mata_uang: brand.mata_uang,
    rentang, // periode yang dipakai PDF ini — dibekukan (tiap elemen `auto` juga memuat dari/sampai)
    total_profit: angka.slice(0, minggu).reduce((s, a) => s + a.profit, 0),
    auto: angka,
  };
  const snapshot = {
    kpi: bln.rows[0]?.kpi || {},
    mingguan: bln.rows[0]?.mingguan || [],
    kreatif: (bln.rows[0]?.kreatif || []).map(k => ({ nama: k.nama, mingguan: k.mingguan })),
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // serialkan unggahan bersamaan untuk minggu yang sama supaya nomor versi tidak bentrok
    await client.query('SELECT pg_advisory_xact_lock($1::int, hashtext($2))', [brand.id, `${bulan}:${minggu}`]);
    const v = await client.query(
      'SELECT COALESCE(MAX(versi), 0) + 1 AS versi FROM laporan_ads_arsip WHERE brand_id=$1 AND bulan=$2 AND minggu=$3',
      [brand.id, bulan, minggu]
    );
    const versi = v.rows[0].versi;
    const ins = await client.query(`
      INSERT INTO laporan_ads_arsip (brand_id, bulan, minggu, versi, judul, ukuran, jumlah_slide, dibuat_oleh, ringkasan, snapshot)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, dibuat_pada
    `, [brand.id, bulan, minggu, versi, judul, pdf.length, slide || null, nama, JSON.stringify(ringkasan), JSON.stringify(snapshot)]);
    const id = ins.rows[0].id;
    await client.query('INSERT INTO laporan_ads_arsip_file (arsip_id, pdf) VALUES ($1,$2)', [id, pdf]);
    await catatArsip(client, id, 'dibuat', nama);

    // batasi jumlah versi tersimpan: yang lebih lama dari ARSIP_MAKS_VERSI terbaru dihapus otomatis
    const lama = await client.query(
      `SELECT id FROM laporan_ads_arsip WHERE brand_id=$1 AND bulan=$2 AND minggu=$3 AND dihapus_pada IS NULL
       ORDER BY versi DESC OFFSET $4`, [brand.id, bulan, minggu, ARSIP_MAKS_VERSI]
    );
    for (const row of lama.rows) {
      await client.query('DELETE FROM laporan_ads_arsip_file WHERE arsip_id=$1', [row.id]);
      await client.query(`UPDATE laporan_ads_arsip SET dihapus_pada=NOW(), dihapus_oleh='sistem (batas versi)' WHERE id=$1`, [row.id]);
      await catatArsip(client, row.id, 'dihapus', 'sistem (batas versi)');
    }
    await client.query('COMMIT');
    return { id, versi, ukuran: pdf.length, dibuat_pada: ins.rows[0].dibuat_pada, total_profit: ringkasan.total_profit };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}

// POST /api/hub/meta-ads/laporan-ads/arsip?brand_id=&bulan=YYYY-MM&minggu=1..4&slide=N  (Content-Type: application/pdf)
router.post('/meta-ads/laporan-ads/arsip', authMiddleware, requirePageAccess('ads-performance'), parserPdf, async (req, res) => {
  const { brand_id, bulan } = req.query;
  const minggu = Number(req.query.minggu);
  const slide = Math.min(Math.max(parseInt(req.query.slide, 10) || 0, 0), 50);
  if (!brand_id || !RE_BULAN.test(bulan || '') || ![1, 2, 3, 4].includes(minggu)) {
    return res.status(400).json({ error: 'brand_id, bulan (YYYY-MM), dan minggu (1–4) wajib' });
  }
  const pdf = req.body;
  if (!Buffer.isBuffer(pdf) || pdf.length < 100) return res.status(400).json({ error: 'Body harus berisi PDF (Content-Type: application/pdf)' });
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') return res.status(400).json({ error: 'Berkas bukan PDF yang valid' });

  try {
    const hasil = await simpanArsipPdf({ brandId: brand_id, bulan, minggu, slide, pdf, nama: req.user.nama });
    if (!hasil) return res.status(404).json({ error: 'Brand tidak ditemukan' });
    res.status(201).json({ data: hasil });
  } catch (e) { console.error('Gagal simpan arsip laporan ads:', e.message); res.status(500).json({ error: 'Gagal menyimpan PDF ke riwayat' }); }
});

// ── Unggahan PDF berpotongan ─────────────────────────────────────────────────
// Alur: (1) POST .../arsip/unggahan {brand_id,bulan,minggu,slide,ukuran} → id + ukuran potongan;
//       (2) PUT .../arsip/unggahan/:id/bagian/:n (application/octet-stream, tiap potongan persis `ukuran_bagian` byte,
//           kecuali yang terakhir) — boleh diulang bila gagal; (3) POST .../arsip/unggahan/:id/selesai → server menyusun,
//           memeriksa, lalu menyimpan lewat simpanArsipPdf yang sama dengan unggahan sekali-kirim.
const UNGGAH_POTONGAN = 700 * 1024;                       // di bawah batas 1 MB proxy (nginx default) dengan ruang cadangan
const UNGGAH_MAKS_POTONGAN = Math.ceil(ARSIP_MAKS_BYTE / UNGGAH_POTONGAN);
const parserPotonganMentah = express.raw({ type: 'application/octet-stream', limit: 800 * 1024 });
function parserPotongan(req, res, next) {
  parserPotonganMentah(req, res, (err) => {
    if (!err) return next();
    const terlalu = err.status === 413 || err.type === 'entity.too.large';
    res.status(terlalu ? 413 : 400).json({ error: terlalu ? 'Potongan terlalu besar' : 'Gagal membaca potongan' });
  });
}

// POST /api/hub/meta-ads/laporan-ads/arsip/unggahan
router.post('/meta-ads/laporan-ads/arsip/unggahan', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { brand_id, bulan } = req.body;
  const minggu = Number(req.body.minggu), ukuran = Number(req.body.ukuran);
  const slide = Math.min(Math.max(parseInt(req.body.slide, 10) || 0, 0), 50);
  if (!brand_id || !RE_BULAN.test(bulan || '') || ![1, 2, 3, 4].includes(minggu)) return res.status(400).json({ error: 'brand_id, bulan (YYYY-MM), dan minggu (1–4) wajib' });
  if (!Number.isInteger(ukuran) || ukuran < 100) return res.status(400).json({ error: 'ukuran PDF tidak valid' });
  if (ukuran > ARSIP_MAKS_BYTE) return res.status(413).json({ error: 'PDF terlalu besar (maks 15 MB)' });
  try {
    const br = await pool.query('SELECT id FROM meta_ads_brands WHERE id=$1', [brand_id]);
    if (!br.rows.length) return res.status(404).json({ error: 'Brand tidak ditemukan' });
    await pool.query(`DELETE FROM laporan_ads_unggahan WHERE dibuat_pada < NOW() - INTERVAL '1 hour'`); // bersihkan unggahan terbengkalai
    const r = await pool.query(
      `INSERT INTO laporan_ads_unggahan (brand_id, bulan, minggu, slide, ukuran, user_id, dibuat_oleh) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [brand_id, bulan, minggu, slide || null, ukuran, Number(req.user.id), req.user.nama]
    );
    res.status(201).json({ data: { id: r.rows[0].id, ukuran_bagian: UNGGAH_POTONGAN, jumlah_bagian: Math.ceil(ukuran / UNGGAH_POTONGAN) } });
  } catch (e) { console.error('Gagal mulai unggahan arsip:', e.message); res.status(500).json({ error: 'Gagal memulai unggahan' }); }
});

// PUT /api/hub/meta-ads/laporan-ads/arsip/unggahan/:id/bagian/:n
router.put('/meta-ads/laporan-ads/arsip/unggahan/:id/bagian/:n', authMiddleware, requirePageAccess('ads-performance'), parserPotongan, async (req, res) => {
  const id = Number(req.params.id), n = Number(req.params.n);
  if (!Number.isInteger(id) || !Number.isInteger(n) || n < 0 || n >= UNGGAH_MAKS_POTONGAN) return res.status(400).json({ error: 'id atau nomor potongan tidak valid' });
  const data = req.body;
  if (!Buffer.isBuffer(data) || !data.length) return res.status(400).json({ error: 'Body harus berisi potongan (Content-Type: application/octet-stream)' });
  try {
    const u = await pool.query(`SELECT ukuran, user_id, status FROM laporan_ads_unggahan WHERE id=$1`, [id]);
    if (!u.rows.length) return res.status(404).json({ error: 'Unggahan tidak ditemukan atau sudah kedaluwarsa' });
    if (u.rows[0].user_id !== Number(req.user.id)) return res.status(403).json({ error: 'Unggahan ini milik pengguna lain' });
    if (u.rows[0].status !== 'baru') return res.status(409).json({ error: 'Unggahan sedang diproses' });
    const jumlah = Math.ceil(u.rows[0].ukuran / UNGGAH_POTONGAN);
    if (n >= jumlah) return res.status(400).json({ error: 'Nomor potongan di luar jumlah yang diharapkan' });
    const harapan = n === jumlah - 1 ? u.rows[0].ukuran - UNGGAH_POTONGAN * (jumlah - 1) : UNGGAH_POTONGAN; // hanya potongan terakhir yang boleh lebih kecil
    if (data.length !== harapan) return res.status(400).json({ error: `Ukuran potongan ${n} seharusnya ${harapan} byte` });
    await pool.query(
      `INSERT INTO laporan_ads_unggahan_bagian (unggahan_id, n, data) VALUES ($1,$2,$3) ON CONFLICT (unggahan_id, n) DO UPDATE SET data = EXCLUDED.data`,
      [id, n, data]
    );
    res.json({ ok: true });
  } catch (e) { console.error('Gagal simpan potongan arsip:', e.message); res.status(500).json({ error: 'Gagal menyimpan potongan' }); }
});

// POST /api/hub/meta-ads/laporan-ads/arsip/unggahan/:id/selesai
router.post('/meta-ads/laporan-ads/arsip/unggahan/:id/selesai', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    // klaim atomik: hanya satu permintaan "selesai" yang boleh memproses (klik ganda / percobaan ulang tidak membuat arsip ganda)
    const klaim = await pool.query(
      `UPDATE laporan_ads_unggahan SET status='diproses' WHERE id=$1 AND user_id=$2 AND status='baru' RETURNING brand_id, bulan, minggu, slide, ukuran`,
      [id, Number(req.user.id)]
    );
    if (!klaim.rows.length) {
      const ada = await pool.query('SELECT user_id, status FROM laporan_ads_unggahan WHERE id=$1', [id]);
      if (!ada.rows.length) return res.status(404).json({ error: 'Unggahan tidak ditemukan atau sudah kedaluwarsa' });
      if (ada.rows[0].user_id !== Number(req.user.id)) return res.status(403).json({ error: 'Unggahan ini milik pengguna lain' });
      return res.status(409).json({ error: 'Unggahan sedang diproses' });
    }
    const u = klaim.rows[0];
    const lepas = () => pool.query(`UPDATE laporan_ads_unggahan SET status='baru' WHERE id=$1`, [id]).catch(() => {});
    try {
      const jumlah = Math.ceil(u.ukuran / UNGGAH_POTONGAN);
      const bag = await pool.query('SELECT n, data FROM laporan_ads_unggahan_bagian WHERE unggahan_id=$1 ORDER BY n', [id]);
      if (bag.rows.length !== jumlah || bag.rows.some((b, i) => b.n !== i)) { await lepas(); return res.status(400).json({ error: `Potongan belum lengkap (${bag.rows.length} dari ${jumlah})` }); }
      const pdf = Buffer.concat(bag.rows.map(b => b.data));
      if (pdf.length !== u.ukuran) { await lepas(); return res.status(400).json({ error: 'Ukuran hasil susunan tidak cocok' }); }
      if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') { await lepas(); return res.status(400).json({ error: 'Berkas bukan PDF yang valid' }); }
      const hasil = await simpanArsipPdf({ brandId: u.brand_id, bulan: u.bulan, minggu: u.minggu, slide: u.slide, pdf, nama: req.user.nama });
      if (!hasil) { await lepas(); return res.status(404).json({ error: 'Brand tidak ditemukan' }); }
      await pool.query('DELETE FROM laporan_ads_unggahan WHERE id=$1', [id]); // potongan ikut terhapus (cascade)
      res.status(201).json({ data: hasil });
    } catch (e) { await lepas(); throw e; }
  } catch (e) { console.error('Gagal menyelesaikan unggahan arsip:', e.message); res.status(500).json({ error: 'Gagal menyimpan PDF ke riwayat' }); }
});

// GET /api/hub/meta-ads/laporan-ads/arsip?brand_id=&bulan=YYYY-MM  (bulan opsional = semua bulan)
router.get('/meta-ads/laporan-ads/arsip', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const { brand_id, bulan } = req.query;
  if (!brand_id) return res.status(400).json({ error: 'brand_id wajib' });
  if (bulan && !RE_BULAN.test(bulan)) return res.status(400).json({ error: 'bulan harus YYYY-MM' });
  try {
    const params = [brand_id];
    let filter = '';
    if (bulan) { params.push(bulan); filter = ' AND bulan=$2'; }
    const r = await pool.query(`
      SELECT id, brand_id, bulan, minggu, versi, judul, ukuran, jumlah_slide, dibuat_oleh, dibuat_pada, ringkasan,
             jumlah_unduh, terakhir_diunduh_oleh, terakhir_diunduh_pada
      FROM laporan_ads_arsip
      WHERE brand_id=$1 AND dihapus_pada IS NULL${filter}
      ORDER BY bulan DESC, minggu DESC, versi DESC LIMIT 200
    `, params);
    res.json({ data: r.rows });
  } catch (e) { console.error('Gagal ambil arsip laporan ads:', e.message); res.status(500).json({ error: 'Gagal ambil riwayat' }); }
});

// GET /api/hub/meta-ads/laporan-ads/arsip/:id/log — jejak dibuat/diunduh/dihapus satu arsip
router.get('/meta-ads/laporan-ads/arsip/:id/log', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    const r = await pool.query('SELECT aksi, oleh, waktu FROM laporan_ads_arsip_log WHERE arsip_id=$1 ORDER BY id DESC LIMIT 100', [id]);
    res.json({ data: r.rows });
  } catch (e) { console.error('Gagal ambil log arsip:', e.message); res.status(500).json({ error: 'Gagal ambil log' }); }
});

// GET /api/hub/meta-ads/laporan-ads/arsip/:id/pdf — unduh file & catat unduhan
router.get('/meta-ads/laporan-ads/arsip/:id/pdf', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    const r = await pool.query(`
      SELECT a.judul, a.bulan, a.minggu, a.versi, f.pdf
      FROM laporan_ads_arsip a JOIN laporan_ads_arsip_file f ON f.arsip_id = a.id
      WHERE a.id=$1 AND a.dihapus_pada IS NULL
    `, [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'PDF tidak ditemukan atau sudah dihapus' });
    const a = r.rows[0];
    // pencatatan tidak boleh menggagalkan unduhan
    try {
      await pool.query(
        `UPDATE laporan_ads_arsip SET jumlah_unduh = jumlah_unduh + 1, terakhir_diunduh_oleh=$2, terakhir_diunduh_pada=NOW() WHERE id=$1`,
        [id, req.user.nama]
      );
      await catatArsip(pool, id, 'diunduh', req.user.nama);
    } catch (e) { console.error('Gagal mencatat unduhan arsip:', e.message); }
    const nama = `Weekly Report - ${a.judul} ${a.bulan} M${a.minggu} v${a.versi}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': a.pdf.length,
      'Content-Disposition': `attachment; filename="${nama.replace(/[^A-Za-z0-9 ._-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nama)}`,
      'Cache-Control': 'private, no-store',
    });
    res.end(a.pdf);
  } catch (e) { console.error('Gagal unduh arsip laporan ads:', e.message); res.status(500).json({ error: 'Gagal mengunduh PDF' }); }
});

// DELETE /api/hub/meta-ads/laporan-ads/arsip/:id — hanya admin. Soft delete: file dibuang, jejak tetap.
router.delete('/meta-ads/laporan-ads/arsip/:id', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang boleh menghapus PDF dari riwayat' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id tidak valid' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      'UPDATE laporan_ads_arsip SET dihapus_pada=NOW(), dihapus_oleh=$2 WHERE id=$1 AND dihapus_pada IS NULL RETURNING id',
      [id, req.user.nama]
    );
    if (!r.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'PDF tidak ditemukan atau sudah dihapus' }); }
    await client.query('DELETE FROM laporan_ads_arsip_file WHERE arsip_id=$1', [id]);
    await catatArsip(client, id, 'dihapus', req.user.nama);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Gagal hapus arsip laporan ads:', e.message);
    res.status(500).json({ error: 'Gagal menghapus PDF' });
  } finally { client.release(); }
});

// ── AI INSIGHT ───────────────────────────────────────────────────────────────

// POST /api/hub/ai/insight-ads
router.post('/ai/insight-ads', authMiddleware, requirePageAccess('ads-performance'), async (req, res) => {
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
        ROUND(i.spend * ${KURS_KE_IDR}, 2) AS spend, i.klik, i.impresi, i.ctr, ROUND(i.cpm * ${KURS_KE_IDR}, 2) AS cpm,
        rep.jumlah_order, rep.omzet, rep.hpp_persen,
        CASE WHEN rep.omzet IS NOT NULL AND i.spend > 0
          THEN ROUND((rep.omzet - rep.omzet * COALESCE(rep.hpp_persen,0)/100 - i.spend * ${KURS_KE_IDR})::numeric, 0)
          ELSE NULL END AS profit_bersih,
        CASE WHEN i.spend > 0 AND rep.omzet IS NOT NULL
          THEN ROUND((rep.omzet / (i.spend * ${KURS_KE_IDR}))::numeric, 2)
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
  } catch (e) { console.error('Gagal generate insight:', e.message); res.status(500).json({ error: 'Gagal generate insight' }); }
});

// POST /api/hub/ai/chat — AI assistant dengan konteks data hub
router.post('/ai/chat', authMiddleware, requirePageAccess('ai-assistant'), async (req, res) => {
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
      pool.query(`SELECT b.nama AS brand, i.tanggal::text, ROUND(i.spend * ${KURS_KE_IDR}, 2) AS spend, i.klik, i.ctr, i.impresi, ROUND(i.cpm * ${KURS_KE_IDR}, 2) AS cpm, rep.jumlah_order, rep.omzet, rep.hpp_persen FROM meta_ads_insights i JOIN meta_ads_brands b ON b.id=i.brand_id LEFT JOIN meta_ads_reports rep ON rep.brand_id=i.brand_id AND rep.tanggal=i.tanggal WHERE DATE_TRUNC('month',i.tanggal)=DATE_TRUNC('month',$1::date) ORDER BY i.tanggal DESC`, [tglIni]).catch(() => ({ rows: [] })),
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
  } catch (e) { console.error('AI Assistant error:', e.message); res.status(500).json({ error: 'Gagal memproses permintaan AI Assistant' }); }
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
          await syncMetaInsights(b.id, b.ad_account_id, tgl, b.token_env);
          console.log(`[Meta Ads Cron] OK: ${b.nama}`);
        } catch (e) {
          console.error(`[Meta Ads Cron] FAIL ${b.nama}: ${e.message}`);
        }
      }
    } catch (e) { console.error('[Meta Ads Cron] Error:', e.message); }
  });
  console.log('[Meta Ads Cron] Terjadwal: setiap hari 07:00 WIB');
} catch { /* node-cron belum terinstall — skip */ }

// Modul RPG/gamifikasi — endpoint /rpg/* (lihat backend/rpg.js)
require('./rpg')(router, { hubPool, authMiddleware, requirePageAccess, getPageAccessList });

module.exports = router;

// Standalone server entry point (dijalankan langsung via PM2)
if (require.main === module) {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use('/api/hub', router);
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Creanimasi Hub running on port ${PORT}`));
}
