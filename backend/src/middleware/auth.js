const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'notifhub-secret-change-me';

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non authentifié' });
  const token = header.slice(7);

  // Try JWT first
  try {
    req.user = jwt.verify(token, SECRET);
    return next();
  } catch {}

  // Fallback: check against MCP API key
  try {
    const Settings = require('../models/Settings');
    const s = await Settings.findOne({ key: 'global' }).lean();
    if (s?.mcpApiKey && token === s.mcpApiKey) {
      req.user = { username: 'api', role: 'admin' };
      return next();
    }
  } catch {}

  res.status(401).json({ error: 'Token invalide ou expiré' });
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

module.exports = { authMiddleware, signToken };
