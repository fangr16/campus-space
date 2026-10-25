import { z } from "zod";
import { SeatStatusSourceSchema } from "./seat-status";

/**
 * Cross-module commands sent over HTTP with the internal service token.
 * These are the wire formats of the two write-back links the task sheet requires:
 *   X-1  M3 -> M1  block every seat of a room while a repair ticket is in progress
 *   X-2  M2 -> M1  block every seat of a room for an approved whole-room booking
 * The receiving service (M1) persists a SeatStatus row per seat with `source` and `refId`.
 */
export const RoomBlockRequestSchema = z.object({
  roomId: z.string().min(1),
  source: SeatStatusSourceSchema.exclude(["M1_RESERVATION"]),
  /** Ticket id (M3) or booking id (M2). Used to release the block later. */
  refId: z.string().min(1),
  from: z.string().datetime(),
  to: z.string().datetime(),
  reason: z.string().max(200).optional(),
});
export type RoomBlockRequest = z.infer<typeof RoomBlockRequestSchema>;

export const RoomReleaseRequestSchema = z.object({
  roomId: z.string().min(1),
  source: SeatStatusSourceSchema.exclude(["M1_RESERVATION"]),
  refId: z.string().min(1),
});
export type RoomReleaseRequest = z.infer<typeof RoomReleaseRequestSchema>;

export const RoomBlockResultSchema = z.object({
  roomId: z.string(),
  affectedSeats: z.number().int().nonnegative(),
});
export type RoomBlockResult = z.infer<typeof RoomBlockResultSchema>;
