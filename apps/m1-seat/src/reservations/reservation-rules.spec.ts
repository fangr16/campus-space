import { describe, expect, it } from "vitest";
import {
  localParts,
  type ReservationSettings,
  startOfCurrentSlot,
  validateReservationWindow,
} from "./reservation-rules";

const settings: ReservationSettings = { maxHours: 4, slotMinutes: 60, timezone: "Asia/Shanghai" };
const room = { openFrom: "07:00", openTo: "22:30" };
/** 2026-11-10 is a Tuesday; local 10:00 in Shanghai is 02:00Z. */
const now = new Date("2026-11-10T01:30:00.000Z");
const utc = (hhmm: string, day = "2026-11-10") => new Date(`${day}T${hhmm}:00.000Z`);
const check = (from: Date, to: Date) =>
  validateReservationWindow({ from, to }, room, settings, now);

describe("localParts", () => {
  it("converts an instant to the local day and minutes of the zone", () => {
    expect(localParts(utc("14:30"), "Asia/Shanghai")).toEqual({
      day: "2026-11-10",
      minutes: 22 * 60 + 30,
    });
    expect(localParts(utc("16:00"), "Asia/Shanghai")).toEqual({ day: "2026-11-11", minutes: 0 });
  });
});

describe("startOfCurrentSlot", () => {
  it("floors to the slot boundary", () => {
    expect(startOfCurrentSlot(now, 60).toISOString()).toBe("2026-11-10T01:00:00.000Z");
    expect(startOfCurrentSlot(now, 30).toISOString()).toBe("2026-11-10T01:30:00.000Z");
  });
});

describe("validateReservationWindow", () => {
  it("accepts a whole-hour window inside opening hours", () => {
    expect(check(utc("02:00"), utc("04:00"))).toBeNull();
  });

  it("accepts the edges of the opening hours (07:00 start, 22:30 end with 30-minute slots)", () => {
    expect(check(utc("23:00"), utc("01:00", "2026-11-11"))).toBeNull(); // 07:00–09:00 local next day
    const halfHour = { ...settings, slotMinutes: 30 };
    expect(
      validateReservationWindow({ from: utc("12:30"), to: utc("14:30") }, room, halfHour, now),
    ).toBeNull(); // 20:30–22:30
  });

  it("rejects an end before or equal to the start as a duration problem", () => {
    expect(check(utc("04:00"), utc("02:00"))).toBe("duration");
    expect(check(utc("02:00"), utc("02:00"))).toBe("duration");
  });

  it("rejects windows that do not start or end on the slot boundary", () => {
    expect(check(utc("02:30"), utc("04:00"))).toBe("whole-hour");
    expect(check(utc("02:00"), utc("03:45"))).toBe("whole-hour");
    expect(check(new Date("2026-11-10T02:00:30.000Z"), utc("04:00"))).toBe("whole-hour");
  });

  it("rejects windows longer than maxHours or shorter than one slot", () => {
    expect(check(utc("02:00"), utc("07:00"))).toBe("duration");
    const halfHour = { ...settings, slotMinutes: 30 };
    expect(
      validateReservationWindow({ from: utc("02:00"), to: utc("02:30") }, room, halfHour, now),
    ).toBeNull();
  });

  it("honours a smaller maxHours set by the administrator", () => {
    expect(
      validateReservationWindow(
        { from: utc("02:00"), to: utc("05:00") },
        room,
        { ...settings, maxHours: 2 },
        now,
      ),
    ).toBe("duration");
  });

  it("rejects windows that start before the current slot but allows the current slot", () => {
    expect(check(utc("00:00"), utc("02:00"))).toBe("in-the-past");
    expect(check(utc("01:00"), utc("03:00"))).toBeNull();
  });

  it("rejects windows outside opening hours or crossing local midnight", () => {
    expect(check(utc("22:00"), utc("00:00", "2026-11-11"))).toBe("opening-hours"); // 06:00–08:00 local next day
    expect(check(utc("13:00"), utc("15:00"))).toBe("opening-hours"); // 21:00–23:00 local
    expect(check(utc("15:00"), utc("17:00"))).toBe("opening-hours"); // 23:00–01:00 local, next day
  });
});
