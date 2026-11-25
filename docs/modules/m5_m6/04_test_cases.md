# CrossPilot · M5·M6 销量预测与智能补货完整测试用例（V1.0）

> **对应文档**：`CrossPilot-M5M6销量预测与智能补货需求说明书`、`CrossPilot-M5M6销量预测与智能补货详细设计说明书`
> **覆盖范围**：冒烟（4 条）、功能与边界（12 条）、接口契约（8 条）、UI 交互（4 条）、兼容性（3 条）、性能（3 条）、RBAC 与安全（6 条）、容错恢复（3 条）、算法专项（4 条）、跨模块回归（3 条），共计 **50 条**。

---

## 0. 测试结构总览与基准环境

| 用例分类 | 前缀 | 数量 | 覆盖重点 |
|---|---|---|---|
| 冒烟测试 | `TC-M5M6-SMK-` | 4 | 预测选优、What-If 沙盒、补货审批生成 PO、分批收货完结 |
| 功能与边界 | `TC-M5M6-FN-` | 12 | 无销量拦截、状态机非法跃迁、超收/不良超收、空理由驳回 |
| 接口契约 | `TC-M5M6-API-` | 8 | 12 组 REST 端点返回格式、错误码 `M5-1003`/`F-2001~2003`、快照留痕 |
| UI 与交互 | `TC-M5M6-UI-` | 4 | 路线切换重算、创建草稿跳审批页、分批收货剩余量展示、告警高亮 |
| 兼容性 | `TC-M5M6-CMP-` | 3 | Chrome/Edge/Safari、1280px/768px 响应式、4 路线长表格横滑 |
| 性能测试 | `TC-M5M6-PRF-` | 3 | 单 SKU 回测 ≤ 40ms、全接口 P95 ≤ 120ms、并发审批安全 |
| RBAC 与安全 | `TC-M5M6-SEC-` | 6 | 禁自批 SoD、仓管收货专属、BI 复盘专属、跨租户隔离 |
| 容错恢复 | `TC-M5M6-REC-` | 3 | 审批或收货失败回滚一致性、422 保持表单、PO 取消回退在途 |
| 算法专项 | `TC-M5M6-AI-` | 4 | 两步取整公式、零需求不强买、WAPE/MAE 精确计算、0 实际销量不除零 |
| 跨模块回归 | `TC-M5M6-REG-` | 3 | M0 盘点联动预测重算；M6 PO 金额同步至 M2；M0 改价同步估算资金 |

- **基准测试环境**：组织 `org_demo`；样本商品 `SKU-00704`（含 45 天历史日销、`MOQ=100`、`pack_size=24`）及新零历史商品 `SKU-BRAND-NEW`。

---

## 1. 冒烟测试用例（TC-M5M6-SMK-01 ~ 04）

| 编号 | 角色 | 操作步骤 | 预期结果 |
|---|---|---|---|
| **TC-M5M6-SMK-01** | `planner` | 在 `/m5/forecast` 查询 `SKU-00704`（`sea` + `profit`） | 返回 `best_model`、WAPE/MAE 对比表、4 路线方案与两步取整 `qty_suggest` |
| **TC-M5M6-SMK-02** | `planner` | 在 `/m6/standard` 设置 `demand_multiplier=1.5` 运行沙盒 | 仿真输出 `simulated.qty_suggest >= baseline.qty_suggest`，不修改 DB 草稿 |
| **TC-M5M6-SMK-03** | `planner`→`approver` | `planner` 创建草稿并 `submit` → `approver` 调用 `approve` | 申请状态 `draft->pending_approve->approved`，生成 `po_id` (`created`) 并增在途 |
| **TC-M5M6-SMK-04** | `warehouse` | 对该 PO 执行 `ship` → `receive(60,5)` → `receive(remaining,0)` | PO 经过 `shipping->partial_received->fully_received`，原申请单自动 `closed` |

---

## 2. 功能与边界测试用例（TC-M5M6-FN-01 ~ 12）

| 编号 | 子类 | 测试场景与输入 | 预期结果 |
|---|---|---|---|
| **TC-M5M6-FN-01** | 反向 | 对刚新建无历史销量的 `SKU-BRAND-NEW` 调用 `GET /supply/forecast/{sku}` | 返回 `422 M5-1003`，不伪造日销曲线 |
| **TC-M5M6-FN-02** | 反向 | 对 `draft` 状态申请直接调用 `/approve` | 抛出 `422 F-2001` 非法状态跃迁 |
| **TC-M5M6-FN-03** | 反向 | 对 `approved` 状态申请再次调用 `/submit` 或 `/reject` | 抛出 `422 F-2001` |
| **TC-M5M6-FN-04** | 反向 | 驳回申请传空字符串 `reason=""` 或全空格 `"   "` | Pydantic 或状态机抛出 `422` (`F-2002`) |
| **TC-M5M6-FN-05** | 反向 | PO `order_qty=100`，累计收货 `receive_qty=101` | 抛出 `422 F-2003`（累计实收不可超过订购量） |
| **TC-M5M6-FN-06** | 反向 | 收货提交 `receive_qty=20, defect_qty=25`（不良品大于实收） | 抛出 `422 F-2003` |
| **TC-M5M6-FN-07** | 反向 | 对 `fully_received` 状态 PO 调用 `/cancel` | 抛出 `422 F-2001`（终态不可取消） |
| **TC-M5M6-FN-08** | 正向 | 对 `created` 或 `shipping` 状态 PO 提交合理原因 `/cancel` | PO 置为 `cancelled`，已加在途数扣回 |
| **TC-M5M6-FN-09** | 边界 | 沙盒参数越界 `demand_multiplier=0.1` 或 `service_level_override=0.999` | Pydantic 校验返回 `422` |
| **TC-M5M6-FN-10** | 正向 | `warehouse` 确认某条 `OPEN` 断货告警 `POST /alerts/{id}/ack` | 告警变为 `ACKED` 并记录 `ack_by` |
| **TC-M5M6-FN-11** | 反向 | 取消 PO 时传空原因 `cancel_reason=""` | 返回 `422` (`F-2002`) |
| **TC-M5M6-FN-12** | 边界 | 收货提交 `receive_qty=0` 或负数 | Pydantic 校验返回 `422`（单次收货需 `>0`） |

---

## 3. 接口契约、UI、兼容性与性能测试用例

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M5M6-API-01** | API | `GET /supply/forecast/{sku}` 传入非法路线 `route_code=rocket` 返回 `422` |
| **TC-M5M6-API-02** | API | `POST /supply/applies` 落库时将当前路线、目标、建议量完整存入 `snapshot_json` |
| **TC-M5M6-API-03** | API | `GET /supply/pos` 准确返回 `receive_qty`、`defect_qty`、`expect_arrive` |
| **TC-M5M6-API-04** | API | `POST /supply/weekly-reviews` 成功持久化并按倒序返回 |
| **TC-M5M6-API-05** | API | `GET /supply/forecast/SKU-NOT-EXIST` 返回 `404 M7-4041` |
| **TC-M5M6-API-06** | API | 所有申请提交、审批、驳回、收货、取消均写入 `module="M6"` 中文审计 |
| **TC-M5M6-API-07** | API | What-If 沙盒支持 `lead_prod_override=0` 边界（快速备货）正常计算 |
| **TC-M5M6-API-08** | API | 响应头包含 `X-Trace-Id` 与统一 JSON 信封 |
| **TC-M5M6-UI-01** | UI | `/m5/forecast` 切换 SKU 或路线时，模型对比表与 4 路线表实时刷新 |
| **TC-M5M6-UI-02** | UI | `/m6/smart` 提交创建补货草案后自动跳转 `/m6/applies` 并高亮待处理单 |
| **TC-M5M6-UI-03** | UI | `/m6/receiving` 清楚区分待收货、已收完 PO 与 `OPEN`/`ACKED` 告警状态 |
| **TC-M5M6-UI-04** | UI | `/m6/standard` 同屏并排对比基线方案与仿真方案的采购量及资金差额 |
| **TC-M5M6-CMP-01** | 兼容 | Chrome / Edge / Safari 最新版正常渲染 M5/M6 全部 7 个页面 |
| **TC-M5M6-CMP-02** | 兼容 | 1280px 与 768px 视口下 4 路线比较表与 14 日预测表支持横向滚动 |
| **TC-M5M6-CMP-03** | 兼容 | 周复盘输入长段落多行中文与符号时安全展示不溢出版面 |
| **TC-M5M6-PRF-01** | 性能 | 单 SKU 6 模型滚动回测 + 4 路线对比计算耗时 ≤ 40ms |
| **TC-M5M6-PRF-02** | 性能 | `GET /supply/forecast/{sku}` 与 `POST /supply/sandbox` P95 ≤ 120ms |
| **TC-M5M6-PRF-03** | 性能 | 并发提交两次 PO 收货，总收货不超过 `order_qty` 不产生脏写 |

---

## 4. 安全、容错、算法与跨模块回归用例

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M5M6-SEC-01** | 安全 | `planner` 提交申请后自调 `/approve` 或 `/reject` → **`403 M7-4031`** |
| **TC-M5M6-SEC-02** | 安全 | 构造 `submit_user == actor.user_id` 的 `/approve` 与 `/reject` 请求 → **`403 M7-4032`（禁自批）** |
| **TC-M5M6-SEC-03** | 安全 | `planner` 或 `approver` 调用 `/pos/{id}/receive` 或 `/ship` → **`403`**（权属 `warehouse`） |
| **TC-M5M6-SEC-04** | 安全 | `planner` 调用 `POST /supply/weekly-reviews` → **`403`**（复盘归 `bi_analyst`） |
| **TC-M5M6-SEC-05** | 安全 | `creator` / `cs` / `mock_buyer` 访问任意 `/supply/*` 接口 → **`403`** |
| **TC-M5M6-SEC-06** | 安全 | `org_other` 携带自身 org 上下文操作 `org_demo` PO → **`403`** |
| **TC-M5M6-REC-01** | 容错 | PO 取消时自动原子回退未收货部分的 `M0Inventory.in_transit` |
| **TC-M5M6-REC-02** | 容错 | 申请审批过程中若创建 PO 异常，申请状态回滚保持 `pending_approve` |
| **TC-M5M6-REC-03** | 容错 | `warehouse` 收货超量抛出 `422 F-2003` 后，PO 已收计数保持原值不变 |
| **TC-M5M6-AI-01** | 算法 | 净需求 190，`MOQ=100`，`pack_size=24` → 两步取整精确为 `192`（8 箱整） |
| **TC-M5M6-AI-02** | 算法 | 库存充足使净需求 `<= 0`（即使 `MOQ=120`）→ 建议补货量输出 `0`，不因 MOQ 强买 |
| **TC-M5M6-AI-03** | 算法 | 回测预测 `[12, 8]`、实际 `[10, 10]` → 绝对误差和 4，WAPE 精确 `20%`，MAE 精确 `2` |
| **TC-M5M6-AI-04** | 算法 | 实际历史总销量为 `0` 时，WAPE 不强算为 `0%`（返回 N/A 或安全标识，不除零崩溃） |
| **TC-M5M6-REG-01** | 回归 | M0-3 将 `SKU-00704` 库存盘点调整后，重新拉取 `/supply/forecast/SKU-00704` 建议量即时重算 |
| **TC-M5M6-REG-02** | 回归 | M6-3 批准创建新 PO 后，M2-2 `po_commitment_rmb` 实时增加对应人民币承诺金额 |
| **TC-M5M6-REG-03** | 回归 | M0-2 成本改价批准后，M6 创建新补货单的 `est_amount_rmb` 按新成本计算 |
