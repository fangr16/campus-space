import { type ReservationRule, type SettingDto, SettingKey } from "@campus/contracts";

/** Parameters the reservation form needs, parsed from GET /api/m1/settings. */
export interface ReservationFormSettings {
  maxHours: number;
  slotMinutes: number;
  timezone: string;
}

/** Reads the three keys; a missing or malformed number falls back so the form never offers nothing. */
export function parseFormSettings(settings: ReadonlyArray<SettingDto>): ReservationFormSettings {
  const get = (key: string, fallback: string) =>
    settings.find((s) => s.key === key)?.value ?? fallback;
  const positive = (key: string, fallback: number) => {
    const value = Number(get(key, String(fallback)));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    maxHours: positive(SettingKey.RESERVATION_MAX_HOURS, 4),
    slotMinutes: positive(SettingKey.RESERVATION_SLOT_MINUTES, 60),
    timezone: get(SettingKey.ROOM_TIMEZONE, "Asia/Shanghai"),
  };
}

/** "HH:mm" to minutes since midnight. */
export function clockToMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Calendar day (yyyy-mm-dd) of an instant in the given zone. */
export function localDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Minutes since local midnight of an instant in the given zone. */
export function localMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** Offset of a zone from UTC, in minutes, at the given instant. */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The instant that corresponds to `day` at `minutes` past midnight in `timeZone`. Two passes
 * handle the (rare) case where the offset differs between the guess and the real instant.
 */
export function zonedToUtc(day: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const naive = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, minutes);
  let guess = new Date(naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60_000);
  guess = new Date(naive - zoneOffsetMinutes(guess, timeZone) * 60_000);
  return guess;
}

/** The days a student may pick: today and the next two days, as yyyy-mm-dd in the room zone. */
export function dayOptions(now: Date, timeZone: string, count = 3): string[] {
  return Array.from({ length: count }, (_, i) =>
    localDay(new Date(now.getTime() + i * 86_400_000), timeZone),
  );
}

/**
 * Start times (minutes since local midnight) a student may pick on `day`: slot boundaries from
 * opening to closing minus one slot, excluding anything before the current slot today.
 */
export function startOptions(
  day: string,
  room: { openFrom: string; openTo: string },
  settings: ReservationFormSettings,
  now: Date,
): number[] {
  const open = clockToMinutes(room.openFrom);
  const close = clockToMinutes(room.openTo);
  const first = Math.ceil(open / settings.slotMinutes) * settings.slotMinutes;
  const options: number[] = [];
  for (let t = first; t + settings.slotMinutes <= close; t += settings.slotMinutes) {
    const instant = zonedToUtc(day, t, settings.timezone);
    if (instant.getTime() + settings.slotMinutes * 60_000 > now.getTime()) options.push(t);
  }
  return options;
}

/** Durations (in slots) allowed from a start time: up to maxHours and not past closing. */
export function durationOptions(
  start: number,
  room: { openTo: string },
  settings: ReservationFormSettings,
): number[] {
  const close = clockToMinutes(room.openTo);
  const maxSlots = Math.floor((settings.maxHours * 60) / settings.slotMinutes);
  const result: number[] = [];
  for (let n = 1; n <= maxSlots; n += 1) {
    if (start + n * settings.slotMinutes > close) break;
    result.push(n);
  }
  return result;
}

/** Builds the API payload for a chosen day, start and number of slots. */
export function buildWindow(
  day: string,
  start: number,
  slots: number,
  settings: ReservationFormSettings,
): { from: string; to: string } {
  return {
    from: zonedToUtc(day, start, settings.timezone).toISOString(),
    to: zonedToUtc(day, start + slots * settings.slotMinutes, settings.timezone).toISOString(),
  };
}

const RULE_MESSAGES: Record<ReservationRule, string> = {
  "whole-hour": "预约必须从时段边界开始和结束（默认整点）",
  duration: "时长不符合要求：至少一个时段，且不超过上限",
  "opening-hours": "所选时间不在自习室开放时间内",
  "in-the-past": "不能预约已经过去的时间",
  "user-overlap": "你在该时段已经持有一个座位",
  "seat-overlap": "该座位在此时段已被预约",
  "not-booked": "这条预约已不是有效状态",
  "already-started": "预约已经开始，不能取消",
};

/** Human-readable explanation of a rule name from error.details.rule. */
export function describeRule(rule: unknown, fallback: string): string {
  return typeof rule === "string" && rule in RULE_MESSAGES
    ? RULE_MESSAGES[rule as ReservationRule]
    : fallback;
}

/** "11-06 10:00–12:00" style label in the room zone for lists. */
export function formatWindow(fromIso: string, toIso: string, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const time = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${fmt.format(new Date(fromIso))}–${time.format(new Date(toIso))}`;
}
