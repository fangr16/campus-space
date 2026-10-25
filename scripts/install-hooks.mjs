#!/usr/bin/env node
/**
 * `pnpm install` runs this through the "prepare" script.
 * Installs the lefthook git hooks on developer machines and does nothing in CI or inside a
 * container image build, where there is no git checkout to hook into.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
if (process.env.CI || !existsSync(join(root, ".git"))) {
  console.info("install-hooks: skipped (CI or no .git directory)");
  process.exit(0);
}
const result = spawnSync("pnpm", ["exec", "lefthook", "install"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
