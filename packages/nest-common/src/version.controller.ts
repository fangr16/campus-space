import type { VersionInfo } from "@campus/contracts";
import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "./public.decorator";
import { buildVersionInfo, SERVICE_INFO, type ServiceInfo } from "./service-info";

/**
 * GET /api/<service>/version
 * Answers "which commit is running here" for release and rollback demos.
 */
@Controller()
export class VersionController {
  private readonly startedAt = new Date();

  constructor(@Inject(SERVICE_INFO) private readonly info: ServiceInfo) {}

  @Public()
  @Get("version")
  version(): VersionInfo {
    return buildVersionInfo(this.info.name, process.env, this.startedAt);
  }
}
