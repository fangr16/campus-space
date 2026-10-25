# 任务分解

> 每个任务指向至少一条需求；没有编号的工作不开始。状态：`待领` / `进行中` / `评审中` / `完成`。看板可以用 CodeArts 工作项，但本文件是真相源，每周一站会同步。
>
> 编号段：000–009 启动；010–019 M1；020–029 M2；030–039 M3；040–049 平台与 D；050–059 流水线与运维；060–069 质量；070–079 文档与评审。

| ID | 任务 | 需求 | 负责人 | 依赖 | 状态 |
|---|---|---|---|---|---|
| TASK-001 | 在 CodeArts 建项目与仓库，推送 base repo，开启 `main` 保护与 MR 门禁 | — | 组长 | — | 待领 |
| TASK-002 | 组会确认 ADR-0001 公共层归属，补齐会议记录后移入 `implemented/` | — | 全员 | — | 待领 |
| TASK-003 | 填写 `docs/team.md` 姓名、评审节点日期 | — | 组长 | — | 待领 |
| TASK-004 | 华为云：2 台 ECS、SWR 组织、代金券 | — | 平台 | — | 待领 |
| TASK-005 | 每位组员本机跑通 `pnpm install && pnpm verify && pnpm test && pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm dev` | — | 全员 | — | 待领 |
| TASK-010 | M1 预约：创建/取消，整点、≤ 4h 参数化、开放时间与冲突校验 | REQ-M1-04 | 模块组 1 | TASK-005 | 待领 |
| TASK-011 | M1 签到：每日动态编码与 Web 录入 | REQ-M1-05 | 模块组 1 | TASK-010 | 待领 |
| TASK-012 | M1 提醒与违约定时任务（可注入时钟） | REQ-M1-06、REQ-D3-01 | 模块组 1 | TASK-010、TASK-042 | 待领 |
| TASK-013 | M1 历史与再次预约 | REQ-M1-07 | 模块组 1 | TASK-010 | 待领 |
| TASK-014 | M1 主数据管理端（自习室/座位 CRUD） | REQ-M1-02、REQ-D2-01 | 模块组 1 | TASK-040 | 待领 |
| TASK-015 | M1 内部接口：block / release（幂等） | REQ-X-01、REQ-X-02、REQ-X-03 | 模块组 1 | TASK-010 | 待领 |
| TASK-020 | M2 AI 需求细化会话并更新 `requirements/m2.md` | REQ-M2-* | 模块组 2 | — | 待领 |
| TASK-021 | M2 申请提交与权限门槛 | REQ-M2-01、02 | 模块组 2 | TASK-020 | 待领 |
| TASK-022 | M2 多级审批接口与审批记录 | REQ-M2-03 | 模块组 2 | TASK-021 | 待领 |
| TASK-023 | M2 超时撤销定时任务 | REQ-M2-04 | 模块组 2 | TASK-022 | 待领 |
| TASK-024 | M2 → M1 写回（调用 TASK-015） | REQ-X-02 | 模块组 2 | TASK-015、TASK-022 | 待领 |
| TASK-025 | M2 前端 | REQ-M2-02、05 | 模块组 2 | TASK-021 | 待领 |
| TASK-030 | M3 AI 需求细化会话并更新 `requirements/m3.md` | REQ-M3-* | 模块组 3 | — | 待领 |
| TASK-031 | M3 上报与派单 | REQ-M3-01、02 | 模块组 3 | TASK-030 | 待领 |
| TASK-032 | M3 状态流转接口与事件表 | REQ-M3-03 | 模块组 3 | TASK-031 | 待领 |
| TASK-033 | M3 SLA 升级定时任务 | REQ-M3-04 | 模块组 3 | TASK-032 | 待领 |
| TASK-034 | M3 → M1 写回（调用 TASK-015） | REQ-X-01 | 模块组 3 | TASK-015、TASK-032 | 待领 |
| TASK-035 | M3 验收与评价、前端 | REQ-M3-05 | 模块组 3 | TASK-032 | 待领 |
| TASK-040 | platform 角色与权限管理接口 | REQ-D1-04、REQ-M1-01、03 | 模块组 2 | — | 待领 |
| TASK-041 | platform 审计模块与内部写入接口 | REQ-D4-01、02 | 模块组 3 | — | 待领 |
| TASK-042 | platform 通知模块（站内消息） | REQ-D3-01、02 | 平台 | — | 待领 |
| TASK-050 | CodeArts Build 任务绑定 `build.yml`，测试环境自动部署 | — | 平台 | TASK-001、004 | 待领 |
| TASK-051 | 生产环境人工审核 + tag + 回滚演练 | — | 平台 | TASK-050 | 待领 |
| TASK-052 | 部署窗口与流水线并发锁 | — | 平台 | TASK-050 | 待领 |
| TASK-043 | platform 登录限流（@nestjs/throttler）与失败日志，替代仅靠 nginx `limit_req` | REQ-D1-01 | 模块组 2 | — | 待领 |
| TASK-044 | 令牌吊销 / 缩短有效期：用户被禁用或角色变更后立即失效（tokenVersion 或刷新流程） | REQ-D1-02 | 模块组 2 | — | 待领 |
| TASK-053 | 每个服务使用独立的数据库角色，仅授权自己的 schema | — | 平台 | TASK-050 | 待领 |
| TASK-017 | 座位平面图数据模型与接口：坐标、插座实体、推导电源、契约、ADR-0007 | REQ-M1-10、REQ-M1-09 | 组长 | — | 评审中 |
| TASK-018 | 座位平面图前端：SVG 平面图、插座覆盖圈、覆盖座位高亮、e2e | REQ-M1-10 | 模块组 1 | TASK-017 | 待领 |
| TASK-016 | M1 自习室列表分页 | REQ-M1-07 | 模块组 1 | — | 待领 |
| TASK-045 | 前端令牌改为 httpOnly Cookie，去掉 localStorage | REQ-D1-02 | 平台 | TASK-044 | 待领 |
| TASK-060 | 每次 Review 前跑 Stryker 并更新 `mutation-log.md` | — | 质量 | — | 待领 |
| TASK-061 | 空库一键重放演练并记录 | — | 质量 | TASK-050 | 待领 |
| TASK-070 | 第一次 Review 材料 | — | 组长 | — | 待领 |
