# packages/contracts

The only shared vocabulary between modules. Everything here is public API for every other
package and for the web app.

## Owns

- `envelope.ts` API response envelope and error codes.
- `auth.ts` roles, JWT payload, login DTOs, internal token header name.
- `seat-status.ts` `SeatStatusSource` and seat status DTOs (cross-module provenance, X-3).
- `m1.ts`, `m2.ts`, `m3.ts` per-module request and response schemas.
- `events.ts` cross-module commands (X-1 repair block, X-2 room booking block).
- `version.ts` `/version` payload.

## Rules

- Every schema is a zod schema plus an inferred type. No hand-written interfaces.
- Adding or renaming a field is a contract change: two reviewers, one from each consumer.
- Breaking changes get a new schema version (`SeatQueryV2`) rather than editing in place
  until all consumers migrate.
- No runtime dependency other than `zod`. No Nest, no Prisma, no React imports.
- Tests prove parsing behavior (coercion, defaults, rejection), not that zod works.
