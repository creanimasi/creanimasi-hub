import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../services/api';

// Pesan error server berbentuk "404: Akun ini belum terhubung…" → pisahkan kode & pesan.
function parseError(err) {
  const m = /^(\d{3}): (.*)$/s.exec(err?.message || '');
  return m ? { status: Number(m[1]), message: m[2] } : { status: 0, message: err?.message || 'Gagal memuat data' };
}

// Pembungkus fetch generik: { data, loading, error, reload }. `fetcher` dipanggil ulang
// bila `deps` berubah; respons basi (balapan antar request) dibuang.
function useRpgResource(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);

  const load = useCallback(async (senyap = false) => {
    const mine = ++seq.current;
    if (!senyap) setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetcher();
      if (mine === seq.current) setState({ data: res.data, loading: false, error: null });
    } catch (err) {
      if (mine === seq.current) setState(s => ({ data: senyap ? s.data : null, loading: false, error: parseError(err) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { seq.current++; }, []);

  return { ...state, reload: () => load(true), retry: () => load(false) };
}

export const useCharacter    = () => useRpgResource(api.rpgCharacter);
export const useQuests       = () => useRpgResource(api.rpgQuests);
export const useAchievements = () => useRpgResource(api.rpgAchievements);
export const useAnalytics    = () => useRpgResource(api.rpgAnalytics);
export const useLeaderboard  = (period, divisi) => useRpgResource(() => api.rpgLeaderboard(period, divisi), [period, divisi]);
export const usePapan        = () => useRpgResource(api.rpgAdminPapan);
export const usePantau       = () => useRpgResource(api.rpgPantauAnggota);
export const useAdminQuests  = () => useRpgResource(api.rpgAdminQuests);
export const useAdminReview  = () => useRpgResource(api.rpgAdminReview);
export const useAdminAchievements = () => useRpgResource(api.rpgAdminAchievements);
