#!/usr/bin/env bash
# Post-deploy smoke: every service healthy and, when a tag is given, reporting that tag.
#   smoke.sh http://host:8080 [expected-tag]
set -euo pipefail

BASE="${1:?usage: smoke.sh <base-url> [expected-tag]}"
EXPECTED="${2:-}"
services=(platform m1 m2 m3)

for i in $(seq 1 30); do
  ok=0
  for s in "${services[@]}"; do
    if curl -fsS "${BASE}/api/${s}/health" >/dev/null 2>&1; then ok=$((ok + 1)); fi
  done
  [[ ${ok} -eq ${#services[@]} ]] && break
  sleep 3
done
[[ ${ok} -eq ${#services[@]} ]] || { echo "smoke: only ${ok}/${#services[@]} services healthy"; exit 1; }

for s in "${services[@]}"; do
  body="$(curl -fsS "${BASE}/api/${s}/version")"
  tag="$(printf '%s' "${body}" | sed -n 's/.*"tag":"\([^"]*\)".*/\1/p')"
  sha="$(printf '%s' "${body}" | sed -n 's/.*"sha":"\([^"]*\)".*/\1/p')"
  echo "smoke: ${s} sha=${sha} tag=${tag}"
  if [[ -n "${EXPECTED}" && "${tag}" != "${EXPECTED}" && "${sha}" != "${EXPECTED}"* ]]; then
    echo "smoke: ${s} reports ${tag}/${sha}, expected ${EXPECTED}"; exit 1
  fi
done
curl -fsS "${BASE}/" | grep -q "<title>" || { echo "smoke: web index missing"; exit 1; }
echo "smoke: ok"
