/**
 * Repair ticket state machine (REQ-M3-02 dispatch, REQ-M3-03 in progress, REQ-M3-04 SLA
 * escalation, REQ-M3-05 acceptance and rework). Pure functions, no I/O.
 */
export type TicketStatus =
  | "REPORTED"
  | "DISPATCHED"
  | "IN_PROGRESS"
  | "ESCALATED"
  | "DONE"
  | "ACCEPTED"
  | "REWORK"
  | "CANCELLED";

export const TRANSITIONS: Readonly<Record<TicketStatus, ReadonlyArray<TicketStatus>>> = {
  REPORTED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["IN_PROGRESS", "ESCALATED", "CANCELLED"],
  IN_PROGRESS: ["DONE", "ESCALATED"],
  ESCALATED: ["DISPATCHED", "IN_PROGRESS", "CANCELLED"],
  DONE: ["ACCEPTED", "REWORK"],
  REWORK: ["IN_PROGRESS"],
  ACCEPTED: [],
  CANCELLED: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Returns the new status or throws with both states named, for a clean 409 upstream. */
export function assertTransition(from: TicketStatus, to: TicketStatus): TicketStatus {
  if (!canTransition(from, to)) throw new Error(`ticket cannot go from ${from} to ${to}`);
  return to;
}

/**
 * Statuses during which the room's seats are taken off the reservable list in M1 (X-1):
 * work is physically happening (or overdue). A ticket that is merely reported or dispatched
 * does not block the room yet; acceptance releases it.
 */
export function blocksRoomSeats(status: TicketStatus): boolean {
  return status === "IN_PROGRESS" || status === "ESCALATED" || status === "REWORK";
}

/** True when the stage deadline has passed and the ticket is still open and not yet escalated. */
export function isOverdue(
  ticket: { status: TicketStatus; slaDueAt: Date | null },
  now: Date,
): boolean {
  if (!ticket.slaDueAt) return false;
  if (!["DISPATCHED", "IN_PROGRESS", "REWORK"].includes(ticket.status)) return false;
  return now.getTime() > ticket.slaDueAt.getTime();
}
