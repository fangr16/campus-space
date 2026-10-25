import { describe, expect, it } from "vitest";
import {
  assertTransition,
  blocksRoomSeats,
  canTransition,
  isOverdue,
  TRANSITIONS,
} from "./ticket-status";

describe("canTransition", () => {
  it("follows the happy path report → dispatch → in progress → done → accepted", () => {
    expect(canTransition("REPORTED", "DISPATCHED")).toBe(true);
    expect(canTransition("DISPATCHED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "DONE")).toBe(true);
    expect(canTransition("DONE", "ACCEPTED")).toBe(true);
  });

  it("allows rework after a failed acceptance and only back into progress", () => {
    expect(canTransition("DONE", "REWORK")).toBe(true);
    expect(canTransition("REWORK", "IN_PROGRESS")).toBe(true);
    expect(canTransition("REWORK", "DONE")).toBe(false);
  });

  it("never reopens accepted or cancelled tickets", () => {
    expect(TRANSITIONS.ACCEPTED).toEqual([]);
    expect(TRANSITIONS.CANCELLED).toEqual([]);
    expect(canTransition("ACCEPTED", "REWORK")).toBe(false);
  });

  it("does not let a reported ticket jump straight to done", () => {
    expect(canTransition("REPORTED", "DONE")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("returns the target status for a legal move", () => {
    expect(assertTransition("REPORTED", "DISPATCHED")).toBe("DISPATCHED");
  });

  it("names both states when the move is illegal", () => {
    expect(() => assertTransition("ACCEPTED", "IN_PROGRESS")).toThrow(
      "ticket cannot go from ACCEPTED to IN_PROGRESS",
    );
  });
});

describe("blocksRoomSeats", () => {
  it("blocks seats while work is in progress, escalated or being reworked", () => {
    expect(blocksRoomSeats("IN_PROGRESS")).toBe(true);
    expect(blocksRoomSeats("ESCALATED")).toBe(true);
    expect(blocksRoomSeats("REWORK")).toBe(true);
  });

  it("does not block before dispatch or after acceptance", () => {
    for (const s of ["REPORTED", "DISPATCHED", "DONE", "ACCEPTED", "CANCELLED"] as const) {
      expect(blocksRoomSeats(s)).toBe(false);
    }
  });
});

describe("isOverdue", () => {
  const due = new Date("2026-11-01T12:00:00Z");

  it("is overdue only after the deadline for an active stage", () => {
    expect(
      isOverdue({ status: "DISPATCHED", slaDueAt: due }, new Date("2026-11-01T12:00:00Z")),
    ).toBe(false);
    expect(
      isOverdue({ status: "DISPATCHED", slaDueAt: due }, new Date("2026-11-01T12:00:01Z")),
    ).toBe(true);
  });

  it("ignores tickets without a deadline or already escalated, done or closed", () => {
    const late = new Date("2026-12-01T00:00:00Z");
    expect(isOverdue({ status: "DISPATCHED", slaDueAt: null }, late)).toBe(false);
    expect(isOverdue({ status: "ESCALATED", slaDueAt: due }, late)).toBe(false);
    expect(isOverdue({ status: "ACCEPTED", slaDueAt: due }, late)).toBe(false);
  });
});
