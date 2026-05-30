'use strict';

const express  = require('express');
const { db }   = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { auditQuerySchema, validate } = require('../utils/validators');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

// GET /api/audit
router.get('/', (req, res, next) => {
  try {
    const q = validate(auditQuerySchema, req.query);

    const where  = [];
    const params = [];

    if (q.user_id)     { where.push('user_id = ?');     params.push(q.user_id); }
    if (q.action)      { where.push('action = ?');      params.push(q.action); }
    if (q.entity_type) { where.push('entity_type = ?'); params.push(q.entity_type); }
    if (q.from)        { where.push('created_at >= ?'); params.push(q.from); }
    if (q.to)          { where.push('created_at <= ?'); params.push(q.to); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset      = (q.page - 1) * q.limit;

    const total = db.prepare(`SELECT COUNT(*) as n FROM audit_logs ${whereClause}`).get(...params).n;
    const rows  = db.prepare(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, q.limit, offset);

    res.json({ data: rows, total, page: q.page, limit: q.limit });
  } catch (err) { next(err); }
});

module.exports = router;
