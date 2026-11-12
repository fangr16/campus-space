import {
  type SeatAvailability,
  SeatAvailabilityState,
  type SeatStatusKind,
  type SeatStatusSource,
} from "@campus/contracts";

/** A seat_statuses row that overlaps the requested window, as the repository returns it. */
export interface OverlappingStatus {
  seatId: string;
  kind: SeatStatusKind;
  source: SeatStatusSource;
  refId: string;
  from: Date;
  to: Date;
}

/** Inclusive-exclusive window [from, to) in UTC. */
export interface TimeRange {
  from: Date;
  to: Date;
}

/** Strength of a state when several statuses overlap the window. */
function rank(state: SeatAvailability["state"]): number {
  switch (state) {
    case "MINE":
      return 3;
    case "BLOCKED":
      return 2;
    case "RESERVED":
      return 1;
    default:
      return 0;
  }
}

function stateOf(status: OverlappingStatus, mine: ReadonlySet<string>): SeatAvailability["state"] {
  if (status.source === "M1_RESERVATION" && mine.has(status.refId)) {
    return SeatAvailabilityState.MINE;
  }
  return status.kind === "BLOCKED" ? SeatAvailabilityState.BLOCKED : SeatAvailabilityState.RESERVED;
}

/**
 * What one seat means to the caller at `from` (REQ-M1-11). Statuses already running at `from`
 * decide the state; when several do, the strongest wins: MINE > BLOCKED > RESERVED, and the
 * winner's `until` lets the UI say "占用至 12:00". Without one the seat is FREE, and the
 * earliest later status inside the window becomes `freeUntil`, which bounds the duration a
 * student may pick.
 */
export function availabilityFor(
  seatId: string,
  statuses: ReadonlyArray<OverlappingStatus>,
  mineReservationIds: ReadonlySet<string>,
  from: Date,
): SeatAvailability {
  let best: SeatAvailability | null = null;
  let nextStart: Date | null = null;
  for (const status of statuses) {
    if (status.seatId !== seatId) continue;
    if (status.from > from) {
      if (!nextStart || status.from < nextStart) nextStart = status.from;
      continue;
    }
    const state = stateOf(status, mineReservationIds);
    if (!best || rank(state) > rank(best.state)) {
      best = { state, source: status.source, refId: status.refId, until: status.to.toISOString() };
    }
  }
  if (best) return best;
  return nextStart
    ? { state: SeatAvailabilityState.FREE, freeUntil: nextStart.toISOString() }
    : { state: SeatAvailabilityState.FREE };
}

/** The window of a validated query, or null when the caller asked for no availability. */
export function windowOf(query: { from?: string; to?: string }): TimeRange | null {
  if (query.from === undefined || query.to === undefined) return null;
  return { from: new Date(query.from), to: new Date(query.to) };
}
