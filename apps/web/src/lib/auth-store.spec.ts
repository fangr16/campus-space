import { type JwtPayload, Role } from "@campus/contracts";
import { describe, expect, it, vi } from "vitest";
import { createAuthStore, memoryStorage } from "./auth-store";

const user: JwtPayload = {
  sub: "u1",
  username: "student",
  displayName: "张同学",
  roles: [Role.STUDENT],
  departmentId: "CS",
};

describe("createAuthStore", () => {
  it("starts signed out with empty storage", () => {
    const store = createAuthStore(memoryStorage());
    expect(store.getSession()).toBeNull();
    expect(store.getToken()).toBeNull();
  });

  it("persists a session and notifies subscribers on sign in and sign out", () => {
    const storage = memoryStorage();
    const store = createAuthStore(storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.signIn({ accessToken: "tok", user });
    expect(store.getToken()).toBe("tok");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(createAuthStore(storage).getSession()?.user.username).toBe("student");

    store.signOut();
    expect(store.getSession()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.signIn({ accessToken: "tok2", user });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("ignores corrupt or contract-violating stored sessions", () => {
    const corrupt = memoryStorage();
    corrupt.setItem("campus-space.session", "{not json");
    expect(createAuthStore(corrupt).getSession()).toBeNull();

    const badUser = memoryStorage();
    badUser.setItem(
      "campus-space.session",
      JSON.stringify({ accessToken: "tok", user: { ...user, roles: ["root"] } }),
    );
    expect(createAuthStore(badUser).getSession()).toBeNull();

    const noToken = memoryStorage();
    noToken.setItem("campus-space.session", JSON.stringify({ user }));
    expect(createAuthStore(noToken).getSession()).toBeNull();
  });

  it("survives a storage that throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(createAuthStore(throwing).getSession()).toBeNull();
  });
});
