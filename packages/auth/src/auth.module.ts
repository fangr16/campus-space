import { type DynamicModule, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { AUTH_OPTIONS, type AuthOptions } from "./auth-options";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";

/**
 * Import once per service. Installs deny-by-default authentication and role checks.
 * platform additionally uses the exported JwtModule to sign tokens.
 */
@Module({})
export class AuthModule {
  static forRoot(options: AuthOptions): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      imports: [
        JwtModule.register({
          secret: options.jwtSecret,
          signOptions: {
            expiresIn: (options.expiresIn ?? "8h") as NonNullable<JwtSignOptions["expiresIn"]>,
          },
        }),
      ],
      providers: [
        { provide: AUTH_OPTIONS, useValue: options },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
      exports: [AUTH_OPTIONS, JwtModule],
    };
  }
}
