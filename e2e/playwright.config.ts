import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke. Expects a migrated and seeded database (`pnpm db:up && pnpm db:migrate &&
 * pnpm db:seed`) and built services (`pnpm build`). Each server below is started only when its
 * URL is not already answering, so `pnpm dev` in another terminal is reused as-is.
 */
const service = (name: string, dir: string, port: number) => ({
  command: `node ../scripts/with-env.mjs node ../apps/${dir}/dist/main.js`,
  url: `http://localhost:${port}/api/${name}/health`,
  reuseExistingServer: true,
  timeout: 60_000,
});

export default defineConfig({
  testDir: "./tests",
  // Every file logs in as the same seeded student and writes to one database, so files must
  // not run concurrently: a parallel worker would cancel or collide with data of another file.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5180",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "zh-CN",
  },
  projects: [
    { name: "warmup", testMatch: /warmup.setup.ts/ },
    {
      name: "chromium",
      dependencies: ["warmup"],
      testIgnore: [/warmup.setup.ts/, /mobile.spec.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    // Phone viewport for the REQ-M1-11 small-screen checks; Chromium-based so no extra browser install.
    {
      name: "mobile",
      dependencies: ["warmup"],
      testMatch: /mobile.spec.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        service("platform", "platform", Number(process.env.PLATFORM_PORT ?? 3001)),
        service("m1", "m1-seat", Number(process.env.M1_PORT ?? 3011)),
        service("m2", "m2-room", Number(process.env.M2_PORT ?? 3012)),
        service("m3", "m3-repair", Number(process.env.M3_PORT ?? 3013)),
        {
          command: "pnpm --filter @campus/web dev",
          url: "http://localhost:5180",
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],
});
