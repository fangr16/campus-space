# apps/m2-room

M2 whole-room booking and multi-level approval. Prefix `api/m2`, schema `m2`, port 3012.
Owner: module group 2 (also owns D-1 in `packages/auth`).

## Owns

- `bookings/` applications, approval records and the state machine in `booking-status.ts`
  (REQ-M2-01..05). Only approved bookings occupy seats in M1 (X-2).
- Planned: an expiry job that auto-withdraws pending bookings past `expiresAt` (REQ-M2-04)
  and the HTTP call to M1's block/release endpoints using `RoomBlockRequest` from contracts.

## Tables

`room_bookings`, `approval_records`. `roomId` is an M1 id carried over the contract; never
join into the m1 schema.

## Conventions

- Every status change goes through `applyDecision` or `canTransition`; controllers never set
  `status` directly.
- Approval level and required levels are fixed at creation; changing the approval chain is
  a new booking.
- Copy the layering of `apps/m1-seat/src/rooms` when adding endpoints.
