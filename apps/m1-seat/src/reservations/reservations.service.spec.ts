import { type JwtPayload, Role } from "@campus/contracts";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { SettingsService } from "../settings/settings.service";
import { type ReservationsRepository, SeatTakenError } from "./reservations.repository";
import { ReservationsService } from "./reservations.service";

const student: JwtPayload = {
  sub: "u1",
  username: "s",
  displayName: "S",
  roles: [Role.STUDENT],
  departmentId: "CS",
};
const now = new Date("2026-11-10T01:30:00.000Z"); // 09:30 Shanghai
const seat = {
  id: "seat-1",
  roomId: "room-1",
  isActive: true,
  room: { id: "room-1", isActive: true, departmentId: null, openFrom: "07:00", openTo: "22:30" },
};
const dto = {
  id: "r1",
  seatId: "seat-1",
  seatCode: "01",
  roomId: "room-1",
  roomCode: "LIB-301",
  roomName: "图书馆",
  userId: "u1",
  from: "2026-11-10T02:00:00.000Z",
  to: "2026-11-10T04:00:00.000Z",
  status: "BOOKED" as const,
  cancelReason: null,
  createdAt: "2026-11-10T01:00:00.000Z",
};

function build(overrides: Partial<Record<keyof ReservationsRepository, unknown>> = {}) {
  const repo = {
    findSeat: vi.fn(async () => seat),
    hasUserOverlap: vi.fn(async () => false),
    create: vi.fn(async () => dto),
    findById: vi.fn(async () => dto),
    cancel: vi.fn(async () => ({ ...dto, status: "CANCELLED" as const, cancelReason: "user" })),
    listByUser: vi.fn(async () => [dto]),
    ...overrides,
  };
  const settings = {
    getReservationSettings: vi.fn(async () => ({
      maxHours: 4,
      slotMinutes: 60,
      timezone: "Asia/Shanghai",
    })),
  } as unknown as SettingsService;
  const service = new ReservationsService(repo as unknown as ReservationsRepository, settings, {
    now: () => now,
  });
  return { service, repo };
}

const request = {
  seatId: "seat-1",
  from: "2026-11-10T02:00:00.000Z",
  to: "2026-11-10T04:00:00.000Z",
};

describe("ReservationsService.create", () => {
  it("creates a reservation for a valid window", async () => {
    const { service, repo } = build();
    await expect(service.create(student, request)).resolves.toEqual(dto);
    expect(repo.create).toHaveBeenCalledWith({
      seatId: "seat-1",
      roomId: "room-1",
      userId: "u1",
      from: new Date(request.from),
      to: new Date(request.to),
    });
  });

  it("reports an unknown, inactive or invisible seat as not found", async () => {
    await expect(
      build({ findSeat: vi.fn(async () => null) }).service.create(student, request),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build({ findSeat: vi.fn(async () => ({ ...seat, isActive: false })) }).service.create(
        student,
        request,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    const eeRoom = { ...seat, room: { ...seat.room, departmentId: "EE" } };
    await expect(
      build({ findSeat: vi.fn(async () => eeRoom) }).service.create(student, request),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("names the broken rule in a 400", async () => {
    const { service, repo } = build();
    const error = await service
      .create(student, { ...request, to: "2026-11-10T03:30:00.000Z" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toMatchObject({ rule: "whole-hour" });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("refuses a second seat for the same user in an overlapping period", async () => {
    const { service } = build({ hasUserOverlap: vi.fn(async () => true) });
    const error = await service.create(student, request).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ rule: "user-overlap" });
  });

  it("maps the database exclusion violation to a seat-overlap conflict", async () => {
    const { service } = build({
      create: vi.fn(async () => {
        throw new SeatTakenError();
      }),
    });
    const error = await service.create(student, request).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ rule: "seat-overlap" });
  });

  it("lets other repository errors propagate", async () => {
    const { service } = build({
      create: vi.fn(async () => {
        throw new Error("connection lost");
      }),
    });
    await expect(service.create(student, request)).rejects.toThrow("connection lost");
  });
});

describe("ReservationsService.cancel", () => {
  it("cancels the caller's own future reservation", async () => {
    const { service, repo } = build();
    const result = await service.cancel(student, "r1");
    expect(result.status).toBe("CANCELLED");
    expect(repo.cancel).toHaveBeenCalledWith("r1", "user", now);
  });

  it("refuses to cancel someone else's reservation", async () => {
    const { service } = build();
    await expect(service.cancel({ ...student, sub: "u2" }, "r1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("refuses to cancel an already cancelled or started reservation", async () => {
    const cancelled = build({
      findById: vi.fn(async () => ({ ...dto, status: "CANCELLED" as const })),
    });
    const e1 = await cancelled.service.cancel(student, "r1").catch((e) => e);
    expect(e1.getResponse()).toMatchObject({ rule: "not-booked" });

    const started = build({
      findById: vi.fn(async () => ({ ...dto, from: "2026-11-10T01:00:00.000Z" })),
    });
    const e2 = await started.service.cancel(student, "r1").catch((e) => e);
    expect(e2.getResponse()).toMatchObject({ rule: "already-started" });
  });

  it("reports a missing reservation as not found", async () => {
    const { service } = build({ findById: vi.fn(async () => null) });
    await expect(service.cancel(student, "nope")).rejects.toBeInstanceOf(NotFoundException);
  });
});
