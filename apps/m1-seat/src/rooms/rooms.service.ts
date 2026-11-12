import type {
  JwtPayload,
  RoomDto,
  RoomLookup,
  RoomQuery,
  RoomSeatsResponse,
  SeatQuery,
} from "@campus/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";
import { canSeeRoom, roomVisibilityFor } from "./room-visibility";
import { RoomsRepository } from "./rooms.repository";
import { availabilityFor, windowOf } from "./seat-availability";
import { withDerivedPower } from "./seat-power";

/**
 * Read side of room and seat master data (REQ-M1-07 search, REQ-M1-09 power filter,
 * REQ-M1-10 floor plan). A room the caller may not see is reported as not found, so
 * department-only rooms do not leak their existence.
 */
@Injectable()
export class RoomsService {
  constructor(private readonly rooms: RoomsRepository) {}

  async lookup(roomId: string): Promise<RoomLookup> {
    const room = await this.rooms.findRoomById(roomId);
    if (!room) throw new NotFoundException("room not found");
    const seats = await this.rooms.findSeats(roomId);
    return { id: room.id, seatIds: seats.map((seat) => seat.id) };
  }

  /** Visible rooms; with a window each room also reports how many seats are free in it. */
  async listRooms(user: JwtPayload, query: RoomQuery): Promise<RoomDto[]> {
    const rooms = await this.rooms.findRooms(roomVisibilityFor(user), query);
    const window = windowOf(query);
    if (!window) return rooms;
    const occupied = await this.rooms.countOccupiedSeats(
      rooms.map((r) => r.id),
      window,
    );
    return rooms.map((room) => ({
      ...room,
      freeSeatCount: room.seatCount - (occupied.get(room.id) ?? 0),
    }));
  }

  /**
   * Seats and outlets of one room. Power availability is derived from outlet positions and
   * ranges; `hasPower` then filters the seats while the outlet list stays complete. With a
   * window every seat carries its availability for the caller (REQ-M1-11).
   */
  async listSeats(user: JwtPayload, roomId: string, query: SeatQuery): Promise<RoomSeatsResponse> {
    const room = await this.rooms.findRoomById(roomId);
    if (!room || !canSeeRoom(roomVisibilityFor(user), room.departmentId)) {
      throw new NotFoundException("room not found");
    }
    const [rawSeats, outlets] = await Promise.all([
      this.rooms.findSeats(room.id),
      this.rooms.findOutlets(room.id),
    ]);
    const powered = withDerivedPower(rawSeats, outlets).filter(
      (seat) => query.hasPower === undefined || seat.hasPowerOutlet === query.hasPower,
    );
    const window = windowOf(query);
    if (!window) return { room, seats: powered, outlets };

    const [statuses, mine] = await Promise.all([
      this.rooms.findOverlappingStatuses(room.id, window),
      this.rooms.findUserReservationIds(user.sub, window),
    ]);
    const seats = powered.map((seat) => ({
      ...seat,
      availability: availabilityFor(seat.id, statuses, mine, window.from),
    }));
    return {
      room,
      seats,
      outlets,
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
    };
  }
}
