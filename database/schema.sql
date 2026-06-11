-- ══════════════════════════════════════════════════════════════
-- CREANIMASI INTERNAL HUB — Database Schema
-- Database: creanimasi_hub_dev
-- ══════════════════════════════════════════════════════════════

-- ── JURNAL MINGGUAN ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jurnal_mingguan (
  id               SERIAL PRIMARY KEY,
  nama             VARCHAR(100) NOT NULL,
  divisi           VARCHAR(50),
  level_karier     VARCHAR(50),
  tanggal_jurnal   DATE NOT NULL DEFAULT CURRENT_DATE,
  pencapaian_1     TEXT,
  pencapaian_2     TEXT,
  pencapaian_3     TEXT,
  hambatan         TEXT,
  pelajaran        TEXT,
  target_depan     TEXT,
  mood             SMALLINT CHECK (mood BETWEEN 1 AND 10),
  skor_karya       SMALLINT CHECK (skor_karya BETWEEN 0 AND 5),
  skor_waktu       SMALLINT CHECK (skor_waktu BETWEEN 0 AND 5),
  skor_komunikasi  SMALLINT CHECK (skor_komunikasi BETWEEN 0 AND 5),
  skor_skill       SMALLINT CHECK (skor_skill BETWEEN 0 AND 5),
  catatan_mentor   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── KOLOM UMUM (shared across all profiling tables) ─────────
-- Dipakai ulang lewat komentar; setiap tabel profiling punya kolom ini.

-- ── PROFILING ADMIN ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiling_admin (
  id                    SERIAL PRIMARY KEY,
  divisi                VARCHAR(20) DEFAULT 'admin',
  nama                  VARCHAR(100) NOT NULL,
  usia                  SMALLINT,
  tanggal_bergabung     DATE,
  domisili              VARCHAR(100),
  level_karier          VARCHAR(50),
  -- Teknis Admin
  platform_dikuasai     TEXT,
  skill_copywriting     SMALLINT CHECK (skill_copywriting BETWEEN 0 AND 5),
  skor_komunikasi       SMALLINT CHECK (skor_komunikasi BETWEEN 0 AND 5),
  pengalaman_komplain   VARCHAR(50),
  bisa_konten_sosmed    VARCHAR(50),
  tools_desain          TEXT,
  -- Karakter
  produktif_waktu       VARCHAR(50),
  gaya_kerja            VARCHAR(100),
  respons_feedback      VARCHAR(100),
  deadline_mepet        VARCHAR(100),
  skor_kerja_tim        SMALLINT CHECK (skor_kerja_tim BETWEEN 0 AND 5),
  -- Motivasi
  semangat_kerja        TEXT,
  penguras_energi       TEXT,
  target_1_tahun        TEXT,
  skill_ingin_dikuasai  TEXT,
  tertarik_memimpin     VARCHAR(100),
  alasan_bergabung      TEXT,
  ingin_diubah          TEXT,
  kepuasan_diri         SMALLINT CHECK (kepuasan_diri BETWEEN 1 AND 10),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROFILING PM ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiling_pm (
  id                      SERIAL PRIMARY KEY,
  divisi                  VARCHAR(20) DEFAULT 'pm',
  nama                    VARCHAR(100) NOT NULL,
  usia                    SMALLINT,
  tanggal_bergabung       DATE,
  domisili                VARCHAR(100),
  level_karier            VARCHAR(50),
  -- Teknis PM
  tools_project           TEXT,
  pengalaman_koordinasi   VARCHAR(50),
  skill_komunikasi        SMALLINT CHECK (skill_komunikasi BETWEEN 0 AND 5),
  skor_komunikasi_klien   SMALLINT CHECK (skor_komunikasi_klien BETWEEN 0 AND 5),
  prioritas_project       VARCHAR(100),
  bahasa_dikuasai         TEXT,
  -- Karakter
  produktif_waktu         VARCHAR(50),
  gaya_kerja              VARCHAR(100),
  respons_feedback        VARCHAR(100),
  deadline_mepet          VARCHAR(100),
  skor_kerja_tim          SMALLINT CHECK (skor_kerja_tim BETWEEN 0 AND 5),
  -- Motivasi
  semangat_kerja          TEXT,
  penguras_energi         TEXT,
  target_1_tahun          TEXT,
  skill_ingin_dikuasai    TEXT,
  tertarik_memimpin       VARCHAR(100),
  alasan_bergabung        TEXT,
  ingin_diubah            TEXT,
  kepuasan_diri           SMALLINT CHECK (kepuasan_diri BETWEEN 1 AND 10),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROFILING ILLUSTRATOR ───────────────────────────────────
CREATE TABLE IF NOT EXISTS profiling_illustrator (
  id                    SERIAL PRIMARY KEY,
  divisi                VARCHAR(20) DEFAULT 'illustrator',
  nama                  VARCHAR(100) NOT NULL,
  usia                  SMALLINT,
  tanggal_bergabung     DATE,
  domisili              VARCHAR(100),
  level_karier          VARCHAR(50),
  -- Teknis Illustrator
  software_utama        TEXT,
  skill_level_csp       SMALLINT CHECK (skill_level_csp BETWEEN 0 AND 5),
  spesialisasi          TEXT,
  waktu_1_karakter      VARCHAR(50),
  kapasitas_paralel     SMALLINT,
  link_portofolio       TEXT,
  skor_komunikasi       SMALLINT CHECK (skor_komunikasi BETWEEN 0 AND 5),
  -- Karakter
  produktif_waktu       VARCHAR(50),
  gaya_kerja            VARCHAR(100),
  respons_feedback      VARCHAR(100),
  deadline_mepet        VARCHAR(100),
  skor_kerja_tim        SMALLINT CHECK (skor_kerja_tim BETWEEN 0 AND 5),
  -- Motivasi
  semangat_kerja        TEXT,
  penguras_energi       TEXT,
  target_1_tahun        TEXT,
  skill_ingin_dikuasai  TEXT,
  tertarik_memimpin     VARCHAR(100),
  alasan_bergabung      TEXT,
  ingin_diubah          TEXT,
  kepuasan_diri         SMALLINT CHECK (kepuasan_diri BETWEEN 1 AND 10),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROFILING RIGGER ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiling_rigger (
  id                    SERIAL PRIMARY KEY,
  divisi                VARCHAR(20) DEFAULT 'rigger',
  nama                  VARCHAR(100) NOT NULL,
  usia                  SMALLINT,
  tanggal_bergabung     DATE,
  domisili              VARCHAR(100),
  level_karier          VARCHAR(50),
  -- Teknis Rigger
  software_rigging      TEXT,
  skill_level_live2d    SMALLINT CHECK (skill_level_live2d BETWEEN 0 AND 5),
  bisa_physics_expr     VARCHAR(50),
  pengalaman_project    TEXT,
  waktu_rigging         VARCHAR(50),
  link_portofolio       TEXT,
  skor_komunikasi       SMALLINT CHECK (skor_komunikasi BETWEEN 0 AND 5),
  -- Karakter
  produktif_waktu       VARCHAR(50),
  gaya_kerja            VARCHAR(100),
  respons_feedback      VARCHAR(100),
  deadline_mepet        VARCHAR(100),
  skor_kerja_tim        SMALLINT CHECK (skor_kerja_tim BETWEEN 0 AND 5),
  -- Motivasi
  semangat_kerja        TEXT,
  penguras_energi       TEXT,
  target_1_tahun        TEXT,
  skill_ingin_dikuasai  TEXT,
  tertarik_memimpin     VARCHAR(100),
  alasan_bergabung      TEXT,
  ingin_diubah          TEXT,
  kepuasan_diri         SMALLINT CHECK (kepuasan_diri BETWEEN 1 AND 10),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROFILING 3D MODELER ────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiling_3d (
  id                    SERIAL PRIMARY KEY,
  divisi                VARCHAR(20) DEFAULT '3d',
  nama                  VARCHAR(100) NOT NULL,
  usia                  SMALLINT,
  tanggal_bergabung     DATE,
  domisili              VARCHAR(100),
  level_karier          VARCHAR(50),
  -- Teknis 3D
  software_3d           TEXT,
  skill_level_blender   SMALLINT CHECK (skill_level_blender BETWEEN 0 AND 5),
  jenis_output          TEXT,
  bisa_vrm_export       VARCHAR(50),
  bisa_3d_print         VARCHAR(50),
  pernah_ar_filter      VARCHAR(50),
  waktu_vrm             VARCHAR(50),
  skor_komunikasi       SMALLINT CHECK (skor_komunikasi BETWEEN 0 AND 5),
  -- Karakter
  produktif_waktu       VARCHAR(50),
  gaya_kerja            VARCHAR(100),
  respons_feedback      VARCHAR(100),
  deadline_mepet        VARCHAR(100),
  skor_kerja_tim        SMALLINT CHECK (skor_kerja_tim BETWEEN 0 AND 5),
  -- Motivasi
  semangat_kerja        TEXT,
  penguras_energi       TEXT,
  target_1_tahun        TEXT,
  skill_ingin_dikuasai  TEXT,
  tertarik_memimpin     VARCHAR(100),
  alasan_bergabung      TEXT,
  ingin_diubah          TEXT,
  kepuasan_diri         SMALLINT CHECK (kepuasan_diri BETWEEN 1 AND 10),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── REWARD TRACKING ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reward_tracking (
  id         SERIAL PRIMARY KEY,
  tanggal    DATE NOT NULL DEFAULT CURRENT_DATE,
  nama       VARCHAR(100) NOT NULL,
  kategori   VARCHAR(50),
  trigger    TEXT,
  bentuk     TEXT,
  nominal    INTEGER DEFAULT 0,
  catatan    TEXT,
  status     VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SKB (Surat Keputusan / Proposal Besar) ──────────────────
CREATE TABLE IF NOT EXISTS skb (
  id              SERIAL PRIMARY KEY,
  tipe            VARCHAR(50) NOT NULL,
  nama            VARCHAR(100) NOT NULL,
  divisi          VARCHAR(50),
  level           VARCHAR(50),
  judul           TEXT NOT NULL,
  deskripsi       TEXT,
  latar_belakang  TEXT,
  tujuan          TEXT,
  output          TEXT,
  timeline        TEXT,
  kebutuhan       TEXT,
  risiko          TEXT,
  ukuran_sukses   TEXT,
  komitmen        TEXT,
  status          VARCHAR(20) DEFAULT 'draft',
  catatan_review  TEXT,
  reviewer        VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── VIEWS ────────────────────────────────────────────────────

-- View: statistik jurnal per anggota
CREATE OR REPLACE VIEW v_jurnal_stats AS
SELECT
  nama,
  COUNT(*)                                                        AS total_jurnal,
  ROUND(AVG(mood), 1)                                             AS avg_mood,
  ROUND(AVG(skor_karya), 1)                                       AS avg_skor_karya,
  ROUND(AVG(skor_skill), 1)                                       AS avg_skor_skill,
  MAX(tanggal_jurnal)                                             AS jurnal_terakhir,
  (MAX(tanggal_jurnal) >= CURRENT_DATE - INTERVAL '7 days')       AS isi_minggu_ini
FROM jurnal_mingguan
GROUP BY nama;

-- View: semua profiling digabung dari 5 divisi
CREATE OR REPLACE VIEW v_profiling_all AS
  SELECT id, 'admin'       AS divisi, nama, level_karier, tanggal_bergabung, created_at FROM profiling_admin
  UNION ALL
  SELECT id, 'pm'          AS divisi, nama, level_karier, tanggal_bergabung, created_at FROM profiling_pm
  UNION ALL
  SELECT id, 'illustrator' AS divisi, nama, level_karier, tanggal_bergabung, created_at FROM profiling_illustrator
  UNION ALL
  SELECT id, 'rigger'      AS divisi, nama, level_karier, tanggal_bergabung, created_at FROM profiling_rigger
  UNION ALL
  SELECT id, '3d'          AS divisi, nama, level_karier, tanggal_bergabung, created_at FROM profiling_3d;

-- ── TIM ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tim (
  id          SERIAL PRIMARY KEY,
  nama        VARCHAR(100) NOT NULL,
  divisi      VARCHAR(50)  NOT NULL,
  level       VARCHAR(50),
  tipe        VARCHAR(50),
  aktif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── LAPORAN MINGGUAN (PDF) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS laporan_mingguan (
  id            SERIAL PRIMARY KEY,
  tanggal       DATE NOT NULL,
  judul         VARCHAR(100) NOT NULL DEFAULT 'Creanimasi',
  kas           NUMERIC(15,2) DEFAULT 0,
  marketing     TEXT,
  produksi      TEXT,
  dibuat_oleh   VARCHAR(100),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tanggal, judul)
);

-- Data keuangan per akun/platform per laporan
CREATE TABLE IF NOT EXISTS laporan_akun (
  id                  SERIAL PRIMARY KEY,
  laporan_id          INTEGER NOT NULL REFERENCES laporan_mingguan(id) ON DELETE CASCADE,
  nama_akun           VARCHAR(100) NOT NULL,
  available_withdraw  NUMERIC(12,2) DEFAULT 0,
  payment_clearing    NUMERIC(12,2) DEFAULT 0,
  active_order        NUMERIC(12,2) DEFAULT 0,
  total_withdraw      NUMERIC(12,2) DEFAULT 0
);

-- Catatan SDM per anggota per laporan
CREATE TABLE IF NOT EXISTS laporan_sdm (
  id          SERIAL PRIMARY KEY,
  laporan_id  INTEGER NOT NULL REFERENCES laporan_mingguan(id) ON DELETE CASCADE,
  nama        VARCHAR(100) NOT NULL,
  catatan     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── LAPORAN ADMIN MINGGUAN (per akun Fiverr) ─────────────────
CREATE TABLE IF NOT EXISTS laporan_admin_mingguan (
  id                            SERIAL PRIMARY KEY,
  tanggal                       DATE NOT NULL,
  akun                          VARCHAR(100) NOT NULL,
  periode                       VARCHAR(50),
  gigs_tags                     JSONB DEFAULT '[]',
  order_queue                   JSONB DEFAULT '{}',
  flow_new_order                INTEGER DEFAULT 0,
  flow_complete_order           INTEGER DEFAULT 0,
  level                         VARCHAR(50),
  success_score                 NUMERIC(5,2),
  rating                        NUMERIC(3,2),
  response_rate                 NUMERIC(5,2),
  orders_progress               VARCHAR(30),
  unique_clients                VARCHAR(30),
  earnings_progress             VARCHAR(30),
  available_funds               NUMERIC(12,2) DEFAULT 0,
  withdrawn_to_date             NUMERIC(12,2) DEFAULT 0,
  payments_clearing             NUMERIC(12,2) DEFAULT 0,
  payments_active               NUMERIC(12,2) DEFAULT 0,
  earnings_to_date              NUMERIC(12,2) DEFAULT 0,
  expenses_to_date              NUMERIC(12,2) DEFAULT 0,
  active_gigs                   JSONB DEFAULT '[]',
  catatan                       TEXT,
  dibuat_oleh                   VARCHAR(100),
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  screenshot_account_status     JSONB,
  screenshot_earnings           JSONB,
  screenshot_active_gigs        JSONB,
  gigs_utama                    JSONB DEFAULT '[]',
  screenshot_weekly_gigs_score  JSONB,
  screenshot_weekly_overview    JSONB,
  screenshot_yearly_overview    JSONB,
  screenshot_total_impressions  JSONB,
  screenshot_fiverr_ads         JSONB,
  screenshot_porto_baru         JSONB,
  todo_list                     JSONB DEFAULT '[]',
  kendala_list                  JSONB DEFAULT '[]',
  UNIQUE (tanggal, akun)
);

-- ── GRANT PERMISSIONS ────────────────────────────────────────
GRANT ALL ON ALL TABLES IN SCHEMA public TO creanimasi;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO creanimasi;
GRANT SELECT ON v_jurnal_stats TO creanimasi;
GRANT SELECT ON v_profiling_all TO creanimasi;

-- ── SEED DATA TIM AWAL ───────────────────────────────────────
INSERT INTO tim (nama, divisi, level, tipe) VALUES
  ('Ariel Tegar',           'Admin',       'Senior', 'Rising Star'),
  ('Ryan Cavallera',        'Admin',       'Senior', 'Rising Star'),
  ('Nanda Cahya Bintang',   'Admin',       'Junior', 'High Potential'),
  ('Dina Syavina',          'PM',          'Senior', 'High Potential'),
  ('Tsania Lathifa',        'PM',          'Junior', 'Rising Star'),
  ('Ahmad Fathurrahman',    'Rigger',      'Senior', 'Rising Star'),
  ('Raynar Harits',         'Rigger',      'Senior', 'Silent Expert'),
  ('Aditya Tri Prakoso',    'Illustrator', 'Senior', 'High Potential'),
  ('Noval Faqihudin Zaky',  'Illustrator', 'Senior', 'High Potential'),
  ('Galang Ramadhan',       'Illustrator', 'Junior', 'Silent Expert'),
  ('Ridho Ramadhan',        '3D Modeler',  'Junior', 'At Risk')
ON CONFLICT DO NOTHING;
