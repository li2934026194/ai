# CrossPilot · M0 店铺接入与商品主档详细设计说明书（LLD V1.0）

> **文档编号**：CP-M0-LLD-2026-V1.0
> **代码基线**：`backend/app/modules/m0_catalog/{models,schemas,service,router}.py`、`backend/app/contracts/product_catalog_contract.py`、`frontend/src/views/m0/*.vue`

---

## 1. 需求追溯矩阵（RTM）

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

## 2. 数据库物理表结构设计

### 2.1 `m0_shops`（店铺授权表）

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

### 2.2 `m0_products`（统一商品主档表）

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

### 2.3 `m0_cost_requests`（成本变更审批单表）

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

### 2.4 `m0_orders`、`m0_inventory` 与 `m0_supplier_quotes`

- **`m0_orders`**：`id` (PK), `org_id`, `order_id` (UQ with `org_id`), `shop_id`, `sku`, `order_date` (`DATE`), `qty` (`INTEGER > 0`), `revenue_usd` (`FLOAT >= 0`), `is_mock` (`BOOLEAN`), `status` (`SETTLED`/`SHIPPED`/`REFUNDED`)。
- **`m0_inventory`**：`inv_id` (PK), `org_id`, `warehouse_code`, `sku` (UQ with `org_id, warehouse_code`), `on_hand` (`INTEGER >= 0`), `in_transit` (`INTEGER >= 0`), `reserved` (`INTEGER >= 0`), `last_stocktake_by`, `updated_at`。
- **`m0_supplier_quotes`**：`quote_id` (PK), `org_id`, `sku`, `supplier_name`, `unit_price_rmb`, `moq`, `lead_days`, `is_simulated` (`BOOLEAN`, 默认 `TRUE`)。

---

## 3. 核心状态流转与错误码字典

### 3.1 成本变更审批状态机

```
[planner 提交改价] --> (PENDING: 快照 old_cost_usd, 锁定 proposer_id)
                           |
         +-----------------+-----------------+
         | approver 审批 (proposer != actor) |
         v                                   v
    [APPROVED]                          [REJECTED]
(事务更新 M0Product.unit_cost_usd)     (主档价格保持原样)
```

### 3.2 统一异常错误码字典

| HTTP 状态 | 业务错误码 | 触发场景 | 前端响应策略 |
|---|---|---|---|
| `401` | `M7-4011` | 缺失有效登录身份或组织上下文头 | 跳转角色确认提示并阻断操作 |
| `403` | `M7-4031` | 岗位缺乏对应 RBAC 权限码或跨租户访问 | 提示当前岗位权限边界，禁用写操作按钮 |
| `403` | `M7-4032` | `cost-requests/{id}/decide` 申请人试图自批 | 明确提示「违反职责分离：发起人禁止自批」 |
| `404` | `M7-4041` | 操作不存在的 `sku` 或 `request_id` | 提示刷新台账确认记录是否存在 |
| `409` | `M7-4091` | 重复 `shop_code` 或重复 `sku`；非 `PENDING` 单重复审批 | 提示编码冲突或该申请已被处理 |
| `422` | `M7-4221` | `sale_price_usd <= 0`、`unit_cost_usd < 0` 或 CSV 格式非法 | 保留用户输入并定位报错字段 |

---

## 4. REST API 完整契约与审计模板

统一路径前缀：`/api/v1/orgs/{org_id}/m0`

| 端点 | 方法 | 权限码 | 请求 Schema | 审计 `action_code` & 中文日志模板 |
|---|---|---|---|---|
| `/shops` | `GET` / `POST` | `m0:read` / `m0:shop:manage` | `ShopCreateReq` | `SHOP_CONNECTED`: `连接店铺 {shop_code}（{platform}，MOCK={is_mock}）` |
| `/products` | `GET` / `POST` | `m0:read` / `m0:cost:propose` | `ProductCreateReq` | `PRODUCT_CREATED`: `创建商品主档 {sku}，售价 ${sale_price_usd}` |
| `/cost-requests` | `POST` | `m0:cost:propose` | `CostProposeReq` | `COST_PROPOSED`: `申请修改 {sku} 成本：${old} -> ${new}` |
| `/cost-requests/{id}/decide` | `POST` | `m0:cost:approve` | `CostDecideReq` | `COST_DECIDED`: `审批 {sku} 成本变更（{decision}）` |
| `/orders/import-csv` | `POST` | `m0:cost:propose` | `CsvOrderImportReq` | `ORDERS_CSV_IMPORTED`: `CSV 导入 {imported} 单，跳过重复 {skipped} 单` |
| `/inventory/stocktake` | `POST` | `m0:inventory:edit` | `StocktakeReq` | `INVENTORY_STOCKTAKE`: `人工盘点 {wh}/{sku}：在库由 {old} 校准为 {new}` |

#### 请求/响应 JSON Payload 示例

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

## 5. 前端架构与视图交互设计（`frontend/src/views/m0/`）

1. **`M0ShopsView.vue`**：顶部四格巡检卡（总数/实盘/演示/异常）；演示店铺显式渲染红色 `MOCK 不计营收` 徽章；新增表单支持 `platform`/`currency`/`is_mock` 校验。
2. **`M0LedgerView.vue`**：分段选项卡或分块展示「主档列表 + 新增 SKU」「成本变更审批区」「订单台账 + CSV 粘贴/本地文件上传（V1.1 补前 10 行预览与测试文件名检测）」「1688 模拟比价表」。
3. **`M0InventoryView.vue`**：按仓库/SKU 表格展示 `on_hand`（`<30` 红字告警）、`in_transit`、`reserved` 口径说明条及盘点直通表单；非 `warehouse` 岗位只读提示 `403` 权限边界。
4. **防重提交与错误降级**：所有提交按钮绑定 `submitting` 状态锁，后端非 `200` 统一解析 `error.message` 在页面横幅展示，不静默吞错。
