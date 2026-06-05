'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const { db }   = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { writeAudit, getIp }         = require('../middleware/audit');
const { createUserSchema, updateUserSchema, resetPasswordSchema, validate } = require('../utils/validators');

const router = express.Router();

// All user management routes require admin
router.use(authenticate, requireRole('admin'));

const PUBLIC_FIELDS = 'id, username, email, role, department, is_active, notify_expiry, created_at, updated_at';

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const users = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY username`).all();
    res.json(users);
  } catch (err) { next(err); }
});

// ── POST /api/users ───────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const data = validate(createUserSchema, req.body);
    const hash = await bcrypt.hash(data.password, 12);

    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)'
    ).run(data.username, data.email, hash, data.role, data.department ?? null);

    const user = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(result.lastInsertRowid);

    writeAudit({
      user_id: req.user.id, username: req.user.username,
      action: 'user.create', entity_type: 'user',
      entity_id: user.id, entity_name: user.username,
      ip_address: getIp(req),
    });

    res.status(201).json(user);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      err.status = 409; err.message = 'Username or email already exists';
    }
    next(err);
  }
});

// ── PUT /api/users/:id ────────────────────────────────────────────────────────
router.put('/:id', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    // Prevent demoting the last active admin
    const data = validate(updateUserSchema, req.body);
    if (data.role !== 'admin' || data.is_active === false) {
      const adminCount = db.prepare("SELECT COUNT(*) as n FROM users WHERE role = 'admin' AND is_active = 1").get().n;
      if (adminCount <= 1 && existing.role === 'admin') {
        return res.status(400).json({ error: 'Cannot demote or deactivate the last admin' });
      }
    }

    const updates = {};
    if (data.email         !== undefined) updates.email         = data.email;
    if (data.role          !== undefined) updates.role          = data.role;
    if (data.is_active     !== undefined) updates.is_active     = data.is_active ? 1 : 0;
    if (data.notify_expiry !== undefined) updates.notify_expiry = data.notify_expiry ? 1 : 0;
    if (data.department    !== undefined) updates.department    = data.department ?? null;
    updates.updated_at = new Date().toISOString();

    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE users SET ${fields} WHERE id = @id`).run({ ...updates, id: req.params.id });

    const user = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(req.params.id);

    writeAudit({
      user_id: req.user.id, username: req.user.username,
      action: 'user.update', entity_type: 'user',
      entity_id: user.id, entity_name: user.username,
      ip_address: getIp(req),
    });

    res.json(user);
  } catch (err) { next(err); }
});

// ── POST /api/users/:id/reset-password ───────────────────────────────────────
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const target = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const { new_password } = validate(resetPasswordSchema, req.body);
    const hash = await bcrypt.hash(new_password, 12);

    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, target.id);
    // Invalidate all refresh tokens for that user
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(target.id);

    writeAudit({
      user_id: req.user.id, username: req.user.username,
      action: 'user.password_reset', entity_type: 'user',
      entity_id: target.id, entity_name: target.username,
      ip_address: getIp(req),
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── DELETE /api/users/:id  (soft-delete) ─────────────────────────────────────
router.delete('/:id', (req, res, next) => {
  try {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot deactivate yourself' });

    const adminCount = db.prepare("SELECT COUNT(*) as n FROM users WHERE role = 'admin' AND is_active = 1").get().n;
    if (adminCount <= 1 && target.role === 'admin') {
      return res.status(400).json({ error: 'Cannot deactivate the last admin' });
    }

    db.prepare("UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(target.id);
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(target.id);

    writeAudit({
      user_id: req.user.id, username: req.user.username,
      action: 'user.deactivate', entity_type: 'user',
      entity_id: target.id, entity_name: target.username,
      ip_address: getIp(req),
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
