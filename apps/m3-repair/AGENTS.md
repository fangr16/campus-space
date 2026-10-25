# apps/m3-repair

M3 maintenance tickets. Prefix `api/m3`, schema `m3`, port 3013. Owner: module group 3
(also owns D-4 audit inside `apps/platform`).

## Owns

- `tickets/` tickets, their event history and the state machine in `ticket-status.ts`
  (REQ-M3-01..05). While a ticket is IN_PROGRESS, ESCALATED or REWORK the room's seats
  are blocked in M1 (X-1); acceptance releases them.
- Planned: SLA escalation job driven by `isOverdue`, dispatch to maintainers, acceptance
  with rating, and the HTTP calls to M1's block/release endpoints.

## Tables

`repair_tickets`, `ticket_events` (append-only). `roomId`/`seatId` are M1 ids carried over
the contract; never join into the m1 schema.

## Conventions

- Every status change calls `assertTransition` and appends a `ticket_events` row in the
  same transaction.
- Photos, if added, are stored by reference; never put binary data in the table.
- Copy the layering of `apps/m1-seat/src/rooms` when adding endpoints.
