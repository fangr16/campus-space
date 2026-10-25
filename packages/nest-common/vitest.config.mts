import { defineConfig, mergeConfig } from "vitest/config";
import { sharedVitestConfig } from "../../vitest.shared.mjs";

export default mergeConfig(
  sharedVitestConfig({ swc: true }),
  defineConfig({
    test: {
      coverage: {
        // bootstrap.ts only wires NestFactory, Swagger and listen(); it is exercised by every
        // service's integration tests and by the e2e smoke, not by unit tests.
        exclude: ["src/bootstrap.ts"],
      },
    },
  }),
);
