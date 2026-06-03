import { useState } from 'react';

// ── SOP ────────────────────────────────────────────────────────────────────
export function SOP() {
  const [active, setActive] = useState(null);

  const SOPS = [
    { id: 'illus',    label: 'Illustrasi',    ico: '🎨', wajib: 7,  c: 'var(--purple)', bg: 'var(--purple-light)',
      items: ['Referensi visual minimal 3 gambar','Deskripsi karakter lengkap','Art style dengan referensi','Pose spesifik atau referensi','Background ada atau transparan','Format file output','Jumlah revisi sesuai paket'] },
    { id: 'rigging',  label: 'Live2D Rigging', ico: '🎬', wajib: 8, c: 'var(--coral)',  bg: 'var(--coral-light)',
      items: ['File PSD layered sudah diterima','Tier rigging sudah ditentukan','Software target (VTube Studio, dll)','Jumlah ekspresi yang dibutuhkan','Toggle outfit/aksesori','Physics priority','Referensi gerakan','Versi VTube Studio klien'] },
    { id: 'vrm',      label: 'VRM 3D',         ico: '📦', wajib: 8,  c: 'var(--blue)',   bg: 'var(--blue-light)',
      items: ['Referensi sheet 2D tampak depan','Tier model (VRoid/semi/full custom)','Software target','Jumlah outfit','Aksesori khusus','BlendShape yang dibutuhkan','Spring bone priority','Polygon budget'] },
    { id: 'ar',       label: 'AR Filter',      ico: '✨', wajib: 7,  c: 'var(--green)',  bg: 'var(--green-light)',
      items: ['Platform target (Instagram/TikTok)','Jenis filter (face/world)','Model 3D yang digunakan','Animasi yang dibutuhkan','Akun platform klien','Referensi filter','Elemen tambahan'] },
    { id: '3dp',      label: '3D Print',       ico: '🖨️', wajib: 8, c: 'var(--amber)',  bg: 'var(--amber-light)',
      items: ['Referensi desain karakter','Ukuran fisik dalam cm','Material cetak (PLA/resin)','Perlu painting atau tidak','Jasa cetak yang digunakan','Jumlah part','Pose karakter','Kebutuhan base/stand'] },
    { id: 'pm-check', label: 'Checklist PM',   ico: '✅', wajib: 10, c: 'var(--green)',  bg: 'var(--green-light)',
      items: ['Nama klien dan platform tercantum','Jenis project spesifik','Deadline dengan tanggal spesifik','Harga yang disepakati','Minimal 3 referensi visual','Deskripsi karakter lengkap','Format file output','Jumlah revisi dikomunikasikan','Klien sudah konfirmasi brief','Tidak ada informasi ambigu'] },
  ];

  return (
    <div>
      <div className="alert alert-amber" style={{ marginBottom: 16 }}>
        <span>⚠️</span>
        <div>Brief yang tidak lengkap adalah sumber utama revisi berulang. Gunakan checklist ini sebelum meneruskan ke PM.</div>
      </div>

      <div className="grid-2">
        {SOPS.map(s => (
          <div key={s.id} className="card" style={{ cursor: 'pointer' }}
            onClick={() => setActive(active === s.id ? null : s.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: active === s.id ? 12 : 0 }}>
              <div className="module-icon" style={{ background: s.bg, color: s.c }}>{s.ico}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{s.wajib} informasi wajib</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{active === s.id ? '▲' : '▼'}</span>
            </div>
            {active === s.id && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {s.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0', fontSize: 12 }}>
                    <span style={{ color: s.c, flexShrink: 0, marginTop: 1 }}>☐</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">🚩 Red flag klien</div>
        {[
          { f: 'Deadline ASAP', a: 'Klarifikasi deadline realistis, tawarkan rush fee' },
          { f: 'Brief tidak jelas — "terserah aja"', a: 'Minta brief spesifik sebelum terima order' },
          { f: 'Revisi sampai puas / unlimited', a: 'Tegaskan batas revisi sesuai paket di awal' },
          { f: 'Ganti konsep setelah approve', a: 'Tunjukkan bukti approval — biaya tambahan' },
          { f: 'Tidak mau DP untuk klien baru', a: 'Minimal 50% DP sebelum mulai' },
          { f: 'Request file source gratis', a: 'PSD/Blender file adalah add-on berbayar' },
        ].map((r, i) => (
          <div key={i} className="member-row">
            <span style={{ color: 'var(--red)', fontSize: 14 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{r.f}</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{r.a}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

