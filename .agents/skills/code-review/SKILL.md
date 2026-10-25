---
name: code-review
description: Use before opening a merge request (self-review) or when asked to review another branch. Produces blockers first, then suggestions, each with location, impact and evidence.
---

# code-review

This is guidance, not a checklist to tick. One substantiated blocker is worth more than a
list of nits. Human reviewers still approve the merge request; this skill prepares the
ground.

## Procedure

1. `git diff origin/main...HEAD` and read the merge request description. Confirm it cites a
   `REQ-*`/`TASK-*` and, for non-trivial work, an ADR in the same branch.
2. Check the blocking requirements below. Stop and report if any fails.
3. Then look for the manual-review items.
4. Report in the format at the bottom.

## Blocking

- Scope matches the approved task brief; no unrelated changes rode along.
- Module boundary intact: no import across `apps/*`, no SQL into another schema, every
  cross-module call goes through `packages/contracts` with the internal token.
- Every `SeatStatus` write sets `source`.
- Schema change has a migration, an updated seed when needed, and an integration test.
- Tests can fail: for each new test, name the line in the implementation that would break
  it. A test that only asserts constants, mocks the unit under test, or covers an empty
  branch is a blocker.
- No secret, token or absolute local path in the diff.
- Docs that describe the changed behavior were updated (`docs/requirements`, contracts).
- Evidence section of the merge request lists the commands run and their results.

## Manual review

- Error handling: failures surface to the caller with a typed error from `contracts`; no
  silent `catch`.
- Concurrency on reservations and approvals: unique constraints or transactions, not hope.
- Unnecessary API surface: new endpoints or exports nobody calls yet.
- Time handling: UTC in storage, explicit timezone at the edge.
- Front end: loading, empty and error states exist for every new query.

## Report format

```markdown
### Blockers
1. <defect> | <file:line> | impact | evidence (command output or reasoning)

### Suggestions
- ...

### Checked and fine
- <one line per area you actually examined>
```

Skip anything a green gate already enforces (lint, typecheck, coverage number).
Write without praise or filler.
