import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

const options = { jwtSecret: "int-secret-0123456789", internalToken: "int-token", expiresIn: "1h" };
let app: INestApplication;
let activeId: string;
let inactiveId: string;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [createAppModule(options)],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/platform");
  await app.init();
  const prisma = app.get(PrismaService);
  const role = await prisma.role.create({ data: { code: "maintainer", name: "维修人员" } });
  const active = await prisma.user.create({
    data: {
      username: "worker",
      displayName: "Worker",
      passwordHash: "hash",
      roles: { create: [{ roleId: role.id }] },
    },
  });
  const inactive = await prisma.user.create({
    data: {
      username: "retired",
      displayName: "Retired",
      passwordHash: "hash",
      isActive: false,
      roles: { create: [{ roleId: role.id }] },
    },
  });
  activeId = active.id;
  inactiveId = inactive.id;
});

afterAll(async () => {
  await app.close();
});

describe("internal maintainer lookup", () => {
  it("requires an internal token", async () => {
    await request(app.getHttpServer())
      .get(`/api/platform/users/internal/${activeId}/maintainer`)
      .expect(401);
  });

  it("accepts active maintainers only", async () => {
    for (const [id, eligible] of [
      [activeId, true],
      [inactiveId, false],
      ["missing", false],
    ] as const) {
      const res = await request(app.getHttpServer())
        .get(`/api/platform/users/internal/${id}/maintainer`)
        .set("x-internal-token", options.internalToken)
        .expect(200);
      expect(res.body.data).toEqual({ id, eligible });
    }
  });
});
