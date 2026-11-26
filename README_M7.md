# CrossPilot AI 跨境电商智能协作平台 · 快速启动与文档入口

> **推荐优先阅读完整版全平台实操手册**：[`docs/05_local_operation_guide.md`](docs/05_local_operation_guide.md)（含零依赖 SQLite 极速模式、Docker Compose PG/Redis/MinIO/Celery/Milvus 全栈编排、9 角色账号密码 `crosspilot123` 与全量测试命令）。

> **完整项目交付文档索引**：[`docs/00_docs_index.md`](docs/00_docs_index.md)（总需求、总概要设计、总详细设计、总测试用例与报告、实操手册）。

---

## 一、目录结构与代码路径索引

```text
ai/
├── docker-compose.yml                # PG 16 + Redis 7 + MinIO + 可选 Celery worker / Milvus / app
├── Jenkinsfile & deploy/deploy.sh    # CI/CD 流水线与一键部署脚本
├── backend/                          # FastAPI 异步后端工程（M0–M8 模块化单体）
│   ├── Dockerfile                    # 容器镜像（内置 ffmpeg 与 alembic upgrade head 启动入口）
│   ├── .env.example                  # 环境变量模板（默认指向 Docker PG/Redis/MinIO）
│   ├── requirements.txt              # Python 依赖清单
│   ├── alembic.ini & alembic/        # 异步数据库迁移脚本（0001~0003，33 张表）
│   ├── app/
│   │   ├── main.py                   # FastAPI 入口、/healthz、/api/v1/docs/*、全模块路由挂载
│   │   ├── core/                     # auth_rbac(9角色)、tenant、audit、storage、cache_queue、docs_router
│   │   ├── contracts/                # M0 商品主档 & M1 FAQ 只读契约
│   │   ├── mocks/seed_data.py        # 演示组织 org_demo、5 个主档 SKU、9 岗位账号与业务种子数据
│   ├── scripts/seed_100_rows.py  # 百行级压测造数脚本（填充 ≥100 行/表，450 条销量历史）
│   └── tests/                    # 38 项自动化测试（功能、冒烟、压测、RBAC、迁移、V1.1 升级）
├── frontend/                     # Vue 3.5 + TypeScript + Vite 6 前端工程（29 个统一设计页面）
│   ├── Dockerfile & nginx.conf.example # 生产镜像与 Nginx 代理（含 30MB 上传与 /ws/ 升级头）
│   ├── vite.config.ts                # 开发服务器 5173 及 /api (+ws) -> 127.0.0.1:8000 代理
│   ├── playwright.config.ts & e2e/   # Playwright 端到端冒烟骨架
│   └── src/__tests__/                # 34 项 Vitest 组件与全页面 DOM 冒烟测试
└── docs/                             # 5 份总项目交付文档 (.md + .docx) + 3 份老师原件 (requirements/)
```

---

## 二、零依赖极速启动（双终端）

### 终端 1：后端（端口 `8000`）

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

export DATABASE_URL="sqlite+aiosqlite:///./crosspilot_local.db"
export STORAGE_BACKEND="local"
export REDIS_URL=""
export MILVUS_URI=""
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
> 如需连接 Docker PostgreSQL / Redis / MinIO，请执行 `docker compose up -d postgres redis minio minio-init` 后复制 `.env.example` 为 `.env`，运行 `alembic upgrade head` 再启动 `uvicorn`。

### 终端 2：前端（端口 `5173`）

```bash
cd frontend
npm install
npm run dev
```

访问 **`http://127.0.0.1:5173`**（工作台）、**`http://127.0.0.1:5173/docs`**（站内文档中心）或 **`http://127.0.0.1:8000/docs`**（Swagger 接口文档）。

---

## 三、自动化测试命令

```bash
# 后端全量测试（38 项）
cd backend && pytest -v

# 前端类型检查、Vitest（34 项）与生产构建
cd frontend && npm run typecheck && npm test -- --run && npm run build
```
