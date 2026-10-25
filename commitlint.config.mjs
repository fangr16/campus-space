/**
 * Commit message gate. Mirrors the "Commits" section of AGENTS.md.
 *   type(scope): summary
 * Scope is optional for repository-wide changes but, when present, must be one of the
 * module or area names below so history can be filtered per module.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "test", "docs", "build", "ci", "chore", "perf", "adr", "revert"],
    ],
    "scope-enum": [
      2,
      "always",
      [
        "platform",
        "m1",
        "m2",
        "m3",
        "web",
        "contracts",
        "auth",
        "common",
        "testing",
        "infra",
        "ci",
        "docs",
        "adr",
        "deps",
      ],
    ],
    "scope-case": [2, "always", "lower-case"],
    "subject-case": [0],
    "header-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 100],
  },
};
