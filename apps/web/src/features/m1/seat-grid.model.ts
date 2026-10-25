import type { SeatDto } from "@campus/contracts";

export type PowerFilter = "all" | "power";

export interface SeatGridSummary {
  total: number;
  powered: number;
  shown: number;
}

/** Counts shown in the seats page header; pure so it is unit tested. */
export function summarizeSeats(
  seats: ReadonlyArray<SeatDto>,
  filter: PowerFilter,
): SeatGridSummary {
  const powered = seats.filter((s) => s.hasPowerOutlet).length;
  return {
    total: seats.length,
    powered,
    shown: filter === "power" ? powered : seats.length,
  };
}

/** Query string value for GET /rooms/:id/seats; `undefined` means no filter. */
export function hasPowerParam(filter: PowerFilter): "true" | undefined {
  return filter === "power" ? "true" : undefined;
}

/** Seats sorted by their numeric code when possible, otherwise lexically. */
export function sortSeats(seats: ReadonlyArray<SeatDto>): SeatDto[] {
  return [...seats].sort((a, b) => {
    const na = Number(a.code);
    const nb = Number(b.code);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.code.localeCompare(b.code);
  });
}
