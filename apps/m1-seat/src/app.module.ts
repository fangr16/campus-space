import { AuthModule, authOptionsFromEnv } from "@campus/auth";
import { CommonModule } from "@campus/nest-common";
import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { PrismaService } from "./prisma/prisma.service";
import { RoomsModule } from "./rooms/rooms.module";

export const SERVICE_NAME = "m1";

/** Root module; integration tests pass explicit auth options instead of reading the env. */
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
      RoomsModule,
    ],
  })
  class AppModule {}
  return AppModule;
}
