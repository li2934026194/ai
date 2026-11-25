# CrossPilot 全平台文档与交付物导航索引

> **说明**：由于仓库 `.gitignore` 规则默认屏蔽了二进制 `*.docx` 文件（仅用于本地下载/排版归档），我们在各模块同级目录下同步落盘了完整对应的 **Markdown (`.md`) 版本**（采用标准 ASCII 文件名以确保 Git 差异视图清晰显示路径），同时在网站内置了 **「交付文档中心 (`/docs`)」** 支持按文件夹树直接阅读与下载全部 `.md` / `.docx` 文件。

---

## 一、快速直达入口

| 文档类型 | 路径 | 说明 |
| :--- | :--- | :--- |
| **本地运行与部署实操手册** | [`docs/07_local_operation_guide.md`](07_local_operation_guide.md) | 零依赖极速运行、Docker Compose 全栈（PG/Redis/MinIO/Celery/Milvus）、AI 配置与全量测试指引 |
| **测试与冒烟总报告** | [`docs/06_test_execution_report.md`](06_test_execution_report.md) | 25 项冒烟用例实测结果、4 处文档对账缺陷根因与修复、压测与综合评分 |
| **全平台使用与联调指南** | [`README_M7.md`](../README_M7.md) | M7 与全平台目录索引及快捷启动说明 |

---

## 二、按模块文件夹分类（M0 – M8）

### 1. `docs/modules/m0/` — M0 店铺接入、商品主档与仓储盘点
- `docs/modules/m0/01_requirements.md`（需求说明书 / `.docx`：`CrossPilot-M0店铺接入与商品主档需求说明书.docx`）
- `docs/modules/m0/02_hld.md`（概要设计说明书 / `.docx`：`CrossPilot-M0店铺接入与商品主档概要设计说明书.docx`）
- `docs/modules/m0/03_lld.md`（详细设计说明书 / `.docx`：`CrossPilot-M0店铺接入与商品主档详细设计说明书.docx`）
- `docs/modules/m0/04_test_cases.md`（测试用例 / `.docx`：`CrossPilot-M0店铺接入与商品主档测试用例.docx`）

### 2. `docs/modules/m1/` — M1 客服导购、咨询模拟与售后闭环
- `docs/modules/m1/01_requirements.md`（需求说明书 / `.docx`：`CrossPilot-M1客服导购与售后闭环需求说明书.docx`）
- `docs/modules/m1/02_hld.md`（概要设计说明书 / `.docx`：`CrossPilot-M1客服导购与售后闭环概要设计说明书.docx`）
- `docs/modules/m1/03_lld.md`（详细设计说明书 / `.docx`：`CrossPilot-M1客服导购与售后闭环详细设计说明书.docx`）
- `docs/modules/m1/04_test_cases.md`（测试用例 / `.docx`：`CrossPilot-M1客服导购与售后闭环测试用例.docx`）

### 3. `docs/modules/m2_m3/` — M2 经营分析与 M3 竞品舆情/只读问数
- `docs/modules/m2_m3/01_requirements.md`（需求说明书 / `.docx`：`CrossPilot-M2M3经营分析与智能问数需求说明书.docx`）
- `docs/modules/m2_m3/02_hld.md`（概要设计说明书 / `.docx`：`CrossPilot-M2M3经营分析与智能问数概要设计说明书.docx`）
- `docs/modules/m2_m3/03_lld.md`（详细设计说明书 / `.docx`：`CrossPilot-M2M3经营分析与智能问数详细设计说明书.docx`）
- `docs/modules/m2_m3/04_test_cases.md`（测试用例 / `.docx`：`CrossPilot-M2M3经营分析与智能问数测试用例.docx`）

### 4. `docs/modules/m4/` — M4 智能选品与过会决策
- `docs/modules/m4/01_requirements.md`（需求说明书 / `.docx`：`CrossPilot-M4智能选品与过会决策需求说明书.docx`）
- `docs/modules/m4/02_hld.md`（概要设计说明书 / `.docx`：`CrossPilot-M4智能选品与过会决策概要设计说明书.docx`）
- `docs/modules/m4/03_lld.md`（详细设计说明书 / `.docx`：`CrossPilot-M4智能选品与过会决策详细设计说明书.docx`）
- `docs/modules/m4/04_test_cases.md`（测试用例 / `.docx`：`CrossPilot-M4智能选品与过会决策测试用例.docx`）

### 5. `docs/modules/m5_m6/` — M5 销量预测与 M6 智能补货闭环
- `docs/modules/m5_m6/01_requirements.md`（需求说明书 / `.docx`：`CrossPilot-M5M6销量预测与智能补货需求说明书.docx`）
- `docs/modules/m5_m6/02_hld.md`（概要设计说明书 / `.docx`：`CrossPilot-M5M6销量预测与智能补货概要设计说明书.docx`）
- `docs/modules/m5_m6/03_lld.md`（详细设计说明书 / `.docx`：`CrossPilot-M5M6销量预测与智能补货详细设计说明书.docx`）
- `docs/modules/m5_m6/04_test_cases.md`（测试用例 / `.docx`：`CrossPilot-M5M6销量预测与智能补货测试用例.docx`）

### 6. `docs/modules/m8/` — M8 组织权限、审批策略与审计底座
- `docs/modules/m8/01_requirements.md`（需求说明书 / `.docx`：`CrossPilot-M8组织权限与平台底座需求说明书.docx`）
- `docs/modules/m8/02_hld.md`（概要设计说明书 / `.docx`：`CrossPilot-M8组织权限与平台底座概要设计说明书.docx`）
- `docs/modules/m8/03_lld.md`（详细设计说明书 / `.docx`：`CrossPilot-M8组织权限与平台底座详细设计说明书.docx`）
- `docs/modules/m8/04_test_cases.md`（测试用例 / `.docx`：`CrossPilot-M8组织权限与平台底座测试用例.docx`）
