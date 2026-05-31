# VMTrak — Roadmap

> Last updated: 2026-05-31
> Version: v0.1.0 — Phase 1 complete, Phase 2 in progress

---

## Completed

### Backend — Core API
- [x] Express app entry point, CORS, cookie-parser, global error handler
- [x] SQLite via `better-sqlite3` (sync, parameterised queries throughout)
- [x] Migration runner — auto-applies from `backend/src/db/migrations/` on startup
- [x] `001_init.sql` — full initial schema (users, refresh_tokens, vms, vm_credentials, audit_logs, notification_log)
- [x] `002_credential_type.sql` — `account_type` changed from `admin/user/service` → `primary/others`
- [x] Admin seed user created on first boot if no users exist

### Backend — Authentication
- [x] `POST /api/auth/login` — bcrypt verify, access + refresh token issue
- [x] `POST /api/auth/refresh` — token rotation (delete old, issue new), HttpOnly cookie
- [x] `POST /api/auth/logout` — refresh token invalidation
- [x] `GET /api/auth/me` — returns current user profile
- [x] JWT middleware (`authenticate`) — verifies token, confirms user still active in DB
- [x] Role guard (`requireRole`) — 401/403 on insufficient role

### Backend — VM Inventory
- [x] `GET /api/vms` — list with search, environment/status/power_state/department filters, pagination, sort, `primary_username` correlated subquery
- [x] `GET /api/vms/:id` — single VM fetch with audit log
- [x] `POST /api/vms` — create VM (admin only), full field set, zod validated
- [x] `PUT /api/vms/:id` — update VM (admin only), diff captured in audit detail
- [x] `DELETE /api/vms/:id` — delete VM (admin only)
- [x] `GET /api/vms/:id/rdp` — RDP file generated in memory, streamed as download, audit logged
- [x] `GET /api/vms/export` — CSV export of active VMs *(see known bug below — route order)*

### Backend — Credentials
- [ x ] `GET /api/vms/:id/credentials` — list with passwords masked as `••••••••`
- [x] `POST /api/vms/:id/credentials` — add credential, AES-256-GCM encrypt on write
- [x] `PUT /api/vms/:id/credentials/:cid` — update credential (re-encrypts if password changed)
- [x] `DELETE /api/vms/:id/credentials/:cid` — remove credential
- [x] `GET /api/vms/:id/credentials/:cid/reveal` — decrypt in-memory, return plaintext, always audit logged

### Backend — Users (admin only)
- [x] `GET /api/users`
- [x] `POST /api/users`
- [x] `PUT /api/users/:id` — update role/email/active; last-admin guard
- [x] `POST /api/users/:id/reset-password` — hash new password, invalidate all refresh tokens
- [x] `DELETE /api/users/:id` — soft-deactivate (sets `is_active = 0`); last-admin guard

### Backend — Supporting Services
- [x] `GET /api/audit` — query audit log with user/action/entity/date filters (admin only)
- [x] `GET /api/dashboard/stats` — VM counts by status/environment/power_state, expiring-in-30d list, expired count
- [x] `GET /api/health` — public health check
- [x] AES-256-GCM encryption service (`services/encryption.js`)
- [x] RDP file generator (`services/rdp.js`) — all standard RDP flags, password intentionally excluded
- [x] Email service (`services/email.js`) — nodemailer, IP-authenticated SMTP relay, HTML templates for all 5 thresholds
- [x] Expiry scheduler (`services/scheduler.js`) — daily cron at 08:00, idempotent via `notification_log`
- [x] Audit middleware (`middleware/audit.js`) — dual write to DB + Winston file
- [x] Winston logger — JSON format, 10 MB rotation, 5 files max
- [x] Zod schemas for all route inputs (`utils/validators.js`)

### Frontend — Infrastructure
- [x] Single canonical frontend at `VMTrak/frontend/` (merged and verified, May 2026)
- [x] Vite 5 + React 18 + TailwindCSS configured
- [x] `index.html`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`
- [x] Global CSS with component classes: `btn-primary`, `btn-secondary`, `btn-danger`, `input-base`, `card-base`
- [x] axios instance with request interceptor (JWT attach) and response interceptor (401 → refresh → retry)
- [x] zustand auth store — token, user, login, logout, checkAuth
- [x] React Router v6 with all routes registered
- [x] AppShell layout — collapsible sidebar + header with user email + logout

### Frontend — Pages
- [x] **Login** — form with username/password, error display, redirect on success
- [x] **VM List** — TanStack Table with sort/filter row models; columns: VM Name, IP Address, Environment, Username (primary credential), three-dot actions menu
  - [x] Three-dot menu: View, Edit, Download RDP — rendered via `createPortal` to escape table `overflow` clipping
  - [x] Search filter (vm_name, IP, hostname, owner)
  - [x] Environment and Status dropdown filters
  - [x] Pagination with Prev/Next
- [x] **VM Detail** — full field display, CredentialPanel (reveal/30 s timer/copy)
- [x] **VM Form** — create and edit mode, all schema fields, number input casting to `Number()` for zod compatibility
  - [x] Credentials sub-card (edit mode only) — list existing, add new (username, type, password with show/hide), delete

---

## Known Bugs — Fix First

- [x] **`api/client.js` refresh token field mismatch** — line 41 reads `data.token` but backend returns `data.accessToken`; token is silently `undefined` after every access-token expiry, forcing re-login
  - Fix: `localStorage.setItem('token', data.accessToken)` and `originalRequest.headers.Authorization = \`Bearer ${data.accessToken}\``

- [x] **`authStore.js` `/auth/me` response unwrap** — lines 15, 43, 67 set `user: data.user` but the endpoint returns the user object directly (not `{ user: ... }`); `user` is always `undefined` after page reload
  - Fix: replace `data.user` with `data` in `refreshUser` and `checkAuth` in `authStore.js`

- [x] **`vms.js` route order — export shadowed by `:id`** — `GET /api/vms/export` is registered after `GET /api/vms/:id`; Express matches `id = 'export'` first and returns 404
  - Fix: move the `/export` route definition above `/:id` in `backend/src/routes/vms.js`

---

## Remaining — Phase 2

### Frontend — Stub Pages (backend APIs are fully ready)

- [ ] **Users page** (`/users`) — currently shows "Coming soon"
  - [ ] Table: username, email, role badge, active status, created date
  - [ ] Create user modal — username, email, password, role
  - [ ] Edit user inline or modal — email, role, active toggle
  - [ ] Reset password action (admin sets new password)
  - [ ] Deactivate user (soft delete with confirmation)

- [ ] **Audit Log page** (`/audit`) — currently shows "Coming soon"
  - [ ] Paginated table: timestamp, user, action, entity, IP address, detail
  - [ ] Filters: date range, action type, entity type, user
  - [ ] Detail expand — shows changed fields for update actions

- [ ] **Dashboard page** (`/dashboard`) — currently shows "Coming soon"
  - [ ] VM count by status (active / maintenance / decommissioned)
  - [ ] VM count by environment (production / staging / dev / test)
  - [ ] VM count by power state
  - [ ] Expiring within 30 days list (links to VM detail)
  - [ ] Expired-but-still-active count with warning badge

### Frontend — Auth & Access Control

- [ ] **Route guards** — unauthenticated users can currently navigate to any route; redirect to `/login` if `!isAuthenticated`
- [ ] **Role-based UI** — support users see "New VM" button and Edit option; backend correctly rejects but UI should hide/disable admin-only actions based on `user.role`

### Backend — Missing Endpoint

- [ ] **`POST /api/vms/import`** — CSV bulk import (admin only); validate headers, insert rows, return summary `{ imported, skipped, errors }`

---

## Remaining — Phase 3 (Deployment)

- [ ] **`backend/Dockerfile`** — `node:20-alpine`, non-root user, healthcheck on `GET /api/health`
- [ ] **`frontend/Dockerfile`** — two-stage: `node:20-alpine` build → `nginx:alpine` serve
- [ ] **`frontend/nginx.conf`** — serve static dist, proxy `/api/*` → `http://backend:3001`
- [ ] **`docker-compose.yml`** at VMTrak root — frontend (port 3000:80) + backend (port 3001) + named volumes for DB and logs
- [ ] **`.env` setup guide** — document one-time secret generation steps for first deploy

---

## Future / Out of Scope for v1

- [ ] Dashboard charts (Chart.js or recharts) — currently plain counts
- [ ] `GET /api/vms/export` — respect current filters (currently exports all non-decommissioned)
- [ ] CSV import progress feedback — streaming or polling for large imports
- [ ] PostgreSQL migration — schema is compatible, swap `better-sqlite3` for `pg`
- [ ] LDAP / Active Directory authentication
- [ ] VM power control — integrate hypervisor API (VMware vSphere / Proxmox)
- [ ] SSH key storage — extend `vm_credentials` with `key_type` for Linux VMs
- [ ] 2FA / TOTP — per-user TOTP gating credential reveal
- [ ] Webhook notifications — Teams / Slack in addition to email
- [ ] Scheduled CSV/Excel email reports
