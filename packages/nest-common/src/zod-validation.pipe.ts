import { Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Parses an incoming body, query or param object with a contracts schema.
 * Throws ZodError on failure; ApiExceptionFilter turns it into 400 VALIDATION_FAILED.
 *
 * Usage: `@Query(new ZodValidationPipe(SeatQuerySchema)) query: SeatQuery`
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
