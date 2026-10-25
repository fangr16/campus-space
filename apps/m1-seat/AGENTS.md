# apps/m1-seat

M1 study-seat reservation and the room/seat master data (D-2). Prefix `api/m1`, schema
`m1`, port 3011. Owner: module group 1. This app is the reference slice the other
modules copy: migration → seed → repository → service → controller → unit + integration tests.

## Owns

- `rooms/` room and seat master data, search and visibility (REQ-M1-02, 07, 09).
- Planned: `reservations/` (REQ-M1-04, 05, 06), `seat-status/` internal endpoints that M2
  and M3 call to block and release seats (X-1, X-2).

## Tables

`rooms`, `seats`, `seat_statuses`. `seat_statuses.source` is mandatory and mirrors
`SeatStatusSource` in contracts (X-3). Never write a status row without `source` and `refId`.

## Conventions

- Rooms a caller may not see are reported as 404, not 403, so department-only rooms do
  not leak.
- Pure rules (visibility, opening hours) live in `room-visibility.ts` and are unit tested;
  controllers and repositories are covered by `rooms.int-spec.ts` against `m1_test`.
- Opening hours are "HH:mm" strings validated by `ClockTimeSchema`; store times in UTC.
- Prisma client is generated into `generated/prisma`; run `pnpm generate` after schema edits.
