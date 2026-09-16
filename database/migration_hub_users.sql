-- Tabel hub_users — sebelumnya cuma ada di database production (tidak tercatat di migrasi manapun).
-- Kolom disusun berdasarkan seluruh referensi `hub_users` di backend/hub.js.
CREATE TABLE IF NOT EXISTS hub_users (
  id          SERIAL PRIMARY KEY,
  nama        VARCHAR(100) NOT NULL,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  password    TEXT         NOT NULL,
  role        VARCHAR(20)  NOT NULL DEFAULT 'member',
  aktif       BOOLEAN      NOT NULL DEFAULT TRUE,
  tim_id      INTEGER REFERENCES tim(id),
  tema        VARCHAR(10)  DEFAULT 'dark',
  last_seen   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
