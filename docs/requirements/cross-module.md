# 跨模块集成点

任务书给定 X-1、X-2、X-3 为示例并要求"各组须讨论是否需要补充其他跨模块集成点"。X-4、X-5 为本组补充，讨论记录见文末。

| ID | 链路 | 要求 | 验收标准（现场可演示） | 状态 | 契约 |
|---|---|---|---|---|---|
| REQ-X-01 | M3 → M1 | 某自习室存在"维修中"工单时，该室全部座位自动从可预约列表下架；验收通过后自动恢复 | 工单进入 `IN_PROGRESS` 后，`GET /api/m1/rooms/:id/seats` 中座位带阻塞状态且预约被拒；`ACCEPTED` 后恢复。全程通过 HTTP，`seat_statuses.source = M3_REPAIR`，`refId = ticketId` | 未开始 | `RoomBlockRequest` / `RoomReleaseRequest`（`packages/contracts/src/events.ts`） |
| REQ-X-02 | M2 → M1 | 整教室预约审批通过后，该室在时段内全部座位被占用；驳回或超时撤销后回滚 | 审批通过后时段内个人预约被拒；`REJECTED`/`EXPIRED`/`CANCELLED` 后可再预约；`source = M2_ROOM_BOOKING`，`refId = bookingId` | 未开始 | 同上 |
| REQ-X-03 | 追溯 | M1 的座位状态必须记录写入来源 | `seat_statuses` 每行有 `source ∈ {M1_RESERVATION, M2_ROOM_BOOKING, M3_REPAIR}` 与 `refId`；按座位+时段可查到来源 | 已实现（schema 与契约） | `SeatStatusSource`（`seat-status.ts`）；`apps/m1-seat/prisma/schema.prisma` |
| REQ-X-04 | 统一通知（补充） | 三个模块的提醒都走 D-3 | 消息中心能看到 M1/M2/M3 各一类通知 | 未开始 | 待定义 `NotificationRequest` |
| REQ-X-05 | 统一审计（补充） | 三条链路的状态变更都写 D-4 | 按 `refId` 能查到 X-1/X-2 的写回与释放记录 | 未开始 | 待定义 `AuditEvent` |

## 调用方式（ADR-0003）

- 调用方以 `x-internal-token` 调用被调方的 `@Internal()` 接口；被调方不信任调用方传来的用户身份。
- 写回接口必须幂等：同一 `(source, refId)` 重复 block 不产生重复行，release 对不存在的 block 返回 0 行而非报错。
- 调用失败的处理策略（重试 / 补偿）在实现 X-1 时写 ADR。

## 讨论记录

| 日期 | 结论 |
|---|---|
| 2026-10-25（组长起草） | 补充 X-4、X-5：通知与审计若各模块各做一套，期末无法演示"统一"，且伦理记录（谁看了什么）需要统一审计。待组会确认。 |
