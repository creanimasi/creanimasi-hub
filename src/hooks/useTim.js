import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { TIM, hitungLama } from '../data/tim';

// ~20 komponen memanggil useTim() dan dulu masing-masing menembak GET /tim sendiri
// (satu kali muat halaman bisa 10× request yang sama). Sekarang satu request dipakai
// bersama selama 30 detik, termasuk request yang masih berjalan.
const TTL_MS = 30 * 1000;
const cache = new Map(); // 'all' | 'aktif' -> { at, promise }

function fetchTim(semua) {
  const key = semua ? 'all' : 'aktif';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = api.getTim(semua)
    .then(res => res.data || [])
    .catch(err => { cache.delete(key); throw err; });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

// Wajib dipanggil saat login/logout (isi /tim bergantung hak akses user, mis. email
// hanya untuk pemegang Master Data) dan setelah data tim diubah.
export function invalidateTimCache() { cache.clear(); }

// Data tim dari DB (termasuk anggota baru), fallback ke data statis
// selama fetch belum selesai atau gagal.
export function useTim(semua = false) {
  const [tim, setTim] = useState(TIM);

  useEffect(() => {
    let batal = false;
    fetchTim(semua)
      .then(rows => {
        if (batal || rows.length === 0) return;
        setTim(rows.map(m => ({ ...m, lama: m.bergabung ? hitungLama(m.bergabung) : '-' })));
      })
      .catch(() => {});
    return () => { batal = true; };
  }, [semua]);

  return tim;
}
