# VMTrak — Deployment & Release Guide

## Environments

| Environment | URL | Branch | Server | How it deploys |
|---|---|---|---|---|
| Dev | `https://vmtrak-dev.internal.indishtech.in` | `dev` | itappsdev02 | Auto on every push to `dev` |
| Production | `https://vmtrak.internal.indishtech.in` | `main` + tag | Separate host | Pull `:latest` from GHCR, redeploy manually |

**Dev** is the live working environment — every push to `dev` auto-deploys via GitHub Actions.

**Production** pulls versioned Docker images from GHCR. Deploying to prod means pulling `:latest` (or a specific version tag) and restarting the containers.

---

## Architecture

```
Internet / Internal network
        │
        ▼
[Nginx Proxy Manager — TLS termination]  (itappsdev02 for dev, separate host for prod)
        │
        ├──▶  /        →  vmtrak-frontend  (host port 3000 → nginx:80)
        └──▶  /api/*   →  vmtrak-backend   (internal → express:3001)
                                │
                                ├── vm-data  (Docker named volume → /app/data/inventory.db)
                                └── vm-logs  (Docker named volume → /app/logs/)
```

Both containers run on a private Docker bridge network (`vmtrak-net`). Only the frontend port 3000 is exposed to Nginx — the backend is not directly reachable from outside the Docker network.

### Containers

| Container | Image | Built from | Port |
|---|---|---|---|
| `vmtrak-frontend` | `ghcr.io/deep7k/vmtrak-frontend` | `./frontend` (Vite → Nginx Alpine) | 3000:80 |
| `vmtrak-backend` | `ghcr.io/deep7k/vmtrak-backend` | `./backend` (Node 20 Alpine) | internal only |

### Data persistence

| Volume | Mount | Contents |
|---|---|---|
| `vm-data` | `/app/data` | `inventory.db` (SQLite) + WAL files |
| `vm-logs` | `/app/logs` | `audit.log` + rotated archives |

Named volumes survive rebuilds, `docker compose up -d --remove-orphans`, and `git clean`. They are never touched by CI.

---

## Pipelines

### `deploy-dev.yml` — triggers on push to `dev`

1. Checkout code on itappsdev02 (self-hosted runner)
2. Write `backend/.env` from `BACKEND_ENV` GitHub secret
3. `docker compose build` — injects `VITE_APP_VERSION=dev-<git-sha>` (e.g. `dev-d19014b`)
4. `docker compose up -d --remove-orphans`
5. Poll `http://localhost:3000/api/health` (12 × 5s) — fails the run if unhealthy

### `release.yml` — triggers on version tag push only (`v*.*.*`)

1. Read version from root `package.json` using `python3` (Node is not in PATH on the runner)
2. Build backend + frontend Docker images
3. Push to GHCR with tags: `:1.2.3`, `:1.2`, `:latest`, `:sha-xxxxxxx` — all pointing to the same image
4. Create GitHub Release with auto-generated changelog

> **Important:** Push to `main` does **not** trigger any pipeline. Only the tag triggers `release.yml`. This prevents double-builds where `:latest` would point to the merge commit instead of the versioned image.

---

## Versioning

Single source of truth: **root `package.json`** `version` field.

When you run `npm version`, a lifecycle script automatically syncs `backend/package.json` and `frontend/package.json` to match, then commits all three and creates the git tag in one atomic step.

- Dev builds show `dev-<sha>` in the sidebar (e.g. `dev-d19014b`)
- Release builds show `v1.2.3` in the sidebar and health endpoint

### Version bump rules

| What changed | Command | Example result |
|---|---|---|
| New feature, new page, new API endpoint | `npm version minor` | `1.2.3 → 1.3.0` |
| Bug fix, security patch, small UI tweak | `npm version patch` | `1.2.3 → 1.2.4` |
| Breaking change (DB migration, removed endpoint) | `npm version major` | `1.2.3 → 2.0.0` |

---

## Day-to-day: making and deploying changes to dev

```bash
# 1. Make your changes on dev branch
git add <files>
git commit -m "describe what changed"

# 2. Push to dev — auto-deploys to itappsdev02
git push origin dev

# 3. Verify at https://vmtrak-dev.internal.indishtech.in
curl -s https://vmtrak-dev.internal.indishtech.in/api/health | jq
# → { "status": "ok", "version": "1.2.3", "uptime": 42 }
```

No version bump needed for day-to-day work. The sidebar shows `dev-<sha>`.

---

## Cutting a release

Run these from the `dev` branch after verifying the change works on dev.

```bash
# 1. Bump version (choose one based on change type above)
npm version patch

# npm version does all of the following automatically:
#   - Updates root / backend / frontend package.json to the new version
#   - Commits the three files with message "vX.Y.Z"
#   - Creates git tag vX.Y.Z locally

# 2. Push dev branch AND the new tag together
git push origin dev --follow-tags

# 3. Merge to main
git checkout main
git merge dev
git push origin main
git checkout dev
```

**After step 2, two pipelines fire:**
- `deploy-dev.yml` → redeploys dev with the new version
- `release.yml` → builds GHCR images tagged `:X.Y.Z` + `:latest` → creates GitHub Release

**After step 3:** nothing fires (main push has no pipeline trigger).

---

## Deploying a release to production

Production runs Docker containers that pull images from GHCR. After a release pipeline completes:

```bash
# On the production host:

# Pull the latest images
docker pull ghcr.io/deep7k/vmtrak-backend:latest
docker pull ghcr.io/deep7k/vmtrak-frontend:latest

# Restart containers (assumes docker-compose.yml is present on the host)
docker compose up -d --remove-orphans

# Verify
curl -s https://vmtrak.internal.indishtech.in/api/health | jq
# → { "status": "ok", "version": "1.2.3", "uptime": ... }
```

To deploy a specific version instead of latest:
```bash
docker pull ghcr.io/deep7k/vmtrak-backend:1.2.3
docker pull ghcr.io/deep7k/vmtrak-frontend:1.2.3
# Update image tags in docker-compose.yml or use docker compose with IMAGE env vars
```

---

## Checking what's running

```bash
# Version + health check
curl -s https://vmtrak-dev.internal.indishtech.in/api/health | jq

# Container status
docker ps --filter name=vmtrak

# Live backend logs
docker logs vmtrak-backend --tail=50 -f

# Live frontend logs
docker logs vmtrak-frontend --tail=20

# Audit log file
docker exec vmtrak-backend tail -f /app/logs/audit.log
```

---

## Manual deploy on dev (if CI fails)

SSH into itappsdev02 and run from the repo checkout directory:

```bash
# Write .env manually if needed
nano backend/.env

# Rebuild and restart
VITE_APP_VERSION=dev-$(git rev-parse --short HEAD) docker compose build
docker compose up -d --remove-orphans

# Verify
curl -s http://localhost:3000/api/health | jq
```

---

## GHCR images

Published to `ghcr.io/deep7k/` on every version tag push.

| Tag | Meaning |
|---|---|
| `:latest` | Most recent release |
| `:1.2.3` | Exact version |
| `:1.2` | Latest patch of that minor |
| `:sha-d19014b` | Exact commit |

```bash
docker pull ghcr.io/deep7k/vmtrak-backend:latest
docker pull ghcr.io/deep7k/vmtrak-frontend:latest
```

Images are public — no authentication needed to pull.

---

## Secrets

| Secret | Where | Used for |
|---|---|---|
| `BACKEND_ENV` | GitHub → Settings → Secrets → Actions → Environments → dev | Full `backend/.env` written by CI before every dev build |
| `GITHUB_TOKEN` | Auto-provided by Actions | Push images to GHCR, create GitHub Releases |

To update backend config on dev: update `BACKEND_ENV` in GitHub → push anything to `dev` to trigger a redeploy.

---

## Known constraints

- `node` is **not** in the PATH on the self-hosted Actions runner. The `release.yml` version-read step uses `python3` for this reason. Do not add `node` commands to CI steps without first confirming it is available.
- The self-hosted runner is `itappsdev02` — the same server that runs the dev containers. A slow build can cause the health check to race against an in-progress restart.
- Docker named volumes (`vm-data`, `vm-logs`) are shared between the current running container and the newly deployed one during `--remove-orphans`. SQLite WAL mode handles this safely.
