# apps/platform

Shared layer D as a service. Prefix `api/platform`, schema `platform`, port 3001.

## Owns

- `auth/` login and `/auth/me` (D-1 issuer; verification lives in `packages/auth`).
- `users/` users, roles, permissions and their repository.
- Planned: `notifications/` (D-3) and `audit/` (D-4), each with its own owner per ADR-0001.

## Tables

`users`, `roles`, `user_roles`, `permissions`, `role_permissions`. Only this service
writes them. Other services learn roles from the JWT, never from this schema.

## Conventions

- Controller → service → repository. Repositories return plain records, never Prisma rows.
- Prisma client is generated into `generated/prisma` (ignored by git); run `pnpm generate`.
- Unit tests (`*.spec.ts`) mock only repositories. Integration tests (`*.int-spec.ts`) run
  the real app against the `platform_test` schema via `pnpm test:integration`.
- Login returns one generic message for every failure; do not add hints.
- Seeds are idempotent; demo users are skipped when `SEED_DEMO_USERS=false`.
