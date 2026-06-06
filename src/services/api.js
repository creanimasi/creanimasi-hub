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
  const data = await res.json();
  if (!res.ok) {
    // Sertakan status code agar useAuth bisa bedakan 401 vs error lain
    throw new Error(`${res.status}: ${data.error || 'Request gagal'}`);
  }
  return data;
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

  // Performa historis
  getPerforma: (periode = 'minggu', limit = 12) =>
    request('GET', `/performa?periode=${periode}&limit=${limit}`),

  // Presence (real-time online status)
  heartbeat:        ()  => request('PATCH', '/auth/heartbeat'),
  offlineSignal:    ()  => request('DELETE', '/auth/heartbeat'),
  getPresence:      ()  => request('GET', '/presence/snapshot'),
  // SSE connection — tidak pakai request() karena streaming
  connectPresence: ()   => {
    const token = localStorage.getItem('hub_token');
    return new EventSource(`${BASE}/presence?token=${token}`);
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

  // User management (admin)
  getUsers:          ()        => request('GET', '/users'),
  tambahUser:        (data)    => request('POST', '/users', data),
  updateUser:        (id, data) => request('PATCH', `/users/${id}`, data),
  nonaktifkanUser:   (id)      => request('DELETE', `/users/${id}`),
  aktifkanUser:      (id)      => request('PATCH', `/users/${id}/aktifkan`),
  resetPasswordUser: (id, pw)  => request('PATCH', `/users/${id}/reset-password`, pw ? { password_baru: pw } : {}),

  // Tim
  getTim:          (semua) => request('GET', `/tim${semua ? '?semua=1' : ''}`),
  tambahTim:       (data)  => request('POST', '/tim', data),
  updateTim:       (id, data) => request('PATCH', `/tim/${id}`, data),
  nonaktifkanTim:  (id)    => request('DELETE', `/tim/${id}`),
  aktifkanAnggota: (id)       => request('PATCH', `/tim/${id}/aktifkan`),
  buatAkunAnggota: (id, data) => request('POST',  `/tim/${id}/buat-akun`, data),
  resetPassword:   (id, pw)   => request('PATCH', `/tim/${id}/reset-password`, { password_baru: pw }),

  // Workshop Kehadiran
  getWorkshop:          ()                          => request('GET', '/workshop'),
  updateWorkshop:       (nama, layerId, sesiIdx, hadir) =>
    request('PATCH', `/workshop/${encodeURIComponent(nama)}/${layerId}/${sesiIdx}`, { hadir }),

  // Friday Win
  getFridayWin:    ()       => request('GET', '/friday-win'),
  postFridayWin:   (data)   => request('POST', '/friday-win', data),
  deleteFridayWin: (id)     => request('DELETE', `/friday-win/${id}`),

  // Sesi 1-on-1
  getSesi1on1:  ()     => request('GET', '/sesi-1on1'),
  postSesi1on1: (data) => request('POST', '/sesi-1on1', data),
};
