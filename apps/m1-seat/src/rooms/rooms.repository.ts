import type { RoomDto, RoomQuery, SeatDto } from "@campus/contracts";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { RoomVisibility } from "./room-visibility";

/** Data access for rooms and seats. Returns contract DTOs, never Prisma rows. */
@Injectable()
export class RoomsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRooms(visibility: RoomVisibility, query: RoomQuery): Promise<RoomDto[]> {
    const where: Prisma.RoomWhereInput = { isActive: true };
    if (!visibility.all) {
      where.OR = [{ departmentId: null }, { departmentId: { in: visibility.departmentIds } }];
    }
    if (query.building) where.building = query.building;
    if (query.keyword) {
      where.AND = [
        {
          OR: [
            { name: { contains: query.keyword, mode: "insensitive" } },
            { code: { contains: query.keyword, mode: "insensitive" } },
          ],
        },
      ];
    }
    const rows = await this.prisma.room.findMany({
      where,
      orderBy: [{ building: "asc" }, { code: "asc" }],
      include: { _count: { select: { seats: { where: { isActive: true } } } } },
    });
    return rows.map(toRoomDto);
  }

  async findRoomById(id: string): Promise<RoomDto | null> {
    const row = await this.prisma.room.findFirst({
      where: { id, isActive: true },
      include: { _count: { select: { seats: { where: { isActive: true } } } } },
    });
    return row ? toRoomDto(row) : null;
  }

  async findSeats(roomId: string, hasPower?: boolean): Promise<SeatDto[]> {
    const rows = await this.prisma.seat.findMany({
      where: {
        roomId,
        isActive: true,
        ...(hasPower === undefined ? {} : { hasPowerOutlet: hasPower }),
      },
      orderBy: { code: "asc" },
    });
    return rows.map((s) => ({
      id: s.id,
      roomId: s.roomId,
      code: s.code,
      hasPowerOutlet: s.hasPowerOutlet,
      isActive: s.isActive,
    }));
  }
}

interface RoomRow {
  id: string;
  code: string;
  name: string;
  building: string;
  floor: number;
  openFrom: string;
  openTo: string;
  departmentId: string | null;
  isActive: boolean;
  _count: { seats: number };
}

function toRoomDto(row: RoomRow): RoomDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    building: row.building,
    floor: row.floor,
    openFrom: row.openFrom,
    openTo: row.openTo,
    departmentId: row.departmentId,
    isActive: row.isActive,
    seatCount: row._count.seats,
  };
}
