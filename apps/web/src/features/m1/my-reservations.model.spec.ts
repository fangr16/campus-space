import type { ReservationDto } from "@campus/contracts";
import { describe, expect, it } from "vitest";
import {
  canCancel,
  describeStart,
  groupReservations,
  HISTORY_LIMIT,
} from "./my-reservations.model";

const now = new Date("2026-11-10T02:00:00.000Z");
const at = (hoursFromNow: number) =>
  new Date(now.getTime() + hoursFromNow * 3_600_000).toISOString();
let counter = 0;
function reservation(
  from: number,
  to: number,
  status: ReservationDto["status"] = "BOOKED",
): ReservationDto {
  counter += 1;
  return reservationWithId(`r${counter}`, from, to, status);
}
const reservationWithId = (
  id: string,
  from: number,
  to: number,
  status: ReservationDto["status"],
): ReservationDto => ({
  id,
  seatId: "s",
  seatCode: "05",
  roomId: "room",
  roomCode: "LIB-301",
  roomName: "图书馆",
  userId: "u",
  from: at(from),
  to: at(to),
  status,
  cancelReason: null,
  createdAt: at(-48),
});

describe("groupReservations", () => {
  it("puts booked, unfinished reservations first by start and the rest newest first", () => {
    const later = reservation(5, 7);
    const soon = reservation(1, 3);
    const running = reservation(-1, 1);
    const finished = reservation(-5, -3);
    const cancelled = reservation(2, 4, "CANCELLED");
    const groups = groupReservations([later, cancelled, finished, soon, running], now);
    expect(groups.upcoming.map((r) => r.id)).toEqual([running.id, soon.id, later.id]);
    expect(groups.history.map((r) => r.id)).toEqual([cancelled.id, finished.id]);
  });

  it("caps history", () => {
    const many = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => reservation(-i - 2, -i - 1));
    expect(groupReservations(many, now).history).toHaveLength(HISTORY_LIMIT);
  });
});

describe("describeStart", () => {
  it("describes minutes, hours, days and a running reservation", () => {
    expect(describeStart(at(0.5), at(2), now)).toBe("30 分钟后开始");
    expect(describeStart(at(2), at(4), now)).toBe("2 小时后开始");
    expect(describeStart(at(50), at(52), now)).toBe("2 天后开始");
    expect(describeStart(at(-1), at(1), now)).toBe("进行中");
    expect(describeStart(at(-3), at(-1), now)).toBe("已结束");
  });
});

describe("canCancel", () => {
  it("allows only booked reservations that have not started", () => {
    expect(canCancel(reservation(1, 3), now)).toBe(true);
    expect(canCancel(reservation(-1, 1), now)).toBe(false);
    expect(canCancel(reservation(1, 3, "CANCELLED"), now)).toBe(false);
  });
});
