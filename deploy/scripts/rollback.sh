#!/usr/bin/env bash
# Rolls the stack back to the previous successful tag (or an explicit one).
#   rollback.sh            -> previous entry in releases.log
#   rollback.sh v0.0.9     -> that tag
# Schema note: prisma migrate deploy is forward-only. A rollback keeps the newer schema and
# runs the older code against it, which is why migrations must stay backward compatible for
# one release (expand/contract). See docs/ops/release.md.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/campus-space}"
cd "${APP_DIR}"

if [[ $# -ge 1 ]]; then
  TARGET="$1"
else
  TARGET="$(grep ' ok$' releases.log | tail -n 2 | head -n 1 | awk '{print $2}' || true)"
fi
[[ -n "${TARGET:-}" ]] || { echo "no previous release found in releases.log"; exit 1; }

echo "rolling back to ${TARGET}"
echo "$(date -u +%FT%TZ) ${TARGET} rollback-start" >> releases.log
"$(dirname "$0")/deploy.sh" "${TARGET}"
