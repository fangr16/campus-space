#!/usr/bin/env bash
# Builds (and optionally pushes) all five images with build metadata baked in for /version.
#   REGISTRY=swr.../org IMAGE_TAG=v0.1.0 PUSH=1 bash deploy/scripts/build-images.sh
# Without REGISTRY the images are tagged locally as campus-space-<app>:<tag>.
set -euo pipefail

cd "$(dirname "$0")/../.."
GIT_SHA="${GIT_SHA:-$(git rev-parse HEAD)}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
GIT_TAG="${GIT_TAG:-$(git describe --tags --exact-match 2>/dev/null || echo "${IMAGE_TAG}")}"
BUILD_TIME="$(date -u +%FT%TZ)"
PREFIX="${REGISTRY:+${REGISTRY}/}campus-space"

build_service() {
  local app="$1" pkg="$2"
  docker build -f deploy/Dockerfile.service \
    --build-arg APP="${app}" --build-arg PKG="${pkg}" \
    --build-arg GIT_SHA="${GIT_SHA}" --build-arg GIT_TAG="${GIT_TAG}" --build-arg BUILD_TIME="${BUILD_TIME}" \
    -t "${PREFIX}-${app}:${IMAGE_TAG}" .
}

build_service platform @campus/platform
build_service m1-seat @campus/m1-seat
build_service m2-room @campus/m2-room
build_service m3-repair @campus/m3-repair
docker build -f deploy/Dockerfile.web -t "${PREFIX}-web:${IMAGE_TAG}" .

if [[ "${PUSH:-0}" == "1" ]]; then
  [[ -n "${REGISTRY:-}" ]] || { echo "PUSH=1 requires REGISTRY"; exit 1; }
  for app in platform m1-seat m2-room m3-repair web; do
    docker push "${PREFIX}-${app}:${IMAGE_TAG}"
  done
fi
echo "images built: ${PREFIX}-{platform,m1-seat,m2-room,m3-repair,web}:${IMAGE_TAG} (sha ${GIT_SHA}, tag ${GIT_TAG})"
