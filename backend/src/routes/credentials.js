'use strict';

const express   = require('express');
const { db }    = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { writeAudit, getIp }         = require('../middleware/audit');
const { encryptPassword, decryptPassword } = require('../services/encryption');
const { createCredentialSchema, updateCredentialSchema, validate } = require('../utils/validators');

const router = express.Router();

const MASKED = '••••••••';

function resolveVm(id) {
  return db.prepare('SELECT id, vm_name FROM vms WHERE id = ?').get(id);
}

// ── GET /api/vms/:id/credentials ──────────────────────────────────────────────
router.get('/:id/credentials', authenticate, requireRole('readwrite'), (req, res, next) => {
  try {
    const vm = resolveVm(req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });

    const creds = db.prepare(
      'SELECT id, vm_id, username, account_type, notes, created_at, updated_at FROM vm_credentials WHERE vm_id = ?'
    ).all(vm.id);

    // Return credentials with password masked
    res.json(creds.map(c => ({ ...c, password: MASKED })));
  } catch (err) { next(err); }
});

// ── POST /api/vms/:id/credentials  [admin] ───────────────────────────────────
router.post('/:id/credentials', authenticate, requireRole('readwrite'), (req, res, next) => {
  try {
    const vm = resolveVm(req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });

    const data = validate(createCredentialSchema, req.body);
    const enc  = encryptPassword(data.password);

    const result = db.prepare(`
      INSERT INTO vm_credentials (vm_id, username, password_enc, password_iv, password_tag, account_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(vm.id, data.username, enc.password_enc, enc.password_iv, enc.password_tag, data.account_type, data.notes ?? null);

    const cred = db.prepare(
      'SELECT id, vm_id, username, account_type, notes, created_at, updated_at FROM vm_credentials WHERE id = ?'
    ).get(result.lastInsertRowid);

    writeAudit({
      user_id: req.user.id, username: req.user.username,
      action: 'credential.create', entity_type: 'credential',
      entity_id: cred.id, entity_name: `${vm.vm_name} / ${cred.username}`,
      ip_address: getIp(req),
    });

    res.status(201).json({ ...cred, password: MASKED });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      err.status = 409; err.message = 'A credential with that username already exists for this VM';
    }
    next(err);
  }
});

// ── PUT /api/vms/:id/credentials/:cid  [admin] ───────────────────────────────
router.put('/:id/credentials/:cid', authenticate, requireRole('readwrite'), (req, res, next) => {
  try {
    const vm   = resolveVm(req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });

    const cred = db.prepare('SELECT * FROM vm_credentials WHERE id = ? AND vm_id = ?').get(req.params.cid, vm.id);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    const data    = validate(updateCredentialSchema, req.body);
    const updates = {};

    if (data.username)     updates.username     = data.username;
    if (data.account_type) updates.account_type = data.account_type;
    if ('notes' in data)   updates.notes        = data.notes;

    if (data.password) {
      const enc = encryptPassword(data.password);
      updates.password_enc = enc.password_enc;
      updates.password_iv  = enc.password_iv;
      updates.password_tag = enc.password_tag;
    }

    updates.updated_at = new Date().toISOString();

    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE vm_credentials SET ${fields} WHERE id = @id`).run({ ...updates, id: cred.id });

    const updated = db.prepare(
      'SELECT id, vm_id, username, account_type, notes, created_at, updated_at FROM vm_credentials WHERE id = ?'
    ).get(cred.id);

    writeAudit({
      user_id: req.user.id, username: req.user.username,
      action: 'credential.update', entity_type: 'credential',
      entity_id: cred.id, entity_name: `${vm.vm_name} / ${updated.username}`,
      ip_address: getIp(req),
    });

    res.json({ ...updated, password: MASKED });
  } catch (err) { next(err); }
});

// ── DELETE /api/vms/:id/credentials/:cid  [admin] ────────────────────────────
router.delete('/:id/credentials/:cid', authenticate, requireRole('readwrite'), (req, res, next) => {
  try {
    const vm   = resolveVm(req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });

    const cred = db.prepare('SELECT * FROM vm_credentials WHERE id = ? AND vm_id = ?').get(req.params.cid, vm.id);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    db.prepare('DELETE FROM vm_credentials WHERE id = ?').run(cred.id);

    writeAudit({
      user_id: req.user.id, username: req.user.username,
      action: 'credential.delete', entity_type: 'credential',
      entity_id: cred.id, entity_name: `${vm.vm_name} / ${cred.username}`,
      ip_address: getIp(req),
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/vms/:id/credentials/:cid/reveal ─────────────────────────────────
router.get('/:id/credentials/:cid/reveal', authenticate, requireRole('readwrite'), (req, res, next) => {
  try {
    const vm   = resolveVm(req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });

    const cred = db.prepare('SELECT * FROM vm_credentials WHERE id = ? AND vm_id = ?').get(req.params.cid, vm.id);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    const plaintext = decryptPassword(cred.password_enc, cred.password_iv, cred.password_tag);

    writeAudit({
      user_id: req.user.id, username: req.user.username,
      action: 'credential.view', entity_type: 'credential',
      entity_id: cred.id, entity_name: `${vm.vm_name} / ${cred.username}`,
      ip_address: getIp(req),
    });

    res.json({ password: plaintext });
  } catch (err) { next(err); }
});

module.exports = router;
