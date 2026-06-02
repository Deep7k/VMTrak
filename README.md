# VMTrak

Self-hosted VM inventory and credential management for IT infrastructure teams. Replaces manual Excel-based tracking with a structured, secure, auditable system.

**Version: v1.0.0**

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Docker & Deployment](#4-docker--deployment)
5. [Database Schema](#5-database-schema)
6. [Backend API](#6-backend-api)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Credential Encryption](#8-credential-encryption)
9. [RDP File Generation](#9-rdp-file-generation)
10. [Email Notification Service](#10-email-notification-service)
11. [Audit Logging](#11-audit-logging)
12. [Frontend Structure](#12-frontend-structure)
13. [Environment Variables](#13-environment-variables)
14. [Security Considerations](#14-security-considerations)

---

## 1. Overview

**Core features:**
- Full VM lifecycle inventory with structured fields (hypervisor host, OS, network, resources, expiry)
- Encrypted credential storage per VM (AES-256-GCM, multiple accounts per VM)
- Live TCP reachability check per VM (port 3389 / 22)
- RDP file generation on demand (Windows VMs only)
- Email notifications for VM expiry at 7d, 1d, and on expiry day
- Three-tier role-based access: `admin`, `readwrite`, `read`
- Microsoft Entra ID (Azure AD) SSO in addition to local credentials
- Full audit log of all actions
- Dockerized, compatible with Nginx reverse proxy (NPM with internal SSL)

---

## 2. Technology Stack

### Backend

| Component    | Technology                              |
|-------------|------------------------------------------|
| Runtime      | Node.js 20 LTS                          |
| Framework    | Express.js + Helmet                     |
| Database     | SQLite via `better-sqlite3` (sync)      |
| Auth         | JWT + refresh tokens; MSAL for Entra ID |
| Encryption   | AES-256-GCM (Node.js built-in crypto)   |
| Email        | Nodemailer (SMTP relay)                 |
| Scheduler    | node-cron (daily 08:00)                 |
| Logging      | Winston (structured JSON, rotation)     |
| Validation   | Zod                                     |
| Rate limit   | express-rate-limit                      |

### Frontend

| Component   | Technology                              |
|------------|------------------------------------------|
| Framework   | React 18 + Vite                         |
| Styling     | TailwindCSS (utility-first)             |
| Table       | TanStack Table v8                       |
| Routing     | React Router v6                         |
| HTTP        | axios (JWT interceptors)                |
| State       | zustand (auth only)                     |

> Plain controlled components and axios — no React Query, no React Hook Form.

### Infrastructure

| Component       | Technology                                |
|----------------|-------------------------------------------|
| Containers      | Docker + Docker Compose (named volumes)  |
| Reverse proxy   | Nginx Proxy Manager (TLS termination)    |
| CI/CD           | GitHub Actions (self-hosted runner)      |

---

## 3. System Architecture

```
[Browser]
    │
    ▼
[Nginx Proxy Manager — TLS termination]
    │
    ├──▶  /            →  frontend container  (port 3000, nginx static)
    └──▶  /api/*       →  backend container   (port 3001, Express)
                │
                ├──▶  vm-data volume  (SQLite DB)
                └──▶  vm-logs volume  (Winston logs)
```

---

## 4. Docker & Deployment

### docker-compose.yml overview

```yaml
services:
  backend:
    volumes:
      - vm-data:/app/data
      - vm-logs:/app/logs

volumes:
  vm-data:
  vm-logs:
```

Named volumes persist across deploys. `git clean` on the CI runner never touches them.

### CI/CD

Push to `dev` branch → GitHub Actions self-hosted runner on `itappsdev02`:
1. Write `.env` from `BACKEND_ENV` GitHub secret
2. `docker compose build`
3. `docker compose up -d --remove-orphans`
4. Health check on `localhost:3000/api/health`

---

## 5. Database Schema

All tables use SQLite. `better-sqlite3` runs synchronously — no async/await on DB calls.

Migrations auto-applied on startup from `backend/src/db/migrations/` in filename order.

| Migration | Description |
|-----------|-------------|
| `001_init.sql` | Full initial schema |
| `002_credential_type.sql` | `account_type` → `primary`/`others` |
| `003_must_change_password.sql` | First-login setup flag |
| `004_three_roles.sql` | Rebuilds users table: `admin`/`readwrite`/`read` |
| `005_notify_expiry.sql` | Per-user expiry notification toggle |

### Key tables

**`users`** — `role CHECK (role IN ('admin', 'readwrite', 'read'))`, `notify_expiry` boolean

**`vms`** — full inventory fields including `hypervisor`, `expiry_date`, `ip_address`, `os_type`

**`vm_credentials`** — AES-256-GCM ciphertext + IV + auth tag; `account_type` (`primary`/`others`)

**`audit_logs`** — denormalised `username`, JSON `detail`, `ip_address`

**`notification_log`** — `(vm_id, notice_type, date(sent_at))` uniqueness prevents duplicate sends

---

## 6. Backend API

Base path: `/api`. All endpoints require `Authorization: Bearer <token>` unless marked `[public]`.

### Auth
```
POST  /api/auth/login                [public]
POST  /api/auth/refresh              [public, cookie]
POST  /api/auth/logout
GET   /api/auth/me
POST  /api/auth/complete-setup
GET   /api/auth/microsoft            [public] — Entra ID redirect
GET   /api/auth/microsoft/callback   [public] — Entra ID callback
```

### VMs
```
GET   /api/vms                       filters: search, environment, status, power_state, department, hypervisor
GET   /api/vms/hypervisors           distinct hypervisor values
GET   /api/vms/reachability?ids=1,2  TCP port check (3389/22), parallel
GET   /api/vms/export                CSV (formula-injection safe)
POST  /api/vms/import                [readwrite+]
GET   /api/vms/:id
POST  /api/vms                       [readwrite+]
PUT   /api/vms/:id                   [readwrite+]
DELETE /api/vms/:id                  [readwrite+]
GET   /api/vms/:id/rdp
```

### Credentials
```
GET   /api/vms/:id/credentials                [readwrite+]
POST  /api/vms/:id/credentials                [readwrite+]
PUT   /api/vms/:id/credentials/:cid           [readwrite+]
DELETE /api/vms/:id/credentials/:cid          [readwrite+]
GET   /api/vms/:id/credentials/:cid/reveal    [readwrite+]
```

### Users & System (admin only)
```
GET   /api/users
POST  /api/users
PUT   /api/users/:id
POST  /api/users/:id/reset-password
DELETE /api/users/:id
GET   /api/audit
GET   /api/dashboard/stats           [readwrite+]
POST  /api/dashboard/test-notifications
GET   /api/health                    [public]
```

---

## 7. Authentication & Authorization

### Local credentials
- Access token: JWT, 15 min, `localStorage`
- Refresh token: 32-byte hex, SHA-256 hashed in DB, 7 days, HttpOnly+Secure+SameSite=Strict cookie
- On 401: frontend silently refreshes, retries; on failure → `/login`

### Microsoft Entra ID (SSO)
- OAuth2 Authorization Code flow via `@azure/msal-node`
- State parameter signed with `JWT_ACCESS_SECRET` (5 min TTL) to prevent CSRF
- Email from ID token matched against `users.email` (case-insensitive)
- On match: issues same VMTrak JWT + cookie as local login
- No match: redirects to `/login?ms_error=not_found&ms_admin=<SITE_ADMIN_EMAIL>`
- Button hidden when `ENTRA_CLIENT_ID` is not set

### Role permissions

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

## 8. Credential Encryption

**Algorithm:** AES-256-GCM (authenticated encryption)

- Key: `CREDENTIAL_ENCRYPTION_KEY` (64-char hex = 32 bytes), `.env` only, never in DB
- Each credential: random 12-byte IV → encrypt → store `(password_enc, password_iv, password_tag)`
- Decrypt in memory on `reveal` request; plaintext never written to disk, logs, or DB
- Generate key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 9. RDP File Generation

`GET /api/vms/:id/rdp` — generated in memory, streamed as `application/x-rdp` download. Password intentionally excluded from file. UI hides button for Linux VMs.

---

## 10. Email Notification Service

Daily cron at **08:00** (timezone set via `TZ` env var). Thresholds: **7 days**, **1 day**, **expired**.

Recipients: all active users with `notify_expiry = 1`, plus VM owner if their email is set.

`notification_log` prevents duplicate sends per `(vm_id, notice_type, date)`.

SMTP: IP-authenticated Postfix relay (no credentials in transport config). HELO hostname set via `SMTP_HELO` to avoid rejection by strict relays.

Test: `bash tests/test-mail.sh`

---

## 11. Audit Logging

Every state-changing and sensitive read writes to both `audit_logs` table and Winston log file.

Log rotation: 10 MB per file, 5 files max. Timestamps stored as UTC; displayed in browser local timezone.

---

## 12. Frontend Structure

### Routes

| Path | Access |
|------|--------|
| `/login` | Public |
| `/auth/callback` | Public (Entra SSO return) |
| `/setup` | Requires `must_change_password` |
| `/dashboard` | readwrite+ |
| `/vms` | All authenticated |
| `/vms/new`, `/vms/:id/edit` | readwrite+ |
| `/vms/:id` | All authenticated |
| `/users` | admin |
| `/audit` | admin |

### VM list columns
Status (TCP dot) · VM Name · IP Address · Hypervisor · Environment · Username · Actions

### Key frontend patterns
- `hasMinRole(user, minRole)` from `Guards.jsx` used for all role-gated UI
- UTC→local timezone: `new Date(ts.replace(' ','T') + 'Z').toLocaleString()`
- `handleSubmit` in VMForm sanitises `'' → null` before posting to avoid zod failures

---

## 13. Environment Variables

```env
# Application
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://vmtrak.yourdomain.internal
TZ=Asia/Kolkata

# Auth tokens (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Credential encryption
CREDENTIAL_ENCRYPTION_KEY=

# SMTP
SMTP_HOST=your-postfix-relay
SMTP_PORT=25
SMTP_FROM=vmtrak@yourdomain.internal
SMTP_HELO=your-docker-host.yourdomain.internal

# Microsoft Entra ID (optional — leave blank to disable SSO)
ENTRA_CLIENT_ID=
ENTRA_TENANT_ID=
ENTRA_CLIENT_SECRET=
ENTRA_REDIRECT_URI=https://vmtrak.yourdomain.internal/api/auth/microsoft/callback
SITE_ADMIN_EMAIL=itadmin@yourdomain.internal

# Logging
LOG_LEVEL=info
```

---

## 14. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Password storage | bcrypt cost factor 12 |
| VM credential storage | AES-256-GCM; key in `.env` only |
| Credential exposure in logs | Passwords excluded from all audit detail |
| JWT theft | 15 min access token expiry |
| Refresh token reuse | SHA-256 hashed; rotated on every use; invalidated on logout |
| Brute force | 20 failed attempts per IP per 15 min |
| Security headers | Helmet: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| CORS | Backend accepts only `FRONTEND_URL` |
| Input validation | Zod on all request bodies before DB |
| SQL injection | Parameterised queries; sort column whitelist |
| CSV formula injection | Prefix `=+-@` cells with `'` |
| Entra SSO CSRF | Signed state token (JWT, 5 min TTL) |
| Sensitive endpoints | Credential reveal + RDP always audit-logged with user + IP |
| TLS | Terminated at NPM; containers on private Docker bridge |
| Secrets in VCS | `.env` in `.gitignore`; prod values in GitHub secret `BACKEND_ENV` |
