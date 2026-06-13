const express = require('express');
const cors    = require('cors');
const path    = require('path');
const hubRoutes = require('./hub');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', credentials: true }));
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
