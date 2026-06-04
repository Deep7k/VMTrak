# VMTrak

Self-hosted VM inventory and credential management for IT infrastructure teams.

**Version: v1.0.0**

---

## What it is

VMTrak replaces manual Excel-based VM tracking with a structured, auditable web application. It stores VM inventory alongside AES-256-GCM-encrypted credentials, provides live TCP reachability checks, generates RDP files on demand, and sends daily email alerts for expiring VMs.

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/architecture.md](docs/architecture.md) | Container layout, request flow, CI/CD, key file paths |
| [docs/auth.md](docs/auth.md) | Local JWT auth, Microsoft Entra SSO, role system, token lifecycle |
| [docs/mail.md](docs/mail.md) | Notification scheduler, email template, SMTP config, test script |
| [docs/ui.md](docs/ui.md) | Design language, color palette, typography, components, state management |
| [docs/security.md](docs/security.md) | Full threat model, encryption, audit logging, security headers |
| [docs/roadmap.md](docs/roadmap.md) | Completed v1.0.0 features and v2 scope |

---

## Technology Stack

**Backend:** Node.js 20, Express, better-sqlite3, JWT, MSAL (Entra SSO), AES-256-GCM, Nodemailer, node-cron, Winston, Zod

**Frontend:** React 18, Vite, TailwindCSS, TanStack Table v8, axios, Zustand, React Router v6

**Infrastructure:** Docker Compose (named volumes), Nginx Proxy Manager (TLS), GitHub Actions self-hosted runner

---

## Quick Setup

### Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://vmtrak.yourdomain.internal
TZ=Asia/Kolkata

JWT_ACCESS_SECRET=    # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_REFRESH_SECRET=   # same
CREDENTIAL_ENCRYPTION_KEY=  # same

SMTP_HOST=your-postfix-relay
SMTP_PORT=25
SMTP_FROM=vmtrak@yourdomain.internal
SMTP_HELO=your-docker-host.yourdomain.internal

# Optional — leave blank to disable Microsoft SSO
ENTRA_CLIENT_ID=
ENTRA_TENANT_ID=
ENTRA_CLIENT_SECRET=
ENTRA_REDIRECT_URI=https://vmtrak.yourdomain.internal/api/auth/microsoft/callback
SITE_ADMIN_EMAIL=itadmin@yourdomain.internal
```

### Deploy

```bash
docker compose build
docker compose up -d
```

Health check: `GET http://localhost:3001/api/health`

An `admin` user is created on first startup (see migration `001_init.sql` for the default password — change it immediately).

---

## Role Overview

| Action | admin | readwrite | read |
|--------|-------|-----------|------|
| View VM list / detail | ✅ | ✅ | ✅ |
| Create / Edit / Delete VM | ✅ | ✅ | ❌ |
| Credentials (view, reveal, edit) | ✅ | ✅ | ❌ |
| Download RDP | ✅ | ✅ | ❌ |
| CSV export / import | ✅ | ✅ | ❌ |
| Dashboard | ✅ | ✅ | ❌ |
| Users management | ✅ | ❌ | ❌ |
| Audit log | ✅ | ❌ | ❌ |

---

## API Base

All endpoints require `Authorization: Bearer <token>` unless marked public.

```
POST  /api/auth/login          [public]
POST  /api/auth/refresh        [public, cookie]
GET   /api/auth/microsoft      [public — Entra SSO redirect]
GET   /api/vms                 filters: search, environment, status, hypervisor, ...
GET   /api/vms/reachability    TCP port check (parallel)
GET   /api/vms/export          CSV download
POST  /api/vms/import          [readwrite+] CSV bulk import
GET   /api/vms/:id/rdp         [readwrite+] RDP file download
GET   /api/vms/:id/credentials/:cid/reveal  [readwrite+] Decrypt credential
GET   /api/health              [public]
```

Full API reference is derivable from `backend/src/routes/`.
