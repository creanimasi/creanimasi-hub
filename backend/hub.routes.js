// ══════════════════════════════════════════════════
// CREANIMASI INTERNAL HUB — Backend API Routes
// Tambahkan ke server Node.js CRM_Creanimasi yang ada
// File: routes/hub.routes.js
// ══════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ── HELPER ────────────────────────────────────────
const query = (text, params) => pool.query(text, params);

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

module.exports = router;
