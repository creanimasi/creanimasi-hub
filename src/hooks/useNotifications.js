import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useTim } from './useTim';

const STORAGE_KEY = 'hub_notif_read';
const getRead = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
// Akun tanpa tautan tim → /rpg/quests selalu 404; jangan ditanyakan lagi tiap polling.
let rpgTanpaTim = null; // id user yang terbukti tidak punya tautan tim
const TIGA_HARI = 3 * 24 * 60 * 60 * 1000;
// build() sering jalan dobel berbarengan (tim selesai dimuat) → satu request dipakai bersama.
let rpgQuestCache = null; // { uid, at, promise }
const fetchRpgQuests = (uid) => {
  if (rpgQuestCache && rpgQuestCache.uid === uid && Date.now() - rpgQuestCache.at < 20000) return rpgQuestCache.promise;
  const promise = api.rpgQuests();
  rpgQuestCache = { uid, at: Date.now(), promise };
  return promise;
};

// 'YYYY-MM' → kode bulan sebelumnya (periode target berkode bulan tempat tanggal tutupnya jatuh)
const bulanLalu = (kode) => { const [y, m] = kode.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };

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

    // ── RPG: dipisah supaya kegagalannya tidak menghapus notifikasi lain ──
    try {
      if (!(user.page_access || []).includes('rpg-admin')) throw new Error('skip');
      const rv = await api.rpgAdminReview();
      const antre = rv.data || [];
      if (antre.length > 0) {
        const id = `rpg_review_${antre.map(a => a.id).join('_')}`;
        list.push({ id, type: 'urgent', icon: '⚔️', unread: !read.includes(id),
          title: `${antre.length} quest menunggu persetujuan`,
          body: antre.slice(0, 4).map(a => `${a.nama.split(' ')[0]}: ${a.judul}`).join(' · '),
          time: new Date(antre[0].diajukan_pada), path: '/rpg/kelola', urgent: true });
      }
    } catch { /* bukan pemegang rpg-admin, atau gagal — dilewati */ }
    if (rpgTanpaTim !== user.id && (user.page_access || []).includes('rpg-quests')) {
      try {
        const q = (await fetchRpgQuests(user.id)).data;
        const semua = q.groups.flatMap(g => g.quests).filter(x => x.reviewedAt && now - new Date(x.reviewedAt) < TIGA_HARI);
        semua.filter(x => x.status === 'ditolak').forEach(x => {
          const id = `rpg_tolak_${x.id}_${x.reviewedAt}`;
          list.push({ id, type: 'warn', icon: '❌', unread: !read.includes(id), title: `Quest "${x.title}" ditolak`,
            body: x.dueLabel.replace(/^Ditolak:? ?/, ''), time: new Date(x.reviewedAt), path: '/rpg/quests' });
        });
        q.completed.filter(x => x.reviewedAt && now - new Date(x.reviewedAt) < TIGA_HARI).forEach(x => {
          const id = `rpg_ok_${x.id}`;
          list.push({ id, type: 'ok', icon: '✅', unread: !read.includes(id), title: `Quest "${x.title}" disetujui`,
            body: `+${x.xpReward} XP`, time: new Date(x.reviewedAt), path: '/rpg/quests' });
        });
      } catch (e) { if (/^(404|403)/.test(e.message || '')) rpgTanpaTim = user.id; }
    }

    // ── Target poin produksi (anggota produksi): pengingat, capaian, hasil periode lalu ──
    if (rpgTanpaTim !== user.id && (user.page_access || []).includes('rpg-quests')) {
      try {
        const t = (await api.rpgTarget()).data;
        if (t.ikut && t.saya.target && t.saya.status !== 'dikecualikan') {
          const { periode, saya } = t;
          if (saya.status === 'tercapai') {
            const id = `target_ok_${periode.kode}`;
            list.push({ id, type: 'ok', icon: '🎯', unread: !read.includes(id), title: `Target poin ${periode.label} tercapai`,
              body: `${saya.poin.toLocaleString('id-ID')} dari ${saya.target.toLocaleString('id-ID')} poin`, time: now, path: '/rpg/quests' });
          } else if (periode.fase === 'berjalan' && periode.sisaHari >= 1 && periode.sisaHari <= 7) {
            const id = `target_ingat_${periode.kode}_${periode.sisaHari <= 3 ? 3 : 7}`;
            list.push({ id, type: 'warn', icon: '🎯', unread: !read.includes(id), urgent: periode.sisaHari <= 3,
              title: `Target poin: sisa ${periode.sisaHari} hari`,
              body: `Kurang ${(saya.target - saya.poin).toLocaleString('id-ID')} poin${saya.butuhPerHari ? ` (~${saya.butuhPerHari}/hari)` : ''} — ${saya.poin}/${saya.target}`,
              time: now, path: '/rpg/quests' });
          }
        }
        // hasil periode yang baru dikunci: tampil di 10 hari pertama periode berikutnya
        const lalu = t.ikut && t.riwayat[0];
        if (lalu && lalu.kode === bulanLalu(t.periode.kode) && t.periode.hariBerjalan <= 10) {
          const id = `target_hasil_${lalu.kode}`;
          list.push({ id, type: lalu.status === 'tercapai' ? 'ok' : 'info', icon: '🏁', unread: !read.includes(id),
            title: `Hasil target ${lalu.label}: ${lalu.status === 'tercapai' ? 'tercapai' : lalu.status === 'belum' ? 'belum tercapai' : 'tidak dinilai'}`,
            body: `${lalu.poin.toLocaleString('id-ID')}${lalu.target ? ' dari ' + lalu.target.toLocaleString('id-ID') : ''} poin${lalu.peringkat ? ' · peringkat #' + lalu.peringkat : ''}`,
            time: now, path: '/rpg/guild?tab=target' });
        }
      } catch { /* opsional — bukan anggota produksi / gagal dimuat */ }
    }
    // ── Admin: periode target yang sudah berakhir dan menunggu dikunci ──
    if ((user.page_access || []).some(k => k === 'rpg-admin' || k === 'rpg-pantau')) {
      try {
        const r = (await api.rpgTargetRekap('sebelumnya')).data;
        if (r && r.fase === 'menunggu_kunci') {
          const id = `target_kunci_${r.periode.kode}`;
          list.push({ id, type: 'info', icon: '🔒', unread: !read.includes(id),
            title: `Periode target ${r.periode.label} menunggu dikunci`,
            body: r.tahanKunci ? 'Penguncian otomatis ditahan — kunci manual bila sudah siap.' : `${r.ringkasan.tercapai} dari ${r.ringkasan.peserta} tercapai (sementara). Dikunci otomatis ${r.kunciOtomatisPada}.`,
            time: now, path: '/rpg/kelola?tab=target' });
        }
      } catch { /* periode sebelumnya belum ada / tak berhak — dilewati */ }
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
