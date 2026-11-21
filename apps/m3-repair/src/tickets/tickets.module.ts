import { Module } from "@nestjs/common";
import { MasterDataRepository } from "./master-data.repository";
import { SLA_SCAN_OPTIONS, SlaService } from "./sla.service";
import { TicketsController } from "./tickets.controller";
import { TicketsRepository } from "./tickets.repository";
import { TicketsService } from "./tickets.service";

@Module({
  controllers: [TicketsController],
  providers: [
    MasterDataRepository,
    TicketsRepository,
    TicketsService,
    {
      provide: SLA_SCAN_OPTIONS,
      useValue: { intervalMs: Number(process.env.M3_SLA_SCAN_INTERVAL_MS ?? 60_000) },
    },
    SlaService,
  ],
})
export class TicketsModule {}
