# CrossPilot · M8 组织权限与平台底座详细设计说明书（LLD V1.0）

> **文档编号**：CP-M8-LLD-2026-V1.0
> **代码基线**：`backend/app/core/{auth_rbac,audit,errors,config,async_jobs,storage}.py`、`backend/app/modules/m8_org/{models,schemas,service,router}.py`、`frontend/src/views/m8/*.vue`

---

## 1. 需求追溯矩阵（RTM）

| 需求/原型编号 | 验收编号 | API / 底座接口 | 数据表 | 前端视图 |
|---|---|---|---|---|
| M8-1 员工名册 (`m8a`) | M8-AC-02, M8-AC-05 | `GET/POST /m8/users`, `PATCH /m8/users/{id}` | `m8_users` | `M8UsersView.vue` |
| M8-2 矩阵与策略 (`m8b`) | M8-AC-01 | `GET /m8/roles`, `GET /m8/policies`, `POST .../toggle` | `m8_approval_policies` | `M8RolesView.vue` |
| M8-2 全平台审计 (`m8b`) | M8-AC-02, M8-AC-06 | `GET /m8/audits?module=...&limit=...` | `core_audit_events` | `M8RolesView.vue` |
| 底座鉴权与拦截 | M8-AC-03, M8-AC-04 | `get_actor_context`, `require_perm`, `write_audit_event` | `core_audit_events` | `M7Sidebar.vue` |

---

## 2. 数据库物理表结构设计（PostgreSQL 15+ + Redis + Celery + MinIO）

> **全平台底座基础设施规范**：
> - **PostgreSQL 15+ (`asyncpg`)**：Alembic 迁移（`0001_init_m7.py` + `0002_platform_m0_m8.py`）全量兼容 PostgreSQL `JSONB`、`TIMESTAMPTZ`、布尔标准 `TRUE/FALSE` 默认值及局部唯一索引（`WHERE deleted_at IS NULL`）。
> - **Redis + Celery (`core/cache_queue.py`)**：缓存 Key `cp:{org_id}:m7:rules`（TTL 300s，规则变更即时 `delete_prefix` 广播清除）；Celery Broker/Backend 承载异步任务。
> - **MinIO (`core/storage.py`)**：统一对象存储 Bucket `crosspilot-assets`，支持自动建桶与本地磁盘无容器回退。
> - **健康探针（`GET /healthz`）**：实时返回 `database_dialect`、`storage_backend`、`redis_status`、`milvus_status`。

### 2.1 `m8_orgs`（组织租户表）& `m8_users`（员工名册表）

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

### 2.2 `m8_approval_policies`（审批策略表）& `core_audit_events`（审计表）

- **`m8_approval_policies`**：`policy_id` (PK), `org_id` (INDEX), `module_code` (`M0`/`M1`/`M4`/`M6`/`M7`), `policy_name`, `rule_summary`, `approver_role`, `enforce_sod` (`BOOLEAN`, 默认 `TRUE`), `is_enabled` (`BOOLEAN`, 默认 `TRUE`)。
- **`core_audit_events`**：`event_id` (PK), `org_id` (INDEX), `module` (INDEX), `action`, `actor_user_id`, `actor_role`, `sku` (NULLABLE), `result_status` (`ALLOWED`/`DENIED`), `sentence_zh` (`TEXT`), `trace_id`, `created_at` (INDEX)。

---

## 3. 权限代码字典与鉴权逻辑（`core/auth_rbac.py`）

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

## 4. REST API 完整契约

统一路径前缀：`/api/v1/orgs/{org_id}/m8`

| 端点 | 方法 | 权限码 | 请求 Schema | 错误码 & 审计 |
|---|---|---|---|---|
| `/users` | `GET` / `POST` | `m8:read` / `m8:manage` | `UserCreateReq` | `409 M7-4091`, `422`, 记 `USER_CREATED` |
| `/users/{user_id}` | `PATCH` | `m8:manage` | `UserUpdateReq` | `404 M7-4041`, `422`, 记 `USER_UPDATED` |
| `/roles` | `GET` | `m8:read` | — | `403 M7-4031` |
| `/policies` | `GET` | `m8:read` | — | `403 M7-4031` |
| `/policies/{id}/toggle` | `POST` | `m8:manage` | `PolicyToggleReq` | `404 M7-4041`, 记 `POLICY_TOGGLED` |
| `/audits` | `GET` | `m8:read` | Query `module`, `limit` | `403 M7-4031` |

#### 请求/响应 JSON Payload 示例

```json
// POST /api/v1/orgs/org_demo/m8/users
{ "user_id": "usr_qa_01", "display_name": "孙质检", "role_code": "warehouse", "email": "qa01@crosspilot.ai" }
// Response 200
{ "ok": true, "data": { "user_id": "usr_qa_01", "role_code": "warehouse", "is_active": true }, "error": null, "trace_id": "tr_m8_01" }
```

---

## 5. 前端视图组件规范（`frontend/src/views/m8/`）

- **`M8UsersView.vue`**：员工名册表（支持即时调岗下拉 + 停用/启用按钮）与新增授权表单；非 `m8:manage` 权限提示只读边界。
- **`M8RolesView.vue`**：9 岗位只读矩阵表 + 5 大审批流策略开关表 + 模块筛选审计台账表（`ALLOWED` 绿标 / `DENIED` 红标）。
- **`M7Sidebar.vue` & Pinia `auth` Store**：管理当前组织、角色上下文并在切换角色时自动触发当前页面重算刷新。
