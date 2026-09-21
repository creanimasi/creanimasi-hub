// ══════════════════════════════════════════════════════════════════════════════
// TARGET POIN PRODUKSI — poin dari quest yang disetujui, dievaluasi tiap periode (28 bulan lalu → 27 bulan ini).
// Dipakai oleh rpg.js:  const target = require('./rpg_target')({ q, hubPool, CONFIG, TZ, hariIniWib });
//                       target.migrasi();  target.metrikTarget(timId);  target.registerRoutes(router, deps)
// Angka aturan ada di CONFIG.TARGET (rpg.js). Poin = XP quest saat disetujui (ledger), BUKAN XP otomatis
// dari laporan/jurnal/absensi — supaya target mengukur hasil produksi, bukan sekadar rajin lapor.
// ══════════════════════════════════════════════════════════════════════════════

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pad = (n) => String(n).padStart(2, '0');
const hariAntara = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
const KODE_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

// ── Helper murni (diekspor untuk pengujian) ─────────────────────────────────────
function periodeKode(kode, tutup) {
  const m = KODE_RE.exec(kode);
  if (!m) return null;
  const y = Number(m[1]), b = Number(m[2]);
  const py = b === 1 ? y - 1 : y, pb = b === 1 ? 12 : b - 1;
  const mulai = `${py}-${pad(pb)}-${pad(tutup + 1)}`, akhir = `${y}-${pad(b)}-${pad(tutup)}`;
  return {
    kode, mulai, akhir, label: `${BULAN[b - 1]} ${y}`,
    rentang: `${tutup + 1} ${BULAN_PENDEK[pb - 1]} – ${tutup} ${BULAN_PENDEK[b - 1]} ${y}`,
    hariTotal: hariAntara(mulai, akhir) + 1,
  };
}
// Periode yang memuat tanggal WIB tertentu: tanggal > tutup masuk periode bulan berikutnya.
function periodeDari(tglWib, tutup) {
  let y = Number(tglWib.slice(0, 4)), b = Number(tglWib.slice(5, 7));
  if (Number(tglWib.slice(8, 10)) > tutup) { b += 1; if (b > 12) { b = 1; y += 1; } }
  return periodeKode(`${y}-${pad(b)}`, tutup);
}
function periodeSebelum(p, tutup) {
  const y = Number(p.kode.slice(0, 4)), b = Number(p.kode.slice(5, 7));
  return periodeKode(b === 1 ? `${y - 1}-12` : `${y}-${pad(b - 1)}`, tutup);
}
const levelKey = (s) => {
  const t = String(s || '').toLowerCase();
  if (/magang|probation/.test(t)) return 'magang';
  if (/junior/.test(t)) return 'junior';
  if (/senior/.test(t)) return 'senior';
  return null;
};
// Target tertentu untuk level → bila tak ada, jatuh ke "semua level" ('*') divisi itu → bila tak ada, null.
const cariTarget = (peta, divisi, lvKey) => peta.get(`${divisi}|${lvKey}`) ?? peta.get(`${divisi}|*`) ?? null;

function statusDari(poin, target, dikecualikan) {
  if (dikecualikan) return 'dikecualikan';
  if (target == null) return 'tanpa_target';
  return poin >= target ? 'tercapai' : 'belum';
}
// Rank berdasarkan persen (lalu poin) hanya untuk yang punya target; seri = peringkat sama.
function beriPeringkat(rows) {
  const ikut = rows.filter(r => r.status === 'tercapai' || r.status === 'belum')
    .sort((a, b) => b.persen - a.persen || b.poin - a.poin || a.nama.localeCompare(b.nama));
  let rank = 0, prev = null;
  ikut.forEach((r, i) => { if (!prev || r.persen !== prev.persen) rank = i + 1; r.peringkat = rank; prev = r; });
  rows.forEach(r => { if (r.peringkat === undefined) r.peringkat = null; });
  const urut = { tercapai: 0, belum: 0, tanpa_target: 1, dikecualikan: 2 };
  return rows.sort((a, b) => (urut[a.status] - urut[b.status]) || ((a.peringkat ?? 1e9) - (b.peringkat ?? 1e9)) || (b.poin - a.poin) || a.nama.localeCompare(b.nama));
}
// Rentetan periode berturut-turut yang tercapai (abaikan periode dikecualikan / tanpa target).
function rentetanTercapai(hasil) {
  const urut = hasil.filter(h => h.status === 'tercapai' || h.status === 'belum').sort((a, b) => (a.kode < b.kode ? -1 : 1));
  let maks = 0, cur = 0;
  for (const h of urut) { cur = h.status === 'tercapai' ? cur + 1 : 0; if (cur > maks) maks = cur; }
  return maks;
}

module.exports = function buatTarget({ q, hubPool, CONFIG, TZ, hariIniWib }) {
  const C = CONFIG.TARGET;
  const tutup = C.TGL_TUTUP;
  const meta = { periodeDari: (t) => periodeDari(t, tutup), periodeKode: (k) => periodeKode(k, tutup) };

  async function migrasi() {
    await q(`CREATE TABLE IF NOT EXISTS rpg_target_poin (
      divisi VARCHAR(40) NOT NULL, level VARCHAR(10) NOT NULL CHECK (level IN ('*','magang','junior','senior')),
      target INTEGER NOT NULL CHECK (target > 0 AND target <= ${C.TARGET_MAKS}),
      updated_by VARCHAR(100), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (divisi, level))`);
    await q(`CREATE TABLE IF NOT EXISTS rpg_target_override (
      periode VARCHAR(7) NOT NULL, tim_id INTEGER NOT NULL REFERENCES tim(id) ON DELETE CASCADE,
      target INTEGER CHECK (target IS NULL OR (target > 0 AND target <= ${C.TARGET_MAKS})),
      dikecualikan BOOLEAN NOT NULL DEFAULT FALSE, catatan VARCHAR(200),
      updated_by VARCHAR(100), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (periode, tim_id))`);
    await q(`CREATE TABLE IF NOT EXISTS rpg_periode (
      kode VARCHAR(7) PRIMARY KEY, status VARCHAR(10) NOT NULL DEFAULT 'terbuka' CHECK (status IN ('terbuka','dikunci')),
      tahan_kunci BOOLEAN NOT NULL DEFAULT FALSE, dikunci_pada TIMESTAMPTZ, dikunci_oleh VARCHAR(100))`);
    await q(`CREATE TABLE IF NOT EXISTS rpg_periode_hasil (
      kode VARCHAR(7) NOT NULL REFERENCES rpg_periode(kode) ON DELETE CASCADE,
      tim_id INTEGER NOT NULL REFERENCES tim(id) ON DELETE CASCADE,
      nama VARCHAR(100) NOT NULL, divisi VARCHAR(40) NOT NULL, level VARCHAR(10),
      target INTEGER, poin INTEGER NOT NULL DEFAULT 0, jumlah_quest INTEGER NOT NULL DEFAULT 0,
      persen INTEGER, status VARCHAR(14) NOT NULL, peringkat INTEGER, catatan VARCHAR(200),
      PRIMARY KEY (kode, tim_id))`);
  }

  // Poin periode: assignment DISETUJUI yang DIAJUKAN dalam rentang tanggal (WIB). Diajukan-tepat-waktu tidak
  // dirugikan bila admin telat meninjau. XP diambil dari ledger saat persetujuan (edit XP quest belakangan
  // tidak mengubah hasil lama); jatuh ke xp quest bila baris ledger tak ada. Hanya quest buatan admin
  // (proyek/sekali) — quest Harian otomatis bukan baris tabel, jadi tidak ikut.
  const TGL_WIB = `(COALESCE(a.diajukan_pada, a.ditinjau_pada) AT TIME ZONE ${TZ})::date`;
  const poinPerTim = (exec, p) => exec(`
    SELECT a.tim_id, COUNT(*)::int AS n, COALESCE(SUM(COALESCE(e.xp, qs.xp)), 0)::int AS poin
    FROM rpg_quest_assignment a JOIN rpg_quest qs ON qs.id = a.quest_id
    LEFT JOIN rpg_xp_event e ON e.tim_id = a.tim_id AND e.sumber = 'quest' AND e.ref_key = 'q:' || a.id
    WHERE a.status = 'disetujui' AND ${TGL_WIB} BETWEEN $1::date AND $2::date
    GROUP BY a.tim_id`, [p.mulai, p.akhir]);
  const menungguPerTim = (exec, p) => exec(`
    SELECT a.tim_id, COUNT(*)::int AS n, COALESCE(SUM(qs.xp), 0)::int AS poin
    FROM rpg_quest_assignment a JOIN rpg_quest qs ON qs.id = a.quest_id
    WHERE a.status = 'diajukan' AND (a.diajukan_pada AT TIME ZONE ${TZ})::date BETWEEN $1::date AND $2::date
    GROUP BY a.tim_id`, [p.mulai, p.akhir]);

  const petaTarget = async (exec = q) => {
    const r = await exec('SELECT divisi, level, target FROM rpg_target_poin');
    return new Map(r.rows.map(x => [`${x.divisi}|${x.level}`, x.target]));
  };

  // Hitung hasil (langsung dari data) seluruh anggota aktif divisi produksi untuk satu periode.
  async function hitungRekap(p, exec = q) {
    const [timR, poinR, tungguR, peta, ovR] = await Promise.all([
      exec('SELECT id, nama, divisi, level FROM tim WHERE aktif = TRUE AND divisi = ANY($1) ORDER BY nama', [C.DIVISI]),
      poinPerTim(exec, p), menungguPerTim(exec, p), petaTarget(exec),
      exec('SELECT tim_id, target, dikecualikan, catatan FROM rpg_target_override WHERE periode = $1', [p.kode]),
    ]);
    const poinMap = new Map(poinR.rows.map(x => [x.tim_id, x])), tungguMap = new Map(tungguR.rows.map(x => [x.tim_id, x]));
    const ovMap = new Map(ovR.rows.map(x => [x.tim_id, x]));
    const rows = timR.rows.map(t => {
      const lv = levelKey(t.level), ov = ovMap.get(t.id) || null;
      const targetDasar = cariTarget(peta, t.divisi, lv);
      const target = ov && ov.target != null ? ov.target : targetDasar;
      const dikecualikan = !!(ov && ov.dikecualikan);
      const poin = (poinMap.get(t.id) || {}).poin || 0;
      const status = statusDari(poin, target, dikecualikan);
      const menunggu = tungguMap.get(t.id) || { n: 0, poin: 0 };
      return {
        _id: t.id, nama: t.nama, divisi: t.divisi, level: lv, target, targetDasar, poin,
        jumlahQuest: (poinMap.get(t.id) || {}).n || 0, status, persen: target ? Math.round((100 * poin) / target) : null,
        menunggu: { n: menunggu.n, poin: menunggu.poin },
        override: ov ? { target: ov.target, dikecualikan: ov.dikecualikan, catatan: ov.catatan } : null,
      };
    });
    return beriPeringkat(rows);
  }

  // Ambil hasil periode: snapshot bila dikunci, selain itu hitung langsung ("sementara").
  async function ambilRekap(p) {
    const st = (await q('SELECT status, tahan_kunci, dikunci_pada, dikunci_oleh FROM rpg_periode WHERE kode = $1', [p.kode])).rows[0];
    const hariIni = hariIniWib();
    if (st && st.status === 'dikunci') {
      const r = await q(`SELECT tim_id AS _id, nama, divisi, level, target, poin, jumlah_quest, persen, status, peringkat, catatan
                         FROM rpg_periode_hasil WHERE kode = $1`, [p.kode]);
      const rows = r.rows.map(x => ({ ...x, jumlahQuest: x.jumlah_quest, targetDasar: x.target, menunggu: { n: 0, poin: 0 }, override: null }));
      const urut = { tercapai: 0, belum: 0, tanpa_target: 1, dikecualikan: 2 };
      rows.sort((a, b) => (urut[a.status] - urut[b.status]) || ((a.peringkat ?? 1e9) - (b.peringkat ?? 1e9)) || (b.poin - a.poin) || a.nama.localeCompare(b.nama));
      return { periode: p, fase: 'final', dikunci: true, dikunciPada: st.dikunci_pada, dikunciOleh: st.dikunci_oleh, tahanKunci: false, rows };
    }
    const fase = hariIni <= p.akhir ? 'berjalan' : 'menunggu_kunci';
    return { periode: p, fase, dikunci: false, dikunciPada: null, dikunciOleh: null, tahanKunci: !!(st && st.tahan_kunci), rows: await hitungRekap(p) };
  }

  // Tambahkan info kemajuan (jalur, sisa hari, kebutuhan/hari) untuk periode yang sedang berjalan.
  function hiasKemajuan(rek) {
    const p = rek.periode, hariIni = hariIniWib();
    const sisaHari = rek.fase === 'berjalan' ? hariAntara(hariIni, p.akhir) + 1 : 0;
    const hariBerjalan = Math.max(0, Math.min(p.hariTotal, hariAntara(p.mulai, hariIni) + 1));
    rek.waktu = { sisaHari, hariBerjalan, hariTotal: p.hariTotal };
    rek.rows.forEach(r => {
      r.jalur = null; r.butuhPerHari = null;
      if (rek.fase === 'berjalan' && r.status === 'belum' && r.target) {
        r.jalur = r.poin / r.target >= hariBerjalan / p.hariTotal ? 'sesuai' : 'tertinggal';
        r.butuhPerHari = sisaHari > 0 ? Math.ceil((r.target - r.poin) / sisaHari) : null;
      }
    });
    return rek;
  }
  function ringkasan(rows) {
    const punya = rows.filter(r => r.status === 'tercapai' || r.status === 'belum');
    const target = punya.reduce((s, r) => s + r.target, 0), poin = punya.reduce((s, r) => s + r.poin, 0);
    return {
      peserta: punya.length, tercapai: punya.filter(r => r.status === 'tercapai').length, belum: punya.filter(r => r.status === 'belum').length,
      tanpaTarget: rows.filter(r => r.status === 'tanpa_target').length, dikecualikan: rows.filter(r => r.status === 'dikecualikan').length,
      poinTim: poin, targetTim: target, persenTim: target ? Math.round((100 * poin) / target) : null,
    };
  }
  const publikRow = ({ _id, ...r }) => r;

  // ── Kunci / buka periode ───────────────────────────────────────────────────
  const hooks = { sesudahKunci: null, sesudahBuka: null };
  async function kunci(p, oleh, { otomatis = false } = {}) {
    const client = await hubPool.connect();
    let rows;
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO rpg_periode (kode) VALUES ($1) ON CONFLICT (kode) DO NOTHING', [p.kode]);
      const cur = (await client.query('SELECT status, tahan_kunci FROM rpg_periode WHERE kode = $1 FOR UPDATE', [p.kode])).rows[0];
      if (cur.status === 'dikunci') { await client.query('ROLLBACK'); return { ok: false, alasan: 'sudah' }; }
      if (otomatis && cur.tahan_kunci) { await client.query('ROLLBACK'); return { ok: false, alasan: 'ditahan' }; }
      rows = await hitungRekap(p, (t, prm) => client.query(t, prm));
      await client.query('DELETE FROM rpg_periode_hasil WHERE kode = $1', [p.kode]);
      for (const r of rows) {
        await client.query(
          `INSERT INTO rpg_periode_hasil (kode, tim_id, nama, divisi, level, target, poin, jumlah_quest, persen, status, peringkat, catatan)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [p.kode, r._id, r.nama, r.divisi, r.level, r.target, r.poin, r.jumlahQuest, r.persen, r.status, r.peringkat, r.override && r.override.catatan]);
      }
      await client.query(`UPDATE rpg_periode SET status = 'dikunci', tahan_kunci = FALSE, dikunci_pada = NOW(), dikunci_oleh = $2 WHERE kode = $1`, [p.kode, oleh]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
    finally { client.release(); }
    try { if (hooks.sesudahKunci) await hooks.sesudahKunci(rows); } catch (e) { console.error('[RPG] sesudah kunci:', e.message); }
    return { ok: true, rows };
  }
  async function buka(p) {
    const client = await hubPool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(`UPDATE rpg_periode SET status = 'terbuka', tahan_kunci = TRUE, dikunci_pada = NULL, dikunci_oleh = NULL
                                    WHERE kode = $1 AND status = 'dikunci' RETURNING kode`, [p.kode]);
      if (!r.rows.length) { await client.query('ROLLBACK'); return false; }
      await client.query('DELETE FROM rpg_periode_hasil WHERE kode = $1', [p.kode]);
      // Lencana target yang mungkin lahir dari hasil periode ini dicabut; yang masih memenuhi syarat dari periode
      // lain dikembalikan lewat evaluasi ulang (hook) segera setelah commit.
      await client.query(`DELETE FROM rpg_achievement_unlock WHERE code IN (SELECT code FROM rpg_achievement WHERE syarat_tipe IN ('target_hit','target_120','target_beruntun','bintang'))`);
      await client.query('COMMIT');
      return true;
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
    finally { client.release(); }
  }
  // Kunci otomatis: periode yang sudah lewat KUNCI_OTOMATIS_HARI hari (atau lebih) setelah tanggal tutup, belum dikunci, tidak ditahan.
  let lastAuto = 0;
  async function kunciOtomatis(paksa = false) {
    if (!paksa && Date.now() - lastAuto < 10 * 60 * 1000) return [];
    lastAuto = Date.now();
    const hariIni = hariIniWib(), dikunci = [];
    let p = periodeSebelum(periodeDari(hariIni, tutup), tutup);
    for (let i = 0; i < C.LOOKBACK_PERIODE && p.akhir >= CONFIG.RPG_MULAI; i++, p = periodeSebelum(p, tutup)) {
      if (hariAntara(p.akhir, hariIni) < C.KUNCI_OTOMATIS_HARI) continue;
      try { const r = await kunci(p, 'sistem', { otomatis: true }); if (r.ok) dikunci.push(p.kode); }
      catch (e) { console.error(`[RPG] kunci otomatis ${p.kode} gagal:`, e.message); }
    }
    return dikunci;
  }

  // ── Metrik untuk achievement (dari snapshot periode yang sudah dikunci) ─────
  async function metrikTarget(timId) {
    const r = await q(`SELECT kode, status, persen, peringkat FROM rpg_periode_hasil WHERE tim_id = $1`, [timId]);
    const h = r.rows;
    return {
      target_hit: h.filter(x => x.status === 'tercapai').length,
      target_120: h.filter(x => x.status === 'tercapai' && x.persen >= 120).length,
      target_beruntun: rentetanTercapai(h),
      bintang: h.filter(x => x.status === 'tercapai' && x.peringkat === 1).length,
    };
  }

  // ── Data anggota (dipakai endpoint anggota DAN halaman Pantau → identik) ────
  async function daftarKontribusi(timId, p) {
    const r = await q(`
      SELECT a.id, qs.judul, qs.tipe, a.status, to_char(${TGL_WIB}, 'YYYY-MM-DD') AS tanggal,
             CASE WHEN a.status = 'disetujui' THEN COALESCE(e.xp, qs.xp) ELSE qs.xp END AS poin
      FROM rpg_quest_assignment a JOIN rpg_quest qs ON qs.id = a.quest_id
      LEFT JOIN rpg_xp_event e ON e.tim_id = a.tim_id AND e.sumber = 'quest' AND e.ref_key = 'q:' || a.id
      WHERE a.tim_id = $1 AND a.status IN ('disetujui', 'diajukan') AND ${TGL_WIB} BETWEEN $2::date AND $3::date
      ORDER BY (a.status = 'diajukan') DESC, COALESCE(a.diajukan_pada, a.ditinjau_pada) DESC`, [timId, p.mulai, p.akhir]);
    return r.rows.map(x => ({ id: x.id, judul: x.judul, tipe: x.tipe, status: x.status, tanggal: x.tanggal, poin: x.poin }));
  }
  async function dataTargetAnggota(tim) {
    const hariIni = hariIniWib(), now = periodeDari(hariIni, tutup), prev = periodeSebelum(now, tutup);
    const rekNow = hiasKemajuan(await ambilRekap(now));
    const saya = rekNow.rows.find(r => r._id === tim.id);
    if (!saya) return { ikut: false };
    const [rekPrev, kontribusi, riwayat] = await Promise.all([
      prev.akhir >= CONFIG.RPG_MULAI ? ambilRekap(prev) : null,
      daftarKontribusi(tim.id, now),
      q(`SELECT kode, target, poin, persen, status, peringkat FROM rpg_periode_hasil WHERE tim_id = $1 ORDER BY kode DESC LIMIT ${C.RIWAYAT}`, [tim.id]),
    ]);
    const sayaPrev = rekPrev && !rekPrev.dikunci ? rekPrev.rows.find(r => r._id === tim.id) : null;
    return {
      ikut: true,
      periode: { ...now, fase: rekNow.fase, ...rekNow.waktu },
      saya: publikRow(saya),
      kontribusi,
      sebelumnya: sayaPrev ? { periode: { ...prev, fase: rekPrev.fase }, saya: publikRow(sayaPrev), kontribusi: await daftarKontribusi(tim.id, prev) } : null,
      riwayat: riwayat.rows.map(x => ({ ...x, label: periodeKode(x.kode, tutup).label })),
    };
  }
  // Ringkasan periode berjalan per anggota (untuk header kolom Kanban admin).
  async function ringkasSekarang() {
    const rek = hiasKemajuan(await ambilRekap(periodeDari(hariIniWib(), tutup)));
    return { periode: { kode: rek.periode.kode, label: rek.periode.label, rentang: rek.periode.rentang, ...rek.waktu },
      peta: new Map(rek.rows.map(r => [r._id, { poin: r.poin, target: r.target, persen: r.persen, status: r.status, jalur: r.jalur }])) };
  }

  return { migrasi, metrikTarget, dataTargetAnggota, ringkasSekarang, kunciOtomatis, meta, hooks,
    registerRoutes(router, d) { registerRoutes(router, d); } };

  // ══════════════════════ ENDPOINT ══════════════════════
  function registerRoutes(router, { authMiddleware, requirePageAccess, salahSatuAkses, timUntukUser, evaluasiAchievement }) {
    const adminOnly = [authMiddleware, requirePageAccess('rpg-admin')];
    const lihatRekap = [authMiddleware, salahSatuAkses('rpg-admin', 'rpg-pantau')];
    const gagal = (res, tag, e, pesan) => { console.error(`[RPG] ${tag}:`, e.message); res.status(500).json({ error: pesan }); };
    const bilangan = (v) => (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v.trim()))) ? Number(v) : NaN;

    hooks.sesudahBuka = async () => {
      const r = await q('SELECT DISTINCT tim_id, nama FROM rpg_periode_hasil');
      for (const x of r.rows) await evaluasiAchievement({ id: x.tim_id, nama: x.nama });
    };
    hooks.sesudahKunci = async (rows) => {
      for (const r of rows) await evaluasiAchievement({ id: r._id, nama: r.nama }); // achievement target
    };

    // Periode yang boleh diminta: tidak di masa depan dan tidak sebelum RPG dimulai.
    const periodeSah = (kodeMentah) => {
      const hariIni = hariIniWib(), now = periodeDari(hariIni, tutup);
      const kode = kodeMentah === 'sebelumnya' ? periodeSebelum(now, tutup).kode : (!kodeMentah || kodeMentah === 'sekarang' ? now.kode : kodeMentah);
      const p = periodeKode(kode, tutup);
      if (!p || p.mulai > hariIni || p.akhir < CONFIG.RPG_MULAI) return null;
      return p;
    };

    // ── Anggota ──
    router.get('/rpg/target', authMiddleware, requirePageAccess('rpg-quests'), async (req, res) => {
      try {
        const tim = await timUntukUser(req.user.id);
        if (!tim) return res.status(404).json({ error: 'Akun ini belum terhubung ke data anggota tim.' });
        await kunciOtomatis();
        res.json({ success: true, data: await dataTargetAnggota(tim) });
      } catch (e) { gagal(res, 'target', e, 'Gagal memuat target'); }
    });

    // Papan terbuka penuh: semua anggota produksi, urut persen pencapaian. ?periode=sekarang|sebelumnya|YYYY-MM
    router.get('/rpg/target/papan', authMiddleware, requirePageAccess('rpg-guild'), async (req, res) => {
      try {
        await kunciOtomatis();
        const p = periodeSah(req.query.periode);
        if (!p && req.query.periode === 'sebelumnya') return res.json({ success: true, data: null });
        if (!p) return res.status(400).json({ error: 'Periode tidak valid' });
        const tim = await timUntukUser(req.user.id);
        const rek = hiasKemajuan(await ambilRekap(p));
        const now = periodeDari(hariIniWib(), tutup);
        const daftar = (await q('SELECT kode FROM rpg_periode WHERE status = $1 ORDER BY kode DESC LIMIT 12', ['dikunci'])).rows.map(x => x.kode);
        const kodeSet = new Set([now.kode, periodeSebelum(now, tutup).kode, ...daftar]);
        res.json({ success: true, data: {
          periode: { ...p, fase: rek.fase, ...rek.waktu }, sementara: !rek.dikunci, ringkasan: ringkasan(rek.rows),
          rows: rek.rows.map(r => ({ ...publikRow(r), isYou: !!tim && r._id === tim.id })),
          daftarPeriode: [...kodeSet].filter(k => periodeKode(k, tutup).akhir >= CONFIG.RPG_MULAI).sort().reverse()
            .map(k => ({ kode: k, label: periodeKode(k, tutup).label })),
        } });
      } catch (e) { gagal(res, 'papan target', e, 'Gagal memuat papan target'); }
    });

    // ── Admin: pengaturan target ──
    router.get('/rpg/admin/target', ...adminOnly, async (req, res) => {
      try {
        const r = await q('SELECT divisi, level, target FROM rpg_target_poin ORDER BY divisi, level');
        const now = periodeDari(hariIniWib(), tutup);
        res.json({ success: true, data: { divisi: C.DIVISI, level: C.LEVEL, target: r.rows, periodeSekarang: now, tutup } });
      } catch (e) { gagal(res, 'admin target', e, 'Gagal memuat pengaturan target'); }
    });
    // Set / hapus satu sel matriks. target null = hapus.
    router.put('/rpg/admin/target', ...adminOnly, async (req, res) => {
      try {
        const { divisi, level } = req.body || {};
        if (!C.DIVISI.includes(divisi)) return res.status(400).json({ error: 'Divisi tidak valid' });
        if (!['*', ...C.LEVEL.map(l => l.key)].includes(level)) return res.status(400).json({ error: 'Level tidak valid' });
        if (req.body.target === null) {
          await q('DELETE FROM rpg_target_poin WHERE divisi = $1 AND level = $2', [divisi, level]);
          return res.json({ success: true });
        }
        const t = bilangan(req.body.target);
        if (!Number.isInteger(t) || t < 1 || t > C.TARGET_MAKS) return res.status(400).json({ error: `Target harus bilangan bulat 1–${C.TARGET_MAKS}` });
        await q(`INSERT INTO rpg_target_poin (divisi, level, target, updated_by) VALUES ($1,$2,$3,$4)
                 ON CONFLICT (divisi, level) DO UPDATE SET target = EXCLUDED.target, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
          [divisi, level, t, req.user.nama]);
        res.json({ success: true });
      } catch (e) { gagal(res, 'set target', e, 'Gagal menyimpan target'); }
    });

    // Rekap satu periode (admin & pantau, hanya-baca).
    router.get('/rpg/admin/target/rekap', ...lihatRekap, async (req, res) => {
      try {
        await kunciOtomatis();
        const p = periodeSah(req.query.periode);
        if (!p && req.query.periode === 'sebelumnya') return res.json({ success: true, data: null }); // belum ada periode sebelumnya (sebelum RPG dimulai)
        if (!p) return res.status(400).json({ error: 'Periode tidak valid' });
        const rek = hiasKemajuan(await ambilRekap(p));
        const hariIni = hariIniWib(), now = periodeDari(hariIni, tutup);
        const daftar = (await q('SELECT kode FROM rpg_periode WHERE status = $1 ORDER BY kode DESC LIMIT 12', ['dikunci'])).rows.map(x => x.kode);
        const kodeSet = new Set([now.kode, periodeSebelum(now, tutup).kode, ...daftar]);
        res.json({ success: true, data: {
          periode: { ...p, ...rek.waktu }, fase: rek.fase, dikunci: rek.dikunci, dikunciPada: rek.dikunciPada, dikunciOleh: rek.dikunciOleh,
          tahanKunci: rek.tahanKunci, bisaDikunci: !rek.dikunci && hariIni > p.akhir,
          kunciOtomatisPada: rek.dikunci ? null : new Date(new Date(p.akhir + 'T00:00:00Z').getTime() + C.KUNCI_OTOMATIS_HARI * 86400000).toISOString().slice(0, 10),
          ringkasan: ringkasan(rek.rows), rows: rek.rows.map(publikRow).map((r, i) => ({ ...r, timId: rek.rows[i]._id })),
          daftarPeriode: [...kodeSet].filter(k => periodeKode(k, tutup).akhir >= CONFIG.RPG_MULAI).sort().reverse()
            .map(k => ({ kode: k, label: periodeKode(k, tutup).label })),
        } });
      } catch (e) { gagal(res, 'rekap target', e, 'Gagal memuat rekap'); }
    });

    // Penyesuaian per orang untuk satu periode (cuti / anggota baru). Hanya periode yang belum dikunci.
    router.put('/rpg/admin/target/override', ...adminOnly, async (req, res) => {
      try {
        const p = periodeSah(req.body.periode);
        if (!p || !KODE_RE.test(String(req.body.periode))) return res.status(400).json({ error: 'Periode tidak valid' });
        const st = (await q('SELECT status FROM rpg_periode WHERE kode = $1', [p.kode])).rows[0];
        if (st && st.status === 'dikunci') return res.status(409).json({ error: 'Periode sudah dikunci' });
        const timId = bilangan(req.body.tim_id);
        if (!Number.isInteger(timId) || timId > 2147483647) return res.status(400).json({ error: 'ID anggota tidak valid' });
        const t = await q('SELECT 1 FROM tim WHERE id = $1 AND aktif = TRUE AND divisi = ANY($2)', [timId, C.DIVISI]);
        if (!t.rows.length) return res.status(404).json({ error: 'Anggota produksi tidak ditemukan' });
        const dikecualikan = req.body.dikecualikan === true;
        let target = null;
        if (req.body.target !== null && req.body.target !== undefined) {
          target = bilangan(req.body.target);
          if (!Number.isInteger(target) || target < 1 || target > C.TARGET_MAKS) return res.status(400).json({ error: `Target harus bilangan bulat 1–${C.TARGET_MAKS}` });
        }
        const catatan = String(req.body.catatan || '').trim().slice(0, 200) || null;
        if (target === null && !dikecualikan) {
          await q('DELETE FROM rpg_target_override WHERE periode = $1 AND tim_id = $2', [p.kode, timId]);
          return res.json({ success: true });
        }
        await q(`INSERT INTO rpg_target_override (periode, tim_id, target, dikecualikan, catatan, updated_by) VALUES ($1,$2,$3,$4,$5,$6)
                 ON CONFLICT (periode, tim_id) DO UPDATE SET target = EXCLUDED.target, dikecualikan = EXCLUDED.dikecualikan,
                   catatan = EXCLUDED.catatan, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
          [p.kode, timId, target, dikecualikan, catatan, req.user.nama]);
        res.json({ success: true });
      } catch (e) { gagal(res, 'override target', e, 'Gagal menyimpan penyesuaian'); }
    });

    router.post('/rpg/admin/target/periode/:kode/kunci', ...adminOnly, async (req, res) => {
      try {
        const p = periodeSah(req.params.kode);
        if (!p || !KODE_RE.test(req.params.kode)) return res.status(400).json({ error: 'Periode tidak valid' });
        if (hariIniWib() <= p.akhir) return res.status(409).json({ error: 'Periode belum berakhir' });
        const r = await kunci(p, req.user.nama);
        if (!r.ok) return res.status(409).json({ error: 'Periode sudah dikunci' });
        res.json({ success: true });
      } catch (e) { gagal(res, 'kunci periode', e, 'Gagal mengunci periode'); }
    });
    // Buka kembali (mis. salah kunci): hasil dihapus, kunci otomatis ditahan sampai admin mengunci lagi.
    router.post('/rpg/admin/target/periode/:kode/buka', ...adminOnly, async (req, res) => {
      try {
        const p = periodeSah(req.params.kode);
        if (!p || !KODE_RE.test(req.params.kode)) return res.status(400).json({ error: 'Periode tidak valid' });
        if (!(await buka(p))) return res.status(409).json({ error: 'Periode ini belum dikunci' });
        try { if (hooks.sesudahBuka) await hooks.sesudahBuka(); } catch (e) { console.error('[RPG] sesudah buka:', e.message); }
        res.json({ success: true });
      } catch (e) { gagal(res, 'buka periode', e, 'Gagal membuka periode'); }
    });

    // Cron harian 00:10 WIB (aman bila node-cron tak terpasang; pembacaan endpoint juga memicu kunci otomatis).
    try {
      const cron = require('node-cron');
      cron.schedule('10 0 * * *', async () => {
        try { const k = await kunciOtomatis(true); if (k.length) console.log('[RPG Target] Dikunci otomatis:', k.join(', ')); }
        catch (e) { console.error('[RPG Target] Cron gagal:', e.message); }
      }, { timezone: 'Asia/Jakarta' });
    } catch { /* node-cron belum terpasang — pemicu lazy tetap jalan */ }
  }
};

module.exports.helpers = { periodeDari, periodeKode, periodeSebelum, levelKey, cariTarget, statusDari, beriPeringkat, rentetanTercapai, hariAntara };
