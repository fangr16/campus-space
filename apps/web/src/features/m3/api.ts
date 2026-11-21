import {
  type AcceptTicketRequest,
  type DispatchTicketRequest,
  type RejectTicketRequest,
  type RepairTicketDto,
  RepairTicketDtoSchema,
  type ReportTicketRequest,
  type TicketEventDto,
  TicketEventDtoSchema,
} from "@campus/contracts";
import { z } from "zod";
import { api } from "../../lib/app-context";

const TicketListSchema = z.array(RepairTicketDtoSchema);
const EventListSchema = z.array(TicketEventDtoSchema);

/** REQ-M3-01..05: every call goes through the public HTTP contract and parses its DTO. */
export function fetchTickets() {
  return api.get("/api/m3/tickets", TicketListSchema);
}

export function reportTicket(input: ReportTicketRequest) {
  return api.post("/api/m3/tickets", RepairTicketDtoSchema, input);
}

export function dispatchTicket(id: string, input: DispatchTicketRequest) {
  return api.post(
    `/api/m3/tickets/${encodeURIComponent(id)}/dispatch`,
    RepairTicketDtoSchema,
    input,
  );
}

export function startTicket(id: string) {
  return api.post(`/api/m3/tickets/${encodeURIComponent(id)}/start`, RepairTicketDtoSchema, {});
}

export function completeTicket(id: string) {
  return api.post(`/api/m3/tickets/${encodeURIComponent(id)}/complete`, RepairTicketDtoSchema, {});
}

export function acceptTicket(id: string, input: AcceptTicketRequest) {
  return api.post(`/api/m3/tickets/${encodeURIComponent(id)}/accept`, RepairTicketDtoSchema, input);
}

export function rejectTicket(id: string, input: RejectTicketRequest) {
  return api.post(`/api/m3/tickets/${encodeURIComponent(id)}/reject`, RepairTicketDtoSchema, input);
}

export function fetchTicketEvents(id: string) {
  return api.get(`/api/m3/tickets/${encodeURIComponent(id)}/events`, EventListSchema);
}

export type { RepairTicketDto, TicketEventDto };
