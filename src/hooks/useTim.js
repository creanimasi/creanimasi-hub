import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { TIM, hitungLama } from '../data/tim';

// Data tim dari DB (termasuk anggota baru), fallback ke data statis
// selama fetch belum selesai atau gagal.
export function useTim(semua = true) {
  const [tim, setTim] = useState(TIM);

  useEffect(() => {
    api.getTim(semua)
      .then(res => {
        const rows = res.data || [];
        if (rows.length === 0) return;
        setTim(rows.map(m => ({ ...m, lama: m.bergabung ? hitungLama(m.bergabung) : '-' })));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semua]);

  return tim;
}
