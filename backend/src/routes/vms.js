'use strict';

const express = require('express');
const { parse: parseCsv } = require('csv-parse/sync');
const { db } = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { writeAudit, getIp } = require('../middleware/audit');
const { vmSchema, updateVmSchema, vmQuerySchema, validate } = require('../utils/validators');
const { generateRdpContent } = require('../services/rdp');

const router = express.Router();

// ── Allowed sort columns (whitelist to prevent SQL injection via column name) ──
const SORTABLE = new Set([
  'vm_name', 'ip_address', 'status', 'environment', 'power_state',
  'owner', 'department', 'expiry_date', 'created_at', 'updated_at',
]);

// ── GET /api/vms ──────────────────────────────────────────────────────────────
router.get('/', authenticate, (req, res, next) => {
  try {
    const q = validate(vmQuerySchema, req.query);

    const where = [];
    const params = [];

    if (q.search) {
      where.push("(vm_name LIKE ? OR hostname LIKE ? OR ip_address LIKE ? OR owner LIKE ?)");
      const s = `%${q.search}%`;
      params.push(s, s, s, s);
    }
    if (q.environment) { where.push('environment = ?'); params.push(q.environment); }
    if (q.status) { where.push('status = ?'); params.push(q.status); }
    if (q.power_state) { where.push('power_state = ?'); params.push(q.power_state); }
    if (q.department) { where.push('department = ?'); params.push(q.department); }
    if (q.expiring_in != null) {
      where.push("expiry_date IS NOT NULL AND expiry_date <= date('now', ? || ' days')");
      params.push(`+${q.expiring_in}`);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const sortCol = SORTABLE.has(q.sort) ? q.sort : 'created_at';
    const order = q.order === 'asc' ? 'ASC' : 'DESC';
    const offset = (q.page - 1) * q.limit;

    const total = db.prepare(`SELECT COUNT(*) as n FROM vms ${whereClause}`).get(...params).n;
    const rows = db.prepare(
      `SELECT vms.*, (
         SELECT username FROM vm_credentials
         WHERE vm_id = vms.id AND account_type = 'primary'
         LIMIT 1
       ) as primary_username
       FROM vms ${whereClause} ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`
    ).all(...params, q.limit, offset);

    res.json({ data: rows, total, page: q.page, limit: q.limit });
  } catch (err) { next(err); }
});

// ── GET /api/vms/export  (CSV) ────────────────────────────────────────────────
router.get('/export', authenticate, (req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM vms WHERE status != 'decommissioned'").all();

    const cols = [
      'vm_name', 'vm_tag', 'description', 'hypervisor', 'cluster', 'datacenter',
      'os_type', 'os_version', 'hostname', 'ip_address', 'vlan', 'mac_address',
      'vcpu', 'ram_gb', 'disk_gb', 'power_state', 'environment', 'status',
      'owner', 'department', 'application', 'expiry_date', 'notes',
    ];

    const escape = v => {
      if (v == null) return '';
      let s = String(v);
      // Neutralise CSV formula injection (Excel/LibreOffice interpret leading =+-@)
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv = [
      cols.join(','),
      ...rows.map(r => cols.map(c => escape(r[c])).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vmtrak-export.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// ── POST /api/vms/import  [admin] ─────────────────────────────────────────────
router.post(
  '/import',
  authenticate,
  requireRole('admin'),
  express.text({ type: ['text/csv', 'text/plain', 'application/octet-stream'] }),
  (req, res, next) => {
    try {
      const body = typeof req.body === 'string' ? req.body : '';
      if (!body.trim()) return res.status(400).json({ error: 'Request body is empty' });

      let rows;
      try {
        rows = parseCsv(body, { columns: true, skip_empty_lines: true, trim: true });
      } catch {
        return res.status(400).json({ error: 'Invalid CSV format' });
      }

      if (rows.length === 0) return res.status(400).json({ error: 'CSV contains no data rows' });

      const NUMERIC = ['vcpu', 'ram_gb', 'disk_gb'];
      const errors  = [];
      let imported  = 0;

      const insert = db.prepare(`
        INSERT INTO vms (
          vm_name, vm_tag, description, hypervisor, cluster, datacenter,
          os_type, os_version, hostname, ip_address, vlan, mac_address,
          vcpu, ram_gb, disk_gb, power_state, environment, status,
          owner, department, application, expiry_date, notes,
          created_at, updated_at, created_by, updated_by
        ) VALUES (
          @vm_name, @vm_tag, @description, @hypervisor, @cluster, @datacenter,
          @os_type, @os_version, @hostname, @ip_address, @vlan, @mac_address,
          @vcpu, @ram_gb, @disk_gb, @power_state, @environment, @status,
          @owner, @department, @application, @expiry_date, @notes,
          @now, @now, @user_id, @user_id
        )
      `);

      const runImport = db.transaction(() => {
        const now = new Date().toISOString();

        rows.forEach((rawRow, idx) => {
          const rowNum = idx + 2; // 1-based + header

          // Normalise keys to lowercase, coerce empty strings → undefined
          const row = {};
          for (const [k, v] of Object.entries(rawRow)) {
            const key = k.toLowerCase().trim();
            row[key] = v === '' ? undefined : v;
          }
          for (const f of NUMERIC) {
            if (row[f] != null) row[f] = Number(row[f]);
          }

          const result = vmSchema.safeParse(row);
          if (!result.success) {
            const fieldErrors = result.error.flatten().fieldErrors;
            const reason = Object.entries(fieldErrors)
              .map(([f, e]) => `${f}: ${e[0]}`).join('; ');
            errors.push({ row: rowNum, vm_name: rawRow.vm_name || '', reason });
            return;
          }

          const d = result.data;
          try {
            insert.run({
              vm_name: d.vm_name, vm_tag: d.vm_tag ?? null,
              description: d.description ?? null, hypervisor: d.hypervisor ?? null,
              cluster: d.cluster ?? null, datacenter: d.datacenter ?? null,
              os_type: d.os_type ?? null, os_version: d.os_version ?? null,
              hostname: d.hostname ?? null, ip_address: d.ip_address ?? null,
              vlan: d.vlan ?? null, mac_address: d.mac_address ?? null,
              vcpu: d.vcpu ?? null, ram_gb: d.ram_gb ?? null, disk_gb: d.disk_gb ?? null,
              power_state: d.power_state ?? 'unknown',
              environment: d.environment ?? null,
              status: d.status ?? 'active',
              owner: d.owner ?? null, department: d.department ?? null,
              application: d.application ?? null, expiry_date: d.expiry_date ?? null,
              notes: d.notes ?? null,
              now, user_id: req.user.id,
            });
            imported++;
          } catch (e) {
            const reason = e.message?.includes('UNIQUE') ? 'VM name already exists' : e.message;
            errors.push({ row: rowNum, vm_name: d.vm_name, reason });
          }
        });
      });

      runImport();

      writeAudit({
        user_id: req.user.id, username: req.user.username,
        action: 'vm.import', entity_type: 'vm',
        detail: { imported, skipped: errors.length, total: rows.length },
        ip_address: getIp(req),
      });

      res.json({ imported, skipped: errors.length, errors });
    } catch (err) { next(err); }
  }
);

// ── GET /api/vms/:id ──────────────────────────────────────────────────────────
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const vm = db.prepare('SELECT * FROM vms WHERE id = ?').get(req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });
    writeAudit({ user_id: req.user.id, username: req.user.username, action: 'vm.view', entity_type: 'vm', entity_id: vm.id, entity_name: vm.vm_name, ip_address: getIp(req) });
    res.json(vm);
  } catch (err) { next(err); }
});

// ── POST /api/vms  [admin] ────────────────────────────────────────────────────
router.post('/', authenticate, requireRole('admin'), (req, res, next) => {
  try {
    const data = validate(vmSchema, req.body);
    const now = new Date().toISOString();

    // Ensure all optional fields have values (null if not provided)
    const params = {
      vm_name: data.vm_name,
      vm_tag: data.vm_tag ?? null,
      description: data.description ?? null,
      hypervisor: data.hypervisor ?? null,
      cluster: data.cluster ?? null,
      datacenter: data.datacenter ?? null,
      os_type: data.os_type ?? null,
      os_version: data.os_version ?? null,
      hostname: data.hostname ?? null,
      ip_address: data.ip_address ?? null,
      vlan: data.vlan ?? null,
      mac_address: data.mac_address ?? null,
      vcpu: data.vcpu ?? null,
      ram_gb: data.ram_gb ?? null,
      disk_gb: data.disk_gb ?? null,
      power_state: data.power_state ?? 'unknown',
      environment: data.environment ?? null,
      status: data.status ?? 'active',
      owner: data.owner ?? null,
      department: data.department ?? null,
      application: data.application ?? null,
      expiry_date: data.expiry_date ?? null,
      notes: data.notes ?? null,
      now,
      user_id: req.user.id,
    };

    const result = db.prepare(`
      INSERT INTO vms (
        vm_name, vm_tag, description, hypervisor, cluster, datacenter,
        os_type, os_version, hostname, ip_address, vlan, mac_address,
        vcpu, ram_gb, disk_gb, power_state, environment, status,
        owner, department, application, expiry_date, notes,
        created_at, updated_at, created_by, updated_by
      ) VALUES (
        @vm_name, @vm_tag, @description, @hypervisor, @cluster, @datacenter,
        @os_type, @os_version, @hostname, @ip_address, @vlan, @mac_address,
        @vcpu, @ram_gb, @disk_gb, @power_state, @environment, @status,
        @owner, @department, @application, @expiry_date, @notes,
        @now, @now, @user_id, @user_id
      )
    `).run(params);

    const vm = db.prepare('SELECT * FROM vms WHERE id = ?').get(result.lastInsertRowid);
    writeAudit({ user_id: req.user.id, username: req.user.username, action: 'vm.create', entity_type: 'vm', entity_id: vm.id, entity_name: vm.vm_name, ip_address: getIp(req) });
    res.status(201).json(vm);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      err.status = 409; err.message = 'VM name already exists';
    }
    next(err);
  }
});

// ── PUT /api/vms/:id  [admin] ─────────────────────────────────────────────────
router.put('/:id', authenticate, requireRole('admin'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM vms WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'VM not found' });

    const data = validate(updateVmSchema, req.body);

    // Build diff for audit
    const detail = {};
    for (const [k, v] of Object.entries(data)) {
      if (existing[k] !== v) detail[k] = { from: existing[k], to: v };
    }

    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    db.prepare(
      `UPDATE vms SET ${fields}, updated_at = @now, updated_by = @user_id WHERE id = @id`
    ).run({ ...data, now: new Date().toISOString(), user_id: req.user.id, id: req.params.id });

    const vm = db.prepare('SELECT * FROM vms WHERE id = ?').get(req.params.id);
    writeAudit({ user_id: req.user.id, username: req.user.username, action: 'vm.update', entity_type: 'vm', entity_id: vm.id, entity_name: vm.vm_name, detail, ip_address: getIp(req) });
    res.json(vm);
  } catch (err) { next(err); }
});

// ── DELETE /api/vms/:id  [admin] ──────────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('admin'), (req, res, next) => {
  try {
    const vm = db.prepare('SELECT * FROM vms WHERE id = ?').get(req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });

    db.prepare('DELETE FROM vms WHERE id = ?').run(req.params.id);
    writeAudit({ user_id: req.user.id, username: req.user.username, action: 'vm.delete', entity_type: 'vm', entity_id: vm.id, entity_name: vm.vm_name, ip_address: getIp(req) });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/vms/:id/rdp ──────────────────────────────────────────────────────
router.get('/:id/rdp', authenticate, (req, res, next) => {
  try {
    const vm = db.prepare('SELECT * FROM vms WHERE id = ?').get(req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });
    if (!vm.ip_address) return res.status(400).json({ error: 'VM has no IP address configured' });

    const credUsername = req.query.user || null;
    const content = generateRdpContent(vm.ip_address, credUsername);

    writeAudit({ user_id: req.user.id, username: req.user.username, action: 'rdp.download', entity_type: 'vm', entity_id: vm.id, entity_name: vm.vm_name, detail: { rdp_user: credUsername }, ip_address: getIp(req) });

    res.setHeader('Content-Type', 'application/x-rdp');
    res.setHeader('Content-Disposition', `attachment; filename="${vm.vm_name}.rdp"`);
    res.send(content);
  } catch (err) { next(err); }
});

module.exports = router;
