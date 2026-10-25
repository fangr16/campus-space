#!/usr/bin/env bash
# Deploys (or rolls forward) the stack on this host to one image tag.
#   deploy.sh <image-tag>            e.g. deploy.sh v0.1.0  or  deploy.sh 9a37335
# Reads REGISTRY, HTTP_PORT and secrets from /opt/campus-space/.env. Every attempt is written to
# releases.log as "<utc-time> <tag> start|ok|failed", and the tag that is actually serving
# traffic is kept in .current-tag so rollback.sh never picks the version that just failed.
set -euo pipefail

TAG="${1:?usage: deploy.sh <image-tag>}"
APP_DIR="${APP_DIR:-/opt/campus-space}"
cd "${APP_DIR}"

set -a
# shellcheck disable=SC1091
. ./.env
set +a
HTTP_PORT="${HTTP_PORT:-8080}"
COMPOSE="docker compose -f ${APP_DIR}/docker-compose.deploy.yml --env-file ${APP_DIR}/.env"

current="$(cat .current-tag 2>/dev/null || echo none)"
echo "deploying ${TAG} (currently serving: ${current})"
echo "$(date -u +%FT%TZ) ${TAG} start" >> releases.log

export IMAGE_TAG="${TAG}"
if ${COMPOSE} pull --quiet && ${COMPOSE} up -d --remove-orphans \
   && "$(dirname "$0")/smoke.sh" "http://127.0.0.1:${HTTP_PORT}" "${TAG}"; then
  echo "${TAG}" > .current-tag
  echo "$(date -u +%FT%TZ) ${TAG} ok" >> releases.log
  echo "deployed ${TAG}"
else
  echo "$(date -u +%FT%TZ) ${TAG} failed" >> releases.log
  echo "deploy of ${TAG} failed; ${current} remains the last known good version" >&2
  exit 1
fi
