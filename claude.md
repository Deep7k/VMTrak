# VMTrak — Claude Code guidance

## What this is
Self-hosted VM inventory app replacing Excel tracking. Node.js/Express backend, React/Vite frontend, SQLite via better-sqlite3, Dockerized for production.

## Documentation
In-depth docs live in `docs/`:
- `docs/architecture.md` — container layout, request flow, CI/CD, key file paths
- `docs/auth.md` — JWT + Entra SSO auth, token lifecycle, role system
- `docs/mail.md` — notification scheduler, email template, SMTP config
- `docs/ui.md` — design system, color palette, typography, component classes
- `docs/security.md` — full threat model, encryption, audit logging
- `docs/roadmap.md` — completed v1.0 features and v2 scope

## Stack
- **Backend:** Express, better-sqlite3 (sync — NO async/await on DB calls), zod, winston, node-cron, nodemailer, @azure/msal-node
- **Frontend:** React 18, Vite, TailwindCSS, TanStack Table v8, axios, zustand (auth store only)
- **Infra:** Docker Compose (named volumes), GitHub Actions self-hosted runner on itappsdev02, Nginx Proxy Manager handles TLS

> The frontend uses plain controlled components + axios + useState. There is no React Query and no React Hook Form installed.

## Role system (3 tiers)
- **admin** — full access: VMs, credentials, dashboard, users, audit log
- **readwrite** — VM CRUD, credentials, dashboard, RDP, CSV; no users/audit
- **read** — VM list and VM detail only; no credentials, no RDP, no dashboard
- Role hierarchy enforced in `requireRole(minRole)` via numeric levels in `middleware/auth.js`
- Frontend uses `hasMinRole(user, minRole)` from `components/Guards.jsx`

## Key conventions
- All DB queries use better-sqlite3 parameterised statements — never string concatenation
- Passwords never appear in logs or audit detail fields
- Credentials encrypted with AES-256-GCM; key from `CREDENTIAL_ENCRYPTION_KEY` in .env
- Access tokens in localStorage, refresh tokens in HttpOnly cookie (SameSite=Strict)
- All routes validate with zod before touching the DB
- RDP files generated in memory only — never written to disk
- SQLite timestamps are UTC; frontend converts to browser local timezone using `new Date(ts + 'Z')`

## VM form
- `handleSubmit` sanitises all empty strings to `null` before posting — prevents zod validation failures on optional enum/regex fields
- `hasExpiry` checkbox gates the expiry date field; unchecking sets `expiry_date: null`
- Number inputs cast to `Number()` in `handleChange` because zod uses `z.number()` not `z.coerce.number()`

## Credentials
- No separate Credentials page — credentials live in the Edit VM form (`/vms/:id/edit`)
- `account_type` uses `primary` / `others`
- VM list shows `primary_username` via a correlated subquery in `GET /api/vms`
- Three-dot actions menu in VMList uses `createPortal` to escape table `overflow` clipping

## Reachability check
- `GET /api/vms/reachability?ids=1,2,3` — TCP connect, port 22 for Linux, 3389 for others, 2s timeout
- Fetched async after VM list loads; shows coloured dot in Status column with ↺ refresh

## Notifications
- Per-user `notify_expiry` toggle in Users page — no hardcoded `NOTIFY_ADMIN_EMAIL`
- Thresholds: 7d, 1d, expired (30d and 14d removed)
- Scheduler runs daily at 08:00; idempotent via `notification_log` table

## Microsoft Entra ID (SSO)
- `GET /api/auth/microsoft` → Microsoft OAuth2 flow
- `GET /api/auth/microsoft/callback` → validates signed state, looks up user by email, issues VMTrak JWT
- Config: `ENTRA_CLIENT_ID`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI`
- Button only appears on login page; if `ENTRA_CLIENT_ID` unset, endpoint returns 503
- Unknown email → redirect to `/login?ms_error=not_found&ms_admin=<SITE_ADMIN_EMAIL>`

## DB migrations
Auto-applied on startup from `backend/src/db/migrations/` in filename order.
- `001_init.sql` — full initial schema (legacy role values; superseded by 004)
- `002_credential_type.sql` — primary/others enum
- `003_must_change_password.sql` — setup flow flag
- `004_three_roles.sql` — rebuilds users table with admin/readwrite/read CHECK
- `005_notify_expiry.sql` — adds notify_expiry column to users
Migration runner tolerates `duplicate column` errors so a crashed partial migration doesn't block startup.

## Dev servers / deployment
- **Do NOT** run `npm run dev` or `docker compose up/down` locally — DNS/SSL point to itappsdev02
- Push to `dev` branch → GitHub Actions builds and deploys on itappsdev02
- Test credentials and env vars are in `.claude/test-creds.md` (gitignored)
- Test mail: `bash tests/test-mail.sh`

## Testing via curl

Test credentials are in `.claude/test-creds.md`. Read that file first for the current username/password and base URL.

### 1. Get an access token
```bash
TOKEN=$(curl -s -X POST https://vmtrak-dev.internal.indishtech.in/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<password from .claude/test-creds.md>"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo $TOKEN
```

### 2. Health check (no auth)
```bash
curl -s https://vmtrak-dev.internal.indishtech.in/api/health | jq
```

### 3. List VMs
```bash
curl -s https://vmtrak-dev.internal.indishtech.in/api/vms \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

### 4. Get a specific VM
```bash
curl -s https://vmtrak-dev.internal.indishtech.in/api/vms/1 \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 5. Create a VM (readwrite+)
```bash
curl -s -X POST https://vmtrak-dev.internal.indishtech.in/api/vms \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "vm_name": "test-vm-curl",
    "ip_address": "10.0.0.99",
    "os_type": "Linux",
    "environment": "test",
    "status": "active",
    "power_state": "on"
  }' | jq
```

### 6. Delete a VM (readwrite+)
```bash
curl -s -X DELETE https://vmtrak-dev.internal.indishtech.in/api/vms/<id> \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 7. Trigger test notifications (admin)
```bash
curl -s -X POST https://vmtrak-dev.internal.indishtech.in/api/dashboard/test-notifications \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 8. List users (admin)
```bash
curl -s https://vmtrak-dev.internal.indishtech.in/api/users \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 9. Check audit log (admin)
```bash
curl -s "https://vmtrak-dev.internal.indishtech.in/api/audit?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[]|{action,username,created_at}'
```

### 10. Reveal a credential (readwrite+)
```bash
curl -s https://vmtrak-dev.internal.indishtech.in/api/vms/<vm_id>/credentials/<cred_id>/reveal \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Notes on curl testing
- The `-c cookies.txt -b cookies.txt` flags are needed if testing refresh token flow (HttpOnly cookie)
- All write endpoints expect `Content-Type: application/json`
- 401 means token expired — re-run the login command to get a fresh token
- 403 means insufficient role for that endpoint
- Add `-v` to any curl command to see full request/response headers for debugging

## Data persistence
- Docker named volumes (`vm-data`, `vm-logs`) — survives deploys
- Previous bind-mount (`./app_data`) was wiped by `git clean -ffdx` on every CI checkout

## File layout
- `backend/src/routes/vms.js` — includes `/hypervisors`, `/reachability`, `/export`, `/import` before `/:id`
- `backend/src/utils/validators.js` — all zod schemas; role enum is `['admin', 'readwrite', 'read']`
- `frontend/src/components/Guards.jsx` — `hasMinRole()` helper + `RequireAuth/RequireAdmin/RequireReadWrite/RequireSetup`
- `frontend/src/pages/VMList.jsx` — StatusDot, ActionsMenu (portal), hypervisor filter
- `frontend/src/pages/VMForm.jsx` — CredentialsSubCard (edit mode only), expiry checkbox, empty→null sanitiser
- `frontend/src/pages/AuthCallback.jsx` — handles `/auth/callback?token=` from Entra SSO redirect

## Do not
- Suggest ORM replacements (Prisma, Drizzle etc.) — raw SQL is intentional
- Add async wrappers around better-sqlite3 calls
- Store secrets anywhere other than .env
- Add a standalone Credentials page/route
- Add React Query or React Hook Form
- Run `docker compose` commands locally
- Start `npm run dev` locally
