import { type ApiResponse, ErrorCode, fail } from "@campus/contracts";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ZodError } from "zod";

const STATUS_TO_CODE: Readonly<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
};

export interface MappedError {
  status: number;
  body: ApiResponse<never>;
}

/**
 * Pure mapping from any thrown value to (status, envelope). Exported so it can be tested
 * without an HTTP server. Unknown errors become 500 with a generic message; the original
 * is logged, never returned.
 */
export function mapException(exception: unknown): MappedError {
  if (exception instanceof ZodError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: fail(ErrorCode.VALIDATION_FAILED, "request validation failed", exception.issues),
    };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code =
      STATUS_TO_CODE[status] ?? (status < 500 ? ErrorCode.CLIENT_ERROR : ErrorCode.INTERNAL);
    const response = exception.getResponse();
    const message =
      typeof response === "string"
        ? response
        : ((response as { message?: string | string[] }).message ?? exception.message);
    return {
      status,
      body: fail(code, Array.isArray(message) ? message.join("; ") : String(message)),
    };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: fail(ErrorCode.INTERNAL, "internal server error"),
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = mapException(exception);
    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }
    const res = host
      .switchToHttp()
      .getResponse<{ status: (s: number) => { json: (b: unknown) => void } }>();
    res.status(status).json(body);
  }
}
