import type {
  RepairTicketDto,
  ReportTicketRequest,
  TicketEventDto,
  TicketPriority,
} from "@campus/contracts";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { assertTransition } from "./ticket-status";

@Injectable()
export class TicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

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
      return toDto(await tx.repairTicket.findUniqueOrThrow({ where: { id } }));
    });
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
