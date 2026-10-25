import { defineConfig, mergeConfig } from "vitest/config";
import { sharedVitestConfig } from "../../vitest.shared.mjs";

/**
 * Integration tests talk to a real PostgreSQL schema (`m2_test`), migrated from scratch
 * by test/global-setup.ts. Run with `pnpm test:integration` after `pnpm db:up`.
 */
export default mergeConfig(
  sharedVitestConfig({ swc: true, integration: true }),
  defineConfig({
    test: {
      globalSetup: ["./test/global-setup.ts"],
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 60_000,
    },
  }),
);
