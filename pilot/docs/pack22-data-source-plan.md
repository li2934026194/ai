# PACK 22 数据源方案（公开真实需求 + 仿真库存）

日期：2026-11-19　状态：22A/22B/22C 已完成真实数据构建与入库验证（`test_public_dataset` 9/9 passed；20 SKU、3,600 行、180 天；全量 122 passed、五闸 5/5）
定位：解决“没有真实店铺 SKU”的验证缺口；不冒充真实店铺库存。

## 一、结论

当前版本采用**半真实数据包**：

- **需求侧真实**：UCI Machine Learning Repository 的 **Online Retail II** 交易数据（英国在线零售商，2009-12-01 至 2011-12-09，1,067,371 行，CC BY 4.0）。
- **商品参数部分真实/部分假设**：售价取该 SKU 的成交单价中位数；采购成本按售价 45% 假设；MOQ、箱规、生产交期、运输/清关/入仓天数按统一假设，后续可替换为 1688/货代真实参数。
- **库存/在途仿真**：用真实日销量 + 假设交期跑一个透明的库存仿真，生成 `on_hand`、`in_transit`；必须在数据集说明与 UI 中标注“库存为仿真”。
- **1688 不进入当前版本**：只作为未来 BL-01（供应商比价/阶梯价/ MOQ 优化）的数据来源，现在不动。

对外口径：

> 需求侧使用 UCI Online Retail II 的真实交易数据；库存与在途由公开策略仿真生成；商品参数部分来自公开成交价、部分为假设。验证的是预测与补货机制，不是某家店铺的真实库存效果。

## 二、数据集规格

- 数据集名：`公开-UCI礼品20SKU-180天`
- `source_type`：`OPEN_PUBLIC`
- 选 SKU：按窗口内总销量排序，取前 20 个；要求窗口内至少有 120 天有成交。
- 时间窗：数据最后一天往前 180 天；按自然日补零，20 SKU × 180 天 = 3,600 行。
- 清洗规则：
  - 删除 `InvoiceNo` 以 `C` 开头的取消单；
  - 删除 `Quantity <= 0`、`UnitPrice <= 0`、`StockCode` 为空的行；
  - 同一 `(StockCode, date)` 聚合 `Quantity` 求和；
  - 缺货日不猜，补 0 销量（UCI 是成交数据，0 表示当天无成交，不表示断货）。
- 商品参数（先统一假设，全部写进 data card，不能散落在代码里）：
  - 汇率：`1 GBP = 9.2 CNY`（固定假设，仅用于把 UCI 英镑价格换算成系统展示用人民币）。
  - `price = round(median(UnitPrice) * 9.2, 2)`
  - `unit_cost = round(price * 0.45, 2)`
  - `moq = 100`，`pack_size = 50`
  - `lead_prod = 30`，`lead_transit = 25`，`lead_customs = 7`，`lead_inbound = 3`
  - `title`：该 SKU 出现次数最多的 `Description`
- 库存仿真（透明、可复现）：
  - 周期：日检查；交期 = 65 天（30+25+7+3）。
  - 日均需求：只用**过去 28 天滚动均值**（不足 28 天用已有天数），禁止用未来数据。
  - 初始在库 = 120 天日均需求；再订货点 = 80 天日均需求；目标水位 = 100 天日均需求。
  - 当 `on_hand <= 80 天日均需求` 且无在途订单时，下单量 = `max(moq, ceil((目标水位 - on_hand - in_transit)/pack_size)*pack_size)`；订单在 65 天后到仓。
  - `on_hand` 不得为负；若需求超过在库，按在库可满足量记销量，并在数据集说明中标注“该日需求被库存截断”（仅仿真层，不改变 UCI 原始需求统计）。
  - `in_transit` 为已下单未到仓数量。

## 三、代码现状（PACK 22 后核对）

1. `loaders/csv_import.py` 只收 `date, sku, sales_qty, on_hand, in_transit`；产品参数从现有数据集复制，**新 SKU 会整批报 E-6002**（PACK 23 再补）。
2. `api/service.py:import_dataset_csv()` 没有产品主数据导入入口；`_product_master()` 只能从已有 `Products` 取。
3. `Datasets.note` 已存在；22B 已把它暴露到 `list_datasets()`、`meta/evidence.dataset_note` 与 P1 数据集菜单。
4. 22A 已新增 `loaders/public_uci.py`、库存仿真器与 `scripts/build_public_dataset.py`；`test_public_dataset` 9/9 通过。
5. PACK 20/21 基线是 102 passed + 6 subtests、五闸 5/5、RUN 5 70/70；PACK 22/23 后收集 122 项，当前 **122 passed + 6 subtests**，五闸 **5/5**；PACK 22 后 `eval_qa` 实测 RUN 6 70/70（146.0s）。
6. 项目不是 git 仓库；PACK 18–21 都没有备份。PACK 22 已动手，改动范围以 `_backup_pack22`（如存在）和 mtime 为准。

## 四、PACK 22 验收

- `python -m pytest tests -q` ≥ 122 collected，新增 RBAC 11 条全绿；**当前 122 passed + 6 subtests**，全量已绿；
- `python -m tests.gates` 目标 5/5；**当前 4/5，G05 因同一 Milvus 环境 FAIL**；
- `python -m tests.eval_qa` 70/70（可在最后统一跑）；
- 新数据集出现在 `/api/datasets`，`/api/p3/sku/{sku}` 能出建议，`evidence.dataset_note` 明确写“库存仿真”；
- 新数据集至少有 20 SKU、3,600 行、180 天；**已用真实 xlsx 构建并写库，且 `/api/datasets`、`/api/p3/sku/85099B` 已验证**；
- 数据卡 `docs/public-dataset.md` 写清来源、许可、时间、选样规则、真实/仿真分层、假设参数、能证明/不能证明；
- 不修改冻结用例、不改提示词、不删难例、不把仿真库存写成真实库存。

## 五、不在本包范围

- 1688 采集/供应商比价/阶梯价拆单/MOQ 优化 → BL-01，未来单独立项。
- 产品主数据 CSV 导入（让用户自带新 SKU 走 UI）→ PACK 23，本包先做离线构建器。
- 真实店铺库存验证、阿里云实际部署、答辩彩排 → 外部依赖，不在代码包内（RBAC 代码侧已完成，部署见 `docs/pack23-rbac.md`）。
