import type { AuthOptions } from "@campus/auth";
import { BadGatewayException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpSeatBlocker } from "./seat-blocker";

const auth: AuthOptions = { jwtSecret: "secret", internalToken: "int-token", expiresIn: "1h" };
const block = {
  roomId: "room-1",
  source: "M3_REPAIR",
  refId: "t1",
  from: "2030-01-01T09:00:00.000Z",
  to: "2099-12-31T23:59:59.999Z",
} as const;

let originalBase: string | undefined;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBase === undefined) delete process.env.M1_BASE_URL;
  else process.env.M1_BASE_URL = originalBase;
});

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  originalBase = process.env.M1_BASE_URL;
  process.env.M1_BASE_URL = "http://m1.test";
  return fetchMock;
}

describe("HttpSeatBlocker", () => {
  it("posts a block with the internal token and validates the result", async () => {
    const fetchMock = respond(201, {
      success: true,
      data: { roomId: "room-1", affectedSeats: 12 },
    });

    await new HttpSeatBlocker(auth).block(block);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://m1.test/api/m1/seat-status/block");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-internal-token"]).toBe("int-token");
    expect(JSON.parse(String(init.body))).toEqual(block);
  });

  it("posts a release and accepts a success envelope without payload constraints", async () => {
    const fetchMock = respond(200, { success: true, data: { affectedSeats: 12 } });

    await new HttpSeatBlocker(auth).release({ roomId: "room-1", source: "M3_REPAIR", refId: "t1" });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://m1.test/api/m1/seat-status/release");
  });

  it("rejects upstream failures and malformed envelopes without swallowing them", async () => {
    respond(502, { success: false, error: { code: "INTERNAL", message: "down" } });
    await expect(new HttpSeatBlocker(auth).block(block)).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    respond(200, { success: true, data: { affectedSeats: "many" } });
    await expect(new HttpSeatBlocker(auth).block(block)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it("fails when M1_BASE_URL is missing", async () => {
    originalBase = process.env.M1_BASE_URL;
    delete process.env.M1_BASE_URL;
    await expect(new HttpSeatBlocker(auth).block(block)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
