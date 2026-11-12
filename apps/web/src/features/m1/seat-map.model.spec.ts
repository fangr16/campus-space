import type { SeatDto } from "@campus/contracts";
import { describe, expect, it } from "vitest";
import {
  describeAvailability,
  describeOutlet,
  describeSeat,
  gridLines,
  groupSeatsByState,
  isSelectable,
  MAP_PADDING,
  MIN_UNIT_PX,
  minMapWidthPx,
  outletKindLabel,
  roomViewBox,
  SEAT_SIZE,
  seatActionLabel,
  stepZoom,
} from "./seat-map.model";

const seat = (code: string, availability?: SeatDto["availability"]): SeatDto => ({
  id: `s${code}`,
  roomId: "r",
  code,
  x: 1,
  y: 1,
  hasPowerOutlet: false,
  isActive: true,
  availability,
});
const until = "2026-11-10T04:00:00.000Z"; // 12:00 Shanghai

describe("roomViewBox", () => {
  it("pads the room on every side so wall outlets stay visible", () => {
    expect(roomViewBox({ width: 18, height: 12 })).toBe(
      `${-MAP_PADDING} ${-MAP_PADDING} ${18 + 2 * MAP_PADDING} ${12 + 2 * MAP_PADDING}`,
    );
  });
});

describe("gridLines", () => {
  it("returns one line per unit including both edges", () => {
    const lines = gridLines({ width: 3, height: 2 });
    expect(lines.vertical).toEqual([0, 1, 2, 3]);
    expect(lines.horizontal).toEqual([0, 1, 2]);
  });
});

describe("zoom", () => {
  it("keeps every seat at least 44px wide at the minimum map width", () => {
    expect(minMapWidthPx({ width: 18 })).toBe(20 * MIN_UNIT_PX);
    expect(SEAT_SIZE * MIN_UNIT_PX).toBeGreaterThanOrEqual(44);
  });

  it("steps through the zoom levels and stops at both ends", () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(3, 1)).toBe(3);
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(2, -1)).toBe(1.5);
    expect(stepZoom(1.7, 1)).toBe(1.5);
  });
});

describe("availability", () => {
  it("lets only free and own seats be selected", () => {
    expect(isSelectable(seat("01"))).toBe(true);
    expect(isSelectable(seat("01", { state: "FREE" }))).toBe(true);
    expect(isSelectable(seat("01", { state: "MINE", refId: "r1" }))).toBe(true);
    expect(isSelectable(seat("01", { state: "RESERVED" }))).toBe(false);
    expect(isSelectable(seat("01", { state: "BLOCKED" }))).toBe(false);
  });

  it("explains the occupying source and its end in the room zone", () => {
    const tz = "Asia/Shanghai";
    expect(describeAvailability(seat("01"), tz)).toBe("空闲");
    expect(describeAvailability(seat("01", { state: "FREE", freeUntil: until }), tz)).toBe(
      "空闲，可约至 12:00",
    );
    expect(describeAvailability(seat("01", { state: "MINE" }), tz)).toBe("我的预约");
    expect(
      describeAvailability(seat("01", { state: "RESERVED", source: "M1_RESERVATION", until }), tz),
    ).toBe("已被预约，至 12:00");
    expect(
      describeAvailability(seat("01", { state: "BLOCKED", source: "M3_REPAIR", until }), tz),
    ).toBe("维修中，至 12:00");
    expect(
      describeAvailability(seat("01", { state: "BLOCKED", source: "M2_ROOM_BOOKING" }), tz),
    ).toBe("整教室预约占用");
  });

  it("names the button by what clicking it does", () => {
    expect(seatActionLabel(seat("05"))).toBe("预约座位 05");
    expect(seatActionLabel(seat("05", { state: "MINE" }))).toBe("我的座位 05");
    expect(seatActionLabel(seat("05", { state: "RESERVED" }))).toBeUndefined();
  });

  it("groups seats free, mine, reserved, blocked and drops empty groups", () => {
    const groups = groupSeatsByState([
      seat("03", { state: "RESERVED" }),
      seat("01"),
      seat("02", { state: "MINE" }),
    ]);
    expect(groups.map((g) => [g.label, g.seats.map((s) => s.code)])).toEqual([
      ["空闲", ["01"]],
      ["我的预约", ["02"]],
      ["已被预约", ["03"]],
    ]);
  });
});

describe("labels", () => {
  it("names both outlet kinds in Chinese", () => {
    expect(outletKindLabel("FIXED")).toBe("固定插座");
    expect(outletKindLabel("RAIL")).toBe("导轨插座");
  });

  it("describes an outlet with position and reach", () => {
    expect(
      describeOutlet({ id: "o", roomId: "r", code: "R1", kind: "RAIL", x: 9, y: 6, range: 3 }),
    ).toBe("导轨插座 R1，位置 (9, 6)，可用范围 3 格");
  });

  it("mentions power coverage only for covered seats and state only with a window", () => {
    expect(describeSeat({ code: "01", x: 2, y: 2, hasPowerOutlet: true })).toBe(
      "座位 01，位置 (2, 2)，在插座覆盖范围内",
    );
    expect(describeSeat({ code: "02", x: 4, y: 2, hasPowerOutlet: false })).toBe(
      "座位 02，位置 (4, 2)",
    );
    expect(
      describeSeat({
        code: "03",
        x: 4,
        y: 2,
        hasPowerOutlet: false,
        availability: { state: "BLOCKED", source: "M3_REPAIR", until },
      }),
    ).toBe("座位 03，位置 (4, 2)，维修中，至 12:00");
  });
});
