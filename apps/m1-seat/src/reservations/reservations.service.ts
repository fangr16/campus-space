import {
  type CreateReservationRequest,
  type JwtPayload,
  type ReservationDto,
  ReservationRule,
} from "@campus/contracts";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CLOCK, type Clock } from "../clock";
import { canSeeRoom, roomVisibilityFor } from "../rooms/room-visibility";
import { SettingsService } from "../settings/settings.service";
import { validateReservationWindow } from "./reservation-rules";
import { ReservationsRepository, SeatTakenError } from "./reservations.repository";

/**
 * Seat reservations (REQ-M1-04). Rules are checked in application code for a clear error;
 * the seat itself is guarded by the database exclusion constraint, so two concurrent requests
 * for the same seat and window can never both succeed (ADR-0009).
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly reservations: ReservationsRepository,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(user: JwtPayload, request: CreateReservationRequest): Promise<ReservationDto> {
    const seat = await this.reservations.findSeat(request.seatId);
    if (
      !seat?.isActive ||
      !seat.room.isActive ||
      !canSeeRoom(roomVisibilityFor(user), seat.room.departmentId)
    ) {
      throw new NotFoundException("seat not found");
    }

    const window = { from: new Date(request.from), to: new Date(request.to) };
    const settings = await this.settings.getReservationSettings();
    const rule = validateReservationWindow(window, seat.room, settings, this.clock.now());
    if (rule) {
      throw new BadRequestException({ message: `reservation violates rule ${rule}`, rule });
    }

    if (await this.reservations.hasUserOverlap(user.sub, window.from, window.to)) {
      throw new ConflictException({
        message: "you already hold a seat in this period",
        rule: ReservationRule.USER_OVERLAP,
      });
    }

    try {
      return await this.reservations.create({
        seatId: seat.id,
        roomId: seat.roomId,
        userId: user.sub,
        from: window.from,
        to: window.to,
      });
    } catch (error: unknown) {
      if (error instanceof SeatTakenError) {
        throw new ConflictException({
          message: "seat is already taken in this period",
          rule: ReservationRule.SEAT_OVERLAP,
        });
      }
      throw error;
    }
  }

  /** Cancels the caller's own reservation before it starts; later cancellation is REQ-M1-05 territory. */
  async cancel(user: JwtPayload, id: string): Promise<ReservationDto> {
    const reservation = await this.reservations.findById(id);
    if (!reservation) throw new NotFoundException("reservation not found");
    if (reservation.userId !== user.sub) throw new ForbiddenException("not your reservation");
    if (reservation.status !== "BOOKED") {
      throw new ConflictException({
        message: `reservation is ${reservation.status}`,
        rule: ReservationRule.NOT_BOOKED,
      });
    }
    const now = this.clock.now();
    if (new Date(reservation.from) <= now) {
      throw new ConflictException({
        message: "reservation has already started",
        rule: ReservationRule.ALREADY_STARTED,
      });
    }
    return this.reservations.cancel(id, "user", now);
  }

  listMine(user: JwtPayload): Promise<ReservationDto[]> {
    return this.reservations.listByUser(user.sub);
  }
}
