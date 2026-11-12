import {
  buildWindow,
  clockToMinutes,
  dayOptions,
  durationOptions,
  localDay,
  localMinutes,
  minutesToClock,
  type ReservationFormSettings,
  startOptions,
  zonedToUtc,
} from "./reservation.model";

/** When a student wants to start: a local day and minutes since midnight. */
export interface TimeWindow {
  day: string;
  start: number;
}

export interface OpeningHours {
  openFrom: string;
  openTo: string;
}

/** Preferred length of a new reservation, in slots (two hours at the default slot). */
export const DEFAULT_SLOTS = 2;

/** Used on the room list, where no single room's hours apply. */
export const ANY_HOURS: OpeningHours = { openFrom: "06:00", openTo: "24:00" };

const PARAM_DAY = "date";
const PARAM_START = "start";

/** Longest reservation the module allows, in slots. */
export function maxSlots(settings: ReservationFormSettings): number {
  return Math.max(1, Math.floor((settings.maxHours * 60) / settings.slotMinutes));
}

/** The next slot boundary after now: what a student most likely wants. */
export function defaultWindow(now: Date, settings: ReservationFormSettings): TimeWindow {
  const slot = settings.slotMinutes;
  const minutes = localMinutes(now, settings.timezone);
  const next = (Math.floor(minutes / slot) + 1) * slot;
  const rollsOver = next >= 24 * 60;
  const day = localDay(new Date(now.getTime() + (rollsOver ? 86_400_000 : 0)), settings.timezone);
  return { day, start: rollsOver ? 0 : next };
}

/**
 * Reads `?date=yyyy-mm-dd&start=HH:mm` from the URL; a missing or illegal part falls back to
 * the matching part of the default window, so a stale link still yields a usable view.
 */
export function readWindow(
  params: URLSearchParams,
  settings: ReservationFormSettings,
  now: Date,
): TimeWindow {
  const fallback = defaultWindow(now, settings);
  const days = dayOptions(now, settings.timezone);
  const day = params.get(PARAM_DAY) ?? "";
  const startText = params.get(PARAM_START) ?? "";
  const start = /^\d{2}:\d{2}$/.test(startText) ? clockToMinutes(startText) : Number.NaN;
  const legalStart =
    Number.isInteger(start) && start >= 0 && start < 1440 && start % settings.slotMinutes === 0;
  return {
    day: days.includes(day) ? day : fallback.day,
    start: legalStart ? start : fallback.start,
  };
}

/** New search params carrying the window; other params are preserved. */
export function writeWindow(params: URLSearchParams, window: TimeWindow): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set(PARAM_DAY, window.day);
  next.set(PARAM_START, minutesToClock(window.start));
  return next;
}

function nearest(options: number[], wanted: number): number | undefined {
  return [...options].sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted))[0];
}

/**
 * The closest start a room can actually offer: the nearest start the room lists on that day,
 * or the first start of the next day that has one.
 */
export function clampToRoom(
  window: TimeWindow,
  room: OpeningHours,
  settings: ReservationFormSettings,
  now: Date,
): TimeWindow {
  const days = dayOptions(now, settings.timezone);
  const from = Math.max(0, days.indexOf(window.day));
  for (const day of days.slice(from)) {
    const starts = startOptions(day, room, settings, now);
    // On the requested day stay close to the wish; a later day starts from the morning.
    const start =
      day !== window.day
        ? starts[0]
        : starts.includes(window.start)
          ? window.start
          : nearest(starts, window.start);
    if (start !== undefined) return { day, start };
  }
  return window;
}

export function sameWindow(a: TimeWindow, b: TimeWindow): boolean {
  return a.day === b.day && a.start === b.start;
}

/** UTC instants for a reservation of `slots` from the window's start. */
export function windowRange(
  window: TimeWindow,
  settings: ReservationFormSettings,
  slots: number,
): { from: string; to: string } {
  return buildWindow(window.day, window.start, slots, settings);
}

/** The longest span a reservation could cover: what the floor plan asks the API about. */
export function horizonRange(
  window: TimeWindow,
  settings: ReservationFormSettings,
): { from: string; to: string } {
  return windowRange(window, settings, maxSlots(settings));
}

/**
 * Durations (in slots) a student may pick for one seat: within the module maximum, before the
 * room closes, and before the seat's next status (`freeUntil`) when the API reported one.
 */
export function allowedSlots(
  window: TimeWindow,
  room: OpeningHours,
  settings: ReservationFormSettings,
  freeUntil?: string,
): number[] {
  const limit = freeUntil ? new Date(freeUntil).getTime() : Number.POSITIVE_INFINITY;
  return durationOptions(window.start, room, settings).filter(
    (n) =>
      zonedToUtc(
        window.day,
        window.start + n * settings.slotMinutes,
        settings.timezone,
      ).getTime() <= limit,
  );
}

/** The duration offered first: the preferred length, or the longest still allowed. */
export function defaultSlots(allowed: ReadonlyArray<number>): number | undefined {
  return allowed.includes(DEFAULT_SLOTS) ? DEFAULT_SLOTS : allowed.at(-1);
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** "今天 11/05 周四" style label for a day chip. */
export function describeDay(day: string, now: Date, timeZone: string): string {
  const days = dayOptions(now, timeZone);
  const relative = ["今天", "明天", "后天"][days.indexOf(day)] ?? "";
  const [y, m, d] = day.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? "";
  return `${relative} ${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")} ${weekday}`.trim();
}

/** "11/06 10:00 起", or "11/06 10:00–12:00" once a duration is known. */
export function describeWindow(
  window: TimeWindow,
  settings: ReservationFormSettings,
  slots?: number,
): string {
  const [, m, d] = window.day.split("-");
  const start = minutesToClock(window.start);
  if (slots === undefined) return `${m}/${d} ${start} 起`;
  return `${m}/${d} ${start}–${minutesToClock(window.start + slots * settings.slotMinutes)}`;
}

/** The caller's BOOKED reservation overlapping the range, if any (one seat per period rule). */
export function findOverlapping<T extends { status: string; from: string; to: string }>(
  reservations: ReadonlyArray<T>,
  range: { from: string; to: string },
): T | undefined {
  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  return reservations.find(
    (r) =>
      r.status === "BOOKED" && new Date(r.from).getTime() < to && new Date(r.to).getTime() > from,
  );
}
