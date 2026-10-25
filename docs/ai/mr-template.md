# 合并请求模板

> 在 CodeArts Repo 新建合并请求时把下面内容粘贴为描述（控制台若支持 MR 模板则配置为默认模板）。三段都必填。

```markdown
## Motivation

- 需求/任务：REQ-M1-04 / TASK-017
- 决策记录：docs/adr/implemented/yyyy-mm-dd-xxx.md（非平凡变更必填，否则写"无：原因"）
- 任务 brief：（粘贴 task-brief 产出的验收标准）

## Changes

- 接口/契约变更：（packages/contracts 的 diff 摘要，或"无"）
- Schema 变更：（迁移文件名，或"无"）
- 行为变更：（用户可见的变化，一条一行）

## Evidence

- [ ] `pnpm verify` 通过
- [ ] `pnpm --filter <pkg> test` 通过（粘贴覆盖率摘要）
- [ ] 集成测试 / e2e（如适用，粘贴命令与结果）
- [ ] 手工验证（请求与响应，或截图/GIF）
- 破坏实验：把 `<文件:行>` 改成 `<…>` 后，`<测试名>` 失败（可选但推荐）

## Review

- 需要的评审人数：1 / 2（schema、contracts、跨模块、packages/* 为 2）
- AI 参与方式：（哪些部分由 agent 生成、你如何验收）
```

## 为什么这样设计

- Motivation 强制引用 REQ/TASK/ADR，满足任务书"提交说明能对应任务或需求"和"需求可追踪"。
- Evidence 要求贴命令和输出，对应 `AGENTS.md` 的 "Verify the world, not the self-report"。
- "AI 参与方式"一栏让"AI 生成的变更须经人工验收后提交"有书面痕迹，期末论文也能引用。
