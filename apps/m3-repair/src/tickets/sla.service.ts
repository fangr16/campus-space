import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { CLOCK, type Clock } from "../clock";
import { PrismaService } from "../prisma/prisma.service";
import { NOTIFIER, type Notifier, type SlaNotificationKind } from "./notifier";
import { assertTransition, isOverdue, type TicketStatus } from "./ticket-status";

/** Fixed identity for events written by the SLA scanner rather than a human actor. */
export const SLA_ACTOR_ID = "system:sla";

export const SLA_SCAN_OPTIONS = Symbol("SLA_SCAN_OPTIONS");

export interface SlaScanOptions {
  /** 0 disables the timer; unit tests inject 0 and call scan() with a fake clock. */
  intervalMs: number;
}

export interface SlaScanResult {
  escalated: number;
  reminded: number;
}

interface SlaTicket {
  id: string;
  status: TicketStatus;
  slaDueAt: Date | null;
  reworkRemindedAt: Date | null;
  assigneeId: string | null;
  reporterId: string;
}

/**
 * Scans overdue tickets on an interval. Both side effects are claimed by a conditional
 * update inside a transaction, so repeated or concurrent scans cannot duplicate them.
 * Time comes from the injected CLOCK; delivery from the injected NOTIFIER port.
 */
@Injectable()
export class SlaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
    @Inject(SLA_SCAN_OPTIONS) private readonly options: SlaScanOptions,
  ) {}

  onModuleInit(): void {
    if (this.options.intervalMs <= 0) return;
    this.timer = setInterval(() => {
      void this.scan().catch((error: unknown) => {
        this.logger.error("SLA scan failed", error instanceof Error ? error.stack : String(error));
      });
    }, this.options.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async scan(): Promise<SlaScanResult> {
    const now = this.clock.now();
    const candidates = await this.prisma.repairTicket.findMany({
      where: {
        slaDueAt: { lt: now },
        status: { in: ["DISPATCHED", "IN_PROGRESS", "REWORK"] },
      },
    });
    const result: SlaScanResult = { escalated: 0, reminded: 0 };
    for (const ticket of candidates) {
      if (!isOverdue(ticket, now)) continue;
      if (ticket.status === "REWORK") {
        if (await this.remindOnce(ticket, now)) result.reminded += 1;
      } else if (await this.escalateOnce(ticket, now)) {
        result.escalated += 1;
      }
    }
    return result;
  }

  private async escalateOnce(ticket: SlaTicket, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.repairTicket.findUnique({ where: { id: ticket.id } });
      if (!current || !isOverdue(current, now)) return false;
      assertTransition(current.status, "ESCALATED");
      const updated = await tx.repairTicket.updateMany({
        where: { id: current.id, status: current.status },
        data: { status: "ESCALATED" },
      });
      if (updated.count !== 1) return false;
      await tx.ticketEvent.create({
        data: {
          ticketId: current.id,
          fromStatus: current.status,
          toStatus: "ESCALATED",
          actorId: SLA_ACTOR_ID,
        },
      });
      await this.notify(current, "SLA_ESCALATED", now);
      return true;
    });
  }

  private async remindOnce(ticket: SlaTicket, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.repairTicket.findUnique({ where: { id: ticket.id } });
      if (current?.status !== "REWORK" || !isOverdue(current, now)) return false;
      const claimed = await tx.repairTicket.updateMany({
        where: { id: current.id, status: "REWORK", reworkRemindedAt: null },
        data: { reworkRemindedAt: now },
      });
      if (claimed.count !== 1) return false;
      await this.notify(current, "SLA_REWORK_REMINDER", now);
      return true;
    });
  }

  private async notify(ticket: SlaTicket, kind: SlaNotificationKind, now: Date): Promise<void> {
    const recipientIds = [ticket.assigneeId, ticket.reporterId].filter((id): id is string =>
      Boolean(id),
    );
    await this.notifier.notify({
      ticketId: ticket.id,
      kind,
      recipientIds: [...new Set(recipientIds)],
      occurredAt: now.toISOString(),
    });
  }
}
