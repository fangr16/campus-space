# campus-space · 校园资源服务平台

复旦大学《软件过程管理与工程伦理》2026 秋季课程实践项目。以自习座位预约为核心，向整教室申请与物业报修两端延伸。

本项目**要求使用 AI 编程助手开发**，考核重点是"能否有条理地使用智能代理开发出一个可交付的系统"。因此这个仓库同时承载两件事：业务系统本身，以及让人与 agent 协作有据可查的过程规范。

## 模块

| 目录 | 模块 | 职责 |
|---|---|---|
| `apps/platform` | D 公共层 | 登录、用户与角色（RBAC）、通知、操作审计 |
| `apps/m1-seat` | M1 自习座位预约 | 自习室与座位主数据（D-2）、搜索、预约、签到、违约 |
| `apps/m2-room` | M2 整教室预约与审批 | 申请、多级审批、超时撤销、向 M1 写回占用 |
| `apps/m3-repair` | M3 物业报修工单 | 上报、派单、维修、验收、向 M1 写回下架/恢复 |
| `apps/web` | 前端 | 学生端与管理端 Web 应用 |
| `packages/contracts` | 契约 | 跨模块 DTO、事件、`SeatStatusSource` 枚举 |
| `packages/auth` | D-1 | JWT 校验、角色守卫、内部服务令牌 |

## 快速开始

```bash
corepack enable && pnpm install
cp .env.example .env
pnpm db:up          # 启动 PostgreSQL（Docker）
pnpm db:migrate     # 各服务 Prisma 迁移
pnpm db:seed        # 幂等种子数据
pnpm dev            # 启动全部服务与前端
```

前端 http://localhost:5173 ，种子账号见 `docs/ops/environments.md`。

## 质量门禁

```bash
pnpm verify             # biome + typecheck + 文档门禁
pnpm test               # 单元测试，80% 行/分支覆盖
pnpm test:integration   # 真实 PostgreSQL 集成测试
pnpm e2e                # Playwright 冒烟
pnpm mutation           # Stryker 变异测试
```

## 文档

- 给 agent 读：[`AGENTS.md`](AGENTS.md)（英文，唯一规则源）与 [`.agents/skills/`](.agents/skills/)
- 给人读：[`docs/README.md`](docs/README.md)（中文索引：需求基线、决策记录、运维手册、伦理记录）
- 参与开发：[`CONTRIBUTING.md`](CONTRIBUTING.md)

## 许可

MIT，见 [LICENSE](LICENSE)。
