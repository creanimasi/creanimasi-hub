import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDarkMode } from '../hooks/useDarkMode';

export default function Login({ onLogin }) {
  const { login }  = useAuth();
  const [dark, toggleDark] = useDarkMode();
  const [form, setForm]    = useState({ username: '', password: '' });
  const [error, setError]  = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) { setError('Isi username dan password'); return; }
    setLoading(true); setError('');
    try {
      const user = await login(form.username, form.password);
      onLogin?.(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow blobs */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,214,143,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(155,143,255,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Theme toggle */}
      <button onClick={toggleDark} style={{
        position: 'absolute', top: 20, right: 20,
        width: 36, height: 36, borderRadius: 10,
        border: '1px solid var(--border-2)', background: 'var(--surface-2)',
        cursor: 'pointer', fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{dark ? '☀️' : '🎮'}</button>

      {/* Login card */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)',
        borderRadius: 20,
        border: '1px solid var(--border)',
        padding: '36px 32px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,214,143,0.05)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--green-light)',
            border: '1px solid rgba(0,214,143,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 0 24px rgba(0,214,143,0.2)',
            padding: 8, overflow: 'hidden',
          }}>
            <img src="/logo192.png" alt="Flipspace" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            Flipspace<span style={{ color: 'var(--green)' }}>.</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, fontWeight: 500,
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Internal Hub
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handle}>
          {error && (
            <div className="alert alert-red" style={{ marginBottom: 16, fontSize: 12 }}>
              <span>⚠️</span><div>{error}</div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'block', marginBottom: 7 }}>Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="Masukkan username kamu"
              autoComplete="username"
              autoFocus
              style={{ fontSize: 14, padding: '10px 13px' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'block', marginBottom: 7 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ fontSize: 14, padding: '10px 40px 10px 13px', letterSpacing: showPass ? 0 : '0.1em' }}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-3)', fontSize: 14, padding: 4,
              }}>{showPass ? '🙈' : '👁️'}</button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14,
              fontWeight: 700, letterSpacing: '0.02em', borderRadius: 12,
              boxShadow: loading ? 'none' : '0 0 20px rgba(0,214,143,0.3)',
            }}>
            {loading ? 'Masuk...' : '⚡ Masuk ke Hub'}
          </button>
        </form>

        {/* Hint akun */}
      </div>
    </div>
  );
}
