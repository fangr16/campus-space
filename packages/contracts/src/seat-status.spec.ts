import { describe, expect, it } from "vitest";
import { SeatStatusDtoSchema, SeatStatusSource, SeatStatusSourceSchema } from "./seat-status";
import { VersionInfoSchema } from "./version";

describe("SeatStatusSourceSchema", () => {
  it("accepts exactly the three write-back sources required by X-3", () => {
    expect(Object.values(SeatStatusSource)).toEqual([
      "M1_RESERVATION",
      "M2_ROOM_BOOKING",
      "M3_REPAIR",
    ]);
    expect(SeatStatusSourceSchema.safeParse("MANUAL").success).toBe(false);
  });
});

describe("SeatStatusDtoSchema", () => {
  const row = {
    id: "s1",
    seatId: "seat-1",
    kind: "BLOCKED",
    source: "M3_REPAIR",
    refId: "ticket-1",
    from: "2026-11-01T08:00:00.000Z",
    to: "2026-11-01T12:00:00.000Z",
    createdAt: "2026-10-25T00:00:00.000Z",
  };

  it("parses a repair block row", () => {
    expect(SeatStatusDtoSchema.parse(row).source).toBe("M3_REPAIR");
  });

  it("rejects a row without provenance", () => {
    const { source: _omit, ...withoutSource } = row;
    expect(SeatStatusDtoSchema.safeParse(withoutSource).success).toBe(false);
  });

  it("rejects timestamps that are not ISO datetimes", () => {
    expect(SeatStatusDtoSchema.safeParse({ ...row, from: "2026-11-01 08:00" }).success).toBe(false);
  });
});

describe("VersionInfoSchema", () => {
  it("requires startedAt to be an ISO datetime", () => {
    const base = { service: "m1", sha: "abc", tag: "v0", buildTime: "x" };
    expect(
      VersionInfoSchema.safeParse({ ...base, startedAt: "2026-10-25T10:00:00.000Z" }).success,
    ).toBe(true);
    expect(VersionInfoSchema.safeParse({ ...base, startedAt: "today" }).success).toBe(false);
  });
});
