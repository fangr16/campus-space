import type { JwtPayload, RepairTicketDto, TicketEventDto } from "@campus/contracts";
import { describe, expect, it } from "vitest";
import { availableActions, describeEvent, describeLocation, formatM3Time } from "./tickets.model";

const ticket = (overrides: Partial<RepairTicketDto> = {}): RepairTicketDto => ({
  id: "t1",
  roomId: "room-1",
  seatId: null,
  reporterId: "student",
  category: "LIGHT",
  description: "broken",
  photoRef: null,
  status: "REPORTED",
  priority: "NORMAL",
  rating: null,
  assigneeId: null,
  slaDueAt: null,
  createdAt: "2030-01-01T09:00:00.000Z",
  updatedAt: "2030-01-01T09:00:00.000Z",
  ...overrides,
});

const caller = (sub: string, ...roles: string[]): Pick<JwtPayload, "sub" | "roles"> => ({
  sub,
  roles: roles as JwtPayload["roles"],
});

describe("availableActions", () => {
  it("offers dispatch to staff on reported and escalated tickets only", () => {
    expect(availableActions(ticket({ status: "REPORTED" }), caller("admin", "admin"))).toEqual([
      "dispatch",
    ]);
    expect(
      availableActions(ticket({ status: "ESCALATED" }), caller("worker", "maintainer")),
    ).toEqual(["dispatch"]);
    expect(availableActions(ticket({ status: "IN_PROGRESS" }), caller("admin", "admin"))).toEqual(
      [],
    );
    expect(availableActions(ticket(), caller("student", "student"))).toEqual([]);
  });

  it("offers work actions only to the assigned maintainer", () => {
    expect(
      availableActions(
        ticket({ status: "DISPATCHED", assigneeId: "worker" }),
        caller("worker", "maintainer"),
      ),
    ).toEqual(["start"]);
    expect(
      availableActions(
        ticket({ status: "IN_PROGRESS", assigneeId: "worker" }),
        caller("worker", "maintainer"),
      ),
    ).toEqual(["complete"]);
    expect(
      availableActions(
        ticket({ status: "REWORK", assigneeId: "worker" }),
        caller("other", "maintainer"),
      ),
    ).toEqual([]);
  });

  it("offers acceptance only to the reporter on a completed ticket", () => {
    expect(
      availableActions(
        ticket({ status: "DONE", reporterId: "student" }),
        caller("student", "student"),
      ),
    ).toEqual(["accept", "reject"]);
    expect(
      availableActions(
        ticket({ status: "DONE", reporterId: "student" }),
        caller("other", "student"),
      ),
    ).toEqual([]);
  });
});

describe("formatting helpers", () => {
  it("describes room-level and seat-level locations", () => {
    expect(describeLocation(ticket())).toBe("room-1 · 整室");
    expect(describeLocation(ticket({ seatId: "seat-9" }))).toBe("room-1 · seat-9");
  });

  it("formats UTC timestamps and handles a missing deadline", () => {
    expect(formatM3Time("2030-01-01T09:30:00.000Z")).toBe("2030-01-01 09:30 UTC");
    expect(formatM3Time(null)).toBe("—");
  });

  it("renders an event with its note when present", () => {
    const event: TicketEventDto = {
      id: "e1",
      ticketId: "t1",
      fromStatus: "DONE",
      toStatus: "REWORK",
      actorId: "student",
      note: "仍未修好",
      createdAt: "2030-01-01T10:00:00.000Z",
    };
    expect(describeEvent(event)).toBe("待验收 → 返工中（仍未修好）");
  });
});
