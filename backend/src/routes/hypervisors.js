'use strict';

const express = require('express');
const { db } = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { writeAudit, getIp } = require('../middleware/audit');
const { createHypervisorSchema, updateHypervisorSchema, validate } = require('../utils/validators');

const router = express.Router();

// ── GET /api/hypervisors ──────────────────────────────────────────────────────
router.get('/', authenticate, requireRole('read'), (req, res, next) => {
  try {
    const rows = db.prepare(`
      SELECT h.*,
        COUNT(v.id) AS vm_count
      FROM hypervisors h
      LEFT JOIN vms v ON v.hypervisor_id = h.id
      GROUP BY h.id
      ORDER BY h.name
    `).all();
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/hypervisors/:id ──────────────────────────────────────────────────
router.get('/:id', authenticate, requireRole('read'), (req, res, next) => {
  try {
    const row = db.prepare('SELECT * FROM hypervisors WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Hypervisor not found' });
    res.json(row);
  } catch (err) { next(err); }
});

// ── POST /api/hypervisors ─────────────────────────────────────────────────────
router.post('/', authenticate, requireRole('readwrite'), (req, res, next) => {
  try {
    const data = validate(createHypervisorSchema, req.body);
    const now  = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO hypervisors (name, hostname, type, description, created_at, updated_at)
      VALUES (@name, @hostname, @type, @description, @now, @now)
    `).run({
      name:        data.name,
      hostname:    data.hostname    ?? null,
      type:        data.type        ?? null,
      description: data.description ?? null,
      now,
    });

    const row = db.prepare('SELECT * FROM hypervisors WHERE id = ?').get(result.lastInsertRowid);
    writeAudit({
      user_id: req.user.id, username: req.user.username,
      action: 'hypervisor.create', entity_type: 'hypervisor',
      entity_id: row.id, entity_name: row.name,
      ip_address: getIp(req),
    });
    res.status(201).json(row);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      err.status = 409; err.message = 'Hypervisor name already exists';
    }
    next(err);
  }
});

// ── PUT /api/hypervisors/:id ──────────────────────────────────────────────────
router.put('/:id', authenticate, requireRole('readwrite'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM hypervisors WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Hypervisor not found' });

    const data   = validate(updateHypervisorSchema, req.body);
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');

    db.prepare(
      `UPDATE hypervisors SET ${fields}, updated_at = @now WHERE id = @id`
    ).run({ ...data, now: new Date().toISOString(), id: req.params.id });

    const row = db.prepare('SELECT * FROM hypervisors WHERE id = ?').get(req.params.id);
    writeAudit({
      user_id: req.user.id, username: req.user.username,
      action: 'hypervisor.update', entity_type: 'hypervisor',
      entity_id: row.id, entity_name: row.name,
      ip_address: getIp(req),
    });
    res.json(row);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      err.status = 409; err.message = 'Hypervisor name already exists';
    }
    next(err);
  }
});

// ── DELETE /api/hypervisors/:id ───────────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('readwrite'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM hypervisors WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Hypervisor not found' });

    const vmCount = db.prepare('SELECT COUNT(*) as n FROM vms WHERE hypervisor_id = ?').get(req.params.id).n;
    if (vmCount > 0) {
      return res.status(409).json({
        error: `Cannot delete — ${vmCount} VM${vmCount !== 1 ? 's are' : ' is'} assigned to this hypervisor`,
      });
    }

    db.prepare('DELETE FROM hypervisors WHERE id = ?').run(req.params.id);
    writeAudit({
      user_id: req.user.id, username: req.user.username,
      action: 'hypervisor.delete', entity_type: 'hypervisor',
      entity_id: existing.id, entity_name: existing.name,
      ip_address: getIp(req),
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
