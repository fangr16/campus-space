import { type JwtPayload, Role } from "@campus/contracts";
import { PUBLIC_ROUTE_KEY } from "@campus/nest-common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it } from "vitest";
import { type AuthenticatedRequest, INTERNAL_KEY } from "./decorators";
import { bearerToken, JwtAuthGuard, safeEqual } from "./jwt-auth.guard";

const options = { jwtSecret: "test-secret-0123456789", internalToken: "internal-abc" };
const jwt = new JwtService({ secret: options.jwtSecret });
const payload: JwtPayload = {
  sub: "u1",
  username: "alice",
  displayName: "Alice",
  roles: [Role.STUDENT],
  departmentId: null,
};

function contextFor(
  headers: Record<string, string>,
  metadata: Record<string, unknown> = {},
): { ctx: ExecutionContext; request: AuthenticatedRequest } {
  const request: AuthenticatedRequest = { headers };
  const handler = () => undefined;
  for (const [key, value] of Object.entries(metadata)) Reflect.defineMetadata(key, value, handler);
  const ctx = {
    getHandler: () => handler,
    getClass: () => class Dummy {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

const guard = new JwtAuthGuard(new Reflector(), jwt, options);

describe("JwtAuthGuard", () => {
  it("allows @Public routes without any header", async () => {
    const { ctx } = contextFor({}, { [PUBLIC_ROUTE_KEY]: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("rejects a request with no authorization header", async () => {
    const { ctx } = contextFor({});
    await expect(guard.canActivate(ctx)).rejects.toThrow("missing bearer token");
  });

  it("accepts a valid token and attaches the parsed user", async () => {
    const token = await jwt.signAsync(payload);
    const { ctx, request } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual(payload);
  });

  it("rejects a token signed with another secret", async () => {
    const token = await new JwtService({ secret: "other" }).signAsync(payload);
    const { ctx } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow("invalid or expired token");
  });

  it("rejects an expired token", async () => {
    const token = await jwt.signAsync(payload, { expiresIn: "-1s" });
    const { ctx } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow("invalid or expired token");
  });

  it("rejects a well-signed token whose payload has an unknown role", async () => {
    const token = await jwt.signAsync({ ...payload, roles: ["superuser"] });
    const { ctx } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow("token payload is not recognized");
  });

  it("accepts the internal token on @Internal routes and flags the request", async () => {
    const { ctx, request } = contextFor(
      { "x-internal-token": options.internalToken },
      { [INTERNAL_KEY]: true },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.internal).toBe(true);
    expect(request.user).toBeUndefined();
  });

  it("rejects a wrong internal token even with a valid bearer token present", async () => {
    const token = await jwt.signAsync(payload);
    const { ctx } = contextFor(
      { "x-internal-token": "nope", authorization: `Bearer ${token}` },
      { [INTERNAL_KEY]: true },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow("invalid internal service token");
  });
});

describe("bearerToken", () => {
  it.each([
    ["Bearer abc", "abc"],
    ["bearer abc", "abc"],
    ["  Bearer   abc  ", "abc"],
  ])("extracts the token from %j", (header, expected) => {
    expect(bearerToken(header)).toBe(expected);
  });

  it.each([undefined, "", "Basic abc", "Bearer", "Bearer a b"])("returns undefined for %j", (h) => {
    expect(bearerToken(h)).toBeUndefined();
  });
});

describe("safeEqual", () => {
  it("compares equal and unequal strings of the same and different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});
