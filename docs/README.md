# 项目文档索引

给人读的文档全部在这里，中文。给 agent 读的规则在仓库根目录 [`AGENTS.md`](../AGENTS.md)（英文）。

| 目录 | 内容 | 对应任务书考核点 |
|---|---|---|
| [`requirements/`](requirements/) | 需求基线（REQ-ID → 验收标准 → 实现 → 验证）、跨模块集成点、未完成项清单 | 需求基线明确且可追踪 |
| [`adr/`](adr/) | 决策记录，按 proposed / implemented / rejected 生命周期组织，必含备选方案 | 架构与决策、公共层归属决策记录 |
| [`ai/`](ai/) | 人机协作方式、任务委派模板、AI 代码质量隐患清单、MR 模板 | 规则供给、任务委派、质量保证 |
| [`quality/`](quality/) | 测试策略、变异测试与破坏实验记录 | 测试必须确实验证了行为 |
| [`ops/`](ops/) | 环境拓扑、CodeArts 接入步骤、部署窗口、发布与回滚记录 | 交付流水线、版本标记、数据演进 |
| [`plan/`](plan/) | 里程碑与任务分解（TASK-ID） | 任务分解与依赖、进度可查看 |
| [`ethics/`](ethics/) | 各阶段真实的伦理判断记录 | 工程伦理融入各阶段 |
| [`demo/`](demo/) | 期末 5 项现场演示脚本 | 期末展示 |
| [`team.md`](team.md) | 分工、横切角色、互为备份 | 项目启动 |
| [`risks.md`](risks.md) | 风险清单与对策 | 第一次 Review：风险识别 |

## 编号规则

- 需求：`REQ-<模块>-<两位序号>`，如 `REQ-M1-04`、`REQ-D1-02`、`REQ-X-01`（跨模块）。
- 任务：`TASK-<三位序号>`，在 `plan/tasks.md` 中维护，每个任务指向至少一条需求。
- 决策：`ADR-<四位序号>`，文件名 `yyyy-mm-dd-<topic>.md`。
- 分支：`<type>/<scope>-<task 序号>-<slug>`，如 `feat/m1-017-seat-search`。

## 文档门禁

`pnpm verify:docs` 检查：`AGENTS.md` 字数预算、ADR 文件的状态与目录一致、ADR 必填章节齐全。文档也是代码，走同样的 MR 流程。
