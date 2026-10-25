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
