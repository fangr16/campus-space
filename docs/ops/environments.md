# 环境

## 拓扑

```
                 测试 ECS (:8080)                          生产 ECS (:8080)
Internet ──► nginx(web 镜像) ─┬─ platform :3000     同构部署，只有 .env 与 IMAGE_TAG 不同
                              ├─ m1-seat  :3000
                              ├─ m2-room  :3000
                              ├─ m3-repair:3000
                              └─ PostgreSQL 16（schema: platform / m1 / m2 / m3）
开发环境 = 本机 docker compose 起 PostgreSQL + 本机进程跑服务与 Vite
```

| 环境 | 入口 | 数据库 | 部署方式 | 谁能发 |
|---|---|---|---|---|
| 开发（本机） | http://localhost:5180 | Docker `campus-space-db-1`，宿主端口 55432 | `pnpm dev` | 每人 |
| 测试 ECS | http://<test-ip>:8080 | 容器内 `db` | 合并到 `main` 后流水线自动 `deploy.sh <sha>` | 流水线 |
| 生产 ECS | http://<prod-ip>:8080 | 容器内 `db` | 人工审核后流水线 `deploy.sh <tag>` | 组长 / 平台负责人审核 |

对外只用 IP + 非 80/443 端口，避免域名备案。

## 本机开发

```bash
corepack enable && pnpm install
cp .env.example .env          # 端口与密钥都是开发用值
pnpm db:up                    # PostgreSQL 16，宿主端口 55432（5432/5433 常被本机已装的 PG 占用）
pnpm db:migrate && pnpm db:seed
pnpm dev                      # 四个服务 + Vite(5180)
```

单独跑：`pnpm --filter @campus/m1-seat dev`。Swagger：`http://localhost:3011/api/m1/docs`（非 production 下开启）。

### 演示账号（种子，仅开发/测试环境；生产 `SEED_DEMO_USERS=false`）

| 用户名 | 密码 | 角色 | 院系 |
|---|---|---|---|
| admin | Campus@2026 | admin | — |
| student | Campus@2026 | student | CS |
| manager | Campus@2026 | room_manager, approver | CS |
| maintainer | Campus@2026 | maintainer | — |

演示账号是**可选项**：只有 `SEED_DEMO_USERS=true` 才创建（`.env.example` 默认开启，部署模板默认关闭）；生产环境开启时还必须设置 `SEED_DEMO_PASSWORD`，否则种子脚本拒绝运行。密码由 `SEED_DEMO_PASSWORD` 覆盖。

### 端口

| 用途 | 端口 | 变量 |
|---|---|---|
| platform / m1 / m2 / m3 | 3001 / 3011 / 3012 / 3013 | `PLATFORM_PORT` 等 |
| web (Vite) | 5180 | `WEB_PORT` |
| PostgreSQL（宿主映射） | 55432 | `POSTGRES_PORT` |
| compose 全栈（nginx） | 8080 | `HTTP_PORT` |

### 已知的本机问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `P1000: Authentication failed` | 5432/5433 上是本机原生 PostgreSQL，不是 Docker 的 | 用 55432（已是默认） |
| Vite 报端口占用 | 本机其它项目占用 | 改 `.env` 的 `WEB_PORT`，并同步 e2e 的 `E2E_BASE_URL` |
| `prisma generate` 偶发失败（并行） | 多服务同时生成时的文件锁 | 重跑；CI 里 `turbo` 会重试一次 |
| 浏览器报 contracts 没有导出 | 工作区包是 CommonJS 产物 | 已在 `vite.config.ts` 用 `optimizeDeps.include` 预打包 |

## 环境变量

以 `.env.example` 为准。生产必须替换：`POSTGRES_PASSWORD`、`JWT_SECRET`、`INTERNAL_SERVICE_TOKEN`（`openssl rand -hex 32`）。`GIT_SHA`、`GIT_TAG`、`BUILD_TIME` 由镜像构建写入，不手填。
