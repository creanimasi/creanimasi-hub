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

    // === SSE: terima update real-time siapa yang online ===
    let sse;
    try {
      sse = api.connectPresence();
      sseRef.current = sse;

      sse.onopen = () => setConnected(true);

      sse.onmessage = (e) => {
        try {
          const list = JSON.parse(e.data);
          setOnlineUsers(list);
        } catch {}
      };

      sse.onerror = () => {
        setConnected(false);
        // Fallback: polling snapshot tiap 60 detik kalau SSE error
        api.getPresence()
          .then(r => setOnlineUsers(r.data || []))
          .catch(() => {});
      };
    } catch {
      // Browser tidak support EventSource, fallback ke snapshot
      api.getPresence().then(r => setOnlineUsers(r.data || [])).catch(() => {});
    }

    // === Heartbeat: kirim tiap 30 detik ===
    sendHeartbeat(); // kirim langsung saat mount
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // === Tandai offline saat tab ditutup / halaman ditinggalkan ===
    const handleUnload = () => api.offlineSignal().catch(() => {});
    window.addEventListener('beforeunload', handleUnload);

    // === Pause heartbeat saat tab tidak aktif ===
    const handleVisibility = () => {
      if (!document.hidden) sendHeartbeat();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      // Cleanup
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
