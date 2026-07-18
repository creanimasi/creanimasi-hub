-- Migration: Fitur Absensi Tim
-- Run sekali di production: psql -d creanimasi_hub_dev -f migration_absensi.sql

CREATE TABLE IF NOT EXISTS absensi_sesi (
  id         SERIAL PRIMARY KEY,
  label      VARCHAR(200) NOT NULL,
  tanggal    DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS absensi_kehadiran (
  id         SERIAL PRIMARY KEY,
  sesi_id    INTEGER NOT NULL REFERENCES absensi_sesi(id) ON DELETE CASCADE,
  nama       VARCHAR(100) NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'tidak_hadir'
               CHECK (status IN ('hadir','terlambat','izin','sakit','tidak_hadir')),
  catatan    TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sesi_id, nama)
);

CREATE INDEX IF NOT EXISTS idx_absensi_kehadiran_sesi_id ON absensi_kehadiran (sesi_id);
