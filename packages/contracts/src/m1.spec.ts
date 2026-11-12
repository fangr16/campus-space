import { describe, expect, it } from "vitest";
import { ClockTimeSchema, RoomQuerySchema, SeatQuerySchema } from "./m1";

describe("SeatQuerySchema", () => {
  it.each([
    ["true", true],
    ["1", true],
    ["false", false],
    ["0", false],
    [true, true],
  ])("coerces hasPower=%s to %s", (input, expected) => {
    expect(SeatQuerySchema.parse({ hasPower: input })).toEqual({ hasPower: expected });
  });

  it("leaves hasPower undefined when absent", () => {
    expect(SeatQuerySchema.parse({})).toEqual({});
  });

  it("rejects values that are not booleans", () => {
    expect(SeatQuerySchema.safeParse({ hasPower: "yes" }).success).toBe(false);
  });
});

describe("window query (REQ-M1-11)", () => {
  const from = "2026-11-10T02:00:00.000Z";
  const to = "2026-11-10T04:00:00.000Z";

  it("accepts a complete window on both list endpoints", () => {
    expect(SeatQuerySchema.parse({ from, to })).toEqual({ from, to });
    expect(RoomQuerySchema.parse({ from, to, keyword: "lib" })).toEqual({
      from,
      to,
      keyword: "lib",
    });
  });

  it("rejects a window with only one bound", () => {
    expect(SeatQuerySchema.safeParse({ from }).success).toBe(false);
    expect(RoomQuerySchema.safeParse({ to }).success).toBe(false);
  });

  it("rejects an empty or inverted window, comparing instants not strings", () => {
    expect(SeatQuerySchema.safeParse({ from, to: from }).success).toBe(false);
    // 10:00+08:00 is 02:00Z: an earlier instant although the string sorts later.
    expect(SeatQuerySchema.safeParse({ from: to, to: "2026-11-10T10:00:00+08:00" }).success).toBe(
      false,
    );
    expect(SeatQuerySchema.safeParse({ from: "2026-11-10T09:00:00+08:00", to }).success).toBe(true);
  });

  it("rejects a window wider than a day", () => {
    expect(SeatQuerySchema.safeParse({ from, to: "2026-11-11T02:00:00.000Z" }).success).toBe(true);
    expect(SeatQuerySchema.safeParse({ from, to: "2026-11-11T02:00:01.000Z" }).success).toBe(false);
  });

  it("rejects malformed instants", () => {
    expect(SeatQuerySchema.safeParse({ from: "2026-11-10", to }).success).toBe(false);
  });
});

describe("RoomQuerySchema", () => {
  it("trims keyword and drops empty strings", () => {
    expect(RoomQuerySchema.parse({ keyword: "  图书馆 " })).toEqual({ keyword: "图书馆" });
    expect(RoomQuerySchema.safeParse({ keyword: "   " }).success).toBe(false);
  });
});

describe("ClockTimeSchema", () => {
  it.each(["00:00", "08:30", "23:59"])("accepts %s", (v) => {
    expect(ClockTimeSchema.safeParse(v).success).toBe(true);
  });

  it.each(["24:00", "8:30", "12:60", "noon"])("rejects %s", (v) => {
    expect(ClockTimeSchema.safeParse(v).success).toBe(false);
  });
});

describe("RoomQuerySchema limits", () => {
  it("rejects keywords and buildings longer than 50 characters", () => {
    expect(RoomQuerySchema.safeParse({ keyword: "x".repeat(51) }).success).toBe(false);
    expect(RoomQuerySchema.safeParse({ building: "x".repeat(50) }).success).toBe(true);
  });
});
