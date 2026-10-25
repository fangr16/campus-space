import { type ApiError, type ApiResponse, apiResponseSchema, ErrorCode } from "@campus/contracts";
import type { z } from "zod";

/** Error thrown for any non-success envelope or transport failure. UI branches on `code`. */
export class ApiClientError extends Error {
  constructor(
    readonly code: ApiError["code"],
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ApiClientOptions {
  /** Returns the current bearer token, or null when signed out. */
  getToken: () => string | null;
  /** Called on 401 so the app can drop the session. */
  onUnauthenticated?: () => void;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/**
 * Thin typed wrapper over fetch. Every call parses the shared envelope and then the payload
 * with the schema the caller passes, so a contract change fails loudly in the browser.
 */
export function createApiClient(options: ApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? "";

  async function request<T extends z.ZodTypeAny>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    schema: T,
    body?: unknown,
  ): Promise<z.infer<T>> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    const token = options.getToken();
    if (token) headers.authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error: unknown) {
      throw new ApiClientError(ErrorCode.INTERNAL, describe(error, "network error"), 0);
    }

    const envelope = await parseEnvelope(response, schema);
    if (!envelope.success || envelope.error) {
      if (response.status === 401) options.onUnauthenticated?.();
      const err = envelope.error ?? { code: ErrorCode.INTERNAL, message: "unknown error" };
      throw new ApiClientError(err.code, err.message, response.status, err.details);
    }
    return envelope.data as z.infer<T>;
  }

  return {
    get: <T extends z.ZodTypeAny>(path: string, schema: T) => request("GET", path, schema),
    post: <T extends z.ZodTypeAny>(path: string, schema: T, body: unknown) =>
      request("POST", path, schema, body),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

async function parseEnvelope<T extends z.ZodTypeAny>(
  response: Response,
  schema: T,
): Promise<ApiResponse<z.infer<T>>> {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApiClientError(
      ErrorCode.INTERNAL,
      `server answered ${response.status} without a JSON body`,
      response.status,
    );
  }
  const parsed = apiResponseSchema(schema).safeParse(json);
  if (!parsed.success) {
    throw new ApiClientError(
      ErrorCode.VALIDATION_FAILED,
      "response did not match the contract",
      response.status,
      parsed.error.issues,
    );
  }
  return parsed.data as ApiResponse<z.infer<T>>;
}

function describe(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
