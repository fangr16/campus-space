# 人机协作方式

任务书考核"人与 AI 如何分工、如何验证、如何约束"。本文件说明本组的做法；规则本身在 [`AGENTS.md`](../../AGENTS.md)（英文，给 agent 读），这里解释为什么这样定、人要做什么。

## 1. 分工

| 谁 | 做什么 | 不做什么 |
|---|---|---|
| 人（组员） | 定范围与验收标准、审阅 brief、阅读并验收每一次变更、解决冲突、评审 MR、决定方案 | 不手写样板代码、不手动跑重复检查 |
| agent | 按 brief 实现、写测试、跑检查并贴输出、起草 ADR 与文档、自检 code-review | 不直接推 `main`、不解决合并冲突、不降低门禁、不在没有 brief 的情况下开工 |

Lab1 分析报告的结论是：在 AI 主导编码的项目里，人的主要工作是"为 agent 指定工作环境和验收标准"。本仓库把这件事做成了文件与门禁，而不是靠每次对话重复交代。

## 2. 规则供给：agent 怎么知道规矩

| 工具 | 读取的文件 |
|---|---|
| Codex / Qoder / Trae / CodeArts 代码智能体 | `AGENTS.md`（根目录与子目录） |
| Claude Code | `CLAUDE.md`（内容只有 `@AGENTS.md`，即导入同一文件） |
| Cursor | `.cursor/rules/agents.mdc`（指向 `AGENTS.md`） |
| 全部 | `.agents/skills/*/SKILL.md`：`task-brief`、`pre-push-checks`、`code-review`、`write-adr` |

约束：根 `AGENTS.md` ≤ 800 词、子目录 ≤ 300 词，由 `pnpm verify:docs` 检查。短，才会被每次读完。

## 3. 任务委派：一次任务的标准流程

```
TASK-xxx（docs/plan/tasks.md，指向 REQ-xxx）
  │
  ├─ 1. 人：把任务号和一句话目标给 agent
  ├─ 2. agent：用 task-brief skill 产出 brief（范围 / 约束 / 验收标准 / 备选方案 / 文件清单）
  ├─ 3. 人：审阅 brief，改验收标准，批准     ← 任务书"先出方案再实现"
  ├─ 4. agent：实现 + 测试，每一步贴命令输出  ← "Verify the world, not the self-report"
  ├─ 5. 人：阅读 diff，逐段验收后提交          ← "AI 生成的变更须经人工验收后提交"
  ├─ 6. agent：pre-push-checks → code-review 自检
  ├─ 7. 人：开 MR（docs/ai/mr-template.md），写明 AI 参与方式
  └─ 8. 评审人：按 code-review skill 的 Blocking 项评审；通过后 --no-ff 合并
```

## 4. 验证：怎么知道 agent 没有骗人

- **机器门禁**：lefthook（提交前）与 CI（`scripts/ci.sh`）跑同一套检查，agent 绕不过。
- **证据规则**：MR 的 Evidence 段必须贴命令与输出；"测试通过了"四个字不算证据。
- **破坏实验**：评审人对每条新测试问"实现中哪一行改坏后它会失败"；Stryker 定期自动做同样的事（`quality/mutation-log.md`）。
- **契约校验**：前端用 zod 校验每个响应；服务间用 `packages/contracts`。agent 幻觉出的字段在运行时就会炸。

## 5. 约束：明确禁止 agent 做的事

见 `AGENTS.md › Hard rules`。其中三条来自任务书原文：不得自行合并冲突、不得生成无法审查的大批量变更、不得绕过评审。

## 6. 本仓库的 bootstrap 记录（真实情况）

base repo 由组长与 Claude Code 在 2026-10-25 一次会话中搭建，前 11 条提交直接进入 `main`（ADR-0006 记录了这一例外）。过程中 agent 出现过的问题与人工纠正，作为 `ai-quality-risks.md` 的第一批素材：

| 现象 | 人工处理 |
|---|---|
| 用 `prisma migrate reset` 做测试库初始化，被 Prisma 判定为危险操作 | 改为 drop 专用测试 schema + `migrate deploy`，不再使用破坏性命令 |
| 把 Prisma client 生成到 `src/generated`，编译后运行时找不到 | 改到 `apps/*/generated`，并加入 `.gitignore` |
| Biome 自动把 Nest 依赖注入用到的 import 改成 `import type`，导致构建失败 | 关闭 `useImportType` 规则并写入配置说明 |
| 端口假设错误（5432、5433、5173 均被本机其它程序占用） | 改为 55432 / 5180，并写进 `.env.example` |
| 覆盖率不足时的第一反应是排除文件 | 只排除有集成测试覆盖的适配层并写明理由；纯逻辑补真实测试 |
| 11 条提交完成后用 code-reviewer agent 复审，发现 4 条 HIGH：运行镜像里没有 prisma CLI（迁移容器必然失败）、nginx 缺少被 include 的文件、回滚脚本会选到失败前两个版本、演示账号默认在生产种子里创建 | 全部修复并补测试（第 12 条提交）；说明 agent 自己写的部署脚本在没有真实运行前不可信，TASK-050 必须在真实 ECS 上跑通 |
