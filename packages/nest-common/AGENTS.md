# packages/nest-common

Plumbing every NestJS service imports once from `main.ts`. Business logic never lives here.

## Owns

- `CommonModule.forRoot({ service })` registers `/health`, `/version`, the response
  envelope interceptor and the exception filter.
- `bootstrapService()` creates the app, sets the global prefix `api/<service>`, CORS,
  shutdown hooks and Swagger at `api/<service>/docs` outside production.
- `ZodValidationPipe` for `@Body()` and `@Query()` parsing against `@campus/contracts`.
- `Public()` metadata read by `@campus/auth` to skip authentication.

## Rules

- Every response goes through the envelope. Controllers return plain data, not envelopes.
- Map errors to `ErrorCode` from contracts; never leak stack traces or SQL in `message`.
- `/version` values come only from `GIT_SHA`, `GIT_TAG`, `BUILD_TIME` env vars set by CI.
- No Prisma import here; database health checks are passed in by the service.
