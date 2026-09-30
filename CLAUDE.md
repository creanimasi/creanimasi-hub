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

## Papan Timeline (backend/timeline.js + src/pages/Timeline.jsx)
Pengganti spreadsheet timeline manual (referensi: kolom NAMA/NAMA KLIEN/POIN/URGENSI per tim). SENGAJA terpisah total
dari modul RPG — poin & urgensi di sini murni catatan manual, TIDAK terhubung ke XP/target poin sama sekali.
- **Struktur 3 tingkat**: `timeline_grup` (mis. "Internal", "Freelance 3D" — 2 baris awal di-seed HANYA saat tabel
  masih benar-benar kosong, `WHERE NOT EXISTS`, BUKAN `ON CONFLICT` per baris — supaya menghapus satu grup bawaan
  tidak "hidup lagi" tiap restart selama grup lain masih ada) > `timeline_orang` (nama bebas teks — freelancer TIDAK
  perlu ada di tabel `tim`; `tim_id` opsional buat menautkan staf internal, ikut membawa `tim_divisi` sebagai badge;
  `warna` hex opsional, kosong = palet otomatis dari indeks urutan) > `timeline_tugas` (deskripsi bebas teks + `poin`
  opsional + `urgensi` opsional). Urutan tiap tingkat lewat kolom `urutan` + endpoint `POST .../pindah {arah}` (tukar
  dengan tetangga se-induk, transaksi + `FOR UPDATE`).
- **Urgensi 1-4, ARAH KEBALIKAN dari RPG**: 1 = paling mendesak (merah) … 4 = paling santai (hijau tua) — RPG 1-7
  arahnya sebaliknya (7 = paling mendesak). Definisi di `src/utils/timelineUrgensi.js`; token warna `--tl-urg-1..4`
  di `index.css` (root + override `[data-theme="light"]`; retro ikut nilai root). Dipakai sebagai LATAR PENUH pada
  `<select>` urgensi (badge, meniru referensi spreadsheet asli — bukan lagi teks-berwarna-di-atas-latar-polos dari
  versi tabel awal), makanya butuh token teks terpisah `--tl-urg-on` (warna teks DI ATAS badge, beda per tema:
  `#0A0E14` gelap untuk dark/retro karena `--tl-urg-*` di sana terang, `#FFFFFF` untuk light karena di sana gelap)
  — jangan pakai `teksKontrasHex()` (fungsi lama, masih diekspor tapi tak dipakai lagi di sini) untuk ini, itu untuk
  warna kustom pita bebas-pilih, bukan token tema yang sudah tetap.
- **Satu kunci akses** `timeline` (admin-tier baru) untuk BACA dan TULIS sekaligus — beda dari pola RPG yang punya
  `rpg-admin`/`rpg-pantau` terpisah, karena halaman ini memang cuma untuk admin/PM yang mengelola bareng, bukan model
  lihat-saja. Default `MATRIX.pm` di hub.js sudah memuat `'timeline'`; `super_admin` otomatis penuh via `ALL_ADMIN_KEYS`.
- **UI** (satu file `Timeline.jsx`, gaya tabel `.card`/`<table>` mengikuti konvensi `AdsPerformance.jsx` — BUKAN
  tema pixel RPG): satu `<table>` per grup, sel Nama memakai `rowSpan` menyatu ke bawah sepanjang baris tugas
  orang itu (border kiri = warna pita). Isian polos tanpa garis (`selInput`, meniru rasa mengetik langsung di sel
  spreadsheet). Sel Nama sengaja dibuat SESEDERHANA gambar referensi (nama teks polos, tanpa avatar/badge yang
  selalu tampil): tautan ke `tim` (badge divisi) dan pemilih warna pita kustom dipindah ke balik tombol "⋯"
  (state lokal `showDetail` di `SelOrang`, tersembunyi secara default) — hanya terlihat saat diklik, supaya baris
  utama tetap bersih. Tombol pindah/hapus per baris (tugas & orang) diberi `className="tl-row-actions"`
  (`index.css`, `opacity: .95` diam → `1` saat `tr:hover`/`tr:focus-within`) supaya tabel tidak ramai saat tak
  disorot tapi tetap terlihat (BUKAN `.45` seperti percobaan pertama — glyph teks kecil `⋯ ↑ ↓ ✕` di opacity
  serendah itu jatuh di bawah kontras WCAG 4.5:1, terutama `✕` merah di tema dark; `.95` adalah titik teraman
  yang masih lolos audit di 3 tema, jadi JANGAN diturunkan lagi tanpa re-audit kontras).
  **Jebakan Playwright yang sudah kena**: (1) pada baris tugas PERTAMA milik satu orang, `<tr>`-nya SEKALIGUS
  memuat sel Nama (rowspan, punya `.tl-row-actions` MILIK ORANG) DAN `.tl-row-actions` milik tugas baris itu
  sendiri — scope ke `.tl-row-actions` di dalam `<tr>` itu ambigu (2 elemen). Urutan DOM selalu [aksi-orang
  (kalau ada), aksi-tugas] → `.locator('.tl-row-actions').last()` aman dipakai seragam di baris manapun (dengan
  atau tanpa sel Nama), jangan `.first()`. (2) kontrol di balik "⋯" (select tautan tim, color picker) tidak ada
  di DOM sampai tombol diklik dulu — `getByLabel(...).count()` harus 0 sebelum klik, baru bisa diisi sesudahnya.
  (3) warna latar (`background`) di-set di tiap `<td>`, BUKAN di `<tr>` induknya — `getComputedStyle(tr)` selalu
  `rgba(0,0,0,0)`, harus baca salah satu `<td>` anaknya.
  Semua field tersimpan otomatis saat blur/onChange (pola sama dengan `TargetAdmin.jsx`); hapus grup/orang pakai
  `window.confirm` native (cascade — grup menghapus semua orang & tugas di dalamnya). State `versi` (naik tiap
  `muat()` selesai, termasuk saat GAGAL) dilewatkan ke tiap child sebagai dependensi efek reset — supaya input
  yang sempat diubah lokal tapi DITOLAK server (mis. poin di luar 0–999) kembali ke nilai server yang sebenarnya,
  bukan tertinggal menampilkan nilai tak tersimpan (prop mentahnya sendiri bisa saja tak berubah dari percobaan
  yang gagal).
- **Tampilan "sama persis spreadsheet referensi" (rework kedua)**: setiap `<td>` milik satu blok orang (sel Nama
  + semua sel tugasnya, termasuk baris "+ tugas") berbagi SATU warna latar PENUH lewat `warnaLatarOrang(o, indeks)`
  (`utils/timelineUrgensi.js`) — bukan cuma garis aksen di sel Nama seperti rework pertama. Tanpa `o.warna`:
  pakai `paletOtomatis(indeks).bg` (6 token `-light` yang sudah ada, dipakai juga sebagai badge di `data/tim.js` —
  opak pastel di tema light, tint alpha 12% di tema dark/retro). Dengan `o.warna` (hex bebas dari color picker):
  DIUBAH jadi tint `rgba(r,g,b,0.12)` (BUKAN warna penuh) — supaya `var(--text)` di atasnya tetap terbaca untuk
  hex APA PUN tanpa perlu tabel kontras per warna (beda dari `teksKontrasHex()` yang masih diekspor tapi tak
  dipakai di jalur ini). Tiap `<tr>` tugas + baris "+ tugas" diberi `data-orang-id={o.id}` (dan `<td rowSpan>`
  Nama juga) khusus untuk mempermudah scoping Playwright yang presisi tanpa bergantung pada urutan DOM.
  Header kolom + banner judul "TIMELINE <NAMA GRUP>" (menggantikan `.card-title` polos) memakai warna TETAP
  (bukan per-tema) `--tl-banner-bg`/`--tl-banner-text` (`index.css`, #C0392B/#FFFFFF, putih di atasnya dihitung
  5,44:1 — aman di 3 tema sekaligus karena ini warna brand halaman, bukan token semantik yang perlu ikut tema).
  Tombol di dalam banner (pindah/hapus grup) SENGAJA dipakai apa adanya (`BtnIcon` biasa, TANPA varian warna
  khusus) — latar `.btn` (`var(--surface-2)`) sudah opak jadi otomatis kontras cukup di atas banner merah apa
  pun temanya; sempat dicoba kasih latar kaca tembus pandang (`rgba(255,255,255,.14)`) supaya "menyatu" dengan
  banner tapi itu MEMBUAT kontrasnya gagal (glyph putih di atas merah yang sudah tercampur RGBA putih jadi lebih
  terang, ratio turun di bawah 4,5:1) — jangan diulangi.
- **Nama ditengahkan, bisa membungkus 2 baris**: field Nama di `SelOrang` pakai `<textarea rows={2}>` (BUKAN
  `<input>` — input tak bisa wrap ke baris baru), 14px bold `textAlign:'center'`, `resize:'none'`, mengisi sisa
  tinggi blok orang lewat flex-column pada `<td>` (bukan `verticalAlign` — konten dipecah 3 baris flex: tombol
  aksi di atas, nama di tengah `flex:1`, panel "⋯" di bawah kalau terbuka). Sempat dicoba 18px dalam `<input>`
  (nama panjang jadi 1 baris kepotong/menggeser tata letak) — diganti `<textarea>` supaya nama panjang otomatis
  membungkus 2 baris alih-alih terpotong. Enter tetap menyimpan (blur) BUKAN bikin baris baru manual
  (`e.preventDefault()` di `onKeyDown`), biar wrap-nya murni dari CSS, bukan `\n` literal di data.
- **Papan grid 2 kolom** (`Timeline()`, bukan lagi kartu bertumpuk penuh-lebar): `gridTemplateColumns:
  repeat(auto-fit, minmax(min(700px,100%), 1fr))` — ambang 700px (BUKAN lebih kecil mis. 480px) SENGAJA sedikit
  di atas lebar minimum satu tabel (±650px: Nama `width` TETAP 150 — sempat 170 lalu `minWidth`, lalu 130, tapi
  `minWidth` saja tetap dibiarkan browser melebar mengambil sisa ruang tabel karena tak ada `width` sebagai
  batas atas; `width` tetap memaksanya sesempit itu, sisa ruang mengalir ke Nama Klien yang memang `minWidth`
  saja/sengaja fleksibel — + Nama Klien 220 + Poin 70 + Urgensi 118 + Aksi 84), supaya kolom baru pecah jadi 2
  kalau BENAR cukup lebar untuk kedua tabel tampil PENUH tanpa scroll horizontal internal
  — ambang lebih kecil membuat "terlihat 2 kolom" tapi tombol pindah/hapus selalu ketutup di luar layar tiap
  layar biasa (~1400px), harus discroll tiap mau dipakai. Di bawah ambang otomatis balik 1 kolom penuh-lebar
  (bagian `min(700px,100%)` mencegah overflow di ponsel). `alignItems:'start'` supaya tinggi kartu ikut isinya
  sendiri, grup ramai tak memaksa grup sebelah ikut setinggi itu. **Jebakan CSS Grid**: item grid (`.card` di
  `GrupTable`) WAJIB diberi `minWidth: 0` eksplisit — defaultnya `min-width: auto`, artinya track grid TAK AKAN
  menyusut di bawah lebar intrinsik konten di dalamnya (tabelnya), sehingga `overflowX:auto` pada div pembungkus
  tabel tak pernah aktif (kolom malah ikut melebar/konten terpotong `overflow:hidden` milik `.card`) — baru
  setelah `minWidth:0` scroll horizontal per-kartu itu benar berfungsi kalau suatu saat memang perlu.
- **Baris dipadatkan** (respons ke keluhan "8 orang harus scroll jauh ke bawah" — dihitung: 8 orang × ±5 baris
  = 41 baris, sebelum dipadatkan ±38px/baris = ±1540px, viewport laptop umum cuma ±900px, JADI TAK MUNGKIN
  "satu halaman tanpa scroll" tercapai literal selama tiap orang tetap menampilkan SLOT_AWAL 4 baris kosong —
  sudah dijelaskan ke user, padatkan baris cuma MENDEKATKAN, bukan menghilangkan scroll total). `tdStyle.padding`
  3px→1px, `selInput.padding` 5px→2px, `BtnIcon` & tombol "⋯" diberi `padding:'3px 5px'` inline (override
  `.btn-icon` bawaan 7px — aman karena `BtnIcon` cuma dipakai lokal di file ini, tak memengaruhi tombol ikon
  di halaman lain), `thStyle.padding` 7px→5px, minHeight kontainer nama 40→36. Hasil: ±38px → ±26px per baris
  (~31% lebih padat), diverifikasi lewat audit kontras ulang (ikon lebih kecil TETAP ≥4,5:1 di 3 tema — kalau
  nanti dipadatkan lagi, WAJIB re-run `kontras()` di test, jangan asumsikan otomatis aman kayak insiden
  `.tl-row-actions` opacity di rework pertama).
- **Auto-seed nama tim produksi** (migrasi `seed_tim_produksi`, tabel penanda `timeline_migrasi(kunci PK)`):
  begitu grup Internal ada, backend mengisi otomatis dengan semua anggota `tim` yang `divisi IN ('Illustrator',
  'Rigger','3D Modeler','Desainer')` (definisi SAMA dengan "tim produksi" RPG Target) DAN `aktif = TRUE` — tiap
  orang langsung dapat SLOT_AWAL (4) baris tugas kosong (lihat poin berikut). **Berjalan PERSIS SEKALI selamanya**
  (ditandai lewat INSERT `ON CONFLICT DO NOTHING RETURNING` ke `timeline_migrasi`, BUKAN dicek dari isi
  `timeline_orang` — beda dari pola 2-grup-awal di atas, karena tabel itu sudah bisa terisi entri manual dari
  pemakaian nyata sehingga guard "WHERE NOT EXISTS" tak cocok di sini). Admin bebas menghapus siapa pun sesudahnya
  tanpa "hidup lagi" tiap restart. Kalau seseorang SUDAH ditautkan manual ke `tim_id` itu di grup mana pun
  sebelum migrasi jalan (jarang, tapi mungkin), migrasi melompatinya (tak menduplikasi). Grup lain (mis.
  Freelance 3D) TIDAK pernah disentuh migrasi ini.
- **SLOT_AWAL = 4 baris tugas kosong otomatis** (`BATAS.SLOT_AWAL` di `timeline.js`): SETIAP orang baru — baik
  dari migrasi produksi di atas MAUPUN ditambah manual admin lewat `POST /timeline/orang` — langsung dapat 4
  baris (`deskripsi=''`, `urgensi=1..4` sebagai penanda urutan visual saja, BUKAN urgensi sungguhan sampai
  diisi) dalam SATU transaksi (`buatSlotAwal(client, orangId)`, dipakai baik oleh endpoint maupun migrasi).
  Insert langsung (bukan lewat `validasiTugas`) karena `deskripsi` kosong hanya boleh untuk baris PLACEHOLDER
  ini — endpoint publik tetap menolak deskripsi kosong untuk tugas yang dibuat via `KotakTambah`/PATCH biasa.
- **`timeline_tugas.tanggal_kerja`** (`DATE NULL`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`): tanggal PEKERJAAN
  itu dilakukan — BUKAN `created_at`/`updated_at` (kapan baris disentuh di sistem; PM sering entry beberapa
  hari sekaligus belakangan, jadi timestamp itu tak akurat buat rekap per-hari-kalender). Opsional, diatur
  lewat tombol "Tgl" di `.tl-row-actions` tiap baris tugas (`Timeline.jsx`) yang membuka popover
  `position:absolute` kecil (SENGAJA absolute, bukan bagian alur tabel — supaya tak memengaruhi lebar kolom
  Aksi cuma karena satu baris sedang membuka popovernya). Satu-satunya konsumen field ini: **Laporan KPI
  Artist** (bawah) — tugas berpoin TANPA `tanggal_kerja` dilewati laporan itu, tak dianggap error.

## Laporan KPI Artist (backend/laporan_kpi.js + src/pages/LaporanKpi.jsx)
Rekap poin harian tim produksi per bulan kalender — pengganti spreadsheet manual "Artist Assignment" (kolom
NAMA per artist, baris tanggal, baris KPI/Total assignment/Total Bonus). PRD lengkap (termasuk keputusan v1
& alasan tiap satu) ada di percakapan 2026-09-23, diringkas di sini.
- **Poin harian OTOMATIS dari Papan Timeline** — dijumlahkan dari kolom `poin` + `tanggal_kerja` di
  `timeline_tugas` (lihat poin di atas), dikelompokkan per tanggal & artist (`o.tim_id`). Halaman ini
  **TIDAK PUNYA** input poin manual sendiri — kalau angkanya salah, perbaikannya di Papan Timeline, bukan di
  sini. **Cakupan artist**: CUMA yang tertaut `tim_id` ke divisi produksi (Illustrator/Rigger/3D
  Modeler/Desainer) & aktif — sama persis definisi dipakai auto-seed Papan Timeline & Target Poin Produksi
  RPG. Freelancer/orang tanpa tautan tim (mis. isi manual grup "Freelance 3D") TAK PERNAH ikut hitungan
  laporan ini walau poinnya tetap valid & tercatat normal di Papan Timeline sendiri.
- **SENGAJA terpisah total dari Target Poin Produksi RPG** (`rpg_target.js`) — v1, keputusan eksplisit di PRD.
  Dua sistem hitung poin berbeda tujuan (ini: rekap harian buat bonus/payroll; RPG: gamifikasi per-periode
  28-27 dari quest disetujui) berjalan berdampingan, TAK saling baca/tulis/pengaruhi. Jangan disatukan tanpa
  keputusan eksplisit baru.
- **KPI & Total Bonus = input admin manual**, disimpan di tabel baru `laporan_kpi_target(tim_id, bulan
  VARCHAR(7) "YYYY-MM", target INT NULL, catatan TEXT NULL, total_bonus INT NULL, UNIQUE(tim_id,bulan))`.
  Endpoint `PUT /laporan-kpi/target` upsert PARSIAL (pola sama seperti PATCH tugas Papan Timeline — cuma
  field yang benar-benar dikirim yang diubah; isi Total Bonus TIDAK menimpa target yang sudah ada, dst).
  Rumus otomatis Total Bonus **belum ditentukan** — kolom disiapkan, diisi manual dulu.
- **"Salin target dari bulan lalu"** (`POST /laporan-kpi/target/salin`): copy `target`+`catatan` ke bulan
  berjalan, `ON CONFLICT DO NOTHING` (tak menimpa target yang sudah diisi manual di bulan tujuan).
  `total_bonus` SENGAJA TIDAK ikut tersalin — itu hasil bulan itu sendiri, bukan rencana yang bisa dibawa maju.
- **Kunci akses baru `laporan-kpi`** (admin-tier), default HANYA Super Admin (tak dimasukkan ke `MATRIX`
  role manapun di `hub.js`, sama pola dengan `rpg-analytics`/`rpg-admin`/`rpg-pantau`) — data berkaitan
  bonus/finansial, sengaja lebih restriktif dari `timeline`. Bisa didelegasikan lewat Master Data > Hak
  Akses seperti kunci lain. Menu sidebar masuk grup collapsible "Laporan" (`groupKey:'laporan'`, path
  ditambahkan ke `LAPORAN_PATHS` di `Sidebar.jsx` biar grup auto-expand saat halaman ini aktif).
- **UI**: grid `<table>` HTML (`Hari`/`Tgl` + satu kolom per artist), `<thead>` 2 baris (nama artist, lalu
  KPI editable), `<tbody>` satu baris per tanggal kalender penuh sebulan (baris Minggu ditandai merah, isi
  poin dikosongkan — bukan berarti tak boleh kerja, cuma tak ditampilkan biar konsisten pola libur di
  referensi), `<tfoot>` Total assignment (read-only, dihitung server) + Total Bonus (editable). **Jebakan
  Playwright**: baris KPI/Total assignment/Total Bonus punya `<td colSpan={2}>` label di depan — index
  artist ke-N di baris itu ada di posisi DOM berbeda dari posisi `<th>` di header (colSpan menghitung 1
  elemen DOM tapi 2 lebar kolom). Jangan pakai `nth-child` mentah untuk cocokkan kolom antar baris; pakai
  `.locator('td').nth(idx)` Playwright (menghitung elemen HASIL QUERY, kebal dari colSpan) dengan offset
  konsisten (+1 buat lewati td label). Juga: `<th>` diberi CSS `text-transform:uppercase` — `innerText()`
  Playwright membaca teks HASIL RENDER (ikut transform), jadi cocokkan nama artist case-insensitive.
- Navigasi SPA (`pushState`+popstate, dipakai helper uji `go()`) ke path yang SAMA seperti sekarang **TIDAK**
  memicu re-fetch (komponen tak remount, state `bulan` lokal tak berubah) — kalau butuh data benar-benar
  segar dari titik uji yang sudah di halaman itu, pakai navigasi penuh (`page.goto`/reload), bukan `go()`.

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
- **Batalkan persetujuan** (`POST /rpg/admin/assignments/:id/batalkan`, semua pemegang `rpg-admin`, BUKAN `rpg-pantau`):
  menarik kembali quest yang SUDAH disetujui (mis. salah menugaskan) — XP dihapus dari ledger (`DELETE ... rpg_xp_event`,
  bukan entri minus, supaya assignment id yang sama bisa dipakai lagi bila anggota mengajukan ulang & disetujui lagi tanpa
  bentrok UNIQUE ref_key) dan status kembali ke `ditolak` (anggota melihat "Ditolak: <alasan>", bisa ajukan ulang). Dibatasi
  `CONFIG.BATAL_MAKS_HARI` (7) hari sejak `ditinjau_pada` — transaksi + `FOR UPDATE`, 409 bila sudah lewat batas atau status
  bukan `disetujui`. Audit tersimpan di kolom baru `dibatalkan_oleh/pada`, `xp_dibatalkan` — TIDAK menimpa `ditinjau_oleh/pada`
  asli (siapa & kapan MENYETUJUI semula tetap utuh). **TIDAK mencabut achievement** yang mungkin sudah terbuka dari XP itu
  (konsisten dengan desain: achievement biasa tidak pernah dievaluasi ulang setelah terbuka — kecuali achievement TARGET,
  yang memang dicabut lewat "buka kembali periode" di rpg_target.js). Bila XP-nya sudah masuk potret periode TARGET yang
  terkunci, respons menyertakan `peringatanTarget` (string) — hasil periode itu TIDAK ikut terkoreksi otomatis, admin perlu
  membuka kembali periode itu di Kelola RPG › Target bila perlu dihitung ulang. Tombol "Batalkan persetujuan" ada di kartu
  Selesai pada Kanban (`bisaDibatalkan` dari server, disembunyikan otomatis lewat batas waktu).
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
