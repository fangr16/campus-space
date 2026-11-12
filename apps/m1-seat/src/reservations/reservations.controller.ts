import { CurrentUser } from "@campus/auth";
import {
  type CreateReservationRequest,
  CreateReservationRequestSchema,
  type JwtPayload,
  type ReservationDto,
} from "@campus/contracts";
import { ZodValidationPipe } from "@campus/nest-common";
import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ReservationsService } from "./reservations.service";

/** Any signed-in user may reserve; visibility of the room is enforced by the service. */
@Controller("reservations")
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  /** POST /api/m1/reservations  { seatId, from, to } */
  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateReservationRequestSchema)) body: CreateReservationRequest,
  ): Promise<ReservationDto> {
    return this.reservations.create(user, body);
  }

  /** GET /api/m1/reservations/me */
  @Get("me")
  mine(@CurrentUser() user: JwtPayload): Promise<ReservationDto[]> {
    return this.reservations.listMine(user);
  }

  /** DELETE /api/m1/reservations/:id (own reservation, before it starts) */
  @Delete(":id")
  @HttpCode(200)
  cancel(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<ReservationDto> {
    return this.reservations.cancel(user, id);
  }
}
