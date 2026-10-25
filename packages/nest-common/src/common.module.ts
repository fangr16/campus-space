import { type DynamicModule, type InjectionToken, Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ApiExceptionFilter } from "./api-exception.filter";
import { EnvelopeInterceptor } from "./envelope.interceptor";
import { HealthController } from "./health.controller";
import { HEALTH_CHECKS, type HealthCheck, SERVICE_INFO, type ServiceInfo } from "./service-info";
import { VersionController } from "./version.controller";

export interface CommonModuleOptions {
  service: string;
  /**
   * Health checks built from providers of the importing app, e.g.
   * `{ inject: [PrismaService], build: (prisma) => [() => prisma.ping()] }`.
   * Providers must come from a global module so this global module can see them.
   */
  health?: {
    inject: InjectionToken[];
    // biome-ignore lint/suspicious/noExplicitAny: Nest resolves injected instances by token at runtime.
    build: (...deps: any[]) => HealthCheck[];
  };
}

/** Import once per service: `CommonModule.forRoot({ service: "m1" })`. */
@Module({})
export class CommonModule {
  static forRoot(options: CommonModuleOptions): DynamicModule {
    const info: ServiceInfo = { name: options.service };
    const health = options.health;
    return {
      module: CommonModule,
      global: true,
      controllers: [HealthController, VersionController],
      providers: [
        { provide: SERVICE_INFO, useValue: info },
        health
          ? { provide: HEALTH_CHECKS, useFactory: health.build, inject: health.inject }
          : { provide: HEALTH_CHECKS, useValue: [] },
        { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
      exports: [SERVICE_INFO, HEALTH_CHECKS],
    };
  }
}
