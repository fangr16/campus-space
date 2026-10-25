import { describe, expect, it } from "vitest";
import {
  INTERNAL_TOKEN_HEADER,
  JwtPayloadSchema,
  LoginRequestSchema,
  Role,
  RoleSchema,
} from "./auth";

describe("RoleSchema", () => {
  it("accepts every declared role and nothing else", () => {
    for (const role of Object.values(Role)) expect(RoleSchema.safeParse(role).success).toBe(true);
    expect(RoleSchema.safeParse("superuser").success).toBe(false);
  });
});

describe("JwtPayloadSchema", () => {
  const valid = {
    sub: "u1",
    username: "alice",
    displayName: "Alice",
    roles: [Role.STUDENT],
  };

  it("defaults departmentId to null when the claim is absent", () => {
    expect(JwtPayloadSchema.parse(valid).departmentId).toBeNull();
  });

  it("requires at least one role", () => {
    expect(JwtPayloadSchema.safeParse({ ...valid, roles: [] }).success).toBe(false);
  });

  it("rejects an unknown role inside an otherwise valid token", () => {
    expect(JwtPayloadSchema.safeParse({ ...valid, roles: ["root"] }).success).toBe(false);
  });
});

describe("LoginRequestSchema", () => {
  it("trims the username but never the password", () => {
    const parsed = LoginRequestSchema.parse({ username: "  alice ", password: " p w " });
    expect(parsed).toEqual({ username: "alice", password: " p w " });
  });

  it("rejects empty credentials", () => {
    expect(LoginRequestSchema.safeParse({ username: "   ", password: "x" }).success).toBe(false);
    expect(LoginRequestSchema.safeParse({ username: "a", password: "" }).success).toBe(false);
  });
});

describe("INTERNAL_TOKEN_HEADER", () => {
  it("is lower-case so Node's header map matches it", () => {
    expect(INTERNAL_TOKEN_HEADER).toBe(INTERNAL_TOKEN_HEADER.toLowerCase());
  });
});
