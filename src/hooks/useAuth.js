import { useState, useEffect, createContext, useContext } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

// Coba restore session dengan retry maksimal 3x (jeda 1 detik)
async function restoreSession(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await api.me();
      // Pastikan respons benar-benar punya data user
      if (res?.user?.id) {
        return { user: res.user, error: null };
      }
      // Respons OK tapi tidak ada user → token tidak valid
      return { user: null, error: 'invalid_token' };
    } catch (err) {
      const msg = err.message || '';
      // Token invalid/expired (401/403) → langsung logout, jangan retry
      if (msg.includes('401') || msg.includes('403') ||
          msg.includes('tidak valid') || msg.includes('Token')) {
        return { user: null, error: 'invalid_token' };
      }
      // Error jaringan/server → tunggu sebentar dan retry
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  // Semua retry gagal (server down) → tetap token, jangan logout
  return { user: null, error: 'network_error' };
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hub_token');
    if (!token) { setLoading(false); return; }

    restoreSession(3).then(({ user, error }) => {
      if (user) {
        setUser(user);
      } else if (error === 'invalid_token') {
        // Token memang tidak valid — hapus dan minta login ulang
        localStorage.removeItem('hub_token');
      }
      // error === 'network_error': token tetap disimpan, halaman loading selesai
      // Komponen lain akan dapat error API dan user bisa refresh manual
      setLoading(false);
    });
  }, []);

  const login = async (username, password) => {
    const res = await api.login(username, password);
    localStorage.setItem('hub_token', res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('hub_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
