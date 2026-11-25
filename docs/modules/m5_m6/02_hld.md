# CrossPilot · M5·M6 销量预测与智能补货概要设计说明书（HLD V1.0）

> **文档编号**：CP-M5M6-HLD-2026-V1.0
> **文档定位**：定义 M5 预测与 M6 补货在 CrossPilot 平台中的分层架构、零依赖纯领域计算核隔离、多模型回测、双状态机流转、量化非功能与安全设计。

---

## 1. 引言

### 1.1 编写目的

本概要设计说明书明确 M5 销量预测与 M6 智能补货执行模块在 CrossPilot 模块化单体中的计算核架构、双状态机（补货申请 + 采购单）与跟 M0/M2 跨模块协作边界。

### 1.2 范围

- **覆盖范围**：M5-1~3 销量预测、回测与复盘（`m5a~c`）；M6-1~4 沙盒、路线对比、审批状态机、PO 分批收货与缺货告警中心（`m6a~d`）。
- **不覆盖范围**：V1 不覆盖真实 1688/ERP 采购付款接口、第三方头程海运追踪 Webhook 以及分布式 GPU 深度学习长序列训练任务调度。

### 1.3 术语表

| 术语 | 定义 |
|---|---|
| `domain/` 纯计算核 | 完全脱离 FastAPI 与 SQLAlchemy 的纯 Python 算法集，保障计算可复算与单测全覆盖 |
| 两步取整 (`two_step_round`) | 正净需求先 `max(net, moq)` 再向上取整至 `pack_size` 整数倍；非正需求返回 `0` |
| `snapshot_json` 快照冻结 | 补货草案创建/提交时冻结当时库存、预测日均与运费快照，防止审批前后遭暗改 |

### 1.4 参考资料

1. 《CrossPilot-M5M6销量预测与智能补货需求说明书》（V1.0）
2. 《CrossPilot-M5M6销量预测与智能补货测试用例》（V1.0）
3. 《AI跨境电商平台-模块需求细化_V1.1》（M06 / M07）
4. 《AI跨境电商平台V1.0-软件需求规格说明书》（FC-01~06 / RP-01~05）

---

## 2. 总体设计

### 2.1 四项核心设计原则

1. **领域计算核完全纯化**：缺货还原、滚动回测、安全库存、两步取整与状态机校验全部抽离到 `domain/` 纯函数模块，0 框架耦合。
2. **事实防造假原则**：无历史销量 SKU 立即阻断并抛 `422 M5-1003`；实际销量之和为 0 时绝不强算 WAPE=0%。
3. **审批快照冻结与 SoD**：`M6ReplenishApply` 提交审批锁定快照与 `submit_user`，由 `approver` 核查且禁自批。
4. **守恒校验与质检红线**：PO 累计收货绝不能超 `order_qty`，不良品不可计入可售库存。

### 2.2 技术选型及理由

| 技术领域 | 选型方案 | 选型理由 |
|---|---|---|
| 纯计算预测与库存引擎 | 零依赖纯 Python `m5_m6_supply/domain/` | 确定性数学运算、运行极快（<40ms）、可脱离数据库高频单测 |
| 状态流转机 | `domain/replenish_flow.py` | 统一作为申请单与采购单跃迁权威来源，防止业务代码漏判非法跃迁 |
| 持久化与快照 | SQLAlchemy 2.0 Async + `snapshot_json` | 保障批准申请单、创建 PO 与更新在途数处于同一 ACID 事务 |

### 2.3 系统边界

- **本模块做什么**：销量历史断货还原、6 模型滚动回测、What-If 沙盒仿真、4 路线 × 3 目标比较、补货申请审批流、PO 分批发货质检与断货告警中心。
- **本模块不做什么**：不直接调用外部付款转账 API；不绕过人工盘点凭收货单将未检验或不良品直接混入可售库存。

---

## 3. 系统架构与数据流图

### 3.1 分层架构图

```
+-----------------------------------------------------------------------+
| 表现层 (Vue 3): m5a~c (预测与复盘) | m6a~d (沙盒/路线/审批/收货与告警)   |
+-----------------------------------+-----------------------------------+
                                    | /api/v1/orgs/{org_id}/supply/*
+-----------------------------------v-----------------------------------+
| 网关与鉴权层: Tenant隔离 + RBAC (m5:read/run/review, m6:read/draft/...) |
+-----------------------------------v-----------------------------------+
| 应用编排层 (M5M6SupplyService): 装配 M0/M5 数据 + SoD + 事务写库 + 审计 |
+-----------------------------------v-----------------------------------+
| 纯计算领域核 (domain/):                                                 |
|  [demand 断货还原] [backtest 6模型] [inventory 两步取整] [routes] [flow] |
+---------+---------------------------------------------------+---------+
          | 只读读取                                           | 读写持久化
+---------v---------+                               +---------v---------+
| M0Product / Inv   |                               | m5_sales_history  |
| (成本/库存/MOQ)    |                               | m6_applies / pos  |
+-------------------+                               +-------------------+
```

### 3.2 销量预测数据流图（M5）

![CrossPilot M5 销量预测数据流图](/home/user/ai/docs/prototypes/dfd_v6/d05_forecast_agent.png)

### 3.3 智能补货与采购执行数据流图（M6）

![CrossPilot M6 智能补货数据流图](/home/user/ai/docs/prototypes/dfd_v6/d06_replenish_agent.png)

---

## 4. 模块划分与职责

| 子模块 | 归属层级 | 单一职责 | 同步/异步协作 |
|---|---|---|---|
| `domain/demand` & `backtest` | 纯领域层 | 断货日还原、6 种时序模型滚动回测与 WAPE/MAE 选优 | 同步纯函数 |
| `domain/inventory` & `routes` | 纯领域层 | 安全库存 SS、ROP、两步取整与 4 路线 × 3 目标比较 | 同步纯函数 |
| `domain/simulate` | 纯领域层 | What-If 交期/审阅期/服务水平/需求倍率仿真比较 | 同步纯函数 |
| `domain/replenish_flow` | 纯领域层 | 严格校验申请单与采购单状态跃迁及数量守恒边界 | 同步纯函数 |
| `M5M6SupplyService` | 应用编排层 | 装配 `M0Product`/`M0Inventory`/`M5SalesHistory`，控制 SoD 与写 `core_audit_events` | 同事务写 DB |

---

## 5. 功能模块设计（追溯至需求与用例）

| 子模块 | 对应需求条目 | 核心实体 / 引擎 | 对应验收编号 |
|---|---|---|---|
| M5-1/2 预测 (`m5a/b`) | 需求 3.1 | `M5SalesHistory`, `domain/{demand,backtest}` | M5M6-AC-01, M5M6-AC-02 |
| M5-3 误差复盘 (`m5c`) | 需求 3.1 | `M6WeeklyReview` | M5M6-AC-02 |
| M6-1/2 沙盒与路线 (`m6a/b`) | 需求 3.2 | `domain/{simulate,routes}`, `M6ReplenishApply` | M5M6-AC-03 |
| M6-3/4 审批与收货 (`m6c/d`) | 需求 3.2 | `domain/replenish_flow`, `M6PurchaseOrder`, `M6AlertEvent` | M5M6-AC-04, M5M6-AC-05, M5M6-AC-06 |

---

## 6. 数据设计

### 6.1 统一数据口径定义

1. **总提前期口径**：`L_eff = lead_time_days + route.transit_days`（生产交期 + 头程物流时效）。
2. **两步取整口径**：`net = Target - (on_hand + in_transit)`；`net <= 0` 输出 `0`；否则 `ceil(max(net, moq) / pack_size) * pack_size`。
3. **WAPE 误差口径**：`sum(|pred - actual|) / sum(actual)`；仅当 `sum(actual) > 0` 计算，否则标 `N/A`。

### 6.2 核心表清单（不含字段明细）

| 表名 | 主键 | 职责说明 |
|---|---|---|
| `m5_sales_history` | `id` | `(org_id, sku, sales_date)` 唯一历史日销与日末库存表 |
| `m6_replenish_applies` | `apply_id` | 补货申请草案、参数快照与审批流状态表 |
| `m6_purchase_orders` | `po_id` | 采购履约单与累计实收/不良/取消状态表 |
| `m6_alert_events` | `alert_id` | 低库存/断货风险告警与人工确认台账 |
| `m6_weekly_reviews` | `review_id` | 预测误差周复盘总结与评估指标沉淀 |

---

## 7. 接口设计（接口清单）

| 接口路径 | 方法 | 权限码 | 核心职责 |
|---|---|---|---|
| `/api/v1/orgs/{org_id}/supply/forecast/{sku}` | `GET` | `m5:read` | 多模型回测、建议补货量与 4 路线对比 |
| `/api/v1/orgs/{org_id}/supply/sandbox` | `POST` | `m5:run` | What-If 沙盒参数调优仿真 |
| `/api/v1/orgs/{org_id}/supply/applies` | `GET` / `POST` | `m6:read` / `m6:draft` | 补货申请列表 / 创建草稿 |
| `/api/v1/orgs/{org_id}/supply/applies/{id}/{submit,approve,reject}` | `POST` | `m6:draft` / `m6:approve` | 提交审批 / 终审生成 PO / 驳回 |
| `/api/v1/orgs/{org_id}/supply/pos` | `GET` | `m6:read` | 查询采购履约单 |
| `/api/v1/orgs/{org_id}/supply/pos/{id}/{ship,receive,cancel}` | `POST` | `m6:receive` | 发货 / 分批质检收货 / 取消回退在途 |
| `/api/v1/orgs/{org_id}/supply/alerts*` | `GET` / `POST` | `m6:read` / `m6:receive` | 告警列表 / 确认消警 |
| `/api/v1/orgs/{org_id}/supply/weekly-reviews` | `GET` / `POST` | `m5:read` / `m5:review` | 预测误差周复盘列表与发布 |

---

## 8. 非功能设计

| 指标类别 | 目标基准 | 说明 |
|---|---|---|
| 单 SKU 预测与 4 路线计算 | ≤ 40ms | 纯内存 NumPy/Python 运算无网络调用 |
| 全接口端到端响应 P95 | ≤ 120ms | 含 SQLite/PostgreSQL 查询与写审计 |
| 非法状态跃迁拦截率 | 100% | `replenish_flow` 统一拦截 `F-2001~2003` |
| 禁自批与角色分权拦截率 | 100% | `submit_user == actor.user_id` 必返 `403 M7-4032` |

---

## 9. 安全设计

1. **岗位权责四分离**：`planner`（起草/沙盒）≠ `approver`（审批下单）≠ `warehouse`（收货取消消警）≠ `bi_analyst`（误差周复盘）。
2. **禁止自批**：`approve` 与 `reject` 均强制校核 `submit_user != actor.user_id`。
3. **快照不可篡改**：批准生成 PO 的采购数量严格受已提交快照及申请量约束。
4. **租户全表隔离**：全部 5 张业务表带 `org_id` 索引。
5. **全量审计**：申请、提交、批准、驳回、发货、收货、取消、消警、周复盘 100% 写入中文审计。

---

## 10. 运行环境与外部依赖（对齐 V1.1 老师数据库与中间件标准）

- **运行环境**：Python 3.11+、FastAPI、SQLAlchemy 2.0 Async + `asyncpg`；**PostgreSQL 15+ 为正式主库**（单机开发演示兼容 SQLite 3.40+）；Vue 3 + TypeScript 前端工作台。
- **配套存储与计算栈**：时序预测回测（MA/EWMA/Holt/Seasonal）与补货优化基于 PostgreSQL 历史销量表在后端线程池执行；周期性预警扫描与长耗时 CSV 导入通过 **Redis + Celery Beat/Worker** 按需调度；采购/质检单据快照以 `JSONB` 存于 PostgreSQL，附件归档至 **MinIO**。
- **V1 零外网依赖**：所有时序模型回测与路线方案均本地计算完成，不依赖外部 GPU 或第三方预测 SaaS。
