/**
 * Shared Vitest configuration for every workspace package.
 *
 * - Unit tests: `src/**\/*.spec.ts`, no database, run by `pnpm test`.
 * - Integration tests: `src/**\/*.int-spec.ts`, need DATABASE_URL, run by `pnpm test:integration`.
 * - Coverage gate: 80% lines and branches (ADR-0005). Do not lower it in a package; fix the tests.
 * - `swc: true` enables decorator metadata for NestJS packages.
 *
 * Usage in a package:
 *   import { sharedVitestConfig } from "../../vitest.shared.mjs";
 *   export default mergeConfig(sharedVitestConfig({ swc: true }), defineConfig({}));
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * @param {{ swc?: boolean, integration?: boolean }} options
 */
export function sharedVitestConfig(options = {}) {
  const integration = options.integration ?? process.env.VITEST_INTEGRATION === "1";
  const plugins = [];
  if (options.swc) {
    const swcModule = require("unplugin-swc");
    const swc = swcModule.default ?? swcModule;
    plugins.push(
      swc.vite({
        module: { type: "es6" },
        jsc: {
          target: "es2022",
          parser: { syntax: "typescript", decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
      }),
    );
  }
  return {
    plugins,
    test: {
      globals: false,
      environment: "node",
      include: integration ? ["src/**/*.int-spec.ts"] : ["src/**/*.spec.ts"],
      passWithNoTests: false,
      reporters: process.env.CI ? ["default", "junit"] : ["default"],
      outputFile: process.env.CI ? { junit: "reports/junit.xml" } : undefined,
      coverage: {
        provider: "v8",
        enabled: !integration,
        reporter: ["text-summary", "lcov"],
        reportsDirectory: "coverage",
        include: ["src/**/*.ts"],
        exclude: [
          "src/**/*.spec.ts",
          "src/**/*.int-spec.ts",
          "src/main.ts",
          "src/**/index.ts",
          "src/**/*.module.ts",
          "generated/**",
          "src/**/*.d.ts",
        ],
        thresholds: { lines: 80, branches: 80 },
      },
    },
  };
}
