# ADR-0013: M3 SLA 超时升级的幂等与通知边界

Status: implemented
Date: 2026-11-21
Related: TASK-033、REQ-M3-04、[ADR-0005](2026-11-05-test-effectiveness.md)

## 问题

REQ-M3-04 要求定时扫描超时工单：在途工单升级为 `ESCALATED` 并发一次站内通知，`REWORK`
超时只提醒一次且保持原状态，重复扫描不得重复升级或提醒。状态机禁止
`REWORK → ESCALATED`，事件表又只表达状态迁移，无法直接记录“提醒”。D-3 通知模块
（TASK-042）尚未建立，无法真正投递站内消息。

## 决定

- 扫描时间来自注入的 `CLOCK`，周期由 `M3_SLA_SCAN_INTERVAL_MS` 控制（默认 60 秒，0 禁用）；
  测试注入固定时钟并直接调用 `scan()`。严格以 `slaDueAt < now` 判断超时，边界时刻不算超时。
- 升级：在事务内重新读取工单，`assertTransition` 校验后用
  `updateMany({ id, status })` 条件更新，写入一条 `actorId = system:sla` 的事件，再经
  `Notifier` 发通知。条件更新只可能有一方成功，冲突方直接跳过；升级后状态不再是候选。
- 返工提醒：`repair_tickets` 增加 `reworkRemindedAt` 列，用
  `updateMany({ id, status: REWORK, reworkRemindedAt: null })` 抢占一次，只发通知，不改状态、
  不写事件。
- 通知通过 `Notifier` 端口发出，当前实现 `LoggingNotifier` 只记录投递意图（见
  `not-done.md`）。通知在事务内调用：投递失败会回滚升级/提醒，下一次扫描重试，避免消息丢失。
  D-3 就绪后替换适配器，届时应改为 outbox 异步投递，避免外部调用长时间占用数据库事务。

## 备选方案

- 在 `ticket_events` 中写一条 `REWORK → REWORK` 事件表示提醒：污染状态历史、破坏“事件即状态迁移”
  的不变量，且让审计无法区分真实流转与提醒。
- 不设标记、每次扫描都提醒：实现最短，但重复扫描会重复通知，直接违反验收标准。
- 通知在事务外发送：升级状态先提交而投递失败时消息永久丢失，且缺少重试入口。
- 直接使用 `new Date()` 与 `setInterval`：测试依赖真实时钟，边界时刻不可确定，破坏可验证性。

## 后果

- 新增迁移与 `reworkRemindedAt` 列，属 schema 变更，需两名人工评审；`generated/prisma` 不提交。
- 站内通知当前不实际送达用户，作为降级项登记；D-3 完成后仅替换适配器，业务规则不变。
- 默认每分钟扫描一次；`M3_SLA_SCAN_INTERVAL_MS=0` 可关闭定时器用于本地手工扫描。
- 事件历史新增 `system:sla` 操作者，前端与审计展示需接受非用户身份。

## 验证

- `sla.service.spec.ts`：时钟注入、两种升级、返工单次提醒、重复扫描、并发冲突、通知失败、定时器启停。
- `sla.int-spec.ts`：真实 PostgreSQL 上重放三个迁移，校验升级/事件/通知的原子性与幂等，以及边界与终态不被触碰。
- `ticket-status.spec.ts`：覆盖 `isOverdue` 的严格边界与状态限制。
- 覆盖率与变异结果见 `docs/quality/mutation-log.md`。
