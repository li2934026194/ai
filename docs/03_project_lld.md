# CrossPilot AI 跨境电商智能协作平台 — 总详细设计说明书

> **文档定位**：本文档合并 M0–M8 全部数据库表结构、Alembic 迁移（`0001`~`0003`）、REST & WebSocket 接口契约、核心业务算法、安全守卫及前端 29 视图组件规范。M7 内容域底层类图/时序图另见 `docs/detailed-design.docx` 与 `docs/attachments/`。

---

## 第一篇 数据库迁移与核心契约总览

- **Alembic 迁移链**：
  1. `0001_init_m7.py`：M7 工作流注册表、生成任务、图文/媒体资产、合规规则、资质台账、合规检查、审批记录、不可篡改审计台账 `core_audit_events`。
  2. `0002_platform_m0_m8.py`：M8（`m8_users`、`m8_approval_policies`）、M0（店铺/商品/订单/库存/调价申请）、M4（选品候选池）、M1（FAQ/会话/消息/售后工单）、M5/M6（销量历史/预测运行/补货申请/采购单/告警事件）、M2/M3（广告活动/竞品监控）。
  3. `0003_v11_m1_att_m2_layout.py`：`m1_aftersales_attachments`（售后多附件）与 `m2_dashboard_layouts`（驾驶舱草稿/发布双态布局与乐观锁版本）。
- **全局响应信封**：所有 REST 接口统一返回 `{"code": "OK", "message": "成功", "data": ..., "trace_id": "req_..."}`；错误统一走 `M7Error` + `trace_id`。

---

## 第2篇 M8 组织权限、审批策略与平台底座详细设计

> **文档编号**：CP-M8-LLD-2026-V1.0
> **代码基线**：`backend/app/core/{auth_rbac,audit,errors,config,async_jobs,storage}.py`、`backend/app/modules/m8_org/{models,schemas,service,router}.py`、`frontend/src/views/m8/*.vue`

---

### 1. 需求追溯矩阵（RTM）

| 需求/原型编号 | 验收编号 | API / 底座接口 | 数据表 | 前端视图 |
|---|---|---|---|---|
| M8-1 员工名册 (`m8a`) | M8-AC-02, M8-AC-05 | `GET/POST /m8/users`, `PATCH /m8/users/{id}` | `m8_users` | `M8UsersView.vue` |
| M8-2 矩阵与策略 (`m8b`) | M8-AC-01 | `GET /m8/roles`, `GET /m8/policies`, `POST .../toggle` | `m8_approval_policies` | `M8RolesView.vue` |
| M8-2 全平台审计 (`m8b`) | M8-AC-02, M8-AC-06 | `GET /m8/audits?module=...&limit=...` | `core_audit_events` | `M8RolesView.vue` |
| 底座鉴权与拦截 | M8-AC-03, M8-AC-04 | `get_actor_context`, `require_perm`, `write_audit_event` | `core_audit_events` | `M7Sidebar.vue` |

---

### 2. 数据库物理表结构设计（PostgreSQL 15+ + Redis + Celery + MinIO）

> **全平台底座基础设施规范**：
> - **PostgreSQL 15+ (`asyncpg`)**：Alembic 迁移（`0001_init_m7.py` + `0002_platform_m0_m8.py`）全量兼容 PostgreSQL `JSONB`、`TIMESTAMPTZ`、布尔标准 `TRUE/FALSE` 默认值及局部唯一索引（`WHERE deleted_at IS NULL`）。
> - **Redis + Celery (`core/cache_queue.py`)**：缓存 Key `cp:{org_id}:m7:rules`（TTL 300s，规则变更即时 `delete_prefix` 广播清除）；Celery Broker/Backend 承载异步任务。
> - **MinIO (`core/storage.py`)**：统一对象存储 Bucket `crosspilot-assets`，支持自动建桶与本地磁盘无容器回退。
> - **健康探针（`GET /healthz`）**：实时返回 `database_dialect`、`storage_backend`、`redis_status`、`milvus_status`。

#### 2.1 `m8_orgs`（组织租户表）& `m8_users`（员工名册表）

- **`m8_orgs`**：`org_id` (VARCHAR(64) PK), `name` (VARCHAR(128)), `region` (VARCHAR(32), 默认 `'CN-SZ'`), `created_at` (TIMESTAMPTZ)。
- **`m8_users`**：

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `user_id` | `VARCHAR(64)` | PK | — | 组织内员工工号 |
| `org_id` | `VARCHAR(64)` | NOT NULL, INDEX | — | 所属组织 ID |
| `display_name` | `VARCHAR(128)` | NOT NULL | — | 员工姓名 |
| `role_code` | `VARCHAR(32)` | NOT NULL | — | 9 大标准岗位编码 |
| `email` | `VARCHAR(128)` | NOT NULL | `''` | 联系邮箱 |
| `is_active` | `BOOLEAN` | NOT NULL | `TRUE` | 账号是否启用 |
| `password_hash` *(V1.1)* | `VARCHAR(255)` | NULLABLE | `NULL` | 真实密码哈希（PBKDF2/bcrypt） |
| `allowed_shop_ids` *(V1.1)* | `JSONB` | NOT NULL | `[]` | 允许访问店铺白名单（空代表全店） |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 入册时间 |

#### 2.2 `m8_approval_policies`（审批策略表）& `core_audit_events`（审计表）

- **`m8_approval_policies`**：`policy_id` (PK), `org_id` (INDEX), `module_code` (`M0`/`M1`/`M4`/`M6`/`M7`), `policy_name`, `rule_summary`, `approver_role`, `enforce_sod` (`BOOLEAN`, 默认 `TRUE`), `is_enabled` (`BOOLEAN`, 默认 `TRUE`)。
- **`core_audit_events`**：`event_id` (PK), `org_id` (INDEX), `module` (INDEX), `action`, `actor_user_id`, `actor_role`, `sku` (NULLABLE), `result_status` (`ALLOWED`/`DENIED`), `sentence_zh` (`TEXT`), `trace_id`, `created_at` (INDEX)。

---

### 3. 权限代码字典与鉴权逻辑（`core/auth_rbac.py`）

```python
ROLE_PERMISSIONS = {
    "approver":   {"m0:read","m0:cost:approve","m1:read","m1:aftersales:approve","m2:read","m3:read","m4:read","m4:approve","m5:read","m6:read","m6:approve","m7:content:read","m7:content:edit","m7:compliance:run","m7:rule:maintain","m7:publish:approve","m7:package:export","m8:read","m8:manage"},
    "creator":    {"m0:read","m1:read","m7:content:read","m7:content:edit","m7:compliance:run","m7:package:export"},
    "manager":    {"m0:read","m0:shop:manage","m1:read","m2:read","m3:read","m4:read","m5:read","m6:read","m7:content:read","m8:read","m8:manage"},
    "planner":    {"m0:read","m0:cost:propose","m1:read","m1:faq:edit","m2:read","m2:edit","m3:read","m4:read","m5:read","m5:run","m6:read","m6:draft","m7:content:read"},
    "selector":   {"m0:read","m4:read","m4:edit","m5:read","m7:content:read"},
    "bi_analyst": {"m0:read","m2:read","m2:edit","m3:read","m3:edit","m3:ask","m4:read","m5:read","m5:review"},
    "warehouse":  {"m0:read","m0:inventory:edit","m5:read","m6:read","m6:receive"},
    "cs":         {"m0:read","m1:read","m1:session:edit","m1:aftersales:submit","m1:simulator:run"},
    "mock_buyer": {"m1:simulator:run"},
}
```

- **脱敏规则（`core/audit.py`）**：正则替换 `sk-[A-Za-z0-9_-]{8,}` 与 `Bearer\s+[A-Za-z0-9._-]+` 为 `***REDACTED***`。

---

### 4. REST API 完整契约

统一路径前缀：`/api/v1/orgs/{org_id}/m8`

| 端点 | 方法 | 权限码 | 请求 Schema | 错误码 & 审计 |
|---|---|---|---|---|
| `/users` | `GET` / `POST` | `m8:read` / `m8:manage` | `UserCreateReq` | `409 M7-4091`, `422`, 记 `USER_CREATED` |
| `/users/{user_id}` | `PATCH` | `m8:manage` | `UserUpdateReq` | `404 M7-4041`, `422`, 记 `USER_UPDATED` |
| `/roles` | `GET` | `m8:read` | — | `403 M7-4031` |
| `/policies` | `GET` | `m8:read` | — | `403 M7-4031` |
| `/policies/{id}/toggle` | `POST` | `m8:manage` | `PolicyToggleReq` | `404 M7-4041`, 记 `POLICY_TOGGLED` |
| `/audits` | `GET` | `m8:read` | Query `module`, `limit` | `403 M7-4031` |

##### 请求/响应 JSON Payload 示例

```json
// POST /api/v1/orgs/org_demo/m8/users
{ "user_id": "usr_qa_01", "display_name": "孙质检", "role_code": "warehouse", "email": "qa01@crosspilot.ai" }
// Response 200
{ "ok": true, "data": { "user_id": "usr_qa_01", "role_code": "warehouse", "is_active": true }, "error": null, "trace_id": "tr_m8_01" }
```

---

### 5. 前端视图组件规范（`frontend/src/views/m8/`）

- **`M8UsersView.vue`**：员工名册表（支持即时调岗下拉 + 停用/启用按钮）与新增授权表单；非 `m8:manage` 权限提示只读边界。
- **`M8RolesView.vue`**：9 岗位只读矩阵表 + 5 大审批流策略开关表 + 模块筛选审计台账表（`ALLOWED` 绿标 / `DENIED` 红标）。
- **`M7Sidebar.vue` & Pinia `auth` Store**：管理当前组织、角色上下文并在切换角色时自动触发当前页面重算刷新。

---

### 6. 容器编排、Celery Worker 与 E2E 测试规范

- **Docker Compose 分层 Profiles（`docker-compose.yml`）**：
  - 核心层（默认启动）：`postgres`（16-alpine）、`redis`（7-alpine）、`minio` + `minio-init`（自动创建 `crosspilot-assets`）。
  - `--profile worker`：`celery-worker` 与 `celery-beat`（加载 `app.core.cache_queue` 注册的 `crosspilot.index_m1_vectors` 与 `crosspilot.health_ping` 任务）。
  - `--profile vector`：`etcd` + `milvus:v2.4.15`；`--profile app`：`backend` + `frontend`（Nginx 含 WebSocket 反代）。
- **CI/CD & Playwright**：`Jenkinsfile` 与 `deploy/deploy.sh` 固化标准发布流水线；`frontend/playwright.config.ts` 与 `frontend/e2e/crosspilot.spec.ts` 覆盖真实浏览器登录、经营工作台及 `/docs` 中心验收。

---

## 第3篇 M0 店铺接入、商品主档与仓储盘点详细设计

> **文档编号**：CP-M0-LLD-2026-V1.0
> **代码基线**：`backend/app/modules/m0_catalog/{models,schemas,service,router}.py`、`backend/app/contracts/product_catalog_contract.py`、`frontend/src/views/m0/*.vue`

---

### 1. 需求追溯矩阵（RTM）

| 需求/原型编号 | 验收编号 | API / 契约接口 | 数据表 | 前端视图 |
|---|---|---|---|---|
| M0-1 店铺授权 (`m0a`) | M0-AC-01, M0-AC-06 | `GET /m0/shops`, `POST /m0/shops` | `m0_shops` | `M0ShopsView.vue` |
| M0-2 主档维护 (`m0b`) | M0-AC-03 | `GET /m0/products`, `POST /m0/products` | `m0_products` | `M0LedgerView.vue` |
| M0-2 成本审批 (`m0b`) | M0-AC-03 | `GET/POST /m0/cost-requests`, `POST .../decide` | `m0_cost_requests`, `m0_products` | `M0LedgerView.vue` |
| M0-2 订单与 CSV (`m0b`) | M0-AC-01, M0-AC-02 | `GET /m0/orders`, `POST /m0/orders/import-csv` | `m0_orders` | `M0LedgerView.vue` |
| M0-2 1688 比价 (`m0b`) | M0-AC-01 | `GET /m0/supplier-quotes` | `m0_supplier_quotes` | `M0LedgerView.vue` |
| M0-3 分仓盘点 (`m0c`) | M0-AC-04, M0-AC-05 | `GET /m0/inventory`, `POST /m0/inventory/stocktake` | `m0_inventory` | `M0InventoryView.vue` |
| 跨模块 M7 供数 | M0-AC-04 | `ProductCatalogContract` | `m0_products` | `M7CopyView.vue` |

---

### 2. 数据库物理表结构设计（PostgreSQL 15+ 标准方言）

> **存储引擎与跨库规范**：生产与标准测试环境采用 **PostgreSQL 15+ (`SQLAlchemy 2.0 Async + asyncpg`)**，统一使用 `TIMESTAMPTZ` 与 `org_id` 租户索引；批量 CSV 导入原件及同步日志通过 `core/storage.py` 归档至 **MinIO (`crosspilot-assets`)**；汇率/批处理状态按需使用 **Redis** 缓存（本地无中间件环境兼容 SQLite 3.40+ 与本地目录存储）。

#### 2.1 `m0_shops`（店铺授权表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `shop_id` | `VARCHAR(64)` | PK | — | 主键 `shop_<hex10>` |
| `org_id` | `VARCHAR(64)` | NOT NULL, INDEX | — | 租户 ID |
| `shop_code` | `VARCHAR(64)` | NOT NULL, UQ(`org_id`,`shop_code`) | — | 组织内唯一店铺编码 |
| `name` | `VARCHAR(128)` | NOT NULL | — | 店铺显示名称 |
| `platform` | `VARCHAR(32)` | NOT NULL | `'amazon_us'` | `amazon_us`/`tiktok_us`/`shopee_th`/`lazada`/`ebay` |
| `currency` | `VARCHAR(16)` | NOT NULL | `'USD'` | 结算币种 |
| `status` | `VARCHAR(24)` | NOT NULL | `'CONNECTED'` | `CONNECTED`/`EXPIRING`/`EXPIRED`/`DISCONNECTED` |
| `is_mock` | `BOOLEAN` | NOT NULL | `FALSE` | 演示隔离标识 |
| `last_sync_at` | `TIMESTAMPTZ` | NULLABLE | `NULL` | 最近同步时间 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 接入时间 |

#### 2.2 `m0_products`（统一商品主档表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `product_id` | `VARCHAR(64)` | PK | — | 主键 `prd_<hex10>` |
| `org_id` | `VARCHAR(64)` | NOT NULL, INDEX | — | 租户 ID |
| `sku` | `VARCHAR(64)` | NOT NULL, INDEX, UQ(`org_id`,`sku`) | — | 内部统一 SKU |
| `name` / `category_cn` | `VARCHAR(255/64)` | NOT NULL | — | 商品名称与中文类目 |
| `brand` / `default_site` | `VARCHAR(64/32)` | NOT NULL | `'CrossPilot'` / `'Amazon US'` | 品牌与默认站点 |
| `sale_price_usd` / `list_price_usd` | `FLOAT` | `sale_price_usd > 0` | — | 现售价与划线价（USD） |
| `unit_cost_usd` | `FLOAT` | `>= 0` | `0.0` | 当前核算采购成本（USD） |
| `moq` / `pack_size` / `lead_time_days` | `INTEGER` | `>= 1` | `50` / `20` / `14` | 最小起订量、整箱装箱数、常规交期 |
| `origin` | `VARCHAR(32)` | NOT NULL | `'IN_STORE_REFRESH'` | `M4_APPROVED` / `IN_STORE_REFRESH` |
| `spec_json` | `JSONB` | NOT NULL | `{}` | 规格参数键值（供 M7 事实锁定） |
| `updated_at` | `TIMESTAMPTZ` | AUTO | `now()` | 最近更新时间 |

#### 2.3 `m0_cost_requests`（成本变更审批单表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `request_id` | `VARCHAR(64)` | PK | — | 主键 `cost_<hex10>` |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 租户与目标 SKU |
| `old_cost_usd` / `new_cost_usd` | `FLOAT` | NOT NULL (`>=0`) | — | 原成本快照与拟变更成本 |
| `reason` | `TEXT` | NOT NULL | — | 调价业务说明（`>=2`字） |
| `status` | `VARCHAR(24)` | NOT NULL | `'PENDING'` | `PENDING` / `APPROVED` / `REJECTED` |
| `proposer_id` / `reviewer_id` | `VARCHAR(64)` | NOT NULL / NULLABLE | — | 申请人与审批人（严格禁止相等） |
| `decision_note` | `TEXT` | NULLABLE | `NULL` | 审批批复意见 |
| `created_at` / `decided_at` | `TIMESTAMPTZ` | — | `now()` / `NULL` | 申请与批复时间戳 |

#### 2.4 `m0_orders`、`m0_inventory` 与 `m0_supplier_quotes`

- **`m0_orders`**：`id` (PK), `org_id`, `order_id` (UQ with `org_id`), `shop_id`, `sku`, `order_date` (`DATE`), `qty` (`INTEGER > 0`), `revenue_usd` (`FLOAT >= 0`), `is_mock` (`BOOLEAN`), `status` (`SETTLED`/`SHIPPED`/`REFUNDED`)。
- **`m0_inventory`**：`inv_id` (PK), `org_id`, `warehouse_code`, `sku` (UQ with `org_id, warehouse_code`), `on_hand` (`INTEGER >= 0`), `in_transit` (`INTEGER >= 0`), `reserved` (`INTEGER >= 0`), `last_stocktake_by`, `updated_at`。
- **`m0_supplier_quotes`**：`quote_id` (PK), `org_id`, `sku`, `supplier_name`, `unit_price_rmb`, `moq`, `lead_days`, `is_simulated` (`BOOLEAN`, 默认 `TRUE`)。

---

### 3. 核心状态流转与错误码字典

#### 3.1 成本变更审批状态机

```
[planner 提交改价] --> (PENDING: 快照 old_cost_usd, 锁定 proposer_id)
                           |
         +-----------------+-----------------+
         | approver 审批 (proposer != actor) |
         v                                   v
    [APPROVED]                          [REJECTED]
(事务更新 M0Product.unit_cost_usd)     (主档价格保持原样)
```

#### 3.2 统一异常错误码字典

| HTTP 状态 | 业务错误码 | 触发场景 | 前端响应策略 |
|---|---|---|---|
| `401` | `M7-4011` | 缺失有效登录身份或组织上下文头 | 跳转角色确认提示并阻断操作 |
| `403` | `M7-4031` | 岗位缺乏对应 RBAC 权限码或跨租户访问 | 提示当前岗位权限边界，禁用写操作按钮 |
| `403` | `M7-4032` | `cost-requests/{id}/decide` 申请人试图自批 | 明确提示「违反职责分离：发起人禁止自批」 |
| `404` | `M7-4041` | 操作不存在的 `sku` 或 `request_id` | 提示刷新台账确认记录是否存在 |
| `409` | `M7-4091` | 重复 `shop_code` 或重复 `sku`；非 `PENDING` 单重复审批 | 提示编码冲突或该申请已被处理 |
| `422` | `M7-4221` | `sale_price_usd <= 0`、`unit_cost_usd < 0` 或 CSV 格式非法 | 保留用户输入并定位报错字段 |

---

### 4. REST API 完整契约与审计模板

统一路径前缀：`/api/v1/orgs/{org_id}/m0`

| 端点 | 方法 | 权限码 | 请求 Schema | 审计 `action_code` & 中文日志模板 |
|---|---|---|---|---|
| `/shops` | `GET` / `POST` | `m0:read` / `m0:shop:manage` | `ShopCreateReq` | `SHOP_CONNECTED`: `连接店铺 {shop_code}（{platform}，MOCK={is_mock}）` |
| `/products` | `GET` / `POST` | `m0:read` / `m0:cost:propose` | `ProductCreateReq` | `PRODUCT_CREATED`: `创建商品主档 {sku}，售价 ${sale_price_usd}` |
| `/cost-requests` | `POST` | `m0:cost:propose` | `CostProposeReq` | `COST_PROPOSED`: `申请修改 {sku} 成本：${old} -> ${new}` |
| `/cost-requests/{id}/decide` | `POST` | `m0:cost:approve` | `CostDecideReq` | `COST_DECIDED`: `审批 {sku} 成本变更（{decision}）` |
| `/orders/import-csv` | `POST` | `m0:cost:propose` | `CsvOrderImportReq` | `ORDERS_CSV_IMPORTED`: `CSV 导入 {imported} 单，跳过重复 {skipped} 单` |
| `/inventory/stocktake` | `POST` | `m0:inventory:edit` | `StocktakeReq` | `INVENTORY_STOCKTAKE`: `人工盘点 {wh}/{sku}：在库由 {old} 校准为 {new}` |

##### 请求/响应 JSON Payload 示例

```json
// POST /api/v1/orgs/org_demo/m0/orders/import-csv
{
  "csv_text": "order_id,shop_id,sku,order_date,qty,revenue_usd,is_mock,status\nORD-2026-01,shop_amz_us,SKU-00704,2026-11-18,2,79.98,false,SETTLED"
}
// Response 200
{
  "ok": true,
  "data": { "imported": 1, "skipped_duplicates": 0, "errors": [] },
  "error": null,
  "trace_id": "tr_m0_csv_01"
}
```

```json
// POST /api/v1/orgs/org_demo/m0/cost-requests/cost_01/decide (SoD 自批拦截 Response 403)
{
  "ok": false,
  "data": null,
  "error": { "code": "M7-4032", "message": "违反职责分离：成本修改申请人禁止自批" },
  "trace_id": "tr_m0_sod_01"
}
```

---

### 5. 前端架构与视图交互设计（`frontend/src/views/m0/`）

1. **`M0ShopsView.vue`**：顶部四格巡检卡（总数/实盘/演示/异常）；演示店铺显式渲染红色 `MOCK 不计营收` 徽章；新增表单支持 `platform`/`currency`/`is_mock` 校验。
2. **`M0LedgerView.vue`**：分段选项卡或分块展示「主档列表 + 新增 SKU」「成本变更审批区」「订单台账 + CSV 粘贴/本地文件上传（V1.1 补前 10 行预览与测试文件名检测）」「1688 模拟比价表」。
3. **`M0InventoryView.vue`**：按仓库/SKU 表格展示 `on_hand`（`<30` 红字告警）、`in_transit`、`reserved` 口径说明条及盘点直通表单；非 `warehouse` 岗位只读提示 `403` 权限边界。
4. **防重提交与错误降级**：所有提交按钮绑定 `submitting` 状态锁，后端非 `200` 统一解析 `error.message` 在页面横幅展示，不静默吞错。

---

## 第4篇 M4 智能选品与过会决策详细设计

> **文档编号**：CP-M4-LLD-2026-V1.0
> **代码基线**：`backend/app/modules/m4_selection/{models,schemas,service,router}.py`、`frontend/src/views/m4/*.vue`

---

### 1. 需求追溯矩阵（RTM）

| 需求/原型编号 | 验收编号 | API 接口 | 数据表 | 前端视图 |
|---|---|---|---|---|
| M4-1 候选导入 (`m4a`) | M4-AC-01, M4-AC-06 | `GET /m4/candidates`, `POST /m4/candidates` | `m4_candidates` | `M4ImportView.vue` |
| M4-2 选品工作台 (`m4b`) | M4-AC-01, M4-AC-02 | `POST /m4/candidates/{id}/evaluate` | `m4_candidates` | `M4WorkbenchView.vue` |
| M4-3 测款终审 (`m4c`) | M4-AC-03, M4-AC-04, M4-AC-05 | `POST /m4/candidates/{id}/decide` | `m4_candidates`, `m0_products` | `M4ApprovalView.vue` |

---

### 2. 数据库物理表结构设计（PostgreSQL 15+ 标准方言）

> **存储规范**：基于 **PostgreSQL 15+ (`JSONB`, `TIMESTAMPTZ`, `asyncpg`)**，选品五维评分存为原生 `JSONB`，过会批准写 `m4_candidates` 与 `m0_products` 在同一事务中提交；批量导入 CSV 原件通过 `FileStorage` 存入 **MinIO**，大批量导入按需由 **Redis + Celery** 异步调度。

#### 2.1 `m4_candidates`（选品候选评估表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `candidate_id` | `VARCHAR(64)` | PK | — | 主键 `cand_<hex10>` |
| `org_id` | `VARCHAR(64)` | NOT NULL, INDEX | — | 租户 ID |
| `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 建议商品编码（自动转大写） |
| `title` / `category_cn` | `VARCHAR(255/64)` | NOT NULL | — | 商品标题与中文类目 |
| `source_channel` | `VARCHAR(64)` | NOT NULL | `'1688 工厂直采'` | 货源渠道与性质来源 |
| `target_price_usd` | `FLOAT` | NOT NULL (`>0`) | — | 目标站售价（USD） |
| `est_cost_rmb` / `est_shipping_rmb` | `FLOAT` | NOT NULL (`>0` / `>=0`) | — | 预估采购成本与头程（RMB） |
| `est_margin_pct` | `FLOAT` | NOT NULL | `0.0` | 扣除 15% 佣金与采购/头程后净毛利率（%） |
| `scores_json` | `JSONB` | NOT NULL | `{...}` | 五维评分字典 (`demand`/`competition`/`margin`/`supply`/`compliance`) |
| `total_score` | `FLOAT` | NOT NULL | `0.0` | 五维加权综合分 |
| `status` | `VARCHAR(32)` | NOT NULL | `'DISCOVERED'` | `DISCOVERED`/`EVALUATING`/`PENDING_APPROVAL`/`APPROVED`/`REJECTED` |
| `operator_note` | `TEXT` | NOT NULL | `''` | 选品调研推荐理由与备注 |
| `submitter_id` / `approver_id` | `VARCHAR(64)` | NULLABLE | `NULL` | 送审人 ID 与审批人 ID（禁相等） |
| `decision_reason` | `TEXT` | NULLABLE | `NULL` | 终审通过/驳回评语 |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | — | `now()` | 创建与更新时间 |

---

### 3. 核心算法、状态机与错误码

#### 3.1 利润与加权评分算子

```python
def compute_margin_pct(target_price_usd: float, est_cost_rmb: float, est_shipping_rmb: float) -> float:
    fx = 7.2
    total_cost_usd = (est_cost_rmb + est_shipping_rmb) / fx
    platform_fee = target_price_usd * 0.15
    net = target_price_usd - total_cost_usd - platform_fee
    return round((net / target_price_usd) * 100.0, 2) if target_price_usd > 0 else 0.0

def compute_total_score(scores: dict[str, float]) -> float:
    w = {"demand": 0.25, "competition": 0.20, "margin": 0.25, "supply": 0.15, "compliance": 0.15}
    return round(sum(float(scores.get(k, 75)) * wt for k, wt in w.items()), 1)
```

#### 3.2 状态机跃迁与错误码

```
[导入] --> DISCOVERED --(保存评估)--> EVALUATING --(提交审批)--> PENDING_APPROVAL
                                                                     |
                                           +-------------------------+-------------------------+
                                           | approver 终审 (submitter != actor)                |
                                           v                                                   v
                                        APPROVED                                            REJECTED
                              (同事务写/升级 M0Product)                                 (不写入 M0 主档)
```

| HTTP 状态 | 错误码 | 触发场景 |
|---|---|---|
| `403` | `M7-4031` | 非 `selector` 调 `/evaluate`、非 `approver` 调 `/decide` 或跨租户访问 |
| `403` | `M7-4032` | `submitter_id == actor.user_id` 试图自批过会 |
| `404` | `M7-4041` | 操作不存在的 `candidate_id` |
| `422` | `M7-4221` | `target_price_usd <= 0`、`est_cost_rmb <= 0`、五维评分越界（`<0` 或 `>100`）、审批意见少于 2 字 |

---

### 4. REST API 完整契约与审计模板

统一前缀：`/api/v1/orgs/{org_id}/m4`

| 端点 | 方法 | 权限码 | 请求 Schema | 审计 `action_code` & 中文日志 |
|---|---|---|---|---|
| `/candidates` | `GET` | `m4:read` | — | 按 `updated_at DESC` 返回全部候选 |
| `/candidates` | `POST` | `m4:edit` | `CandidateImportReq` | `CANDIDATE_IMPORTED`: `导入选品候选 {sku}，初算毛利 {margin}%` |
| `/candidates/{id}/evaluate` | `POST` | `m4:edit` | `CandidateEvaluateReq` | `CANDIDATE_EVALUATED`: `评估 {sku}（总分 {score}，毛利 {margin}%，提交={submit}）` |
| `/candidates/{id}/decide` | `POST` | `m4:approve` | `CandidateDecisionReq` | `CANDIDATE_DECIDED`: `终审 {sku}（{decision}）：{note}` |

##### `POST /candidates/{id}/decide` Payload 示例

```json
// Request
{ "decision": "APPROVED", "note": "毛利率达标且无商标冲突，同意小批测款并转 M0 主档" }
// Response 200
{ "ok": true, "data": { "candidate_id": "cand_9a8b", "sku": "SKU-NEW-01", "status": "APPROVED", "m0_synced": true }, "error": null, "trace_id": "tr_m4_01" }
```

---

### 5. 前端视图组件规范（`frontend/src/views/m4/`）

- **`M4ImportView.vue`**：单品导入表单，录入即时预览预估净毛利率，导入后支持直达 `/m4/workbench`。
- **`M4WorkbenchView.vue`**：左列候选清单（状态徽章 + 毛利率）+ 右列成本/五维评分滑块与双按钮（「保存评估」/「保存并提交审批」）。
- **`M4ApprovalView.vue`**：展示待审与已决队列，提交人视图禁用审批并提示 SoD；`approver` 填写理由一键同意/驳回，同意后出现「前往 M7-1 开始内容制作 →」引导链接。

---

### 6. M4 异步 CSV 导入详细设计（`202 Accepted`）

- **`POST /api/v1/orgs/{org_id}/m4/candidates/import-csv-async`**：
  1. 校验 UTF-8 字节长度 ≤ `25 * 1024 * 1024`（25 MB，超限直接返回 `422 M7-4221`）。
  2. 写入 `m7_generation_jobs` 任务记录（`job_type="m4_csv_import"`、`status="QUEUED"`），通过 `spawn_background_job` 派发独立 `AsyncSession` 执行去重与三态分流导入。
  3. 立即返回 **HTTP `202 Accepted`** 及 `{ "job_id": "m4job_...", "status": "QUEUED" }`。
- **`GET /api/v1/orgs/{org_id}/m4/jobs/{job_id}`**：按 `org_id + job_id` 隔离查询当前任务状态（`QUEUED/RUNNING/SUCCEEDED/FAILED`）、`progress` 及导入结果统计 `result`。

---

## 第5篇 M1 客服导购、咨询模拟与售后闭环详细设计

> **文档编号**：CP-M1-LLD-2026-V1.0
> **代码基线**：`backend/app/modules/m1_cs/{models,schemas,service,router}.py`、`backend/app/contracts/voice_faq_contract.py`、`frontend/src/views/m1/*.vue`

---

### 1. 需求追溯矩阵（RTM）

| 需求/原型编号 | 验收编号 | API 接口 | 数据表 | 前端视图 |
|---|---|---|---|---|
| M1-1 会话与建单 (`m1a`) | M1-AC-03, M1-AC-05 | `GET /m1/sessions`, `POST /m1/sessions/{id}/reply`, `POST /m1/aftersales` | `m1_cs_sessions`, `m1_aftersales_tickets` | `M1SessionsView.vue` |
| M1-2 导购 FAQ (`m1b`) | M1-AC-01 | `GET /m1/faqs`, `POST /m1/faqs` | `m1_faq_entries` | `M1FaqsView.vue` |
| M1-4 买家模拟器 (`m1d`) | M1-AC-02 | `POST /m1/simulator/ask` | `m1_cs_sessions`, `m1_faq_entries` | `M1SimulatorView.vue` |
| M1-3 售后退款审批 (`m1c`) | M1-AC-03, M1-AC-04 | `GET /m1/aftersales`, `POST /m1/aftersales/{id}/decide` | `m1_aftersales_tickets` | `M1AftersalesView.vue` |

---

### 2. 数据库物理表结构设计（PostgreSQL 15+ + Milvus + MinIO）

> **存储分工（严格对齐 V1.1 老师技术栈标准）**：结构化业务事实（FAQ、会话、售后工单）全量落 **PostgreSQL 15+ (`JSONB`, `TIMESTAMPTZ`, `asyncpg`)** 作为唯一最终真源；导购商品推荐向量索引使用 **Milvus (`crosspilot_m1_products`)**；售后凭证附件与截图归档至 **MinIO (`crosspilot-assets`)**。

#### 2.1 `m1_faq_entries`（SKU 导购痛点与 FAQ 表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `faq_id` | `VARCHAR(64)` | PK | — | 主键 `faq_<hex10>` |
| `org_id` | `VARCHAR(64)` | NOT NULL, INDEX, UQ(`org_id`,`sku`) | — | 租户 ID |
| `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 关联商品 SKU |
| `pain_points_json` | `JSONB` | NOT NULL | `[]` | 买家痛点列表 |
| `faq_pairs_json` | `JSONB` | NOT NULL | `[]` | `[{"q":"...","a":"..."}]` 问答对列表 |
| `updated_at` | `TIMESTAMPTZ` | AUTO | `now()` | 更新时间 |

#### 2.2 `m1_cs_sessions`（客服与模拟会话表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `session_id` | `VARCHAR(64)` | PK | — | 会话 ID `cs_<hex10>` |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 租户与商品 SKU |
| `buyer_name` / `channel` | `VARCHAR(64/32)` | NOT NULL | — | 买家名与渠道（模拟固定标 `Buyer Simulator (MOCK)`） |
| `question` / `reply` | `TEXT` | NOT NULL | `''` | 买家原问与客服/AI 建议回复 |
| `is_mock` | `BOOLEAN` | NOT NULL | `TRUE` | 强演示隔离标记 |
| `status` | `VARCHAR(24)` | NOT NULL | `'OPEN'` | `OPEN` / `REPLIED` |
| `handler_id` | `VARCHAR(64)` | NULLABLE | `NULL` | 接管回复人 ID |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `now()` | — | 进线时间 |

#### 2.3 `m1_aftersales_tickets`（售后赔付审批表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `ticket_id` | `VARCHAR(64)` | PK | — | 工单 ID `tkt_<hex10>` |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 租户与 SKU |
| `order_ref` / `platform` | `VARCHAR(64/32)` | NOT NULL | `'Amazon US'` | 关联订单号与销售平台 |
| `issue_type` | `VARCHAR(64)` | NOT NULL | — | 售后问题分类 |
| `refund_usd` | `FLOAT` | NOT NULL (`>=0`) | `0.0` | 申请退款金额（USD） |
| `evidence_note` | `TEXT` | NOT NULL | `''` | 客服核验凭证说明 |
| `status` | `VARCHAR(24)` | NOT NULL | `'PENDING_APPROVAL'` | `PENDING_APPROVAL` / `APPROVED` / `REJECTED` |
| `submitter_id` / `approver_id` | `VARCHAR(64)` | NOT NULL / NULLABLE | — | 提交人与审批人（严格禁止相等） |
| `decision_note` | `TEXT` | NULLABLE | `NULL` | 主管审批意见 |

---

#### 2.4 Milvus 向量集合与 MinIO 对象键设计（`vector_store.py` / `storage.py`）

- **Milvus Collection**：`crosspilot_m1_products`（`COSINE` 相似度，64 维归一化向量，标量字段 `org_id`, `sku`, `seq`）。
- **20 件批量索引流程**：`upsert_faq` / 批量导入调用 `milvus_adapter.index_products_batch_20()`，每 20 条一批校验向量维度与条数后 `upsert` 进 Milvus；检索时先按 `org_id` 标量过滤召回 Top-3 SKU，再回表 PostgreSQL 复核 `M0Product` 与 `M1FaqEntry` 实时状态；未启用 Milvus profile 时安全降级为主库停用词+CJK双字匹配。
- **MinIO 对象路径**：`orgs/{org_id}/m1/aftersales/{ticket_id}/{filename}`（Magic MIME 白名单校验）。

### 3. 状态流转与异常错误码

#### 3.1 售后工单状态机

```
[cs 提交售后单] --> PENDING_APPROVAL (锁定 submitter_id, refund_usd)
                           |
         +-----------------+-----------------+
         | approver 决策 (submitter != actor)|
         v                                   v
     APPROVED                            REJECTED
(实时扣减 M2 净利润)                 (不发生利润扣减)
```

#### 3.2 错误码字典

| HTTP 状态 | 错误码 | 触发场景 |
|---|---|---|
| `403` | `M7-4031` | `mock_buyer` 访问真实会话/工单，或非授权角色修改 FAQ/回复/审批 |
| `403` | `M7-4032` | `submitter_id == actor.user_id` 试图自批售后退款 |
| `404` | `M7-4041` | 回复不存在的 `session_id` 或审批不存在的 `ticket_id` |
| `422` | `M7-4221` | `refund_usd < 0`、`question` 少于 2 字、非法审批枚举 |

---

### 4. REST API 完整契约与示例

统一前缀：`/api/v1/orgs/{org_id}/m1`

| 端点 | 方法 | 权限码 | 请求 Schema | 审计 `action_code` |
|---|---|---|---|---|
| `/faqs` | `GET` / `POST` | `m1:read` / `m1:faq:edit` | `FaqUpsertReq` | `FAQ_UPDATED` |
| `/sessions` | `GET` | `m1:read` | — | — |
| `/sessions/{session_id}/reply` | `POST` | `m1:session:edit` | `SessionReplyReq` | `SESSION_REPLIED` |
| `/simulator/ask` | `POST` | `m1:simulator:run` | `SimulatorMsgReq` | `BUYER_SIMULATED` |
| `/aftersales` | `GET` / `POST` | `m1:read` / `m1:aftersales:submit` | `AftersalesCreateReq` | `AFTERSALES_SUBMITTED` |
| `/aftersales/{ticket_id}/decide` | `POST` | `m1:aftersales:approve` | `AftersalesDecisionReq` | `AFTERSALES_DECIDED` |

##### `POST /simulator/ask` & `POST /aftersales/{ticket_id}/decide` Payload 示例

```json
// POST /m1/simulator/ask
{ "sku": "SKU-00704", "question": "Does it support 110V?" }
// Response 200
{ "ok": true, "data": { "session_id": "cs_8a1b2c3d4e", "suggested_reply": "【知识库命中】..." }, "error": null, "trace_id": "tr_m1_01" }
```

```json
// POST /m1/aftersales/tkt_123/decide (SoD 自批拦截 Response 403)
{ "ok": false, "data": null, "error": { "code": "M7-4032", "message": "违反职责分离：客服建单人禁止自批售后退款" }, "trace_id": "tr_m1_02" }
```

---

### 5. 前端视图组件规范（`frontend/src/views/m1/`）

- `M1SessionsView.vue`：左列展示会话队列（`MOCK` 红色标）与快捷回复框；右列嵌售后退款建单表单。
- `M1FaqsView.vue`：支持选定 SKU、换行维护多条痛点、动态增删 Q&A 对并一键保存同步。
- `M1SimulatorView.vue`：页首明示「MOCK 安全沙盒，绝不外发真实平台」，实时回显知识库命中回复及跳往会话台。
- `M1AftersalesView.vue`：待审批工单与已审批历史分组展示，提供审批意见输入与通过/驳回按钮。

---

### 6. V1.1 实时推送与售后多附件详细接口

- **`WS /api/v1/orgs/{org_id}/m1/ws/{session_id}`**：由 `M1EventHub` 管理按 `org_id:session_id` 隔离的房间连接，支持 `ping -> {"type":"pong"}` 心跳保活，并在 `reply_session` / `simulate_inquiry` 落库后广播实时事件；Nginx 侧配置 `proxy_http_version 1.1` 与 `Upgrade` 升级头。
- **`POST /api/v1/orgs/{org_id}/m1/aftersales/{ticket_id}/attachments`**：接收 `multipart/form-data`（`files: list[UploadFile]`），校验文件扩展名（`.pdf/.jpg/.jpeg/.png/.docx/.txt`）、单件 ≤5MB、累计 ≤10 件并写入 `m1_aftersales_attachments` 表与 `FileStorage`。
- **`GET /api/v1/orgs/{org_id}/m1/aftersales/{ticket_id}/attachments/{att_id}`**：严格校验 `org_id` + `ticket_id` 归属后从 `FileStorage` 返回文件流（非法后缀返回 `422`，跨组织访问返回 `404`）。

---

## 第6篇 M5 销量预测与 M6 智能补货闭环详细设计

> **文档编号**：CP-M5M6-LLD-2026-V1.0
> **代码基线**：`backend/app/modules/m5_m6_supply/{domain/*,models,schemas,service,router}.py` & `frontend/src/views/m5m6/*.vue`

---

### 1. 需求追溯矩阵（RTM）

| 需求/原型编号 | 验收编号 | API 接口 | 数据表 / Domain 模块 | 前端视图 |
|---|---|---|---|---|
| M5-1/2 画像与预测 (`m5a/b`) | M5M6-AC-01/02/03 | `GET /supply/forecast/{sku}` | `m5_sales_history`, `domain/{demand,backtest,inventory}` | `M5ProfilesView`, `M5ForecastView` |
| M5-3 预测复盘 (`m5c`) | M5M6-AC-02 | `GET/POST /supply/weekly-reviews` | `m6_weekly_reviews` | `M5ReviewView` |
| M6-1 沙盒仿真 (`m6a`) | M5M6-AC-03 | `POST /supply/sandbox` | `domain/simulate` | `M6StandardView` |
| M6-2 智能路线 (`m6b`) | M5M6-AC-03 | `GET /supply/forecast/{sku}`, `POST /supply/applies` | `domain/routes`, `m6_replenish_applies` | `M6SmartView` |
| M6-3 审批下单 (`m6c`) | M5M6-AC-04/05 | `POST /supply/applies/{id}/{submit,approve,reject}` | `domain/replenish_flow`, `m6_purchase_orders` | `M6AppliesView` |
| M6-4 到货收货与告警 (`m6d`) | M5M6-AC-06 | `POST /supply/pos/{id}/{ship,receive,cancel}`, `alerts*` | `m6_purchase_orders`, `m6_alert_events`, `m0_inventory` | `M6ReceivingView` |

---

### 2. 数据库物理表结构设计（PostgreSQL 15+ 标准方言）

> **存储与事务规范**：基于 **PostgreSQL 15+ (`JSONB`, `TIMESTAMPTZ`, `asyncpg`)**；采购收货状态机 (`create_po -> ship -> receive -> cancel`) 采用行级事务与状态前置校验；周期性缺货预警扫描按需由 **Redis + Celery Beat** 触发；周复盘指标与采购快照使用 `JSONB` 持久化。

#### 2.1 `m5_sales_history`（历史日销量流水表）

| 字段名 | SQL 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `INTEGER` | PK, AUTO | 自增主键 |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX, UQ(`org_id`,`sku`,`sales_date`) | 租户与 SKU |
| `sales_date` | `DATE` | NOT NULL, INDEX | 业务统计日期（不含当日未完结） |
| `qty_raw` / `on_hand_eod` | `FLOAT` | NOT NULL | 原始售出件数与日末库存（`0` 代表断货日） |
| `revenue_usd` | `FLOAT` | NOT NULL | 当日实盘销售额（USD） |

#### 2.2 `m6_replenish_applies`（补货申请单表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `apply_id` | `VARCHAR(64)` | PK | — | 主键 `app_<hex10>` |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 租户与 SKU |
| `route_code` | `VARCHAR(24)` | NOT NULL | `'sea'` | `sea`/`air`/`rail`/`truck` |
| `objective_mode` | `VARCHAR(24)` | NOT NULL | `'profit'` | `sales`/`profit`/`cash` |
| `qty_suggest` / `qty_propose` | `INTEGER` | NOT NULL | `0` | 系统建议量与人工提报量 |
| `est_amount_rmb` | `FLOAT` | NOT NULL | `0.0` | 预估采购+运费总资金（RMB） |
| `status` | `VARCHAR(32)` | NOT NULL | `'draft'` | `draft`/`pending_approve`/`approved`/`rejected`/`closed` |
| `submit_user` / `approve_user` | `VARCHAR(64)` | NULLABLE | `NULL` | 提交人与审批人（禁止相同） |
| `submit_at` / `approve_at` | `TIMESTAMPTZ` | NULLABLE | `NULL` | 提交时间与审批时间 |
| `reject_reason` | `TEXT` | NULLABLE | `NULL` | 驳回理由（驳回必非空） |
| `snapshot_json` | `JSONB` | NOT NULL | `{}` | 提交冻结参数快照 |

#### 2.3 `m6_purchase_orders`、`m6_alert_events`、`m6_weekly_reviews`

- **`m6_purchase_orders`**：`po_id` (PK), `org_id`, `apply_id`, `sku`, `route_code`, `order_qty`, `receive_qty`, `defect_qty`, `status` (`created`/`shipping`/`partial_received`/`fully_received`/`cancelled`), `expect_arrive`, `actual_arrive`, `cancel_reason`。
- **`m6_alert_events`**：`alert_id` (PK), `org_id`, `sku`, `severity`, `alert_type`, `message`, `status` (`OPEN`/`ACKED`), `ack_by`。
- **`m6_weekly_reviews`**：`review_id` (PK), `org_id`, `week_label`, `summary_text`, `metrics_json`, `is_mock`, `created_by`。

---

### 3. 核心数学模型与双状态机规则

#### 3.1 安全库存与两步取整算法（`domain/inventory.py`）

- **安全库存**：`SS = z * sigma * sqrt(L_eff + R)`（`z` 由服务水平决定：`0.98->2.05`, `0.95->1.65`, `0.90->1.28`）。
- **再订货点**：`ROP = mu * L_eff + SS`；**目标水位**：`Target = mu * (L_eff + R) + SS`。
- **净需求与两步取整**：`raw_net = max(0, Target - (on_hand + in_transit))`；若 `raw_net == 0` 返回 `0`；否则 `step1 = max(raw_net, moq)`，`qty_suggest = ceil(step1 / pack_size) * pack_size`。

#### 3.2 纯状态机流转图与错误码（`domain/replenish_flow.py`）

```
[补货申请单]
  draft --(submit)--> pending_approve --(approve, SoD)--> approved --(PO全收)--> closed
                                      \-(reject, 非空理由)-> rejected

[采购单 PO]
  created --(ship)--> shipping --(receive部分)--> partial_received --(receive全额)--> fully_received
     \----(cancel)-------\------------(cancel)-----------\--------(cancel)----------> cancelled
```

| 对象 | 允许流转 | 失败错误码 |
|---|---|---|
| 补货申请 | `draft -> pending_approve -> approved -> closed`；`pending_approve -> rejected` | 非法跃迁 `422 F-2001`；空驳回理由 `422 F-2002`；自批 `403 M7-4032` |
| 采购单 PO | `created -> shipping -> partial_received -> fully_received`；未终态 `-> cancelled` | 非法跃迁 `422 F-2001`；超收/不良超实收 `422 F-2003`；空取消原因 `422 F-2002` |
| 销量预测 | 需具备历史销量；缺失直接拦截 | 无历史销量 `422 M5-1003` |

---

### 4. REST API 完整契约

统一前缀：`/api/v1/orgs/{org_id}/supply`

| 端点 | 方法 | 权限码 | 请求 Schema | 错误码 & 审计 |
|---|---|---|---|---|
| `/forecast/{sku}` | `GET` | `m5:read` | Query `route_code`, `objective_mode` | `404 M7-4041`, `422 M5-1003` |
| `/sandbox` | `POST` | `m5:run` | `WhatIfSandboxReq` | `422`, `403 M7-4031` |
| `/applies` | `GET` / `POST` | `m6:read` / `m6:draft` | `ApplyCreateReq` | `422`, 记 `APPLY_CREATED` |
| `/applies/{id}/submit` | `POST` | `m6:draft` | — | `404`, `422 F-2001`, 记 `APPLY_SUBMITTED` |
| `/applies/{id}/approve` | `POST` | `m6:approve` | — | **`403 M7-4032`**, `422 F-2001`, 记 `APPLY_APPROVED` |
| `/applies/{id}/reject` | `POST` | `m6:approve` | `ApplyRejectReq` | **`403 M7-4032`**, `422 F-2001/2002`, 记 `APPLY_REJECTED` |
| `/pos` | `GET` | `m6:read` | — | `403 M7-4031` |
| `/pos/{po_id}/ship` | `POST` | `m6:receive` | — | `404`, `422 F-2001`, 记 `PO_SHIPPED` |
| `/pos/{po_id}/receive` | `POST` | `m6:receive` | `PoReceiveReq` | `404`, `422 F-2001/2003`, 记 `PO_RECEIVED` |
| `/pos/{po_id}/cancel` | `POST` | `m6:receive` | `PoCancelReq` | `404`, `422 F-2001/2002`, 记 `PO_CANCELLED` |
| `/alerts` / `/alerts/{id}/ack` | `GET` / `POST` | `m6:read` / `m6:receive` | — | `404`, 记 `ALERT_ACKED` |
| `/weekly-reviews` | `GET` / `POST` | `m5:read` / `m5:review` | `WeeklyReviewCreateReq` | `422`, 记 `WEEKLY_REVIEW_SAVED` |

##### `POST /sandbox` Payload 示例

```json
// Request
{ "sku": "SKU-00704", "route_code": "air", "objective_mode": "sales", "demand_multiplier": 1.4 }
// Response 200
{ "ok": true, "data": { "baseline": { "qty_suggest": 180 }, "simulated": { "qty_suggest": 300 } }, "error": null, "trace_id": "tr_m6_01" }
```

---

### 5. 前端视图组件规范（`frontend/src/views/m5m6/`）

- `M5ProfilesView.vue` / `M5ForecastView.vue` / `M5ReviewView.vue`：画像历史覆盖天数、6 模型回测对比表 + 14 天趋势柱状/折线 + BI 周复盘提交表单。
- `M6StandardView.vue` / `M6SmartView.vue`：What-If 四参数滑块并排对比 + 4 路线对比选优直达生成补货草案。
- `M6AppliesView.vue` / `M6ReceivingView.vue`：申请单状态标签与禁自批提示；PO 发货/分批质检收货（实时显示剩余可收数）/取消按钮与告警中心分组列表。

---

### 6. M5 扩展时序模型（Prophet / LightGBM / CatBoost）详细规范

在 `backend/app/modules/m5_m6_supply/domain/models.py` 中 `MODELS` 注册表除基础 4 策略外，新增 V1.1 对齐的三类高阶模型包装器，全部保证输出非负有限浮点值（无 `NaN` / `Inf`）：
1. **`f_prophet_trend` (`prophet`)**：线性趋势+周周期双重平滑预测。
2. **`f_lightgbm_gbdt` (`lightgbm`)**：基于近 7/14 日滞后残差的梯度提升残差迭代拟合。
3. **`f_catboost_tree` (`catboost`)**：按星期几相位分桶均值与全局水平加权的类别特征树拟合。

---

## 第7篇 M2 经营分析驾驶舱与 M3 竞品/智能问数详细设计

> **文档编号**：CP-M2M3-LLD-2026-V1.0
> **代码基线**：`backend/app/modules/m2_m3_bi/{models,schemas,service,router}.py`、`frontend/src/views/HomeWorkbenchView.vue`、`frontend/src/views/m2m3/*.vue`

---

### 1. 需求追溯矩阵（RTM）

| 需求/原型编号 | 验收编号 | API 接口 | 数据表 / 上游来源 | 前端视图 |
|---|---|---|---|---|
| 首页待办 (`/home`) | M2M3-AC-05 | `GET /home/workbench` | `m0_*`, `m1_aftersales_tickets`, `m6_*` | `HomeWorkbenchView.vue` |
| M2-1 广告调节 (`m2a`) | M2M3-AC-04 | `GET /m2/ads`, `POST /m2/ads/{id}/adjust` | `m2_ad_campaigns` | `M2AdsView.vue` |
| M2-2 经营大屏 (`m2b`) | M2M3-AC-01/02 | `GET /m2/overview` | 多模块聚合 | `M2OverviewView.vue` |
| M3-1 竞品监控 (`m3a`) | M2M3-AC-04 | `GET /m3/competitors`, `POST /m3/competitors` | `m3_competitor_watches` | `M3CompetitorsView.vue` |
| M3-2 智能问数 (`m3b`) | M2M3-AC-03/05 | `POST /m3/ask` *(V1.1)* + 聚合读接口 | 只读聚合 + 审计 | `M3AskView.vue` |

---

### 2. 数据库物理表结构设计（PostgreSQL 15+ 标准方言）

> **存储与并发隔离**：基于 **PostgreSQL 15+ (`asyncpg`)**，M2 经营驾驶舱多指标卡各自使用独立异步数据库会话，互不阻塞；指标汇总缓存按需写入 **Redis**（TTL 60s）；M3 问数只读连接严禁对 PostgreSQL 执行任何 DML/DDL 语句；知识库检索按需使用 **Milvus (`vector` profile)**。

#### 2.1 `m2_ad_campaigns`（广告投放计划表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `campaign_id` | `VARCHAR(64)` | PK | — | 广告计划 ID `camp_<hex10>` |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 组织与推广 SKU |
| `platform` | `VARCHAR(32)` | NOT NULL | `'Amazon Sponsored'` | 广告渠道 |
| `campaign_name` | `VARCHAR(128)` | NOT NULL | — | 计划名称 |
| `daily_budget_usd` | `FLOAT` | NOT NULL (`>0`) | `50.0` | 日预算（USD） |
| `spend_7d_usd` / `sales_7d_usd` | `FLOAT` | NOT NULL | `280.0` / `1400.0` | 近 7 日广告花费与归因销售 |
| `acos` / `roas` | `FLOAT` | NOT NULL | `0.20` / `5.0` | 广告投入产出比指标 |
| `status` | `VARCHAR(24)` | NOT NULL | `'ACTIVE'` | `ACTIVE` / `PAUSED` |

#### 2.2 `m3_competitor_watches`（竞品监控表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `watch_id` | `VARCHAR(64)` | PK | — | 监控记录 ID `watch_<hex10>` |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 组织与我方对标 SKU |
| `competitor_brand` / `asin_or_ref` | `VARCHAR(64)` | NOT NULL | — | 竞品品牌与 ASIN |
| `price_usd` / `rating` | `FLOAT` | `price > 0`, `1.0<=rating<=5.0` | `4.5` | 竞品售价与评分 |
| `review_count` / `bsr_rank` | `INTEGER` | `bsr >= 1` | `120` / `450` | 评论数与类目 BSR 排名 |
| `sentiment_score` | `FLOAT` | NOT NULL | `0.82` | 评论正向情感分（0~1） |
| `negative_topics_json` | `JSONB` | NOT NULL | `[]` | 高频差评痛点标签数组 |
| `last_alert` | `TEXT` | NOT NULL | `''` | 最新异动警示 |
| `updated_at` | `TIMESTAMPTZ` | AUTO | `now()` | 更新时间 |

---

### 3. 核心聚合口径与问数安全守卫逻辑

#### 3.1 利润与资金计算口径

```python
# 实盘订单过滤 (V1.1 全量加固)
live_orders = [o for o in m0_orders if not o.is_mock]
# SKU 级利润
cogs_usd = round(sum(o.qty) * unit_cost_usd, 2)
platform_fee_usd = round(gmv_usd * 0.15, 2)
sku_net_profit_usd = round(gmv_usd - cogs_usd - platform_fee_usd, 2)

# 组织级总净利（扣减 7 日广告消耗与已批准售后退款）
org_net_profit_usd = round(sum(sku_net_profit_usd) - total_ad_spend - total_approved_refund, 2)

# PO 承诺资金（RMB，不与 USD 混加）
po_commitment_rmb = sum(po.order_qty * round(unit_cost_usd * 7.2, 2) for po in pos if po.status != "cancelled")
```

#### 3.2 只读问数安全守卫与错误码

- **写意图检测规则**：匹配 `delete | drop | update | insert | alter | truncate | 修改 | 删除 | 改价 | 下单 | 退款` 即拒绝执行，返回只读拦截提示并记 `ASK_WRITE_BLOCKED` 审计。
- **错误码字典**：`403 M7-4031`（权限/租户越界）、`404 M7-4041`（广告计划 `campaign_id` 不存在）、`422 M7-4221`（预算 `<= 0`、评分越界、问题为空）。

---

### 4. REST API 完整契约

统一路径前缀：`/api/v1/orgs/{org_id}`

| 端点 | 方法 | 权限码 | 请求 Schema | 错误码 & 审计 |
|---|---|---|---|---|
| `/home/workbench` | `GET` | `m0:read` | — | `403 M7-4031` |
| `/m2/overview` | `GET` | `m2:read` | — | `403 M7-4031` |
| `/m2/ads` | `GET` | `m2:read` | — | `403 M7-4031` |
| `/m2/ads/{campaign_id}/adjust` | `POST` | `m2:edit` | `AdAdjustReq` | `404 M7-4041`, `422`, 记 `AD_ADJUSTED` |
| `/m3/competitors` | `GET` / `POST` | `m3:read` / `m3:edit` | `CompetitorCreateReq` | `422`, 记 `COMPETITOR_ADDED` |
| `/m3/ask` *(V1.1)* | `POST` | `m3:ask` | `AskQueryReq` (`question`) | 写意图拦截记 `ASK_WRITE_BLOCKED`；查询记 `ASK_EXECUTED` |

##### `POST /m2/ads/{campaign_id}/adjust` Payload 示例

```json
// Request
{ "daily_budget_usd": 85.0, "status": "ACTIVE" }
// Response 200
{ "ok": true, "data": { "campaign_id": "camp_amz_704", "daily_budget_usd": 85.0, "status": "ACTIVE" }, "error": null, "trace_id": "tr_m2_01" }
```

---

### 5. 前端视图组件规范

- **`HomeWorkbenchView.vue`**：6 项 KPI 卡片 + 4 项动态待办流转卡（M7 跳转 `/m7/compliance`）+ 8 项快捷通道按钮；对 `mock_buyer` 展示 403 引导跳转 `/m1/simulator`。
- **`M2AdsView.vue`**：行内可编辑 `daily_budget_usd` 输入框 + 「保存启用 / 暂停」双按钮。
- **`M2OverviewView.vue`**：四格财务 KPI + 单 SKU 盈利拆解表 + 多渠道结算对账表，右上角「追问智能助手 →」跳 `/m3/ask`。
- **`M3CompetitorsView.vue`** & **`M3AskView.vue`**：竞品监控表/新增表单；问答预设问题按钮 + 写意图安全阻断 + 溯源输出区（返回 `engine_mode`: `vanna_http` 或 `pg_readonly_fact`）。

---

### 6. M2 驾驶舱设计器与 Vanna 2 详细设计

- **`m2_dashboard_layouts` 数据表**：存储 `org_id`（唯一索引）、`draft_layout_json`、`published_layout_json`、`version`（乐观锁版本号）及 `updated_by`。
- **设计器接口群**：
  - `GET /api/v1/orgs/{org_id}/m2/designer/layout`：返回草稿、已发布布局与当前 `version`。
  - `PUT /api/v1/orgs/{org_id}/m2/designer/layout`：校验 `req.version == row.version`（冲突返回 `409 M7-4091`），保存最多 4 张卡配置并自增版本号。
  - `POST /api/v1/orgs/{org_id}/m2/designer/publish`：将草稿原子升级为正式布局并写中文审计。
  - `GET /api/v1/orgs/{org_id}/m2/designer/cards`：使用 `asyncio.gather` 对最多 4 张卡并行派生独立 `AsyncSession` 执行指标查询（单卡异常仅标记该卡 `ok=false` 而不拖垮整页），响应强制附带 `Cache-Control: no-store`。
- **Vanna 2 可配置接入（`vanna_client.py`）**：`POST /m3/ask` 先执行 `_MUTATION_RE` 写删阻断，再调用 `query_vanna_if_configured(org_id, question)`；未配置 `VANNA_BASE_URL` 或服务不可达时自动回退 PostgreSQL 只读事实引擎。
