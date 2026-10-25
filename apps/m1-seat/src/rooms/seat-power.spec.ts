import type { PowerOutletDto, SeatDto } from "@campus/contracts";
import { describe, expect, it } from "vitest";
import { isCoveredBy, squaredDistance, withDerivedPower } from "./seat-power";

const seat = (code: string, x: number, y: number): SeatDto => ({
  id: code,
  roomId: "r",
  code,
  x,
  y,
  hasPowerOutlet: false,
  isActive: true,
});

const outlet = (code: string, x: number, y: number, range: number): PowerOutletDto => ({
  id: code,
  roomId: "r",
  code,
  kind: "FIXED",
  x,
  y,
  range,
});

describe("squaredDistance", () => {
  it("is zero for the same point and symmetric", () => {
    expect(squaredDistance({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(0);
    expect(squaredDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
    expect(squaredDistance({ x: 3, y: 4 }, { x: 0, y: 0 })).toBe(25);
  });
});

describe("isCoveredBy", () => {
  const o = outlet("o1", 5, 5, 2);

  it("covers a seat strictly inside the range", () => {
    expect(isCoveredBy({ x: 6, y: 6 }, o)).toBe(true);
  });

  it("covers a seat exactly on the boundary", () => {
    expect(isCoveredBy({ x: 7, y: 5 }, o)).toBe(true);
  });

  it("does not cover a seat just outside the range", () => {
    expect(isCoveredBy({ x: 7, y: 6 }, o)).toBe(false);
    expect(isCoveredBy({ x: 8, y: 5 }, o)).toBe(false);
  });

  it("treats range as inclusive even for range 1 (adjacent desk)", () => {
    expect(isCoveredBy({ x: 2, y: 2 }, outlet("wall", 1, 2, 1))).toBe(true);
    expect(isCoveredBy({ x: 3, y: 2 }, outlet("wall", 1, 2, 1))).toBe(false);
  });
});

describe("withDerivedPower", () => {
  const seats = [seat("01", 2, 2), seat("02", 6, 2), seat("03", 9, 6)];

  it("flags seats covered by any outlet and leaves the rest false", () => {
    const flagged = withDerivedPower(seats, [outlet("a", 1, 2, 1), outlet("b", 9, 7, 1)]);
    expect(flagged.map((s) => [s.code, s.hasPowerOutlet])).toEqual([
      ["01", true],
      ["02", false],
      ["03", true],
    ]);
  });

  it("ignores a stored hasPowerOutlet value: outlets are the only source of truth", () => {
    const stale = [{ ...seat("01", 2, 2), hasPowerOutlet: true }];
    expect(withDerivedPower(stale, [])[0]?.hasPowerOutlet).toBe(false);
  });

  it("does not mutate the input seats", () => {
    const input = [seat("01", 2, 2)];
    withDerivedPower(input, [outlet("a", 2, 2, 1)]);
    expect(input[0]?.hasPowerOutlet).toBe(false);
  });
});
