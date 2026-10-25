# packages/auth

Shared layer D-1 (identity and access) as a library. Token issuing lives in
`apps/platform`; every service verifies tokens here. Owner: module group 2 (see ADR-0001).

## Owns

- `AuthModule.forRoot({ jwtSecret, internalToken })` installs `JwtAuthGuard` and
  `RolesGuard` as global guards: every route is denied unless it is `@Public()`,
  `@Internal()` or the caller has a valid bearer token.
- `@Roles(...)` restricts a route to the given roles from `@campus/contracts`.
- `@Internal()` accepts service-to-service calls carrying `x-internal-token`.
- `@CurrentUser()` injects the verified `JwtPayload`.

## Rules

- Secrets come from the service's environment; this package never reads `.env` itself.
- The guard verifies signature, expiry and payload shape (`JwtPayloadSchema`). A token that
  parses but has an unknown role is rejected.
- Internal calls are not users: `@Roles()` never matches an internal request. A route that
  needs both must declare both decorators.
- Fine-grained permissions (REQ-M1-03) are resolved by platform, not here.
