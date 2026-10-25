# ADR-0006: 分支与合并策略

Status: implemented
Date: 2026-10-25
Related: 任务书 §三"版本管理"；Lab1 分析报告问题 3

## 问题

任务书要求：分支与合并策略明确；变更经合并请求评审后合并；代码冲突由人处理，不得交由 AI 自行合并；AI 生成的变更须经人工验收后提交，避免无法审查的大批量变更；提交历史是开发过程的主要证据。

## 决定

- **主干保护**：`main` 只接受合并请求，禁止直接推送（CodeArts 保护分支）。
- **分支命名**：`<type>/<scope>-<task 序号>-<slug>`，如 `feat/m1-017-seat-search`。
- **MR 粒度**：≤ 400 行改动、≤ 3 天生命周期，超过即拆分。
- **合并方式**：作者先 `git rebase origin/main`，冲突**由人**在特性分支上解决，再由评审人以 `--no-ff` 合并，保留分支内的细粒度提交。
- **评审人数**：普通 1 人；schema / contracts / 跨模块 / `packages/*` 为 2 人，且至少 1 人来自受影响模块。
- **提交信息**：Conventional Commits，scope 受 commitlint 白名单约束。
- **标签**：每次生产发布打 `v0.x.y`，与 `/version` 返回的 SHA 对应。
- **Bootstrap 例外**：仓库初始化阶段（本 ADR 所在的前 11 条提交，2026-10-25 至 2026-10-26）由组长直接提交到 `main`，以便在推送到 CodeArts 前形成可运行骨架；推送后立即开启保护分支，此后无例外。

## 备选方案

| 方案 | 优点 | 为什么落选 |
|---|---|---|
| squash 合并 | `main` 历史整洁 | 会抹掉"每次 AI 变更经人工验收"的细粒度提交，而提交历史正是任务书的主要证据 |
| 允许 agent 解决简单冲突 | 省时 | 任务书明文禁止；Lab1 报告显示 harness 团队也出现过冲突解决后的返工 |
| 长期特性分支按模块开发，Review 前合并 | 组间互不干扰 | 冲突集中爆发，集成风险全部后置；Lab1 报告显示 harness 一半的合并是为了同步主干 |
| 完全 trunk-based 直推 main | 最快 | 无评审记录，违反任务书 |

## 后果

- 组员需要习惯小 MR 与频繁 rebase；`pre-push-checks` skill 规定 `--force-with-lease`。
- 不提交每个 MR 都会重生成的汇总文件（OpenAPI 输出、覆盖率报告），避免 Lab1 报告中观察到的生成文件冲突。

## 验证

- CodeArts 分支策略截图归档于 `docs/ops/codearts-setup.md`。
- `git log --merges` 中每个合并对应一个 MR，无 squash 提交。
