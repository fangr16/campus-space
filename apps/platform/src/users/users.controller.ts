import { Internal } from "@campus/auth";
import type { MaintainerLookup } from "@campus/contracts";
import { Controller, Get, Param } from "@nestjs/common";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Internal()
  @Get("internal/:id/maintainer")
  maintainer(@Param("id") id: string): Promise<MaintainerLookup> {
    return this.users.maintainer(id);
  }
}
