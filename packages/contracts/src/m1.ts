import { z } from "zod";

/** "HH:mm" 24-hour clock, used for room opening hours (REQ-M1-02). */
export const ClockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:mm");

/**
 * Floor-plan coordinates (REQ-M1-10). Rooms are abstract grids: (0,0) is the top-left corner,
 * x grows to the right and y downwards, one unit is roughly one desk width. Nothing here is
 * measured in metres; the layout only has to be true to the relative positions.
 */
export const GridCoordinateSchema = z.number().int().nonnegative();

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
  /** Floor-plan size in grid units (REQ-M1-10). */
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type RoomDto = z.infer<typeof RoomDtoSchema>;

export const SeatDtoSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  code: z.string(),
  /** Position on the floor plan (REQ-M1-10). */
  x: GridCoordinateSchema,
  y: GridCoordinateSchema,
  /**
   * Within reach of a power outlet (REQ-M1-09). Since REQ-M1-10 this is derived from the
   * room's outlets and their range, never stored by hand.
   */
  hasPowerOutlet: z.boolean(),
  isActive: z.boolean(),
});
export type SeatDto = z.infer<typeof SeatDtoSchema>;

export const PowerOutletKind = {
  /** Wall or floor socket at a fixed point. */
  FIXED: "FIXED",
  /** Overhead or desk rail: a longer reach, modelled by a larger range. */
  RAIL: "RAIL",
} as const;
export type PowerOutletKind = (typeof PowerOutletKind)[keyof typeof PowerOutletKind];
export const PowerOutletKindSchema = z.enum(
  Object.values(PowerOutletKind) as [PowerOutletKind, ...PowerOutletKind[]],
);

/** A power outlet on the floor plan; seats within `range` grid units can use it. */
export const PowerOutletDtoSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  code: z.string(),
  kind: PowerOutletKindSchema,
  x: GridCoordinateSchema,
  y: GridCoordinateSchema,
  /** Reach in grid units (Euclidean distance, inclusive). */
  range: z.number().int().positive(),
});
export type PowerOutletDto = z.infer<typeof PowerOutletDtoSchema>;

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
  /** Every outlet of the room, regardless of the seat filter, so the map can draw them all. */
  outlets: z.array(PowerOutletDtoSchema),
});
export type RoomSeatsResponse = z.infer<typeof RoomSeatsResponseSchema>;

/* ----------------------------------------------------------------------------------------- */
/* Reservations (REQ-M1-04)                                                                   */
/* ----------------------------------------------------------------------------------------- */

export const ReservationStatus = {
  BOOKED: "BOOKED",
  CANCELLED: "CANCELLED",
} as const;
export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];
export const ReservationStatusSchema = z.enum(
  Object.values(ReservationStatus) as [ReservationStatus, ...ReservationStatus[]],
);

/**
 * Rule names returned in `error.details.rule` when a reservation is refused, so the UI can
 * explain which rule was broken without parsing messages.
 */
export const ReservationRule = {
  WHOLE_HOUR: "whole-hour",
  DURATION: "duration",
  OPENING_HOURS: "opening-hours",
  IN_THE_PAST: "in-the-past",
  USER_OVERLAP: "user-overlap",
  SEAT_OVERLAP: "seat-overlap",
  NOT_BOOKED: "not-booked",
  ALREADY_STARTED: "already-started",
} as const;
export type ReservationRule = (typeof ReservationRule)[keyof typeof ReservationRule];

export const CreateReservationRequestSchema = z.object({
  seatId: z.string().min(1),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});
export type CreateReservationRequest = z.infer<typeof CreateReservationRequestSchema>;

export const ReservationDtoSchema = z.object({
  id: z.string(),
  seatId: z.string(),
  seatCode: z.string(),
  roomId: z.string(),
  roomCode: z.string(),
  roomName: z.string(),
  userId: z.string(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  status: ReservationStatusSchema,
  cancelReason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type ReservationDto = z.infer<typeof ReservationDtoSchema>;

/* ----------------------------------------------------------------------------------------- */
/* Module settings (REQ-M1-01, REQ-M1-04 "参数可调")                                           */
/* ----------------------------------------------------------------------------------------- */

export const SettingKey = {
  RESERVATION_MAX_HOURS: "reservation.maxHours",
  RESERVATION_SLOT_MINUTES: "reservation.slotMinutes",
  ROOM_TIMEZONE: "room.timezone",
} as const;
export type SettingKey = (typeof SettingKey)[keyof typeof SettingKey];

export const SettingDtoSchema = z.object({
  key: z.string(),
  value: z.string(),
  updatedAt: z.string().datetime(),
});
export type SettingDto = z.infer<typeof SettingDtoSchema>;

export const UpdateSettingRequestSchema = z.object({
  value: z.string().trim().min(1).max(100),
});
export type UpdateSettingRequest = z.infer<typeof UpdateSettingRequestSchema>;
