import type {
  RepairTicketDto,
  ReportTicketRequest,
  TicketEventDto,
  TicketPriority,
} from "@campus/contracts";
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CLOCK, type Clock } from "../clock";
import { PrismaService } from "../prisma/prisma.service";
import { SEAT_BLOCKER, type SeatBlocker } from "./seat-blocker";
import { assertTransition } from "./ticket-status";

const REPAIR_SOURCE = "M3_REPAIR" as const;
/** Repair blocks are open-ended: release is driven by ACCEPTED, not by a deadline. */
const OPEN_ENDED = "2099-12-31T23:59:59.999Z";

@Injectable()
export class TicketsRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SEAT_BLOCKER) private readonly blocker: SeatBlocker,
  ) {}

  async report(input: ReportTicketRequest, reporterId: string): Promise<RepairTicketDto> {
    const ticket = await this.prisma.repairTicket.create({
      data: {
        ...input,
        reporterId,
        events: { create: { toStatus: "REPORTED", actorId: reporterId } },
      },
    });
    return toDto(ticket);
  }

  async dispatch(
    id: string,
    actorId: string,
    assigneeId: string,
    priority: TicketPriority,
    slaDueAt: Date,
  ): Promise<RepairTicketDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.repairTicket.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("ticket not found");
      try {
        assertTransition(current.status, "DISPATCHED");
      } catch {
        throw new ConflictException("ticket cannot be dispatched from this status");
      }
      const updated = await tx.repairTicket.updateMany({
        where: { id, status: current.status },
        data: { status: "DISPATCHED", assigneeId, priority, slaDueAt },
      });
      if (updated.count !== 1) throw new ConflictException("ticket changed concurrently");
      await tx.ticketEvent.create({
        data: { ticketId: id, fromStatus: current.status, toStatus: "DISPATCHED", actorId },
      });
      return toDto(await tx.repairTicket.findUniqueOrThrow({ where: { id } }));
    });
  }

  async transition(
    id: string,
    actorId: string,
    toStatus: "IN_PROGRESS" | "DONE",
  ): Promise<RepairTicketDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.repairTicket.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("ticket not found");
      if (current.assigneeId !== actorId) throw new ForbiddenException("not assigned to ticket");
      try {
        assertTransition(current.status, toStatus);
      } catch {
        throw new ConflictException("ticket cannot move to this status");
      }
      const updated = await tx.repairTicket.updateMany({
        where: { id, status: current.status, assigneeId: actorId },
        data: { status: toStatus },
      });
      if (updated.count !== 1) throw new ConflictException("ticket changed concurrently");
      await tx.ticketEvent.create({
        data: { ticketId: id, fromStatus: current.status, toStatus, actorId },
      });
      if (toStatus === "IN_PROGRESS") {
        await this.blocker.block({
          roomId: current.roomId,
          source: REPAIR_SOURCE,
          refId: id,
          from: this.clock.now().toISOString(),
          to: OPEN_ENDED,
          reason: "维修中，整室座位下架",
        });
      }
      return toDto(await tx.repairTicket.findUniqueOrThrow({ where: { id } }));
    });
  }

  async accept(id: string, reporterId: string, rating: number): Promise<RepairTicketDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.repairTicket.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("ticket not found");
      if (current.reporterId !== reporterId) {
        throw new ForbiddenException("only the reporter can accept a ticket");
      }
      try {
        assertTransition(current.status, "ACCEPTED");
      } catch {
        throw new ConflictException("ticket cannot be accepted from this status");
      }
      const updated = await tx.repairTicket.updateMany({
        where: { id, status: current.status, reporterId },
        data: { status: "ACCEPTED", rating },
      });
      if (updated.count !== 1) throw new ConflictException("ticket changed concurrently");
      await tx.ticketEvent.create({
        data: {
          ticketId: id,
          fromStatus: current.status,
          toStatus: "ACCEPTED",
          actorId: reporterId,
          note: `评分：${rating}`,
        },
      });
      await this.blocker.release({
        roomId: current.roomId,
        source: REPAIR_SOURCE,
        refId: id,
      });
      return toDto(await tx.repairTicket.findUniqueOrThrow({ where: { id } }));
    });
  }

  async reject(id: string, reporterId: string, reason: string): Promise<RepairTicketDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.repairTicket.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("ticket not found");
      if (current.reporterId !== reporterId) {
        throw new ForbiddenException("only the reporter can reject a ticket");
      }
      try {
        assertTransition(current.status, "REWORK");
      } catch {
        throw new ConflictException("ticket cannot be rejected from this status");
      }
      const updated = await tx.repairTicket.updateMany({
        where: { id, status: current.status, reporterId },
        data: { status: "REWORK" },
      });
      if (updated.count !== 1) throw new ConflictException("ticket changed concurrently");
      await tx.ticketEvent.create({
        data: {
          ticketId: id,
          fromStatus: current.status,
          toStatus: "REWORK",
          actorId: reporterId,
          note: reason,
        },
      });
      return toDto(await tx.repairTicket.findUniqueOrThrow({ where: { id } }));
    });
  }

  async list(userId: string, isAdmin: boolean): Promise<RepairTicketDto[]> {
    const tickets = await this.prisma.repairTicket.findMany({
      where: isAdmin ? undefined : { OR: [{ reporterId: userId }, { assigneeId: userId }] },
      orderBy: { updatedAt: "desc" },
    });
    return tickets.map(toDto);
  }

  async events(id: string, userId: string, isAdmin: boolean): Promise<TicketEventDto[]> {
    const ticket = await this.prisma.repairTicket.findUnique({
      where: { id },
      select: { reporterId: true, assigneeId: true },
    });
    if (!ticket) throw new NotFoundException("ticket not found");
    if (!isAdmin && userId !== ticket.reporterId && userId !== ticket.assigneeId) {
      throw new ForbiddenException("ticket history is private");
    }
    const events = await this.prisma.ticketEvent.findMany({
      where: { ticketId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() }));
  }
}

function toDto(ticket: {
  id: string;
  roomId: string;
  seatId: string | null;
  reporterId: string;
  category: string;
  description: string;
  photoRef: string | null;
  status: RepairTicketDto["status"];
  priority: RepairTicketDto["priority"];
  rating: number | null;
  assigneeId: string | null;
  slaDueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): RepairTicketDto {
  return {
    ...ticket,
    slaDueAt: ticket.slaDueAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}
