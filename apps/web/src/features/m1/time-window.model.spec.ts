import { describe, expect, it } from "vitest";
import {
  ANY_HOURS,
  allowedSlots,
  clampToRoom,
  defaultSlots,
  defaultWindow,
  describeDay,
  describeWindow,
  findOverlapping,
  horizonRange,
  maxSlots,
  readWindow,
  sameWindow,
  windowRange,
  writeWindow,
} from "./time-window.model";

const settings = { maxHours: 4, slotMinutes: 60, timezone: "Asia/Shanghai" };
const room = { openFrom: "07:00", openTo: "22:30" };
const now = new Date("2026-11-10T01:30:00.000Z"); // Tue 09:30 Shanghai

describe("defaultWindow", () => {
  it("starts at the next slot boundary", () => {
    expect(defaultWindow(now, settings)).toEqual({ day: "2026-11-10", start: 10 * 60 });
  });

  it("rolls over to the next day after the last boundary", () => {
    const late = new Date("2026-11-10T15:30:00.000Z"); // 23:30 Shanghai
    expect(defaultWindow(late, settings)).toEqual({ day: "2026-11-11", start: 0 });
  });
});

describe("readWindow / writeWindow", () => {
  it("round-trips through the URL and keeps other params", () => {
    const window = { day: "2026-11-11", start: 14 * 60 };
    const params = writeWindow(new URLSearchParams("view=list"), window);
    expect(params.toString()).toBe("view=list&date=2026-11-11&start=14%3A00");
    expect(readWindow(params, settings, now)).toEqual(window);
  });

  it("falls back per field for missing or illegal values", () => {
    expect(readWindow(new URLSearchParams("date=2026-12-01&start=10:30"), settings, now)).toEqual(
      defaultWindow(now, settings),
    );
    expect(readWindow(new URLSearchParams("date=2026-11-12"), settings, now)).toEqual({
      day: "2026-11-12",
      start: 10 * 60,
    });
    expect(readWindow(new URLSearchParams("start=abc"), settings, now).start).toBe(10 * 60);
  });

  it("does not mutate the params it is given", () => {
    const original = new URLSearchParams("a=1");
    writeWindow(original, { day: "2026-11-10", start: 0 });
    expect(original.toString()).toBe("a=1");
  });
});

describe("clampToRoom", () => {
  it("keeps a start the room offers", () => {
    const window = { day: "2026-11-10", start: 10 * 60 };
    expect(clampToRoom(window, room, settings, now)).toEqual(window);
  });

  it("moves a start before opening or in the past to the nearest offered start", () => {
    expect(clampToRoom({ day: "2026-11-10", start: 8 * 60 }, room, settings, now)).toEqual({
      day: "2026-11-10",
      start: 9 * 60,
    });
    expect(clampToRoom({ day: "2026-11-11", start: 5 * 60 }, room, settings, now)).toEqual({
      day: "2026-11-11",
      start: 7 * 60,
    });
  });

  it("jumps to the next morning when today has no start left", () => {
    const evening = new Date("2026-11-10T14:30:00.000Z"); // 22:30 Shanghai
    expect(clampToRoom({ day: "2026-11-10", start: 22 * 60 }, room, settings, evening)).toEqual({
      day: "2026-11-11",
      start: 7 * 60,
    });
  });

  it("accepts any hour between 06:00 and midnight on the room list", () => {
    const window = { day: "2026-11-10", start: 22 * 60 };
    expect(clampToRoom(window, ANY_HOURS, settings, now)).toEqual(window);
  });
});

describe("ranges", () => {
  it("converts a window plus duration to UTC instants", () => {
    expect(windowRange({ day: "2026-11-10", start: 10 * 60 }, settings, 2)).toEqual({
      from: "2026-11-10T02:00:00.000Z",
      to: "2026-11-10T04:00:00.000Z",
    });
  });

  it("asks about the longest possible reservation for the floor plan", () => {
    expect(maxSlots(settings)).toBe(4);
    expect(horizonRange({ day: "2026-11-10", start: 10 * 60 }, settings)).toEqual({
      from: "2026-11-10T02:00:00.000Z",
      to: "2026-11-10T06:00:00.000Z",
    });
  });
});

describe("allowedSlots / defaultSlots", () => {
  const window = { day: "2026-11-10", start: 10 * 60 };

  it("offers up to the maximum when the seat stays free", () => {
    expect(allowedSlots(window, room, settings)).toEqual([1, 2, 3, 4]);
    expect(defaultSlots([1, 2, 3, 4])).toBe(2);
  });

  it("stops before the seat's next status", () => {
    const allowed = allowedSlots(window, room, settings, "2026-11-10T03:00:00.000Z"); // 11:00
    expect(allowed).toEqual([1]);
    expect(defaultSlots(allowed)).toBe(1);
  });

  it("stops before closing and offers nothing when the next slot is already taken", () => {
    expect(allowedSlots({ day: "2026-11-10", start: 21 * 60 }, room, settings)).toEqual([1]);
    expect(allowedSlots(window, room, settings, "2026-11-10T02:30:00.000Z")).toEqual([]);
    expect(defaultSlots([])).toBeUndefined();
  });
});

describe("labels", () => {
  it("names days relative to now with the weekday", () => {
    expect(describeDay("2026-11-10", now, settings.timezone)).toBe("今天 11/10 周二");
    expect(describeDay("2026-11-12", now, settings.timezone)).toBe("后天 11/12 周四");
  });

  it("formats a window with or without a duration", () => {
    const window = { day: "2026-11-10", start: 10 * 60 };
    expect(describeWindow(window, settings)).toBe("11/10 10:00 起");
    expect(describeWindow(window, settings, 2)).toBe("11/10 10:00–12:00");
  });

  it("compares windows by value", () => {
    const a = { day: "2026-11-10", start: 600 };
    expect(sameWindow(a, { ...a })).toBe(true);
    expect(sameWindow(a, { ...a, start: 660 })).toBe(false);
  });
});

describe("findOverlapping", () => {
  const range = { from: "2026-11-10T02:00:00.000Z", to: "2026-11-10T04:00:00.000Z" };
  const booked = (from: string, to: string, status = "BOOKED") => ({ status, from, to });

  it("finds a booked reservation that touches the range and ignores cancelled ones", () => {
    const hit = booked("2026-11-10T03:00:00.000Z", "2026-11-10T05:00:00.000Z");
    expect(findOverlapping([hit], range)).toBe(hit);
    expect(
      findOverlapping(
        [booked("2026-11-10T03:00:00.000Z", "2026-11-10T05:00:00.000Z", "CANCELLED")],
        range,
      ),
    ).toBeUndefined();
  });

  it("treats a reservation ending exactly at the start as non-overlapping", () => {
    expect(
      findOverlapping([booked("2026-11-10T00:00:00.000Z", "2026-11-10T02:00:00.000Z")], range),
    ).toBeUndefined();
  });
});
