# CrossPilot · M4 智能选品与过会决策完整测试用例（V1.0）

> **对应文档**：`CrossPilot-M4智能选品与过会决策需求说明书`、`CrossPilot-M4智能选品与过会决策详细设计说明书`
> **覆盖范围**：冒烟（4 条）、功能正反边界（10 条）、接口契约（6 条）、UI 交互（4 条）、兼容性（3 条）、性能（3 条）、RBAC 与安全隔离（6 条）、容错恢复（3 条）、算法/口径专项（4 条）、跨模块回归（3 条），共计 **46 条**。

---

## 0. 测试结构总览与基准环境

| 用例分类 | 前缀 | 数量 | 覆盖重点 |
|---|---|---|---|
| 冒烟测试 | `TC-M4-SMK-` | 4 | 候选导入、评估调参、提交审批、主管过会写回 M0+M7 |
| 功能与边界 | `TC-M4-FN-` | 10 | 售价/成本 0 与负值、五维分越界、空评语驳回、已决重复审批 |
| 接口契约 | `TC-M4-API-` | 6 | SKU 大写规范化、响应信封、审计落库、不存在 ID 404 |
| UI 与交互 | `TC-M4-UI-` | 4 | 实时毛利预览、左右联动工作台、审批后直达 M7 跳转 |
| 兼容性 | `TC-M4-CMP-` | 3 | Chrome/Edge/Safari、1280px/768px 双栏自适应、长标题不溢出 |
| 性能测试 | `TC-M4-PRF-` | 3 | 列表 P95 ≤ 80ms、过会写 M0 事务 ≤ 120ms、并发审批安全 |
| 安全与隔离 | `TC-M4-SEC-` | 6 | 禁自批 SoD、`selector`/`approver` 分权、无关角色阻断、租户隔离 |
| 容错恢复 | `TC-M4-REC-` | 3 | 写 M0 异常回滚 M4 状态、422 校验失败保留输入、断网重试幂等 |
| 算法专项 | `TC-M4-AI-` | 4 | 精确毛利公式、五维权重 1.0 检验、高精度防偷渡、汇率 7.2 成本回写 |
| 跨模块回归 | `TC-M4-REG-` | 3 | M4→M0 主档新增/升级、M4→M7-1 置顶待上新、M4 驳回不影响 M0 |

- **基准测试环境**：组织 `org_demo`；样本测试商品 `SKU-TEST-M4`（目标售价 `$29.99`，采购 `42 RMB`，头程 `18 RMB`）。

---

## 1. 冒烟测试用例（TC-M4-SMK-01 ~ 04）

| 编号 | 角色 | 操作步骤 | 预期结果 |
|---|---|---|---|
| **TC-M4-SMK-01** | `selector` | 在 `/m4/import` 录入 `sku=sku-new-88`，售价 `35.0`，采购 `50`，头程 `15` | HTTP 200；SKU 自动规范为 `SKU-NEW-88`，状态 `DISCOVERED`，精确算得毛利 |
| **TC-M4-SMK-02** | `selector` | 在 `/m4/workbench` 调高售价至 `39.99`、五维评分至 `[88,80,90,85,92]` 点击「保存评估」 | 状态更新为 `EVALUATING`，`total_score=87.1` |
| **TC-M4-SMK-03** | `selector` | 点击「保存并提交审批」 | 状态更新为 `PENDING_APPROVAL`，锁定 `submitter_id="usr_selector"` |
| **TC-M4-SMK-04** | `approver` | 在 `/m4/approval` 填批语点击「同意测款」 | 状态为 `APPROVED`，同步写入 `M0Product(origin="M4_APPROVED")` 并可在 M7-1 选用 |

---

## 2. 功能与边界测试用例（TC-M4-FN-01 ~ 10）

| 编号 | 子类 | 测试场景与输入 | 预期结果 |
|---|---|---|---|
| **TC-M4-FN-01** | 边界 | 导入候选传入 `target_price_usd=0` 或 `-10` | 返回 `422` 拦截 |
| **TC-M4-FN-02** | 边界 | 导入候选传入 `est_cost_rmb=0` 或 `est_shipping_rmb=-5` | 返回 `422` 拦截（采购需 `>0`，头程需 `>=0`） |
| **TC-M4-FN-03** | 边界 | 五维评估传入 `demand=105` 或 `compliance=-1` | 返回 `422` 拦截（严格限制 `0~100`） |
| **TC-M4-FN-04** | 反向 | 终审拒绝时 `note=""` 或仅 1 个字 | 返回 `422` 拦截（理由至少 2 字） |
| **TC-M4-FN-05** | 正向 | `approver` 选择 `REJECTED` 驳回候选品 | 状态变为 `REJECTED`，`M0Product` 不新增任何记录 |
| **TC-M4-FN-06** | 反向 | 对不存在的 `cand_ghost` 调用 `/evaluate` 或 `/decide` | 返回 `404 M7-4041` |
| **TC-M4-FN-07** | 正向 | 对已存在 M0 同名 SKU 的老品再经 M4-3 批准翻新 | `M0Product` 按新核算成本与售价升级并标 `origin="M4_APPROVED"`，不产生重复 SKU 报错 |
| **TC-M4-FN-08** | 边界 | `est_shipping_rmb=0`（国内免头程样本测试） | 正常入池并正确算出高毛利 |
| **TC-M4-FN-09** | 反向 | 终审接口传非法枚举 `decision="HOLD"` | 返回 `422` 拦截 |
| **TC-M4-FN-10** | 正向 | 评估时设 `submit_for_approval=false` 后二次修改再设 `true` | 状态平稳经历 `DISCOVERED -> EVALUATING -> PENDING_APPROVAL` |

---

## 3. 接口契约、UI、兼容性与性能测试用例

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M4-API-01** | API | 导入小写 `sku="abc-101"` 后响应与库内 `sku` 自动规范为 `"ABC-101"` |
| **TC-M4-API-02** | API | `GET /m4/candidates` 按 `updated_at DESC` 倒序返回 |
| **TC-M4-API-03** | API | 导入、评估、送审、过会、驳回 100% 写入 `module="M4"` 中文审计 |
| **TC-M4-API-04** | API | 响应头包含 `X-Trace-Id` 与统一 JSON 信封 |
| **TC-M4-API-05** | API | 过会批准后返回体携带 `m0_synced=true` 标志 |
| **TC-M4-API-06** | API | `POST /m4/candidates` 缺 `title` 或 `title` 少于 2 字返回 `422` |
| **TC-M4-UI-01** | UI | `/m4/import` 输入售价与采购价时卡片实时预览净毛利率百分比 |
| **TC-M4-UI-02** | UI | `/m4/workbench` 点击左列不同候选 SKU，右侧五维参数与评语同步切换 |
| **TC-M4-UI-03** | UI | `/m4/approval` 过会后渲染「前往 M7-1 内容制作 →」快捷入口 |
| **TC-M4-UI-04** | UI | 待审队列角标数量与实际 `PENDING_APPROVAL` 记录数 100% 吻合 |
| **TC-M4-CMP-01** | 兼容 | Chrome / Edge / Safari 最新版正常渲染 M4 三个工作台 |
| **TC-M4-CMP-02** | 兼容 | 1280px 与 768px 视口下左右双栏平滑堆叠，按钮不重叠 |
| **TC-M4-CMP-03** | 兼容 | 商品标题含特殊字符与长文本时不破坏卡片对齐 |
| **TC-M4-PRF-01** | 性能 | 500 个候选品池下 `GET /m4/candidates` P95 ≤ 80ms |
| **TC-M4-PRF-02** | 性能 | `POST /m4/candidates/{id}/decide` 含同事务写 M0 与审计 P95 ≤ 120ms |
| **TC-M4-PRF-03** | 性能 | 并发提交两次评估不产生数据损坏或 500 错误 |

---

## 4. 安全、容错、算法与跨模块回归用例

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M4-SEC-01** | 安全 | `selector` 提交后尝试自调 `/decide` → **`403 M7-4031`** |
| **TC-M4-SEC-02** | 安全 | 构造同 `user_id` 的 `approver` 自提自审调 `/decide` → **`403 M7-4032`（禁自批）** |
| **TC-M4-SEC-03** | 安全 | `approver` / `planner` / `manager` 调 `POST /m4/candidates` 或 `/evaluate` → **`403`** |
| **TC-M4-SEC-04** | 安全 | `creator` / `warehouse` / `cs` / `mock_buyer` 访问任意 `/m4/*` → **`403`** |
| **TC-M4-SEC-05** | 安全 | 跨租户 `X-Actor-Org-Id: org_other` 操作 `org_demo` 候选 → **`403`** |
| **TC-M4-SEC-06** | 安全 | 审批评语带 `<img src=x onerror=alert(1)>` 在列表按纯文本安全展示 |
| **TC-M4-REC-01** | 容错 | 终审写 `M0Product` 失败抛出异常时，`M4Candidate` 状态原子回滚保持 `PENDING_APPROVAL` |
| **TC-M4-REC-02** | 容错 | 评估提交 422 校验失败后前端保留用户输入方便修正 |
| **TC-M4-REC-03** | 容错 | 对已 `APPROVED` 候选品验证不重复插入多条同 SKU `M0Product` |
| **TC-M4-AI-01** | 算法 | 验证 `target_price_usd=30.0, est_cost_rmb=42.0, est_shipping_rmb=18.0` 精确算得 `(30 - 60/7.2 - 4.5)/30 = 57.22%` |
| **TC-M4-AI-02** | 算法 | 验证五维评分权重之和精确等于 `0.25+0.20+0.25+0.15+0.15 = 1.00` |
| **TC-M4-AI-03** | 算法 | 验证过会写回 `M0Product.unit_cost_usd` 精确为 `round((est_cost_rmb + est_shipping_rmb)/7.2, 2)` |
| **TC-M4-AI-04** | 算法 | 校验净毛利低于 30% 门槛（如 `29.99%`）不被误判放行 |
| **TC-M4-REG-01** | 回归 | M4-3 批准测款后，`GET /m0/products` 与 `GET /m7/products/available` 立即同步新增商品 |
| **TC-M4-REG-02** | 回归 | M4-3 驳回候选品后，M0 主档与 M7 可选商品列表保持零变更 |
| **TC-M4-REG-03** | 回归 | 过会审批完成后，`/home` 首页「选品待终审」待办数量精确减 1 |
