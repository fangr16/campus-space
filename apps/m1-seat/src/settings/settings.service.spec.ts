import { describe, expect, it } from "vitest";
import { parseReservationSettings, SETTING_DEFAULTS, validateSetting } from "./settings.service";

describe("validateSetting", () => {
  it("accepts sensible values for every known key", () => {
    expect(validateSetting("reservation.maxHours", "4")).toBeNull();
    expect(validateSetting("reservation.slotMinutes", "30")).toBeNull();
    expect(validateSetting("room.timezone", "Asia/Shanghai")).toBeNull();
  });

  it("rejects out-of-range or malformed values with a reason", () => {
    expect(validateSetting("reservation.maxHours", "0")).toMatch(/1 to 12/);
    expect(validateSetting("reservation.maxHours", "2.5")).toMatch(/integer/);
    expect(validateSetting("reservation.slotMinutes", "45")).toMatch(/30 or 60/);
    expect(validateSetting("room.timezone", "Mars/Olympus")).toMatch(/IANA/);
  });

  it("rejects unknown keys", () => {
    expect(validateSetting("reservation.colour", "red")).toMatch(/unknown/);
  });
});

describe("parseReservationSettings", () => {
  it("falls back to the defaults when nothing is stored", () => {
    expect(parseReservationSettings([])).toEqual({
      maxHours: Number(SETTING_DEFAULTS["reservation.maxHours"]),
      slotMinutes: 60,
      timezone: "Asia/Shanghai",
    });
  });

  it("uses stored values where present", () => {
    expect(
      parseReservationSettings([
        { key: "reservation.maxHours", value: "2" },
        { key: "room.timezone", value: "UTC" },
      ]),
    ).toEqual({ maxHours: 2, slotMinutes: 60, timezone: "UTC" });
  });
});
