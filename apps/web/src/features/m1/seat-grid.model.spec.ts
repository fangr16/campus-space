import type { SeatDto } from "@campus/contracts";
import { describe, expect, it } from "vitest";
import { hasPowerParam, sortSeats, summarizeSeats } from "./seat-grid.model";

const seat = (code: string, hasPowerOutlet: boolean): SeatDto => ({
  id: code,
  roomId: "r",
  code,
  x: 0,
  y: 0,
  hasPowerOutlet,
  isActive: true,
});

describe("summarizeSeats", () => {
  const seats = [seat("01", true), seat("02", false), seat("03", true)];

  it("counts powered seats and shows all when unfiltered", () => {
    expect(summarizeSeats(seats, "all")).toEqual({ total: 3, powered: 2, shown: 3 });
  });

  it("shows only powered seats under the power filter", () => {
    expect(summarizeSeats(seats, "power")).toEqual({ total: 3, powered: 2, shown: 2 });
  });
});

describe("hasPowerParam", () => {
  it("maps the filter to the query parameter the API expects", () => {
    expect(hasPowerParam("power")).toBe("true");
    expect(hasPowerParam("all")).toBeUndefined();
  });
});

describe("sortSeats", () => {
  it("sorts numeric codes numerically, not lexically", () => {
    const sorted = sortSeats([seat("10", false), seat("2", false), seat("1", false)]);
    expect(sorted.map((s) => s.code)).toEqual(["1", "2", "10"]);
  });

  it("falls back to lexical order for non-numeric codes and does not mutate the input", () => {
    const input = [seat("B", false), seat("A", false)];
    expect(sortSeats(input).map((s) => s.code)).toEqual(["A", "B"]);
    expect(input[0]?.code).toBe("B");
  });
});
