# PACK 23：RBAC 认证授权体系（as-built）

> 状态：已落地并通过专项测试；演示模式默认不改变旧接口行为，生产通过 `AUTH_ENABLED=1` 打开。
> 本文是给后续开发（WorkBuddy）与阿里云部署用的唯一 RBAC 口径，避免再从聊天记录里猜。

## 1. 目标与边界

用户要求：

1. 建立 `user`、`role`、`permission` 三张表，并建立多对多关联；
2. DAO 管理三张表及关联；
3. Service 作为外观模式，管理 RBAC 业务一致性；
4. 用户/角色/权限的 HTTP 管理接口；
5. 可靠权限装饰器：先校验 JWT，再拿用户权限与资源所需权限比对；
6. 登录接口，token 用 JWT，不把 token 放中间件或服务器本地内存；
7. 最小前端入口。

本实现是**应用内 RBAC + JWT**，不接飞书，不接 Keycloak。适合课程答辩与单台阿里云 ECS 部署；如果老师后续要求统一身份/SSO，再把 Keycloak/OIDC 作为外部 IdP 接入，不改现有权限模型。

## 2. 数据模型

表名统一 `rbac_` 前缀，避免 PostgreSQL 的 `user` 保留字与业务表冲突。

| 表 | 作用 | 关键字段 |
|---|---|---|
| `rbac_user` | 用户 | `id`、`username` 唯一、`password_hash`、`status`、`created_at/updated_at` |
| `rbac_role` | 角色 | `id`、`code` 唯一、`name`、`description` |
| `rbac_permission` | 权限 | `id`、`code` 唯一（如 `apply:approve`）、`resource`、`action` |
| `rbac_user_role` | 用户-角色关联 | `user_id` + `role_id` 联合主键，外键 CASCADE |
| `rbac_role_permission` | 角色-权限关联 | `role_id` + `permission_id` 联合主键，外键 CASCADE |
| `rbac_audit_log` | 鉴权审计 | 登录、拒绝、权限检查；只追加 |

模型定义在 `schema.py` 的 `RBACUser` / `RBACRole` / `RBACPermission` / `RBACAuditLog`，并已加入 `TABLE_MODELS`；`db.create_all()` 会幂等建表。

## 3. 分层

```
rbac/
├── config.py       # AUTH_ENABLED / JWT 密钥 / TTL / CORS
├── errors.py       # RBACError（真实 HTTP 401/403/404/409/400）
├── principal.py    # Principal 不可变主体
├── passwords.py    # scrypt 哈希（标准库，无 bcrypt/passlib）
├── jwt_tokens.py   # HS256 签发/校验
├── context.py      # ContextVar 请求级主体
├── dao.py          # 三张主表 + 关联表 CRUD
├── service.py      # 事务/一致性/种子/权限聚合
├── decorators.py   # @require_permission
├── api.py          # /api/auth/*、/api/rbac/*、鉴权中间件
└── bootstrap.py    # 建表 + seed_defaults
```

- **DAO 不 commit**，只 flush；事务边界由 Service 控制。
- **Service 不返回 ORM 对象**，统一转 dict，避免 Session 关闭后 lazy load。
- **装饰器不信任 token 里的 permissions 快照**：`RBACService.has_permission()` 每次查库，角色被撤销后旧 token 不会继续放行。
- **token 无状态**：服务端不保存 session，不把 token 写进中间件/全局变量；只在校验后放请求级 `ContextVar`，请求结束 reset。

## 4. 认证流程

1. `POST /api/auth/login` 提交 `username/password`；
2. `RBACService.authenticate()` 查用户、`scrypt` 校验、检查 `status=active`；
3. 签发 HS256 JWT：`sub=user_id`、`username`、`roles`、`permissions`、`iss`、`aud`、`iat`、`exp`；
4. 前端把 token 放 `Authorization: Bearer ...`；
5. 中间件校验签名/过期/issuer/audience，写入 `request.state.principal` 与 ContextVar；
6. 中间件按 `method + path` 找所需权限，`has_permission` 查库比对；不匹配返回 403；
7. Service 层的 `@require_permission(...)` 再做一次函数级校验（用于内部调用与非 HTTP 入口）。

401/403 使用真实 HTTP 状态码，不沿用项目原有的 HTTP 200 + `body.code` 业务错误约定，避免前端把鉴权失败当业务成功。

## 5. 权限码与角色

默认权限 19 个，见 `rbac/service.py:DEFAULT_PERMISSIONS`：

- 数据/看板：`dataset:read`、`dataset:import`、`ops:read`、`dashboard:read`、`sku:read`、`forecast:read`
- 补货/采购：`apply:read`、`apply:create`、`apply:approve`、`po:ship`、`po:receive`、`po:cancel`
- RBAC：`rbac:user:read/write`、`rbac:role:read/write`、`rbac:permission:read/write`
- 审计：`audit:read`

默认角色：

| 角色 | 能力 |
|---|---|
| `viewer` | 只读数据集/看板/SKU/申请 |
| `planner` | viewer + 提交补货申请 |
| `approver` | viewer + 审批/驳回申请 |
| `warehouse` | viewer + 采购单发货/收货 |
| `auditor` | viewer + 审计读取 |
| `admin` | 全部权限，含 RBAC 管理 |

生产建议：提交人不得审批自己；当前代码尚未在 `approve_apply` 内加“submit_user != approve_user”校验，属于后续加固项（不要在演示里宣称已实现四眼原则）。

## 6. HTTP 接口

### 登录

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录，返回 `access_token` / `expires_in` / `user` |
| GET | `/api/auth/me` | 当前 token 的用户、角色、权限快照 |

### 用户

| 方法 | 路径 | 权限 |
|---|---|---|
| GET | `/api/rbac/users` | `rbac:user:read` |
| POST | `/api/rbac/users` | `rbac:user:write`；body `username/password/display_name/role_codes/status` |
| PATCH | `/api/rbac/users/{id}` | `rbac:user:write`；可改密码、状态、角色 |
| DELETE | `/api/rbac/users/{id}` | `rbac:user:write`；最后一名启用管理员受保护 |

### 角色 / 权限

| 方法 | 路径 | 权限 |
|---|---|---|
| GET | `/api/rbac/roles` | `rbac:role:read` |
| POST | `/api/rbac/roles` | `rbac:role:write` |
| PATCH | `/api/rbac/roles/{id}` | `rbac:role:write`，可直接带 `permission_codes` |
| PUT | `/api/rbac/roles/{id}/permissions` | `rbac:role:write` |
| DELETE | `/api/rbac/roles/{id}` | `rbac:role:write`；仍被用户引用时拒绝 |
| GET | `/api/rbac/permissions` | `rbac:permission:read` |
| POST | `/api/rbac/permissions` | `rbac:permission:write` |
| DELETE | `/api/rbac/permissions/{id}` | `rbac:permission:write`；仍被角色引用时拒绝 |
| GET | `/api/rbac/audit?limit=` | `audit:read` |

### 既有业务端点

`permission_for()` 已登记：

- `GET /api/datasets` → `dataset:read`
- `POST /api/datasets/import` → `dataset:import`
- `GET /api/ops/summary` → `ops:read`
- `GET /api/p1/dashboard` → `dashboard:read`
- `GET /api/p2/skus` / `GET /api/p3/sku/{sku}` / `GET /api/p3/route-plan` → `sku:read`
- `POST /api/p3/apply` → `apply:create`
- `POST /api/p3/apply/approve|reject` → `apply:approve`
- `POST /api/p3/po/ship|receive|cancel` → `po:ship|receive|cancel`
- `GET /api/p3/applies` → `apply:read`
- `/api/health`、`/api/copy`、`/api/auth/login` 公开

## 7. 服务装饰器

```python
from rbac.decorators import require_permission

@require_permission("apply:approve")
def approve_apply(...):
    ...
```

行为：

- `AUTH_ENABLED=0`：跳过，保证演示模式旧调用不被破坏；
- `AUTH_ENABLED=1`：从 `kwargs["principal"]` 或请求 ContextVar 取 `Principal`；
- 无主体 → `RBACError(AUTH-401, 401)`；
- 有主体但无权限 → 写审计 `deny`，抛 `RBACError(AUTH-403, 403)`。

当前已装饰：`create_apply`、`approve_apply`、`reject_apply`、`cancel_po`、`ship_po`、`receive_po_goods`、`import_dataset_csv`。

业务路由还会用 JWT 用户名覆盖请求体里的 `submit_user/approve_user/operator`，防止登录用户伪造成别人。演示模式没有 token 时才保留请求体的 demo 字段。

## 8. 初始化与运行

```powershell
# 建表 + 默认权限/角色（不创建任何可登录用户）
.\.venv\Scripts\python.exe scripts\seed_rbac.py

# 同时创建管理员（密码至少 8 位；生产从环境变量注入，不要写进代码）
$env:RBAC_ADMIN_USERNAME="admin"
$env:RBAC_ADMIN_PASSWORD="至少8位-请替换"
.\.venv\Scripts\python.exe scripts\seed_rbac.py

# 打开鉴权
$env:AUTH_ENABLED="1"
$env:AUTH_JWT_SECRET="至少32字节的随机字符串"
```

生产环境变量见 `.env.example`：

- `AUTH_ENABLED=1`
- `AUTH_JWT_SECRET` >=32 字节
- `AUTH_JWT_ISSUER` / `AUTH_JWT_AUDIENCE`
- `AUTH_JWT_TTL_MINUTES`
- `CORS_ORIGINS`（生产不要留 `*`）
- `RBAC_ADMIN_USERNAME` / `RBAC_ADMIN_PASSWORD`（仅 seed 使用）

## 9. 前端 P7「权限」

- 文件：`frontend/src/pages/P7Rbac.vue`；`App.vue` 增加 P7 tab。
- 功能：登录、当前用户、用户列表/新建/删除、角色/权限列表、审计列表。
- token 存浏览器 `sessionStorage`，关闭会话即失效；服务端无 session。
- 生产必须 HTTPS；P7 页不要放在公网无鉴权入口。

## 10. 阿里云部署（建议顺序）

1. ECS（Ubuntu 22.04/24.04），安全组只开 22/80/443；不要暴露 PostgreSQL 5432、Milvus 19530。
2. 安装 Python 3.12/3.13、PostgreSQL、Nginx；`python -m venv .venv`，`pip install -r requirements.txt`。
3. 上传项目（不要把 `.venv`、`data/pilot.db`、`_backup_*`、`__pycache__` 打包上传）。
4. 建库 `pilot`，配置 `DATABASE_URL`；执行 `python -m tests.test_data` 或 `python -m api.main` 前先 `seed_rbac.py`。
5. `uvicorn api.main:app --host 127.0.0.1 --port 8000` 用 systemd 守护；Nginx 反代 `/api` 和静态 `web/dist`，配 HTTPS。
6. 生产设 `AUTH_ENABLED=1`、强 `AUTH_JWT_SECRET`、`CORS_ORIGINS=你的域名`；`/docs`、`/openapi.json` 建议在 Nginx 层只允许内网/白名单。
7. Milvus 可后置单独部署；未起时 RAG 走降级，不影响 RBAC 与主业务只读接口。
8. 备份：PostgreSQL 每日 `pg_dump`；`.env` 权限 600；不要提交 git。
9. 可执行模板已放在 `deploy/README.md`、`deploy/pilot.service`、`deploy/nginx-pilot.conf`；模板不等于已部署，ECS/域名/证书仍需实际配置。

当前仓库没有 `Dockerfile` / `docker-compose.yml`；课程答辩若老师要求容器化，再单独补，不要把“已有容器方案”写进文档。

## 11. 测试结果（2026-11-19）

- `pytest tests/test_rbac.py -q`：**11 passed**（登录、401、403、admin 管理、服务装饰器、身份覆盖、审计）。
- `pytest tests -q`：**122 passed + 6 subtests**；Milvus、Ollama、PostgreSQL 已恢复并参与验证。
- `python -m tests.gates`：**5/5 PASS**；G01–G05 全部通过。
- `npm run build`：**579 modules** 构建通过。

## 12. 已知缺口 / 下一阶段

1. 未接外部 IdP（Keycloak/飞书）；当前是应用内账号体系。
2. 未实现“提交人不得审批自己”的四眼原则；只在文档中标注。
3. 未做登录失败限流/锁定；生产建议 Nginx `limit_req` + 应用层计数。
4. 未做密码重置/邮件；管理员只能通过 PATCH 改密码。
5. 未做 refresh token；当前 access token 到期需重新登录（默认 60 分钟）。
6. 未做多租户/数据级权限；当前是功能级 RBAC。
7. `rbac_audit_log` 只记录登录/拒绝/部分权限检查，未记录所有管理写操作；后续可在 Service 写操作统一补审计。
