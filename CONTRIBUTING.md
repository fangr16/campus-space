# 贡献指南

本文件写给组内成员。给 agent 的规则在 `AGENTS.md`，两者冲突时以 `AGENTS.md` 为准并提 MR 修正本文件。

## 1. 工作流（每个任务）

1. **领任务**：任务来自 `docs/plan/tasks.md`（`TASK-xxx`），每个任务指向一条需求（`REQ-xxx`）。没有编号的工作不开始。
2. **写 brief**：让 agent 用 `task-brief` skill 产出范围 / 约束 / 验收标准 / 备选方案，你审阅通过后再让它实现。
3. **开分支**：`feat/m1-017-seat-search`，格式 `<type>/<scope>-<task>-<slug>`。
4. **实现**：agent 产出的每次变更由你阅读后再提交。不接受"一次性 2000 行"的提交。
5. **自检**：推送前跑 `pre-push-checks` skill，开 MR 前跑 `code-review` skill。
6. **开 MR**：用 `docs/ai/mr-template.md` 的三段：Motivation（引用 REQ/TASK/ADR）、Changes、Evidence。
7. **评审**：普通变更 1 人；schema / contracts / 跨模块 / `packages/*` 变更 2 人且至少 1 人来自受影响模块。评审意见全部解决、流水线通过后，由评审人合并。
8. **合并**：先 `git rebase origin/main`，冲突**由人**在分支上解决，推送后由评审人以 `--no-ff` 合并。

## 2. 提交信息

Conventional Commits：`type(scope): summary`

- type：`feat fix refactor test docs build ci chore perf adr`
- scope：`platform m1 m2 m3 web contracts auth common infra ci docs adr`
- summary 用祈使句，不超过 72 字符；正文说明"做了什么、为什么"，可引用 `REQ-M1-04`。

commitlint 在 `commit-msg` 钩子强制检查。

## 3. 本地钩子

`pnpm install` 后 lefthook 自动安装：

| 钩子 | 内容 |
|---|---|
| commit-msg | commitlint |
| pre-commit | biome 格式化与 lint（仅暂存文件）、AGENTS.md 字数、ADR 格式、空白符检查 |
| pre-push | 受影响包的 typecheck 与单元测试 |

钩子不能跳过（`--no-verify` 视为违规）。钩子误报请提 issue 修钩子。

## 4. 评审时看什么

按 `.agents/skills/code-review/SKILL.md` 的 Blocking 列表逐条看，重点是：

- 测试能不能失败：找出"把实现改坏后这条测试会红"的那一行；找不到就是阻塞项。
- 模块边界：有没有跨 app import、跨 schema SQL。
- `SeatStatus` 写入是否带 `source`。
- 有没有改了行为却没改 `docs/requirements`。

## 5. 版本与发布

- 测试环境：合并到 `main` 后流水线自动部署，无需人工。
- 生产环境：流水线"人工审核"节点由组长或平台负责人批准；每次发布打 tag `v0.x.y`，并在 `docs/ops/release.md` 追加记录。
- 回滚：`deploy/scripts/rollback.sh <previous-tag>`。

## 6. 决策与伦理

- 任何在两个以上方案间做出的选择写 ADR（`write-adr` skill）。
- 每次评审会各成员在 `docs/ethics/ethics-log.md` 追加至少一条真实的伦理判断，期末论文直接引用。
