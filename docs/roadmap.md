# VMTrak — Roadmap

> Last updated: 2026-06-05
> Version: v1.2.x — Active development

---

## Completed — v1.0.0

### Core API
- [x] Express app, CORS, cookie-parser, helmet (security headers), global error handler
- [x] SQLite via `better-sqlite3` (sync, parameterised queries throughout)
- [x] Migration runner — auto-applies from `backend/src/db/migrations/` on startup; tolerates duplicate-column errors on redeploy
- [x] Rate limiting on login — 20 failed attempts per IP per 15 min (`express-rate-limit`)

### Authentication
- [x] JWT access tokens (15 min) + opaque refresh tokens (7 days, HttpOnly cookie, SameSite=Strict)
- [x] Token rotation on refresh; invalidation on logout
- [x] First-login setup flow — `must_change_password` flag, `/setup` page, `RequireSetup` guard
- [x] **Microsoft Entra ID / Azure AD SSO** — MSAL OAuth2 flow, email-matched user lookup, signed CSRF state

### Role System (3 tiers)
- [x] `admin` — full access (VMs, credentials, dashboard, users, audit log)
- [x] `readwrite` — VM CRUD, credentials, dashboard, RDP, CSV; no users/audit
- [x] `read` — VM list and VM detail only
- [x] Numeric role hierarchy in `requireRole()` middleware
- [x] Role-gated UI: sidebar, route guards, VM list buttons, VM detail panels

### VM Inventory
- [x] Full VM lifecycle fields including hypervisor host, expiry date with notification toggle
- [x] `GET /api/vms` — search, environment/status/power_state/department/hypervisor filters, pagination, sort
- [x] `GET /api/vms/hypervisors` — distinct hypervisor values for filter dropdown
- [x] `GET /api/vms/reachability` — parallel TCP connectivity check (port 3389 or 22), 2s timeout
- [x] `GET /api/vms/:id/rdp` — in-memory RDP file generation (excluded from Linux VMs in UI)
- [x] `GET /api/vms/export` — CSV export with formula-injection sanitisation
- [x] `POST /api/vms/import` — CSV bulk import with per-row validation

### Credentials
- [x] AES-256-GCM encryption at rest; key never stored in DB
- [x] Reveal endpoint — decrypts in memory, 30s auto-mask countdown in UI
- [x] `account_type`: `primary` / `others`; primary username shown in VM list
- [x] Credentials sub-card in Edit VM form only (no standalone credentials route)

### Users & Audit
- [x] Admin CRUD for users with last-admin guard
- [x] Per-user `notify_expiry` toggle — controls who receives expiry email alerts
- [x] Full audit log — dual write to SQLite + Winston file; all sensitive actions logged

### Email Notifications
- [x] Daily cron at 08:00 (IST via `TZ` env var); idempotent via `notification_log`
- [x] Thresholds: **7 days**, **1 day**, **expired** (configurable in `scheduler.js`)
- [x] Recipients: all users with `notify_expiry = 1` + VM owner email if set
- [x] Light-themed HTML email template; severity colour-coded (amber/red)
- [x] `POST /api/dashboard/test-notifications` — manual trigger
- [x] `tests/test-mail.sh` — automated test script

### Frontend
- [x] VM list: Status (TCP reachability dot), Hypervisor, Environment, Username columns
- [x] Filters: Search, Environment, Status, Hypervisor
- [x] VM detail: live connectivity badge, hypervisor host, expiry date
- [x] Dashboard: stat cards, expiring soon list, recent activity feed
- [x] Audit log: timestamps displayed in browser local timezone (UTC→local conversion)
- [x] Glass dark theme throughout; Tabler Icons (local, no CDN)
- [x] Favicon (SVG server-rack icon) + sidebar logo with vertical layout

### Infrastructure
- [x] Docker named volumes (`vm-data`, `vm-logs`) — data persists across deploys
- [x] `TZ` configurable via `.env` — affects cron times and log timestamps
- [x] GitHub Actions self-hosted runner on itappsdev02; health-checked deploy
- [x] `ENTRA_CLIENT_ID` etc. in `BACKEND_ENV` GitHub secret

### Security
- [x] Rate limiting (login), Helmet headers, CORS locked to `FRONTEND_URL`
- [x] SQL injection: parameterised queries + sort column whitelist
- [x] CSV formula injection: `=+-@` prefix stripping in export
- [x] JWT tampering: signature verified on every request
- [x] Entra SSO CSRF: signed state token (JWT, 5 min TTL)
- [x] `CREDENTIAL_ENCRYPTION_KEY` — never stored in DB; AES-256-GCM

---

## Completed — v1.2.x

### Import Tool
- [x] **Improvements to import tool** — case-insensitive enum matching (Windows/WINDOWS/windows all accepted), human-readable Zod error messages per field, NaN pre-check for numeric columns, "Import another file" retry button, taller error panel with row·name·reason format
- [x] CSV import template trimmed to match VM Create form fields (15 columns, section order)

### Hypervisors
- [x] **Separate Hypervisor page** — full CRUD page at `/hypervisors` with sidebar link (readwrite+)
- [x] Hypervisors table: `name`, `hostname`, `type` (VMware vSphere/Proxmox/Hyper-V/KVM/Other), `version`, `status`, `environment`, `vcpu`, `ram_gb`, `disk_gb`, `description`
- [x] DB migration: `hypervisors` table with FK `vms.hypervisor_id → hypervisors(id)`; existing VM hypervisor text values seeded and backfilled automatically
- [x] VM Create/Edit form: hypervisor field replaced with dropdown sourced from hypervisors table
- [x] TCP reachability check per hypervisor (port by type: vSphere 443, Proxmox 8006, Hyper-V 5985, KVM/Other 22)
- [x] Live status dot + ↺ Check button on hypervisors list
- [x] `HypervisorForm` page mirrors VM Create layout (Identity/Host/Resources/Notes sections)
- [x] Three-dot portal menu on hypervisors list (Edit → form page, Delete with confirmation)
- [x] Delete guard: 409 if VMs are still assigned to the hypervisor

---

## Upcoming

| Feature | Notes |
|---------|-------|
|Predictions for Fields | when user is filling ,OS Version,Owner,Department,Application application should show from existing data|
|Restrict read permission further| in user creation window add department so an user who has only read permission should only see vms whose he is either owner or in department.|
