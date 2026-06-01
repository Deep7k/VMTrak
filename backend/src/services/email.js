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

async function sendMail(to, subject, html) {
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || 'vminventory@localhost',
    to:   Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  });
  logger.info('email.sent', { to, subject, messageId: info.messageId });
  return info;
}

const SEVERITY = {
  '30d':     { label: 'Expiry Warning',  color: '#3b82f6', bg: '#1e3a5f', icon: '📅' },
  '14d':     { label: 'Expiry Warning',  color: '#8b5cf6', bg: '#2e1b5e', icon: '📅' },
  '7d':      { label: 'Expiry Urgent',   color: '#f59e0b', bg: '#451a03', icon: '⚠️' },
  '1d':      { label: 'Expiry Critical', color: '#ef4444', bg: '#450a0a', icon: '🚨' },
  'expired': { label: 'VM Expired',      color: '#dc2626', bg: '#3b0000', icon: '🔴' },
};

const VERB = {
  '30d':     'expires in <strong>30 days</strong>',
  '14d':     'expires in <strong>14 days</strong>',
  '7d':      'expires in <strong>7 days</strong>',
  '1d':      'expires <strong>tomorrow</strong>',
  'expired': 'has <strong>expired today</strong>',
};

/**
 * @param {object}   vm           – VM row from DB
 * @param {string}   noticeType   – '30d' | '14d' | '7d' | '1d' | 'expired'
 * @param {string[]} recipients   – list of email addresses
 */
async function sendExpiryNotification(vm, noticeType, recipients) {
  const sev     = SEVERITY[noticeType] || SEVERITY['30d'];
  const verb    = VERB[noticeType]     || 'is expiring';
  const appUrl  = process.env.FRONTEND_URL || 'http://localhost:5173';
  const subject = `[VMTrak] ${sev.label} — ${vm.vm_name}`;

  const row = (label, value) => value
    ? `<tr>
        <td style="padding:8px 16px;font-weight:600;color:#94a3b8;font-size:13px;white-space:nowrap;border-bottom:1px solid #1e293b">${label}</td>
        <td style="padding:8px 16px;color:#e2e8f0;font-size:13px;border-bottom:1px solid #1e293b">${value}</td>
       </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155">

    <!-- Header bar -->
    <div style="background:${sev.color};padding:4px 0"></div>

    <!-- Top brand row -->
    <div style="padding:20px 28px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #334155">
      <div style="width:36px;height:36px;background:#1d9e75;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:monospace;font-weight:700;font-size:18px;color:#fff;flex-shrink:0">V</div>
      <div>
        <div style="font-family:monospace;font-weight:700;color:#e2e8f0;font-size:15px">VMTrak</div>
        <div style="font-size:11px;color:#64748b;margin-top:1px">VM Inventory System</div>
      </div>
      <div style="margin-left:auto;background:${sev.bg};color:${sev.color};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid ${sev.color}40">
        ${sev.icon}&nbsp; ${sev.label.toUpperCase()}
      </div>
    </div>

    <!-- Body -->
    <div style="padding:24px 28px">
      <p style="margin:0 0 20px;color:#cbd5e1;font-size:15px;line-height:1.6">
        The virtual machine <strong style="color:#f1f5f9">${vm.vm_name}</strong> ${verb}.
      </p>

      <!-- VM details table -->
      <div style="background:#0f172a;border-radius:8px;overflow:hidden;border:1px solid #1e293b;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          ${row('VM Name',     vm.vm_name)}
          ${row('IP Address',  vm.ip_address)}
          ${row('Hostname',    vm.hostname)}
          ${row('Environment', vm.environment)}
          ${row('Owner',       vm.owner)}
          ${row('Department',  vm.department)}
          ${row('Expiry Date', `<span style="color:${sev.color};font-weight:600">${vm.expiry_date}</span>`)}
        </table>
      </div>

      <!-- CTA button -->
      <div style="text-align:center;margin-bottom:8px">
        <a href="${appUrl}/vms/${vm.id}"
           style="display:inline-block;background:${sev.color};color:#fff;text-decoration:none;padding:10px 28px;border-radius:8px;font-weight:600;font-size:14px">
          View VM in VMTrak →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;border-top:1px solid #1e293b;text-align:center">
      <p style="margin:0;font-size:11px;color:#475569">
        This notification was sent automatically by VMTrak.<br>
        To stop receiving these alerts, ask your admin to disable notifications on your account.
      </p>
    </div>

  </div>
</body>
</html>`;

  await sendMail(recipients, subject, html);
}

module.exports = { sendMail, sendExpiryNotification };
