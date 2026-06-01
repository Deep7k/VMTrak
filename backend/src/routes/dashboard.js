'use strict';

const express  = require('express');
const { db }   = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { runExpiryCheck } = require('../services/scheduler');

const router = express.Router();

// GET /api/dashboard/stats
router.get('/stats', authenticate, requireRole('readwrite'), (req, res, next) => {
  try {
    const totalVms = db.prepare("SELECT COUNT(*) as n FROM vms").get().n;

    const byStatus = db.prepare(
      "SELECT status, COUNT(*) as n FROM vms GROUP BY status"
    ).all();

    const byEnvironment = db.prepare(
      "SELECT environment, COUNT(*) as n FROM vms WHERE environment IS NOT NULL GROUP BY environment"
    ).all();

    const byPowerState = db.prepare(
      "SELECT power_state, COUNT(*) as n FROM vms GROUP BY power_state"
    ).all();

    const expiringSoon = db.prepare(`
      SELECT id, vm_name, ip_address, environment, owner, expiry_date,
             CAST(julianday(expiry_date) - julianday('now') AS INTEGER) as days_until_expiry
      FROM vms
      WHERE expiry_date IS NOT NULL
        AND status = 'active'
        AND date(expiry_date) >= date('now')
        AND date(expiry_date) <= date('now', '+30 days')
      ORDER BY expiry_date ASC
      LIMIT 10
    `).all();

    const expiredCount = db.prepare(`
      SELECT COUNT(*) as n FROM vms
      WHERE expiry_date IS NOT NULL AND status = 'active' AND date(expiry_date) < date('now')
    `).get().n;

    res.json({
      total: totalVms,
      by_status:      Object.fromEntries(byStatus.map(r => [r.status, r.n])),
      by_environment: Object.fromEntries(byEnvironment.map(r => [r.environment, r.n])),
      by_power_state: Object.fromEntries(byPowerState.map(r => [r.power_state, r.n])),
      expiring_soon: expiringSoon,
      expired_count: expiredCount,
    });
  } catch (err) { next(err); }
});

// POST /api/dashboard/test-notifications  [admin] — manual trigger for testing SMTP
router.post('/test-notifications', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    await runExpiryCheck();
    res.json({ ok: true, message: 'Expiry check complete — check logs for details' });
  } catch (err) { next(err); }
});

module.exports = router;
