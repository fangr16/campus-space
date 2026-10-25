# ADR-0003: 服务形态为每模块一个服务，共享一个数据库实例

Status: implemented
Date: 2026-10-25
Related: 任务书 §二"跨模块集成"、§七第 5 项演示"模块 A 通过网络调用模块 B"；[ADR-0001](../proposed/2026-10-25-public-layer-ownership.md)

## 问题

任务书要求期末现场演示"模块 A 通过网络调用模块 B，展示状态写回效果"，要求 M1 的座位状态记录写入来源，并要求公共层归属与故障责任可说明。同时组内只有 2 台 ECS，运维能力有限。

## 决定

```
apps/
  web/          React 前端
  platform/     D：登录/用户/角色、通知、审计
  m1-seat/      M1 + D-2 自习室/座位主数据
  m2-room/      M2
  m3-repair/    M3
packages/
  contracts/    DTO、事件、SeatStatusSource 枚举、错误信封
  auth/         JWT 校验、角色守卫、内部服务令牌守卫
  nest-common/  /health、/version、统一响应与异常过滤器
```

- 每个 app 是独立的 NestJS 进程与 Docker 镜像，独立 Prisma schema 与迁移。
- 一个 PostgreSQL 实例，每服务一个 schema（`platform` / `m1` / `m2` / `m3`），禁止跨 schema 查询。
- 跨模块调用走 HTTP，请求头携带内部服务令牌（`X-Internal-Token`），契约在 `packages/contracts`。
- Nginx 按前缀路由：`/api/platform`、`/api/m1`、`/api/m2`、`/api/m3`、`/` → web。

## 备选方案

| 方案 | 优点 | 为什么落选 |
|---|---|---|
| 单体 NestJS，M1/M2/M3/D 作为 Nest Module | 部署最简单 | "网络调用"演示要自己调自己，牵强；模块边界靠纪律维持，公共层故障责任说不清 |
| 三服务，D 全部做成共享库，不单独部署 | 少一个部署单元 | 通知与审计数据会分散在三个 schema，追溯链路要跨库拼；审计表应有唯一写入点 |
| 每服务一个独立数据库实例 | 隔离最彻底 | 2 台 ECS 资源有限，4 个 PG 实例运维负担不值 |

## 后果

- 5 个镜像、一次 compose 部署覆盖全部模块，满足"一次部署覆盖本组交付的所有模块"。
- 需要内部服务令牌与契约治理，见 `packages/auth` 与 `packages/contracts`。
- 迁移在各服务容器启动前由 `deploy/scripts/migrate.sh` 顺序执行，流水线中自动跑。

## 验证

- `docker compose -f deploy/docker-compose.yml up --build` 后，5 个 `/version` 端点可访问。
- 第二次 Review 时 X-1（M3→M1）与 X-2（M2→M1）通过 HTTP 写回并在 `SeatStatus.source` 留痕。
