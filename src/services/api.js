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
  if (!res.ok) throw new Error(data.error || 'Request gagal');
  return data;
}

export const api = {
  // Jurnal
  simpanJurnal:   (data)         => request('POST', '/jurnal', data),
  getJurnal:      (nama)         => request('GET', `/jurnal${nama ? `?nama=${nama}` : ''}`),
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

  // Revenue
  getRevenue:        (bulan, tahun) => request('GET', `/revenue?bulan=${bulan}&tahun=${tahun}`),
  getRevenueHistory: ()             => request('GET', '/revenue/history'),
  saveRevenue:       (data)         => request('POST', '/revenue', data),

  // Modul Topik
  getModulTopik:    (nama)                          => request('GET', `/modul-topik${nama ? `?nama=${encodeURIComponent(nama)}` : ''}`),
  updateModulTopik: (nama, modulId, topikIdx, selesai) =>
    request('PATCH', `/modul-topik/${encodeURIComponent(nama)}/${modulId}/${topikIdx}`, { selesai }),

  // Modul Progress (legacy — tidak dipakai, digantikan modul-topik)
  // getModulProgress / updateModulProgress dihapus

  // Tim
  getTim:          (semua) => request('GET', `/tim${semua ? '?semua=1' : ''}`),
  tambahTim:       (data)  => request('POST', '/tim', data),
  updateTim:       (id, data) => request('PATCH', `/tim/${id}`, data),
  nonaktifkanTim:  (id)    => request('DELETE', `/tim/${id}`),
  resetPassword:   (id, pw) => request('PATCH', `/tim/${id}/reset-password`, { password_baru: pw }),

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
