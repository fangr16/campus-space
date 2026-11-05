# apps/m1-seat

M1 study-seat reservation and the room/seat master data (D-2). Prefix `api/m1`, schema
`m1`, port 3011. Owner: module group 1. This app is the reference slice the other
modules copy: migration → seed → repository → service → controller → unit + integration tests.

## Owns

- `rooms/` room and seat master data, search, visibility and the floor plan (REQ-M1-02,
  07, 09, 10). `seat-power.ts` derives power availability from outlets; never store it.
- `reservations/` booking and cancellation (REQ-M1-04); rules are pure functions in
  `reservation-rules.ts`, the clock is injected (`CLOCK`). `settings/` holds module parameters.
- Planned: check-in and no-show (REQ-M1-05, 06), `seat-status/` internal endpoints that M2
  and M3 call to block and release seats (X-1, X-2).

## Tables

`rooms`, `seats`, `power_outlets`, `seat_statuses`, `reservations`, `settings`. Overlapping
seat statuses are rejected by a database exclusion constraint (ADR-0009); never bypass it. `seats.hasPowerOutlet` is deprecated
(derived at read time) and is dropped in the release after ADR-0007. `seat_statuses.source` is mandatory and mirrors
`SeatStatusSource` in contracts (X-3). Never write a status row without `source` and `refId`.

## Conventions

- Rooms a caller may not see are reported as 404, not 403, so department-only rooms do
  not leak.
- Pure rules (visibility, opening hours) live in `room-visibility.ts` and are unit tested;
  controllers and repositories are covered by `rooms.int-spec.ts` against `m1_test`.
- Opening hours are "HH:mm" strings validated by `ClockTimeSchema`; store times in UTC.
- Prisma client is generated into `generated/prisma`; run `pnpm generate` after schema edits.
