#!/usr/bin/env node
/**
 * Runs a command with the repository root `.env` loaded (variables already present in the
 * environment win). Lets every workspace package share one env file without each app
 * depending on dotenv:  node ../../scripts/with-env.mjs prisma migrate deploy
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envFile = join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: with-env.mjs <command> [args...]");
  process.exit(2);
}
const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
