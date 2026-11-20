# 七 Agent 跨境备货助手 · Pilot

一套内核（core）两个壳（FastAPI 正式后端 + Streamlit 调试台）的补货决策系统。

- **core/** —— 纯计算内核：需求口径、4 模型回测、库存推导、两步取整。**绝不 import 任何 Web/ORM**。
- **api/** —— FastAPI 壳：取数 + 调 core，只转 JSON，不重算任何数。
- **agents/** —— 七个业务 Agent（A1–A7），调 core 取数，统一走 registry。
- **loaders/ + schema.py + db.py + scenarios.py** —— 数据层：PostgreSQL 19 张表（13 张业务表 + 6 张 RBAC/审计表）+ 六套合成数据集 + 一套 UCI 公开数据集 + CSV 导入器。
- **rbac/** —— PACK 23：user/role/permission 三表 + 多对多、DAO、Service、JWT 登录、权限装饰器、HTTP 管理接口。
- **tests/** —— core / data / api / agents / 履约 / RBAC / 评测与五闸。

## 当前状态（2026-11-19，本地可答辩最终收口）

- **本地可演示**：P1–P7 在 1366×768 / 1920×1080 均无页面级横向滚动、无控制台业务错误（响应式布局：去 body 固定最小宽、表格内部横滚、图表 resize、favicon 清零）。
- 全量 **143 passed + 6 subtests**（136 基线 + 7 条 PACK 25 模拟报价测试），2 个既有 DeprecationWarning；Milvus / Ollama / PostgreSQL 均参与验证。
- 五闸 **5/5 PASS**，**G02 契约 18/18**（PACK 25 新增 `GET /api/p3/supplier-quotes` 已同步闸门与契约）；结果见 `docs/gates-latest.json`。
- P5「AI 助手」已接真实 A1：点「生成草稿」真实请求后端；有 Key 显示 A1 原文，无 Key/超时才降级到本地模板并明确提示（不冒充模型成功）。
- P7 权限中枢可用本地演示管理员 `admin` 登录（**口令仅本地演示、此处不写**，生产必须更换）；可管理用户/角色/权限并查看审计。已另建 viewer 只读用户验证越权 403。
- PACK 22 真实 UCI 数据集 `公开-UCI礼品20SKU-180天` 已写库（20 SKU / 3,600 行 / 2011-06-13～2011-12-09）；销量为公开真实成交，库存/在途为透明仿真。
- PACK 24 商品主数据导入：`POST /api/datasets/import` 的 CSV 增加 9 个可选主数据列，新 SKU 带完整合法主数据即可建产品；旧格式完全兼容。
- UAT 数据已按 ID 精确清理，库恢复 `datasets=7 / products=140 / replenish_apply=3 / purchase_order=1`。逐项证据见 `docs/final-local-acceptance.md` 与 `docs/uat-screenshots/`。
- PACK 25「1688 第一层模拟供应商报价」已落地：19 张表（新增 `supplier_quotes`，约 420 行）、18 个业务端点（新增 `GET /api/p3/supplier-quotes`）、P3 只读比价卡片。**模拟数据、非实时 1688、非正式报价**，不写回 `products.unit_cost`、不改补货建议、不生成采购单。详见 `docs/pack25-1688-first-layer.md`。
- 1688 第二层（真实采集/实时接口）仍不做（BL-01）；未部署阿里云、未接真实店铺。

## 唯一的 Python 环境：`.venv`

> 本机有多个 Python（系统 3.13.12 / envs 3.13.14 / .venv 3.13.18）。
> **全部命令固定用 `.venv\Scripts\python.exe`**，不要再 `python` / `pip` 混用，
> 否则包会装错环境、版本会漂移（health 接口曾报 sqlalchemy 2.1.9 而非 2.0.36）。

### 初始化（首次）

```powershell
cd pilot
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

固定版本：`sqlalchemy==2.0.36`、`openai-agents==0.24.0`、`fastapi`、`uvicorn`、`httpx2`、`PyJWT==2.15.1`。

## 跑测试（以全量回归为准）

```powershell
cd pilot
.\.venv\Scripts\python.exe -m pytest tests -q              # 当前 143 passed + 6 subtests
.\.venv\Scripts\python.exe -m tests.gates                 # 当前 5/5 PASS
.\.venv\Scripts\python.exe -m tests.eval_qa               # RUN 5：70/70，走缓存
.\.venv\Scripts\python.exe -m tests.check_numbers         # 数字全文一致：30/30
```

旧的四层命令仍可单独跑，但不再作为封版口径：

```powershell
.\.venv\Scripts\python.exe -m tests.test_core
.\.venv\Scripts\python.exe -m tests.test_data
.\.venv\Scripts\python.exe -m tests.test_api
.\.venv\Scripts\python.exe -m tests.test_agents
```

## 起 API（FastAPI + uvicorn）

```powershell
cd pilot
.\.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

核心只读端点（完整 18 个端点见 `17-接口契约v1.3`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 状态 + 数据集数 + sqlalchemy 版本 |
| GET | `/api/datasets` | 数据集清单：id/name/source_type/created_at/note |
| GET | `/api/p1/dashboard?dataset_id=` | P1 KPI：待补货 / 断货风险 / 占用资金 / 今日运行 |
| GET | `/api/p2/skus?dataset_id=&rank=` | SKU 列表（日均销量降序） |
| GET | `/api/p3/sku/{sku}?dataset_id=` | 单 SKU 详情：S1 曲线 + per_model + 推导链 + evidence |
| GET | `/api/p3/supplier-quotes?dataset_id=&sku=` | PACK 25：3 家 1688 第一层**模拟**报价 + 阶梯价 + 排名 + 与成本差 |

PACK 20 新增 `POST /api/datasets/import`；PACK 21 新增 `GET /api/ops/summary` 与采购单取消入口。完整请求/响应见契约。

### PACK 24：CSV 商品主数据导入

`POST /api/datasets/import`（沿用 PACK 20 端点，RBAC `dataset:import` 不变，未加新端点）：
- 前 5 列必填（旧格式不变）：`date,sku,sales_qty,on_hand,in_transit`。
- 新 SKU 再填 9 列：`title,price,unit_cost,moq,pack_size,lead_prod,lead_transit,lead_customs,lead_inbound`；已有 SKU 只填前 5 列即可（沿用库里主数据，CSV 不覆盖）。
- 新 SKU 主数据必须齐全合法（整数且 >0，同 SKU 多行一致），整批校验失败完整回滚；重名仍拒绝。
- 错误码：E-6001/6002/6003/6004 沿用；新增 E-6005 冲突 / E-6006 缺字段 / E-6007 非法值（均定位到行/列）。
- 前端 P1「＋ 导入 CSV 数据集」面板支持下载模板、上传、提交、成功结果与行/列级错误展示；导入后数据集进列表、P2 可查新 SKU。详见 `docs/pack24-report.md` 与契约 §3quinquies。

### PACK 25：1688 第一层模拟供应商报价（只读比价）

**模拟数据、非实时 1688、非正式报价、未校验供应商**；只做比价展示，不写回 `products.unit_cost`、不改补货建议量、不生成采购单。

- 第 19 张表 `supplier_quotes`：每 SKU 3 家固定供应商（MOCK-A/B/C），`quote_id` 确定性、seed 幂等；约 420 行。
- 规则确定性无随机：以 `unit_cost` 为基准（缺则 `price×0.45`，两者都缺用非 0 占位并声明「非真实成本」）；三家价格系数 0.92/1.03/0.97，三档阶梯价（MOQ / ×2 / ×5），按当前建议量选适用档、按适用价排名；金额 2 位小数。
- seed（可重复执行，幂等）：

```powershell
.\.venv\Scripts\python.exe scripts\seed_1688_quotes.py
.\.venv\Scripts\python.exe scripts\seed_1688_quotes.py --dataset-id ds_xxx
```

- 只读端点 `GET /api/p3/supplier-quotes?dataset_id=&sku=`（RBAC `sku:read`）：返回 3 家报价 + 最低价 + 与成本差额；库内无quote时按规则即时生成（`persisted=false`，不写库）；缺成本时 `saving_*` 为 null。
- 前端 P3「1688 模拟报价 · 第一层」卡片：模拟徽标、阶梯价、与成本差、最低价汇总；空态/缺成本/接口失败三态齐全。详见 `docs/pack25-1688-first-layer.md` 与截图 `docs/uat-screenshots/1688-P3-quotes.png`。

### PACK 23：RBAC / JWT 登录

演示模式默认 `AUTH_ENABLED=0`，既有 17 个业务端点保持原行为；生产设为 `1` 后，`/api/*` 统一要求 Bearer token，并按路径/服务装饰器校验权限。本地演示管理员用户名为 `admin`（口令不写入文档/仓库，生产必须更换）。

```powershell
# 1) 建 RBAC 表、默认权限/角色，并创建管理员
$env:RBAC_ADMIN_USERNAME="admin"
$env:RBAC_ADMIN_PASSWORD="至少8位-生产请改"
.\.venv\Scripts\python.exe scripts\seed_rbac.py

# 2) 开发/联调打开鉴权
$env:AUTH_ENABLED="1"
$env:AUTH_JWT_SECRET="至少32字节的随机密钥-生产必须换"
```

- 登录：`POST /api/auth/login`（body `username/password`）→ `access_token`；`GET /api/auth/me`。
- 管理：`/api/rbac/users`、`/api/rbac/roles`、`/api/rbac/permissions`、`/api/rbac/audit`（详见 `docs/pack23-rbac.md`）。
- 前端新增 P7「权限」页：登录后管理用户/角色/权限并查看审计；token 只放在浏览器 sessionStorage，服务端无 session、无 token 内存缓存。
- 说明：这是应用内 JWT + RBAC，不是飞书/Keycloak 统一身份；阿里云部署时由 ECS + Nginx + HTTPS 承载。可执行模板见 `deploy/README.md`、`deploy/pilot.service`、`deploy/nginx-pilot.conf`（**只是模板，尚未实际部署**）。

每个响应都带 `meta{source_type, as_of, method}`；SKU 详情另带 `evidence`。错误结构化返回（HTTP 200 不 500），常用：
`E-1001` 数据不足 / `E-1003` SKU 不存在 / `E-1004` 断货占比高（warning）；导入相关 `E-6001`～`E-6007`；完整错误码见契约与 `docs/reject-matrix.md`。

## 数据库：PostgreSQL 默认 + SQLite 回退（PACK 7）

`db.py` 的连接串优先级：

1. 环境变量 `DATABASE_URL` 设了就用它；
2. 没设就默认连 PostgreSQL：`postgresql+psycopg://postgres@127.0.0.1:5432/pilot`
   （驱动 psycopg 3，已装进 .venv）；
3. 显式切回 SQLite：设 `DATABASE_URL=sqlite:///data/pilot.db`。

SQLite 相关代码（`DB_PATH` / `check_same_thread` / `data/pilot.db`）全部保留，
是回滚路径，不要删。`connect_args` 按方言条件注入：SQLite 才加
`check_same_thread=False`，PG 不需要。

PG 兼容性要点（PACK 7 实测结论）：

- **自增主键**：schema 里 `Integer + autoincrement` 自动映射为 PG `SERIAL`
  （`nextval(..._seq)`），无需改。
- **布尔字段**：`is_stockout` / `is_refund` 在 schema 里是 **`Boolean`（不是
  `Integer`）**，PG 下正确映射为原生 `boolean`（存 `true/false`）。写入侧
  `scenarios.py` 传的 Python `int 0/1` 由 psycopg 3 自动转成 `boolean`，落库值正确。
- **时间字段**：`created_at` 用 `datetime.now()` 落本地时间（本机 +08），PG 列是
  `timestamp without time zone`（naive），存的就是 +08 墙上时间，与 SQLite 行为一致。
- **SQLite 专有语法**：已排查并适配——`tests/test_data.py` 的 `sqlite_master` /
  `PRAGMA table_info` 改为 `information_schema` 跨方言写法；`is_stockout=1` 改为
  `is_stockout = TRUE`；`loaders/base.py` 的 upsert 已有 PG 分支；`api/service.py`
  只用 `func.max/count`（跨方言通用）。
- **中文**：PG 编码 UTF8，商品标题 `合成商品 SKU-xxx` 写入/读出无乱码。

## 一条必须遵守的约定

`api/service.py` **不要 import agents.tools**。openai-agents SDK 也叫 `agents` 包，
与本地 `pilot/agents` 同名会撞。service.py 自己从 db 读 + 调 core。

## 两壳同数（关键）

补货建议量的算法只有一份：`core/inventory.py::build_suggestion`。
api 和 agents 都调它，σ_日 从 best 模型残差真算、lead_time 从 products 表读。
**不要在任何壳里再写 σ / lead_time / 取整公式**，否则两壳会算出不同的数互相打脸。

## 目录

| 路径 | 作用 |
|---|---|
| `core/` | 纯计算内核（demand/models/backtest/inventory/simulate/metrics） |
| `api/` | FastAPI 壳（main/service/schemas） |
| `agents/` | 七 Agent（registry/tools/explain） |
| `loaders/` | 数据源 loader（base + synthetic + csv_import + supplier_quotes） |
| `schema.py` | 19 张表 SQLAlchemy 定义（13 业务 + 6 RBAC/审计） |
| `rbac/` | JWT 登录、RBAC DAO/Service/装饰器/HTTP 路由 |
| `deploy/` | 阿里云部署模板（systemd、Nginx、步骤说明；未实际执行） |
| `db.py` | 引擎 + 会话 + create_all + suggestion_to_row |
| `scenarios.py` | S1–S6 合成场景注入 + 建库 |
| `data/pilot.db` | SQLite 回退库（默认仍走 PostgreSQL） |
| `.env` | DeepSeek key（只进这里，绝不进 .py/README） |
