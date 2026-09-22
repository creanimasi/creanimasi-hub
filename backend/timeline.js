// ══════════════════════════════════════════════════════════════════════════════
// PAPAN TIMELINE — pengganti spreadsheet manual: Grup (mis. "Internal", "Freelance 3D")
// > Orang (pita warna) > Tugas (klien/deskripsi + poin opsional + urgensi 1-4 opsional).
// Didaftarkan dari hub.js: require('./timeline')(router, { hubPool, authMiddleware, requirePageAccess })
// Satu kunci akses ('timeline') untuk baca DAN tulis — halaman ini memang untuk admin/PM yang mengelola
// papan bersama, bukan model baca-tulis terpisah seperti modul RPG.
// ══════════════════════════════════════════════════════════════════════════════

const BATAS = { GRUP_NAMA: 60, ORANG_NAMA: 100, DESKRIPSI: 300, POIN_MAKS: 999, URGENSI_MIN: 1, URGENSI_MAX: 4 };
const WARNA_RE = /^#[0-9a-fA-F]{6}$/;

module.exports = function registerTimeline(router, { hubPool, authMiddleware, requirePageAccess }) {
  const q = (text, params) => hubPool.query(text, params);
  const akses = [authMiddleware, requirePageAccess('timeline')];
  const bilangan = (v) => (typeof v === 'number' || (typeof v === 'string' && /^-?\d+$/.test(v.trim()))) ? Number(v) : NaN;

  const ready = (async () => {
    try {
      await q(`CREATE TABLE IF NOT EXISTS timeline_grup (
        id SERIAL PRIMARY KEY, nama VARCHAR(${BATAS.GRUP_NAMA}) NOT NULL UNIQUE,
        urutan INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`);
      await q(`CREATE TABLE IF NOT EXISTS timeline_orang (
        id SERIAL PRIMARY KEY, grup_id INTEGER NOT NULL REFERENCES timeline_grup(id) ON DELETE CASCADE,
        nama VARCHAR(${BATAS.ORANG_NAMA}) NOT NULL, tim_id INTEGER REFERENCES tim(id) ON DELETE SET NULL,
        warna VARCHAR(7), urutan INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`);
      await q(`CREATE TABLE IF NOT EXISTS timeline_tugas (
        id SERIAL PRIMARY KEY, orang_id INTEGER NOT NULL REFERENCES timeline_orang(id) ON DELETE CASCADE,
        deskripsi VARCHAR(${BATAS.DESKRIPSI}) NOT NULL,
        poin INTEGER CHECK (poin IS NULL OR (poin BETWEEN 0 AND ${BATAS.POIN_MAKS})),
        urgensi SMALLINT CHECK (urgensi IS NULL OR (urgensi BETWEEN ${BATAS.URGENSI_MIN} AND ${BATAS.URGENSI_MAX})),
        urutan INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
      await q('CREATE INDEX IF NOT EXISTS idx_timeline_orang_grup ON timeline_orang (grup_id)');
      await q('CREATE INDEX IF NOT EXISTS idx_timeline_tugas_orang ON timeline_tugas (orang_id)');
      // Dua grup awal sesuai referensi spreadsheet — HANYA saat tabel masih kosong sama sekali (instalasi baru).
      // Bukan ON CONFLICT per baris: kalau begitu, menghapus SATU grup bawaan (mis. admin sudah tak butuh
      // "Freelance 3D") akan membuatnya "hidup lagi" tiap server restart selama grup lain masih ada.
      await q(`INSERT INTO timeline_grup (nama, urutan)
               SELECT * FROM (VALUES ('Internal', 0), ('Freelance 3D', 1)) AS v(nama, urutan)
               WHERE NOT EXISTS (SELECT 1 FROM timeline_grup)`);
    } catch (e) { console.error('Migration Timeline startup:', e.message); }
  })();
  router.use('/timeline', async (req, res, next) => { await ready; next(); });

  const gagal = (res, tag, e, pesan) => { console.error(`[Timeline] ${tag}:`, e.message); res.status(500).json({ error: pesan }); };
  const teks = (v, maks) => { const t = String(v ?? '').trim(); return t ? t.slice(0, maks) : null; };

  // ── GET /timeline — seluruh papan, bersarang & terurut ──────────────────────
  router.get('/timeline', ...akses, async (req, res) => {
    try {
      const [grupR, orangR, tugasR] = await Promise.all([
        q('SELECT id, nama, urutan FROM timeline_grup ORDER BY urutan, id'),
        q(`SELECT o.id, o.grup_id, o.nama, o.tim_id, o.warna, o.urutan, t.divisi AS tim_divisi
           FROM timeline_orang o LEFT JOIN tim t ON t.id = o.tim_id ORDER BY o.urutan, o.id`),
        q(`SELECT id, orang_id, deskripsi, poin, urgensi, urutan FROM timeline_tugas ORDER BY urutan, id`),
      ]);
      const tugasPerOrang = new Map();
      for (const t of tugasR.rows) { const arr = tugasPerOrang.get(t.orang_id) || []; arr.push(t); tugasPerOrang.set(t.orang_id, arr); }
      const orangPerGrup = new Map();
      for (const o of orangR.rows) {
        const arr = orangPerGrup.get(o.grup_id) || []; arr.push({ ...o, tugas: tugasPerOrang.get(o.id) || [] }); orangPerGrup.set(o.grup_id, arr);
      }
      const data = grupR.rows.map(g => ({ ...g, orang: orangPerGrup.get(g.id) || [] }));
      res.json({ success: true, data });
    } catch (e) { gagal(res, 'get', e, 'Gagal memuat papan timeline'); }
  });

  // ── Grup ──────────────────────────────────────────────────────────────────
  router.post('/timeline/grup', ...akses, async (req, res) => {
    try {
      const nama = teks(req.body.nama, BATAS.GRUP_NAMA);
      if (!nama) return res.status(400).json({ error: 'Nama grup wajib diisi' });
      const urutan = (await q('SELECT COALESCE(MAX(urutan), -1) + 1 AS n FROM timeline_grup')).rows[0].n;
      const r = await q('INSERT INTO timeline_grup (nama, urutan) VALUES ($1,$2) RETURNING id', [nama, urutan]);
      res.json({ success: true, data: { id: r.rows[0].id } });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Nama grup sudah dipakai' });
      gagal(res, 'buat grup', e, 'Gagal membuat grup');
    }
  });

  router.patch('/timeline/grup/:id', ...akses, async (req, res) => {
    try {
      const nama = teks(req.body.nama, BATAS.GRUP_NAMA);
      if (!nama) return res.status(400).json({ error: 'Nama grup wajib diisi' });
      const r = await q('UPDATE timeline_grup SET nama = $1 WHERE id = $2 RETURNING id', [nama, parseInt(req.params.id, 10)]);
      if (!r.rows.length) return res.status(404).json({ error: 'Grup tidak ditemukan' });
      res.json({ success: true });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Nama grup sudah dipakai' });
      gagal(res, 'ubah grup', e, 'Gagal mengubah grup');
    }
  });

  router.delete('/timeline/grup/:id', ...akses, async (req, res) => {
    try {
      const r = await q('DELETE FROM timeline_grup WHERE id = $1 RETURNING id', [parseInt(req.params.id, 10)]);
      if (!r.rows.length) return res.status(404).json({ error: 'Grup tidak ditemukan' });
      res.json({ success: true });
    } catch (e) { gagal(res, 'hapus grup', e, 'Gagal menghapus grup'); }
  });

  router.post('/timeline/grup/:id/pindah', ...akses, async (req, res) => {
    try { await pindahUrutan('timeline_grup', null, parseInt(req.params.id, 10), req.body.arah, res); }
    catch (e) { gagal(res, 'pindah grup', e, 'Gagal memindah urutan grup'); }
  });

  // ── Orang ─────────────────────────────────────────────────────────────────
  router.post('/timeline/orang', ...akses, async (req, res) => {
    try {
      const grupId = bilangan(req.body.grup_id);
      const nama = teks(req.body.nama, BATAS.ORANG_NAMA);
      if (!Number.isInteger(grupId)) return res.status(400).json({ error: 'Grup tidak valid' });
      if (!nama) return res.status(400).json({ error: 'Nama wajib diisi' });
      const timId = req.body.tim_id != null && req.body.tim_id !== '' ? bilangan(req.body.tim_id) : null;
      if (timId !== null && !Number.isInteger(timId)) return res.status(400).json({ error: 'Tautan anggota tidak valid' });
      const warna = req.body.warna ? String(req.body.warna).trim() : null;
      if (warna && !WARNA_RE.test(warna)) return res.status(400).json({ error: 'Warna harus kode hex (mis. #FDE68A)' });
      const g = await q('SELECT 1 FROM timeline_grup WHERE id = $1', [grupId]);
      if (!g.rows.length) return res.status(404).json({ error: 'Grup tidak ditemukan' });
      const urutan = (await q('SELECT COALESCE(MAX(urutan), -1) + 1 AS n FROM timeline_orang WHERE grup_id = $1', [grupId])).rows[0].n;
      const r = await q('INSERT INTO timeline_orang (grup_id, nama, tim_id, warna, urutan) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [grupId, nama, timId, warna, urutan]);
      res.json({ success: true, data: { id: r.rows[0].id } });
    } catch (e) { gagal(res, 'tambah orang', e, 'Gagal menambah anggota'); }
  });

  router.patch('/timeline/orang/:id', ...akses, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const set = [], params = [];
      if ('nama' in req.body) {
        const nama = teks(req.body.nama, BATAS.ORANG_NAMA);
        if (!nama) return res.status(400).json({ error: 'Nama wajib diisi' });
        params.push(nama); set.push(`nama = $${params.length}`);
      }
      if ('tim_id' in req.body) {
        const timId = req.body.tim_id != null && req.body.tim_id !== '' ? bilangan(req.body.tim_id) : null;
        if (timId !== null && !Number.isInteger(timId)) return res.status(400).json({ error: 'Tautan anggota tidak valid' });
        params.push(timId); set.push(`tim_id = $${params.length}`);
      }
      if ('warna' in req.body) {
        const warna = req.body.warna ? String(req.body.warna).trim() : null;
        if (warna && !WARNA_RE.test(warna)) return res.status(400).json({ error: 'Warna harus kode hex (mis. #FDE68A)' });
        params.push(warna); set.push(`warna = $${params.length}`);
      }
      if (!set.length) return res.status(400).json({ error: 'Tidak ada perubahan' });
      params.push(id);
      const r = await q(`UPDATE timeline_orang SET ${set.join(', ')} WHERE id = $${params.length} RETURNING id`, params);
      if (!r.rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
      res.json({ success: true });
    } catch (e) { gagal(res, 'ubah orang', e, 'Gagal mengubah anggota'); }
  });

  router.delete('/timeline/orang/:id', ...akses, async (req, res) => {
    try {
      const r = await q('DELETE FROM timeline_orang WHERE id = $1 RETURNING id', [parseInt(req.params.id, 10)]);
      if (!r.rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
      res.json({ success: true });
    } catch (e) { gagal(res, 'hapus orang', e, 'Gagal menghapus anggota'); }
  });

  router.post('/timeline/orang/:id/pindah', ...akses, async (req, res) => {
    try {
      const o = await q('SELECT grup_id FROM timeline_orang WHERE id = $1', [parseInt(req.params.id, 10)]);
      if (!o.rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
      await pindahUrutan('timeline_orang', 'grup_id', parseInt(req.params.id, 10), req.body.arah, res, o.rows[0].grup_id);
    } catch (e) { gagal(res, 'pindah orang', e, 'Gagal memindah urutan anggota'); }
  });

  // ── Tugas ─────────────────────────────────────────────────────────────────
  const validasiTugas = (b, wajibDeskripsi) => {
    const out = {};
    if (wajibDeskripsi || 'deskripsi' in b) {
      const deskripsi = teks(b.deskripsi, BATAS.DESKRIPSI);
      if (!deskripsi) return { error: 'Deskripsi tugas wajib diisi' };
      out.deskripsi = deskripsi;
    }
    if ('poin' in b) {
      if (b.poin === null || b.poin === '') out.poin = null;
      else {
        const poin = bilangan(b.poin);
        if (!Number.isInteger(poin) || poin < 0 || poin > BATAS.POIN_MAKS) return { error: `Poin harus bilangan bulat 0–${BATAS.POIN_MAKS}` };
        out.poin = poin;
      }
    }
    if ('urgensi' in b) {
      if (b.urgensi === null || b.urgensi === '') out.urgensi = null;
      else {
        const urgensi = bilangan(b.urgensi);
        if (!Number.isInteger(urgensi) || urgensi < BATAS.URGENSI_MIN || urgensi > BATAS.URGENSI_MAX) return { error: `Urgensi harus bilangan bulat ${BATAS.URGENSI_MIN}–${BATAS.URGENSI_MAX}` };
        out.urgensi = urgensi;
      }
    }
    return { out };
  };

  router.post('/timeline/tugas', ...akses, async (req, res) => {
    try {
      const orangId = bilangan(req.body.orang_id);
      if (!Number.isInteger(orangId)) return res.status(400).json({ error: 'Anggota tidak valid' });
      const { out, error } = validasiTugas(req.body, true);
      if (error) return res.status(400).json({ error });
      const o = await q('SELECT 1 FROM timeline_orang WHERE id = $1', [orangId]);
      if (!o.rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
      const urutan = (await q('SELECT COALESCE(MAX(urutan), -1) + 1 AS n FROM timeline_tugas WHERE orang_id = $1', [orangId])).rows[0].n;
      const r = await q('INSERT INTO timeline_tugas (orang_id, deskripsi, poin, urgensi, urutan) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [orangId, out.deskripsi, out.poin ?? null, out.urgensi ?? null, urutan]);
      res.json({ success: true, data: { id: r.rows[0].id } });
    } catch (e) { gagal(res, 'tambah tugas', e, 'Gagal menambah tugas'); }
  });

  router.patch('/timeline/tugas/:id', ...akses, async (req, res) => {
    try {
      const { out, error } = validasiTugas(req.body, false);
      if (error) return res.status(400).json({ error });
      const kunci = Object.keys(out);
      if (!kunci.length) return res.status(400).json({ error: 'Tidak ada perubahan' });
      const set = kunci.map((k, i) => `${k} = $${i + 1}`);
      const params = kunci.map(k => out[k]);
      params.push(parseInt(req.params.id, 10));
      const r = await q(`UPDATE timeline_tugas SET ${set.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id`, params);
      if (!r.rows.length) return res.status(404).json({ error: 'Tugas tidak ditemukan' });
      res.json({ success: true });
    } catch (e) { gagal(res, 'ubah tugas', e, 'Gagal mengubah tugas'); }
  });

  router.delete('/timeline/tugas/:id', ...akses, async (req, res) => {
    try {
      const r = await q('DELETE FROM timeline_tugas WHERE id = $1 RETURNING id', [parseInt(req.params.id, 10)]);
      if (!r.rows.length) return res.status(404).json({ error: 'Tugas tidak ditemukan' });
      res.json({ success: true });
    } catch (e) { gagal(res, 'hapus tugas', e, 'Gagal menghapus tugas'); }
  });

  router.post('/timeline/tugas/:id/pindah', ...akses, async (req, res) => {
    try {
      const t = await q('SELECT orang_id FROM timeline_tugas WHERE id = $1', [parseInt(req.params.id, 10)]);
      if (!t.rows.length) return res.status(404).json({ error: 'Tugas tidak ditemukan' });
      await pindahUrutan('timeline_tugas', 'orang_id', parseInt(req.params.id, 10), req.body.arah, res, t.rows[0].orang_id);
    } catch (e) { gagal(res, 'pindah tugas', e, 'Gagal memindah urutan tugas'); }
  });

  // Tukar `urutan` dengan tetangga (atas = urutan lebih kecil sebelumnya, bawah = lebih besar berikutnya),
  // dibatasi ke ruang lingkup yang sama (lingkupKolom/lingkupNilai — mis. tugas hanya ditukar dalam orang_id yang sama).
  async function pindahUrutan(tabel, lingkupKolom, id, arah, res, lingkupNilaiLuar) {
    if (!['atas', 'bawah'].includes(arah)) { res.status(400).json({ error: 'Arah harus "atas" atau "bawah"' }); return; }
    const client = await hubPool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(`SELECT id, urutan${lingkupKolom ? `, ${lingkupKolom}` : ''} FROM ${tabel} WHERE id = $1 FOR UPDATE`, [id]);
      if (!cur.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Data tidak ditemukan' }); }
      const row = cur.rows[0];
      const lingkupNilai = lingkupKolom ? row[lingkupKolom] : lingkupNilaiLuar;
      const lingkupSql = lingkupKolom ? `AND ${lingkupKolom} = $2` : '';
      const tetangga = await client.query(
        `SELECT id, urutan FROM ${tabel} WHERE urutan ${arah === 'atas' ? '<' : '>'} $1 ${lingkupSql}
         ORDER BY urutan ${arah === 'atas' ? 'DESC' : 'ASC'} LIMIT 1 FOR UPDATE`,
        lingkupKolom ? [row.urutan, lingkupNilai] : [row.urutan]);
      if (!tetangga.rows.length) { await client.query('ROLLBACK'); return res.json({ success: true, data: { berubah: false } }); }
      await client.query(`UPDATE ${tabel} SET urutan = $1 WHERE id = $2`, [tetangga.rows[0].urutan, row.id]);
      await client.query(`UPDATE ${tabel} SET urutan = $1 WHERE id = $2`, [row.urutan, tetangga.rows[0].id]);
      await client.query('COMMIT');
      res.json({ success: true, data: { berubah: true } });
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
    finally { client.release(); }
  }
};
