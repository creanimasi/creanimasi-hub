-- Master Data — sistem role generik & matriks akses per halaman.
-- Dijalankan otomatis lewat IIFE di backend/hub.js (lihat komentar
-- "MASTER DATA: ROLE & HAK AKSES HALAMAN"), file ini murni dokumentasi
-- (mengikuti pola migration_superadmin.sql / migration_hub_users.sql).
--
-- Menggantikan sistem role biner lama (hub_users.role = 'admin'|'member'
-- + flag is_superadmin) dengan 6 role generik (super_admin, founder,
-- mentor, admin_market, pm, anggota) dan matriks akses per halaman yang
-- bisa diatur dari UI (Master Data > Hak Akses/Role), tanpa perlu deploy
-- kode setiap kali role/akses berubah.
--
-- Kolom hub_users.role (varchar) dan is_superadmin TIDAK dihapus — masih
-- ada untuk kompatibilitas/riwayat, tapi sudah tidak dipakai untuk
-- otorisasi apa pun. Sumber kebenaran otorisasi sekarang: hub_users.role_id
-- + tabel role_page_access.

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  key VARCHAR(30) NOT NULL UNIQUE,               -- super_admin | founder | mentor | admin_market | pm | anggota
  nama VARCHAR(50) NOT NULL,
  is_protected BOOLEAN NOT NULL DEFAULT FALSE,   -- true hanya untuk super_admin
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS halaman (
  id SERIAL PRIMARY KEY,
  page_key VARCHAR(50) NOT NULL UNIQUE,
  nama VARCHAR(100) NOT NULL,
  route_path VARCHAR(100) NOT NULL,
  is_baseline BOOLEAN NOT NULL DEFAULT FALSE,    -- true = semua role otomatis akses (Dashboard, Profil, dst)
  urutan INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS role_page_access (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  page_key VARCHAR(50) NOT NULL REFERENCES halaman(page_key) ON DELETE CASCADE,
  can_access BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(role_id, page_key)
);

ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);
ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS email VARCHAR(120);
ALTER TABLE tim ADD COLUMN IF NOT EXISTS tanggal_lahir DATE;

-- Migrasi data existing (zero regression di hari deploy):
--   role='admin' (superadmin ataupun bukan) -> role_id super_admin
--   role='member'                            -> role_id anggota
-- Semua admin existing (superadmin maupun bukan) punya akses identik ke
-- seluruh halaman admin-tier hari ini — cuma beda di boleh-tidak
-- mengangkat admin baru. Supaya tidak ada satu akun pun kehilangan akses
-- saat fitur ini deploy, semua tetap dapat akses penuh via super_admin.
-- Reassign spesifik ke Founder/Mentor/Admin Market/PM dilakukan manual oleh
-- Super Admin lewat Master Data > Manajemen User setelah deploy — pemetaan
-- siapa dapat role apa adalah keputusan bisnis, bukan sesuatu yang bisa
-- ditebak dari kode (lihat PRD bagian 10 poin 1).
