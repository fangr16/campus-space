import type { JwtPayload, RepairTicketDto } from "@campus/contracts";
import { BadGatewayException, BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MasterDataRepository } from "./master-data.repository";
import { TicketsRepository } from "./tickets.repository";
import { TicketsService } from "./tickets.service";

const user: JwtPayload = {
  sub: "reporter",
  username: "reporter",
  displayName: "Reporter",
  roles: ["student"],
  departmentId: null,
};
const report = { roomId: "room", seatId: "seat", category: "light", description: "broken" };
const ticket = { id: "ticket" } as RepairTicketDto;

function setup() {
  const master = {
    room: vi.fn().mockResolvedValue({ id: "room", seatIds: ["seat"] }),
    maintainer: vi.fn().mockResolvedValue(true),
  };
  const tickets = {
    report: vi.fn().mockResolvedValue(ticket),
    dispatch: vi.fn().mockResolvedValue(ticket),
    transition: vi.fn().mockResolvedValue(ticket),
    accept: vi.fn().mockResolvedValue(ticket),
    reject: vi.fn().mockResolvedValue(ticket),
    events: vi.fn().mockResolvedValue([]),
  };
  return {
    service: new TicketsService(
      master as unknown as MasterDataRepository,
      tickets as unknown as TicketsRepository,
    ),
    master,
    tickets,
  };
}

describe("TicketsService", () => {
  it("checks the room and seat before creating a report for the caller", async () => {
    const { service, tickets } = setup();
    expect(await service.report(user, report)).toBe(ticket);
    expect(tickets.report).toHaveBeenCalledWith(report, "reporter");
  });

  it("rejects a seat outside the room without writing", async () => {
    const { service, tickets } = setup();
    await expect(service.report(user, { ...report, seatId: "other" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tickets.report).not.toHaveBeenCalled();
  });

  it("rejects an inconsistent room response without writing", async () => {
    const { service, master, tickets } = setup();
    master.room.mockResolvedValue({ id: "another-room", seatIds: ["seat"] });
    await expect(service.report(user, report)).rejects.toBeInstanceOf(BadGatewayException);
    expect(tickets.report).not.toHaveBeenCalled();
  });

  it("accepts a room-level report without a seat", async () => {
    const { service, tickets } = setup();
    await service.report(user, { ...report, seatId: undefined });
    expect(tickets.report).toHaveBeenCalledOnce();
  });

  it("requires a future deadline and an active maintainer before dispatch", async () => {
    const { service, master, tickets } = setup();
    const input = {
      assigneeId: "worker",
      priority: "HIGH" as const,
      slaDueAt: "2030-01-01T00:00:00.000Z",
    };
    await expect(
      service.dispatch(user, "ticket", { ...input, slaDueAt: "2020-01-01T00:00:00.000Z" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(master.maintainer).not.toHaveBeenCalled();
    master.maintainer.mockResolvedValue(false);
    await expect(service.dispatch(user, "ticket", input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tickets.dispatch).not.toHaveBeenCalled();
    master.maintainer.mockResolvedValue(true);
    expect(await service.dispatch(user, "ticket", input)).toBe(ticket);
    expect(tickets.dispatch).toHaveBeenCalledWith(
      "ticket",
      "reporter",
      "worker",
      "HIGH",
      new Date(input.slaDueAt),
    );
  });

  it("rejects a deadline exactly at dispatch time", async () => {
    const { service, tickets } = setup();
    const due = "2030-01-01T00:00:00.000Z";
    const clock = vi.spyOn(Date, "now").mockReturnValue(new Date(due).getTime());
    try {
      await expect(
        service.dispatch(user, "ticket", {
          assigneeId: "worker",
          priority: "HIGH",
          slaDueAt: due,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tickets.dispatch).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });

  it("passes the caller and target state to the transition repository", async () => {
    const { service, tickets } = setup();
    expect(await service.transition(user, "ticket", "IN_PROGRESS")).toBe(ticket);
    expect(await service.transition(user, "ticket", "DONE")).toBe(ticket);
    expect(tickets.transition.mock.calls).toEqual([
      ["ticket", "reporter", "IN_PROGRESS"],
      ["ticket", "reporter", "DONE"],
    ]);
  });

  it("passes the reporter, rating and rework reason to the repository", async () => {
    const { service, tickets } = setup();
    expect(await service.accept(user, "ticket", { rating: 4 })).toBe(ticket);
    expect(await service.reject(user, "ticket", { reason: "still broken" })).toBe(ticket);
    expect(tickets.accept.mock.calls).toEqual([["ticket", "reporter", 4]]);
    expect(tickets.reject.mock.calls).toEqual([["ticket", "reporter", "still broken"]]);
  });

  it("grants admin history access while keeping the caller identity", async () => {
    const { service, tickets } = setup();
    await service.events(user, "ticket");
    await service.events({ ...user, roles: ["admin"] }, "ticket");
    expect(tickets.events.mock.calls).toEqual([
      ["ticket", "reporter", false],
      ["ticket", "reporter", true],
    ]);
  });
});
