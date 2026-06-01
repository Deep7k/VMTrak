# VMTrak — Claude Code guidance

## What this is
Self-hosted VM inventory app replacing Excel tracking. Node.js/Express backend, React/Vite frontend, SQLite via better-sqlite3, Dockerized.

## Stack
- **Backend:** Express, better-sqlite3 (sync — NO async/await on DB calls), zod, winston, node-cron, nodemailer
- **Frontend:** React 18, Vite, TailwindCSS, TanStack Table v8, axios, zustand (auth store only)
- **Infra:** Docker Compose, Nginx Proxy Manager handles TLS

> The frontend uses plain controlled components + axios + useState. There is no React Query and no React Hook Form installed.

## Key conventions
- All DB queries use better-sqlite3 parameterised statements — never string concatenation
- Passwords never appear in logs or audit detail fields — enforce this strictly
- Credentials encrypted with AES-256-GCM; key from `CREDENTIAL_ENCRYPTION_KEY` in .env
- Access tokens in localStorage, refresh tokens in HttpOnly cookie
- All routes validate with zod before touching the DB
- RDP files generated in memory only — never written to disk

## Frontend number inputs
`handleChange` in VMForm casts `type="number"` inputs to `Number()` before storing in state.
Required because zod uses `z.number()` (not `z.coerce.number()`) and HTML inputs always yield strings.

## Credentials
- No separate Credentials page or sidebar item — credentials live in the Edit VM form (`/vms/:id/edit`)
- `account_type` uses `primary` / `others` (changed from `admin`/`user`/`service` in migration 002)
- VM list shows `primary_username` via a correlated subquery in `GET /api/vms`
- Three-dot actions menu in VMList uses `createPortal` (renders into `document.body`) — needed to escape the table's `overflow` container

## DB migrations
Auto-applied on startup from `backend/src/db/migrations/` in filename order.
- `001_init.sql` — full initial schema
- `002_credential_type.sql` — recreates vm_credentials with primary/others enum
After any migration that uses `PRAGMA foreign_keys = OFF`, `initDb()` re-enables it explicitly.

## Dev servers
- Backend: run from `/home/itadmin/VMTrak/backend` — `npm run dev` (port 3001)
- Frontend: run from `/home/itadmin/VMTrak/frontend` — `npm run dev` (port 5173)
- `backend/frontend.RETIRED/` and `backend/frontend.bak/` are dead directories — do not run anything from them

## File layout
- `backend/src/routes/vms.js` — GET /api/vms includes primary_username correlated subquery
- `backend/src/utils/validators.js` — all zod schemas; account_type enum is `['primary', 'others']`
- `frontend/src/pages/VMList.jsx` — ActionsMenu component uses createPortal for overflow-safe dropdown
- `frontend/src/pages/VMForm.jsx` — CredentialsSubCard component shown in edit mode only
- `frontend/src/components/CredentialPanel.jsx` — used in VMDetail for reveal/copy (read-only)
- `frontend/src/router.jsx` — no /credentials route; sidebar has no Credentials item

## Do not
- Suggest ORM replacements (Prisma, Drizzle etc.) — raw SQL is intentional
- Add async wrappers around better-sqlite3 calls
- Store secrets anywhere other than .env
- Add a standalone Credentials page/route — credentials live in the Edit VM view
- Add React Query or React Hook Form — keep it plain axios + useState
- Run `docker compose up`, `docker compose down`, `docker compose restart`, or any other docker compose command that starts/stops containers — deployment is handled by the GitHub Actions self-hosted runner on itappsdev02; running these locally creates containers on the wrong host (itappsdev01)
- Start dev servers (`npm run dev`) or attempt browser-based verification locally — DNS and SSL point to itappsdev02 so local testing is meaningless; just write the code, commit, and push to `dev` and let the pipeline deploy it

## Testing / verification
After pushing to `dev` and waiting for the pipeline to deploy, test via curl against the live dev instance at `https://vmtrak-dev.internal.indishtech.in/`. Credentials are in `.claude/test-creds.md` (local only, gitignored).
