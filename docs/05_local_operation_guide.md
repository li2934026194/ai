# CrossPilot AI 全平台（M0–M8）本地运行、Docker 编排与实操手册

> 本文档面向本地开发、答辩演示、测试验收与 Docker 容器化部署，完整覆盖 **零依赖极速本地模式**、**Docker Compose 生产/教师技术栈全栈模式**、**外部 AI 能力接通（DashScope / Vanna 2 / ComfyUI / Milvus）** 以及 **全量自动化测试与常见故障排查**。

---

## 一、环境准备与前置要求

| 组件 | 最低版本 | 用途 | 是否必装 |
| :--- | :--- | :--- | :--- |
| **Git** | 2.35+ | 拉取源码与切换分支 `arena/20303949-ai` | 必装 |
| **Python** | 3.11+ | 运行 FastAPI + SQLAlchemy 2.0 后端及 `pytest` | 本地直跑必装 |
| **Node.js / npm** | Node 20+ / npm 10+ | 运行 Vue 3 + Vite 6 前端及 `vitest` / `playwright` | 本地直跑必装 |
| **Docker & Compose** | Docker 24+ / Compose v2 | 一键拉起 PostgreSQL 16、Redis 7、MinIO、Celery、Milvus 与前后端容器 | 容器化部署必装 |
| **FFmpeg**（可选） | 系统命令行 `ffmpeg` | M7-3 合成真实 15s MP4 视频（未安装时安全触发 `503 M7-5031` 门禁演示） | 可选 |

---

## 二、方式 A：零外部依赖极速本地运行（推荐首次快速体验）

不需要安装 PostgreSQL、Redis、MinIO 或申请任何 API Key，5 分钟即可在本地跑通 M0–M8 全部业务与 `/docs` 文档中心。

### 1. 拉取代码并切到工作分支

```bash
git clone https://github.com/li2934026194/ai.git
cd ai
git fetch origin arena/20303949-ai
git checkout arena/20303949-ai
```

### 2. 启动后端（端口 `8000`）

**macOS / Linux：**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 零外部中间件兜底模式（自动使用 SQLite + 本地磁盘存储 + 内存缓存）
export DATABASE_URL="sqlite+aiosqlite:///./crosspilot_local.db"
export STORAGE_BACKEND="local"
export REDIS_URL=""
export MILVUS_URI=""
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Windows (PowerShell)：**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

$env:DATABASE_URL="sqlite+aiosqlite:///./crosspilot_local.db"
$env:STORAGE_BACKEND="local"
$env:REDIS_URL=""
$env:MILVUS_URI=""
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> 后端启动时会自动建表并初始化演示组织 `org_demo`、5 个演示 SKU 与 9 个预设账号。

### 3. 启动前端（另开一个终端，端口 `5173`）

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 **`http://127.0.0.1:5173`** 即可进入系统；也可访问 **`http://127.0.0.1:8000/docs`** 查看后端 Swagger 接口文档，或访问前端菜单 **「交付文档中心 (`/docs`)」** 在线阅读与下载全部 `.md`/`.docx` 规范。

---

## 三、预设登录账号（9 大 RBAC 角色）

前端界面打开即可通过左侧栏「当前登录岗位」下拉框一键切换 9 大角色；后端登录接口 `POST /api/v1/auth/login` 预设演示账号如下（统一密码 **`crosspilot123`**）：

| 用户名 (`user_id`) | 角色 (`role_code`) | 中文职责 | 主要可访问模块 |
| :--- | :--- | :--- | :--- |
| `usr_manager` | `manager` | 大屏浏览者 / 管理者 | 全模块只读、M0 店铺接入、M8 组织管理 |
| `usr_approver` | `approver` | 主管 / 审批人 | M0/M1/M4/M6/M7 全链路审批与合规规则维护 |
| `usr_planner` | `planner` | 驾驶舱设计者 / 业务运营 | M2 驾驶舱设计器（草稿/发布/4卡问数）、广告预算、M5/M6 申请 |
| `usr_creator` | `creator` | 内容创作 / 审核人员 | M7 文案、AI 生图、视频/A+、合规检查与出口包 |
| `usr_selector` | `selector` | 选品研究员 | M4 选品评估、CSV 异步导入（202） |
| `usr_analyst` | `bi_analyst` | 数据分析 / BI 人员 | M2 经营看板、M3 竞品监测与只读智能问数 |
| `usr_warehouse` | `warehouse` | 采购 / 仓库 / 物流人员 | M0 库存盘点、M6 采购收货入库 |
| `usr_cs` | `cs` | 客服 | M1 客服工作台、FAQ、售后工单与附件上传 |
| `usr_buyer` | `mock_buyer` | 测试买家 | M1 模拟买家中控台（数据打标 `is_mock=true` 严格隔离） |

---

## 四、方式 B：Docker Compose 生产技术栈全栈启动（PostgreSQL + Redis + MinIO + Celery + Milvus）

仓库根目录已提供完整的 `docker-compose.yml`、`backend/Dockerfile`、`frontend/Dockerfile` 与 `frontend/nginx.conf.example`：

### 1. 启动核心中间件（PostgreSQL 16 + Redis 7 + MinIO 对象存储）

```bash
docker compose up -d postgres redis minio minio-init
```

各组件默认地址与凭据（可在 `backend/.env` 中修改）：
- **PostgreSQL 16**：`postgresql+asyncpg://crosspilot:crosspilot123@127.0.0.1:5432/crosspilot`
- **Redis 7**：`redis://127.0.0.1:6379/0`
- **MinIO**：S3 API `http://127.0.0.1:9000` / 控制台 `http://127.0.0.1:9001`（账号 `minioadmin` / 密码 `minioadmin`，自动初始化桶 `crosspilot-assets`）

### 2. 按需启用 Celery Worker / Beat 与 Milvus 向量库

```bash
# 启动 Celery 异步 Worker 与 Beat 定时任务
docker compose --profile worker up -d celery-worker celery-beat

# 可选：启动 Milvus v2.4.15 向量检索引擎（用于 M1 FAQ 语义检索）
docker compose --profile vector up -d etcd milvus
```

### 3. 运行 Alembic 数据库迁移（或直接启动全栈容器）

```bash
# 本地连接 Docker Postgres 执行迁移并启动后端：
cd backend
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 或直接用 Docker Compose 一键启动全栈前后端容器（Nginx 含 WebSocket /ws/ 反代）：
docker compose --profile app --profile worker up -d --build
```

启动后验证依赖矩阵：
```bash
curl -s http://127.0.0.1:8000/healthz | python3 -m json.tool
```
返回中可见 `db.ok: true`、`storage`（`minio` 或 `local`）、`cache_queue`（`redis` + `celery`）、`vector_store`（`milvus` 或 `keyword_fallback`）及 `vanna` / `comfyui` 就绪状态。

---

## 五、方式 C：接通外部 AI 引擎与可选算法库

在 `backend/.env` 中配置以下变量即可无缝切换至真实 AI 外部服务（留空时均自动使用内置确定性引擎兜底，绝不报错阻塞演示）：

| 环境变量 | 说明 | 对应模块 |
| :--- | :--- | :--- |
| `DASHSCOPE_API_KEY` | 阿里云百炼 API Key（通义千问 Qwen + 万相 Wanxiang） | M7 文案与主图生成 |
| `VANNA_BASE_URL` | Vanna 2 HTTP 服务地址（如 `http://127.0.0.1:8084`） | M3 只读智能问数 |
| `COMFYUI_BASE_URL` | ComfyUI 服务地址（如 `http://127.0.0.1:8188`） | M7 ComfyUI 生图流水线 |

如需在 M5 销量预测中使用原生 `prophet` / `lightgbm` / `catboost` 第三方库，可在虚拟环境中按需安装；未安装时系统内置对应的确定性趋势/残差提升/星期特征树算法 (`f_prophet_trend` / `f_lightgbm_gbdt` / `f_catboost_tree`)，返回平滑无 NaN 的多模型预测对比。

---

## 六、CI/CD 与生产脚本

- **Jenkins 流水线**：根目录 [`Jenkinsfile`](../Jenkinsfile) 定义了 后端 `pytest` + 前端 `vue-tsc` / `vitest` / `vite build` + Docker 镜像构建全流程。
- **一键部署脚本**：[`deploy/deploy.sh`](../deploy/deploy.sh) 支持 `ENABLE_WORKER=true ENABLE_APP=true bash deploy/deploy.sh`（按需加 `ENABLE_VECTOR=true`）拉起容器编排并等待 PostgreSQL 就绪，后端镜像入口自动执行 `alembic upgrade head` 后启动 Uvicorn。
- **Nginx 反向代理**：[`frontend/nginx.conf.example`](../frontend/nginx.conf.example) 已配置 `client_max_body_size 30m`（支撑 M4 25MB CSV 异步导入与 M1 多附件上传）及 `/api/v1/orgs/*/m1/ws/` WebSocket 升级头。

---

## 七、全量自动化测试与端到端校验命令

### 1. 后端单元测试、冒烟、压测与迁移校验（37 项）

```bash
cd backend
pytest -v
```
涵盖：
- 24 项模块端到端冒烟（`TC-*-SMK-*`）与并发压测（`TC-*-PRF-*`）
- 9 角色 RBAC 权限矩阵、SoD 互斥校验与跨组织 403/404 隔离
- Alembic 全量建表（`0001` ~ `0003`）
- M1 WebSocket 心跳广播与 `multipart/form-data` 附件上传校验
- M2 驾驶舱草稿/乐观锁（409）/发布与 4 卡独立会话并发问数
- M4 异步 CSV 导入 `202 Accepted` 与任务轮询
- M5 `prophet` / `lightgbm` / `catboost` 模型输出稳定性

### 2. 前端类型检查、组件单测与生产构建（34 项）

```bash
cd frontend
npx vue-tsc --noEmit
npm test -- --run
npm run build
```

### 3. Playwright 真实浏览器端到端 E2E 测试（本地可选运行）

```bash
cd frontend
npx playwright install chromium
npx playwright test
```

---

## 八、常见故障排查

| 现象 | 原因 | 解决方法 |
| :--- | :--- | :--- |
| `401 / 403` 登录失败 | 使用了非演示密码或旧浏览器缓存 | 演示账号统一密码为 `crosspilot123`；清空 `localStorage` 后重新登录 |
| PostgreSQL 连接拒绝 | 未启动 Docker Postgres 或密码不匹配 | 运行 `docker compose up -d postgres` 并核对 `backend/.env` 中 `DATABASE_URL` |
| `alembic upgrade head` 报列已存在 | 旧库由 `Base.metadata.create_all` 初始化过 | 执行 `alembic stamp head` 同步版本号，或删库重建后执行 `alembic upgrade head` |
| 售后附件上传 `422` | 超过 5MB/单文件、超过 10 个附件或扩展名非法 | 仅支持 `pdf/jpg/jpeg/png/docx/txt`，单文件 ≤ 5MB |
| M7-3 视频合成返回 `503` | 宿主机未安装 `ffmpeg` | 属预期硬门禁保护（不会破坏已有图片资产）；安装 `ffmpeg` 后重试即可 |
