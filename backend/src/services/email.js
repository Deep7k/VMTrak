'use strict';

const nodemailer = require('nodemailer');
const logger     = require('../utils/logger');

let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'localhost',
      port:   parseInt(process.env.SMTP_PORT || '25', 10),
      secure: false,
      auth:   undefined, // IP-authenticated relay, no credentials
      tls:    { rejectUnauthorized: false },
      name:   process.env.SMTP_HELO || 'itappsdev02.indishtech.lan',
    });
  }
  return _transporter;
}

/**
 * @param {string[]} to
 * @param {string}   subject
 * @param {string}   html
 */
async function sendMail(to, subject, html) {
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || 'vminventory@localhost',
    to:   to.join(', '),
    subject,
    html,
  });
  logger.info('email.sent', { to, subject, messageId: info.messageId });
  return info;
}

const LABEL = {
  '30d':     { tag: 'EXPIRY WARNING',  verb: 'expires in 30 days' },
  '14d':     { tag: 'EXPIRY WARNING',  verb: 'expires in 14 days' },
  '7d':      { tag: 'EXPIRY URGENT',   verb: 'expires in 7 days'  },
  '1d':      { tag: 'EXPIRY CRITICAL', verb: 'expires TOMORROW'   },
  'expired': { tag: 'VM EXPIRED TODAY', verb: 'has expired today'  },
};

/**
 * Send a VM expiry notification.
 * @param {object} vm          – VM row from DB
 * @param {'30d'|'14d'|'7d'|'1d'|'expired'} noticeType
 */
async function sendExpiryNotification(vm, noticeType) {
  const label      = LABEL[noticeType] || { tag: 'EXPIRY NOTICE', verb: 'is expiring' };
  const appUrl     = process.env.FRONTEND_URL || 'http://localhost:5173';
  const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;

  const to = [];
  if (adminEmail) to.push(adminEmail);
  if (vm.owner && vm.owner.includes('@') && vm.owner !== adminEmail) to.push(vm.owner);
  if (to.length === 0) {
    logger.warn('sendExpiryNotification: no recipients configured, skipping', { vm_id: vm.id });
    return;
  }

  const subject = `[VM Inventory] ${label.tag} — ${vm.vm_name} ${label.verb}`;
  const html = `
    <h2 style="color:#c0392b">${label.tag}</h2>
    <p>The following VM <strong>${label.verb}</strong>.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><strong>VM Name</strong></td><td>${vm.vm_name}</td></tr>
      <tr><td><strong>IP Address</strong></td><td>${vm.ip_address || 'N/A'}</td></tr>
      <tr><td><strong>Environment</strong></td><td>${vm.environment || 'N/A'}</td></tr>
      <tr><td><strong>Owner</strong></td><td>${vm.owner || 'N/A'}</td></tr>
      <tr><td><strong>Department</strong></td><td>${vm.department || 'N/A'}</td></tr>
      <tr><td><strong>Expiry Date</strong></td><td>${vm.expiry_date}</td></tr>
    </table>
    <p><a href="${appUrl}/vms/${vm.id}">View VM in VMTrak →</a></p>
    <hr/>
    <small>This notification was sent automatically by VMTrak.</small>
  `;

  await sendMail(to, subject, html);
}

module.exports = { sendMail, sendExpiryNotification };
