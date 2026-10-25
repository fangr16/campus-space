import { z } from "zod";

/**
 * Payload of GET /api/<service>/version. Lets the team state which commit runs in each
 * environment, which the task sheet requires for production releases and rollbacks.
 */
export const VersionInfoSchema = z.object({
  service: z.string(),
  sha: z.string(),
  tag: z.string(),
  buildTime: z.string(),
  startedAt: z.string().datetime(),
});
export type VersionInfo = z.infer<typeof VersionInfoSchema>;
