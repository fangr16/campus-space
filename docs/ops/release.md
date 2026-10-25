# 发布与回滚

> 任务书："部署版本有可追溯的标记（tag）；能从部署回溯到对应提交，并说明每次发布包含哪些变更。" "生产环境需人工审批后发布；应可回滚；能说明当前运行的是哪个版本。"

## 版本标识

- 测试环境：每次合并到 `main` 自动部署，`IMAGE_TAG = git 短 sha`。
- 生产环境：组长打 tag `v0.<迭代>.<修订>`（如 `v0.1.0`），流水线以该 tag 构建并在人工审核后部署，`IMAGE_TAG = tag`。
- 运行中的版本：每个服务 `GET /api/<svc>/version` 返回 `{ sha, tag, buildTime, startedAt }`，前端页脚实时显示；主机上 `/opt/campus-space/releases.log` 记录每次 `deploy.sh` 的结果。

## 发布步骤（生产）

1. 确认测试环境该 sha 的 e2e 通过，`not-done.md` 与 `baseline.md` 已更新。
2. 在 `main` 上打 tag 并推送：`git tag -a v0.1.0 -m "..." && git push origin v0.1.0`。
3. 在本文件下方追加一行发布记录（包含哪些 MR / REQ）。
4. 流水线到"生产发布人工审核"节点，组长或平台负责人审核通过。
5. `deploy.sh v0.1.0` 完成后 `smoke.sh` 校验四个服务的 `tag == v0.1.0`。
6. 群里通知，附页脚截图。

## 回滚

```bash
ssh <prod-ecs>
cd /opt/campus-space && bash scripts/rollback.sh          # 回到 releases.log 中上一个成功版本
bash scripts/rollback.sh v0.0.9                            # 或指定 tag
```

回滚只换镜像，不回退 schema（`prisma migrate deploy` 只向前）。因此每次迁移必须与上一发布的代码兼容（expand/contract，见 `deploy-window.md`）。含破坏性 schema 变更的发布要在记录里标注"不可回滚到 vX 之前"。

## 发布记录

| 日期 | 环境 | 版本 | 包含 | 迁移 | 操作人 / 审核人 | 结果 |
|---|---|---|---|---|---|---|
| 2026-10-25 | 本机 | base repo（12 commits） | 仓库骨架、M1 只读切片、登录 | `platform` / `m1` / `m2` / `m3` 各 `init` | 组长 | 本机 e2e 通过 |
