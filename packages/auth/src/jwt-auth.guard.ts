import { INTERNAL_TOKEN_HEADER, JwtPayloadSchema } from "@campus/contracts";
import { PUBLIC_ROUTE_KEY } from "@campus/nest-common";
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AUTH_OPTIONS, type AuthOptions } from "./auth-options";
import { type AuthenticatedRequest, INTERNAL_KEY } from "./decorators";

/**
 * Global authentication guard. Order of evaluation:
 *  1. `@Public()`   -> allow without identity
 *  2. `@Internal()` -> require a matching x-internal-token, mark request.internal
 *  3. otherwise     -> require a valid bearer token whose payload matches JwtPayloadSchema
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(AUTH_OPTIONS) private readonly options: AuthOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (this.reflector.getAllAndOverride<boolean>(INTERNAL_KEY, targets)) {
      const presented = headerValue(request.headers[INTERNAL_TOKEN_HEADER]);
      if (presented !== undefined && safeEqual(presented, this.options.internalToken)) {
        request.internal = true;
        return true;
      }
      throw new UnauthorizedException("invalid internal service token");
    }

    const token = bearerToken(headerValue(request.headers.authorization));
    if (!token) throw new UnauthorizedException("missing bearer token");

    let claims: unknown;
    try {
      claims = await this.jwt.verifyAsync(token, {
        secret: this.options.jwtSecret,
        algorithms: ["HS256"],
      });
    } catch {
      throw new UnauthorizedException("invalid or expired token");
    }
    const parsed = JwtPayloadSchema.safeParse(claims);
    if (!parsed.success) throw new UnauthorizedException("token payload is not recognized");
    request.user = parsed.data;
    return true;
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) return undefined;
  return token;
}

/** Constant-time comparison so a timing side channel cannot reveal the internal token. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
