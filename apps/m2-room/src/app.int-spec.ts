import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppModule } from "./app.module";

const options = { jwtSecret: "int-secret-0123456789", internalToken: "int-token", expiresIn: "1h" };

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [createAppModule(options)],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/m2");
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe("m2 skeleton", () => {
  it("reports its version without a token", async () => {
    const res = await request(app.getHttpServer()).get("/api/m2/version").expect(200);
    expect(res.body.data.service).toBe("m2");
  });

  it("passes the database health check after migrations were applied", async () => {
    const res = await request(app.getHttpServer()).get("/api/m2/health").expect(200);
    expect(res.body.data).toEqual({ status: "ok", service: "m2", checks: 1 });
  });

  it("answers unknown routes with the shared NOT_FOUND envelope", async () => {
    const res = await request(app.getHttpServer()).get("/api/m2/nothing").expect(404);
    expect(res.body).toEqual({
      success: false,
      data: null,
      error: { code: "NOT_FOUND", message: expect.stringContaining("nothing") },
    });
  });
});
