const express = require('express');
const cors    = require('cors');
const path    = require('path');
const hubRoutes = require('./hub');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Creanimasi Hub running on port ${PORT}`);
});
