# VMTrak
## Table of Contents

1. [Project Overview](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#1-project-overview)
2. [Technology Stack](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#2-technology-stack)
3. [System Architecture](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#3-system-architecture)
4. [Docker & Deployment](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#4-docker--deployment)
5. [Database Schema](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#5-database-schema)
6. [Backend API](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#6-backend-api)
7. [Authentication & Authorization](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#7-authentication--authorization)
8. [Credential Encryption](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#8-credential-encryption)
9. [RDP File Generation](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#9-rdp-file-generation)
10. [Email Notification Service](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#10-email-notification-service)
11. [Audit Logging](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#11-audit-logging)
12. [Frontend Structure](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#12-frontend-structure)
13. [Environment Variables](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#13-environment-variables)
14. [Project File Structure](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#14-project-file-structure)
15. [Security Considerations](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#15-security-considerations)
16. [Future Considerations](https://claude.ai/chat/7ca3cc04-9d10-4a87-9c1a-4ecda2a9f660#16-future-considerations)

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

---

## 2. Technology Stack

### Backend

|Component|Technology|Rationale|
|---|---|---|
|Runtime|Node.js 20 LTS|Stable, widely supported|
|Framework|Express.js|Minimal, well-documented|
|Database|SQLite via `better-sqlite3`|Zero-infra, single-file, sufficient for scale|
|ORM / Query|Raw SQL via `better-sqlite3`|Full control, no abstraction overhead|
|Auth|JWT (`jsonwebtoken`) — access + refresh tokens|Stateless, proxy-compatible|
|Encryption|Node.js built-in `crypto` (AES-256-GCM)|No external dependency|
|Email|`nodemailer`|SMTP relay support|
|Scheduler|`node-cron`|In-process cron for expiry checks|
|Logging|`winston`|Structured JSON audit logs|
|Validation|`zod`|Schema validation on all inputs|

### Frontend

|Component|Technology|Rationale|
|---|---|---|
|Framework|React 18 + Vite|Fast builds, lightweight|
|Styling|TailwindCSS|Utility-first, no runtime overhead|
|Table|TanStack Table v8|Sorting, filtering, pagination|
|Data fetching|TanStack Query (React Query)|Caching, loading/error states|
|Routing|React Router v6|SPA routing|
|Forms|React Hook Form + zod|Validation aligned with backend|
|HTTP client|axios|Interceptors for JWT refresh|
|Icons|Lucide React|Lightweight, consistent|

### Infrastructure

|Component|Technology|
|---|---|
|Containerization|Docker + Docker Compose|
|Reverse proxy|Existing Nginx Proxy Manager (NPM) with internal SSL|
|Persistence|Docker named volumes for SQLite DB and logs|

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

### NPM Configuration

Point NPM to `http://<docker-host>:3000`. NPM handles SSL. No changes needed inside containers.

---

## 5. Database Schema

All tables use SQLite. `better-sqlite3` runs synchronously — no async/await complexity.

### 5.1 `users`

```sql
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE,
  email       TEXT    NOT NULL UNIQUE,
  password_hash TEXT  NOT NULL,               -- bcrypt, cost factor 12
  role        TEXT    NOT NULL DEFAULT 'support', -- 'admin' | 'support'
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### 5.2 `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,        -- SHA-256 hash of the token
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### 5.3 `vms`

```sql
CREATE TABLE vms (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Identity
  vm_name         TEXT NOT NULL UNIQUE,
  vm_tag          TEXT,
  description     TEXT,

  -- Infrastructure
  hypervisor      TEXT,
  cluster         TEXT,
  datacenter      TEXT,

  -- OS
  os_type         TEXT,                       -- 'Windows' | 'Linux' | 'Other'
  os_version      TEXT,
  hostname        TEXT,

  -- Network
  ip_address      TEXT,
  vlan            TEXT,
  mac_address     TEXT,

  -- Resources
  vcpu            INTEGER,
  ram_gb          REAL,
  disk_gb         REAL,

  -- State
  power_state     TEXT DEFAULT 'unknown',     -- 'on' | 'off' | 'suspended' | 'unknown'
  environment     TEXT,                       -- 'production' | 'staging' | 'development' | 'test'
  status          TEXT DEFAULT 'active',      -- 'active' | 'decommissioned' | 'maintenance'

  -- Ownership
  owner           TEXT,
  department      TEXT,
  application     TEXT,

  -- Lifecycle
  expiry_date     TEXT,                       -- ISO 8601 date, nullable
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
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vm_id           INTEGER NOT NULL REFERENCES vms(id) ON DELETE CASCADE,
  username        TEXT    NOT NULL,
  password_enc    TEXT    NOT NULL,           -- AES-256-GCM ciphertext, base64-encoded
  password_iv     TEXT    NOT NULL,           -- 12-byte IV, base64-encoded
  password_tag    TEXT    NOT NULL,           -- 16-byte GCM auth tag, base64-encoded
  account_type    TEXT    NOT NULL DEFAULT 'user', -- 'admin' | 'user' | 'service'
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (vm_id, username)
);
```

### 5.5 `audit_logs`

```sql
CREATE TABLE audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  username    TEXT,                           -- denormalised for log permanence
  action      TEXT    NOT NULL,              -- see Action Types below
  entity_type TEXT,                          -- 'vm' | 'credential' | 'user' | 'auth'
  entity_id   INTEGER,
  entity_name TEXT,                          -- denormalised VM name / username
  detail      TEXT,                          -- JSON blob of changed fields
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
  notice_type TEXT    NOT NULL,              -- '30d' | '14d' | '7d' | '1d' | 'expired'
  sent_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  recipient   TEXT    NOT NULL
);
```

Prevents duplicate emails on the same day for the same VM + notice type.

---

## 6. Backend API

Base path: `/api`  
All endpoints require `Authorization: Bearer <access_token>` unless marked `[public]`.

### 6.1 Auth

```
POST   /api/auth/login          [public]   Body: { username, password }
POST   /api/auth/refresh        [public]   Body: { refreshToken }
POST   /api/auth/logout                    Invalidates refresh token
GET    /api/auth/me                        Returns current user profile
```

### 6.2 VMs

```
GET    /api/vms                 List all VMs (with filters, pagination, sort)
GET    /api/vms/:id             Get single VM (excludes credentials)
POST   /api/vms                 Create VM          [admin only]
PUT    /api/vms/:id             Update VM          [admin only]
DELETE /api/vms/:id             Delete VM          [admin only]
GET    /api/vms/:id/rdp         Download RDP file  [admin + support]
POST   /api/vms/import          CSV bulk import    [admin only]
GET    /api/vms/export          Export CSV         [admin + support]
```

**GET /api/vms query parameters:**

```
search=<string>       full-text across vm_name, hostname, ip_address, owner
environment=<string>
status=<string>
power_state=<string>
department=<string>
expiring_in=<days>    filter VMs expiring within N days
page=<int>            default 1
limit=<int>           default 50, max 200
sort=<field>          default created_at
order=asc|desc        default desc
```

### 6.3 VM Credentials

```
GET    /api/vms/:id/credentials          List credentials (passwords masked as "••••••••")
POST   /api/vms/:id/credentials          Add credential        [admin only]
PUT    /api/vms/:id/credentials/:cid     Update credential     [admin only]
DELETE /api/vms/:id/credentials/:cid     Delete credential     [admin only]
GET    /api/vms/:id/credentials/:cid/reveal   Decrypt and return password  [admin + support]
```

The `reveal` endpoint decrypts the password in memory and returns it over HTTPS. It is always audit logged with user, IP, VM name, and credential username.

### 6.4 Users (Admin only)

```
GET    /api/users               List all users
POST   /api/users               Create user
PUT    /api/users/:id           Update user (role, email, active status)
POST   /api/users/:id/reset-password   Admin resets a user's password
DELETE /api/users/:id           Deactivate user (soft delete, sets is_active=0)
```

### 6.5 Audit Log (Admin only)

```
GET    /api/audit               Query audit logs
```

Query params: `user_id`, `action`, `entity_type`, `from`, `to`, `page`, `limit`

### 6.6 System

```
GET    /api/health              [public]   Returns { status: "ok", uptime }
GET    /api/dashboard/stats               Returns VM counts by status/env, expiring soon
```

---

## 7. Authentication & Authorization

### Token Strategy

- **Access token:** JWT, signed with `JWT_ACCESS_SECRET`, expires in **15 minutes**
- **Refresh token:** Opaque random string (32 bytes, hex), hashed with SHA-256 before DB storage, expires in **7 days**
- On login: both tokens issued
- On access token expiry: frontend silently POSTs to `/api/auth/refresh` using the refresh token
- On refresh token expiry or invalidation: user is redirected to login

### JWT Payload

```json
{
  "sub": 1,
  "username": "itadmin",
  "role": "admin",
  "iat": 1700000000,
  "exp": 1700000900
}
```

### Role Permissions

|Action|admin|support|
|---|---|---|
|View VMs|✅|✅|
|Create / Edit / Delete VM|✅|❌|
|View credentials (masked)|✅|✅|
|Reveal password|✅|✅|
|Add / Edit / Delete credentials|✅|❌|
|Download RDP|✅|✅|
|Import / Export CSV|✅|✅ (export only)|
|View audit log|✅|❌|
|Manage users|✅|❌|

---

## 8. Credential Encryption

Algorithm: **AES-256-GCM** (authenticated encryption — provides both confidentiality and integrity).

### Encryption key

- 32-byte key stored in `.env` as `CREDENTIAL_ENCRYPTION_KEY` (hex-encoded, 64 chars)
- Never stored in the database
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Encrypt (on save)

```javascript
function encryptPassword(plaintext) {
  const iv = crypto.randomBytes(12);                          // 96-bit IV
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.CREDENTIAL_ENCRYPTION_KEY, 'hex'),
    iv
  );
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();                            // 16-byte auth tag
  return {
    password_enc: encrypted.toString('base64'),
    password_iv:  iv.toString('base64'),
    password_tag: tag.toString('base64')
  };
}
```

### Decrypt (on reveal)

```javascript
function decryptPassword(enc, iv, tag) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.CREDENTIAL_ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(enc, 'base64')),
    decipher.final()
  ]).toString('utf8');
}
```

Decryption happens **in memory only**. The plaintext password is never written to disk, logs, or the database.

---

## 9. RDP File Generation

Endpoint: `GET /api/vms/:id/rdp?user=<username>`

The server:

1. Fetches the VM record (IP address, VM name)
2. Validates the requesting user has access
3. Generates the `.rdp` file content as a string in memory
4. Writes it to the HTTP response as a file download
5. Logs the download to the audit log

**Generated `.rdp` file content:**

```
full address:s:<ip_address>
username:s:<credential_username>
prompt for credentials:i:1
administrative session:i:0
desktopwidth:i:1920
desktopheight:i:1080
session bpp:i:32
connection type:i:7
networkautodetect:i:1
bandwidthautodetect:i:1
displayconnectionbar:i:1
enableworkspacereconnect:i:0
disable wallpaper:i:0
autoreconnection enabled:i:1
authentication level:i:2
```

Password is **intentionally excluded** from the RDP file for security. The user copies the password from the credential panel manually.

**HTTP response headers:**

```
Content-Type: application/x-rdp
Content-Disposition: attachment; filename="<vm_name>.rdp"
```

---

## 10. Email Notification Service

### SMTP Configuration

Uses `nodemailer` with SMTP transport (IP-authenticated Postfix M365 relay — no username/password required):

```javascript
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),   // typically 25 or 587
  secure: false,
  auth: undefined,                          // IP auth, no credentials
  tls: { rejectUnauthorized: false }
});
```

### Cron Schedule

Runs daily at **08:00 server local time** using `node-cron`:

```javascript
cron.schedule('0 8 * * *', runExpiryCheck);
```

### Expiry Check Logic

```
For each VM where expiry_date IS NOT NULL and status = 'active':
  daysUntilExpiry = daysBetween(today, expiry_date)

  For each threshold in [30, 14, 7, 1, 0]:
    if daysUntilExpiry == threshold:
      if no row in notification_log for (vm_id, threshold_type, today):
        send email
        insert row into notification_log
```

The `notification_log` check ensures idempotency — restarting the container mid-day will not resend emails.

### Email Templates

**Subject line examples:**

```
[VM Inventory] EXPIRY WARNING — MYVM01 expires in 30 days
[VM Inventory] EXPIRY URGENT — MYVM01 expires in 7 days
[VM Inventory] VM EXPIRED TODAY — MYVM01
```

**Email body includes:** VM Name, IP Address, Environment, Owner, Department, Expiry Date, direct link to VM record in the app.

**Recipients:** VM `owner` field (if it is a valid email) + `NOTIFY_ADMIN_EMAIL` from `.env`.

---

## 11. Audit Logging

Every state-changing and sensitive read operation writes a row to the `audit_logs` table AND appends a JSON entry to `audit.log` (Winston file transport, volume-mounted).

### Log entry structure

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

The `detail` field captures changed fields as `{ field: { from: oldValue, to: newValue } }` for update actions. Passwords are **never** included in `detail`.

### Winston configuration

```javascript
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/app/logs/audit.log', maxsize: 10485760, maxFiles: 5 }),
    new winston.transports.Console()
  ]
});
```

Log rotation: 10 MB per file, up to 5 files (50 MB total). Adjust via env if needed.

---

## 12. Frontend Structure

### Pages / Routes

```
/login                    Login page
/                         Dashboard (VM count stats, expiring soon widget)
/vms                      VM list (filterable, sortable, paginated table)
/vms/new                  Add VM form              [admin only]
/vms/:id                  VM detail view
/vms/:id/edit             Edit VM form             [admin only]
/admin/users              User management          [admin only]
/admin/audit              Audit log viewer         [admin only]
```

### Component Structure (abbreviated)

```
src/
├── api/               axios instance + per-resource API functions
├── components/
│   ├── layout/        AppShell, Sidebar, TopBar
│   ├── ui/            Button, Modal, Badge, Input, Table (shared)
│   ├── vm/            VMTable, VMForm, VMDetailPanel, CredentialPanel
│   └── admin/         UserTable, UserForm, AuditLogTable
├── hooks/             useAuth, useVMs, useCredentials, useAudit
├── pages/             One file per route
├── store/             Auth context (JWT, user role)
└── utils/             formatters, validators
```

### JWT Handling in Frontend

- Access token stored in **memory only** (React context / closure) — not in `localStorage`
- Refresh token stored in an **HttpOnly, Secure, SameSite=Strict cookie** — not accessible to JavaScript
- Axios request interceptor attaches `Authorization: Bearer <access_token>` header
- Axios response interceptor catches 401, silently calls `/api/auth/refresh`, retries the original request

### Credential UI

- Passwords rendered as `••••••••` by default
- "Reveal" button triggers `GET /api/vms/:id/credentials/:cid/reveal`
- Revealed password shown inline for 30 seconds, then masked again automatically
- Copy-to-clipboard button available while revealed

---

## 13. Environment Variables

File: `.env` (backend container, never committed to version control)

```env
# Application
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://vminventory.yourdomain.internal

# Auth
JWT_ACCESS_SECRET=<random 64-char hex>
JWT_REFRESH_SECRET=<random 64-char hex>
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Encryption
CREDENTIAL_ENCRYPTION_KEY=<random 64-char hex>

# SMTP (Postfix M365 IP relay — no credentials)
SMTP_HOST=your-postfix-relay-host
SMTP_PORT=25
SMTP_FROM=vminventory@yourdomain.internal
NOTIFY_ADMIN_EMAIL=itadmin@yourdomain.internal

# Logging
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
├── .env                          # Secrets — never commit
├── .env.example                  # Template — commit this
├── docker-compose.yml
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── index.js              # Express app entry point
│   │   ├── db/
│   │   │   ├── database.js       # better-sqlite3 connection, migrations
│   │   │   └── migrations/
│   │   │       └── 001_init.sql  # Full schema
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT verification, role guard
│   │   │   └── audit.js          # Audit log middleware
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── vms.js
│   │   │   ├── credentials.js
│   │   │   ├── users.js
│   │   │   └── audit.js
│   │   ├── services/
│   │   │   ├── encryption.js     # AES-256-GCM encrypt/decrypt
│   │   │   ├── rdp.js            # RDP file generator
│   │   │   ├── email.js          # Nodemailer transporter + templates
│   │   │   └── scheduler.js      # node-cron expiry checker
│   │   └── utils/
│   │       ├── logger.js         # Winston instance
│   │       └── validators.js     # Zod schemas
│   └── data/                     # SQLite DB (Docker volume mount point)
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/
        ├── components/
        ├── hooks/
        ├── pages/
        ├── store/
        └── utils/
```

---

## 15. Security Considerations

|Concern|Mitigation|
|---|---|
|Password storage (app users)|bcrypt with cost factor 12|
|VM credential storage|AES-256-GCM encryption; key only in `.env`|
|Credential exposure in logs|Passwords explicitly excluded from all log output and audit detail fields|
|JWT token theft|Access tokens expire in 15 min; refresh tokens are HttpOnly cookies|
|Refresh token reuse|Token stored as SHA-256 hash in DB; invalidated on logout|
|Sensitive endpoints|All credential reveal and RDP download actions are audit logged with user + IP|
|CORS|Backend configured to accept requests only from `FRONTEND_URL`|
|Input validation|All request bodies validated with zod schemas before DB interaction|
|SQL injection|`better-sqlite3` parameterised queries throughout|
|RDP file on disk|Generated in memory only; never written to filesystem|
|Secrets in version control|`.env` in `.gitignore`; `.env.example` with placeholder values committed instead|
|Container hardening|Backend runs as non-root user inside container|
|TLS|Terminated at NPM; internal container-to-container traffic is on private Docker bridge network|

---

## 16. Future Considerations

These are out of scope for v1 but documented for planning:

- **PostgreSQL migration** — schema is compatible; swap `better-sqlite3` for `pg`
- **LDAP / Active Directory auth** — useful if VMs become domain-joined
- **VM power control** — integrate hypervisor API (VMware vSphere, Proxmox) for power state sync
- **SSH key storage** — extend `vm_credentials` with `key_type` field for Linux VMs
- **2FA / TOTP** — add per-user TOTP for credential reveal actions
- **Webhook notifications** — Teams / Slack alerts in addition to email
- **CSV/Excel scheduled reports** — weekly VM status report emailed to admin
