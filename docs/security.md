# VMTrak — Security Model

## Threat Model Summary

VMTrak stores internal infrastructure metadata including VM credentials encrypted at rest. The primary threats are:
- Unauthorized access to VM inventory or credentials (insider + external)
- Credential leakage via logs, exports, or API responses
- Session hijacking or token theft
- Injection attacks (SQL, CSV formula, XSS)
- CSRF on the SSO redirect flow

---

## Authentication Security

### Password storage
- **Algorithm:** bcrypt with cost factor 12
- Passwords are never stored in plaintext or logged anywhere
- Audit log `detail` fields explicitly exclude password values

### JWT access tokens
- Short-lived: **15 minutes**
- Signed with `JWT_ACCESS_SECRET` (64-char hex = 32 bytes of entropy)
- Stored in `localStorage` (not cookies, to avoid CSRF on API calls)
- Verified on every request in `middleware/auth.js`

### Refresh tokens
- Generated as `crypto.randomBytes(32).toString('hex')`
- **Never stored in plaintext** — only the SHA-256 hash is in the DB
- Delivered via `HttpOnly; Secure; SameSite=Strict` cookie
- Single-use: rotated on every `/refresh` call (old hash deleted immediately)
- Invalidated on logout (row deleted from `refresh_tokens`)
- A stolen DB dump does not expose live refresh tokens

### Brute force protection
- `express-rate-limit` on `POST /api/auth/login`
- 20 failed attempts per IP per 15-minute window
- Returns 429 with `Retry-After` header

### Microsoft Entra SSO CSRF protection
- The OAuth2 `state` parameter is a **signed JWT** (not a random nonce)
- Signed with `JWT_ACCESS_SECRET`, 5-minute TTL
- If the state signature is invalid or expired, the callback returns an error
- A passive network observer who captures the redirect URL cannot reuse the state in a different session

---

## Credential Encryption

File: `backend/src/services/encryption.js`

### Algorithm
**AES-256-GCM** (authenticated encryption — provides both confidentiality and integrity)

### Key management
- Key: `CREDENTIAL_ENCRYPTION_KEY` env var — 64-char hex (32 bytes)
- **Never stored in the database**
- Key is only in `.env` (git-ignored) and the `BACKEND_ENV` GitHub secret

### Per-credential storage

Each credential row in `vm_credentials` stores:
```
password_enc  — AES-256-GCM ciphertext (hex)
password_iv   — 12-byte random IV (hex), unique per credential
password_tag  — 16-byte GCM authentication tag (hex)
```

The IV is randomly generated on every encrypt call. Two credentials with the same password produce different ciphertext.

### Decryption
- Only happens in memory, inside `GET /api/vms/:id/credentials/:cid/reveal`
- Plaintext is never written to disk, logs, DB, or included in any other response
- The `credentials` list endpoint returns username + metadata only — never passwords

### Key rotation
There is no automated key rotation. To rotate: decrypt all credentials with the old key, re-encrypt with the new key, update `.env`. This is a manual operation. Consider scripting it if rotation frequency is required.

---

## Input Validation

All request bodies are validated with **Zod** schemas before any DB operation.

Files: `backend/src/utils/validators.js`

Validation covers:
- Type checking (string, number, enum, date format)
- Required vs optional fields
- Enum values for `role`, `os_type`, `power_state`, `environment`, `status`, `account_type`
- String length limits
- IP address format (loose regex — accepts IPv4 and hostnames)

Zod errors are caught by the global error handler and returned as 400 with field-level detail.

---

## SQL Injection Prevention

- All queries use `better-sqlite3` **parameterised statements** — no string concatenation
- Dynamic `ORDER BY` columns are validated against a hardcoded whitelist before use:
  ```js
  const ALLOWED_SORT_COLS = ['vm_name', 'ip_address', 'environment', 'status', ...];
  if (!ALLOWED_SORT_COLS.includes(sortCol)) throw new Error('invalid sort');
  ```
- There is no ORM escape layer — raw SQL is used throughout, which makes it easier to audit

---

## CSV Formula Injection Prevention

`GET /api/vms/export` generates a CSV file. Cells that start with `=`, `+`, `-`, or `@` are prefixed with a single quote `'` before writing. This prevents Excel/Sheets from interpreting cell values as formulas when a user opens the file.

---

## HTTP Security Headers

Configured via **Helmet** in `backend/src/index.js`:

| Header                   | Value                                              |
|--------------------------|----------------------------------------------------|
| `Content-Security-Policy` | Default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' |
| `X-Frame-Options`         | `SAMEORIGIN`                                       |
| `X-Content-Type-Options`  | `nosniff`                                          |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`                  |
| `Strict-Transport-Security` | Set by Nginx Proxy Manager at the edge           |

---

## CORS

```js
cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,  // allows cookies
})
```

The backend only accepts requests from `FRONTEND_URL`. Any other origin gets a CORS rejection. `credentials: true` is required for the refresh token cookie.

---

## Audit Logging

Every state-changing and sensitive read operation writes to both:
1. `audit_logs` SQLite table (queryable via `/api/audit`)
2. Winston structured JSON log file (`/app/logs/audit.log`)

### Logged events

| Action                 | Entity type   |
|------------------------|---------------|
| `auth.login`           | auth          |
| `auth.logout`          | auth          |
| `auth.refresh`         | auth          |
| `vm.create`            | vm            |
| `vm.update`            | vm            |
| `vm.delete`            | vm            |
| `vm.export`            | vm            |
| `vm.import`            | vm            |
| `credential.create`    | credential    |
| `credential.update`    | credential    |
| `credential.delete`    | credential    |
| `credential.reveal`    | credential    |
| `rdp.download`         | vm            |
| `user.create`          | user          |
| `user.update`          | user          |
| `user.delete`          | user          |
| `user.reset_password`  | user          |
| `notification.sent`    | vm            |

### Audit record structure

```json
{
  "user_id": 1,
  "username": "admin",
  "action": "credential.reveal",
  "entity_type": "credential",
  "entity_id": 42,
  "entity_name": "administrator @ web-server-01",
  "detail": { "vm_name": "web-server-01" },
  "ip_address": "10.0.0.5",
  "created_at": "2026-06-04T08:32:11.000Z"
}
```

Passwords are **never included** in `detail`.

### Log rotation

Winston rotates logs at 10 MB per file, keeping up to 5 files. Old files are compressed.

---

## TLS

TLS is terminated at **Nginx Proxy Manager** (not inside the containers). The Docker containers communicate over a private bridge network without TLS. This is standard practice for containerised apps behind a reverse proxy.

NPM manages certificate issuance (Let's Encrypt or uploaded cert) and renewal.

---

## Secrets Management

| Secret                         | Storage                                     |
|--------------------------------|---------------------------------------------|
| `JWT_ACCESS_SECRET`            | `.env` (gitignored) + `BACKEND_ENV` GitHub secret |
| `JWT_REFRESH_SECRET`           | Same                                        |
| `CREDENTIAL_ENCRYPTION_KEY`    | Same                                        |
| `ENTRA_CLIENT_SECRET`          | Same                                        |
| Test credentials               | `.claude/test-creds.md` (gitignored)        |

`.env` is in `.gitignore`. The CI/CD pipeline writes `.env` from the `BACKEND_ENV` GitHub secret before building — the actual values never appear in the repository.

---

## Database Schema (Security-relevant tables)

```sql
-- Hashed refresh tokens (never plaintext)
CREATE TABLE refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Encrypted credential storage
CREATE TABLE vm_credentials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  vm_id         INTEGER NOT NULL REFERENCES vms(id) ON DELETE CASCADE,
  username      TEXT NOT NULL,
  password_enc  TEXT,    -- AES-256-GCM ciphertext
  password_iv   TEXT,    -- 12-byte IV (hex)
  password_tag  TEXT,    -- 16-byte GCM auth tag (hex)
  account_type  TEXT NOT NULL CHECK(account_type IN ('primary','others')),
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vm_id, username)
);
```

---

## Known Limitations / Future Work

| Gap                          | Notes                                                      |
|------------------------------|------------------------------------------------------------|
| No 2FA on credential reveal  | TOTP gate for reveal endpoint is in the v2 roadmap         |
| No encryption key rotation   | Manual process; no automated rotation tooling              |
| Access tokens in localStorage | Vulnerable to XSS (mitigated by CSP + no eval); cookies would require CSRF token |
| No IP allowlisting           | Rate limiting only; no per-user IP restriction             |
