#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu 22.04/24.04 ECS host (test or production).
# Installs Docker, creates /opt/campus-space with the compose file and an .env template,
# and logs in to SWR. Run as a sudoer:  bash bootstrap-host.sh
# Demo 1 (fresh environment) starts here, then the pipeline deploys.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/campus-space}"
REPO_RAW="${REPO_RAW:-}"   # optional: raw URL prefix to fetch deploy files from the repo

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
fi
docker compose version >/dev/null

sudo mkdir -p "${APP_DIR}"
sudo chown "$USER" "${APP_DIR}"
cd "${APP_DIR}"

here="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "${here}/docker-compose.deploy.yml" ]]; then
  cp "${here}/docker-compose.deploy.yml" .
  cp -r "${here}/scripts" .
elif [[ -n "${REPO_RAW}" ]]; then
  curl -fsSL "${REPO_RAW}/deploy/docker-compose.deploy.yml" -o docker-compose.deploy.yml
  mkdir -p scripts
  for f in deploy.sh rollback.sh smoke.sh; do curl -fsSL "${REPO_RAW}/deploy/scripts/${f}" -o "scripts/${f}"; done
fi
chmod +x scripts/*.sh

if [[ ! -f .env ]]; then
  cat > .env <<'ENV'
# Fill in before the first deploy. Never commit this file.
REGISTRY=swr.cn-east-3.myhuaweicloud.com/REPLACE_ORG
HTTP_PORT=8080
POSTGRES_USER=campus
POSTGRES_PASSWORD=REPLACE_WITH_openssl_rand_hex_24
POSTGRES_DB=campus
PLATFORM_DATABASE_URL=postgresql://campus:REPLACE_WITH_SAME_PASSWORD@db:5432/campus?schema=platform
M1_DATABASE_URL=postgresql://campus:REPLACE_WITH_SAME_PASSWORD@db:5432/campus?schema=m1
M2_DATABASE_URL=postgresql://campus:REPLACE_WITH_SAME_PASSWORD@db:5432/campus?schema=m2
M3_DATABASE_URL=postgresql://campus:REPLACE_WITH_SAME_PASSWORD@db:5432/campus?schema=m3
JWT_SECRET=REPLACE_WITH_openssl_rand_hex_32
JWT_EXPIRES_IN=8h
INTERNAL_SERVICE_TOKEN=REPLACE_WITH_openssl_rand_hex_32
PLATFORM_BASE_URL=http://platform:3000
M1_BASE_URL=http://m1-seat:3000
M2_BASE_URL=http://m2-room:3000
M3_BASE_URL=http://m3-repair:3000
SEED_DEMO_USERS=true
ENV
  echo "wrote ${APP_DIR}/.env template; replace every REPLACE_* value"
fi

echo "host ready. next: docker login <swr> ; scripts/deploy.sh <tag>"
