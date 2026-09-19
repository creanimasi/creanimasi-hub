const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const hubRoutes = require('./hub');

const app  = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

// Di belakang reverse proxy Coolify/nginx — perlu agar req.ip (dipakai rate limiter) benar
app.set('trust proxy', 1);

// Header keamanan dasar untuk API JSON
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Auth di app ini pakai Bearer token (bukan cookie), jadi credentials tidak dibutuhkan —
// origin dibatasi lewat allowlist eksplisit (CORS_ORIGIN env, koma-pisah) agar tidak terbuka ke semua domain.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,https://hub.creanimasi.com')
  .split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origin tidak diizinkan oleh CORS'));
  },
}));
// Endpoint auth tidak pernah butuh body besar — batasi sebelum parser global 25mb
app.use('/api/hub/auth', express.json({ limit: '10kb' }));
app.use(express.json({ limit: '25mb' }));

// Health check
app.get('/api/health', (_, res) => res.json({ ok: true, service: 'creanimasi-hub' }));

// API routes
app.use('/api/hub', hubRoutes);

// Serve React build hanya kalau memang ada (di deployment Coolify frontend disajikan
// container nginx terpisah, jadi build tidak ada di sini). Path yang tidak dikenal
// dibalas 404 JSON — tidak membocorkan path internal server.
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(path.join(buildPath, 'index.html'))) {
  app.use(express.static(buildPath));
  app.get('*', (req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}
app.use((req, res) => res.status(404).json({ error: 'Tidak ditemukan' }));

// Pastikan error body parser (payload terlalu besar, JSON tidak valid) tetap dibalas JSON
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Ukuran data terlalu besar. Kurangi jumlah/ukuran screenshot.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Format data tidak valid' });
  }
  if (err.message === 'Origin tidak diizinkan oleh CORS') {
    return res.status(403).json({ error: err.message });
  }
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

app.listen(PORT, () => {
  console.log(`Creanimasi Hub running on port ${PORT}`);
});
