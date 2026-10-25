import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HealthController } from "./health.controller";
import { buildVersionInfo } from "./service-info";
import { VersionController } from "./version.controller";
import { ZodValidationPipe } from "./zod-validation.pipe";

describe("buildVersionInfo", () => {
  const started = new Date("2026-10-25T10:00:00.000Z");

  it("uses CI-provided build metadata when present", () => {
    const info = buildVersionInfo(
      "m1",
      { GIT_SHA: "abc123", GIT_TAG: "v0.1.0", BUILD_TIME: "2026-10-25T09:00:00Z" },
      started,
    );
    expect(info).toEqual({
      service: "m1",
      sha: "abc123",
      tag: "v0.1.0",
      buildTime: "2026-10-25T09:00:00Z",
      startedAt: "2026-10-25T10:00:00.000Z",
    });
  });

  it("falls back to honest placeholders for local runs, including blank values", () => {
    const info = buildVersionInfo("m1", { GIT_SHA: "  ", GIT_TAG: "" }, started);
    expect(info.sha).toBe("local");
    expect(info.tag).toBe("untagged");
    expect(info.buildTime).toBe("unknown");
  });
});

describe("VersionController", () => {
  it("reports the configured service name", () => {
    const controller = new VersionController({ name: "platform", healthChecks: [] });
    expect(controller.version().service).toBe("platform");
  });
});

describe("HealthController", () => {
  it("returns ok with the number of checks that ran", async () => {
    const controller = new HealthController({
      name: "m1",
      healthChecks: [async () => undefined, async () => undefined],
    });
    await expect(controller.health()).resolves.toEqual({ status: "ok", service: "m1", checks: 2 });
  });

  it("throws 503 when any check rejects", async () => {
    const controller = new HealthController({
      name: "m1",
      healthChecks: [
        async () => undefined,
        async () => {
          throw new Error("db down");
        },
      ],
    });
    await expect(controller.health()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe(z.object({ page: z.coerce.number().int() }));

  it("returns the parsed value", () => {
    expect(pipe.transform({ page: "2" })).toEqual({ page: 2 });
  });

  it("throws a ZodError on invalid input", () => {
    expect(() => pipe.transform({ page: "two" })).toThrowError(/expected number|Invalid|invalid/i);
  });
});
