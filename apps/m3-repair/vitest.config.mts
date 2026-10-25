import { defineConfig, mergeConfig } from "vitest/config";
import { sharedVitestConfig } from "../../vitest.shared.mjs";

export default mergeConfig(
  sharedVitestConfig({ swc: true }),
  defineConfig({
    test: {
      coverage: {
        // Controllers, repositories and the Prisma service are thin adapters. They are covered
        // by the *.int-spec.ts suite against a real database (pnpm test:integration), which is
        // the evidence ADR-0005 asks for; the unit gate measures services and pure logic.
        exclude: ["src/**/*.controller.ts", "src/**/*.repository.ts", "src/prisma/**"],
      },
    },
  }),
);
