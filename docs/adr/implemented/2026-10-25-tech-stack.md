# ADR-0002: 技术栈选择全 TypeScript

Status: implemented
Date: 2026-10-25
Related: 任务书 §一"技术栈自选，建议选择企业级的方案"；[ADR-0003](2026-10-25-service-topology.md)

## 问题

任务书不提供脚手架，要求企业级方案。团队 5 人，必须用 AI 编程助手开发，组员使用的工具不同（Codex / Qoder / Trae / Cursor / Claude Code）。需要一套 agent 熟悉、单语言、便于共享类型与契约的技术栈。

## 决定

| 层 | 选择 |
|---|---|
| 语言 | TypeScript（strict） |
| 后端 | NestJS 12 + Prisma 6 + PostgreSQL 16 |
| 前端 | React 19 + Vite + TypeScript + Ant Design 6 + TanStack Query + React Router |
| 仓库 | pnpm 11 workspace + Turborepo |
| 代码质量 | Biome（格式化 + lint）、commitlint、lefthook |
| 测试 | Vitest（单元/集成，含覆盖率门禁）、Playwright（e2e）、Stryker（变异测试） |
| 运行 | Docker / Docker Compose、Nginx 作为入口 |

## 备选方案

| 方案 | 优点 | 为什么落选 |
|---|---|---|
| Spring Boot 3 + Vue 3 | 校园项目最常见的"企业级"组合，Flyway 成熟 | 前后端两种语言，契约无法用类型共享；Lab1 分析对象 deepseek-harness 是 TS 生态，组内对 TS 工具链更熟 |
| Go + Vue 3 | 部署轻、单二进制 | 组内 Go 经验少，AI 生成的 Go 代码评审成本高 |
| 全 TS 但用 Prisma 8 / Drizzle | 更新 | Prisma 8 当时为 rc，配置方式与 6.x 不同；6.x 是 agent 训练语料中最常见的形态，幻觉风险低 |
| ESLint + Prettier 代替 Biome | agent 更熟 | 两套配置、钩子慢；Biome 一个依赖解决格式化与 lint，足够学生项目 |

## 后果

- 所有服务与前端共享 `packages/contracts`，接口变更在编译期暴露。
- NestJS 默认测试框架是 Jest，本仓库统一用 Vitest（需 `unplugin-swc` 支持装饰器元数据），组员不要再引入 Jest。
- Prisma 每服务一个 schema 文件、一套迁移，见 ADR-0003。

## 验证

- `pnpm verify && pnpm test` 在干净 checkout 上通过。
- `apps/m1-seat` 的示例切片从迁移到页面全部用上述栈完成。
