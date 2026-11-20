# CrossPilot V1.0 SRS 对齐版 — 逐区逐字逐数溯源高保真 UI 原型（`ui_v6`）

> **生成依据**：严格对齐《AI跨境电商平台V1.0_软件需求规格说明书》（SRS）、[V6 精简业务与数据通俗说明（1→2→3 步骤）](../../plans/业务与数据通俗说明_123步骤.md) 与 [V6 数据流程图](../dfd_v6/)。
> **设计原则**：
> 1. **精简 6 角色 RBAC**（`admin / planner / cs / approver / warehouse / viewer`），全面替换演示头 `X-Actor-Role`（对应 `R-01 / Q-01`）。
> 2. **保留完整店铺与主数据闭环**（支持 Amazon/Shopee/TikTok 绑定、订单商品主数据去重、独立库存同步、选品/创作/客服/预测/补货/问数/驾驶舱全链路）。
> 3. **每张原型图右侧自带“逐区逐数溯源注释” + 底部“逐字逐数总账”**，把页面上**每一个功能区、每一段规则文字、每一个阈值数字、每一条示例数据**的来龙去脉全部标清（明确区分 **SRS 硬性规则/阈值数字** 与 **§0.3 教学演示样例数据**）。

---

## 一、8 张带逐区溯源注释的 UI 原型总览

| 序号 | 原型文件 | 模块名称 | 对应通俗小功能（1→2→3） | 核心 SRS 需求出处 |
|---:|---|---|---|---|
| 0 | [`u00_base.png`](u00_base.png) | **M0 公共底座**：店铺接入、订单商品主数据、独立库存同步与 6 角色 RBAC | 0.1 角色鉴权 / 0.2 店铺主数据 / 0.3 独立库存同步 | `FR-COM-01~08`、`SRS §1.5/§1.6/§5.8`、`R-01/Q-01` |
| 1 | [`u01_cs.png`](u01_cs.png) | **M1 智能客服 Agent**：推荐商品库、双语翻译与发信拦截、订单关联与售后工单 | 1.1 商品库 / 1.2 双语翻译与拦截 / 1.3 订单关联与工单 | `FR-CS-01~27`、`BR-CS-01~06`、`SRS §3.2`、`R-02` |
| 2 | [`u02_bi.png`](u02_bi.png) | **M2 驾驶舱设计 Agent**：自然语言编排、草稿/发布双版本、4 卡并发与文字解读 | 2.1 草稿编排与AI解读 / 2.2 发布大屏4卡并发 | `FR-BI-01~10`、`BR-BI-01~02`、`SRS §4.2` |
| 3 | [`u03_qa.png`](u03_qa.png) | **M3 智能问数 Agent（拓展）**：三条只读查询路、写操作硬拒、流式证据与记忆清理 | 3.1 指标口径与词典 / 3.2 三路查询与硬拒拦截 | `FR-QA-01~11`、`BR-QA-01~02`、`SRS §5.1~5.2` |
| 4 | [`u04_selection.png`](u04_selection.png) | **M4 选品分析 Agent**：4 种数据性质隔离、异步导入、规则初筛与测款决策 | 4.1 四源导入 / 4.2 盈利汇总与初筛 / 4.3 测款决策 | `FR-SEL-01~14`、`BR-SEL-01~04`、`SRS §6.2~6.3` |
| 5 | [`u05_forecast.png`](u05_forecast.png) | **M5 销量预测 Agent**：需求画像锁版本、7/14/30 天预测、WAPE 评估中心 | 5.1 画像与模型筛选 / 5.2 日销预测 / 5.3 WAPE 评估 | `FR-FC-01~12`、`BR-FC-01~04`、`SRS §7.2~7.3` |
| 6 | [`u06_replenish.png`](u06_replenish.png) | **M6 补货预测 Agent（拓展）**：普通/智能双入口、签名重算、SoD 审批与履约凭证 | 6.1 双入口预览 / 6.2 签名重算与审批 / 6.3 履约凭证 | `FR-RP-01~11`、`AC-RP-01~05`、`SRS §8.1~8.2` |
| 7 | [`u07_content.png`](u07_content.png) | **M7 商品内容创作 Agent**：同入口三模式、5 组文案+合规、ComfyUI 主图与短视频 | 7.1 同入口防重 / 7.2 文案5草稿与合规 / 7.3 ComfyUI 媒体 | `FR-GC-01~10`、`AC-GC-01~04`、`SRS §9.1~9.2` |

---

## 二、全页面规则数字 vs 示例数据总对照（防混淆红线）

> 根据 **SRS §0.3（非声称边界）**，原型界面上所有具体的店铺名、SKU 编号、金额、销量数值均为**闭环演示样例（MOCK/教学数据）**，不代表真实运营业绩；而所有校验阈值、并发上限、状态枚举和公式规则均**逐字逐数来自 SRS**。

### 1. M0 公共底座 (`u00_base.png`)
- **规则与阈值出处**：
  - `6 角色（admin / planner / cs / approver / warehouse / viewer）`：由 SRS §1.5（9 个业务岗）与代码 `pilot/rbac/service.py`（6 个权限角色）对齐收敛，并替换 `X-Actor-Role` 演示头（`R-01 / Q-01`）。
  - `org_01` 租户隔离 & `X-Api-Envelope: 1`：来自 `FR-COM-01/02`（`TenantMixin` + 统一包络）。
  - `去重键 (order_id, platform, org_id)`、`未知字段保持 NULL`、`CostCard`：来自 SRS §5.8 / §4.1。
  - `SYNCED` 状态锁 & 唯一 `InventoryPosition` 写入入口：来自 SRS §1.6、`FR-RP-10`、`AC-RP-04`（M1 退货和 M6 采购收货凭证绝不直接改写此库存数字）。
- **页面示例数据来源**：`Amazon US / Shopee TH / TikTok UK`、订单 `#AMZ-90218 ($128.00 × 4)`、`#SHP-4410 (฿650 × 3)`、`LAMP-001`（可用 45 / 安全 20 / 在途 100）均为前端闭环演示样例。

### 2. M1 智能客服 Agent (`u01_cs.png`)
- **规则与阈值出处**：
  - `20 件/批写入 Milvus`、`原文截断 ≤1000 字符`、`最多返回 3 件推荐商品`：来自 `FR-CS-08/09/10`。
  - `两条商品路径分离（Milvus 推荐表 vs V2 CustomerListing）`：来自 SRS §3.2.2。
  - `WS 实时推送 + 3 秒 HTTP 轮询兜底`、`MOCK-AMAZON-*`、`DELIVERED_MOCK`、`Amazon SP-API 只写不读`：来自 `FR-CS-11~22`、`C-01`。
  - `候选订单仅 AFTER_SALES_COMPLAINT 可查`、`理由 5~1000 字符`、`附件 ≤10 件，每件 ≤5MB (PDF/JPG/PNG/DOCX/TXT)`、`external_status: UNKNOWN`、`补校验会话=HUMAN`、`行锁 + version+1 + 主管(≠提交人)审批`：来自 `FR-CS-22~27`、`BR-CS-01~06`、`R-02`。
- **页面示例数据来源**：会话 `#C-108 / #C-109`、买家申诉 `$64` vs 订单 `#90195` 实付 `$56.00`（用于演示“未核实金额拦截”防骗场景）、`LAMP-001 ($24.9)` 均为演示样例。

### 3. M2 驾驶舱设计 Agent (`u02_bi.png`)
- **规则与阈值出处**：
  - `/compose` 不落库预览、`PUT` 保存草稿、`POST` 发布大屏（草稿/发布双版本互不干扰）：来自 `FR-BI-01~03`、`FR-BI-10`、`BR-BI-01~02`。
  - `layout_only` 首屏先出稳定版式 + 最多 `4 卡并发` + 每卡独立数据库 `Session` + 单卡异常隔离：来自 `FR-BI-05~08`。
  - `/describe` 独立分支（先核验 M3 数字再由模型写文字，不改动发布版） & `queried_at / data_as_of` 时间区分：来自 `FR-BI-04/09`。
- **页面示例数据来源**：卡片 GMV `$6,360,000`、订单 `100 单`、可用 `45 / 低库存 1`、版本号 `draft_v4 / published_v3` 均为界面演示值（实际由 M3 `QAClient` 从底座重算）。

### 4. M3 智能问数 Agent (`u03_qa.png`)
- **规则与阈值出处**：
  - `recognize_intent()` 硬拒绝一切修改/删除/调价/改预算写操作（`REJECTED_WRITE`）：来自 `FR-QA-02/05`。
  - `三条只读路径`（A 指标点 `MetricDataPoint` / B `BIDAO` 同日最高版本快照或库存 / C `Vanna 2` 单条受控 `SELECT`） & `SIMULATION` 同步联调标识：来自 SRS §5.2、§3.1、`FR-QA-02/06/10`。
  - `MIXED_CURRENCY` 跨币种禁止强行相加（分列展示）：来自 `FR-QA-06`。
  - `NDJSON` 4 类事件流（`status → sql → answer_delta → result/error`）与记忆规则（默认读 `8 条` / 历史 `20 条` / 单会话上限 `50 条` / 清理 `30 天前`）：来自 `FR-QA-07~09`、`SRS §3.4`。
- **页面示例数据来源**：`$362,520 (USD)` 与 `฿209,800,000 (THB)` 仅为演示跨币种订单计算时的 `MIXED_CURRENCY` 分列规则。

### 5. M4 选品分析 Agent (`u04_selection.png`)
- **规则与阈值出处**：
  - `4 种数据性质`（`INTERNAL / PAID_EXTERNAL / OPEN_PUBLIC / MOCK`）及 `单文件 ≤25MB / 解压 ≤150MB / ≤50列 / ≤50,000行 / SHA-256 去重 / 202 异步任务`：来自 `FR-SEL-02~05`。
  - `≥4 周趋势`、`经营利润 = 毛利 - 5项费用（缺1项即留空不填0）`、4 种状态（`缺失为空 / ESTIMATE_ONLY / BLOCKED / NEED_DATA`）：来自 `FR-SEL-06~08`、`BR-SEL-01~03`。
  - `3 组预设权重（均衡 0.5/0.4/0.1 · 收入 0.7/0.2/0.1 · 增长 0.25/0.65/0.1）` & `未知利润不按 0 参与排序重归一`：来自 `FR-SEL-09/12`。
  - `测款 5 项硬门槛（纯 INTERNAL + 缺失为空 + 利润率 ≥10% + 无高风险）` & `测款复盘建议（达标 ≥90% 且利润率 ≥10% → PRODUCE；单价 <0.5× 或 >2× 先核对）`：来自 `FR-SEL-10~11`、`BR-SEL-04`。
- **页面示例数据来源**：`N-08 / N-12 / N-15 / N-16` 与 `T-03 (目标$10,000 / 实际$9,200 / 92%)` 均为教学演示样例。

### 6. M5 销量预测 Agent (`u05_forecast.png`)
- **规则与阈值出处**：
  - `DemandProfile` 件锁 + `version` 递增 & `ForecastModelDefinition.available()` 先查依赖再执行、`recommend()` 不提前写死精度结论：来自 `FR-FC-01~04/06`。
  - `7 / 14 / 30 天预测窗口`、`最长一年真实历史`、`空日补零、剔除当日`、`误差带非统计 P80 置信区间`：来自 `FR-FC-05~10`。
  - `WAPE 参考区间（≤5%极优 / 5-10%优 / 10-20%良 / 20-30%一般 / >30%较差，待 Q-07 评审）` & `缺货日识别排除` & `演示来源不评准确率`：来自 `FR-FC-08/10/11`、`BR-FC-01~03`。
- **页面示例数据来源**：`LAMP-001` 历史日销量（18~52 件）、未来 14 天总量 `432 件`、`WAPE 18.2% / Bias -2.1% / MAE 4.2` 均为演示曲线与样例（SRS §0.3 不声称部署环境已有特定预测精度）。

### 7. M6 补货预测 Agent (`u06_replenish.png`)
- **规则与阈值出处**：
  - `普通 vs 智能双分支（planning_mode 隔离）` & 智能分支无未来预测报 `FORECAST_REQUIRED`：来自 `FR-RP-01~03`、`AC-RP-01`。
  - `保销量 / 保利润 / 保现金` 三方案与 `海/空/铁` 路线：来自 SRS `img_074` 与 `FR-RP-05`。
  - `fact_signature (+ history_signature)` 签名防漂移、`Idempotency-Key` 幂等提交重算、`SYNCED` 库存 + 有效成本卡门禁：来自 `FR-RP-05~06`、`AC-RP-02`。
  - `6 步审批状态机（READY_FOR_REVIEW → APPROVED → EXECUTING → PURCHASE_ORDERED → INSPECTED → SHIPPED）`、提交≠审批 SoD、多批收货独立表且保持 `PURCHASE_ORDERED`、履约凭证**绝不直接改写 `InventoryPosition`**：来自 `FR-RP-07~10`、`AC-RP-03/04`。
- **页面示例数据来源**：`LAMP-001` 三方案数量与金额（`240/$5,200`、`192/$4,200`、`120/$2,600`）及采购单 `PO-1108（100+92 分批收货）` 均为演示样例（SRS §0.3 不代表已向真实供应商下单）。

### 8. M7 商品内容创作 Agent (`u07_content.png`)
- **规则与阈值出处**：
  - `POST /generation-jobs` 同入口三模式（`COPYWRITING / MAIN_IMAGE / SHORT_VIDEO`）按 `purpose` 分流及 `org_id + idempotency_key` 查重：来自 `FR-GC-01~03/10`。
  - `5 组固定槽位文案草稿`（由 `ContentHarness / ContentDraftSkills` 确定性策略生成，非外部大模型）& `独立 POST /compliance-check`（提示词 ≠ 正式合规）：来自 `FR-GC-04~05`、SRS §0.3。
  - `ComfyUI /prompt → 定时 /sync 轮询 /history/{id} → /view 下载真实文件校验 MIME`（空输出或节点报错绝不标 `SUCCEEDED`）& `二进制直出不走 X-Api-Envelope 解包`：来自 `FR-GC-06~08`、`AC-GC-01~04`、`FR-COM-02`。
  - `生成完成 ≠ 视觉合规通过 ≠ 已自动发布`：来自 SRS §9.1、`R-09`。
- **页面示例数据来源**：`LAMP-001` 五点文案示例、`wf_v2 / job-1120-01 / #cf-9921` 均为演示样例。
