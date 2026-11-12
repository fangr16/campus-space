import { describe, expect, it } from "vitest";
import {
  buildWindow,
  dayOptions,
  describeRule,
  durationOptions,
  formatWindow,
  localDay,
  localMinutes,
  minutesToClock,
  parseFormSettings,
  startOptions,
  zonedToUtc,
} from "./reservation.model";

const settings = { maxHours: 4, slotMinutes: 60, timezone: "Asia/Shanghai" };
const room = { openFrom: "07:00", openTo: "22:30" };
const now = new Date("2026-11-10T01:30:00.000Z"); // 09:30 Shanghai

describe("parseFormSettings", () => {
  it("reads the three keys with defaults", () => {
    expect(parseFormSettings([])).toEqual(settings);
    expect(
      parseFormSettings([
        { key: "reservation.maxHours", value: "2", updatedAt: "2026-01-01T00:00:00.000Z" },
      ]).maxHours,
    ).toBe(2);
  });

  it("falls back for a malformed or non-positive number instead of yielding NaN", () => {
    const at = "2026-01-01T00:00:00.000Z";
    expect(
      parseFormSettings([
        { key: "reservation.slotMinutes", value: "abc", updatedAt: at },
        { key: "reservation.maxHours", value: "0", updatedAt: at },
      ]),
    ).toEqual(settings);
  });
});

describe("localMinutes", () => {
  it("reads the wall-clock minutes in the room zone", () => {
    expect(localMinutes(now, "Asia/Shanghai")).toBe(9 * 60 + 30);
    expect(localMinutes(new Date("2026-11-10T16:00:00.000Z"), "Asia/Shanghai")).toBe(0);
  });
});

describe("zone conversion", () => {
  it("maps a Shanghai local time to the UTC instant and back to the same day", () => {
    const at = zonedToUtc("2026-11-10", 10 * 60, "Asia/Shanghai");
    expect(at.toISOString()).toBe("2026-11-10T02:00:00.000Z");
    expect(localDay(at, "Asia/Shanghai")).toBe("2026-11-10");
  });

  it("handles a local midnight that is the previous day in UTC", () => {
    expect(zonedToUtc("2026-11-10", 0, "Asia/Shanghai").toISOString()).toBe(
      "2026-11-09T16:00:00.000Z",
    );
  });

  it("formats clocks", () => {
    expect(minutesToClock(7 * 60)).toBe("07:00");
    expect(minutesToClock(22 * 60 + 30)).toBe("22:30");
  });
});

describe("dayOptions", () => {
  it("offers today and the next two days in the room zone", () => {
    expect(dayOptions(now, "Asia/Shanghai")).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"]);
  });
});

describe("startOptions", () => {
  it("lists slot boundaries from opening until a full slot still fits before closing", () => {
    const tomorrow = startOptions("2026-11-11", room, settings, now);
    expect(tomorrow[0]).toBe(7 * 60);
    expect(tomorrow[tomorrow.length - 1]).toBe(21 * 60); // 21:00–22:00 fits, 22:00–23:00 does not
    expect(tomorrow).toHaveLength(15);
  });

  it("drops slots that already ended today but keeps the current one", () => {
    const today = startOptions("2026-11-10", room, settings, now);
    expect(today[0]).toBe(9 * 60); // 09:00–10:00 still running at 09:30
  });

  it("honours 30-minute slots", () => {
    const half = startOptions("2026-11-11", room, { ...settings, slotMinutes: 30 }, now);
    expect(half[0]).toBe(7 * 60);
    expect(half[half.length - 1]).toBe(22 * 60); // 22:00–22:30
  });
});

describe("durationOptions", () => {
  it("offers up to maxHours but never past closing", () => {
    expect(durationOptions(10 * 60, room, settings)).toEqual([1, 2, 3, 4]);
    expect(durationOptions(20 * 60, room, settings)).toEqual([1, 2]);
    expect(durationOptions(20 * 60, room, { ...settings, slotMinutes: 30 })).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });
});

describe("buildWindow", () => {
  it("produces UTC ISO strings for the chosen local window", () => {
    expect(buildWindow("2026-11-11", 10 * 60, 2, settings)).toEqual({
      from: "2026-11-11T02:00:00.000Z",
      to: "2026-11-11T04:00:00.000Z",
    });
  });
});

describe("describeRule", () => {
  it("explains known rules in Chinese and falls back otherwise", () => {
    expect(describeRule("seat-overlap", "x")).toContain("已被预约");
    expect(describeRule("nope", "fallback")).toBe("fallback");
    expect(describeRule(undefined, "fallback")).toBe("fallback");
  });
});

describe("formatWindow", () => {
  it("renders the window in the room zone", () => {
    expect(
      formatWindow("2026-11-11T02:00:00.000Z", "2026-11-11T04:00:00.000Z", "Asia/Shanghai"),
    ).toBe("11/11 10:00–12:00");
  });
});
