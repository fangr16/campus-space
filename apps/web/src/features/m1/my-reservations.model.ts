import type { ReservationDto } from "@campus/contracts";

export interface ReservationGroups {
  /** Still valid and not yet over, soonest first. */
  upcoming: ReservationDto[];
  /** Cancelled or finished, latest first, capped. */
  history: ReservationDto[];
}

export const HISTORY_LIMIT = 20;

/** Splits the list the API returns (newest first) into what matters now and what is past. */
export function groupReservations(
  reservations: ReadonlyArray<ReservationDto>,
  now: Date,
): ReservationGroups {
  const isUpcoming = (r: ReservationDto) =>
    r.status === "BOOKED" && new Date(r.to).getTime() > now.getTime();
  const upcoming = reservations
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime());
  const history = reservations
    .filter((r) => !isUpcoming(r))
    .sort((a, b) => new Date(b.from).getTime() - new Date(a.from).getTime())
    .slice(0, HISTORY_LIMIT);
  return { upcoming, history };
}

/** "2 小时后开始" / "30 分钟后开始" / "进行中" for an upcoming card. */
export function describeStart(fromIso: string, toIso: string, now: Date): string {
  const from = new Date(fromIso).getTime();
  if (from <= now.getTime()) {
    return new Date(toIso).getTime() > now.getTime() ? "进行中" : "已结束";
  }
  const minutes = Math.round((from - now.getTime()) / 60_000);
  if (minutes < 60) return `${minutes} 分钟后开始`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时后开始`;
  return `${Math.floor(hours / 24)} 天后开始`;
}

/** A reservation may be cancelled while it is booked and has not started. */
export function canCancel(reservation: ReservationDto, now: Date): boolean {
  return reservation.status === "BOOKED" && new Date(reservation.from).getTime() > now.getTime();
}
