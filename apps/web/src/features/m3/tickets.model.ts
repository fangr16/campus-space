import type { JwtPayload, RepairTicketDto, TicketEventDto } from "@campus/contracts";

export type TicketAction = "dispatch" | "start" | "complete" | "accept" | "reject";

/** Pure view rules for M3. The API owns authorization; this only decides which buttons to show. */
export const STATUS_LABEL: Record<RepairTicketDto["status"], { text: string; color: string }> = {
  REPORTED: { text: "已上报", color: "blue" },
  DISPATCHED: { text: "已派单", color: "cyan" },
  IN_PROGRESS: { text: "维修中", color: "orange" },
  ESCALATED: { text: "已升级", color: "red" },
  DONE: { text: "待验收", color: "gold" },
  ACCEPTED: { text: "已验收", color: "green" },
  REWORK: { text: "返工中", color: "volcano" },
  CANCELLED: { text: "已取消", color: "default" },
};

export const PRIORITY_LABEL: Record<RepairTicketDto["priority"], string> = {
  LOW: "低",
  NORMAL: "普通",
  HIGH: "高",
  URGENT: "紧急",
};

export const CATEGORY_OPTIONS = [
  { value: "LIGHT", label: "照明" },
  { value: "WATER", label: "给排水" },
  { value: "ELECTRICITY", label: "用电/插座" },
  { value: "DOOR", label: "门窗" },
  { value: "OTHER", label: "其他" },
];

type Caller = Pick<JwtPayload, "sub" | "roles">;

/** Mirrors the service rules: dispatch needs a staff role, work needs the assignee,
 * acceptance needs the reporter. The server re-checks every one of these. */
export function availableActions(ticket: RepairTicketDto, caller: Caller): TicketAction[] {
  const staff = caller.roles.includes("maintainer") || caller.roles.includes("admin");
  const assigned = ticket.assigneeId === caller.sub;
  const reporter = ticket.reporterId === caller.sub;
  const actions: TicketAction[] = [];
  if (staff && (ticket.status === "REPORTED" || ticket.status === "ESCALATED")) {
    actions.push("dispatch");
  }
  if (
    assigned &&
    (ticket.status === "DISPATCHED" || ticket.status === "ESCALATED" || ticket.status === "REWORK")
  ) {
    actions.push("start");
  }
  if (assigned && ticket.status === "IN_PROGRESS") actions.push("complete");
  if (reporter && ticket.status === "DONE") actions.push("accept", "reject");
  return actions;
}

export function describeLocation(ticket: RepairTicketDto): string {
  return ticket.seatId ? `${ticket.roomId} · ${ticket.seatId}` : `${ticket.roomId} · 整室`;
}

/** UTC is explicit: stored values are ISO strings and the browser must not imply local time. */
export function formatM3Time(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

export function describeEvent(event: TicketEventDto): string {
  const from = event.fromStatus ? STATUS_LABEL[event.fromStatus].text : "新建";
  const to = STATUS_LABEL[event.toStatus].text;
  const base = `${from} → ${to}`;
  return event.note ? `${base}（${event.note}）` : base;
}
