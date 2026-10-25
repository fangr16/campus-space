import { describe, expect, it } from "vitest";
import {
  describeOutlet,
  describeSeat,
  gridLines,
  MAP_PADDING,
  outletKindLabel,
  roomViewBox,
} from "./seat-map.model";

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

  it("mentions power coverage only for covered seats", () => {
    expect(describeSeat({ code: "01", x: 2, y: 2, hasPowerOutlet: true })).toBe(
      "座位 01，位置 (2, 2)，在插座覆盖范围内",
    );
    expect(describeSeat({ code: "02", x: 4, y: 2, hasPowerOutlet: false })).toBe(
      "座位 02，位置 (4, 2)",
    );
  });
});
