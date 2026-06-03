# Creanimasi Internal Hub — Konteks Proyek (v2.0)

## Tentang Creanimasi Studio
Studio VTuber model, illustrasi anime, VRM, AR filter, 3D print.
Platform: Fiverr, VGen, Etsy. Owner: Mas Kholed.
Tim inhouse 11 orang + remote.

## Stack Teknologi
- Frontend: React + React Router di ~/Documents/creanimasi-hub
- Backend: Node.js di ~/Documents/creanimasi-fiverr-project-manager-main - v28/server/server.js
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
    tim.js             — data 11 anggota + hitungLama() otomatis dari tanggal
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

## Database Tables (PostgreSQL: creanimasi_hub_dev)
hub_users, jurnal_mingguan, profiling_admin/pm/illustrator/rigger/3d,
tim, modul_topik, workshop_kehadiran, friday_win, sesi_1on1,
revenue_bulanan, reward_tracking, skb

## Sistem Role & Akses
**Admin (kholed/admin123):** Semua halaman + edit modul/workshop/SKB review/reset PW
**Member (username/creanimasi123):** Dashboard, Modul divisi sendiri, Isi Jurnal,
Riwayat Jurnal, Profiling, SOP, Ajukan SKB, Profil & Ganti Password

## Data Tim (11 anggota)
| Nama | Divisi | Level | Tipe |
|------|--------|-------|------|
| Ariel Tegar | Admin | Senior | Rising Star |
| Ryan Cavallera | Admin | Senior | Rising Star |
| Nanda Cahya Bintang | Admin | Junior | High Potential |
| Dina Syavina | PM | Senior | High Potential |
| Tsania Lathifa | PM | Junior | Rising Star |
| Ahmad Fathurrahman | Rigger | Senior | Rising Star |
| Raynar Harits | Rigger | Senior | Silent Expert |
| Aditya Tri Prakoso | Illustrator | Senior | High Potential |
| Noval Faqihudin Zaky | Illustrator | Senior | High Potential |
| Galang Ramadhan | Illustrator | Junior | Silent Expert |
| Ridho Ramadhan | 3D Modeler | Junior | At Risk |

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
