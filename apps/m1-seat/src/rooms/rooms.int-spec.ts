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

const token = (roles: Role[], departmentId: string | null) =>
  jwt.sign({
    sub: `u-${roles.join("-")}-${departmentId ?? "none"}`,
    username: "u",
    displayName: "U",
    roles,
    departmentId,
  } satisfies JwtPayload);

let app: INestApplication;
let libRoomId: string;
let csRoomId: string;
let libSeatIds: Record<string, string>;
const seatId = (code: string): string => {
  const id = libSeatIds[code];
  if (!id) throw new Error(`no seat ${code}`);
  return id;
};

const WINDOW = {
  from: new Date("2030-01-10T02:00:00.000Z"),
  to: new Date("2030-01-10T04:00:00.000Z"),
};
const windowQuery = `from=${WINDOW.from.toISOString()}&to=${WINDOW.to.toISOString()}`;
const STUDENT_SUB = `u-${Role.STUDENT}-none`;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [createAppModule(options)],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/m1");
  await app.init();
  const prisma = app.get(PrismaService);

  // Seat 01 sits one unit from the wall socket W1 (covered); seat 02 is far from every outlet.
  const lib = await prisma.room.create({
    data: {
      code: "LIB-301",
      name: "图书馆三楼自习室",
      building: "图书馆",
      floor: 3,
      openFrom: "07:00",
      openTo: "22:30",
      departmentId: null,
      width: 18,
      height: 12,
      seats: {
        create: [
          { code: "01", x: 2, y: 2 },
          { code: "02", x: 10, y: 2 },
          { code: "03", x: 12, y: 2, isActive: false },
        ],
      },
      outlets: { create: [{ code: "W1", kind: "FIXED", x: 1, y: 2, range: 1 }] },
    },
  });
  const cs = await prisma.room.create({
    data: {
      code: "CS-304",
      name: "计算机学院 304",
      building: "逸夫楼",
      floor: 3,
      openFrom: "08:00",
      openTo: "21:30",
      departmentId: "CS",
      seats: { create: [{ code: "01", x: 2, y: 2 }] },
    },
  });
  await prisma.room.create({
    data: {
      code: "OLD-1",
      name: "已注销",
      building: "旧楼",
      floor: 1,
      openFrom: "08:00",
      openTo: "20:00",
      isActive: false,
    },
  });
  libRoomId = lib.id;
  csRoomId = cs.id;
  const libSeats = await prisma.seat.findMany({ where: { roomId: lib.id } });
  libSeatIds = Object.fromEntries(libSeats.map((s) => [s.code, s.id]));
});

afterAll(async () => {
  await app.close();
});

describe("GET /api/m1/rooms", () => {
  it("requires a token", async () => {
    const res = await request(app.getHttpServer()).get("/api/m1/rooms").expect(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("shows a CS student the campus room and the CS room, never inactive rooms", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/m1/rooms")
      .set("authorization", `Bearer ${token([Role.STUDENT], "CS")}`)
      .expect(200);
    expect(res.body.data.map((r: { code: string }) => r.code).sort()).toEqual([
      "CS-304",
      "LIB-301",
    ]);
    const lib = res.body.data.find((r: { code: string }) => r.code === "LIB-301");
    expect(lib.seatCount).toBe(2);
    expect(lib.width).toBe(18);
    expect(lib.height).toBe(12);
  });

  it("hides the CS room from an EE student", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/m1/rooms")
      .set("authorization", `Bearer ${token([Role.STUDENT], "EE")}`)
      .expect(200);
    expect(res.body.data.map((r: { code: string }) => r.code)).toEqual(["LIB-301"]);
  });

  it("filters by building and keyword", async () => {
    const byBuilding = await request(app.getHttpServer())
      .get("/api/m1/rooms?building=逸夫楼")
      .set("authorization", `Bearer ${token([Role.ADMIN], null)}`)
      .expect(200);
    expect(byBuilding.body.data.map((r: { code: string }) => r.code)).toEqual(["CS-304"]);

    const byKeyword = await request(app.getHttpServer())
      .get("/api/m1/rooms?keyword=lib")
      .set("authorization", `Bearer ${token([Role.ADMIN], null)}`)
      .expect(200);
    expect(byKeyword.body.data.map((r: { code: string }) => r.code)).toEqual(["LIB-301"]);
  });
});

describe("GET /api/m1/rooms/internal/:id/lookup", () => {
  it("requires the internal token and returns only active seat ids", async () => {
    await request(app.getHttpServer())
      .get(`/api/m1/rooms/internal/${libRoomId}/lookup`)
      .expect(401);
    const res = await request(app.getHttpServer())
      .get(`/api/m1/rooms/internal/${libRoomId}/lookup`)
      .set("x-internal-token", options.internalToken)
      .expect(200);
    const prisma = app.get(PrismaService);
    const seats = await prisma.seat.findMany({ where: { roomId: libRoomId, isActive: true } });
    expect(res.body.data).toEqual({ id: libRoomId, seatIds: seats.map((s) => s.id) });
  });

  it("rejects an unknown room", async () => {
    await request(app.getHttpServer())
      .get("/api/m1/rooms/internal/missing/lookup")
      .set("x-internal-token", options.internalToken)
      .expect(404);
  });
});

describe("GET /api/m1/rooms/:id/seats", () => {
  it("returns seats with positions, derived power and the room's outlets", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/m1/rooms/${libRoomId}/seats`)
      .set("authorization", `Bearer ${token([Role.STUDENT], null)}`)
      .expect(200);
    expect(res.body.data.room.code).toBe("LIB-301");
    expect(res.body.data.seats).toEqual([
      expect.objectContaining({ code: "01", x: 2, y: 2, hasPowerOutlet: true }),
      expect.objectContaining({ code: "02", x: 10, y: 2, hasPowerOutlet: false }),
    ]);
    expect(res.body.data.outlets).toEqual([
      expect.objectContaining({ code: "W1", kind: "FIXED", x: 1, y: 2, range: 1 }),
    ]);
  });

  it("applies hasPower=true to the seats but keeps the full outlet list", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/m1/rooms/${libRoomId}/seats?hasPower=true`)
      .set("authorization", `Bearer ${token([Role.STUDENT], null)}`)
      .expect(200);
    expect(res.body.data.seats.map((s: { code: string }) => s.code)).toEqual(["01"]);
    expect(res.body.data.outlets).toHaveLength(1);
  });

  it("returns an empty outlet list and no powered seats for a room without outlets", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/m1/rooms/${csRoomId}/seats`)
      .set("authorization", `Bearer ${token([Role.STUDENT], "CS")}`)
      .expect(200);
    expect(res.body.data.outlets).toEqual([]);
    expect(res.body.data.seats[0].hasPowerOutlet).toBe(false);
  });

  describe("availability in a window (REQ-M1-11)", () => {
    beforeAll(async () => {
      const prisma = app.get(PrismaService);
      // Seat 01: the caller's own reservation. Seat 02: an M3 repair block. Seat 04 (added
      // here): another student's reservation. Seat 05 (added here): free. Seat 06 (added
      // here): free at the start, taken by someone else one hour later.
      const extra = await prisma.seat.createManyAndReturn({
        data: [
          { roomId: libRoomId, code: "04", x: 4, y: 6 },
          { roomId: libRoomId, code: "05", x: 6, y: 6 },
          { roomId: libRoomId, code: "06", x: 8, y: 6 },
        ],
      });
      for (const s of extra) libSeatIds[s.code] = s.id;
      const mine = await prisma.reservation.create({
        data: { seatId: seatId("01"), roomId: libRoomId, userId: STUDENT_SUB, ...WINDOW },
      });
      const other = await prisma.reservation.create({
        data: { seatId: seatId("04"), roomId: libRoomId, userId: "someone-else", ...WINDOW },
      });
      const laterWindow = { from: new Date("2030-01-10T03:00:00.000Z"), to: WINDOW.to };
      const later = await prisma.reservation.create({
        data: { seatId: seatId("06"), roomId: libRoomId, userId: "someone-else", ...laterWindow },
      });
      await prisma.seatStatus.createMany({
        data: [
          {
            seatId: seatId("06"),
            kind: "RESERVED",
            source: "M1_RESERVATION",
            refId: later.id,
            ...laterWindow,
          },
          {
            seatId: seatId("01"),
            kind: "RESERVED",
            source: "M1_RESERVATION",
            refId: mine.id,
            ...WINDOW,
          },
          {
            seatId: seatId("04"),
            kind: "RESERVED",
            source: "M1_RESERVATION",
            refId: other.id,
            ...WINDOW,
          },
          {
            seatId: seatId("02"),
            kind: "BLOCKED",
            source: "M3_REPAIR",
            refId: "ticket-1",
            from: new Date("2030-01-10T00:00:00.000Z"),
            to: new Date("2030-01-10T03:00:00.000Z"),
          },
        ],
      });
    });

    it("marks each seat MINE, BLOCKED, RESERVED or FREE for the caller, with provenance", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/m1/rooms/${libRoomId}/seats?${windowQuery}`)
        .set("authorization", `Bearer ${token([Role.STUDENT], null)}`)
        .expect(200);
      const byCode = Object.fromEntries(
        res.body.data.seats.map((s: { code: string; availability: unknown }) => [
          s.code,
          s.availability,
        ]),
      );
      expect(byCode["01"]).toMatchObject({ state: "MINE", source: "M1_RESERVATION" });
      expect(byCode["01"].refId).toEqual(expect.any(String));
      expect(byCode["02"]).toMatchObject({
        state: "BLOCKED",
        source: "M3_REPAIR",
        until: "2030-01-10T03:00:00.000Z",
      });
      expect(byCode["04"]).toMatchObject({ state: "RESERVED", source: "M1_RESERVATION" });
      expect(byCode["05"]).toEqual({ state: "FREE" });
      expect(byCode["06"]).toEqual({ state: "FREE", freeUntil: "2030-01-10T03:00:00.000Z" });
      expect(res.body.data.window).toEqual({
        from: WINDOW.from.toISOString(),
        to: WINDOW.to.toISOString(),
      });
    });

    it("shows the same reservation as RESERVED to another student", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/m1/rooms/${libRoomId}/seats?${windowQuery}`)
        .set("authorization", `Bearer ${token([Role.STUDENT], "EE")}`)
        .expect(200);
      const seat01 = res.body.data.seats.find((s: { code: string }) => s.code === "01");
      expect(seat01.availability.state).toBe("RESERVED");
    });

    it("omits availability and the window echo without from/to", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/m1/rooms/${libRoomId}/seats`)
        .set("authorization", `Bearer ${token([Role.STUDENT], null)}`)
        .expect(200);
      expect(res.body.data.seats[0].availability).toBeUndefined();
      expect(res.body.data.window).toBeUndefined();
    });

    it("counts free seats per room in the window on the room list", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/m1/rooms?${windowQuery}`)
        .set("authorization", `Bearer ${token([Role.STUDENT], "CS")}`)
        .expect(200);
      const lib = res.body.data.find((r: { code: string }) => r.code === "LIB-301");
      const cs = res.body.data.find((r: { code: string }) => r.code === "CS-304");
      // 01 mine, 02 blocked, 04 other, 06 taken later in the window: one of five is free.
      expect(lib.seatCount).toBe(5);
      expect(lib.freeSeatCount).toBe(1);
      expect(cs.freeSeatCount).toBe(1);
    });

    it("rejects a half window or an inverted one with VALIDATION_FAILED", async () => {
      const half = await request(app.getHttpServer())
        .get(`/api/m1/rooms/${libRoomId}/seats?from=${WINDOW.from.toISOString()}`)
        .set("authorization", `Bearer ${token([Role.STUDENT], null)}`)
        .expect(400);
      expect(half.body.error.code).toBe("VALIDATION_FAILED");
      const inverted = await request(app.getHttpServer())
        .get(`/api/m1/rooms?from=${WINDOW.to.toISOString()}&to=${WINDOW.from.toISOString()}`)
        .set("authorization", `Bearer ${token([Role.STUDENT], null)}`)
        .expect(400);
      expect(inverted.body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  it("rejects an invalid hasPower value with VALIDATION_FAILED", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/m1/rooms/${libRoomId}/seats?hasPower=maybe`)
      .set("authorization", `Bearer ${token([Role.STUDENT], null)}`)
      .expect(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("answers 404 for a department room the caller may not see", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/m1/rooms/${csRoomId}/seats`)
      .set("authorization", `Bearer ${token([Role.STUDENT], "EE")}`)
      .expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
