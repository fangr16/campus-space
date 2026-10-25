import { defineConfig, mergeConfig } from "vitest/config";
import { sharedVitestConfig } from "../../vitest.shared.mjs";

/**
 * Unit tests cover the framework-free layer: API client, auth store and view models.
 * React components are verified by the Playwright smoke in /e2e against the running stack,
 * so .tsx files are excluded from the unit coverage gate on purpose.
 */
export default mergeConfig(
  sharedVitestConfig({ swc: false }),
  defineConfig({
    test: {
      include: ["src/**/*.spec.ts"],
      coverage: {
        include: ["src/lib/**/*.ts", "src/features/**/*.model.ts"],
        // app-context.ts only wires the singletons to window.localStorage; the e2e smoke covers it.
        exclude: ["src/**/*.spec.ts", "src/**/*.d.ts", "src/lib/app-context.ts"],
      },
    },
  }),
);
