# VMTrak Frontend

Industrial/utilitarian VM management interface built with Vite, React, and Tailwind CSS.

## Development

```bash
npm install
npm run dev
```

Server runs on `http://localhost:5173` with proxy to backend at `http://localhost:3001/api`.

## Build

```bash
npm run build
npm run preview
```

## Architecture

- **src/pages/** — Full-page components (Login, etc.)
- **src/components/** — Reusable UI components (AppShell, Sidebar, Header)
- **src/hooks/** — Custom React hooks (useAuth)
- **src/store/** — Zustand state management (authStore)
- **src/api/** — Axios client with JWT interceptors
- **src/index.css** — Tailwind + industrial theme utilities

## Auth Flow

1. **Login** — POST `/api/auth/login` → JWT token stored in localStorage
2. **Request** — All API requests include `Authorization: Bearer <token>`
3. **Refresh** — On 401, automatically refresh token via `/api/auth/refresh`
4. **Logout** — Clear token, POST `/api/auth/logout`

## Theme

Dark slate palette with emerald accents. Monospaced typography. Status indicators for infrastructure feel.

Utilities: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.input-base`, `.status-badge`, `.card-base`
