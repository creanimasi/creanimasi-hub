// ══════════════════════════════════════════════════════════════════════════════
// LAPORAN KPI ARTIST — rekap poin harian per artist (tim produksi), grid kalender
// bulanan pengganti spreadsheet "Artist Assignment". PRD: lihat percakapan 2026-09-23.
// Angka poin harian DIAMBIL OTOMATIS dari kolom `poin` + `tanggal_kerja` di
// timeline_tugas (backend/timeline.js) — halaman ini TIDAK punya input poin manual
// sendiri, cuma target KPI bulanan per artist yang diatur admin di sini.
// SENGAJA terpisah total dari Target Poin Produksi RPG (rpg_target.js) — v1, lihat PRD §3.
// Didaftarkan dari hub.js: require('./laporan_kpi')(router, { hubPool, authMiddleware, requirePageAccess })
// ══════════════════════════════════════════════════════════════════════════════

const BULAN_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
// Sama persis definisi "tim produksi" yang dipakai auto-seed Papan Timeline & Target Poin Produksi RPG.
const DIVISI_PRODUKSI = ['Illustrator', 'Rigger', '3D Modeler', 'Desainer'];

module.exports = function registerLaporanKpi(router, { hubPool, authMiddleware, requirePageAccess }) {
  const q = (text, params) => hubPool.query(text, params);
  const akses = [authMiddleware, requirePageAccess('laporan-kpi')];
  const bilangan = (v) => (typeof v === 'number' || (typeof v === 'string' && /^-?\d+$/.test(v.trim()))) ? Number(v) : NaN;

  const ready = (async () => {
    try {
      await q(`CREATE TABLE IF NOT EXISTS laporan_kpi_target (
        id SERIAL PRIMARY KEY,
        tim_id INTEGER NOT NULL REFERENCES tim(id) ON DELETE CASCADE,
        bulan VARCHAR(7) NOT NULL,
        target INTEGER CHECK (target IS NULL OR (target BETWEEN 0 AND 9999)),
        catatan VARCHAR(300),
        total_bonus INTEGER CHECK (total_bonus IS NULL OR total_bonus >= 0),
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (tim_id, bulan))`);
      await q('CREATE INDEX IF NOT EXISTS idx_laporan_kpi_target_bulan ON laporan_kpi_target (bulan)');
    } catch (e) { console.error('Migration Laporan KPI startup:', e.message); }
  })();
  router.use('/laporan-kpi', async (req, res, next) => { await ready; next(); });

  const gagal = (res, tag, e, pesan) => { console.error(`[LaporanKPI] ${tag}:`, e.message); res.status(500).json({ error: pesan }); };

  // ── GET /laporan-kpi?bulan=2026-09 — grid artist × tanggal, target & total sudah dihitung ──
  router.get('/laporan-kpi', ...akses, async (req, res) => {
    try {
      const bulan = String(req.query.bulan || '');
      if (!BULAN_RE.test(bulan)) return res.status(400).json({ error: 'Format bulan harus YYYY-MM (mis. 2026-09)' });
      const [tahun, bln] = bulan.split('-').map(Number);
      const awal = `${bulan}-01`;
      const jumlahHari = new Date(tahun, bln, 0).getDate(); // tgl 0 bulan berikutnya = hari terakhir bulan ini
      const akhir = `${bulan}-${String(jumlahHari).padStart(2, '0')}`;

      const artisR = await q('SELECT id, nama FROM tim WHERE divisi = ANY($1) AND aktif = TRUE ORDER BY nama', [DIVISI_PRODUKSI]);
      const ids = artisR.rows.map(a => a.id);

      const [poinR, targetR] = await Promise.all([
        ids.length
          ? q(`SELECT o.tim_id, tt.tanggal_kerja::text AS tanggal, SUM(tt.poin)::int AS poin
               FROM timeline_tugas tt JOIN timeline_orang o ON o.id = tt.orang_id
               WHERE tt.tanggal_kerja BETWEEN $1 AND $2 AND tt.poin IS NOT NULL AND o.tim_id = ANY($3)
               GROUP BY o.tim_id, tt.tanggal_kerja`, [awal, akhir, ids])
          : Promise.resolve({ rows: [] }),
        ids.length
          ? q('SELECT tim_id, target, catatan, total_bonus FROM laporan_kpi_target WHERE bulan = $1 AND tim_id = ANY($2)', [bulan, ids])
          : Promise.resolve({ rows: [] }),
      ]);

      const poinPerArtist = new Map();
      for (const p of poinR.rows) {
        const m = poinPerArtist.get(p.tim_id) || {};
        m[p.tanggal] = p.poin;
        poinPerArtist.set(p.tim_id, m);
      }
      const targetPerArtist = new Map(targetR.rows.map(t => [t.tim_id, t]));

      const hariList = [];
      for (let d = 1; d <= jumlahHari; d++) {
        const tgl = `${bulan}-${String(d).padStart(2, '0')}`;
        const dow = new Date(tahun, bln - 1, d).getDay();
        hariList.push({ tanggal: tgl, namaHari: HARI[dow], minggu: dow === 0 });
      }

      const artists = artisR.rows.map(a => {
        const poinHarian = poinPerArtist.get(a.id) || {};
        const total = Object.values(poinHarian).reduce((s, n) => s + n, 0);
        const t = targetPerArtist.get(a.id);
        return {
          tim_id: a.id, nama: a.nama,
          target: t?.target ?? null, catatan: t?.catatan ?? null, total_bonus: t?.total_bonus ?? null,
          poinHarian, total,
        };
      });

      res.json({ success: true, data: { bulan, hariList, artists } });
    } catch (e) { gagal(res, 'get', e, 'Gagal memuat laporan KPI'); }
  });

  // ── PUT /laporan-kpi/target — atur target/catatan/bonus satu artist satu bulan (upsert, field parsial) ──
  router.put('/laporan-kpi/target', ...akses, async (req, res) => {
    try {
      const timId = bilangan(req.body.tim_id);
      const bulan = String(req.body.bulan || '');
      if (!Number.isInteger(timId)) return res.status(400).json({ error: 'Artist tidak valid' });
      if (!BULAN_RE.test(bulan)) return res.status(400).json({ error: 'Format bulan harus YYYY-MM' });

      const kolom = {};
      if ('target' in req.body) {
        if (req.body.target === null || req.body.target === '') kolom.target = null;
        else {
          const t = bilangan(req.body.target);
          if (!Number.isInteger(t) || t < 0 || t > 9999) return res.status(400).json({ error: 'Target harus bilangan bulat 0–9999' });
          kolom.target = t;
        }
      }
      if ('catatan' in req.body) {
        const c = String(req.body.catatan ?? '').trim();
        kolom.catatan = c ? c.slice(0, 300) : null;
      }
      if ('total_bonus' in req.body) {
        if (req.body.total_bonus === null || req.body.total_bonus === '') kolom.total_bonus = null;
        else {
          const b = bilangan(req.body.total_bonus);
          if (!Number.isInteger(b) || b < 0) return res.status(400).json({ error: 'Total Bonus harus bilangan bulat ≥ 0' });
          kolom.total_bonus = b;
        }
      }
      const kunci = Object.keys(kolom);
      if (!kunci.length) return res.status(400).json({ error: 'Tidak ada perubahan' });

      const timAda = await q('SELECT 1 FROM tim WHERE id = $1', [timId]);
      if (!timAda.rows.length) return res.status(404).json({ error: 'Artist tidak ditemukan' });

      // Pastikan baris ada dulu (upsert kosong), baru UPDATE kolom yang benar-benar dikirim — supaya field
      // lain yang tak disertakan di body TIDAK ikut ter-reset (pola sama seperti PATCH tugas Papan Timeline).
      await q('INSERT INTO laporan_kpi_target (tim_id, bulan) VALUES ($1,$2) ON CONFLICT (tim_id, bulan) DO NOTHING', [timId, bulan]);
      const set = kunci.map((k, i) => `${k} = $${i + 1}`);
      const params = kunci.map(k => kolom[k]);
      params.push(timId, bulan);
      await q(`UPDATE laporan_kpi_target SET ${set.join(', ')}, updated_at = NOW() WHERE tim_id = $${params.length - 1} AND bulan = $${params.length}`, params);
      res.json({ success: true });
    } catch (e) { gagal(res, 'ubah target', e, 'Gagal menyimpan target'); }
  });

  // ── POST /laporan-kpi/target/salin — salin target+catatan (BUKAN total_bonus) dari satu bulan ke bulan lain ──
  router.post('/laporan-kpi/target/salin', ...akses, async (req, res) => {
    try {
      const dari = String(req.body.dari || '');
      const ke = String(req.body.ke || '');
      if (!BULAN_RE.test(dari) || !BULAN_RE.test(ke)) return res.status(400).json({ error: 'Format bulan harus YYYY-MM' });
      if (dari === ke) return res.status(400).json({ error: 'Bulan asal dan tujuan tidak boleh sama' });
      const r = await q(
        `INSERT INTO laporan_kpi_target (tim_id, bulan, target, catatan)
         SELECT tim_id, $2, target, catatan FROM laporan_kpi_target WHERE bulan = $1
         ON CONFLICT (tim_id, bulan) DO NOTHING RETURNING tim_id`, [dari, ke]);
      res.json({ success: true, data: { disalin: r.rowCount } });
    } catch (e) { gagal(res, 'salin target', e, 'Gagal menyalin target'); }
  });
};
