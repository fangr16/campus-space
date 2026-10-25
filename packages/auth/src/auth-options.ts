export const AUTH_OPTIONS = Symbol("AUTH_OPTIONS");

export interface AuthOptions {
  /** HMAC secret shared by platform (issuer) and every verifying service. */
  jwtSecret: string;
  /** Shared secret for service-to-service calls (header x-internal-token). */
  internalToken: string;
  /** Token lifetime for platform's issuer, e.g. "8h". Verifiers ignore it. */
  expiresIn?: string;
}

/** Minimum secret length enforced outside development (32 hex bytes = 64 chars). */
export const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_PREFIXES = ["REPLACE_", "dev-only", "changeme", "change-me"];

/**
 * Reads the options from the environment and fails fast when a secret is missing.
 * In production it also refuses short secrets, the placeholders from .env.example and the
 * bootstrap template, and identical JWT and internal secrets, so a forgotten template value
 * cannot ship.
 */
export function authOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): AuthOptions {
  const jwtSecret = env.JWT_SECRET?.trim();
  const internalToken = env.INTERNAL_SERVICE_TOKEN?.trim();
  if (!jwtSecret) throw new Error("JWT_SECRET is not configured");
  if (!internalToken) throw new Error("INTERNAL_SERVICE_TOKEN is not configured");
  if (env.NODE_ENV === "production") {
    assertStrongSecret("JWT_SECRET", jwtSecret);
    assertStrongSecret("INTERNAL_SERVICE_TOKEN", internalToken);
    if (jwtSecret === internalToken) {
      throw new Error("JWT_SECRET and INTERNAL_SERVICE_TOKEN must differ");
    }
  }
  return { jwtSecret, internalToken, expiresIn: env.JWT_EXPIRES_IN?.trim() || "8h" };
}

export function assertStrongSecret(name: string, value: string): void {
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters in production`);
  }
  const lower = value.toLowerCase();
  if (PLACEHOLDER_PREFIXES.some((prefix) => lower.startsWith(prefix.toLowerCase()))) {
    throw new Error(
      `${name} still holds a placeholder value; generate one with openssl rand -hex 32`,
    );
  }
}
