import { AUTH_OPTIONS, type AuthOptions } from "@campus/auth";
import {
  INTERNAL_TOKEN_HEADER,
  type RoomBlockRequest,
  RoomBlockRequestSchema,
  RoomBlockResultSchema,
  type RoomReleaseRequest,
  RoomReleaseRequestSchema,
} from "@campus/contracts";
import { BadGatewayException, Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

/** Port for the M3 -> M1 write-back link (REQ-X-01). Tests inject a recording double. */
export const SEAT_BLOCKER = Symbol("SEAT_BLOCKER");

export interface SeatBlocker {
  block(input: RoomBlockRequest): Promise<void>;
  release(input: RoomReleaseRequest): Promise<void>;
}

const ENVELOPE = z.object({ success: z.literal(true), data: z.unknown() });

/** Sends the commands from packages/contracts to M1's planned internal seat-status endpoints. */
@Injectable()
export class HttpSeatBlocker implements SeatBlocker {
  constructor(@Inject(AUTH_OPTIONS) private readonly auth: AuthOptions) {}

  async block(input: RoomBlockRequest): Promise<void> {
    const body = RoomBlockRequestSchema.parse(input);
    await this.post("/api/m1/seat-status/block", body, RoomBlockResultSchema);
  }

  async release(input: RoomReleaseRequest): Promise<void> {
    const body = RoomReleaseRequestSchema.parse(input);
    await this.post("/api/m1/seat-status/release", body);
  }

  private async post(path: string, body: unknown, result?: z.ZodTypeAny): Promise<void> {
    const base = process.env.M1_BASE_URL;
    if (!base) throw new BadGatewayException("M1_BASE_URL is not configured");
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [INTERNAL_TOKEN_HEADER]: this.auth.internalToken,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      throw new BadGatewayException("M1 seat-status service unavailable");
    }
    if (!response.ok) throw new BadGatewayException("M1 seat-status write-back failed");
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new BadGatewayException("M1 seat-status response invalid");
    }
    const envelope = ENVELOPE.safeParse(json);
    if (!envelope.success) throw new BadGatewayException("M1 seat-status response invalid");
    if (result && !result.safeParse(envelope.data.data).success) {
      throw new BadGatewayException("M1 seat-status response invalid");
    }
  }
}
