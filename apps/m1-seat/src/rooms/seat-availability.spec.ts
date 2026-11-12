import { describe, expect, it } from "vitest";
import { availabilityFor, type OverlappingStatus, windowOf } from "./seat-availability";

const from = new Date("2026-11-10T02:00:00.000Z");
const until = new Date("2026-11-10T04:00:00.000Z");
const row = (partial: Partial<OverlappingStatus>): OverlappingStatus => ({
  seatId: "s1",
  kind: "RESERVED",
  source: "M1_RESERVATION",
  refId: "r-other",
  from,
  to: until,
  ...partial,
});

describe("availabilityFor", () => {
  it("is FREE when no status touches the seat", () => {
    expect(availabilityFor("s1", [row({ seatId: "s2" })], new Set(), from)).toEqual({
      state: "FREE",
    });
  });

  it("is FREE until the earliest later status when the seat is only taken later", () => {
    const later = new Date("2026-11-10T05:00:00.000Z");
    const sooner = new Date("2026-11-10T03:00:00.000Z");
    expect(
      availabilityFor(
        "s1",
        [row({ from: later, to: new Date("2026-11-10T06:00:00.000Z") }), row({ from: sooner })],
        new Set(),
        from,
      ),
    ).toEqual({ state: "FREE", freeUntil: sooner.toISOString() });
  });

  it("is RESERVED for another student's reservation, with provenance and end time", () => {
    expect(availabilityFor("s1", [row({})], new Set(), from)).toEqual({
      state: "RESERVED",
      source: "M1_RESERVATION",
      refId: "r-other",
      until: until.toISOString(),
    });
  });

  it("is MINE when the reservation id belongs to the caller", () => {
    expect(
      availabilityFor("s1", [row({ refId: "r-mine" })], new Set(["r-mine"]), from),
    ).toMatchObject({ state: "MINE", refId: "r-mine" });
  });

  it("is BLOCKED for an M3 repair or M2 booking row", () => {
    expect(
      availabilityFor(
        "s1",
        [row({ kind: "BLOCKED", source: "M3_REPAIR", refId: "t1" })],
        new Set(),
        from,
      ),
    ).toMatchObject({ state: "BLOCKED", source: "M3_REPAIR" });
    expect(
      availabilityFor(
        "s1",
        [row({ kind: "BLOCKED", source: "M2_ROOM_BOOKING", refId: "b1" })],
        new Set(),
        from,
      ),
    ).toMatchObject({ state: "BLOCKED", source: "M2_ROOM_BOOKING" });
  });

  it("lets MINE win over BLOCKED and BLOCKED over RESERVED regardless of order", () => {
    const blocked = row({ kind: "BLOCKED", source: "M3_REPAIR", refId: "t1" });
    const mine = row({ refId: "r-mine" });
    const other = row({ refId: "r-other" });
    const ids = new Set(["r-mine"]);
    expect(availabilityFor("s1", [other, blocked], ids, from).state).toBe("BLOCKED");
    expect(availabilityFor("s1", [blocked, other], ids, from).state).toBe("BLOCKED");
    expect(availabilityFor("s1", [blocked, mine, other], ids, from).state).toBe("MINE");
    expect(availabilityFor("s1", [other, mine], ids, from).refId).toBe("r-mine");
  });

  it("ignores a stronger status that only begins later", () => {
    const laterBlock = row({
      kind: "BLOCKED",
      source: "M3_REPAIR",
      refId: "t1",
      from: new Date("2026-11-10T03:00:00.000Z"),
    });
    expect(availabilityFor("s1", [laterBlock, row({})], new Set(), from).state).toBe("RESERVED");
  });
});

describe("windowOf", () => {
  it("returns null without a window and parsed instants with one", () => {
    expect(windowOf({})).toBeNull();
    expect(windowOf({ from: "2026-11-10T10:00:00+08:00", to: "2026-11-10T04:00:00Z" })).toEqual({
      from: new Date("2026-11-10T02:00:00.000Z"),
      to: new Date("2026-11-10T04:00:00.000Z"),
    });
  });
});
