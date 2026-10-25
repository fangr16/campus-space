#!/usr/bin/env bash
# Rolls the stack back to the previous successful tag (or an explicit one).
#   rollback.sh            -> newest "ok" entry in releases.log whose tag differs from .current-tag
#   rollback.sh v0.0.9     -> that tag
# Schema note: prisma migrate deploy is forward-only. A rollback keeps the newer schema and
# runs the older code against it, which is why migrations must stay backward compatible for
# one release (expand/contract). See docs/ops/release.md.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/campus-space}"
cd "${APP_DIR}"
current="$(cat .current-tag 2>/dev/null || echo none)"

if [[ $# -ge 1 ]]; then
  TARGET="$1"
else
  TARGET="$(awk -v cur="${current}" '$3 == "ok" && $2 != cur { last = $2 } END { print last }' releases.log 2>/dev/null || true)"
fi
[[ -n "${TARGET:-}" ]] || { echo "no previous successful release other than ${current} found in releases.log"; exit 1; }
[[ "${TARGET}" != "${current}" ]] || { echo "${TARGET} is already the serving version"; exit 1; }

echo "rolling back from ${current} to ${TARGET}"
echo "$(date -u +%FT%TZ) ${TARGET} rollback-from-${current}" >> releases.log
"$(dirname "$0")/deploy.sh" "${TARGET}"
