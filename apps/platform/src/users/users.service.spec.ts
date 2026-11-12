import { describe, expect, it, vi } from "vitest";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

describe("UsersService.maintainer", () => {
  it("accepts only active users with the maintainer role", async () => {
    const findById = vi.fn();
    const service = new UsersService({ findById } as unknown as UsersRepository);
    findById.mockResolvedValue({ isActive: true, roleCodes: ["maintainer"] });
    expect(await service.maintainer("worker")).toEqual({ id: "worker", eligible: true });
    findById.mockResolvedValue({ isActive: false, roleCodes: ["maintainer"] });
    expect((await service.maintainer("retired")).eligible).toBe(false);
    findById.mockResolvedValue({ isActive: true, roleCodes: ["student"] });
    expect((await service.maintainer("student")).eligible).toBe(false);
    findById.mockResolvedValue(null);
    expect((await service.maintainer("missing")).eligible).toBe(false);
  });
});
