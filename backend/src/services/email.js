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
      auth:   undefined,
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
  '30d':     { label: 'Expiry Warning',  accent: '#2563eb' },
  '14d':     { label: 'Expiry Warning',  accent: '#2563eb' },
  '7d':      { label: 'Expiry Warning',  accent: '#d97706' },
  '1d':      { label: 'Expiry Tomorrow', accent: '#dc2626' },
  'expired': { label: 'VM Expired',      accent: '#dc2626' },
};

const VERB = {
  '30d':     'expires in <b>30 days</b>',
  '14d':     'expires in <b>14 days</b>',
  '7d':      'expires in <b>7 days</b>',
  '1d':      'expires <b>tomorrow</b>',
  'expired': 'expired today',
};

/**
 * @param {object}   vm          – VM row from DB
 * @param {string}   noticeType  – '7d' | '1d' | 'expired'
 * @param {string[]} recipients  – list of email addresses
 */
async function sendExpiryNotification(vm, noticeType, recipients) {
  const sev    = SEVERITY[noticeType] || SEVERITY['7d'];
  const verb   = VERB[noticeType]     || 'is expiring';
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const subject = `[VMTrak] ${sev.label} — ${vm.vm_name}`;

  const row = (label, value) => value
    ? `<tr>
        <td style="padding:9px 0;color:#6b7280;font-size:13px;width:130px;vertical-align:top">${label}</td>
        <td style="padding:9px 0;color:#111827;font-size:13px;font-weight:500">${value}</td>
       </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Helvetica,Arial,sans-serif">

  <div style="max-width:520px;margin:40px auto 24px">

    <!-- Brand line -->
    <div style="padding:0 4px 14px;display:flex;align-items:center;gap:8px">
      <div style="width:26px;height:26px;background:#1d9e75;border-radius:6px;text-align:center;line-height:26px;font-family:monospace;font-weight:700;font-size:14px;color:#fff">V</div>
      <span style="font-size:14px;font-weight:600;color:#374151">VMTrak</span>
    </div>

    <!-- Card -->
    <div style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden">

      <!-- Accent bar -->
      <div style="height:3px;background:${sev.accent}"></div>

      <!-- Body -->
      <div style="padding:28px 32px">

        <!-- Label chip -->
        <div style="margin-bottom:18px">
          <span style="display:inline-block;background:${sev.accent}18;color:${sev.accent};font-size:11px;font-weight:700;letter-spacing:.5px;padding:3px 10px;border-radius:4px;text-transform:uppercase">${sev.label}</span>
        </div>

        <h1 style="margin:0 0 6px;font-size:18px;font-weight:600;color:#111827">${vm.vm_name}</h1>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280">This virtual machine ${verb}.</p>

        <!-- Divider -->
        <div style="border-top:1px solid #f3f4f6;margin-bottom:20px"></div>

        <!-- Details table -->
        <table style="width:100%;border-collapse:collapse">
          ${row('IP Address',  vm.ip_address)}
          ${row('Hostname',    vm.hostname)}
          ${row('Environment', vm.environment ? vm.environment.charAt(0).toUpperCase() + vm.environment.slice(1) : null)}
          ${row('Owner',       vm.owner)}
          ${row('Department',  vm.department)}
          ${row('Expiry Date', `<span style="color:${sev.accent};font-weight:600">${vm.expiry_date}</span>`)}
        </table>

        <!-- CTA -->
        <div style="margin-top:28px">
          <a href="${appUrl}/vms/${vm.id}"
             style="display:inline-block;background:${sev.accent};color:#ffffff;text-decoration:none;padding:9px 22px;border-radius:6px;font-size:13px;font-weight:600">
            View in VMTrak
          </a>
        </div>

      </div>
    </div>

    <!-- Footer -->
    <p style="margin:16px 4px 0;font-size:11px;color:#9ca3af;line-height:1.6">
      Sent by VMTrak &middot; To stop receiving these alerts, ask your admin to turn off notifications on your account.
    </p>

  </div>
</body>
</html>`;

  await sendMail(recipients, subject, html);
}

module.exports = { sendMail, sendExpiryNotification };
