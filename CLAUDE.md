# Creanimasi Internal Hub — Konteks Proyek

## Tentang Creanimasi Studio
Studio VTuber model, illustrasi anime, VRM, AR filter, 3D print.
Platform: Fiverr, VGen, Etsy. Owner: Mas Kholed.
Tim inhouse 11 orang + remote.

## Stack Teknologi
- Frontend: React + React Router di ~/Documents/creanimasi-hub
- Backend: Node.js di ~/Documents/creanimasi-fiverr-project-manager-main - v28/server/server.js
- Database: PostgreSQL di Coolify (163.61.44.177)
- Hosting: Coolify v4 di 163.61.44.177:8000
- OS: Zorin Linux (Ubuntu based)

## Struktur Project Frontend
src/
  components/
    Sidebar.jsx       — navigasi 12 halaman
    Layout.jsx        — wrapper dengan topbar
    FormJurnal.jsx    — form jurnal refleksi mingguan
    FormProfiling.jsx — form profiling 5 divisi
  pages/
    Dashboard.jsx     — overview kondisi tim
    Tim.jsx           — profil 11 anggota
    Pages.jsx         — Modul, Jurnal, SOP, Reward, Workshop, Kader, SKB, 1on1
    FormPages.jsx     — halaman wrapper form jurnal & profiling
  data/
    tim.js            — data 11 anggota tim lengkap
  services/
    api.js            — semua call ke backend /api/hub
backend/
  hub.routes.js       — sudah dicopy ke server/routes/hub.js CRM

## API Backend
Base URL: http://163.61.44.177:3001/api/hub
Endpoints:
- POST/GET /jurnal
- POST/GET /profiling/:divisi (admin|pm|illustrator|rigger|3d)
- POST/GET /reward
- POST/GET /skb
- GET /dashboard

## Database Tables (sudah dibuat di PostgreSQL)
- jurnal_mingguan
- profiling_admin, profiling_pm, profiling_illustrator, profiling_rigger, profiling_3d
- reward_tracking
- skb

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

## Sistem yang Sudah Dibangun
- Career path 6 level (Magang → Koordinator)
- KPI teknis & non-teknis semua divisi
- Modul belajar: Admin(12), PM(12), Secondline(12), Illustrator(14), Rigger(14), 3D(14)
- SOP Brief semua jenis project
- Panduan Onboarding
- Sistem Reward & Apresiasi
- Program Workshop JRUHUB 19 sesi
- Template SKB 4 jenis
- Agenda 1-on-1 5 template
- Command Center Google Sheets + Apps Script

## Kandidat Secondline (urutan)
1. Ariel Tegar — paling siap
2. Ahmad Fathurrahman — sangat siap
3. Ryan Cavallera — siap dikembangkan
4. Tsania Lathifa — investasi jangka menengah

## Prioritas Tindakan Sekarang
1. 1-on-1 dengan Ridho (At Risk, satu-satunya 3D Modeler)
2. Perbaiki sistem brief (Fathur + Ryan + Noval semua sebut revisi)
3. Gathering/BBQ bulan ini (Noval & Nanda sudah sinyal)
4. Friday Win mulai Jumat ini
5. Jurnal refleksi mulai berjalan serentak

## Cara Deploy ke Coolify
1. Push ke GitHub: git push origin main
2. Coolify auto-deploy dari repo creanimasi-hub
3. Build command: npm run build
4. Publish dir: build
5. Env var: REACT_APP_API_URL=http://163.61.44.177:3001/api/hub

## Konvensi Kode
- Warna utama: --green #1D9E75
- Font: Inter
- Semua komponen pakai CSS variables dari index.css
- Data statis di src/data/tim.js
- API calls semua lewat src/services/api.js
