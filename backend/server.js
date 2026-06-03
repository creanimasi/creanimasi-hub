const express = require('express');
const cors    = require('cors');
const hubRoutes = require('./hub');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'creanimasi-hub-api' }));
app.use('/api/hub', hubRoutes);

app.listen(PORT, () => {
  console.log(`Creanimasi Hub API running on port ${PORT}`);
});
