/** Schema owned by the integration tests; it is dropped and re-migrated on every run. */
export const TEST_SCHEMA = "platform_test";

/** Rewrites the `schema` query parameter of a PostgreSQL URL so tests never touch dev data. */
export function testDatabaseUrl(baseUrl: string, schema: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
