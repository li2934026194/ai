# CrossPilot · M2·M3 经营分析与智能问数完整测试用例（V1.0）

> **对应文档**：`CrossPilot-M2M3经营分析与智能问数需求说明书`、`CrossPilot-M2M3经营分析与智能问数详细设计说明书`
> **覆盖范围**：冒烟（4 条）、功能正反边界（10 条）、接口契约（6 条）、UI 交互（4 条）、兼容性（3 条）、性能（3 条）、RBAC 与安全隔离（6 条）、容错恢复（3 条）、问数与口径专项（4 条）、跨模块回归（4 条），共计 **47 条**。

---

## 0. 测试结构总览与基准环境

| 用例分类 | 前缀 | 数量 | 覆盖重点 |
|---|---|---|---|
| 冒烟测试 | `TC-M2M3-SMK-` | 4 | 首页工作台、广告预算调节、大屏利润聚合、竞品添加与智能问数 |
| 功能与边界 | `TC-M2M3-FN-` | 10 | 写意图拦截、多币种独立展示、参数边界、不存在 ID、结算状态展示 |
| 接口契约 | `TC-M2M3-API-` | 6 | 响应结构、30日趋势排序、PO 取消不计承诺金、审计落库 |
| UI 与交互 | `TC-M2M3-UI-` | 4 | 首页待办跳正确路由、广告行内编辑、大屏跳转问数、差评标签渲染 |
| 兼容性 | `TC-M2M3-CMP-` | 3 | Chrome/Edge/Safari、1280px/768px KPI 网格自适应、长问答折行 |
| 性能测试 | `TC-M2M3-PRF-` | 3 | 跨 6 模块大屏聚合 ≤ 150ms、广告/竞品写接口 ≤ 80ms、连续问数 |
| RBAC 与安全 | `TC-M2M3-SEC-` | 6 | 管理者只读约束、BI 与运营权责边界、无关角色阻断、租户隔离 |
| 容错恢复 | `TC-M2M3-REC-` | 3 | 空订单不除零崩溃、422 保留输入、写拦截不污染对话历史 |
| 口径专项 | `TC-M2M3-AI-` | 4 | M3-2 与 M2-2 口径一致、写意图拦截、溯源标注、USD/RMB 不混加 |
| 跨模块回归 | `TC-M2M3-REG-` | 4 | M1 退款扣净利、M6 PO 承诺金、M0 订单增 GMV、M0 模拟订单隔离 |

- **基准测试环境**：组织 `org_demo`；测试角色 `manager`、`bi_analyst`、`planner`、`approver`、`mock_buyer`。

---

## 1. 冒烟测试用例（TC-M2M3-SMK-01 ~ 04）

| 编号 | 角色 | 操作步骤 | 预期结果 |
|---|---|---|---|
| **TC-M2M3-SMK-01** | `manager` | 打开 `/home` 与 `/m2/overview` | 展示 6 项首页 KPI、4 项待办、SKU 盈利拆解表与两渠道结算表 |
| **TC-M2M3-SMK-02** | `planner` | 在 `/m2/ads` 将 `camp_amz_704` 日预算改为 `95` 并点击「暂停」 | HTTP 200；状态更新为 `PAUSED`、`daily_budget_usd=95`；写审计 `AD_ADJUSTED` |
| **TC-M2M3-SMK-03** | `bi_analyst` | 在 `/m3/competitors` 新增竞品 `Nesco Pro` / `B0C998877`，售价 `28.9` | HTTP 200；监控列表新增记录并带默认痛点 |
| **TC-M2M3-SMK-04** | `bi_analyst` | 在 `/m3/ask` 点击预设问题「当前整体毛利率与哪个 SKU 利润贡献最高？」 | 展示实时 GMV、净利、最高贡献 SKU、广告/退款扣减与口径溯源 |

---

## 2. 功能与边界测试用例（TC-M2M3-FN-01 ~ 10）

| 编号 | 子类 | 测试场景与输入 | 预期结果 |
|---|---|---|---|
| **TC-M2M3-FN-01** | 安全 | 在 M3-2 输入 `"DELETE FROM m0_orders"` 或 `"把 SKU-00704 售价修改为 1 美元"` | 触发【只读安全拦截】，拒绝执行且数据库无任何修改 |
| **TC-M2M3-FN-02** | 口径 | 检查 M2-2 `po_commitment_rmb`（RMB）与 `total_gmv_usd`（USD）展示 | 分币种加前缀 `$` 与 `¥` 展示，绝不直接数字混加 |
| **TC-M2M3-FN-03** | 反向 | 广告调价输入 `daily_budget_usd=0` 或 `-20` | Pydantic 返回 `422` 拦截 |
| **TC-M2M3-FN-04** | 反向 | 广告调价传入 `status="STOPPED"`（非 `ACTIVE`/`PAUSED`） | 返回 `422` |
| **TC-M2M3-FN-05** | 反向 | 对不存在广告 `camp_ghost` 调用 `/adjust` | 返回 `404 M7-4041` |
| **TC-M2M3-FN-06** | 边界 | 新增竞品输入 `rating=0.5` 或 `rating=5.5` | 超出 `1.0~5.0` 范围，返回 `422` |
| **TC-M2M3-FN-07** | 边界 | 新增竞品输入 `price_usd=0` 或 `bsr_rank=0` | 返回 `422` |
| **TC-M2M3-FN-08** | 正向 | 检查 `M2Overview` 中的 `trend_30d` 数组 | 按 `date` 升序排列且不超过最近 30 天 |
| **TC-M2M3-FN-09** | 正向 | 检查 `settlements` 中 Amazon US 与 TikTok Shop US 扣减计算 | 净结算 = 毛收入 - 佣金 - 广告/退款，无 `NaN` 或负零异常 |
| **TC-M2M3-FN-10** | 边界 | 新增竞品 `competitor_brand=""` 或 `asin_or_ref` 少于 2 字 | Pydantic 返回 `422` 拦截 |

---

## 3. 接口契约、UI、兼容性与性能测试用例

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M2M3-API-01** | API | `GET /home/workbench` 返回 `kpis` 与 `todos` 全部结构字段，待办路由均为有效前端路径（`/m4/approval`, `/m6/applies`, `/m7/compliance`, `/m1/aftersales`） |
| **TC-M2M3-API-02** | API | `GET /m2/overview` 统计的 `po_commitment_rmb` 自动排除 `status == "cancelled"` 的已取消采购单 |
| **TC-M2M3-API-03** | API | `POST /m2/ads/{id}/adjust` 与 `POST /m3/competitors` 均写入对应 `M2`/`M3` 中文审计记录 |
| **TC-M2M3-API-04** | API | 响应头带 `X-Trace-Id`，错误统一信封格式 |
| **TC-M2M3-API-05** | API | `POST /m3/ask` *(V1.1)* 对写指令返回安全阻断状态并写 `ASK_WRITE_BLOCKED` 审计 |
| **TC-M2M3-API-06** | API | `GET /m2/overview` 在 `m0_orders` 为空时 `margin_pct` 安全返回 `0.0`（不出现除零 500） |
| **TC-M2M3-UI-01** | UI | `/home` 点击 4 条待办的「立即处理 →」均准确跳转至目标业务页不出现空白页 |
| **TC-M2M3-UI-02** | UI | `/m2/overview` 点击「追问智能助手 →」顺畅跳入 `/m3/ask` |
| **TC-M2M3-UI-03** | UI | `/m3/competitors` 差评痛点数组以标签徽章优雅折行渲染 |
| **TC-M2M3-UI-04** | UI | `/m2/ads` 行内修改预算点击保存后刷新仍持久化保持新预算 |
| **TC-M2M3-CMP-01** | 兼容 | Chrome / Edge / Safari 最新版正常渲染 `/home` 与 M2/M3 四页 |
| **TC-M2M3-CMP-02** | 兼容 | 1280px 与 768px 视口下 KPI 四列网格平滑折行为 2 列或 1 列不重叠 |
| **TC-M2M3-CMP-03** | 兼容 | M3-2 问数返回多行数据表格与长中文解释时折行清晰 |
| **TC-M2M3-PRF-01** | 性能 | 1,000 条订单 + 30 天趋势下 `GET /m2/overview` 与 `GET /home/workbench` P95 ≤ 150ms |
| **TC-M2M3-PRF-02** | 性能 | `POST /m2/ads/{id}/adjust` 与 `POST /m3/competitors` P95 ≤ 80ms |
| **TC-M2M3-PRF-03** | 性能 | 连续 10 次触发 M3-2 问数与大屏刷新无内存泄漏或卡顿 |

---

## 4. 安全、容错、问数口径与跨模块回归用例

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M2M3-SEC-01** | 安全 | `manager` / `approver` 调用 `POST /m2/ads/{id}/adjust` 或 `POST /m3/competitors` → **`403 M7-4031`** |
| **TC-M2M3-SEC-02** | 安全 | `planner` 调用 `POST /m3/competitors` → **`403`**（竞品维护权归 `bi_analyst`） |
| **TC-M2M3-SEC-03** | 安全 | `creator` / `selector` / `warehouse` / `cs` 访问 `/m2/overview` / `/m2/ads` / `/m3/competitors` → **`403`** |
| **TC-M2M3-SEC-04** | 安全 | `mock_buyer` 访问 `/home/workbench` 与全部 M2/M3 接口 → **`403`** |
| **TC-M2M3-SEC-05** | 安全 | 跨租户 `X-Actor-Org-Id: org_other` 请求 `org_demo` 广告调整 → **`403`** |
| **TC-M2M3-SEC-06** | 安全 | 在 M3-2 提问框输入 `<script>alert(1)</script>` 或 SQL 拼接 `' OR 1=1 --`，安全转义且无 SQL 注入 |
| **TC-M2M3-REC-01** | 容错 | 全新空组织 `m0_orders` 为空时打开 `/m2/overview`，页面展示 `0` 值与友好空态，不抛 500 |
| **TC-M2M3-REC-02** | 容错 | 新增竞品校验失败返回 422 后，已填表单字段保留方便修改 |
| **TC-M2M3-REC-03** | 容错 | 在 M3-2 触发写拦截后可立即继续正常只读提问，对话不死锁 |
| **TC-M2M3-AI-01** | 口径 | M3-2 回答的总 GMV、预估净利、7日广告支出与 M2-2 大屏底层数值 100% 一致 |
| **TC-M2M3-AI-02** | 口径 | 校验 M3-2 拦截「改价/删单/修改库存/下采购单」全部 4 类写指令并附引导指引 |
| **TC-M2M3-AI-03** | 口径 | 校验 M3-2 每条合法回答末尾均显式附带【口径溯源】与未对接项说明 |
| **TC-M2M3-AI-04** | 口径 | 校验 `org_net_profit_usd` 严格遵循 `SKU净利之和 - 7日广告 - 已批售后退款` |
| **TC-M2M3-REG-01** | 回归 | M1-3 批准 `$30.00` 退款后，M2-2 `approved_refund_usd` 增加 `$30.00` 且 `net_profit_usd` 同步减少 `$30.00` |
| **TC-M2M3-REG-02** | 回归 | M6-3 批准采购单后，M2-2 `po_commitment_rmb` 同步增加；PO 取消后同步扣回 |
| **TC-M2M3-REG-03** | 回归 | M0-2 导入新实盘订单后，首页 `gmv_usd` 与 M2-2 `total_gmv_usd` 同步实时上升 |
| **TC-M2M3-REG-04** | 回归 | M0-2 导入 `is_mock=True` 测试订单后，V1.1 加固后的 M2-2 `total_gmv_usd` 保持不变 |
