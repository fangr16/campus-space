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

function serviceWith(rooms: RoomDto[]) {
  const repo = {
    findRooms: vi.fn(async () => rooms),
    findRoomById: vi.fn(async (id: string) => rooms.find((r) => r.id === id) ?? null),
    findSeats: vi.fn(async (roomId: string) => [
      { id: "a", roomId, code: "01", x: 2, y: 2, hasPowerOutlet: false, isActive: true },
      { id: "b", roomId, code: "02", x: 6, y: 2, hasPowerOutlet: false, isActive: true },
    ]),
    findOutlets: vi.fn(async () => outlets),
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
