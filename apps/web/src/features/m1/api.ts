import { RoomDtoSchema, type RoomQuery, RoomSeatsResponseSchema } from "@campus/contracts";
import { z } from "zod";
import { api } from "../../lib/app-context";

const RoomListSchema = z.array(RoomDtoSchema);

export function fetchRooms(query: RoomQuery) {
  const params = new URLSearchParams();
  if (query.building) params.set("building", query.building);
  if (query.keyword) params.set("keyword", query.keyword);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return api.get(`/api/m1/rooms${suffix}`, RoomListSchema);
}

export function fetchRoomSeats(roomId: string, hasPower: "true" | undefined) {
  const suffix = hasPower ? `?hasPower=${hasPower}` : "";
  return api.get(
    `/api/m1/rooms/${encodeURIComponent(roomId)}/seats${suffix}`,
    RoomSeatsResponseSchema,
  );
}
