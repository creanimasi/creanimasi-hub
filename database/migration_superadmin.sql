-- Tambah tingkat "superadmin" TANPA mengubah role existing ('admin'/'member').
-- Superadmin = hub_users dengan role='admin' DAN is_superadmin=TRUE.
-- Kenapa flag, bukan role baru: supaya tidak perlu ubah semua pengecekan
-- `req.user.role !== 'admin'` yang sudah tersebar di backend/hub.js —
-- superadmin otomatis lolos semua itu (role-nya tetap 'admin'), dan cuma
-- endpoint ubah-role (PATCH /tim/:id) yang butuh pengecekan tambahan.
ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;
