import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiClientError, createApiClient } from "./api-client";

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const Item = z.object({ id: z.string() });

const headersOf = (init?: RequestInit): Record<string, string> =>
  (init?.headers ?? {}) as Record<string, string>;

function clientWith(fetchImpl: typeof fetch, token: string | null = "tok") {
  const onUnauthenticated = vi.fn();
  const client = createApiClient({ getToken: () => token, onUnauthenticated, fetchImpl });
  return { client, onUnauthenticated };
}

describe("createApiClient", () => {
  it("sends the bearer token and returns the parsed data payload", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(headersOf(init).authorization).toBe("Bearer tok");
      return jsonResponse(200, { success: true, data: { id: "a" }, error: null });
    });
    const { client } = clientWith(fetchImpl as unknown as typeof fetch);
    await expect(client.get("/api/m1/x", Item)).resolves.toEqual({ id: "a" });
  });

  it("omits the authorization header when signed out", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(headersOf(init).authorization).toBeUndefined();
      return jsonResponse(200, { success: true, data: { id: "a" }, error: null });
    });
    const { client } = clientWith(fetchImpl as unknown as typeof fetch, null);
    await client.get("/api/m1/x", Item);
  });

  it("throws ApiClientError with the server's code and calls onUnauthenticated on 401", async () => {
    const fetchImpl = async () =>
      jsonResponse(401, {
        success: false,
        data: null,
        error: { code: "UNAUTHENTICATED", message: "missing bearer token" },
      });
    const { client, onUnauthenticated } = clientWith(fetchImpl as typeof fetch);
    const error = await client.get("/api/m1/x", Item).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).code).toBe("UNAUTHENTICATED");
    expect((error as ApiClientError).status).toBe(401);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("does not call onUnauthenticated for other failures", async () => {
    const fetchImpl = async () =>
      jsonResponse(404, { success: false, data: null, error: { code: "NOT_FOUND", message: "x" } });
    const { client, onUnauthenticated } = clientWith(fetchImpl as typeof fetch);
    await expect(client.get("/api/m1/x", Item)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("rejects a payload that violates the contract even when the server says success", async () => {
    const fetchImpl = async () =>
      jsonResponse(200, { success: true, data: { id: 42 }, error: null });
    const { client } = clientWith(fetchImpl as typeof fetch);
    await expect(client.get("/api/m1/x", Item)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "response did not match the contract",
    });
  });

  it("maps a non-JSON body and a network failure to INTERNAL", async () => {
    const html = async () => new Response("<html>502</html>", { status: 502 });
    await expect(clientWith(html as typeof fetch).client.get("/x", Item)).rejects.toMatchObject({
      code: "INTERNAL",
      status: 502,
    });
    const down = async () => {
      throw new Error("Failed to fetch");
    };
    await expect(clientWith(down as typeof fetch).client.get("/x", Item)).rejects.toMatchObject({
      code: "INTERNAL",
      message: "Failed to fetch",
      status: 0,
    });
  });

  it("posts a JSON body with the content-type header", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(headersOf(init)["content-type"]).toBe("application/json");
      expect(init?.body).toBe(JSON.stringify({ username: "a", password: "b" }));
      return jsonResponse(200, { success: true, data: { id: "a" }, error: null });
    });
    const { client } = clientWith(fetchImpl as unknown as typeof fetch);
    await client.post("/api/platform/auth/login", Item, { username: "a", password: "b" });
  });
});

describe("createApiClient edge cases", () => {
  it("treats success=false without an error object as INTERNAL unknown error", async () => {
    const fetchImpl = async () => jsonResponse(500, { success: false, data: null, error: null });
    await expect(
      clientWith(fetchImpl as typeof fetch).client.get("/x", Item),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: "unknown error",
      status: 500,
    });
  });

  it("falls back to a generic message when the transport throws a non-Error", async () => {
    const down = async () => {
      throw "offline";
    };
    await expect(clientWith(down as typeof fetch).client.get("/x", Item)).rejects.toMatchObject({
      code: "INTERNAL",
      message: "network error",
    });
  });

  it("prefixes paths with baseUrl when configured", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toBe("http://api.test/api/m1/rooms");
      return jsonResponse(200, { success: true, data: { id: "a" }, error: null });
    });
    const client = createApiClient({
      getToken: () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      baseUrl: "http://api.test",
    });
    await client.get("/api/m1/rooms", Item);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("createApiClient session handling", () => {
  it("drops the session on a 401 even when the body is not JSON", async () => {
    const fetchImpl = async () => new Response("<html>401</html>", { status: 401 });
    const { client, onUnauthenticated } = clientWith(fetchImpl as typeof fetch);
    await expect(client.get("/x", Item)).rejects.toMatchObject({ status: 401 });
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });
});
