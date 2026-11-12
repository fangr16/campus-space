# ADR-0010: 时间优先的预约交互与按时段计算的座位状态

Status: implemented
Date: 2026-11-05
Related: REQ-M1-11、REQ-M1-04、REQ-M1-07、REQ-M1-09、REQ-M1-10、REQ-X-03；TASK-019；[ADR-0007](2026-10-25-seat-layout-model.md)、[ADR-0009](2026-11-05-reservation-model.md)

## 问题

TASK-010 的第一版前端是"先点座位，再在弹窗里选日期、开始、时长"。组长验收后指出：看不出所选时段哪些座位空着，平面图上所有座位一个样；一次预约要点五次，弹窗挡住平面图；手机上顶部导航竖排占满一屏、平面图缩到座位号不可读；"我的预约"把已取消的历史和有效预约混在一张表里；自习室列表看不到空位数。需要重新设计交互，并决定"座位在某时段是否可约"由谁计算。

## 决定

1. **时间优先**：学生先选日期和开始时间（`?date=&start=` 放在 URL，自习室列表与平面图共用），平面图按该时间的状态上色：空闲 / 我的 / 已被预约 / 不可用。时长在点中座位之后、在选择卡里选，因为能选多长取决于那个座位从开始时间起空到几点。
2. **状态由服务端按时段计算**：`GET /rooms/:id/seats?from&to` 为每个座位返回 `availability {state, source?, refId?, until?, freeUntil?}`；`GET /rooms?from&to` 为每间自习室返回 `freeSeatCount`。规则是纯函数 `seat-availability.ts`：在 `from` 时刻已生效的状态行决定 `state`（MINE > BLOCKED > RESERVED），没有则 FREE，并把窗口内最早的后续状态开始时刻作为 `freeUntil`。`source` 直接暴露 X-3 的来源，前端据此显示"整教室预约占用 / 维修中"。
3. **前端询问的窗口**：平面图问 `[start, start + maxHours)`，这样一次请求就能算出每个座位可选的时长；自习室列表问 `[start, start + 1 个时段)`，空位数的含义是"那一个时段起至少空一个时段"。
4. **选择卡代替弹窗**：桌面端在平面图右侧，手机端贴底；只有空闲座位和本人座位可点，前者给"确认预约"，后者给"取消预约"。服务端规则错误仍按 `details.rule` 翻译成中文。
5. **手机端**：顶部导航折成两行（品牌 + 会话、横向滚动的模块 chip）；平面图最小单位宽 32px，座位不小于 44px，容器横向滚动并提供 +/−/适应 缩放；另有"列表"视图（按状态分组，空闲在前）作为小屏与无障碍替代，`?view=list` 入 URL。
6. **我的预约**分"即将开始"（卡片 + 取消）与折叠的"历史记录"（最近 20 条），在前端按 `status` 与 `to` 分组，不改接口。

## 备选方案

| 方案 | 为什么落选 |
|---|---|
| 保留"先座位后时间"，只改样式 | 核心问题是用户看不到"这个时段哪些座位能约"，样式解决不了 |
| 时段条里一起选时长，平面图按整段时长上色 | 组长否决（2026-11-05）：时长应在选了座位之后选；且按整段上色会把"后一小时才被占"的座位也标成不可用，白白少掉可约的座位 |
| 前端拉取全部状态行自己算 | 一间房一天的状态行可能上百条，而且 MINE 需要知道哪些预约是本人的，服务端一次算完更简单也更安全 |
| 再加一个 `GET /rooms/:id/availability` 接口 | 契约新增两个字段即可向后兼容，少一个接口少一份文档与测试 |
| 手机端用 Drawer 弹层 | 贴底卡片不遮住平面图上方的时段条和筛选，少一次关闭操作 |
| 手机端只做列表、不做可缩放平面图 | 组长要求两者都要（2026-11-05） |

## 后果

- 契约新增（兼容）：`SeatAvailability`、`SeatDto.availability?`、`RoomDto.freeSeatCount?`、`RoomSeatsResponse.window?`，`RoomQuery`/`SeatQuery` 增加 `from/to`（成对、`to > from`）。属契约变更，需两名评审。
- M2/M3 以后写入的 BLOCKED 状态行会自动在平面图上以来源显示，不需要前端再改。
- `ReserveDialog.tsx` 删除；`reservation.model.ts` 的日期/时间/时长选项函数继续被时段条和选择卡复用。
- 本次合成一个 MR（组长决定），非测试代码约 1 300 行，超过 ADR-0006 的 400 行上限，原因与行数记录在 MR 描述。
- `freeSeatCount` 的语义是"开始时段空闲"，不是"能约满 maxHours"；列表页文案写成"xx:xx 起空闲 n / 总数"。

## 验证

- `seat-availability.spec.ts`：FREE / FREE+freeUntil / RESERVED / MINE / BLOCKED、优先级、"晚些才开始的状态不算"；`rooms.service.spec.ts`：带窗口附加状态并回显，不带窗口不查状态；`rooms.int-spec.ts`：四种状态各一个座位、他人视角为 RESERVED、`freeSeatCount`、半窗口与倒置窗口 400。
- 前端 `time-window.model.spec.ts`（URL 读写、默认值、夹到开放时间、`allowedSlots` 受 `freeUntil` 与关门限制）、`seat-map.model.spec.ts`（状态文案、按钮名、分组、缩放）、`my-reservations.model.spec.ts`（分组、倒计时文案）。
- e2e `reservations.spec.ts`（选明天 → 空闲 40/40 → 点座位 → 确认 → 变 MINE、横幅、39/40 → 我的预约取消；同人重叠提示 + 从平面图取消）；`mobile.spec.ts`（Pixel 7：导航可见无横向溢出、座位 ≥ 44px 且容器可滚动、列表模式预约与取消）。
- 破坏实验 5（`docs/quality/mutation-log.md`）：把"在 from 时刻已生效"的判断改成 `>=`，单元 6 条、集成 2 条失败。
