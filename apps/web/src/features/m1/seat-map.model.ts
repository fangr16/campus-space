import type { PowerOutletDto, RoomDto } from "@campus/contracts";

/** Padding around the room so wall outlets at x=0 or y=0 are not clipped. */
export const MAP_PADDING = 1;
/** Seat glyph size in grid units (a desk is roughly one unit wide). */
export const SEAT_SIZE = 1.4;
/** Pixel height the map may grow to before it scrolls horizontally instead. */
export const MAP_MAX_HEIGHT_PX = 560;

/** SVG viewBox string covering the whole room plus padding. */
export function roomViewBox(room: Pick<RoomDto, "width" | "height">): string {
  const w = room.width + MAP_PADDING * 2;
  const h = room.height + MAP_PADDING * 2;
  return `${-MAP_PADDING} ${-MAP_PADDING} ${w} ${h}`;
}

/** Grid lines every unit, used as a faint backdrop so positions read as a plan. */
export function gridLines(room: Pick<RoomDto, "width" | "height">): {
  vertical: number[];
  horizontal: number[];
} {
  return {
    vertical: Array.from({ length: room.width + 1 }, (_, i) => i),
    horizontal: Array.from({ length: room.height + 1 }, (_, i) => i),
  };
}

export function outletKindLabel(kind: PowerOutletDto["kind"]): string {
  return kind === "RAIL" ? "导轨插座" : "固定插座";
}

/** Accessible description of one outlet, also used as its tooltip. */
export function describeOutlet(outlet: PowerOutletDto): string {
  return `${outletKindLabel(outlet.kind)} ${outlet.code}，位置 (${outlet.x}, ${outlet.y})，可用范围 ${outlet.range} 格`;
}

/** Accessible description of one seat. */
export function describeSeat(seat: {
  code: string;
  x: number;
  y: number;
  hasPowerOutlet: boolean;
}): string {
  return `座位 ${seat.code}，位置 (${seat.x}, ${seat.y})${seat.hasPowerOutlet ? "，在插座覆盖范围内" : ""}`;
}
