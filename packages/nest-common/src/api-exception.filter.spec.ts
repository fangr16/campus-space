import { ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { mapException } from "./api-exception.filter";

describe("mapException", () => {
  it("maps ZodError to 400 VALIDATION_FAILED with the issues as details", () => {
    const result = z.object({ n: z.number() }).safeParse({ n: "x" });
    if (result.success) throw new Error("expected failure");
    const mapped = mapException(result.error);
    expect(mapped.status).toBe(400);
    expect(mapped.body.error?.code).toBe("VALIDATION_FAILED");
    expect(Array.isArray(mapped.body.error?.details)).toBe(true);
  });

  it.each([
    [new NotFoundException("room missing"), 404, "NOT_FOUND", "room missing"],
    [new ConflictException("seat taken"), 409, "CONFLICT", "seat taken"],
    [new UnauthorizedException(), 401, "UNAUTHENTICATED", "Unauthorized"],
  ])("maps %s to its status and code", (exception, status, code, message) => {
    const mapped = mapException(exception);
    expect(mapped.status).toBe(status);
    expect(mapped.body).toEqual({
      success: false,
      data: null,
      error: { code, message },
    });
  });

  it("hides unknown errors behind 500 INTERNAL without leaking the message", () => {
    const mapped = mapException(new Error("SELECT * FROM users failed: password=hunter2"));
    expect(mapped.status).toBe(500);
    expect(mapped.body.error).toEqual({ code: "INTERNAL", message: "internal server error" });
  });

  it("joins array messages from Nest validation responses", () => {
    const mapped = mapException(new ConflictException(["a", "b"]));
    expect(mapped.body.error?.message).toBe("a; b");
  });
});
