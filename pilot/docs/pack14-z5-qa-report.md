# PACK 14 / Z5 补充修 · QA 独立验收报告

> 【合成演示业务，非真实生产业务】全部结论来自本轮真实运行，原始输出照贴，未对任何数字做微调。

- 验收人：QA 严过关（Yan）
- 项目根：`C:\Users\Windows\Desktop\pilot`
- 解释器：`.venv\Scripts\python.exe`（Python 3.13.18 / pytest 9.2.0）
- 被测版本：`agents/registry.py`（A3 自答分支 handoffs=[] + `A3_READ_TOOLS`）、`agents/tools.py`（`A3_READ_TOOLS`）
- 验收方式：真实 DeepSeek 调用，**不读 eval-raw 缓存**做边界/A6/A3 专测；run8 走官方评测入口
- 临时脚本：`tests/tmp_qa_boundary.py`、`tests/tmp_qa_numbers.py`；日志：`tests/tmp_qa_boundary.log`、`tests/tmp_qa_run8.log`、`tests/tmp_qa_pytest.log`、`tests/tmp_qa_numbers.log`、`tests/tmp_qa_db_after.log`、`tests/tmp_qa_baseline_sha256.txt`

---

## 0. 判定速览

| 项 | 内容 | 结论 |
|---|---|---|
| 1 | 11 条边界一致性（11×5=55 次真实 Agent） | **达标** 11/11 五次全一致，且 11/11 命中期望 |
| 2 | A6 真转交 | **达标** 7/7 真转交（`last_agent=A6_replenish`） |
| 3 | A3 真实数字 | **部分达标** 严格"工具来源真实数字"口径 6/9；A13 明确说"没有取数能力"（但工具其实有数），A32/A33 无工具来源数字 |
| 4 | run8 完整汇总 | **达标** 问数 50/50 (100.0%)，完整汇总行见 §4 |
| 5 | 全量 pytest | **达标** 64 passed |
| 6 | 库前后计数 | **达标** 3/1 → 3/1 不变，无写库 |
| 7 | 没证明的东西 | 见 §7，共 8 点 |

**总判定：7 项中 6 项全部达标，第 3 项" A3 真实数字"未完全达标（A13 是实质缺口）。**

---

## 1. 11 条边界一致性（每条 5 次真实 Agent）

调用路径：`tests.eval_qa.call_agent("A3_ask", question)` = `Runner.run_sync(AGENTS["A3_ask"], question)`，取 `result.last_agent.name`。55 次真实调用，非缓存、非 mock。

原始表（摘自 `tests/tmp_qa_boundary.log`）：

| id | 问句 | 期望 | 5 次实际 last_agent | 是否 5 次完全一致 | 是否都等于期望 |
|---|---|---|---|---|---|
| A07 | SKU-002 的在手库存是多少？ | A3_ask | A3_ask, A3_ask, A3_ask, A3_ask, A3_ask | 是 | 是 |
| A13 | SKU-017 的服务水平是多少？ | A3_ask | A3_ask, A3_ask, A3_ask, A3_ask, A3_ask | 是 | 是 |
| A14 | SKU-017 的总交期是多少天？ | A3_ask | A3_ask, A3_ask, A3_ask, A3_ask, A3_ask | 是 | 是 |
| A15 | SKU-017 的安全库存是多少件？ | A3_ask | A3_ask, A3_ask, A3_ask, A3_ask, A3_ask | 是 | 是 |
| A20 | 对比 SKU-004 和 SKU-005 的在手库存。 | A3_ask | A3_ask, A3_ask, A3_ask, A3_ask, A3_ask | 是 | 是 |
| A21 | 「合成-正在缺货」和「合成-断货14天」两个数据集里，SKU-002 的日均销量差多少？ | A3_ask | A3_ask, A3_ask, A3_ask, A3_ask, A3_ask | 是 | 是 |
| A30 | WAPE 的口径是怎么算的？ | A5_forecast | A5_forecast, A5_forecast, A5_forecast, A5_forecast, A5_forecast | 是 | 是 |
| A33 | 断货日是怎么剔除的？ | A3_ask | A3_ask, A3_ask, A3_ask, A3_ask, A3_ask | 是 | 是 |
| A36 | SKU-999 的库存是多少？ | A3_ask | A3_ask, A3_ask, A3_ask, A3_ask, A3_ask | 是 | 是 |
| A37 | 预测一下 SKU-017 下个月的价格。 | A5_forecast | A5_forecast, A5_forecast, A5_forecast, A5_forecast, A5_forecast | 是 | 是 |
| A46 | 帮我把这条补货申请审批通过。 | A6_replenish | A6_replenish, A6_replenish, A6_replenish, A6_replenish, A6_replenish | 是 | 是 |

原始汇总行：
```
[1 汇总] 一致 11/11；命中期望 11/11
```

**结论**：11 条全部 5/5 完全一致，无一条翻转。A3_ask 自答分支没有再"嘴上说转交但实际没转"，A5/A6 真 handoff 分支照常工作。

---

## 2. A6 真转交

规则判 A6（`expected_intent=A6_replenish`）的 7 条，每条跑 1 次真实 Agent，核对 `last_agent`。重点防"假转交"（A3 嘴上说转给 A6 但落点仍是 A3_ask）。

原始表（摘自 `tests/tmp_qa_boundary.log`）：

| id | 期望 | 实际 last_agent | 是否真转交 | 回答首 80 字 |
|---|---|---|---|---|
| A09 | A6_replenish | A6_replenish | 是 | **SKU-017 补货建议：420 件，占用资金 4,200 元**  **预测依据**（数据集：合成-断货14天） - 最佳模型：snaive，WAPE = |
| A10 | A6_replenish | A6_replenish | 是 | **SKU-002 补货结论（数据集：合成-断货14天，holding_days=45）**  **1) 预测结论** - 最佳模型：**croston_sba |
| A17 | A6_replenish | A6_replenish | 是 | 两个 SKU 的对比结果如下（数据集：**合成-断货14天**，持有天数 45 天，服务水平 97%）：  ## 预测结论 \| 项目 \| SKU-002 \| S |
| A24 | A6_replenish | A6_replenish | 是 | 两个 SKU 的补货建议与占用资金对比如下（数据集均为「合成-断货14天」，持有天数 45 天）：  \| 项目 \| SKU-001 \| SKU-008 \| \|-\| |
| A31 | A6_replenish | A6_replenish | 是 | 关于建议量的计算口径，我先说明：**具体公式由工具内部的 core.build_suggestion 计算得出，我这边只能按工具回执里带出的口径字段来说明，不会 |
| A38 | A6_replenish | A6_replenish | 是 | 我需要先确认一下：您想补的是哪个 SKU？请提供 SKU 编号。  另外有两点要提前说明：  1. **我不能"直接下单"**。我能做的是先给出补货建议，再走" |
| A46 | A6_replenish | A6_replenish | 是 | 我需要一个申请单号（apply_id）才能执行审批。请提供要审批的补货申请编号。  另外需要提醒：当前上下文是**只读**的，审批类操作（approve_app |

原始汇总行：
```
[2 汇总] 真转交 7/7
```

**结论**：7/7 真转交，未发现假转交。run8 里另外两条 A6 用例 A19/A43 也各 HIT 一次（见 §4 日志），但没做 5 次重复。

---

## 3. A3 真实数字

### 3.1 宽松口径：答案里是否出现任意数字（来自 `tests/tmp_qa_boundary.log`）

| id | 问句 | 答案中的真实数字摘录 | 是否含数字 | last_agent |
|---|---|---|---|---|
| A07 | SKU-002 的在手库存是多少？ | …在手库存：678.0 件…在途：0.0 件…快照日期：2026-06-29…（共 19 处数字） | 是 | A3_ask |
| A13 | SKU-017 的服务水平是多少？ | …属于预测/库存策略参数，需要走 A5_forecast 或由策略侧给出，我这边没有这个指… | 是※ | A3_ask |
| A14 | SKU-017 的总交期是多少天？ | …总交期是 **53 天**…日均需求 8.77 件，服务水平 97%…SS=69.77…历史断货 0 天（共 13 处） | 是 | A3_ask |
| A15 | SKU-017 的安全库存是多少件？ | …要哪个？或者告诉我数据集名称，我直接跑一遍 SKU-017。 | 是※ | A3_ask |
| A20 | 对比 SKU-004 和 SKU-005 的在手库存。 | …截至 2026-06-29，数据集：合成-断货14天…（共 23 处数字） | 是 | A3_ask |
| A21 | …两个数据集里，SKU-002 的日均销量差多少？ | …合成-正在缺货 \| **8.80 件** \| 8 天 \| 2026-06-22…（共 57 处数字） | 是 | A3_ask |
| A32 | 服务水平为什么是 97%？ | …97% 意味着在 100 个补货周期里，预计约 97 个周期…（共 23 处数字） | 是※ | A3_ask |
| A33 | 断货日是怎么剔除的？ | …当前可用数据集 6 个（均为合成场景）：合成-交期延误20天…（共 8 处数字） | 是※ | A3_ask |
| A36 | SKU-999 的库存是多少？ | …dataset_id=ds_00b31ed333b05de698c0 里查不到任何库存数据（共 12 处数字） | 是※ | A3_ask |

※ **这个"是"不可信**：宽松正则把 SKU 编号、数据集名里的数字、枚举序号（1./2.）、行业常识（97%、1.88）都算成数字。下面是严格口径。

### 3.2 严格口径：答案中是否含"工具回执来源"的真实数字（来自 `tests/tmp_qa_numbers.log`，0 次 LLM，只读 run8 raw）

| id | 问句 | 工具来源标记（命中项） | 是否含真实数字 | 是否出现「无取数能力/转交」 | 答案摘录 |
|---|---|---|---|---|---|
| A07 | SKU-002 的在手库存是多少？ | sku_snapshot.在途, sku_snapshot.数据集ID, sku_snapshot.截止日, 工具数据集名 | 是 | 否 | …SKU-002 当前在手库存为 678.0 件，在途 0.0 件。  - 数据源：数据集「合成-断货14天」（dataset_id=ds_00b31ed333b05de698c0），取… |
| A13 | SKU-017 的服务水平是多少？ | 工具数据集名（仅提到数据集名，无指标数字） | **否（实质）** | 否 | … 实际可发量 / 需求量  另外请告诉我用哪个数据集（默认「合成-断货14天」）。口径确认后，我再取真实数据计算… |
| A14 | SKU-017 的总交期是多少天？ | run_replenish.占用资金, 工具数据集名 | 是 | 否 | …\| 0 天（无断货日） \| \| 建议补货量 \| 420 件（占用资金 4,200 元，按 45 天持有期） \|… |
| A15 | SKU-017 的安全库存是多少件？ | sku_snapshot.在手, sku_snapshot.数据集ID, 工具数据集名 | 是 | 是 | …ventory_daily）180 行 \|  也就是说：**在手 279 件、无在途**，但"安全库存是多少"这一问题本身在本数据集里无对应字段，无法回答… |
| A20 | 对比 SKU-004 和 SKU-005 的在手库存。 | sku_snapshot.数据集ID, 工具数据集名 | 是 | 否 | …对比结果（数据集：合成-断货14天，dataset_id=ds_00b31ed333b05de698c0；口径：最新日期 2026-06-29 的库存快照… |
| A21 | …两个数据集里，SKU-002 的日均销量差多少？ | sku_snapshot.截止日, 工具数据集名 | 是 | 否 | …录：`inventory_daily`，各 180 行（快照截至 2026-06-29）。 - 日均由 `core.build_suggestion` 基于上述销售日记录计算… |
| A32 | 服务水平为什么是 97%？ | （无） | 否 | 否 | …服务水平 97% 是一个**业务目标参数**，不是从数据里算出来的… |
| A33 | 断货日是怎么剔除的？ | （无） | 否 | 否 | …这个属于方法解释类问题，我直接简要说明（不涉及具体 SKU 数字，不转交）… |
| A36 | SKU-999 的库存是多少？ | sku_snapshot.销售行数, sku_snapshot.库存行数, sku_snapshot.数据集ID | 是 | 是 | …在手数量：无数据 - 在途数量：无数据 - 数据行数口径：销售日记录 0 行（sales_daily），库存日记录 0 行… |

原始汇总行：
```
[3 精核汇总] 含工具来源真实数字 7/9
```
（其中 A13 的 1 项只是"工具数据集名"弱命中，实际未给指标数字，故实质为 **6/9**。）

### 3.3 点名验证：SKU-009 现在多少在手（真实调用，原文照贴）

```
last_agent=A3_ask status=ok error=None
答案原文：SKU-009 当前库存如下：

- **在手：678.0 件**
- **在途：0.0 件**
- 数据截至：2026-06-29

数据来源与行数口径：
- 数据集：合成-断货14天（dataset_id=ds_00b31ed333b05de698c0）
- 库存快照表 `inventory_daily`：180 行
- 销售记录表 `sales_daily`：180 行

说明：以上为 SYNTHETIC 合成演示数据，仅通过只读查询获取；没有写入数据库，也没有改动数据。

如果需要补货建议量（涉及日均消耗、交期、断货损失），请告诉我，我会转交 A6_replenish 计算。
```
✅ 取到真实数字 678.0 件 / 0.0 件 / 180 行。

### 3.4 未达标点（照实报，不微调）

**A13「SKU-017 的服务水平是多少？」答案原文（摘自 `tests/tmp_qa_borderline_answers.log`）：**

> "服务水平"不是库存快照或补货建议能直接算出的字段，需要先确认口径，所以我先不给出具体数字，以免编造。
> - 可查：SKU-017 的在手量、在途量、日均销量、总交期、历史断货天数、断货损失、建议补货量和占用资金
> - **不可查：服务水平（service level）这类指标，当前只读工具没有返回该字段**
> 请确认一下你要的口径……另外请告诉我用哪个数据集（默认「合成-断货14天」）。口径确认后，我再取真实数据计算……

**但工具其实有这个数。** 直调 `tools._run_replenish_impl("SKU-017")`（0 次 LLM）原始输出：

```
SKU SKU-017；本次使用的数据集：合成-断货14天；日均 8.77 件，服务水平 97%（cost_reverse），总交期 53 天，σ_LT=37.10，SS=69.77；历史断货 0 天（历史无断货日）；断货损失约 0 元（口径：断货天数 × 日均 × 售价 × 毛利率 × 1.5，毛利率=(售价-成本)/售价）；建议补 420 件，占用资金 4,200 元；口径声明：合成场景，结论不可当作真实经营依据。
```

`run_replenish` 明确在 `A3_READ_TOOLS` 里且回执带"服务水平 97%"，但 A3 答"当前只读工具没有返回该字段"——这是**模型没调用已挂工具**，属实质缺口，不是判定口径问题。同类次要问题：A15 答"不提供安全库存字段"，但工具回执里有 `SS=69.77`（A15 答案本身仍含 279 件/180 行真实数字，故只算次要）。

A32/A33 是"为什么/怎么剔除"的口径解释类问句，答案没有工具来源数字；按"答案里必须出现真实数字"的字面要求也不达标，但这两条的性质是方法解释，是否应要求数字值得产品确认。

---

## 4. run8 评测（完整汇总行原样贴出）

复现命令：
```
cd C:\Users\Windows\Desktop\pilot
.venv\Scripts\python.exe -m tests.eval_qa --only both
```

**完整汇总行（原始，未删减）：**
```
[RUN 8] 2026-11-18T20:42:36 | 问数命中 50/50 (100.0%) | 解释数字一致 30/30 (100.0%) | 四要素 22/30 | 用例通过 22/30 | LLM 调用 50 次（解释缓存命中 26） | 总耗时 146.1s | 平均 2.92s/次
```

六项必含字段齐全：问数命中率 50/50(100.0%)、解释数字一致率 30/30(100.0%)、四要素 22/30、用例通过 22/30、LLM 调用 50 次、耗时 146.1s。

**本轮生成文件路径与时间戳：**
```
[RAW] C:\Users\Windows\Desktop\pilot\docs\eval-raw.json
[REPORT] C:\Users\Windows\Desktop\pilot\docs\eval-report-v1.md
-rw-r--r-- 1 Windows 197121 205805 2026-11-18 20:42:36.029476300 +0800 docs/eval-raw.json
-rw-r--r-- 1 Windows 197121  16239 2026-11-18 20:42:36.032464400 +0800 docs/eval-report-v1.md
```

`docs/eval-report-v1.md` 内的汇总行（原文）：
```
- 本轮汇总行：`[RUN 8] 2026-11-18T20:42:36 | 问数命中 50/50 (100.0%) | 解释数字一致 30/30 (100.0%) | 四要素 22/30 | 用例通过 22/30 | LLM 调用 50 次（解释缓存命中 26） | 总耗时 146.1s | 平均 2.92s/次`
```

50 条问数全部 HIT（含 A19/A43 两条 A6），无 MISS、无 error 降级。解释 30 条数字一致 30/30，但四要素只有 22/30（E-1004×3 / E-4001×2 / E-5001×3 缺指定文案），这一项本轮未修、也不在 Z5 改动范围内，照实记录。

---

## 5. 全量 pytest

命令：`./.venv/Scripts/python.exe -m pytest tests`

原始输出末尾（摘自 `tests/tmp_qa_pytest.log`）：
```
============================= test session starts =============================
platform win32 -- Python 3.13.18, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\Users\Windows\Desktop\pilot
plugins: anyio-4.16.0
collected 64 items

tests\test_api.py .........                                              [ 14%]
tests\test_core.py ............................                          [ 57%]
tests\test_data.py ........                                              [ 70%]
tests\test_rag.py ....                                                   [ 76%]
tests\test_replenish_flow.py ......                                      [ 85%]
tests\test_routes.py ......                                              [ 95%]
tests\test_ws.py ...                                                     [100%]

============================= 64 passed in 42.41s =============================
[non-fatal] Tracing: shutdown timeout reached; dropping queued traces.
```

✅ 64 passed，无失败项。

---

## 6. 库前后计数

验收前（本次工作最早，在任何真实调用之前）：
```
DATABASE_URL= postgresql+psycopg://postgres@127.0.0.1:5432/pilot
replenish_apply= 3
purchase_order= 1
```

边界/A6/A3 专测脚本自身前后（共 72 次真实 Agent 调用）：
```
[DB-BEFORE] replenish_apply=3 purchase_order=1
[DB-AFTER] replenish_apply=3 purchase_order=1  不变
```

全部验收（含 run8 + pytest）结束后：
```
replenish_apply= 3
purchase_order= 1
```

✅ 前后不变，没有问句触发写库；run8 日志中也没有任何 `[WARN] ... 触发了写库`。

---

## 7. 本轮没证明的东西

1. **LLM 随机性是否彻底消除，未证明**。11 条×5 次只覆盖了这 11 条、且在约 3.5 分钟内采样；我比对的只是 `last_agent`，**没有比对答案文本是否逐字一致**（同一问句 5 次的自然语言答案明显不同）。自答分支仍走真 DeepSeek，temperature 未锁定（历史上锁 0 反而掉到 82% 已回退），跨时段/跨模型的稳定性没有数据。
2. **词表边界，未证明**。`classify_intent` 只认写死的 `("wape","预测","模型","回测")`、`("建议补","补货","补多少","订货","订多少","下单","建议量","审批")`、`("补货点",)`。同义问法/新问法（"库存够不够"、"还要补吗"、英文词）如何落点，本轮没有覆盖。
3. **未覆盖问句**：50 条里只有 11 条做了 5 次重复；A6 真转交只单独跑了 7/9（A19/A43 只在 run8 各跑 1 次）；A5 真 handoff 只由 A30/A37 的 5 次验证；口径与追溯组多数问句（A25–A29/A34/A35）只跑 1 次。
4. **解释结果大量依赖缓存**：30 条解释中 26 条是跨轮缓存复用，本轮真调用只有 EX-03/EX-07/EX-08/EX-09 四条。"解释数字一致 30/30"不能当作 30 条本轮真实重算全过的证据。
5. **四要素 22/30 未达标**，本轮没有修，也不属于 Z5 改动范围；E-1004/E-4001/E-5001 的指定文案缺失仍然存在。
6. **写工具执行版 `get_exec_agent` / `run_write_action` 没有跑**。只证明了只读上下文计数不变，**没有**主动越权尝试（例如让 A3 调 `submit_replenish_apply`）来验证物理隔离；Z4 的隔离结论沿用前轮，不是本轮新证。
7. **流式路径（`/ws/runs` 的 `run_streamed`）下 A3 自答分支未验证**。`_RuleRoutingModel.stream_response` 直接 `NotImplementedError`；pytest 的 3 条 ws 测试只跑 A5/A6。本轮所有 A3 结论都来自 `run_sync`。
8. **真实经营效果未验证**：全部数据 SYNTHETIC；A1/A2/A4/A7 未纳入本轮验收；A3 是否"答得对"（而不只是"落点对"）只人工抽查了 A07/A13/A15/A20/A21/SKU-009 六条，其余未逐条审读。

---

## 8. round2 定向复测（A13 文字补丁）

> 工程师针对 round1 §3.4 的 A13 缺口打了一个**纯文字补丁**：`agents/tools.py` 的 `run_replenish` docstring 补「服务水平/σ_LT/SS」字段清单；`agents/registry.py` 的 A3 instructions 补泛化取数纪律（"先调用只读工具取数…不得臆断工具没有该字段"）。实现体、词表、判定口径一行未动。本节是 QA 对该补丁的定向复测，**不重跑全量 7 项**。

补丁核对（`diff -u _backup_pack14_fix/round2/*.py agents/*.py` 原始输出）：
```
--- _backup_pack14_fix/round2/registry.py	2026-11-18 20:45:55.985549600 +0800
+++ agents/registry.py	2026-11-18 20:46:01.913440600 +0800
@@ -264,9 +264,11 @@
-        # PACK 14 / Z5 补充：仅能力配套说明；上面的判定三分法表述一字未动，不为提分改口径。
+        # PACK 14 / Z5 补充：能力配套说明 + 泛化取数纪律；判定三分法表述与词表一字未动，不为提分改口径。
         "可调用只读工具取真实数字（sku_snapshot / list_datasets / run_replenish），"
-        "禁止编造、禁止写库。",
+        "禁止编造、禁止写库。"
+        "用户问任何单一指标（在手 / 在途 / 服务水平 / 安全库存 / 交期等）时，先调用只读工具取数、"
+        "依据回执作答；不得臆断工具没有该字段，也不得说『没有取数能力』。",
--- _backup_pack14_fix/round2/tools.py	2026-11-18 20:45:55.991549800 +0800
+++ agents/tools.py	2026-11-18 20:46:01.885768000 +0800
@@ -448,7 +448,8 @@
-    回执固定带出：本次使用的数据集 / 日均 / 总交期 / 历史断货天数 + 首个断货日 /
+    回执固定带出：本次使用的数据集 / 日均 / 服务水平（含来源，如 cost_reverse）/ σ_LT /
+    安全库存 SS / 总交期 / 历史断货天数 + 首个断货日 /
```

补丁后文件 SHA256（round1 基线已 FAILED，符合预期）：
```
bdb31e3790ace0b19c605e52e1b977d787f8b8cd31e0f2897f47111f7f848f20 *agents/registry.py
3b777027d9660e11f325b16470f821d363c80cca9e970bbe1c01c043cd1f6f9e *agents/tools.py
```

### 8.1 A13 / A15 各 5 次真实数字严格判定

临时脚本：`tests/tmp_qa_round2.py`；日志：`tests/tmp_qa_round2.log`；逐次答案原文审计：`tests/tmp_qa_round2_audit.json`。全部走 `call_agent("A3_ask", q)` = `Runner.run_sync`，真实 DeepSeek 调用，**不读 eval-raw 缓存**。严格口径与 §3.2 完全相同：只认工具回执来源数字；禁用说法正则覆盖「当前只读工具没有返回该字段 / 没有取数能力 / 没有直接查询工具 / 我先不给出具体数字以免编造」。

原始表（摘自 `tests/tmp_qa_round2.log`）：

| id | 次 | last_agent | 工具来源数字标记 | 含真实数字 | 禁用说法 | 答案数字摘录 |
|---|---|---|---|---|---|---|
| A13 | 1 | A3_ask | sku_snapshot.在手/在途/销售行数/库存行数/数据集ID/截止日, run_replenish.断货天数/占用资金 | 是 | 无 | …**SKU-017 的服务水平 = 97%（来源：cost_rev…（共34处） |
| A13 | 2 | A3_ask | sku_snapshot.销售行数/库存行数/数据集ID/截止日, run_replenish.占用资金 | 是 | 无 | …**SKU-017 的服务水平 = 97%（来源：cost_rev…（共26处） |
| A13 | 3 | A3_ask | sku_snapshot.在手/在途/数据集ID/截止日, run_replenish.日均/总交期/服务水平/σ_LT/SS/断货天数/占用资金 | 是 | 无 | …**SKU-017 服务水平 = 97%** …`run_replenish` 回执明确给出「服务水平 97%（cost_reverse）」… |
| A13 | 4 | A3_ask | run_replenish.日均/总交期/σ_LT/SS/断货天数 | 是 | 无 | …**SKU-017 服务水平 = 97%**…日均 8.77 / σ_LT=37.10 / 安全库存 SS=69.77 / 总交期 53 天… |
| A13 | 5 | A3_ask | run_replenish.日均/总交期/σ_LT/SS/断货天数/占用资金 | 是 | 无 | …**SKU-017 的服务水平：97%**…日均 8.77 件、总交期 53 天、σ_LT = 37.10… |
| A15 | 1 | A3_ask | sku_snapshot.在手/在途/销售行数/库存行数/数据集ID/截止日, run_replenish.SS/断货天数/占用资金 | 是 | 无 | …**SKU-017 安全库存 = 69.77 件（约 70 件）**… |
| A15 | 2 | A3_ask | sku_snapshot.在手/在途/销售行数/库存行数/数据集ID/截止日, run_replenish.SS/断货天数/占用资金 | 是 | 无 | …**SKU-017 安全库存 = 69.77 件（约 70 件）**… |
| A15 | 3 | A3_ask | run_replenish.总交期/服务水平/σ_LT/SS/占用资金 | 是 | 无 | …**SKU-017 安全库存 = 69.77 件**（约 70 件）… |
| A15 | 4 | A3_ask | run_replenish.SS/断货天数/占用资金 | 是 | 无 | …**SKU-017 安全库存 = 69.77 件，约 70 件**… |
| A15 | 5 | A3_ask | run_replenish.占用资金 | 是 | 无 | …**SKU-017 的安全库存为 69.77 件，约 70 件。**… |

原始汇总行：
```
[R2-1 A13] 达标 5/5
[R2-1 A15] 达标 5/5
```

A13 第 3 次答案原文（逐字，来自 `tests/tmp_qa_round2_audit.json`）：
```
**SKU-017 服务水平 = 97%**

依据与口径：
- **来源**：`run_replenish` 回执明确给出「服务水平 97%（cost_reverse）」，即由成本/售价结构反推的最优服务水平，不是人工设定值。
- **数据集**：合成-断货14天（dataset_id=ds_00b31ed333b05de698c0，SYNTHETIC 合成演示数据）
- **行数口径**：sales_daily 180 行、inventory_daily 180 行；截至 2026-06-29 在手 279 件、在途 0 件
- **配套参数**：日均 8.77 件，总交期 53 天，σ_LT=37.10，安全库存 SS=69.77，历史断货 0 天，建议补货 420 件（占用资金 4,200 元）

⚠️ 提示：这是合成场景数据，结论不可当作真实经营依据。如需看 97% 服务水平下的补货建议明细，或换其他数据集（如「合成-正在缺货」）对比，告诉我即可。
```

**结论**：A13 5/5 达标。round1 的三句禁用说法（"当前只读工具没有返回该字段"、"我先不给出具体数字以免编造"、"没有取数能力"）在 5 次回答中**一次都没出现**；5 次都直接给出 97% 并注明 `cost_reverse` 来源，附带日均 8.77 / 总交期 53 / σ_LT 37.10 / SS 69.77 等工具回执数字。A15 次要问题也一并改善：5/5 直接给出 69.77 件（约 70 件）。

### 8.2 第 1 项关键路由回归

| id | 期望 | 3 次 last_agent | 是否全一致且命中 |
|---|---|---|---|
| A07 | A3_ask | A3_ask, A3_ask, A3_ask | 是 |
| A46 | A6_replenish | A6_replenish, A6_replenish, A6_replenish | 是 |

### 8.3 第 2 项 A09 真转交回归

| id | 期望 | 3 次 last_agent | 是否 3 次真转交 | 回答首 80 字 |
|---|---|---|---|---|
| A09-1 | A6_replenish | A6_replenish | 是 | **SKU-017 补货结论（合成演示数据）：建议补 420 件，占用资金 4,200 元。**  **预测依据** - 数据集：合成-断货14天 - 最佳模型 |
| A09-2 | A6_replenish | A6_replenish | 是 | # SKU-017 补货建议  ## 预测结论（run_forecast） - 数据集：**合成-断货14天** - 最佳模型：**snaive**，WAPE |
| A09-3 | A6_replenish | A6_replenish | 是 | SKU-017 补货结论如下（**合成演示数据，非真实经营依据**）：  ## 预测结论 - 数据集：合成-断货14天 - 最佳模型：**snaive**，WA |

原始汇总行：
```
[R2-3 A09] 3 次真转交 = 是
```

### 8.4 库计数

```
[DB-BEFORE] replenish_apply=3 purchase_order=1
[DB-AFTER] replenish_apply=3 purchase_order=1  不变
[TOTAL] round2 真实 Agent 调用 19 次
```
✅ 3/1 前后不变，无写库。

### 8.5 round2 判定

**A13 已达标**（5/5 真实数字 + 0 次禁用说法），A15 次要问题同步修复。**无新回归**：A07/A46 路由各 3/3 稳定，A09 3/3 真转交，库计数不变。本轮为第 2 轮（2 轮硬上限），到此收口，不再进入第 3 轮。round1 §7 中"未证明的东西"除 A13/A15 相关描述外仍成立；§3.2 里 A32/A33 口径解释类无工具数字的性质判定不变。

---

## 9. 红线遵守与完整性核对

验收结束后对关键文件复算 SHA256（`sha256sum -c tests/tmp_qa_baseline_sha256.txt`）：
```
agents/registry.py: OK
agents/tools.py: OK
core/backtest.py: OK
tests/cases_ask.json: OK
tests/cases_explain.json: OK
tests/eval_qa.py: OK
```
（以上为 round1 结束时的状态。round2 后 `agents/registry.py` / `agents/tools.py` 两项变为 `FAILED`，是工程师补丁所致；其余四项仍 `OK`：
```
agents/registry.py: FAILED
agents/tools.py: FAILED
core/backtest.py: OK
tests/cases_ask.json: OK
tests/cases_explain.json: OK
tests/eval_qa.py: OK
```
）

✅ 未改 `core/backtest.py`、未改用例集、未改判定口径、未改 `.env`、未为通过某条问句加词、未读/打印 `.env` 内容。只在 `tests/` 下新增 `tmp_qa_*` 脚本与日志，未改既有评测文件。
