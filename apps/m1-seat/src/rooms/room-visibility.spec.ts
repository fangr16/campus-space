import { type JwtPayload, Role } from "@campus/contracts";
import { describe, expect, it } from "vitest";
import {
  canSeeRoom,
  clockToMinutes,
  isWithinOpeningHours,
  roomVisibilityFor,
} from "./room-visibility";

const user = (roles: Role[], departmentId: string | null): JwtPayload => ({
  sub: "u",
  username: "u",
  displayName: "U",
  roles,
  departmentId,
});

describe("roomVisibilityFor", () => {
  it("lets room managers, ops managers and admins see every room", () => {
    for (const role of [Role.ROOM_MANAGER, Role.OPS_MANAGER, Role.ADMIN]) {
      expect(roomVisibilityFor(user([role], null))).toEqual({ all: true });
    }
  });

  it("limits a student to campus rooms plus their own department", () => {
    expect(roomVisibilityFor(user([Role.STUDENT], "CS"))).toEqual({
      all: false,
      departmentIds: ["CS"],
    });
  });

  it("gives a student without a department only campus rooms", () => {
    expect(roomVisibilityFor(user([Role.STUDENT], null))).toEqual({
      all: false,
      departmentIds: [],
    });
  });

  it("treats a mixed-role user by the strongest role", () => {
    expect(roomVisibilityFor(user([Role.STUDENT, Role.ADMIN], "CS"))).toEqual({ all: true });
  });
});

describe("canSeeRoom", () => {
  const cs = roomVisibilityFor(user([Role.STUDENT], "CS"));

  it("allows campus-wide rooms for everyone", () => {
    expect(canSeeRoom(cs, null)).toBe(true);
  });

  it("allows the caller's own department room and denies another department's", () => {
    expect(canSeeRoom(cs, "CS")).toBe(true);
    expect(canSeeRoom(cs, "EE")).toBe(false);
  });

  it("allows everything for staff", () => {
    expect(canSeeRoom({ all: true }, "EE")).toBe(true);
  });
});

describe("clockToMinutes", () => {
  it.each([
    ["00:00", 0],
    ["08:30", 510],
    ["22:30", 1350],
  ])("converts %s to %i", (clock, minutes) => {
    expect(clockToMinutes(clock)).toBe(minutes);
  });
});

describe("isWithinOpeningHours", () => {
  const room = { openFrom: "08:00", openTo: "22:00" };

  it("accepts a window fully inside opening hours, including the edges", () => {
    expect(isWithinOpeningHours(room, "08:00", "12:00")).toBe(true);
    expect(isWithinOpeningHours(room, "18:00", "22:00")).toBe(true);
  });

  it("rejects windows that start before opening or end after closing", () => {
    expect(isWithinOpeningHours(room, "07:00", "09:00")).toBe(false);
    expect(isWithinOpeningHours(room, "20:00", "23:00")).toBe(false);
  });

  it("rejects empty or inverted windows", () => {
    expect(isWithinOpeningHours(room, "10:00", "10:00")).toBe(false);
    expect(isWithinOpeningHours(room, "12:00", "10:00")).toBe(false);
  });
});
