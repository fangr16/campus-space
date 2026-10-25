import { describe, expect, it } from "vitest";
import {
  applyDecision,
  canTransition,
  occupiesSeats,
  shouldExpire,
  TRANSITIONS,
} from "./booking-status";

describe("canTransition", () => {
  it("allows the documented transitions and nothing else", () => {
    expect(canTransition("PENDING", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "CANCELLED")).toBe(true);
    expect(canTransition("REJECTED", "APPROVED")).toBe(false);
    expect(canTransition("EXPIRED", "PENDING")).toBe(false);
  });

  it("treats REJECTED, CANCELLED and EXPIRED as terminal", () => {
    for (const terminal of ["REJECTED", "CANCELLED", "EXPIRED"] as const) {
      expect(TRANSITIONS[terminal]).toEqual([]);
    }
  });
});

describe("applyDecision", () => {
  it("approves a single-level booking on the first approval", () => {
    const next = applyDecision(
      { status: "PENDING", currentLevel: 1, requiredLevels: 1 },
      "APPROVED",
    );
    expect(next.status).toBe("APPROVED");
  });

  it("advances a two-level booking to level 2 and approves on the second approval", () => {
    const afterFirst = applyDecision(
      { status: "PENDING", currentLevel: 1, requiredLevels: 2 },
      "APPROVED",
    );
    expect(afterFirst).toEqual({ status: "PENDING", currentLevel: 2, requiredLevels: 2 });
    expect(applyDecision(afterFirst, "APPROVED").status).toBe("APPROVED");
  });

  it("rejects at any level and keeps the level for the record", () => {
    const next = applyDecision(
      { status: "PENDING", currentLevel: 2, requiredLevels: 3 },
      "REJECTED",
    );
    expect(next).toEqual({ status: "REJECTED", currentLevel: 2, requiredLevels: 3 });
  });

  it("refuses decisions on a booking that is not pending", () => {
    expect(() =>
      applyDecision({ status: "APPROVED", currentLevel: 1, requiredLevels: 1 }, "APPROVED"),
    ).toThrow("cannot decide a booking in status APPROVED");
  });

  it("does not mutate the input state", () => {
    const state = { status: "PENDING" as const, currentLevel: 1, requiredLevels: 2 };
    applyDecision(state, "APPROVED");
    expect(state.currentLevel).toBe(1);
  });
});

describe("shouldExpire", () => {
  const deadline = new Date("2026-11-01T12:00:00Z");

  it("expires a pending booking at or after the deadline, not before", () => {
    const pending = { status: "PENDING" as const, currentLevel: 1, requiredLevels: 1 };
    expect(shouldExpire(pending, deadline, new Date("2026-11-01T11:59:59Z"))).toBe(false);
    expect(shouldExpire(pending, deadline, deadline)).toBe(true);
  });

  it("never expires a booking that already left PENDING", () => {
    const approved = { status: "APPROVED" as const, currentLevel: 1, requiredLevels: 1 };
    expect(shouldExpire(approved, deadline, new Date("2026-12-01T00:00:00Z"))).toBe(false);
  });
});

describe("occupiesSeats", () => {
  it("only an approved booking blocks seats in M1", () => {
    expect(occupiesSeats("APPROVED")).toBe(true);
    for (const s of ["PENDING", "REJECTED", "CANCELLED", "EXPIRED"] as const) {
      expect(occupiesSeats(s)).toBe(false);
    }
  });
});
