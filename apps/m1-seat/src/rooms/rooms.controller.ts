import { CurrentUser } from "@campus/auth";
import {
  type JwtPayload,
  type RoomDto,
  type RoomQuery,
  RoomQuerySchema,
  type RoomSeatsResponse,
  type SeatQuery,
  SeatQuerySchema,
} from "@campus/contracts";
import { ZodValidationPipe } from "@campus/nest-common";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { RoomsService } from "./rooms.service";

/** Any authenticated user may browse rooms; visibility is narrowed by RoomsService. */
@Controller("rooms")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  /** GET /api/m1/rooms?building=&keyword= */
  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(RoomQuerySchema)) query: RoomQuery,
  ): Promise<RoomDto[]> {
    return this.rooms.listRooms(user, query);
  }

  /** GET /api/m1/rooms/:id/seats?hasPower=true */
  @Get(":id/seats")
  seats(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(SeatQuerySchema)) query: SeatQuery,
  ): Promise<RoomSeatsResponse> {
    return this.rooms.listSeats(user, id, query);
  }
}
