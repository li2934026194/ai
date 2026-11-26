# CrossPilot AI 全平台文档总索引（精简合并版）

> **整编说明**：项目全套设计、需求、测试与部署文档已由分散的分模块文件**合并精简为 5 份总项目文档**（每份同时提供 Markdown 在线阅读版与图文并茂的 Word `.docx` 交付版，并统一打包至根目录 [`docs-deliverables.zip`](../docs-deliverables.zip)）。**老师提供的原始需求与基线文档全部原封保留，未作任何修改。**

---

## 一、总项目交付文档（5 份核心文档，`.md` + `.docx`）

| 序号 | 文档名称 | Markdown 版（Git 跟踪 / 站内预览） | Word 版（含嵌入架构图 / 打包下载） | 内容范围 |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **总需求说明书** | [`docs/01_project_requirements.md`](01_project_requirements.md) | `docs/CrossPilot-总需求说明书.docx` | M0–M8 全平台需求、9 大角色与契约、V1.0 SRS & V1.1 对齐 |
| **2** | **总概要设计说明书** | [`docs/02_project_hld.md`](02_project_hld.md) | `docs/CrossPilot-总概要设计说明书.docx` | 全平台架构、9 张 DFD 图、V1.1 老师技术栈标准（PG/Redis/MinIO/Celery/Milvus/Nginx/Docker） |
| **3** | **总详细设计说明书** | [`docs/03_project_lld.md`](03_project_lld.md) | `docs/CrossPilot-总详细设计说明书.docx` | 33 张表字典、REST & WebSocket 接口、核心算法与 29 视图规范 |
| **4** | **总测试用例与执行报告** | [`docs/04_project_test_cases_and_report.md`](04_project_test_cases_and_report.md) | `docs/CrossPilot-总测试用例与执行报告.docx` | 24 项冒烟 + M0–M8 测试用例矩阵 + 37 项后端 / 34 项前端实测执行报告 |
| **5** | **本地运行与部署实操手册** | [`docs/05_local_operation_guide.md`](05_local_operation_guide.md) | `docs/CrossPilot-本地运行与部署实操手册.docx` | 零依赖极速本地运行、Docker Compose 全栈编排、9 角色账号密码与故障排查 |

- **一键打包下载**：[`docs-deliverables.zip`](../docs-deliverables.zip)（内含上述全部 5 份总项目 `.docx` 交付文档）。
- **快捷入口**：[`README_M7.md`](../README_M7.md)（仓库根目录快速启动说明）。

---

## 二、原始基线与老师参考文件（原封保留，未作任何改动）

| 目录 / 文件 | 说明 |
| :--- | :--- |
| `docs/requirements/` | 老师原始需求与架构规范（`V1.0 SRS`、`V1.1 架构与需求`、`模块需求细化_V1.1`、`两周开发计划_V1.1`、M7 原始需求/概要/测试 `.docx` 及 `assets/v1.1/` 原图） |
| `docs/detailed-design.docx` | M7 商品内容创作与合规交付详细设计原件 |
| `docs/plans/` | 早期 SRS 偏差分析与阶段性需求分析归档（`.docx`） |
| `docs/prototypes/` | V6 原型交互工程（`web/`）、UI 截图（`ui_v6/`、`simple_v6/`）及 DFD 架构图（`dfd_v6/`） |
| `docs/attachments/` | M7 用例图、类图、时序图（`.mmd` / `.svg`） |
