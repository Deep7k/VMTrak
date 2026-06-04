# VMTrak — System Architecture

## Overview

VMTrak is a self-hosted VM inventory application. It replaces manual spreadsheet tracking with a structured, auditable web app. The system is fully containerised and designed to run behind an internal reverse proxy (Nginx Proxy Manager).

---

## Container Layout

```
Internet / Internal network
        │
        ▼
[Nginx Proxy Manager]  ← TLS termination (Let's Encrypt or internal CA)
        │
        ├──▶  /          → vmtrak-frontend  (port 3000 → nginx:80, serves React SPA)
        └──▶  /api/*     → vmtrak-backend   (port 3001, Express API)
                                │
                                ├── vm-data volume  (/app/data/inventory.db)
                                └── vm-logs volume  (/app/logs/audit.log*)
```

Both containers run on a private Docker bridge network (`vmtrak-net`). Neither container is reachable directly from outside — all traffic enters through the reverse proxy.

---

## Services

### Frontend (vmtrak-frontend)

Two-stage Docker build:
1. **Node 20 Alpine** — `npm ci && vite build` produces `/app/dist`
2. **Nginx Alpine** — serves `/app/dist` as a static SPA

The Nginx config (`frontend/nginx.conf`) does two things:
- Serves all routes with `try_files $uri /index.html` (enables client-side routing)
- Proxies `/api/*` to `http://backend:3001` (same Docker network, no port exposure needed)

Listens on port 80 inside the container; mapped to host port 3000.

### Backend (vmtrak-backend)

Node.js 20 Alpine running `node src/index.js`.

Key responsibilities:
- REST API (Express, port 3001)
- SQLite database access via `better-sqlite3` (synchronous — no async/await on DB calls)
- JWT issuance and verification
- Microsoft Entra ID OAuth2 flow (MSAL Node)
- AES-256-GCM credential encryption/decryption
- Daily notification cron (node-cron, 08:00 IST)
- Audit log (dual-write: SQLite + Winston file)

Runs as an unprivileged user (`appuser`) inside the container.

---

## Data Persistence

| Volume     | Mount path      | Contents                          |
|------------|-----------------|-----------------------------------|
| `vm-data`  | `/app/data`     | `inventory.db` + WAL files        |
| `vm-logs`  | `/app/logs`     | `audit.log` + rotated archives    |

Named volumes survive `docker compose up -d --remove-orphans` and `git clean` on the CI runner. The previous bind-mount approach (`./app_data`) was wiped on every CI checkout — the volume approach was the fix.

---

## Database

SQLite via `better-sqlite3`. The library is **synchronous** — all queries are blocking calls. There is no connection pool and no async wrapper. This is intentional: SQLite with WAL mode handles the concurrency level this app needs without the overhead of a full RDBMS.

Pragmas set at startup:
```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

Schema migrations live in `backend/src/db/migrations/` and are applied in filename order on every startup. The runner tolerates `duplicate column` errors so a partial migration from a previous crashed deploy doesn't block startup.

See [database schema details in security.md](security.md#database-schema) or the migration files directly.

---

## Request Flow

### Authenticated API request

```
Browser
  │  Authorization: Bearer <access_token>
  ▼
Nginx Proxy Manager  →  /api/vms  →  vmtrak-backend:3001
                                            │
                                     auth middleware
                                     (verify JWT signature, extract user + role)
                                            │
                                     route handler
                                     (Zod validation → DB query → JSON response)
                                            │
                                     audit middleware
                                     (for write operations: log to SQLite + Winston)
```

### Token refresh flow

```
Browser detects 401
  │
  ▼
POST /api/auth/refresh (HttpOnly cookie carries refresh token)
  │
  ▼
Backend: hash cookie value → compare against refresh_tokens table
         → issue new access token + rotate refresh token
  │
  ▼
Browser: stores new access token, retries original request
```

If `/refresh` itself returns 401, the axios interceptor redirects to `/login`.

---

## Background Jobs

A single node-cron job runs inside the backend container:

| Schedule        | Job                                                            |
|-----------------|----------------------------------------------------------------|
| Daily at 08:00  | Scan `vms` table for `expiry_date` within 7d / 1d / today    |

The scheduler uses the `TZ` environment variable (default `Asia/Kolkata`). Each run checks `notification_log` to avoid duplicate emails for the same `(vm_id, notice_type, date)` combination.

See [mail.md](mail.md) for full details.

---

## CI/CD Pipeline

File: `.github/workflows/deploy-dev.yml`

Trigger: push to `dev` branch (or manual `workflow_dispatch`)

Runner: self-hosted, `[self-hosted, Linux, X64, dev02]` — this is `itappsdev02` on the internal network.

Steps:
1. Checkout code
2. Write `./backend/.env` from the `BACKEND_ENV` GitHub secret
3. `docker compose build`
4. `docker compose up -d --remove-orphans`
5. Poll `http://localhost:3000/api/health` (12 retries × 5s) until healthy

There is no staging→production promotion flow yet. The `dev` branch IS the deployed environment at `vmtrak-dev.internal.indishtech.in`.

---

## Key File Paths

| Purpose                    | Path                                      |
|----------------------------|-------------------------------------------|
| Backend entry point        | `backend/src/index.js`                    |
| Express app setup          | `backend/src/index.js`                    |
| DB init + migrations       | `backend/src/db/database.js`              |
| Migrations                 | `backend/src/db/migrations/`              |
| Auth routes (local + SSO)  | `backend/src/routes/auth.js`              |
| VM CRUD routes             | `backend/src/routes/vms.js`               |
| Credential routes          | `backend/src/routes/credentials.js`       |
| JWT middleware             | `backend/src/middleware/auth.js`          |
| AES-256-GCM service        | `backend/src/services/encryption.js`      |
| Email service              | `backend/src/services/email.js`           |
| Notification scheduler     | `backend/src/services/scheduler.js`       |
| RDP file generator         | `backend/src/services/rdp.js`             |
| Zod schemas                | `backend/src/utils/validators.js`         |
| Winston logger             | `backend/src/utils/logger.js`             |
| Frontend entry             | `frontend/src/main.jsx`                   |
| React Router config        | `frontend/src/router.jsx`                 |
| Axios client + interceptor | `frontend/src/api/client.js`              |
| Auth state (Zustand)       | `frontend/src/store/authStore.js`         |
| Role guards                | `frontend/src/components/Guards.jsx`      |
| AppShell layout            | `frontend/src/components/AppShell.jsx`    |
| Global CSS / theme         | `frontend/src/index.css`                  |
| Tailwind config            | `frontend/tailwind.config.js`             |
| Docker Compose             | `docker-compose.yml`                      |
| CI/CD workflow             | `.github/workflows/deploy-dev.yml`        |
