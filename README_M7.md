# CrossPilot M7 商品内容创作与合规交付系统

本目录实现了与 `pilot/` 完全隔离的 M7 前后端独立工程（技术栈严格对齐《AI跨境电商平台V1.1-架构与需求》与 `docs/detailed-design.docx`）。

## 技术栈
- **前端 (`frontend/`)**：Vue 3 (`<script setup>`) + TypeScript + Vite + `vue-tsc` + Vue Router 4 + Pinia + Axios + Vitest
- **后端 (`backend/`)**：Python 3.11+ + FastAPI + Pydantic v2 + SQLAlchemy 2.0 Async + Alembic + PostgreSQL 15+（本地开发兼容 SQLite `aiosqlite`）+ Pillow (IPTC/XMP) + FFmpeg + 阿里云百炼 (`dashscope`) 双模式适配

## 快速启动

### 1. 后端 API (`backend/`)
```bash
cd backend
cp .env.example .env
# 在本地 .env 中按需填写 DASHSCOPE_API_KEY（留空则自动使用本地合规模板与 Pillow 渲染回退）
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. 前端 SPA (`frontend/`)
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```
前端内置 Vite `/api` 与 `/healthz` 反向代理至 `127.0.0.1:8000`，生产环境可参考 `frontend/nginx.conf.example`。

## 核心验证命令
- 后端全量测试（15 个用例，覆盖基础契约、词库/IPTC/5项校验、503 视频门禁、9角色 RBAC、多租户隔离、Alembic 迁移、ZIP/HTML 导出）：
  ```bash
  cd backend && pytest -v
  ```
- 前端类型检查、单测与生产构建：
  ```bash
  cd frontend && npm run test && npm run typecheck && npm run build
  ```

## 安全与红线说明
1. **视频合成硬门禁**：当 `VIDEO_ENGINE_ENABLED=false` 或系统未安装 `ffmpeg` 时，`/videos/generate` 严格返回 `503 M7-5031`，绝不伪造空 `.mp4` 文件，且完整保留已完成的文案与 1+4 套图。
2. **职责分离（禁自批）**：`M7_STRICT_SEPARATION_OF_DUTIES=true` 时，同一操作人或 `creator` 角色尝试批准发布包会被拦截为 `403 M7-4032`，且任何上游修改均自动失效旧审批。
3. **秘钥安全**：仓库仅提供 `backend/.env.example`，绝不提交 `.env` 或真实 `DASHSCOPE_API_KEY`。
