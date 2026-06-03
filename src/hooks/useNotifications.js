import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { TIM } from '../data/tim';

const STORAGE_KEY = 'hub_notif_read';
const getRead = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const markRead = (ids) => localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...getRead(), ...ids])]));

export function useNotifications(user) {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(false);
  const isAdmin = user?.role === 'admin';

  const build = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const list = [];
    const read = getRead();
    const now  = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    try {
      if (isAdmin) {
        // 1. Anggota belum isi jurnal minggu ini
        const jRes = await api.getJurnal();
        const isiMingguIni = new Set(
          (jRes.data || [])
            .filter(j => new Date(j.tanggal_jurnal || j.created_at) >= weekAgo)
            .map(j => j.nama)
        );
        const belum = TIM.filter(t => !isiMingguIni.has(t.nama));
        if (belum.length > 0) {
          const id = `jurnal_belum_${now.toISOString().slice(0,10)}`;
          list.push({ id, type: 'jurnal', icon: '📓', unread: !read.includes(id),
            title: `${belum.length} anggota belum isi jurnal`,
            body: belum.map(t => t.nama.split(' ')[0]).join(', '),
            time: now, path: '/jurnal' });
        }

        // 2. SKB menunggu review
        const skbRes = await api.getSKB();
        const pending = (skbRes.data || []).filter(s => s.status === 'diajukan');
        if (pending.length > 0) {
          const id = `skb_pending_${pending.map(s=>s.id).join('_')}`;
          list.push({ id, type: 'skb', icon: '📋', unread: !read.includes(id),
            title: `${pending.length} SKB menunggu review`,
            body: pending.map(s => s.judul).join('; '),
            time: new Date(pending[0].created_at), path: '/skb' });
        }

        // 3. Sesi 1-on-1 belum dengan At Risk
        const atRisk = TIM.filter(t => t.tipe === 'At Risk');
        if (atRisk.length > 0) {
          const sesiRes = await api.getSesi1on1();
          const recently = new Set(
            (sesiRes.data || [])
              .filter(s => new Date(s.tanggal) >= new Date(now - 30 * 24 * 60 * 60 * 1000))
              .map(s => s.anggota)
          );
          const needSesi = atRisk.filter(t => !recently.has(t.nama));
          if (needSesi.length > 0) {
            const id = `atrisk_${needSesi.map(t=>t.id).join('_')}`;
            list.push({ id, type: 'urgent', icon: '⚠️', unread: !read.includes(id),
              title: `${needSesi.length} anggota At Risk perlu 1-on-1`,
              body: needSesi.map(t => t.nama.split(' ')[0]).join(', '),
              time: now, path: '/1on1', urgent: true });
          }
        }
      } else {
        // Member: cek apakah sudah isi jurnal minggu ini
        const jRes = await api.getJurnal(user.nama);
        const sudah = (jRes.data || []).some(j => new Date(j.tanggal_jurnal || j.created_at) >= weekAgo);
        const hari  = now.getDay();
        if (!sudah && hari >= 4) {
          const id = `my_jurnal_${now.toISOString().slice(0,10)}`;
          list.push({ id, type: 'jurnal', icon: '📓', unread: !read.includes(id),
            title: 'Belum isi jurnal minggu ini',
            body: 'Jurnal refleksi rutin tiap Jumat. Butuh ~10 menit.',
            time: now, path: '/jurnal/isi' });
        }

        // Cek SKB yang ditolak/disetujui
        const skbRes = await api.getSKB();
        const mySkb = (skbRes.data || []).filter(s => s.nama === user.nama && ['disetujui','ditolak'].includes(s.status));
        mySkb.forEach(s => {
          const id = `skb_status_${s.id}`;
          if (!read.includes(id))
            list.push({ id, type: s.status === 'disetujui' ? 'ok' : 'warn',
              icon: s.status === 'disetujui' ? '✅' : '❌', unread: true,
              title: `SKB "${s.judul}" ${s.status}`,
              body: s.catatan_review || '', time: new Date(s.updated_at), path: '/skb' });
        });
      }
    } catch {}

    setNotifs(list);
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => {
    build();
    const interval = setInterval(() => {
      // Pause polling saat tab tidak aktif — hemat server request
      if (!document.hidden) build();
    }, 5 * 60 * 1000);

    // Resume saat user kembali ke tab
    const onVisible = () => { if (!document.hidden) build(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [build]);

  const readAll = () => {
    markRead(notifs.map(n => n.id));
    setNotifs(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const unreadCount = notifs.filter(n => n.unread).length;
  return { notifs, loading, unreadCount, readAll, refresh: build };
}
