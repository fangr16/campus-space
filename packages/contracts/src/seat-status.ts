import { z } from "zod";

/**
 * Who wrote a seat status row. Required by the task sheet (X-3): M1 must record whether a
 * seat is blocked by its own reservation, by an approved whole-room booking (M2) or by a
 * repair ticket (M3), so the state can be traced and audited.
 */
export const SeatStatusSource = {
  M1_RESERVATION: "M1_RESERVATION",
  M2_ROOM_BOOKING: "M2_ROOM_BOOKING",
  M3_REPAIR: "M3_REPAIR",
} as const;
export type SeatStatusSource = (typeof SeatStatusSource)[keyof typeof SeatStatusSource];
export const SeatStatusSourceSchema = z.enum(
  Object.values(SeatStatusSource) as [SeatStatusSource, ...SeatStatusSource[]],
);

/** What the status means for a student trying to reserve. */
export const SeatStatusKind = {
  RESERVED: "RESERVED",
  BLOCKED: "BLOCKED",
} as const;
export type SeatStatusKind = (typeof SeatStatusKind)[keyof typeof SeatStatusKind];
export const SeatStatusKindSchema = z.enum(
  Object.values(SeatStatusKind) as [SeatStatusKind, ...SeatStatusKind[]],
);

export const SeatStatusDtoSchema = z.object({
  id: z.string(),
  seatId: z.string(),
  kind: SeatStatusKindSchema,
  source: SeatStatusSourceSchema,
  /** Id of the reservation, booking or ticket that caused this row, in the source module. */
  refId: z.string(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type SeatStatusDto = z.infer<typeof SeatStatusDtoSchema>;
