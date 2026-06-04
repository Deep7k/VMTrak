# VMTrak — Deployment & Release Guide

## Environments

| Environment | URL | Branch | Server | How it deploys |
|---|---|---|---|---|
| Dev | `https://vmtrak-dev.internal.indishtech.in` | `dev` | itappsdev02 | Auto on every push to `dev` |
| Production | _(future)_ | `main` + tag | TBD | Pull GHCR image manually |

There is currently one live environment: **dev**, running on `itappsdev02`. The `main` branch is the stable/release branch — it is not auto-deployed anywhere. Releases publish versioned Docker images to GHCR for future production use.

---

## Architecture

```
Internet / Internal network
        │
        ▼
[Nginx Proxy Manager — TLS termination]  (itappsdev02, port 443)
        │
        ├──▶  /        →  vmtrak-frontend  (host port 3000 → nginx:80)
        └──▶  /api/*   →  vmtrak-backend   (host port 3001 → express:3001)
                                │
                                ├── vm-data  (Docker named volume → /app/data/inventory.db)
                                └── vm-logs  (Docker named volume → /app/logs/)
```

Both containers run on a private Docker bridge network (`vmtrak-net`). Only the frontend port 3000 is exposed to Nginx — the backend is not directly reachable from outside the Docker network.

### Containers

| Container | Image | Built from | Port |
|---|---|---|---|
| `vmtrak-frontend` | Built on runner | `./frontend` (Vite → Nginx Alpine) | 3000:80 |
| `vmtrak-backend` | Built on runner | `./backend` (Node 20 Alpine) | internal only |

### Data persistence

| Volume | Mount | Contents |
|---|---|---|
| `vm-data` | `/app/data` | `inventory.db` (SQLite) + WAL files |
| `vm-logs` | `/app/logs` | `audit.log` + rotated archives |

Named volumes survive `docker compose up -d --remove-orphans`, rebuilds, and `git clean`. They are **never** touched by CI.

---

## Pipelines

### `deploy-dev.yml` — triggers on push to `dev`

1. Checkout code on itappsdev02 (self-hosted runner)
2. Write `backend/.env` from `BACKEND_ENV` GitHub secret
3. `docker compose build` (injects `VITE_APP_VERSION=dev-<git-sha>`)
4. `docker compose up -d --remove-orphans`
5. Poll `http://localhost:3000/api/health` (12 × 5s) — fails the run if unhealthy

### `release.yml` — triggers on version tag push (`v*.*.*`)

1. Read version from root `package.json`
2. Build backend + frontend Docker images
3. Push to GHCR with tags: `:1.2.1`, `:1.2`, `:latest`, `:sha-xxxxxxx`
4. Create GitHub Release with auto-generated changelog

> Push to `main` does **not** trigger any pipeline — main is just the merge target.

---

## Versioning

Single source of truth: **root `package.json`** `version` field.

When you run `npm version`, a lifecycle script automatically syncs `backend/package.json` and `frontend/package.json` to match, then commits all three and creates the git tag.

### Version bump rules

| What changed | Command | Example |
|---|---|---|
| New feature, new page, new API endpoint | `npm version minor` | `1.2.0 → 1.3.0` |
| Bug fix, security patch, small UI tweak | `npm version patch` | `1.2.0 → 1.2.1` |
| Breaking change (DB migration, removed endpoint) | `npm version major` | `1.2.0 → 2.0.0` |

---

## Day-to-day: making and deploying changes

```bash
# 1. Make your changes on dev branch
git add <files>
git commit -m "describe what changed"

# 2. Push to dev — auto-deploys to itappsdev02
git push origin dev

# 3. Verify at https://vmtrak-dev.internal.indishtech.in
#    Check health endpoint returns expected version:
curl -s https://vmtrak-dev.internal.indishtech.in/api/health | jq
```

No version bump needed for day-to-day work. The sidebar will show `dev-<sha>`.

---

## Cutting a release

Run all of these from the `dev` branch after verifying the change on dev.

```bash
# 1. Bump version (choose one)
npm version patch   # bug fix / small change
npm version minor   # new feature
npm version major   # breaking change

# This command does all of the following automatically:
#   - Updates root/backend/frontend package.json to the new version
#   - Commits the three package.json files with message "vX.Y.Z"
#   - Creates git tag vX.Y.Z

# 2. Push dev branch + the new tag together
git push origin dev --follow-tags

# 3. Merge to main
git checkout main
git merge dev
git push origin main
git checkout dev
```

**What happens after step 2:**
- `deploy-dev.yml` fires → redeploys dev (now shows `dev-<sha>`)
- `release.yml` fires (triggered by the tag) → builds GHCR images tagged `:X.Y.Z`, `:X.Y`, `:latest`, `:sha-xxx` → creates GitHub Release

**What happens after step 3:**
- Nothing (main push has no pipeline trigger)

---

## Checking what's running

```bash
# Version running on dev
curl -s https://vmtrak-dev.internal.indishtech.in/api/health | jq
# → { "status": "ok", "version": "1.2.1", "uptime": 3021 }

# Container status on itappsdev02
docker ps --filter name=vmtrak

# Live backend logs
docker logs vmtrak-backend --tail=50 -f

# Live frontend logs
docker logs vmtrak-frontend --tail=20

# Audit log file
docker exec vmtrak-backend tail -f /app/logs/audit.log
```

---

## Manual deploy (if CI fails)

SSH into itappsdev02 and run from the repo directory:

```bash
cd ~/VMTrak   # or wherever the repo is checked out on the runner

# Write .env manually if needed (copy from GitHub secret)
nano backend/.env

# Rebuild and restart
docker compose build
docker compose up -d --remove-orphans

# Check health
curl -s http://localhost:3000/api/health | jq
```

---

## GHCR images

Images are published to GitHub Container Registry under `ghcr.io/deep7k/`:

```bash
# Pull latest release
docker pull ghcr.io/deep7k/vmtrak-backend:latest
docker pull ghcr.io/deep7k/vmtrak-frontend:latest

# Pull specific version
docker pull ghcr.io/deep7k/vmtrak-backend:1.2.1
docker pull ghcr.io/deep7k/vmtrak-frontend:1.2.1
```

Images are public. No authentication needed to pull.

---

## Secrets

| Secret | Where | Used for |
|---|---|---|
| `BACKEND_ENV` | GitHub repo → Environments → dev | Full `backend/.env` written by CI before build |
| `GITHUB_TOKEN` | Auto-provided by Actions | Push images to GHCR, create GitHub Releases |

To update a secret: GitHub → repo → Settings → Secrets and variables → Actions → `BACKEND_ENV` → Update.
