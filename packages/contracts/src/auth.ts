import { z } from "zod";

/**
 * Roles are coarse-grained and shared across modules. Fine-grained permissions live in
 * platform's role-permission table (REQ-M1-01, REQ-M1-03); services check roles here and
 * ask platform for permissions only when a role is not enough.
 */
export const Role = {
  STUDENT: "student",
  ROOM_MANAGER: "room_manager",
  OPS_MANAGER: "ops_manager",
  APPROVER: "approver",
  MAINTAINER: "maintainer",
  ADMIN: "admin",
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const RoleSchema = z.enum(Object.values(Role) as [Role, ...Role[]]);

/** Claims carried in every access token issued by platform. */
export const JwtPayloadSchema = z.object({
  sub: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  roles: z.array(RoleSchema).min(1),
  departmentId: z.string().nullable().default(null),
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export const LoginRequestSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.string().min(1),
  user: JwtPayloadSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** Header carrying the shared secret for service-to-service calls (ADR-0003). */
export const INTERNAL_TOKEN_HEADER = "x-internal-token";
