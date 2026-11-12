import type { PowerOutletDto, RoomDto, SeatAvailabilityState, SeatDto } from "@campus/contracts";

/** Padding around the room so wall outlets at x=0 or y=0 are not clipped. */
export const MAP_PADDING = 1;
/** Seat glyph size in grid units (a desk is roughly one unit wide). */
export const SEAT_SIZE = 1.4;
/**
 * Smallest pixel size of one grid unit. A seat is 1.4 units, so this keeps every seat at
 * least 44px wide, the usual minimum touch target; narrower screens scroll the map instead.
 */
export const MIN_UNIT_PX = 32;
/** Zoom steps offered by the +/- buttons; 1 fits the container width. */
export const ZOOM_LEVELS = [1, 1.5, 2, 3] as const;

/** SVG viewBox string covering the whole room plus padding. */
export function roomViewBox(room: Pick<RoomDto, "width" | "height">): string {
  const w = room.width + MAP_PADDING * 2;
  const h = room.height + MAP_PADDING * 2;
  return `${-MAP_PADDING} ${-MAP_PADDING} ${w} ${h}`;
}

/** Pixel width below which seats would fall under the touch-target minimum. */
export function minMapWidthPx(room: Pick<RoomDto, "width">): number {
  return (room.width + MAP_PADDING * 2) * MIN_UNIT_PX;
}

/** Next zoom level in the given direction, clamped to the available steps. */
export function stepZoom(current: number, direction: 1 | -1): number {
  const index = ZOOM_LEVELS.indexOf(current as (typeof ZOOM_LEVELS)[number]);
  const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, Math.max(index, 0) + direction));
  return ZOOM_LEVELS[next] ?? 1;
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

/** A seat's state in the current window; seats loaded without a window count as free. */
export function seatState(seat: Pick<SeatDto, "availability">): SeatAvailabilityState {
  return seat.availability?.state ?? "FREE";
}

/** Only free seats can be reserved and only the caller's own seats can be released. */
export function isSelectable(seat: Pick<SeatDto, "availability">): boolean {
  const state = seatState(seat);
  return state === "FREE" || state === "MINE";
}

export const STATE_LABEL: Record<SeatAvailabilityState, string> = {
  FREE: "空闲",
  MINE: "我的预约",
  RESERVED: "已被预约",
  BLOCKED: "不可用",
};

const SOURCE_LABEL = {
  M1_RESERVATION: "已被预约",
  M2_ROOM_BOOKING: "整教室预约占用",
  M3_REPAIR: "维修中",
} as const;

function clock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** "维修中，至 12:00" style text explaining why a seat cannot be taken (X-3 provenance). */
export function describeAvailability(
  seat: Pick<SeatDto, "availability">,
  timeZone: string,
): string {
  const availability = seat.availability;
  if (!availability) return STATE_LABEL.FREE;
  if (availability.state === "FREE") {
    return availability.freeUntil
      ? `${STATE_LABEL.FREE}，可约至 ${clock(availability.freeUntil, timeZone)}`
      : STATE_LABEL.FREE;
  }
  if (availability.state === "MINE") return STATE_LABEL.MINE;
  const reason = availability.source
    ? SOURCE_LABEL[availability.source]
    : STATE_LABEL[availability.state];
  return availability.until ? `${reason}，至 ${clock(availability.until, timeZone)}` : reason;
}

/** Accessible description of one seat. */
export function describeSeat(
  seat: Pick<SeatDto, "code" | "x" | "y" | "hasPowerOutlet" | "availability">,
  timeZone = "Asia/Shanghai",
): string {
  const power = seat.hasPowerOutlet ? "，在插座覆盖范围内" : "";
  const state = seat.availability ? `，${describeAvailability(seat, timeZone)}` : "";
  return `座位 ${seat.code}，位置 (${seat.x}, ${seat.y})${power}${state}`;
}

/** Button name announced for a selectable seat; occupied seats are not buttons. */
export function seatActionLabel(seat: Pick<SeatDto, "code" | "availability">): string | undefined {
  switch (seatState(seat)) {
    case "FREE":
      return `预约座位 ${seat.code}`;
    case "MINE":
      return `我的座位 ${seat.code}`;
    default:
      return undefined;
  }
}

export interface SeatGroup {
  state: SeatAvailabilityState;
  label: string;
  seats: SeatDto[];
}

const GROUP_ORDER: SeatAvailabilityState[] = ["FREE", "MINE", "RESERVED", "BLOCKED"];

/** Seats grouped for the list view: free first, then mine, then taken; empty groups dropped. */
export function groupSeatsByState(seats: ReadonlyArray<SeatDto>): SeatGroup[] {
  return GROUP_ORDER.map((state) => ({
    state,
    label: STATE_LABEL[state],
    seats: seats.filter((seat) => seatState(seat) === state),
  })).filter((group) => group.seats.length > 0);
}
