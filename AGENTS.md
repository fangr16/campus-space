# AGENTS.md

Rules for every coding agent (Codex, Qoder, Trae, Cursor, Claude Code) working in this
repository. This file is the single source of truth; `CLAUDE.md` and `.cursor/rules` only
point here. Keep it under 800 words (`pnpm verify:docs` enforces the budget).

## Read first

1. `docs/README.md` for the Chinese project docs index (requirements, ADRs, ops).
2. `packages/contracts/src` for every cross-module DTO, enum and event.
3. The `AGENTS.md` inside the app or package you are editing.

## Repository layout

- `apps/platform` shared layer D: login, users, roles, notifications, audit.
- `apps/m1-seat` study-seat reservation plus room/seat master data.
- `apps/m2-room` whole-room booking and approval.
- `apps/m3-repair` maintenance tickets.
- `apps/web` React front end for all modules.
- `packages/*` shared code; `deploy/` containers and scripts; `docs/` human docs (Chinese).
- `.agents/skills/*` reusable procedures: `task-brief`, `pre-push-checks`, `code-review`, `write-adr`.

## Commands

| Purpose | Command |
|---|---|
| Install | `pnpm install` |
| Lint, typecheck, doc gates | `pnpm verify` |
| Unit tests with coverage | `pnpm test` |
| Integration tests (needs `pnpm db:up`) | `pnpm test:integration` |
| End-to-end smoke | `pnpm e2e` |
| Mutation tests | `pnpm mutation` |
| Run everything locally | `pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm dev` |

Run the smallest check that covers your diff before every push (`pre-push-checks` skill).
CI runs the full matrix.

## Hard rules

- **Branching.** Never commit to `main`. One merge request per task, under 400 changed
  lines and under 3 days old; split otherwise. Rebase onto `main`, then the reviewer merges
  with `--no-ff`. Never use raw `--force`; use `--force-with-lease`.
- **Conflicts are resolved by a human** on the feature branch. An agent may describe a
  conflict but must stop and hand it over. Never auto-resolve or auto-merge.
- **Provenance.** Every merge request cites a requirement id (`REQ-*`) or task id
  (`TASK-*`) from `docs/requirements` or `docs/plan/tasks.md`. Non-trivial changes include an
  ADR in the same merge request (`write-adr` skill).
- **Propose before implementing.** For any task touching more than one file, first write a
  brief (scope, constraints, acceptance criteria, files to change, alternatives) and wait for
  human approval (`task-brief` skill). Never start coding from a one-line prompt.
- **Human acceptance.** AI-generated changes are reviewed by a human before they are
  committed. Do not produce a single commit that nobody can review.
- **Review.** Schema, contract, cross-module and `packages/*` changes need two human
  reviewers; everything else needs one. Run the `code-review` skill before opening a merge
  request.
- **Module boundaries.** Modules talk only through the public HTTP contracts in
  `packages/contracts`, authenticated with the internal service token. No cross-schema SQL,
  no importing another app's source.
- **Data.** Schema changes go through Prisma migrations committed with the code. Seeds are
  idempotent and separate from business data. Never edit a database by hand.
- **Seat state provenance.** Every write to `SeatStatus` sets `source` from
  `SeatStatusSource` (`M1_RESERVATION`, `M2_ROOM_BOOKING`, `M3_REPAIR`).
- **Secrets.** Never commit credentials. Read them from the environment; document new
  variables in `.env.example`.
- **Generated files** (OpenAPI output, coverage, mutation reports, build output) are not
  committed. Lockfiles are.

## Evidence rules

- Verify the world, not the self-report. Say only what you ran and show the output.
  "Tests pass" without a command is not evidence.
- Never use `--passWithNoTests`, skip, or lower a threshold to get green.
- Tests assert behavior. A test that cannot fail when the implementation breaks is a defect.
  Prefer real database integration tests over mocking the repository under test.
- Coverage gate is 80% lines and branches per package. Mutation score from `pnpm mutation`
  is logged in `docs/quality/mutation-log.md` before each review.

## Commits

Conventional Commits: `type(scope): summary`. Types: `feat fix refactor test docs build ci
chore perf adr`. Scopes: `platform m1 m2 m3 web contracts auth common infra ci docs adr`.
The body states what changed and why, in one or two sentences. No reasoning transcripts,
no tool chatter, no em dashes.

## Prose

Agent-facing files (`AGENTS.md`, skills) are English. Everything in `docs/` is Chinese.
Comments state contracts (inputs, failure modes, ownership), not how you arrived at them.

## Editing these instructions

Change this file only through a merge request that also updates the relevant ADR. Keep
app-level `AGENTS.md` files under 300 words. Do not duplicate rules between levels.
