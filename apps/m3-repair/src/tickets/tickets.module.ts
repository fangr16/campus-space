import { Module } from "@nestjs/common";
import { MasterDataRepository } from "./master-data.repository";
import { TicketsController } from "./tickets.controller";
import { TicketsRepository } from "./tickets.repository";
import { TicketsService } from "./tickets.service";

@Module({
  controllers: [TicketsController],
  providers: [MasterDataRepository, TicketsRepository, TicketsService],
})
export class TicketsModule {}
