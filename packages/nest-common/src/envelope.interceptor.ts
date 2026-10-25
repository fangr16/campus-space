import { type ApiResponse, ok } from "@campus/contracts";
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";

/** True when a handler already returned a full envelope (for example with pagination meta). */
export function isEnvelope(value: unknown): value is ApiResponse<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.success === "boolean" && "data" in v && "error" in v;
}

/** Wraps every successful handler result in the shared API envelope. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>> {
    return next.handle().pipe(map((value) => (isEnvelope(value) ? value : ok(value ?? null))));
  }
}
