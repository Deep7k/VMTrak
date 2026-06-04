'use strict';

const express = require('express');
const net     = require('net');
const { db } = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { writeAudit, getIp } = require('../middleware/audit');
const { createHypervisorSchema, updateHypervisorSchema, validate } = require('../utils/validators');

const router = express.Router();

// Port to probe per hypervisor type
function probePort(type) {
  switch (type) {
    case 'VMware vSphere': return 443;
    case 'Proxmox':        return 8006;
    case 'Hyper-V':        return 5985;
    case 'KVM':            return 22;
    default:               return 22;
  }
}

// ── GET /api/hypervisors/reachability?ids=1,2 ─────────────────────────────────
router.get('/reachability', authenticate, requireRole('read'), async (req, res, next) => {
  try {
    const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
    if (ids.length === 0) return res.json({});
    if (ids.length > 50) return res.status(400).json({ error: 'Max 50 IDs per request' });

    const placeholders = ids.map(() => '?').join(',');
    const hypervisors = db.prepare(
      `SELECT id, hostname, type FROM hypervisors WHERE id IN (${placeholders})`
    ).all(...ids);

    const checkPort = (host, port) => new Promise(resolve => {
      const socket = new net.Socket();
      let done = false;
      const finish = status => { if (!done) { done = true; socket.destroy(); resolve(status); } };
      socket.setTimeout(2000);
      socket.connect(port, host, () => finish('online'));
      socket.on('error', () => finish('offline'));
      socket.on('timeout', () => finish('offline'));
    });

    const results = await Promise.all(
      hypervisors.map(async hv => {
        if (!hv.hostname) return [String(hv.id), 'unknown'];
        const port   = probePort(hv.type);
        const status = await checkPort(hv.hostname, port);
        return [String(hv.id), status];
      })
    );

    res.json(Object.fromEntries(results));
  } catch (err) { next(err); }
});

// ── GET /api/hypervisors ──────────────────────────────────────────────────────
router.get('/', authenticate, requireRole('read'), (req, res, next) => {
  try {
    const rows = db.prepare(`
      SELECT h.*, COUNT(v.id) AS vm_count
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
      INSERT INTO hypervisors (name, hostname, type, version, description, status, environment, vcpu, ram_gb, disk_gb, created_at, updated_at)
      VALUES (@name, @hostname, @type, @version, @description, @status, @environment, @vcpu, @ram_gb, @disk_gb, @now, @now)
    `).run({
      name:        data.name,
      hostname:    data.hostname    ?? null,
      type:        data.type        ?? null,
      version:     data.version     ?? null,
      description: data.description ?? null,
      status:      data.status      ?? 'active',
      environment: data.environment ?? null,
      vcpu:        data.vcpu        ?? null,
      ram_gb:      data.ram_gb      ?? null,
      disk_gb:     data.disk_gb     ?? null,
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
