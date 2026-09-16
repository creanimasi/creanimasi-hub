import { useState, useEffect } from 'react';
import { api } from '../services/api';

// Nama hook dipertahankan "useDarkMode" (dipakai di Layout.jsx & Login.jsx) meski
// sekarang mengelola 3 tema (dark/light/retro), bukan cuma boolean gelap-terang —
// menghindari ubah import di banyak file untuk penambahan yang sifatnya perluasan.
const THEMES = ['dark', 'light', 'retro'];

export function useDarkMode(userTema) {
  const [theme, setTheme] = useState(() => {
    // Prioritas: tema dari DB (via userTema) → localStorage → default dark
    if (userTema && THEMES.includes(userTema)) return userTema;
    const saved = localStorage.getItem('theme');
    return THEMES.includes(saved) ? saved : 'dark';
  });

  // Sync tema dari DB saat user login/me loaded
  useEffect(() => {
    if (userTema && THEMES.includes(userTema)) setTheme(userTema);
  }, [userTema]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Siklus: dark -> light -> retro -> dark
  const cycleTheme = () => {
    setTheme(t => {
      const next = THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
      api.setTema(next).catch(() => {}); // simpan ke DB di background (best-effort)
      return next;
    });
  };

  return [theme, cycleTheme];
}
