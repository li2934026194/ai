# CrossPilot · M5·M6 销量预测与智能补货详细设计说明书（LLD V1.0）

> **文档编号**：CP-M5M6-LLD-2026-V1.0
> **代码基线**：`backend/app/modules/m5_m6_supply/{domain/*,models,schemas,service,router}.py` & `frontend/src/views/m5m6/*.vue`

---

## 1. 需求追溯矩阵（RTM）

| 需求/原型编号 | 验收编号 | API 接口 | 数据表 / Domain 模块 | 前端视图 |
|---|---|---|---|---|
| M5-1/2 画像与预测 (`m5a/b`) | M5M6-AC-01/02/03 | `GET /supply/forecast/{sku}` | `m5_sales_history`, `domain/{demand,backtest,inventory}` | `M5ProfilesView`, `M5ForecastView` |
| M5-3 预测复盘 (`m5c`) | M5M6-AC-02 | `GET/POST /supply/weekly-reviews` | `m6_weekly_reviews` | `M5ReviewView` |
| M6-1 沙盒仿真 (`m6a`) | M5M6-AC-03 | `POST /supply/sandbox` | `domain/simulate` | `M6StandardView` |
| M6-2 智能路线 (`m6b`) | M5M6-AC-03 | `GET /supply/forecast/{sku}`, `POST /supply/applies` | `domain/routes`, `m6_replenish_applies` | `M6SmartView` |
| M6-3 审批下单 (`m6c`) | M5M6-AC-04/05 | `POST /supply/applies/{id}/{submit,approve,reject}` | `domain/replenish_flow`, `m6_purchase_orders` | `M6AppliesView` |
| M6-4 到货收货与告警 (`m6d`) | M5M6-AC-06 | `POST /supply/pos/{id}/{ship,receive,cancel}`, `alerts*` | `m6_purchase_orders`, `m6_alert_events`, `m0_inventory` | `M6ReceivingView` |

---

## 2. 数据库物理表结构设计（PostgreSQL 15+ 标准方言）

> **存储与事务规范**：基于 **PostgreSQL 15+ (`JSONB`, `TIMESTAMPTZ`, `asyncpg`)**；采购收货状态机 (`create_po -> ship -> receive -> cancel`) 采用行级事务与状态前置校验；周期性缺货预警扫描按需由 **Redis + Celery Beat** 触发；周复盘指标与采购快照使用 `JSONB` 持久化。

### 2.1 `m5_sales_history`（历史日销量流水表）

| 字段名 | SQL 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `INTEGER` | PK, AUTO | 自增主键 |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX, UQ(`org_id`,`sku`,`sales_date`) | 租户与 SKU |
| `sales_date` | `DATE` | NOT NULL, INDEX | 业务统计日期（不含当日未完结） |
| `qty_raw` / `on_hand_eod` | `FLOAT` | NOT NULL | 原始售出件数与日末库存（`0` 代表断货日） |
| `revenue_usd` | `FLOAT` | NOT NULL | 当日实盘销售额（USD） |

### 2.2 `m6_replenish_applies`（补货申请单表）

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

### 2.3 `m6_purchase_orders`、`m6_alert_events`、`m6_weekly_reviews`

- **`m6_purchase_orders`**：`po_id` (PK), `org_id`, `apply_id`, `sku`, `route_code`, `order_qty`, `receive_qty`, `defect_qty`, `status` (`created`/`shipping`/`partial_received`/`fully_received`/`cancelled`), `expect_arrive`, `actual_arrive`, `cancel_reason`。
- **`m6_alert_events`**：`alert_id` (PK), `org_id`, `sku`, `severity`, `alert_type`, `message`, `status` (`OPEN`/`ACKED`), `ack_by`。
- **`m6_weekly_reviews`**：`review_id` (PK), `org_id`, `week_label`, `summary_text`, `metrics_json`, `is_mock`, `created_by`。

---

## 3. 核心数学模型与双状态机规则

### 3.1 安全库存与两步取整算法（`domain/inventory.py`）

- **安全库存**：`SS = z * sigma * sqrt(L_eff + R)`（`z` 由服务水平决定：`0.98->2.05`, `0.95->1.65`, `0.90->1.28`）。
- **再订货点**：`ROP = mu * L_eff + SS`；**目标水位**：`Target = mu * (L_eff + R) + SS`。
- **净需求与两步取整**：`raw_net = max(0, Target - (on_hand + in_transit))`；若 `raw_net == 0` 返回 `0`；否则 `step1 = max(raw_net, moq)`，`qty_suggest = ceil(step1 / pack_size) * pack_size`。

### 3.2 纯状态机流转图与错误码（`domain/replenish_flow.py`）

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

## 4. REST API 完整契约

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

#### `POST /sandbox` Payload 示例

```json
// Request
{ "sku": "SKU-00704", "route_code": "air", "objective_mode": "sales", "demand_multiplier": 1.4 }
// Response 200
{ "ok": true, "data": { "baseline": { "qty_suggest": 180 }, "simulated": { "qty_suggest": 300 } }, "error": null, "trace_id": "tr_m6_01" }
```

---

## 5. 前端视图组件规范（`frontend/src/views/m5m6/`）

- `M5ProfilesView.vue` / `M5ForecastView.vue` / `M5ReviewView.vue`：画像历史覆盖天数、6 模型回测对比表 + 14 天趋势柱状/折线 + BI 周复盘提交表单。
- `M6StandardView.vue` / `M6SmartView.vue`：What-If 四参数滑块并排对比 + 4 路线对比选优直达生成补货草案。
- `M6AppliesView.vue` / `M6ReceivingView.vue`：申请单状态标签与禁自批提示；PO 发货/分批质检收货（实时显示剩余可收数）/取消按钮与告警中心分组列表。
