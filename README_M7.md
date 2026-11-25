# CrossPilot M7 商品内容创作与合规交付系统 · 本地运行与测试指南

> **Git 分支与仓库路径**
> - **远程仓库**：`https://github.com/li2934026194/ai.git`
> - **开发分支**：`arena/20303949-ai`
> - **M7 后端代码目录**：`backend/`（与原 `pilot/` 目录完全隔离）
> - **M7 前端代码目录**：`frontend/`（与原 `pilot/frontend/` 完全隔离）

---

## 一、目录结构与代码路径索引

```text
ai/
├── backend/                          # M7 FastAPI 异步后端工程
│   ├── .env.example                  # 环境变量模板（复制为 .env 后本地填写）
│   ├── requirements.txt              # Python 依赖清单
│   ├── alembic.ini & alembic/        # 异步数据库迁移脚本（9 张表）
│   ├── app/
│   │   ├── main.py                   # FastAPI 入口、/healthz、/m7/health、/m7/audit
│   │   ├── core/                     # auth_rbac(9角色)、tenant、audit、storage、async_jobs
│   │   ├── contracts/                # M0-2 商品主档 & M1-2 FAQ 只读契约
│   │   ├── mocks/seed_data.py        # 5 个演示 SKU、12 条规则矩阵、7 条资质台账种子
│   │   └── modules/m7_content/       # M7 核心业务域（router/schemas/models/repository/services/domain/adapters）
│   └── tests/                        # 15 个自动化测试用例（test_step1~test_step5）
├── frontend/                         # M7 Vue 3 + TypeScript + Vite 前端工程
│   ├── vite.config.ts                # 开发服务器 5173 及 /api -> 127.0.0.1:8000 代理配置
│   ├── nginx.conf.example            # 生产环境 Nginx 反代模板
│   └── src/
│       ├── api/                      # Axios 拦截器 & 22+ M7 API 绑定
│       ├── stores/                   # Pinia：m7Workspace / m7Copy / m7Media / m7Compliance
│       ├── composables/              # usePermission(9角色) / useJobPolling / useRelayProgress
│       ├── components/               # M7Sidebar / M7RelayBar
│       ├── router/index.ts           # /m7/copy, /m7/images, /m7/video-aplus, /m7/compliance
│       ├── views/m7/                 # M7-1 ~ M7-4 四大业务视图
│       └── __tests__/m7.spec.ts      # Vitest 组件与权限单元测试
└── docs/
    ├── detailed-design.docx          # M7 详细设计说明书
    └── requirements/
        ├── CrossPilot-M7商品内容创作与合规交付概要设计说明书.docx
        └── CrossPilot-M7商品内容创作与合规交付测试用例.docx
```

---

## 二、拉取代码到本地

```bash
git clone https://github.com/li2934026194/ai.git
cd ai
git fetch origin arena/20303949-ai
git checkout arena/20303949-ai
```

如果本地已经有仓库，直接拉取更新即可：

```bash
git fetch origin
git checkout arena/20303949-ai
git pull origin arena/20303949-ai
```

---

## 三、本地运行环境准备

| 组件 | 版本要求 | 说明 |
| --- | --- | --- |
| **Python** | 3.11+ | 运行后端 FastAPI、SQLAlchemy 2.0、Pillow、Pytest |
| **Node.js / npm** | Node 18+ / npm 9+ | 运行前端 Vue 3 + Vite + TypeScript + Vitest |
| **FFmpeg**（可选） | 系统命令行 `ffmpeg` | **不装也能启动**：未安装时 M7-3 会真实触发 `503 M7-5031` 门禁演示；安装后可合成真实 15s `.mp4` |
| **阿里云百炼 Key**（可选） | `DASHSCOPE_API_KEY` | **不填也能运行**：留空时自动切换为本地合规模板 + Pillow 制图兜底模式 |

---

## 四、本地启动步骤（双终端）

### 终端 1：启动 M7 后端服务（默认端口 `8000`）

1. **创建虚拟环境并安装依赖**
   - **macOS / Linux**：
     ```bash
     cd backend
     python3 -m venv .venv
     source .venv/bin/activate
     pip install -r requirements.txt
     ```
   - **Windows (PowerShell)**：
     ```powershell
     cd backend
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     pip install -r requirements.txt
     ```

2. **配置本地环境变量 `.env`**
   ```bash
   cp .env.example .env
   ```
   > `backend/.env` 中默认已配好 SQLite (`sqlite+aiosqlite:///./m7_dev.db`) 与 `M7_STRICT_SEPARATION_OF_DUTIES=true`。如需启用真实阿里云百炼大模型，可在本地 `.env` 中填入 `DASHSCOPE_API_KEY=你的密钥`（**切勿提交 `.env` 到 Git**）。

3. **初始化数据库并启动服务**
   ```bash
   alembic upgrade head
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   启动成功后可验证：
   - 健康检查：`http://127.0.0.1:8000/healthz`
   - M7 引擎探测：`http://127.0.0.1:8000/api/v1/orgs/org_demo/m7/health`
   - FastAPI 自动接口文档（Swagger）：`http://127.0.0.1:8000/docs`

### 终端 2：启动 M7 前端界面（默认端口 `5173`）

```bash
cd frontend
npm install
npm run dev
```

启动成功后在浏览器打开：
- **工作台入口**：`http://127.0.0.1:5173/m7/copy`（会自动通过 Vite Proxy 把 `/api` 转发到 `http://127.0.0.1:8000`）

---

## 五、自动化测试运行方法

### 1. 后端全量测试（15 个自动化用例）
在已激活 `backend/.venv` 的终端中执行：
```bash
cd backend
pytest -v
```
涵盖内容：
- `test_step1_foundation.py`：9 张表结构、密钥脱敏、`FileStorage` 魔数拦截与路径穿越防护、9 角色权限、跨租户隔离；
- `test_step2_domain_adapters.py`：三层词库扫描、UTF-8 字节边界、`ALL CAPS` 软提示、Pillow IPTC/XMP 写入/剥离/重写、资质 `T-1/T/T+1` 边界、百炼兜底与 `503 M7-5031` 门禁；
- `test_step3_api_endpoints.py`：22+ REST 接口联调、幂等键、乐观锁 `409 M7-4091`、保留图文不产空 `.mp4`、同人禁自批 `403 M7-4032`、上游变更失效旧审批、`.zip` / `.html` 导出；
- `test_step5_security_and_isolation.py`：全部 9 角色逐个验证、跨组织 `org_demo` vs `org_other` 隔离、全部 5 个种子 SKU 加载、空白文本/指令拦截、干净库 `alembic upgrade head`。

### 2. 前端单元测试、类型检查与打包构建
```bash
cd frontend
npm run test       # 运行 Vitest 单测（9 角色矩阵、防正则崩溃/XSS、空值拦截、无 NaN 预览）
npm run typecheck  # vue-tsc --noEmit 严格 TypeScript 校验
npm run build      # 生成生产静态产物 dist/
```

---

## 六、前端界面人工走查建议路线（5 分钟体验闭环）

打开 `http://127.0.0.1:5173/m7/copy`，默认角色为 **内容创作 / 审核人员 (林设计)**：

1. **M7-1 多语言商品文案（`/m7/copy`）**
   - 点击品牌词快捷芯片（如 `+ USB-C`）、点击「✨ 生成 3 组合规候选文案」或「⚡ 一键采纳 4 类核心文案」；
   - 在编辑框输入 `Velcro` / `Waterproof` 验证红底下划线高亮、改写建议（`hook and loop` / `Water-resistant`）及保存拦截；
   - 输入 `AMAZING` 验证黄色软提示不阻断保存；保存后点击「↩ 一键还原 AI 原稿」确认恢复初始稿。

2. **M7-2 主图与详情套图（`/m7/images`）**
   - 勾选/取消 AI 合成人物出镜，点击「🎨 生成并落盘 1+4 电商套图」；
   - 测试「仅重绘当前图位」和「局部修改当前选中图位」（查看修改前后对比弹窗）；
   - 点击「🧪 模拟裁剪丢失标签」→「🔍 真实读盘校验」→「🛠 一键重写入并修复标签」。

3. **M7-3 短视频与 A+ 长页（`/m7/video-aplus`）**
   - 在 3 段分镜中点击「📥 引用M7-1」自动填充字幕；
   - 若本机未装 FFmpeg，点击「🎬 合成 15 秒竖屏短视频」将触发真实的 **`503 M7-5031`** 阻断提示，同时顶部核心交付进度保持已有图文成果不丢失；若本机已安装 `ffmpeg` 且 `.env` 中 `VIDEO_ENGINE_ENABLED=true`，将真实合成可播放的 15 秒 `.mp4`；
   - 点击「🧩 一键组装 A+ 图文详情长页」查看组装结果。

4. **M7-4 合规检查、职责分离审批与离线导出（`/m7/compliance`）**
   - 点击「🛡 1. 运行 5 项上架合规检查」查看逐项检查与缺失一键跳修；
   - 在「6 页签成品总览」切换查看 **买家视角预览**（「预览，尚未发布」横幅）、**审计台账**（全量中文操作留痕）；切换至 `COS-052` 验证无划线价不显示 `NaN` 且能看到过期资质阻断；
   - 在林设计（`creator`）身份下，「主管批准发布包」为禁用状态；在左侧栏切换为 **主管 / 审批人 (陈主管)** 后即可执行批准并下载 `.ZIP` / `.HTML` 离线交付包；
   - 切换为 `bi_analyst` / `warehouse` / `cs` / `mock_buyer` 验证 403 权限隔离提示页。

---

## 七、常见问题排查

- **Q1：运行 `pytest` 报错 `ModuleNotFoundError: No module named 'app'`**
  - 确认是在 `backend/` 目录下运行 `pytest`（`backend/pyproject.toml` 已配置 `pythonpath = ["."]`），且已激活 `backend/.venv`。
- **Q2：点击合成短视频提示 `503 M7-5031`**
  - 这是**符合设计的真实门禁**：说明本机未安装 `ffmpeg` 或 `.env` 中设置了 `VIDEO_ENGINE_ENABLED=false`。安装 `ffmpeg` 并确保命令行可直接执行 `ffmpeg -version` 后重启后端即可合成 `.mp4`。
- **Q3：前端页面请求接口报 404 或网络错误**
  - 检查终端 1 的 `uvicorn` 是否监听在 `8000` 端口；前端必须通过 Vite 的 `http://127.0.0.1:5173` 访问，不可直接用 `file://` 打开 `index.html`。
