import { type JwtPayload, Role } from "@campus/contracts";

/**
 * Which rooms a caller may see (REQ-M1-02): staff roles see every room; everyone else sees
 * campus-wide rooms plus the rooms of their own department.
 */
export type RoomVisibility = { all: true } | { all: false; departmentIds: string[] };

const SEES_ALL_ROOMS: ReadonlySet<string> = new Set<string>([
  Role.ROOM_MANAGER,
  Role.OPS_MANAGER,
  Role.ADMIN,
]);

export function roomVisibilityFor(user: JwtPayload): RoomVisibility {
  if (user.roles.some((role) => SEES_ALL_ROOMS.has(role))) return { all: true };
  return { all: false, departmentIds: user.departmentId ? [user.departmentId] : [] };
}

/** Pure check used both for list filtering and for single-room access. */
export function canSeeRoom(visibility: RoomVisibility, roomDepartmentId: string | null): boolean {
  if (visibility.all) return true;
  if (roomDepartmentId === null) return true;
  return visibility.departmentIds.includes(roomDepartmentId);
}

/** "HH:mm" to minutes since midnight. Input is validated by contracts' ClockTimeSchema. */
export function clockToMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True when [from, to) lies inside the room's opening hours of a single day. */
export function isWithinOpeningHours(
  room: { openFrom: string; openTo: string },
  from: string,
  to: string,
): boolean {
  const open = clockToMinutes(room.openFrom);
  const close = clockToMinutes(room.openTo);
  const start = clockToMinutes(from);
  const end = clockToMinutes(to);
  return start < end && start >= open && end <= close;
}
