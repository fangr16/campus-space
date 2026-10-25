# 任务 brief 模板

> agent 侧的操作说明在 `.agents/skills/task-brief/SKILL.md`。这里是给人看的版本：你在批准一份 brief 之前应该检查什么。

## 模板

```markdown
## Task brief: <标题>

- Source: REQ-M1-04 / TASK-017
- Goal（一句话，可观察的结果）:
- In scope:
- Out of scope:
- Constraints:（涉及的契约、是否改 schema、是否跨模块、性能、安全）
- Acceptance criteria:（每条可测试，并写明由哪个测试文件证明）
  1.
  2.
- Files to change:
- Alternatives considered:
- Risks and how they are checked:
- Estimated size: <N files, ~M lines>（必须 < 400 行改动）
```

## 批准前的检查清单（人）

- [ ] Source 指向真实存在的 REQ/TASK，而不是 agent 编的编号。
- [ ] 每条验收标准都能回答"失败时是哪个测试红"。"功能正常"不算。
- [ ] 至少有一个被否决的备选方案，且否决理由站得住。
- [ ] 改 schema 或 contracts 时，brief 写明了迁移文件名和受影响的消费方。
- [ ] 规模 < 400 行；否则要求拆成有序的多个 brief。
- [ ] Out of scope 里写了你最担心 agent 顺手去改的东西。

## 一个真实例子（base repo 的 M1 切片）

```markdown
## Task brief: M1 自习室与座位只读接口

- Source: REQ-M1-02 / REQ-M1-07 / REQ-M1-09
- Goal: 学生登录后能看到自己有权使用的自习室，并按插座筛选座位
- In scope: rooms/seats 表与迁移、种子、GET /rooms、GET /rooms/:id/seats、前端两页
- Out of scope: 预约、签到、管理端写接口
- Constraints: 不改 contracts 之外的共享包；他院系房间返回 404 不返回 403
- Acceptance criteria:
  1. CS 学生看到全校房间 + CS 房间（rooms.int-spec.ts）
  2. EE 学生看不到 CS 房间，按 id 访问 404（rooms.int-spec.ts）
  3. ?hasPower=true 只返回带插座座位（rooms.int-spec.ts）
  4. 可见性与开放时间规则有纯函数单测（room-visibility.spec.ts）
- Files to change: apps/m1-seat/**, apps/web/src/features/m1/**
- Alternatives considered: 可见性在前端过滤（否：泄露数据）；403 而非 404（否：泄露存在性）
- Risks: 种子与契约角色漂移 → toJwtPayload 解析失败即报错
- Estimated size: 14 files, ~600 lines（超限，拆为后端 + 前端两个 MR）
```
