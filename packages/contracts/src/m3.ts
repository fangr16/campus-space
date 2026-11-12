import { z } from "zod";

export const TicketStatusSchema = z.enum([
  "REPORTED",
  "DISPATCHED",
  "IN_PROGRESS",
  "ESCALATED",
  "DONE",
  "ACCEPTED",
  "REWORK",
  "CANCELLED",
]);
export const TicketPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;

export const ReportTicketRequestSchema = z.object({
  roomId: z.string().trim().min(1),
  seatId: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(2000),
  photoRef: z.string().trim().min(1).max(500).optional(),
});
export type ReportTicketRequest = z.infer<typeof ReportTicketRequestSchema>;

export const DispatchTicketRequestSchema = z.object({
  assigneeId: z.string().trim().min(1),
  priority: TicketPrioritySchema,
  slaDueAt: z.string().datetime(),
});
export type DispatchTicketRequest = z.infer<typeof DispatchTicketRequestSchema>;

export const RepairTicketDtoSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  seatId: z.string().nullable(),
  reporterId: z.string(),
  category: z.string(),
  description: z.string(),
  photoRef: z.string().nullable(),
  status: TicketStatusSchema,
  priority: TicketPrioritySchema,
  assigneeId: z.string().nullable(),
  slaDueAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RepairTicketDto = z.infer<typeof RepairTicketDtoSchema>;
