# ADR-0004: 代码托管与流水线只使用华为云 CodeArts

Status: implemented
Date: 2026-10-25
Related: L0 课程介绍（要求使用华为云码道托管、流水线、发布）；任务书 §三"交付流水线"

## 问题

课程要求使用华为云 CodeArts 托管代码并部署到本组的 2 台 ECS。组员习惯 GitHub 的 PR 体验，部分 AI 工具对 GitHub 集成更好。需要决定是否双平台并行。

## 决定

只用 CodeArts：Repo（代码与 MR）、Build（`build.yml`）、Pipeline（YAML 流水线）、Deploy（主机部署）、SWR（镜像）。

仓库内的约束：
- 所有 CI 逻辑放在 `scripts/ci.sh` 与 `deploy/scripts/*.sh`，`build.yml` 与 `.codearts/pipeline.yml` 只是调用这些脚本的薄模板，避免被平台语法绑死。
- MR 门禁在 CodeArts 控制台配置：保护 `main`、"开启流水线门禁"、评审意见全部解决后才能合入；流水线触发勾选"合并请求事件"。
- 生产阶段前放"人工审核"插件；每次生产发布打 tag。
- 控制台配置步骤写在 `docs/ops/codearts-setup.md`，截图归档，作为"基础设施脚本化"之外不可脚本化部分的证据。

## 备选方案

| 方案 | 优点 | 为什么落选 |
|---|---|---|
| GitHub 为主 + 镜像到 CodeArts | PR 体验与 AI 工具集成好 | 两套 MR/评审记录分裂，"提交历史是主要证据"会出现两个真相源；镜像同步出问题时演示有风险 |
| GitLab 自建在 ECS 上 | 完全可控 | 占用本就紧张的 ECS 资源，且不符合课程要求 |

## 后果

- 组员需要适应 CodeArts 的 MR 界面；`docs/ai/mr-template.md` 提供描述模板。
- CodeArts YAML 流水线以 `jobId` 绑定控制台任务，仓库里的 YAML 含占位符，接入时回填。
- 若 CodeArts 代码智能体可用，其规则同样读取 `AGENTS.md`。

## 验证

- 提交到 `main` 自动触发构建并部署到测试 ECS；MR 页面的"合入条件"显示流水线结果。
- 生产发布需人工审核通过，`/version` 返回与 tag 一致的 SHA。
