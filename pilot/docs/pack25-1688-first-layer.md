# PACK 25 · 1688 第一层模拟供应商报价（as-built 验收报告）

> 一句话：新增第 19 张表 `supplier_quotes` 与第 18 个业务端点 `GET /api/p3/supplier-quotes`，
> P3 增加只读模拟比价卡片；**模拟数据、非实时 1688、非正式报价**，不写回主数据、不改补货、不生成采购单。
> 验收日期：2026-11-19。全程真实 PostgreSQL、真实浏览器 UAT，无伪造。

## 一、本轮定位与边界

- **是第一层模拟报价**，不是实时 1688；不登录、不联网采集、不跑任何采集脚本。
- 1688 **第二层（真实采集/实时接口）仍不做**，列入 BL-01。
- 三不写回：不改 `products.unit_cost`、不改补货建议量、不生成采购单。
- 红线文件（`core/backtest.py`、`agents/tools.py`、`core/replenish_flow.py`、
  `tests/cases_ask.json`、`tests/cases_explain.json`）一字未改，G01 哈希通过。
- 不改 core 补货公式；`tier_json` 只用于展示，绝不参与 core 计算。

## 二、数据模型（第 19 张表）

`schema.py::SupplierQuotes`，表名 `supplier_quotes`，15 列：

| 列 | 类型 | 含义 |
|---|---|---|
| quote_id | String(64) PK | `sq_` + sha1(dataset_id\|sku\|supplier_code)[:16]，确定性 |
| dataset_id / sku | String | 定位一个 SKU |
| supplier_code | String(32) | MOCK-A / MOCK-B / MOCK-C |
| supplier_name | String(128) | 模拟供应商名（义乌/广州/深圳） |
| unit_price | Float | 基准×系数的模拟采购单价（元/件） |
| currency | String(8) | CNY |
| moq / pack_size | Integer | 起订量 / 箱规 |
| lead_prod / lead_transit | Integer | 生产 / 运输交期（天） |
| reliability | Float | 可靠性 0–1 |
| freight_per_unit | Float | 单件运费（仅展示） |
| tier_json | Text | 三档阶梯价 JSON（仅展示） |
| is_mock | Boolean | 恒 true |
| source_note | Text | 固定含「模拟 1688 第一层报价；非实时、非正式、未校验供应商」 |
| created_at | DateTime | 生成时间 |

约束：`UNIQUE(dataset_id, sku, supplier_code)`、`INDEX(dataset_id, sku)`。
`lead_days` 不落列，由 service 返回时按 `lead_prod + lead_transit` 计算。

## 三、确定性模拟报价规则（`loaders/supplier_quotes.py`）

三个纯函数：`build_mock_quotes(product, qty)`、`quote_id_for(...)`、
`finalize_quotes(rows, qty, current_cost)`（适用价/节省/排名统一计算，杜绝写库路径与即时路径口径分叉）。

**基准三级**（确定性，绝不用 0）：
1. `unit_cost` 有值 → 基准=unit_cost，`current_unit_cost`=真实值；
2. `unit_cost` 缺、`price` 有值 → 基准=`price×0.45`，note 追加「按售价 45% 估算」，`current_unit_cost`=None；
3. 两者都缺（真实数据有 18 个慢动 SKU 如此）→ 基准=10 元非 0 占位，note 追加「非真实成本估算」声明，`current_unit_cost`=None。
   —— 缺成本时 `saving_*` 一律 None，前端显示「缺成本，无法比较」，不伪造节省。

**三家固定系数**：

| code | 名称 | 系数 | MOQ | 生产交期 | 可靠性 | 单件运费 |
|---|---|---|---|---|---|---|
| MOCK-A | 义乌 | 0.92 | 原 MOQ | 原+2 | 0.86 | 0.80 |
| MOCK-B | 广州 | 1.03 | max(原,原×2) | max(1,原−1) | 0.93 | 0.60 |
| MOCK-C | 深圳 | 0.97 | 原 MOQ | 原+5 | 0.78 | 1.10 |

**三档阶梯**：min_qty = MOQ / MOQ×2 / MOQ×5；价格 = 单位价 ×1 / ×0.97 / ×0.93。
**适用档**：qty≥MOQ×5→档3；≥MOQ×2→档2；否则档1。金额统一 2 位小数，MOQ 最少 1。
**排名**：适用价升序 → reliability 降序 → supplier_code 升序。
**节省**：`saving_per_unit=current_unit_cost−best适用价`（可为负），`saving_amount=×当前建议量`。

## 四、接口契约（第 18 端点）

`GET /api/p3/supplier-quotes?dataset_id=<id>&sku=<sku>`，RBAC `sku:read`，
`response_model=SupplierQuotesResponse`。响应关键字段：

- `meta{source_type, as_of, method="supplier_quote_first_layer", dataset_note}`；
- `qty`（当前建议量，算不出为 0）、`current_unit_cost`（缺成本 None）、`quote_source="SYNTHETIC_1688_FIRST_LAYER"`；
- `is_mock=true`、`persisted`（库内是否已落报价）、`best_supplier_code/best_applicable_price/best_saving_*`；
- `quotes[]`：rank / supplier_code / supplier_name / unit_price / applicable_unit_price /
  tier_prices[{min_qty,price}] / moq / pack_size / lead_days / reliability / freight_per_unit /
  saving_per_unit / saving_amount / is_mock / source_note；
- `note` 固定「模拟报价，非 1688 实时数据；不写回主数据。」；`empty_reason`（建议量算不出时「暂无建议量，按 MOQ 展示」）。

行为：校验数据集/SKU，不存在返回 E-1003；优先读 `supplier_quotes`，无则即时生成（`persisted=false`，不写库）；
qty 优先取当前建议量，失败 qty=0 仍返回报价。全程只读。

## 五、Seed 脚本与执行结果

`scripts/seed_1688_quotes.py`：先 `create_all()` 确保表存在，从 `datasets` 表遍历全部数据集（不写死 id，
`--dataset-id` 可限定单个），每 SKU 生成 3 条，quote_id 撞键跳过。

```
.\.venv\Scripts\python.exe scripts\seed_1688_quotes.py
.\.venv\Scripts\python.exe scripts\seed_1688_quotes.py --dataset-id ds_xxx
```

- 首次执行（含前期失败残留 60 条的幂等续跑）：`datasets=7 skus=140 quotes=420 inserted=360 skipped=60`。
- 第二次执行：`inserted=0 skipped=420`（幂等验证通过）。
- 最终 `supplier_quotes=420` 行；业务四表仍 `datasets=7 / products=140 / replenish_apply=3 / purchase_order=1`。
- 未打印任何密钥/口令/连接串密码。

## 六、前端 P3 卡片

`frontend/src/api.js` 新增 `getSupplierQuotes(datasetId, sku)`（业务错误上抛、网络错误返回 null）。
`frontend/src/pages/P3SkuDetail.vue`：`loadDetail()` 并行触发 `loadQuotes()`，失败只影响报价卡片。

卡片位置：多路线方案对比之后、本 SKU 补货申请记录之前。内容：
标题「1688 模拟报价 · 第一层」+ 徽标「模拟数据 / 非实时」；当前成本/建议量/比较口径说明行；
表格列「供应商 / 单价 / 当前档价 / 阶梯价 / MOQ / 箱规 / 交期 / 可靠性 / 与当前成本差 / 排名」（`.tbl-wrap` 包裹）；
底部最低价供应商 + 当前档最低价 + 预估节省金额 +「模拟报价，不写回主数据」。
三态空态：无报价「运行 seed 脚本后可持久化」、缺成本「缺成本，无法比较」、接口失败「模拟报价暂不可用，本页其他数据正常」。
所有数字来自接口，无写死；无「选为供应商/写入采购单/改成本」等动作。

## 七、测试与验收（原始结果）

新增 `tests/test_supplier_quotes.py`（7 项：生成规则/阶梯价/缺成本/API/未知SKU/seed幂等/四表不变），
并在 `tests/test_data.py` 的 `EXPECTED_TABLES` 增 `supplier_quotes`。

```
.\.venv\Scripts\python.exe -m pytest tests -q
  → 143 passed, 2 warnings, 6 subtests passed in 56.61s   （136 基线 + 7 新增，无回退）

.\.venv\Scripts\python.exe -m tests.gates
  → [G01] PASS  [G02] 端点数 18/18 PASS  [G03] 两壳一致 PASS
    [G04] 行数 {'replenish_apply':3,'purchase_order':1}，列数 13 PASS
    [G05] 143 passed PASS    结果：5/5 通过

cd frontend && npm run build
  → ✓ 579 modules transformed. ✓ built in 11.78s
```

真实浏览器 UAT（`scripts/uat_p3_quotes.py`，Edge headless + CDP，1366×768）：
DOM 断言 `card=true / badge=模拟数据 / 非实时 / rows=3 / suppliers=[MOCK-A,MOCK-C,MOCK-B] /
summary 含 MOCK-A ¥9.2 ¥288 / sw=1336=cw=1336（无页面级横滚）` → **PASS**。
截图：`docs/uat-screenshots/1688-P3-quotes.png`。

## 八、未完成项与残余风险

- 1688 第二层（真实采集/接口、真实交期/资质校验）未做，符合本轮边界。
- 18 个慢动 SKU 无成本无售价：报价基准为非 0 占位并明确声明「非真实成本」，仅用于演示比价；
  其 `saving_*` 为 null，不得当作真实节省。
- `lead_prod/lead_transit`、运费、可靠性均为模拟假设参数，非真实供应商报价。
- 前端构建有既存的 >500 kB chunk 警告（echarts 体积），非本轮引入，不影响构建通过。
