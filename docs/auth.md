# VMTrak — Authentication & Authorization

## Two Auth Methods

VMTrak supports two independent login paths that both produce the same JWT + refresh-cookie session:

| Method               | Entry point                     | Who uses it                  |
|----------------------|---------------------------------|------------------------------|
| Local credentials    | `POST /api/auth/login`          | All local accounts           |
| Microsoft Entra SSO  | `GET /api/auth/microsoft`       | Org accounts (Azure AD)      |

---

## Local Authentication

### Login flow

```
POST /api/auth/login
  body: { username, password }

1. Fetch user row WHERE username = ? AND is_active = 1
2. bcrypt.compare(password, password_hash)  — cost factor 12
3. Check must_change_password flag
   → if set: return { must_change_password: true } (frontend redirects to /setup)
4. Issue access token (JWT, 15m, stored localStorage)
5. Issue refresh token (32-byte hex, SHA-256 hashed in DB, 7d, HttpOnly cookie)
6. Write audit log: auth.login
```

### Refresh flow

```
POST /api/auth/refresh  (no body — reads HttpOnly cookie)

1. Read refresh token from cookie
2. Hash it (SHA-256), look up in refresh_tokens WHERE token_hash = ? AND expires_at > now()
3. Delete old row (rotation — each token is single-use)
4. Issue new access token + new refresh token
5. Set new cookie
```

If this endpoint returns 401, the frontend interceptor redirects to `/login`.

### Logout

```
POST /api/auth/logout

1. Hash cookie value, DELETE from refresh_tokens
2. Clear cookie (Set-Cookie with expired date)
3. Audit: auth.logout
```

### First-login setup (`must_change_password`)

When an admin creates a new user, `must_change_password = 1`. On next login the backend returns `{ must_change_password: true }` alongside a short-lived token scoped only to `/api/auth/complete-setup`. The frontend `RequireSetup` guard intercepts this and redirects to `/setup`.

```
POST /api/auth/complete-setup
  body: { email, newPassword }

→ Updates users SET email = ?, password_hash = bcrypt(newPassword), must_change_password = 0
→ Then issues full access + refresh tokens
```

---

## Token Details

### Access token (JWT)

```
Header: { alg: "HS256" }
Payload: {
  sub: <user_id>,
  username: "...",
  role: "admin" | "readwrite" | "read",
  iat, exp  (15 minutes)
}
Signed with: JWT_ACCESS_SECRET (64-char hex from .env)
Stored in: localStorage (key: "vmtrak_token")
```

### Refresh token

```
Value:    crypto.randomBytes(32).toString('hex')  (never stored in plaintext)
DB:       SHA-256 hash stored in refresh_tokens table
Cookie:   HttpOnly, Secure, SameSite=Strict, Path=/api/auth/refresh
Expiry:   7 days (configurable via REFRESH_TOKEN_EXPIRY env var)
Rotation: every use issues a new token, old hash deleted immediately
```

---

## Microsoft Entra ID (Azure AD) SSO

### Prerequisites

In Azure Portal, register an app with:
- Redirect URI: `https://<your-domain>/api/auth/microsoft/callback`
- API permissions: `openid`, `email`, `profile` (delegated)

Set in `.env`:
```
ENTRA_CLIENT_ID=<application-client-id>
ENTRA_TENANT_ID=<directory-tenant-id>
ENTRA_CLIENT_SECRET=<client-secret-value>
ENTRA_REDIRECT_URI=https://<your-domain>/api/auth/microsoft/callback
SITE_ADMIN_EMAIL=<admin@yourdomain.com>
```

If `ENTRA_CLIENT_ID` is not set, the "Sign in with Microsoft" button is hidden and the `/api/auth/microsoft` endpoint returns 503.

### OAuth2 Authorization Code Flow

```
1. User clicks "Sign in with Microsoft"
   Browser → GET /api/auth/microsoft

2. Backend:
   a. Signs a state JWT (payload: { nonce }, exp: 5 min, key: JWT_ACCESS_SECRET)
   b. Builds MSAL authorization URL with state=<signed_jwt>
   c. Redirects browser to login.microsoftonline.com

3. User authenticates with Microsoft, consents to scopes
   Microsoft → GET /api/auth/microsoft/callback?code=...&state=...

4. Backend:
   a. Verifies state JWT signature (prevents CSRF)
   b. Exchanges code for tokens via MSAL acquireTokenByCode()
   c. Extracts email from ID token claims (case-insensitive)
   d. SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND is_active = 1
   e. Issues VMTrak access token + refresh cookie (same as local login)
   f. Redirects browser to /auth/callback?token=<access_token>

5. Frontend AuthCallback.jsx:
   a. Reads ?token= from URL
   b. Stores in localStorage
   c. Loads /api/auth/me to hydrate Zustand store
   d. Navigates to /vms
```

### Error cases

| Condition                          | Response                                                               |
|------------------------------------|------------------------------------------------------------------------|
| Email not in VMTrak users table    | Redirect to `/login?ms_error=not_found&ms_admin=<SITE_ADMIN_EMAIL>`   |
| User account is inactive           | Redirect to `/login?ms_error=not_found`                               |
| State JWT invalid/expired          | Redirect to `/login?ms_error=state_invalid`                           |
| MSAL token exchange fails          | Redirect to `/login?ms_error=token_failed`                            |

The Login page reads these query params and shows a contextual error message. When `ms_error=not_found` appears, it also displays a "Contact: <ms_admin email>" hint so the user knows who to ask for access.

---

## Authorization: Role System

### Roles

| Role        | Level | Can do                                                                 |
|-------------|-------|------------------------------------------------------------------------|
| `admin`     | 3     | Everything: VMs, credentials, dashboard, users, audit log              |
| `readwrite` | 2     | VMs CRUD, credentials, dashboard, RDP, CSV export/import               |
| `read`      | 1     | VM list and VM detail only                                             |

### Backend enforcement

`backend/src/middleware/auth.js` exports:

```js
requireAuth        // verifies JWT, attaches req.user
requireRole(min)   // checks roleLevel[req.user.role] >= roleLevel[min]
```

Route example:
```js
router.post('/vms', requireAuth, requireRole('readwrite'), handler)
router.get('/users', requireAuth, requireRole('admin'), handler)
```

### Frontend enforcement

`frontend/src/components/Guards.jsx` exports:

```js
hasMinRole(user, minRole)  // boolean helper

// Route wrappers (used in router.jsx):
RequireAuth        // redirects to /login if not authenticated
RequireReadWrite   // redirects to /vms if role < readwrite
RequireAdmin       // redirects to /vms if role < admin
RequireSetup       // redirects to /setup if must_change_password is true
```

UI elements (buttons, sidebar links, panels) also use `hasMinRole` directly to hide/show based on role.

---

## Brute-Force Protection

`express-rate-limit` applied specifically to `POST /api/auth/login`:

- Window: 15 minutes
- Max attempts: 20 per IP
- On limit: 429 response with `Retry-After` header

---

## Security Notes

- Access tokens are **never** sent to the database — they're stateless JWTs
- Refresh tokens are **hashed** (SHA-256) before DB storage — a DB leak doesn't expose live sessions
- Cookie flags prevent JavaScript access (`HttpOnly`) and cross-origin submission (`SameSite=Strict`)
- Entra state parameter is signed (not just random) so it cannot be forged without knowing `JWT_ACCESS_SECRET`
- `must_change_password` tokens are short-lived and the route validates the flag before accepting the password change

See [security.md](security.md) for the full threat model.
