import { type JwtPayload, Role } from "@campus/contracts";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

const options = { jwtSecret: "int-secret-0123456789", internalToken: "int-token", expiresIn: "1h" };
const jwt = new JwtService({ secret: options.jwtSecret });
const token = (sub: string, roles: Role[] = [Role.STUDENT]) =>
  jwt.sign({
    sub,
    username: sub,
    displayName: sub,
    roles,
    departmentId: null,
  } satisfies JwtPayload);

/** Tomorrow 10:00–12:00 Shanghai (02:00Z–04:00Z): always in the future and inside opening hours. */
function tomorrowWindow(startHourUtc: number, hours: number): { from: string; to: string } {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() + 1);
  from.setUTCHours(startHourUtc, 0, 0, 0);
  const to = new Date(from.getTime() + hours * 3_600_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

let app: INestApplication;
let prisma: PrismaService;
let seatA: string;
let seatB: string;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [createAppModule(options)],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/m1");
  await app.init();
  prisma = app.get(PrismaService);
  const room = await prisma.room.create({
    data: {
      code: "RSV-301",
      name: "预约测试自习室",
      building: "图书馆",
      floor: 3,
      openFrom: "07:00",
      openTo: "22:30",
      seats: {
        create: [
          { code: "01", x: 2, y: 2 },
          { code: "02", x: 4, y: 2 },
        ],
      },
    },
    include: { seats: true },
  });
  seatA = room.seats.find((s) => s.code === "01")?.id ?? "";
  seatB = room.seats.find((s) => s.code === "02")?.id ?? "";
});

beforeEach(async () => {
  await prisma.seatStatus.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.setting.deleteMany();
});

afterAll(async () => {
  // Other int-spec files share the m1_test schema: leave no rows behind.
  await prisma.seatStatus.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.room.deleteMany({ where: { code: "RSV-301" } });
  await app.close();
});

const post = (sub: string, body: object) =>
  request(app.getHttpServer())
    .post("/api/m1/reservations")
    .set("authorization", `Bearer ${token(sub)}`)
    .send(body);

describe("POST /api/m1/reservations", () => {
  it("creates a reservation and its RESERVED seat status with M1 provenance (X-3)", async () => {
    const res = await post("alice", { seatId: seatA, ...tomorrowWindow(2, 2) }).expect(201);
    expect(res.body.data).toMatchObject({
      seatCode: "01",
      roomCode: "RSV-301",
      status: "BOOKED",
      userId: "alice",
    });
    const statuses = await prisma.seatStatus.findMany({ where: { seatId: seatA } });
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toMatchObject({
      kind: "RESERVED",
      source: "M1_RESERVATION",
      refId: res.body.data.id,
    });
  });

  it("rejects a non-whole-hour window with the rule name in details", async () => {
    const window = tomorrowWindow(2, 2);
    const res = await post("alice", {
      seatId: seatA,
      from: window.from,
      to: window.to.replace("00:00.000Z", "30:00.000Z"),
    }).expect(400);
    expect(res.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      details: { rule: "whole-hour" },
    });
  });

  it("rejects an overlapping reservation on the same seat with 409 seat-overlap", async () => {
    await post("alice", { seatId: seatA, ...tomorrowWindow(2, 2) }).expect(201);
    const res = await post("bob", { seatId: seatA, ...tomorrowWindow(3, 2) }).expect(409);
    expect(res.body.error).toMatchObject({ code: "CONFLICT", details: { rule: "seat-overlap" } });
  });

  it("rejects a second seat for the same user in an overlapping period", async () => {
    await post("alice", { seatId: seatA, ...tomorrowWindow(2, 2) }).expect(201);
    const res = await post("alice", { seatId: seatB, ...tomorrowWindow(3, 1) }).expect(409);
    expect(res.body.error.details.rule).toBe("user-overlap");
  });

  it("lets exactly one of ten concurrent requests for the same seat succeed", async () => {
    const window = tomorrowWindow(5, 2);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => post(`user-${i}`, { seatId: seatA, ...window })),
    );
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(9);
    expect(await prisma.reservation.count({ where: { status: "BOOKED" } })).toBe(1);
    expect(await prisma.seatStatus.count()).toBe(1);
  });

  it("honours a lower maxHours set by a room manager, and forbids students from changing it", async () => {
    await request(app.getHttpServer())
      .put("/api/m1/settings/reservation.maxHours")
      .set("authorization", `Bearer ${token("mgr", [Role.ROOM_MANAGER])}`)
      .send({ value: "2" })
      .expect(200);
    const res = await post("alice", { seatId: seatA, ...tomorrowWindow(2, 3) }).expect(400);
    expect(res.body.error.details.rule).toBe("duration");

    await request(app.getHttpServer())
      .put("/api/m1/settings/reservation.maxHours")
      .set("authorization", `Bearer ${token("alice")}`)
      .send({ value: "8" })
      .expect(403);
    const bad = await request(app.getHttpServer())
      .put("/api/m1/settings/reservation.maxHours")
      .set("authorization", `Bearer ${token("mgr", [Role.ROOM_MANAGER])}`)
      .send({ value: "99" })
      .expect(400);
    expect(bad.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("DELETE /api/m1/reservations/:id", () => {
  it("cancels the caller's reservation, releases the seat and frees the window", async () => {
    const window = tomorrowWindow(2, 2);
    const created = await post("alice", { seatId: seatA, ...window }).expect(201);
    const res = await request(app.getHttpServer())
      .delete(`/api/m1/reservations/${created.body.data.id}`)
      .set("authorization", `Bearer ${token("alice")}`)
      .expect(200);
    expect(res.body.data.status).toBe("CANCELLED");
    expect(await prisma.seatStatus.count({ where: { seatId: seatA } })).toBe(0);
    await post("bob", { seatId: seatA, ...window }).expect(201);
  });

  it("forbids cancelling another user's reservation", async () => {
    const created = await post("alice", { seatId: seatA, ...tomorrowWindow(2, 2) }).expect(201);
    const res = await request(app.getHttpServer())
      .delete(`/api/m1/reservations/${created.body.data.id}`)
      .set("authorization", `Bearer ${token("bob")}`)
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lists the caller's reservations newest first", async () => {
    await post("alice", { seatId: seatA, ...tomorrowWindow(2, 1) }).expect(201);
    await post("alice", { seatId: seatB, ...tomorrowWindow(6, 1) }).expect(201);
    const res = await request(app.getHttpServer())
      .get("/api/m1/reservations/me")
      .set("authorization", `Bearer ${token("alice")}`)
      .expect(200);
    expect(res.body.data.map((r: { seatCode: string }) => r.seatCode)).toEqual(["02", "01"]);
  });
});
