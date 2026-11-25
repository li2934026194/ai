# CrossPilot · M0 店铺接入与商品主档概要设计说明书（HLD V1.0）

> **文档编号**：CP-M0-HLD-2026-V1.0
> **文档定位**：定义 M0 在 CrossPilot 平台中的架构分层、子域职责、统一数据口径、跨模块契约、量化非功能指标与安全隔离策略。

---

## 1. 引言

### 1.1 编写目的

本概要设计说明书面向架构师、后端与前端研发及测试团队，明确 M0 店铺接入与商品主档模块在 CrossPilot 模块化单体中的内部架构、对外只读契约边界与核心数据口径，作为需求说明书与详细设计说明书之间的桥梁。

### 1.2 范围

- **覆盖范围**：
  1. M0 三大核心页面与对应后端子域：M0-1 店铺授权管理（`m0a`）、M0-2 商品成本与订单台账（`m0b`）、M0-3 分店库存与人工盘点（`m0c`）。
  2. M0 与平台公共底座（组织/RBAC 鉴权、中文操作审计台账）的协同机制。
  3. M0 向 M7（`ProductCatalogContract`）、M5/M6（商品主档与可售库存）、M2/M3（实盘订单与店铺聚合）供应数据的单向边界。
- **不覆盖范围**：
  1. 不覆盖 M1–M8 其余业务模块的内部实现设计。
  2. 不覆盖实际海外电商平台（Amazon SP-API / TikTok Shop / Shopee Open Platform）生产 OAuth2 授权回调与实时 Webhook 采集调度（V1 保留标准 Adapter 位）。
  3. 不覆盖第三方海外仓 WMS 自动改库存接口与实时金融外汇牌价对接。
  4. 不展开表字段精确 DDL、逐行请求/响应 JSON 与状态错误码明细（归入详细设计说明书）。

### 1.3 术语表

| 术语 | 业务与架构定义 |
|---|---|
| `is_mock` 隔离标记 | 区分实盘店铺/订单与内部联调演示数据的强布尔字段；所有实盘经营报表强制过滤 `is_mock=False` |
| `M0CostRequest` SoD | 成本改价的发起人（`proposer_id`）与审批人（`reviewer_id`）严格物理分人，杜绝自批篡改毛利 |
| 盘点单唯一改库存 | M6-4 仓库收货登记仅保留质检与在途核销留痕；正式可售库存 `on_hand` 仅经 M0-3 盘点确认更新 |
| `ProductCatalogContract` | 跨模块只读商品事实快照契约，屏蔽 `unit_cost_usd` 等采买机密字段 |

### 1.4 参考资料

1. 《CrossPilot-M0店铺接入与商品主档需求说明书》（V1.0）
2. 《CrossPilot-M0店铺接入与商品主档测试用例》（V1.0）
3. 《AI跨境电商平台-模块需求细化_V1.1》（M02 店铺同步与主档口径规范）
4. 《AI跨境电商平台V1.0-软件需求规格说明书》（ST-01~02 / DT-04）

---

## 2. 总体设计

### 2.1 四项核心设计原则

1. **单一事实源与跨模块只读隔离**：全平台所有业务读取商品售价、规格与库存必须经过 M0 域表或 `contracts/`，禁止下游模块自建商品副本或反向写改 `M0Product`。
2. **实盘与测试物理隔离**：店铺、订单、供应商报价均具备显式 `is_mock` / `is_simulated` 标识；实盘计算引擎默认且强制排除测试数据。
3. **业务主键防重与缺失诚实声明**：外部订单导入严格以 `(org_id, order_id)` 去重；接口失败或授权失效当天绝不填零销量。
4. **职责分离与强事务审计**：连店、建品、改价审批、CSV 导入与盘点均与 `core_audit_events` 同事务提交，审计不可删除。

### 2.2 技术选型及理由

| 技术领域 | 选型方案 | 选型理由 |
|---|---|---|
| 服务与参数校验 | FastAPI + Pydantic v2 + Async SQLAlchemy 2.0 | 强类型 Schema 拦截负成本、负库存及非法平台枚举；异步处理 CSV 批量导入无阻塞 |
| 数据库与约束 | PostgreSQL 15+ / SQLite 3.40+ + Alembic | 成本审批、分仓多唯一索引（`uq_m0_shop_code`, `uq_m0_org_sku`, `uq_m0_wh_sku`）依赖 ACID 事务 |
| 跨模块契约 | `contracts/product_catalog_contract.py` | 输出只读 `ProductFactSnapshot` DTO，物理剥离敏感采购成本字段 |
| 权限与隔离 | 平台公共 `core/auth_rbac.py` + `core/tenant.py` | 复用组织上下文提取与 9 岗位权限码细粒度拦截 |

### 2.3 系统边界（做什么 vs 不做什么）

- **本模块做什么**：管理多平台店铺登记与授权状态、一货多店主 SKU 主档、双人成本变更审批、订单台账检索与 CSV 防重导入、分仓库存台账与人工盘点校准、1688 模拟比价参照。
- **本模块不做什么**：不直接连网修改 Amazon/Shopee 线上价格与库存；不绕过审批静默覆盖历史成本；不绕过盘点单将收货不良品算作线上可售库存。

---

## 3. 系统架构设计

### 3.1 分层架构说明

1. **表现层（Vue 3 前端）**：承载 `M0ShopsView`、`M0LedgerView`、`M0InventoryView` 三个工作台，完成权限态提示、MOCK 标签渲染、CSV 预览与表单输入校验。
2. **网关与安全层**：通过 `/api/v1/orgs/{org_id}/m0/*` 统一接入，强制校验 `org_id` 租户一致与 `m0:*` RBAC 权限码。
3. **M0 领域服务层**：由 `M0-Shop`、`M0-Catalog`、`M0-CostSoD`、`M0-OrderLedger`、`M0-Inventory`、`M0-QuoteRef` 六个内聚组件构成。
4. **公共底座与契约层**：依赖 `core/audit`（中文审计台账）、`core/auth_rbac`；对外通过 `contracts/product_catalog_contract.py` 暴露只读商品快照。
5. **数据持久化层**：维护 6 张带 `org_id` 索引的核心业务表（V1.1 新增 `m0_sync_batches` 与 `m0_fx_rates`）。

### 3.2 系统分层与部署架构图

```
+-----------------------------------------------------------------------+
| 表现层 (Vue 3 SPA): m0a 店铺授权 | m0b 主档/成本/CSV台账 | m0c 分仓盘点   |
+-----------------------------------+-----------------------------------+
                                    | HTTPS / JSON (X-Actor-* / JWT)
+-----------------------------------v-----------------------------------+
| 网关与安全层: /api/v1/orgs/{org_id}/m0/*  --> Tenant隔离 + RBAC 6权限码  |
+-----------------------------------+-----------------------------------+
| M0 领域服务层 (M0CatalogService):                                       |
|  [M0-Shop]  [M0-Catalog]  [M0-CostSoD]  [M0-OrderLedger] [M0-Inventory] |
+---------+-------------------------+-------------------------+---------+
          | 同步写入审计               | 单向只读契约              | 事务持久化
+---------v---------+     +---------v---------+     +---------v---------+
| core_audit_events |     | ProductCatalog    |     | m0_shops/products |
| (中文审计底座)      |     | Contract -> M7    |     | orders/inventory  |
+-------------------+     +-------------------+     +-------------------+
```

---

## 4. 模块划分与职责

### 4.1 模块清单与单一职责

| 子模块 | 归属层级 | 单一职责 |
|---|---|---|
| `M0-Shop` | 接入治理 | 店铺注册、唯一编码校验、`is_mock` 隔离打标、授权健康态与同步批次管理 |
| `M0-Catalog` | 主数据中台 | 一货多店主 SKU 档案维护、防止重复建品、承接 M4 过会新品落库 |
| `M0-CostSoD` | 价格合规流 | 管理成本变更申请单生命周期、执行 `proposer != reviewer` 职责分离、批准后回写主档 |
| `M0-OrderLedger` | 账务台账 | 订单检索与 CSV 批量幂等导入、行级校验与 `(org_id, order_id)` 防重跳过 |
| `M0-Inventory` | 仓储库存 | 分店分仓独立台账维护、低水位识别、人工盘点校准 `on_hand` |
| `M0-QuoteRef` | 采买参考 | 只读维护 1688 模拟比价表，隔离测试/参考报价层不触碰正式成本 |

### 4.2 跨模块协作与同步/异步依赖表

| 协作方 | 方向 | 通信方式 | 契约与边界约束 |
|---|---|---|---|
| **M4 选品决策** | M4 → M0 | 同事务同步调用 | 仅 `M4Candidate` 终审通过时写入 `M0Product`，标 `origin="M4_APPROVED"` |
| **M7 内容创作** | M0 → M7 | 同步只读契约 | `ProductCatalogContract` 屏蔽 `unit_cost_usd` 与供应商信息 |
| **M5 预测 / M6 补货** | M0 → M5/M6 | 同步只读查询 | 读取 `M0Product` 供应链参数及 `M0Inventory.on_hand`/`in_transit` |
| **M6-4 仓库收货** | M6 → M0 | 异步解耦边界 | 收货登记不直接修改可售数；须由仓管在 M0-3 提交盘点单校准 |
| **M2 大屏 / M3 问数** | M0 → M2/M3 | 同步只读聚合 | 强制过滤 `is_mock=False`，防止演示订单污染实盘营收 |

---

## 5. 功能模块设计（追溯至需求与用例）

### 5.1 功能与需求追溯总表

| 子模块 | 对应需求条目 | 核心交互实体 | 对应验收编号 |
|---|---|---|---|
| M0-1 店铺授权 (`m0a`) | 需求 3.1 | `M0Shop`, `M0SyncBatch` (V1.1) | M0-AC-01, M0-AC-06 |
| M0-2 主档与台账 (`m0b`) | 需求 3.2 | `M0Product`, `M0CostRequest`, `M0Order`, `M0SupplierQuote` | M0-AC-01, M0-AC-02, M0-AC-03 |
| M0-3 分仓盘点 (`m0c`) | 需求 3.3 | `M0Inventory` | M0-AC-04, M0-AC-05, M0-AC-06 |

### 5.2 关键业务设计说明

1. **成本改价双人闭环**：申请提交时将当前 `M0Product.unit_cost_usd` 快照为 `old_cost_usd`；主管审批校验通过前主档价格纹丝不动；仅当 `decision == "APPROVED"` 且 `proposer_id != reviewer_id` 时原子更新主档。
2. **CSV 导入行级容错**：解析时跳过空行，捕获负数数量或负数营收记录进 `errors[]` 数组而不中断同批次合法记录入库；重复单号计入 `skipped_duplicates`。

---

## 6. 数据设计

### 6.1 统一数据口径定义（全局防打架规范）

1. **实盘订单口径**：实盘 GMV 与实盘订单数仅统计 `m0_orders.is_mock == False` 且 `status != "CANCELLED"` 的记录；`is_mock == True` 订单永不参与实盘结算。
2. **净可售库存口径**：`on_hand` 即代表当前仓库净可售库存；`reserved` 仅作参考展示，严禁下游再次扣减为 `on_hand - reserved`；`in_transit` 代表海空头程在途数，未到仓不可售。
3. **双币种隔离口径**：主档售价与成本以 USD 保留 2 位小数存储；1688 参考报价以 RMB 标示；跨币种展示必须携带币种前缀与汇率来源，严禁直接数值相加。
4. **低库存预警口径**：分仓记录 `on_hand < 30` 触发前端高亮红字预警并提示关联 M6 补货。

### 6.2 核心数据实体与表清单（不含字段明细）

| 表名 | 主键 | 唯一业务键 | 职责说明 |
|---|---|---|---|
| `m0_shops` | `shop_id` | `(org_id, shop_code)` | 平台店铺注册档案与演示隔离标识 |
| `m0_products` | `product_id` | `(org_id, sku)` | 商品主档（定价、核算成本、MOQ/箱规/交期） |
| `m0_cost_requests` | `request_id` | — | 成本改价申请审批单与版本记录 |
| `m0_orders` | `id` | `(org_id, order_id)` | 多平台订单流水台账（防重导入） |
| `m0_inventory` | `inv_id` | `(org_id, warehouse_code, sku)` | 分仓库存实时台账（净可售、在途、盘点人） |
| `m0_supplier_quotes` | `quote_id` | — | 1688 模拟比价记录（带 `is_simulated` 标） |

### 6.3 基础主数据与店铺接入数据流图（DFD）

![CrossPilot M0 基础主数据与店铺接入数据流图](/home/user/ai/docs/prototypes/dfd_v6/d08_base_foundation.png)

---

## 7. 接口设计（接口与契约清单）

| 接口 / 契约路径 | 方法 | 权限码 | 核心职责 |
|---|---|---|---|
| `/api/v1/orgs/{org_id}/m0/shops` | `GET` / `POST` | `m0:read` / `m0:shop:manage` | 查询店铺列表 / 新增连店 |
| `/api/v1/orgs/{org_id}/m0/products` | `GET` / `POST` | `m0:read` / `m0:cost:propose` | 查询商品主档 / 新增主档 SKU |
| `/api/v1/orgs/{org_id}/m0/cost-requests` | `GET` / `POST` | `m0:read` / `m0:cost:propose` | 成本申请列表 / 提交改价申请 |
| `/api/v1/orgs/{org_id}/m0/cost-requests/{id}/decide` | `POST` | `m0:cost:approve` | 主管审批/驳回改价（禁自批） |
| `/api/v1/orgs/{org_id}/m0/orders` | `GET` | `m0:read` | 查询订单台账（按 `is_mock` 与时间倒序） |
| `/api/v1/orgs/{org_id}/m0/orders/import-csv` | `POST` | `m0:cost:propose` | 订单 CSV 防重批量导入 |
| `/api/v1/orgs/{org_id}/m0/inventory` | `GET` | `m0:read` | 分仓库存台账查询 |
| `/api/v1/orgs/{org_id}/m0/inventory/stocktake` | `POST` | `m0:inventory:edit` | 人工盘点校准可售库存 |
| `/api/v1/orgs/{org_id}/m0/supplier-quotes` | `GET` | `m0:read` | 1688 模拟比价列表 |
| `contracts/product_catalog_contract.py` | 内部同步 | 只读契约 | 向 M7 供应脱敏 `ProductFactSnapshot` |

---

## 8. 非功能设计

### 8.1 性能指标（量化基准）

| 指标项 | 目标基准 | 说明 |
|---|---|---|
| 店铺 / 主档 / 库存列表查询 P95 | ≤ 100ms | 单组织 ≤ 5,000 SKU 规模下带索引查询 |
| 500 行订单 CSV 批量导入耗时 | ≤ 500ms | 含逐行校验、`order_id` 查重与批量写库 |
| 成本审批 / 人工盘点事务耗时 P95 | ≤ 80ms | 含同事务写 `core_audit_events` |

### 8.2 可靠性与容错指标

1. **订单幂等防重率 100%**：相同 `(org_id, order_id)` 重复导入绝不翻倍记账。
2. **部分失败隔离**：CSV 批量导入单行格式错误仅记入 `errors[]`，同批次其余合法行正常入库。
3. **测试隔离零泄漏**：`mock_buyer` 对所有 `/m0/*` 端点拦截率 100%；`is_mock=True` 订单与模拟报价永不混入实盘指标。

### 8.3 可扩展性指标

- **多平台扩展**：新增电商平台仅需在 `PlatformEnum` 与同步 Adapter 注册表中增加枚举和解析器，不改动核心订单/主档表结构。
- **多仓库扩展**：分仓库存以 `(org_id, warehouse_code, sku)` 联合唯一建模，天然支持任意数量海外仓/中转仓横向扩展。

---

## 9. 安全设计

### 9.1 岗位 RBAC 权限矩阵

见《需求说明书》第 2 节矩阵：涵盖 `m0:read`、`m0:shop:manage`（仅 `manager`）、`m0:cost:propose`（仅 `planner`）、`m0:cost:approve`（仅 `approver`）、`m0:inventory:edit`（仅 `warehouse`）。

### 9.2 安全防护与审计策略

1. **多租户隔离**：所有表按 `org_id` 强索引且在路由层校验 `X-Actor-Org-Id == org_id`，跨组织访问 100% 返回 `403`。
2. **职责分离强约束**：`cost-requests/{id}/decide` 严格执行 `proposer_id != actor.user_id`（`403 M7-4032`）。
3. **成本字段敏感屏蔽**：跨模块向 M7 输送商品事实时物理裁剪 `unit_cost_usd` 与 1688 供应商报价。
4. **CSV 注入与超长文本防护**：拦截超长字段与非法数值，字符串输入去除危险公式前缀并转义。
5. **全量不可篡改审计**：所有连店、加品、改价、导入、盘点均写入中文审计台账（`module="M0"`），前端无删除权限。

---

## 10. 运行环境与外部依赖（对齐 V1.1 老师数据库与中间件标准）

- **服务端环境**：Python 3.11+、FastAPI 0.115+、SQLAlchemy 2.0 Async + `asyncpg`、Alembic；**PostgreSQL 15+ 为正式主库**（本地单机无 Docker 测试态兼容 SQLite 3.40+）。
- **配套基础设施**：**Redis + Celery**（订单/同步批处理异步任务与汇率缓存）、**MinIO**（导入原始 CSV/附件归档对象存储），由根目录 `docker-compose.yml` 一键拉起。
- **前端环境**：Node.js 20+、Vue 3.4+、TypeScript 5+、Pinia 2+、Vite 5+；浏览器兼容 Chrome / Edge / Safari 最新两代主版本。
- **V1 外部依赖说明**：V1 阶段不依赖外网电商开放平台生产密钥，可纯离线闭环运行；V2 对接真实店铺时通过环境变量注入平台 OAuth AppKey/Secret。
