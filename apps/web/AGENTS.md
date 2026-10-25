# apps/web

React front end for every module. Vite dev server on 5180 proxies `/api/<service>` to the
services, the same shape nginx serves in deployment.

## Layout

- `src/lib/` framework-free: `api-client.ts` (envelope parsing, bearer token, typed
  `ApiClientError`), `auth-store.ts` (token persistence), unit tested at 80%.
- `src/features/<module>/` pages, hooks and `*.model.ts` view models per module
  (`auth`, `shell`, `m1`, `m2`, `m3`). View models are pure and unit tested.
- `src/styles/tokens.css` design tokens; components use tokens, never raw colors. Feature
  styles live next to the component (`seat-map.css`).
- `@campus/contracts` is aliased to its TypeScript source in `vite.config.ts`; do not import
  from its `dist`.

## Rules

- Parse every response with the zod schema from `@campus/contracts` in the feature's
  `api.ts`; never trust `any` from fetch.
- Server state lives in TanStack Query; no copying of query results into local state.
- Every query renders loading, empty and error states.
- Routes: `/login`, `/m1/rooms`, `/m1/rooms/:id`, `/m2`, `/m3`. Add new routes in `app.tsx`.
- Components are verified by the Playwright smoke in `/e2e`; keep pure logic in
  `*.model.ts` so it can be unit tested.
- Semantic HTML first (`main`, `nav`, `section`, headings in order); Ant Design for forms
  and tables only.
