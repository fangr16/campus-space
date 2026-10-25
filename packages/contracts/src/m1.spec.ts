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
