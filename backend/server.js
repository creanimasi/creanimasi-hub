const express = require('express');
const cors    = require('cors');
const path    = require('path');
const hubRoutes = require('./hub');

const app  = express();
const PORT = process.env.PORT || 3000;

// Di belakang reverse proxy Coolify/nginx — perlu agar req.ip (dipakai rate limiter) benar
app.set('trust proxy', 1);

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
app.use(express.json({ limit: '25mb' }));

// Health check
app.get('/api/health', (_, res) => res.json({ ok: true, service: 'creanimasi-hub' }));

// API routes
app.use('/api/hub', hubRoutes);

// Serve React build
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Pastikan error body parser (payload terlalu besar, JSON tidak valid) tetap dibalas JSON
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Ukuran data terlalu besar. Kurangi jumlah/ukuran screenshot.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Format data tidak valid' });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Creanimasi Hub running on port ${PORT}`);
});
