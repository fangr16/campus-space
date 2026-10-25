import { type JwtPayload, Role, type RoomDto } from "@campus/contracts";
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
};

function serviceWith(rooms: RoomDto[]) {
  const repo = {
    findRooms: vi.fn(async () => rooms),
    findRoomById: vi.fn(async (id: string) => rooms.find((r) => r.id === id) ?? null),
    findSeats: vi.fn(async (roomId: string, hasPower?: boolean) =>
      [
        { id: "a", roomId, code: "01", hasPowerOutlet: true, isActive: true },
        { id: "b", roomId, code: "02", hasPowerOutlet: false, isActive: true },
      ].filter((s) => hasPower === undefined || s.hasPowerOutlet === hasPower),
    ),
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
  it("returns the room with its seats, honoring the power filter", async () => {
    const { service } = serviceWith([csRoom]);
    const result = await service.listSeats(student, "r-cs", { hasPower: true });
    expect(result.room.code).toBe("CS-304");
    expect(result.seats.map((s) => s.code)).toEqual(["01"]);
  });

  it("returns every active seat when no filter is given", async () => {
    const { service } = serviceWith([csRoom]);
    const result = await service.listSeats(student, "r-cs", {});
    expect(result.seats).toHaveLength(2);
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
