---
name: task-brief
description: Use when a human hands you a task that touches more than one file, or whenever the scope, constraints or acceptance criteria are not written down yet. Produces the brief that must be approved before implementation.
---

# task-brief

The course rule is "plan first, then implement". A brief turns a one-line request into a
reviewable contract between the human and the agent. Write it, post it, and stop until a
human approves it.

## Procedure

1. Locate the source of the task: a `REQ-*` in `docs/requirements/` or a `TASK-*` in
   `docs/plan/tasks.md`. If neither exists, ask the human to create one; do not invent an id.
2. Read the `AGENTS.md` of every app or package you expect to touch, and
   `packages/contracts/src` if any interface is involved.
3. Fill the template below. Every field is mandatory. "N/A" needs a reason.
4. If two reasonable designs exist, list both under Alternatives and say which you prefer.
   A brief with one unexamined design is incomplete.
5. Post the brief in the merge request description (or chat) and wait for approval.
   After approval, copy the brief into the merge request as the `Motivation` section.

## Template

```markdown
## Task brief: <short title>

- Source: REQ-M1-04 / TASK-017
- Goal (one sentence, observable outcome):
- In scope:
- Out of scope:
- Constraints: (contracts touched, schema change yes/no, cross-module yes/no, perf, security)
- Acceptance criteria: (each line testable; name the test file that will prove it)
  1.
  2.
- Files to change:
- Alternatives considered:
- Risks and how they are checked:
- Estimated size: <N files, ~M lines> (must stay under 400 changed lines)
```

## Rules

- Acceptance criteria name a test, an HTTP request with expected response, or a UI state.
  "Works correctly" is not a criterion.
- If the brief exceeds 400 changed lines, split it into ordered briefs before starting.
- A schema change in the brief triggers the two-reviewer rule and must name the migration.
