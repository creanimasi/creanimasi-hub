import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useTim } from './useTim';

const STORAGE_KEY = 'hub_notif_read';
const getRead = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const markRead = (ids) => localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...getRead(), ...ids])]));

export function useNotifications(user) {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(false);
  const isAdmin = user?.role === 'admin';
  const tim = useTim();

  const build = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const list = [];
    const read = getRead();
    const now  = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - (weekAgo.getDay() === 0 ? 6 : weekAgo.getDay() - 1));
    weekAgo.setHours(0, 0, 0, 0);

    try {
      if (isAdmin) {
        const [jRes, skbRes, sesiRes, profRes] = await Promise.all([
          api.getJurnal(),
          api.getSKB(),
          api.getSesi1on1(),
          api.getProfilingAll(),
        ]);

        // 0. Request sesi 1-on-1 dari anggota (minggu ini)
        const request1on1 = (jRes.data || []).filter(j =>
          j.request_1on1 && new Date(j.tanggal_jurnal || j.created_at) >= weekAgo
        );
        if (request1on1.length > 0) {
          const ids = request1on1.map(j => j.id).sort().join('_');
          const id = `request_1on1_${ids}`;
          list.push({
            id, type: 'urgent', icon: '🗣️', unread: !read.includes(id),
            title: `${request1on1.length} anggota minta sesi 1-on-1`,
            body: request1on1.map(j => `${j.nama.split(' ')[0]}${j.catatan_request ? ': ' + j.catatan_request.slice(0,40) : ''}`).join(' · '),
            time: new Date(request1on1[0].tanggal_jurnal || request1on1[0].created_at),
            path: '/1on1', urgent: true,
          });
        }

        // 1. Anggota belum isi jurnal minggu ini
        const isiMingguIni = new Set(
          (jRes.data || [])
            .filter(j => new Date(j.tanggal_jurnal || j.created_at) >= weekAgo)
            .map(j => j.nama)
        );
        const belum = tim.filter(t => !isiMingguIni.has(t.nama));
        if (belum.length > 0) {
          const id = `jurnal_belum_${now.toISOString().slice(0,10)}`;
          list.push({ id, type: 'jurnal', icon: '📓', unread: !read.includes(id),
            title: `${belum.length} anggota belum isi jurnal`,
            body: belum.map(t => t.nama.split(' ')[0]).join(', '),
            time: now, path: '/jurnal' });
        }

        // 2. SKB menunggu review
        const pending = (skbRes.data || []).filter(s => s.status === 'diajukan');
        if (pending.length > 0) {
          const id = `skb_pending_${pending.map(s=>s.id).join('_')}`;
          list.push({ id, type: 'skb', icon: '📋', unread: !read.includes(id),
            title: `${pending.length} SKB menunggu review`,
            body: pending.map(s => s.judul).join('; '),
            time: new Date(pending[0].created_at), path: '/skb' });
        }

        // 3. Sesi 1-on-1 belum dengan At Risk
        const atRisk = tim.filter(t => t.tipe === 'At Risk');
        if (atRisk.length > 0) {
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

        // 4. Profiling kadaluarsa (>90 hari tidak diupdate)
        const now90 = new Date(now - 90 * 24 * 60 * 60 * 1000);
        const profilingByNama = {};
        (profRes.data || []).forEach(p => {
          if (!profilingByNama[p.nama] || new Date(p.created_at) > new Date(profilingByNama[p.nama].created_at))
            profilingByNama[p.nama] = p;
        });
        const kadaluarsa = tim.filter(t => {
          const p = profilingByNama[t.nama];
          return !p || new Date(p.created_at) < now90;
        });
        if (kadaluarsa.length > 0) {
          const id = `profiling_kadaluarsa_${now.toISOString().slice(0,7)}`;
          list.push({ id, type: 'info', icon: '👤', unread: !read.includes(id),
            title: `${kadaluarsa.length} anggota perlu update profiling`,
            body: kadaluarsa.map(t => t.nama.split(' ')[0]).join(', ') + ' (>90 hari)',
            time: now, path: '/tim' });
        }

      } else {
        const [jRes, skbRes] = await Promise.all([
          api.getJurnal(user.nama),
          api.getSKB(),
        ]);

        const sudah = (jRes.data || []).some(j => new Date(j.tanggal_jurnal || j.created_at) >= weekAgo);
        const hari  = now.getDay();
        if (!sudah && hari >= 4) {
          const id = `my_jurnal_${now.toISOString().slice(0,10)}`;
          list.push({ id, type: 'jurnal', icon: '📓', unread: !read.includes(id),
            title: 'Belum isi jurnal minggu ini',
            body: 'Jurnal refleksi rutin tiap Jumat. Butuh ~10 menit.',
            time: now, path: '/jurnal/isi' });
        }

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
    } catch {
      // Notifikasi bersifat opsional — gagal fetch tidak crash UI
    }

    setNotifs(list);
    setLoading(false);
  }, [user, isAdmin, tim]);

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
