// Slide laporan Ads mingguan (16:9, 1920×1080 px). Dipakai untuk preview (skala kecil via `scale`)
// dan ekspor PDF (skala 1, tiap elemen [data-slide] = satu halaman).

export const SLIDE_W = 1920;
export const SLIDE_H = 1080;

const FONT = "'Montserrat','Poppins','Inter',system-ui,-apple-system,'Segoe UI',sans-serif";
const C = {
  header: '#FFBD59', shadow: '#FF9557', body: '#F9F8EA', judul: '#8B3A1E',
  angka: '#343B73', teks: '#1B1B1B', pink: '#FA5A83', coklat: '#5A4038', ungu: '#E5DCF0',
  merah: '#D9363E',
};
const BG = 'linear-gradient(165deg, #B79CF0 0%, #83B4F4 42%, #3FD9F7 100%)';
const BULAN_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const fmtInt = (n) => Number(n || 0).toLocaleString('id-ID');
const fmtRp = (n) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`;
const fmtCtr = (n) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(2).replace('.', ',')}%`);

export function namaBulan(bulan) {
  const m = Number(String(bulan || '').slice(5, 7));
  return BULAN_EN[m - 1] || '';
}

const BULAN_ID_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_EN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-09-03','2026-09-09' → "3–9 Sep"; lintas bulan → "24 Agu–2 Sep". en=true untuk PDF (nama bulan Inggris).
export function labelRentang(dari, sampai, en = false) {
  if (!dari || !sampai) return '';
  const nm = en ? BULAN_EN_PENDEK : BULAN_ID_PENDEK;
  const [, m1, d1] = dari.split('-').map(Number);
  const [, m2, d2] = sampai.split('-').map(Number);
  if (dari.slice(0, 7) === sampai.slice(0, 7)) return d1 === d2 ? `${d1} ${nm[m1 - 1]}` : `${d1}–${d2} ${nm[m1 - 1]}`;
  return `${d1} ${nm[m1 - 1]}–${d2} ${nm[m2 - 1]}`;
}

function Slide({ children, scale, index }) {
  const kecil = scale !== 1;
  return (
    <div
      className="slide-wrap"
      style={kecil ? { width: SLIDE_W * scale, height: SLIDE_H * scale, marginBottom: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.35)', borderRadius: 8, overflow: 'hidden' } : undefined}
    >
      <div
        data-slide={index}
        style={{ width: SLIDE_W, height: SLIDE_H, position: 'relative', overflow: 'hidden', background: BG, fontFamily: FONT, color: C.teks, zoom: kecil ? scale : undefined }}
      >
        {/* grid halus: SVG (bukan repeating-gradient) karena html2canvas tidak menggambar repeating-gradient */}
        <svg width={SLIDE_W} height={SLIDE_H} style={{ position: 'absolute', left: 0, top: 0 }}>
          <defs>
            <pattern id={`grid${index}`} width="64" height="64" patternUnits="userSpaceOnUse">
              <path d="M64 0H0V64" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#grid${index})`} />
        </svg>
        {children}
      </div>
    </div>
  );
}

// Pakai background-image (bukan <img object-fit>) — html2canvas mengabaikan object-fit sehingga maskot melar saat diekspor PDF.
function Maskot({ src, style, posisi = 'center bottom' }) {
  if (!src) return null;
  return (
    <div style={{ position: 'absolute', backgroundImage: `url("${src}")`, backgroundRepeat: 'no-repeat', backgroundSize: 'contain', backgroundPosition: posisi, ...style }} />
  );
}

function WinCard({ title, style, bodyStyle, headerBg = C.header, titleColor = C.judul, titleSize = 48, dot = '#fff', children }) {
  return (
    <div style={{ position: 'absolute', ...style }}>
      <div style={{ position: 'absolute', inset: 0, transform: 'translate(14px, 14px)', background: C.shadow, borderRadius: 36 }} />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 36, overflow: 'hidden', background: C.body }}>
        <div style={{ height: 92, flexShrink: 0, background: headerBg, display: 'flex', alignItems: 'center', gap: 14, padding: '0 36px' }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 18, height: 18, borderRadius: 9, background: dot, flexShrink: 0 }} />)}
          <span style={{ marginLeft: 10, fontSize: titleSize, fontWeight: 900, color: titleColor, letterSpacing: -0.5, whiteSpace: 'nowrap' }}>{title}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, ...bodyStyle }}>{children}</div>
      </div>
    </div>
  );
}

function Donut({ segmen, size = 400, tebal = 120 }) {
  const total = segmen.reduce((s, x) => s + x.nilai, 0);
  const r = (size - tebal) / 2;
  const keliling = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4E2D4" strokeWidth={tebal} />
        {total > 0 && segmen.filter(x => x.nilai > 0).map((x, i) => {
          const panjang = (x.nilai / total) * keliling;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={x.warna} strokeWidth={tebal}
              strokeDasharray={`${panjang} ${keliling - panjang}`} strokeDashoffset={-offset} />
          );
          offset += panjang;
          return el;
        })}
      </g>
    </svg>
  );
}

function InstagramIcon({ size = 96 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96">
      <defs>
        <linearGradient id="igGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FFC107" /><stop offset="0.35" stopColor="#F4511E" />
          <stop offset="0.7" stopColor="#D81B60" /><stop offset="1" stopColor="#8E24AA" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="84" height="84" rx="24" fill="none" stroke="url(#igGrad)" strokeWidth="9" />
      <circle cx="48" cy="48" r="20" fill="none" stroke="url(#igGrad)" strokeWidth="9" />
      <circle cx="71" cy="25" r="5.5" fill="url(#igGrad)" />
    </svg>
  );
}

// ── Slide 1: cover ───────────────────────────────────────────────────────────
function Cover({ d }) {
  const ada = !!d.maskot;
  const lebarTeks = ada ? 1120 : 1700;
  // ukuran judul menyesuaikan panjang nama supaya muat satu baris (rata-rata lebar huruf ≈ 0,62 em)
  const ukuranJudul = Math.max(70, Math.min(200, Math.floor(lebarTeks / (Math.max(String(d.judul || '').length, 1) * 0.62))));
  return (
    <>
      <Maskot src={d.maskot} style={{ left: 40, bottom: 0, height: 1040, width: 760 }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: ada ? 750 : 0, right: 50, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: ada ? 'flex-end' : 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 62, fontWeight: 900, color: C.coklat, whiteSpace: 'nowrap' }}>
          <span>Weekly report</span>
          <span style={{ background: C.coklat, color: '#fff', padding: '4px 26px' }}>{namaBulan(d.bulan)} {d.minggu}</span>
        </div>
        <div style={{ fontSize: ukuranJudul, lineHeight: 1.05, fontWeight: 900, color: '#fff', margin: '30px 0 34px', textAlign: ada ? 'right' : 'center', textShadow: '0 6px 0 rgba(90,64,56,0.18)' }}>{d.judul}</div>
        {d.igHandle ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
            <InstagramIcon />
            <span style={{ fontSize: 68, fontWeight: 900, color: C.coklat }}>{d.igHandle}</span>
          </div>
        ) : null}
      </div>
    </>
  );
}

// ── Slide 2: order queue, flow, problem ──────────────────────────────────────
function OrderFlow({ d }) {
  const m = d.mingguan[d.minggu - 1] || {};
  const oq = m.order_queue || {};
  const baris = [
    { label: 'IN PROGRESS', nilai: oq.in_progress || 0, warna: '#87E8E8' },
    { label: 'REVISION', nilai: oq.revisi || 0, warna: '#6BBCD9' },
    { label: 'READY DELIVERED', nilai: oq.ready || 0, warna: '#4A93B8' },
  ];
  const total = baris.reduce((s, x) => s + x.nilai, 0);
  const kendala = (m.kendala || []).slice(0, 5);
  return (
    <>
      <Maskot src={d.maskot} style={{ right: -60, bottom: 0, height: 900, width: 460 }} />
      <WinCard title="Order queue" style={{ left: 70, top: 60, width: 900, height: 610 }} bodyStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 44px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 54, fontWeight: 700 }}>Total Order</div>
          <div style={{ fontSize: 170, fontWeight: 900, color: C.angka, lineHeight: 1.05, marginBottom: 24 }}>{total}</div>
          {baris.map(b => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
              <span style={{ width: 34, height: 34, borderRadius: 17, background: b.warna, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 27, letterSpacing: 2, fontWeight: 500, whiteSpace: 'nowrap' }}>{b.label}</span>
              <span style={{ fontSize: 46, fontWeight: 900, color: C.angka, minWidth: 60, textAlign: 'right' }}>{b.nilai}</span>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 24 }}><Donut segmen={baris} size={340} tebal={104} /></div>
      </WinCard>
      <WinCard title="Flow in a weeks" titleSize={42} style={{ left: 1010, top: 60, width: 560, height: 610 }} bodyStyle={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 44, fontWeight: 700 }}>New Order</div>
        <div style={{ fontSize: 150, fontWeight: 900, color: C.angka, lineHeight: 1.1, marginBottom: 20 }}>{m.flow_new || 0}</div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>Complete Order</div>
        <div style={{ fontSize: 150, fontWeight: 900, color: C.angka, lineHeight: 1.1 }}>{m.flow_complete || 0}</div>
      </WinCard>
      <WinCard title="Problem in a weeks" headerBg={C.pink} titleColor="#fff" titleSize={44} style={{ left: 70, top: 715, width: 1120, height: 300 }} bodyStyle={{ background: '#fff', padding: '18px 44px', overflow: 'hidden' }}>
        {kendala.length === 0
          ? <div style={{ fontSize: 34, color: '#777', paddingTop: 26 }}>Tidak ada kendala minggu ini.</div>
          : (
            <ul style={{ margin: 0, paddingLeft: 38, fontSize: 34, fontWeight: 600, lineHeight: 1.3 }}>
              {kendala.map((k, i) => <li key={i}>{k}</li>)}
            </ul>
          )}
      </WinCard>
    </>
  );
}

// ── Slide 3: performance tracking ────────────────────────────────────────────
function Performance({ d }) {
  const { minggu, auto, mingguan, kpi } = d;
  const minggus = [1, 2, 3, 4];
  const kolom = '340px 170px repeat(4, 1fr)';
  const tampil = (w) => w <= minggu;
  const totalProfit = auto.slice(0, minggu).reduce((s, a) => s + (a.profit || 0), 0);
  const kpiTeks = (v, fmt = fmtInt) => (v ? fmt(v) : '');

  const baris = [
    { label: 'Impresi', kpi: kpiTeks(kpi.impresi), sel: w => fmtInt(auto[w - 1].impresi) },
    { label: 'CTR (rata-rata)', kpi: kpi.ctr ? fmtCtr(kpi.ctr) : '', sel: w => fmtCtr(auto[w - 1].ctr) },
    { label: 'Profile Visit', kpi: kpiTeks(kpi.profile_visit), sel: w => fmtInt(mingguan[w - 1].profile_visit) },
    { label: 'Chat masuk', kpi: kpiTeks(kpi.chat_masuk), sel: w => fmtInt(mingguan[w - 1].chat_masuk) },
    { label: 'Order', kpi: kpiTeks(kpi.order), sel: w => fmtInt(auto[w - 1].jumlah_order) },
  ];
  const barisUang = [
    { label: 'Iklan', sel: w => fmtRp(auto[w - 1].spend) },
    { label: 'Omzet', sel: w => fmtRp(auto[w - 1].omzet) },
    { label: 'Profit', sel: w => fmtRp(auto[w - 1].profit), merahBilaNegatif: w => auto[w - 1].profit < 0 },
  ];
  const sel = { padding: '0 18px', fontSize: 34, fontWeight: 800, display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' };
  const garis = { borderLeft: '4px solid #FFC978' };
  const tinggiBaris = 58;

  return (
    <>
      <WinCard title="PERFORMANCE TRACKING" titleSize={56} style={{ left: 50, top: 50, width: 1820, height: 980 }} bodyStyle={{ padding: '14px 34px 26px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: kolom, alignItems: 'center', height: 84 }}>
          <div style={{ background: '#161616', color: '#fff', borderRadius: 12, padding: '8px 22px', fontSize: 40, fontWeight: 900, display: 'flex', justifyContent: 'space-between', gridColumn: '1 / 3' }}>
            <span>DATA</span><span>KPI</span>
          </div>
          {minggus.map(w => (
            <div key={w} style={{ ...sel, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', lineHeight: 1.05 }}>
              <span style={{ fontSize: 42, fontWeight: 900, color: C.judul }}>Minggu {w}</span>
              {d.rentang?.[w - 1] && <span style={{ fontSize: 24, fontWeight: 700, color: '#A5694A' }}>{labelRentang(d.rentang[w - 1].dari, d.rentang[w - 1].sampai, true)}</span>}
            </div>
          ))}
        </div>
        {baris.map(b => (
          <div key={b.label} style={{ display: 'grid', gridTemplateColumns: kolom, height: tinggiBaris, alignItems: 'center' }}>
            <div style={sel}>{b.label}</div>
            <div style={sel}>{b.kpi}</div>
            {minggus.map(w => <div key={w} style={{ ...sel, ...garis }}>{tampil(w) ? b.sel(w) : ''}</div>)}
          </div>
        ))}
        <div style={{ background: C.ungu, margin: '6px -34px 0', padding: '0 34px' }}>
          {barisUang.map(b => (
            <div key={b.label} style={{ display: 'grid', gridTemplateColumns: kolom, height: tinggiBaris, alignItems: 'center' }}>
              <div style={sel}>{b.label}</div>
              <div style={sel} />
              {minggus.map(w => (
                <div key={w} style={{ ...sel, ...garis, color: tampil(w) && b.merahBilaNegatif?.(w) ? C.merah : undefined }}>{tampil(w) ? b.sel(w) : ''}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: kolom, marginTop: 14, height: 170 }}>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={{ background: '#161616', color: '#fff', borderRadius: 12, padding: '8px 22px', fontSize: 40, fontWeight: 900, display: 'inline-block' }}>TO DO LIST</span>
          </div>
          {minggus.map(w => (
            <div key={w} style={{ ...garis, padding: '0 18px', overflow: 'hidden' }}>
              {tampil(w) && (
                <ul style={{ margin: 0, paddingLeft: 26, fontSize: 27, fontWeight: 700, lineHeight: 1.25 }}>
                  {(mingguan[w - 1].todo || []).slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30, background: '#C5E1FF', border: '4px solid #7C86E0', borderRadius: 18, padding: '10px 36px' }}>
            <span style={{ fontSize: 38, fontWeight: 800 }}>Total Profit</span>
            <span style={{ fontSize: 54, fontWeight: 900, color: totalProfit < 0 ? C.merah : C.teks }}>{fmtRp(totalProfit)}</span>
          </div>
        </div>
      </WinCard>
    </>
  );
}

// ── Slide: ads creatives (satu slide per kreatif) ────────────────────────────
function Kreatif({ d, k }) {
  const minggus = [1, 2, 3, 4].filter(w => w <= d.minggu);
  return (
    <>
      <Maskot src={d.maskot} posisi="center top" style={{ right: -90, top: 130, height: 620, width: 380 }} />
      <WinCard title="Ads Creatives" style={{ left: 70, top: 60, width: 1520, height: 960 }} bodyStyle={{ display: 'flex', gap: 60, padding: '34px 50px' }}>
        <div style={{ width: 560, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 20, overflow: 'hidden', border: '3px solid #ECE9D6' }}>
          {k.gambar
            ? <img src={k.gambar} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <span style={{ fontSize: 30, color: '#999' }}>Belum ada gambar</span>}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34 }}>
          {k.nama ? <div style={{ fontSize: 38, fontWeight: 900, color: C.judul }}>{k.nama}</div> : null}
          {minggus.map(w => (
            <div key={w}>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#8a8570', letterSpacing: 2 }}>MINGGU {w}</div>
              <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.2 }}>Chat masuk : {k.mingguan[w - 1]?.chat ?? 0}</div>
              <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.2 }}>order : {k.mingguan[w - 1]?.order ?? 0}</div>
            </div>
          ))}
        </div>
      </WinCard>
    </>
  );
}

// ── Slide: galeri gambar (proyek selesai / portofolio baru) ──────────────────
function Galeri({ d, judul, gambar }) {
  const kolom = gambar.length <= 1 ? 1 : gambar.length <= 4 ? 2 : 3;
  return (
    <>
      <Maskot src={d.maskot} posisi="center top" style={{ right: -90, top: 130, height: 620, width: 380 }} />
      <WinCard title={judul} style={{ left: 70, top: 60, width: 1600, height: 960 }} bodyStyle={{ padding: 34, display: 'grid', gridTemplateColumns: `repeat(${kolom}, 1fr)`, gridAutoRows: '1fr', gap: 22 }}>
        {gambar.map((g, i) => (
          <div key={i} style={{ background: '#2B2B2B', borderRadius: 14, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
            <img src={g} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        ))}
      </WinCard>
    </>
  );
}

function Terimakasih({ d }) {
  return (
    <>
      <Maskot src={d.maskot} style={{ left: 380, bottom: 40, height: 820, width: 480 }} />
      <div style={{ position: 'absolute', left: 900, top: 250, transform: 'rotate(-6deg)', fontFamily: "'Segoe Print','Comic Sans MS','Bradley Hand',cursive", fontSize: 230, fontWeight: 900, lineHeight: 1, color: '#0d0d0d', letterSpacing: 4 }}>
        THANK<br />YOU!
      </div>
    </>
  );
}

// data: { judul, igHandle, maskot, bulan 'YYYY-MM', minggu 1..4, kpi, auto[4], mingguan[4],
//         kreatif [{nama, gambar, mingguan[4]}], proyek [dataUrl], portofolio [dataUrl] }
export default function SlideDeck({ data, scale = 1 }) {
  const slide = [
    <Cover key="cover" d={data} />,
    <OrderFlow key="order" d={data} />,
    <Performance key="perf" d={data} />,
    ...data.kreatif.map((k, i) => <Kreatif key={`kr${i}`} d={data} k={k} />),
    ...(data.proyek.length ? [<Galeri key="proyek" d={data} judul="Completed Projects in a week" gambar={data.proyek} />] : []),
    ...(data.portofolio.length ? [<Galeri key="porto" d={data} judul="New portfolio" gambar={data.portofolio} />] : []),
    <Terimakasih key="thanks" d={data} />,
  ];
  return (
    <>
      {slide.map((el, i) => <Slide key={el.key} index={i} scale={scale}>{el}</Slide>)}
    </>
  );
}
