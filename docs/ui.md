# VMTrak — UI Design System

## Overview

VMTrak uses a custom dark-glass design language built on top of TailwindCSS. All visual tokens are defined in `frontend/src/index.css` as CSS custom properties, with Tailwind utility classes layered on top.

---

## Design Language

The aesthetic is **dark glass**: deep near-black backgrounds, subtle translucent card surfaces, muted borders, and a single teal brand accent. The goal is a dense-data interface that feels like an internal tooling dashboard — not a marketing site.

Key principles:
- High information density (tables, not cards, for VM lists)
- Low visual noise (borders at 7% white opacity, not solid lines)
- Single accent color (`#1d9e75`) used sparingly
- Monospace fonts only where data is being displayed (IPs, credentials)

---

## Color Palette

All colors are defined as CSS custom properties in `frontend/src/index.css`:

```css
:root {
  --bg-primary:   #0a0c10;          /* Page background — near-black */
  --bg-card:      rgba(255,255,255,0.04);  /* Card/panel surfaces */
  --bg-hover:     rgba(255,255,255,0.06);  /* Row hover, menu hover */
  --border:       rgba(255,255,255,0.07);  /* All borders */
  --brand:        #1d9e75;          /* Teal — buttons, active links, badges */
  --brand-hover:  #18876a;          /* Darker teal on hover */
  --text-primary: #e8e8e8;          /* Main body text */
  --text-muted:   #888;             /* Secondary text, labels */
  --danger:       #e87878;          /* Error states, delete buttons */
  --danger-hover: #d46060;
  --warning:      #f59e0b;          /* 7-day expiry badge */
  --critical:     #ef4444;          /* Expired / 1-day badge */
  --success:      #22c55e;          /* Reachability dot (online) */
  --offline:      #ef4444;          /* Reachability dot (unreachable) */
  --unknown:      #6b7280;          /* Reachability dot (unchecked) */
}
```

---

## Typography

### Fonts

```css
body {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont,
               'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
}
```

`Inter` is loaded from the system where available; the fallback chain covers macOS, Windows, and Linux without a network request.

For data fields (IPs, credentials, IDs, code), monospace is used:
```css
.input-base, td.mono, .credential-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
               'Liberation Mono', 'Courier New', monospace;
}
```

### Scale

| Usage              | Size     | Weight   |
|--------------------|----------|----------|
| Page headings      | 1.125rem | 600      |
| Section headings   | 0.875rem | 600      |
| Body / table rows  | 0.875rem | 400      |
| Muted labels       | 0.75rem  | 400      |

---

## Component Classes

These utility classes are defined in `frontend/src/index.css` (not Tailwind components) so they work everywhere without `@apply` conflicts.

### Cards

```css
.card-base {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
}
```

### Inputs

```css
.input-base {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  color: var(--text-primary);
  padding: 0.5rem 0.75rem;
  font-family: ui-monospace, ...;  /* monospace for data fields */
  width: 100%;
}
.input-base:focus {
  outline: none;
  border-color: var(--brand);
}
```

### Buttons

```css
.btn-primary   { background: var(--brand); color: #fff; border-radius: 0.375rem; }
.btn-secondary { background: rgba(255,255,255,0.08); color: var(--text-primary); }
.btn-danger    { background: var(--danger); color: #fff; }
```

All buttons use `cursor: pointer` and a subtle opacity change on hover.

### Modal

```css
.glass-modal {
  background: #131720;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  box-shadow: 0 25px 50px rgba(0,0,0,0.6);
}
```

---

## Icons

Icons are from **Tabler Icons** (`@tabler/icons-webfont`), loaded locally (no CDN):

```html
<i class="ti ti-server"></i>       <!-- server/VM -->
<i class="ti ti-shield-lock"></i>  <!-- credentials -->
<i class="ti ti-users"></i>        <!-- users -->
<i class="ti ti-chart-bar"></i>    <!-- dashboard -->
<i class="ti ti-clipboard-list"></i> <!-- audit -->
```

The webfont is imported once in `index.css`. Icons are sized with `font-size` in the relevant component.

---

## Layout

### AppShell

`frontend/src/components/AppShell.jsx` is the top-level layout wrapper for all authenticated pages:

```
┌──────────────────────────────────────────────────────┐
│ Sidebar (fixed, 220px wide)  │  Main content area    │
│                              │  ┌──────────────────┐ │
│  [V] VMTrak                  │  │ Header (h-14)    │ │
│                              │  ├──────────────────┤ │
│  ● Dashboard                 │  │                  │ │
│  ● VMs                       │  │   <Outlet />     │ │
│  ─────────────────           │  │                  │ │
│  ● Users    (admin)          │  │                  │ │
│  ● Audit    (admin)          │  └──────────────────┘ │
│                              │                       │
│  [username]  [logout]        │                       │
└──────────────────────────────────────────────────────┘
```

- Sidebar width: `220px`, fixed position, full viewport height
- Main area: `margin-left: 220px`, scrolls independently
- Header: fixed top, `height: 56px`, shows current page name + user badge

### Sidebar

`frontend/src/components/Sidebar.jsx`

- Navigation links filtered by role: `hasMinRole(user, 'admin')` controls visibility of Users and Audit links
- Active link highlighted with `var(--brand)` left border + background
- Logo: custom SVG server-rack icon (`public/favicon.svg`) above "VMTrak" text

### VM List Table

Built with **TanStack Table v8** (`@tanstack/react-table`).

Columns: Status · VM Name · IP Address · Hypervisor · Environment · Username · Actions

- **Status dot** — coloured circle showing TCP reachability (green/red/grey)
- **Actions menu** — three-dot button that opens a dropdown using `createPortal` to escape the table's `overflow: hidden` container
- Pagination: 25 rows per page default, controls at bottom

Filters: Search (VM name / IP), Environment dropdown, Status dropdown, Hypervisor dropdown, Power State dropdown.

---

## State Management

| Layer         | Tool     | What it manages                             |
|---------------|----------|---------------------------------------------|
| Auth          | Zustand  | `user`, `token`, `isAuthenticated`          |
| Everything else | useState | Local component state (forms, tables, modals) |

There is **no React Query** and **no React Hook Form**. All API calls are plain `axios` calls in `useEffect` or event handlers. Form state is plain `useState` with controlled inputs.

---

## Reachability Dots

The status dot in the VM list is purely cosmetic — it does not block or gate any action.

Implementation:
1. `VMList` loads, renders table with all dots in "unknown" (grey) state
2. `useEffect` fires after first render, calls `GET /api/vms/reachability?ids=1,2,3...`
3. Backend does parallel TCP connects (port 3389 for Windows, port 22 for Linux), 2s timeout each
4. Response: `{ 1: true, 2: false, 3: null, ... }` — true/false/null
5. Component updates dot color: green (true), red (false), grey (null/unknown)
6. A ↺ refresh button re-triggers the reachability call

---

## Tailwind Config

`frontend/tailwind.config.js` — standard config, content scanning `src/**/*.{js,jsx}`. No custom theme extensions — all custom tokens are in `index.css` as CSS custom properties. Tailwind is used for spacing, flexbox, grid, and responsive utilities.

---

## Favicon

`frontend/public/favicon.svg` — an SVG server-rack icon. It doubles as the sidebar logo. The SVG uses the brand teal (`#1d9e75`) as the primary fill color.
