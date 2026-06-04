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
const JWT_SECRET = process.env.HUB_JWT_SECRET || 'creanimasi-hub-secret-2024';

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
    if (!user) return res.status(401).json({ error: 'Username tidak ditemukan' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Password salah' });

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
  if (password_baru.length < 6)
    return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
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
      nama, divisi, level_karier, tanggal_jurnal,
      pencapaian_1, pencapaian_2, pencapaian_3,
      hambatan, pelajaran, target_depan,
      mood, skor_karya, skor_waktu, skor_komunikasi, skor_skill,
      catatan_mentor
    } = req.body;

    if (!nama || !mood) {
      return res.status(400).json({ error: 'Nama dan mood wajib diisi' });
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
    let q = `SELECT * FROM jurnal_mingguan`;
    const params = [];
    if (nama) {
      q += ` WHERE nama = $1`;
      params.push(nama);
    }
    q += ` ORDER BY tanggal_jurnal DESC, created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

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
    const fields = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at');
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
  const pw = password_baru || 'creanimasi123';
  try {
    const timR = await hubPool.query('SELECT nama FROM tim WHERE id=$1', [req.params.id]);
    if (!timR.rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
    const nama = timR.rows[0].nama;
    const hashed = await bcrypt.hash(pw, 10);
    const r = await hubPool.query('UPDATE hub_users SET password=$1 WHERE nama=$2 RETURNING username', [hashed, nama]);
    if (!r.rows.length) return res.status(404).json({ error: 'User tidak ditemukan di hub_users' });
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

module.exports = router;
