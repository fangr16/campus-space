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
const token = (role: Role) =>
  jwt.sign({
    sub: `user-${role}`,
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
