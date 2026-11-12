import { ReservationRule } from "@campus/contracts";
import { clockToMinutes } from "../rooms/room-visibility";

/** Parameters that administrators can tune (settings table, REQ-M1-04 "参数可调"). */
export interface ReservationSettings {
  /** Longest single reservation, in hours. */
  maxHours: number;
  /** Booking granularity, in minutes; reservations start and end on a slot boundary. */
  slotMinutes: number;
  /** IANA zone the rooms live in; opening hours are expressed in it. */
  timezone: string;
}

export interface ReservationWindow {
  from: Date;
  to: Date;
}

const MINUTE = 60_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

/** Calendar day and minutes since local midnight of an instant in the given zone. */
export function localParts(date: Date, timeZone: string): { day: string; minutes: number } {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(timeZone, fmt);
  }
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) if (p.type !== "literal") parts[p.type] = p.value;
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Start of the slot that contains `now`; a reservation may not begin before it. */
export function startOfCurrentSlot(now: Date, slotMinutes: number): Date {
  const slot = slotMinutes * MINUTE;
  return new Date(Math.floor(now.getTime() / slot) * slot);
}

function onSlotBoundary(date: Date, slotMinutes: number, timeZone: string): boolean {
  if (date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) return false;
  return localParts(date, timeZone).minutes % slotMinutes === 0;
}

/**
 * Checks a requested window against the booking rules of REQ-M1-04 and REQ-M1-02 and names
 * the first rule it breaks, or null when the window is acceptable. Pure: the caller passes
 * `now`, so every branch is unit-testable and the scheduler can reuse it.
 *
 * Order: shape (to after from) → slot alignment → duration bounds → not in the past →
 * inside opening hours on a single local day.
 */
export function validateReservationWindow(
  window: ReservationWindow,
  room: { openFrom: string; openTo: string },
  settings: ReservationSettings,
  now: Date,
): ReservationRule | null {
  const { from, to } = window;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return ReservationRule.DURATION;
  }
  if (
    !onSlotBoundary(from, settings.slotMinutes, settings.timezone) ||
    !onSlotBoundary(to, settings.slotMinutes, settings.timezone)
  ) {
    return ReservationRule.WHOLE_HOUR;
  }
  const minutes = (to.getTime() - from.getTime()) / MINUTE;
  if (minutes < settings.slotMinutes || minutes > settings.maxHours * 60) {
    return ReservationRule.DURATION;
  }
  if (from < startOfCurrentSlot(now, settings.slotMinutes)) return ReservationRule.IN_THE_PAST;

  const start = localParts(from, settings.timezone);
  const end = localParts(to, settings.timezone);
  if (start.day !== end.day) return ReservationRule.OPENING_HOURS;
  if (start.minutes < clockToMinutes(room.openFrom) || end.minutes > clockToMinutes(room.openTo)) {
    return ReservationRule.OPENING_HOURS;
  }
  return null;
}
