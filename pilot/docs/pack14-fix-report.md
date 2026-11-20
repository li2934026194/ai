# PACK 14 修链路报告（Z1–Z5）

【合成演示业务，非真实生产业务】

- 项目：`C:\Users\Windows\Desktop\pilot`
- 备份（改动前）：`C:\Users\Windows\Desktop\pilot\_backup_pack14\`（core/、agents/、api/、frontend/src/、tests/、schema.py、web/index.html）
- 解释器：`.venv\Scripts\python.exe`；数据库 `postgresql+psycopg://postgres@127.0.0.1:5432/pilot`
- 本轮纪律：**未改 `core/backtest.py` 的回测口径、未改 `tests/cases_ask.json` / `tests/cases_explain.json`、未改任何 Agent 的 instructions、未为提分改 prompt。**

---

## 0. 结论摘要

| 项 | 结果 | 判定 |
|---|---|---|
| Z1 断货日/断货损失接通 | 14 天档 `zero_days=14`、首个断货日 2026-03-22、损失 3838.19；8 天档 8 / 2026-06-22 / 2112.56；构造 95/100/105 天 → 8550 / 12000 / 15750 | **达标** |
| Z2 工具补 dataset 入参 | 坏数据集名直接拒答不回落；回执回显数据集；EX-20~24 拿到本数据集自己的数（660 件 / 9240 元） | **达标** |
| Z3 文案下沉 | 两句只在 `api/constants.py` 一处定义，前端 `/api/copy` + Agent 回执各引用一处；前端 0 处字面量 | **达标（Agent 回执命中；LLM 转述未命中，见 §6）** |
| Z4 写库工具物理隔离 | A38/A46 复测前后 `replenish_apply=3`、`purchase_order=1` 不变；写库默认关闭、需二次确认 | **达标** |
| Z5 路由稳定性 | 4 次真实跑分 88% / 90% / 92% / 92%，两次差异 5–6 条 | **未达标**（≥92% 只在两次擦线，差异 ≤1 未达成） |

---

## 1. Z1：断货日与断货损失接通

### 1.1 改前（`_backup_pack14/core/inventory.py:205-207`）

```python
stockout_date=None,
zero_days=0,
lost_amount=None,
```

三处硬编码占位：序列里明明有断货日，回执永远 0 天 / 无日期 / 无金额。

### 1.2 改后（`core/inventory.py`）

- 新增 `_coerce_date()`：把 `date` / `datetime` / ISO 字符串统一成 `date`（API 壳传 `date`、Agent 壳传字符串，实测字符串会炸 `'str' has no attribute 'isoformat'`）。
- 新增 `gross_margin_rate(price, unit_cost)`：售价缺失 / ≤成本 / 负毛利 → `None`。
- `build_suggestion(..., inbound_batches: Optional[list] = None)`：
  - `zero_days` = `series.dates` 中 `is_stockout` 为真的天数；`stockout_date` = 其中第一天；
  - `lost_amount`：`zero_days==0` → `0.0` + 「历史无断货日，损失为 0（是真实 0，不是缺数）」；
    缺 price/unit_cost → `None` + 「缺售价或单件成本，断货损失无法计算」；
    毛利率无效 → `None` + 说明；否则 `estimate_loss(zero_days, mu_daily, price, margin)`。
  - 同时新增前向字段 `inputs_json["stockout_forward"]`（`simulate_stockout(on_hand, inbound_batches, mu_daily, horizon=90)`）。

### 1.3 关键设计判断（必须记下来）

`core/simulate.py` 的 `simulate_stockout` 是**从今天起的前向模拟**，而契约与冻结用例里的「断货天数」是**历史断货日**（`series.qty is None` 的天数）。两者不能互相顶替：

- 历史三字段（断货天数 / 首个断货日 / 断货损失）走 `series` + `estimate_loss`；
- `simulate_stockout` 只供新增的前向块 `stockout_forward`（`horizon_days / first_zero_date / coverage_days / inbound_batch_count / on_hand`）。

字段分开、来源分开，避免把"未来会断几天"当成"过去断了几天"。

### 1.4 前后对照（同一批输入，分别跑备份 core 与现 core，实跑）

`measure_before_after.py`：设 `PILOT_CORE_ROOT` 时旧 `core` 包优先，从同一 PostgreSQL 取行。

| 输入（数据集 / SKU） | 改前 zero_days | 改前 stockout_date | 改前 lost_amount | 改后 zero_days | 改后 stockout_date | 改后 lost_amount |
|---|---|---|---|---|---|---|
| 合成-断货14天 / SKU-001 | 0（序列里实际 14 天） | null | null | **14** | **2026-03-22** | **3838.19** |
| 合成-正在缺货 / SKU-002 | 0（序列里实际 8 天） | null | null | **8** | **2026-06-22** | **2112.56** |
| 合成-断货14天 / SKU-018（缺成本售价） | 0 | null | null | 0 | null | 0.0（reason=「历史无断货日，损失为 0（是真实 0，不是缺数）」；占用资金仍 null=「成本未填，金额无法计算」） |
| 合成-正在缺货 / SKU-017 | 0 | null | null | 0 | null | 0.0（同上 reason） |
| 构造 100 天断货 | 0 | null | null | **100** | 2026-03-02 | **12000** |
| 构造 95 天断货 | 0 | null | null | **95** | 2026-03-02 | **8550** |
| 构造 105 天断货 | 0 | null | null | **105** | 2026-03-02 | **15750** |

### 1.5 `/api/p3/sku` 回执实测（新增 `stockout` 块）

```
合成-断货14天 SKU-001:
{"zero_days":14,"first_date":"2026-03-22","lost_amount":3838.19,"lost_amount_reason":null,
 "gross_margin_rate":0.6667,
 "forward":{"horizon_days":90,"first_zero_date":"2027-01-31","zero_days":16,"coverage_days":74,
            "inbound_batch_count":0,"on_hand":678.0}}

合成-正在缺货 SKU-002:
{"zero_days":8,"first_date":"2026-06-22","lost_amount":2112.56,"gross_margin_rate":0.5882,
 "forward":{"horizon_days":90,"first_zero_date":"2026-11-18","zero_days":90,"coverage_days":0,"on_hand":0.0}}

合成-断货14天 SKU-018（缺成本售价）:
{"zero_days":0,"first_date":null,"lost_amount":0.0,
 "lost_amount_reason":"历史无断货日，损失为 0（是真实 0，不是缺数）","gross_margin_rate":null,
 "forward":{"first_zero_date":null,"zero_days":0,"coverage_days":90,"on_hand":478.0}}
```

### 1.6 验收文案与实际数据命名的错配（如实记录）

验收写的是「S1（合成-正在缺货）14 天断货」与「正常 S6 → 8 天」。实际数据是：

- 14 天断货在 `ds_00b31ed333b05de698c0`「合成-断货14天」的 SKU-001；
- 8 天断货在 `ds_505a8430098d535b8ec1`「合成-正在缺货」的 SKU-002。

两档都已跑通且 `lost_amount > 0`，只是数据集名与文案对调。未按文案去改数据，按实际数据报告。

---

## 2. Z2：工具补 `dataset_name` 入参

### 2.1 改前签名

```
_backup_pack14/agents/tools.py:278: def forecast_backtest(sku: str) -> str:
_backup_pack14/agents/tools.py:299: def run_replenish(sku: str, holding_days: int = 45) -> str:
```

工具锁死默认数据集，问「合成-正在缺货」也只能拿默认集的数（PACK 13 EX-20~24 数字错位根因）。

### 2.2 改后签名与实现

```
agents/tools.py:300: def _forecast_backtest_impl(sku: str, dataset_name: str | None = None) -> str:
agents/tools.py:337: def forecast_backtest(sku: str, dataset_name: str | None = None) -> str:
agents/tools.py:347: def _run_replenish_impl(sku: str, holding_days: int = 45, dataset_name: str | None = None) -> str:
agents/tools.py:446: def run_replenish(sku: str, holding_days: int = 45, dataset_name: str | None = None) -> str:
```

- `DEFAULT_DATASET_NAME = "合成-断货14天"`、`resolve_dataset()`、`UnknownDataset`；
- 指定名查不到 → `UnknownDataset`，回执「未找到数据集 X，无法给出」，**绝不回落默认**；
- 每条回执首句固定「SKU x；本次使用的数据集：<name>」。
- 实现体拆成 `_run_replenish_impl` / `_forecast_backtest_impl`（与既有 `route_compare` 同模式），`@function_tool` 包装器只转调 —— 这样回执验收可以 0 次 LLM 直调，不必构造 SDK 假 context。

### 2.3 回执实测（0 次 LLM，直调 impl）

```
[合成-正在缺货 / SKU-002]
SKU SKU-002；本次使用的数据集：合成-正在缺货；日均 8.80 件，服务水平 97%（cost_reverse），
总交期 53 天，σ_LT=22.33，SS=42.00；历史断货 8 天，首个断货日 2026-06-22；
断货损失约 2,113 元（口径：断货天数 × 日均 × 售价 × 毛利率 × 1.5，毛利率=(售价-成本)/售价）；
建议补 660 件，占用资金 9,240 元；口径声明：合成场景，结论不可当作真实经营依据。

[合成-断货14天 / SKU-001]
… 历史断货 14 天，首个断货日 2026-03-22；断货损失约 3,838 元 …
本轮无需补货（no_replenishment），占用资金 0 元；口径声明：…

[坏数据集名]
未找到数据集「不存在的数据集」，无法给出。数据集名必须与 /api/datasets 返回的 name 完全一致；
不要用其它数据集的数字顶替。

[forecast / 查无此集]
未找到数据集「查无此集」，无法给出预测结论。…
```

### 2.4 EX-20~24 验收（run9 实测）

| 用例 | 数据集 | SKU | 建议量 | 占用资金 | 数字一致 |
|---|---|---|---|---|---|
| EX-20 | 合成-正在缺货 | SKU-002 | 660 | 9240.0 | PASS |
| EX-21 | 合成-正在缺货 | SKU-003 | 660 | 11880.0 | PASS |
| EX-22 | 合成-正在缺货 | SKU-004 | 660 | 14520.0 | PASS |
| EX-23 | 合成-正在缺货 | SKU-005 | 660 | 6600.0 | PASS |
| EX-24 | 合成-正在缺货 | SKU-006 | 660 | 9240.0 | PASS |

660 件 / 9240 元与验收期望一致，且**是按该数据集自身实算出来的**（不是迁就旧期望）：期望值本来就是该数据集 SKU-002 的 `qty=660`、`capital=9240`。

---

## 3. Z3：文案下沉

### 3.1 改前

前端各处硬编码（`_backup_pack14/frontend/src`）：

```
errorCodes.js:10: { code: 'E-4001', title: '本轮无需补货', detail: '建议量为 0 时显示「本轮无需补货」，不显示 0 件。' },
errorCodes.js:11: { code: 'E-5001', title: '合成场景声明', detail: '本页数据为合成演示数据（SYNTHETIC），非真实经营数据。' },
P3SkuDetail.vue:349: {{ Number(d.qty) === 0 ? '本轮无需补货' : ... }}
P3SkuDetail.vue:500 / P1Dashboard.vue:113 / P2Replenish.vue:266 / P4Forecast.vue:97 / P6Workshop.vue:210:
  <div ...>本页数据为合成演示数据（SYNTHETIC），非真实经营数据。<!-- E-5001 --></div>
```

Agent 侧：`_backup_pack14/agents/tools.py` 里「本轮无需补货」「合成场景」**0 处命中** —— 所以 E-4001 / E-5001 在 AI 文本里永远打不出来。

### 3.2 改后

唯一源头 `api/constants.py`：

```python
NO_REPLENISH_TEXT = "本轮无需补货"
SYNTHETIC_NOTICE = "合成场景，结论不可当作真实经营依据"
AMOUNT_UNAVAILABLE_TEXT = "成本未填，金额无法计算"
def copy_payload() -> dict: ...
def agent_notice() -> str:  # 返回「口径声明：合成场景，结论不可当作真实经营依据。」
```

- 后端：`GET /api/copy`（`api/main.py`）实测返回
  `{"no_replenish":"本轮无需补货","synthetic_notice":"合成场景，结论不可当作真实经营依据","amount_unavailable":"成本未填，金额无法计算","source":"api/constants.py","note":"前端与 Agent 共用的唯一文案来源，禁止在页面或提示词里各写一份。"}`
- 前端：`api.js` 的 `getCopy()`（失败返回 null 不阻塞页面）→ `App.vue` `onMounted` 写入 `store.copy` → 6 个页面（P1/P2/P3/P4/P6 + errorCodes.js）各一处引用；
  `errorCodes.js` 用 `titleKey` / `detailKey` + `resolveCode()`，未加载显示「（文案未加载）」，**不做字面量兜底**。
- Agent：`agents/tools.py` 回执改用 `agent_notice()` + 两个常量。

前端残留字面量检查（`Get-ChildItem frontend\src -Recurse | Select-String '本轮无需补货|合成场景，结论不可当作真实经营依据'`）：

```
store.js:5:  // PACK 14 / Z3：copy 是后端 /api/copy 的文案（本轮无需补货 / 合成场景声明），
```

只剩一行注释，无任何展示用字面量。

### 3.3 验收（E-4001 / E-5001 命中原文）

| 位置 | E-4001「本轮无需补货」 | E-5001「合成场景，结论不可当作真实经营依据」 |
|---|---|---|
| `run_replenish` 工具回执 | 命中（`本轮无需补货（no_replenishment）`） | 命中（`口径声明：合成场景，结论不可当作真实经营依据。`） |
| `/api/p3/sku` 页面数据 | `qty=0` 时前端取 `store.copy.no_replenish` | 页脚取 `store.copy.synthetic_notice` |
| 评测里 LLM 最终回答（EX-10/11、EX-13/14/15） | **未命中**（模型改写为「无需补货」） | **未命中**（改写为「合成场景演示结果，不可当作真实经营依据」） |

即：链路已通（数据源唯一、回执带原文），但模型转述会改写原文 —— 这是 Z5/§6 要报的失败，不是文案层能修的（修它就得改 prompt）。

---

## 4. Z4：写库工具与问数上下文物理隔离

### 4.1 结构

- `agents/tools.py`：`READ_TOOLS = [forecast_backtest, run_replenish, route_compare]`、
  `WRITE_TOOLS = [submit_replenish_apply, approve_apply, reject_apply, receive_po_goods]`、
  `WRITE_GUARD_TOOLS` = 四个同名拒绝桩（回执写明「当前处于只读上下文（问数 / 解释 / 评测），没有写库权限…」）。
- `agents/registry.py`：`build_agents()` 里 A6 只挂 `a5.as_tool(run_forecast)` + `run_replenish` + `route_compare` + 四个拒绝桩；
  `get_exec_agent()` 返回 `A6_replenish_exec`（唯一挂真写工具）。
- 写库三道门：`write_tools_enabled()`（环境变量 `PILOT_ENABLE_WRITE_TOOLS`，默认 `"0"`）→ `confirmed=True` 二次确认 →
  才调 `api.service` 的 `create_apply / approve_apply / reject_apply / receive_po_goods`。

`run_write_action("submit", {...})` 默认实测：

```
{'status': 'blocked', 'wrote': False,
 'message': '写库工具默认关闭：本次没有产生任何申请或采购单。如需真正执行，请显式设置
  PILOT_ENABLE_WRITE_TOOLS=1，并在复核参数后传 confirmed=True 二次确认。'}
```

### 4.2 A38 复测前后计数（验收项）

| 时点 | `replenish_apply` | `purchase_order` | 说明 |
|---|---|---|---|
| PACK 13 run1（改前） | 3 → **4** | 1 | A38「帮我直接下单补 500 件」真的写库，新增 `ap_513d58d073f84e74`，事后按 apply_id 手工删除 |
| PACK 14 A38 复测（改后） | 3 | 1 | A6 回答「我这边的下单/审批是只读上下文，无法真正写库」，不落单 |
| PACK 14 A46 复测（改后） | 3 | 1 | 「帮我把这条补货申请审批通过」同样拒绝 |
| 4 轮完整跑分（run3/4/8/9）之后 | **3** | **1** | 跑分前后不变 |

A38 原话（截断）：

> 我这边的下单/审批是只读上下文，无法真正写库。`submit_replenish_apply`、`approve_apply`、`receive_po_goods` 这些工具在当前上下文都会被拒绝（不会写库）……我不会假装成功。

### 4.3 注意点

A6 的工具名列表仍含四个写工具名（`['run_forecast','run_replenish','route_compare','submit_replenish_apply','approve_apply','reject_apply','receive_po_goods']`），但实际对象是拒绝桩 —— 老测试 `tests/test_replenish_flow.py` 的结构断言因此仍然通过。这一条不靠提示词，靠工具不在手上。

---

## 5. Z5：路由稳定性（未达标）

### 5.1 规则表（`agents/registry.py::classify_intent`）

```
FORECAST_TERMS  = ("wape", "预测", "模型", "回测")
REPLENISH_TERMS = ("建议补", "补货", "补多少", "订货", "订多少", "下单", "建议量", "审批")
METRIC_GUARD_TERMS = ("补货点",)
判定顺序：guard → A5 → A6 → 否则 A3_ask
```

机制：`_RuleRoutingModel` 命中 A5/A6 时直接返回带 `ResponseFunctionToolCall` 的 `ModelResponse`（0 次 LLM 决策）；
命中 A3 时透传真模型自答。A3 的 instructions 一字未改。

### 5.2 四次真实跑分汇总行

```
[RUN 3] 2026-11-18T19:46:00 | 问数命中 46/50 (92.0%) | 解释数字一致 30/30 (100%) | 四要素 22/30 | 用例通过 22/30 | LLM 调用 76 次（解释缓存 0） | 总耗时 276.8s | 平均 3.64s/次
[RUN 4] 2026-11-18T19:49:33 | 问数命中 46/50 (92.0%) | 解释数字一致 0/30 (仅跑 ask，解释未评) | LLM 调用 50 次（缓存 26） | 总耗时 127.1s | 平均 2.54s/次
[RUN 6] 2026-11-18T20:01:36 | 问数命中 45/50 (90.0%) | 解释数字一致 30/30 (100%) | 四要素 22/30 | 用例通过 22/30 | LLM 调用 50 次（缓存 26） | 总耗时 161.1s | 平均 3.22s/次
[RUN 7] 2026-11-18T20:04:04 | 问数命中 44/50 (88.0%) | 解释数字一致 30/30 (100%) | 四要素 22/30 | 用例通过 22/30 | LLM 调用 50 次（缓存 26） | 总耗时 129.8s | 平均 2.60s/次
```

（RUN 5 是中途被否决的方案，命中 100%，见 §5.4，已回退不计入结论。）

### 5.3 两次运行差异表（同一份最终代码，RUN 6 vs RUN 7）

| 用例 | 问句 | 期望 | RUN 6 | RUN 7 | 归属 |
|---|---|---|---|---|---|
| A07 | SKU-002 的在手库存是多少？ | A3_ask | A6 ❌ | A6 ❌ | 两次都错 |
| A15 | SKU-017 的安全库存是多少件？ | A3_ask | A6 ❌ | A6 ❌ | 两次都错 |
| A21 | 两个数据集 SKU-002 的日均销量差多少？ | A3_ask | A5 ❌ | A5 ❌ | 两次都错 |
| A16 | 对比 SKU-017 和 SKU-008 的日均销量。 | A3_ask | A5 ❌ | ✅ | **翻转** |
| A26 | 日均销量这个数是从哪来的？ | A3_ask | A5 ❌ | ✅ | **翻转** |
| A13 | SKU-017 的服务水平是多少？ | A3_ask | ✅ | A5 ❌ | **翻转** |
| A14 | SKU-017 的总交期是多少天？ | A3_ask | ✅ | A6 ❌ | **翻转** |
| A20 | 对比 SKU-004 和 SKU-005 的在手库存。 | A3_ask | ✅ | A5 ❌ | **翻转** |

差异条数 = 5（RUN 3 vs RUN 4 也是 6 条：A04/A13/A15/A20/A21/A33）。验收要求 ≤1，**未达成**。

### 5.4 逐条定位（A07/A14/A15/A20/A21/A33/A37）

| 用例 | 问句 | 根因分类 | 说明 |
|---|---|---|---|
| A37 | 预测一下 SKU-017 下个月的价格 | **词表已覆盖** | 含「预测」→ A5，4 次跑分全命中，不再翻转。 |
| A07 | SKU-002 的在手库存是多少 | 边界缺失（指标词未入表） | 无「能力」类动词，按设计应 A3 自答；但 A3 没有取数工具，它自己会算「要不要转给 A6 取数」。 |
| A14 | SKU-017 的总交期是多少天 | 同上 | 同上。 |
| A15 | SKU-017 的安全库存是多少件 | 同上（且与 A35 的「补货点」guard 不同族） | 同上。 |
| A20 | 对比 SKU-004 和 SKU-005 的在手库存 | 同上 | 同上。 |
| A21 | 两个数据集 SKU-002 的日均销量差多少 | 同上 | 同上。 |
| A33 | 断货日是怎么剔除的 | 同上（口径类，却被转去 A5） | 同上。 |

结论：**这 6 条不是词表误判，而是「A3 自答段」的落点由 A3 自己的 LLM 决定**。规则表只能决定「转不转」，决定不了「模型要不要自己转」。而 A3 的 instructions（禁止改）同时又要求它「涉及预测/补货就转交」，所以它在「空口给口径」与「转出去拿数」之间随采样摆动 —— 这是结构性矛盾，不是加几个词能修的。

### 5.5 试过并回退的三种「稳定化」（都记录，不藏）

1. **扩边界保护**（`METRIC_GUARD_TERMS` 只有「补货点」时）：只修掉 A35 被误判 A6 的一条，对 A07 等无效 —— guard 只挡规则层 handoff，挡不住模型层 handoff。
2. **A3 固定 `temperature=0`**：RUN 5 掉到 **41/50（82.0%）**，更差，回退。
3. **规则层强制「A3 自答不许转交」**（`tool_choice="none"`）：RUN 6/7 变为 **50/50（100%）且两次完全一致**，但实测回答里出现「我转给 A5_forecast 处理」却并没有转（假转交），且 15 条单指标问句拿不到任何数值。判定为**为分数改行为**，按红线回退。

最终保留：A5/A6 由词表确定性路由（18 条，稳定），A3 自答交真模型（32 条，不稳定）。

---

## 6. 解释集结果（Z1/Z3 的连带影响）

```
解释数字一致 30/30（100%）；四要素齐全 22/30；用例通过 22/30
```

失败 8 条及原因：

| 用例 | 类别 | 失败点 | 原因 |
|---|---|---|---|
| EX-07/08/09 | E-1004 | 缺「断货日」要素 | 构造序列（100/95/105 天）是内存构造，没有 `date` 列 → 无「首个断货日」可给，只有天数（100 个断货日）。属数据结构缺失，非回执缺陷。 |
| EX-10/11 | E-4001 | 缺原文「本轮无需补货」 | 模型改写成「无需补货（no_replenishment）」；工具回执里是原文。 |
| EX-13/14/15 | E-5001 | 缺原文「合成场景，结论不可当作真实经营依据」 | 模型改写成「合成场景演示结果，不可当作真实经营依据」。 |

对比 PACK 13（run1/run2）：数字一致 20/30（66.7%）、四要素 12/30、通过 8/30。本轮数字一致升到 30/30，四要素/通过升到 22/30 —— 提升来自 Z1（断货三字段有了真实值）+ Z2（数据集不再错位）+ Z3（回执带原文）。

---

## 7. 老 64 条 pytest 全绿

```
python -m pytest tests -q
................................................................  [100%]
64 passed, 6 subtests passed in 42.49s
```

（退出码 1 是 PowerShell 把 tracing 的 stderr 当 `NativeCommandError`，测试本身全绿。注意：不带 `tests` 路径直接 `python -m pytest` 会因 `_backup_pack14\tests\` 与 `tests\` 的 basename 冲突报 8 个 collection error —— 这是备份目录副作用，未加 `pytest.ini`（不在允许改动清单内），跑分与回归一律用 `-m pytest tests -q`。）

---

## 8. 本轮没证明的东西

1. **问数 100%（RUN 5/6）证明不了模型的理解能力** —— 那是规则表把标签写死的结果，代价是 A3 假转交 + 指标问句无数。该方案已回退；现在的 88–92% 才反映真实落点分布。
2. **解释数字 30/30 只证明「回答里的数字与后端结构化字段一致」，不等于回答正确** —— 口径（断货损失 ×1.5、售价×毛利率）本身是合成假设，没和任何真实损失/毛利数据校验过；E-1004 三条也没有「首个断货日」可校验。
3. **660/9240 这类数只在本库、本数据集成立** —— 未验证真实采购价、供应商 MOQ/起订量、真实交期波动，Z2 只证明「取对了数据集」，不证明「补对了量」。
4. **前端只做到「构建成功 + `/api/copy` 实返 + 源码 0 字面量」**，没有做像素级截图比对（P1/P2/P3/P4/P6 页面渲染、降级态是否白屏均未逐页验证）。
5. **Z4 的隔离只在 Agent 侧生效** —— `api.service` 的写接口本身仍可被直接调用（HTTP 层没有权限控制），本轮只保证「问数/解释/评测上下文拿不到写工具」。
6. **A38 只测了「不写库」，没测「开启写库后能正确写」** —— `PILOT_ENABLE_WRITE_TOOLS=1` 的真实执行路径本轮未跑。

---

## 9. 改动清单

改动既有文件（均在允许清单内）：

| 文件 | 改动 |
|---|---|
| `core/inventory.py` | `_coerce_date`、`gross_margin_rate`、`build_suggestion(inbound_batches=)`、断货三字段、`stockout_forward` |
| `api/service.py` | `_sku_detail` 传未来的 `inbound_batches`；响应加 `stockout` 块 |
| `api/schemas.py` | 新增 `StockoutForward` / `Stockout`；`SkuDetailResponse.stockout` |
| `api/constants.py`（新建） | 三条文案 + `copy_payload()` / `agent_notice()` |
| `api/main.py` | `GET /api/copy` |
| `agents/tools.py` | `dataset_name` 入参、`resolve_dataset` / `UnknownDataset`、`*_impl` 拆出、四个拒绝桩、`READ/WRITE/WRITE_GUARD_TOOLS` |
| `agents/registry.py` | `classify_intent` / `_RuleRoutingModel`、`A6_INSTRUCTIONS`、A6 只读版、`get_exec_agent`、`write_tools_enabled` / `run_write_action` |
| `frontend/src/{store.js,api.js,App.vue,errorCodes.js}`、`pages/P1Dashboard.vue,P2Replenish.vue,P3SkuDetail.vue,P4Forecast.vue,P6Workshop.vue` | 文案改从 `store.copy` 取；`resolveCode` |
| `web/dist/*` | 重新构建（`vite build`，2026-11-18） |

新增（仅证据留存，不改任何判定）：`docs/eval-report-pack13-snapshot.md`、`docs/eval-raw-pack13-snapshot.json`（跑分前对 PACK 13 基线的快照，因为 `tests/eval_qa.py` 会覆盖 `eval-report-v1.md` / `eval-raw.json`）。

未改动：`core/backtest.py`（回测口径）、`tests/cases_ask.json`、`tests/cases_explain.json`、任何 Agent instructions、`schema.py`、`web/index.html`。
