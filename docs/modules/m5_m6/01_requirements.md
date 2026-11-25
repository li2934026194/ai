# CrossPilot · 销量预测与智能补货模块（M5·M6）需求说明书

> **文档状态**：V1.0 正式基线（对齐《AI跨境电商平台-模块需求细化_V1.1》M06/M07、《SRS V1.0》FC-01~06 / RP-01~05 及原型 `docs/prototypes/web/pages_m4_m6.js`）
> **适用范围**：M5-1 画像与方案（`m5a`）、M5-2 销量预测（`m5b`）、M5-3 误差复盘（`m5c`）、M6-1 常规补货沙盒（`m6a`）、M6-2 智能补货与路线（`m6b`）、M6-3 审批下单（`m6c`）、M6-4 到货质检收货（`m6d`）

---

## 1. 模块定位、三方映射与核心原则

### 1.1 业务目标

M5 与 M6 共同构成 CrossPilot 的**履约决策大脑与供应链闭环执行体系**。解决跨境供应链中「缺货日被当零需求拉低销量、无回测盲目预测、忽略海空铁卡运输周期与可靠性差异、零需求被起订量强制采购、补货审批后快照遭暗改、采购单超收/盲目加库存引发超卖」六大业务痛点。

### 1.2 三方编号对齐映射表

| 原型与现行路由 | 子模块名称 | 老师《模块需求细化 V1.1》对应 | 《SRS V1.0》需求编号 | 后端模块 / 前端视图 |
|---|---|---|---|---|
| `m5a` (`/m5/profiles`) | M5-1 商品画像与预测方案 | M06（预测对象、历史天数与模型门槛） | FC-01, FC-02 | `m5_m6_supply` / `M5ProfilesView.vue` |
| `m5b` (`/m5/forecast`) | M5-2 销量预测与缺口测算 | M06（滚动回测、覆盖期与预测趋势曲线） | FC-03, FC-04, FC-05 | `m5_m6_supply` / `M5ForecastView.vue` |
| `m5c` (`/m5/review`) | M5-3 预测误差复盘与修正 | M06（WAPE/MAE 评估与缺货日还原复盘） | FC-06 | `m5_m6_supply` / `M5ReviewView.vue` |
| `m6a` (`/m6/standard`) | M6-1 常规补货测算与沙盒 | M07（What-If 季节/参数调优与情景对比） | RP-01, RP-02 | `m5_m6_supply` / `M6StandardView.vue` |
| `m6b` (`/m6/smart`) | M6-2 智能补货测算与路线 | M07（预测驱动缺口、4 路线与 3 目标比较） | RP-03, RP-04 | `m5_m6_supply` / `M6SmartView.vue` |
| `m6c` (`/m6/applies`) | M6-3 补货审批与下单 | M07（防篡改快照核对、禁自批、生成采购单） | RP-05 | `m5_m6_supply` / `M6AppliesView.vue` |
| `m6d` (`/m6/receiving`) | M6-4 到货质检与收货凭证 | M07（分批质检登记、取消与断货消警） | RP-05 | `m5_m6_supply` / `M6ReceivingView.vue` |

### 1.3 上下游接口契约

- **上游输入**：`M0Product`（采购成本 USD、MOQ、箱规 `pack_size`、交期 `lead_time_days`）、`M0Inventory`（实时可用 `on_hand` 与在途 `in_transit`）、`M5SalesHistory`（剔除当日未完结订单的真实历史日销量）。
- **下游输出**：
  - M6-3 批准生成的 `M6PurchaseOrder` 承诺资金汇总至 M2 经营大屏（`po_commitment_rmb`）；
  - M6-4 到货质检与 M0-3 盘点校准闭环联动 `M6AlertEvent`（V1.1 严格收敛：收货只核减 `in_transit` 并留痕待上架，经 M0-3 盘点确认或合格入库后自动消警）。

### 1.4 七项核心业务原则（硬约束）

1. **纯计算与框架隔离**：所有销量还原、滚动回测、安全库存、ROP、两步取整与状态流转规则由 `domain/` 纯函数实时计算，绝不硬编码业务数字。
2. **缺货日还原与历史缺失不填零**：当日末库存为 0 引起的断货低销须标注或还原真实潜在需求，同时永久保留 `qty_raw`；无任何销量记录的新 SKU 直接阻断并返回 `422 M5-1003`，绝不编造历史曲线。
3. **覆盖窗口匹配原则**：用于采购决策的预测跨度必须覆盖「总提前期（生产+物流）+ 审阅覆盖期」；不足不可静默替代。
4. **MOQ 与整箱两步取整约束**：正净需求 `net > 0` 必须先 `max(net, MOQ)` 再向上取整为 `pack_size` 整数倍；净需求 `<= 0` 时直接返回 `0`，不得因 MOQ 强行采购。
5. **路线可靠性与假设透明声明**：`sea`（45 天）、`air`（7 天）、`rail`（25 天）、`truck`（18 天）均显式标注演示假设参数属性，不得伪装为实时承运商报价。
6. **严密状态机与职责分离（SoD）**：`draft -> pending_approve -> approved -> closed`（或 `rejected`），`created -> shipping -> partial_received -> fully_received`（或 `cancelled`）。任何非法跃迁抛 `422 F-2001/2002/2003`；**提交人（`submit_user`）绝对禁止自批或自驳回（`403 M7-4032`）**。
7. **收货质量与库存口径规范**：不良品 `defect_qty` 不可计入合格可售库存；V1.1 严格收敛「M6-4 登记收货与质检留痕核减 `in_transit`，经 M0-3 盘点确认后写入 `on_hand` 并联动关闭 `M6AlertEvent`」。

---

## 2. 岗位权限矩阵（RBAC）

| 业务操作 | 权限码 | `planner` | `approver` | `warehouse` | `bi_analyst` | `manager` / `selector` | `creator`/`cs`/`mock_buyer` |
|---|---|---|---|---|---|---|---|
| 查看预测、补货单、PO、告警与周报 | `m5:read`, `m6:read` | ✅ | ✅ | ✅ | ✅ | ✅ (`manager`/`selector`仅`m5:read`) | ❌ (403) |
| 运行预测与 What-If 沙盒仿真 | `m5:run` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 撰写与发布预测误差周复盘 | `m5:review` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| 创建补货草案与提交审批 | `m6:draft` | ✅ | ❌ (403) | ❌ (403) | ❌ | ❌ | ❌ |
| 审批通过 / 驳回补货单（禁自批） | `m6:approve` | ❌ (403) | ✅ | ❌ (403) | ❌ | ❌ (403) | ❌ |
| PO 发货、分批收货、取消与确认告警 | `m6:receive` | ❌ (403) | ❌ (403) | ✅ | ❌ | ❌ | ❌ |

---

## 3. 分页详细功能需求

### 3.1 M5-1 ~ M5-3（销量预测与复盘）

1. **M5-1 (`m5a`)**：展示各 SKU 历史销量覆盖天数、平均日销与可选预测策略门槛（如：历史天数 `< 14` 天提示仅用短期均线或新品参考）。
2. **M5-2 (`m5b`)**：选择 SKU、运输路线（`sea`/`air`/`rail`/`truck`）、决策目标（`sales`/`profit`/`cash`），调用 `/supply/forecast/{sku}` 展示：
   - 多模型回测表（SMA / EWMA / Holt / Croston 等 WAPE/MAE 对比及 `best_model` 标识）；
   - 安全库存 `SS`、再订货点 `ROP`、目标库存、两步取整建议补货量 `qty_suggest`；
   - 14 天逐日需求预测与 4 路线全维对比明细。
3. **M5-3 (`m5c`)**：核对回测误差率（WAPE = 绝对误差之和 / 实际销量之和；实际合计为 0 时不可强算，标 N/A）与偏差方向，由 `bi_analyst` 沉淀复盘总结（`M6WeeklyReview`）。

### 3.2 M6-1 ~ M6-4（补货测算与采购履约）

1. **M6-1 (`m6a`)**：What-If 沙盒允许调节生产交期覆盖（0~90天）、审阅周期（1~90天）、服务水平（0.90~0.99）、需求倍率（0.3~3.0x），实时输出基线 vs 仿真对比。
2. **M6-2 (`m6b`)**：强制基于有效 M5 预测（缺预测阻断），展开各路线覆盖天数与缺货风险后一键创建 `draft` 补货单（锁定 `snapshot_json`）。
3. **M6-3 (`m6c`)**：
   - `planner` 提交 `draft` → `pending_approve`；
   - `approver` 核对快照与提交人（禁自批）后批准 → 立即创建 `M6PurchaseOrder`（`status="created"`）并增加 `M0Inventory.in_transit`；或填写非空理由驳回 `rejected`。
4. **M6-4 (`m6d`)**：
   - `warehouse` 对 PO 执行 `ship`（发货在途）→ 分批 `receive`（输入实收 `receive_qty > 0` 与不良 `0 <= defect_qty <= receive_qty`，禁止累计实收 > `order_qty`）→ 全收自动置 PO 为 `fully_received` 并联动原申请单变为 `closed`；
   - 支持对未终态 PO 填写非空原因 `cancel` 并自动回退在途数；支持确认 `OPEN` 断货告警（`ACKED`）。

---

## 4. 核心数据对象与跨模块契约

| 核心实体 | 归属表 | 职责与核心约束 |
|---|---|---|
| `M5SalesHistory` | `m5_sales_history` | 按 `(org_id, sku, sales_date)` 唯一记录原始销量与日末库存 |
| `M6ReplenishApply` | `m6_replenish_applies` | 补货草案与提交冻结参数快照（`snapshot_json`）与审批人追踪 |
| `M6PurchaseOrder` | `m6_purchase_orders` | 采购履约单与累计收货/不良品/取消原因记录 |
| `M6AlertEvent` / `M6WeeklyReview` | `m6_alert_events`, `m6_weekly_reviews` | 断货告警闭环与预测误差周复盘沉淀 |

---

## 5. 非功能需求与验收标准

### 5.1 性能、准确率与可靠性指标

1. **预测与仿真响应**：单 SKU 多模型回测 + 4 路线全维对比计算耗时 ≤ 40ms；所有接口 P95 ≤ 120ms。
2. **数值守恒与精度**：两步取整算法 100% 满足 `0 <= net` 零强买与 `pack_size` 整箱约束；累计收货数绝对不超过采购单量 `order_qty`。
3. **状态机确定性**：非法状态流转拦截率 100%，所有履约操作 100% 写入中文审计。

### 5.2 核心验收标准矩阵（M5M6-AC-01 ~ M5M6-AC-06，对齐 M06-A01~07 / M07-A01~07）

| 验收编号 | 对应老师用例 | 给定条件与动作 | 通过标准 |
|---|---|---|---|
| **M5M6-AC-01** | M06-A02/06 | 新 SKU 无历史销量调用预测 | 返回 `422 M5-1003`；实际销量为 0 时 WAPE 不强算为零 |
| **M5M6-AC-02** | M06-A05 | 回测预测 12、8；实际 10、10 | 绝对误差和 4，WAPE 精确 20%，MAE 精确 2，原预测不覆盖 |
| **M5M6-AC-03** | M07-A03/05 | 净需求 190、MOQ 100、箱规 24；以及净需求 ≤ 0 | 正需求两步取整为 `192`；零/负需求输出 `0`（不因 MOQ 强买） |
| **M5M6-AC-04** | — | `draft` 直接审批、空理由驳回、已收满 PO 取消或超量收货 | 全部被纯状态机抛出 `422 F-2001/2002/2003` 拦截 |
| **M5M6-AC-05** | M07-A06/07 | `planner` 提交后同人审批，或 `warehouse` 以外角色收货 | 全部返回 `403`（SoD `M7-4032` / RBAC `M7-4031`） |
| **M5M6-AC-06** | E2E-02 | `order_qty=100` 先收 60（不良 5）再收 40 | PO 依次经过 `created -> partial_received -> fully_received`，申请单自动 `closed` |

---

## 6. 已确认的技术落地口径（V1 实施方案拍板）

1. **V1 路线与参数公开声明**：`sea`/`air`/`rail`/`truck` 时效与单位运费采用结构化配置假设参数并向运营透明展示，V2 对接承运商实时报价 API。
2. **V1.1 精修规划**：收敛 `receive_po` 库存红线（收货只核减 `in_transit`、记录质检合格与不良品，由 M0-3 盘点确认更新 `on_hand` 并自动关闭对应 `M6AlertEvent`）。
