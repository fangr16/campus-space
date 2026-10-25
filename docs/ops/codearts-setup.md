# CodeArts 接入步骤

> 依据 [ADR-0004](../adr/implemented/2026-10-25-hosting-and-pipeline.md)。控制台操作无法脚本化，这里逐步记录；每一步完成后在本文件勾选并把截图放到 `docs/ops/evidence/`（作为"基础设施脚本化"之外部分的证据）。页面名称以 2026-10 的华为云控制台为准，变动时更新。

## 0. 前置

- [ ] 学生认证、加入课程班级、领取代金券（见课程申领文档）。
- [ ] 2 台 ECS（Ubuntu 22.04+，2C4G 起），安全组放行 22、8080。
- [ ] SWR 创建组织（如 `campus-space`），记下 `swr.<region>.myhuaweicloud.com/<org>` 与临时登录指令。

## 1. 代码仓（CodeArts Repo）

1. 新建项目（Scrum 或 IPD 均可）→ 代码托管 → 新建仓库 `campus-space`（空仓库，不要初始化 README）。
2. 本机推送：
   ```bash
   git remote add origin <codearts-repo-url>
   git push -u origin main
   ```
3. **分支保护**：仓库 → 设置 → 保护分支 → 新建，分支 `main`，关闭所有角色的"推送"权限，仅允许"合并"。
4. **合并请求策略**：设置 → 策略设置 → 合并请求 → 设置分支策略 → 新建：
   - 分支 `main`
   - 勾选 **开启流水线门禁**（流水线失败不能合入）
   - 勾选 **评审问题全部解决才能合入**
   - 最少评审/检视人数：1（schema / contracts / 跨模块变更由评审人自行再拉一人，见 CONTRIBUTING）
   - 禁止合并人与作者相同
5. MR 模板：设置 → 合并请求模板（若有），粘贴 `docs/ai/mr-template.md` 中的代码块。
6. 每位组员：个人设置里绑定 SSH key；仓库成员角色设为"开发者"（不能直推 `main`）。

- [ ] 1–6 完成，截图：分支策略页。

## 2. 编译构建（CodeArts Build）

1. 新建任务 `campus-space-ci`，代码源选本仓库，分支 `main`。
2. 选择"使用代码仓库中的 YAML 文件"，路径 `build.yml`。
3. 参数设置：`REGISTRY`、`SWR_USER`、`SWR_PASSWORD`（私密）、`IMAGE_TAG`（默认 `${GIT_COMMIT_SHORT}` 或流水线传入）。
4. 执行一次，确认 `scripts/ci.sh` 全绿并且 5 个镜像出现在 SWR。
5. 记下任务详情页 URL 末尾的 32 位 `jobId`。

> 若构建环境不允许在任务内启动 PostgreSQL 容器，为集成测试提供 `PLATFORM_DATABASE_URL` 等 4 个参数，指向测试 ECS 上对外开放的数据库（仅限测试环境、仅对构建节点放行）。`scripts/ci.sh` 在两者都没有时会失败而不是跳过。

- [ ] 完成，jobId：`________________________________`

## 3. 部署（CodeArts Deploy）

1. 基础资源 → 主机集群 → 新建"测试环境"集群并添加测试 ECS（SSH 密钥），再建"生产环境"集群。
2. 在每台 ECS 上执行一次 `bash deploy/scripts/bootstrap-host.sh`，编辑 `/opt/campus-space/.env`，`docker login` SWR。
3. 新建部署任务 `deploy-test`：步骤"执行 Shell 命令"，目标主机测试集群，命令：
   ```bash
   cd /opt/campus-space && bash scripts/deploy.sh ${IMAGE_TAG}
   ```
   参数 `IMAGE_TAG` 由流水线传入。
4. 同样新建 `deploy-prod`（生产集群）。
5. 记下两个任务的 `jobId`。

- [ ] 完成，jobId：test `________________` prod `________________`

## 4. 流水线（CodeArts Pipeline）

1. 新建流水线 → 流水线源 Repo → 本仓库 → "已有 yaml 文件" → `.codearts/pipeline.yml`。
2. 回填三个 `REPLACE_WITH_*_JOB_ID` 与审核人；若"人工审核"插件标识与模板不同，按控制台实际名称改 `uses`。
3. 触发设置：勾选 **合并请求事件**（打开 / 更新）与 **代码提交事件**，分支过滤 `main`。
4. 并发控制：开启"同一流水线串行执行"，作为部署窗口的机械保证（见 `deploy-window.md`）。
5. 提一个 MR 验证：MR 页面"合入条件"显示流水线结果；故意让测试失败确认门禁生效（演示 2 的彩排）。

- [ ] 完成，截图：MR 合入条件页、流水线运行记录。

## 5. 代码智能体（课程要求开通）

按课程文档开通 CodeArts 代码智能体；它读取仓库根目录 `AGENTS.md`，无需额外配置。把开通截图归档。

## 6. 回填到本仓库

完成后更新：`docs/team.md`（环境地址）、`docs/ops/environments.md`（ECS IP）、`.codearts/pipeline.yml`（jobId，通过 MR 提交）。
