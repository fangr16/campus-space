import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAppModule } from "../app.module";
import { CLOCK } from "../clock";
import { PrismaService } from "../prisma/prisma.service";
import { NOTIFIER, type SlaNotification } from "./notifier";
import { SLA_ACTOR_ID, SLA_SCAN_OPTIONS, SlaService } from "./sla.service";

const options = { jwtSecret: "int-secret-0123456789", internalToken: "int-token", expiresIn: "1h" };
const NOW = new Date("2030-01-01T12:00:00Z");
const PAST = new Date("2030-01-01T11:00:00Z");
const FUTURE = new Date("2030-01-01T13:00:00Z");

let app: INestApplication;
let prisma: PrismaService;
let sla: SlaService;
let notifications: SlaNotification[];

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [createAppModule(options)] })
    .overrideProvider(CLOCK)
    .useValue({ now: () => NOW })
    .overrideProvider(NOTIFIER)
    .useValue({
      notify: async (input: SlaNotification) => {
        notifications.push(input);
      },
    })
    .overrideProvider(SLA_SCAN_OPTIONS)
    .useValue({ intervalMs: 0 })
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/m3");
  await app.init();
  prisma = app.get(PrismaService);
  sla = app.get(SlaService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  notifications = [];
  await prisma.ticketEvent.deleteMany();
  await prisma.repairTicket.deleteMany();
});

async function ticket(
  status: "DISPATCHED" | "IN_PROGRESS" | "REWORK" | "ESCALATED" | "DONE" | "ACCEPTED" | "CANCELLED",
  slaDueAt: Date | null,
  id: string,
) {
  return prisma.repairTicket.create({
    data: {
      id,
      roomId: "room-1",
      reporterId: "reporter",
      category: "LIGHT",
      description: "fault",
      status,
      assigneeId: "worker",
      slaDueAt,
    },
  });
}

describe("SLA scan against the m3_test schema", () => {
  it.each(["DISPATCHED", "IN_PROGRESS"] as const)(
    "escalates an overdue %s ticket atomically and notifies once",
    async (status) => {
      await ticket(status, PAST, "overdue");

      expect(await sla.scan()).toEqual({ escalated: 1, reminded: 0 });
      expect(
        await prisma.repairTicket.findUniqueOrThrow({ where: { id: "overdue" } }),
      ).toMatchObject({
        status: "ESCALATED",
      });
      expect(await prisma.ticketEvent.findMany({ where: { ticketId: "overdue" } })).toMatchObject([
        { fromStatus: status, toStatus: "ESCALATED", actorId: SLA_ACTOR_ID },
      ]);
      expect(notifications).toEqual([
        {
          ticketId: "overdue",
          kind: "SLA_ESCALATED",
          recipientIds: ["worker", "reporter"],
          occurredAt: NOW.toISOString(),
        },
      ]);

      expect(await sla.scan()).toEqual({ escalated: 0, reminded: 0 });
      expect(await prisma.ticketEvent.count({ where: { ticketId: "overdue" } })).toBe(1);
      expect(notifications).toHaveLength(1);
    },
  );

  it("reminds an overdue REWORK ticket once and leaves its status untouched", async () => {
    await ticket("REWORK", PAST, "rework");

    expect(await sla.scan()).toEqual({ escalated: 0, reminded: 1 });
    const stored = await prisma.repairTicket.findUniqueOrThrow({ where: { id: "rework" } });
    expect(stored).toMatchObject({ status: "REWORK" });
    expect(stored.reworkRemindedAt).toEqual(NOW);
    expect(await prisma.ticketEvent.count({ where: { ticketId: "rework" } })).toBe(0);
    expect(notifications).toMatchObject([{ kind: "SLA_REWORK_REMINDER", ticketId: "rework" }]);

    expect(await sla.scan()).toEqual({ escalated: 0, reminded: 0 });
    expect(notifications).toHaveLength(1);
  });

  it("does not touch future deadlines, the boundary, tickets without a deadline or closed states", async () => {
    await ticket("DISPATCHED", FUTURE, "future");
    await ticket("IN_PROGRESS", NOW, "boundary");
    await ticket("DISPATCHED", null, "no-deadline");
    await ticket("ESCALATED", PAST, "already-escalated");
    await ticket("DONE", PAST, "done");
    await ticket("ACCEPTED", PAST, "accepted");
    await ticket("CANCELLED", PAST, "cancelled");

    expect(await sla.scan()).toEqual({ escalated: 0, reminded: 0 });
    expect(await prisma.ticketEvent.count()).toBe(0);
    expect(notifications).toHaveLength(0);
  });
});
