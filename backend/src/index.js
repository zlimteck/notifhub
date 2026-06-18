require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
const runner = require('./monitors/runner');
const { authMiddleware } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Frontend static files (before auth middleware)
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Public API routes
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/ping',   require('./routes/ping'));
app.use('/api/events', require('./routes/sse'));
app.use('/api/public', require('./routes/public'));
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date() }));

// Protected API routes
app.use('/api', authMiddleware);
app.use('/api/monitors',  require('./routes/monitors'));
app.use('/api/logs',      require('./routes/logs'));
app.use('/api/settings',  require('./routes/settings'));
app.use('/api/history',   require('./routes/history'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/stats',    require('./routes/stats'));

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

const PORT = process.env.PORT || 5050;

async function initAdmin() {
  const User = require('./models/User');
  const count = await User.countDocuments();
  if (count === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'notifhub';
    await User.create({ username, password });
    console.log(`[Auth] Compte admin créé : ${username} / ${password}`);
    console.log('[Auth] ⚠️  Changez le mot de passe dans Paramètres !');
  }
}

connectDB().then(async () => {
  await initAdmin();
  app.listen(PORT, () => console.log(`Backend NotifHub sur :${PORT}`));
  runner.start();
});
