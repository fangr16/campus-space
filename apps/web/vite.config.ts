import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Dev server proxies each API prefix to its service so the browser only ever talks to one
 * origin, exactly like nginx does in deploy/nginx/default.conf.
 */
const services: Record<string, number> = {
  platform: Number(process.env.PLATFORM_PORT ?? 3001),
  m1: Number(process.env.M1_PORT ?? 3011),
  m2: Number(process.env.M2_PORT ?? 3012),
  m3: Number(process.env.M3_PORT ?? 3013),
};

export default defineConfig({
  plugins: [react()],
  // The contracts package is compiled from its TypeScript source instead of the CommonJS dist:
  // the dev server then always sees the current schemas (a pre-bundled copy went stale after
  // every rebuild) and gets HMR for free. Production builds use the same alias.
  resolve: {
    alias: {
      "@campus/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url),
      ),
    },
  },
  // Pre-bundle the third-party dependencies up front so Vite never discovers one mid-session,
  // re-optimizes and reloads the page (which broke the e2e login flow once).
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router",
      "@tanstack/react-query",
      "antd",
      "antd/locale/zh_CN",
      "@ant-design/icons",
      "dayjs",
      "zod",
    ],
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5180),
    proxy: Object.fromEntries(
      Object.entries(services).map(([name, port]) => [
        `/api/${name}`,
        { target: `http://localhost:${port}`, changeOrigin: true },
      ]),
    ),
  },
  preview: { port: Number(process.env.WEB_PORT ?? 5180) },
  build: {
    sourcemap: true,
    outDir: "dist",
  },
});
