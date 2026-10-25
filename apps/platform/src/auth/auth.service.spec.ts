import { Role } from "@campus/contracts";
import { JwtService } from "@nestjs/jwt";
import { hash } from "bcryptjs";
import { beforeAll, describe, expect, it } from "vitest";
import type { UserRecord, UsersRepository } from "../users/users.repository";
import { AuthService, toJwtPayload } from "./auth.service";

const options = { jwtSecret: "unit-secret-0123456789", internalToken: "t", expiresIn: "1h" };
const jwt = new JwtService({ secret: options.jwtSecret });

let alice: UserRecord;

beforeAll(async () => {
  alice = {
    id: "u-alice",
    username: "alice",
    passwordHash: await hash("correct horse", 4),
    displayName: "Alice",
    departmentId: "CS",
    isActive: true,
    roleCodes: [Role.STUDENT],
  };
});

function serviceWith(users: Record<string, UserRecord>): AuthService {
  const repo = {
    findByUsername: async (username: string) => users[username] ?? null,
    findById: async (id: string) => Object.values(users).find((u) => u.id === id) ?? null,
  } as unknown as UsersRepository;
  return new AuthService(repo, jwt, options);
}

describe("AuthService.login", () => {
  it("returns a signed token whose claims match the user", async () => {
    const result = await serviceWith({ alice }).login({
      username: "alice",
      password: "correct horse",
    });
    expect(result.expiresIn).toBe("1h");
    expect(result.user).toEqual({
      sub: "u-alice",
      username: "alice",
      displayName: "Alice",
      roles: ["student"],
      departmentId: "CS",
    });
    const verified = await jwt.verifyAsync(result.accessToken);
    expect(verified.sub).toBe("u-alice");
    expect(verified.roles).toEqual(["student"]);
  });

  it("rejects a wrong password with the generic message", async () => {
    await expect(
      serviceWith({ alice }).login({ username: "alice", password: "wrong" }),
    ).rejects.toThrow("invalid username or password");
  });

  it("rejects an unknown user with the same generic message", async () => {
    await expect(
      serviceWith({ alice }).login({ username: "bob", password: "correct horse" }),
    ).rejects.toThrow("invalid username or password");
  });

  it("rejects a disabled account even with the right password", async () => {
    const disabled = { ...alice, isActive: false };
    await expect(
      serviceWith({ alice: disabled }).login({ username: "alice", password: "correct horse" }),
    ).rejects.toThrow("invalid username or password");
  });
});

describe("toJwtPayload", () => {
  it("fails loudly when a stored role code is unknown to contracts", () => {
    expect(() => toJwtPayload({ ...alice, roleCodes: ["wizard"] })).toThrow();
  });

  it("fails when a user has no roles at all", () => {
    expect(() => toJwtPayload({ ...alice, roleCodes: [] })).toThrow();
  });
});
