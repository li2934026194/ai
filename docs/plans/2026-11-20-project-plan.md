# 项目计划（2026-11-20）

> 权威文档只有三份：A `CrossPilot-需求分析.md`、B `AI跨境电商平台V1.0-软件需求规格说明书.md`、C `AI跨境电商平台V1.1-架构与需求.md`。
> 裁决：C 架构 > B FR/验收 > A 背景。M01–M10 只作验收细则挂在 FR 下。
> **图片声明**：具备读图能力。已查看 `img_001`（分层总体架构）、`img_002`（代码分层）、`img_074`（补货数据流向）、`img_079`（补货时序图）；上一轮另看过 `img_003/006/098`。其余图片未逐张看，相关结论仅基于文字。
> 本轮只提交 `docs/plans/` 下 md，不改业务代码。

## 0. 判断与验证（先判断，再验证）

### 5 条判断（验证前写下）

| # | 判断 | 验证结论 | 证据 |
|---|---|---|---|
| J1 | 选品 Agent 只有壳没有算法 | **成立** | A4 空工具骨架 `pilot/agents/registry.py:341`；无 FBM/FBA 利润函数（`pilot/core/` 无费用计算）；只有模拟报价 `pilot/schema.py:353` |
| J2 | 数据层比业务层成熟 | **成立** | 数据层 19 表+5 loader+143 测试（`pilot/schema.py:61`，`pilot/tests/` 21 文件）；业务层 3/7 Agent 是骨架（`pilot/agents/registry.py:339-344`） |
| J3 | 预测/补货是唯一真实闭环 | **成立** | 回测+建议+审批全链路：`pilot/core/backtest.py:50`、`pilot/core/inventory.py:224`、`pilot/core/replenish_flow.py:65`，UAT 全链路通过（`pilot/docs/final-local-acceptance.md` T4） |
| J4 | 客服/内容/驾驶舱/问数是演示桩 | **成立** | A1 订单查询写死字符串 `pilot/agents/tools.py:172-186`；A2/A7 骨架 `pilot/agents/registry.py:339,344`；P1 固定 KPI `pilot/api/main.py:110` |
| J5 | RBAC 是最成熟的公共能力 | **成立** | 中间件真鉴权 `pilot/rbac/api.py:170`，JWT+审计，验收验证 401/403（`pilot/docs/final-local-acceptance.md` T2） |

### 3 个假设（验证前写下）

| # | 假设 | 验证结论 | 证据 |
|---|---|---|---|
| A1 | `core/` 未被 Web/ORM 污染 | **部分成立** | 无 fastapi/sqlalchemy/pydantic import；但 `pilot/core/demand.py:62` 函数内局部 `import pandas`，属灰色（pandas 非 Web/ORM，但与“纯计算”口径有张力） |
| A2 | `api/` 不重算数值 | **不成立** | `pilot/api/service.py:246` `days_left = on_hand / mu_daily` 在壳层计算，违反铁律字面 |
| A3 | Agent 都走 registry | **成立** | 统一 `build_agents()` `pilot/agents/registry.py:270`，`support_draft` 经 `run_agent("A1_support")` `pilot/api/service.py:1190` |

## 1. 一页结论

1. **现在不能按 A/B/C 答辩**：B 的 103 条 FR 里，已实现 1 条（WAPE 口径）、半实现约 20 条、其余 80 条未实现；A 的 32 条里已实现 0 条。答辩问到客服会话、驾驶舱设计、问数本体、选品利润、内容生成，全部无代码可答。
2. **能答辩的只有“预测→补货→审批”**：回测、建议量、审批履约、RBAC 四块是真的（143 测试、五闸 5/5）。这是 Pilot 的全部家当，也是两周内唯一能保住的线。
3. **最差的不是缺功能，是假实现和口径不一致**：`query_order` 假数据、`app.py` 已坏、`AUTH_ENABLED` 默认关；`dataset_id` vs `org_id`、状态机两套名字、数据性质四值对不上——这些不修，答辩会被追问穿帮。
4. **文档本身有 10 处矛盾**（基线表 X1–X10），已按 C>B>A 裁决；但代码与三份文档的目录、栈、字段仍对不上（前端 JS 非 TS、无 `/api/v1`、无 `org_id`），新开发前必须先定口径。

## 2. 需求基线表

全量基线表见 `docs/plans/SPEC-BASELINE.md`（B 103 FR + 24 BR + 12 NFR、A 32 FR、C-only 13 条，逐条带来源/优先级/验收/代码状态）。

| 分组 | 总数 | 已实现 | 半实现 | 未实现 | 口径不一致 |
|---|---|---|---|---|---|
| B·FR-COM（公共） | 8 | 1 | 5 | 0 | 2 |
| B·FR-CS（客服） | 27 | 0 | 0 | 27 | 0 |
| B·FR-BI（驾驶舱） | 10 | 0 | 0 | 10 | 0 |
| B·FR-QA（问数） | 11 | 0 | 0 | 11 | 0 |
| B·FR-SEL（选品） | 14 | 0 | 0 | 14 | 1 |
| B·FR-FC（预测） | 12 | 0 | 7 | 3 | 1 |
| B·FR-RP（补货） | 11 | 0 | 6 | 2 | 3 |
| B·FR-GC（内容） | 10 | 0 | 0 | 10 | 0 |
| B·BR（规则） | 24 | 1 | 8 | 12 | 3 |
| A·FR（CrossPilot） | 32 | 0 | 3 | 29 | 0 |

## 3. 差距汇总（按 P0/P1/P2）

### P0（缺失即不可验收）

| FR | 缺口 | 证据 |
|---|---|---|
| B·FR-COM-01/02 | 无 `org_id`、无 `/api/v1`+orgApi | `pilot/schema.py:77` 用 `dataset_id`；`pilot/frontend/src/api.js:78` 调 `/api/p1` |
| B·FR-CS-06~27 | 客服会话/推荐/翻译/工单全空 | 无表无路由（`pilot/api/main.py` 无 `/inbound`）；A1 只有草稿 `pilot/api/main.py:259` |
| B·FR-BI-01~10 | 驾驶舱设计全空 | 无 `bi_dashboard_designs`；A2 骨架 `pilot/agents/registry.py:339` |
| B·FR-QA-01~11 | 问数本体全空 | 无 `bi_ontology.py`、无 `/bi/*`；A3 只问补货指标 `pilot/agents/registry.py:300` |
| B·FR-SEL-01~14 | 选品全空 | A4 骨架 `pilot/agents/registry.py:341`；无利润引擎 |
| B·FR-FC-07 | 未来预测无接口无落库 | `pilot/api/main.py` 无预测执行接口；`ForecastRuns` 只存回测 `pilot/schema.py:172` |
| B·FR-RP-05/07 | 状态机/签名与文档不一致 | 代码 `pending_approve` `pilot/core/replenish_flow.py:65` vs 文档 `READY_FOR_REVIEW` |
| B·FR-GC-01~10 | 内容生成全空 | A7 骨架 `pilot/agents/registry.py:344`；无 ComfyUI |
| A·FR-01~04,09,10,12,13,16,18,20,21,23~26,29,30 | 平台接入/看板/标题/主图/规则矩阵/审核/意图/预测/RBAC 三级/映射/ComfyUI 全空 | 无 SP-API/Shopee/TikTok 代码；无工作流表 |

### P1（重要可分期）

| FR | 缺口 | 证据 |
|---|---|---|
| B·FR-CS-01~05,16 | 邮件中继/三平台适配/统一消息模型 | 无 IMAP/SES/Adapter 代码 |
| B·FR-BI-04 | `/describe` AI 描述 | 无此接口 |
| B·FR-QA-03 | Vanna 增补解释 | 无 Vanna（`pilot/requirements.txt` 无） |
| B·FR-SEL-12/14 | LLM 解释+选品页 | A4 骨架 |
| B·FR-FC-10/11 | 评估中心+缺货日期识别 | 无评估中心；断货只置 None `pilot/core/demand.py:104` |
| B·FR-GC-10 | 三前端模式 | 无此页 |
| A·FR-05~08,11,14,17,19,22,27,28,31,32 | 异常归因/简报/趋势/评分/视频/资质/工单/回填/库存同步/批量/模板/GPU/降级 | 均无代码 |

### P2（增强拓展）

| FR | 缺口 | 证据 |
|---|---|---|
| B·FR-CS-03 | 东南亚三平台消息 API | 无 |
| B·FR-QA-10 | 训练 SQL 租户隔离 | 无 |
| A·FR-15 | TikTok 保证金监测 | 无 |

## 4. 落地方案

### 阶段 0：止血（D1–D2，6–8h）

- **目标**：消除假实现和坏入口。
- **改动文件**：`pilot/agents/tools.py`（`query_order/query_logistics` 改诚实或下掉）、`pilot/app.py`（停用声明）、`pilot/README.md`（标注）、`pilot/requirements.txt`（补 pandas/numpy/pymilvus 或标注可选）。
- **验收**：`cd pilot && python -m pytest tests -q` 全绿；`grep -rn "待发货" pilot/agents/tools.py` 无结果。
- **工时**：6–8h。

### 阶段 1：M06 未来预测 + M07 口径对齐（D3–D7，20–28h）

- **目标**：B·FR-FC-07、A·FR-18 从半实现补到已实现；B·FR-RP-05/07 口径对齐。
- **改动文件**：`pilot/api/main.py`（`POST /api/v1/forecast-runs`）、`pilot/api/service.py`（预测执行）、`pilot/schema.py`（`ForecastRuns.mode/horizon`）、`pilot/core/inventory.py`（在途分段+MOQ 取整）、`pilot/core/replenish_flow.py`（状态映射层）、`pilot/frontend/src/pages/P4Forecast.vue`、`pilot/tests/test_core.py`。
- **验收**：S1 场景调接口返回 14 天逐日点并落库；M07-A03 算例（190→192）测试通过；全量测试绿。
- **工时**：20–28h。

### 阶段 2：M10 参数版本 + 问数/驾驶舱最小版（D8–D11，20–28h）

- **目标**：B·FR-COM-05、NFR-08 补版本；B·FR-QA/BI 最小只读闭环。
- **改动文件**：`pilot/schema.py`（`config_versions`）、`pilot/api/main.py`（`GET/POST /api/v1/config-versions`）、`pilot/api/service.py`（注入版本快照）、`pilot/agents/tools.py`（`query_metrics` 只读工具）、`pilot/frontend/src/pages/P1Dashboard.vue`（截止时间+来源）。
- **验收**：M10-A01 版本隔离测试通过；问数返回带 `data_as_of`。
- **工时**：20–28h。

### 阶段 3：真实数据（D12 起，40h+，需账号）

- **目标**：A·FR-01 或 A·FR-08 至少一条真实链路。
- **前置**：真实账号+货代报价（见第 6 节 Q2/Q3）。
- **改动文件**：`pilot/loaders/` 新增真实 loader、`pilot/schema.py` 新增来源快照表、`pilot/core/` 新增 FBM/FBA 利润。
- **验收**：M03-A04/A05 算例+一条真实核价链路。
- **工时**：40h+（不含等账号）。

### 阶段 4：内容与发布（阶段 3 后，40h+）

- **目标**：B·FR-GC、A·FR-09/10/30。
- **验收**：M04-A07、M05-A01（目标账号回查草稿）。
- **工时**：40h+。

## 5. 架构一致性检查

| 硬约束 | 结论 | 证据 |
|---|---|---|
| `core/` 不得被 Web/ORM 污染 | **基本通过，1 处灰色** | 无 fastapi/sqlalchemy/pydantic import；但 `pilot/core/demand.py:62` 函数内 `import pandas`（pandas 非 Web/ORM，但与“纯计算”口径有张力，建议移至 loaders） |
| `api/` 不得重算数值 | **不通过** | `pilot/api/service.py:246` `days_left = on_hand / mu_daily` 在壳层计算；另有大量 `round()`（`pilot/api/service.py:304-319`）。数值虽小，但违反铁律字面，应下沉 `core` |
| Agent 必须走 registry | **通过** | 统一 `build_agents()` `pilot/agents/registry.py:270`；`support_draft` 经 `run_agent` `pilot/api/service.py:1190`；WS 经 `_load_registry` `pilot/api/ws.py:51`。注：A2/A4/A7 虽走 registry，但为空骨架（`pilot/agents/registry.py:329`），“走了”不等于“实现了” |

## 6. 待确认的问题（不确认就没法写代码，按排序）

| # | 问题 | 为什么卡住 |
|---|---|---|
| Q1 | 两周按 B 的 FR 验收，还是按 Pilot 的 P1–P7 验收？ | 决定阶段 1–4 全部取舍；B 有 103 条 FR，Pilot 只有 18 端点 |
| Q2 | 1688/Amazon 账号何时给？ | A·FR-01/08、B·FR-SEL 全部卡在账号上 |
| Q3 | 货代报价表谁提供？ | B·BR-SEL-02/03 利润口径需要真实费率 |
| Q4 | `moq % pack_size` 抛错还是取整？ | 代码抛错 `pilot/core/inventory.py:213`，真实组合多不整除，M07 不可用 |
| Q5 | 补货状态机以 B 为准加映射，还是改代码状态名？ | B·FR-RP-07 vs 代码 `pilot/core/replenish_flow.py:65`，决定迁移方式 |
| Q6 | `AUTH_ENABLED` 默认关，答辩用开还是关？ | 默认关=无鉴权（`pilot/rbac/config.py:16`），开=需 JWT secret |
| Q7 | 预测最少历史 60 天是否作正式门槛？ | 代码写死 `pilot/core/backtest.py:55`，B Q-07 未定 |
| Q8 | A2/A4/A7 骨架答辩时怎么讲？ | 注册表里有、工具是空的（`pilot/agents/registry.py:329`），决定演示口径 |

---

*计划完。本轮未改业务代码，仅新增 `docs/plans/SPEC-BASELINE.md` 与本文件。*
