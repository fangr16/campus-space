import { defineConfig, mergeConfig } from "vitest/config";
import { sharedVitestConfig } from "../../vitest.shared.mjs";

export default mergeConfig(sharedVitestConfig({ swc: true }), defineConfig({}));
