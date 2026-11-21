import {
  type AcceptTicketRequest,
  type DispatchTicketRequest,
  type JwtPayload,
  type RejectTicketRequest,
  type RepairTicketDto,
  type ReportTicketRequest,
  Role,
  type TicketEventDto,
} from "@campus/contracts";
import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";
import { MasterDataRepository } from "./master-data.repository";
import { TicketsRepository } from "./tickets.repository";

@Injectable()
export class TicketsService {
  constructor(
    private readonly masterData: MasterDataRepository,
    private readonly tickets: TicketsRepository,
  ) {}

  async report(user: JwtPayload, input: ReportTicketRequest): Promise<RepairTicketDto> {
    const room = await this.masterData.room(input.roomId);
    if (room.id !== input.roomId)
      throw new BadGatewayException("room lookup returned another room");
    if (input.seatId && !room.seatIds.includes(input.seatId)) {
      throw new BadRequestException("seat does not belong to the room");
    }
    return this.tickets.report(input, user.sub);
  }

  async dispatch(
    user: JwtPayload,
    id: string,
    input: DispatchTicketRequest,
  ): Promise<RepairTicketDto> {
    if (new Date(input.slaDueAt).getTime() <= Date.now()) {
      throw new BadRequestException("slaDueAt must be in the future");
    }
    if (!(await this.masterData.maintainer(input.assigneeId))) {
      throw new BadRequestException("assignee is not an active maintainer");
    }
    return this.tickets.dispatch(
      id,
      user.sub,
      input.assigneeId,
      input.priority,
      new Date(input.slaDueAt),
    );
  }

  transition(
    user: JwtPayload,
    id: string,
    toStatus: "IN_PROGRESS" | "DONE",
  ): Promise<RepairTicketDto> {
    return this.tickets.transition(id, user.sub, toStatus);
  }

  list(user: JwtPayload): Promise<RepairTicketDto[]> {
    return this.tickets.list(user.sub, user.roles.includes(Role.ADMIN));
  }

  accept(user: JwtPayload, id: string, input: AcceptTicketRequest): Promise<RepairTicketDto> {
    return this.tickets.accept(id, user.sub, input.rating);
  }

  reject(user: JwtPayload, id: string, input: RejectTicketRequest): Promise<RepairTicketDto> {
    return this.tickets.reject(id, user.sub, input.reason);
  }

  events(user: JwtPayload, id: string): Promise<TicketEventDto[]> {
    return this.tickets.events(id, user.sub, user.roles.includes(Role.ADMIN));
  }
}
