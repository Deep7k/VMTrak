'use strict';

const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const rateLimit  = require('express-rate-limit');
const { db }     = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { writeAudit, getIp } = require('../middleware/audit');
const { loginSchema, initialSetupSchema, validate } = require('../utils/validators');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed login attempts — try again in 15 minutes' },
});

const ACCESS_EXPIRY  = process.env.ACCESS_TOKEN_EXPIRY  || '15m';
const REFRESH_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
}

function issueRefreshToken(userId) {
  const raw  = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS).toISOString();

  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(userId, hash, expiresAt);

  return raw;
}

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res, next) => {
  try {
    const { username, password } = validate(loginSchema, req.body);
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? AND is_active = 1'
    ).get(username);

    const ip = getIp(req);

    if (!user) {
      writeAudit({ action: 'auth.login_failed', entity_type: 'auth', detail: { username }, ip_address: ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      writeAudit({ user_id: user.id, username: user.username, action: 'auth.login_failed', entity_type: 'auth', ip_address: ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken  = signAccessToken(user);
    const refreshToken = issueRefreshToken(user.id);

    writeAudit({ user_id: user.id, username: user.username, action: 'auth.login', entity_type: 'auth', ip_address: ip });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   REFRESH_EXPIRY_MS,
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        must_change_password: user.must_change_password === 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req, res, next) => {
  try {
    const raw = req.cookies?.refreshToken;
    if (!raw) return res.status(401).json({ error: 'No refresh token' });

    const hash   = crypto.createHash('sha256').update(raw).digest('hex');
    const stored = db.prepare(
      "SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > datetime('now')"
    ).get(hash);

    if (!stored) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(stored.user_id);
    if (!user)  return res.status(401).json({ error: 'User not found or deactivated' });

    // Rotate — delete old, issue new
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
    const newRefresh = issueRefreshToken(user.id);
    const accessToken = signAccessToken(user);

    res.cookie('refreshToken', newRefresh, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   REFRESH_EXPIRY_MS,
    });

    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res, next) => {
  try {
    const raw = req.cookies?.refreshToken;
    if (raw) {
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash);
    }
    writeAudit({ user_id: req.user.id, username: req.user.username, action: 'auth.logout', entity_type: 'auth', ip_address: getIp(req) });
    res.clearCookie('refreshToken');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, role, must_change_password, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  res.json({ ...user, must_change_password: user.must_change_password === 1 });
});

// POST /api/auth/complete-setup
router.post('/complete-setup', authenticate, (req, res, next) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.must_change_password) return res.status(400).json({ error: 'Setup already completed' });

    const { email, password } = validate(initialSetupSchema, req.body);

    const emailConflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, user.id);
    if (emailConflict) return res.status(409).json({ error: 'Email already in use' });

    const hash = bcrypt.hashSync(password, 12);

    db.prepare(`
      UPDATE users
      SET email = ?, password_hash = ?, must_change_password = 0, updated_at = datetime('now')
      WHERE id = ?
    `).run(email, hash, user.id);

    // Invalidate all existing refresh tokens so the next request uses the fresh state
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);

    writeAudit({
      user_id: user.id,
      username: user.username,
      action: 'auth.setup_completed',
      entity_type: 'user',
      entity_id: user.id,
      entity_name: user.username,
      ip_address: getIp(req),
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
