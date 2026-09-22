import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';

const HEARTBEAT_INTERVAL = 30 * 1000; // 30 detik

export function usePresence(user) {
  const [onlineUsers, setOnlineUsers] = useState([]); // [{ id, nama, username, role }]
  const [connected,   setConnected]   = useState(false);
  const sseRef       = useRef(null);
  const heartbeatRef = useRef(null);

  // Kirim heartbeat ke server
  const sendHeartbeat = useCallback(() => {
    if (!user) return;
    api.heartbeat().catch(() => {}); // best-effort, tidak crash kalau gagal
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let reconnectTimer = null;
    const RECONNECT_MS = 5000;

    // === SSE: terima update real-time siapa yang online ===
    // Tiket dari /presence/ticket sekali-pakai — kalau langsung pakai auto-retry bawaan EventSource
    // (URL & tiket yang sama), server sudah menghapus tiket itu → 401 terus dan presence beku selamanya.
    // Di sini reconnect diambil alih manual: tiap kali putus, tutup koneksi lama & minta tiket baru.
    const connect = async () => {
      if (cancelled) return;
      try {
        const sse = await api.connectPresence();
        if (cancelled) { sse.close(); return; }
        if (sseRef.current) sseRef.current.close();
        sseRef.current = sse;

        sse.onopen = () => setConnected(true);

        sse.onmessage = (e) => {
          try {
            const list = JSON.parse(e.data);
            setOnlineUsers(list);
          } catch {}
        };

        sse.onerror = () => {
          if (cancelled) return;
          setConnected(false);
          sse.close();
          if (sseRef.current === sse) sseRef.current = null;
          // Snapshot langsung supaya data tidak basi selama menunggu reconnect
          api.getPresence().then(r => setOnlineUsers(r.data || [])).catch(() => {});
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, RECONNECT_MS);
        };
      } catch {
        // Browser tidak support EventSource atau gagal ambil tiket — fallback ke snapshot + coba lagi
        if (cancelled) return;
        api.getPresence().then(r => setOnlineUsers(r.data || [])).catch(() => {});
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, RECONNECT_MS);
      }
    };
    connect();

    // === Heartbeat: kirim tiap 30 detik ===
    sendHeartbeat(); // kirim langsung saat mount
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // === Tandai offline saat tab ditutup / halaman ditinggalkan ===
    const handleUnload = () => api.offlineSignal().catch(() => {});
    window.addEventListener('beforeunload', handleUnload);

    // === Pause heartbeat saat tab tidak aktif; saat kembali aktif juga cek SSE (bisa putus diam-diam
    // selagi tab disembunyikan) ===
    const handleVisibility = () => {
      if (document.hidden) return;
      sendHeartbeat();
      if (!sseRef.current || sseRef.current.readyState === EventSource.CLOSED) {
        clearTimeout(reconnectTimer);
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      // Cleanup
      cancelled = true;
      clearTimeout(reconnectTimer);
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
      api.offlineSignal().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Helper: cek apakah user tertentu sedang online
  const isOnline = useCallback((namaOrUsername) =>
    onlineUsers.some(u => u.nama === namaOrUsername || u.username === namaOrUsername),
  [onlineUsers]);

  return { onlineUsers, connected, isOnline };
}
