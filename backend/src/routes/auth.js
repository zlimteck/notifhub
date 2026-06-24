const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' });

  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

  const ok = await user.verifyPassword(password);
  if (!ok) return res.status(401).json({ error: 'Identifiants incorrects' });

  const token = signToken({ id: user._id, username: user.username });
  res.json({ token, username: user.username });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const jwt = require('jsonwebtoken');
    const SECRET = process.env.JWT_SECRET || 'orveil-secret-change-me';
    const payload = jwt.verify(header.slice(7), SECRET);
    res.json({ username: payload.username });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const jwt = require('jsonwebtoken');
    const SECRET = process.env.JWT_SECRET || 'orveil-secret-change-me';
    const payload = jwt.verify(header.slice(7), SECRET);
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Champs requis' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 caractères min)' });

    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const ok = await user.verifyPassword(currentPassword);
    if (!ok) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

module.exports = router;
