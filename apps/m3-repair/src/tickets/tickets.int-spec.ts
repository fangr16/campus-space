import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { type JwtPayload, Role } from "@campus/contracts";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

const options = { jwtSecret: "int-secret-0123456789", internalToken: "int-token", expiresIn: "1h" };
const jwt = new JwtService({ secret: options.jwtSecret });
const token = (role: Role, sub = `user-${role}`) =>
  jwt.sign({
    sub,
    username: role,
    displayName: role,
    roles: [role],
    departmentId: null,
  } satisfies JwtPayload);
const report = {
  roomId: "room-1",
  seatId: "seat-1",
  category: "LIGHT",
  description: "Lamp broken",
};
const due = "2030-01-01T00:00:00.000Z";
let app: INestApplication;
let upstream: Server;
let prisma: PrismaService;
let originalM1: string | undefined;
let originalPlatform: string | undefined;

beforeAll(async () => {
  upstream = createServer((req, res) => {
    const authorized = req.headers["x-internal-token"] === options.internalToken;
    const path = req.url ?? "";
    const data =
      path === "/api/m1/rooms/internal/room-1/lookup"
        ? { id: "room-1", seatIds: ["seat-1"] }
        : path.startsWith("/api/platform/users/internal/")
          ? { id: path.split("/")[5], eligible: path.includes("/worker/") }
          : null;
    res.writeHead(!authorized ? 401 : data ? 200 : 404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        success: Boolean(data),
        data,
        error: data ? null : { code: "NOT_FOUND", message: "missing" },
      }),
    );
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  originalM1 = process.env.M1_BASE_URL;
  originalPlatform = process.env.PLATFORM_BASE_URL;
  process.env.M1_BASE_URL = base;
  process.env.PLATFORM_BASE_URL = base;
  const moduleRef = await Test.createTestingModule({
    imports: [createAppModule(options)],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/m3");
  await app.init();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
  if (originalM1 === undefined) delete process.env.M1_BASE_URL;
  else process.env.M1_BASE_URL = originalM1;
  if (originalPlatform === undefined) delete process.env.PLATFORM_BASE_URL;
  else process.env.PLATFORM_BASE_URL = originalPlatform;
});

describe("report and dispatch", () => {
  it("creates a REPORTED ticket and its first event atomically", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/m3/tickets")
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send(report)
      .expect(201);
    expect(res.body.data).toMatchObject({
      roomId: "room-1",
      seatId: "seat-1",
      status: "REPORTED",
      reporterId: "user-student",
      photoRef: null,
    });
    const events = await prisma.ticketEvent.findMany({ where: { ticketId: res.body.data.id } });
    expect(events).toMatchObject([
      { fromStatus: null, toStatus: "REPORTED", actorId: "user-student" },
    ]);
  });

  it("stores an optional photo reference without image bytes", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/m3/tickets")
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send({ ...report, photoRef: "repairs/photo-1" })
      .expect(201);
    expect(res.body.data.photoRef).toBe("repairs/photo-1");
    expect(
      (await prisma.repairTicket.findUniqueOrThrow({ where: { id: res.body.data.id } })).photoRef,
    ).toBe("repairs/photo-1");
  });

  it("rejects invalid locations and leaves no ticket", async () => {
    const before = await prisma.repairTicket.count();
    await request(app.getHttpServer())
      .post("/api/m3/tickets")
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send({ ...report, roomId: "missing" })
      .expect(404);
    await request(app.getHttpServer())
      .post("/api/m3/tickets")
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send({ ...report, seatId: "wrong" })
      .expect(400);
    expect(await prisma.repairTicket.count()).toBe(before);
  });

  it("requires a user token and valid body", async () => {
    await request(app.getHttpServer()).post("/api/m3/tickets").send(report).expect(401);
    await request(app.getHttpServer())
      .post("/api/m3/tickets")
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send({ ...report, description: " " })
      .expect(400);
  });

  it("dispatches to an active maintainer and records the transition", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/m3/tickets")
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send(report)
      .expect(201);
    const id = created.body.data.id as string;
    const input = { assigneeId: "worker", priority: "HIGH", slaDueAt: due };
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/dispatch`)
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send(input)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/dispatch`)
      .set("authorization", `Bearer ${token(Role.ADMIN)}`)
      .send({ ...input, assigneeId: "unknown" })
      .expect(400);
    const res = await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/dispatch`)
      .set("authorization", `Bearer ${token(Role.ADMIN)}`)
      .send(input)
      .expect(201);
    expect(res.body.data).toMatchObject({
      status: "DISPATCHED",
      assigneeId: "worker",
      priority: "HIGH",
      slaDueAt: due,
    });
    const events = await prisma.ticketEvent.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => [event.fromStatus, event.toStatus, event.actorId])).toEqual([
      [null, "REPORTED", "user-student"],
      ["REPORTED", "DISPATCHED", "user-admin"],
    ]);
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/dispatch`)
      .set("authorization", `Bearer ${token(Role.ADMIN)}`)
      .send(input)
      .expect(409);
    expect(await prisma.ticketEvent.count({ where: { ticketId: id } })).toBe(2);
  });

  it("redispatches an escalated ticket", async () => {
    const ticket = await prisma.repairTicket.create({
      data: {
        roomId: "room-1",
        reporterId: "user-student",
        category: "LIGHT",
        description: "Still broken",
        status: "ESCALATED",
      },
    });
    const res = await request(app.getHttpServer())
      .post(`/api/m3/tickets/${ticket.id}/dispatch`)
      .set("authorization", `Bearer ${token(Role.MAINTAINER)}`)
      .send({ assigneeId: "worker", priority: "URGENT", slaDueAt: due })
      .expect(201);
    expect(res.body.data).toMatchObject({ status: "DISPATCHED", assigneeId: "worker" });
    expect(await prisma.ticketEvent.findMany({ where: { ticketId: ticket.id } })).toMatchObject([
      { fromStatus: "ESCALATED", toStatus: "DISPATCHED", actorId: "user-maintainer" },
    ]);
  });
});

describe("repair progress and event history", () => {
  it("allows only the assigned maintainer to start and complete a ticket", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/m3/tickets")
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send(report)
      .expect(201);
    const id = created.body.data.id as string;
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/dispatch`)
      .set("authorization", `Bearer ${token(Role.ADMIN)}`)
      .send({ assigneeId: "worker", priority: "HIGH", slaDueAt: due })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/start`)
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/start`)
      .set("authorization", `Bearer ${token(Role.MAINTAINER)}`)
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/m3/tickets/missing/start")
      .set("authorization", `Bearer ${token(Role.MAINTAINER, "worker")}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/complete`)
      .set("authorization", `Bearer ${token(Role.MAINTAINER, "worker")}`)
      .expect(409);
    expect(await prisma.ticketEvent.count({ where: { ticketId: id } })).toBe(2);

    const started = await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/start`)
      .set("authorization", `Bearer ${token(Role.MAINTAINER, "worker")}`)
      .expect(201);
    expect(started.body.data.status).toBe("IN_PROGRESS");
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/start`)
      .set("authorization", `Bearer ${token(Role.MAINTAINER, "worker")}`)
      .expect(409);
    const completed = await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/complete`)
      .set("authorization", `Bearer ${token(Role.MAINTAINER, "worker")}`)
      .expect(201);
    expect(completed.body.data.status).toBe("DONE");
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${id}/complete`)
      .set("authorization", `Bearer ${token(Role.MAINTAINER, "worker")}`)
      .expect(409);
    expect(await prisma.repairTicket.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "DONE",
      assigneeId: "worker",
    });
    expect(
      await prisma.ticketEvent.findMany({ where: { ticketId: id }, orderBy: { createdAt: "asc" } }),
    ).toMatchObject([
      { fromStatus: null, toStatus: "REPORTED", actorId: "user-student" },
      { fromStatus: "REPORTED", toStatus: "DISPATCHED", actorId: "user-admin" },
      { fromStatus: "DISPATCHED", toStatus: "IN_PROGRESS", actorId: "worker" },
      { fromStatus: "IN_PROGRESS", toStatus: "DONE", actorId: "worker" },
    ]);
    const history = await request(app.getHttpServer())
      .get(`/api/m3/tickets/${id}/events`)
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .expect(200);
    expect(history.body.data.map((event: { toStatus: string }) => event.toStatus)).toEqual([
      "REPORTED",
      "DISPATCHED",
      "IN_PROGRESS",
      "DONE",
    ]);
  });

  it("resumes an escalated or reworked ticket using existing transitions", async () => {
    for (const status of ["ESCALATED", "REWORK"] as const) {
      const ticket = await prisma.repairTicket.create({
        data: {
          roomId: "room-1",
          reporterId: "user-student",
          category: "LIGHT",
          description: "Still broken",
          status,
          assigneeId: "worker",
        },
      });
      const response = await request(app.getHttpServer())
        .post(`/api/m3/tickets/${ticket.id}/start`)
        .set("authorization", `Bearer ${token(Role.MAINTAINER, "worker")}`)
        .expect(201);
      expect(response.body.data.status).toBe("IN_PROGRESS");
      expect(await prisma.ticketEvent.findMany({ where: { ticketId: ticket.id } })).toMatchObject([
        { fromStatus: status, toStatus: "IN_PROGRESS", actorId: "worker" },
      ]);
    }
  });

  it("limits event history to the reporter, assignee, and admin", async () => {
    const ticket = await prisma.repairTicket.create({
      data: {
        roomId: "room-1",
        reporterId: "user-student",
        category: "LIGHT",
        description: "Broken",
        assigneeId: "worker",
        events: { create: { toStatus: "REPORTED", actorId: "user-student" } },
      },
    });
    for (const auth of [token(Role.STUDENT), token(Role.MAINTAINER, "worker"), token(Role.ADMIN)]) {
      const response = await request(app.getHttpServer())
        .get(`/api/m3/tickets/${ticket.id}/events`)
        .set("authorization", `Bearer ${auth}`)
        .expect(200);
      expect(response.body.data).toMatchObject([
        { ticketId: ticket.id, fromStatus: null, toStatus: "REPORTED" },
      ]);
      expect(response.body.data[0].createdAt).toEqual(expect.any(String));
    }
    await request(app.getHttpServer())
      .get(`/api/m3/tickets/${ticket.id}/events`)
      .set("authorization", `Bearer ${token(Role.STUDENT, "other")}`)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/m3/tickets/missing/events")
      .set("authorization", `Bearer ${token(Role.ADMIN)}`)
      .expect(404);
  });
});

describe("acceptance and rework", () => {
  async function doneTicket(id: string) {
    return prisma.repairTicket.create({
      data: {
        id,
        roomId: "room-1",
        reporterId: "user-student",
        category: "LIGHT",
        description: "fixed",
        status: "DONE",
        assigneeId: "worker",
      },
    });
  }

  it("accepts a DONE ticket with a rating and records the score in its event", async () => {
    const ticket = await doneTicket("accept-1");
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${ticket.id}/accept`)
      .set("authorization", `Bearer ${token(Role.STUDENT, "other")}`)
      .send({ rating: 5 })
      .expect(403);

    const res = await request(app.getHttpServer())
      .post(`/api/m3/tickets/${ticket.id}/accept`)
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send({ rating: 5 })
      .expect(201);
    expect(res.body.data).toMatchObject({ status: "ACCEPTED", rating: 5 });
    expect(await prisma.repairTicket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject(
      {
        status: "ACCEPTED",
        rating: 5,
      },
    );
    expect(await prisma.ticketEvent.findMany({ where: { ticketId: ticket.id } })).toMatchObject([
      { fromStatus: "DONE", toStatus: "ACCEPTED", actorId: "user-student", note: "评分：5" },
    ]);

    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${ticket.id}/accept`)
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send({ rating: 4 })
      .expect(409);
  });

  it("rejects a DONE ticket with a reason and lets the maintainer repair it again", async () => {
    const ticket = await doneTicket("reject-1");
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${ticket.id}/reject`)
      .set("authorization", `Bearer ${token(Role.STUDENT, "other")}`)
      .send({ reason: "still broken" })
      .expect(403);

    const rejected = await request(app.getHttpServer())
      .post(`/api/m3/tickets/${ticket.id}/reject`)
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send({ reason: "still broken" })
      .expect(201);
    expect(rejected.body.data).toMatchObject({ status: "REWORK" });
    expect(await prisma.ticketEvent.findMany({ where: { ticketId: ticket.id } })).toMatchObject([
      { fromStatus: "DONE", toStatus: "REWORK", note: "still broken" },
    ]);

    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${ticket.id}/start`)
      .set("authorization", `Bearer ${token(Role.MAINTAINER, "worker")}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${ticket.id}/complete`)
      .set("authorization", `Bearer ${token(Role.MAINTAINER, "worker")}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${ticket.id}/accept`)
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send({ rating: 3 })
      .expect(201);
    expect(await prisma.repairTicket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject(
      {
        status: "ACCEPTED",
        rating: 3,
      },
    );
  });

  it("rejects non-DONE tickets and invalid ratings or reasons", async () => {
    const ticket = await prisma.repairTicket.create({
      data: {
        id: "accept-2",
        roomId: "room-1",
        reporterId: "user-student",
        category: "LIGHT",
        description: "new",
        status: "REPORTED",
      },
    });
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${ticket.id}/accept`)
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send({ rating: 5 })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${ticket.id}/reject`)
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send({ reason: "no" })
      .expect(409);

    const done = await doneTicket("accept-3");
    for (const rating of [0, 6, 2.5]) {
      await request(app.getHttpServer())
        .post(`/api/m3/tickets/${done.id}/accept`)
        .set("authorization", `Bearer ${token(Role.STUDENT)}`)
        .send({ rating })
        .expect(400);
    }
    await request(app.getHttpServer())
      .post(`/api/m3/tickets/${done.id}/reject`)
      .set("authorization", `Bearer ${token(Role.STUDENT)}`)
      .send({ reason: "  " })
      .expect(400);
  });
});
