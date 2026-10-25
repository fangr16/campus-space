import { describe, expect, it } from "vitest";
import { RoomBlockRequestSchema } from "./events";
import { SeatStatusSource } from "./seat-status";

const base = {
  roomId: "room-1",
  refId: "ticket-9",
  from: "2026-11-01T08:00:00.000Z",
  to: "2026-11-01T12:00:00.000Z",
};

describe("RoomBlockRequestSchema", () => {
  it("accepts a repair block from M3", () => {
    const parsed = RoomBlockRequestSchema.parse({ ...base, source: SeatStatusSource.M3_REPAIR });
    expect(parsed.source).toBe("M3_REPAIR");
  });

  it("accepts a booking block from M2", () => {
    expect(
      RoomBlockRequestSchema.safeParse({ ...base, source: SeatStatusSource.M2_ROOM_BOOKING })
        .success,
    ).toBe(true);
  });

  it("rejects M1_RESERVATION because M1 never blocks itself over the wire", () => {
    expect(
      RoomBlockRequestSchema.safeParse({ ...base, source: SeatStatusSource.M1_RESERVATION })
        .success,
    ).toBe(false);
  });

  it("rejects a missing refId so a block can always be released", () => {
    const { refId: _omit, ...withoutRef } = base;
    expect(
      RoomBlockRequestSchema.safeParse({ ...withoutRef, source: SeatStatusSource.M3_REPAIR })
        .success,
    ).toBe(false);
  });
});
