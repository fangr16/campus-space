# ADR-0009: 座位预约的数据模型、并发控制与参数

Status: implemented
Date: 2026-11-05
Related: REQ-M1-04、REQ-M1-02、REQ-X-03；TASK-010；[ADR-0007](2026-10-25-seat-layout-model.md)

## 问题

REQ-M1-04 要求"整点小时为单位，最多一次性预约 4 小时（系统参数可调）"。实现时要回答四个问题：预约和座位状态的关系；两个学生同时抢同一座位时如何保证只有一人成功；"参数可调"的参数放在哪；预约开始后能否取消、一人能否同时占多个座位。组长于 2026-11-05 对 M1 内部决策拍板，公共层相关契约留待组会。

## 决定

1. **预约有自己的表** `reservations`（用户、座位、时段、状态 `BOOKED/CANCELLED`、取消原因），同时每条有效预约在 `seat_statuses` 写一行 `kind=RESERVED, source=M1_RESERVATION, refId=预约 id`。取消时删除该状态行。这样 X-3 的"写入来源"在同一张表里，M2/M3 以后的占用也写同一张表。
2. **并发由数据库保证**：`seat_statuses` 上手写迁移加 `btree_gist` 扩展与排他约束 `EXCLUDE USING gist ("seatId" WITH =, tsrange("from","to",'[)') WITH &&)`。应用层只负责把约束冲突翻译成 409 `seat-overlap`。Prisma 无法表达该约束，`migrate dev` 会提示 drift，属预期。
3. **规则在纯函数里**（`reservation-rules.ts`）：起止落在时段边界（默认整点）、时长在 1 个时段到 `maxHours` 之间、不早于当前时段、落在自习室开放时间内且不跨本地日。时钟由 `CLOCK` 注入。
4. **参数由 M1 自管**：`settings` 表，键 `reservation.maxHours`、`reservation.slotMinutes`、`room.timezone`，管理员（`room_manager`、`admin`）通过 `PUT /api/m1/settings/:key` 修改；种子只在缺失时写默认值，不覆盖管理员的修改。
5. **权限用角色**：学生等任何登录用户可预约；修改参数需管理角色；细粒度权限等 platform 提供。
6. **取消语义**：只能取消自己的、尚未开始的预约；开始后的"提前结束"随签到（REQ-M1-05）实现，不算违约。
7. **一人一时段一座**：同一用户不能持有时段重叠的两个有效预约（409 `user-overlap`），呼应附件 1"减少占座"的目标。
8. 时间统一存 UTC；开放时间按 `room.timezone` 换算后比较。

## 备选方案

| 方案 | 为什么落选 |
|---|---|
| 不建 `reservations` 表，只用 `seat_statuses` | 签到、违约、历史复用都需要预约的生命周期与归属 |
| 应用层"先查后插"或加锁 | 有竞态窗口；多实例下应用锁无效；演示抢座必翻车 |
| 参数集中放 platform | M1 每次预约都要跨服务取参数，增加耦合与故障面 |
| 预约开始后也可取消 | 与未签到违约难以区分，影响 REQ-M1-06 的违约判定 |
| 允许一人同时多座 | 与提高周转率的目标相悖 |

## 后果

- M2/M3 的占用写回（X-1、X-2）以后同样受排他约束保护；若房间已有预约，block 必须先取消预约，否则插入失败。这是组会要定的决策 3 的技术背景。
- 合同新增 `ReservationDto`、`CreateReservationRequest`、`ReservationRule`、`SettingDto`，均为新增。
- 共享包 `nest-common` 的异常过滤器开始把异常对象里的额外字段（如 `rule`）放进 `error.details`，所有服务受益。

## 验证

- `reservation-rules.spec.ts`：整点、时长、过去、开放时间、跨日边界各有用例。
- `reservations.int-spec.ts`：创建写入 RESERVED 状态行；同座重叠 409；同人重叠 409；**10 个并发请求恰好 1 个 201、9 个 409**；取消释放座位；参数修改影响校验；学生改参数 403。
- 破坏实验：删除排他约束后并发用例必须失败（记录于 `docs/quality/mutation-log.md`）。
