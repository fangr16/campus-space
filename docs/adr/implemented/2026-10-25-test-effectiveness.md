# ADR-0005: 测试有效性门禁为 80% 覆盖率加变异测试

Status: implemented
Date: 2026-10-25
Related: 任务书 §三"测试必须确实验证了行为……验证手段：故意破坏实现，观察测试是否失败"；Lab1 分析报告问题 5

## 问题

AI 容易生成"看起来完整但什么都没测"的测试：断言常量、覆盖空分支、mock 掉被测逻辑本身。Lab1 分析的 deepseek-harness 用每文件 100% 覆盖率作为门禁，团队自己也承认这会催生无断言测试，变异测试一直停留在提议阶段。

## 决定

1. CI 门禁：每个包行覆盖与分支覆盖 ≥ 80%（Vitest `coverage.thresholds`），低于即失败。禁止 `--passWithNoTests`、`.skip`、`.only`。
2. 变异测试：Stryker（`@stryker-mutator/vitest-runner`）对 `apps/*/src/**/*.service.ts` 与 `packages/auth`、`packages/contracts` 运行，每次 Review 前至少跑一次，变异得分与存活变异体摘录到 `docs/quality/mutation-log.md`。
3. 评审要求：每条新测试，评审人能指出"实现中哪一行改坏后它会失败"，指不出即阻塞。
4. 集成测试用真实 PostgreSQL（compose 启动），不 mock 被测仓储。

## 备选方案

| 方案 | 优点 | 为什么落选 |
|---|---|---|
| 每文件 100% 覆盖 | 门禁最严 | 覆盖率衡量"跑到了"而不是"验证了"，高压下 agent 会写无断言测试；5 人组负担过重 |
| 80% 覆盖 + 纯人工破坏实验 | 工具链最简单 | 证据靠自觉，容易在赶进度时省略；Stryker 把"故意破坏实现"自动化并留下可复现报告 |
| 不设覆盖率门禁，只做变异测试 | 直指本质 | 变异测试慢，不适合每次 MR 跑；需要覆盖率作为快速前置门禁 |

## 后果

- 变异测试耗时，放在定期任务而非每个 MR；`mutation-log.md` 是任务书要求的破坏实验证据。
- 需要 `packages/testing` 提供测试数据库工具，避免各组重复造轮子。

## 验证

- 把 `apps/m1-seat` 中插座筛选逻辑反转后 `pnpm --filter m1-seat test` 失败（首条破坏实验记录）。
- `pnpm mutation` 产出报告，首次得分记录在 `docs/quality/mutation-log.md`。
