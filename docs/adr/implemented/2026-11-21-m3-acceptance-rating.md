# ADR-0014: M3 验收评分与返工原因的记录方式

Status: implemented
Date: 2026-11-21
Related: TASK-035、REQ-M3-05、[ADR-0012](2026-11-12-m3-progress-actions.md)

## 问题

REQ-M3-05 要求上报人验收 `DONE` 工单：通过时给出 1～5 分评分并进入 `ACCEPTED`，不通过时
说明原因并进入 `REWORK`。评分与原因都要在事件历史中可追溯，且不能被非上报人或非法状态
的调用写入。

## 决定

- 评分存为 `repair_tickets.rating`（可空整数，仅 `ACCEPTED` 工单有值，取值 1～5 由
  `AcceptTicketRequestSchema` 约束）。验收接口在事务内校验上报人身份与状态迁移，条件更新
  工单状态与评分，并追加一条 `note = "评分：<n>"` 的 `ACCEPTED` 事件。
- 返工原因写入 `ticket_events.note`，不新增列：`REWORK` 事件天生带原因，事件历史即验收记录。
- 两个接口都不加角色注解，任何登录用户可访问，但仓储层强制 `reporterId === actorId`，
  否则 403；非 `DONE` 状态返回 409。重复验收因状态机终态自然被拒绝。
- 返工后按既有状态机 `REWORK → IN_PROGRESS → DONE → ACCEPTED` 重新流转，验收接口不绕过状态机。

## 备选方案

- 新建 `ticket_reviews` 表存评分与原因：结构更正规，但一张工单只有一个评分一个原因，
  多出一张表和关联迁移成本，收益不足。
- 把评分写进事件 `note` 文本：省一列，但丢失数值类型与 1～5 的契约校验，统计需解析文本。
- 允许管理员代上报人验收：方便运营，但违反“仅上报人可验收”的验收标准，且责任主体不清。

## 后果

- 新增迁移与 schema 列，属 schema 变更，需两名人工评审；`generated/prisma` 不提交。
- 契约新增 `AcceptTicketRequest`、`RejectTicketRequest` 与 DTO 的 `rating` 字段，需两名评审人。
- 事件 `note` 字段被复用为评分与原因的载体，前端展示需同时处理两种语义。
- 前端替换 M3 占位页由同一任务的前端变更交付，含上报表单、工单列表、事件历史与验收/返工操作。

## 验证

- `tickets.int-spec.ts`：上报人以外的 403、非 `DONE` 的 409、评分落库与事件文案、返工原因写入事件、
  返工后重新维修并再次验收、评分与原因的非法输入 400。
- `tickets.service.spec.ts`：上报人、评分与原因向仓储层的转发。
- `m3.spec.ts`（contracts）：评分边界 0/6/小数拒绝、原因 trim 与空白拒绝。
- 变异结果见 `docs/quality/mutation-log.md`。
