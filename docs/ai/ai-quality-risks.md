# AI 生成代码的质量隐患与应对

任务书："能说明 AI 生成代码的质量隐患与应对方式。" 每条隐患对应一个在本仓库里真实存在的检测手段；没有检测手段的隐患不算已应对。

| # | 隐患 | 典型表现 | 检测 / 应对（本仓库） |
|---|---|---|---|
| 1 | 幻觉 API | 调用不存在的库方法、编造的字段名 | TypeScript strict + `pnpm typecheck`；前端对每个响应做 zod 校验（`api-client.ts`），字段不符当场报 `VALIDATION_FAILED` |
| 2 | 看起来完整但什么都没测的测试 | 断言常量、`expect(true)`、mock 掉被测逻辑 | 评审规则"指出哪一行改坏会红"；Stryker 变异测试（`quality/mutation-log.md`）；禁止 `--passWithNoTests` / `.skip` / `.only` |
| 3 | 过度 mock | 仓储、数据库全被 mock，集成从未真的跑过 | 每个服务有 `*.int-spec.ts` 对真实 PostgreSQL 跑；单元测试只允许 mock 仓储接口 |
| 4 | 静默吞错 | `catch {}`、返回空数组掩盖失败 | 统一异常过滤器只在 5xx 时记录并返回通用信息；code-review skill 的 Manual review 项；Biome 规则 |
| 5 | 为了过门禁而降门禁 | 调低覆盖率阈值、排除文件 | 阈值在共享配置里；包级排除必须附注释说明由哪个集成测试覆盖；评审时检查 `vitest.config.mts` diff |
| 6 | 硬编码密钥与本地路径 | 把 `.env` 内容写进代码、绝对路径 | `.gitignore` 排除 `.env*`；`authOptionsFromEnv` 缺密钥即启动失败；code-review 阻塞项 |
| 7 | 越权跨模块 | 直接 import 另一个 app 的代码、跨 schema 查询 | 每服务独立 Prisma schema 与客户端；contracts 之外无共享业务类型；评审阻塞项 |
| 8 | 危险的运维命令 | `migrate reset`、`DROP` 生产库 | 测试只操作 `*_test` schema；Prisma 自身对 agent 的危险操作拦截（本仓库真实触发过一次） |
| 9 | 过大的变更 | 一次提交几千行，无法评审 | MR ≤ 400 行；commit 前人工阅读；brief 超限先拆分 |
| 10 | 思维链泄漏到产物 | 注释里写"我先试了 A 然后改成 B"、提交信息里带工具对话 | `AGENTS.md › Prose`；commitlint 限制长度；评审删除 |
| 11 | 过时或不兼容的依赖用法 | 用旧版本 API 写新版本库 | 依赖版本由 pnpm catalog 统一；3 天发布冷却期避免刚发布的破坏性版本；CI 全量跑 |
| 12 | 自我报告失真 | "测试全部通过"但没跑 | MR Evidence 段必须贴命令与输出；CI 复跑 |

## 本仓库 bootstrap 期间的真实案例

见 [`collaboration.md`](collaboration.md) 第 6 节。这些案例会持续追加，供期末论文引用。
