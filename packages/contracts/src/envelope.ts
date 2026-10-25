import { z } from "zod";

/**
 * Stable error codes shared by all services. The HTTP status is chosen by the service;
 * clients branch on `code`, never on the message text.
 */
export const ErrorCode = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ApiErrorSchema = z.object({
  code: z.enum(Object.values(ErrorCode) as [ErrorCode, ...ErrorCode[]]),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

/**
 * Every HTTP response from every service has this shape.
 * Success: `{ success: true, data, error: null }`.
 * Failure: `{ success: false, data: null, error }`.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta?: PaginationMeta;
}

export function apiResponseSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    success: z.boolean(),
    data: data.nullable(),
    error: ApiErrorSchema.nullable(),
    meta: PaginationMetaSchema.optional(),
  });
}

export function ok<T>(data: T, meta?: PaginationMeta): ApiResponse<T> {
  return meta === undefined
    ? { success: true, data, error: null }
    : { success: true, data, error: null, meta };
}

export function fail(code: ErrorCode, message: string, details?: unknown): ApiResponse<never> {
  const error: ApiError = details === undefined ? { code, message } : { code, message, details };
  return { success: false, data: null, error };
}

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;
