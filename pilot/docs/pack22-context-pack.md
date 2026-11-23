# PACK 22 执行上下文包（WorkBuddy 唯一最新口径）

更新：2026-11-19
用途：喂给外部执行器 WorkBuddy，避免它每次从零猜项目状态。
冲突规则：**本文件 > `docs/pack22-data-source-plan.md` > 聊天里的任务书**。凡与本文冲突的旧数字，一律作废。

## 0.1 执行结果（2026-11-19 15:53，先看这段）

- 22A/22B/22C **已落地**：`loaders/public_uci.py`、`scripts/build_public_dataset.py`、`DatasetItem.note`、`meta/evidence.dataset_note`、`tests/fixtures/uci_sample.csv`、`tests/test_public_dataset.py`、`docs/public-dataset.md`；`test_public_dataset` **9/9 passed**（7 条离线逻辑 + 2 条 DB 集成）。
- 当前全量：**122 collected；122 passed + 6 subtests**；五闸 **5/5 PASS**。Milvus 19530、Ollama `bge-m3`、PostgreSQL 5432 均已实际参与本轮验证，不再有 RAG 环境 error。
- **真实 `data/online_retail_II.xlsx` 已存在并正式构建成功**：`公开-UCI礼品20SKU-180天` = 20 SKU、3,600 条销量、3,600 条库存记录，窗口 2011-06-13～2011-12-09，`dataset_id=ds_94ed9ae746425c53bbda`。库存/在途仍为仿真，不是店铺真实库存。
- 22A/22B/22C 不需要重写；后续若继续，做阿里云实际部署或新的业务需求，不要重复报“数据未生成 / Milvus 未起”。

## 0. 先读什么

1. 本文件（先读，建立当前状态）。
2. `C:\Users\Windows\Desktop\pilot\docs\pack22-data-source-plan.md`（PACK 22 详细方案）。
3. `C:\Users\Windows\Desktop\pilot\docs\封版报告.md`（只看“未完成/残余风险/红线”）。
4. 只有需要改 API 时，才读交付目录的 `17-接口契约v1.3（as-built·接v1.2）.md`。

**不要整份喂 Word 设计说明。** Word 是给人看的产品说明，PACK 22 的数据源细节不在里面；整份喂会增加噪声，也不会自动变成最新状态。Word 由 MainAgent 统一维护。

## 1. 项目底座

- 项目根：`C:\Users\Windows\Desktop\pilot`
- Python：`.\.venv\Scripts\python.exe`（3.13）
- PostgreSQL：`postgresql+psycopg://postgres@127.0.0.1:5432/pilot`
- Milvus：19530
- 前端：`frontend\`，Vue 七页（P1–P7，P7 为 PACK 23 权限页）
- 交付目录：`C:\Users\Windows\Doubao\chats\2026-11-18\new-chat-2`
- 项目不是 git 仓库；差异靠 `_backup_packNN` 备份 + `git diff --no-index`

## 2. 当前基线（PACK 20/21 已封版）

- `python -m pytest tests -q`：**PACK 20/21 历史基线 102 passed + 6 subtests**（PACK 22 后见 §0.1）
- `python -m tests.gates`：**5/5 PASS**（PACK 20/21 时点）；G02 既有业务端点 **16/16**，RBAC 路由另见 `docs/pack23-rbac.md`
- `python -m tests.eval_qa`：PACK 20/21 基线为 RUN 5；PACK 22 后实测 **RUN 6，问数 50/50、解释 30/30、四要素 30/30、用例 30/30 = 70/70（146.0s）**
- 前端 `npm run build`：**579 modules** 通过（PACK 23 P7 权限页后）
- 库计数：`datasets=7`（6 套合成 + 1 套 UCI 公开）、`replenish_apply=3`、`purchase_order=1`；采购单 13 列；RBAC 新增 6 张表
- PACK 22/23 后当前：122 collected；122 passed + 6 subtests；五闸 5/5；`test_public_dataset` 9/9；`test_rbac` 11/11。

PACK 22 只能在这条基线上“只增不减”。新增测试可以，改旧测试凑数不行。

## 3. 数据源决定（已定，不再讨论）

当前版本采用**半真实数据包**，不是“真实店铺数据”：

- 需求：UCI **Online Retail II** 真实交易数据（CC BY 4.0，2009-12-01～2011-12-09，1,067,371 行）。
- 商品参数：UCI 成交价 + 固定假设（汇率、成本率、MOQ、箱规、交期）。
- 库存/在途：透明仿真。
- 1688：只做未来 BL-01（供应商比价/阶梯价/MOQ 优化），**当前版本不碰**，不买/不跑闲鱼采集脚本。

对外只能声称：验证预测与补货机制；不得声称“某家店铺真实库存效果”。

## 4. PACK 22 唯一参数（以此为准）

- 数据集名：`公开-UCI礼品20SKU-180天`
- `source_type`：`OPEN_PUBLIC`
- 选 20 个 SKU：窗口内总销量排序；至少 120 天有成交
- 时间窗：最后一天往前 **180 天**；自然日补零；20 × 180 = **3,600 行**
- 清洗：去 `InvoiceNo` 以 C 开头的取消单；去 `Quantity<=0`、`UnitPrice<=0`、空 `StockCode`；按 `(StockCode,date)` 聚合 `Quantity`
- 商品参数：
  - `price = round(median(UnitPrice) * 9.2, 2)`（1 GBP=9.2 CNY，固定假设）
  - `unit_cost = round(price * 0.45, 2)`
  - `moq=100`，`pack_size=50`
  - `lead_prod=30`，`lead_transit=25`，`lead_customs=7`，`lead_inbound=3`
  - `title`：该 SKU 出现次数最多的 `Description`
- 库存仿真（唯一版）：
  - 交期 65 天
  - 日均需求：**过去 28 天滚动均值**（不足 28 天用已有天数），不得用未来数据
  - 初始在库 = **120 天**日均需求
  - 再订货点 = **80 天**日均需求
  - 目标水位 = **100 天**日均需求
  - `on_hand` 不得为负；`in_transit` 为已下单未到仓
- **任务书旧数字 90/60/80 作废**，按本节 120/80/100 + 28 天滚动均值执行。
- 数据说明必须写明：销量真实、库存/在途仿真、成本与交期假设、金额按 9.2 汇率换算。
- 建议 note 原文：
  `公开真实需求：UCI Online Retail II（CC BY 4.0），窗口 2011-06-13~2011-12-09，20 SKU；库存/在途为仿真；成本按售价 45% 假设、按 1 GBP=9.2 CNY 换算；MOQ=100、箱规=50、生产 30 天、运输 25 天、清关 7 天、入仓 3 天为假设参数。`

## 5. 代码缺口（已核对）

1. `loaders/csv_import.py` 只收 `date, sku, sales_qty, on_hand, in_transit`；产品参数从现有数据集复制，**新 SKU 整批报 E-6002**。
2. `api/service.py:import_dataset_csv()` 没有产品主数据导入入口；`_product_master()` 只能从已有 `Products` 取。
3. `Datasets.note` 已存在，但 `list_datasets()`、`_sku_detail` 的 `evidence`、P1 数据集菜单都没暴露/展示。
4. 没有公开数据 loader、没有库存仿真器、没有 UCI 构建脚本。
5. 前端 `P1Dashboard.vue` 的 CSV 面板仍写“产品参数沿用当前数据集，未知 SKU 会被整批拒绝”。

PACK 22 只解决 3、4；**产品主数据导入留到 PACK 23**，不要在本包扩成新端点。

## 6. PACK 22 范围

- **22A**：新增 `loaders\public_uci.py` + `scripts\build_public_dataset.py`，离线构建公开数据集。
- **22B**：`DatasetItem.note`、`list_datasets` 返回 note、`_sku_detail` 的 `meta/evidence` 增 `dataset_note`；P1 菜单显示 note/“仿真库存”标签。**不加新 API 端点**，G02 仍 16/16。
- **22C**：`tests\fixtures\uci_sample.csv`（3 SKU × 120 天，测试用）；`tests\test_public_dataset.py`；`docs\public-dataset.md` 数据卡。
- **不做**：产品主数据导入、1688、供应商比价、阶梯价、MOQ 优化、Word/契约/台账/用例总表更新。

## 7. 冻结红线（碰了就停）

- `tests\cases_ask.json`
- `tests\cases_explain.json`
- `core\backtest.py`
- `agents\tools.py`
- `core\replenish_flow.py`

不改提示词、不改评测集/容差、不删难例、不把 50/50 说成“意图识别 100%”。

## 8. 验收命令

```powershell
cd C:\Users\Windows\Desktop\pilot
.\.venv\Scripts\python.exe -m pytest tests -q
.\.venv\Scripts\python.exe -m tests.gates
cd frontend
npm run build
cd ..
.\.venv\Scripts\python.exe scripts\build_public_dataset.py --xlsx data\online_retail_II.xlsx --dry-run
.\.venv\Scripts\python.exe scripts\build_public_dataset.py --xlsx data\online_retail_II.xlsx --name "公开-UCI礼品20SKU-180天"
.\.venv\Scripts\python.exe -m tests.eval_qa
```

期望：pytest 122 collected，当前 **122 passed + 6 subtests**；gates **5/5 PASS**；build 通过；真实 UCI 已生成 20 SKU/3,600 行并通过 API 验证；eval 70/70（PACK 22 后 RUN 6）。

## 9. 报告格式

1. 备份路径与改了哪些文件。
2. dry-run 输出。
3. 正式建库的 `dataset_id/name/SKU 数/行数/起止日`。
4. pytest/gates/build 的真实输出计数。
5. `/api/datasets` 的 note 原文、`/api/p3/sku/{sku}` 的 `evidence.dataset_note` 原文。
6. 未完成项/阻塞。

不要只说“已通过”。
