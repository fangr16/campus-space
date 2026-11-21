# ADR-0015: M3 向 M1 写回座位下架的触发与失败补偿

Status: implemented
Date: 2026-11-21
Related: TASK-034、REQ-M3-06 / REQ-X-01、[ADR-0003](2026-10-25-service-topology.md)、[ADR-0013](2026-11-21-m3-sla-escalation.md)

## 问题

X-1 要求维修中的自习室整室座位从 M1 可预约列表下架，验收通过后恢复。M1 的 block/release
内部接口（TASK-015）尚未由模块组 1 实现，但 M3 侧仍需交付可验证的逻辑。契约
`RoomBlockRequest` / `RoomReleaseRequest` 已在 `packages/contracts` 定义。

## 决定

- 触发点：`DISPATCHED / ESCALATED / REWORK → IN_PROGRESS`（start 接口）时 block；
  `DONE → ACCEPTED`（accept 接口）时 release。派单不下架，`DONE` 保持下架，只有验收通过才恢复。
- 范围：按工单的 `roomId` 下架整室，忽略 `seatId`；`source = M3_REPAIR`，`refId = ticketId`。
- 阻塞窗口：`from` 取注入时钟的当前时间，`to` 用固定远期哨兵 `2099-12-31T23:59:59.999Z`
  表示“直到显式释放”。维修没有业务结束时间；用 `slaDueAt` 作结束时间会让座位在 SLA 到期时提前恢复。
  M1 需按 `(source, refId)` 幂等写入，重复 block 覆盖同一条阻塞。
- 失败补偿：写回在工单状态变更的同一数据库事务内调用，失败即回滚状态与事件，下一次操作自然重试，
  避免“状态已变但座位仍可约”的分叉。
- 实现形态：`SeatBlocker` 端口 + `HttpSeatBlocker` 适配器，用内部令牌调用 M1 的
  `/api/m1/seat-status/block` 与 `/release`，3 秒超时；测试注入记录型替身，M1 接口就绪后无需改业务代码。

## 备选方案

- 写放在事务外、失败只记日志：实现简单，但状态与座位占用会分叉且没有重试入口，验收现场会出现“维修中仍可预约” → 否决。
- 用 `slaDueAt` 作为 `to`：语义错误，SLA 是升级期限而非维修结束，到期会让座位提前恢复 → 否决。
- 只下架报修的单个座位：违反任务书“该室全部座位下架”的整室规则 → 否决。
- 等 M1 接口完成再动手：当前无明确排期，M3 侧无法交付可验证的行为 → 改为按契约实现并用替身验证。

## 后果

- 端到端联调仍被 TASK-015 阻塞，已登记在 `not-done.md`；M1 接口路径与幂等行为需与其实现者对齐。
- 契约无需变更，复用既有 `RoomBlockRequest` / `RoomReleaseRequest`。
- 外部 HTTP 位于数据库事务内，长事务风险需关注；M1 接口稳定后评估改为 outbox 异步投递。
- 当前 M3 没有取消工单接口；若未来出现 `ESCALATED → CANCELLED` 且已下架，取消路径必须补一次 release。

## 验证

- `tickets.int-spec.ts`：派单不下架、开始维修整室 block、DONE 仍保持、验收 release、返工恢复时再次 block
  （同一 `refId`）、写回失败时状态与事件回滚。
- `seat-blocker.spec.ts`：内部令牌、请求体、响应校验、上游失败与非 200 的异常传播。
- 迁移重放与全量单测见本 MR 的检查记录；跨模块真实联调待 TASK-015 完成后补演示脚本。
