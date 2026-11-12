import { describe, expect, it } from "vitest";
import { DispatchTicketRequestSchema, ReportTicketRequestSchema } from "./m3";

describe("M3 request contracts", () => {
  it("accepts a report without a seat or photo and trims its text", () => {
    expect(
      ReportTicketRequestSchema.parse({
        roomId: " room-1 ",
        category: " light ",
        description: " broken ",
      }),
    ).toEqual({ roomId: "room-1", category: "light", description: "broken" });
  });

  it("rejects empty details and an invalid priority or deadline", () => {
    expect(
      ReportTicketRequestSchema.safeParse({ roomId: "r", category: " ", description: "x" }).success,
    ).toBe(false);
    expect(
      DispatchTicketRequestSchema.safeParse({
        assigneeId: "u",
        priority: "CRITICAL",
        slaDueAt: "2030-01-01T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      DispatchTicketRequestSchema.safeParse({
        assigneeId: "u",
        priority: "HIGH",
        slaDueAt: "tomorrow",
      }).success,
    ).toBe(false);
  });
});
