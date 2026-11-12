import type {
  DispatchTicketRequest,
  JwtPayload,
  RepairTicketDto,
  ReportTicketRequest,
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
}
