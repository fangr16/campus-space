import { AUTH_OPTIONS, type AuthOptions } from "@campus/auth";
import {
  type JwtPayload,
  JwtPayloadSchema,
  type LoginRequest,
  type LoginResponse,
} from "@campus/contracts";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { type UserRecord, UsersRepository } from "../users/users.repository";

/**
 * Issues access tokens. The same generic message is returned for an unknown user, a wrong
 * password and a disabled account so the login form cannot be used to enumerate accounts.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    @Inject(AUTH_OPTIONS) private readonly options: AuthOptions,
  ) {}

  async login(request: LoginRequest): Promise<LoginResponse> {
    const user = await this.users.findByUsername(request.username);
    const passwordOk = user ? await compare(request.password, user.passwordHash) : false;
    if (!user || !passwordOk || !user.isActive) {
      throw new UnauthorizedException("invalid username or password");
    }
    const payload = toJwtPayload(user);
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, expiresIn: this.options.expiresIn ?? "8h", user: payload };
  }
}

/**
 * Maps a stored user to token claims. Throws when the stored roles contain a code that
 * contracts does not know, which means seed data and contracts drifted apart.
 */
export function toJwtPayload(user: UserRecord): JwtPayload {
  return JwtPayloadSchema.parse({
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: user.roleCodes,
    departmentId: user.departmentId,
  });
}
