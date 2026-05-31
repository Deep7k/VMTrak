# VMTrak

## What this is
Self-hosted VM inventory app replacing Excel tracking. Node.js/Express backend, React/Vite frontend, SQLite via better-sqlite3, Dockerized.

## Stack
- Backend: Express, better-sqlite3 (sync — NO async/await on DB calls), zod, winston, node-cron, nodemailer
- Frontend: React 18, Vite, TailwindCSS, TanStack Table v8, TanStack Query, React Hook Form, axios
- Infra: Docker Compose, Nginx Proxy Manager handles TLS

## Key conventions
- All DB queries use better-sqlite3 parameterised statements — never string concatenation
- Passwords never appear in logs or audit detail fields — enforce this strictly
- Credentials encrypted with AES-256-GCM; key comes from CREDENTIAL_ENCRYPTION_KEY in .env
- Access tokens in memory only, refresh tokens in HttpOnly cookie — do not suggest localStorage
- All routes validate with zod before touching the DB
- RDP files generated in memory only — never written to disk

## File layout
- backend/src/routes/ — one file per resource
- backend/src/services/ — encryption.js, rdp.js, email.js, scheduler.js
- frontend/src/ — api/, components/, hooks/, pages/, store/, utils/

## Do not
- Suggest ORM replacements (Prisma, Drizzle etc.) — raw SQL is intentional
- Add async wrappers around better-sqlite3 calls
- Store secrets anywhere other than .env