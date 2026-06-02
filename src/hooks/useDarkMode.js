import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function useDarkMode(userTema) {
  const [dark, setDark] = useState(() => {
    // Prioritas: tema dari DB (via userTema) → localStorage → default dark
    if (userTema) return userTema !== 'light';
    const saved = localStorage.getItem('theme');
    return saved ? saved !== 'light' : true;
  });

  // Sync tema dari DB saat user login/me loaded
  useEffect(() => {
    if (userTema) {
      const isD = userTema !== 'light';
      setDark(isD);
    }
  }, [userTema]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = () => {
    setDark(d => {
      const next = !d;
      // Simpan ke DB di background (best-effort)
      api.setTema(next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  };

  return [dark, toggle];
}
