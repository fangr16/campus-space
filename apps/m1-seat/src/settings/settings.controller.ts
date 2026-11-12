import { Roles } from "@campus/auth";
import {
  Role,
  type SettingDto,
  type UpdateSettingRequest,
  UpdateSettingRequestSchema,
} from "@campus/contracts";
import { ZodValidationPipe } from "@campus/nest-common";
import { BadRequestException, Body, Controller, Get, Param, Put } from "@nestjs/common";
import { InvalidSettingError, SettingsService } from "./settings.service";

/** Module parameters. Reading is open to every signed-in user; writing needs a manager role. */
@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** GET /api/m1/settings */
  @Get()
  list(): Promise<SettingDto[]> {
    return this.settings.list();
  }

  /** PUT /api/m1/settings/:key  { value } */
  @Put(":key")
  @Roles(Role.ROOM_MANAGER, Role.ADMIN)
  async update(
    @Param("key") key: string,
    @Body(new ZodValidationPipe(UpdateSettingRequestSchema)) body: UpdateSettingRequest,
  ): Promise<SettingDto> {
    try {
      return await this.settings.update(key, body.value);
    } catch (error: unknown) {
      if (error instanceof InvalidSettingError) {
        throw new BadRequestException({ message: error.message, key: error.key });
      }
      throw error;
    }
  }
}
