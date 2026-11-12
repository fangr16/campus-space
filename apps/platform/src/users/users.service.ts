import type { MaintainerLookup } from "@campus/contracts";
import { Injectable } from "@nestjs/common";
import { UsersRepository } from "./users.repository";

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async maintainer(id: string): Promise<MaintainerLookup> {
    const user = await this.users.findById(id);
    return { id, eligible: Boolean(user?.isActive && user.roleCodes.includes("maintainer")) };
  }
}
