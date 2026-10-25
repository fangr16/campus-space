#!/usr/bin/env node
/**
 * Runs every documentation gate in sequence and fails if any of them fails.
 * Add new gates here so `pnpm verify:docs`, lefthook and CI stay in sync.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gates = ["verify-agents-budget.mjs", "verify-adr.mjs"];

let failed = false;
for (const gate of gates) {
  const result = spawnSync(process.execPath, [join(here, gate)], { stdio: "inherit" });
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
