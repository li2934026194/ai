# CrossPilot AI 全平台（M0–M8）本地拉取、数据库配置、表关系与业务数据流实操手册

> **适用对象**：本手册专为在**你自己的本地电脑（Windows / macOS / Linux）**上首次拉取 GitHub 代码、独立部署本地数据库与中间件、并完整跑通 M0–M8 全流程的开发者与答辩演示者编写。按照下面 **第 1 步 → 第 7 步** 顺序操作即可一次跑通。

---

## 一、把 GitHub 拉到本地后，第一步到第七步怎么操作？

### 第 1 步：拉取仓库并切换到工作分支 `arena/20303949-ai`

打开终端（Windows 用 **PowerShell** 或 **Git Bash**，macOS/Linux 用 **Terminal**）：

```bash
git clone https://github.com/li2934026194/ai.git
cd ai
git fetch origin arena/20303949-ai
git checkout arena/20303949-ai
```

> **预期结果**：执行 `git branch` 显示当前处于 `* arena/20303949-ai`；目录下能看到 `backend/`、`frontend/`、`docker-compose.yml`、`docs/`。

---

### 第 2 步：检查本地基础环境版本

| 工具 | 最低要求 | 检查命令 | 说明 |
| :--- | :--- | :--- | :--- |
| **Python** | `3.11+` | `python --version` 或 `python3 --version` | 运行后端 FastAPI + SQLAlchemy 2.0 + Pytest |
| **Node.js / npm** | `Node 20+` / `npm 10+` | `node -v && npm -v` | 运行前端 Vue 3 + Vite 6 + Vitest |
| **Docker Desktop**（若用 Docker 启动 PG/Redis/MinIO） | `Docker 24+` | `docker compose version` | **没有 Docker 也可以先跑方式 A（SQLite），有 Docker 推荐跑方式 B（PostgreSQL 16 全栈）** |
| **FFmpeg**（可选） | 任意版本 | `ffmpeg -version` | 不装也能启动；装了才可合成 M7-3 真实 `.mp4` 视频（未装时安全触发 `503 M7-5031` 门禁） |

---

### 第 3 步：选择本地数据库方案并准备好数据库（二选一）

因为本地数据库运行在你的电脑上，请从以下两种方式中选一种：

#### 方案 A：零安装 SQLite 极速模式（不装 PostgreSQL/Docker 也能立刻跑通）
- 无需安装任何数据库服务，直接跳过建库步骤，在第 4 步中把 `DATABASE_URL` 设为 `sqlite+aiosqlite:///./crosspilot_local.db` 即可（系统启动时会自动建表并初始化全部 33 张表及演示数据）。

#### 方案 B：正式 PostgreSQL 16 + Redis + MinIO 模式（严格对齐老师 V1.1 标准）

- **子方式 B1（推荐，Docker 一键拉起 PG + Redis + MinIO）**：
  在仓库根目录 `/ai` 执行：
  ```bash
  docker compose up -d postgres redis minio minio-init
  ```
  检查容器全部健康（`healthy` / `running`）：
  ```bash
  docker compose ps
  ```
  > 如需进一步启用 **Celery 异步 Worker/Beat** 或 **Milvus 向量检索**：
  > - 启动 Celery：`docker compose --profile worker up -d celery-worker celery-beat`
  > - 启动 Milvus：`docker compose --profile vector up -d etcd milvus`

- **子方式 B2（本机自己装了 PostgreSQL，不用 Docker）**：
  在本机打开 `psql`（如 `psql -U postgres`）执行以下建库建用户 SQL：
  ```sql
  CREATE USER crosspilot WITH PASSWORD 'crosspilot123';
  CREATE DATABASE crosspilot OWNER crosspilot ENCODING 'UTF8';
  GRANT ALL PRIVILEGES ON DATABASE crosspilot TO crosspilot;
  ```
  > 如需在非 Docker 环境也启用 Redis 与 MinIO，本机另外启动 Redis（默认端口 `6379`）和 MinIO（默认端口 `9000` 并新建 Bucket `crosspilot-assets`）；若本机没装 Redis/MinIO，后端会在启动时自动安全降级为进程内缓存与本地磁盘 `backend/m7_storage/`，**不会报错阻塞启动**。

---

### 第 4 步：安装后端依赖并配置 `backend/.env`

**macOS / Linux：**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

**Windows (PowerShell)：**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

打开 `backend/.env` 按你第 3 步选择的方案核对/修改：
- 若走 **方案 B（PostgreSQL）**：`.env.example` 默认已经是 `postgresql+asyncpg://crosspilot:crosspilot123@127.0.0.1:5432/crosspilot`，直接可用！
- 若走 **方案 A（零外部依赖 SQLite）**：把 `backend/.env` 里的对应行改为：
  ```dotenv
  DATABASE_URL=sqlite+aiosqlite:///./crosspilot_local.db
  STORAGE_BACKEND=local
  REDIS_URL=
  CELERY_BROKER_URL=
  CELERY_RESULT_BACKEND=
  MILVUS_URI=
  ```

> `.env` 全部字段的详细说明见本文 **「二、环境变量与中间件全字段配置手册」**。

---

### 第 5 步：执行数据库迁移（建表）并启动后端（端口 `8000`）

在已激活 `backend/.venv` 的 `backend/` 目录执行：

```bash
# 1. 执行 Alembic 迁移脚本（按顺序创建 0001 -> 0002 -> 0003 共 33 张表）
alembic upgrade head

# 2. 查看迁移版本确认（应显示 0003_v11_m1_att_m2_layout (head)）
alembic current

# 3. 启动 FastAPI 后端（首次启动 lifespan 会自动调用 ensure_seed_data 写入演示组织 org_demo、9 个岗位账号与 5 个演示 SKU）
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

打开新终端（或浏览器）验证后端健康检查：
```bash
curl http://127.0.0.1:8000/healthz
```
看到 `"code": "OK"` 且 `"status": "healthy"`（连接 PG 时 `"database_dialect": "postgresql"`，用 SQLite 时为 `"sqlite"`），说明后端与数据库全部就绪！

---

### 第 6 步：安装前端依赖并启动前端（另开一个终端，端口 `5173`）

```bash
cd frontend
npm install
npm run dev
```

看到终端打印 `Local: http://localhost:5173/` 后，用浏览器访问：
- **业务工作台首页**：`http://127.0.0.1:5173`（自动重定向 `/home`）
- **站内交付文档中心**：`http://127.0.0.1:5173/docs`
- **后端 Swagger 接口调试页**：`http://127.0.0.1:8000/docs`

---

### 第 7 步：运行全量自动化测试验证环境无误

```bash
# 后端全量 37 项测试（单元测试 + 24 项冒烟 + 压测 + V1.1 升级 + Alembic 迁移测试）
cd backend
pytest -v

# 前端类型校验、34 项 Vitest 组件测试与打包构建
cd ../frontend
npm run typecheck
npm test -- --run
npm run build
```

---

## 二、环境变量与中间件全字段配置手册（`backend/.env`）

下表逐项说明 `backend/.env.example` 中**每一个字段**的作用、必填性与降级策略：

### 2.1 数据库配置（核心必选）
| 字段名 | 默认值 / 示例 | 配置说明 |
| :--- | :--- | :--- |
| `M7_ENV` | `development` | 运行环境标识（`development` / `test` / `production`） |
| `DATABASE_URL` | `postgresql+asyncpg://crosspilot:crosspilot123@127.0.0.1:5432/crosspilot` | **必填**。Async 驱动地址：<br>• PostgreSQL 必须用 `postgresql+asyncpg://用户名:密码@主机:端口/库名`<br>• 单机极速体验可改为 `sqlite+aiosqlite:///./crosspilot_local.db` |

### 2.2 文件对象存储（MinIO / 本地磁盘）
| 字段名 | 默认值 / 示例 | 配置说明 |
| :--- | :--- | :--- |
| `STORAGE_BACKEND` | `auto` | `auto`（连得通 MinIO 就用 MinIO，连不通自动回退本地磁盘）；`minio`（强制 MinIO）；`local`（强制本地磁盘） |
| `STORAGE_ROOT` | `./m7_storage` | 本地磁盘存储目录（存放生成的图文、MP4、导出 ZIP 包及 M1 售后凭证附件） |
| `MINIO_ENDPOINT` | `127.0.0.1:9000` | MinIO S3 API 地址（Docker Compose 下容器间填 `minio:9000`，宿主机填 `127.0.0.1:9000`） |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO 登录账号（与 `docker-compose.yml` 中 `MINIO_ROOT_USER` 一致） |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO 登录密码（与 `docker-compose.yml` 中 `MINIO_ROOT_PASSWORD` 一致） |
| `MINIO_BUCKET` | `crosspilot-assets` | 对象存储桶名称（`docker-compose.yml` 的 `minio-init` 会自动创建此桶） |
| `MINIO_SECURE` | `false` | 本地 HTTP 为 `false`，生产 HTTPS 改为 `true` |

### 2.3 缓存与异步任务队列（Redis + Celery，可选）
| 字段名 | 默认值 / 示例 | 配置说明 |
| :--- | :--- | :--- |
| `REDIS_URL` | `redis://127.0.0.1:6379/0` | Redis 缓存连接串；留空或连不通时自动降级为进程内 TTL 缓存 |
| `CELERY_BROKER_URL` | `redis://127.0.0.1:6379/1` | Celery Broker（DB 1），用于 `crosspilot.index_m1_vectors` 等后台任务 |
| `CELERY_RESULT_BACKEND` | `redis://127.0.0.1:6379/2` | Celery 结果存储（DB 2） |

### 2.4 向量检索与外部 AI 引擎（均支持无服务自动兜底）
| 字段名 | 默认值 / 示例 | 配置说明 |
| :--- | :--- | :--- |
| `VECTOR_BACKEND` | `auto` | `auto`（Milvus 连通则写入/检索 Milvus，否则自动使用 PG 关键词精准匹配兜底） |
| `MILVUS_URI` | `http://127.0.0.1:19530` | Milvus Standalone gRPC/HTTP 端口（需先启动 `--profile vector`） |
| `MILVUS_COLLECTION` | `crosspilot_m1_products` | M1 商品知识向量集合名 |
| `VANNA_BASE_URL` | 留空 | **M3 智能问数 Vanna 2 HTTP 服务地址**（如 `http://127.0.0.1:8084`）；留空走内置 PostgreSQL 只读事实引擎 |
| `COMFYUI_BASE_URL` | 留空 | **M7 ComfyUI 生图地址**（如 `http://127.0.0.1:8188`）；留空依次走百炼或本地 Pillow 确定性出图 |
| `CLOUD_LLM_PROVIDER` | `dashscope` | 云端大模型开关：`dashscope`（有 Key 调通义千问+万相）或 `mock` |
| `DASHSCOPE_API_KEY` | 留空 | 阿里云百炼 API Key（**留空也能完整跑通所有模块**，自动切入本地合规模板） |
| `DASHSCOPE_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 百炼 OpenAI 兼容网关 |
| `DASHSCOPE_TEXT_MODEL` | `qwen-plus` | M7-1 文案模型 |
| `DASHSCOPE_IMAGE_MODEL` | `wanx2.1-t2i-turbo` | M7-2 生图模型 |

### 2.5 合规硬门禁、鉴权与跨域
| 字段名 | 默认值 / 示例 | 配置说明 |
| :--- | :--- | :--- |
| `FFMPEG_BIN` | `ffmpeg` | FFmpeg 可执行路径 |
| `VIDEO_ENGINE_ENABLED` | `true` | `true` 且宿主机有 `ffmpeg` 时可合成真实 `.mp4`；否则安全拦截并返回 `503 M7-5031` |
| `M7_STRICT_SEPARATION_OF_DUTIES` | `true` | **必须为 `true`**：强制执行提交人 ≠ 审批人（M0/M1/M4/M6/M7 禁自批） |
| `JWT_SECRET_KEY` | `change-me-in-local-env-only` | JWT 签名密钥（本地开发默认即可，线上部署务必改强随机串） |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 允许跨域的前端来源列表（逗号分隔） |

---

## 三、全平台 33 张数据库表清单与表间关联关系

系统共有 **33 张表**（由 Alembic `0001_init_m7`、`0002_platform_m0_m8`、`0003_v11_m1_att_m2_layout` 三次迁移创建），所有业务表均通过 **`org_id`** 实现租户隔离，跨模块商品主线通过 **`sku`** 串联：

### 3.1 分模块表结构与外键/关联关系一览

| 所属模块 | 数据表名 | 主键 | 关联表 / 外键或业务关联键 | 表职责 |
| :--- | :--- | :--- | :--- | :--- |
| **M8 底座** | `m8_users` | `user_id` | `role_code` → `m8_role_definitions.role_code`；`org_id` | 员工账号、PBKDF2 密码哈希、`allowed_shop_ids_json` 店铺权限 |
| **M8 底座** | `m8_role_definitions` | `role_code` | — | 9 大标准业务角色及权限点集合 `permissions_json` |
| **M8 底座** | `m8_approval_policies` | `policy_id` | `org_id` + `module`（M0/M1/M4/M6/M7） | 五大业务域审批阈值与 SoD 策略开关 |
| **M0 主档** | `m0_shops` | `shop_id` | `org_id` + `shop_code`；`is_mock` | 授权店铺接入与密钥掩码 `credential_mask` |
| **M0 主档** | `m0_sync_batches` | `batch_id` | `shop_id` → `m0_shops.shop_id` | 订单批量/CSV 同步去重与断档日期诊断 |
| **M0 主档** | `m0_fx_rates` | `rate_id` | `org_id` + `currency` | 多币种汇率快照（USD/EUR/GBP/JPY/RMB） |
| **M0 主档** | `m0_products` | `product_id` | `org_id` + `sku`（唯一） | **全平台核心商品主档**（被 M1/M2/M5/M6/M7 只读消费） |
| **M0 主档** | `m0_cost_requests` | `req_id` | `sku` → `m0_products.sku`；`proposer_id != reviewer_id` | 采购成本调价申请与 SoD 审批 |
| **M0 主档** | `m0_orders` | `order_id` | `shop_id` → `m0_shops.shop_id`；`sku` → `m0_products.sku`；`is_mock` | 实盘与模拟订单流水（M2/M5 强制只读 `is_mock=false`） |
| **M0 主档** | `m0_inventory` | `inv_id` | `org_id` + `warehouse_code` + `sku` | 在手 `on_hand`、在途 `in_transit`、锁库 `reserved` |
| **M0 主档** | `m0_supplier_quotes` | `quote_id` | `sku` → `m0_products.sku` | 1688/本地供应商报价单（供 M6 选优） |
| **M4 选品** | `m4_candidates` | `candidate_id` | `sku` → 过会 `APPROVED` 后自动写入 **`m0_products`** 与 **`m7_generation_jobs`** | 选品池、五维权重评分、毛利门禁、过会状态 |
| **M7 内容** | `m7_workflow_registry` | `workflow_id` | — | AI 文案/生图/视频工作流版本注册表 |
| **M7 内容** | `m7_generation_jobs` | `job_id` | **FK** `workflow_id` → `m7_workflow_registry.workflow_id`；`sku` | 异步任务进度与幂等控制（亦承接 M4 `m4_csv_import`） |
| **M7 内容** | `m7_generation_assets` | `asset_id` | **FK** `job_id` → `m7_generation_jobs.job_id`；`sku` | M7-1 文案 / M7-2 图槽 / M7-3 A+ 资产与乐观锁 `version` |
| **M7 内容** | `m7_generation_media` | `media_id` | **FK** `asset_id` → `m7_generation_assets.asset_id` | 图片/MP4 文件元数据、`sha256`、`storage_key`、IPTC 状态 |
| **M7 内容** | `m7_compliance_rules` | `rule_id` | `platform` + `category` | 平台合规规则矩阵（标题/五点字节数、三层禁用词库） |
| **M7 内容** | `m7_cert_records` | `cert_id` | `sku` → `m0_products.sku` | 资质台账（FDA/FCC/CE 等证书与效期 `expire_date`） |
| **M7 内容** | `m7_compliance_checks` | `check_id` | **FK** `rule_id` → `m7_compliance_rules.rule_id`；`sku` | 5 项上架硬门禁检查快照 |
| **M7 内容** | `m7_approval_records` | `approval_id` | **FK** `check_id` → `m7_compliance_checks.check_id`；`last_editor_id != approver_id` | 上架发布审批单（上游修改会自动使旧审批 `is_active=false`） |
| **审计底座** | `core_audit_events` | `event_id` | `org_id` + `sku` + `module` + `trace_id` | **全平台不可篡改中文审计台账**（仅允许 INSERT/SELECT） |
| **M1 客服** | `m1_faq_entries` | `faq_id` | `org_id` + `sku`（唯一） | SKU 痛点与 FAQ 问答对（同步喂给 M7-1 文案参照） |
| **M1 客服** | `m1_cs_sessions` | `session_id` | `sku` → `m0_products.sku`；`is_mock` | 真实客服会话与模拟买家会话（WebSocket 按 `org_id:session_id` 推流） |
| **M1 客服** | `m1_aftersales_tickets` | `ticket_id` | `sku` → `m0_products.sku`；`submitter_id != approver_id` | 售后退款工单与审批流 |
| **M1 客服** | `m1_aftersales_attachments` | `att_id` | `ticket_id` → `m1_aftersales_tickets.ticket_id` | 售后 `multipart` 上传凭证附件索引（V1.1 新增） |
| **M2/M3 BI** | `m2_ad_campaigns` | `campaign_id` | `sku` → `m0_products.sku` | 站内广告预算、花费与 ACOS/ROAS |
| **M2/M3 BI** | `m2_dashboard_layouts` | `layout_id` | `org_id`（唯一） | 驾驶舱草稿/发布双态布局与乐观锁 `version`（V1.1 新增） |
| **M2/M3 BI** | `m3_competitor_watches` | `watch_id` | `sku` → `m0_products.sku` | 竞品 ASIN 价格、BSR、差评痛点监测 |
| **M5/M6 供** | `m5_sales_history` | `id` | `org_id` + `sku` + `sales_date` | 日粒度实盘历史销量与期末库存（7 模型预测数据源） |
| **M5/M6 供** | `m6_replenish_applies` | `apply_id` | `sku` → `m0_products.sku`；`submit_user != approve_user` | 补货申请草案、审批流（`DRAFT→SUBMITTED→APPROVED/REJECTED`） |
| **M5/M6 供** | `m6_purchase_orders` | `po_id` | `apply_id` → `m6_replenish_applies.apply_id`；`sku` | 审批通过后自动生成的采购单；**收货时原子扣减在途、增加 `m0_inventory.on_hand`** |
| **M5/M6 供** | `m6_alert_events` | `alert_id` | `org_id` + `sku` | 断货/滞销/过期告警台账 |
| **M5/M6 供** | `m6_weekly_reviews` | `review_id` | `org_id` + `week_label` | BI 预测误差（WAPE）周复盘纪要 |

### 3.2 核心跨表关系链（ASCII 血缘图）

```text
M8 底座: m8_users ──(org_id + role_code)──> 全表鉴权 & core_audit_events (不可篡改审计)

主业务流:
[M4] m4_candidates
       │  (approver 过会 APPROVED)
       ▼
[M0] m0_products ◄─────── m0_shops ──► m0_orders (is_mock=false) ──► [M5] m5_sales_history
       │                                                                    │
       ├──► [M1] m1_faq_entries ──(只读痛点契约)──┐                         ▼
       │         m1_cs_sessions (WS 推流)        │                   [M6] m6_replenish_applies
       │         m1_aftersales_tickets           │                          │ (approver 批准)
       │           └──► m1_aftersales_attachments│                          ▼
       │                                         ▼                   m6_purchase_orders
       └──► [M7] m7_generation_jobs ──► m7_generation_assets                │ (warehouse 质检收货)
                   (FK: workflow_id)      ├──► m7_generation_media          ▼
                                          └──► m7_compliance_checks ──► 回写 m0_inventory (on_hand+/in_transit-)
                                                 (FK: rule_id)
                                                 │
                                                 ▼
                                          m7_approval_records ──► 导出合规上架包 (.zip / .html)

经营分析流: m0_orders + m0_products + m2_ad_campaigns + m1_aftersales_tickets + m6_alert_events
              ──► [M2] m2_dashboard_layouts (4卡独立会话并发) & [M3] 只读问数 (Vanna 2 / SQL 守卫)
```

---

## 四、业务数据端到端流向实操演练（以“选品 → 主档 → 创作 → 客服 → 补货 → 经营分析”为例）

在浏览器打开 **`http://127.0.0.1:5173`** 后，通过左侧栏 **「当前登录岗位」** 切换不同角色，即可亲眼验证跨表数据自动流转：

### 环节 1：M4 选品入池 → 过会同步至 M0 主档与 M7 文案（体验跨模块自动联动）
1. **选品录入**：左侧切到 **`选品研究员 (吴选品 / selector)`**，进入 **「M4-1 选品导入 (`/m4/import`)」** 或 **「M4-2 评估工作台 (`/m4/workbench`)」**。
   - 导入或选中一款候选品（写表 **`m4_candidates`**，状态 `DISCOVERED`），调整五维评分滑块、毛利率 ≥ 18% 后点击 **「保存并提交审批」**（状态变为 `PENDING_APPROVAL`，记录 `submitter_id = usr_selector`）。
2. **职责分离过会**：左侧切到 **`主管 / 审批人 (陈主管 / approver)`**（若仍用吴选品点击审批会被 `403 M7-4032` 拦截），进入 **「M4-3 过会决策 (`/m4/approval`)」**，勾选自动触发 M7 文案草稿并点击 **「同意小批测款」**：
   - 写表 **`m4_candidates`**（`status = APPROVED`）；
   - **自动同步写入 `m0_products`**（`origin = M4_APPROVED`，成本自动按汇率 `7.2` 换算为美元）；
   - **自动生成 `m7_generation_jobs` + `m7_generation_assets`** 初始英文文案草稿。

### 环节 2：M7 商品内容创作 → 合规检查 → 导出亚马逊上架交付包
1. **文案与痛点消费**：左侧切到 **`内容创作 / 审核人员 (林设计 / creator)`**，进入 **「M7-1 文案工作台 (`/m7/copy`)」**，切换刚才过会的 SKU。
   - 页面自动读取 **`m0_products` 主档参数** + **`m1_faq_entries` 买家痛点**（如果先在 M1-2 新增了一条 FAQ 痛点，刷新 M7-1 会立刻出现在左侧参考面板中）；输入禁用词如 `Waterproof` 会触发三层词库红底改写提示。
2. **AI 生图与 IPTC 标识**：进入 **「M7-2 主图工作台 (`/m7/images`)」** 生成 1+4 套图（写表 **`m7_generation_assets` + `m7_generation_media`** 并落盘 MinIO/本地 `m7_storage/`），若勾选 AI 人物出镜则自动写入 IPTC `DigitalSourceType` 标签。
3. **合规门禁与防自批审批**：进入 **「M7-4 合规检查与上架包 (`/m7/compliance`)」** 运行 5 项检查（写表 **`m7_compliance_checks`**），切回 **`陈主管 (approver)`** 执行上架批准（写表 **`m7_approval_records`**），即可下载最终 `.zip` 离线合规交付包。

### 环节 3：M1 客服导购、WebSocket 沙盒与售后附件
1. **模拟买家隔离**：左侧切到 **`测试买家 (usr_buyer)`**，进入 **「M1-3 咨询模拟沙盒 (`/m1/simulator`)」** 发一条提问，系统写入 **`m1_cs_sessions`（`is_mock = true`）**，通过 FAQ 向量/精准匹配回显答案并向 WebSocket 房间推流；**所有 `is_mock = true` 数据严禁进入 M2 财务统计与 M5 销量预测**。
2. **客服与售后附件**：切到 **`李客服 (cs)`**，在 **「M1-1 客服工作台 (`/m1/sessions`)」** 回复消息，在 **「M1-4 售后工单 (`/m1/aftersales`)」** 提交退款工单并可上传凭证附件（写表 **`m1_aftersales_tickets` + `m1_aftersales_attachments`**）；再切 **`陈主管 (approver)`** 完成退款审批。

### 环节 4：M5 销量预测 → M6 智能补货 → 采购收货回写 M0 库存
1. **7 模型销量预测**：切到 **`张运营 (planner)`**，进入 **「M5-2 多模型预测 (`/m5/forecast`)」**，读取 **`m5_sales_history` + `m0_inventory`**，对比 `ma7`/`es`/`snaive`/`croston_sba`/`prophet`/`lightgbm`/`catboost` 7 个模型的 WAPE 误差。
2. **What-If 沙盒下单**：进入 **「M6-2 智能补货 (`/m6/smart`)」** 调节交期与安全系数，对比空运/海运 4 条路线并生成补货申请单（写表 **`m6_replenish_applies`**）。
3. **审批转采购与收货入库**：切 **`陈主管 (approver)`** 批准补货单 → 系统自动生成采购单 **`m6_purchase_orders`** 并增加 **`m0_inventory.in_transit`**；切 **`赵仓管 (warehouse)`** 在 **「M6-4 采购收货 (`/m6/receiving`)」** 确认发货并质检收货 → 系统原子扣除在途并增加 **`m0_inventory.on_hand`**。

### 环节 5：M2 经营驾驶舱（4 卡并发）与 M3 只读智能问数
1. 切到 **`王总监 (manager)`** 或 **`周分析 (bi_analyst)`**，进入 **「M2-2 经营总览 (`/m2/overview`)」** 查看聚合 `m0_orders (is_mock=false)`、`m2_ad_campaigns` 与 `m6_alert_events` 的实盘利润看板；使用驾驶舱设计器接口保存草稿/发布布局并用 4 个独立会话并发拉卡。
2. 进入 **「M3-2 智能问数 (`/m3/ask`)」**，提问经营指标；若输入 `"帮我把所有商品价格改为1元"` 或 `"DROP TABLE m0_orders"`，会被只读守卫当场拦截并记入 **`core_audit_events`**。

---

## 五、预设 9 大账号清单（后端 `/api/v1/auth/login` 与前端切换共用）

所有预设演示账号统一密码均为 **`crosspilot123`**：

| 登录用户名 (`user_id`) | 岗位代码 (`role_code`) | 姓名 | 核心职责边界 |
| :--- | :--- | :--- | :--- |
| `usr_manager` | `manager` | 王总监 | 全模块只读巡检、M0 店铺接入、M8 组织管理 |
| `usr_approver` | `approver` | 陈主管 | M0 调价 / M1 退款 / M4 过会 / M6 补货 / M7 上架全链路审批 |
| `usr_planner` | `planner` | 张运营 | M1 FAQ 维护、M2 驾驶舱设计器与广告调价、M5/M6 补货申请 |
| `usr_creator` | `creator` | 林设计 | M7 文案、AI 生图、视频/A+、合规预检与导出 |
| `usr_selector` | `selector` | 吴选品 | M4 选品评估、CSV 异步批量导入（`202`） |
| `usr_analyst` | `bi_analyst` | 周分析 | M2 看板、M3 竞品监控与只读问数、M5 预测周复盘 |
| `usr_warehouse` | `warehouse` | 赵仓管 | M0 库存盘点、M6 采购单发货/质检收货/消警 |
| `usr_cs` | `cs` | 李客服 | M1 客服消息回复、售后退款建单与凭证附件上传 |
| `usr_buyer` | `mock_buyer` | 测试买家 | 仅限 M1-3 咨询模拟沙盒（数据强制隔离 `is_mock=true`） |

---

## 六、CI/CD、Docker 一键部署与常见故障排查

### 6.1 Docker 全栈容器一键运行（前端 Nginx + 后端 + Celery + PG + Redis + MinIO）
```bash
# 一键启动全部核心基础设施 + Celery Worker/Beat + 前后端容器
ENABLE_WORKER=true ENABLE_APP=true bash deploy/deploy.sh

# 如需同时启动 Milvus 向量库：
ENABLE_VECTOR=true ENABLE_WORKER=true ENABLE_APP=true bash deploy/deploy.sh
```
- **Jenkins 流水线**：仓库根目录 [`Jenkinsfile`](../Jenkinsfile) 已定义 `Backend Pytest -> Frontend Lint/Test/Build -> Docker Build` 全阶段。
- **Nginx 代理配置**：[`frontend/nginx.conf.example`](../frontend/nginx.conf.example) 已内置 `client_max_body_size 30m` 与 `/api/v1/orgs/*/m1/ws/` WebSocket 升级头。
- **Playwright 真浏览器 E2E**：
  ```bash
  cd frontend
  npx playwright install chromium
  npx playwright test
  ```

### 6.2 常见本地故障排查

| 现象 | 原因 | 解决方法 |
| :--- | :--- | :--- |
| `alembic upgrade head` 报连接 `5432` 拒绝 | 未启动 PostgreSQL 且 `.env` 用了默认 PG 地址 | 先执行 `docker compose up -d postgres`，或按第 4 步改为 SQLite 地址 |
| 报错 `ModuleNotFoundError: No module named 'app'` | 未在 `backend/` 目录下运行命令 | `cd backend` 后再执行 `pytest` 或 `uvicorn` |
| `alembic upgrade head` 报列/表已存在 | 旧本地库曾直接由 `create_all` 建表 | 删除旧 `.db` 测试库或新库重建，再执行 `alembic upgrade head` |
| M7-3 视频合成返回 `503 M7-5031` | 宿主机未安装 `ffmpeg` 或配置关闭 | 属预期合规硬门禁（不破坏已有图文资产）；本机装好 `ffmpeg` 后重启后端即可合成 `.mp4` |
| M1 售后附件上传返回 `422` | 后缀不在白名单或单文件 > 5MB / 总数 > 10 | 仅允许 `.pdf/.jpg/.jpeg/.png/.docx/.txt`，单件 ≤ 5MB |
| `/api/v1/auth/login` 返回 401 | 输入了旧用户名（如 `usr_bi_analyst`） | 请对照第五章表使用精确 `user_id`（`usr_analyst`、`usr_buyer` 等）与密码 `crosspilot123` |
