import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "./public.decorator";
import { SERVICE_INFO, type ServiceInfo } from "./service-info";

export interface HealthReport {
  status: "ok";
  service: string;
  checks: number;
}

/**
 * GET /api/<service>/health
 * Runs the service's registered checks (for example a database ping). Any failure returns
 * 503 so the deploy script and nginx can tell a broken container from a healthy one.
 */
@Controller()
export class HealthController {
  constructor(@Inject(SERVICE_INFO) private readonly info: ServiceInfo) {}

  @Public()
  @Get("health")
  async health(): Promise<HealthReport> {
    const results = await Promise.allSettled(this.info.healthChecks.map((check) => check()));
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      throw new ServiceUnavailableException(`${failed.length} health check(s) failed`);
    }
    return { status: "ok", service: this.info.name, checks: results.length };
  }
}
