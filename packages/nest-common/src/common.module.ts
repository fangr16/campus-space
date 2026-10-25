import { type DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ApiExceptionFilter } from "./api-exception.filter";
import { EnvelopeInterceptor } from "./envelope.interceptor";
import { HealthController } from "./health.controller";
import { SERVICE_INFO, type ServiceInfo } from "./service-info";
import { VersionController } from "./version.controller";

export interface CommonModuleOptions {
  service: string;
  healthChecks?: ReadonlyArray<() => Promise<void>>;
}

/** Import once per service: `CommonModule.forRoot({ service: "m1" })`. */
@Module({})
export class CommonModule {
  static forRoot(options: CommonModuleOptions): DynamicModule {
    const info: ServiceInfo = { name: options.service, healthChecks: options.healthChecks ?? [] };
    return {
      module: CommonModule,
      global: true,
      controllers: [HealthController, VersionController],
      providers: [
        { provide: SERVICE_INFO, useValue: info },
        { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
      exports: [SERVICE_INFO],
    };
  }
}
