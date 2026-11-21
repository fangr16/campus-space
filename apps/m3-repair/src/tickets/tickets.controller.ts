import { CurrentUser, Roles } from "@campus/auth";
import {
  type AcceptTicketRequest,
  AcceptTicketRequestSchema,
  type DispatchTicketRequest,
  DispatchTicketRequestSchema,
  type JwtPayload,
  type RejectTicketRequest,
  RejectTicketRequestSchema,
  type RepairTicketDto,
  type ReportTicketRequest,
  ReportTicketRequestSchema,
  Role,
  type TicketEventDto,
} from "@campus/contracts";
import { ZodValidationPipe } from "@campus/nest-common";
import { Body, Controller, Get, Param, Post } from "@nestjs/common";
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

  @Roles(Role.MAINTAINER)
  @Post(":id/start")
  start(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<RepairTicketDto> {
    return this.tickets.transition(user, id, "IN_PROGRESS");
  }

  @Roles(Role.MAINTAINER)
  @Post(":id/complete")
  complete(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<RepairTicketDto> {
    return this.tickets.transition(user, id, "DONE");
  }

  @Get()
  list(@CurrentUser() user: JwtPayload): Promise<RepairTicketDto[]> {
    return this.tickets.list(user);
  }

  @Post(":id/accept")
  accept(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(AcceptTicketRequestSchema)) body: AcceptTicketRequest,
  ): Promise<RepairTicketDto> {
    return this.tickets.accept(user, id, body);
  }

  @Post(":id/reject")
  reject(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RejectTicketRequestSchema)) body: RejectTicketRequest,
  ): Promise<RepairTicketDto> {
    return this.tickets.reject(user, id, body);
  }

  @Get(":id/events")
  events(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<TicketEventDto[]> {
    return this.tickets.events(user, id);
  }
}
