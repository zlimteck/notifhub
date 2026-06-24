require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
const runner = require('./monitors/runner');
const { authMiddleware } = require('./middleware/auth');

const app = express();

// Security headers
app.use(require('helmet')({ contentSecurityPolicy: false }));

// CORS — open in dev, restricted to FRONTEND_URL in production
const corsOrigin = process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL
  : true;
app.use(cors({ origin: corsOrigin, credentials: true }));

// Body size limit
app.use(express.json({ limit: '1mb' }));

// Frontend static files (before auth middleware)
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Public API routes
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/ping',   require('./routes/ping'));
app.use('/api/events', require('./routes/sse'));
app.use('/api/public', require('./routes/public'));
app.use('/api/badge',  require('./routes/badge'));
app.use('/api/mcp',    require('./routes/mcp'));
app.use('/api/webhook', require('./routes/webhook'));
console.log('[MCP] Serveur MCP démarré sur /api/mcp (Streamable HTTP)');
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date() }));

// Metrics endpoint — own auth: accepts JWT, MCP key, or METRICS_TOKEN env var
app.use('/api/metrics', async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  // 1. Static METRICS_TOKEN env var (Prometheus / Grafana)
  const metricsToken = process.env.METRICS_TOKEN;
  if (metricsToken && token === metricsToken) return next();

  // 2. Fallback to standard JWT / MCP key auth
  const { authMiddleware: auth } = require('./middleware/auth');
  return auth(req, res, next);
}, require('./routes/metrics'));

// Protected API routes
app.use('/api', authMiddleware);
app.use('/api/monitors',  require('./routes/monitors'));
app.use('/api/logs',      require('./routes/logs'));
app.use('/api/settings',  require('./routes/settings'));
app.use('/api/history',   require('./routes/history'));
app.use('/api/incidents',   require('./routes/incidents'));
app.use('/api/annotations', require('./routes/annotations'));
app.use('/api/stats',       require('./routes/stats'));
app.use('/api/ai',          require('./routes/ai'));
app.use('/api/search',      require('./routes/search'));
app.use('/api/changelog',   require('./routes/changelog'));

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

const PORT = process.env.PORT || 5050;

async function initAdmin() {
  const User = require('./models/User');
  const count = await User.countDocuments();
  if (count === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'orveil';
    await User.create({ username, password });
    console.log(`[Auth] Compte admin créé : ${username} / ${password}`);
    console.log('[Auth] ⚠️  Changez le mot de passe dans Paramètres !');
  }
}

if (!process.env.ENCRYPTION_KEY) {
  console.warn('[Crypto] ⚠️  ENCRYPTION_KEY non définie — les tokens/mots de passe sont stockés en clair.');
}

connectDB().then(async () => {
  await initAdmin();
  app.listen(PORT, () => console.log(`Backend Orveil sur :${PORT}`));
  runner.start();
});
