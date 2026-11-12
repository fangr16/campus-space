import {
  type CreateReservationRequest,
  ReservationDtoSchema,
  RoomDtoSchema,
  type RoomQuery,
  RoomSeatsResponseSchema,
  SettingDtoSchema,
} from "@campus/contracts";
import { z } from "zod";
import { api } from "../../lib/app-context";

const RoomListSchema = z.array(RoomDtoSchema);
const ReservationListSchema = z.array(ReservationDtoSchema);
const SettingListSchema = z.array(SettingDtoSchema);

/** Optional `from`/`to` window on list endpoints (REQ-M1-11); both or neither. */
export interface WindowParams {
  from?: string;
  to?: string;
}

function toSearch(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, value);
  }
  return params.size > 0 ? `?${params.toString()}` : "";
}

export function fetchRooms(query: RoomQuery & WindowParams) {
  const suffix = toSearch({
    building: query.building,
    keyword: query.keyword,
    from: query.from,
    to: query.to,
  });
  return api.get(`/api/m1/rooms${suffix}`, RoomListSchema);
}

export function fetchRoomSeats(roomId: string, query: { hasPower?: "true" } & WindowParams) {
  const suffix = toSearch({ hasPower: query.hasPower, from: query.from, to: query.to });
  return api.get(
    `/api/m1/rooms/${encodeURIComponent(roomId)}/seats${suffix}`,
    RoomSeatsResponseSchema,
  );
}

/** Module parameters (maxHours, slot length, timezone) that drive the time bar. */
export function fetchSettings() {
  return api.get("/api/m1/settings", SettingListSchema);
}

export function createReservation(request: CreateReservationRequest) {
  return api.post("/api/m1/reservations", ReservationDtoSchema, request);
}

export function fetchMyReservations() {
  return api.get("/api/m1/reservations/me", ReservationListSchema);
}

export function cancelReservation(id: string) {
  return api.delete(`/api/m1/reservations/${encodeURIComponent(id)}`, ReservationDtoSchema);
}
