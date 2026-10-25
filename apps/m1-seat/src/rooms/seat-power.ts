import type { PowerOutletDto, SeatDto } from "@campus/contracts";

/** Anything with a position on the floor plan. */
export interface GridPoint {
  x: number;
  y: number;
}

/** Squared Euclidean distance in grid units; integers in, integer out, no rounding. */
export function squaredDistance(a: GridPoint, b: GridPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** True when the seat lies within the outlet's reach, boundary included (REQ-M1-10). */
export function isCoveredBy(seat: GridPoint, outlet: GridPoint & { range: number }): boolean {
  return squaredDistance(seat, outlet) <= outlet.range * outlet.range;
}

/** Returns new seat objects whose hasPowerOutlet is derived from the room's outlets. */
export function withDerivedPower(
  seats: ReadonlyArray<SeatDto>,
  outlets: ReadonlyArray<PowerOutletDto>,
): SeatDto[] {
  return seats.map((seat) => ({
    ...seat,
    hasPowerOutlet: outlets.some((outlet) => isCoveredBy(seat, outlet)),
  }));
}
