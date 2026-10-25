import { AuthModule, authOptionsFromEnv } from "@campus/auth";
import { CommonModule } from "@campus/nest-common";
import { Module } from "@nestjs/common";
import { PlatformAuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PrismaService } from "./prisma/prisma.service";
import { UsersModule } from "./users/users.module";

export const SERVICE_NAME = "platform";

/**
 * Root module. `createAppModule` exists so integration tests can build the same graph with
 * explicit auth options instead of reading the process environment.
 */
export function createAppModule(options = authOptionsFromEnv()) {
  @Module({
    imports: [
      PrismaModule,
      CommonModule.forRoot({
        service: SERVICE_NAME,
        health: {
          inject: [PrismaService],
          build: (prisma: PrismaService) => [() => prisma.ping()],
        },
      }),
      AuthModule.forRoot(options),
      UsersModule,
      PlatformAuthModule,
    ],
  })
  class AppModule {}
  return AppModule;
}
