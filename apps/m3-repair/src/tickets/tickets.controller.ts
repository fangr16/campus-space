import { CurrentUser, Roles } from "@campus/auth";
import {
  type DispatchTicketRequest,
  DispatchTicketRequestSchema,
  type JwtPayload,
  type RepairTicketDto,
  type ReportTicketRequest,
  ReportTicketRequestSchema,
  Role,
} from "@campus/contracts";
import { ZodValidationPipe } from "@campus/nest-common";
import { Body, Controller, Param, Post } from "@nestjs/common";
import { TicketsService } from "./tickets.service";

@Controller("tickets")
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  report(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ReportTicketRequestSchema)) body: ReportTicketRequest,
  ): Promise<RepairTicketDto> {
    return this.tickets.report(user, body);
  }

  @Roles(Role.MAINTAINER, Role.ADMIN)
  @Post(":id/dispatch")
  dispatch(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(DispatchTicketRequestSchema)) body: DispatchTicketRequest,
  ): Promise<RepairTicketDto> {
    return this.tickets.dispatch(user, id, body);
  }
}
