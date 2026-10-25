import type { VersionInfo } from "@campus/contracts";

export const SERVICE_INFO = Symbol("SERVICE_INFO");

export interface ServiceInfo {
  /** Short service name, also the URL prefix segment: api/<name>. */
  name: string;
  /** Optional async checks run by /health; each throws when unhealthy. */
  healthChecks: ReadonlyArray<() => Promise<void>>;
}

export interface BuildEnv {
  GIT_SHA?: string;
  GIT_TAG?: string;
  BUILD_TIME?: string;
}

/**
 * Builds the /version payload from CI-provided environment variables.
 * Defaults keep local runs honest ("local", "untagged") instead of pretending.
 */
export function buildVersionInfo(name: string, env: BuildEnv, startedAt: Date): VersionInfo {
  return {
    service: name,
    sha: env.GIT_SHA?.trim() || "local",
    tag: env.GIT_TAG?.trim() || "untagged",
    buildTime: env.BUILD_TIME?.trim() || "unknown",
    startedAt: startedAt.toISOString(),
  };
}
