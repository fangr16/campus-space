#!/usr/bin/env bash
# Deploys (or rolls forward) the stack on this host to one image tag.
#   deploy.sh <image-tag>            e.g. deploy.sh v0.1.0  or  deploy.sh 9a37335
# Reads REGISTRY and secrets from /opt/campus-space/.env, records the tag history in
# /opt/campus-space/releases.log so rollback.sh can find the previous version.
set -euo pipefail

TAG="${1:?usage: deploy.sh <image-tag>}"
APP_DIR="${APP_DIR:-/opt/campus-space}"
COMPOSE="docker compose -f ${APP_DIR}/docker-compose.deploy.yml --env-file ${APP_DIR}/.env"

cd "${APP_DIR}"
previous="$(tail -n 1 releases.log 2>/dev/null | awk '{print $2}' || true)"
echo "deploying ${TAG} (previous: ${previous:-none})"

export IMAGE_TAG="${TAG}"
${COMPOSE} pull --quiet
${COMPOSE} up -d --remove-orphans

"$(dirname "$0")/smoke.sh" "http://127.0.0.1:${HTTP_PORT:-8080}" "${TAG}"

echo "$(date -u +%FT%TZ) ${TAG} ok" >> releases.log
echo "deployed ${TAG}"
