#!/usr/bin/env bash
# Portable CI entry point. CodeArts Build (build.yml) calls this; it can also run locally:
#   bash scripts/ci.sh            # verify + unit tests + integration tests + web build
#   STAGE=images bash scripts/ci.sh   # additionally build (and with PUSH=1 push) images
# Fails on the first red step so later pipeline stages never run on a broken build.
set -euo pipefail
cd "$(dirname "$0")/.."

log() { printf '\n==== %s ====\n' "$*"; }

log "toolchain"
node --version
corepack enable >/dev/null 2>&1 || true
pnpm --version

log "install (frozen lockfile)"
pnpm install --frozen-lockfile

log "verify: lint, typecheck, doc gates"
pnpm verify

log "unit tests with coverage gate"
pnpm test

log "integration tests against PostgreSQL"
if [[ -z "${PLATFORM_DATABASE_URL:-}" ]]; then
  if command -v docker >/dev/null 2>&1; then
    docker compose -f deploy/docker-compose.yml up -d db
    export POSTGRES_PORT="${POSTGRES_PORT:-55432}"
    for v in PLATFORM M1 M2 M3; do
      export "${v}_DATABASE_URL=postgresql://campus:campus@localhost:${POSTGRES_PORT}/campus?schema=$(echo "$v" | tr '[:upper:]' '[:lower:]')"
    done
  else
    echo "no PLATFORM_DATABASE_URL and no docker: integration tests cannot run; refusing to pass silently" >&2
    exit 1
  fi
fi
export JWT_SECRET="${JWT_SECRET:-ci-only-secret-0123456789abcdef}"
export INTERNAL_SERVICE_TOKEN="${INTERNAL_SERVICE_TOKEN:-ci-only-internal-token}"
pnpm test:integration

log "build all apps"
pnpm build

if [[ "${STAGE:-}" == "images" ]]; then
  log "container images"
  bash deploy/scripts/build-images.sh
fi

log "ci ok"
