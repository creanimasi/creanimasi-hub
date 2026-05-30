// src/services/api.js
// Semua call ke backend dari frontend

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/hub';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request gagal');
  return data;
}

export const api = {
  // Jurnal
  simpanJurnal:   (data) => request('POST', '/jurnal', data),
  getJurnal:      (nama) => request('GET', `/jurnal${nama ? `?nama=${nama}` : ''}`),
  getJurnalStats: ()     => request('GET', '/jurnal/stats'),

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
};
