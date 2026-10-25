#!/usr/bin/env node
/**
 * Gate: every ADR under docs/adr/{proposed,implemented,rejected} has the required shape.
 *
 * Checks (see .agents/skills/write-adr/SKILL.md):
 *  - file name yyyy-mm-dd-<kebab>.md
 *  - first line "# ADR-NNNN: <title>"
 *  - "Status: <x>" matches the folder it lives in
 *  - "Date: yyyy-mm-dd" present
 *  - required sections present; proposed uses "## 方案", others use "## 决定"
 *  - "## 备选方案" has at least one table row or list item
 *
 * Exits non-zero with one line per violation.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const adrRoot = join(root, "docs", "adr");
const statuses = ["proposed", "implemented", "rejected"];
const fileNameRe = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const titleRe = /^# ADR-\d{4}: \S.*$/;

const problems = [];

for (const status of statuses) {
  const dir = join(adrRoot, status);
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    problems.push(`${relative(root, dir)}: directory missing`);
    continue;
  }
  for (const name of entries) {
    if (name === ".gitkeep") continue;
    const file = join(dir, name);
    if (!statSync(file).isFile()) continue;
    const rel = relative(root, file).replaceAll("\\", "/");
    if (!fileNameRe.test(name)) problems.push(`${rel}: file name must be yyyy-mm-dd-topic.md`);
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    if (!titleRe.test(lines[0] ?? ""))
      problems.push(`${rel}: first line must be "# ADR-NNNN: title"`);
    const statusLine = lines.find((l) => l.startsWith("Status:"));
    const declared = statusLine?.replace("Status:", "").trim();
    if (declared !== status)
      problems.push(`${rel}: Status "${declared ?? "(none)"}" does not match folder "${status}"`);
    if (!lines.some((l) => /^Date: \d{4}-\d{2}-\d{2}$/.test(l)))
      problems.push(`${rel}: missing "Date: yyyy-mm-dd"`);

    const headings = lines.filter((l) => l.startsWith("## ")).map((l) => l.slice(3).trim());
    const decisionHeading = status === "proposed" ? "方案" : "决定";
    for (const required of ["问题", decisionHeading, "备选方案", "后果", "验证"]) {
      if (!headings.includes(required)) problems.push(`${rel}: missing section "## ${required}"`);
    }
    const alt = sectionBody(lines, "备选方案");
    if (alt && !alt.some((l) => /^\s*(\|.*\||[-*]\s+\S|\d+\.\s+\S)/.test(l))) {
      problems.push(
        `${rel}: "## 备选方案" must list at least one alternative (table row or list item)`,
      );
    }
  }
}

function sectionBody(lines, heading) {
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) return null;
  const body = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) break;
    body.push(lines[i]);
  }
  // Skip the table header and separator rows so an empty table does not count.
  return body.filter((l) => !/^\s*\|[\s:-|]*\|\s*$/.test(l) && !/^\s*\|\s*方案\s*\|/.test(l));
}

if (problems.length > 0) {
  console.error("verify-adr: FAILED");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log("verify-adr: ok");
