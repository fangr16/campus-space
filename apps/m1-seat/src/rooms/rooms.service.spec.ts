import { type JwtPayload, type PowerOutletDto, Role, type RoomDto } from "@campus/contracts";
import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { RoomsRepository } from "./rooms.repository";
import { RoomsService } from "./rooms.service";

const student: JwtPayload = {
  sub: "s1",
  username: "student",
  displayName: "S",
  roles: [Role.STUDENT],
  departmentId: "CS",
};

const csRoom: RoomDto = {
  id: "r-cs",
  code: "CS-304",
  name: "CS 304",
  building: "逸夫楼",
  floor: 3,
  openFrom: "08:00",
  openTo: "21:30",
  departmentId: "CS",
  isActive: true,
  seatCount: 2,
  width: 12,
  height: 8,
};

const outlets: PowerOutletDto[] = [
  { id: "o1", roomId: "r-cs", code: "W1", kind: "FIXED", x: 1, y: 2, range: 1 },
];

const until = new Date("2026-11-10T04:00:00.000Z");
const window = { from: "2026-11-10T02:00:00.000Z", to: "2026-11-10T04:00:00.000Z" };

function serviceWith(rooms: RoomDto[]) {
  const repo = {
    findRooms: vi.fn(async () => rooms),
    findRoomById: vi.fn(async (id: string) => rooms.find((r) => r.id === id) ?? null),
    findSeats: vi.fn(async (roomId: string) => [
      { id: "a", roomId, code: "01", x: 2, y: 2, hasPowerOutlet: false, isActive: true },
      { id: "b", roomId, code: "02", x: 6, y: 2, hasPowerOutlet: false, isActive: true },
    ]),
    findOutlets: vi.fn(async () => outlets),
    findOverlappingStatuses: vi.fn(async () => [
      {
        seatId: "b",
        kind: "RESERVED",
        source: "M1_RESERVATION",
        refId: "r-mine",
        from: new Date(window.from),
        to: until,
      },
    ]),
    findUserReservationIds: vi.fn(async () => new Set(["r-mine"])),
    countOccupiedSeats: vi.fn(async () => new Map([["r-cs", 1]])),
  };
  return { service: new RoomsService(repo as unknown as RoomsRepository), repo };
}

describe("RoomsService.listRooms", () => {
  it("passes the caller's visibility and query to the repository", async () => {
    const { service, repo } = serviceWith([csRoom]);
    await service.listRooms(student, { building: "逸夫楼" });
    expect(repo.findRooms).toHaveBeenCalledWith(
      { all: false, departmentIds: ["CS"] },
      { building: "逸夫楼" },
    );
  });
});

describe("RoomsService.listRooms with a window", () => {
  it("adds freeSeatCount from the occupied-seat count and leaves it out otherwise", async () => {
    const { service, repo } = serviceWith([csRoom]);
    const plain = await service.listRooms(student, {});
    expect(plain[0]?.freeSeatCount).toBeUndefined();
    expect(repo.countOccupiedSeats).not.toHaveBeenCalled();

    const windowed = await service.listRooms(student, window);
    expect(windowed[0]?.freeSeatCount).toBe(1);
    expect(repo.countOccupiedSeats).toHaveBeenCalledWith(["r-cs"], {
      from: new Date(window.from),
      to: new Date(window.to),
    });
  });
});

describe("RoomsService.listSeats", () => {
  it("derives power from outlets and returns every outlet alongside the seats", async () => {
    const { service } = serviceWith([csRoom]);
    const result = await service.listSeats(student, "r-cs", {});
    expect(result.room.code).toBe("CS-304");
    expect(result.seats.map((s) => [s.code, s.hasPowerOutlet])).toEqual([
      ["01", true],
      ["02", false],
    ]);
    expect(result.outlets).toEqual(outlets);
  });

  it("keeps only powered seats under hasPower=true but still lists all outlets", async () => {
    const { service } = serviceWith([csRoom]);
    const result = await service.listSeats(student, "r-cs", { hasPower: true });
    expect(result.seats.map((s) => s.code)).toEqual(["01"]);
    expect(result.outlets).toHaveLength(1);
  });

  it("keeps only unpowered seats under hasPower=false", async () => {
    const { service } = serviceWith([csRoom]);
    const result = await service.listSeats(student, "r-cs", { hasPower: false });
    expect(result.seats.map((s) => s.code)).toEqual(["02"]);
  });

  it("attaches availability and echoes the window when one is given", async () => {
    const { service, repo } = serviceWith([csRoom]);
    const result = await service.listSeats(student, "r-cs", window);
    expect(result.window).toEqual(window);
    expect(result.seats.map((s) => s.availability)).toEqual([
      { state: "FREE" },
      { state: "MINE", source: "M1_RESERVATION", refId: "r-mine", until: until.toISOString() },
    ]);
    expect(repo.findUserReservationIds).toHaveBeenCalledWith("s1", expect.anything());
  });

  it("neither queries statuses nor sets availability without a window", async () => {
    const { service, repo } = serviceWith([csRoom]);
    const result = await service.listSeats(student, "r-cs", {});
    expect(result.window).toBeUndefined();
    expect(result.seats[0]?.availability).toBeUndefined();
    expect(repo.findOverlappingStatuses).not.toHaveBeenCalled();
  });

  it("reports an unknown room as not found", async () => {
    const { service } = serviceWith([csRoom]);
    await expect(service.listSeats(student, "nope", {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it("hides another department's room behind the same not-found error", async () => {
    const eeStudent = { ...student, departmentId: "EE" };
    const { service, repo } = serviceWith([csRoom]);
    await expect(service.listSeats(eeStudent, "r-cs", {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findSeats).not.toHaveBeenCalled();
  });
});
