import { CurrentUser } from "@campus/auth";
import {
  type JwtPayload,
  type LoginRequest,
  LoginRequestSchema,
  type LoginResponse,
} from "@campus/contracts";
import { Public, ZodValidationPipe } from "@campus/nest-common";
import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/platform/auth/login */
  @Public()
  @Post("login")
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
  ): Promise<LoginResponse> {
    return this.auth.login(body);
  }

  /** GET /api/platform/auth/me: the claims of the presented token. */
  @Get("me")
  me(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
  }
}
