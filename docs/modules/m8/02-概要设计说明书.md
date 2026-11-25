# CrossPilot · M8 组织权限与平台底座概要设计说明书（HLD V1.0）

> **文档编号**：CP-M8-HLD-2026-V1.0
> **文档定位**：定义 M8 与平台公共安全底座（`core/`）的分层架构、双模认证拦截链、跨模块服务契约、量化性能指标与不可篡改审计体系。

---

## 1. 引言

### 1.1 编写目的

本概要设计说明书明确 CrossPilot 组织权限与平台底座（M8 + `core/`）的系统边界、鉴权网关链路、多租户隔离架构与中文审计落盘机制，为全平台 M0–M8 所有业务模块提供统一的安全基线。

### 1.2 范围

- **覆盖范围**：
  1. M8-1 员工名册与岗位授权（`m8a`）、M8-2 岗位权限矩阵与全平台审计台账（`m8b`）。
  2. 平台公共底座 `backend/app/core/`：配置中心、DB 会话、JWT/Header 身份解析、9 角色 RBAC、多租户门禁、独立事务中文审计、本地存储与异步任务队列。
- **不覆盖范围**：
  1. 不覆盖外部企业微信 / 飞书 / Okta SSO OIDC 联合登录实现（V2 保留）。
  2. 不覆盖具体业务模块（M0–M7）内部的审批流业务数据表，仅管控公共 `enforce_sod` 策略与统一审计台账。

### 1.3 术语表

| 术语 | 定义 |
|---|---|
| 双模认证 (`AuthMode`) | 线上 `Authorization: Bearer <HS256 JWT>` 与演示环境安全受控 Header 模式并存 |
| `SoD` (Separation of Duties) | 职责分离铁律：敏感审批业务单据的提交人与终审人不可为同一用户 |
| `Independent Audit Session` | 独立于业务事务的异步审计写库会话，确保 403/500 失败场景的拦截日志依然持久化 |
| `redact_secrets` | 日志与错误响应脱敏过滤器，自动掩码 `sk-*`、`Bearer *` 与敏感凭据 |

### 1.4 参考资料

1. 《CrossPilot-M8组织权限与平台底座需求说明书》（V1.0）
2. 《CrossPilot-M8组织权限与平台底座测试用例》（V1.0）
3. 《AI跨境电商平台-模块需求细化_V1.1》（M10 公共管理与任务审核）
4. 《AI跨境电商平台V1.0-软件需求规格说明书》（CM-01~07）

---

## 2. 总体设计

### 2.1 四项核心设计原则

1. **鉴权网关前置与零信任**：任何业务路由不信任前端隐藏按钮，所有端到端安全性由后端 `require_perm` 与 `org_id` 校验统一裁决。
2. **权限代码静态权威化**：9 角色到 `m0:*`~`m8:*` 的映射唯一固化于 `core/auth_rbac.py`，M8 页面矩阵仅供透明展示与核对，严禁运行时动态篡改代码边界。
3. **拦截记录永不回滚**：权限拒绝（403）或 SoD 拦截时，即使当前请求立即中止，系统依然通过独立数据库会话写入中文审计句，保证可审计性。
4. **凭证脱敏与最小暴露**：异常堆栈、HTTP 响应与审计文本在落盘前统一经过 `redact_secrets()` 清洗，防止 API Key/Token 泄露。

### 2.2 技术选型及理由

| 技术领域 | 选型方案 | 选型理由 |
|---|---|---|
| 身份令牌 | PyJWT (`HS256`) + FastAPI `Depends` | 轻量、无状态、支持过期时间校验与角色/组织声明注入 |
| 权限裁决 | `ROLE_PERMISSIONS` 静态集合 + `require_perm` 依赖工厂 | O(1) 集合包含检查，天然防止角色权限配置漂移 |
| 审计持久化 | `core/audit.py` + 独立 `AsyncSession` | 业务回滚不影响安全拦截审计落库，满足强安全合规 |
| 追踪与脱敏 | `trace_id` 中间件 + 正则凭证清洗 | 每个请求附带 `X-Trace-Id`，支持前端报错与后端审计精确串联 |

### 2.3 系统边界

- **本模块做什么**：组织与成员管理、在线调岗/停用、9 岗位矩阵展示、5 大模块审批策略开关维护、全平台多模块审计日志检索、JWT 签发与 Header 校验。
- **本模块不做什么**：不直接存储各业务模块审批单详情；不提供前端删除或清空历史审计日志的入口。

---

## 3. 系统架构与数据流图

### 3.1 分层架构与请求生命周期图

```
[浏览器 / API 客户端]
        |  HTTP Request (Bearer JWT 或 X-Actor-User-Id/Role/Org-Id)
        v
+-------------------------------------------------------------------+
| 1. TraceId 中间件: 生成/透传 X-Trace-Id, 捕获异常与敏感词脱敏         |
+---------------------------------+---------------------------------+
                                  v
+-------------------------------------------------------------------+
| 2. 身份与租户门禁: get_actor_context -> 核验 actor.org_id == {org_id}|
+---------------------------------+---------------------------------+
                                  v
+-------------------------------------------------------------------+
| 3. RBAC 权限裁决: require_perm(perm) -> 校验 ROLE_PERMISSIONS[role] |
|    --> 若失败: 独立事务写 RBAC 拦截审计 -> 抛出 HTTP 403 M7-4031     |
+---------------------------------+---------------------------------+
                                  v
+-------------------------------------------------------------------+
| 4. M0–M8 业务路由 & 服务层 (执行业务逻辑 + SoD 校验 + 写业务审计)     |
+-------------------------------------------------------------------+
```

### 3.2 系统权限控制与全局基础数据流图

![CrossPilot M8 平台角色权限矩阵与底座数据流图](/home/user/ai/docs/prototypes/dfd_v6/d00_rbac_roles.png)

![CrossPilot 全平台核心端到端数据流概览图](/home/user/ai/docs/prototypes/dfd_v6/d00_system_data_flow.png)

---

## 4. 模块划分与职责

| 子模块 | 归属路径 | 单一职责 | 依赖方向 |
|---|---|---|---|
| `core/auth_rbac.py` | 公共安全底座 | 解析 JWT/Header 上下文、校验 9 岗位 RBAC 权限码、控制演示切换开关 | 被所有 M0–M8 Router 依赖 |
| `core/audit.py` | 公共审计底座 | 写入标准中文审计句（支持独立会话提交与全局敏感凭据脱敏） | 被所有 M0–M8 Service 及 RBAC 调用 |
| `core/errors.py` & `trace.py` | 统一异常处理 | 生成统一 `{ok, data, error, trace_id}` JSON 信封与全局 `trace_id` | 挂载于 FastAPI App 根级 |
| `core/async_jobs.py` & `storage.py` | 公共基础设施 | 幂等异步长任务调度、防路径穿越安全文件存取（供 M7 等复用） | 被 M7 等异步生产模块调用 |
| `m8_org/service.py` | M8 领域服务 | 组织用户 CRUD、在职状态控制、9 岗位矩阵组装、审批策略与审计多条件查询 | 仅写 `m8_*` 表，只读 `core_audit_events` |

---

## 5. 功能模块设计（追溯至需求与用例）

| 子模块 | 对应需求条目 | 核心交互实体 | 对应验收编号 |
|---|---|---|---|
| M8-1 员工名册与调岗 (`m8a`) | 需求 3.1 | `M8Org`, `M8User` | M8-AC-02, M8-AC-05 |
| M8-2 矩阵/策略/审计 (`m8b`) | 需求 3.2 | `M8ApprovalPolicy`, `CoreAuditEvent` | M8-AC-01, M8-AC-02, M8-AC-06 |
| 底座门禁与双模认证 | 需求 1.4 | `ActorContext`, `ROLE_PERMISSIONS` | M8-AC-03, M8-AC-04 |

---

## 6. 数据设计

### 6.1 统一数据口径定义（全局安全规范）

1. **审计动作与状态口径**：`result_status` 仅允许 `ALLOWED`（绿标）与 `DENIED`（红标）；任何 `403` 权限或 SoD 拦截必须记录 `DENIED` 且 `module="RBAC"` 或对应业务域。
2. **停用账号生效口径**：`m8_users.is_active == False` 的成员立即失去 API 访问与待办分发资格（V1.1 强制拦截），历史记录保留其原姓名与角色不级联抹除。
3. **默认策略口径**：5 大模块审批策略在组织初始化时默认开启 `enforce_sod=True`。

### 6.2 核心表清单（不含字段明细）

| 表名 | 主键 | 职责说明 |
|---|---|---|
| `m8_orgs` | `org_id` | 多租户组织基本信息与地区/币种配置 |
| `m8_users` | `user_id` | 组织员工名册、岗位编码、邮箱及启用状态（V1.1 增 `password_hash`、`allowed_shop_ids`） |
| `m8_approval_policies` | `policy_id` | M0/M1/M4/M6/M7 审批规则阈值与 `enforce_sod` 开关 |
| `core_audit_events` | `event_id` | 全平台统一不可篡改中文自然语言操作与拦截审计日志 |
| `core_async_jobs` | `job_id` | 通用幂等异步长任务状态机表 |
| `core_storage_assets` | `asset_id` | 平台二进制资产文件元信息与 SHA-256 摘要表 |

---

## 7. 接口设计（接口清单）

| 接口路径 | 方法 | 权限码 | 职责 |
|---|---|---|---|
| `/api/v1/orgs/{org_id}/m8/users` | `GET` / `POST` | `m8:read` / `m8:manage` | 查询员工列表 / 新增成员 |
| `/api/v1/orgs/{org_id}/m8/users/{user_id}` | `PATCH` | `m8:manage` | 调岗或启停账号 |
| `/api/v1/orgs/{org_id}/m8/roles` | `GET` | `m8:read` | 获取 9 岗位标准权限矩阵 |
| `/api/v1/orgs/{org_id}/m8/policies` | `GET` | `m8:read` | 获取 5 大模块审批策略 |
| `/api/v1/orgs/{org_id}/m8/policies/{id}/toggle` | `POST` | `m8:manage` | 启用或停用审批策略 |
| `/api/v1/orgs/{org_id}/m8/audits` | `GET` | `m8:read` | 按模块与时间倒序查询中文审计台账 |
| `/api/v1/auth/login` *(V1.1)* | `POST` | 公开 | 账号密码校验签发 `HS256 JWT` |

---

## 8. 非功能设计

| 指标类别 | 目标基准 | 说明 |
|---|---|---|
| 鉴权门禁开销 | ≤ 2ms / 请求 | 内存集合 RBAC 匹配 + Header/JWT 解码 |
| 审计列表查询 P95 | ≤ 60ms | 支持按 `org_id`, `module`, `created_at` 复合索引检索 |
| 越权拦截审计成功率 | 100% | 独立 DB 会话提交，不受主请求回滚影响 |
| 密钥泄露拦截率 | 100% | `redact_secrets` 覆盖异常中间件与审计文本 |

---

## 9. 安全设计

1. **生产防伪造 Header**：当配置 `M7_ENABLE_DEMO_ROLE_SWITCH=false` 时，网关自动拒绝无签名的 `X-Actor-*` 伪造头，强制要求合法 `HS256 JWT`。
2. **禁止自举提权**：`ROLE_PERMISSIONS` 静态写入后端代码且不可通过 API 扩大；仅 `manager` 与 `approver` 拥有 `m8:manage`。
3. **防路径穿越**：`core/storage.py` 写入与读取文件严格规范化路径并限制在 `STORAGE_ROOT` 沙盒内。
4. **不可篡改台账**：`core_audit_events` 全系统仅提供 INSERT 与 SELECT，无 UPDATE/DELETE 接口。
5. **跨租户硬拒绝**：任何路径参数 `{org_id}` 与凭证内 `org_id` 不一致时立刻阻断并写入跨租户尝试告警。

---

## 10. 运行环境与外部依赖

- **运行环境**：Python 3.11+、FastAPI、PyJWT、SQLAlchemy 2.0 Async；前端 Vue 3 + Pinia 认证上下文存储。
- **配置项**：`M7_JWT_SECRET`（生产强制强随机秘钥）、`M7_ENABLE_DEMO_ROLE_SWITCH`、`M7_STRICT_SEPARATION_OF_DUTIES`。
