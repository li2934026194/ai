# AI Agent 工作须知（Arena / Cursor / Copilot 等云端 Agent 必读）

本项目**有一部分运行环境不在仓库里**（属于开发者本机的重资源）。写代码时请按本文假定，
不要试图读取、下载或重新生成这些内容，也不要因为"文件不存在"就重写相关模块。

## 仓库里有什么

- `pilot/` 主项目：FastAPI 后端 + Streamlit 调试台 + 纯计算内核
  - `pilot/core/` —— 纯计算内核（需求口径、模型回测、库存推导）。**架构铁律：不得 import 任何 Web/ORM**
  - `pilot/api/` —— FastAPI 壳：取数 + 调 core，只转 JSON，不重算数值
  - `pilot/agents/` —— 七个业务 Agent（A1–A7），统一走 registry
  - `pilot/loaders/` `schema.py` `db.py` `scenarios.py` —— 数据层
  - `pilot/rbac/` —— 用户/角色/权限 + JWT + 审计
  - `pilot/frontend/` —— Vite 前端（`src/` 是源码，`node_modules` 未提交，需先 `npm install`）
  - `pilot/docs/` —— 设计、验收、闸门、契约文档。**改接口前先看 docs 里的契约与 gates 记录**
  - `pilot/tests/` —— 143 个用例，改动后必须跑通
- `pilot/web/` —— 旧版静态页（`dist` 构建产物未提交）

## 需求文档（权威输入，必须先读）

`docs/requirements/` 是项目方给的需求文档，已由 docx 转成 Markdown（原 docx 不入库）。
索引见 `docs/requirements/README.md`；动手改功能前，按 **M01–M10** 编号查到对应章节再写代码。

- `docs/requirements/AI跨境电商平台V1.1-架构与需求.md` —— 最新架构与各 Agent 讲解，**版本冲突时以此为准**
- `docs/requirements/AI跨境电商平台-模块需求细化_V1.1.md` —— 模块输入/输出、人工确认、验收标准
- `docs/requirements/AI跨境电商平台V1.0-软件需求规格说明书.md` —— FR 编号体系与优先级
- `docs/requirements/AI跨境电商平台-两周开发计划与方案设计_V1.1.md` —— 开发顺序与取舍
- `docs/requirements/AI跨境电商平台-第一版需求文档_V1.0.md`、`docs/requirements/CrossPilot-需求分析.md` —— 历史基线

注意事项：
1. 文档里出现 `[[图片]]` 的位置是原 docx 的截图，图没有转换过来，**不要因为看不到图就判断需求缺失**，按上下文文字实现
2. 文档描述 M01–M10 十个模块，**不等于代码里都已实现**；改之前先核对现有路由/表/测试
3. 文档中的平台政策、第三方 API 能力、性能数值属于待核实输入，不要当成已验证事实写进代码注释

## 不在仓库里（开发者本机环境，云端看不到）

| 路径 | 说明 | 云端怎么办 |
|---|---|---|
| `pilot/.pg/` | 便携版 PostgreSQL 19 张表 + 数据 + WAL | 按 `schema.py` 建表；或用 `sqlite:///data/pilot.db` 回退 |
| `pilot/.venv/` | Python 3.13 虚拟环境 | 按 `pilot/requirements.txt` 安装 |
| `pilot/frontend/node_modules/` | npm 依赖 | `npm install` |
| `pilot/data/online_retail_II.xlsx` | UCI 真实数据集，单文件 43.5 MB | **不要提交**；用 `sample_200.csv` 代替验证 |
| `pilot/data/*.zip` `*.db` | 原始压缩包 / SQLite 回退库 | 同上 |
| `pilot/_backup_*` | 历史改动备份（已从仓库移除） | 不要新建、不要把它们当正式代码 |
| `.env` | 真实密钥 | 只保留 `.env.example` |

## 数据样本（云端可用）

`pilot/data/sample_200.csv` —— 真实数据集第一个 sheet `Year 2009-2010` 的前 200 行（不含表头之外任何加工）。

字段：`Invoice, StockCode, Description, Quantity, InvoiceDate, Price, Customer ID, Country`

完整数据集有两个 sheet：`Year 2009-2010` 与 `Year 2010-2011`，字段一致。
真实库由 `pilot/scripts/build_public_dataset.py --xlsx data/online_retail_II.xlsx` 构建。

## 数据库

- 默认 PostgreSQL，`DATABASE_URL` 环境变量可覆盖；可显式回退 SQLite：`sqlite:///data/pilot.db`
- **表定义唯一来源是 `pilot/schema.py`（19 张表 = 13 业务 + 6 RBAC/审计）。不要凭记忆编字段名，先读它**
- 上线前数据以真实库为准，测试可用合成数据集（`scenarios.py`）

## 命令

```bash
# Windows 本机
.venv\Scripts\python.exe -m pytest tests -q
# Linux / 云端
python -m pytest tests -q
```

只跑 `tests/` 目录，不要在仓库根目录直接 `pytest`。

## 提交铁律

1. **绝不提交**：`.pg/`、`.venv/`、`node_modules/`、`*.xlsx`、`*.zip`、`*.db`、`.env`、任何密钥或 token
2. 改动尽量落在 `pilot/core/` `pilot/api/` `pilot/agents/` `pilot/frontend/src/` `pilot/tests/`
3. `pilot/core/` 保持纯净：不 import Web 框架、不 import ORM（有测试兜底）
4. 改 API 签名必须同步 `pilot/docs` 里的契约与闸门记录
