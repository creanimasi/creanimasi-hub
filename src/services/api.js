// src/services/api.js
// Semua call ke backend dari frontend

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/hub';

function getToken() { return localStorage.getItem('hub_token'); }

async function request(method, path, body) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  if (!res.ok) {
    // Sesi tidak valid lagi (token kedaluwarsa / akun dinonaktifkan) → AuthProvider
    // mengeluarkan user ke halaman login, bukan membiarkan UI setengah rusak.
    if (res.status === 401 && token && path !== '/auth/login') {
      window.dispatchEvent(new Event('hub-unauthorized'));
    }
    throw new Error(`${res.status}: ${data.error || 'Request gagal'}`);
  }
  return data;
}

// Unggah/unduh biner (PDF). request() di atas khusus JSON.
//   body + contentType → kirim berkas mentah, balasan JSON; blob:true → balasan berupa Blob.
async function rawRequest(method, path, { body, contentType, blob } = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });
  if (!res.ok) {
    let data = {};
    try { data = JSON.parse(await res.text()); } catch { /* balasan bukan JSON (mis. halaman error nginx) */ }
    if (res.status === 401 && token) window.dispatchEvent(new Event('hub-unauthorized'));
    const pesan = data.error || (res.status === 413 ? 'Berkas terlalu besar untuk server' : 'Request gagal');
    throw new Error(`${res.status}: ${pesan}`);
  }
  return blob ? res.blob() : res.json();
}

// Ulangi panggilan yang gagal karena jaringan/5xx (maks 3 kali, jeda bertahap). Galat 4xx (validasi/akses) tidak diulang.
async function denganUlang(fn, kali = 3) {
  let galat;
  for (let i = 0; i < kali; i++) {
    try { return await fn(); }
    catch (e) {
      galat = e;
      if (/^4\d\d:/.test(e.message || '')) throw e;
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw galat;
}

export const api = {
  // Jurnal
  simpanJurnal:   (data)         => request('POST', '/jurnal', data),
  getJurnal:      (nama)         => request('GET', `/jurnal${nama ? `?nama=${encodeURIComponent(nama)}` : ''}`),
  getJurnalStats: ()             => request('GET', '/jurnal/stats'),
  replyJurnal:    (id, reply)    => request('PATCH', `/jurnal/${id}/reply`, { reply }),

  // Profiling
  simpanProfiling: (divisi, data) => request('POST', `/profiling/${divisi}`, data),
  getProfilingAll: ()              => request('GET', '/profiling/all'),
  getProfiling:    (divisi)        => request('GET', `/profiling/${divisi}`),

  // Reward
  simpanReward:      (data) => request('POST', '/reward', data),
  getReward:         ()     => request('GET', '/reward'),
  updateRewardStatus:(id, status) => request('PATCH', `/reward/${id}/status`, { status }),

  // SKB
  simpanSKB:  (data) => request('POST', '/skb', data),
  getSKB:     ()     => request('GET', '/skb'),
  updateSKB:  (id, data) => request('PATCH', `/skb/${id}`, data),

  // Dashboard
  getDashboard: () => request('GET', '/dashboard'),

  // Auth
  login:          (username, password)           => request('POST', '/auth/login', { username, password }),
  me:             ()                             => request('GET',  '/auth/me'),
  gantiPassword:  (password_lama, password_baru) => request('PATCH', '/auth/password', { password_lama, password_baru }),
  setTema:        (tema)                         => request('PATCH', '/auth/tema', { tema }),
  getProfilingMe: ()                             => request('GET', '/profiling/me'),
  updateProfil:   (data)                         => request('PATCH', '/profil/update', data),

  // Laporan Harian (dari Telegram bot)
  getLaporanHarian:       (q = '') => request('GET', `/laporan-harian${q}`),
  getLaporanHarianStats:  (q = '') => request('GET', `/laporan-harian/stats${q}`),
  getLaporanHarianGrafik: (q = '') => request('GET', `/laporan-harian/grafik${q}`),
  hapusLaporanHarian:     (id)     => request('DELETE', `/laporan-harian/${id}`),

  // Laporan Mingguan
  getAnalisisSdm:   (tgl)   => request('GET', `/laporan-sdm-analisa?tanggal=${tgl}`),
  getLaporan:       ()      => request('GET', '/laporan-mingguan'),
  getLaporanById:   (id)    => request('GET', `/laporan-mingguan/${id}`),
  buatLaporan:      (data)  => request('POST', '/laporan-mingguan', data),
  updateLaporan:    (id, d) => request('PUT',  `/laporan-mingguan/${id}`, d),
  hapusLaporan:     (id)    => request('DELETE', `/laporan-mingguan/${id}`),

  // Laporan Mingguan Admin (analitik per-akun Fiverr)
  getLaporanAdmin:       ()      => request('GET', '/laporan-admin'),
  getLaporanAdminById:   (id)    => request('GET', `/laporan-admin/${id}`),
  buatLaporanAdmin:      (data)  => request('POST', '/laporan-admin', data),
  updateLaporanAdmin:    (id, d) => request('PUT',  `/laporan-admin/${id}`, d),
  hapusLaporanAdmin:     (id)    => request('DELETE', `/laporan-admin/${id}`),

  // Performa historis
  getPerforma: (periode = 'minggu', limit = 12) =>
    request('GET', `/performa?periode=${periode}&limit=${limit}`),

  // Presence (real-time online status)
  heartbeat:        ()  => request('PATCH', '/auth/heartbeat'),
  offlineSignal:    ()  => request('DELETE', '/auth/heartbeat'),
  getPresence:      ()  => request('GET', '/presence/snapshot'),
  // SSE connection — minta tiket sekali-pakai dulu (via header Authorization biasa)
  // supaya JWT asli tidak pernah masuk ke query string/access log
  connectPresence: async () => {
    const { ticket } = await request('GET', '/presence/ticket');
    return new EventSource(`${BASE}/presence?ticket=${ticket}`);
  },

  // Revenue
  getRevenue:        (bulan, tahun) => request('GET', `/revenue?bulan=${bulan}&tahun=${tahun}`),
  getRevenueHistory: ()             => request('GET', '/revenue/history'),
  saveRevenue:       (data)         => request('POST', '/revenue', data),

  // Modul Topik (progress)
  getModulTopik:    (nama)                          => request('GET', `/modul-topik${nama ? `?nama=${encodeURIComponent(nama)}` : ''}`),
  updateModulTopik: (nama, modulId, topikIdx, selesai) =>
    request('PATCH', `/modul-topik/${encodeURIComponent(nama)}/${modulId}/${topikIdx}`, { selesai }),

  // Nama topik modul (custom dari admin)
  getModulTopikNama:    ()                          => request('GET', '/modul-topik-nama'),
  updateModulTopikNama: (modulId, topikIdx, nama)   => request('PATCH', `/modul-topik-nama/${modulId}/${topikIdx}`, { nama }),

  // Modul Progress (legacy — tidak dipakai, digantikan modul-topik)
  // getModulProgress / updateModulProgress dihapus

  // Tim
  getTim:          (semua) => request('GET', `/tim${semua ? '?semua=1' : ''}`),
  getAkunTanpaTim: ()      => request('GET', '/akun-tanpa-tim'),
  tambahTim:       (data)  => request('POST', '/tim', data),
  updateTim:       (id, data) => request('PATCH', `/tim/${id}`, data),
  nonaktifkanTim:  (id)    => request('DELETE', `/tim/${id}`),
  aktifkanAnggota: (id)       => request('PATCH', `/tim/${id}/aktifkan`),
  buatAkunAnggota: (id, data) => request('POST',  `/tim/${id}/buat-akun`, data),
  resetPassword:   (id, pw)   => request('PATCH', `/tim/${id}/reset-password`, { password_baru: pw }),

  // Master Data — Role & Hak Akses
  getRoles:            ()               => request('GET', '/roles'),
  getPages:             ()               => request('GET', '/pages'),
  getRolePageAccess:   (roleId)         => request('GET', `/roles/${roleId}/page-access`),
  saveRolePageAccess:  (roleId, access) => request('PUT', `/roles/${roleId}/page-access`, { access }),

  // Workshop Kehadiran
  getWorkshop:          ()                          => request('GET', '/workshop'),
  updateWorkshop:       (nama, layerId, sesiIdx, hadir) =>
    request('PATCH', `/workshop/${encodeURIComponent(nama)}/${layerId}/${sesiIdx}`, { hadir }),

  // Absensi Tim
  getSesiAbsensi:    ()                               => request('GET', '/absensi/sesi'),
  getDetailAbsensi:  (id)                             => request('GET', `/absensi/sesi/${id}`),
  createSesiAbsensi: (data)                           => request('POST', '/absensi/sesi', data),
  updateAbsensi:     (sesiId, nama, status, catatan)  =>
    request('PATCH', `/absensi/${sesiId}/${encodeURIComponent(nama)}`, { status, catatan }),
  editSesiAbsensi:   (id, data)                       => request('PUT', `/absensi/sesi/${id}`, data),
  deleteSesiAbsensi: (id)                             => request('DELETE', `/absensi/sesi/${id}`),

  // Laporan Bulanan
  getLaporanBulanan: (bulan) => request('GET', `/laporan-bulanan?bulan=${bulan}`),

  // Friday Win
  getFridayWin:    ()       => request('GET', '/friday-win'),
  postFridayWin:   (data)   => request('POST', '/friday-win', data),
  deleteFridayWin: (id)     => request('DELETE', `/friday-win/${id}`),

  // Sesi 1-on-1
  getSesi1on1:  ()     => request('GET', '/sesi-1on1'),
  postSesi1on1: (data) => request('POST', '/sesi-1on1', data),

  // Meta Ads
  getMetaBrands:      ()                          => request('GET', '/meta-ads/brands'),
  createMetaBrand:    (data)                      => request('POST', '/meta-ads/brands', data),
  updateMetaBrand:    (id, data)                  => request('PUT', `/meta-ads/brands/${id}`, data),
  deleteMetaBrand:    (id)                        => request('DELETE', `/meta-ads/brands/${id}`),
  updateMetaBrandSettings: (id, data)             => request('PUT', `/meta-ads/brands/${id}/settings`, data),
  getMetaInsights:    (brandId, bulan)            => request('GET', `/meta-ads/insights?${brandId ? `brand_id=${brandId}&` : ''}${bulan ? `bulan=${bulan}` : ''}`),
  saveMetaReport:     (data)                      => request('POST', '/meta-ads/report', data),
  // ringkas=1: daftar gambar tanpa isinya (isi diambil per gambar lewat unduhGambarLaporanAds) — jauh lebih ringan
  getLaporanAds:      (brandId, bulan)            => request('GET', `/meta-ads/laporan-ads?brand_id=${brandId}&bulan=${bulan}&ringkas=1`),
  unduhGambarLaporanAds: (id)                     => rawRequest('GET', `/meta-ads/laporan-ads/gambar/${id}`, { blob: true }),
  saveLaporanAds:     (data)                      => request('PUT', '/meta-ads/laporan-ads', data),
  hitungAngkaLaporanAds: (brandId, bulan, rentang) => request('POST', '/meta-ads/laporan-ads/hitung', { brand_id: brandId, bulan, rentang }),
  uploadGambarLaporanAds: (data)                  => request('POST', '/meta-ads/laporan-ads/gambar', data),
  hapusGambarLaporanAds:  (id)                    => request('DELETE', `/meta-ads/laporan-ads/gambar/${id}`),
  // Riwayat (arsip) PDF Laporan Ads
  getArsipLaporanAds:     (brandId, bulan)        => request('GET', `/meta-ads/laporan-ads/arsip?brand_id=${brandId}${bulan ? `&bulan=${bulan}` : ''}`),
  getLogArsipLaporanAds:  (id)                    => request('GET', `/meta-ads/laporan-ads/arsip/${id}/log`),
  // Diunggah PER POTONGAN (≤ ~700 KB): proxy di depan backend membatasi body request (nginx default 1 MB → 413), jadi PDF
  // berisi foto tidak bisa dikirim sekaligus. Server menyusun potongan lalu menyimpan seperti biasa.
  unggahArsipLaporanAds:  async (brandId, bulan, minggu, slide, blob) => {
    const mulai = await request('POST', '/meta-ads/laporan-ads/arsip/unggahan', { brand_id: brandId, bulan, minggu, slide, ukuran: blob.size });
    const { id, ukuran_bagian: ukuran, jumlah_bagian: jumlah } = mulai.data;
    for (let i = 0; i < jumlah; i++) {
      const bagian = blob.slice(i * ukuran, (i + 1) * ukuran);
      await denganUlang(() => rawRequest('PUT', `/meta-ads/laporan-ads/arsip/unggahan/${id}/bagian/${i}`, { body: bagian, contentType: 'application/octet-stream' }));
    }
    return denganUlang(() => request('POST', `/meta-ads/laporan-ads/arsip/unggahan/${id}/selesai`));
  },
  unduhArsipLaporanAds:   (id)                    => rawRequest('GET', `/meta-ads/laporan-ads/arsip/${id}/pdf`, { blob: true }),
  hapusArsipLaporanAds:   (id)                    => request('DELETE', `/meta-ads/laporan-ads/arsip/${id}`),
  getMetaLaporan:     (bulan, brandId)            => request('GET', `/meta-ads/laporan?bulan=${bulan}${brandId ? `&brand_id=${brandId}` : ''}`),
  syncMetaBrand:      (brandId, tanggal)          => request('POST', `/meta-ads/sync/${brandId}`, tanggal ? { tanggal } : {}),
  syncMetaRange:      (brandId, dari, sampai)     => request('POST', `/meta-ads/sync-range/${brandId}`, { dari, sampai }),
  syncAllMetaBrands:  (tanggal)                   => request('POST', '/meta-ads/sync-all', tanggal ? { tanggal } : {}),

  // RPG / Gamifikasi (respons: { success, data })
  rpgCharacter:     ()                 => request('GET', '/rpg/character'),
  rpgQuests:        ()                 => request('GET', '/rpg/quests'),
  rpgProgress:      (id, progress_pct) => request('PATCH', `/rpg/quests/${id}/progress`, { progress_pct }),
  rpgAjukan:        (id, catatan)      => request('POST', `/rpg/quests/${id}/ajukan`, { catatan }),
  rpgLeaderboard:   (period, divisi)   => request('GET', `/rpg/leaderboard?period=${period}${divisi && divisi !== 'Semua' ? `&divisi=${encodeURIComponent(divisi)}` : ''}`),
  rpgAchievements:  ()                 => request('GET', '/rpg/achievements'),
  rpgAnalytics:     ()                 => request('GET', '/rpg/admin/analytics'),
  rpgAdminPapan:    ()                 => request('GET', '/rpg/admin/papan'),
  rpgPantauAnggota: ()                 => request('GET', '/rpg/pantau/anggota'),
  rpgPantauDetail:  (id)               => request('GET', `/rpg/pantau/anggota/${id}`),
  rpgAdminQuests:   ()                 => request('GET', '/rpg/admin/quests'),
  rpgAdminBuatQuest:(data)             => request('POST', '/rpg/admin/quests', data),
  rpgAdminUbahQuest:(id, data)         => request('PATCH', `/rpg/admin/quests/${id}`, data),
  rpgAdminTugaskan: (id, tim_ids)      => request('POST', `/rpg/admin/quests/${id}/tugaskan`, { tim_ids }),
  rpgAdminReview:   ()                 => request('GET', '/rpg/admin/review'),
  rpgAdminPutuskan: (id, status, catatan_review) => request('PATCH', `/rpg/admin/assignments/${id}`, { status, catatan_review }),
  rpgAdminAchievements: ()             => request('GET', '/rpg/admin/achievements'),
  rpgAdminGrant:    (code, tim_id)     => request('POST', `/rpg/admin/achievements/${code}/grant`, { tim_id }),
  // Target poin produksi
  rpgTarget:        ()                 => request('GET', '/rpg/target'),
  rpgTargetPapan:   (periode)          => request('GET', `/rpg/target/papan?periode=${encodeURIComponent(periode || 'sekarang')}`),
  rpgAdminTarget:   ()                 => request('GET', '/rpg/admin/target'),
  rpgAdminSetTarget:(divisi, level, target) => request('PUT', '/rpg/admin/target', { divisi, level, target }),
  rpgTargetRekap:   (periode)          => request('GET', `/rpg/admin/target/rekap?periode=${encodeURIComponent(periode || 'sekarang')}`),
  rpgAdminOverride: (data)             => request('PUT', '/rpg/admin/target/override', data),
  rpgAdminKunciPeriode: (kode)         => request('POST', `/rpg/admin/target/periode/${kode}/kunci`),
  rpgAdminBukaPeriode:  (kode)         => request('POST', `/rpg/admin/target/periode/${kode}/buka`),

  // AI
  getAiInsightAds: (bulan, brandId) => request('POST', '/ai/insight-ads', { bulan, ...(brandId ? { brand_id: brandId } : {}) }),
  aiChat:          (pesan, riwayat) => request('POST', '/ai/chat', { pesan, riwayat }),
};
