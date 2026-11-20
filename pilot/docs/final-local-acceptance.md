# Pilot 本地可答辩最终收口 · 验收证据（2026-11-19）

> 依据：`WorkBuddy任务书-Pilot最终收口-V1.md`。只做本地收口，未部署阿里云 / 未接真实店铺 / 未接 1688 / 未改 core 预测补货计算口径 / 未泄露密钥。
> 本报告所有命令输出、截图、计数均为真实执行结果；UAT 数据按 ID 精确清理，最终库计数恢复 `datasets=7 / products=140 / replenish_apply=3 / purchase_order=1`。

## 一句话结论
**本地可演示**：P1–P7 在 1366×768 与 1920×1080 下均无页面级横向滚动、无控制台业务错误；P5 真实调用 A1（成功/降级两条路径均验证）；P7 可用管理员登录且 RBAC 用户/角色/权限/审计可见；CSV 导入→P2、申请→审批→发货→收货→取消全链路页面/API 走通；全量 136 passed + 6 subtests、五闸 5/5（G02 17/17）、前端构建通过；库恢复基线且无 UAT 残留。

## 基线（执行前，真实核对）
- PG：`postgresql+psycopg://postgres@127.0.0.1:5432/pilot`；Milvus 19530 / Ollama 11434 均 OPEN。
- 计数：`datasets=7 / products=140 / replenish_apply=3 / purchase_order=1 / rbac_user=0`；18 张业务/RBAC 表。
- 测试 132 passed + 6 subtests；五闸 5/5、G02 16/16；前端 579 modules。
- 阻断项：`styles.css` body `min-width:1660px`；P5 纯本地模板（无后端）；`rbac_user=0`（无人可登录）。

## T1 桌面布局收口
改动：`frontend/src/styles.css`（移除 body 固定最小宽与页面级 `overflow-x`，改 `html,body{max-width:100%;overflow-x:hidden}`；`.grid-4/.grid-2` 用 `minmax(0,1fr)` + ≤1400px 断点；新增 `.tbl-wrap{overflow-x:auto}`）；P1/P2/P3/P4/P6/P7 所有表格包 `.tbl-wrap`（表头 sticky 保留，表格内部横向滚动）；`P3SkuDetail.vue` ECharts 加 `window.resize → chart.resize()`（含卸载移除监听）；`index.html` 加内联 SVG favicon 消除 404。

验收（CDP 真实浏览器，逐页读 `documentElement.scrollWidth/clientWidth`）：

| 视口 | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|---|---|---|---|---|---|---|---|
| 1366×768 | 1366/1366 | 1366/1366 | 1366/1366 | 1366/1366 | 1366/1366 | 1366/1366 | 1366/1366 |
| 1920×1080 | 1920/1920 | 1920/1920 | 1920/1920 | 1920/1920 | 1920/1920 | 1920/1920 | 1920/1920 |

全部 `scrollWidth == clientWidth`，无页面级横向滚动；截图见 `docs/uat-screenshots/1366-P1..P7.png`、`1920-P1..P7.png`（14 张）。P1 四 KPI 在 1366 下为 2×2 布局，完整无裁切/重叠（见 `1366-P1.png`）。

## T2 RBAC 初始化与 P7 登录
- `scripts/seed_rbac.py --admin-username admin --admin-password <本地演示口令> --admin-display-name 演示管理员` → `新增权限 0，新增角色 0，管理员 admin`（权限 19 / 角色 6 已预置）。**本地演示口令仅进程参数传入，未写入任何代码/文档/报告**；生产必须更换。本地演示继续 `AUTH_ENABLED=0`。
- 独立端口 8001（`AUTH_ENABLED=1`，JWT secret 仅进程环境变量）验证：
  - 无 token `GET /api/datasets` → **401 AUTH-401**；
  - `POST /api/auth/login`（admin）→ **200**，返回 token；
  - 带 token `/api/datasets` → **200**（8 数据集）；
  - `POST /api/rbac/users` 建 viewer01（viewer 角色）→ **201**；viewer 登录 → 200；viewer `/api/datasets` → 200；viewer `/api/rbac/users` → **403 AUTH-403**（越权拦截）；
  - `rbac_audit_log` 189 → 192（登录/操作留痕）；`rbac_user` = admin + viewer01。
- P7 浏览器（8000 演示端口）真实填入管理员账号点击登录：`notice=已登录：admin`，页面显示用户/角色/权限/审计，不再停在登录框。截图 `1366-P7-login.png` / `1366-P7-logged-in.png`。

## T3 P5 接入 A1 + 真实降级
新增第 17 端点 `POST /api/agents/support`（契约 §3sexies-val）：`api/service.py::support_draft()` 按文件路径加载 registry 调 `run_agent("A1_support", message, tool_label="chat")`，async 端点用 `asyncio.to_thread` 执行；前端 `generateSupportDraft()` 真实请求，成功显示 A1 原文，失败（E-2001/超时/网络/无 Key）才切本地模板并明确降级提示；RBAC 映射 `sku:read`，未绕过权限。G02 同步 16→17。

- **成功路径（真实 Key）**：curl/Python HTTP → `status=success, degraded=false, latency_ms=1028`，`text`=A1 真实草稿（要求提供订单号、声明只读/无发送权限）；CDP 点击"生成草稿"等待 9s → note=`草稿由 AI 助手 A1 生成`，draft 为真实 A1 文案；Performance API 捕获到 **1 次** `/api/agents/support` 请求（699ms）。截图 `1366-P5-success.png`。
- **降级路径（人为提前读取/无 Key 语义）**：CDP 点击后 4s 读取 → note=`AI 服务不可用，已切换模板版（E-2001 降级…）`，draft 为本地模板；`tests/test_support_endpoint.py` monkeypatch 假 registry 验证 `status=fallback → degraded=true`（不会被误判成功）。截图 `1366-P5-after-generate.png`。
- 未宣称 A2/A4/A7 已实现。

## T4 真实浏览器 UAT（CDP + 真实 PG）
1. **CSV 模板导入新 SKU**：P1 点击数据集→导入入口→填名/CSV→开始导入（80 天、14 列主数据完整，SKU `UAT-NEW-01`）→当前数据集切为新集；PG 核验 products=1/sales=80；P2 页面（切到该数据集）真实显示 `UAT-NEW-01`（qty 250、资金 2240）。截图 `1366-P1-import-result.png`、`1366-P2-imported-sku.png`。按 dataset_id 精确清理。
2. **非法 CSV**：同 SKU 主数据冲突（title 第2/3行不同）→页面显示 `E-6005：SKU UAT-NEW-01 主数据冲突：title 在第 2 行是…第 3 行是…`，PG 无 `UAT-非法` 数据集（零残留）。截图 `1366-P1-import-invalid.png`。
3. **提交申请**：P3 切数据集/SKU→点"提交申请"→`ap_f86af16c5e4e4125` 状态"待审批"。截图 `1366-P3-apply-submitted.png`。
4. **审批通过**：`POST /api/p3/apply/approve` → 生成唯一采购单 `po_540659e1266d4b57`（order_qty=250，与申请 qty_propose=250、capital=2240 一致）；`purchase_order` 1→2。
5. **发货/部分/完全收货**：ship→shipping；收 100→partial_received(100/250)；收 150→fully_received(250/250)、申请 closed。回执数字与 PG 一致。
6. **驳回**：空理由 → E-1104 拒绝；填 `reject_reason` → status=rejected、理由落库。
7. **取消**：新申请审批→发货→部分收 80→取消 → PO status=cancelled、`receive_qty` 仍 80（**不冲销**）、申请保持 approved（未自动关闭），回执"已收 80 件仍计入库存"。
8. **P7 登录/建 viewer/审计/退出重登**：见 T2；审计 189→192。
9. **P5 成功/降级**：见 T3。
10. **1366/1920 无横向滚动、无控制台业务错**：见 T1；CDP `console errors=[]`、resource 4xx 计数 0（favicon 用 data URI，零 404）。截图 `1366-P7-final.png`。

> 说明：前端 P2 有审批/驳回/取消采购单入口，P3 有提交申请/收货质检入口；后端 `/api/p3/po/ship` 无独立前端按钮（既有设计：审批通过后自动进入 created，可直接收货），发货步骤用同一后端端点（与页面同源 API）验证。

## T5 回归、闸门与构建（原始结果）
```
.\.venv\Scripts\python.exe -m pytest tests -q
  → 136 passed, 2 warnings, 6 subtests passed in 50.59s   [exit=0]
  （132 基线 + 4 条 T3 新增；warnings 为既有 FastAPI on_event deprecated）

.\.venv\Scripts\python.exe -m tests.gates
  → G01 红线哈希 PASS
    G02 契约闸门 端点数 17/17 PASS
    G03 双壳闸门 SKU-002/005/017 一致 PASS
    G04 库闸门 行数 {replenish_apply:3, purchase_order:1} 列数13 PASS
    G05 口径闸门 136 passed, 2 warnings, 6 subtests PASS
    结果：5/5 通过                                          [exit=0]

cd frontend && npm run build
  → ✓ 579 modules transformed ... built in 9.14s          [exit=0]
```

## 数据库最终计数与无残留证明
精确清理（按 ID，未全库清空、未恢复旧备份）：UAT 数据集 `ds_f851d002340b52feae32`（含 products/sales/inventory 等）、3 张 UAT 申请（`ap_f86…`/`ap_df1…`/`ap_6cb…`）、2 张 UAT 采购单（`po_540…`/`po_bcb…`）。

```
清理后：datasets=7  products=140  replenish_apply=3  purchase_order=1
        UAT 残留数据集=0  UAT 残留申请=0
```
保留项（非业务四表，属 T2 验收证据）：演示管理员 admin、viewer01 用户、`rbac_audit_log` 登录留痕；`agent_runs` 为只读运行日志（P5/A1 调用，不影响基线四表）。

## 变更文件清单
- 后端：`api/service.py`（+`support_draft`/`_load_support_registry`；`_sku_detail` 回测历史不足归一化 E-1001）、`api/schemas.py`（+`SupportDraftRequest/Response`，Response 含 error）、`api/main.py`（+`POST /api/agents/support`，`asyncio.to_thread`）、`rbac/api.py`（support 映射 `sku:read`）、`tests/gates.py`（EXPECTED_PATHS +support，16→17）、`tests/test_support_endpoint.py`（新增 4 条）。
- 前端：`frontend/src/styles.css`（响应式 + `.tbl-wrap`）、`P1/P2/P3/P4/P6/P7.vue`（表格包 `.tbl-wrap`）、`P3SkuDetail.vue`（resize）、`P5Assistant.vue`（真实 A1 + 降级）、`api.js`（+`generateSupportDraft`）、`index.html`（favicon）。
- 文档：契约 §五/§3sexies-val/变更记录、`README.md`、用例总表、本文件、截图目录 `docs/uat-screenshots/`。
- UAT 工具脚本：`scripts/uat_cdp.py`、`scripts/uat_scenarios.py`、`scripts/uat_console_check.py`（仅浏览器自动化，不伪造业务数据）。
- 备份：`_backup_final/`（改动前文件 `.bak`）。

## 未完成项 / 残余风险（不计入本轮完成）
1. **真实店铺**：未接（任务明确排除）；UCI 是公开成交数据，库存/在途为仿真，不得表述为真实店铺。
2. **1688**：比价/阶梯价/MOQ 优化仍为 BL-01，未触碰。
3. **阿里云部署**：未部署、未创建任何云资源（ECS/Nginx/HTTPS/systemd 均未配置）。
4. **发货前端入口**：`po/ship` 无独立前端按钮（既有设计），本轮经同源 API 验证，未新增前端按钮（不属本轮要求）。
5. **已有 SKU 主数据编辑/覆盖**：仍为 PACK24 既定"不做"范围。
6. 管理员本地演示口令仅用于本机演示，生产必须更换并设 `AUTH_ENABLED=1` + 强 `AUTH_JWT_SECRET`。
