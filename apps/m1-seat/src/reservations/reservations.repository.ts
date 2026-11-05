import type { ReservationDto } from "@campus/contracts";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface SeatForReservation {
  id: string;
  roomId: string;
  isActive: boolean;
  room: {
    id: string;
    isActive: boolean;
    departmentId: string | null;
    openFrom: string;
    openTo: string;
  };
}

export interface NewReservation {
  seatId: string;
  roomId: string;
  userId: string;
  from: Date;
  to: Date;
}

/** Thrown when the database's exclusion constraint rejects an overlapping seat status. */
export class SeatTakenError extends Error {
  constructor() {
    super("seat already has a status in this period");
    this.name = "SeatTakenError";
  }
}

const RESERVATION_INCLUDE = { seat: { include: { room: true } } } as const;

type ReservationRow = {
  id: string;
  seatId: string;
  roomId: string;
  userId: string;
  from: Date;
  to: Date;
  status: "BOOKED" | "CANCELLED";
  cancelReason: string | null;
  createdAt: Date;
  seat: { code: string; room: { code: string; name: string } };
};

/**
 * Data access for reservations. Writes that touch seat_statuses run in one transaction so a
 * reservation can never exist without its RESERVED status row (X-3 provenance).
 */
@Injectable()
export class ReservationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSeat(seatId: string): Promise<SeatForReservation | null> {
    return this.prisma.seat.findUnique({
      where: { id: seatId },
      select: {
        id: true,
        roomId: true,
        isActive: true,
        room: {
          select: { id: true, isActive: true, departmentId: true, openFrom: true, openTo: true },
        },
      },
    });
  }

  /** True when the user already holds a BOOKED reservation overlapping [from, to). */
  async hasUserOverlap(userId: string, from: Date, to: Date): Promise<boolean> {
    const count = await this.prisma.reservation.count({
      where: { userId, status: "BOOKED", from: { lt: to }, to: { gt: from } },
    });
    return count > 0;
  }

  async create(input: NewReservation): Promise<ReservationDto> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const reservation = await tx.reservation.create({
          data: input,
          include: RESERVATION_INCLUDE,
        });
        await tx.seatStatus.create({
          data: {
            seatId: input.seatId,
            kind: "RESERVED",
            source: "M1_RESERVATION",
            refId: reservation.id,
            from: input.from,
            to: input.to,
          },
        });
        return reservation;
      });
      return toDto(row);
    } catch (error: unknown) {
      if (isExclusionViolation(error)) throw new SeatTakenError();
      throw error;
    }
  }

  async findById(id: string): Promise<ReservationDto | null> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include: RESERVATION_INCLUDE,
    });
    return row ? toDto(row) : null;
  }

  /** Marks the reservation cancelled and releases its seat status in one transaction. */
  async cancel(id: string, reason: string, at: Date): Promise<ReservationDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "CANCELLED", cancelReason: reason, cancelledAt: at },
        include: RESERVATION_INCLUDE,
      });
      await tx.seatStatus.deleteMany({ where: { source: "M1_RESERVATION", refId: id } });
      return updated;
    });
    return toDto(row);
  }

  async listByUser(userId: string): Promise<ReservationDto[]> {
    const rows = await this.prisma.reservation.findMany({
      where: { userId },
      orderBy: { from: "desc" },
      include: RESERVATION_INCLUDE,
      take: 100,
    });
    return rows.map(toDto);
  }
}

function toDto(row: ReservationRow): ReservationDto {
  return {
    id: row.id,
    seatId: row.seatId,
    seatCode: row.seat.code,
    roomId: row.roomId,
    roomCode: row.seat.room.code,
    roomName: row.seat.room.name,
    userId: row.userId,
    from: row.from.toISOString(),
    to: row.to.toISOString(),
    status: row.status,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt.toISOString(),
  };
}

/** PostgreSQL reports exclusion-constraint violations as SQLSTATE 23P01. */
export function isExclusionViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const meta = (error as { meta?: { code?: string } }).meta;
  return meta?.code === "23P01" || /23P01|exclusion constraint/i.test(error.message);
}
