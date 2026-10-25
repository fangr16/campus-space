# 决策记录（ADR）

任务书要求"理解和评估 AI 给出的候选方案，而非直接接受 AI 首次给出的方案"，并要求公共层归属等决策"形成书面决策记录"。这个目录就是那份证据。

## 目录即状态

```
adr/
  proposed/     提出后待评审；组会或 MR 评审通过后移入 implemented/
  implemented/  已决定并已落地；内容与实际一致，反悔要写新 ADR 并互相链接
  rejected/     被否决但理由仍有价值（防止以后再踩）
```

文件名 `yyyy-mm-dd-<topic>.md`，日期为首次提出日；文件内 `Status:` 必须与所在目录一致，`pnpm verify:docs` 会检查。

## 必填结构

```markdown
# ADR-NNNN: 标题

Status: proposed | implemented | rejected
Date: yyyy-mm-dd
Related: REQ-xx / TASK-xx / 其他 ADR

## 问题
## 决定            （proposed 状态写 "## 方案"）
## 备选方案        （至少一个，并说明为什么落选）
## 后果
## 验证
```

写 ADR 用 `.agents/skills/write-adr` skill。

## 索引

| 编号 | 主题 | 状态 |
|---|---|---|
| ADR-0001 | [公共层 D 的归属](proposed/2026-10-25-public-layer-ownership.md) | proposed（待组会确认） |
| ADR-0002 | [技术栈：全 TypeScript](implemented/2026-10-25-tech-stack.md) | implemented |
| ADR-0003 | [服务形态：每模块一个服务](implemented/2026-10-25-service-topology.md) | implemented |
| ADR-0004 | [托管与流水线：只用 CodeArts](implemented/2026-10-25-hosting-and-pipeline.md) | implemented |
| ADR-0005 | [测试有效性：80% 覆盖 + 变异测试](implemented/2026-10-25-test-effectiveness.md) | implemented |
| ADR-0006 | [分支与合并策略](implemented/2026-10-25-branching-and-merging.md) | implemented |
| ADR-0007 | [座位平面图与插座覆盖范围的数据模型](implemented/2026-10-25-seat-layout-model.md) | implemented |

> ADR-0002 到 0006 是组长在搭建 base repo 时做的启动决策，已随仓库落地，因此直接记为 implemented。任何组员可以提出新的 ADR 取代它们。
