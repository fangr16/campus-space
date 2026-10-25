import type { Role } from "@campus/contracts";
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type AuthenticatedRequest, ROLES_KEY } from "./decorators";

/**
 * Global authorization guard, evaluated after JwtAuthGuard.
 * Routes without `@Roles()` are open to any authenticated caller.
 * Internal requests carry no user and therefore never satisfy `@Roles()`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new ForbiddenException("this route requires a user role");
    if (!hasAnyRole(user.roles, required)) {
      throw new ForbiddenException(`requires one of: ${required.join(", ")}`);
    }
    return true;
  }
}

export function hasAnyRole(held: readonly Role[], required: readonly Role[]): boolean {
  return required.some((role) => held.includes(role));
}
