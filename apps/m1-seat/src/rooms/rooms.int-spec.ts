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

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [createAppModule(options)],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/m1");
  await app.init();
  const prisma = app.get(PrismaService);

  const lib = await prisma.room.create({
    data: {
      code: "LIB-301",
      name: "图书馆三楼自习室",
      building: "图书馆",
      floor: 3,
      openFrom: "07:00",
      openTo: "22:30",
      departmentId: null,
      seats: {
        create: [
          { code: "01", hasPowerOutlet: true },
          { code: "02", hasPowerOutlet: false },
          { code: "03", hasPowerOutlet: false, isActive: false },
        ],
      },
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
      seats: { create: [{ code: "01", hasPowerOutlet: true }] },
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

describe("GET /api/m1/rooms/:id/seats", () => {
  it("lists active seats and applies hasPower", async () => {
    const all = await request(app.getHttpServer())
      .get(`/api/m1/rooms/${libRoomId}/seats`)
      .set("authorization", `Bearer ${token([Role.STUDENT], null)}`)
      .expect(200);
    expect(all.body.data.room.code).toBe("LIB-301");
    expect(all.body.data.seats.map((s: { code: string }) => s.code)).toEqual(["01", "02"]);

    const powered = await request(app.getHttpServer())
      .get(`/api/m1/rooms/${libRoomId}/seats?hasPower=true`)
      .set("authorization", `Bearer ${token([Role.STUDENT], null)}`)
      .expect(200);
    expect(powered.body.data.seats.map((s: { code: string }) => s.code)).toEqual(["01"]);
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
