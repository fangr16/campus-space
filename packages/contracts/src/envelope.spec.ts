import { describe, expect, it } from "vitest";
import { z } from "zod";
import { apiResponseSchema, ErrorCode, fail, ok, PageQuerySchema } from "./envelope";

describe("ok", () => {
  it("wraps data with success=true and a null error", () => {
    expect(ok({ id: "1" })).toEqual({ success: true, data: { id: "1" }, error: null });
  });

  it("attaches pagination meta only when provided", () => {
    const meta = { total: 3, page: 1, pageSize: 20 };
    expect(ok([1], meta).meta).toEqual(meta);
    expect("meta" in ok([1])).toBe(false);
  });
});

describe("fail", () => {
  it("produces a null data payload and the given code", () => {
    const res = fail(ErrorCode.NOT_FOUND, "room missing");
    expect(res.success).toBe(false);
    expect(res.data).toBeNull();
    expect(res.error).toEqual({ code: "NOT_FOUND", message: "room missing" });
  });

  it("includes details only when provided", () => {
    expect(fail(ErrorCode.VALIDATION_FAILED, "bad", { field: "x" }).error?.details).toEqual({
      field: "x",
    });
    expect(fail(ErrorCode.INTERNAL, "boom").error).not.toHaveProperty("details");
  });
});

describe("apiResponseSchema", () => {
  const schema = apiResponseSchema(z.object({ id: z.string() }));

  it("accepts a success envelope", () => {
    expect(schema.safeParse(ok({ id: "a" })).success).toBe(true);
  });

  it("rejects an unknown error code", () => {
    const parsed = schema.safeParse({
      success: false,
      data: null,
      error: { code: "WHATEVER", message: "x" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("PageQuerySchema", () => {
  it("coerces strings and applies defaults", () => {
    expect(PageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(PageQuerySchema.parse({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
  });

  it("caps pageSize at 100", () => {
    expect(PageQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});
