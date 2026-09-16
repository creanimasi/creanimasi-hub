// Hitung lama bergabung otomatis dari format DD/MM/YYYY
export function hitungLama(bergabung) {
  if (!bergabung) return '-';
  const [d, m, y] = bergabung.split('/').map(Number);
  const mulai = new Date(y, m - 1, d);
  const now   = new Date();
  const selisihBulan =
    (now.getFullYear() - mulai.getFullYear()) * 12 +
    (now.getMonth() - mulai.getMonth());
  if (selisihBulan < 1)  return '< 1 bln';
  if (selisihBulan < 12) return `${selisihBulan} bln`;
  const tahun = Math.floor(selisihBulan / 12);
  const sisa  = selisihBulan % 12;
  return sisa > 0 ? `${tahun} thn ${sisa} bln` : `${tahun} thn`;
}

// Data disinkronkan dari tabel `tim` production (Coolify) pada 2026-09-15.
// Field naratif (semangat/energi/target/mentor) di DB production sudah kembali ke default "-"
// untuk hampir semua orang (datanya sekarang hidup di tabel profiling_*, bukan di sini lagi) —
// untuk 11 anggota awal kita pertahankan teks lama sebagai sample/fallback yang lebih informatif.
// 11 anggota baru (id 23-33) belum punya data naratif/tanggal bergabung di DB.
const RAW_TIM = [
  { id:1, nama:"Ariel Tegar", divisi:"Admin", level:"Senior Team", status:"Aktif",
    tipe:"Rising Star", kriteria:3, kepuasan:7, bergabung:"21/09/2025", entitas:"Creanimasi Studio",
    semangat:"Mencapai tujuan dan impian awal", energi:"Handle klien awam teknis",
    target:"Memiliki beberapa unit usaha sendiri", memimpin:"Ya, sangat tertarik",
    skill:3, komunikasi:3, mentor:"-" },
  { id:2, nama:"Ryan Cavallera", divisi:"Admin", level:"Senior Team", status:"Aktif",
    tipe:"Rising Star", kriteria:3, kepuasan:7, bergabung:"25/04/2025", entitas:"Creillustra",
    semangat:"Mendapatkan ilmu baru dan bonus", energi:"Revisi berulang, komplain klien",
    target:"Memimpin 1 tim dengan 2 akun marketplace", memimpin:"Ya, sangat tertarik",
    skill:3, komunikasi:3, mentor:"-" },
  { id:3, nama:"Nanda Cahya Bintang", divisi:"Admin", level:"Junior Team", status:"Aktif",
    tipe:"High Potential", kriteria:3, kepuasan:7, bergabung:"27/03/2026", entitas:"Creanimasi Studio",
    semangat:"Uang dan pemahaman baru", energi:"Sinyal dan device ngelag",
    target:"Tempat yang lebih tinggi lagi", memimpin:"Ya, sangat tertarik",
    skill:3, komunikasi:3, mentor:"Ariel Tegar" },
  { id:4, nama:"Dina Syavina", divisi:"PM", level:"Senior Team", status:"Aktif",
    tipe:"High Potential", kriteria:3, kepuasan:7, bergabung:"30/08/2023", entitas:"Creanimasi Studio",
    semangat:"Uang", energi:"Ngomong sama orang",
    target:"Admin studio sendiri", memimpin:"Mungkin kalau sudah siap",
    skill:3, komunikasi:3, mentor:"-" },
  { id:5, nama:"Tsania Lathifa", divisi:"PM", level:"Junior Team", status:"Aktif",
    tipe:"Rising Star", kriteria:3, kepuasan:7, bergabung:"02/03/2026", entitas:"Creanimasi Studio",
    semangat:"Gajian dan ketemu teman-teman", energi:"Ngerti mood orang lain",
    target:"Berkembang skill dan karier", memimpin:"Ya, sangat tertarik",
    skill:3, komunikasi:3, mentor:"Dina Syavina" },
  { id:6, nama:"Ahmad Fathurrahman", divisi:"Rigger", level:"Senior Team", status:"Aktif",
    tipe:"Rising Star", kriteria:3, kepuasan:7, bergabung:"05/01/2025", entitas:"Creanimasi Studio",
    semangat:"Lingkungan dan pikiran tenang", energi:"Revisi tanpa kejelasan",
    target:"Menetap dan kembangkan skill", memimpin:"Mungkin kalau sudah siap",
    skill:3, komunikasi:3, mentor:"-" },
  { id:7, nama:"Raynar Harits", divisi:"Rigger", level:"Senior Team", status:"Aktif",
    tipe:"Silent Expert", kriteria:3, kepuasan:7, bergabung:"13/04/2025", entitas:"Creillustra",
    semangat:"Lingkungan", energi:"Jobdesk yang over",
    target:"Masih di Semarang karena kuliah", memimpin:"Mungkin kalau sudah siap",
    skill:3, komunikasi:3, mentor:"-" },
  { id:8, nama:"Aditya Tri Prakoso", divisi:"Illustrator", level:"Senior Team", status:"Aktif",
    tipe:"High Potential", kriteria:3, kepuasan:7, bergabung:"21/06/2025", entitas:"Creanimasi Studio",
    semangat:"Uang", energi:"Ngelag dan internet lemot",
    target:"Improve skill, punya passive income", memimpin:"Ya, sangat tertarik",
    skill:3, komunikasi:3, mentor:"-" },
  { id:9, nama:"Noval Faqihudin Zaky", divisi:"Illustrator", level:"Senior Team", status:"Aktif",
    tipe:"High Potential", kriteria:3, kepuasan:7, bergabung:"01/01/2025", entitas:"Creanimasi Studio",
    semangat:"Entertain dan ketemu teman", energi:"Revisi yang sudah lewat stepnya",
    target:"Illustrator yang lebih baik", memimpin:"Mungkin kalau sudah siap",
    skill:3, komunikasi:3, mentor:"-" },
  { id:10, nama:"Galang Ramadhan", divisi:"Illustrator", level:"Junior Team", status:"Aktif",
    tipe:"Silent Expert", kriteria:3, kepuasan:7, bergabung:"24/02/2025", entitas:"Creanimasi Studio",
    semangat:"Mendengarkan musik", energi:"Membersihkan dapur",
    target:"Di sini (Creanimasi)", memimpin:"Belum tertarik saat ini",
    skill:3, komunikasi:3, mentor:"-" },
  { id:11, nama:"Ridho Ramadhan", divisi:"3D Modeler", level:"Junior Team", status:"Aktif",
    tipe:"Rising Star", kriteria:5, kepuasan:8, bergabung:"04/03/2025", entitas:"Creanimasi Studio",
    semangat:"Instruksi jelas", energi:"Tidak ada instruksi",
    target:"Intel Arc B580", memimpin:"Mungkin kalau sudah siap",
    skill:5, komunikasi:4, mentor:"-" },
  // ── Anggota baru (belum ada di CLAUDE.md sebelumnya) ──────────────────────
  // Status "Nonaktif" di bawah berdasarkan hub_users.aktif=false (bukan tim.status,
  // yang di DB production selalu berisi "Aktif" untuk semua baris — field itu tampaknya
  // tidak lagi dipelihara).
  { id:23, nama:"Andini Dyah Paramastri", divisi:"Admin", level:"Senior", status:"Nonaktif",
    tipe:"At Risk", kriteria:4, kepuasan:6, bergabung:"", entitas:"Shuyou",
    semangat:"-", energi:"-", target:"-", memimpin:"Belum tertarik saat ini",
    skill:0, komunikasi:0, mentor:"-" },
  { id:24, nama:"Elenesya Sasmariza", divisi:"Admin", level:"Junior", status:"Nonaktif",
    tipe:"Rising Star", kriteria:5, kepuasan:9, bergabung:"", entitas:"Flip Studio",
    semangat:"-", energi:"-", target:"-", memimpin:"Belum tertarik saat ini",
    skill:4, komunikasi:4, mentor:"-" },
  { id:25, nama:"Risma Wulandari", divisi:"Admin", level:"Junior", status:"Nonaktif",
    tipe:"High Potential", kriteria:3, kepuasan:8, bergabung:"", entitas:"Flip Studio",
    semangat:"-", energi:"-", target:"-", memimpin:"Belum tertarik saat ini",
    skill:3, komunikasi:3, mentor:"-" },
  { id:26, nama:"Maheswara Artha Kumara Gautama", divisi:"PM", level:"Senior", status:"Nonaktif",
    tipe:"Rising Star", kriteria:5, kepuasan:9, bergabung:"", entitas:"Shuyou",
    semangat:"-", energi:"-", target:"-", memimpin:"Belum tertarik saat ini",
    skill:5, komunikasi:5, mentor:"-" },
  { id:27, nama:"Rizky Himawan Aria Wicaksa", divisi:"3D Modeler", level:"Senior", status:"Nonaktif",
    tipe:"", kriteria:3, kepuasan:7, bergabung:"", entitas:"Shuyou",
    semangat:"-", energi:"-", target:"-", memimpin:"Belum tertarik saat ini",
    skill:3, komunikasi:3, mentor:"-" },
  { id:28, nama:"davian", divisi:"Admin", level:"Magang / Probation", status:"Aktif",
    tipe:"Rising Star", kriteria:4, kepuasan:8, bergabung:"", entitas:"Creanimasi Studio",
    semangat:"-", energi:"-", target:"-", memimpin:"Belum tertarik saat ini",
    skill:4, komunikasi:4, mentor:"-" },
  { id:29, nama:"nindi", divisi:"Admin", level:"Magang / Probation", status:"Aktif",
    tipe:"", kriteria:3, kepuasan:7, bergabung:"", entitas:"Creanimasi Studio",
    semangat:"-", energi:"-", target:"-", memimpin:"Belum tertarik saat ini",
    skill:3, komunikasi:3, mentor:"-" },
  { id:30, nama:"Vitto Ramadani", divisi:"Desainer", level:"Junior", status:"Aktif",
    tipe:"", kriteria:3, kepuasan:7, bergabung:"", entitas:"Creanimasi Studio",
    semangat:"-", energi:"-", target:"-", memimpin:"Belum tertarik saat ini",
    skill:3, komunikasi:3, mentor:"-" },
  { id:31, nama:"Azzahra Nadienta", divisi:"PM", level:"Senior", status:"Aktif",
    tipe:"", kriteria:3, kepuasan:7, bergabung:"", entitas:"Creanimasi Studio",
    semangat:"-", energi:"-", target:"-", memimpin:"Belum tertarik saat ini",
    skill:3, komunikasi:3, mentor:"-" },
  { id:32, nama:"Sigit Setyawan", divisi:"3D Modeler", level:"Magang / Probation", status:"Aktif",
    tipe:"Rising Star", kriteria:3, kepuasan:9, bergabung:"", entitas:"Creanimasi Studio",
    semangat:"-", energi:"-", target:"-", memimpin:"Belum tertarik saat ini",
    skill:4, komunikasi:4, mentor:"-" },
  { id:33, nama:"Aryo Cahyono", divisi:"3D Modeler", level:"Senior", status:"Aktif",
    tipe:"", kriteria:3, kepuasan:7, bergabung:"", entitas:"Creanimasi Studio",
    semangat:"-", energi:"-", target:"-", memimpin:"Belum tertarik saat ini",
    skill:3, komunikasi:3, mentor:"-" },
];

export const TIM = RAW_TIM.map(m => ({ ...m, lama: hitungLama(m.bergabung) }));

export const TIPE_COLOR = {
  "Rising Star":   { bg:"var(--green-light)",  text:"var(--green)",  badge:"rs" },
  "High Potential":{ bg:"var(--purple-light)", text:"var(--purple)", badge:"hp" },
  "Silent Expert": { bg:"var(--amber-light)",  text:"var(--amber)",  badge:"se" },
  "At Risk":       { bg:"var(--coral-light)",  text:"var(--coral)",  badge:"ar" },
};

export const DIVISI_COLOR = {
  Admin:       { bg:"var(--amber-light)",  text:"var(--amber)",  icon:"💼" },
  PM:          { bg:"var(--blue-light)",   text:"var(--blue)",   icon:"📋" },
  Rigger:      { bg:"var(--coral-light)",  text:"var(--coral)",  icon:"🎬" },
  Illustrator: { bg:"var(--purple-light)", text:"var(--purple)", icon:"🎨" },
  "3D Modeler":{ bg:"var(--green-light)",  text:"var(--green)",  icon:"📦" },
  Desainer:    { bg:"var(--amber-light)",  text:"var(--amber)",  icon:"🖌️" },
};

export const MODUL_LIST = [
  { id:"admin", label:"Admin", jumlah:12, done:0, warna:"var(--amber)", bg:"var(--amber-light)",
    topik:["Customer Service & Komplain","Copywriting & Platform","Brief Writing","Social Media Dasar","Koordinasi PM & Tim","Pengetahuan Produk","Data Entry & Report","Komunikasi Klien","Prosedur Order","Quality Control Brief","Tools & Software Admin","Onboarding & SOP"] },
  { id:"pm", label:"Project Manager", jumlah:12, done:0, warna:"var(--blue)", bg:"var(--blue-light)",
    topik:["Project Planning","Koordinasi Tim","Client Communication","Timeline Management","Brief Assessment","Revision Management","Quality Control","Tools PM","Risk Management","Reporting","Escalation Handling","Closing Project"] },
  { id:"secondline", label:"Secondline", jumlah:12, done:0, warna:"var(--purple)", bg:"var(--purple-light)",
    topik:["Visi & Misi Studio","Leadership Dasar","Coaching & Mentoring","Delegasi Tugas","Evaluasi Performa","Komunikasi Strategis","Pengambilan Keputusan","Manajemen Konflik","Budaya Tim","KPI & Metrik","Kaderisasi","Succession Planning"] },
  { id:"illus", label:"Illustrator", jumlah:14, done:0, warna:"var(--purple)", bg:"var(--purple-light)",
    topik:["Anatomi Karakter","Color Theory","Art Style VTuber","Chibi Proportions","Layering PSD","Expression Sheet","Costume Design","Hair & Accessories","Background Basic","Line Art Quality","Coloring & Shading","Lighting Effect","Portfolio Building","Client Communication"] },
  { id:"rigger", label:"Rigger/Animator", jumlah:14, done:0, warna:"var(--coral)", bg:"var(--coral-light)",
    topik:["Live2D Dasar","Mesh Deformer","Parameter Setup","Physics Setup","Expression Toggle","Outfit Switch","Breath & Idle","Mouth Shapes","Eye Tracking","Hand Rigging","Tail & Hair Physics","VTube Studio Setup","Model Export","QC & Delivery"] },
  { id:"3d", label:"3D Modeler", jumlah:14, done:0, warna:"var(--blue)", bg:"var(--blue-light)",
    topik:["Blender Dasar","Character Modeling","UV Unwrapping","Texturing","Rigging 3D","VRM Setup","BlendShape","Spring Bone","Export & Test","AR Filter Spark","3D Print Prep","Watertight Mesh","Support Structure","Finishing & Paint"] },
];

export const WORKSHOP_JRUHUB = [
  { id:"layer0", label:"Layer 0 — 5 Pilar Refleksi Diri", bulan:"Bulan 1",
    items:["Adab","Ilmu","Ruang Senyap","Pencapaian","Rezeki"],
    warna:"var(--green)",  bg:"var(--green-light)"  },
  { id:"layer1", label:"Layer 1 — Ilmu Omprengan", bulan:"Bulan 2–7",
    items:["Merevisi Generasi","Memimpin Diri","Keberanian","Inisiatif & Kreatif","Semangat","Pikiran & Tubuh"],
    warna:"var(--purple)", bg:"var(--purple-light)" },
  { id:"layer2", label:"Layer 2 — Leadership Skill Training", bulan:"Bulan 8–15",
    items:["Pendamping Design","Melakukan Profiling","Membangun Motif","Komunikasi Mentor","Mentee Tidak Tumbuh","Naluri","Public Speaking","Bahasa Tubuh & Komunal"],
    warna:"var(--amber)",  bg:"var(--amber-light)"  },
];

export const REWARD_LIST = [
  { ico:"🏆", label:"Bonus naik level",        nilai:"Rp 100–500rb",  trigger:"Setiap naik level" },
  { ico:"📈", label:"Bonus revenue Admin",      nilai:"5% kelebihan",  trigger:"Akhir bulan" },
  { ico:"⭐", label:"Bonus kualitas project",   nilai:"Rp 25rb",       trigger:"0 revisi dari klien" },
  { ico:"🎉", label:"Gathering tim",            nilai:"Rp 100–300rb",  trigger:"Setiap bulan" },
  { ico:"📚", label:"Budget kursus",            nilai:"Rp 150–300rb",  trigger:"Naik Senior ke atas" },
  { ico:"🙏", label:"Bonus mentor kaderisasi",  nilai:"Rp 100rb",      trigger:"Mentee naik level" },
];
