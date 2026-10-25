import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { firstValueFrom, of } from "rxjs";
import { describe, expect, it } from "vitest";
import { EnvelopeInterceptor, isEnvelope } from "./envelope.interceptor";

const ctx = {} as ExecutionContext;
const handler = (value: unknown): CallHandler => ({ handle: () => of(value) });

describe("EnvelopeInterceptor", () => {
  const interceptor = new EnvelopeInterceptor();

  it("wraps plain handler results", async () => {
    const out = await firstValueFrom(interceptor.intercept(ctx, handler({ id: 1 })));
    expect(out).toEqual({ success: true, data: { id: 1 }, error: null });
  });

  it("turns undefined into a null data payload", async () => {
    const out = await firstValueFrom(interceptor.intercept(ctx, handler(undefined)));
    expect(out.data).toBeNull();
    expect(out.success).toBe(true);
  });

  it("passes an existing envelope through unchanged", async () => {
    const envelope = {
      success: true,
      data: [1],
      error: null,
      meta: { total: 1, page: 1, pageSize: 20 },
    };
    const out = await firstValueFrom(interceptor.intercept(ctx, handler(envelope)));
    expect(out).toBe(envelope);
  });
});

describe("isEnvelope", () => {
  it.each([null, 1, "x", { success: true }, { data: 1, error: null }])("rejects %j", (v) => {
    expect(isEnvelope(v)).toBe(false);
  });

  it("accepts the three-key shape", () => {
    expect(
      isEnvelope({ success: false, data: null, error: { code: "INTERNAL", message: "" } }),
    ).toBe(true);
  });
});
