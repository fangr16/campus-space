#!/usr/bin/env node
/**
 * Gate: agent instruction files stay short enough to be read on every task.
 *
 *  - root AGENTS.md            <= 800 words
 *  - any nested AGENTS.md      <= 300 words
 *  - CLAUDE.md                 must be exactly "@AGENTS.md" (pointer, not a second rule set)
 *  - every .agents/skills/<x>/SKILL.md has name + description front matter
 *
 * Word count splits on whitespace, which is what the budget in AGENTS.md promises.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ROOT_BUDGET = 800;
const NESTED_BUDGET = 300;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".turbo", ".pnpm-store"]);
const problems = [];

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name === "AGENTS.md") out.push(full);
  }
  return out;
}

const words = (text) => text.split(/\s+/).filter(Boolean).length;

for (const file of walk(root, [])) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const count = words(readFileSync(file, "utf8"));
  const budget = rel === "AGENTS.md" ? ROOT_BUDGET : NESTED_BUDGET;
  if (count > budget) problems.push(`${rel}: ${count} words, budget is ${budget}`);
}

const claude = join(root, "CLAUDE.md");
if (!existsSync(claude)) problems.push("CLAUDE.md: missing (must contain exactly @AGENTS.md)");
else if (readFileSync(claude, "utf8").trim() !== "@AGENTS.md") {
  problems.push("CLAUDE.md: must contain exactly @AGENTS.md so there is one rule source");
}

const skillsDir = join(root, ".agents", "skills");
if (existsSync(skillsDir)) {
  for (const name of readdirSync(skillsDir)) {
    const skill = join(skillsDir, name, "SKILL.md");
    if (!existsSync(skill)) {
      problems.push(`.agents/skills/${name}: missing SKILL.md`);
      continue;
    }
    const text = readFileSync(skill, "utf8");
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) problems.push(`.agents/skills/${name}/SKILL.md: missing front matter`);
    else {
      if (!/^name:\s*\S/m.test(fm[1]))
        problems.push(`.agents/skills/${name}/SKILL.md: front matter needs "name"`);
      if (!/^description:\s*\S/m.test(fm[1]))
        problems.push(`.agents/skills/${name}/SKILL.md: front matter needs "description"`);
    }
  }
}

if (problems.length > 0) {
  console.error("verify-agents-budget: FAILED");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log("verify-agents-budget: ok");
