import { AUTH_OPTIONS, type AuthOptions } from "@campus/auth";
import { INTERNAL_TOKEN_HEADER, MaintainerLookupSchema, RoomLookupSchema } from "@campus/contracts";
import { BadGatewayException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

/** HTTP-only reads of M1 and platform master data. */
@Injectable()
export class MasterDataRepository {
  constructor(@Inject(AUTH_OPTIONS) private readonly auth: AuthOptions) {}

  async room(roomId: string): Promise<z.infer<typeof RoomLookupSchema>> {
    const base = process.env.M1_BASE_URL;
    if (!base) throw new BadGatewayException("M1_BASE_URL is not configured");
    return this.get(
      `${base}/api/m1/rooms/internal/${encodeURIComponent(roomId)}/lookup`,
      RoomLookupSchema,
      true,
    );
  }

  async maintainer(userId: string): Promise<boolean> {
    const base = process.env.PLATFORM_BASE_URL;
    if (!base) throw new BadGatewayException("PLATFORM_BASE_URL is not configured");
    const result = await this.get(
      `${base}/api/platform/users/internal/${encodeURIComponent(userId)}/maintainer`,
      MaintainerLookupSchema,
    );
    return result.id === userId && result.eligible;
  }

  private async get<T extends z.ZodTypeAny>(
    url: string,
    schema: T,
    room = false,
  ): Promise<z.infer<T>> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { [INTERNAL_TOKEN_HEADER]: this.auth.internalToken },
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      throw new BadGatewayException("master data service unavailable");
    }
    if (room && response.status === 404) throw new NotFoundException("room not found");
    if (!response.ok) throw new BadGatewayException("master data lookup failed");
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException("master data response invalid");
    }
    const envelope = z.object({ success: z.literal(true), data: z.unknown() }).safeParse(body);
    const parsed = envelope.success ? schema.safeParse(envelope.data.data) : null;
    if (!parsed?.success) {
      throw new BadGatewayException("master data response invalid");
    }
    return parsed.data;
  }
}
