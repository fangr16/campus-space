import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "../../generated/prisma";

/** One PrismaClient per process, connected on startup and closed on shutdown. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Used by /health: fails when the database is unreachable. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
