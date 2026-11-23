# 公开数据集数据卡（PACK 22）：公开-UCI礼品20SKU-180天

> 口径唯一来源：`docs/pack22-context-pack.md` §4。本卡逐条对应，不散落魔数。
> 状态：**真实 UCI 文件已下载并正式构建入库；`test_public_dataset` 9/9 passed，全量 122 passed、五闸 5/5。数据集为 20 SKU × 180 天 = 3,600 行，库存/在途仍为透明仿真。**

## 一、来源与许可

- 数据源：UCI Machine Learning Repository，**Online Retail II**（Dataset 502）。
- 下载页：https://archive.ics.uci.edu/dataset/502/online+retail+ii
- 文件：`online_retail_II.xlsx`（两个 sheet：Year 2009-2010 / Year 2010-2011）。
- 原始规模：1,067,371 行，英国在线零售商 2009-12-01 ～ 2011-12-09 的真实成交记录。
- 许可：**CC BY 4.0**；DOI：`10.24432/C5W02B`（以 UCI 页面标注为准）。
- 归属声明：数据来自 UCI 公开仓库，本项目仅做选择与聚合，不声称拥有原始数据。

## 二、数据集规格

| 项 | 值 |
|---|---|
| 数据集名 | `公开-UCI礼品20SKU-180天` |
| `source_type` | `OPEN_PUBLIC` |
| SKU 数 | 20 |
| 时间窗 | 数据最后一天往前 180 个自然日（建议 note 窗口 2011-06-13~2011-12-09） |
| 行数 | 20 × 180 = **3,600**（自然日补零，缺货日补 0 销量） |
| 选样 | 窗口内总销量降序取前 20；每个 SKU 窗口内至少 120 天有成交 |

## 三、清洗规则（真实成交层）

1. 删除 `InvoiceNo` 以 `C` 开头的取消单；
2. 删除 `Quantity <= 0`、`UnitPrice <= 0`、`StockCode` 为空的行；
3. 按 `(StockCode, date)` 聚合 `Quantity` 求和；
4. 自然日补零：UCI 是成交数据，某日 0 表示**当天无成交**，不表示断货；
5. `sales_daily.qty` = 真实成交量，**绝不因仿真库存不足而改**。

## 四、商品参数（部分真实 / 部分假设）

| 字段 | 取值 | 性质 |
|---|---|---|
| `price` | round(median(UnitPrice) × 9.2, 2) | UCI 真实成交单价中位数 + 汇率假设 |
| `unit_cost` | round(price × 0.45, 2) | 假设 |
| `title` | 该 SKU 出现次数最多的 `Description` | 真实 |
| `moq` | 100 | 假设 |
| `pack_size` | 50 | 假设 |
| `lead_prod / transit / customs / inbound` | 30 / 25 / 7 / 3（合计 65 天） | 假设 |
| 汇率 | 1 GBP = 9.2 CNY | 固定假设，仅换算展示金额 |

## 五、库存 / 在途仿真层（透明、可复现、确定性）

- 检查周期：日；交期 65 天。
- 日均需求：**过去 28 天滚动均值**（含当天；不足 28 天用已有天数），不使用未来数据。
- 初始在库 = 120 天日均需求；再订货点 = 80 天日均需求；目标水位 = 100 天日均需求。
- 下单规则：无在途且 `on_hand <= 再订货点` 时下单，
  `下单量 = max(moq, ceil((目标水位 − on_hand − in_transit)/pack_size) × pack_size)`，65 天后到仓。
- `on_hand` 不得为负；若仿真需求超过仿真在库，该日 `on_hand` 记 0 并计一次「仿真断货」，
  **真实销量 qty 不变**。
- `in_transit` = 已下单未到仓数量（仿真快照，不落 `inbound_batches` 真实批次表）。

> 旧任务书的 90/60/80 已作废；本卡与代码均为 120/80/100 + 过去 28 天滚动均值。

## 六、能证明 / 不能证明

**能证明：**
- 预测与补货机制在真实需求分布上的可运行性（回测、WAPE、建议量推导链、证据块）。
- 一套透明库存策略在真实成交序列下的在手/在途演化与仿真断货天数。

**不能证明：**
- 任何真实店铺的真实库存效果——库存与在途是仿真，不是店铺实况。
- 采购成本、MOQ、箱规、四段交期的真实性——这些是假设参数，非供应商报价。
- 仿真断货天数 ≠ UCI 真实断货——UCI 只有成交记录，无库存字段。
- 不声称「某家店铺真实库存」「准确率 XX%」「减少缺货 XX%」。

## 七、复现命令

```powershell
cd C:\Users\Windows\Desktop\pilot
.\.venv\Scripts\python.exe -m pip install openpyxl   # 仅当缺失
.\.venv\Scripts\python.exe scripts\build_public_dataset.py --xlsx data\online_retail_II.xlsx --dry-run
.\.venv\Scripts\python.exe scripts\build_public_dataset.py --xlsx data\online_retail_II.xlsx --name "公开-UCI礼品20SKU-180天"
```
`--dry-run` 不写库，只复算统计；xlsx 不存在时明确报错退出，不用假数据补位。
可选 `--limit`（默认 20）、`--window-days`（默认 180）。

## 八、当前产物状态（如实）

- 构建器代码 `loaders/public_uci.py`、`scripts/build_public_dataset.py`：已实现，`test_public_dataset` **9/9 passed**（7 条离线逻辑 + 2 条 DB 集成，含 `on_hand` 非负、滚动均值无未来泄漏、note 含仿真标注）。
- 测试夹具 `tests/fixtures/uci_sample.csv`：3 SKU × 120 天，测试用，不冒充真实全量。
- **真实全量已生成并写库**：`data/online_retail_II.xlsx` 存在；正式构建输出 `dataset_id=ds_94ed9ae746425c53bbda`，products=20、sales_daily=3,600、inventory_daily=3,600、inbound_batches=0（在途只作为仿真快照，按设计不落真实批次表）。
- 时间窗实测为 **2011-06-13～2011-12-09**；仿真断货 137 个 SKU·日，`on_hand<0` 为 0。
- API 验证：`/api/datasets` 返回该数据集；`/api/p3/sku/85099B?dataset_id=ds_94ed9ae746425c53bbda` 返回 200，`best_model=croston_sba`、建议量 2,150 件、占用资金 17,350.5 元，`meta/evidence.dataset_note` 均保留“库存/在途为仿真”。
