/**
 * Shared Stryker configuration (ADR-0005). Mutation testing is the automated form of
 * "break the implementation on purpose and check that a test fails". It targets the pure
 * logic layer that unit tests own; adapters covered by integration tests are excluded.
 *
 * Usage in a package's stryker.config.mjs:
 *   import { sharedStrykerConfig } from "../../stryker.shared.mjs";
 *   export default sharedStrykerConfig();
 *
 * Results are summarized by hand into docs/quality/mutation-log.md before each review.
 */
export function sharedStrykerConfig(overrides = {}) {
  return {
    plugins: ["@stryker-mutator/vitest-runner"],
    testRunner: "vitest",
    vitest: { configFile: "vitest.config.mts" },
    mutate: [
      "src/**/*.ts",
      "!src/**/*.spec.ts",
      "!src/**/*.int-spec.ts",
      "!src/main.ts",
      "!src/seed.ts",
      "!src/**/index.ts",
      "!src/**/*.module.ts",
      "!src/**/*.controller.ts",
      "!src/**/*.repository.ts",
      "!src/prisma/**",
      "!src/bootstrap.ts",
      "!src/generated/**",
    ],
    ignoreStatic: true,
    coverageAnalysis: "perTest",
    reporters: ["clear-text", "progress", "html", "json"],
    htmlReporter: { fileName: "reports/mutation/index.html" },
    jsonReporter: { fileName: "reports/mutation/report.json" },
    thresholds: { high: 85, low: 70, break: null },
    tempDirName: ".stryker-tmp",
    // Mutate in place: the sandbox copy would break the relative import of vitest.shared.mjs.
    inPlace: true,
    cleanTempDir: true,
    ...overrides,
  };
}
