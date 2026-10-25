---
name: pre-push-checks
description: Use before every git push and before opening a merge request. Selects the smallest set of checks that cover the outgoing diff and reports exactly what ran.
---

# pre-push-checks

Local checks stay fast; CI owns the full matrix. Pick the checks that match the diff,
run them, and report the commands with their output. Do not push and hope CI differs.

## Procedure

1. `git fetch origin && git diff --stat origin/main...HEAD` to see what is outgoing.
2. Map each kind of change to its evidence:

| Change | Minimum evidence |
|---|---|
| `apps/<svc>/src/**` | `pnpm --filter <svc> test` and `pnpm --filter <svc> typecheck` |
| `apps/<svc>/prisma/**` | `pnpm db:up`, `pnpm --filter <svc> db:migrate`, `pnpm --filter <svc> test:integration` |
| `packages/contracts/**` | `pnpm typecheck` across the workspace (every consumer) and the contract tests |
| `packages/auth/**` or `packages/nest-common/**` | `pnpm test` (all packages) |
| `apps/web/**` | `pnpm --filter web test` and `pnpm --filter web typecheck`; `pnpm e2e` if a route changed |
| `docs/**`, `AGENTS.md`, `.agents/**` | `pnpm verify:docs` |
| `deploy/**`, `build.yml`, `scripts/ci.sh` | `bash -n` on shell scripts and `docker compose -f deploy/docker-compose.yml config` |

3. Run `pnpm biome check` on changed files (lefthook already does this on commit).
4. Confirm the commit messages follow Conventional Commits and the branch cites a `REQ-*`
   or `TASK-*`.
5. Push with `git push --force-with-lease` if you rebased; never raw `--force`.

## Forbidden

- `--passWithNoTests`, `.skip`, `.only`, lowering coverage or mutation thresholds.
- Reporting a check you did not run. Pending CI is reported as pending, not as passed.
- Editing a test so it passes without a documented behavior change in the merge request.
