# CrossPilot AI 全平台（M0–M8）本地拉取、环境差异、数据库配置与全链路实操手册

> **写给本地部署的你**：因为你的本地电脑（Windows / macOS / Linux）与云端开发沙盒环境不同，本地的数据库、中间件、FFmpeg 与 API 密钥都需要你在自己电脑上启动或配置。本手册不仅给你**“从 GitHub 拉下来第 1 步到第 8 步怎么跑”**的保姆级命令，还把**“哪些在本地能直接跑、哪些会因环境缺失而触发兜底或报错、Windows 专属避坑、33 张表怎么连怎么查、数据怎么跨表流转”**一次性全部写透。

---

## 一、先看清：沙盒环境 vs 你本地拉下来运行的能力边界

当你把仓库拉到本地后，不同功能的运行情况分为以下三类，避免误以为“跑不起来是代码坏了”：

### 1. 拉下来就能直接跑通（100% 无需外部服务与密钥）
- **全部 M0–M8 前后端核心业务（29 个页面）**：9 角色 RBAC 切换与登录、SoD 防自批、M4 五维加权选品 + `202` 异步 CSV 导入 + 过会同步 M0/M7、M7-1 三层词库扫描与本地合规文案模板、M7-2 Pillow 1+4 电商主图生成与 IPTC 标签读写校验、M7-4 五项合规门禁与离线 `.zip` 上架包导出、M1 WebSocket 实时聊天 + 售后 `multipart` 多附件上传 + 模拟沙盒隔离、M5 7 种预测模型（含 Prophet/LightGBM/CatBoost 策略）与 WAPE 回测、M6 What-If 沙盒与采购收货回写库存、M2 驾驶舱设计器与 4 卡并发、M3 只读问数与写删 SQL 拦截。
- **全套自动化测试**：后端 `pytest` 37 项 + 前端 `vitest` 34 项 + `vue-tsc` 类型检查。

### 2. 拉下来如果不配/不装对应服务，会自动走兜底或触发预期拦截（共 7 项）

| 功能项 | 你本地没配/没装时的真实表现 | 你本地想跑“真实版”需要做什么 |
| :--- | :--- | :--- |
| **1. Word `.docx` 文档文件** | `.gitignore` 屏蔽了散落 `*.docx`（防 Git 臃肿），所以 `git clone` 后 `docs/` 里有 5 份 `.md` + 3 份老师原件，**5 份总 `.docx` 打包在根目录 `docs-deliverables.zip` 中** | 拉取后在根目录执行 `unzip docs-deliverables.zip -d docs/`（或右键解压到 `docs/`），就能得到全部 5 份 `.docx` 并在 `/docs` 网页直接下载 |
| **2. PostgreSQL / Redis / MinIO** | GitHub 仓库里不包含运行中的数据库实例！如果直接执行 `alembic upgrade head`，`.env.example` 默认连 `127.0.0.1:5432` 会报错 **Connection refused** | **三选一**：① 执行 `docker compose up -d postgres redis minio minio-init`；② 本机装 PostgreSQL 手动建库；③ 改为 SQLite（见第 3 步方案 A），无需装任何数据库直接启动 |
| **3. M7-3 视频合成（`FFmpeg`）** | 本地电脑（含本沙盒）未装 `ffmpeg` 时，点击合成 15s 短视频会**故意返回 `503 M7-5031`**（合规硬门禁，绝不生成假 `.mp4`，也不破坏已有图文） | 本机安装 `ffmpeg`（Windows：`winget install Gyan.FFmpeg`；Mac：`brew install ffmpeg`）并确保命令行 `ffmpeg -version` 可用后重启后端；或用 `docker compose --profile app` 运行（容器内已装好 `ffmpeg`） |
| **4. 阿里云百炼大模型（Qwen + 万相）** | 仓库不含作者 API Key，留空时自动切换为本地确定性合规模板 + Pillow 出图 | 在 `backend/.env` 填入自己的 `DASHSCOPE_API_KEY=sk-...` 重启后端即可调用真实通义千问与万相生图 |
| **5. Vanna 2 / ComfyUI 外部 AI** | 本地默认无此两项服务，自动回退为 PG 只读事实引擎与百炼/本地生图 | 本机另行启动 Vanna 2（如 `8084`）或 ComfyUI（如 `8188`）后，把地址填入 `.env` 的 `VANNA_BASE_URL` / `COMFYUI_BASE_URL` |
| **6. Milvus 向量检索库** | 默认未开启时 M1 自动回退 PostgreSQL 停用词+CJK 双字匹配，不影响答复 | 需 Docker Desktop 分配 **≥4GB 内存** 后执行 `docker compose --profile vector up -d etcd milvus` |
| **7. Playwright 真浏览器 E2E** | 仓库含 `playwright.config.ts` 和 `e2e/crosspilot.spec.ts`，但未预先安装约 150MB 的 Chromium 浏览器 | 本地想跑真浏览器测试时，先运行 `npm install -D @playwright/test && npx playwright install chromium`，再运行 `npx playwright test` |

---

## 二、把 GitHub 拉到本地后，第一步到第八步完整操作流程

### 第 1 步：拉取仓库并切到当前工作分支
```bash
git clone https://github.com/li2934026194/ai.git
cd ai
git fetch origin arena/20303949-ai
git checkout arena/20303949-ai
```
（可选）把打包好的 5 份总 Word 文档解压到 `docs/` 目录：
- **macOS / Linux / Git Bash**：`unzip -o docs-deliverables.zip -d docs/`
- **Windows PowerShell**：`Expand-Archive -Path docs-deliverables.zip -DestinationPath docs -Force`

---

### 第 2 步：检查本地 Python、Node.js 与 Docker 版本
```bash
python --version   # 或 python3 --version，强烈推荐 Python 3.11 或 3.12
node -v            # 推荐 Node 20 LTS 以上
npm -v             # 推荐 npm 10 以上
docker compose version   # 若走方案 A（SQLite）可不装 Docker；走方案 B 必装并先打开 Docker Desktop
```
> **Windows 重要提醒**：请尽量使用 **Python 3.11 或 3.12**（不要使用刚发布的 3.13/3.14 实验版，否则 `asyncpg` / `pymilvus` 可能找不到预编译二进制包而报 C++ 编译错误）。

---

### 第 3 步：准备本地数据库（三种方式任选其一，推荐 B1 或 A）

#### 方案 A：零安装 SQLite 极速模式（最快，5 分钟跑通全部功能）
- 无需安装 PostgreSQL、Redis、MinIO 或 Docker，直接跳过本步去第 4 步修改 `backend/.env` 为 SQLite 即可。

#### 方案 B1：Docker Compose 一键拉起全套生产中间件（推荐，严格对齐老师 V1.1 技术栈）
> 操作前请确认电脑上的 **Docker Desktop 已启动**，且本机没有占用 `5432`（PG）、`6379`（Redis）、`9000/9001`（MinIO）端口。

在仓库根目录执行：
```bash
docker compose up -d postgres redis minio minio-init
docker compose ps
```
> **预期结果**：`crosspilot-postgres`、`crosspilot-redis`、`crosspilot-minio` 均为 `healthy`（`crosspilot-minio-init` 执行完建桶后正常退出为 `Exited (0)`）。
> - （按需）启动 Celery 后台任务队列：`docker compose --profile worker up -d celery-worker celery-beat`
> - （按需）启动 Milvus 向量库（确保 Docker 内存 ≥ 4GB）：`docker compose --profile vector up -d etcd milvus`

#### 方案 B2：本机手动安装了 PostgreSQL（不用 Docker）
打开本机 `psql`（或 pgAdmin / Navicat 查询窗口），用超级用户执行以下 SQL 建库建账号：
```sql
CREATE USER crosspilot WITH PASSWORD 'crosspilot123';
CREATE DATABASE crosspilot OWNER crosspilot ENCODING 'UTF8';
GRANT ALL PRIVILEGES ON DATABASE crosspilot TO crosspilot;
```
- 本机装了 Redis 可一起启动（默认 `127.0.0.1:6379`）；本机装了 MinIO 可建一个名为 `crosspilot-assets` 的 Bucket；**若本机没装 Redis/MinIO，留空或保持默认即可，后端会自动降级，不会阻塞启动**。

---

### 第 4 步：创建后端虚拟环境、安装依赖并配置 `backend/.env`

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
# 如果上面这句报“禁止运行脚本”，先执行一次下面这句再重试：
# Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
Copy-Item .env.example .env
```

现在用编辑器（如 VS Code / 记事本）打开 **`backend/.env`**（**强烈建议直接改 `.env` 文件，不要用临时环境变量命令，Windows 和 Mac 通用**）：
- **如果你第 3 步选的是方案 B（PostgreSQL）**：`.env.example` 默认就已经配好 `postgresql+asyncpg://crosspilot:crosspilot123@127.0.0.1:5432/crosspilot`，**无需改动**（如果是 B2 且本机未起 Redis/MinIO，可把 `STORAGE_BACKEND=local`、`REDIS_URL=`）。
- **如果你第 3 步选的是方案 A（SQLite 极速模式）**：把 `backend/.env` 顶部对应几行改成下面这样保存：
  ```dotenv
  DATABASE_URL=sqlite+aiosqlite:///./crosspilot_local.db
  STORAGE_BACKEND=local
  REDIS_URL=
  CELERY_BROKER_URL=
  CELERY_RESULT_BACKEND=
  MILVUS_URI=
  ```

---

### 第 5 步：执行 Alembic 数据库迁移建表（重要顺序红线！）

> **顺序红线**：务必**先运行 `alembic upgrade head` 建表，再启动 `uvicorn`**！（如果先启动了 `uvicorn`，后端 `create_all` 会把表先建好，导致后续再跑 `alembic upgrade head` 时报“表已存在”；万一顺序反了，执行 `alembic stamp head` 同步迁移版本号即可。）

在已激活 `.venv` 的 `backend/` 目录执行：
```bash
# 执行 0001 -> 0002 -> 0003 全部迁移（自动创建 33 张表与全部索引）
alembic upgrade head

# 校验迁移版本（预期输出：0003_v11_m1_att_m2_layout (head)）
alembic current
```

---

### 第 6 步：启动后端服务并校验健康接口（端口 `8000`）

在 `backend/` 目录继续执行：
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
> 后端启动瞬间会自动执行 `ensure_seed_data()`，往库里写入演示组织 `org_demo`、9 个 RBAC 岗位账号（密码 `crosspilot123`）、5 个演示 SKU（`SKU-00704` 等）、12 条合规规则、7 条资质台账和业务模拟/实盘种子数据。

另开终端（或浏览器直接打开）验证：
```bash
curl http://127.0.0.1:8000/healthz
```
看到返回 JSON 中 `"status": "healthy"` 且 `"database_dialect"` 为 `"postgresql"`（或 `"sqlite"`），即为成功！

---

### 第 7 步：安装前端依赖并启动前端开发服务器（端口 `5173`）

新开一个终端窗口：
```bash
cd frontend
npm install
npm run dev
```
看到 `Local: http://localhost:5173/` 后，用浏览器打开：
- **业务工作台首页**：`http://127.0.0.1:5173`（自动跳转到 `/home`）
- **站内交付文档中心**：`http://127.0.0.1:5173/docs`
- **后端 Swagger 接口文档**：`http://127.0.0.1:8000/docs`

> **注意**：前端必须通过 `http://127.0.0.1:5173` 访问（不要直接双击 `index.html` 用 `file://` 打开），Vite 会自动将 `/api` 和 `/api/.../ws/...` 代理转发到 `127.0.0.1:8000`。

---

### 第 8 步：运行全量自动化测试确认本地环境 100% 正常

```bash
# 1. 后端 37 项自动化测试（功能、24 项冒烟、并发压测、RBAC、Alembic 迁移、V1.1 升级）
cd backend
pytest -v

# 2. 前端类型检查 + 34 项 Vitest 组件测试 + 生产打包
cd ../frontend
npm run typecheck
npm test -- --run
npm run build
```

---

## 三、本地可视化查库指南与环境变量全字段说明

### 3.1 如何用数据库客户端查看本地 33 张表？
- **如果你用了方案 B（PostgreSQL）**：用 **DBeaver / Navicat / DataGrip / pgAdmin** 新建 PostgreSQL 连接：
  - Host：`127.0.0.1`，Port：`5432`，Database：`crosspilot`，Username：`crosspilot`，Password：`crosspilot123`。
- **如果你用了方案 A（SQLite）**：用 **DBeaver / DB Browser for SQLite / VS Code SQLite 插件** 直接打开文件 `backend/crosspilot_local.db`。

**5 条最常用的核验 SQL（连接后可直接运行观察数据流向）**：
```sql
-- 1. 查看 9 个预设账号与权限店铺边界
SELECT user_id, display_name, role_code, is_active FROM m8_users;

-- 2. 查看 M4 选品过会后同步到 M0 商品主档的新品
SELECT sku, name, origin, unit_cost_usd, sale_price_usd, approver FROM m0_products;

-- 3. 查看 M7 文案/主图任务、资产版本与合规检查结果
SELECT j.job_id, j.sku, j.job_type, j.status, a.asset_slot, a.version FROM m7_generation_jobs j LEFT JOIN m7_generation_assets a ON j.job_id = a.job_id;

-- 4. 查看 M6 补货申请、采购单与 M0 库存实时联动
SELECT po.po_id, po.sku, po.order_qty, po.receive_qty, po.status, inv.on_hand, inv.in_transit FROM m6_purchase_orders po JOIN m0_inventory inv ON po.sku = inv.sku;

-- 5. 查看不可篡改全平台中文审计台账
SELECT module, action, sku, actor_role, ok, sentence_zh, created_at FROM core_audit_events ORDER BY created_at DESC LIMIT 20;
```

### 3.2 `backend/.env` 全字段配置速查表

| 分类 | 字段名 | 默认值 / 示例 | 必填性与说明 |
| :--- | :--- | :--- | :--- |
| **基础** | `M7_ENV` | `development` | 环境标识：`development` / `test` / `production` |
| **主库** | `DATABASE_URL` | `postgresql+asyncpg://crosspilot:crosspilot123@127.0.0.1:5432/crosspilot` | **必填**。异步连接串（PG 必须用 `+asyncpg`，SQLite 用 `sqlite+aiosqlite:///./crosspilot_local.db`） |
| **存储** | `STORAGE_BACKEND` | `auto` | `auto`（通 MinIO 用 MinIO，不通回退本地）/ `minio` / `local` |
| **存储** | `STORAGE_ROOT` | `./m7_storage` | 本地磁盘附件与交付包根目录 |
| **MinIO** | `MINIO_ENDPOINT` | `127.0.0.1:9000` | MinIO S3 API 地址（Docker 内部容器间用 `minio:9000`） |
| **MinIO** | `MINIO_ACCESS_KEY` / `SECRET_KEY` | `minioadmin` / `minioadmin` | 与 `docker-compose.yml` 一致；MinIO Web 控制台在 `http://127.0.0.1:9001` |
| **MinIO** | `MINIO_BUCKET` | `crosspilot-assets` | 对象存储桶名（`minio-init` 会自动初始化） |
| **MinIO** | `MINIO_SECURE` | `false` | 本地 HTTP 为 `false` |
| **队列** | `REDIS_URL` | `redis://127.0.0.1:6379/0` | Redis 缓存连接串；留空自动走内存缓存 |
| **队列** | `CELERY_BROKER_URL` / `RESULT_BACKEND` | `redis://127.0.0.1:6379/1` & `/2` | Celery Broker 与结果后端（Windows 本地直跑 Celery 需加 `--pool=solo`） |
| **向量** | `VECTOR_BACKEND` / `MILVUS_URI` | `auto` / `http://127.0.0.1:19530` | `MILVUS_COLLECTION=crosspilot_m1_products`；未起 Milvus 时自动回退 PG 精确检索 |
| **外部AI** | `VANNA_BASE_URL` | 留空 | M3 问数 Vanna 2 HTTP 服务地址；留空走 PG 只读事实引擎 |
| **外部AI** | `COMFYUI_BASE_URL` | 留空 | M7 ComfyUI 生图服务地址；留空依次走百炼或本地 Pillow 确定性制图 |
| **百炼** | `CLOUD_LLM_PROVIDER` / `DASHSCOPE_API_KEY` | `dashscope` / 留空 | 填入阿里云百炼 Key 即调用 `qwen-plus` 与 `wanx2.1-t2i-turbo`，留空走本地模板 |
| **门禁** | `FFMPEG_BIN` / `VIDEO_ENGINE_ENABLED` | `ffmpeg` / `true` | 宿主机无 `ffmpeg` 时 M7-3 合成返回 `503 M7-5031` 硬门禁 |
| **安全** | `M7_STRICT_SEPARATION_OF_DUTIES` | `true` | **必须为 `true`**：强制执行提交人 ≠ 审批人 |
| **安全** | `JWT_SECRET_KEY` / `CORS_ORIGINS` | `change-me-in-local-env-only` | 鉴权签名串与允许跨域的前端源 |

---

## 四、全平台 33 张数据库表清单与表间关联关系

系统共有 **33 张表**，均通过 **`org_id`** 做租户隔离、通过 **`sku`** 做商品主线串联：

| 所属模块 | 数据表名 | 主键 | 关键外键 / 关联键 | 职责 |
| :--- | :--- | :--- | :--- | :--- |
| **M8** | `m8_users` / `m8_role_definitions` / `m8_approval_policies` | `user_id` / `role_code` / `policy_id` | `role_code` 关联角色权限矩阵；`allowed_shop_ids_json` 控制店铺数据权限 | 账号、9 岗位权限与 5 域 SoD 策略 |
| **M0** | `m0_shops` / `m0_sync_batches` / `m0_fx_rates` | `shop_id` / `batch_id` / `rate_id` | `m0_sync_batches.shop_id` → `m0_shops.shop_id` | 店铺接入、同步去重与汇率快照 |
| **M0** | `m0_products` / `m0_cost_requests` | `product_id` / `req_id` | `org_id + sku` 唯一；`proposer_id != reviewer_id` | **核心商品主档**与调价防自批流 |
| **M0** | `m0_orders` / `m0_inventory` / `m0_supplier_quotes` | `order_id` / `inv_id` / `quote_id` | `shop_id` + `sku` + `is_mock`（实盘隔离标志） | 订单流水、在手/在途/锁库库存与供应商报价 |
| **M4** | `m4_candidates` | `candidate_id` | `sku` → 过会后自动写入 `m0_products` 与 `m7_generation_jobs` | 选品池、五维评分、毛利与 IP 风险门禁 |
| **M7** | `m7_workflow_registry` / `m7_generation_jobs` | `workflow_id` / `job_id` | **FK** `workflow_id` → `m7_workflow_registry.workflow_id` | 工作流注册与异步任务幂等表 |
| **M7** | `m7_generation_assets` / `m7_generation_media` | `asset_id` / `media_id` | **FK** `job_id` → `m7_generation_jobs.job_id`；**FK** `asset_id` → `m7_generation_assets.asset_id` | 文案/图槽/A+ 资产（乐观锁 `version`）与媒体字节/IPTC 索引 |
| **M7** | `m7_compliance_rules` / `m7_cert_records` | `rule_id` / `cert_id` | `platform + category`；`sku` 关联资质效期 | 三层禁用词库与 FDA/FCC/CE 证书台账 |
| **M7** | `m7_compliance_checks` / `m7_approval_records` | `check_id` / `approval_id` | **FK** `rule_id`；**FK** `check_id`；`last_editor_id != approver_id` | 5 项硬门禁检查快照与上架审批（上游改稿自动失效旧审批） |
| **审计** | `core_audit_events` | `event_id` | `org_id + sku + module + trace_id` | **全平台不可篡改中文审计台账** |
| **M1** | `m1_faq_entries` / `m1_cs_sessions` | `faq_id` / `session_id` | `sku`（FAQ 同步喂给 M7-1）；`is_mock` 隔离 | 买家痛点/FAQ 与 WebSocket 会话台 |
| **M1** | `m1_aftersales_tickets` / `m1_aftersales_attachments` | `ticket_id` / `att_id` | `ticket_id` 关联多附件表；`submitter_id != approver_id` | 售后退款工单与 `multipart` 凭证附件 |
| **M2/M3** | `m2_ad_campaigns` / `m2_dashboard_layouts` / `m3_competitor_watches` | `campaign_id` / `layout_id` / `watch_id` | `org_id`（布局唯一）；`sku` 关联广告与竞品 | 广告预算、驾驶舱草稿/发布双态布局与竞品监控 |
| **M5/M6** | `m5_sales_history` / `m6_weekly_reviews` | `id` / `review_id` | `org_id + sku + sales_date` | 日粒度实盘销量（7 模型输入）与 WAPE 周复盘 |
| **M5/M6** | `m6_replenish_applies` / `m6_purchase_orders` / `m6_alert_events` | `apply_id` / `po_id` / `alert_id` | `apply_id` → `m6_purchase_orders.apply_id`；收货回写 `m0_inventory` | 补货申请、采购执行与预警中心 |

### 跨模块数据血缘全景图
```text
[M4 选品] m4_candidates ──(approver过会 APPROVED)──► [M0 主档] m0_products (origin=M4_APPROVED)
                                                            │
      ┌────────────(过会可选自动触发草稿)───────────────────┼──────► [M1 客服] m1_faq_entries ──(只读痛点)──┐
      ▼                                                     │                                              │
[M7 内容] m7_generation_jobs ──► m7_generation_assets ◄─────┴──────────────────────────────────────────────┘
                                       ├──► m7_generation_media (MinIO / m7_storage + IPTC)
                                       └──► m7_compliance_checks ──► m7_approval_records ──► .ZIP 合规交付包

[M0 实盘] m0_orders (is_mock=false) ──► [M5 预测] m5_sales_history (7模型 WAPE) ──► [M6 补货] m6_replenish_applies
                                                                                          │ (approver批准)
[M2/M3 BI] m2_dashboard_layouts (4卡并发) & 只读问数 ◄── 聚合 m0/m1/m2/m6 实盘            ▼
                                                                                    m6_purchase_orders
                                                                                          │ (warehouse质检收货)
                                                                                          ▼
                                                                                    更新 m0_inventory (on_hand+ / in_transit-)
```

---

## 五、端到端业务数据流实操演练（从选品到创作、客服、补货、驾驶舱）

打开 `http://127.0.0.1:5173`，通过左侧栏 **「当前登录岗位」** 切换角色，可按以下顺序完整跑通跨模块数据联动：

1. **M4 选品入池 → 过会同步 M0 主档与 M7 文案**
   - 切换为 **`吴选品 (selector)`**，进入 **「M4-1 选品导入 (`/m4/import`)」** 或 **「M4-2 评估工作台 (`/m4/workbench`)」**，导入或评估候选品并点击「保存并提交审批」（写 `m4_candidates`，`status=PENDING_APPROVAL`）。
   - 切换为 **`陈主管 (approver)`**，进入 **「M4-3 过会决策 (`/m4/approval`)」**，勾选自动触发 M7 文案草稿并点击「同意小批测款」→ **自动写 `m0_products`（RMB 成本按 `7.2` 换算美元）并生成 `m7_generation_jobs` + `m7_generation_assets` 初稿**。
2. **M7 文案 → AI 主图 → 5 项合规检查 → 离线导出**
   - 切换为 **`林设计 (creator)`**，在 **M7-1 (`/m7/copy`)** 自动看到 `m0_products` 参数与 `m1_faq_entries` 买家痛点；尝试输入 `Waterproof` 验证三层禁用词库标红提示。
   - 在 **M7-2 (`/m7/images`)** 生成 1+4 电商套图并测试 AI 人物 IPTC 标签读写修复。
   - 在 **M7-4 (`/m7/compliance`)** 运行 5 项检查 → 切回 **`陈主管 (approver)`** 点击「批准发布」→ 导出 `.zip` 离线合规交付包。
3. **M1 模拟买家隔离、WebSocket 推流与售后多附件**
   - 切换为 **`测试买家 (usr_buyer)`**，在 **M1-3 (`/m1/simulator`)** 提问（写 `m1_cs_sessions`，`is_mock=true`）；
   - 切换为 **`李客服 (cs)`**，在 **M1-1 (`/m1/sessions`)** 回复消息（触发 WebSocket 广播），并在 **M1-4 (`/m1/aftersales`)** 建退款单上传 `pdf/png/txt` 附件（写 `m1_aftersales_attachments`），再由 **`陈主管`** 审批退款。
4. **M5 7 模型预测 → M6 补货申请 → 采购收货回写 M0 库存**
   - 切换为 **`张运营 (planner)`**，在 **M5-2 (`/m5/forecast`)** 对比 7 个模型（含 Prophet/LightGBM/CatBoost）WAPE 误差；在 **M6-2 (`/m6/smart`)** 调参生成补货申请（写 `m6_replenish_applies`）。
   - 切换为 **`陈主管 (approver)`** 批准补货单（生成 `m6_purchase_orders` 并增加 `m0_inventory.in_transit`）→ 切换为 **`赵仓管 (warehouse)`** 在 **M6-4 (`/m6/receiving`)** 发货并收货（原子扣减 `in_transit`、增加 `on_hand`）。
5. **M2 驾驶舱与 M3 只读问数**
   - 切换为 **`周分析 (bi_analyst)`** 或 **`王总监 (manager)`**，在 **M2-2 (`/m2/overview`)** 查看隔离 `is_mock=false` 的实盘收益，在 **M3-2 (`/m3/ask`)** 测试只读经营问答与 `"DROP TABLE"` / `"修改价格"` 写删拦截。

---

## 六、预设 9 大账号清单（统一密码：`crosspilot123`）

| 登录用户名 (`user_id`) | 角色 (`role_code`) | 姓名 | 可访问模块边界 |
| :--- | :--- | :--- | :--- |
| `usr_manager` | `manager` | 王总监 | 全模块只读巡检、M0 店铺接入、M8 组织管理 |
| `usr_approver` | `approver` | 陈主管 | M0 调价 / M1 退款 / M4 过会 / M6 补货 / M7 上架全链路审批 |
| `usr_planner` | `planner` | 张运营 | M1 FAQ 维护、M2 驾驶舱设计器与广告调价、M5/M6 补货申请 |
| `usr_creator` | `creator` | 林设计 | M7 文案、AI 生图、视频/A+、合规预检与导出 |
| `usr_selector` | `selector` | 吴选品 | M4 选品评估、CSV 异步批量导入（`202`） |
| `usr_analyst` | `bi_analyst` | 周分析 | M2 看板、M3 竞品监控与只读问数、M5 预测周复盘 |
| `usr_warehouse` | `warehouse` | 赵仓管 | M0 库存盘点、M6 采购单发货/质检收货/消警 |
| `usr_cs` | `cs` | 李客服 | M1 客服消息回复、售后退款建单与凭证附件上传 |
| `usr_buyer` | `mock_buyer` | 测试买家 | 仅限 M1-3 咨询模拟沙盒（`is_mock=true` 严格隔离） |

---

## 七、Windows / macOS 本地常见坑与一键排查表

| 常见报错 / 现象 | 真实原因 | 一步解决方法 |
| :--- | :--- | :--- |
| `docker compose up` 报 `port 5432 / 6379 is already allocated` | 本地已装了别的 PostgreSQL / Redis 占用了端口 | 停掉本地旧服务（Windows 服务管理器停掉 `postgresql`），或改 `docker-compose.yml` 左边映射端口（如 `"5433:5432"`）并同步改 `.env` |
| Windows PowerShell 运行 `Activate.ps1` 报错禁止运行脚本 | Windows 默认 PowerShell 执行策略限制 | 执行 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`，或直接用 `.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000` |
| `pip install` 在 Windows 报错 `Microsoft Visual C++ 14.0 is required` | 本地用了 Python 3.13/3.14 导致依赖无预编译 wheel | 安装 **Python 3.11 或 3.12** 后重建 `.venv` 再 `pip install -r requirements.txt` |
| `alembic upgrade head` 报 `Connection refused` (5432) | 没启动 PostgreSQL 且 `.env` 仍是默认 PG 连接串 | 按第 3 步先起 `docker compose up -d postgres`，或按第 4 步改为 SQLite 连接串 |
| `alembic upgrade head` 报 `table already exists` | 先跑了 `uvicorn` 自动 `create_all` 建表，后跑了 `alembic` | 执行 `alembic stamp head` 同步版本号，或删掉测试 `.db` 重建后先运行 `alembic upgrade head` |
| Windows 本机跑 `celery worker` 报错崩溃 | Celery 5 默认 `prefork` 不支持 Windows 原生进程 | 加 `--pool=solo`：`celery -A app.core.cache_queue.celery_app worker --pool=solo -l info`；或用 Docker `--profile worker` |
| Windows 运行 `bash deploy/deploy.sh` 报 `$'\r': command not found` | Git 自动检出成 CRLF 换行 | 用 Git Bash 执行 `sed -i 's/\r$//' deploy/deploy.sh && ENABLE_WORKER=true ENABLE_APP=true bash deploy/deploy.sh` |
| M7-3 合成视频返回 `503 M7-5031` | 宿主机未装 `ffmpeg`（符合设计硬门禁） | 安装 `ffmpeg` 并重启后端即可产出 `.mp4`，或用 `docker compose --profile app up -d` |
| 前端 `/docs` 看不到 5 份 `.docx` 下载 | 拉取 GitHub 后还未解压 `docs-deliverables.zip` | 仓库根目录执行 `unzip -o docs-deliverables.zip -d docs/`（或 PowerShell `Expand-Archive`） |

---

## 八、百行级数据压测造数与高并发防爆保障（会炸吗？）

**结论：不会炸。** 针对你担心的“本地各业务表至少 100 条数据 + 多模块并发请求是否会锁库/爆连接池”，代码层已做以下 **5 项硬核并发加固**：

1. **PostgreSQL 连接池放大与断连自愈（`backend/app/core/database.py`）**：
   - 将默认 `pool_size=5` 提升为 **`pool_size=20, max_overflow=30`**（单节点最高可承载 50 路并发连接），并开启 `pool_pre_ping=True` 与 `pool_recycle=1800`，避免长连接失效或 M2 4 卡并发时连接池耗尽。
2. **SQLite 并发防锁死加固（`backend/app/core/database.py`）**：
   - 开启 **`PRAGMA journal_mode=WAL` + `PRAGMA synchronous=NORMAL` + `PRAGMA busy_timeout=15000` + `timeout=15.0`**，大幅降低多请求混写时的 `database is locked` 风险。
3. **长耗时导入与推流异步解耦**：
   - M4 大文件 CSV（≤25MB）通过 `POST /m4/candidates/import-csv-async` 立即返回 `202 Accepted` 后台独立会话跑批，不阻塞主事件循环；M1 WebSocket 由 `M1EventHub` 内存广播、数据库只做最终真源落盘。
4. **乐观锁并发写防覆盖**：
   - M7 文案编辑与 M2 驾驶舱布局保存均带 `version` 乐观锁，并发双开修改会安全返回 `409` 冲突提示而不是互相静默覆盖。
5. **本地一键填充 ≥100 条数据脚本（可选运行）**：
   - 默认启动的 `ensure_seed_data()` 仅种 5 个演示 SKU（保持界面清爽）；如果你想在本地直接压测 **每张核心表 ≥100 条数据** 的效果，可在 `backend/` 目录下运行内置幂等造数脚本：
     ```bash
     cd backend
     python scripts/seed_100_rows.py
     ```
   - 该脚本会幂等把 `m0_products`、`m0_orders`、`m4_candidates`、`m1_cs_sessions`、`m1_aftersales_tickets`、`m2_ad_campaigns`、`m3_competitor_watches` 补齐至 **100 条/表**、`m5_sales_history` 补齐至 **450 条**。
   - **实测基准**：`pytest` 中的 `test_100_rows_and_30_concurrent_requests` 已实测在各核心表 ≥100 条数据下同时并发发起 **30 路跨模块混合读写请求**（含 M2 4 卡并发、7 模型预测、M3 问数、M1 模拟进线），**30/30 全部 200 OK，无锁死、无崩溃**。
