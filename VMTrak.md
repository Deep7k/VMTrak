# VMTrak

## Table of Contents

1. [Project Overview](#1-project-overview)
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
14. [Project File Structure](#14-project-file-structure)
15. [Security Considerations](#15-security-considerations)
16. [Future Considerations](#16-future-considerations)

---

## 1. Project Overview

A self-hosted web application for IT infrastructure teams to manage VM inventory. Replaces manual Excel-based tracking with a structured, secure, auditable system.

**Core requirements:**

- Full VM lifecycle inventory with structured fields
- Encrypted credential storage per VM (multiple users per VM)
- RDP file generation on demand
- Email notifications for VM expiry (via existing Postfix M365 relay)
- Role-based access: `admin` and `support`
- Full audit log of all actions
- Dockerized, compatible with Nginx reverse proxy (NPM with internal SSL)
- Admin UI for user management

**Current version:** v0.1.0 (Phase 1 — core inventory and credential management)

---

## 2. Technology Stack

### Backend

| Component   | Technology                                    | Rationale                                      |
|-------------|-----------------------------------------------|------------------------------------------------|
| Runtime     | Node.js 20 LTS                                | Stable, widely supported                       |
| Framework   | Express.js                                    | Minimal, well-documented                       |
| Database    | SQLite via `better-sqlite3`                   | Zero-infra, single-file, sufficient for scale  |
| ORM / Query | Raw SQL via `better-sqlite3`                  | Full control, no abstraction overhead          |
| Auth        | JWT (`jsonwebtoken`) — access + refresh tokens | Stateless, proxy-compatible                   |
| Encryption  | Node.js built-in `crypto` (AES-256-GCM)       | No external dependency                         |
| Email       | `nodemailer`                                  | SMTP relay support                             |
| Scheduler   | `node-cron`                                   | In-process cron for expiry checks              |
| Logging     | `winston`                                     | Structured JSON audit logs                     |
| Validation  | `zod`                                         | Schema validation on all inputs                |

### Frontend

| Component    | Technology                | Rationale                                   |
|--------------|---------------------------|---------------------------------------------|
| Framework    | React 18 + Vite           | Fast builds, lightweight                    |
| Styling      | TailwindCSS               | Utility-first, no runtime overhead          |
| Table        | TanStack Table v8         | Sorting, filtering, pagination              |
| Routing      | React Router v6           | SPA routing                                 |
| HTTP client  | axios                     | Interceptors for JWT refresh                |
| State        | React `useState`/`useEffect` | Local component state; `zustand` for auth only |

> **Note:** The frontend uses plain controlled components and axios directly — not React Query or React Hook Form. Keep it simple.

### Infrastructure

| Component        | Technology                                            |
|------------------|-------------------------------------------------------|
| Containerization | Docker + Docker Compose                               |
| Reverse proxy    | Existing Nginx Proxy Manager (NPM) with internal SSL  |
| Persistence      | Docker named volumes for SQLite DB and logs           |

---

## 3. System Architecture

```
[Browser]
    │
    ▼
[Nginx Proxy Manager — TLS termination, internal SSL]
    │
    ├──▶  /            →  frontend container  (port 3000, Vite preview / nginx static)
    └──▶  /api/*       →  backend container   (port 3001, Express)
                │
                ├──▶  /data/inventory.db   (SQLite, Docker volume)
                └──▶  /logs/audit.log      (Winston, Docker volume)
```

- Frontend container serves the built React SPA via nginx (alpine).
- Backend container runs the Express API.
- Both containers are on the same Docker bridge network (`VMTrak-net`).
- The frontend nginx config proxies `/api/*` to the backend container internally.
- NPM terminates TLS and proxies to the frontend container only.

---

## 4. Docker & Deployment

### docker-compose.yml (overview)

```yaml
services:
  frontend:
    build: ./frontend
    container_name: VMTrak-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - VMTrak-net

  backend:
    build: ./backend
    container_name: VMTrak-backend
    ports:
      - "3001:3001"
    volumes:
      - vm-data:/app/data
      - vm-logs:/app/logs
    env_file:
      - .env
    networks:
      - VMTrak-net
    restart: unless-stopped

volumes:
  vm-data:
  vm-logs:

networks:
  VMTrak-net:
    driver: bridge
```

### Frontend Dockerfile

- `node:20-alpine` build stage → `npm run build`
- `nginx:alpine` serve stage → copies dist to `/usr/share/nginx/html`
- Custom `nginx.conf` proxies `/api/*` to `http://backend:3001`

### Backend Dockerfile

- `node:20-alpine`
- Non-root user
- Healthcheck on `GET /api/health`

### Development (local)

```bash
# Backend (from /backend)
npm install
npm run dev        # nodemon on port 3001

# Frontend (from /frontend)
npm install
npm run dev        # Vite dev server on port 5173
```

> Always run frontend dev server from `/frontend`, not from any other directory in the repo.

---

## 5. Database Schema

All tables use SQLite. `better-sqlite3` runs synchronously — no async/await on DB calls.

Migrations are applied automatically on startup from `backend/src/db/migrations/` in filename order. Applied migrations are tracked in the `_migrations` table.

### 5.1 `users`

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,               -- bcrypt, cost factor 12
  role          TEXT    NOT NULL DEFAULT 'support' CHECK (role IN ('admin', 'support')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### 5.2 `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,          -- SHA-256 hash of the token
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### 5.3 `vms`

```sql
CREATE TABLE vms (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vm_name         TEXT NOT NULL UNIQUE,
  vm_tag          TEXT,
  description     TEXT,
  hypervisor      TEXT,
  cluster         TEXT,
  datacenter      TEXT,
  os_type         TEXT CHECK (os_type IN ('Windows', 'Linux', 'Other') OR os_type IS NULL),
  os_version      TEXT,
  hostname        TEXT,
  ip_address      TEXT,
  vlan            TEXT,
  mac_address     TEXT,
  vcpu            INTEGER,
  ram_gb          REAL,
  disk_gb         REAL,
  power_state     TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (power_state IN ('on', 'off', 'suspended', 'unknown')),
  environment     TEXT CHECK (environment IN ('production', 'staging', 'development', 'test') OR environment IS NULL),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'decommissioned', 'maintenance')),
  owner           TEXT,
  department      TEXT,
  application     TEXT,
  expiry_date     TEXT,                         -- ISO 8601 date, nullable
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_by      INTEGER REFERENCES users(id),
  updated_by      INTEGER REFERENCES users(id)
);
```

### 5.4 `vm_credentials`

```sql
CREATE TABLE vm_credentials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  vm_id         INTEGER NOT NULL REFERENCES vms(id) ON DELETE CASCADE,
  username      TEXT    NOT NULL,
  password_enc  TEXT    NOT NULL,               -- AES-256-GCM ciphertext, base64
  password_iv   TEXT    NOT NULL,               -- 12-byte IV, base64
  password_tag  TEXT    NOT NULL,               -- 16-byte GCM auth tag, base64
  account_type  TEXT    NOT NULL DEFAULT 'primary'
                  CHECK (account_type IN ('primary', 'others')),
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (vm_id, username)
);
```

> `account_type` uses `primary` / `others` (not the original `admin`/`user`/`service` — changed in migration 002).
> The `primary` credential is what shows in the VM list table's Username column.

### 5.5 `audit_logs`

```sql
CREATE TABLE audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  username    TEXT,                             -- denormalised for log permanence
  action      TEXT    NOT NULL,
  entity_type TEXT,                            -- 'vm' | 'credential' | 'user' | 'auth'
  entity_id   INTEGER,
  entity_name TEXT,
  detail      TEXT,                            -- JSON blob of changed fields
  ip_address  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Audit action types:**

```
auth.login         auth.logout         auth.login_failed
vm.create          vm.update           vm.delete          vm.view
credential.create  credential.update   credential.delete  credential.view
rdp.download
user.create        user.update         user.deactivate    user.password_reset
notification.sent
```

### 5.6 `notification_log`

```sql
CREATE TABLE notification_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vm_id       INTEGER NOT NULL REFERENCES vms(id) ON DELETE CASCADE,
  notice_type TEXT    NOT NULL CHECK (notice_type IN ('30d', '14d', '7d', '1d', 'expired')),
  sent_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  recipient   TEXT    NOT NULL
);
```

Prevents duplicate emails on the same day for the same VM + notice type.

### Migrations

| File                         | Description                                              |
|------------------------------|----------------------------------------------------------|
| `001_init.sql`               | Full initial schema — all tables, indexes, pragmas       |
| `002_credential_type.sql`    | Recreates `vm_credentials` with `primary`/`others` enum |

---

## 6. Backend API

Base path: `/api`
All endpoints require `Authorization: Bearer <access_token>` unless marked `[public]`.

### 6.1 Auth

```
POST   /api/auth/login          [public]   Body: { username, password }
POST   /api/auth/refresh        [public]   Cookie: refreshToken
POST   /api/auth/logout                    Invalidates refresh token
GET    /api/auth/me                        Returns current user profile
```

### 6.2 VMs

```
GET    /api/vms                 List VMs (filters, pagination, sort) — includes primary_username
GET    /api/vms/:id             Get single VM
POST   /api/vms                 Create VM          [admin only]
PUT    /api/vms/:id             Update VM          [admin only]
DELETE /api/vms/:id             Delete VM          [admin only]
GET    /api/vms/:id/rdp         Download RDP file
GET    /api/vms/export          Export CSV
```

**GET /api/vms response** includes a `primary_username` field (correlated subquery from `vm_credentials` where `account_type = 'primary'`). Used to populate the Username column in the VM list.

**GET /api/vms query parameters:**

```
search=<string>       full-text across vm_name, hostname, ip_address, owner
environment=<string>  production | staging | development | test
status=<string>       active | decommissioned | maintenance
power_state=<string>  on | off | suspended | unknown
department=<string>
expiring_in=<days>    VMs expiring within N days
page=<int>            default 1
limit=<int>           default 50, max 200
sort=<field>          default created_at
order=asc|desc        default desc
```

### 6.3 VM Credentials

```
GET    /api/vms/:id/credentials                  List credentials (passwords masked)
POST   /api/vms/:id/credentials                  Add credential        [admin only]
PUT    /api/vms/:id/credentials/:cid             Update credential     [admin only]
DELETE /api/vms/:id/credentials/:cid             Delete credential     [admin only]
GET    /api/vms/:id/credentials/:cid/reveal      Decrypt password      [admin + support]
```

The `reveal` endpoint decrypts the password in memory and returns it. Always audit logged.

### 6.4 Users (Admin only)

```
GET    /api/users               List all users
POST   /api/users               Create user
PUT    /api/users/:id           Update user (role, email, active status)
POST   /api/users/:id/reset-password   Admin resets a user's password
DELETE /api/users/:id           Deactivate user (soft delete)
```

### 6.5 Audit Log (Admin only)

```
GET    /api/audit               Query audit logs
```

Query params: `user_id`, `action`, `entity_type`, `from`, `to`, `page`, `limit`

### 6.6 System

```
GET    /api/health              [public]   Returns { status: "ok", uptime }
GET    /api/dashboard/stats               VM counts by status/env, expiring soon
```

---

## 7. Authentication & Authorization

### Token Strategy

- **Access token:** JWT, signed with `JWT_ACCESS_SECRET`, expires in **15 minutes**, stored in `localStorage`
- **Refresh token:** Opaque 32-byte hex string, SHA-256 hashed before DB storage, expires in **7 days**, stored in HttpOnly cookie
- On login: both tokens issued
- On 401: frontend silently calls `/api/auth/refresh`, retries the request
- On refresh failure: redirect to `/login`

### Role Permissions

| Action                        | admin | support |
|-------------------------------|-------|---------|
| View VMs                      | ✅    | ✅      |
| Create / Edit / Delete VM     | ✅    | ❌      |
| View credentials (masked)     | ✅    | ✅      |
| Reveal password               | ✅    | ✅      |
| Add / Edit / Delete credentials | ✅  | ❌      |
| Download RDP                  | ✅    | ✅      |
| Export CSV                    | ✅    | ✅      |
| View audit log                | ✅    | ❌      |
| Manage users                  | ✅    | ❌      |

---

## 8. Credential Encryption

Algorithm: **AES-256-GCM** (authenticated encryption).

### Key management

- 32-byte key in `.env` as `CREDENTIAL_ENCRYPTION_KEY` (hex-encoded, 64 chars)
- Never stored in the database
- Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Flow

- **Encrypt (save):** random 12-byte IV → AES-256-GCM → store `(password_enc, password_iv, password_tag)` in DB
- **Decrypt (reveal):** reconstruct cipher from DB fields → plaintext returned in HTTP response only
- Plaintext is **never** written to disk, logs, or DB

---

## 9. RDP File Generation

`GET /api/vms/:id/rdp?user=<username>`

Generates `.rdp` file content in memory and streams as a download. Password is **excluded** from the file — user copies it from the credential panel.

```
Content-Type: application/x-rdp
Content-Disposition: attachment; filename="<vm_name>.rdp"
```

---

## 10. Email Notification Service

Daily cron at **08:00** checks VMs with `expiry_date IS NOT NULL` and sends email at thresholds: 30d, 14d, 7d, 1d, and on the expiry date. `notification_log` prevents duplicate sends.

SMTP uses IP-authenticated Postfix M365 relay (no credentials needed in transport config).

---

## 11. Audit Logging

Every state-changing and sensitive read writes to both `audit_logs` table and `audit.log` file (Winston).

```json
{
  "timestamp": "2025-11-20T08:34:12.000Z",
  "level": "info",
  "user_id": 1,
  "username": "itadmin",
  "action": "credential.view",
  "entity_type": "credential",
  "entity_id": 7,
  "entity_name": "MYVM01 / Administrator",
  "detail": {},
  "ip_address": "192.168.1.42"
}
```

`detail` captures `{ field: { from, to } }` for updates. Passwords are never in `detail`.

Log rotation: 10 MB per file, 5 files max.

---

## 12. Frontend Structure

### Routes

```
/login                    Login page
/                         → redirects to /vms
/dashboard                Dashboard — stats (coming soon)
/vms                      VM list — filterable, sortable table
/vms/new                  Create VM form        [admin only]
/vms/:id                  VM detail view + credentials panel
/vms/:id/edit             Edit VM form          [admin only — includes credentials sub-card]
/users                    User management       [admin only]
/audit                    Audit log viewer      [admin only]
```

> There is no separate `/credentials` route. Credentials are managed inside the Edit VM form.

### VM List table columns

| VM Name | IP Address | Environment | Username | ⋮ |

- **Username** — primary credential username (account_type = 'primary'), or `—` if none set
- **⋮ menu** — three-dot dropdown per row; items: View, Edit, Download RDP
  - Rendered via React portal (`createPortal` into `document.body`) to escape table `overflow` clipping

### Edit VM — Credentials sub-card

Appears below the Notes field only when editing an existing VM (`/vms/:id/edit`). Allows:
- Viewing existing credentials (username + type badge)
- Adding a new credential: Username, Type (Primary / Others), Password (with show/hide)
- Removing credentials

Credential API calls are immediate (not batched with the VM save).

### Key frontend patterns

- Data fetching: plain `axios` + `useState`/`useEffect` — no React Query
- Forms: plain controlled inputs with `onChange` — no React Hook Form
- Auth state: `zustand` store (`authStore.js`)
- Number inputs: `handleChange` detects `e.target.type === 'number'` and casts to `Number()` before setting state — required because `better-sqlite3` zod schemas use `z.number()` not `z.coerce.number()`

### Credential display (VMDetail)

- Passwords shown as `••••••••`
- "Reveal" fetches decrypted password, shows for 30 seconds with countdown, then masks again
- Copy-to-clipboard available while revealed

---

## 13. Environment Variables

File: `.env` (backend only, never committed)

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://vminventory.yourdomain.internal

JWT_ACCESS_SECRET=<random 64-char hex>
JWT_REFRESH_SECRET=<random 64-char hex>
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

CREDENTIAL_ENCRYPTION_KEY=<random 64-char hex>

SMTP_HOST=your-postfix-relay-host
SMTP_PORT=25
SMTP_FROM=vminventory@yourdomain.internal
NOTIFY_ADMIN_EMAIL=itadmin@yourdomain.internal

LOG_LEVEL=info
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 14. Project File Structure

```
VMTrak/
├── VMTrak.md                         # This document
├── claude.md                         # Claude Code session guidance
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.js                  # Express entry point, boot sequence
│   │   ├── db/
│   │   │   ├── database.js           # DB connection, migration runner, admin seed
│   │   │   └── migrations/
│   │   │       ├── 001_init.sql      # Full initial schema
│   │   │       └── 002_credential_type.sql  # account_type → primary/others
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT verify, requireRole()
│   │   │   └── audit.js              # writeAudit(), getIp()
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── vms.js                # includes primary_username subquery on list
│   │   │   ├── credentials.js
│   │   │   ├── users.js
│   │   │   ├── audit.js
│   │   │   └── dashboard.js
│   │   ├── services/
│   │   │   ├── encryption.js         # AES-256-GCM encrypt/decrypt
│   │   │   ├── rdp.js                # RDP file content generator
│   │   │   ├── email.js              # Nodemailer + templates
│   │   │   └── scheduler.js          # node-cron expiry checker
│   │   └── utils/
│   │       ├── logger.js             # Winston instance
│   │       └── validators.js         # Zod schemas for all routes
│   └── data/
│       └── inventory.db              # SQLite DB (Docker volume in prod)
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── router.jsx                # createBrowserRouter — all routes defined here
        ├── api/
        │   └── client.js             # axios instance + JWT interceptors
        ├── components/
        │   ├── AppShell.jsx          # Layout wrapper (sidebar + header)
        │   ├── Sidebar.jsx           # Nav: Dashboard, VMs, Users, Audit Log
        │   ├── Header.jsx
        │   └── CredentialPanel.jsx   # Used in VMDetail — reveal/copy passwords
        ├── hooks/
        │   └── useAuth.js
        ├── pages/
        │   ├── Login.jsx
        │   ├── VMList.jsx            # Table with three-dot actions menu (portal-based)
        │   ├── VMDetail.jsx          # VM info + CredentialPanel
        │   ├── VMForm.jsx            # Create + Edit; Edit mode includes credentials sub-card
        │   ├── Users.jsx
        │   └── Audit.jsx
        └── store/
            └── authStore.js          # zustand: token, user, login/logout
```

---

## 15. Security Considerations

| Concern                          | Mitigation                                                               |
|----------------------------------|--------------------------------------------------------------------------|
| Password storage (app users)     | bcrypt cost factor 12                                                    |
| VM credential storage            | AES-256-GCM; key only in `.env`, never in DB                             |
| Credential exposure in logs      | Passwords excluded from all audit detail fields                          |
| JWT token theft                  | Access tokens expire in 15 min                                           |
| Refresh token reuse              | Stored as SHA-256 hash; invalidated on logout                            |
| Sensitive endpoints              | Credential reveal + RDP download always audit logged with user + IP      |
| CORS                             | Backend accepts only `FRONTEND_URL`                                      |
| Input validation                 | All request bodies validated with zod before DB interaction              |
| SQL injection                    | `better-sqlite3` parameterised queries throughout; sort column whitelisted |
| RDP file on disk                 | Generated in memory only                                                 |
| Secrets in version control       | `.env` in `.gitignore`                                                   |
| TLS                              | Terminated at NPM; containers communicate on private Docker bridge       |

---

## 16. Future Considerations

- **Dashboard page** — stats widget is a placeholder (`/dashboard` returns "Coming soon")
- **PostgreSQL migration** — schema is compatible; swap `better-sqlite3` for `pg`
- **LDAP / Active Directory auth**
- **VM power control** — integrate hypervisor API (VMware vSphere, Proxmox)
- **SSH key storage** — extend `vm_credentials` with `key_type` field for Linux VMs
- **2FA / TOTP** — per-user TOTP for credential reveal
- **Webhook notifications** — Teams / Slack alerts
- **CSV bulk import** — `POST /api/vms/import` endpoint planned but not implemented
- **Role enforcement in frontend** — currently all UI is shown regardless of role; role checks exist only on backend
