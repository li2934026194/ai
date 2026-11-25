# CrossPilot · M0 店铺接入与商品主档完整测试用例（V1.0）

> **对应文档**：`CrossPilot-M0店铺接入与商品主档需求说明书`、`CrossPilot-M0店铺接入与商品主档详细设计说明书`
> **覆盖范围**：冒烟（4 条）、功能正反边界（12 条）、接口契约（8 条）、UI 交互（4 条）、兼容性（3 条）、性能（3 条）、RBAC 与安全隔离（6 条）、容错与异常恢复（3 条）、智能/口径专项（3 条）、跨模块回归（4 条），共计 **50 条**。

---

## 0. 测试结构总览与基准环境

| 用例分类 | 前缀 | 数量 | 覆盖重点 |
|---|---|---|---|
| 冒烟测试 | `TC-M0-SMK-` | 4 | 连店、加品与成本审批、CSV 防重导入、人工盘点校准 |
| 功能与边界 | `TC-M0-FN-` | 12 | `shop_code`/`sku` 重名、0/负价格、自批、CSV 部分坏行、负盘点 |
| 接口契约 | `TC-M0-API-` | 8 | HTTP 200/403/404/409/422 信封、审计落库、`ProductCatalogContract` 脱敏 |
| UI 与交互 | `TC-M0-UI-` | 4 | MOCK 徽章渲染、低库存红字预警、提交防重锁、错误提示 |
| 兼容性 | `TC-M0-CMP-` | 3 | Chrome/Edge/Safari 适配、1280px/768px 响应式、超长 SKU/店铺名折行 |
| 性能测试 | `TC-M0-PRF-` | 3 | 列表 P95 ≤ 100ms、500 行 CSV ≤ 500ms、并发导入防重一致性 |
| 安全与隔离 | `TC-M0-SEC-` | 6 | 9 岗位越权、禁自批 SoD、跨租户隔离、CSV 公式注入过滤 |
| 容错恢复 | `TC-M0-REC-` | 3 | 部分坏行隔离不回滚合法行、事务失败回滚、重复点击防双入账 |
| 口径专项 | `TC-M0-AI-` | 3 | `is_mock` 过滤、`on_hand` 不扣 `reserved`、`in_transit` 不计可售 |
| 跨模块回归 | `TC-M0-REG-` | 4 | M4 过会写 M0、M0 供数 M7 脱敏、盘点重算 M5/M6、CSV 订单联动 M2 |

- **基准测试环境**：组织 `org_demo`；基准主档 `SKU-00704`（售价 `$39.99`，成本 `$10.50`，仓库 `WH-US-WEST` `on_hand=80, reserved=10, in_transit=50`）；测试账号覆盖 `manager`/`approver`/`planner`/`warehouse`/`selector`/`bi_analyst`/`creator`/`cs`/`mock_buyer`。

---

## 1. 冒烟测试用例（TC-M0-SMK-01 ~ 04）

| 编号 | 角色 | 操作步骤 | 预期结果 |
|---|---|---|---|
| **TC-M0-SMK-01** | `manager` | 在 `/m0/shops` 新建 `shop_code=SH-UK-01`，platform=`amazon_us`，`is_mock=false` | HTTP 200；店铺列表展示新店铺且状态为 `CONNECTED` |
| **TC-M0-SMK-02** | `planner`→`approver` | `planner` 对 `SKU-00704` 提改价 `$9.80` → `approver` 批准 | 批准前主档仍为 `$10.50`；批准后更新为 `$9.80` 并写 `COST_DECIDED` 审计 |
| **TC-M0-SMK-03** | `planner` | 在 `/m0/ledger` 导入含 2 条合法订单的 CSV 文本 | 返回 `imported=2, skipped_duplicates=0`，台账立即呈现 2 笔订单 |
| **TC-M0-SMK-04** | `warehouse` | 在 `/m0/inventory` 对 `WH-US-WEST / SKU-00704` 提交盘点 `counted_qty=120` | `on_hand` 更新为 `120`，`last_stocktake_by` 为当前仓管，写审计 |

---

## 2. 功能与边界测试用例（TC-M0-FN-01 ~ 12）

| 编号 | 子类 | 测试场景与输入 | 预期结果 |
|---|---|---|---|
| **TC-M0-FN-01** | 反向 | 在同组织再次创建已存在 `shop_code=SH-UK-01` | 返回 `409 M7-4091` 提示编码重复 |
| **TC-M0-FN-02** | 反向 | 在同组织创建重复 `sku=SKU-00704` | 返回 `409 M7-4091` 阻止覆盖主档 |
| **TC-M0-FN-03** | 边界 | 新增商品传 `sale_price_usd=0` 或 `unit_cost_usd=-1` | Pydantic 校验返回 `422` 拦截 |
| **TC-M0-FN-04** | 边界 | 新增商品 `moq=0` 或 `pack_size=0` 或 `lead_time_days=0` | 返回 `422`（必须 `>= 1`） |
| **TC-M0-FN-05** | 反向 | 成本变更请求传空理由 `reason="a"`（少于 2 字） | 返回 `422` 拦截 |
| **TC-M0-FN-06** | 正向 | `approver` 对成本单选择 `REJECTED` 并填写理由 | 申请状态置为 `REJECTED`，`M0Product.unit_cost_usd` 保持旧价不变 |
| **TC-M0-FN-07** | 反向 | 对已批准或已驳回的成本单再次调用 `/decide` | 返回 `409 M7-4091`（禁止重复审批） |
| **TC-M0-FN-08** | 幂等 | 同一批含 `ORD-CSV-01` 的 CSV 连续导入两次 | 第 1 次 `imported=1`，第 2 次 `imported=0, skipped_duplicates=1` |
| **TC-M0-FN-09** | 反向 | CSV 中第 2 行出现 `qty=-5` 或非数字 `revenue_usd="abc"` | 第 2 行记录进 `errors[]`，同批第 1 行合法订单仍成功入库 |
| **TC-M0-FN-10** | 边界 | 人工盘点传入 `counted_qty=0`（全盘零库存）vs `counted_qty=-1` | `0` 允许更新并亮低库存预警；`-1` 返回 `422` |
| **TC-M0-FN-11** | 反向 | 对不存在的 `SKU-GHOST` 发起成本变更或人工盘点 | 返回 `404 M7-4041` |
| **TC-M0-FN-12** | 口径 | 查验 `GET /m0/supplier-quotes` 返回字段 | 全部报价记录均携带 `is_simulated=true`，不影响 `M0Product.unit_cost_usd` |

---

## 3. 接口契约与 UI 测试用例（TC-M0-API-01 ~ 08 / TC-M0-UI-01 ~ 04）

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M0-API-01** | API | 全部 M0 响应均带 `X-Trace-Id` 与 `{ok, data, error, trace_id}` 标准信封 |
| **TC-M0-API-02** | API | `ProductCatalogContract.get_product_fact_snapshot` 返回不含 `unit_cost_usd` 与报价信息 |
| **TC-M0-API-03** | API | `POST /m0/shops` 传非法枚举 `platform="unknown"` 返回 `422` |
| **TC-M0-API-04** | API | `GET /m0/orders` 默认按 `order_date DESC` 倒序返回 |
| **TC-M0-API-05** | API | `POST /m0/orders/import-csv` 仅传表头无数据行时返回 `imported=0, errors=[]` |
| **TC-M0-API-06** | API | `POST /m0/inventory/stocktake` 自动覆盖更新 `on_hand` 与 `last_stocktake_by` |
| **TC-M0-API-07** | API | 连店、加品、改价、导入、盘点全量写入 `module="M0"` 中文自然语言审计 |
| **TC-M0-API-08** | API | 不存在 `request_id` 调用 `/cost-requests/cost_ghost/decide` 返回 `404 M7-4041` |
| **TC-M0-UI-01** | UI | `/m0/shops` 中 `is_mock=true` 店铺显式展示红色「仅演示不计营收」徽章 |
| **TC-M0-UI-02** | UI | `/m0/inventory` 中 `on_hand < 30` 行高亮低库存预警并显示「前往 M6 补货」链接 |
| **TC-M0-UI-03** | UI | `/m0/ledger` 切换角色为 `planner` 时隐藏主管审批按钮，切换为 `approver` 时显示 |
| **TC-M0-UI-04** | UI | 连店或盘点表单提交期间按钮锁定禁用，避免双击触发重复提交提示 |

---

## 4. 兼容性、性能、安全、容错、口径与回归用例

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M0-CMP-01** | 兼容 | Chrome / Edge / Safari 最新版打开 `/m0/shops`、`/m0/ledger`、`/m0/inventory` 无控制台报错 |
| **TC-M0-CMP-02** | 兼容 | 1440px / 1280px / 768px 视口下表格支持横向滚动，操作按钮不遮挡折行 |
| **TC-M0-CMP-03** | 兼容 | 商品名称含中英文混排、特殊字符 `"` / `&` / 60 字长名称时页面正确转义无截断错位 |
| **TC-M0-PRF-01** | 性能 | 单组织 1000 条订单下调用 `GET /m0/orders` 与 `GET /m0/products`，P95 ≤ 100ms |
| **TC-M0-PRF-02** | 性能 | 批量导入 500 行订单 CSV（含 100 条重复单号）总耗时 ≤ 500ms |
| **TC-M0-PRF-03** | 性能 | 并发两次同时发送相同 `ORD-RACE-01` CSV 请求，DB 最终仅入库 1 条（不报 500 崩溃） |
| **TC-M0-SEC-01** | 安全 | `planner` 提交改价申请后，构造同 `user_id` 的 `approver` 调 `/decide` → **`403 M7-4032`** |
| **TC-M0-SEC-02** | 安全 | `planner`/`approver`/`warehouse` 调用 `POST /m0/shops` → **`403 M7-4031`** |
| **TC-M0-SEC-03** | 安全 | `manager`/`planner`/`approver` 调用 `POST /m0/inventory/stocktake` → **`403`**（权属 `warehouse`） |
| **TC-M0-SEC-04** | 安全 | `mock_buyer` 访问任何 `/m0/*` 接口 → **`403`** |
| **TC-M0-SEC-05** | 安全 | `X-Actor-Org-Id: org_other` 请求 `org_demo` 主档或盘点 → **`403`** 跨租户隔离 |
| **TC-M0-SEC-06** | 安全 | CSV 中包含 `=CMD\|'/C calc'!A0` 恶意公式字符串入库及导出时不执行公式 |
| **TC-M0-REC-01** | 容错 | 导入含 3 条正常行 + 1 条缺字段坏行的 CSV，正常 3 条持久化，坏行在 `errors[]` 精确指明行号 |
| **TC-M0-REC-02** | 容错 | 成本审批期间模拟数据库写异常，成本申请单与商品主档成本保持事务一致回滚 |
| **TC-M0-REC-03** | 容错 | 断网重试重新提交同一批次订单 CSV，系统幂等跳过全部已存在单号 |
| **TC-M0-AI-01** | 口径 | 仓内 `on_hand=80, reserved=10`，校验 M5/M6 取到的净可售数为 `80`（绝非 `70`） |
| **TC-M0-AI-02** | 口径 | 在途 `in_transit=50` 且未提交 M0-3 盘点单时，`on_hand` 保持不变 |
| **TC-M0-AI-03** | 口径 | 存在缺失同步日期时不向 `m5_sales_history` 或 `m0_orders` 插入 0 销量假记录 |
| **TC-M0-REG-01** | 回归 | M4-3 批准测款新品后，M0-2 商品主档即刻新增 `origin="M4_APPROVED"` 记录 |
| **TC-M0-REG-02** | 回归 | M0-2 批准新成本后，M6 新建补货草案的采购估算金额按新成本计算 |
| **TC-M0-REG-03** | 回归 | M0-3 提交盘点校准后，M5-2 预测缺口与 M6-2 建议补货量即时重算 |
| **TC-M0-REG-04** | 回归 | M0-2 导入 `is_mock=false` 订单 `$100` 后，M2-2 实盘 GMV 增加 `$100`；导入 `is_mock=true` 订单不增加 |
