import type { JwtPayload, Role } from "@campus/contracts";
import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "campus:roles";
export const INTERNAL_KEY = "campus:internal";

/** Restricts a route to callers holding at least one of the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Allows service-to-service calls authenticated with the internal token header. */
export const Internal = () => SetMetadata(INTERNAL_KEY, true);

/** Request fields written by the guards. */
export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: JwtPayload;
  internal?: boolean;
}

/** Injects the verified token payload. Undefined on `@Internal()` routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
