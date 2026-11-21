import { Logger } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { LoggingNotifier, type Notifier, type SlaNotification } from "./notifier";
import { SLA_ACTOR_ID, SlaService } from "./sla.service";
import type { TicketStatus } from "./ticket-status";

interface Row {
  id: string;
  status: TicketStatus;
  slaDueAt: Date | null;
  reworkRemindedAt: Date | null;
  assigneeId: string | null;
  reporterId: string;
}

const NOW = new Date("2030-01-01T12:00:00Z");

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "t1",
    status: "DISPATCHED",
    slaDueAt: new Date("2030-01-01T11:00:00Z"),
    reworkRemindedAt: null,
    assigneeId: "worker",
    reporterId: "reporter",
    ...overrides,
  };
}

/** In-memory stand-in for the two transactional writes the scanner performs. */
class FakePrisma {
  rows = new Map<string, Row>();
  events: Array<Record<string, unknown>> = [];
  conflict = false;
  missingOnClaim = false;

  repairTicket = {
    findMany: async ({ where }: { where: { slaDueAt: { lt: Date }; status: { in: string[] } } }) =>
      [...this.rows.values()].filter(
        (candidate) =>
          candidate.slaDueAt !== null &&
          candidate.slaDueAt.getTime() < where.slaDueAt.lt.getTime() &&
          where.status.in.includes(candidate.status),
      ),
  };

  $transaction = async (fn: (tx: unknown) => Promise<boolean>) =>
    fn({
      repairTicket: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          if (this.missingOnClaim) return null;
          const stored = this.rows.get(where.id);
          return stored ? { ...stored } : null;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; status?: string; reworkRemindedAt?: Date | null };
          data: Partial<Row>;
        }) => {
          if (this.conflict) return { count: 0 };
          const current = this.rows.get(where.id);
          if (!current || (where.status && current.status !== where.status)) return { count: 0 };
          if (where.reworkRemindedAt === null && current.reworkRemindedAt !== null) {
            return { count: 0 };
          }
          Object.assign(current, data);
          return { count: 1 };
        },
      },
      ticketEvent: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          this.events.push(data);
          return data;
        },
      },
    });
}

function setup(intervalMs = 0) {
  const prisma = new FakePrisma();
  const notifications: SlaNotification[] = [];
  const notifier: Notifier = {
    notify: async (input) => {
      notifications.push(input);
    },
  };
  const service = new SlaService(prisma as unknown as PrismaService, { now: () => NOW }, notifier, {
    intervalMs,
  });
  return { prisma, notifications, notifier, service };
}

describe("SlaService.scan", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it.each(["DISPATCHED", "IN_PROGRESS"] as const)(
    "escalates an overdue %s ticket with a system event and one notification",
    async (status) => {
      const { prisma, notifications, service } = setup();
      prisma.rows.set("t1", row({ status }));

      expect(await service.scan()).toEqual({ escalated: 1, reminded: 0 });
      expect(prisma.rows.get("t1")).toMatchObject({ status: "ESCALATED" });
      expect(prisma.events).toMatchObject([
        { ticketId: "t1", fromStatus: status, toStatus: "ESCALATED", actorId: SLA_ACTOR_ID },
      ]);
      expect(notifications).toEqual([
        {
          ticketId: "t1",
          kind: "SLA_ESCALATED",
          recipientIds: ["worker", "reporter"],
          occurredAt: NOW.toISOString(),
        },
      ]);

      expect(await service.scan()).toEqual({ escalated: 0, reminded: 0 });
      expect(prisma.events).toHaveLength(1);
      expect(notifications).toHaveLength(1);
    },
  );

  it("reminds an overdue REWORK ticket once without changing status or appending an event", async () => {
    const { prisma, notifications, service } = setup();
    prisma.rows.set("t1", row({ status: "REWORK" }));

    expect(await service.scan()).toEqual({ escalated: 0, reminded: 1 });
    expect(prisma.rows.get("t1")).toMatchObject({
      status: "REWORK",
      reworkRemindedAt: NOW,
    });
    expect(prisma.events).toHaveLength(0);
    expect(notifications).toMatchObject([{ kind: "SLA_REWORK_REMINDER", ticketId: "t1" }]);

    expect(await service.scan()).toEqual({ escalated: 0, reminded: 0 });
    expect(notifications).toHaveLength(1);
  });

  it("ignores future deadlines, the exact deadline, terminal states and tickets without a deadline", async () => {
    const { prisma, notifications, service } = setup();
    prisma.rows.set("future", row({ id: "future", slaDueAt: new Date("2030-01-02T00:00:00Z") }));
    prisma.rows.set("boundary", row({ id: "boundary", slaDueAt: NOW }));
    prisma.rows.set("no-deadline", row({ id: "no-deadline", slaDueAt: null }));
    for (const status of ["REPORTED", "ESCALATED", "DONE", "ACCEPTED", "CANCELLED"] as const) {
      prisma.rows.set(status, row({ id: status, status }));
    }

    expect(await service.scan()).toEqual({ escalated: 0, reminded: 0 });
    expect(notifications).toHaveLength(0);
    expect(prisma.events).toHaveLength(0);
  });

  it("does not notify when a concurrent scan won the conditional update", async () => {
    const { prisma, notifications, service } = setup();
    prisma.rows.set("t1", row());
    prisma.conflict = true;

    expect(await service.scan()).toEqual({ escalated: 0, reminded: 0 });
    expect(prisma.rows.get("t1")).toMatchObject({ status: "DISPATCHED" });
    expect(prisma.events).toHaveLength(0);
    expect(notifications).toHaveLength(0);
  });

  it.each(["DISPATCHED", "REWORK"] as const)(
    "skips a %s ticket that disappeared before the transactional claim",
    async (status) => {
      const { prisma, notifications, service } = setup();
      prisma.rows.set("t1", row({ status }));
      prisma.missingOnClaim = true;

      expect(await service.scan()).toEqual({ escalated: 0, reminded: 0 });
      expect(prisma.events).toHaveLength(0);
      expect(notifications).toHaveLength(0);
    },
  );

  it("deduplicates recipients when the assignee is also the reporter", async () => {
    const { prisma, notifications, service } = setup();
    prisma.rows.set("t1", row({ assigneeId: "same", reporterId: "same" }));

    await service.scan();
    expect(notifications[0]?.recipientIds).toEqual(["same"]);
  });

  it("propagates a notification failure so the transaction can be retried by the next scan", async () => {
    const { prisma, notifier, service } = setup();
    prisma.rows.set("t1", row());
    vi.spyOn(notifier, "notify").mockRejectedValueOnce(new Error("D-3 unavailable"));

    await expect(service.scan()).rejects.toThrow("D-3 unavailable");
  });
});

describe("SlaService scheduling", () => {
  it("starts and stops the interval only when one is configured", async () => {
    vi.useFakeTimers();
    try {
      const { service } = setup(10);
      const scan = vi.spyOn(service, "scan").mockResolvedValue({ escalated: 0, reminded: 0 });

      service.onModuleInit();
      await vi.advanceTimersByTimeAsync(25);
      expect(scan.mock.calls.length).toBeGreaterThan(0);

      service.onModuleDestroy();
      const callsAfterDestroy = scan.mock.calls.length;
      await vi.advanceTimersByTimeAsync(25);
      expect(scan.mock.calls.length).toBe(callsAfterDestroy);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([0, -1])("does not start a timer when the interval is %i", (intervalMs) => {
    const { service } = setup(intervalMs);
    const scan = vi.spyOn(service, "scan");
    service.onModuleInit();
    expect(scan).not.toHaveBeenCalled();
    service.onModuleDestroy();
  });

  it("logs a failed scheduled scan without crashing the timer", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    try {
      const { service } = setup(10);
      vi.spyOn(service, "scan").mockRejectedValueOnce(new Error("db down"));
      service.onModuleInit();
      await vi.advanceTimersByTimeAsync(10);
      expect(error).toHaveBeenCalledWith("SLA scan failed", expect.any(String));
      service.onModuleDestroy();
    } finally {
      error.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("LoggingNotifier", () => {
  it("records the delivery intent on the placeholder port", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    try {
      await new LoggingNotifier().notify({
        ticketId: "t1",
        kind: "SLA_ESCALATED",
        recipientIds: ["worker"],
        occurredAt: NOW.toISOString(),
      });
      expect(log).toHaveBeenCalledWith(expect.stringContaining("SLA_ESCALATED ticket=t1"));
    } finally {
      log.mockRestore();
    }
  });
});
