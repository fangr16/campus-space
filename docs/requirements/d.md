# D 公共层 · 需求与验收标准

来源：任务书 §二（"基于 RBAC 身份与权限、空间与座位主数据、通知服务、操作审计"）。归属见 [ADR-0001](../adr/proposed/2026-10-25-public-layer-ownership.md)。

| ID | 子域 | 需求 | 验收标准（可测试） | 状态 | 实现 | 验证 |
|---|---|---|---|---|---|---|
| REQ-D1-01 | 身份与权限 | 用户名密码登录，签发 JWT | 正确凭据返回令牌与用户信息；错误凭据、禁用账号返回同一条 401 信息 | 已实现 | `apps/platform/src/auth/` | `auth.service.spec.ts`、`auth.int-spec.ts` |
| REQ-D1-02 | 身份与权限 | 所有服务默认拒绝、按角色放行 | 无令牌 401；过期/伪造令牌 401；角色不符 403；`@Public` 与 `@Internal` 例外 | 已实现 | `packages/auth` | `jwt-auth.guard.spec.ts`、`roles.guard.spec.ts` |
| REQ-D1-03 | 身份与权限 | 服务间调用使用内部令牌 | 带正确 `x-internal-token` 的请求可访问 `@Internal` 接口，且不被当作用户 | 已实现 | `packages/auth/src/jwt-auth.guard.ts` | `jwt-auth.guard.spec.ts › internal token` |
| REQ-D1-04 | 身份与权限 | 角色与细粒度权限可配置（支撑 REQ-M1-01/03） | 管理员维护角色-权限矩阵；服务可查询某用户是否拥有某权限 | 未开始（表已建） | `apps/platform/prisma/schema.prisma` | |
| REQ-D2-01 | 空间与座位主数据 | 自习室、座位、开放时间、插座标记的登记与注销 | 管理员 CRUD；注销后不再出现在列表 | 降级实现（只读接口 + 种子） | `apps/m1-seat/src/rooms/` | `rooms.int-spec.ts` |
| REQ-D2-02 | 空间与座位主数据 | 主数据以只读接口供 M2/M3 校验 `roomId` | `GET /api/m1/rooms/:id` 对内部令牌可用 | 未开始 | | |
| REQ-D3-01 | 通知服务 | 站内消息单渠道，模板化，幂等 | 同一事件重复投递只产生一条消息；用户可读未读 | 未开始 | `apps/platform/src/notifications/`（待建） | |
| REQ-D3-02 | 通知服务 | 三个模块的提醒都通过 D-3（X-4） | M1 提醒、M2 审批结果、M3 派单/升级均可在消息中心看到 | 未开始 | | |
| REQ-D4-01 | 操作审计 | 记录谁/何时/对什么/做了什么/结果 | 每条跨模块写回与审批、派单操作有审计行 | 未开始 | `apps/platform/src/audit/`（待建） | |
| REQ-D4-02 | 操作审计 | 可按对象追溯（X-5） | 按座位或工单 id 查到相关操作序列 | 未开始 | | |

## 细化记录

| 日期 | 工具 | 内容 | 结论 |
|---|---|---|---|
| 2026-10-25 | Claude Code（组长） | D-1 落地为共享库 + platform 登录；D-2 归 m1；D-3/D-4 留在 platform 待建 | 采纳（待 ADR-0001 组会确认） |
