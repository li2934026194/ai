# PACK 24：产品主数据导入（as-built）

> 目标：让产品主数据不存在的新 SKU 可通过现有 CSV 导入进入系统，不再统一报 E-6002；旧 CSV 完全兼容。真实 PostgreSQL 验收，不使用 SQLite/mock。

## 1. 一句话结论
PACK 24 **可验收**：扩展现有 `POST /api/datasets/import`，新 SKU 带完整合法商品主数据即可建产品并导入；旧格式零改动；全量 132 passed + 6 subtests、五闸 5/5、前端构建通过、P1→P2 真实 HTTP 链路走通。

## 2. 变更文件清单
| 文件 | 变更 |
|---|---|
| `loaders/csv_import.py` | 新增 `MASTER_COLUMNS`/`INTEGER_MASTER_COLUMNS`、`extract_master()`、`_master_value()`；`parse_csv()` 每行附带 `_line`/`_master` 原始值（不改返回结构语义） |
| `api/service.py` | `import_dataset_csv()` 接入 `extract_master(skip_skus=已有SKU)`，合并主数据；新 SKU 缺主数据仍 E-6002 且 message 明确 |
| `frontend/src/pages/P1Dashboard.vue` | 加「下载 CSV 模板」按钮与模板常量、更新导入说明、错误展示支持换行 |
| `tests/test_csv_master_data.py` | 新增，10 条验收测试（真实 PG） |
| `docs/reject-matrix.md` | 新增 E-6005/6006/6007，更新 E-6002 语义 |
| `docs/pack24-report.md` | 本报告（新建） |
| `README.md` | 状态、测试计数、PACK24 导入说明、错误码 |
| 交付目录 `17-接口契约v1.3（as-built·接v1.2）.md` | §3quinquies 扩展 CSV 格式/口径/错误码 + v1.3-p24 版本行 |
| 交付目录 `Pilot-测试用例总表.md` | 追加 S17 段 10 条用例 |

**未改**：`schema.py`（`products` 表已含全部主数据列，无表结构变化）、`core/*`（预测/补货口径未动）、`agents/*`、Milvus/UCI 数据、RBAC 行为、五条红线文件（`cases_ask.json`/`cases_explain.json`/`core/backtest.py`/`agents/tools.py`/`core/replenish_flow.py`）。备份在 `_backup_pack24\`。

## 3. 接口契约（摘要）
`POST /api/datasets/import`（JSON），权限 `dataset:import`（未加新端点、未绕过 RBAC）。

请求字段：
| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 数据集名，全库唯一 ≤128 字 |
| `csv_text` | 是 | 完整 CSV 文本 |
| `note` | 否 | 备注 |
| `base_dataset_id` | 否 | 已有 SKU 主数据来源数据集 |

CSV 列（表头名固定，逗号分隔）：
- 前 5 列必填（旧格式）：`date, sku, sales_qty, on_hand, in_transit`
- 后 9 列可选主数据（新 SKU 必填全）：`title, price, unit_cost, moq, pack_size, lead_prod, lead_transit, lead_customs, lead_inbound`

响应 `DatasetImportResponse`：`dataset_id/name/source_type/skus/sku_count/rows/start_date/end_date/note`。

错误码：
| 码 | 触发 |
|---|---|
| E-6001 | CSV 格式错误（旧） |
| E-6002 | 新 SKU 未提供任何商品主数据（旧码，message 明确"缺少商品主数据"） |
| E-6003 | 历史 <60 天（旧） |
| E-6004 | 数据集重名（旧，未放宽） |
| E-6005（新） | 同 SKU 多行主数据冲突 |
| E-6006（新） | 新 SKU 填了部分主数据列但没填全（定位字段） |
| E-6007（新） | 主数据非法值：空标题/0或负值/非整数/非法数字（定位行/列） |

旧格式兼容：已有 SKU 只填前 5 列 → 沿用库里主数据，行为与 PACK 20 完全一致；已有 SKU 即使 CSV 误带主数据也不采用、不校验。

## 4. 数据模型变化
**无表结构变化**。`schema.py::Products` 已含 `title/price/unit_cost/moq/pack_size/lead_prod/lead_transit/lead_customs/lead_inbound`。PACK 24 只是让导入器能为新 SKU 写入这些字段（此前只从已有主数据复制）。`datasets/products/sales_daily/inventory_daily` 四表写入仍走既有幂等 `upsert_dataset()`，整批事务失败完整回滚。

## 5. 前端使用路径（本地真实启动）
```powershell
cd C:\Users\Windows\Desktop\pilot
# 1) 起 API（连真实 PG）
.\.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000
# 2) 起前端开发服务器（另开一个终端）
cd frontend
npm run dev        # 默认 http://127.0.0.1:5173
```
操作路径：
1. 打开 `http://127.0.0.1:5173` → P1 今日驾驶舱 → 数据集下拉 → 「＋ 导入 CSV 数据集」。
2. 点「↓ 下载 CSV 模板」得到 14 列模板；填写新 SKU（≥60 天，主数据 9 列齐全且一致）或已有 SKU（只填前 5 列）。
3. 上传文件或粘贴 CSV → 填数据集名 → 「开始导入」。
4. 成功：绿色提示含 SKU 数/行数/日期，数据集自动切到新数据集并出现在下拉列表。
5. 失败：红色提示显示 E-600x 与行/列级原因（如"第 3 行 P24-BAD3 的 moq='1.5' 必须是整数"）。
6. 导入后到 P2 补货页选新数据集，可见新 SKU 的标题/日销/建议量/资金。

## 6. 真实 PostgreSQL 验收证据
环境：`postgresql+psycopg://postgres@127.0.0.1:5432/pilot`，Milvus 19530、Ollama bge-m3 可用。

一条完整验收路径（HTTP 实测，dataset_id=ds_05b18a711b215d07be09，验收后已清理，库恢复 datasets=7）：
```
POST /api/datasets/import  {name: PACK24-演示-帆布袋新品, 90 天 CSV, sku=DEMO-NEW-01, 主数据齐全}
→ {"dataset_id":"ds_05b18a711b215d07be09","sku_count":1,"rows":90,
   "start_date":"2026-03-01","end_date":"2026-05-29","source_type":"TEST_API"}

PG products 行：sku=DEMO-NEW-01, title=演示新品-帆布袋, price=19.9, unit_cost=8.96,
  moq=100, pack_size=50, lead=(30,25,7,3); sales_daily=90 行, inventory_daily=90 行

GET /api/datasets → 含 {id: ds_05b18a711b215d07be09, name: PACK24-演示-帆布袋新品, note: "P1 上传验收：新 SKU + 完整主数据"}
GET /api/p2/skus?dataset_id=... → {sku: DEMO-NEW-01, title: 演示新品-帆布袋, daily_avg: 3.0, qty: 250, capital: 2240.0}
```

10 项验收场景（`tests/test_csv_master_data.py`，全部真实 PG，10 passed）：
1. 新 SKU + 完整主数据成功并落库 ✓
2. 新 SKU 旧格式 → E-6002，零脏数据 ✓
3. 缺 unit_cost → E-6006 定位字段 ✓
4. price/unit_cost/moq/pack_size/lead/title 非法 → E-6007 共 6 项 ✓
5. 同 SKU 主数据冲突 → E-6005 ✓
6. 重名 → E-6004（未放宽）✓
7. 合法 + 冲突 SKU 同批 → 整批回滚零残留 ✓
8. 旧格式 SKU-017 回放成功 ✓
9. P2 可查新 SKU ✓
10. 方言断言 postgresql、products 主数据列齐全 ✓

## 7. 全量测试与五闸
```
.\.venv\Scripts\python.exe -m pytest tests -q
→ 132 passed, 2 warnings, 6 subtests passed in 49.68s   （122 基线 + 10 新增，原有未删改）

.\.venv\Scripts\python.exe -m tests.gates
→ G01 PASS / G02 端点 16/16 PASS / G03 PASS / G04 PASS / G05 132 passed PASS
→ 结果：5/5 通过

cd frontend && npm run build
→ ✓ 579 modules transformed ... built in 12.06s
```

## 8. 未完成项 / 残余风险
1. 演示数据集验收后已清理（不污染基线）；如需长期保留示例数据集，可按文中命令重建。
2. 前端 dev server 未常驻（验收时按需启动）；构建产物已在 `web/dist/`，uvicorn 静态挂载可直接服务。
3. 商品主数据"编辑/更新"（覆盖已有 SKU 主数据）本版明确不做——已有 SKU 一律沿用库里主数据，如需改主数据应走后续独立功能。
4. 1688 供应商比价/阶梯价/MOQ 优化仍为 BL-01，本轮未触碰。
