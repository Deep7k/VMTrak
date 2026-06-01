'use strict';

const cron    = require('node-cron');
const { db }  = require('../db/database');
const { sendExpiryNotification } = require('./email');
const { writeAudit } = require('../middleware/audit');
const logger  = require('../utils/logger');

const THRESHOLDS = [
  { days: 30, type: '30d'     },
  { days: 14, type: '14d'     },
  { days:  7, type: '7d'      },
  { days:  1, type: '1d'      },
  { days:  0, type: 'expired' },
];

async function runExpiryCheck() {
  logger.info('scheduler: running daily expiry check');

  const vms = db.prepare(`
    SELECT * FROM vms
    WHERE expiry_date IS NOT NULL AND status = 'active'
  `).all();

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  for (const vm of vms) {
    // Parse expiry as local midnight to match now (avoids UTC vs local skew on IST servers)
    const [ey, em, ed] = vm.expiry_date.split('-').map(Number);
    const expiry    = new Date(ey, em - 1, ed);
    const now       = new Date();
    now.setHours(0, 0, 0, 0);
    const msPerDay  = 86400000;
    const daysUntil = Math.round((expiry - now) / msPerDay);

    for (const { days, type } of THRESHOLDS) {
      if (daysUntil !== days) continue;

      // Idempotency — only send once per VM + type per day
      const alreadySent = db.prepare(`
        SELECT id FROM notification_log
        WHERE vm_id = ? AND notice_type = ? AND date(sent_at) = ?
      `).get(vm.id, type, today);

      if (alreadySent) continue;

      try {
        // Build recipient list from users with notify_expiry enabled + VM owner
        const notifyUsers = db.prepare(
          "SELECT email FROM users WHERE notify_expiry = 1 AND is_active = 1"
        ).all().map(u => u.email);

        const recipients = [...new Set([
          ...notifyUsers,
          ...(vm.owner?.includes('@') ? [vm.owner] : []),
        ])];

        if (recipients.length === 0) {
          logger.warn('scheduler: no notification recipients configured for VM', { vm_id: vm.id });
          continue;
        }

        await sendExpiryNotification(vm, type, recipients);

        for (const recipient of recipients) {
          db.prepare(`
            INSERT INTO notification_log (vm_id, notice_type, recipient) VALUES (?, ?, ?)
          `).run(vm.id, type, recipient);
        }

        writeAudit({
          action: 'notification.sent', entity_type: 'vm',
          entity_id: vm.id, entity_name: vm.vm_name,
          detail: { notice_type: type, days_until: daysUntil },
        });
      } catch (err) {
        logger.error('scheduler: failed to send expiry notification', {
          vm_id: vm.id, vm_name: vm.vm_name, error: err.message,
        });
      }
    }
  }

  logger.info('scheduler: expiry check complete', { checked: vms.length });
}

// Daily at 08:00 server time
cron.schedule('0 8 * * *', runExpiryCheck);

// Run once on startup in dev mode so you can verify it works
if (process.env.NODE_ENV !== 'production') {
  logger.info('scheduler: dev mode — running expiry check on startup');
  runExpiryCheck().catch(err => logger.error('startup expiry check failed', { error: err.message }));
}

module.exports = { runExpiryCheck };
