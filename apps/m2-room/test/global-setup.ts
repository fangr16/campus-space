/**
 * Vitest global setup for integration tests.
 * Points M2_DATABASE_URL at the dedicated `m2_test` schema of the local database,
 * drops that schema and replays every committed migration with `prisma migrate deploy`, so the
 * tests always run against the schema the migrations actually produce. Development data in the
 * `platform` schema is never touched.
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { PrismaClient } from "../generated/prisma";
import { TEST_SCHEMA, testDatabaseUrl } from "./test-db";

export default async function setup(): Promise<void> {
  const base = process.env.M2_DATABASE_URL;
  if (!base) {
    throw new Error(
      "M2_DATABASE_URL is not set. Run `pnpm db:up` and copy .env.example to .env first.",
    );
  }
  const url = testDatabaseUrl(base, TEST_SCHEMA);
  process.env.M2_DATABASE_URL = url;

  const admin = new PrismaClient({ datasourceUrl: url });
  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
  } finally {
    await admin.$disconnect();
  }

  execSync("npx prisma migrate deploy", {
    cwd: resolve(__dirname, ".."),
    stdio: "inherit",
    env: { ...process.env, M2_DATABASE_URL: url },
  });
}
