-- Tabel yang dulu dibuat manual langsung di database production dan tidak tercatat di
-- migrasi manapun. Definisi di bawah disalin dari skema production (information_schema)
-- pada 2026-09-19. Dijalankan otomatis oleh IIFE di backend/hub.js (blok "MASTER DATA");
-- file ini dokumentasi. IF NOT EXISTS → aman untuk database yang tabelnya sudah ada.

CREATE TABLE IF NOT EXISTS friday_win (
  id SERIAL PRIMARY KEY, tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  posted_by VARCHAR(100) NOT NULL, headline TEXT NOT NULL,
  penerima VARCHAR(100), pesan TEXT, created_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE IF NOT EXISTS sesi_1on1 (
  id SERIAL PRIMARY KEY, tanggal DATE NOT NULL, anggota VARCHAR(100) NOT NULL,
  tipe VARCHAR(50) NOT NULL, durasi_menit INTEGER DEFAULT 30, ringkasan TEXT,
  tindak_lanjut TEXT, mood_sebelum INTEGER, mood_sesudah INTEGER,
  host VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE IF NOT EXISTS workshop_kehadiran (
  id SERIAL PRIMARY KEY, nama VARCHAR(100) NOT NULL, layer_id VARCHAR(20) NOT NULL,
  sesi_idx INTEGER NOT NULL, hadir BOOLEAN DEFAULT FALSE, updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (nama, layer_id, sesi_idx));

CREATE TABLE IF NOT EXISTS revenue_bulanan (
  id SERIAL PRIMARY KEY, bulan INTEGER NOT NULL CHECK (bulan >= 1 AND bulan <= 12),
  tahun INTEGER NOT NULL, nama VARCHAR(100) NOT NULL, jumlah NUMERIC(12,2) DEFAULT 0,
  target NUMERIC(12,2) DEFAULT 0, catatan TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (nama, bulan, tahun));

CREATE TABLE IF NOT EXISTS modul_topik (
  id SERIAL PRIMARY KEY, nama VARCHAR(100) NOT NULL, modul_id VARCHAR(20) NOT NULL,
  topik_idx INTEGER NOT NULL, selesai BOOLEAN DEFAULT FALSE, updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (nama, modul_id, topik_idx));

CREATE TABLE IF NOT EXISTS modul_topik_nama (
  id SERIAL PRIMARY KEY, modul_id VARCHAR(20) NOT NULL, topik_idx INTEGER NOT NULL,
  nama TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW(), updated_by VARCHAR(100),
  UNIQUE (modul_id, topik_idx));
