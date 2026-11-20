# 差距分析与落地方案（2026-11-20）

> 角色：技术负责人。本轮只出报告，不改业务代码。
> 判定标准：**有路由、有表、有测试、有前端页面，四者齐全才算“已实现”**；文档写了不算，文件名像不算。
> 引用格式：代码 `path:line`；需求 `文档名 + 小节`。

## 报告说明（先把话说清楚）

- **读图能力**：具备。已直接查看 `docs/requirements/assets/v1.1/img_001.jpg`（分层总体架构）、`img_002.jpg`（代码分层与业务边界）、`img_003.jpg`（技术栈选型）、`img_006.jpg`（智能客服业务流程图）、`img_098.jpg`（部署图）。其余 90 张未逐张查看，相关结论**只靠正文文字推断**，在表中标为“文字推断”。
- **阅读范围**：`AGENTS.md`、`docs/requirements/README.md`、V1.1 架构与需求（844 行）、模块需求细化 V1.1（724 行）、SRS V1.0（587 行）、两周计划 V1.1（829 行）已全文读完；`pilot/schema.py`、`pilot/api/main.py`、`pilot/api/service.py`、`pilot/core/` 全包、`pilot/agents/registry.py`、`pilot/agents/tools.py`、`pilot/rbac/api.py`、`pilot/loaders/`、`pilot/frontend/src/`、`pilot/tests/`（143 个测试函数）已读完。`pilot/docs/pack*.md` 只读了封版与验收两份，其余按需抽查。
- **版本冲突裁决**：按 `docs/requirements/README.md` 第六节，以 **V1.1 为准**，V1.0 为历史基线；`模块需求细化_V1.1` 的验收标准优先。
- **分支说明**：本分支 `arena/20303949-ai` 原基点 `c4a21e9` 是孤儿初始提交（仅 `README.md`），与 `main` 无共同祖先。本轮已 `git merge origin/main --allow-unrelated-histories` 把 `main@45a8995` 合入本分支，报告在此基础上提交。PR 相对 `main` 的 diff 只有本文件。

---

## 1. 一页结论（人话版）

**结论一：`pilot/` 是一个做得很好的“补货预测 Pilot”，但它不是文档里说的“跨境电商 AI 中枢平台”。**
Pilot 的真实身份写在 `pilot/README.md` 第一行：“七 Agent 跨境备货助手 · Pilot”。它把预测、补货建议、审批履约、RBAC 这条线做扎实了（143 测试、五闸 5/5、UAT 全链路走通）。但文档承诺的 M01–M10 十个模块里，**只有 M07 补货算半成品，其余九个要么是骨架、要么是模拟、要么完全没有**。答辩时如果按 M01–M10 的验收标准问，Pilot 只能答上 M07 和 M10 的一半。

**结论二：文档之间互相打架，代码只跟其中一份对得上。**
三套文档各说各话：SRS 说 7 个 Agent（含客服），模块细化说 10 个模块（不含客服），两周计划说用 LangChain+SQLite，V1.1 说用 FastAPI+PostgreSQL+Vanna+ComfyUI。代码实际用的是 **OpenAI Agents SDK + PostgreSQL + dataset_id 租户**，跟三份文档的架构、目录、字段名都对不上。**不先裁决文档，任何新开发都会写出第四种口径。**

**结论三：最危险的不是缺功能，是“假实现”。**
`pilot/agents/tools.py:172-177` 的 `query_order()` 和 `query_logistics()` 是写死的字符串（“已付款，待发货”“预计 2 日送达”），注释却写“查询自订单表”。`pilot/app.py` 的 Streamlit 调试台因为 `import core` 被 `pilot/core/` 包抢占，**已经跑不起来了**（调的是旧 `core.py` 的接口，拿到的是新包）。`AUTH_ENABLED` 默认关闭、CORS 默认 `*`，部署上去就是裸奔。这三处不修，上线第一天就会出事。

**结论四：两周能保住的只有“预测→补货→审批”这一条线，其余必须砍。**
如果只有两周，我会砍掉：M01 采集、M02 店铺同步、M03 选品、M04 内容、M05 发布、M09 驾驶舱设计（全部不做）；保住：M07 补货（补齐口径）、M06 未来预测（补一个接口）、M10 权限（已实现，只需开鉴权）。**两周的目标不是“十个模块都过”，而是“一条线从数据到审批全程可答辩”。**

**结论五：第一件事是修“假实现”和“坏掉的入口”，不是加新功能。**
先把 `query_order` 的假数据改成诚实报错、把 `app.py` 的坏导入修好、把 `AUTH_ENABLED` 默认值和 CORS 收紧。这三件事合计不到一天，但它们决定答辩时被问“数据哪来的”时，你是诚实还是心虚。

---

## 2. 差距总表

### 2.1 总览（M01–M10）

| 模块 | 现状 | 缺口（一句话） | 优先级 |
|---|---|---|---|
| M01 商品采集与竞品查询 | 未实现 | 无 Amazon 采集、无 ASIN、无购买量区间，CSV 导入只是销量/库存 | P0（文档要求，但两周内砍） |
| M02 店铺同步与测试数据 | 未实现 | 无 SP-API 同步、无店铺/订单/库存快照表，Shopify 客户端只在坏掉的 `app.py` 里 | P0（两周内砍） |
| M03 选品 Agent | 未实现 | 只有 1688 模拟报价比价，无搜图、无利润 FBM/FBA、无商标专利 | P0（两周内砍） |
| M04 产品内容生成 | 未实现 | A7 是空骨架，无生成任务/素材表，无 ComfyUI | P0（两周内砍） |
| M05 亚马逊草稿与确认发布 | 未实现 | 无草稿接口、无提交记录表 | P0（两周内砍） |
| M06 销量预测 | 半实现 | 只有回测对比，无未来 7/14/30 天预测的保存与评估 | P0（两周内保） |
| M07 补货 | 半实现 | 算法与审批流有，但状态机、公式、成本卡与文档口径不一致 | P0（两周内保） |
| M08 智能问数 | 半实现 | 只有意图路由+只读取数，无本体、无 `/bi/query`、无会话 | P1（两周内砍） |
| M09 经营驾驶舱 | 半实现 | 只有 KPI 看板，无设计/草稿/发布双版本 | P1（两周内砍） |
| M10 公共管理与任务审核 | 半实现 | RBAC 真实现，但无参数版本、无任务中心 | P0（两周内保 RBAC） |

### 2.2 M01–M10 三列对照（需求要点 / 代码现状 / 结论）

#### M01 商品采集与竞品查询

- **需求要点**（`模块需求细化_V1.1.md` M01 节）：美国站公开页面采集、ASIN 去重、标题/售价/购买量原文/归属、近 N 月+价格+FBA/FBM+销量门槛筛选、快照追加、M01-A01~A06 六条验收。
- **代码现状**：
  - 无采集器：`pilot/loaders/` 只有 `base.py`（upsert）、`csv_import.py`（CSV 销量/库存）、`public_uci.py`（UCI 公开数据集）、`supplier_quotes.py`（模拟报价）、`synthetic.py`（合成场景）。无 Scrapy、无浏览器、无 ASIN 字段（`pilot/loaders/csv_import.py:64` 解析的列是 `date,sku,sales_qty,on_hand,in_transit` + 9 个主数据列）。
  - 无对应表：`pilot/schema.py` 无 `products` 之外的商品快照表；`Products` 表（`pilot/schema.py:77`）只有 `sku/title/unit_cost/price/moq/pack_size/lead_*`，无 ASIN、无购买量、无快照历史。
  - 无路由：`pilot/api/main.py` 无 `/api/v1/products`、无采集批次接口。
- **结论**：**未实现**。CSV 导入不能冒充采集。

#### M02 店铺同步与测试数据管理

- **需求要点**（`模块需求细化_V1.1.md` M02 节）：SP-API 授权、商品/销量/库存增量同步、去重与修订、测试成本/在途独立批次、M02-A01~A06。
- **代码现状**：
  - 无 SP-API：`pilot/shopify_client.py` 只被 `pilot/app.py:30,42-43` 调用（Streamlit 调试台），FastAPI 侧无任何店铺同步。`pilot/api/main.py` 无 `/api/v1/store-syncs`。
  - 无对应表：`pilot/schema.py` 无 `stores/sales_facts/inventory_snapshots/sync_runs`；现有 `SalesDaily`（`pilot/schema.py:100`）是 `(dataset_id,sku,date)` 粒度，无店铺、无订单、无修订版本。
  - 测试数据：`pilot/scenarios.py:118-148` 有 S1–S6 六套合成场景，`pilot/loaders/synthetic.py:144` 有 `SyntheticLoader`，但它们是演示数据集，不是 M02 定义的“独立测试批次”（无批次启用/停用/版本指向）。
- **结论**：**未实现**。合成场景 ≠ 店铺同步。

#### M03 选品 Agent

- **需求要点**（`模块需求细化_V1.1.md` M03 节）：图文初筛、1688 搜图与同规格单件价、FBM/FBA 利润（M03-A04/A05 有精确算例）、商标+外观专利、历史复查、M03-A01~A11。
- **代码现状**：
  - A4 是骨架：`pilot/agents/registry.py:329-344` 的 `_skeleton()` 给 A4_sourcing 空工具，指令明写“本轮未实现”。
  - 只有模拟比价：`pilot/schema.py:353` 的 `SupplierQuotes`（每 SKU 3 家 MOCK-A/B/C，`is_mock` 恒 true）+ `GET /api/p3/supplier-quotes`（`pilot/api/main.py:248`）。`pilot/docs/iteration-backlog.md` BL-01 明确 1688 真实采集不做。
  - 无利润引擎：`pilot/core/` 无 FBM/FBA 费用计算（无头程/尾程/平台抽点/仓储/广告预留）。`pilot/core/routes.py:32` 的 `ROUTE_ASSUMPTIONS` 是海/空/铁/卡航**合成假设**，不是货代报价。
  - 无商标专利：全仓无相关代码。
- **结论**：**未实现**。模拟报价卡片不能冒充选品。

#### M04 产品内容生成 Agent

- **需求要点**（`模块需求细化_V1.1.md` M04 节）：八类内容（标题/五点/描述/后台词/主图/附图/A+/视频）、关键词、校验、局部修改、版本关联、M04-A01~A09。
- **代码现状**：
  - A7 是骨架：`pilot/agents/registry.py:344` 同上。
  - 无表：`pilot/schema.py` 无 `GenerationJob/GenerationAsset/GenerationMedia/ComplianceCheck`。
  - 无路由：`pilot/api/main.py` 无 `/api/v1/content-runs`、无 `/compliance-check`、无 ComfyUI 调用。
  - 前端：`pilot/frontend/src/pages/` 无内容页（P1–P7 是驾驶舱/补货/SKU详情/预测体检/AI助手/工坊/权限）。
- **结论**：**未实现**。

#### M05 亚马逊草稿与确认发布

- **需求要点**（`模块需求细化_V1.1.md` M05 节）：预检查、原生草稿（目标账号可回查）、人工确认、Listing/A+/视频分项状态、M05-A01~A07。文档明确“本地预览、库存设零不能替代”。
- **代码现状**：无 `putListingsItem`、无 `VALIDATION_PREVIEW`、无草稿表、无提交表、无路由。`pilot/api/main.py` 全文无 `listing/draft/publish`。
- **结论**：**未实现**。且按两周计划 G06，这项需要真实账号验证，两周内无法保证。

#### M06 销量预测 Agent

- **需求要点**（`模块需求细化_V1.1.md` M06 节 + `SRS V1.0` 第 7 章）：候选/在售双路径、7/14/30 天预测、覆盖采购周期、WAPE/MAE/偏差评估、M06-A01~A07。SRS 要求 `ForecastModelDefinition/DemandProfile/ForecastRun` 表 + `ForecastStrategy` 契约（统计/间歇/树/深度）。
- **代码现状**：
  - 回测有：`pilot/core/models.py` 4 个统计模型（`ma7/es/snaive/croston_sba`，`pilot/core/models.py:100-105` 的 `MODELS`）、`pilot/core/backtest.py:50` rolling 回测、`pilot/core/metrics.py:28` WAPE（口径正确：`sum|y-yhat|/sum(y)`，`sum==0→None`）。
  - 未来预测无：`pilot/api/main.py` 无预测执行接口；`ForecastRuns/ForecastPoints`（`pilot/schema.py:172,190`）存的是**回测** run，不是未来预测。P4 预测体检页（`pilot/frontend/src/pages/P4Forecast.vue`）只读 `per_model` 对比。
  - 模型种类缺：无树模型、无深度模型（`pilot/core.py:71` 的 `f_lightgbm` 在被抢占的旧文件里，FastAPI 侧用不到）。
  - 评估缺：无 WAPE 评估中心、无缺货日期识别（SRS FR-FC-11）、无人工实际值修正。
- **结论**：**半实现**。缺的是“未来预测执行+保存+评估”这一半。

#### M07 补货 Agent

- **需求要点**（`模块需求细化_V1.1.md` M07 节 + `SRS V1.0` 第 8 章）：预测验证、时间推演库存、建议数量（M07-A03 算例 190→192）、MOQ/箱规、预算冲突、人工确认、M07-A01~A07。SRS 状态机 `READY_FOR_REVIEW→APPROVED→EXECUTING→PURCHASE_ORDERED→INSPECTED→SHIPPED`（FR-RP-07）。
- **代码现状**：
  - 算法有：`pilot/core/inventory.py:202` 的 `order_qty()`（两步取整，M07-A03 算例可复现：190→192）、`pilot/core/inventory.py:224` 的 `build_suggestion()`（SS/ROP/target 全链路，σ 从回测残差真算）。
  - 审批流有：`pilot/core/replenish_flow.py:65,73` 状态机 + `pilot/schema.py:279,311` 的 `ReplenishApply/PurchaseOrder` + `POST /api/p3/apply*`、`POST /api/p3/po/*`（`pilot/api/main.py:155-233`）。
  - 口径不一致（见附录 A ②类）：状态名不同（`draft/pending_approve/approved/closed` vs `READY_FOR_REVIEW/.../SHIPPED`）；`order_qty` 不分到货时间直接扣全部在途（M07-A02 要求晚到在途不能掩盖早期缺货）；`moq % pack_size != 0` 直接抛错（`pilot/core/inventory.py:213-214`，真实组合会被拒）；无成本卡、无预测版本绑定、无“含测试数据”标识。
- **结论**：**半实现**。这是全仓最接近文档的模块，但口径必须对齐。

#### M08 智能问数 Agent

- **需求要点**（`模块需求细化_V1.1.md` M08 节 + `SRS V1.0` 第 5 章）：本体、只读工具、歧义澄清、追问继承、M08-A01~A07。SRS 要求 `context/bi_ontology.py`、`BiDAO/BiToolRunner`、`POST /bi/query` 与 `/bi/query/stream`。
- **代码现状**：
  - 路由有：A3 意图路由（`pilot/agents/registry.py:108` `classify_intent` + `pilot/agents/semantic_router.py` 语义兜底）+ 只读工具（`sku_snapshot/list_datasets/run_replenish`，`pilot/agents/tools.py:665,705,446`）。
  - 问数无：无本体文件、无 `/bi/*` 路由、无会话表、无流式 NDJSON。A3 的“问数”是补货指标的只读问答，不是经营问数（无销售额/订单/广告/利润口径）。
- **结论**：**半实现**。路由和只读纪律有，问数本体没有。

#### M09 经营驾驶舱 Agent

- **需求要点**（`模块需求细化_V1.1.md` M09 节 + `SRS V1.0` 第 4 章）：自然语言编排、拖拽、草稿/发布双版本、逐卡问数、M09-A01~A07。SRS 要求 `bi_dashboard_designs` 表 + `/compose /preview /publish /describe`。
- **代码现状**：
  - A2 是骨架：`pilot/agents/registry.py:339` 同上。
  - 看板有但不是驾驶舱设计：P1 今日驾驶舱（`pilot/frontend/src/pages/P1Dashboard.vue`）是固定 KPI（待补货/断货风险/占用资金/今日运行），数据来自 `GET /api/p1/dashboard`（`pilot/api/main.py:110`）。无 `bi_dashboard_designs` 表，无编排/发布接口。
- **结论**：**半实现**。固定看板有，设计器没有。

#### M10 公共管理与任务审核

- **需求要点**（`模块需求细化_V1.1.md` M10 节）：成员权限、参数版本（新参数只影响新任务，M10-A01）、任务中心、并发版本、M10-A01~A07。
- **代码现状**：
  - RBAC 真实现：`pilot/rbac/api.py:170` 中间件 + `pilot/schema.py:425,454,482,506` 四表 + JWT（`pilot/rbac/config.py`）。验收文档已验证 401/403/审计（`pilot/docs/final-local-acceptance.md` T2）。
  - 参数版本无：`pilot/core/__init__.py:87` 的 `InventoryParams` 是代码默认值，无 `config_versions` 表，无任务快照。改参数会静默影响所有新计算，M10-A01 不满足。
  - 任务中心无：无 `jobs/job_steps/review_items` 表，无任务列表页。
- **结论**：**半实现**。权限有，版本和任务没有。

### 2.3 SRS 七 Agent（M1–M7）对照（补充）

SRS 的 M1–M7 与模块细化的 M01–M10 是两套编号（见附录 B D1）。按 SRS 口径：

| SRS 模块 | Pilot 对应 | 结论 |
|---|---|---|
| M1 智能客服（FR-CS-01~27） | A1 草稿（`POST /api/agents/support`，`pilot/api/main.py:259`） | 未实现（无会话/翻译/推荐/工单，只有单条草稿） |
| M2 驾驶舱设计（FR-BI-01~10） | A2 骨架 | 未实现 |
| M3 智能问数（FR-QA-01~11） | A3 路由+只读工具 | 半实现 |
| M4 选品分析（FR-SEL-01~14） | A4 骨架 | 未实现 |
| M5 销量预测（FR-FC-01~12） | A5 回测工具 | 半实现 |
| M6 补货预测（FR-RP-01~11） | A6 真实现 | 半实现（口径不一致） |
| M7 内容创作（FR-GC-01~10） | A7 骨架 | 未实现 |

---

## 3. 分阶段方案

> 原则：两周内只保一条线（M06→M07→M10 权限），其余模块先冻结。工时按单人全职估算，含测试。

### 阶段 0：止血（D1–D2，约 12h）—— 不做这一步，后面都白做

- **目标**：消除“假实现”和“坏入口”，让答辩时每句话都有证据。
- **改动文件清单**：
  1. `pilot/agents/tools.py`（`query_order`/`query_logistics` 改为诚实返回“演示桩，未接订单表”或直接删除工具）
  2. `pilot/app.py`（删除或改名隔离；它调的 `core.py` 接口已被 `core/` 包抢占，`import core` 实际加载 `pilot/core/__init__.py`，`core.aggregate_daily(orders)` 单参调用必报错）
  3. `pilot/rbac/config.py`（`AUTH_ENABLED` 默认保持 0 但在 `pilot/README.md` 写明部署必须开；`CORS_ORIGINS` 默认 `*` 改为启动警告）
  4. `pilot/requirements.txt`（补 `pandas/numpy/pymilvus` 或明确标注 loaders/rag 为本地可选依赖）
- **验收标准**：
  - `cd pilot && python -m pytest tests -q` 全绿（当前 143 passed + 6 subtests）
  - `grep -rn "查询自订单表" pilot/agents/tools.py` 无结果（假注释清除）
  - `python -c "import core; print(core.__file__)"` 输出包路径，且 `pilot/app.py` 不再被误认为可用入口（README 标注“已停用”）
- **预估工时**：6–8h（含回归）

### 阶段 1：补齐 M06 未来预测 + M07 口径对齐（D3–D7，约 24h）

- **目标**：M06 从“只有回测”补到“能跑未来预测并保存”；M07 与 M07-A01~A07 对齐。
- **改动文件清单**：
  1. `pilot/api/main.py`（新增 `POST /api/v1/forecast-runs`，复用 `core.models.MODELS` + `core.backtest`，保存未来 7/14/30 天逐日点）
  2. `pilot/schema.py`（`ForecastRuns` 加 `horizon/mode` 字段区分回测与未来预测；或新增 `future_forecasts` 表——见第 4 节决策）
  3. `pilot/core/inventory.py`（`order_qty` 按到货日期分段扣在途；`moq % pack_size` 改为向上取整到箱规而非抛错）
  4. `pilot/core/replenish_flow.py` + `pilot/schema.py`（状态机加映射层：代码状态 ↔ 文档状态双向转换，落库仍用代码状态）
  5. `pilot/frontend/src/pages/P4Forecast.vue`（加“跑未来预测”按钮 + 曲线展示）
  6. `pilot/tests/test_core.py`、`pilot/tests/test_replenish_flow.py`（补 M06-A05、M07-A02/A03 用例）
- **验收标准**：
  - `POST /api/v1/forecast-runs` 对 S1 场景返回 14 天逐日预测，`ForecastRuns` 落库且 `params_json` 含模型名与训练截止日
  - M07-A03 算例（300+20-80-50=190→192）在测试中断言通过
  - M07-A02 用例（第 4 天缺货、第 8 天在途）不再被在途掩盖
  - 全量测试仍绿
- **预估工时**：20–28h

### 阶段 2：M10 参数版本 + M08/M09 最小版（D8–D11，约 24h）

- **目标**：M10-A01 可验证；问数和驾驶舱有最小可用闭环（只读、不编数）。
- **改动文件清单**：
  1. `pilot/schema.py`（新增 `config_versions` 表：参数名/值/版本/生效时间/操作人）
  2. `pilot/api/service.py`（`build_suggestion` 调用前注入版本快照，`inputs_json` 记录版本）
  3. `pilot/api/main.py`（新增 `GET/POST /api/v1/config-versions`）
  4. `pilot/agents/`（A3 加 `query_metrics` 只读工具，复用 `sku_snapshot` 口径；不做 Vanna）
  5. `pilot/frontend/src/pages/P1Dashboard.vue`（KPI 加数据截止时间与来源标注）
- **验收标准**：
  - M10-A01：任务 A 用 30%、全局改 35%、任务 B 用 35%，A 仍为 30%（测试断言）
  - 问数返回带 `data_as_of` 与来源；无数据返回“无数据”而非 0
- **预估工时**：20–28h

### 阶段 3：M01/M02/M03 真实数据（D12 起，按老师拍板）

- **目标**：至少一条真实链路（1688 搜图核价 **或** 店铺销量同步），不再用模拟冒充。
- **前置**：需要真实账号（1688/Amazon）、货代报价表、店铺授权。**没有账号就不要开工**，先做 G01–G06 接入验证（两周计划第 4 节）。
- **改动文件清单**（待接入验证后定）：`pilot/loaders/` 新增真实 loader、`pilot/schema.py` 新增来源/快照表、`pilot/core/` 新增 FBM/FBA 利润函数。
- **验收标准**：M03-A04/A05 算例 + 一条真实 1688 核价链路（链接、SKU、单件价、时间可回查）。
- **预估工时**：40h+（不含等账号时间）

### 阶段 4：M04/M05 内容与发布（阶段 3 之后）

- **目标**：八类内容 + 原生草稿回查。需要 ComfyUI 环境与真实店铺草稿路径（G05/G06）。
- **验收标准**：M04-A07（无视频文件不记成功）、M05-A01（目标账号可回查草稿）。
- **预估工时**：40h+

---

## 4. 关键技术决策

### 4.1 要改的接口契约

| 决策 | 内容 | 理由 |
|---|---|---|
| 新接口用 `/api/v1/*` 前缀，旧 `/api/p*` 不动 | 未来预测、参数版本、问数走 `/api/v1/`；P1–P7 旧接口保持兼容 | 两周计划第 24 节已建议；避免改坏已验收的 P1–P7 |
| 未来预测接口 `POST /api/v1/forecast-runs` | 入参 `dataset_id/sku/horizon/method`，出参逐日点 + 模型 + 训练截止日 + `inputs_json` 快照 | 对应 M06 输出要求（带日期、依据、版本） |
| 参数版本接口 `GET/POST /api/v1/config-versions` | 每次保存生成新版本，`build_suggestion` 必须记录所用版本 | 对应 M10-A01；不做版本，改参数就是静默改历史 |

### 4.2 要改的字段

| 决策 | 内容 | 理由 |
|---|---|---|
| `ForecastRuns` 加 `mode`（`backtest`/`future`）+ `horizon` | 区分回测与未来预测，同一表复用 | 最小改动；新表会分叉查询 |
| `Suggestions.inputs_json` 加 `config_version` | 补货建议可追溯到参数版本 | M10 要求“每个结果回到所用配置” |
| **不改** `source_type` 取值 | 代码 `TEST_API/OPEN_PUBLIC/PLATFORM_REPORT/SYNTHETIC`（`pilot/schema.py:45`）与文档 `INTERNAL/PAID_EXTERNAL/OPEN_PUBLIC/MOCK` 只在 `OPEN_PUBLIC` 重合，但**不重命名** | 重命名是破坏性变更（全库数据+全测试）；改为在文档里加映射表 |
| **不改** `dataset_id` 为 `org_id` | 本期保留 `dataset_id` 作为租户键；`org_id` 延后到阶段 3 与真实店铺一起引入 | 加 `org_id` 要动 13 张表+全部查询，两周内风险大于收益 |

### 4.3 数据库迁移方式

- 现状 `pilot/db.py:87` 用 `Base.metadata.create_all()`，无迁移工具。**本期不引入 Alembic**（两周内引入迁移框架会拖慢交付）。
- 阶段 1 的 `ForecastRuns` 加字段用 `create_all` + 手工 `ALTER TABLE` 脚本（`pilot/scripts/` 下新增一次性脚本），并在 `pilot/docs/` 记一笔变更。
- 阶段 3 引入 `org_id` 时再正式引入 Alembic（届时表多、变更频繁，必须有迁移）。

### 4.4 兼容策略

- P1–P7 旧接口、旧状态名、旧 `source_type` 全部保留；新口径走映射层（状态转换函数、字段别名），不做破坏性改名。
- 前端旧页不动；新功能加新页或在旧页加区块，不重写 App.vue 路由。

### 4.5 本期不做（明确边界）

1. 不做 M01 采集、M02 店铺同步、M03 选品、M04 内容、M05 发布（阶段 3/4 再说）。
2. 不做 Vanna、ComfyUI、Celery、MinIO、Milvus 生产化（保持现状：Milvus 可选、其余不接）。
3. 不做 LangChain/LangGraph 迁移（两周计划的方案 B 与代码的 OpenAI Agents SDK 不兼容，迁移成本太高；见附录 B D10）。
4. 不做 `org_id` 多租户（见 4.2）。
5. 不做真实 1688/Amazon 接入（无账号前不写代码）。

---

## 5. 风险与待确认（需要你或老师拍板，不要自己假设）

| # | 问题 | 为什么必须拍板 | 影响 |
|---|---|---|---|
| Q1 | 两周交付按 M01–M10 验收，还是按 Pilot 的 P1–P7 验收？ | 两套编号互不兼容（附录 B D1），验收标准完全不同 | 决定阶段 1–4 全部取舍 |
| Q2 | 1688 和 Amazon 店铺账号什么时候能给？ | M01/M02/M03/M05 都卡在账号上（两周计划 G01–G06） | 决定阶段 3 能否启动 |
| Q3 | 货代报价表（FBM 头尾程、FBA 海运）谁提供？ | M03 利润算例（M03-A04/A05）需要真实费率，合成假设不能当真 | 决定 M03 能否验收 |
| Q4 | `moq % pack_size != 0` 时是抛错还是向上取整？ | 代码现在抛错（`pilot/core/inventory.py:213`），真实组合多为不整除 | 决定 M07 是否可用 |
| Q5 | 补货状态机以代码为准还是以 SRS 为准？ | 代码 `draft→closed` vs SRS `READY_FOR_REVIEW→SHIPPED`，两套名字 | 决定第 4 节映射层怎么做 |
| Q6 | `AUTH_ENABLED` 默认关、CORS 默认 `*`，答辩演示用哪种模式？ | 默认关=裸奔，开=要配 JWT secret | 决定部署方式 |
| Q7 | 预测最少历史 60 天（代码现状）是否作为正式门槛？ | SRS Q-07 未定，代码 `pilot/core/backtest.py:55` 写死 60 | 决定 M06 验收口径 |
| Q8 | A2/A4/A7 骨架在答辩时怎么讲？ | 注册表里有、工具是空的（`pilot/agents/registry.py:329`） | 决定演示口径（诚实说骨架 vs 隐藏） |
| Q9 | `pilot/app.py` Streamlit 台留还是删？ | 已坏（`import core` 被包抢占），留着误导新人 | 决定仓库卫生 |
| Q10 | 两周计划的 LangChain/LangGraph 方案还作数吗？ | 代码用的是 OpenAI Agents SDK，两者不兼容 | 决定是否要迁移（建议：不迁） |

---

## 6. 明天就能开工的 5 个任务

### 任务 1：清除 A1 假数据（`pilot/agents/tools.py`）

- **改哪个文件**：`pilot/agents/tools.py:172-186`（`query_order`、`query_logistics`）
- **怎么做**：把写死的“已付款，待发货”“预计 2 日送达”改成诚实返回（例如“演示桩：未接订单表，无法查询真实订单”），或直接从 `A1_TOOLS` 移除这两个工具，只保留 `search_knowledge` + `draft_reply`。
- **验收标准**：`grep -rn "待发货\|预计 2 日送达" pilot/agents/tools.py` 无结果；`cd pilot && python -m pytest tests/test_agents.py -q` 全绿。
- **明确不做**：不接真实订单表（没有表可接）；不改 A1 指令文案。

### 任务 2：隔离坏掉的 Streamlit 入口（`pilot/app.py`）

- **改哪个文件**：`pilot/app.py`（文件头加“已停用”声明，或改名 `pilot/app_legacy.py`）；`pilot/README.md`（标注 Streamlit 台已停用，正式入口只有 `api.main`）
- **怎么做**：`import core` 实际加载 `pilot/core/__init__.py`（已验证），而 `app.py:59,138,155` 调的是旧 `core.py` 的 `aggregate_daily/replenish_suggest/inventory_curve`，必报错。最小修法是停用声明，不试图修旧台。
- **验收标准**：`python -c "import core; print(core.__file__)"` 输出包路径；README 有停用标注；全量测试仍绿。
- **明确不做**：不修 Streamlit 台；不删 `pilot/core.py`（先留着，避免误伤引用）。

### 任务 3：补 `requirements.txt` 缺失依赖（`pilot/requirements.txt`）

- **改哪个文件**：`pilot/requirements.txt`
- **怎么做**：`pilot/loaders/public_uci.py:21`、`pilot/shopify_client.py:16`、`pilot/core.py:14` 用 `pandas/numpy`，`pilot/rag/milvus_store.py:78` 用 `pymilvus`，但 `requirements.txt` 只有 6 个包。补上 `pandas/numpy/pymilvus`（钉版本），或在文件里标注“loaders/rag 为本地可选，不在 CI 安装”。
- **验收标准**：干净环境 `pip install -r requirements.txt` 后，`python -c "import api.main"` 成功；`pytest tests -q` 全绿。
- **明确不做**：不加 LangChain/LangGraph/Celery/Vanna（代码没用）。

### 任务 4：M07-A03 算例进测试（`pilot/tests/test_core.py`）

- **改哪个文件**：`pilot/tests/test_core.py`（新增用例）
- **怎么做**：把模块细化 M07-A03 的算例写成断言：需求 300 + 安全库存 20 − 到货前可用 80 − 期内在途 50 = 190，MOQ 100、箱规 24 → 建议 192。调用 `pilot/core/inventory.py:202` 的 `order_qty()` 验证。
- **验收标准**：新用例通过；`python -m pytest tests/test_core.py -q` 全绿。
- **明确不做**：不改 `order_qty` 算法（只加测试）；不碰状态机。

### 任务 5：未来预测接口最小版（`pilot/api/main.py` + `pilot/api/service.py`）

- **改哪个文件**：`pilot/api/main.py`（加路由）、`pilot/api/service.py`（加函数）、`pilot/schema.py`（`ForecastRuns` 加 `mode/horizon`）
- **怎么做**：`POST /api/v1/forecast-runs`，入参 `dataset_id/sku/horizon/method`，内部复用 `core.models.MODELS` + `core.backtest` 的训练窗口，返回逐日预测并落库。`mode='future'` 与回测区分。
- **验收标准**：对 S1 场景调接口返回 14 天逐日点；`ForecastRuns` 有一行 `mode=future`；`pytest tests/test_api.py -q` 全绿。
- **明确不做**：不做 WAPE 评估中心；不做缺货日期识别；不做前端按钮（先接口）。

---

## 附录 A：四类问题分析（根因 + 影响）

### ① 需求有、代码完全没有

| 问题 | 根因 | 影响 |
|---|---|---|
| M01 采集、M02 同步、M03 选品、M04 内容、M05 发布五大模块全空 | 文档是按“完整平台”写的，代码是按“补货 Pilot”做的，两者从未对齐过范围 | **阻断答辩**：按 M01–M10 验收，5/10 直接零分 |
| V1.1 的客服会话/工单、驾驶舱设计、问数本体、内容生成四套实体全空 | V1.1 描述的是另一个代码库（`backend/app/...`），Pilot 里没有这些表 | **阻断答辩**：SRS FR-CS/BI/QA/GC 全部无法验收 |
| ComfyUI、Vanna、Celery、MinIO 全未接入 | `requirements.txt` 无对应包，`pilot/` 无调用代码 | 影响评分：图上标“已实现”，代码里没有 |

### ② 代码有、但与文档口径不一致

| 问题 | 证据 | 根因 | 影响 |
|---|---|---|---|
| 数据性质四值对不上 | 代码 `TEST_API/OPEN_PUBLIC/PLATFORM_REPORT/SYNTHETIC`（`pilot/schema.py:45`）vs 文档 `INTERNAL/PAID_EXTERNAL/OPEN_PUBLIC/MOCK`（V1.1 第 4.1 节） | 代码按“数据来源”命名，文档按“数据可信度”命名，从未统一 | 影响评分：答辩被问“数据性质”时两边对不上 |
| 租户键对不上 | 代码 `dataset_id`（`pilot/schema.py:77`）vs 文档 `org_id`（SRS FR-COM-01） | Pilot 按“数据集”隔离，文档按“组织”隔离 | 影响评分：多租户验收（M08-A06/M09-A07）必挂 |
| 补货状态机对不上 | 代码 `draft→closed`（`pilot/core/replenish_flow.py:65`）vs SRS `READY_FOR_REVIEW→SHIPPED`（FR-RP-07） | 代码先做了演示状态机，文档后写了业务状态机 | 影响评分：M07 状态流转验收对不上 |
| 补货公式细节对不上 | 代码不分到货时间扣在途（`pilot/core/inventory.py:202`）vs M07-A02 要求时间分段 | 代码用了库存理论公式（SS/ROP/target），文档用了覆盖期公式 | 影响评分：M07-A02 必挂 |
| 预测模型种类对不上 | 代码 4 个统计模型（`pilot/core/models.py:100`）vs SRS 统计/间歇/树/深度 | 代码只做了统计基线，文档写了完整模型谱 | 只是优化：基线够用，树/深度可后补 |
| 前端技术栈对不上 | 代码 Vue3 JS 无 TS/Router/Axios（`pilot/frontend/package.json`）vs V1.1 图 `img_003` 称 Vue3+TypeScript+Vue Router+Axios+Playwright | 文档按目标栈写，代码按实际栈写 | 影响评分：技术栈答辩对不上 |

### ③ 文档之间互相矛盾（按 V1.1 裁决）

| # | 矛盾 | 裁决（以 V1.1 为准） |
|---|---|---|
| D1 | 模块编号：SRS M1–M7（含客服）vs 细化 M01–M10（不含客服）vs Pilot A1–A7（另一套） | **以细化 M01–M10 为验收编号**（`README.md` 第六节），SRS 的 M1–M7 只作追溯；Pilot 的 A1–A7 是代码内部名，不进验收 |
| D2 | 技术栈：V1.1（FastAPI+PG+Milvus+Vanna+ComfyUI）vs 两周（LangChain+SQLite+Scrapy）vs 代码（OpenAI Agents+PG） | **以 V1.1 为准**，但代码现状按“V1.1 的子集”记（无 Vanna/ComfyUI/Celery）；两周计划的 LangGraph 方案**不执行**（见 D10） |
| D3 | 代码目录：V1.1 `backend/app/...` vs 代码 `pilot/api/...` vs 两周 `sellerdata/...` | **以代码 `pilot/` 为准**，V1.1 的目录描述视为过期（文档未同步代码重构） |
| D4 | 数据性质：见 ②类第一行 | **以 V1.1 四值（INTERNAL/PAID_EXTERNAL/OPEN_PUBLIC/MOCK）为文档口径**，代码值加映射表，不改代码 |
| D5 | 租户：文档 `org_id` vs 代码 `dataset_id` | **以 V1.1 `org_id` 为目标口径**，代码本期保留 `dataset_id`，阶段 3 迁移 |
| D6 | 补货状态机：SRS vs 代码 | **以 SRS 状态机为业务口径**，代码状态加映射层（见第 4 节） |
| D7 | 客服范围：细化明确排除客服（“第一版继续排除智能客服”）vs V1.1/SRS 把客服列为第 1 个 Agent | **以细化为准：客服不在 M01–M10 验收范围**；Pilot 的 A1 草稿只算演示，不进 M01–M10 验收 |
| D8 | 数据库：两周 SQLite vs V1.1 PostgreSQL vs 代码默认 PG | **以 V1.1 PostgreSQL 为准**，代码已对齐（`pilot/db.py:38`），SQLite 只作回退 |
| D9 | Agent 框架：两周 LangChain/LangGraph vs 代码 OpenAI Agents SDK | **以代码为准（OpenAI Agents）**；两周计划的方案 B 视为未采纳的历史方案，不迁移 |
| D10 | 图片版本：`img_006` 标“智能客服 Agent v1.2” vs 文档 V1.0/V1.1 | 以文档版本为准，图片版本号视为笔误，不影响验收 |

### ④ 代码自身的设计问题

| # | 问题 | 证据 | 根因 | 影响 |
|---|---|---|---|---|
| C1 | `pilot/core.py` 被 `pilot/core/` 包抢占，`app.py` 已坏 | `python -c "import core"` 输出 `pilot/core/__init__.py`；`pilot/app.py:59` 调旧接口 | 新包与旧文件同名共存，Python 优先包 | 只是优化（Streamlit 台本就是调试台），但留着误导新人 |
| C2 | `query_order/query_logistics` 假数据冒充查库 | `pilot/agents/tools.py:172-186` 写死字符串，注释称“查询自订单表” | 演示期图省事，后来没改 | **阻断答辩**：被问数据来源时穿帮 |
| C3 | `service.py` 在壳层重算 `days_left` | `pilot/api/service.py:246` `on_hand / mu_daily` | 展示逻辑图省事放了 service | 只是优化：数值小、口径单一，但违反铁律字面 |
| C4 | `requirements.txt` 缺 pandas/numpy/pymilvus | `pilot/loaders/public_uci.py:21` 等有 import，`pilot/requirements.txt` 无 | requirements 只覆盖 FastAPI 主链 | 影响评分：干净环境装不上 loaders/rag |
| C5 | `AUTH_ENABLED` 默认关 + CORS `*` | `pilot/rbac/config.py:16,42` | 演示优先，生产配置后补 | **阻断上线**：默认部署=无鉴权+全跨域 |
| C6 | `order_qty` 要求 `moq % pack_size == 0` | `pilot/core/inventory.py:213-214` | 库存理论假设，真实组合多不整除 | 影响评分：真实 SKU 会被拒 |
| C7 | `order_qty` 不分到货时间扣在途 | `pilot/core/inventory.py:202-221` | 同上 | 影响评分：M07-A02 必挂 |
| C8 | 未登记路由只要求登录（fail-open） | `pilot/rbac/api.py:160` `return None` | 中间件图省事，新路由默认放行 | 影响评分：新增接口容易漏权限 |
| C9 | 无迁移，只有 `create_all` | `pilot/db.py:87` | 演示期够用 | 只是优化：改表靠手工，阶段 3 必须补 |
| C10 | A2/A4/A7 骨架注册为正式 Agent | `pilot/agents/registry.py:339-344` | 占位图省事 | 影响评分：答辩时“七个 Agent”说法会被追问 |

---

## 附录 B：证据索引（抽查过的关键文件）

| 文件 | 看了什么 | 关键行 |
|---|---|---|
| `pilot/schema.py` | 19 表（13 业务 + 4 RBAC + 2 关联）、无 `org_id` | `pilot/schema.py:45,77,172,279,353,425` |
| `pilot/api/main.py` | 18 端点（P1–P7 + support + ws），无 `/api/v1/*` | `pilot/api/main.py:64,81-272` |
| `pilot/api/service.py` | 取数+调 core，`days_left` 壳层计算 | `pilot/api/service.py:246` |
| `pilot/core/__init__.py` | `SourceType` 四值、铁律声明 | `pilot/core/__init__.py:22` |
| `pilot/core/metrics.py` | WAPE/bias/MAE 口径正确 | `pilot/core/metrics.py:28,45,62` |
| `pilot/core/models.py` | 4 统计模型，无树/深度 | `pilot/core/models.py:100-105` |
| `pilot/core/inventory.py` | `order_qty` 两步取整 + MOQ 整除约束 | `pilot/core/inventory.py:202-221` |
| `pilot/core/replenish_flow.py` | 状态机 `draft→closed` | `pilot/core/replenish_flow.py:65,73` |
| `pilot/agents/registry.py` | A1/A3/A5/A6 真实现，A2/A4/A7 骨架 | `pilot/agents/registry.py:270-344` |
| `pilot/agents/tools.py` | `query_order` 写死字符串 | `pilot/agents/tools.py:172-186` |
| `pilot/rbac/api.py` | 中间件真鉴权，未登记路由 fail-open | `pilot/rbac/api.py:117-160,170` |
| `pilot/rbac/config.py` | `AUTH_ENABLED` 默认 0、CORS 默认 `*` | `pilot/rbac/config.py:16,42` |
| `pilot/app.py` | Streamlit 旧台，调旧 `core.py` 接口 | `pilot/app.py:16,59,138` |
| `pilot/frontend/package.json` | Vue3 JS，无 TS/Router/Axios | `pilot/frontend/package.json:1-18` |
| `pilot/tests/` | 143 个测试函数，五闸 5/5 | `pilot/docs/gates-latest.json` |

---

*报告完。本轮未改任何业务代码，仅新增本文件。*
