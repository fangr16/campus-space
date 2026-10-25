/**
 * Approval state machine for whole-room bookings (REQ-M2-03 multi-level approval,
 * REQ-M2-04 timeout, REQ-M2-05 applicant cancellation). Pure functions, no I/O.
 */
export type BookingStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";
export type ApprovalDecision = "APPROVED" | "REJECTED";

export interface BookingState {
  status: BookingStatus;
  currentLevel: number;
  requiredLevels: number;
}

export const TRANSITIONS: Readonly<Record<BookingStatus, ReadonlyArray<BookingStatus>>> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED", "EXPIRED"],
  APPROVED: ["CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Applies one approver's decision. An approval at an intermediate level advances the level;
 * the final approval moves the booking to APPROVED. A rejection at any level ends the flow.
 * Throws when the booking is no longer pending.
 */
export function applyDecision(state: BookingState, decision: ApprovalDecision): BookingState {
  if (state.status !== "PENDING") {
    throw new Error(`cannot decide a booking in status ${state.status}`);
  }
  if (decision === "REJECTED") return { ...state, status: "REJECTED" };
  if (state.currentLevel >= state.requiredLevels) return { ...state, status: "APPROVED" };
  return { ...state, currentLevel: state.currentLevel + 1 };
}

/** True when the booking should be auto-withdrawn: still pending and past its deadline. */
export function shouldExpire(state: BookingState, expiresAt: Date, now: Date): boolean {
  return state.status === "PENDING" && now.getTime() >= expiresAt.getTime();
}

/**
 * Statuses that occupy the room's seats in M1 (X-2). Only an approved booking blocks seats;
 * rejection, cancellation and expiry release them.
 */
export function occupiesSeats(status: BookingStatus): boolean {
  return status === "APPROVED";
}
