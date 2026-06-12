-- Migration: tambah kolom yang sudah ada di dev tapi belum ada di production
-- Aman dijalankan berkali-kali (IF NOT EXISTS) — tidak error jika kolom sudah ada.
-- Jalankan di production sebelum auto-sync skor profiling (PROFILING_TO_TIM_SKOR) di-deploy.

ALTER TABLE tim
  ADD COLUMN IF NOT EXISTS status      VARCHAR(50)  DEFAULT 'Aktif',
  ADD COLUMN IF NOT EXISTS kriteria    INTEGER      DEFAULT 3,
  ADD COLUMN IF NOT EXISTS kepuasan    INTEGER      DEFAULT 7,
  ADD COLUMN IF NOT EXISTS bergabung   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS semangat    TEXT         DEFAULT '-',
  ADD COLUMN IF NOT EXISTS energi      TEXT         DEFAULT '-',
  ADD COLUMN IF NOT EXISTS target      TEXT         DEFAULT '-',
  ADD COLUMN IF NOT EXISTS memimpin    VARCHAR(100) DEFAULT 'Belum tertarik saat ini',
  ADD COLUMN IF NOT EXISTS skill       INTEGER      DEFAULT 3,
  ADD COLUMN IF NOT EXISTS komunikasi  INTEGER      DEFAULT 3,
  ADD COLUMN IF NOT EXISTS mentor      VARCHAR(100) DEFAULT '-',
  ADD COLUMN IF NOT EXISTS entitas     VARCHAR(50)  DEFAULT 'Creanimasi Studio';
