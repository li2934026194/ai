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

---

## 第8篇 M7 商品内容创作与合规交付详细设计（完整版）

文档状态：V1.0 正式基线（与原型 docs/prototypes/web/pages_m7_m8.js、需求说明书 V1.1、概要设计说明书 V1.0 完全对齐）
适用范围：严格限定在 CrossPilot M7 四大核心模块（M7-1 多语言商品文案、M7-2 主图与详情套图、M7-3 商品短视频制作、M7-4 合规检查与成品打包）

#### 1. 文档信息

| 属性 | 内容 |
| :--- | :--- |
| 文档编号 | CP-M7-DD-2026-V1.0 |
| 系统名称 | CrossPilot 跨境电商智能工作台 — M7 商品内容创作与合规交付子系统 |
| 文档版本 | V1.0 |
| 编写日期 | 2026-11-19 |
| 前端技术栈 | Vue 3 (<script setup> Composition API) + TypeScript + Vue Router 4 + Pinia + Axios + OpenAPI Client（页面交互与布局对齐原型 docs/prototypes/web/） |
| 后端技术栈 | Python 3.11+ + FastAPI + Pydantic v2 + SQLAlchemy 2.0 (Async) + Alembic + Uvicorn + Pytest |
| 数据与媒体栈 | PostgreSQL 15+（本地开发兼容 SQLite 3.40+）、本地磁盘/MinIO FileStorage、Python Pillow (IPTC/XMP)、本地 FFmpeg (MP4 合成) |
| 基线依据 | 1. 《CrossPilot-M7商品内容创作与合规交付需求说明书》（commit c52ecbe） 2. 《CrossPilot-M7商品内容创作与合规交付概要设计说明书》（commit 6d12e11） 3. 《CrossPilot-M7商品内容创作与合规交付测试用例》（V2.0，118 条，commit 3f66153） |
| 阅读对象 | M7 前后端研发工程师、测试工程师（QA）、架构评审委员会、安全与合规审核人 |

##### 修改记录

| 版本 | 日期 | 作者 | 变更说明 |
| :--- | :--- | :--- | :--- |
| V1.0 | 2026-11-19 | CrossPilot 架构与研发组 | 初稿完成，覆盖 15 章全部详细设计内容及 ./attachments/ 全部源码与导出矢量图 |

#### 2. 设计范围与需求追溯

##### 2.1 设计边界声明

本详细设计严格限定于 M7 四大子模块及必要的共享核心服务与上游只读契约：

• 纳入设计范围（In-Scope）：

1. M7-1 多语言商品文案（路由 `m7a`）：读取上游商品主档与卖点/FAQ，支持平台/语言/站点配置、三层词库（品牌必用词、通用红线违禁词、平台商标与监管词）实时扫描、多版本 AI 草稿生成、就地微调保存与还原 AI 原稿、超长与红线强拦截。

2. M7-2 主图与详情套图（路由 `m7b`）：1+4 套图配置与异步生成、单图重绘、局部修改对比、磁盘级 IPTC/XMP AI 来源双标记（trainedAlgorithmicMedia、contains-synthetic-performer）尾部写入与读回校验、裁剪丢失阻断与重写修复。

3. M7-3 商品短视频与 A+ 详情（路由 `m7c`）：云端动态片段 + 本地 FFmpeg 15 秒三段分镜 MP4 合成、视频节点未配置如实报错阻断、分镜热编辑与单镜重做、引用 M7-1 文案、可视化 A+ 图文详情长页组装。

4. M7-4 合规检查与成品打包（路由 `m7d`）：站点 × 类目合规规则矩阵、资质管理与到期续期（含 TikTok 达人/品牌授权核验）、买家视角上架前预览与 8+N 缺失一键跳转补齐、5 项独立服务端合规检查、主管审批与禁自批职责分离门禁、上游改动旧审批自动失效、本地离线交付包（.html/.zip）导出。

5. 共享底座与契约边界：core/（多租户 org_id 隔离、9 角色 RBAC、不可篡改审计、异步任务协调、FileStorage）、contracts/（M0-2/M4-3 商品事实只读接口、M1-2 卖点 FAQ 只读接口）、mocks/（V1 模拟商品与店铺事实）。

• 明确排除范围（Out-of-Scope）：

• 真实跨境电商平台（Amazon SP-API / Shopee Open Platform / TikTok Shop API）远程推流与上架发布。

• 本地重型 GPU ComfyUI 集群部署（V1 以云端多模态 API + 本地 Pillow/FFmpeg 为主，仅保留 GeneratorAdapter 适配器接口与未配置如实报错兼容）。

• 独立重型规则中心微服务后台（V1 规则矩阵与词库以 DB/JSON 种子表维护，仅 approver 可编辑并写审计）。

• M1–M6、M8 等非 M7 模块内部实现（严禁直接跨模块读写其私有表）。

##### 2.2 需求追溯矩阵（Requirements Traceability Matrix）

| 需求编号 | 验收编号 | 所属模块 | 对应核心接口（Section 7） | 对应数据表（Section 6） | 对应关键用例/时序 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| M7-FR-01 选品承接与防编造 | M7-AC-01 | M7-1 | GET /products/available | contracts 只读视图 | sequence-m7-copy |
| M7-FR-02 多语言文案与三层词库 | M7-AC-02 | M7-1 | POST /copy/generate, POST /copy/scan | m7_generation_jobs, m7_generation_assets | sequence-m7-copy |
| M7-FR-03 就地微调与原稿保留 | M7-AC-02 | M7-1 | PUT /copy/assets/{asset_id}, POST /copy/assets/{asset_id}/restore | m7_generation_assets, core_audit_events | sequence-m7-copy |
| M7-FR-04 1+4 套图异步与差异化 | M7-AC-03 | M7-2 | POST /images/batch, POST /jobs/{job_id}/sync | m7_workflow_registry, m7_generation_jobs, m7_generation_media | sequence-m7-image |
| M7-FR-05 单图重绘与局部修改 | M7-AC-03 | M7-2 | POST /images/slots/{slot_idx}/regenerate, POST /images/slots/{slot_idx}/inpaint | m7_generation_assets, m7_generation_media | sequence-m7-image |
| M7-FR-06 IPTC/XMP 写入与读盘核验 | M7-AC-04 | M7-2 / M7-4 | POST /images/iptc/verify | m7_generation_media | sequence-m7-image |
| M7-FR-07 15s 短视频与分镜编辑/重做 | M7-AC-05 | M7-3 | POST /videos/generate, PUT /videos/segments/{seg_idx}, POST /videos/segments/{seg_idx}/regenerate | m7_generation_jobs, m7_generation_assets, m7_generation_media | sequence-m7-video-aplus |
| M7-FR-08 未配置阻断与 A+ 长页组装 | M7-AC-05 | M7-3 | POST /videos/generate, POST /aplus/generate | m7_generation_assets, core_audit_events | sequence-m7-video-aplus |
| M7-FR-09 站点×类目矩阵与资质续期 | M7-AC-06 | M7-4 | GET /compliance/matrix, PUT /compliance/matrix/{rule_id}, POST /certs/renew | m7_compliance_rules, m7_cert_records | sequence-m7-compliance-export |
| M7-FR-10 5 项上架合规独立检查 | M7-AC-06 | M7-4 | POST /compliance/check | m7_compliance_checks, core_audit_events | sequence-m7-compliance-export |
| M7-FR-11 买家视角预览与 8+N 补齐 | M7-AC-07 | M7-4 | GET /packages/{sku}/summary | m7_generation_assets, m7_compliance_checks | sequence-m7-compliance-export |
| M7-FR-12 禁自批审批、失效重审与离线导出 | M7-AC-08 | M7-4 | POST /packages/approve, GET /packages/{sku}/export | m7_approval_records, core_audit_events | sequence-m7-compliance-export |

##### 2.3 假设、约束与待确认项摘要

• 核心约束：所有业务请求必须绑定 org_id 并在 DB 查询层强制追加租户过滤；任何模拟测试数据不得篡改正式交付包中的真实磁盘媒体；approver 与 creator 必须遵守职责分离（禁自批，403 拦截）。

• 关键假设：V1 期间使用 MOCK 商品库与本地磁盘存储；所有云端大模型/文生图密钥通过环境变量注入，缺失时图片/文案可由本地 Pillow 模板或确定性安全回退演示，而视频生成节点未配置时按需求必须如实报错阻断（M7-5031）。

#### 3. 总体设计概述

##### 3.1 系统分层与代码目录规划

M7 模块遵循模块化单体 + 契约防腐层架构，作为独立新工程置于仓库新建目录 backend/ 与 frontend/（与历史遗留目录 `pilot/` 完全隔离，严禁直接引用或混入 `pilot/` 代码），工程目录结构如下：

| [text] backend/ ├── app/ │   ├── main.py                      # FastAPI 入口、CORS/异常处理/OpenAPI 挂载 │   ├── core/                        # 共享平台底座：auth_rbac / tenant / audit / storage / async_jobs │   ├── contracts/                   # 上游只读契约：product_catalog_contract.py / voice_faq_contract.py │   ├── mocks/                       # V1 MOCK 商品与资质种子数据提供者 │   └── modules/ │       └── m7_content/ │           ├── router.py            # M7ApiRouter（22 个 REST 端点 + RBAC 依赖注入） │           ├── schemas.py           # Pydantic v2 请求/响应 DTO 与严格字段校验 │           ├── models.py            # SQLAlchemy 2.0 ORM 模型（9 张表） │           ├── repository.py        # M7Repository（带 org_id 强制隔离的数据访问） │           ├── services/ │           │   ├── copy_service.py          # M7-1 文案业务编排 │           │   ├── image_service.py         # M7-2 1+4 套图与局部修改编排 │           │   ├── video_aplus_service.py   # M7-3 视频与 A+ 详情编排 │           │   └── compliance_service.py    # M7-4 合规检查、审批与离线包导出 │           ├── domain/ │           │   ├── lexicon_scanner.py       # 三层词库扫描 & 字节上限值对象计算 │           │   ├── iptc_handler.py          # Pillow IPTC/XMP 磁盘写入与真实读盘核验 │           │   └── rule_evaluator.py        # 5 项独立规则检查引擎 │           └── adapters/ │               ├── base.py                  # GeneratorAdapter 抽象接口 │               ├── cloud_api_adapter.py     # 通义千问/万相 或 豆包/Seedance 适配器 │               └── local_media_adapter.py   # Pillow 合成 + FFmpeg 15s 视频压制适配器 └── alembic/versions/                # 数据库迁移脚本  frontend/ ├── src/ │   ├── api/                         # OpenAPI 自动生成客户端 + Axios 拦截器 │   ├── stores/                      # Pinia Stores（m7Workspace / m7Copy / m7Media / m7Compliance） │   ├── router/index.ts              # /m7/copy, /m7/images, /m7/video-aplus, /m7/compliance │   ├── composables/                 # usePermission / useJobPolling / useRelayProgress │   └── views/m7/                    # 4 大主视图 + 买家预览抽屉 + 审批与导出弹框 |
| :--- |

##### 3.2 领域模型与分层架构类图

###### 3.2.1 领域实体、值对象与存储关系类图

源码：./attachments/class-m7-domain.mmd ｜ 矢量图：./attachments/class-m7-domain.svg

M7 领域模型类图

核心类职责说明：

• ProductFactSnapshot（只读契约视图）：承载上游 SKU 基础属性、价格、类目及卖点，防止 M7 在文案与图片提示词中虚构参数。

• WorkflowRegistry（实体）：锁定每次异步生成所使用的工作流版本与末端合规节点，确保复现可追溯。

• GenerationJob（聚合根）：管理 COPY / IMG / VID / APLUS 任务状态机（QUEUED -> RUNNING -> SUCCEEDED / FAILED），通过 idempotency_key 保证幂等。

• GenerationAsset（实体）：记录每个内容槽位（如 title, bullets, img_slot_0..4, vid_15s, aplus_page）的 content_json 与不可覆盖的 orig_content_json（支持一键还原 AI 原稿）。

• GenerationMedia（实体）：强绑定磁盘二进制文件元信息（mime_type, file_size, storage_key, ai_person_flag, iptc_verified），禁止无真实二进制文件生成假记录。

• CopyScanResult & StoryboardSegment（值对象）：分别封装三层词库/字节超限扫描结果与 3 段 5 秒分镜结构。

• ComplianceRuleSeed、CertRecord、ComplianceCheck、ApprovalRecord（合规与门禁实体）：构成独立于生成的合规检查、过期拦截与主管审批失效闭环。

###### 3.2.2 分层架构类图（Controller / Service / Domain / Adapter / Repository）

源码：./attachments/class-m7-service.mmd ｜ 矢量图：./attachments/class-m7-service.svg

M7 分层架构类图

类协作关系说明：

• M7ApiRouter 仅负责 DTO 解析、通过 CorePlatformFacade.requirePerm() 执行路由级 RBAC，并委派至 4 个应用服务。

• CopyService、ImageService、VideoAplusService、CompliancePackageService 各自编排事务边界，严禁直接调用其他模块底层表；所有跨模块事实通过 contracts 读取。

• LexiconScanner 与 IptcMetadataHandler 为纯领域服务，不依赖 HTTP 上下文，可在同步接口及异步后台任务中复用。

• GeneratorAdapter 隔离外部多模态引擎差异，允许 CloudApiAdapter 与 LocalPillowFfmpegAdapter 组合降级执行。

#### 4. 用例图

源码：./attachments/usecase-m7-content.mmd ｜ 矢量图：./attachments/usecase-m7-content.svg

M7 商品内容创作与合规交付系统用例图

##### 角色与核心用例说明

| 角色 / 参与者 | 职责权限边界 | 覆盖核心用例 | 异常扩展与阻断 |
| :--- | :--- | :--- | :--- |
| 内容创作/审核人员 (`creator`) | 具备内容生成、编辑、重绘、分镜调整、发起合规检查及批准后导出下载权限；不可编辑规则矩阵、不可自我批准 | UC-01~UC-04、UC-06~UC-08、UC-10~UC-12、UC-15~UC-16、UC-18 | UC-05 违禁/超长拦截、UC-09 IPTC 丢失阻断、UC-13 视频未配置阻断、UC-19 自批 403 拦截 |
| 主管 / 审批人 (`approver`) | 具备规则矩阵与词库维护、合规复核、最终批准发布包与导出权限；可审批他人创建的工作包 | UC-14、UC-15、UC-17、UC-18 | UC-19 资质过期/缺项时无法通过检查，禁止强行批准 |
| 只读人员 (`manager / planner / selector`) | 仅允许查看商品创作进度、预览买家视角页面，禁止修改资产与调用生成或审批接口 | UC-16（只读预览） | 任何写接口返回 403 Forbidden 并写审计 |
| 外部生成引擎适配器 | 执行大语言模型生成、图像合成、动态视频与 FFmpeg 合成 | 被 UC-02、UC-06、UC-10 调用 | 无响应、节点未配置或伪造 MIME 时返回受控异常 |

#### 5. 模块详细设计

##### 5.1 M7-1 多语言商品文案（m7a）

###### 5.1.1 模块职责、边界与依赖

• 职责：基于选定商品与站点语言配置，生成 3 组差异化文案草稿（标题、五点卖点、长描述、后台搜索词），实时执行三层词库扫描与平台字节/字符上限校验，支持就地人工微调与一键还原 AI 原稿。

• 边界：仅处理文本型创作资产（slot 为 title / bullets / description / search_terms）；不负责读取磁盘图片元数据，也不负责跨 SKU 批量推流。

• 依赖：只读依赖 contracts.ProductCatalogContract（商品事实）与 contracts.VoiceFaqContract（高频痛点），调用 LexiconScanner 与 CloudApiAdapter。

###### 5.1.2 关键时序图（成功与异常拦截路径）

源码：./attachments/sequence-m7-copy.mmd ｜ 矢量图：./attachments/sequence-m7-copy.svg

M7-1 多语言商品文案时序图

###### 5.1.3 核心接口与涉及数据表

• 接口：GET /products/available、POST /copy/generate、POST /copy/scan、POST /copy/assets/{asset_id}/select、PUT /copy/assets/{asset_id}、POST /copy/assets/{asset_id}/restore

• 数据表：m7_generation_jobs、m7_generation_assets、m7_compliance_rules、m7_approval_records（上游改写时联动失效）、core_audit_events

###### 5.1.4 异常处理、事务、幂等与并发控制

• 异常拦截：前端扫描仅供即时绿/红提示，服务端在 PUT /copy/assets/{asset_id} 必须重新运行 LexiconScanner；一旦命中 ban_hits > 0、tm_hits、reg_hits、all_caps_words（全大写禁用）或 over_len == True，抛出 M7-4221 异常，拒绝写入交付清单并记录审计。

• 原稿保护与事务：首次生成落盘时 orig_content_json 与 content_json 同步写入；微调时仅更新 content_json 与 edit_status='MANUALLY_EDITED'，并在同一事务内将该 SKU 现存有效的 m7_approval_records.is_active 置为 false（触发上游改动重审）。

• 并发与幂等：POST /copy/generate 校验 X-Idempotency-Key，相同键 10 分钟内直接返回已生成任务；PUT /copy/assets/{asset_id} 使用乐观锁版本号 version，若版本号不一致返回 409 Conflict (M7-4091) 防止多人覆盖。

##### 5.2 M7-2 主图与详情套图（m7b）

###### 5.2.1 模块职责、边界与依赖

• 职责：承接 M7-1 卖点关键字，配置 1 张白底主图 + 4 张差异化场景/细节/尺寸/卖点图参数并触发异步生成；支持单图重绘、局部修改对比（保留其余 4 张不变）及磁盘级 IPTC/XMP 双标签写入与读回验证。

• 边界：不执行视频帧渲染；所有图片落盘前必须验证魔数与真实 MIME 为 image/*。

• 依赖：m7_workflow_registry（锁版本）、CloudApiAdapter + LocalPillowFfmpegAdapter、IptcMetadataHandler、CorePlatformFacade.saveBinaryToStorage()。

###### 5.2.2 关键时序图（异步生成、单图重绘与 IPTC 读写校验）

源码：./attachments/sequence-m7-image.mmd ｜ 矢量图：./attachments/sequence-m7-image.svg

M7-2 主图与详情套图时序图

###### 5.2.3 核心接口与涉及数据表

• 接口：POST /images/batch、POST /jobs/{job_id}/sync、POST /images/slots/{slot_idx}/regenerate、POST /images/slots/{slot_idx}/inpaint、POST /images/iptc/verify

• 数据表：m7_workflow_registry、m7_generation_jobs、m7_generation_assets、m7_generation_media、m7_approval_records、core_audit_events

###### 5.2.4 异常处理、事务、幂等与并发控制

• 伪造资源与失败拦截：同步外部结果时，若无输出、HTTP 非 200 或二进制头校验非合法 image/png | image/jpeg | image/webp，立即将任务置为 FAILED，严禁插入 `m7_generation_media`，返回 M7-4241。

• 末端 IPTC 双写与读盘验证：生成管线末端调用 Pillow PngInfo / JPEG EXIF/XMP 写入 trainedAlgorithmicMedia 与 contains-synthetic-performer（真人出镜图启用）；当用户在 M7-2 或 M7-4 触发校验时，系统真正打开磁盘图片文件读取元数据并更新 iptc_verified 字段，丢失时阻断并允许一键重写入。

• 单图锁与幂等：regenerate / inpaint 仅针对 slot_idx ∈ [0..4] 生成新版本 GenerationAsset 并切换 is_selected=true，其余 4 个槽位记录只读不变；同一 job_id 轮询同步采用数据库行锁（SELECT ... FOR UPDATE SKIP LOCKED）防重复落盘。

##### 5.3 M7-3 商品短视频与 A+ 详情制作（m7c）

###### 5.3.1 模块职责、边界与依赖

• 职责：生成 15 秒 9:16 竖屏三段分镜商品短视频（3 秒吸睛钩子 + 8 秒核心卖点演示 + 4 秒促销行动号召），支持分镜图位切换、运镜参数调整、双语字幕与引用 M7-1 文案、单镜重做，以及一键组装可视化 A+ 图文详情长页。

• 边界：V1 仅输出 15 秒本地 MP4 与 A+ HTML 结构化模块；不接入外部达人实时直播流或付费配音计费通道。

• 依赖：CloudApiAdapter（可选图生视频片段）、LocalPillowFfmpegAdapter（FFmpeg 拼接、双语烧录字幕与音轨合成）、M7-1/M7-2 已选资产。

###### 5.3.2 关键时序图（FFmpeg 合成、分镜重做、未配置阻断与 A+ 组装）

源码：./attachments/sequence-m7-video-aplus.mmd ｜ 矢量图：./attachments/sequence-m7-video-aplus.svg

M7-3 商品短视频与 A+ 详情时序图

###### 5.3.3 核心接口与涉及数据表

• 接口：POST /videos/generate、PUT /videos/segments/{seg_idx}、POST /videos/segments/{seg_idx}/regenerate、POST /aplus/generate

• 数据表：m7_generation_jobs、m7_generation_assets、m7_generation_media、m7_approval_records、core_audit_events

###### 5.3.4 异常处理、事务、幂等与并发控制

• 未配置节点如实报错：若环境未检测到可用 ffmpeg 二进制且外部视频节点未配置（或模拟未配置开关打开），POST /videos/generate 立即返回 503 Service Unavailable (M7-5031)，绝不生成空 MP4 伪装成功，且已有文案和套图资产完全保留。

• 局部重渲染：regenerate 单镜重做仅重算目标 seg_idx ∈ {0,1,2} 的视觉片段后由 FFmpeg 快速重新混流封装 MP4，确保其余两段脚本与图位配置原样保留。

• A+ 图文组装：POST /aplus/generate 事务内聚合 M7-1 已选标题/卖点与 M7-2 已选套图槽位，生成 aplus_page 资产后将 8 项交付完整度推进至 8/8。

##### 5.4 M7-4 合规检查与成品打包（m7d）

###### 5.4.1 模块职责、边界与依赖

• 职责：提供站点 × 类目动态合规规则矩阵（支持 approver 编辑）、类目资质记录与到期续期（含 TikTok 授权核验）、买家视角模拟预览与 8+N 缺失一键定位补齐、5 项独立上架合规检查、主管审批门禁（禁自批与上游修改自动失效）及本地离线包导出（.html / .zip）。

• 边界：V1 离线导出包供本地验证与人工上架使用，不发起电商平台在线提交。

• 依赖：m7_compliance_rules、m7_cert_records、m7_compliance_checks、m7_approval_records、IptcMetadataHandler（真读盘核验）、m7_generation_assets/media。

###### 5.4.2 关键时序图（5 项合规检查、禁自批门禁与离线导出）

源码：./attachments/sequence-m7-compliance-export.mmd ｜ 矢量图：./attachments/sequence-m7-compliance-export.svg

M7-4 合规检查与成品打包时序图

###### 5.4.3 核心接口与涉及数据表

• 接口：GET /compliance/matrix、PUT /compliance/matrix/{rule_id}、POST /certs/renew、POST /compliance/check、GET /packages/{sku}/summary、POST /packages/approve、GET /packages/{sku}/export

• 数据表：m7_compliance_rules、m7_cert_records、m7_compliance_checks、m7_approval_records、core_audit_events

###### 5.4.4 异常处理、事务、幂等与并发控制

• 五项独立检查门禁：服务端按最新 m7_compliance_rules 重新核查：1）文案无红线/商标/监管词且长度达标；2）1+4 套图无遗漏；3）所有选中图片真实打开磁盘文件读取 trainedAlgorithmicMedia（含人像还需 contains-synthetic-performer）；4）全部必备资质存在且 expire_date >= CURRENT_DATE（TikTok 额外检查达人/品牌授权有效）；5）8 类基本交付物完整。任一失败即 overall_pass=false，禁用批准与导出。

• 职责分离与禁自批：POST /packages/approve 首先在路由层要求 m7:publish:approve（仅 approver 拥有），并在服务层二次核对 current_user.id != last_editor_id（即使具备审批角色也不能审批自己最后修改的内容，违者返回 403 Forbidden (M7-4032) 并记入安全审计）。

• 上游变更自动失效机制：任何修改 M7-1 文案、M7-2 图片、M7-3 视频/A+ 或资质续期失效的写操作，均调用 invalidate_active_approvals(org_id, sku)，将 m7_approval_records.is_active 置为 false、invalidated_reason 记明上游变更事件，强制重新过检与复批。

#### 6. 数据库表设计

数据库选型：PostgreSQL 15+（生产/测试环境），兼容 SQLite 3.40+（本地单机极速启动）。下述 DDL 以 PostgreSQL 标准方言编写，通过 SQLAlchemy JSON().with_variant(JSONB, "postgresql") 实现跨库兼容。

##### 6.1 数据表总览

| 序号 | 表名 | 类型 | 所属范围 | 核心职责 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | m7_workflow_registry | 配置实体 | M7-2/M7-3 | 工作流模板版本锁定与合规节点登记 |
| 2 | m7_generation_jobs | 聚合根 | M7-1/2/3 | 异步/同步生成任务状态机与幂等键 |
| 3 | m7_generation_assets | 核心资产 | M7-1/2/3 | 文案/套图槽位/视频分镜/A+ 结构化版本与原稿快照 |
| 4 | m7_generation_media | 媒体文件 | M7-2/M7-3 | 磁盘媒体元数据、MIME 校验与 IPTC 真实读盘状态 |
| 5 | m7_compliance_rules | 规则种子 | M7-1/M7-4 | 站点 × 类目规则矩阵、字符上限、三层词库种子 |
| 6 | m7_cert_records | 资质台账 | M7-4 | 类目强制资质、TikTok 授权与到期日 |
| 7 | m7_compliance_checks | 检查记录 | M7-4 | 5 项独立合规校验结果快照 |
| 8 | m7_approval_records | 审批门禁 | M7-4 | 主管审批放行凭证与上游改动失效状态 |
| 9 | core_audit_events | 平台审计 | 共享底座 | 只追加（Append-Only）全链路中文操作审计台账 |

##### 6.2 详细表结构与字段设计

###### 表 1：m7_workflow_registry（生成工作流版本注册表）

| 字段名 | 类型与长度 | 可空 | 默认值 | 约束 / 索引 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| workflow_id | VARCHAR(64) | NO | - | PK | 工作流唯一标识（如 wf_img_1plus4_v2） |
| purpose | VARCHAR(32) | NO | - | INDEX | 用途枚举：COPYWRITING / MAIN_IMAGE / SHORT_VIDEO / APLUS |
| version | VARCHAR(32) | NO | - | - | 语义化版本号（如 2.1.0） |
| adapter_type | VARCHAR(32) | NO | 'CLOUD_API' | - | 执行引擎：CLOUD_API / PILLOW_FFMPEG / COMFYUI |
| compliance_node | VARCHAR(64) | NO | 'iptc_tail_v1' | - | 末端必经合规节点标识 |
| status | VARCHAR(16) | NO | 'ACTIVE' | - | 枚举：ACTIVE / DEPRECATED / UNCONFIGURED |
| config_json | JSONB | NO | '{}' | - | 默认采样步数/画幅/超时参数 |
| created_at | TIMESTAMPTZ | NO | NOW() | - | 创建时间 |

###### 表 2：m7_generation_jobs（内容生成任务表）

| 字段名 | 类型与长度 | 可空 | 默认值 | 约束 / 索引 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| job_id | VARCHAR(64) | NO | - | PK | 任务 ID（UUID/ULID，如 job_01J...） |
| org_id | VARCHAR(64) | NO | - | INDEX(org_id, sku) | 租户隔离 ID |
| sku | VARCHAR(64) | NO | - | INDEX | 关联商品 SKU |
| job_type | VARCHAR(24) | NO | - | - | 枚举：COPY / IMG_BATCH / IMG_REGEN / IMG_INPAINT / VIDEO_15S / VIDEO_SEG / APLUS |
| platform | VARCHAR(24) | NO | 'amazon_us' | - | 标准化站点枚举：amazon_us / shopee_th / tiktok_us |
| workflow_id | VARCHAR(64) | YES | NULL | FK -> m7_workflow_registry | 锁定的工作流模板 ID |
| workflow_version | VARCHAR(32) | NO | '1.0.0' | - | 锁定版本快照 |
| idempotency_key | VARCHAR(128) | NO | - | UNIQUE(org_id, idempotency_key) | 防重放幂等键 |
| status | VARCHAR(20) | NO | 'QUEUED' | INDEX | 状态机：QUEUED / RUNNING / SUCCEEDED / FAILED |
| progress | SMALLINT | NO | 0 | CHECK(0..100) | 进度百分比 |
| engine_run_id | VARCHAR(128) | YES | NULL | - | 外部云端 API 或 ComfyUI 运行 ID |
| params_json | JSONB | NO | '{}' | - | 输入参数快照（风格/语言/避坑/分镜参数） |
| error_code | VARCHAR(32) | YES | NULL | - | 失败错误码（如 M7-5031） |
| error_detail | TEXT | YES | NULL | - | 失败详因（不含敏感密钥） |
| created_by | VARCHAR(64) | NO | - | - | 发起人用户 ID |
| created_at | TIMESTAMPTZ | NO | NOW() | - | 创建时间 |
| updated_at | TIMESTAMPTZ | NO | NOW() | - | 更新时间 |

###### 表 3：m7_generation_assets（生成内容资产版本表）

| 字段名 | 类型与长度 | 可空 | 默认值 | 约束 / 索引 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| asset_id | VARCHAR(64) | NO | - | PK | 资产 ID |
| org_id | VARCHAR(64) | NO | - | INDEX(org_id, sku, asset_slot) | 租户隔离 ID |
| sku | VARCHAR(64) | NO | - | INDEX | 关联商品 SKU |
| job_id | VARCHAR(64) | NO | - | FK -> m7_generation_jobs | 来源任务 ID |
| asset_slot | VARCHAR(32) | NO | - | - | 17 个标准槽位：核心文案(copy_title/copy_bullets/copy_desc/copy_kw)、扩展文案(copy_faq/copy_aplus_txt/copy_variant/copy_attr/copy_alt/copy_warranty)、套图(img_0..img_4)、视频与A+(vid_15s/aplus_page) |
| platform | VARCHAR(24) | NO | 'amazon_us' | - | 标准化平台标识：amazon_us / shopee_th / tiktok_us |
| lang | VARCHAR(16) | NO | 'en-US' | - | 语言标识（en-US/zh-CN/th-TH 等） |
| variant_idx | SMALLINT | NO | 0 | - | 候选草稿序号（0..2，用于同槽位多版本候选区分） |
| version | INTEGER | NO | 1 | - | 乐观锁及版本递增号 |
| is_selected | BOOLEAN | NO | FALSE | - | 是否被采纳入交付清单（同一 (org_id, sku, platform, asset_slot) 最多仅 1 条为 TRUE） |
| edit_status | VARCHAR(24) | NO | 'AI_GENERATED' | - | 枚举：AI_GENERATED / MANUALLY_EDITED / RESTORED_ORIGINAL |
| content_json | JSONB | NO | '{}' | - | 当前生效结构化内容（文案文本、分镜数组或 A+ 模块） |
| orig_content_json | JSONB | NO | '{}' | - | AI 初稿不可变快照，用于一键还原 |
| scan_result_json | JSONB | NO | '{}' | - | 最近一次 CopyScanResult 扫描快照 |
| last_edited_by | VARCHAR(64) | NO | - | - | 最后操作人（用于禁自批校对） |
| deleted_at | TIMESTAMPTZ | YES | NULL | - | 软删除时间戳（仅历史作废版本） |
| created_at | TIMESTAMPTZ | NO | NOW() | - | 创建时间 |
| updated_at | TIMESTAMPTZ | NO | NOW() | - | 更新时间 |

###### 表 4：m7_generation_media（磁盘媒体文件绑定表）

| 字段名 | 类型与长度 | 可空 | 默认值 | 约束 / 索引 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| media_id | VARCHAR(64) | NO | - | PK | 媒体 ID |
| org_id | VARCHAR(64) | NO | - | INDEX | 租户 ID |
| asset_id | VARCHAR(64) | NO | - | UNIQUE FK -> m7_generation_assets | 1:1 绑定资产槽位版本 |
| media_kind | VARCHAR(16) | NO | - | - | 枚举：IMAGE / VIDEO |
| mime_type | VARCHAR(64) | NO | - | - | 真实魔数检测 MIME（image/png、video/mp4 等） |
| file_size | BIGINT | NO | - | CHECK(file_size > 0) | 文件字节大小 |
| sha256 | CHAR(64) | NO | - | - | 文件摘要（防篡改及缓存校验） |
| storage_key | VARCHAR(255) | NO | - | UNIQUE | 本地相对存储路径（如 orgs/org1/sku1/img_0_v2.png） |
| width | INTEGER | YES | NULL | - | 像素宽 |
| height | INTEGER | YES | NULL | - | 像素高 |
| duration_sec | NUMERIC(5,2) | YES | NULL | - | 视频时长（秒，如 15.00） |
| ai_person_flag | BOOLEAN | NO | FALSE | - | 是否含 AI 虚拟模特/数字人 |
| iptc_verified | BOOLEAN | NO | FALSE | - | 磁盘读回校验双标记是否全部存在 |
| iptc_tags_json | JSONB | NO | '{}' | - | 最近一次从磁盘真实读回的 IPTC/XMP 键值 |
| created_at | TIMESTAMPTZ | NO | NOW() | - | 落盘时间 |

###### 表 5：m7_compliance_rules（站点×类目合规规则种子表）

| 字段名 | 类型与长度 | 可空 | 默认值 | 约束 / 索引 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| rule_id | VARCHAR(64) | NO | - | PK | 规则 ID（如 rule_amazon_us_kitchen_appliance） |
| org_id | VARCHAR(64) | NO | - | UNIQUE(org_id, platform, category) | 租户规则唯一键（默认初始化 3×4=12 条规则矩阵） |
| platform | VARCHAR(24) | NO | - | - | amazon_us / shopee_th / tiktok_us |
| category | VARCHAR(64) | NO | - | - | kitchen_appliance / bags_travel / 3c_accessories / beauty_skincare |
| rule_version | VARCHAR(32) | NO | '2026.11' | - | 规则版本号 |
| effective_date | DATE | NO | CURRENT_DATE | - | 生效日期 |
| title_max_chars | INTEGER | NO | 200 | - | 标题最大字符数上限（Amazon 200 / TikTok 150 / Shopee 120） |
| bullet_max_chars | INTEGER | NO | 500 | - | 单条卖点最大字符数上限 |
| search_terms_max_bytes | INTEGER | NO | 250 | - | 后台搜索词 UTF-8 最大字节数上限（250 bytes） |
| lexicon_json | JSONB | NO | '{}' | - | 三层词库：{must:[], ban:[], trademark:[], regulatory:[]} |
| required_certs_json | JSONB | NO | '[]' | - | 必备资质清单（如 ["UL","FCC","TikTok达人授权"]） |
| image_policy_json | JSONB | NO | '{}' | - | 主图纯白/像素/AI声明强制项 |
| updated_by | VARCHAR(64) | NO | - | - | 仅 approver 可更新 |
| updated_at | TIMESTAMPTZ | NO | NOW() | - | 最后更新 |

###### 表 6：m7_cert_records（类目资质与授权台账表）

| 字段名 | 类型与长度 | 可空 | 默认值 | 约束 / 索引 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| cert_id | VARCHAR(64) | NO | - | PK | 资质 ID |
| org_id | VARCHAR(64) | NO | - | INDEX(org_id, sku) | 租户 ID |
| sku | VARCHAR(64) | NO | - | - | 商品 SKU |
| cert_type | VARCHAR(64) | NO | - | - | 资质类型（如 FCC、FDA、TIKTOK_CREATOR_AUTH） |
| cert_no | VARCHAR(128) | NO | - | - | 证书编号 |
| expire_date | DATE | NO | - | INDEX | 到期日期 |
| status | VARCHAR(16) | NO | 'VALID' | - | VALID / EXPIRING / EXPIRED |
| doc_url | VARCHAR(255) | YES | NULL | - | 本地资质附件路径 |
| updated_at | TIMESTAMPTZ | NO | NOW() | - | 更新时间 |

###### 表 7：m7_compliance_checks（5 项上架合规检查记录表）

| 字段名 | 类型与长度 | 可空 | 默认值 | 约束 / 索引 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| check_id | VARCHAR(64) | NO | - | PK | 检查记录 ID |
| org_id | VARCHAR(64) | NO | - | INDEX(org_id, sku, created_at) | 租户 ID |
| sku | VARCHAR(64) | NO | - | - | 商品 SKU |
| platform | VARCHAR(24) | NO | - | - | 检查站点 |
| rule_id | VARCHAR(64) | NO | - | FK -> m7_compliance_rules | 依据规则版本快照 |
| rule_version | VARCHAR(32) | NO | - | - | 规则版本号快照 |
| checks_json | JSONB | NO | '[]' | - | 5 项明细数组 [{code, name, passed, detail, jump_route}] |
| deliverable_count | SMALLINT | NO | 0 | - | 当前完备交付物数量（满分 8） |
| overall_pass | BOOLEAN | NO | FALSE | - | 5 项是否全绿通过 |
| checked_by | VARCHAR(64) | NO | - | - | 触发检查用户 ID |
| created_at | TIMESTAMPTZ | NO | NOW() | - | 检查时间 |

###### 表 8：m7_approval_records（主管审批与失效门禁表）

| 字段名 | 类型与长度 | 可空 | 默认值 | 约束 / 索引 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| approval_id | VARCHAR(64) | NO | - | PK | 审批记录 ID |
| org_id | VARCHAR(64) | NO | - | INDEX(org_id, sku, platform, is_active) | 租户 ID |
| sku | VARCHAR(64) | NO | - | - | 商品 SKU |
| platform | VARCHAR(24) | NO | 'amazon_us' | - | 目标站点（支持同 SKU 多站点独立过检审批） |
| check_id | VARCHAR(64) | NO | - | FK -> m7_compliance_checks | 绑定的合格检查单 |
| last_editor_id | VARCHAR(64) | NO | - | - | 提交前最后修改创作资产的用户 ID |
| approver_id | VARCHAR(64) | NO | - | - | 批准主管 ID（服务层按 M7_STRICT_SEPARATION_OF_DUTIES 校验互斥，避免单人演示数据库硬报错） |
| decision | VARCHAR(16) | NO | 'APPROVED' | - | APPROVED / REJECTED |
| note | TEXT | YES | NULL | - | 审批意见 |
| is_active | BOOLEAN | NO | TRUE | - | 上游若被改动或切规则自动置为 FALSE |
| invalidated_reason | VARCHAR(128) | YES | NULL | - | 失效原因（如 COPY_EDITED / IMG_REGEN / CERT_EXPIRED） |
| approved_at | TIMESTAMPTZ | NO | NOW() | - | 审批时间 |

###### 表 9：core_audit_events（平台只追加审计事件表）

| 字段名 | 类型与长度 | 可空 | 默认值 | 约束 / 索引 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| event_id | VARCHAR(64) | NO | - | PK | 审计事件 ID |
| org_id | VARCHAR(64) | NO | - | INDEX(org_id, created_at) | 租户 ID |
| sku | VARCHAR(64) | YES | NULL | INDEX | 关联商品 SKU |
| module | VARCHAR(16) | NO | 'M7' | - | 模块代码 |
| action | VARCHAR(48) | NO | - | - | 动作代码（如 COPY_BAN_BLOCKED、APPROVE_SELF_DENIED） |
| actor_id | VARCHAR(64) | NO | - | - | 操作人 ID |
| actor_role | VARCHAR(24) | NO | - | - | 操作人角色 |
| ok | BOOLEAN | NO | TRUE | - | 操作是否成功放行 |
| sentence_zh | TEXT | NO | - | - | 人类可读中文审计摘要 |
| payload_json | JSONB | NO | '{}' | - | 脱敏上下文快照 |
| trace_id | VARCHAR(64) | NO | - | - | 请求链路追踪 ID |
| created_at | TIMESTAMPTZ | NO | NOW() | - | 不可修改时间戳 |

##### 6.3 完整建表 DDL（PostgreSQL 15+）

| [sql] CREATE TABLE m7_workflow_registry (     workflow_id     VARCHAR(64) PRIMARY KEY,     purpose         VARCHAR(32) NOT NULL,     version         VARCHAR(32) NOT NULL,     adapter_type    VARCHAR(32) NOT NULL DEFAULT 'CLOUD_API',     compliance_node VARCHAR(64) NOT NULL DEFAULT 'iptc_tail_v1',     status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',     config_json     JSONB NOT NULL DEFAULT '{}'::jsonb,     created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() );  CREATE TABLE m7_generation_jobs (     job_id           VARCHAR(64) PRIMARY KEY,     org_id           VARCHAR(64) NOT NULL,     sku              VARCHAR(64) NOT NULL,     job_type         VARCHAR(24) NOT NULL,     platform         VARCHAR(24) NOT NULL DEFAULT 'amazon_us',     workflow_id      VARCHAR(64) REFERENCES m7_workflow_registry(workflow_id),     workflow_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',     idempotency_key  VARCHAR(128) NOT NULL,     status           VARCHAR(20) NOT NULL DEFAULT 'QUEUED',     progress         SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),     engine_run_id    VARCHAR(128),     params_json      JSONB NOT NULL DEFAULT '{}'::jsonb,     error_code       VARCHAR(32),     error_detail     TEXT,     created_by       VARCHAR(64) NOT NULL,     created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),     updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),     CONSTRAINT uq_m7_job_idemp UNIQUE (org_id, idempotency_key) ); CREATE INDEX idx_m7_jobs_org_sku_status ON m7_generation_jobs (org_id, sku, status, created_at DESC);  CREATE TABLE m7_generation_assets (     asset_id          VARCHAR(64) PRIMARY KEY,     org_id            VARCHAR(64) NOT NULL,     sku               VARCHAR(64) NOT NULL,     job_id            VARCHAR(64) NOT NULL REFERENCES m7_generation_jobs(job_id),     asset_slot        VARCHAR(32) NOT NULL,     platform          VARCHAR(24) NOT NULL DEFAULT 'amazon_us',     lang              VARCHAR(16) NOT NULL DEFAULT 'en-US',     variant_idx       SMALLINT NOT NULL DEFAULT 0,     version           INTEGER NOT NULL DEFAULT 1,     is_selected       BOOLEAN NOT NULL DEFAULT FALSE,     edit_status       VARCHAR(24) NOT NULL DEFAULT 'AI_GENERATED',     content_json      JSONB NOT NULL DEFAULT '{}'::jsonb,     orig_content_json JSONB NOT NULL DEFAULT '{}'::jsonb,     scan_result_json  JSONB NOT NULL DEFAULT '{}'::jsonb,     last_edited_by    VARCHAR(64) NOT NULL,     deleted_at        TIMESTAMPTZ,     created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),     updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() ); CREATE INDEX idx_m7_assets_active ON m7_generation_assets (org_id, sku, asset_slot) WHERE deleted_at IS NULL; CREATE UNIQUE INDEX uq_m7_assets_selected_slot ON m7_generation_assets (org_id, sku, platform, asset_slot)     WHERE is_selected = TRUE AND deleted_at IS NULL;  CREATE TABLE m7_generation_media (     media_id       VARCHAR(64) PRIMARY KEY,     org_id         VARCHAR(64) NOT NULL,     asset_id       VARCHAR(64) NOT NULL UNIQUE REFERENCES m7_generation_assets(asset_id),     media_kind     VARCHAR(16) NOT NULL CHECK (media_kind IN ('IMAGE', 'VIDEO')),     mime_type      VARCHAR(64) NOT NULL,     file_size      BIGINT NOT NULL CHECK (file_size > 0),     sha256         CHAR(64) NOT NULL,     storage_key    VARCHAR(255) NOT NULL UNIQUE,     width          INTEGER,     height         INTEGER,     duration_sec   NUMERIC(5,2),     ai_person_flag BOOLEAN NOT NULL DEFAULT FALSE,     iptc_verified  BOOLEAN NOT NULL DEFAULT FALSE,     iptc_tags_json JSONB NOT NULL DEFAULT '{}'::jsonb,     created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() ); CREATE INDEX idx_m7_media_org ON m7_generation_media (org_id, media_kind);  CREATE TABLE m7_compliance_rules (     rule_id                VARCHAR(64) PRIMARY KEY,     org_id                 VARCHAR(64) NOT NULL,     platform               VARCHAR(24) NOT NULL,     category               VARCHAR(64) NOT NULL,     rule_version           VARCHAR(32) NOT NULL DEFAULT '2026.11',     effective_date         DATE NOT NULL DEFAULT CURRENT_DATE,     title_max_chars        INTEGER NOT NULL DEFAULT 200,     bullet_max_chars       INTEGER NOT NULL DEFAULT 500,     search_terms_max_bytes INTEGER NOT NULL DEFAULT 250,     lexicon_json           JSONB NOT NULL DEFAULT '{}'::jsonb,     required_certs_json    JSONB NOT NULL DEFAULT '[]'::jsonb,     image_policy_json      JSONB NOT NULL DEFAULT '{}'::jsonb,     updated_by             VARCHAR(64) NOT NULL,     updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),     CONSTRAINT uq_m7_rule_org_plat_cat UNIQUE (org_id, platform, category) );  CREATE TABLE m7_cert_records (     cert_id     VARCHAR(64) PRIMARY KEY,     org_id      VARCHAR(64) NOT NULL,     sku         VARCHAR(64) NOT NULL,     cert_type   VARCHAR(64) NOT NULL,     cert_no     VARCHAR(128) NOT NULL,     expire_date DATE NOT NULL,     status      VARCHAR(16) NOT NULL DEFAULT 'VALID',     doc_url     VARCHAR(255),     updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() ); CREATE INDEX idx_m7_certs_org_sku ON m7_cert_records (org_id, sku, expire_date);  CREATE TABLE m7_compliance_checks (     check_id          VARCHAR(64) PRIMARY KEY,     org_id            VARCHAR(64) NOT NULL,     sku               VARCHAR(64) NOT NULL,     platform          VARCHAR(24) NOT NULL,     rule_id           VARCHAR(64) NOT NULL REFERENCES m7_compliance_rules(rule_id),     rule_version      VARCHAR(32) NOT NULL,     checks_json       JSONB NOT NULL DEFAULT '[]'::jsonb,     deliverable_count SMALLINT NOT NULL DEFAULT 0,     overall_pass      BOOLEAN NOT NULL DEFAULT FALSE,     checked_by        VARCHAR(64) NOT NULL,     created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() ); CREATE INDEX idx_m7_checks_latest ON m7_compliance_checks (org_id, sku, created_at DESC);  CREATE TABLE m7_approval_records (     approval_id        VARCHAR(64) PRIMARY KEY,     org_id             VARCHAR(64) NOT NULL,     sku                VARCHAR(64) NOT NULL,     platform           VARCHAR(24) NOT NULL DEFAULT 'amazon_us',     check_id           VARCHAR(64) NOT NULL REFERENCES m7_compliance_checks(check_id),     last_editor_id     VARCHAR(64) NOT NULL,     approver_id        VARCHAR(64) NOT NULL,     decision           VARCHAR(16) NOT NULL DEFAULT 'APPROVED',     note               TEXT,     is_active          BOOLEAN NOT NULL DEFAULT TRUE,     invalidated_reason VARCHAR(128),     approved_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() ); CREATE INDEX idx_m7_approval_active ON m7_approval_records (org_id, sku, platform, is_active, approved_at DESC);  CREATE TABLE core_audit_events (     event_id    VARCHAR(64) PRIMARY KEY,     org_id      VARCHAR(64) NOT NULL,     sku         VARCHAR(64),     module      VARCHAR(16) NOT NULL DEFAULT 'M7',     action      VARCHAR(48) NOT NULL,     actor_id    VARCHAR(64) NOT NULL,     actor_role  VARCHAR(24) NOT NULL,     ok          BOOLEAN NOT NULL DEFAULT TRUE,     sentence_zh TEXT NOT NULL,     payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,     trace_id    VARCHAR(64) NOT NULL,     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() ); CREATE INDEX idx_core_audit_org_sku ON core_audit_events (org_id, sku, created_at DESC); |
| :--- |

##### 6.4 索引查询场景、生命周期与迁移策略

• 高频查询索引映射：

• uq_m7_assets_selected_slot（部分唯一索引）：保证同一 SKU 在同一站点每个交付槽位有且仅有一条有效选中资产，使打包汇总查询实现毫秒级 Index-Only Scan。

• idx_m7_jobs_org_sku_status：支撑异步任务轮询列表与超时回收扫描。

• idx_m7_checks_latest & idx_m7_approval_active：支撑 M7-4 实时判断当前是否处于“合规校验通过 + 主管已批准”门禁状态。

• 生命周期、软删除与审计策略：

• m7_generation_assets 历史重绘版本保留（置 is_selected=false），仅作废版本使用 deleted_at 软删除；core_audit_events 与 m7_approval_records 严格只追加/状态失效，禁止物理 DELETE（保留期不少于 365 天）。

• 所有表结构变更通过 alembic revision --autogenerate 管理，生产上线前须先执行 alembic upgrade head 并在 CI 中检查无回滚破坏性变更。

#### 7. 接口设计

##### 7.1 统一接口规范

• 基础前缀：/api/v1/orgs/{org_id}/m7（RESTful 资源风格，JSON UTF-8）。

• 公共请求头：

• Authorization: Bearer <jwt>（携带 sub、org_id、role）

• X-Request-Id: <uuid>（全链路追踪）

• X-Idempotency-Key: <key>（所有 POST 生成与状态改变写操作推荐/必传）

• 分页、排序与过滤规范：列表类查询统一支持 ?page=1&page_size=20&sort=-created_at&keyword=...，上限 page_size <= 100。

• 统一响应信封：

| [json]   {     "code": "OK",     "message": "成功",     "trace_id": "req_9f2a1c",     "data": { ... }   } |
| :--- |

• OpenAPI 契约一致性：后端 FastAPI 自动生成 /openapi.json，前端通过 openapi-typescript 生成类型定义与 Axios 客户端，确保前后端 DTO 字段零漂移。

• 平台与类目标准枚举字典（解决前后端中英文口径冲突）：

• platform：amazon_us（亚马逊美国站，标题上限 200 字符）、shopee_th（虾皮泰国站，标题上限 120 字符）、tiktok_us（TikTok 美区，标题上限 150 字符）。

• category：kitchen_appliance（厨房小电）、bags_travel（箱包出行）、3c_accessories（3C配件）、beauty_skincare（美妆护肤）。

• 后端 Schema 接收英文 code 并内建中文别名兼容映射，种子脚本默认初始化 3 × 4 = 12 条规则矩阵。

##### 7.2 22 个规范化 RESTful 端点详细契约

| # | 方法与路径（基于 /api/v1/orgs/{org_id}/m7） | RBAC 权限码 | 幂等/超时/限流 | 核心用途 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | GET /products/available | m7:content:read | 只读 / 3s / 60rpm | 拉取可创作 SKU、事实主档与 M1-2 卖点 FAQ |
| 2 | POST /copy/generate | m7:content:edit | 幂等键 / 30s / 15rpm | 生成指定槽位的多语言 3 组候选文案并执行三层词库扫描 |
| 3 | POST /copy/scan | m7:content:read | 幂等只读 / 2s / 60rpm | 实时扫描前端输入微调文案的三层词库、字符数与 UTF-8 字节上限 |
| 4 | POST /copy/assets/{asset_id}/select | m7:content:edit | 幂等 / 3s / 30rpm | 采纳候选草稿写入交付清单（校验未阻断后切换 is_selected=true） |
| 5 | PUT /copy/assets/{asset_id} | m7:content:edit | 乐观锁 version / 3s / 30rpm | 服务端强校验后保存微调稿，保留 AI 原稿并失效旧审批 |
| 6 | POST /copy/assets/{asset_id}/restore | m7:content:edit | 幂等 / 3s / 20rpm | 一键还原 orig_content_json AI 原稿并失效旧审批 |
| 7 | POST /images/batch | m7:content:edit | 幂等键 / 5s(202) / 10rpm | 提交 1+4 套图异步生成任务，锁定工作流版本 |
| 8 | GET /engines/status | m7:content:read | 只读 / 3s / 60rpm | 查询统一引擎状态（云端 API / 本地 Pillow&FFmpeg / 可选 ComfyUI 节点池） |
| 9 | POST /jobs/{job_id}/sync | m7:content:read | 锁防重 / 10s / 60rpm | 同步外部任务结果、检验真实 MIME、执行末端 IPTC 写入 |
| 10 | POST /images/slots/{slot_idx}/regenerate | m7:content:edit | 幂等键 / 5s(202) / 15rpm | 仅重绘指定图位（其余 4 张不变），并失效旧审批 |
| 11 | POST /images/slots/{slot_idx}/inpaint | m7:content:edit | 幂等键 / 5s(202) / 15rpm | 局部修改指定图位并返回原图/新图对比 |
| 12 | POST /images/iptc/verify | m7:compliance:run | 幂等 / 5s / 30rpm | 真读盘核验 IPTC/XMP 双标签或执行重新写入 |
| 13 | POST /videos/generate | m7:content:edit | 幂等键 / 45s / 6rpm | 合成 15s 三段分镜 MP4（未配置节点直接返回 503 M7-5031） |
| 14 | PUT /videos/segments/{seg_idx} | m7:content:edit | 乐观锁 / 3s / 30rpm | 热修改分镜图位/运镜/字幕或引用 M7-1 |
| 15 | POST /videos/segments/{seg_idx}/regenerate | m7:content:edit | 幂等键 / 30s / 10rpm | 仅重做指定分镜并重新拼接 MP4 |
| 16 | POST /aplus/generate | m7:content:edit | 幂等键 / 10s / 15rpm | 组装 M7-1+M7-2 可视化 A+ 图文长页 |
| 17 | GET /compliance/matrix | m7:content:read | 只读 / 3s / 60rpm | 查询站点×类目规则矩阵与当前 SKU 资质台账 |
| 18 | PUT /compliance/matrix/{rule_id} | m7:rule:maintain | 乐观锁 / 3s / 20rpm | 仅 approver 维护三层词库与站点规则（写审计并清缓存） |
| 19 | POST /certs/renew | m7:rule:maintain | 幂等 / 3s / 20rpm | 仅 approver 续期或变更资质到期日 |
| 20 | POST /compliance/check | m7:compliance:run | 幂等键 / 5s / 30rpm | 运行 5 项上架合规检查并持久化 ComplianceCheck |
| 21 | GET /packages/{sku}/summary | m7:content:read | 只读 / 3s / 60rpm | 查询 ?platform=... 下 8+N 清单就绪度与买家视角预览数据 |
| 22 | POST /packages/approve & GET /packages/{sku}/export | m7:publish:approve / m7:package:export | 事务门禁 / 5~15s / 20rpm | 主管批准（禁自批）；按 ?platform=...&format=zip\|html 下载离线交付包 |

##### 7.3 关键接口详尽 Schema 与 JSON 示例

###### (1) POST /api/v1/orgs/{org_id}/m7/copy/generate

• 请求体 (`CopyGenerateRequest`)：

• sku (str, 必填), platform (Literal["amazon_us","shopee_th","tiktok_us"]), slot (Literal["copy_title","copy_bullets","copy_desc","copy_kw","copy_faq","copy_aplus_txt","copy_variant","copy_attr","copy_alt","copy_warranty"]), lang (str, 默认 "en-US"), must_words (list[str]), ban_words (list[str]), tone (str)

• 响应体 (`200 OK`)：

| [json]   {     "code": "OK",     "message": "成功生成 3 组文案草稿",     "trace_id": "req_88a1",     "data": {       "job_id": "job_copy_01J",       "sku": "SKU-00704",       "slot": "copy_title",       "variants": [         {           "asset_id": "ast_title_v1",           "variant_idx": 0,           "text": "Wireless Noise Cancelling Earbuds 40H Playtime IPX5",           "translation_cn": "【中文对照】无线降噪耳机 40小时续航 IPX5防水",           "scan_result": {             "must_hits": 2,             "total_must": 2,             "ban_hits": 0,             "tm_hits": [],             "reg_hits": [],             "all_caps_words": [],             "char_len": 52,             "max_chars": 200,             "byte_len": 52,             "max_bytes": 250,             "over_len": false,             "blocked": false           }         }       ]     }   } |
| :--- |

###### (2) PUT /api/v1/orgs/{org_id}/m7/copy/assets/{asset_id}

• 请求体 (`CopyEditRequest`)：{"version": 1, "text": "...", "translation_cn": "..."}

• 异常拦截响应 (`422 Unprocessable Entity`)：

| [json]   {     "code": "M7-4221",     "message": "文案触发合规拦截，未写入交付清单",     "trace_id": "req_88b2",     "data": {       "blocked": true,       "reasons": ["命中通用违禁词: Cure", "标题超出 Amazon 200 字符上限(当前 218)"],       "scan_result": { "ban_hits": 1, "over_len": true }     }   } |
| :--- |

###### (3) POST /api/v1/orgs/{org_id}/m7/images/batch & POST /jobs/{job_id}/sync

• Batch 请求 (`202 Accepted`)：

{"sku":"SKU-00704","platform":"amazon_us","style":"studio_clean","aspect":"1:1","avoid_words":["watermark","text overlay"],"ai_person":false}

• Sync 响应（成功 `200 OK`）：返回 status: "SUCCEEDED"、slots[0..4] 含 media_id、preview_url、mime_type: "image/png"、iptc_verified: true。

• Sync 响应（无输出/伪造 MIME `424 Failed Dependency`）：返回 code: "M7-4241", status: "FAILED", error_detail: "外部响应非合法 image/* 字节，已拦截入库"。

###### (4) POST /api/v1/orgs/{org_id}/m7/videos/generate

• 请求体：{"sku":"SKU-00704","platform":"amazon_us","script_style":"product_showcase","voice_lang":"en-US","bgm":"acoustic_home","segments":[...]}

• 未配置节点报错 (`503 Service Unavailable`)：

| [json]   {     "code": "M7-5031",     "message": "视频生成节点未配置或 FFmpeg 不可用，已如实阻断（已保留现有文案与套图）",     "trace_id": "req_91c3",     "data": { "node": "video_generator", "configured": false }   } |
| :--- |

###### (5) POST /api/v1/orgs/{org_id}/m7/compliance/check

• 请求体：{"sku":"SKU-00704","platform":"tiktok_us","category":"kitchen_appliance"}

• 响应体 (`200 OK`)：

| [json]   {     "code": "OK",     "message": "已完成 5 项上架合规检查",     "trace_id": "req_95d1",     "data": {       "check_id": "chk_01J",       "overall_pass": false,       "deliverable_count": 7,       "gate_status": "CHECK_FAILED",       "checks": [         {"code": "COPY_REDLINE", "name": "文案词库与长度核验", "passed": true, "detail": "0 违禁 / 长度合规", "jump_route": "/m7/copy"},         {"code": "IMG_1PLUS4", "name": "1+4 套图完备性", "passed": true, "detail": "5/5 已生成", "jump_route": "/m7/images"},         {"code": "IPTC_DISK", "name": "AI 元数据真读盘核验", "passed": true, "detail": "5/5 含 trainedAlgorithmicMedia", "jump_route": "/m7/images"},         {"code": "CERT_VALID", "name": "类目资质与 TikTok 授权", "passed": false, "detail": "FCC 证书已于 2026-10-01 过期", "jump_route": "/m7/compliance#certs"},         {"code": "BUNDLE_8", "name": "8+N 交付清单完整度", "passed": false, "detail": "缺少 A+ 图文长页 (7/8)", "jump_route": "/m7/video-aplus"}       ]     }   } |
| :--- |

###### (6) POST /api/v1/orgs/{org_id}/m7/packages/approve & GET /packages/{sku}/export

• Approve 请求体：{"sku":"SKU-00704","platform":"amazon_us","check_id":"chk_01J","decision":"APPROVED","note":"资质已续期且五项检查全绿，同意导出"}

• 自批拦截 (`403 Forbidden`)：当 actor_role != 'approver' 返回 M7-4031；当开启 M7_STRICT_SEPARATION_OF_DUTIES=true 且 current_user.id == last_editor_id 返回 code: "M7-4032", message: "违反职责分离原则：创作者不可自我批准"。

• Export (`GET /packages/{sku}/export?platform=amazon_us&format=zip`)：验证指定 platform 存在 is_active = True 的审批单且 overall_pass = True 后，返回 Content-Type: application/zip（或 text/html）附件流下载并写审计。

#### 8. 关键业务逻辑伪代码

##### 8.1 M7-1 文案生成、三层词库扫描与字符/字节上限强拦截

| [python] async def generate_and_scan_copy(org_id: str, req: CopyGenerateReq, user: User) -> CopyGenerateResp:     # 1. 只读拉取上游商品事实（防止虚构规格与价格）     fact = await product_contract.get_fact_snapshot(org_id=org_id, sku=req.sku)     if not fact:         raise M7DomainError("M7-4041", f"商品 {req.sku} 不存在或未同步至 M7", status=404)      # 2. 获取站点×类目最新合规词库与字符/字节限制     rule = await repo.get_rule(org_id, req.platform, fact.category)     job = await repo.create_or_reuse_idempotent_job(         org_id=org_id, sku=req.sku, job_type="COPY", platform=req.platform,         idemp_key=req.idempotency_key, created_by=user.id     )     if job.status == "SUCCEEDED":         return await repo.load_copy_response(job.job_id)      # 3. 调用大模型生成 3 组指定槽位的多语言草稿（传入 fact 锚点约束）     drafts = await adapter.generate_copy(         fact=fact, platform=req.platform, slot=req.slot, lang=req.lang, tone=req.tone     )     results = []     async with repo.transaction():         for idx, draft in enumerate(drafts):             scan = lexicon_scanner.scan_three_layers(                 text=draft.text,                 slot=req.slot,                 must_words=req.must_words or rule.lexicon_json["must"],                 ban_words=(req.ban_words or []) + rule.lexicon_json["ban"],                 tm_words=rule.lexicon_json["trademark"],                 reg_words=rule.lexicon_json["regulatory"],                 max_chars=rule.title_max_chars if req.slot == "copy_title" else rule.bullet_max_chars,                 max_bytes=rule.search_terms_max_bytes if req.slot == "copy_kw" else None,             )             # 候选草稿均写入真实槽位 req.slot，初始 is_selected=False；待用户点击采纳(/select)时正式入清单             asset = await repo.save_copy_asset(                 org_id=org_id, sku=req.sku, job_id=job.job_id, slot=req.slot,                 platform=req.platform, lang=req.lang, variant_idx=idx,                 content=draft.model_dump(), orig_content=draft.model_dump(),                 scan_result=scan.model_dump(), is_selected=False,                 last_edited_by=user.id,             )             results.append((asset, scan))         await repo.mark_job_succeeded(job.job_id)         await audit.append(org_id, req.sku, "COPY_GENERATED", user, True, f"生成 {req.slot} ({req.lang}) 草稿 3 组")     return build_copy_response(job.job_id, req.slot, results) |
| :--- |

##### 8.2 M7-1 就地微调保存与还原 AI 原稿

| [python] async def save_manual_copy_edit(org_id: str, asset_id: str, req: CopyEditReq, user: User) -> AssetDTO:     asset = await repo.get_asset_for_update(org_id, asset_id)     if asset.version != req.version:         raise M7DomainError("M7-4091", "文案已被他人修改，请刷新最新版本", status=409)      rule = await repo.get_rule(org_id, asset.platform, req.category or "kitchen_appliance")     scan = lexicon_scanner.scan_three_layers(         text=req.text, slot=asset.asset_slot,         must_words=rule.lexicon_json["must"], ban_words=rule.lexicon_json["ban"],         tm_words=rule.lexicon_json["trademark"], reg_words=rule.lexicon_json["regulatory"],         max_chars=rule.title_max_chars if asset.asset_slot == "copy_title" else rule.bullet_max_chars,         max_bytes=rule.search_terms_max_bytes if asset.asset_slot == "copy_kw" else None,     )     if scan.blocked:         await audit.append(org_id, asset.sku, "COPY_BAN_BLOCKED", user, False,                            f"微调文案触发拦截：{scan.block_reasons_zh()}")         raise M7DomainError("M7-4221", "命中平台红线词或超出字符/字节上限，禁止写入交付清单", status=422, detail=scan)      async with repo.transaction():         # 仅更新 content_json，绝对保留 orig_content_json         updated = await repo.update_asset_content(             asset_id=asset_id, new_content=req.content_dict(),             scan_result=scan.model_dump(), edit_status="MANUALLY_EDITED",             editor_id=user.id, next_version=asset.version + 1,         )         # 上游资产变更，立即失效对应平台既有主管审批         await repo.invalidate_active_approvals(org_id, asset.sku, asset.platform, reason="COPY_EDITED")         await audit.append(org_id, asset.sku, "COPY_EDITED", user, True, "就地微调并保存文案（保留AI原稿）")     return updated |
| :--- |

##### 8.3 M7-2 1+4 异步出图同步、MIME 校验与磁盘 IPTC 核验

| [python] async def sync_image_job(org_id: str, job_id: str, user: User) -> JobStatusResp:     async with repo.job_lock(org_id, job_id) as job:         if job.status in ("SUCCEEDED", "FAILED"):             return JobStatusResp.from_job(job)          raw_outputs = await adapter.poll_image_outputs(job.engine_run_id)         if not raw_outputs or len(raw_outputs) < 5:             await repo.mark_job_failed(job_id, "M7-4241", "生成节点无输出或张数不足5张")             return JobStatusResp.failed(job_id, "M7-4241")          saved_media = []         for slot_idx, binary in enumerate(raw_outputs[:5]):             # 1) 真实魔数检测 MIME，禁止空文件或 HTML 报错页入库             mime = detect_magic_mime(binary)             if mime not in ("image/png", "image/jpeg", "image/webp"):                 await repo.mark_job_failed(job_id, "M7-4241", f"图位 {slot_idx} MIME 非法: {mime}")                 raise M7DomainError("M7-4241", f"检测到非法图片响应 {mime}，已阻止落盘", status=424)              # 2) 末端通过 Pillow 写入 IPTC/XMP AI 生成声明双标记             tagged_bytes = iptc_handler.write_tags_to_bytes(                 binary, ai_generated=True, ai_person=job.params_json.get("ai_person", False)             )             storage_key = await storage.save_bytes(org_id, job.sku, f"img_{slot_idx}_v{job.job_id}.png", tagged_bytes)              # 3) 真实打开磁盘文件读回验证（防写入失败）             tags_readback = iptc_handler.read_and_verify_from_disk(storage.resolve_path(storage_key))             media = await repo.save_slot_asset_and_media(                 org_id=org_id, sku=job.sku, job_id=job_id, slot=f"img_{slot_idx}",                 mime=mime, size=len(tagged_bytes), storage_key=storage_key,                 iptc_verified=tags_readback.valid, iptc_tags=tags_readback.raw, editor_id=user.id             )             saved_media.append(media)          await repo.invalidate_active_approvals(org_id, job.sku, reason="IMAGE_BATCH_UPDATED")         await repo.mark_job_succeeded(job_id)         await audit.append(org_id, job.sku, "IMAGE_BATCH_OK", user, True, "1+4套图生成并完成IPTC读盘校验")         return JobStatusResp.succeeded(job_id, saved_media) |
| :--- |

##### 8.4 M7-3 15 秒短视频生成（未配置阻断 & FFmpeg 合成）与单镜重做

| [python] async def generate_15s_video(org_id: str, req: VideoGenReq, user: User) -> VideoGenResp:     # 1. 强检查视频合成引擎配置状态（未配置必须如实报错阻断）     if not adapter.is_video_engine_configured():         await audit.append(org_id, req.sku, "VIDEO_UNCONFIGURED", user, False, "视频节点未配置，已阻断")         raise M7DomainError("M7-5031", "视频生成节点未配置或 FFmpeg 不可用，已如实阻断", status=503)      # 2. 获取 M7-2 对应槽位真实磁盘图片作为分镜底图     slot_paths = await repo.get_selected_image_paths(org_id, req.sku, [s.img_slot for s in req.segments])     job = await repo.create_job(org_id, req.sku, "VIDEO_15S", req.idempotency_key, user.id)      try:         clip_paths = []         for seg, img_path in zip(req.segments, slot_paths):             clip = await adapter.render_motion_clip(img_path=img_path, motion=seg.motion, duration=seg.duration_sec)             clip_paths.append(clip)          # 3. 本地 FFmpeg 拼接三段分镜 + 压制双语字幕 + 混音 BGM         mp4_bytes = await ffmpeg_adapter.mux_15s_mp4(             clips=clip_paths, segments=req.segments, bgm=req.bgm, voice_lang=req.voice_lang         )         if detect_magic_mime(mp4_bytes) != "video/mp4" or len(mp4_bytes) < 1024:             raise M7DomainError("M7-4242", "合成视频流校验失败，禁止写入空文件", status=424)          key = await storage.save_bytes(org_id, req.sku, f"vid_15s_{job.job_id}.mp4", mp4_bytes)         media = await repo.save_video_asset(org_id, req.sku, job.job_id, req.segments, key, len(mp4_bytes), user.id)         await repo.invalidate_active_approvals(org_id, req.sku, reason="VIDEO_UPDATED")         await repo.mark_job_succeeded(job.job_id)         return VideoGenResp(job_id=job.job_id, media=media)     except Exception as exc:         await repo.mark_job_failed(job.job_id, "M7-5032", str(exc))         raise |
| :--- |

##### 8.5 M7-4 5 项上架合规检查、禁自批门禁与离线交付包导出

| [python] async def run_5_compliance_checks(org_id: str, req: ComplianceCheckReq, user: User) -> ComplianceCheckResp:     rule = await repo.get_rule(org_id, req.platform, req.category)     bundle = await repo.get_selected_bundle(org_id, req.sku, req.platform)     certs = await repo.get_certs(org_id, req.sku)      # 1) 文案合规（以服务端规则表为准重扫）     c1 = rule_evaluator.check_copy(bundle.copy_assets, rule)     # 2) 1+4 套图完备性     c2 = rule_evaluator.check_images_1plus4(bundle.image_assets)     # 3) 真实打开磁盘文件核验 IPTC/XMP 双标签（裁剪丢失立即失败）     c3 = iptc_handler.verify_bundle_from_disk(bundle.image_media_list, storage)     # 4) 类目资质与 TikTok 授权时效核验     c4 = rule_evaluator.check_certs(certs, required=rule.required_certs_json, platform=req.platform, today=date.today())     # 5) 8+N 完整度（主图1 + 场景4 + 标题/五点/长描 + 短视频 + A+）     c5 = rule_evaluator.check_deliverables_completeness(bundle)      checks = [c1, c2, c3, c4, c5]     overall_pass = all(c.passed for c in checks)     record = await repo.save_compliance_check(org_id, req.sku, req.platform, rule, checks, overall_pass, user.id)     await audit.append(org_id, req.sku, "COMPLIANCE_CHECK", user, overall_pass,                        f"运行5项合规检查：{'全部通过' if overall_pass else '存在未通过项'}")     return record  async def approve_package(org_id: str, req: ApproveReq, user: User) -> ApprovalResp:     if user.role != "approver":         await audit.append(org_id, req.sku, "APPROVE_DENIED_ROLE", user, False, "非主管角色越权审批被拦截")         raise M7DomainError("M7-4031", "仅主管(approver)可执行发布包批准", status=403)      check = await repo.get_check(org_id, req.check_id)     if not check.overall_pass:         raise M7DomainError("M7-4222", "合规检查未全绿通过，禁止批准发布", status=422)      last_editor = await repo.get_last_asset_editor(org_id, req.sku, req.platform)     if settings.M7_STRICT_SEPARATION_OF_DUTIES and last_editor == user.id:         await audit.append(org_id, req.sku, "APPROVE_SELF_DENIED", user, False, "触发禁自批职责分离拦截")         raise M7DomainError("M7-4032", "职责分离拦截：创作者不可自我批准同一工作包", status=403)      approval = await repo.create_active_approval(         org_id, req.sku, req.platform, check.check_id, last_editor or "system", user.id, req.note     )     await audit.append(org_id, req.sku, "PACKAGE_APPROVED", user, True, f"主管批准发布包：{req.note}")     return approval |
| :--- |

上游改动自动失效联动清单：PUT /copy/assets/{asset_id}、POST /copy/assets/{asset_id}/restore、POST /copy/assets/{asset_id}/select、POST /jobs/{job_id}/sync、POST /images/slots/*/regenerate|inpaint、PUT/POST /videos/segments/*、POST /aplus/generate、PUT /compliance/matrix/{rule_id}、POST /certs/renew 均须在事务内调用 invalidate_active_approvals(org_id, sku, platform, reason)。

#### 9. 前端详细设计

工程栈：Vue 3.4+ (`<script setup>`) + TypeScript + Vue Router 4 + Pinia + Axios + OpenAPI Client，交互语义、接力进度条（文案 → 套图 → 视频&A+ → 合规打包）及布局完全承接已验证通过的原型 docs/prototypes/web/pages_m7_m8.js。

##### 9.1 路由、视图与组件划分

| 路由路径 | 页面组件 | 对应原型模块 | 核心子组件 |
| :--- | :--- | :--- | :--- |
| /m7/copy | M7CopyWorkbench.vue | m7a | M7RelayBar、ProductSelectorPanel、LexiconPillInput、CopyDraftCard、InlineCopyEditor |
| /m7/images | M7ImageStudio.vue | m7b | M7RelayBar、ImageConfigForm、SlotGallery1Plus4、InpaintCompareModal、IptcStatusBadge |
| /m7/video-aplus | M7VideoAplusView.vue | m7c | M7RelayBar、VerticalVideoPlayer、StoryboardSegmentList、SourceMapPanel、AplusBuilderPanel |
| /m7/compliance | M7CompliancePackView.vue | m7d | M7RelayBar、RuleMatrixEditor、CertLedgerPanel、BuyerPreviewDrawer、FiveChecksPanel、ApproveExportModal |

##### 9.2 Pinia 状态管理设计

• useM7WorkspaceStore：维护全局 currentOrgId、currentSku、platform（amazon_us | shopee_th | tiktok_us）、category（kitchen_appliance | bags_travel | 3c_accessories | beauty_skincare）、relayProgress（0–8 交付进度）及当前选中草稿槽位，切换路由时自动保持跨步上下文连贯。

• useM7CopyStore：管理 variants、editingContent、origSnapshot、scanResult 与乐观锁 version，提供 runRealtimeScan()（300ms 防抖调用 /copy/scan）与 restoreOriginal()。

• useM7MediaStore：管理 1+4 槽位状态、轮询定时器 pollJob(jobId)（指数退避 1s -> 2s -> 3s，页面卸载自动 onUnmounted 清理）、单图局部对比状态及 3 段分镜 segments。

• useM7ComplianceStore：管理 ruleMatrix、certRecords、fiveChecks、approvalStatus（PENDING_CHECK | CHECK_FAILED | CHECK_PASSED | APPROVED | INVALIDATED）及离线打包下载进度。

##### 9.3 表单校验、RBAC 按钮控制与状态处理

• 前端校验 + 服务端兜底：输入微调时前端防抖提示命中词与当前字节数；点击保存由服务端强阻断并返回 M7-4221 高亮对应段落。

• RBAC 精细控制（`usePermission()`）：

• manager / planner / selector：仅展示只读视图与买家预览，隐藏或禁用所有生成/编辑/重做按钮。

• creator：开放创作/检查/导出按钮；规则矩阵编辑按钮置灰只读；「2. 主管批准发布包」按钮仅在无权限测试模式外默认不可点，若误触由后端返回 `403` 提示。

• approver：开放规则矩阵编辑与「2. 主管批准发布包」弹窗。

• Loading / Error / Empty 三态：

• Loading：生成与同步过程展示分步骨架屏与进度百分比条（如 正在写入 IPTC 双标签...）。

• Error：节点未配置（M7-5031）或 MIME 失败（M7-4241）在对应面板展示醒目红色告警卡片并附「重试」或「检查环境」按钮，绝不清空前序已完成资产。

• Empty：未选商品或未生成套图时展示引导空状态与一键跳转到前置步骤 CTA。

#### 10. 非功能设计

| 维度 | 具体工程实现方案 |
| :--- | :--- |
| 性能与并发 | 1. 三层词库扫描使用预编译 Trie/AC 自动机缓存，单次扫描 P95 < 30ms。 2. 1+4 异步任务与 FFmpeg 合成置于 FastAPI 后台任务/Worker 池，不阻塞 HTTP 主事件循环；静态资源预览启用 ETag 与分片读取。 |
| 可用性与降级 | 云端文生图 API 超时（>25s）自动切换备用 LocalPillowFfmpegAdapter 合成高保真带背景商品图（并在审计标明降级来源）；视频节点未配置则按约束禁止静默降级造假，直接返 503。 |
| 可扩展性 | 通过 GeneratorAdapter 抽象基类解耦模型厂商，新增通义/豆包/ComfyUI 实现只需新增 Adapter 类并注册到 m7_workflow_registry。 |
| 缓存策略 | m7_compliance_rules 与 ProductFactSnapshot 缓存于进程内 LRU/Redis（TTL 5min），当 approver 修改规则矩阵时主动广播清除对应 org_id 缓存键。 |
| 限流、超时与重试 | 生成类高耗接口按 org_id + user_id 令牌桶限流（出图 10 req/min，视频 6 req/min）；外部云端 HTTP 客户端配置连接超时 5s、读取超时 30s，仅对幂等网络超时（502/504）最多指数退避重试 2 次。 |
| 幂等性保障 | 所有 POST 创建型接口强制或优先读取 X-Idempotency-Key 写入 uq_m7_job_idemp 唯一约束；重复请求在事务层直接返回既有 job_id。 |
| 日志、监控与审计 | 结构化 JSON 日志强制注入 trace_id、org_id、sku、actor_role；Prometheus 暴露 m7_job_duration_seconds、m7_compliance_block_total、m7_iptc_verify_fail_total；全部敏感业务动作写入不可篡改 core_audit_events。 |
| 安全设计 | 1. SQLi 防护：全量采用 SQLAlchemy ORM 参数化绑定。 2. XSS 防护：Vue3 模板自动转义 + 离线 HTML 导包使用 bleach/白名单转义。 3. CSRF/越权防护：JWT Bearer 鉴权 + 路径 org_id 与 Token org_id 强比对 + 服务层二次角色/禁自批校验。 4. 文件安全：禁止信任上传/外部返回后缀名，强制文件头魔数检测与路径穿越规范化（Path.resolve().is_relative_to(BASE_STORAGE)）。 |

#### 11. 异常与错误处理设计

##### 11.1 统一异常响应格式

| [json] {   "code": "M7-4221",   "message": "文案触发平台红线拦截，已阻止写入交付清单",   "trace_id": "req_a19f02",   "data": { "field": "title", "matched_ban_words": ["100% Cure"] } } |
| :--- |

##### 11.2 M7 业务错误码全表

| 错误码 | HTTP 状态 | 触发场景 | 前端提示策略 | 后端日志与审计 |
| :--- | :--- | :--- | :--- | :--- |
| M7-4001 | 400 | 请求参数格式错误或槽位索引越界 | 表单字段红色校验提示 | WARN 脱敏参数记录 |
| M7-4031 | 403 | 非授权角色调用写操作或规则修改 | 顶部权限不足 Toast 告警 | 写 core_audit_events(ok=false) |
| M7-4032 | 403 | creator 越权审批或 approver 自我批准 | 醒目 Modal 提示「违反职责分离」 | 写高危安全审计事件 |
| M7-4041 | 404 | SKU、任务、资产或规则不存在 | Empty 状态提示并返回列表 | INFO 记录 |
| M7-4091 | 409 | 乐观锁 version 冲突或重复导出锁 | 提示「内容已被更新，请刷新后重试」 | WARN 记录冲突版本号 |
| M7-4221 | 422 | 文案命中红线/商标/监管词或字节超限 | Inline 标红命中词与字节差值 | 写拦截审计（不写交付表） |
| M7-4222 | 422 | 合规 5 项检查未全通过或审批已失效 | 禁止批准按钮并高亮跳转缺项 | 写阻断审计 |
| M7-4241 | 424 | 生成图无输出或 MIME 魔数非 image/* | 任务失败卡片提示并支持重试 | ERROR 记录外部响应摘要 |
| M7-4242 | 424 | IPTC 磁盘读盘丢失或视频流为空 | 高亮提示「需重新写入元数据」 | ERROR 记录文件 sha256 |
| M7-5031 | 503 | 视频节点未配置或 FFmpeg 不可用 | 如实报错卡片（保留图文资产） | ERROR 触发运维告警 |

• 日志脱敏规范：所有请求/错误日志自动掩码 Authorization、DASHSCOPE_API_KEY、VOLC_SECRET_KEY 等密钥字段，禁止打印原始二进制媒体流。

#### 12. 测试设计要点

与《CrossPilot-M7商品内容创作与合规交付测试用例》（V2.0，118 条）完全映射，自动化测试体系分层如下：

| 测试层级 | 技术工具 | 核心覆盖范围与必测用例 |
| :--- | :--- | :--- |
| 后端单元测试 | Pytest | 1. LexiconScanner 三层词库、全大写过滤、Amazon UTF-8 字节上限边界值。 2. IptcMetadataHandler 真实写入 PNG/JPEG 后裁剪模拟丢失 -> 读盘核验必返回 false。 3. RuleEvaluator 过期资质（expire_date < today）与 TikTok 授权缺失判定。 |
| API 契约与集成测试 | Pytest + httpx.AsyncClient + SQLite/PG 测试库 | 1. 全 22 个 RESTful 端点正常路径及 X-Idempotency-Key 幂等验证。 2. RBAC 矩阵压测：manager 全写接口 403、creator 改规则/审批 403、approver 自批自身修改包 403。 3. 上游改动（改文案/重绘/换分镜）后旧 m7_approval_records.is_active 必变 false。 4. 模拟外部图生图返回 text/html 错误页 -> 验证 m7_generation_media 零写入且返回 M7-4241。 |
| 前端组件测试 | Vitest + Vue Test Utils | 1. 文案红线高亮、字符计数器、还原 AI 原稿按钮。 2. 9 角色切换下按钮禁用与显隐逻辑。 3. m7d 买家预览抽屉与 8+N 缺失一键跳转对应路由。 |
| 端到端验收测试 | Playwright | 跑通端到端完整链路：选品 -> 生成并微调文案 -> 1+4套图 -> 裁剪丢失IPTC并重写修复 -> 15s短视频+单镜重做+A+ -> 续期资质 -> 5项全绿 -> 主管审批 -> 下载离线ZIP包。 |

#### 13. 部署与配置说明

##### 13.1 核心环境变量清单（.env）

| 变量名 | 示例值 | 说明 |
| :--- | :--- | :--- |
| M7_ENV | production / development | 运行环境标识 |
| DATABASE_URL | postgresql+asyncpg://cp:pass@db:5432/crosspilot | 主数据库（开发可用 sqlite+aiosqlite:///./m7_dev.db） |
| STORAGE_ROOT | /var/lib/crosspilot/m7_storage | 磁盘媒体与离线交付包根路径 |
| CLOUD_LLM_PROVIDER | dashscope / volcengine / mock | 文案与多模态 API 提供商 |
| DASHSCOPE_API_KEY | sk-***（运行时注入） | 阿里云百炼密钥（日志脱敏） |
| FFMPEG_BIN | /usr/bin/ffmpeg | FFmpeg 可执行路径（为空时触发未配置阻断） |
| VIDEO_ENGINE_ENABLED | true / false | 视频生成节点开关（测试未配置阻断场景） |
| M7_STRICT_SEPARATION_OF_DUTIES | true / false | 是否开启禁自批同人互斥（生产必须 true，单账号演示可置 false） |
| JWT_SECRET_KEY | <strong-random-secret> | 鉴权签名密钥 |

##### 13.2 迁移、启动与健康检查

| [bash] # 1. 环境前置校验（Python >= 3.11, Pillow, FFmpeg） python3 --version && ffmpeg -version \| head -n 1  # 2. 执行数据库建表迁移与规则/MOCK 种子初始化 alembic upgrade head python3 -m app.modules.m7_content.seed_rules  # 3. 启动 FastAPI 后端（绑定 0.0.0.0） uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2  # 4. 启动 Vue3 前端构建/开发服务 cd frontend && npm ci && npm run build |
| :--- |

• 健康检查探针：GET /healthz 校验数据库连接与 STORAGE_ROOT 可写性；GET /api/v1/orgs/{org_id}/m7/health 额外探测 FFmpeg 与外部云端引擎配置可用性（不泄露密钥）。

#### 14. 假设与待确认项

1. V1 虚拟交付边界：V1 仅交付本地 .html / .zip 离线包，若后续接入 Amazon SP-API / TikTok Shop 实盘推送，仅需新增 M7PublishDispatcher 适配器而不改动 M7-1~M7-4 数据库主结构。

2. 云端模型计费与配额：假设生产环境已由运维统一配置组织级 API Key 与月度配额；单租户超额限流阈值（当前默认 10 套图/分钟、6 视频/分钟）待正式上线前与商务运营确认。

3. 跨国对象存储迁移：V1 采用本地磁盘持久化路径（storage_key），后续切换至 MinIO/OSS 时仅需替换 FileStorage 实现类，不影响 m7_generation_media 表结构。

#### 15. 附录

##### 15.1 图文件附件清单（docs/attachments/）

| 序号 | 图名称 | Mermaid 源码路径 | 导出矢量图路径 | 所属章节 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | M7 领域模型类图 | ./attachments/class-m7-domain.mmd | ./attachments/class-m7-domain.svg | 3.2.1 |
| 2 | M7 分层架构类图 | ./attachments/class-m7-service.mmd | ./attachments/class-m7-service.svg | 3.2.2 |
| 3 | M7 系统用例图 | ./attachments/usecase-m7-content.mmd | ./attachments/usecase-m7-content.svg | 4 |
| 4 | M7-1 文案与扫描微调时序图 | ./attachments/sequence-m7-copy.mmd | ./attachments/sequence-m7-copy.svg | 5.1.2 |
| 5 | M7-2 套图与 IPTC 校验时序图 | ./attachments/sequence-m7-image.mmd | ./attachments/sequence-m7-image.svg | 5.2.2 |
| 6 | M7-3 视频与 A+ 详情时序图 | ./attachments/sequence-m7-video-aplus.mmd | ./attachments/sequence-m7-video-aplus.svg | 5.3.2 |
| 7 | M7-4 合规检查与审批导出时序图 | ./attachments/sequence-m7-compliance-export.mmd | ./attachments/sequence-m7-compliance-export.svg | 5.4.2 |

##### 15.2 核心术语表

| 术语 | 释义 |
| :--- | :--- |
| 1+4 套图 | 1 张纯白底主图 + 4 张差异化场景/卖点/细节/尺寸辅图组成的完整视觉套图组 |
| 三层词库 | 品牌必用词（绿色保底）、通用红线违禁词（直接拦截）、平台商标与医疗/认证监管词（严格拦截） |
| IPTC/XMP 双标签 | 遵循数字内容溯源标准的 trainedAlgorithmicMedia（AI 生成）与 contains-synthetic-performer（AI 真人出镜）元数据标签 |
| 8+N 交付清单 | 8 类基础必选交付件（主图1 + 辅图4 + 标题/卖点/长描 + 短视频 + A+）及随平台类目动态追加的 N 项资质/声明附件 |
| 禁自批门禁 | 职责分离控制：内容最后编辑者即使具有主管权限，也不得审批放行由其本人修改的同一商品交付包 |
