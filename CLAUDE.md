# Creanimasi Internal Hub — Konteks Proyek (v2.0)

## Tentang Creanimasi Studio
Studio VTuber model, illustrasi anime, VRM, AR filter, 3D print.
Platform: Fiverr, VGen, Etsy. Owner: Mas Kholed.
Tim inhouse ~17 orang aktif (24 akun tercatat di hub_users, 7 nonaktif/offboarded) + remote,
tersebar di beberapa entitas/brand: Creanimasi Studio, Creillustra, Shuyou, Flip Studio.

## Stack Teknologi
- Frontend: React + React Router di ~/Documents/creanimasi-hub
- Backend: Node.js di ~/Documents/creanimasi-hub/backend (hub.js + server.js) — BUKAN di
  project "creanimasi-fiverr-project-manager-main - v28" seperti dokumentasi versi lama
  (project itu adalah aplikasi terpisah "CRM_Creanimasi", di-deploy ke crm.creanimasi.com)
- Database: PostgreSQL lokal: creanimasi_hub_dev / production: Coolify (163.61.44.177)
- Hosting: Coolify v4 di 163.61.44.177:8000
- OS: Zorin Linux (Ubuntu based)

## Struktur Project Frontend
```
src/
  components/
    Sidebar.jsx        — navigasi role-based (admin 16 item, member 9 item)
    Layout.jsx         — wrapper dengan topbar, hamburger mobile, notification bell
    FormJurnal.jsx     — form jurnal (auto-detect nama dari login)
    FormProfiling.jsx  — form profiling 5 divisi (auto-detect nama & divisi)
  pages/
    Dashboard.jsx      — dual dashboard: admin (real-time DB) & member (personal)
    Tim.jsx            — character cards gaming UI + filter/search + popup modal
    ManajemenTim.jsx   — CRUD tim: tambah/edit/nonaktifkan/reset password
    Login.jsx          — halaman login gaming-style
    Profil.jsx         — profil user + ganti password + edit info + riwayat profiling
    Kalender.jsx       — kalender kegiatan tim (visual bulanan)
    FormPages.jsx      — PageFormJurnal, PageFormProfiling, PageRiwayatJurnal
    Pages.jsx          — Modul, Jurnal, SOP, Reward, Workshop, Kader, SKB,
                         FridayWin, OneOnOne
  hooks/
    useAuth.js         — JWT auth context (login/logout/me)
    useDarkMode.js     — dark mode tersimpan ke DB per user
    useNotifications.js — polling notifikasi tiap 5 menit
  data/
    tim.js             — data 22 anggota (17 aktif) + hitungLama() otomatis dari tanggal
  services/
    api.js             — semua call ke backend /api/hub (40+ methods)
  utils/
    exportCsv.js       — utility download CSV
```

## API Backend
Base URL lokal: http://localhost:3001/api/hub
Base URL prod:  http://163.61.44.177:3001/api/hub

Semua endpoint WAJIB Auth: `Authorization: Bearer <token>`
Kecuali: POST /auth/login

Endpoint: auth/login|me|password|tema, jurnal, profiling/:divisi|all|me,
reward, skb, tim, modul-topik, workshop, friday-win, sesi-1on1, revenue,
dashboard, profil/update, tim/:id/reset-password

## Database Tables (PostgreSQL: creanimasi_hub_dev / production: creanimasi_hub — 28 tabel)
hub_users, jurnal_mingguan, profiling_admin/pm/illustrator/rigger/3d,
tim, modul_topik, modul_topik_nama, modul_progress, workshop_kehadiran, friday_win, sesi_1on1,
revenue_bulanan, reward_tracking, skb, absensi_kehadiran, absensi_sesi,
laporan_harian, laporan_mingguan, laporan_akun, laporan_sdm, laporan_admin_mingguan,
meta_ads_brands, meta_ads_insights, meta_ads_reports, meta_ads_thresholds

Catatan soal migrasi yang tidak lengkap:
- `hub_users` dan `modul_topik_nama` **tidak punya CREATE TABLE di manapun di repo ini**
  (bukan di `schema.sql`, migrasi, maupun IIFE auto-migration `hub.js`) — berarti dibuat manual
  langsung di production. `hub_users` sudah saya rekonstruksi strukturnya ke
  `database/migration_hub_users.sql` (2026-09-15, dicek langsung ke DB production).
  `modul_progress` disebut di kolom `data/tim.js`-adjacent tapi tidak ditemukan referensinya
  sama sekali di `backend/hub.js` — kemungkinan tabel sisa dari fitur yang sudah tidak dipakai.
- `absensi_kehadiran`/`absensi_sesi` ADA di `database/migration_absensi.sql` **dan** dibuat ulang
  (idempotent, `IF NOT EXISTS`) oleh IIFE di `hub.js` — redundan tapi tidak masalah.
- `meta_ads_*` dan kolom `request_1on1`/`catatan_request` di `jurnal_mingguan` **hanya** dibuat
  lewat IIFE auto-migration di `backend/hub.js` (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ...
  ADD COLUMN IF NOT EXISTS` yang jalan otomatis tiap kali server start) — tidak ada file SQL-nya,
  tapi ini "by design", bukan gap.

## Modul RPG / Gamifikasi (backend/rpg.js + src/modules/rpg)
Terdaftar dari `hub.js` (`require('./rpg')(router, {...})`), endpoint `/api/hub/rpg/*`. Tabel `rpg_*` dibuat
otomatis (IIFE `CREATE TABLE IF NOT EXISTS` di rpg.js): `rpg_xp_event` (ledger XP, UNIQUE tim_id+sumber+ref_key →
idempoten), `rpg_quest`, `rpg_quest_assignment`, `rpg_achievement`, `rpg_achievement_unlock`.
- **Semua angka aturan** (XP per aktivitas, kurva level, stage, title, tanggal mulai `RPG_MULAI`) ada di objek
  `CONFIG` di atas `backend/rpg.js`. Level tidak disimpan — selalu dihitung dari total XP ledger.
- XP otomatis dari data terverifikasi (`syncXp`, maks 1×/60 dtk, dipanggil lazy saat endpoint dibaca): laporan
  harian, jurnal mingguan, absensi hadir/terlambat, Friday Win diterima, dan quest yang **disetujui admin**.
  Centang mandiri (workshop/modul) sengaja tidak dihitung. Pencocokan `LOWER(TRIM(nama))` ke `tim.nama`.
- Hak akses: halaman anggota `/rpg/character|quests|guild|achievements` = baseline (semua login); `rpg-admin`
  (`/rpg/kelola`: quest, persetujuan, achievement manual) dan `rpg-analytics` = admin-tier via Master Data.
- `tim.tipe`/`kepuasan` TIDAK pernah dikirim ke endpoint anggota (hanya `distribusi tipe` di analytics admin).
- Akun tanpa tautan ke `tim` → endpoint anggota 404 → UI menampilkan "Belum terhubung".

## Sistem Role & Akses
**Admin (kholed/admin123):** Semua halaman + edit modul/workshop/SKB review/reset PW
**Member (username/creanimasi123):** Dashboard, Modul divisi sendiri, Isi Jurnal,
Riwayat Jurnal, Profiling, SOP, Ajukan SKB, Profil & Ganti Password

## Data Tim (22 baris di tabel `tim`, disinkron dari production 2026-09-15)
**Aktif (17):**
| Nama | Divisi | Level | Tipe | Entitas |
|------|--------|-------|------|---------|
| Ariel Tegar | Admin | Senior | Rising Star | Creanimasi Studio |
| Ryan Cavallera | Admin | Senior | Rising Star | Creillustra |
| Nanda Cahya Bintang | Admin | Junior | High Potential | Creanimasi Studio |
| Dina Syavina | PM | Senior | High Potential | Creanimasi Studio |
| Tsania Lathifa | PM | Junior | Rising Star | Creanimasi Studio |
| Ahmad Fathurrahman | Rigger | Senior | Rising Star | Creanimasi Studio |
| Raynar Harits | Rigger | Senior | Silent Expert | Creillustra |
| Aditya Tri Prakoso | Illustrator | Senior | High Potential | Creanimasi Studio |
| Noval Faqihudin Zaky | Illustrator | Senior | High Potential | Creanimasi Studio |
| Galang Ramadhan | Illustrator | Junior | Silent Expert | Creanimasi Studio |
| Ridho Ramadhan | 3D Modeler | Junior | Rising Star | Creanimasi Studio |
| davian | Admin | Magang/Probation | Rising Star | Creanimasi Studio |
| nindi | Admin | Magang/Probation | — | Creanimasi Studio |
| Vitto Ramadani | Desainer | Junior | — | Creanimasi Studio |
| Azzahra Nadienta | PM | Senior | — | Creanimasi Studio |
| Sigit Setyawan | 3D Modeler | Magang/Probation | Rising Star | Creanimasi Studio |
| Aryo Cahyono | 3D Modeler | Senior | — | Creanimasi Studio |

**Nonaktif/offboarded (5, login dinonaktifkan):** Andini Dyah Paramastri (Admin, Shuyou),
Elenesya Sasmariza (Admin, Flip Studio), Risma Wulandari (Admin, Flip Studio),
Maheswara Artha Kumara Gautama (PM, Shuyou), Rizky Himawan Aria Wicaksa (3D Modeler, Shuyou)

**Admin login (2):** kholed (Mas Kholed), mietsaq (Mietsaq Husain)

Data lengkap tersinkron di `src/data/tim.js`. Field naratif (semangat/energi/target/mentor)
di tabel `tim` production sudah default "-" untuk semua orang — data itu sekarang hidup di
tabel `profiling_*`, bukan di `tim` lagi.

## Fitur Utama v2.0
- Auth JWT + role-based routing + global authMiddleware di semua endpoint
- Mobile responsive: sidebar drawer + hamburger button
- Notification bell: polling 5 menit, badge unread count
- Dark mode tersimpan ke DB per user
- Modul belajar per-topik checkbox (14 topik real per divisi)
- Workshop JRUHUB: kehadiran per anggota per sesi
- Jurnal: auto-detect nama + admin view DB + riwayat member
- SKB workflow: draft → diajukan → disetujui/ditolak → selesai
- Friday Win feed + Sesi 1-on-1 logging
- Revenue tracking bulanan + Reward tracking form
- Kalender kegiatan tim visual + Export CSV + Print laporan
- Onboarding banner member baru + Password reset admin
- Lama bergabung dihitung otomatis dari tanggal bergabung
- Metrik utama: Skill Teknis, Komunikasi, Kriteria PILAR, Kepuasan Diri

## Konvensi Kode
- Warna: --green #00D68F (dark) / #1D9E75 (light)
- Font: Inter; CSS variables dari index.css
- Data statis: src/data/tim.js (RAW_TIM + hitungLama())
- API calls: src/services/api.js

## Cara Deploy ke Coolify
1. `npm run build` — pastikan Compiled successfully
2. `git push origin master` — Coolify auto-deploy
3. Build command: `npm run build`
4. Publish dir: `build`
5. Env var: `REACT_APP_API_URL=http://163.61.44.177:3001/api/hub`
6. Backend hub.js harus jalan di server port 3001

## Cara Jalankan Lokal
```bash
# Frontend (port 3000)
cd ~/Documents/creanimasi-hub && npm start

# Backend (port 3001)
cd ~/Documents/"creanimasi-fiverr-project-manager-main - v28"/server && node server.js
```
