# CrossPilot · M8 组织权限与平台底座完整测试用例（V1.0）

> **对应文档**：`CrossPilot-M8组织权限与平台底座需求说明书`、`CrossPilot-M8组织权限与平台底座详细设计说明书`
> **覆盖范围**：冒烟（4 条）、功能与边界（10 条）、接口契约（8 条）、UI 交互（4 条）、兼容性（3 条）、性能（3 条）、RBAC 与安全隔离（8 条）、容错恢复（3 条）、脱敏与口径专项（3 条）、跨模块回归（4 条），共计 **50 条**。

---

## 0. 测试结构总览与基准环境

| 用例分类 | 前缀 | 数量 | 覆盖重点 |
|---|---|---|---|
| 冒烟测试 | `TC-M8-SMK-` | 4 | 名册授权、在线调岗停用、9岗位矩阵、审批策略与中文审计 |
| 功能与边界 | `TC-M8-FN-` | 10 | 重名工号、非法角色枚举、停用保持历史签名、策略开关、审计按模块过滤 |
| 接口契约 | `TC-M8-API-` | 8 | HTTP 200/401/403/404/409/422、`X-Trace-Id`、不可删审计 |
| UI 与交互 | `TC-M8-UI-` | 4 | 侧边栏切岗实时刷新、ALLOWED/DENIED 徽章、矩阵只读提示 |
| 兼容性 | `TC-M8-CMP-` | 3 | Chrome/Edge/Safari、1280px/768px 权限矩阵横滑、长审计句折行 |
| 性能测试 | `TC-M8-PRF-` | 3 | 鉴权开销 ≤ 2ms、审计查询 P95 ≤ 60ms、并发写审计无锁死 |
| 安全与隔离 | `TC-M8-SEC-` | 8 | 全9岗边界、禁自批 SoD、`mock_buyer` 强隔离、伪造组织头、JWT篡改 |
| 容错恢复 | `TC-M8-REC-` | 3 | 主请求 403 回滚仍落审计、非法参数不影响现有成员、空模块筛查 |
| 脱敏与口径 | `TC-M8-AI-` | 3 | `sk-`/`Bearer` 脱敏、`enforce_sod` 默认全开、历史审计不可变 |
| 跨模块回归 | `TC-M8-REG-` | 4 | M0/M1/M4/M6/M7 全部审计写入 `M8-2`、全平台 `mock_buyer` 拦截 |

- **基准测试环境**：组织 `org_demo`；默认预置 9 名演示员工与 5 条审批策略（`M0`、`M1`、`M4`、`M6`、`M7`）。

---

## 1. 冒烟测试用例（TC-M8-SMK-01 ~ 04）

| 编号 | 角色 | 操作步骤 | 预期结果 |
|---|---|---|---|
| **TC-M8-SMK-01** | `manager` | 在 `/m8/users` 新增员工 `usr_new_cs`，岗位 `cs` | HTTP 200；员工名册展示 `usr_new_cs`，写 `USER_CREATED` 审计 |
| **TC-M8-SMK-02** | `approver` | 将 `usr_new_cs` 调岗为 `planner` 并设为停用 | 员工表状态更新；历史审计记录不被篡改，新增 `USER_UPDATED` |
| **TC-M8-SMK-03** | `manager` | 在 `/m8/roles` 核对权限矩阵与审批策略 | 准确渲染 9 个标准岗位及其权限集合与 5 大审批策略 |
| **TC-M8-SMK-04** | `approver` | 切换 `M4` 审批策略开关并筛选 `module=M8` 审计 | 策略状态切换成功，审计列表首位显示中文 `POLICY_TOGGLED` 记录 |

---

## 2. 功能与边界测试用例（TC-M8-FN-01 ~ 10）

| 编号 | 子类 | 测试场景与输入 | 预期结果 |
|---|---|---|---|
| **TC-M8-FN-01** | 反向 | 在同组织再次创建已存在 `user_id="usr_cs"` | 返回 `409 M7-4091` 拒绝重复工号 |
| **TC-M8-FN-02** | 反向 | 新增员工传非法角色 `role_code="super_admin"` | Pydantic 返回 `422` 拦截 |
| **TC-M8-FN-03** | 反向 | 新增员工 `display_name=""` 或 1 个空格 | 返回 `422` 拦截 |
| **TC-M8-FN-04** | 反向 | 对不存在工号 `usr_ghost` 调用 `PATCH /m8/users/usr_ghost` | 返回 `404 M7-4041` |
| **TC-M8-FN-05** | 正向 | 对员工执行调岗后检查该员工此前在其他模块留下的审计句子 | 历史审计内原角色与签名原样保留，未发生级联修改 |
| **TC-M8-FN-06** | 正向 | `GET /m8/audits?module=RBAC` 筛选越权记录 | 仅返回 `module == "RBAC"` 且按 `created_at DESC` 排序 |
| **TC-M8-FN-07** | 边界 | `GET /m8/audits?limit=1` 与 `limit=200` | 返回条数严格受 `limit` 限制；超出 `limit` 范围返回 `422` |
| **TC-M8-FN-08** | 反向 | 对不存在策略 ID `pol_ghost` 调用 `/toggle` | 返回 `404 M7-4041` |
| **TC-M8-FN-09** | 边界 | 演示模式下校验 `ROLE_PERMISSIONS` 返回的总角色数 | 精确为 9 个，且 `mock_buyer` 权限列表长度严格为 1 |
| **TC-M8-FN-10** | 正向 | 停用员工后再次重新启用（`is_active: false -> true`） | 状态正常恢复为 `在职启用`，产生两条独立审计 |

---

## 3. 接口契约、UI、兼容性与性能测试用例

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M8-API-01** | API | 所有 M8 接口响应符合 `{ok, data, error, trace_id}` 且带 `X-Trace-Id` |
| **TC-M8-API-02** | API | 尝试向 `/m8/audits` 发送 `DELETE` 或 `PUT` 请求 → HTTP `405 Method Not Allowed` |
| **TC-M8-API-03** | API | `PATCH /m8/users/{id}` 仅传 `is_active`（不传 `role_code`）部分更新成功 |
| **TC-M8-API-04** | API | `GET /m8/policies` 返回所有 5 个业务域策略并默认 `enforce_sod=true` |
| **TC-M8-API-05** | API | `POST /m8/users` 创建用户后可立即在 GET 列表中读到 |
| **TC-M8-API-06** | API | 缺失有效认证头且关闭演示开关时访问任意接口返回 `401 M7-4011` |
| **TC-M8-API-07** | API | `GET /m8/roles` 返回权限码列表有序排列且无重复项 |
| **TC-M8-API-08** | API | 非法角色更新 `PATCH /m8/users/{id}` `{role_code:"hacker"}` 返回 `422` |
| **TC-M8-UI-01** | UI | 侧边栏切换角色为 `cs` 后访问 `/m8/users`，页面清晰展示 `403` 无权提示不白屏 |
| **TC-M8-UI-02** | UI | `/m8/roles` 审计表格中 `ALLOWED` 渲染绿色徽章，`DENIED` 渲染红色徽章 |
| **TC-M8-UI-03** | UI | `/m8/roles` 切换模块筛选下拉框，审计表格即时按模块刷新 |
| **TC-M8-UI-04** | UI | `/m8/users` 点击「停用 / 启用」按钮立即生效且更新徽章文字 |
| **TC-M8-CMP-01** | 兼容 | Chrome / Edge / Safari 最新版访问 M8 两页与侧边栏切岗器正常交互 |
| **TC-M8-CMP-02** | 兼容 | 1280px 与 768px 视口下权限矩阵表格支持横向滚动不截断按钮 |
| **TC-M8-CMP-03** | 兼容 | 审计句子含双引号、尖括号或超长 SKU 串时安全转义展示 |
| **TC-M8-PRF-01** | 性能 | 单请求 `require_perm` 鉴权耗时 ≤ 2ms（不含 DB I/O） |
| **TC-M8-PRF-02** | 性能 | 累计 2,000 条审计日志下调用 `GET /m8/audits?limit=80`，P95 ≤ 60ms |
| **TC-M8-PRF-03** | 性能 | 并发 20 次触发 403 越权拦截，全部安全写审计无 SQLite/PG 锁冲突报错 |

---

## 4. 安全隔离、容错、脱敏与跨模块回归用例

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M8-SEC-01** | 安全 | `planner` / `creator` / `selector` / `bi_analyst` / `warehouse` / `cs` 访问 `/m8/users` → **`403`** |
| **TC-M8-SEC-02** | 安全 | `mock_buyer` 访问 `/m8/users`、`/m8/roles`、`/m8/audits` → **`403`** |
| **TC-M8-SEC-03** | 安全 | `X-Actor-Org-Id: org_other` 访问 `/api/v1/orgs/org_demo/m8/users` → **`403`** 跨租户拦截 |
| **TC-M8-SEC-04** | 安全 | 关闭 `M7_ENABLE_DEMO_ROLE_SWITCH=false` 后仅带 `X-Actor-Role: approver` 请求 → **`401`** |
| **TC-M8-SEC-05** | 安全 | 伪造过期或错误签名 `Authorization: Bearer fake.jwt.token` → **`401`** |
| **TC-M8-SEC-06** | 安全 | 在 `/m8/users` 输入 `<script>alert(1)</script>` 姓名入库，前端展示纯文本不执行脚本 |
| **TC-M8-SEC-07** | 安全 | 员工停用（`is_active=false`）后（V1.1），持原凭证访问平台接口 → **`401/403`** 阻断 |
| **TC-M8-SEC-08** | 安全 | 验证 5 大 SoD 流（M0改价/M1退款/M4过会/M6补货/M7发布）同人自批全部 **`403 M7-4032`** |
| **TC-M8-REC-01** | 容错 | 触发 `403` 越权抛出异常后，验证 `/m8/audits?module=RBAC` 中依然存在该次 `DENIED` 记录 |
| **TC-M8-REC-02** | 容错 | `POST /m8/users` 因重复工号 409 失败后，原有用户记录与权限完全不受损 |
| **TC-M8-REC-03** | 容错 | 审计模块筛选不存在值 `module=NONEXIST` 安全返回空数组 `[]`，不报 500 |
| **TC-M8-AI-01** | 脱敏 | 向 `write_audit_event` 传入含 `sk-1234567890abcdef` 文本，落库自动脱敏为 `***REDACTED***` |
| **TC-M8-AI-02** | 脱敏 | 错误响应中若包含 `Bearer eyJ...` 片段，统一被清洗脱敏不外泄 |
| **TC-M8-AI-03** | 口径 | 新建组织默认初始化 5 条 `enforce_sod=true` 策略与标准管理员，无缺失 |
| **TC-M8-REG-01** | 回归 | M0 连店、M1 建单、M4 评分、M6 审批、M7 导出完成后，在 `/m8/audits` 全部可查中文全链路 |
| **TC-M8-REG-02** | 回归 | 全平台所有模块越权请求均汇总至 `/m8/audits?module=RBAC` 统一安全态势看板 |
| **TC-M8-REG-03** | 回归 | 通过 M8 切换 `approver` 后，立即能审批 M0/M1/M4/M6/M7 待办单据 |
| **TC-M8-REG-04** | 回归 | 切换为 `mock_buyer` 后验证 8 个业务组中除 M1-4 模拟器外其余接口全部被挡在门外 |
