import { useState } from 'react';

// Versi in-app dari docs/panduan-tambah-brand-ads.md — ubah keduanya bersamaan.

const TABS = [
  { id: 'mulai', label: 'Mulai' },
  { id: 'a',     label: 'BM Sama (A)' },
  { id: 'b',     label: 'BM Beda (B)' },
  { id: 'after', label: 'Setelah Dibuat' },
  { id: 'error', label: 'Error' },
];

const PS_TES = `$T = "TOKEN"
curl.exe "https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name&access_token=$T"`;

const ERRORS = [
  ['No permissions available (saat generate token)', 'System User belum punya role di App, atau app belum punya use case Marketing API.', 'Skenario B langkah 3; cek use case app.'],
  ['me/adaccounts → {"data":[]}', 'Ad account belum di-assign ke System User.', 'Skenario A langkah 1.'],
  ['(#200) Ad account owner has NOT grant ads_read…', 'Akun belum di-assign, atau app dan akun beda BM (app mode Development), atau brand memakai token yang salah (Nama Env Token kosong).', 'Cek assign, buat app di BM pemilik akun, cek ✏️ Edit Brand.'],
  ['190 … subcode 460 (session invalidated)', 'Token dicabut (Revoke tokens) atau dibatalkan Meta.', 'Generate token baru → update di Coolify → Redeploy.'],
  ['Cannot parse access token', 'Token salah tempel, terpotong, atau kelebihan spasi.', 'Tempel ulang lewat variabel $T.'],
  ['META_ACCESS_TOKEN_XXX tidak di-set', 'Env var belum dibuat, salah ketik, atau backend belum di-redeploy.', 'Cocokkan nama persis, lalu Redeploy.'],
  ['Sync gagal (500)', 'Alasan asli hanya ada di log backend.', 'Coolify → backend → Logs → cari baris "Gagal sync:".'],
  ['Brand sudah ada', 'Nama brand harus unik.', 'Pakai nama lain.'],
];

const S = {
  h:    { fontSize: 13, fontWeight: 700, color: 'var(--text-1)', margin: '16px 0 8px' },
  p:    { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 8px' },
  ol:   { margin: '0 0 8px', paddingLeft: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 },
  ul:   { margin: '0 0 8px', paddingLeft: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 },
  li:   { marginBottom: 8 },
  code: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-1)' },
  pre:  { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-1)', overflowX: 'auto', whiteSpace: 'pre', margin: '8px 0' },
  note: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: '3px solid #FFB84B', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: '8px 0' },
  th:   { padding: '7px 9px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' },
  td:   { padding: '8px 9px', fontSize: 12, color: 'var(--text-2)', borderBottom: '1px solid var(--border)', verticalAlign: 'top', lineHeight: 1.5 },
};

const C = ({ children }) => <code style={S.code}>{children}</code>;

function TabMulai() {
  return (
    <>
      <div style={S.h}>Konsep dasar</div>
      <ul style={S.ul}>
        <li style={S.li}>Hub mengambil data dari Meta memakai <b>access token</b>. Satu token = satu <b>Business Manager (BM)</b>.</li>
        <li style={S.li}>Satu token boleh dipakai banyak brand selama ad account-nya bisa diakses token itu.</li>
        <li style={S.li}>Token disimpan sebagai <b>env var di Coolify</b>, bukan di database. Brand hanya mencatat <i>nama</i> env var-nya di field <b>Nama Env Token</b>. Kosong = memakai <C>META_ACCESS_TOKEN</C>.</li>
      </ul>

      <div style={S.h}>Tentukan skenario</div>
      <p style={S.p}>Buka <b>Business Settings → Accounts → Ad accounts</b> pada BM yang token-nya ingin kamu pakai.</p>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={S.th}>Kondisi</th><th style={S.th}>Skenario</th></tr></thead>
          <tbody>
            <tr><td style={S.td}>Ad account <b>sudah ada</b> di daftar BM yang token-nya sudah kamu punya</td><td style={S.td}><b>A</b> — tanpa token baru</td></tr>
            <tr><td style={S.td}>Ad account di <b>BM lain</b>, pemiliknya mau share ke BM kamu (Partner)</td><td style={S.td}><b>A</b> — setelah dishare</td></tr>
            <tr><td style={S.td}>Ad account di <b>BM lain</b>, tidak bisa di-share, kamu punya akses admin di sana</td><td style={S.td}><b>B</b> — token baru dari BM itu</td></tr>
          </tbody>
        </table>
      </div>

      <div style={S.h}>Aturan penting</div>
      <ul style={S.ul}>
        <li style={S.li}>Jangan klik <b>Revoke tokens</b> kecuali sudah punya token pengganti yang terpasang di Coolify.</li>
        <li style={S.li}>Jangan pakai awalan <C>REACT_APP_</C> untuk token (ikut ter-bundle ke frontend).</li>
        <li style={S.li}>Jangan tempel token ke chat atau commit ke git.</li>
        <li style={S.li}>Kalau token berlaku 60 hari, catat tanggal ganti supaya sync tidak berhenti mendadak.</li>
      </ul>
    </>
  );
}

function TabA() {
  return (
    <>
      <div style={S.note}>Tidak perlu token baru dan tidak perlu redeploy.</div>
      <ol style={S.ol}>
        <li style={S.li}>
          <b>Beri akses ke System User.</b> Business Settings → Accounts → <b>Ad accounts</b> → pilih akun → <b>Add people</b> → tab <b>System users</b> → pilih System User pemilik token → aktifkan <b>View performance</b> → <b>Assign</b>.
          <br />Kalau akun belum ada di daftar dan dimiliki BM lain, minta pemiliknya: Business Settings → Ad accounts → pilih akun → <b>Assign Partners</b> → masukkan <b>Business ID</b> BM kamu (View performance). Lalu ulangi langkah ini.
        </li>
        <li style={S.li}>
          <b>Tes</b> (ganti <C>TOKEN</C>, jangan tempel token ke chat). Ad account baru harus muncul di hasil. Kalau <C>{'{"data":[]}'}</C>, akses belum ter-assign.
          <pre style={S.pre}>{PS_TES}</pre>
        </li>
        <li style={S.li}>
          <b>Tambah di Hub</b>: tombol <b>+ Brand</b>. Isi Nama Brand (unik) dan Ad Account ID (<C>act_xxxxxxxxxx</C>). <b>Nama Env Token</b> dikosongkan kalau BM-nya pakai <C>META_ACCESS_TOKEN</C>; isi nama env var lain kalau BM-nya memakai itu (misal <C>META_ACCESS_TOKEN_BM2</C>).
        </li>
        <li style={S.li}>Lanjut ke tab <b>Setelah Dibuat</b>.</li>
      </ol>
    </>
  );
}

function TabB() {
  return (
    <>
      <div style={S.note}>Lakukan <b>semua langkah di BM tempat ad account berada</b>.</div>
      <ol style={S.ol}>
        <li style={S.li}><b>Buat App</b> di developers.facebook.com → My Apps → Create App. Use case: <b>Create &amp; manage ads with Marketing API</b>. Di langkah Business, pilih BM tersebut.</li>
        <li style={S.li}><b>Buat System User</b>: Business Settings → Users → System Users → <b>Add</b> (role Employee cukup).</li>
        <li style={S.li}><b>Hubungkan System User ke App</b>: Business Settings → Accounts → <b>Apps</b> → pilih app → <b>Add People</b> → pilih System User → aktifkan <b>Develop app</b>. Tanpa ini, generate token menampilkan <i>"No permissions available"</i>.</li>
        <li style={S.li}><b>Beri akses ad account</b>: pilih System User → <b>Add assets</b> → <b>Ad accounts</b> → aktifkan <b>View performance</b>. Kalau tombol Add assets tidak terlihat, pakai cara tab A langkah 1 dari sisi Ad accounts.</li>
        <li style={S.li}><b>Generate token</b>: System User → <b>Generate token</b> → pilih app → expiration <b>Never</b> → centang <b><C>ads_read</C></b> → salin token (hanya tampil sekali).</li>
        <li style={S.li}>
          <b>Tes token</b> dengan perintah ini. Akun harus muncul.
          <pre style={S.pre}>{PS_TES}</pre>
        </li>
        <li style={S.li}>
          <b>Pasang di Coolify</b>: aplikasi <b>backend</b> → Environment Variables → <b>Add</b>.
          <ul style={{ ...S.ul, marginTop: 6 }}>
            <li>Name: <C>META_ACCESS_TOKEN_</C> + nama unik, misal <C>META_ACCESS_TOKEN_BM3</C> (harus diawali <C>META_ACCESS_TOKEN</C>; huruf besar, angka, underscore).</li>
            <li>Value: token. <b>Buildtime dimatikan, Runtime dicentang.</b></li>
            <li><b>Save</b>, lalu <b>Redeploy</b> backend — env var baru hanya terbaca setelah restart.</li>
          </ul>
        </li>
        <li style={S.li}><b>Tambah di Hub</b>: <b>+ Brand</b>, isi Nama, Ad Account ID, dan <b>Nama Env Token</b> dengan nama variabel dari langkah 7 (persis sama).</li>
        <li style={S.li}>Lanjut ke tab <b>Setelah Dibuat</b>.</li>
      </ol>
    </>
  );
}

function TabAfter() {
  return (
    <>
      <ol style={S.ol}>
        <li style={S.li}>Klik <b>⚙️ Setting</b> → isi <b>Kurs USD</b> dan <b>HPP default (%)</b>. Default kurs 16.000 dan HPP 0% — kalau dibiarkan, profit terlihat terlalu besar.</li>
        <li style={S.li}>Klik <b>📅 Sync Range</b> untuk menarik data historis, atau <b>Sync Meta</b> untuk kemarin.</li>
        <li style={S.li}>Isi <b>+ Input Harian</b> (jumlah order dan omzet) supaya profit dan ROAS terhitung.</li>
        <li style={S.li}>Sync otomatis jalan setiap hari <b>07:00 WIB</b> untuk semua brand aktif.</li>
      </ol>
      <div style={S.h}>Mengubah atau menghapus brand</div>
      <ul style={S.ul}>
        <li style={S.li}><b>✏️ Edit Brand</b> (muncul setelah memilih satu brand): ubah nama, akun, env token, dan status aktif.</li>
        <li style={S.li}>Untuk berhenti sync tanpa kehilangan data, hilangkan centang <b>Brand aktif</b>.</li>
        <li style={S.li}><b>Hapus</b> brand menghapus semua data insights, report harian, dan threshold brand itu secara permanen.</li>
      </ul>
    </>
  );
}

function TabError() {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
        <thead><tr><th style={S.th}>Pesan</th><th style={S.th}>Penyebab</th><th style={S.th}>Solusi</th></tr></thead>
        <tbody>
          {ERRORS.map(([pesan, sebab, solusi]) => (
            <tr key={pesan}>
              <td style={{ ...S.td, color: 'var(--text-1)', fontWeight: 600 }}>{pesan}</td>
              <td style={S.td}>{sebab}</td>
              <td style={S.td}>{solusi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TAB_VIEW = { mulai: TabMulai, a: TabA, b: TabB, after: TabAfter, error: TabError };

export default function PanduanBrandAdsModal({ onClose }) {
  const [tab, setTab] = useState('mulai');
  const View = TAB_VIEW[tab];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '18px 22px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>📖 Panduan Menambah Brand</div>
          <button onClick={onClose} aria-label="Tutup" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '12px 22px 0', borderBottom: '1px solid var(--border)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '7px 12px', fontSize: 12, fontWeight: tab === t.id ? 700 : 500, background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--green)' : 'transparent'}`, color: tab === t.id ? 'var(--text-1)' : 'var(--text-3)', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ padding: '4px 22px 22px', overflowY: 'auto' }}>
          <View />
        </div>
      </div>
    </div>
  );
}
