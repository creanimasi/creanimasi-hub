-- Migration: buat tabel laporan_mingguan, laporan_akun, laporan_sdm, laporan_admin_mingguan
-- yang sudah ada di schema.sql tapi belum pernah dibuat di production.
-- Aman dijalankan berkali-kali (IF NOT EXISTS) — tidak error jika tabel sudah ada.

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
