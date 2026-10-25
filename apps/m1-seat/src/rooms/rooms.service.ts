import type {
  JwtPayload,
  RoomDto,
  RoomQuery,
  RoomSeatsResponse,
  SeatQuery,
} from "@campus/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";
import { canSeeRoom, roomVisibilityFor } from "./room-visibility";
import { RoomsRepository } from "./rooms.repository";

/**
 * Read side of room and seat master data (REQ-M1-07 search, REQ-M1-09 power filter).
 * A room the caller may not see is reported as not found, so department-only rooms do not
 * leak their existence.
 */
@Injectable()
export class RoomsService {
  constructor(private readonly rooms: RoomsRepository) {}

  listRooms(user: JwtPayload, query: RoomQuery): Promise<RoomDto[]> {
    return this.rooms.findRooms(roomVisibilityFor(user), query);
  }

  async listSeats(user: JwtPayload, roomId: string, query: SeatQuery): Promise<RoomSeatsResponse> {
    const room = await this.rooms.findRoomById(roomId);
    if (!room || !canSeeRoom(roomVisibilityFor(user), room.departmentId)) {
      throw new NotFoundException("room not found");
    }
    const seats = await this.rooms.findSeats(room.id, query.hasPower);
    return { room, seats };
  }
}
