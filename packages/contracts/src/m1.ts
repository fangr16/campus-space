import { z } from "zod";

/** "HH:mm" 24-hour clock, used for room opening hours (REQ-M1-02). */
export const ClockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:mm");

export const RoomDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  building: z.string(),
  floor: z.number().int(),
  openFrom: ClockTimeSchema,
  openTo: ClockTimeSchema,
  /** null means campus-wide; a value restricts the room to that department (REQ-M1-02). */
  departmentId: z.string().nullable(),
  isActive: z.boolean(),
  seatCount: z.number().int().nonnegative(),
});
export type RoomDto = z.infer<typeof RoomDtoSchema>;

export const SeatDtoSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  code: z.string(),
  /** Near a fixed or rail power outlet (REQ-M1-09). */
  hasPowerOutlet: z.boolean(),
  isActive: z.boolean(),
});
export type SeatDto = z.infer<typeof SeatDtoSchema>;

/** Query string for GET /api/m1/rooms. All fields optional; strings are coerced. */
export const RoomQuerySchema = z.object({
  building: z.string().trim().min(1).max(50).optional(),
  keyword: z.string().trim().min(1).max(50).optional(),
});
export type RoomQuery = z.infer<typeof RoomQuerySchema>;

const booleanFromQuery = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

/** Query string for GET /api/m1/rooms/:id/seats. */
export const SeatQuerySchema = z.object({
  hasPower: booleanFromQuery.optional(),
});
export type SeatQuery = z.infer<typeof SeatQuerySchema>;

export const RoomSeatsResponseSchema = z.object({
  room: RoomDtoSchema,
  seats: z.array(SeatDtoSchema),
});
export type RoomSeatsResponse = z.infer<typeof RoomSeatsResponseSchema>;
