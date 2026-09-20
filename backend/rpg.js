// ══════════════════════════════════════════════════════════════════════════════
// MODUL RPG / GAMIFIKASI — XP, level, quest, achievement, leaderboard
// Didaftarkan dari hub.js: require('./rpg')(router, { hubPool, authMiddleware, requirePageAccess, getPageAccessList })
// Semua angka aturan (XP, kurva level, dst.) ada di CONFIG di bawah — satu tempat untuk disetel.
// ══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Aktivitas sebelum tanggal ini tidak dihitung (bukan seluruh riwayat lama).
  RPG_MULAI: '2026-09-01',
  XP: { laporan_harian: 15, jurnal: 40, absensi_hadir: 10, absensi_terlambat: 5, friday_win: 30 },
  // level = floor(sqrt(xp / LEVEL_DIV)) + 1  → ambang XP total untuk level L = LEVEL_DIV × (L-1)²
  LEVEL_DIV: 40,
  LEVEL_MAX: 20,
  STAGES: [ // urut naik; dipakai berdasarkan level minimum
    { min: 1,  nama: 'Pemula' },
    { min: 5,  nama: 'Staf' },
    { min: 10, nama: 'Staf Senior' },
    { min: 15, nama: 'Ahli' },
    { min: 20, nama: 'Master' },
  ],
  // Title dari achievement tertinggi yang terbuka (urutan prioritas). tim.tipe TIDAK dipakai.
  TITLE_PRIORITAS: [
    ['maxlevel', 'Legenda'], ['topguild', 'Juara Guild'], ['goldcollab', 'Kolaborator Emas'],
    ['questmaster', 'Quest Master'], ['streak30', 'Konsisten'], ['firstquest', 'Petualang'],
  ],
  TITLE_DEFAULT: 'Pendatang Baru',
  STREAK_LOOKBACK_HARI: 90,
  SYNC_MIN_INTERVAL_MS: 60 * 1000,
  IKON_QUEST: ['sync', 'board', 'shield', 'badge', 'target'],
};

const ACHIEVEMENTS_SEED = [
  ['onboarding',  'Onboarding Tuntas',       'Menyelesaikan onboarding (diberikan admin).',        'manual',      0,  1],
  ['firstquest',  'Quest Pertama',           'Quest pertamamu disetujui admin.',                    'quest_count', 1,  2],
  ['streak30',    '30 Hari Beruntun Lapor',  'Laporan harian 30 hari kerja berturut-turut.',        'streak',      30, 3],
  ['promo',       'Naik ke Staf Senior',     'Mencapai career stage Staf Senior (Level 10).',       'level',       10, 4],
  ['questmaster', 'Quest Master',            'Menyelesaikan 50 quest.',                             'quest_count', 50, 5],
  ['goldcollab',  'Kolaborator Emas',        'Menerima 10 Friday Win dari rekan.',                  'friday_wins', 10, 6],
  ['topguild',    'Juara Guild Mingguan',    'Peringkat 1 XP mingguan pada minggu yang sudah lewat.', 'topguild',  1,  7],
  ['maxlevel',    'Level Maksimal',          'Mencapai level maksimal.',                            'level',       20, 8],
];

const TZ = "'Asia/Jakarta'";

// ── Helper murni ─────────────────────────────────────────────────────────────
const levelDariXp = (xp) => Math.min(CONFIG.LEVEL_MAX, Math.floor(Math.sqrt(Math.max(0, xp) / CONFIG.LEVEL_DIV)) + 1);
const xpMenujuLevelBerikut = (level, xp) => (level >= CONFIG.LEVEL_MAX ? xp : CONFIG.LEVEL_DIV * level * level);
const stageDariLevel = (level) => [...CONFIG.STAGES].reverse().find(s => level >= s.min).nama;
const rarityDariLevel = (level) => Math.min(5, Math.ceil(level / 4));

const hariIniWib = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const geser = (str, n) => new Date(new Date(str + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
const hariMinggu = (str) => new Date(str + 'T00:00:00Z').getUTCDay(); // 0=Minggu … 6=Sabtu
const hariKerja = (str) => { const d = hariMinggu(str); return d >= 1 && d <= 5; };
const hariKerjaSebelum = (str) => { let s = geser(str, -1); while (!hariKerja(s)) s = geser(s, -1); return s; };

// Streak = hari kerja berturut-turut berlaporan; laporan hari ini boleh belum masuk.
function hitungStreak(tanggalSet, hariIni) {
  let cur = hariIni;
  while (!hariKerja(cur)) cur = geser(cur, -1);
  if (!tanggalSet.has(cur) && cur === hariIni) cur = hariKerjaSebelum(cur);
  let streak = 0;
  while (tanggalSet.has(cur) && streak < 400) { streak++; cur = hariKerjaSebelum(cur); }
  return streak;
}

// % hari kerja dalam 30 hari terakhir yang punya laporan harian
function hitungKonsistensi(tanggalSet, hariIni) {
  let n = 0, r = 0;
  for (let i = 0; i < 30; i++) {
    const d = geser(hariIni, -i);
    if (!hariKerja(d)) continue;
    n++; if (tanggalSet.has(d)) r++;
  }
  return n ? Math.min(100, Math.round((100 * r) / n)) : 0;
}

function labelTenggat(tenggat, hariIni) {
  if (!tenggat) return { dueLabel: 'Tanpa tenggat', warn: false };
  const selisih = Math.round((new Date(tenggat + 'T00:00:00Z') - new Date(hariIni + 'T00:00:00Z')) / 86400000);
  if (selisih < 0) return { dueLabel: `Terlambat ${-selisih} hari`, warn: true };
  if (selisih === 0) return { dueLabel: 'Tenggat hari ini', warn: true };
  if (selisih === 1) return { dueLabel: 'Tenggat besok', warn: true };
  return { dueLabel: `${selisih} hari lagi`, warn: false };
}

function labelSelesai(tanggalIso, hariIni) {
  const d = new Date(new Date(tanggalIso).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const selisih = Math.round((new Date(hariIni + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000);
  if (selisih <= 0) return 'Selesai hari ini';
  if (selisih === 1) return 'Selesai kemarin';
  return `Selesai ${selisih} hari lalu`;
}

module.exports = function registerRpg(router, { hubPool, authMiddleware, requirePageAccess, getPageAccessList }) {
  const q = (text, params) => hubPool.query(text, params);

  // ── Migrasi (idempoten) ────────────────────────────────────────────────────
  const ready = (async () => {
    try {
      await q(`CREATE TABLE IF NOT EXISTS rpg_xp_event (
        id BIGSERIAL PRIMARY KEY,
        tim_id INTEGER NOT NULL REFERENCES tim(id) ON DELETE CASCADE,
        sumber VARCHAR(30) NOT NULL, ref_key VARCHAR(100) NOT NULL, xp INTEGER NOT NULL,
        keterangan TEXT, terjadi_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (tim_id, sumber, ref_key))`);
      await q('CREATE INDEX IF NOT EXISTS idx_rpg_xp_tim ON rpg_xp_event (tim_id)');
      await q('CREATE INDEX IF NOT EXISTS idx_rpg_xp_waktu ON rpg_xp_event (terjadi_pada)');
      await q(`CREATE TABLE IF NOT EXISTS rpg_quest (
        id SERIAL PRIMARY KEY, judul VARCHAR(150) NOT NULL, deskripsi TEXT,
        tipe VARCHAR(10) NOT NULL CHECK (tipe IN ('proyek','sekali')),
        xp INTEGER NOT NULL CHECK (xp > 0 AND xp <= 1000), tenggat DATE,
        ikon VARCHAR(10) NOT NULL DEFAULT 'target', aktif BOOLEAN NOT NULL DEFAULT TRUE,
        dibuat_oleh VARCHAR(100), created_at TIMESTAMPTZ DEFAULT NOW())`);
      await q(`CREATE TABLE IF NOT EXISTS rpg_quest_assignment (
        id SERIAL PRIMARY KEY,
        quest_id INTEGER NOT NULL REFERENCES rpg_quest(id) ON DELETE CASCADE,
        tim_id INTEGER NOT NULL REFERENCES tim(id) ON DELETE CASCADE,
        status VARCHAR(12) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','diajukan','disetujui','ditolak')),
        progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
        catatan_anggota TEXT, catatan_review TEXT, diajukan_pada TIMESTAMPTZ,
        ditinjau_oleh VARCHAR(100), ditinjau_pada TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (quest_id, tim_id))`);
      await q(`CREATE TABLE IF NOT EXISTS rpg_achievement (
        code VARCHAR(30) PRIMARY KEY, label VARCHAR(80) NOT NULL, deskripsi TEXT,
        syarat_tipe VARCHAR(20) NOT NULL, syarat_nilai INTEGER NOT NULL DEFAULT 0, urutan INTEGER NOT NULL DEFAULT 0)`);
      await q(`CREATE TABLE IF NOT EXISTS rpg_achievement_unlock (
        tim_id INTEGER NOT NULL REFERENCES tim(id) ON DELETE CASCADE,
        code VARCHAR(30) NOT NULL REFERENCES rpg_achievement(code) ON DELETE CASCADE,
        unlocked_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (tim_id, code))`);
      for (const [code, label, deskripsi, tipe, nilai, urutan] of ACHIEVEMENTS_SEED) {
        await q(`INSERT INTO rpg_achievement (code, label, deskripsi, syarat_tipe, syarat_nilai, urutan)
                 VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`, [code, label, deskripsi, tipe, nilai, urutan]);
      }
    } catch (e) { console.error('Migration RPG startup:', e.message); }
  })();
  router.use('/rpg', async (req, res, next) => { await ready; next(); });

  // ── Sinkronisasi XP otomatis dari data aktivitas terverifikasi ─────────────
  // Idempoten (UNIQUE tim_id+sumber+ref_key), dibatasi 1× per menit.
  // Centang mandiri (workshop, modul) sengaja TIDAK dihitung — anggota bisa mengubahnya sendiri.
  let lastSync = 0, syncing = null;
  const TIM_JOIN = (kolom) => `JOIN tim t ON LOWER(TRIM(t.nama)) = LOWER(TRIM(${kolom}))`;
  const SUMBER = [
    ['laporan_harian', `
      INSERT INTO rpg_xp_event (tim_id, sumber, ref_key, xp, keterangan, terjadi_pada)
      SELECT t.id, 'laporan_harian', 'lh:' || d.tanggal::text, $2::int, 'Laporan harian', (d.tanggal::timestamp AT TIME ZONE ${TZ})
      FROM (SELECT DISTINCT nama, tanggal FROM laporan_harian WHERE tanggal >= $1::date) d
      ${TIM_JOIN('d.nama')}
      ON CONFLICT (tim_id, sumber, ref_key) DO NOTHING`, [CONFIG.XP.laporan_harian]],
    ['jurnal', `
      INSERT INTO rpg_xp_event (tim_id, sumber, ref_key, xp, keterangan, terjadi_pada)
      SELECT DISTINCT ON (t.id, to_char(j.tanggal_jurnal, 'IYYY-IW'))
             t.id, 'jurnal', 'jm:' || to_char(j.tanggal_jurnal, 'IYYY-IW'), $2::int, 'Jurnal mingguan',
             (j.tanggal_jurnal::timestamp AT TIME ZONE ${TZ})
      FROM jurnal_mingguan j ${TIM_JOIN('j.nama')}
      WHERE j.tanggal_jurnal >= $1::date
      ORDER BY t.id, to_char(j.tanggal_jurnal, 'IYYY-IW'), j.tanggal_jurnal
      ON CONFLICT (tim_id, sumber, ref_key) DO NOTHING`, [CONFIG.XP.jurnal]],
    ['absensi', `
      INSERT INTO rpg_xp_event (tim_id, sumber, ref_key, xp, keterangan, terjadi_pada)
      SELECT t.id, 'absensi', 'ab:' || s.id,
             CASE k.status WHEN 'hadir' THEN $2::int ELSE $3::int END,
             'Kehadiran: ' || s.label, (s.tanggal::timestamp AT TIME ZONE ${TZ})
      FROM absensi_kehadiran k JOIN absensi_sesi s ON s.id = k.sesi_id ${TIM_JOIN('k.nama')}
      WHERE s.tanggal >= $1::date AND k.status IN ('hadir', 'terlambat')
      ON CONFLICT (tim_id, sumber, ref_key) DO NOTHING`, [CONFIG.XP.absensi_hadir, CONFIG.XP.absensi_terlambat]],
    ['friday_win', `
      INSERT INTO rpg_xp_event (tim_id, sumber, ref_key, xp, keterangan, terjadi_pada)
      SELECT t.id, 'friday_win', 'fw:' || f.id, $2::int, 'Friday Win: ' || left(f.headline, 60), (f.tanggal::timestamp AT TIME ZONE ${TZ})
      FROM friday_win f ${TIM_JOIN('f.penerima')}
      WHERE f.tanggal >= $1::date AND f.penerima IS NOT NULL
      ON CONFLICT (tim_id, sumber, ref_key) DO NOTHING`, [CONFIG.XP.friday_win]],
  ];

  async function syncXp(paksa = false) {
    if (!paksa && Date.now() - lastSync < CONFIG.SYNC_MIN_INTERVAL_MS) return;
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        for (const [nama, sql, param] of SUMBER) {
          try {
            await q(sql, [CONFIG.RPG_MULAI, ...param]);
          } catch (e) { console.error(`[RPG] sync ${nama} gagal:`, e.message); }
        }
        lastSync = Date.now();
      } finally { syncing = null; }
    })();
    return syncing;
  }

  // ── Query bersama ──────────────────────────────────────────────────────────
  async function timUntukUser(userId) {
    const r = await q(
      `SELECT t.id, t.nama, t.divisi, t.entitas, t.skill, t.komunikasi, t.kriteria, t.aktif
       FROM hub_users u JOIN tim t ON t.id = u.tim_id OR (u.tim_id IS NULL AND t.nama = u.nama)
       WHERE u.id = $1 LIMIT 1`, [userId]);
    return r.rows[0] || null;
  }

  const xpTotal = async (timId, sampai) => {
    const r = await q(
      `SELECT COALESCE(SUM(xp), 0)::int AS xp FROM rpg_xp_event WHERE tim_id = $1 ${sampai ? 'AND terjadi_pada <= $2' : ''}`,
      sampai ? [timId, sampai] : [timId]);
    return r.rows[0].xp;
  };

  async function tanggalLaporan(nama) {
    const r = await q(
      `SELECT DISTINCT to_char(tanggal, 'YYYY-MM-DD') AS d FROM laporan_harian
       WHERE LOWER(TRIM(nama)) = LOWER(TRIM($1)) AND tanggal >= (CURRENT_DATE - $2::int)`,
      [nama, CONFIG.STREAK_LOOKBACK_HARI]);
    return new Set(r.rows.map(x => x.d));
  }

  const PERIODE_SQL = {
    weekly: `AND e.terjadi_pada AT TIME ZONE ${TZ} >= date_trunc('week', now() AT TIME ZONE ${TZ})`,
    season: `AND e.terjadi_pada AT TIME ZONE ${TZ} >= date_trunc('quarter', now() AT TIME ZONE ${TZ})`,
    all: '',
  };

  async function leaderboard({ period = 'weekly', divisi = null, timIdSaya = null }) {
    const filterPeriode = PERIODE_SQL[period] ?? PERIODE_SQL.weekly;
    const params = []; let filterDivisi = '';
    if (divisi) { params.push(divisi); filterDivisi = `AND t.divisi = $${params.length}`; }
    const r = await q(`
      SELECT t.id, t.nama, t.divisi, t.entitas,
             COALESCE(SUM(e.xp), 0)::int AS xp,
             RANK() OVER (ORDER BY COALESCE(SUM(e.xp), 0) DESC) AS rank
      FROM tim t LEFT JOIN rpg_xp_event e ON e.tim_id = t.id ${filterPeriode}
      WHERE t.aktif = TRUE ${filterDivisi}
      GROUP BY t.id
      ORDER BY xp DESC, t.nama`, params);
    return r.rows.map(x => ({
      rank: Number(x.rank), nama: x.nama, divisi: x.divisi, unit: 'Unit ' + (x.entitas || 'Creanimasi Studio'),
      xp: x.xp, isYou: timIdSaya != null && x.id === timIdSaya, _id: x.id,
    }));
  }
  const publik = (rows) => rows.map(({ _id, ...r }) => r);

  // ── Achievement ────────────────────────────────────────────────────────────
  async function metrik(tim) {
    const [xp, quest, wins, top, tanggal] = await Promise.all([
      xpTotal(tim.id),
      q(`SELECT COUNT(*)::int AS n FROM rpg_quest_assignment WHERE tim_id = $1 AND status = 'disetujui'`, [tim.id]),
      q(`SELECT COUNT(*)::int AS n FROM rpg_xp_event WHERE tim_id = $1 AND sumber = 'friday_win'`, [tim.id]),
      q(`WITH w AS (
           SELECT tim_id, date_trunc('week', terjadi_pada AT TIME ZONE ${TZ}) AS wk, SUM(xp) AS xp FROM rpg_xp_event GROUP BY 1, 2),
         r AS (
           SELECT tim_id, xp, RANK() OVER (PARTITION BY wk ORDER BY xp DESC) AS rk FROM w
           WHERE wk < date_trunc('week', now() AT TIME ZONE ${TZ}))
         SELECT COUNT(*)::int AS n FROM r WHERE tim_id = $1 AND rk = 1 AND xp > 0`, [tim.id]),
      tanggalLaporan(tim.nama),
    ]);
    const level = levelDariXp(xp);
    return { xp, level, quest: quest.rows[0].n, friday_wins: wins.rows[0].n, topguild: top.rows[0].n, streak: hitungStreak(tanggal, hariIniWib()), tanggal };
  }

  const NILAI_METRIK = { quest_count: 'quest', streak: 'streak', level: 'level', friday_wins: 'friday_wins', topguild: 'topguild' };

  // Evaluasi + simpan unlock baru; kembalikan daftar lengkap untuk UI.
  async function evaluasiAchievement(tim, m = null) {
    m = m || await metrik(tim);
    const [defs, unlocked] = await Promise.all([
      q('SELECT * FROM rpg_achievement ORDER BY urutan'),
      q('SELECT code, unlocked_at FROM rpg_achievement_unlock WHERE tim_id = $1', [tim.id]),
    ]);
    const sudah = new Map(unlocked.rows.map(u => [u.code, u.unlocked_at]));
    for (const d of defs.rows) {
      if (sudah.has(d.code) || d.syarat_tipe === 'manual') continue;
      const nilai = m[NILAI_METRIK[d.syarat_tipe]];
      if (nilai != null && nilai >= d.syarat_nilai) {
        await q('INSERT INTO rpg_achievement_unlock (tim_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING', [tim.id, d.code]);
        sudah.set(d.code, new Date());
      }
    }
    return defs.rows.map(d => {
      const locked = !sudah.has(d.code);
      const nilai = m[NILAI_METRIK[d.syarat_tipe]];
      let progressLabel;
      if (locked) {
        if (d.syarat_tipe === 'manual') progressLabel = 'Diberikan admin';
        else if (d.syarat_tipe === 'topguild') progressLabel = 'Terkunci';
        else progressLabel = `${Math.min(nilai ?? 0, d.syarat_nilai)}/${d.syarat_nilai}`;
      }
      return { code: d.code, label: d.label, deskripsi: d.deskripsi, locked, ...(progressLabel ? { progressLabel } : {}) };
    });
  }

  const titleDariAchievement = (daftar) => {
    const terbuka = new Set(daftar.filter(a => !a.locked).map(a => a.code));
    const hit = CONFIG.TITLE_PRIORITAS.find(([code]) => terbuka.has(code));
    return hit ? hit[1] : CONFIG.TITLE_DEFAULT;
  };

  // ── Quest anggota ──────────────────────────────────────────────────────────
  async function dataQuest(tim) {
    const hariIni = hariIniWib();
    const [asg, tanggal] = await Promise.all([
      q(`SELECT a.id, a.status, a.progress_pct, a.catatan_review, a.ditinjau_pada, qs.id AS quest_id, qs.judul, qs.deskripsi,
                qs.tipe, qs.xp, qs.ikon, to_char(qs.tenggat, 'YYYY-MM-DD') AS tenggat
         FROM rpg_quest_assignment a JOIN rpg_quest qs ON qs.id = a.quest_id
         WHERE a.tim_id = $1 AND (qs.aktif = TRUE OR a.status = 'disetujui')
         ORDER BY qs.tenggat NULLS LAST, a.id`, [tim.id]),
      tanggalLaporan(tim.nama),
    ]);
    const streak = hitungStreak(tanggal, hariIni);
    const sudahHariIni = tanggal.has(hariIni);
    const bentuk = (a) => {
      let due;
      if (a.status === 'diajukan') due = { dueLabel: 'Menunggu persetujuan admin', warn: false };
      else if (a.status === 'ditolak') due = { dueLabel: 'Ditolak' + (a.catatan_review ? ': ' + a.catatan_review : ' — perbaiki lalu ajukan lagi'), warn: true };
      else due = labelTenggat(a.tenggat, hariIni);
      return { id: a.id, type: a.ikon, title: a.judul, deskripsi: a.deskripsi, xpReward: a.xp, status: a.status, progressPct: a.progress_pct, reviewedAt: a.ditinjau_pada, ...due };
    };
    const aktif = asg.rows.filter(a => a.status !== 'disetujui');
    const harian = {
      id: 'harian-lapor', type: 'sync', title: 'Lapor Progres Harian', xpReward: CONFIG.XP.laporan_harian, status: sudahHariIni ? 'selesai' : 'aktif',
      dueLabel: `Quest harian · Streak ${streak} hari` + (sudahHariIni ? ' · sudah lapor hari ini' : ''), warn: false, otomatis: true,
    };
    const kelompok = (tipe) => aktif.filter(a => a.tipe === tipe).map(bentuk);
    const selesaiMingguIni = await q(
      `SELECT COUNT(*)::int AS n FROM rpg_quest_assignment WHERE tim_id = $1 AND status = 'disetujui'
         AND ditinjau_pada AT TIME ZONE ${TZ} >= date_trunc('week', now() AT TIME ZONE ${TZ})`, [tim.id]);
    const senin = geser(hariIni, -((hariMinggu(hariIni) + 6) % 7));
    let laporMingguIni = 0;
    for (let d = senin; d <= hariIni; d = geser(d, 1)) if (hariKerja(d) && tanggal.has(d)) laporMingguIni++;
    return {
      summary: {
        activeCount: aktif.length + (sudahHariIni ? 0 : 1),
        xpPending: aktif.reduce((s, a) => s + a.xp, 0) + (sudahHariIni ? 0 : CONFIG.XP.laporan_harian),
        completedThisWeek: selesaiMingguIni.rows[0].n + laporMingguIni,
      },
      groups: [
        { id: 'harian', label: 'HARIAN', tag: '— berulang tiap hari', quests: [harian] },
        { id: 'proyek', label: 'PROYEK', tag: '— tugas klien & produksi', quests: kelompok('proyek') },
        { id: 'sekali', label: 'SEKALI', tag: '— tantangan satu kali', quests: kelompok('sekali') },
      ],
      completed: asg.rows.filter(a => a.status === 'disetujui')
        .sort((a, b) => new Date(b.ditinjau_pada) - new Date(a.ditinjau_pada)).slice(0, 20)
        .map(a => ({ id: a.id, title: a.judul, when: labelSelesai(a.ditinjau_pada, hariIni), xpReward: a.xp, reviewedAt: a.ditinjau_pada })),
      _streak: streak,
    };
  }

  // Kartu karakter + 4 stat. Satu-satunya tempat yang membangunnya, dipakai Character Sheet anggota
  // DAN halaman Pantau Anggota → tampilan admin dijamin identik dengan yang dilihat anggota.
  // TIDAK pernah memuat tim.tipe / kepuasan.
  function bentukKarakter(tim, m, ach, xpMinggu) {
    const level = m.level, levelLalu = levelDariXp(xpMinggu);
    let levelUpNote = null;
    if (level > levelLalu) {
      const stageBaru = stageDariLevel(level), stageLama = stageDariLevel(levelLalu);
      levelUpNote = stageBaru !== stageLama
        ? `Naik dari ${stageLama} ke ${stageBaru} minggu ini.`
        : `Naik ke Level ${level} minggu ini.`;
    }
    const skala = (v) => Math.max(0, Math.min(100, Math.round((Number(v) || 0) * 20)));
    return {
      character: {
        nama: tim.nama, initial: tim.nama.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(),
        divisi: tim.divisi, entitas: tim.entitas,
        roleLine: `${tim.divisi} · Unit ${tim.entitas || 'Creanimasi Studio'}`,
        level, careerStage: stageDariLevel(level), title: titleDariAchievement(ach),
        rarity: rarityDariLevel(level), rarityMax: 5,
        xpTotal: m.xp, xpNextTier: xpMenujuLevelBerikut(level, m.xp), levelUpNote,
      },
      stats: [
        { key: 'produktivitas', label: 'Produktivitas', value: skala(tim.skill), colorVar: '--rpg-stat-produktivitas' },
        { key: 'kolaborasi',    label: 'Kolaborasi',    value: skala(tim.kriteria), colorVar: '--rpg-stat-kolaborasi' },
        { key: 'inisiatif',     label: 'Inisiatif',     value: skala(tim.komunikasi), colorVar: '--rpg-stat-inisiatif' },
        { key: 'konsistensi',   label: 'Konsistensi',   value: hitungKonsistensi(m.tanggal, hariIniWib()), colorVar: '--rpg-stat-konsistensi' },
      ],
    };
  }

  // ══════════════════════ ENDPOINT ANGGOTA ══════════════════════
  const perluTim = async (req, res) => {
    const tim = await timUntukUser(req.user.id);
    if (!tim) { res.status(404).json({ error: 'Akun ini belum terhubung ke data anggota tim.' }); return null; }
    return tim;
  };

  // GET /api/hub/rpg/character — TIDAK pernah memuat tim.tipe / kepuasan
  router.get('/rpg/character', authMiddleware, requirePageAccess('rpg-character'), async (req, res) => {
    try {
      const tim = await perluTim(req, res); if (!tim) return;
      await syncXp();
      const m = await metrik(tim);
      // Character Sheet menampilkan ringkasan dari halaman lain; bagian itu hanya ikut bila role
      // pemakai punya akses ke halaman aslinya (Papan Quest / Guild Hall / Pencapaian).
      const akses = new Set(await getPageAccessList(req.user.role_id));
      const bisa = { quests: akses.has('rpg-quests'), guild: akses.has('rpg-guild'), achievements: akses.has('rpg-achievements') };
      const [ach, quests, lb, xpMinggu] = await Promise.all([
        evaluasiAchievement(tim, m), // selalu: dipakai untuk title di kartu karakter
        bisa.quests ? dataQuest(tim) : null,
        bisa.guild ? leaderboard({ period: 'weekly', timIdSaya: tim.id }) : [],
        xpTotal(tim.id, new Date(Date.now() - 7 * 86400000)),
      ]);
      const top3 = lb.slice(0, 3);
      const saya = lb.find(x => x.isYou);
      const aktifGabung = quests ? [...quests.groups[1].quests, ...quests.groups[2].quests, ...quests.groups[0].quests].slice(0, 3) : [];
      res.json({ success: true, data: {
        ...bentukKarakter(tim, m, ach, xpMinggu),
        achievements: bisa.achievements ? [...ach].sort((a, b) => Number(a.locked) - Number(b.locked)).slice(0, 5) : [],
        activeQuests: aktifGabung,
        leaderboard: bisa.guild ? publik(saya && !top3.includes(saya) ? [...top3, saya] : top3) : [],
        akses: bisa, // supaya UI menyembunyikan panel (bukan menampilkan "kosong" yang menyesatkan)
      } });
    } catch (e) { console.error('[RPG] character:', e.message); res.status(500).json({ error: 'Gagal memuat karakter' }); }
  });

  // GET /api/hub/rpg/quests
  router.get('/rpg/quests', authMiddleware, requirePageAccess('rpg-quests'), async (req, res) => {
    try {
      const tim = await perluTim(req, res); if (!tim) return;
      await syncXp();
      const { _streak, ...data } = await dataQuest(tim);
      res.json({ success: true, data });
    } catch (e) { console.error('[RPG] quests:', e.message); res.status(500).json({ error: 'Gagal memuat quest' }); }
  });

  // PATCH /api/hub/rpg/quests/:id/progress — hanya milik sendiri
  router.patch('/rpg/quests/:id/progress', authMiddleware, requirePageAccess('rpg-quests'), async (req, res) => {
    try {
      const tim = await perluTim(req, res); if (!tim) return;
      const pct = Number(req.body.progress_pct);
      if (!Number.isInteger(pct) || pct < 0 || pct > 100) return res.status(400).json({ error: 'progress_pct harus bilangan bulat 0–100' });
      const r = await q(
        `UPDATE rpg_quest_assignment SET progress_pct = $1 WHERE id = $2 AND tim_id = $3 AND status IN ('aktif','ditolak') RETURNING id`,
        [pct, parseInt(req.params.id, 10), tim.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Quest tidak ditemukan atau tidak bisa diubah' });
      res.json({ success: true });
    } catch (e) { console.error('[RPG] progress:', e.message); res.status(500).json({ error: 'Gagal menyimpan progres' }); }
  });

  // POST /api/hub/rpg/quests/:id/ajukan — anggota menandai selesai, menunggu persetujuan admin
  router.post('/rpg/quests/:id/ajukan', authMiddleware, requirePageAccess('rpg-quests'), async (req, res) => {
    try {
      const tim = await perluTim(req, res); if (!tim) return;
      const catatan = String(req.body.catatan || '').slice(0, 1000) || null;
      const r = await q(
        `UPDATE rpg_quest_assignment SET status = 'diajukan', progress_pct = 100, catatan_anggota = $1, diajukan_pada = NOW()
         WHERE id = $2 AND tim_id = $3 AND status IN ('aktif','ditolak') RETURNING id`,
        [catatan, parseInt(req.params.id, 10), tim.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Quest tidak ditemukan atau sudah diajukan' });
      res.json({ success: true });
    } catch (e) { console.error('[RPG] ajukan:', e.message); res.status(500).json({ error: 'Gagal mengajukan quest' }); }
  });

  // GET /api/hub/rpg/leaderboard?period=weekly|season|all&divisi=
  router.get('/rpg/leaderboard', authMiddleware, requirePageAccess('rpg-guild'), async (req, res) => {
    try {
      await syncXp();
      const tim = await timUntukUser(req.user.id);
      const period = ['weekly', 'season', 'all'].includes(req.query.period) ? req.query.period : 'weekly';
      const rows = await leaderboard({ period, divisi: req.query.divisi || null, timIdSaya: tim ? tim.id : null });
      const musim = Math.floor((new Date(Date.now() + 7 * 3600 * 1000).getUTCMonth()) / 3) + 1;
      res.json({ success: true, data: { period, musim: 'Musim ' + String(musim).padStart(2, '0'), rows: publik(rows) } });
    } catch (e) { console.error('[RPG] leaderboard:', e.message); res.status(500).json({ error: 'Gagal memuat leaderboard' }); }
  });

  // GET /api/hub/rpg/achievements
  router.get('/rpg/achievements', authMiddleware, requirePageAccess('rpg-achievements'), async (req, res) => {
    try {
      const tim = await perluTim(req, res); if (!tim) return;
      await syncXp();
      const daftar = await evaluasiAchievement(tim);
      res.json({ success: true, data: daftar });
    } catch (e) { console.error('[RPG] achievements:', e.message); res.status(500).json({ error: 'Gagal memuat achievement' }); }
  });

  // ══════════════════════ ENDPOINT ADMIN (rpg-admin) ══════════════════════
  const adminOnly = [authMiddleware, requirePageAccess('rpg-admin')];

  router.get('/rpg/admin/quests', ...adminOnly, async (req, res) => {
    try {
      const r = await q(`
        SELECT qs.id, qs.judul, qs.deskripsi, qs.tipe, qs.xp, qs.ikon, qs.aktif, to_char(qs.tenggat, 'YYYY-MM-DD') AS tenggat, qs.created_at,
               COUNT(a.id)::int AS ditugaskan,
               COUNT(a.id) FILTER (WHERE a.status = 'diajukan')::int AS menunggu,
               COUNT(a.id) FILTER (WHERE a.status = 'disetujui')::int AS selesai
        FROM rpg_quest qs LEFT JOIN rpg_quest_assignment a ON a.quest_id = qs.id
        GROUP BY qs.id ORDER BY qs.aktif DESC, qs.created_at DESC`);
      res.json({ success: true, data: r.rows });
    } catch (e) { console.error('[RPG] admin quests:', e.message); res.status(500).json({ error: 'Gagal memuat quest' }); }
  });

  function validasiQuest(b, parsial = false) {
    const out = {};
    if (!parsial || b.judul !== undefined) {
      const judul = String(b.judul || '').trim();
      if (!judul || judul.length > 150) return { error: 'Judul wajib diisi (maks. 150 karakter)' };
      out.judul = judul;
    }
    if (!parsial || b.tipe !== undefined) {
      if (!['proyek', 'sekali'].includes(b.tipe)) return { error: 'Tipe harus "proyek" atau "sekali"' };
      out.tipe = b.tipe;
    }
    if (!parsial || b.xp !== undefined) {
      const xp = Number(b.xp);
      if (!Number.isInteger(xp) || xp < 1 || xp > 1000) return { error: 'XP harus bilangan bulat 1–1000' };
      out.xp = xp;
    }
    if (b.deskripsi !== undefined) out.deskripsi = String(b.deskripsi || '').slice(0, 2000) || null;
    if (b.tenggat !== undefined) {
      if (b.tenggat && !/^\d{4}-\d{2}-\d{2}$/.test(b.tenggat)) return { error: 'Format tenggat harus YYYY-MM-DD' };
      out.tenggat = b.tenggat || null;
    }
    if (b.ikon !== undefined) {
      if (!CONFIG.IKON_QUEST.includes(b.ikon)) return { error: 'Ikon tidak valid' };
      out.ikon = b.ikon;
    }
    if (b.aktif !== undefined) out.aktif = !!b.aktif;
    return { out };
  }

  async function tugaskan(client, questId, timIds) {
    const ids = [...new Set((timIds || []).map(Number).filter(Number.isInteger))];
    if (!ids.length) return 0;
    const r = await client.query(
      `INSERT INTO rpg_quest_assignment (quest_id, tim_id)
       SELECT $1, t.id FROM tim t WHERE t.id = ANY($2::int[]) AND t.aktif = TRUE
       ON CONFLICT (quest_id, tim_id) DO NOTHING`, [questId, ids]);
    return r.rowCount;
  }

  router.post('/rpg/admin/quests', ...adminOnly, async (req, res) => {
    const { out, error } = validasiQuest(req.body);
    if (error) return res.status(400).json({ error });
    const client = await hubPool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `INSERT INTO rpg_quest (judul, deskripsi, tipe, xp, tenggat, ikon, dibuat_oleh) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [out.judul, out.deskripsi ?? null, out.tipe, out.xp, out.tenggat ?? null, out.ikon || (out.tipe === 'proyek' ? 'shield' : 'target'), req.user.nama]);
      const ditugaskan = await tugaskan(client, r.rows[0].id, req.body.tim_ids);
      await client.query('COMMIT');
      res.status(201).json({ success: true, data: { id: r.rows[0].id, ditugaskan } });
    } catch (e) { await client.query('ROLLBACK'); console.error('[RPG] buat quest:', e.message); res.status(500).json({ error: 'Gagal membuat quest' }); }
    finally { client.release(); }
  });

  router.patch('/rpg/admin/quests/:id', ...adminOnly, async (req, res) => {
    const { out, error } = validasiQuest(req.body, true);
    if (error) return res.status(400).json({ error });
    const kolom = Object.keys(out);
    if (!kolom.length) return res.status(400).json({ error: 'Tidak ada perubahan' });
    try {
      const set = kolom.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const r = await q(`UPDATE rpg_quest SET ${set} WHERE id = $${kolom.length + 1} RETURNING id`, [...kolom.map(k => out[k]), parseInt(req.params.id, 10)]);
      if (!r.rows.length) return res.status(404).json({ error: 'Quest tidak ditemukan' });
      res.json({ success: true });
    } catch (e) { console.error('[RPG] ubah quest:', e.message); res.status(500).json({ error: 'Gagal mengubah quest' }); }
  });

  router.post('/rpg/admin/quests/:id/tugaskan', ...adminOnly, async (req, res) => {
    const client = await hubPool.connect();
    try {
      const ada = await client.query('SELECT 1 FROM rpg_quest WHERE id = $1', [parseInt(req.params.id, 10)]);
      if (!ada.rows.length) return res.status(404).json({ error: 'Quest tidak ditemukan' });
      const ditugaskan = await tugaskan(client, parseInt(req.params.id, 10), req.body.tim_ids);
      res.json({ success: true, data: { ditugaskan } });
    } catch (e) { console.error('[RPG] tugaskan:', e.message); res.status(500).json({ error: 'Gagal menugaskan quest' }); }
    finally { client.release(); }
  });

  router.get('/rpg/admin/review', ...adminOnly, async (req, res) => {
    try {
      const r = await q(`
        SELECT a.id, a.progress_pct, a.catatan_anggota, a.diajukan_pada, qs.id AS quest_id, qs.judul, qs.xp, qs.tipe,
               t.id AS tim_id, t.nama, t.divisi
        FROM rpg_quest_assignment a JOIN rpg_quest qs ON qs.id = a.quest_id JOIN tim t ON t.id = a.tim_id
        WHERE a.status = 'diajukan' ORDER BY a.diajukan_pada`);
      res.json({ success: true, data: r.rows });
    } catch (e) { console.error('[RPG] review:', e.message); res.status(500).json({ error: 'Gagal memuat antrean' }); }
  });

  // Persetujuan: XP & status ditulis dalam SATU transaksi; kunci baris supaya tidak dobel.
  router.patch('/rpg/admin/assignments/:id', ...adminOnly, async (req, res) => {
    const status = req.body.status;
    if (!['disetujui', 'ditolak'].includes(status)) return res.status(400).json({ error: 'Status harus "disetujui" atau "ditolak"' });
    const catatan = String(req.body.catatan_review || '').slice(0, 1000) || null;
    if (status === 'ditolak' && !catatan) return res.status(400).json({ error: 'Alasan penolakan wajib diisi' });
    const client = await hubPool.connect();
    let timId = null;
    try {
      await client.query('BEGIN');
      const a = await client.query(
        `SELECT a.id, a.tim_id, a.status, qs.xp, qs.judul FROM rpg_quest_assignment a JOIN rpg_quest qs ON qs.id = a.quest_id
         WHERE a.id = $1 FOR UPDATE OF a`, [parseInt(req.params.id, 10)]);
      if (!a.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pengajuan tidak ditemukan' }); }
      const row = a.rows[0];
      if (row.status !== 'diajukan') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Pengajuan ini sudah diproses' }); }
      await client.query(
        `UPDATE rpg_quest_assignment SET status = $1, catatan_review = $2, ditinjau_oleh = $3, ditinjau_pada = NOW() WHERE id = $4`,
        [status, catatan, req.user.nama, row.id]);
      if (status === 'disetujui') {
        await client.query(
          `INSERT INTO rpg_xp_event (tim_id, sumber, ref_key, xp, keterangan, terjadi_pada) VALUES ($1, 'quest', $2, $3, $4, NOW())
           ON CONFLICT (tim_id, sumber, ref_key) DO NOTHING`,
          [row.tim_id, 'q:' + row.id, row.xp, 'Quest: ' + row.judul]);
      }
      await client.query('COMMIT');
      timId = row.tim_id;
    } catch (e) { await client.query('ROLLBACK'); console.error('[RPG] review quest:', e.message); return res.status(500).json({ error: 'Gagal memproses pengajuan' }); }
    finally { client.release(); }
    try { // evaluasi achievement setelah commit; kegagalan di sini tidak boleh membatalkan persetujuan
      const t = await q('SELECT id, nama FROM tim WHERE id = $1', [timId]);
      if (t.rows[0] && status === 'disetujui') await evaluasiAchievement(t.rows[0]);
    } catch (e) { console.error('[RPG] evaluasi achievement:', e.message); }
    res.json({ success: true });
  });

  router.get('/rpg/admin/achievements', ...adminOnly, async (req, res) => {
    try {
      const r = await q(`
        SELECT d.code, d.label, d.deskripsi, d.syarat_tipe, d.syarat_nilai, COUNT(u.tim_id)::int AS terbuka
        FROM rpg_achievement d LEFT JOIN rpg_achievement_unlock u ON u.code = d.code
        GROUP BY d.code ORDER BY d.urutan`);
      res.json({ success: true, data: r.rows });
    } catch (e) { console.error('[RPG] admin achievements:', e.message); res.status(500).json({ error: 'Gagal memuat achievement' }); }
  });

  router.post('/rpg/admin/achievements/:code/grant', ...adminOnly, async (req, res) => {
    try {
      const d = await q('SELECT syarat_tipe FROM rpg_achievement WHERE code = $1', [req.params.code]);
      if (!d.rows.length) return res.status(404).json({ error: 'Achievement tidak ditemukan' });
      if (d.rows[0].syarat_tipe !== 'manual') return res.status(400).json({ error: 'Achievement ini terbuka otomatis, tidak bisa diberikan manual' });
      const timId = parseInt(req.body.tim_id, 10);
      const t = await q('SELECT 1 FROM tim WHERE id = $1 AND aktif = TRUE', [timId]);
      if (!t.rows.length) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
      await q('INSERT INTO rpg_achievement_unlock (tim_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING', [timId, req.params.code]);
      res.json({ success: true });
    } catch (e) { console.error('[RPG] grant:', e.message); res.status(500).json({ error: 'Gagal memberikan achievement' }); }
  });

  // ══════════════════════ PAPAN QUEST ADMIN (Kanban: satu kolom per anggota) ══════════════════════
  // Baca: pemegang rpg-admin ATAU rpg-pantau (pantau = hanya lihat). Aksi setujui/tolak TIDAK ada di sini —
  // tetap lewat PATCH /rpg/admin/assignments/:id yang mensyaratkan rpg-admin. Endpoint ini tidak mengubah data.
  const salahSatuAkses = (...kunci) => async (req, res, next) => {
    try {
      const akses = await getPageAccessList(req.user.role_id);
      if (kunci.some(k => akses.includes(k))) return next();
      res.status(403).json({ error: 'Anda tidak memiliki akses ke halaman ini' });
    } catch (e) { console.error('[RPG] cek akses:', e.message); res.status(500).json({ error: 'Gagal memeriksa hak akses' }); }
  };
  const SELESAI_HARI = 30; // kartu Selesai lebih lama dari ini tidak dikirim (hanya dihitung)

  router.get('/rpg/admin/papan', authMiddleware, salahSatuAkses('rpg-admin', 'rpg-pantau'), async (req, res) => {
    try {
      await syncXp();
      const hariIni = hariIniWib();
      const [timR, xpR, kartuR, selesaiR, belumR] = await Promise.all([
        q('SELECT id, nama, divisi, entitas FROM tim WHERE aktif = TRUE ORDER BY nama'),
        q('SELECT tim_id, SUM(xp)::int AS xp FROM rpg_xp_event GROUP BY tim_id'),
        // Aturan tampil sama dengan Papan Quest anggota: quest nonaktif disembunyikan kecuali yang sudah disetujui.
        q(`SELECT a.id, a.tim_id, a.status, a.progress_pct, a.catatan_anggota, a.catatan_review, a.diajukan_pada, a.ditinjau_pada,
                  qs.id AS quest_id, qs.judul, qs.deskripsi, qs.tipe, qs.xp, qs.ikon, to_char(qs.tenggat, 'YYYY-MM-DD') AS tenggat
           FROM rpg_quest_assignment a
           JOIN rpg_quest qs ON qs.id = a.quest_id
           JOIN tim t ON t.id = a.tim_id AND t.aktif = TRUE
           WHERE (qs.aktif = TRUE OR a.status = 'disetujui')
             AND (a.status <> 'disetujui' OR a.ditinjau_pada >= now() - make_interval(days => $1))
           ORDER BY qs.tenggat NULLS LAST, a.id`, [SELESAI_HARI]),
        q("SELECT tim_id, COUNT(*)::int AS n FROM rpg_quest_assignment WHERE status = 'disetujui' GROUP BY tim_id"),
        q('SELECT COUNT(*)::int AS n FROM rpg_quest qs WHERE qs.aktif = TRUE AND NOT EXISTS (SELECT 1 FROM rpg_quest_assignment a WHERE a.quest_id = qs.id)'),
      ]);
      const xpPer = Object.fromEntries(xpR.rows.map(r => [r.tim_id, r.xp]));
      const selesaiPer = Object.fromEntries(selesaiR.rows.map(r => [r.tim_id, r.n]));
      const anggota = timR.rows.map(t => ({
        id: t.id, nama: t.nama, divisi: t.divisi, entitas: t.entitas,
        level: levelDariXp(xpPer[t.id] || 0), selesaiTotal: selesaiPer[t.id] || 0,
      }));
      const kartu = kartuR.rows.map(a => ({
        id: a.id, timId: a.tim_id, questId: a.quest_id, judul: a.judul, deskripsi: a.deskripsi, tipe: a.tipe, xp: a.xp, ikon: a.ikon,
        tenggat: a.tenggat, ...labelTenggat(a.tenggat, hariIni),
        status: a.status, progressPct: a.progress_pct, catatanAnggota: a.catatan_anggota, catatanReview: a.catatan_review,
        diajukanPada: a.diajukan_pada, ditinjauPada: a.ditinjau_pada,
      }));
      res.json({ success: true, data: { selesaiHari: SELESAI_HARI, anggota, kartu, belumDitugaskan: belumR.rows[0].n } });
    } catch (e) { console.error('[RPG] papan admin:', e.message); res.status(500).json({ error: 'Gagal memuat papan quest' }); }
  });

  // ══════════════════════ PANTAU ANGGOTA (rpg-pantau) ══════════════════════
  // Hanya-baca. Menampilkan kondisi RPG tiap anggota persis seperti yang dilihat anggota itu (fungsi yang
  // sama dipakai ulang), ditambah asal XP dan aktivitas yang namanya tak cocok dengan anggota mana pun.
  // Membuka halaman ini tidak mengubah XP/quest; satu-satunya efek samping = sinkronisasi XP otomatis dan
  // pencatatan achievement yang MEMANG sudah memenuhi syarat (idempoten, sama seperti saat anggota membukanya).
  const pantau = [authMiddleware, requirePageAccess('rpg-pantau')];

  // Jalankan fungsi async pada daftar dengan konkurensi terbatas (jangan menghabiskan pool koneksi).
  async function petakan(daftar, batas, fn) {
    const hasil = new Array(daftar.length);
    for (let i = 0; i < daftar.length; i += batas) {
      const potong = daftar.slice(i, i + batas);
      const r = await Promise.all(potong.map((x, j) => fn(x, i + j)));
      r.forEach((v, j) => { hasil[i + j] = v; });
    }
    return hasil;
  }

  router.get('/rpg/pantau/anggota', ...pantau, async (req, res) => {
    try {
      await syncXp();
      const [timR, questR, terakhirR, mingguR] = await Promise.all([
        q(`SELECT t.id, t.nama, t.divisi, t.entitas, t.skill, t.komunikasi, t.kriteria,
                  EXISTS (SELECT 1 FROM hub_users u WHERE u.tim_id = t.id OR (u.tim_id IS NULL AND u.nama = t.nama)) AS punya_akun
           FROM tim t WHERE t.aktif = TRUE ORDER BY t.nama`),
        q(`SELECT a.tim_id, a.status, COUNT(*)::int AS n FROM rpg_quest_assignment a JOIN rpg_quest qs ON qs.id = a.quest_id
           WHERE qs.aktif = TRUE OR a.status = 'disetujui' GROUP BY a.tim_id, a.status`),
        q('SELECT tim_id, MAX(terjadi_pada) AS terakhir FROM rpg_xp_event GROUP BY tim_id'),
        q(`SELECT tim_id, SUM(xp)::int AS xp FROM rpg_xp_event
           WHERE terjadi_pada AT TIME ZONE ${TZ} >= date_trunc('week', now() AT TIME ZONE ${TZ}) GROUP BY tim_id`),
      ]);
      const questPer = {}; questR.rows.forEach(r => { (questPer[r.tim_id] = questPer[r.tim_id] || {})[r.status] = r.n; });
      const terakhirPer = Object.fromEntries(terakhirR.rows.map(r => [r.tim_id, r.terakhir]));
      const mingguPer = Object.fromEntries(mingguR.rows.map(r => [r.tim_id, r.xp]));

      const anggota = await petakan(timR.rows, 5, async (t) => {
        const m = await metrik(t);
        const ach = await evaluasiAchievement(t, m);
        const qs = questPer[t.id] || {};
        return {
          id: t.id, nama: t.nama, divisi: t.divisi, entitas: t.entitas, punyaAkun: t.punya_akun,
          level: m.level, careerStage: stageDariLevel(m.level), xpTotal: m.xp, xpMinggu: mingguPer[t.id] || 0,
          streak: m.streak, konsistensi: hitungKonsistensi(m.tanggal, hariIniWib()),
          quest: { aktif: qs.aktif || 0, diajukan: qs.diajukan || 0, ditolak: qs.ditolak || 0, disetujui: qs.disetujui || 0 },
          achievement: { terbuka: ach.filter(a => !a.locked).length, total: ach.length },
          terakhirAktif: terakhirPer[t.id] || null,
        };
      });

      // Nama pada data sumber yang TIDAK cocok dengan anggota mana pun → tidak menghasilkan XP (mis. salah ketik di bot).
      // Kriteria cocok identik dengan sinkronisasi XP: LOWER(TRIM(nama)) terhadap tim.nama (semua baris tim).
      const tak = await q(`
        SELECT * FROM (
          SELECT 'Laporan harian' AS sumber, TRIM(l.nama) AS nama, COUNT(*)::int AS jumlah, MAX(l.tanggal)::text AS terakhir
            FROM laporan_harian l WHERE l.tanggal >= $1::date AND TRIM(COALESCE(l.nama, '')) <> ''
             AND NOT EXISTS (SELECT 1 FROM tim t WHERE LOWER(TRIM(t.nama)) = LOWER(TRIM(l.nama))) GROUP BY TRIM(l.nama)
          UNION ALL
          SELECT 'Jurnal mingguan', TRIM(j.nama), COUNT(*)::int, MAX(j.tanggal_jurnal)::text
            FROM jurnal_mingguan j WHERE j.tanggal_jurnal >= $1::date AND TRIM(COALESCE(j.nama, '')) <> ''
             AND NOT EXISTS (SELECT 1 FROM tim t WHERE LOWER(TRIM(t.nama)) = LOWER(TRIM(j.nama))) GROUP BY TRIM(j.nama)
          UNION ALL
          SELECT 'Kehadiran', TRIM(k.nama), COUNT(*)::int, MAX(s.tanggal)::text
            FROM absensi_kehadiran k JOIN absensi_sesi s ON s.id = k.sesi_id
            WHERE s.tanggal >= $1::date AND TRIM(COALESCE(k.nama, '')) <> ''
             AND NOT EXISTS (SELECT 1 FROM tim t WHERE LOWER(TRIM(t.nama)) = LOWER(TRIM(k.nama))) GROUP BY TRIM(k.nama)
          UNION ALL
          SELECT 'Friday Win', TRIM(f.penerima), COUNT(*)::int, MAX(f.tanggal)::text
            FROM friday_win f WHERE f.tanggal >= $1::date AND TRIM(COALESCE(f.penerima, '')) <> ''
             AND NOT EXISTS (SELECT 1 FROM tim t WHERE LOWER(TRIM(t.nama)) = LOWER(TRIM(f.penerima))) GROUP BY TRIM(f.penerima)
        ) x ORDER BY jumlah DESC, nama LIMIT 50`, [CONFIG.RPG_MULAI]);

      res.json({ success: true, data: { mulai: CONFIG.RPG_MULAI, anggota, takDikenali: tak.rows } });
    } catch (e) { console.error('[RPG] pantau anggota:', e.message); res.status(500).json({ error: 'Gagal memuat data anggota' }); }
  });

  router.get('/rpg/pantau/anggota/:timId', ...pantau, async (req, res) => {
    try {
      const timId = parseInt(req.params.timId, 10);
      if (!Number.isInteger(timId)) return res.status(400).json({ error: 'ID anggota tidak valid' });
      const t = (await q(`SELECT t.id, t.nama, t.divisi, t.entitas, t.skill, t.komunikasi, t.kriteria,
                 EXISTS (SELECT 1 FROM hub_users u WHERE u.tim_id = t.id OR (u.tim_id IS NULL AND u.nama = t.nama)) AS punya_akun
                 FROM tim t WHERE t.id = $1 AND t.aktif = TRUE`, [timId])).rows[0];
      if (!t) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
      await syncXp();
      const m = await metrik(t);
      const [ach, quests, xpMinggu, lbMinggu, lbMusim, perSumber, terbaru] = await Promise.all([
        evaluasiAchievement(t, m),
        dataQuest(t),
        xpTotal(t.id, new Date(Date.now() - 7 * 86400000)),
        leaderboard({ period: 'weekly' }),
        leaderboard({ period: 'season' }),
        q('SELECT sumber, COUNT(*)::int AS jumlah, SUM(xp)::int AS xp FROM rpg_xp_event WHERE tim_id = $1 GROUP BY sumber ORDER BY SUM(xp) DESC', [t.id]),
        q('SELECT sumber, keterangan, xp, terjadi_pada FROM rpg_xp_event WHERE tim_id = $1 ORDER BY terjadi_pada DESC, id DESC LIMIT 15', [t.id]),
      ]);
      const { _streak, ...dataQ } = quests;
      res.json({ success: true, data: {
        ...bentukKarakter(t, m, ach, xpMinggu),
        achievements: [...ach].sort((a, b) => Number(a.locked) - Number(b.locked)),
        quests: dataQ,
        streak: m.streak,
        xp: { total: m.xp, mulai: CONFIG.RPG_MULAI, perSumber: perSumber.rows, terbaru: terbaru.rows },
        peringkat: {
          mingguan: (lbMinggu.find(x => x._id === t.id) || {}).rank || null,
          musim: (lbMusim.find(x => x._id === t.id) || {}).rank || null,
          dari: lbMinggu.length,
        },
        punyaAkun: t.punya_akun,
      } });
    } catch (e) { console.error('[RPG] pantau detail:', e.message); res.status(500).json({ error: 'Gagal memuat detail anggota' }); }
  });

  // ══════════════════════ ANALYTICS (rpg-analytics) ══════════════════════
  router.get('/rpg/admin/analytics', authMiddleware, requirePageAccess('rpg-analytics'), async (req, res) => {
    try {
      await syncXp();
      const hariIni = hariIniWib();
      const [tim, musim, mingguan, harian, proyek, tipe] = await Promise.all([
        q(`SELECT t.id, COALESCE(SUM(e.xp), 0)::int AS xp FROM tim t LEFT JOIN rpg_xp_event e ON e.tim_id = t.id WHERE t.aktif = TRUE GROUP BY t.id`),
        q(`SELECT COALESCE(SUM(xp), 0)::int AS xp FROM rpg_xp_event WHERE terjadi_pada AT TIME ZONE ${TZ} >= date_trunc('quarter', now() AT TIME ZONE ${TZ})`),
        q(`SELECT to_char(w.wk, 'DD/MM') AS minggu, COALESCE(SUM(e.xp), 0)::int AS xp
           FROM generate_series(date_trunc('week', now() AT TIME ZONE ${TZ}) - interval '7 weeks', date_trunc('week', now() AT TIME ZONE ${TZ}), interval '1 week') AS w(wk)
           LEFT JOIN rpg_xp_event e ON date_trunc('week', e.terjadi_pada AT TIME ZONE ${TZ}) = w.wk
           GROUP BY w.wk ORDER BY w.wk`),
        q(`SELECT t.id, COUNT(DISTINCT lh.tanggal) FILTER (WHERE EXTRACT(ISODOW FROM lh.tanggal) < 6)::int AS hari
           FROM tim t LEFT JOIN laporan_harian lh ON LOWER(TRIM(lh.nama)) = LOWER(TRIM(t.nama)) AND lh.tanggal >= (CURRENT_DATE - 30)
           WHERE t.aktif = TRUE GROUP BY t.id`),
        q(`SELECT qs.tipe, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE a.status = 'disetujui')::int AS selesai
           FROM rpg_quest_assignment a JOIN rpg_quest qs ON qs.id = a.quest_id GROUP BY qs.tipe`),
        q(`SELECT tipe, COUNT(*)::int AS jumlah FROM tim WHERE aktif = TRUE AND COALESCE(tipe, '') <> '' GROUP BY tipe`),
      ]);
      const levels = tim.rows.map(r => levelDariXp(r.xp));
      const buckets = [['Lv 1–5', 1, 5], ['Lv 6–10', 6, 10], ['Lv 11–15', 11, 15], ['Lv 16–20', 16, 20]];
      let hariKerja30 = 0; for (let i = 0; i < 30; i++) if (hariKerja(geser(hariIni, -i))) hariKerja30++;
      const pctHarian = harian.rows.length && hariKerja30
        ? Math.round(harian.rows.reduce((s, r) => s + Math.min(1, r.hari / hariKerja30), 0) / harian.rows.length * 100) : 0;
      const pctQuest = (t) => { const r = proyek.rows.find(x => x.tipe === t); return r && r.total ? { completionPct: Math.round(100 * r.selesai / r.total), n: r.total } : { completionPct: 0, n: 0 }; };
      const completionByType = [
        { tipe: 'Harian', completionPct: pctHarian, n: harian.rows.length },
        { tipe: 'Proyek', ...pctQuest('proyek') },
        { tipe: 'Sekali', ...pctQuest('sekali') },
      ];
      const punyaData = completionByType.filter(c => c.n > 0);
      const WARNA = { 'Rising Star': '--rpg-stat-konsistensi', 'High Potential': '--rpg-stat-kolaborasi', 'Silent Expert': '--rpg-stat-inisiatif', 'At Risk': '--rpg-stat-produktivitas' };
      res.json({ success: true, data: {
        overall: {
          totalXpSeason: musim.rows[0].xp,
          avgLevel: levels.length ? Math.round(levels.reduce((s, l) => s + l, 0) / levels.length * 10) / 10 : 0,
          completionRateOverall: punyaData.length ? Math.round(punyaData.reduce((s, c) => s + c.completionPct, 0) / punyaData.length) : 0,
          anggotaAktif: tim.rows.length,
        },
        levelDistribution: buckets.map(([bucket, a, b]) => ({ bucket, jumlah: levels.filter(l => l >= a && l <= b).length })),
        xpTrend: mingguan.rows.map(r => ({ minggu: r.minggu, xp: r.xp })),
        completionByType,
        tipeDistribution: Object.keys(WARNA).map(t => ({ tipe: t, jumlah: (tipe.rows.find(r => r.tipe === t) || { jumlah: 0 }).jumlah, colorVar: WARNA[t] })),
      } });
    } catch (e) { console.error('[RPG] analytics:', e.message); res.status(500).json({ error: 'Gagal memuat analytics' }); }
  });

  return { syncXp, CONFIG };
};

// Diekspor untuk pengujian
module.exports.helpers = { levelDariXp, xpMenujuLevelBerikut, stageDariLevel, hitungStreak, hitungKonsistensi, labelTenggat, CONFIG };
