# PACK 20 报告：CSV 导入器

日期：2026-11-19　状态：已完成（后端 + 前端面板 + 4 条用例，全量 91 项测试绿）

## 1. 为什么做

系统此前只能跑六套合成数据集，答辩时无法回答“真实店铺数据能不能进来”。PACK 20 解决的是**数据入口**，不是再做一个页面：外部 CSV → 校验 → 落成正式数据集 → 直接进入 预测/补货/解释 全链路。

## 2. 契约（已写进接口契约 §3quinquies）

`POST /api/datasets/import`，请求体：

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 新数据集名，全库唯一 |
| `csv_text` | 是 | 完整 CSV 文本 |
| `note` | 否 | 备注 |
| `base_dataset_id` | 否 | 从哪个数据集继承产品参数；不传则任取同 SKU 的产品参数 |

CSV 必需列：`date, sku, sales_qty, on_hand, in_transit`。日期 `YYYY-MM-DD`；同一 SKU 同一天不得重复；数值不得为负。

硬约束：每个 SKU ≥ 60 天历史、≤ 50 个 SKU、≤ 50000 行。

错误码：`E-6001` 格式错误 / `E-6002` 未知 SKU / `E-6003` 历史不足 60 天 / `E-6004` 数据集重名。**任一校验失败整批不写库**。

## 3. 实现

- `loaders/csv_import.py`（新）：`parse_csv()` 纯解析校验 → `build_frames()` 生成 products / sales_daily / inventory_daily 三表记录 → `CsvLoader` 满足 `Loader` 协议，交给既有 `upsert_dataset()` 落库（复用同一套 upsert 与 dataset_id 规则，不另造写库路径）。
- 产品参数（成本/售价/MOQ/箱规/四段交期）不要求写在 CSV 里，从产品主数据继承；这样真实店铺只需要导出“每天卖了多少、剩多少、在途多少”。
- `api/service.py`：`_product_master()` + `import_dataset_csv()`，先查重名、再解析、再校验 SKU 与天数，全部通过才 `upsert_dataset()`；任何异常 rollback。
- `api/main.py`：`POST /api/datasets/import`；`api/schemas.py`：`DatasetImportRequest/Response`。
- 前端：`P1Dashboard` 数据集菜单底部「＋ 导入 CSV 数据集」→ 面板（名称、选文件或粘贴 CSV、错误/成功提示、导入后自动切换新数据集并刷新）。

## 4. 验收证据

| 用例 | 验的是什么 | 结果 |
|---|---|---|
| `test_01_roundtrip_numbers_match` | 用主数据集 SKU-017 原始日数据拼 CSV 导入，**新数据集算出的 qty/交期/资金/最优模型必须与来源逐位一致** | 通过（qty 360 / 3600 元） |
| `test_02_reject_bad_csv` | 缺列→E-6001、未知 SKU→E-6002、30 天→E-6003；失败后库里不留数据集 | 通过 |
| `test_03_duplicate_name_and_empty` | 重名→E-6004；空 CSV→E-6001 | 通过 |
| `test_04_new_dataset_visible_in_list` | 导入后 `/api/datasets` 可见 | 通过 |

- `python -m pytest tests/test_csv_import.py -q` = **4 passed**
- `python -m pytest tests -q` = **91 passed, 6 subtests passed**
- `python -m tests.gates` = **5/5**（G02 端点 15/15）
- 导入测试自清理；复核库 `datasets=6`、`replenish_apply=3`、`purchase_order=1`，与基线一致。
- 前端 `npm run build` = 578 modules，6.47s，通过。

## 5. 已知边界（如实记录）

1. CSV 不写产品参数，**新 SKU 无法直接导入**（会 E-6002）；要接全新商品，需要先补产品主数据。这是刻意选择：没有成本/交期就无法算建议量，让用户填半套参数反而会算出假数字。
2. `sales_qty` 按“实际卖出量”入 `sales_daily.qty`；CSV 里没有断货标记，断货日不会被标成 censored。真实数据若要区分“没卖掉”与“没货卖”，下一版需要加 `is_stockout` 列并进入需求校准。
3. 一次只导入一个数据集；不支持增量追加到已有数据集（重名直接拒绝，避免静默合并）。
4. 前端入口只在 P1 数据集菜单；P2/P3 没有重复入口。
5. 导入依赖既有 `upsert_dataset()`，与合成数据走同一条写库路径——好处是行为一致，代价是 `products` 表会把同 SKU 参数再写一份（数据量可接受）。
