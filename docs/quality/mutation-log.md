# 变异测试与破坏实验记录

> 任务书："测试必须确实验证了行为……验证手段：故意破坏实现，观察测试是否失败。" 本文件记录两类证据：Stryker 自动变异（`pnpm mutation`）和人工破坏实验。每次 Review 前追加一节。

## 2026-10-25 · base repo 基线

### Stryker（Vitest 4.1，Stryker 10.0，`inPlace: true`）

| 包 | 变异体 | 杀死 | 存活 | 得分 | 存活变异体说明 |
|---|---|---|---|---|---|
| `apps/m1-seat` | 50 | 49 | 1 | **98.0%** | `rooms.service.ts:28` 的 `"room not found"` 文案被改写后测试仍通过：测试只断言异常类型。可接受（文案不是契约），不补测。 |
| `packages/contracts` | 30 | 29 | 1 | **96.7%** | `envelope.ts` 中 `fail()` 的 `details === undefined` 分支的一个等价变异。其余 4 个文件只有 schema 声明，无可变异语句（n/a）。 |
| `packages/auth` | 109 | 98 | 9（+1 超时，+1 无覆盖） | **90.8%** | `decorators.ts` 无覆盖（装饰器工厂，由集成测试覆盖）；`jwt-auth.guard.ts` 5 个存活集中在错误信息字符串与 `bearerToken` 的空白处理；`auth-options.ts` 2 个是 `trim()` 相关。下一轮补 `bearerToken` 边界测试。 |

命令：`pnpm --filter <pkg> mutation`，HTML 报告在各包 `reports/mutation/index.html`（不入库）。

### 人工破坏实验

| # | 破坏 | 预期 | 结果 | 证据 |
|---|---|---|---|---|
| 1 | `apps/m1-seat/src/rooms/room-visibility.ts` 中 `canSeeRoom` 对院系房间的判断取反 | `room-visibility.spec.ts` 失败 | 失败 1 条：`allows the caller's own department room and denies another department's` | 单元测试输出（2026-10-25） |
| 2 | `apps/m1-seat/src/rooms/rooms.repository.ts` 中 `findSeats` 忽略 `hasPower` 过滤 | `rooms.int-spec.ts` 失败 | 失败 1 条：`lists active seats and applies hasPower`，`expected ['01','02'] to deeply equal ['01']` | 集成测试输出（2026-10-25） |

### 结论与待办

- 单元层的变异得分与"测试能失败"的要求一致；适配层（控制器、仓储）由集成测试与破坏实验 2 覆盖。
- 待办（TASK-060）：auth 包补 `bearerToken` 的空白与大小写边界测试；platform、m2、m3 在业务逻辑落地后纳入 `pnpm mutation`。
- 工具说明：Stryker 在 Vitest 5 下不能激活变异体（全部存活、每个变异体 0 个测试），已把 Vitest 固定在 4.x（`pnpm-workspace.yaml` catalog）。

## 2026-10-25 · TASK-017 座位平面图（MR 1）

| # | 破坏 | 预期 | 结果 |
|---|---|---|---|
| 3 | `apps/m1-seat/src/rooms/seat-power.ts` 中覆盖判定由 `<=` 改为 `<`（边界座位不再算覆盖） | 单元与集成测试都失败 | 单元 6 条失败（边界、range=1 相邻桌、推导与筛选），集成 2 条失败（`returns seats with positions, derived power`、`applies hasPower=true`）；恢复后 27 单元 + 9 集成全部通过 |
