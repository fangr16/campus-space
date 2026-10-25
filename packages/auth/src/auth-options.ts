export const AUTH_OPTIONS = Symbol("AUTH_OPTIONS");

export interface AuthOptions {
  /** HMAC secret shared by platform (issuer) and every verifying service. */
  jwtSecret: string;
  /** Shared secret for service-to-service calls (header x-internal-token). */
  internalToken: string;
  /** Token lifetime for platform's issuer, e.g. "8h". Verifiers ignore it. */
  expiresIn?: string;
}

/** Reads the options from the environment and fails fast when a secret is missing. */
export function authOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): AuthOptions {
  const jwtSecret = env.JWT_SECRET?.trim();
  const internalToken = env.INTERNAL_SERVICE_TOKEN?.trim();
  if (!jwtSecret) throw new Error("JWT_SECRET is not configured");
  if (!internalToken) throw new Error("INTERNAL_SERVICE_TOKEN is not configured");
  return { jwtSecret, internalToken, expiresIn: env.JWT_EXPIRES_IN?.trim() || "8h" };
}
