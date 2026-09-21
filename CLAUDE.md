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

## Ads Performance & Laporan Ads Mingguan (backend/hub.js bagian META ADS + src/pages/LaporanAdsMingguan.jsx)
- **Token Meta per brand**: kolom `meta_ads_brands.token_env` = NAMA env var (harus berawalan `META_ACCESS_TOKEN`; kosong = pakai
  `META_ACCESS_TOKEN`). Token TIDAK disimpan di DB. Tiap token baru = env var baru di Coolify + redeploy backend.
- **Mata uang**: `spend`/`cpm` disimpan mentah (mata uang ad account, terdeteksi ke `meta_ads_brands.mata_uang` saat sync).
  Semua query membacanya lewat `KURS_KE_IDR` (akun USD × `kurs_usd` brand; selain itu dianggap IDR). Jangan baca `i.spend` mentah.
- **Laporan Ads Mingguan** (`/laporan-ads-mingguan`, kunci akses = `ads-performance`, belum punya kunci sendiri): selalu 4 minggu
  per bulan. **Periode tiap minggu** = 4 rentang tanggal `laporan_ads_bulan.rentang` (JSONB; NULL = bawaan 1–7, 8–14, 15–21,
  22–akhir bulan). Bisa diatur per bulan (mulai tgl berapa pun, boleh melewati akhir bulan); validasi `cekRentang` (hub.js) dan
  `utils/periodeMinggu.js` (frontend) harus dijaga sama: berurutan, tak tumpang tindih, tiap rentang ≤ 31 hari. Tumpang tindih dengan
  bulan tetangga hanya peringatan; `saran_lanjut` menawarkan mulai sehari setelah Minggu 4 bulan lalu. Angka otomatis dihitung
  `hitungAngkaLaporanAds(brand, bulan, rentang)` (sumber tunggal: GET, `POST .../hitung` saat periode diedit, dan pembekuan arsip);
  isian manual di `laporan_ads_bulan`, gambar di `laporan_ads_gambar` (diunggah satu-satu, dikompres di browser).
- **Riwayat PDF** (`laporan_ads_arsip`/`_file`/`_log`): tiap Download PDF mengunggah PDF mentah (`application/pdf`, maks 15 MB) ke
  `POST /meta-ads/laporan-ads/arsip`; server membekukan angka dari DB (bukan dari klien). Maks 3 versi terbaru per brand+bulan+minggu
  (sisanya soft delete otomatis). Hapus manual hanya admin (`req.user.role === 'admin'`). Unduhan tercatat di log.
- **Batas upload (PENTING)**: proxy nginx di depan backend membatasi body request **1 MB** (terbukti di production: ≤ 900 KB lolos,
  ≥ 1,1 MB → 413 HTML nginx). `client_max_body_size` di `nginx.conf` repo TIDAK berlaku di production (Coolify tidak memakai file itu;
  konfigurasi nginx production ada di pengaturan Coolify). Karena itu **PDF Riwayat diunggah per potongan ≤ 700 KB**
  (`POST .../arsip/unggahan` → `PUT .../bagian/:n` → `POST .../selesai`, tabel sementara `laporan_ads_unggahan*`) dan gambar laporan
  dikompres ≤ ~900 KB — JANGAN membuat request tunggal > 1 MB. `POST .../arsip` (sekali-kirim) tetap ada tapi tidak dipakai frontend.
- Ekspor PDF di browser (`html2canvas` + `jsPDF`): html2canvas mengabaikan `object-fit` dan `repeating-linear-gradient` — di `SlideDeck.jsx`
  maskot memakai `background-image` dan grid latar memakai pola SVG karena itu.

## Modul RPG / Gamifikasi (backend/rpg.js + src/modules/rpg)
Terdaftar dari `hub.js` (`require('./rpg')(router, {...})`), endpoint `/api/hub/rpg/*`. Tabel `rpg_*` dibuat
otomatis (IIFE `CREATE TABLE IF NOT EXISTS` di rpg.js): `rpg_xp_event` (ledger XP, UNIQUE tim_id+sumber+ref_key →
idempoten), `rpg_quest`, `rpg_quest_assignment`, `rpg_achievement`, `rpg_achievement_unlock`.
- **Semua angka aturan** (XP per aktivitas, kurva level, stage, title, tanggal mulai `RPG_MULAI`) ada di objek
  `CONFIG` di atas `backend/rpg.js`. Level tidak disimpan — selalu dihitung dari total XP ledger.
- XP otomatis dari data terverifikasi (`syncXp`, maks 1×/60 dtk, dipanggil lazy saat endpoint dibaca): laporan
  harian, jurnal mingguan, absensi hadir/terlambat, Friday Win diterima, dan quest yang **disetujui admin**.
  Centang mandiri (workshop/modul) sengaja tidak dihitung. Pencocokan `LOWER(TRIM(nama))` ke `tim.nama`.
- Hak akses: SEMUA 6 halaman diatur lewat Master Data > Hak Akses/Role (grup "Guild"): 4 halaman anggota
  (`rpg-character|rpg-quests|rpg-guild|rpg-achievements`, default TRUE untuk semua role — dulu baseline) dan 2 halaman
  admin (`rpg-admin` = /rpg/kelola, `rpg-analytics`, default hanya Super Admin). Endpoint anggota memakai
  `requirePageAccess`; /rpg/character menyaring panel Quest/Guild/Pencapaian sesuai akses (`data.akses`).
  Migrasi di IIFE master hub.js: beri semua role akses dulu, baru lepas flag baseline (satu transaksi, tidak menimpa
  pencabutan admin saat restart).
- **Pantau Anggota** (`/rpg/anggota`, kunci akses `rpg-pantau`, default hanya Super Admin, bisa didelegasikan lewat matriks):
  hanya-baca. Daftar semua anggota aktif + detail per anggota (kartu karakter/stat/quest/pencapaian dibangun oleh fungsi
  yang SAMA dengan milik anggota → identik) + asal XP per sumber + "aktivitas tak dikenali" (nama di laporan/jurnal/
  absensi/Friday Win yang tak cocok dengan anggota mana pun → tak menghasilkan XP; biasanya salah ketik).
- **Papan Quest admin (Kanban)**: menu Papan Quest untuk pemegang `rpg-admin`/`rpg-pantau` menampilkan satu KOLOM per anggota,
  kartu = penugasan quest dengan status di dalam kartu (urut: Menunggu → Perlu perbaikan → Aktif → Selesai terlipat, 30 hari).
  Filter divisi/cari/tipe/status di state React (URL sebagai cermin), kolom anggota tanpa kartu disembunyikan. Data:
  `GET /rpg/admin/papan` (baca: rpg-admin ATAU rpg-pantau; hanya-baca). Setujui/tolak dari kartu memakai
  `PATCH /rpg/admin/assignments/:id` (rpg-admin saja, transaksi + 409 bila sudah diproses). Admin TIDAK bisa memindahkan
  status Aktif/Diajukan (itu hak anggota). Akun tanpa tautan tim punya sakelar "Papan saya" (pesan netral).
- **Urgensi quest 1–7** (`rpg_quest.urgensi`, SMALLINT NOT NULL DEFAULT 4, CHECK 1–7; 7 = paling mendesak; nama: Santai,
  Rendah, Agak rendah, Normal, Tinggi, Mendesak, Kritis). Konstanta `URGENSI_*` di `CONFIG` rpg.js; daftar nama/keterangan +
  warna (`--rpg-urg-1..7`, skala panas, semua ≥4,5:1) di `src/modules/rpg/utils/urgensi.js` + `rpg-tokens.css`. TIDAK
  memengaruhi XP. Memengaruhi urutan (papan anggota & kartu Kanban non-Selesai: urgensi desc) dan filter Kanban "Urgensi ≥ N"
  (`?urg=`). Warna = saluran terpisah dari warna status; angka + batang sinyal (`UrgensiChip`) adalah isyarat utama karena
  beberapa pasangan warna berdekatan bagi penderita buta warna. Jangan beri `opacity` pada baris yang berisi teks (menurunkan
  kontras di bawah 4,5:1).
- **Target poin produksi** (`backend/rpg_target.js`, angka di `CONFIG.TARGET` rpg.js): tim produksi (Illustrator, Rigger,
  3D Modeler, Desainer) punya target poin per PERIODE = tanggal 28 bulan lalu s/d 27 bulan ini (WIB; kode periode = bulan
  tanggal 27, mis. `2026-09` = 28 Agu–27 Sep). Poin = XP quest yang DISETUJUI (dari ledger `rpg_xp_event`, jadi edit XP quest
  belakangan tak mengubah hasil lama), dihitung menurut tanggal DIAJUKAN (admin telat meninjau tak merugikan anggota); BUKAN XP
  otomatis dari laporan/jurnal/absensi. Target diatur admin per divisi × level (`rpg_target_poin`; level `*` = semua level;
  level dipetakan dari teks `tim.level` lewat `levelKey`, tahan ejaan "Magang/Probation" vs "Magang / Probation"); tanpa angka
  = "tanpa target" (poin tetap dicatat). Penyesuaian per orang per periode: `rpg_target_override` (target khusus atau
  dikecualikan). Status: tercapai (poin ≥ target) / belum / tanpa_target / dikecualikan; selama berjalan "belum" dipecah
  sesuai jalur / tertinggal (bandingkan persen dengan hari berjalan). Setelah tanggal 27 periode "menunggu kunci" (hasil
  sementara, masih dihitung langsung); admin menekan Kunci, atau otomatis 6 hari setelah tutup (tgl 3) lewat cron 00:10 WIB +
  pemicu malas saat endpoint dibaca. Kunci = potret ke `rpg_periode_hasil` (target saat itu dibekukan; transaksi + FOR UPDATE →
  tak ganda). "Buka kembali" menghapus potret, menahan kunci otomatis, dan mencabut lencana target (dievaluasi ulang dari periode
  lain). Periode sebelum `RPG_MULAI` tak pernah dihitung/dikunci. Endpoint: anggota `GET /rpg/target` (rpg-quests) & papan
  terbuka penuh `GET /rpg/target/papan` (rpg-guild, urut PERSEN target, bukan poin mentah); admin `/rpg/admin/target[...]`
  (rpg-admin; rekap juga untuk rpg-pantau, hanya-baca). `?periode=sebelumnya` yang belum ada → 200 `data:null`. Lencana:
  `targethit`, `target120`, `targetstreak` (3 periode beruntun), `bintang` (peringkat 1) — terbuka hanya dari periode TERKUNCI.
  UI: kartu di Papan Quest anggota (`TargetCard`, komponen sama dipakai Pantau), tab "Target Produksi" di Guild Hall (`?tab=target`),
  tab "Target" di Kelola RPG (`?tab=target`), mini progress di header kolom Kanban, notifikasi (pengingat sisa ≤7/≤3 hari,
  tercapai, hasil periode lalu di 10 hari pertama, admin: periode menunggu kunci). Status selalu berteks (bukan hanya warna).
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
7. **`DATABASE_URL` di Coolify HARUS memakai NAMA container Postgres (`w0cowk8gs8cs8ocs8o0scww8`), BUKAN IP** (mis. 10.0.1.x).
   IP di jaringan `coolify` dibagikan dinamis: pada deploy 2026-09-21 container backend baru mengambil `10.0.1.4` — IP yang
   tertulis di env — sehingga backend menyambung ke dirinya sendiri (`ECONNREFUSED 10.0.1.4:5432`, login 500). Postgres sendiri
   ada di `10.0.1.8` dan tak pernah bermasalah. Diperbaiki dengan mengganti host di env (entri non-Preview) lalu deploy ulang.
   Cek cepat setelah deploy: `docker logs <container>` tanpa `ECONN`/`Migration ... startup:`; login palsu → 401 (bukan 500).
   Grep verifikasi jangan hanya `error|gagal` — galat migrasi berbunyi "Migration ... startup: connect ECONNREFUSED".

## Cara Jalankan Lokal
```bash
# Frontend (port 3000)
cd ~/Documents/creanimasi-hub && npm start

# Backend (port 3001)
cd ~/Documents/"creanimasi-fiverr-project-manager-main - v28"/server && node server.js
```
