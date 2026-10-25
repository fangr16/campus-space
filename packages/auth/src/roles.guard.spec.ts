import { type JwtPayload, Role } from "@campus/contracts";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { authOptionsFromEnv } from "./auth-options";
import { type AuthenticatedRequest, ROLES_KEY } from "./decorators";
import { hasAnyRole, RolesGuard } from "./roles.guard";

function contextFor(request: AuthenticatedRequest, roles?: Role[]): ExecutionContext {
  const handler = () => undefined;
  if (roles) Reflect.defineMetadata(ROLES_KEY, roles, handler);
  return {
    getHandler: () => handler,
    getClass: () => class Dummy {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const student: JwtPayload = {
  sub: "u1",
  username: "s",
  displayName: "S",
  roles: [Role.STUDENT],
  departmentId: null,
};

describe("RolesGuard", () => {
  const guard = new RolesGuard(new Reflector());

  it("lets any authenticated caller through a route without @Roles", () => {
    expect(guard.canActivate(contextFor({ headers: {}, user: student }))).toBe(true);
  });

  it("allows a user holding one of the required roles", () => {
    const ctx = contextFor({ headers: {}, user: student }, [Role.ADMIN, Role.STUDENT]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("forbids a user lacking every required role", () => {
    const ctx = contextFor({ headers: {}, user: student }, [Role.ADMIN]);
    expect(() => guard.canActivate(ctx)).toThrow("requires one of: admin");
  });

  it("forbids internal requests on role-restricted routes", () => {
    const ctx = contextFor({ headers: {}, internal: true }, [Role.STUDENT]);
    expect(() => guard.canActivate(ctx)).toThrow("requires a user role");
  });
});

describe("hasAnyRole", () => {
  it("is false for an empty held list and true on any overlap", () => {
    expect(hasAnyRole([], [Role.ADMIN])).toBe(false);
    expect(hasAnyRole([Role.OPS_MANAGER, Role.ADMIN], [Role.ADMIN])).toBe(true);
  });
});

describe("authOptionsFromEnv", () => {
  it("fails fast when a secret is missing", () => {
    expect(() => authOptionsFromEnv({})).toThrow("JWT_SECRET is not configured");
    expect(() => authOptionsFromEnv({ JWT_SECRET: "x" })).toThrow(
      "INTERNAL_SERVICE_TOKEN is not configured",
    );
  });

  it("trims values and defaults the expiry", () => {
    expect(
      authOptionsFromEnv({ JWT_SECRET: " s ", INTERNAL_SERVICE_TOKEN: " t ", JWT_EXPIRES_IN: "" }),
    ).toEqual({ jwtSecret: "s", internalToken: "t", expiresIn: "8h" });
  });
});

describe("authOptionsFromEnv in production", () => {
  const strong = "a".repeat(64);
  const other = "b".repeat(64);

  it("accepts long distinct secrets", () => {
    expect(
      authOptionsFromEnv({
        NODE_ENV: "production",
        JWT_SECRET: strong,
        INTERNAL_SERVICE_TOKEN: other,
      }).jwtSecret,
    ).toBe(strong);
  });

  it("rejects short secrets", () => {
    expect(() =>
      authOptionsFromEnv({
        NODE_ENV: "production",
        JWT_SECRET: "short",
        INTERNAL_SERVICE_TOKEN: other,
      }),
    ).toThrow("at least 32 characters");
  });

  it("rejects placeholder values from the templates", () => {
    expect(() =>
      authOptionsFromEnv({
        NODE_ENV: "production",
        JWT_SECRET: "REPLACE_WITH_openssl_rand_hex_32_xxxxxxxxxxxxxxxx",
        INTERNAL_SERVICE_TOKEN: other,
      }),
    ).toThrow("placeholder");
    expect(() =>
      authOptionsFromEnv({
        NODE_ENV: "production",
        JWT_SECRET: strong,
        INTERNAL_SERVICE_TOKEN: "dev-only-internal-token-xxxxxxxxxxxxxxxxxxxxxx",
      }),
    ).toThrow("placeholder");
  });

  it("rejects identical JWT and internal secrets", () => {
    expect(() =>
      authOptionsFromEnv({
        NODE_ENV: "production",
        JWT_SECRET: strong,
        INTERNAL_SERVICE_TOKEN: strong,
      }),
    ).toThrow("must differ");
  });

  it("does not apply the production rules in development", () => {
    expect(authOptionsFromEnv({ JWT_SECRET: "x", INTERNAL_SERVICE_TOKEN: "x" }).jwtSecret).toBe(
      "x",
    );
  });
});
