# VMTrak — Email Notification System

## Overview

VMTrak sends HTML email alerts when VMs are approaching or past their expiry date. The system is:
- **Scheduled** — runs automatically once per day at 08:00
- **Idempotent** — a `notification_log` table prevents duplicate sends
- **Per-user opt-in** — each user has a `notify_expiry` toggle in the Users page

---

## Scheduler

File: `backend/src/services/scheduler.js`

Uses `node-cron`. The cron expression is `'0 8 * * *'` — every day at 08:00.

Timezone is controlled by the `TZ` environment variable in `.env`:
```
TZ=Asia/Kolkata
```
Change this to match your server's operational timezone. The cron fires at 08:00 in that timezone.

### What the scheduler does

1. Query all active VMs with `expiry_date IS NOT NULL`
2. For each VM, compute days until expiry
3. For each threshold that matches, check `notification_log` to see if already sent today
4. If not already sent: send email, insert into `notification_log`

### Expiry thresholds

| `notice_type` | Trigger condition              | Email subject                     |
|---------------|--------------------------------|-----------------------------------|
| `7d`          | 7 days until expiry            | "VM Expiry Alert — 7 days left"   |
| `1d`          | 1 day until expiry             | "VM Expiry Alert — expires tomorrow" |
| `expired`     | Expiry date is today or past   | "VM Expired"                      |

---

## Idempotency

Table: `notification_log`

```sql
CREATE TABLE notification_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vm_id       INTEGER NOT NULL REFERENCES vms(id) ON DELETE CASCADE,
  notice_type TEXT NOT NULL CHECK(notice_type IN ('7d','1d','expired')),
  sent_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  recipient   TEXT NOT NULL
);
```

Before sending, the scheduler runs:
```sql
SELECT 1 FROM notification_log
WHERE vm_id = ? AND notice_type = ? AND date(sent_at) = date('now')
```
If a row exists, the email is skipped. This means the scheduler can be called multiple times in a day without duplicate sends — including via the manual test endpoint.

---

## Recipients

Emails are sent to:
- All active users in the `users` table where `notify_expiry = 1`
- The VM's `owner` field, if it looks like a valid email address

Admins manage the `notify_expiry` toggle per user on the Users page (`/users`). There is no hardcoded `NOTIFY_ADMIN_EMAIL` — all recipients are driven from the database.

---

## Email Template

File: `backend/src/services/email.js`

The template is an inline HTML email (no external CSS dependencies). It is designed to render correctly in Outlook and standard webmail clients.

### Structure

```
┌─────────────────────────────────────┐
│  [V] VMTrak                         │  ← brand header (always green accent)
│  ─────────────────────────────────  │
│  [AMBER/RED accent bar]             │  ← color changes by severity
│                                     │
│  ⚠ VM Expiry Alert                  │
│  <vm_name> expires in X days        │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ IP Address    │ 10.10.10.50  │   │
│  │ Hostname      │ ...          │   │
│  │ Environment   │ production   │   │
│  │ Owner         │ ...          │   │
│  │ Department    │ ...          │   │
│  │ Expiry Date   │ 2026-06-10   │   │
│  └──────────────────────────────┘   │
│                                     │
│  [View in VMTrak]  ← CTA button     │
│                                     │
│  To stop receiving alerts, ask...   │  ← footer
└─────────────────────────────────────┘
```

### Severity colors

| Threshold  | Accent bar color | Hex       |
|------------|-----------------|-----------|
| 7 days     | Amber           | `#f59e0b` |
| 1 day      | Red             | `#ef4444` |
| Expired    | Red             | `#ef4444` |

The CTA button links to `<FRONTEND_URL>/vms/<vm_id>`.

---

## SMTP Configuration

VMTrak uses Nodemailer with a plain SMTP transport (no auth, IP-authenticated relay):

```env
SMTP_HOST=<postfix-relay-ip-or-hostname>
SMTP_PORT=25
SMTP_FROM=vmtrak@yourdomain.internal
SMTP_HELO=<docker-host-fqdn>
```

`SMTP_HELO` sets the HELO/EHLO hostname sent to the relay. If your Postfix relay rejects HELO names that don't match an A record, set this to the FQDN of the Docker host (`itappsdev02.indishtech.lan` in dev).

No authentication is configured — the transport relies on the relay accepting connections from the Docker host's IP. If your relay requires auth, add `auth: { user, pass }` to the transporter options in `email.js`.

---

## Manual Test Trigger

```
POST /api/dashboard/test-notifications
Authorization: Bearer <admin_token>
```

This calls the same notification function the scheduler uses. It respects `notification_log` idempotency, so it won't re-send if an alert was already sent today for a given VM.

Useful for:
- Confirming SMTP relay is reachable from the Docker container
- Checking that template renders correctly in your mail client
- Verifying `notify_expiry` toggles work

---

## Test Script

File: `tests/test-mail.sh`

End-to-end shell script that:
1. Logs in as admin (reads credentials from `.claude/test-creds.md`)
2. Creates a test VM with `expiry_date = today`
3. Calls `POST /api/dashboard/test-notifications`
4. Polls `GET /api/audit` waiting for `notification.sent` action
5. Prints result and deletes the test VM

Run with:
```bash
bash tests/test-mail.sh
```

The script targets the dev URL (`https://vmtrak-dev.internal.indishtech.in`). Change `BASE_URL` at the top of the script if testing against a different environment.
