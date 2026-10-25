import { Role } from "@campus/contracts";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

const options = { jwtSecret: "int-secret-0123456789", internalToken: "int-token", expiresIn: "1h" };

let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [createAppModule(options)],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/platform");
  await app.init();
  prisma = app.get(PrismaService);

  const student = await prisma.role.create({ data: { code: Role.STUDENT, name: "学生" } });
  await prisma.user.create({
    data: {
      username: "student",
      displayName: "张同学",
      departmentId: "CS",
      passwordHash: await hash("Campus@2026", 4),
      roles: { create: [{ roleId: student.id }] },
    },
  });
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/platform/auth/login", () => {
  it("returns a token in the envelope for valid credentials", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/platform/auth/login")
      .send({ username: "student", password: "Campus@2026" })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(res.body.data.user).toMatchObject({
      username: "student",
      roles: ["student"],
      departmentId: "CS",
    });
    expect(typeof res.body.data.accessToken).toBe("string");
  });

  it("answers 401 UNAUTHENTICATED for a wrong password", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/platform/auth/login")
      .send({ username: "student", password: "nope" })
      .expect(401);
    expect(res.body).toEqual({
      success: false,
      data: null,
      error: { code: "UNAUTHENTICATED", message: "invalid username or password" },
    });
  });

  it("answers 400 VALIDATION_FAILED when the body is malformed", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/platform/auth/login")
      .send({ username: "" })
      .expect(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("GET /api/platform/auth/me", () => {
  it("rejects a missing token", async () => {
    const res = await request(app.getHttpServer()).get("/api/platform/auth/me").expect(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns the claims of a token obtained from login", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/platform/auth/login")
      .send({ username: "student", password: "Campus@2026" });
    const res = await request(app.getHttpServer())
      .get("/api/platform/auth/me")
      .set("authorization", `Bearer ${login.body.data.accessToken}`)
      .expect(200);
    expect(res.body.data.username).toBe("student");
  });
});

describe("public endpoints", () => {
  it("serves /version without a token", async () => {
    const res = await request(app.getHttpServer()).get("/api/platform/version").expect(200);
    expect(res.body.data.service).toBe("platform");
  });

  it("serves /health without a token", async () => {
    const res = await request(app.getHttpServer()).get("/api/platform/health").expect(200);
    expect(res.body.data.status).toBe("ok");
  });
});
