# CrossPilot · 店铺接入与商品主档模块（M0）需求说明书

> **文档状态**：V1.0 正式基线（对齐《AI跨境电商平台-模块需求细化_V1.1》M02、《AI跨境电商平台V1.0-软件需求规格说明书》ST-01~02 / DT-04 及原型 `docs/prototypes/web/pages_m0_m3.js`）
> **适用范围**：M0-1 店铺授权管理（`m0a`）、M0-2 商品成本与订单台账（`m0b`）、M0-3 分店库存与人工盘点（`m0c`）

---

## 1. 模块定位、三方映射与核心原则

### 1.1 业务目标

M0 是 CrossPilot 全平台的**事实底座与主数据中枢**。在跨境多平台（Amazon、TikTok Shop、Shopee、Lazada、eBay）运营场景下，M0 旨在解决五大长期业务痛点：
1. 店铺授权分散、Token 过期无人知晓，导致订单拉取中断或混入演示测试数据虚增实盘营收；
2. 同款商品在不同站点使用不同店铺 SKU/ASIN，缺乏统一内部编码（SKU）导致毛利核算与采购备货口径混乱；
3. 采购成本与头程运费被一线随意改写，导致历史毛利报表突然跳变且无人审批留痕；
4. 仓库刚卸货未清点残次品就自动增加线上可售库存，引发线上超卖发不出货；
5. 同一批外部订单重复同步或重复导入 CSV 时发生双倍记账，或采集失败当天被错误记为零销量。

### 1.2 三方编号对齐映射表

| 原型与现行路由 | 子模块名称 | 老师《模块需求细化 V1.1》对应 | 《SRS V1.0》需求编号 | 后端模块 / 前端视图 |
|---|---|---|---|---|
| `m0a` (`/m0/shops`) | M0-1 店铺授权管理 | M02 店铺同步与测试数据管理（授权校验、同步批次） | ST-01, ST-02 | `m0_catalog` / `M0ShopsView.vue` |
| `m0b` (`/m0/ledger`) | M0-2 商品成本与订单台账 | M02（自有商品档案、真实销量去重、测试成本批次） | ST-01, DT-04 | `m0_catalog` / `M0LedgerView.vue` |
| `m0c` (`/m0/inventory`) | M0-3 分店库存与人工盘点 | M02（多状态库存口径、在途隔离、安全水位） | ST-02, DT-04 | `m0_catalog` / `M0InventoryView.vue` |

### 1.3 上下游接口契约（仅限跨模块衔接）

- **上游输入**：
  - M4-3 测款终审通过的新品（`M4SelectionService.decide_candidate` 写入/升级 `M0Product`，标明 `origin="M4_APPROVED"` 与审批依据）；
  - M6-4 到货质检与收货凭证（仅产生质检与在途核销记录，**严格禁止绕过盘点直接替代人工清点**）；
  - 运营或管理者导入的店铺授权信息、CSV 订单/历史销量批次、人工盘点实数与 1688 参考报价。
- **下游输出**：
  - `contracts/product_catalog_contract.py`：向 M7 内容创作子系统暴露只读 `ProductFactSnapshot`（SKU、名称、类目、品牌、售价、划线价、规格与卖点，屏蔽敏感采购成本与供应商资料）；
  - M1-2 导购知识库与 M1-3 售后赔付校验：按 SKU 核对本店在售商品与订单参考编号；
  - M5 销量预测与 M6 智能补货：供给 `M0Product`（`unit_cost_usd`、`moq`、`pack_size`、`lead_time_days`）与 `M0Inventory`（实时净可售 `on_hand`）；
  - M2 经营大屏与 M3 智能问数：按组织聚合实盘店铺与订单（**严格过滤 `is_mock=False`**）。

### 1.4 六项核心产品原则（硬约束）

1. **实盘与演示严格隔离（MOCK Isolation）**：任何 `is_mock=True` 的店铺、订单、报价必须显式标注「仅演示不计营收」或「模拟比价层」；M2 实盘营收汇总与 M5 真实销量预测严禁混入 `is_mock=True` 数据。
2. **收货不自动改库存，盘点才改库存（Stocktake Redline）**：M6-4 仓库收货登记只留档收货数量、不良品数量与质检凭证；分仓库存 `on_hand` 的正式校准必须由仓库/物流人员在 M0-3 提交人工盘点单触发（V1.1 在服务端统一收敛为：收货只核减 `in_transit` 与待上架留痕，盘点确认后才写入 `on_hand`）。
3. **成本变更审批与职责分离（SoD）**：修改 `M0Product.unit_cost_usd` 必须通过 `M0CostRequest` 发起申请并填写业务原因；**申请人（`proposer_id`）绝对禁止自批（`reviewer_id != proposer_id`）**，批复前主档成本保持旧值不变。
4. **订单业务键防重与缺失不填零**：订单导入/同步按 `(org_id, order_id)` 严格去重，重复提交只跳过计数不翻倍；某天接口失败或授权失效时保留失败状态与最后成功时间，绝不把缺失日当成零销售。
5. **可售口径不重复扣减占用**：若来源库存 `on_hand` 已代表当前可用净库存，另列的 `reserved`（占用锁定）仅作展示参考，下游 M5/M6 取用时不可再次扣减成 `on_hand - reserved`。
6. **1688 模拟比价隔离**：`M0SupplierQuote` 标记 `is_simulated=True`，只作采买比价提示，绝不静默覆盖正式 `M0Product.unit_cost_usd`。

---

## 2. 岗位权限矩阵（RBAC）

| 业务操作 | 权限码 | `manager` | `approver` | `planner` | `warehouse` | `selector` | `bi_analyst` | `creator` / `cs` | `mock_buyer` |
|---|---|---|---|---|---|---|---|---|---|
| 浏览店铺、主档、台账、库存 | `m0:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (403) |
| 新增 / 重连 / 同步店铺 | `m0:shop:manage` | ✅ | ❌ (403) | ❌ (403) | ❌ (403) | ❌ | ❌ | ❌ | ❌ |
| 新建主档 / 导入订单 CSV | `m0:cost:propose` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 发起成本变更申请 | `m0:cost:propose` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 审批成本变更（禁自批） | `m0:cost:approve` | ❌ (403) | ✅ | ❌ (403) | ❌ | ❌ | ❌ | ❌ | ❌ |
| 提交人工盘点校准库存 | `m0:inventory:edit` | ❌ (403) | ❌ (403) | ❌ (403) | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 3. 分页详细功能需求

### 3.1 M0-1：店铺授权管理（`m0a` / `/m0/shops`）

1. **店铺统计与状态巡检卡**：顶部展示总接入店铺数、实盘经营店数、演示隔离店数、异常/临期店铺数。
2. **连接新店铺**：
   - 输入项：店铺编码 `shop_code`（组织内唯一）、店铺名称 `name`、电商平台（`amazon_us` / `tiktok_us` / `shopee_th` / `lazada` / `ebay`）、结算币种（`USD` / `GBP` / `THB` / `MYR` / `SGD`）、经营性质开关 `is_mock`（默认提示选择实盘或演示）。
   - 校验规则：`shop_code` 重复抛出 `409 M7-4091`；非 `manager` 权限返回 `403 M7-4031`。
3. **店铺列表与同步状态（V1.1 补齐项）**：
   - 列表展示凭证掩码（如 `尾号 4821`）、授权有效期状态（`CONNECTED` / `EXPIRING` / `EXPIRED`）、`last_sync_at`。
   - 点击「立即同步 / 重新授权」生成同步批次记录（新增数 / 去重数 / 失败数 / 缺失日期）；演示店铺始终附带红色「仅限演示不计营收」徽章。

### 3.2 M0-2：商品成本与订单台账（`m0b` / `/m0/ledger`）

1. **统一商品主档区**：
   - 字段包含：`sku`、商品名称、中文类目、品牌、默认站点、当前售价与划线价（USD）、当前核算采购成本（USD）、MOQ、箱规（`pack_size`）、常规交期（`lead_time_days`）、来源标识（`M4_APPROVED` / `IN_STORE_REFRESH`）及过会/更新依据。
   - 新增商品校验：`sale_price_usd > 0`、`unit_cost_usd >= 0`、`moq >= 1`、`pack_size >= 1`；SKU 重复返回 `409 M7-4091`。
2. **成本变更申请与审批区**：
   - `planner` 选择 SKU 填写 `new_cost_usd >= 0` 与必填业务原因（`reason` ≥ 2 字）提交，状态为 `PENDING`，保留 `old_cost_usd` 与 `proposer_id`。
   - `approver` 审批：系统校验 `proposer_id != actor.user_id`（违者 `403 M7-4032`）；批准（`APPROVED`）后立即更新 `M0Product.unit_cost_usd` 并写审计，驳回（`REJECTED`）则维持原价。
3. **订单台账与 CSV 批量导入**：
   - 订单表按时间/单号倒序显示 `order_id`、`shop_id`、`sku`、`order_date`、`qty`、`revenue_usd`、`is_mock` 标签与状态。
   - **CSV 批量导入（`POST /orders/import-csv`）**：标准头 `order_id,shop_id,sku,order_date,qty,revenue_usd,is_mock,status`。逐行校验格式、`qty > 0`、`revenue_usd >= 0`；按 `(org_id, order_id)` 去重跳过已存在单号，输出 `{imported, skipped_duplicates, errors}`。V1.1 前端需补齐本地文件选择、前 10 行预览与测试文件名（`mock/demo/演示`）冲突警示。
4. **1688 供应商参考报价区**：只读展示供应商名称、人民币单件价、MOQ、交期及 `is_simulated` 模拟比价层声明。

### 3.3 M0-3：分店库存与人工盘点（`m0c` / `/m0/inventory`）

1. **分仓库存台账**：按 `(warehouse_code, sku)` 独立展示，支持多仓（如 `WH-US-WEST` 美西海外仓、`WH-TH-BKK` 曼谷仓、`WH-CN-SZ` 深圳总仓）。
2. **低库存红字预警与口径展示**：展示 `on_hand`（净可售）、`in_transit`（在途，未到仓不可售）、`reserved`（占用参考，不重复扣减）、`last_stocktake_by`；`on_hand < 30` 高亮预警并引导前往 M6 补货。
3. **人工盘点校准表单**：仅 `warehouse` (`m0:inventory:edit`) 可提交盘点单（`warehouse_code`, `sku`, `counted_qty >= 0`, `reason`）；保存后立即更新 `on_hand = counted_qty` 并实时联动 M5/M6 缺口重算。

---

## 4. 核心数据对象与接口契约概要

| 数据对象 / 契约 | 所属层级 | 关键字段与唯一约束 |
|---|---|---|
| `M0Shop`（店铺主档） | 数据实体 | `shop_id` (PK), `org_id`, `shop_code` (UQ with org), `platform`, `currency`, `status`, `is_mock` |
| `M0Product`（商品主档） | 数据实体 | `product_id` (PK), `org_id`, `sku` (UQ with org), `sale_price_usd`, `unit_cost_usd`, `moq`, `pack_size`, `lead_time_days` |
| `M0CostRequest`（成本变更） | 数据实体 | `request_id` (PK), `sku`, `old_cost_usd`, `new_cost_usd`, `status`, `proposer_id`, `reviewer_id` |
| `M0Order`（订单台账） | 数据实体 | `id` (PK), `org_id`, `order_id` (UQ with org), `shop_id`, `sku`, `qty`, `revenue_usd`, `is_mock` |
| `M0Inventory`（分仓库存） | 数据实体 | `inv_id` (PK), `org_id`, `warehouse_code`, `sku` (UQ), `on_hand`, `in_transit`, `reserved` |
| `M0SupplierQuote`（1688比价） | 数据实体 | `quote_id` (PK), `sku`, `supplier_name`, `unit_price_rmb`, `moq`, `is_simulated` |
| `ProductFactSnapshot` | 跨模块契约 | 仅向 M7 暴露名称、类目、品牌、售价、规格卖点，物理屏蔽采购成本与报价 |

---

## 5. 非功能需求与验收标准

### 5.1 性能、可靠性与审计覆盖率

1. **响应与批量吞吐**：店铺/商品/库存列表查询接口 P95 ≤ 100ms；单次 500 行订单 CSV 批量解析、校验、去重与落库耗时 ≤ 500ms；并发盘点与成本审批支持数据库事务 ACID 串行一致性。
2. **去重与隔离覆盖率**：订单导入 `(org_id, order_id)` 去重准确率 100%；`is_mock=True` 演示数据在 M2 实盘聚合中被排除率 100%；越权调用或同人自批拦截率 100%。
3. **可追溯性**：连店、加品、改价申请、改价审批、CSV 导入与人工盘点 100% 写入 `core_audit_events` 中文自然语言台账，任何成本变均可追溯 `old_cost -> new_cost`、申请人和审批人。

### 5.2 核心验收标准矩阵（M0-AC-01 ~ M0-AC-06，对齐 M02-A01~A06）

| 验收编号 | 对应老师用例 | 给定条件与操作 | 通过标准 |
|---|---|---|---|
| **M0-AC-01** | M02-A01 / DT-04 | 创建 1 家 `is_mock=True` 演示店并导入测试订单 `$500` | 店铺与订单显式标 MOCK；M2 实盘 GMV 与净利润严格不计入该 `$500` |
| **M0-AC-02** | M02-A02 | 同一批含 `ORD-CSV-01` 的订单 CSV 连续导入两次 | 第 1 次成功入账，第 2 次全部被去重跳过（`skipped_duplicates` 准确），销量不翻倍 |
| **M0-AC-03** | M02-A06 | `planner` 申请 `SKU-00704` 改价 `$8.50`，同人尝试审批后再由 `approver` 审批 | 自批返回 `403`；主管批准前主档仍为旧价，批准后更新为 `$8.50` 并留存旧版本审计 |
| **M0-AC-04** | M02-A03 | 某仓记录 `on_hand=80, reserved=10`（可售已扣占用） | 下游 M5/M6 读取当前可售基数为 `80`，不得二次扣减成 `70` |
| **M0-AC-05** | M02-A05 | 在途 `in_transit=50`，真实库存 `on_hand=80`；M6-4 登记收货 | 未盘点确认前当前可售仍为 `80`；由 `warehouse` 在 M0-3 提交盘点单后才更新 `on_hand` |
| **M0-AC-06** | M02-A04 | `org_other` 跨租户请求或无权限岗位调用连店/盘点接口 | 全部返回 `403`；缺少某天同步记录时不填零销量 |

---

## 6. 已确认的技术落地口径（V1 实施方案拍板）

1. **V1 多平台接入边界**：平台支持 Amazon / TikTok Shop / Shopee / Lazada / eBay 的名义店铺档案与结算币种声明，V1 采用本地凭证掩码登记与演示同步触发，不接入真实海外卖家后台 OAuth 秘钥；预留 Adapter 扩展位供 V2 接入 SP-API。
2. **V1 多币种与成本精度**：系统主核算账本为 USD（含 2 位小数舍入），1688 参考报价按 RMB 标示；V1.1 补齐组织级可配置 FX 汇率表（`fx_rates`）用于透明折算展示，绝不隐式混淆 USD 与 RMB。
3. **V1.1 精细化迭代清单**：补齐前端本地 CSV 上传前 10 行预览与测试文件名（`mock/demo`）阻断警告、店铺同步批次流水记录（`m0_sync_batches`）以及与 M6-4 的严格盘点解耦（收货只核减 `in_transit`，盘点才更新 `on_hand`）。
