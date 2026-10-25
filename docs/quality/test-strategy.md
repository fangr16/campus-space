# 测试策略

依据 [ADR-0005](../adr/implemented/2026-10-25-test-effectiveness.md)。目标不是覆盖率数字，而是"实现改坏时测试会红"。

## 分层

| 层 | 文件模式 | 跑在哪里 | 测什么 | 不测什么 |
|---|---|---|---|---|
| 单元 | `src/**/*.spec.ts` | `pnpm test`，lefthook pre-push，CI | 纯函数（状态机、可见性、时间规则）、service（仓储以接口 mock）、契约 schema、守卫 | 控制器、仓储、Prisma 服务、bootstrap |
| 集成 | `src/**/*.int-spec.ts` | `pnpm test:integration`，CI | 整个 Nest 应用 + 真实 PostgreSQL（`<svc>_test` schema，每次 drop 后用 `prisma migrate deploy` 重放） | 其它服务（跨模块用内部令牌模拟调用方） |
| 端到端 | `e2e/tests/*.spec.ts` | `pnpm e2e`，CI（部署测试环境后） | 浏览器里的关键路径：登录、自习室、座位筛选、占位页、版本页脚、退出 | 细节样式 |
| 变异 | `stryker.config.mjs` | `pnpm mutation`，每次 Review 前 | 单元层能否杀死变异体 | 适配层 |
| 契约 | contracts 的 spec + 前端 zod 校验 | 单元 / 运行时 | 字段、枚举、强制转换 | — |

## 门禁

- 覆盖率：每个包行与分支 ≥ 80%（`vitest.shared.mjs`）。包级只允许排除**有集成测试覆盖的适配层**（控制器、仓储、Prisma 服务、bootstrap、`.tsx`），且必须在配置里写明理由。
- 禁止：`--passWithNoTests`、`.skip`、`.only`、调低阈值。
- 评审：对每条新测试问"实现中哪一行改坏后它会失败"，答不上来即阻塞（`.agents/skills/code-review`）。

## 测试数据

- 单元测试自己构造数据，不依赖种子。
- 集成测试在 `beforeAll` 里用 Prisma 直接插入所需行；每个服务独立 `<svc>_test` schema，`fileParallelism: false`。
- e2e 依赖种子（`pnpm db:seed`）：账号 `student / Campus@2026`、房间 `LIB-301`（40 座，10 座带插座）。改种子要同步改 e2e 断言。

## 定时任务与时间

状态机与超时判断全部是接收 `now: Date` 的纯函数（`shouldExpire`、`isOverdue`、`isWithinOpeningHours`），定时任务只负责调用。实现 REQ-M1-06、REQ-M2-04、REQ-M3-04 时沿用这一模式，不在测试里 `sleep`。

## 工具版本说明

Vitest 固定在 4.x：Stryker 10 的 vitest-runner 在 Vitest 5 下无法激活变异体（2026-10-25 实测所有变异体"存活"且每个变异体跑 0 个测试），降到 4.1 后得到真实结果。升级前先跑 `pnpm mutation` 确认。
