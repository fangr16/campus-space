import type { ArgumentsHost } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ApiExceptionFilter } from "./api-exception.filter";

function hostWith(): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe("ApiExceptionFilter.catch", () => {
  it("writes the mapped status and envelope to the response", () => {
    const { host, status, json } = hostWith();
    new ApiExceptionFilter().catch(new NotFoundException("gone"), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      data: null,
      error: { code: "NOT_FOUND", message: "gone" },
    });
  });

  it("logs unknown errors and still answers with the generic 500 envelope", () => {
    const { host, status, json } = hostWith();
    const filter = new ApiExceptionFilter();
    const logger = vi
      .spyOn((filter as unknown as { logger: { error: (m: string) => void } }).logger, "error")
      .mockImplementation(() => undefined);
    filter.catch(new Error("db exploded"), host);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger.mock.calls[0]?.[0]).toContain("db exploded");
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0]?.[0]).toEqual({
      success: false,
      data: null,
      error: { code: "INTERNAL", message: "internal server error" },
    });
  });

  it("logs a non-Error throwable as a string", () => {
    const { host, status } = hostWith();
    const filter = new ApiExceptionFilter();
    const logger = vi
      .spyOn((filter as unknown as { logger: { error: (m: string) => void } }).logger, "error")
      .mockImplementation(() => undefined);
    filter.catch("plain string", host);
    expect(logger).toHaveBeenCalledWith("plain string");
    expect(status).toHaveBeenCalledWith(500);
  });
});
