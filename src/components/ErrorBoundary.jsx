import { Component } from 'react';

// Menangkap error render di satu halaman supaya sidebar/topbar tetap hidup dan
// user bisa pindah halaman, bukan layar kosong total. `resetKey` (path aktif)
// mereset kondisi error saat user berpindah halaman.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) this.setState({ hasError: false });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ maxWidth: 420, margin: '60px auto', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Halaman ini mengalami masalah</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
          Coba muat ulang. Kalau tetap muncul, buka halaman lain lewat menu di samping dan kabari admin.
        </div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Muat ulang</button>
      </div>
    );
  }
}
