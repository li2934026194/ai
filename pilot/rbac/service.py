"""RBAC Service：外观层。

职责：
- 事务一致性：一个业务操作一个 Session，成功 commit，异常 rollback；
- 聚合 user/role/permission 的读写，HTTP 层不直接碰 DAO；
- 密码哈希、用户名/权限码校验、默认角色/权限种子；
- 给装饰器和中间件提供 has_permission() 的实时判断（不信任 token 里的旧快照）。
"""

from __future__ import annotations

import re
from typing import Iterable, Optional
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from db import get_session
from rbac.dao import RBACDAO
from rbac.errors import RBACError
from rbac.passwords import hash_password, verify_password
from rbac.principal import Principal

_USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,64}$")
_CODE_RE = re.compile(r"^[a-z0-9][a-z0-9:_-]{2,127}$")
_STATUSES = {"active", "disabled"}

# 权限码与 HTTP/服务端资源一一对应；新增端点时必须在这里登记。
DEFAULT_PERMISSIONS: tuple[tuple[str, str, str, str], ...] = (
    ("dataset:read", "读取数据集", "dataset", "read"),
    ("dataset:import", "导入数据集", "dataset", "import"),
    ("ops:read", "读取运行观测", "ops", "read"),
    ("dashboard:read", "读取首页看板", "dashboard", "read"),
    ("sku:read", "读取 SKU 详情", "sku", "read"),
    ("forecast:read", "读取预测体检", "forecast", "read"),
    ("apply:read", "读取补货申请", "apply", "read"),
    ("apply:create", "提交补货申请", "apply", "create"),
    ("apply:approve", "审批/驳回补货申请", "apply", "approve"),
    ("po:ship", "采购单发货", "po", "ship"),
    ("po:receive", "采购单收货质检", "po", "receive"),
    ("po:cancel", "取消采购单", "po", "cancel"),
    ("rbac:user:read", "读取用户", "rbac:user", "read"),
    ("rbac:user:write", "管理用户", "rbac:user", "write"),
    ("rbac:role:read", "读取角色", "rbac:role", "read"),
    ("rbac:role:write", "管理角色", "rbac:role", "write"),
    ("rbac:permission:read", "读取权限", "rbac:permission", "read"),
    ("rbac:permission:write", "管理权限", "rbac:permission", "write"),
    ("audit:read", "读取鉴权审计", "audit", "read"),
)

DEFAULT_ROLES: dict[str, tuple[str, list[str]]] = {
    "viewer": (
        "只读观察者",
        [
            "dataset:read",
            "ops:read",
            "dashboard:read",
            "sku:read",
            "forecast:read",
            "apply:read",
        ],
    ),
    "planner": (
        "补货计划员",
        [
            "dataset:read",
            "ops:read",
            "dashboard:read",
            "sku:read",
            "forecast:read",
            "apply:read",
            "apply:create",
        ],
    ),
    "approver": (
        "审批人",
        [
            "dataset:read",
            "ops:read",
            "dashboard:read",
            "sku:read",
            "forecast:read",
            "apply:read",
            "apply:approve",
        ],
    ),
    "warehouse": (
        "仓配操作员",
        [
            "dataset:read",
            "ops:read",
            "dashboard:read",
            "sku:read",
            "forecast:read",
            "apply:read",
            "po:ship",
            "po:receive",
        ],
    ),
    "auditor": (
        "审计员",
        [
            "dataset:read",
            "ops:read",
            "dashboard:read",
            "sku:read",
            "forecast:read",
            "apply:read",
            "audit:read",
        ],
    ),
    "admin": (
        "系统管理员",
        [code for code, _, _, _ in DEFAULT_PERMISSIONS],
    ),
}


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def _validate_username(username: str) -> str:
    username = (username or "").strip()
    if not _USERNAME_RE.match(username):
        raise RBACError(
            "RBAC-400",
            "用户名必须为 3-64 位字母/数字/下划线/点/中划线",
            400,
        )
    return username


def _validate_code(code: str, label: str = "权限码") -> str:
    code = (code or "").strip()
    if not _CODE_RE.match(code):
        raise RBACError(
            "RBAC-400",
            f"{label}必须为 3-128 位小写字母/数字/冒号/下划线/中划线",
            400,
        )
    return code


def _validate_password(password: str) -> str:
    if not isinstance(password, str) or len(password) < 8:
        raise RBACError("RBAC-400", "密码至少 8 位", 400)
    return password


def _permission_codes(user) -> list[str]:
    return sorted({p.code for role in user.roles for p in role.permissions})


def _role_codes(user) -> list[str]:
    return sorted(role.code for role in user.roles)


def user_to_dict(user) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "status": user.status,
        "roles": _role_codes(user),
        "permissions": _permission_codes(user),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def role_to_dict(role) -> dict:
    return {
        "id": role.id,
        "code": role.code,
        "name": role.name,
        "description": role.description,
        "permissions": sorted(p.code for p in role.permissions),
        "user_count": len(role.users),
        "created_at": role.created_at.isoformat() if role.created_at else None,
    }


def permission_to_dict(permission) -> dict:
    return {
        "id": permission.id,
        "code": permission.code,
        "name": permission.name,
        "resource": permission.resource,
        "action": permission.action,
        "description": permission.description,
        "created_at": permission.created_at.isoformat() if permission.created_at else None,
    }


class RBACService:
    # ------------------------------------------------------------------ auth
    def authenticate(self, username: str, password: str, *, ip: str = "") -> Principal:
        username = (username or "").strip()
        with get_session() as session:
            dao = RBACDAO(session)
            user = dao.get_user_by_username(username)
            if user is None or not verify_password(password, user.password_hash):
                if user is not None:
                    dao.add_audit(
                        user_id=user.id,
                        username=username,
                        action="login",
                        resource="/api/auth/login",
                        result="deny",
                        detail="密码错误",
                        ip=ip,
                    )
                    session.commit()
                raise RBACError("AUTH-401", "用户名或密码错误", 401)
            if user.status != "active":
                dao.add_audit(
                    user_id=user.id,
                    username=username,
                    action="login",
                    resource="/api/auth/login",
                    result="deny",
                    detail="账号已停用",
                    ip=ip,
                )
                session.commit()
                raise RBACError("AUTH-403", "账号已停用，请联系管理员", 403)
            principal = Principal(
                user_id=user.id,
                username=user.username,
                roles=tuple(_role_codes(user)),
                permissions=tuple(_permission_codes(user)),
            )
            dao.add_audit(
                user_id=user.id,
                username=user.username,
                action="login",
                resource="/api/auth/login",
                result="allow",
                ip=ip,
            )
            session.commit()
            return principal

    def has_permission(self, user_id: str, permission_code: str) -> bool:
        with get_session() as session:
            dao = RBACDAO(session)
            user = dao.get_user(user_id)
            if user is None or user.status != "active":
                return False
            return permission_code in set(_permission_codes(user))

    def get_user(self, user_id: str) -> dict:
        with get_session() as session:
            user = RBACDAO(session).get_user(user_id)
            if user is None:
                raise RBACError("RBAC-404", "用户不存在", 404)
            return user_to_dict(user)

    def audit(
        self,
        *,
        user_id: Optional[str],
        username: str,
        action: str,
        resource: str = "",
        result: str = "allow",
        detail: str = "",
        ip: str = "",
    ) -> None:
        try:
            with get_session() as session:
                RBACDAO(session).add_audit(
                    user_id=user_id,
                    username=username,
                    action=action,
                    resource=resource,
                    result=result,
                    detail=detail,
                    ip=ip,
                )
                session.commit()
        except Exception:
            # 审计失败不能吞掉主体的 401/403；只静默记录。
            pass

    def list_audit(self, limit: int = 100) -> list[dict]:
        with get_session() as session:
            rows = RBACDAO(session).list_audit(limit)
            return [
                {
                    "id": r.id,
                    "user_id": r.user_id,
                    "username": r.username,
                    "action": r.action,
                    "resource": r.resource,
                    "result": r.result,
                    "detail": r.detail,
                    "ip": r.ip,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]

    # ----------------------------------------------------------------- users
    def list_users(self) -> list[dict]:
        with get_session() as session:
            return [user_to_dict(u) for u in RBACDAO(session).list_users()]

    def create_user(
        self,
        *,
        username: str,
        password: str,
        display_name: str = "",
        role_codes: Optional[Iterable[str]] = None,
        status: str = "active",
    ) -> dict:
        username = _validate_username(username)
        _validate_password(password)
        if status not in _STATUSES:
            raise RBACError("RBAC-400", "status 只能是 active/disabled", 400)
        codes = list(dict.fromkeys(role_codes or ["viewer"]))
        with get_session() as session:
            dao = RBACDAO(session)
            if dao.get_user_by_username(username) is not None:
                raise RBACError("RBAC-409", f"用户名已存在: {username}", 409)
            try:
                user = dao.create_user(
                    user_id=_new_id("usr"),
                    username=username,
                    display_name=(display_name or username).strip(),
                    password_hash=hash_password(password),
                    status=status,
                )
                dao.set_user_roles(user, codes)
                session.commit()
                return user_to_dict(user)
            except ValueError as exc:
                session.rollback()
                raise RBACError("RBAC-400", str(exc), 400) from exc
            except IntegrityError as exc:
                session.rollback()
                raise RBACError("RBAC-409", "用户名已存在", 409) from exc

    def update_user(
        self,
        user_id: str,
        *,
        display_name: Optional[str] = None,
        password: Optional[str] = None,
        status: Optional[str] = None,
        role_codes: Optional[Iterable[str]] = None,
    ) -> dict:
        if status is not None and status not in _STATUSES:
            raise RBACError("RBAC-400", "status 只能是 active/disabled", 400)
        if password is not None:
            _validate_password(password)
        with get_session() as session:
            dao = RBACDAO(session)
            user = dao.get_user(user_id)
            if user is None:
                raise RBACError("RBAC-404", "用户不存在", 404)
            try:
                dao.update_user(
                    user,
                    display_name=display_name,
                    password_hash=hash_password(password) if password is not None else None,
                    status=status,
                )
                if role_codes is not None:
                    dao.set_user_roles(user, role_codes)
                if user.status == "disabled" and "admin" in _role_codes(user):
                    raise RBACError("RBAC-409", "管理员账号不能停用", 409)
                session.commit()
                return user_to_dict(user)
            except ValueError as exc:
                session.rollback()
                raise RBACError("RBAC-400", str(exc), 400) from exc
            except IntegrityError as exc:
                session.rollback()
                raise RBACError("RBAC-409", "用户更新冲突", 409) from exc

    def delete_user(self, user_id: str) -> None:
        with get_session() as session:
            dao = RBACDAO(session)
            user = dao.get_user(user_id)
            if user is None:
                raise RBACError("RBAC-404", "用户不存在", 404)
            if "admin" in _role_codes(user):
                admin_count = sum(
                    1
                    for u in dao.list_users()
                    if "admin" in _role_codes(u) and u.status == "active"
                )
                if admin_count <= 1:
                    raise RBACError("RBAC-409", "不能删除最后一个启用的管理员", 409)
            dao.delete_user(user)
            session.commit()

    # ----------------------------------------------------------------- roles
    def list_roles(self) -> list[dict]:
        with get_session() as session:
            return [role_to_dict(r) for r in RBACDAO(session).list_roles()]

    def create_role(self, *, code: str, name: str, description: str = "") -> dict:
        code = _validate_code(code, "角色码")
        if not (name or "").strip():
            raise RBACError("RBAC-400", "角色名称不能为空", 400)
        with get_session() as session:
            dao = RBACDAO(session)
            if dao.get_role_by_code(code) is not None:
                raise RBACError("RBAC-409", f"角色码已存在: {code}", 409)
            try:
                role = dao.create_role(
                    role_id=_new_id("role"),
                    code=code,
                    name=name.strip(),
                    description=description or "",
                )
                session.commit()
                return role_to_dict(role)
            except IntegrityError as exc:
                session.rollback()
                raise RBACError("RBAC-409", "角色码已存在", 409) from exc

    def update_role(
        self,
        role_id: str,
        *,
        name: Optional[str] = None,
        description: Optional[str] = None,
        permission_codes: Optional[Iterable[str]] = None,
    ) -> dict:
        with get_session() as session:
            dao = RBACDAO(session)
            role = dao.get_role(role_id)
            if role is None:
                raise RBACError("RBAC-404", "角色不存在", 404)
            try:
                dao.update_role(role, name=name, description=description)
                if permission_codes is not None:
                    dao.set_role_permissions(role, permission_codes)
                session.commit()
                return role_to_dict(role)
            except ValueError as exc:
                session.rollback()
                raise RBACError("RBAC-400", str(exc), 400) from exc

    def delete_role(self, role_id: str) -> None:
        with get_session() as session:
            dao = RBACDAO(session)
            role = dao.get_role(role_id)
            if role is None:
                raise RBACError("RBAC-404", "角色不存在", 404)
            if role.users:
                raise RBACError("RBAC-409", "角色仍被用户引用，不能删除", 409)
            if role.code == "admin":
                raise RBACError("RBAC-409", "内置 admin 角色不能删除", 409)
            dao.delete_role(role)
            session.commit()

    # ------------------------------------------------------------- permissions
    def list_permissions(self) -> list[dict]:
        with get_session() as session:
            return [permission_to_dict(p) for p in RBACDAO(session).list_permissions()]

    def create_permission(
        self,
        *,
        code: str,
        name: str,
        resource: str = "",
        action: str = "",
        description: str = "",
    ) -> dict:
        code = _validate_code(code)
        if not (name or "").strip():
            raise RBACError("RBAC-400", "权限名称不能为空", 400)
        with get_session() as session:
            dao = RBACDAO(session)
            if dao.get_permission_by_code(code) is not None:
                raise RBACError("RBAC-409", f"权限码已存在: {code}", 409)
            try:
                permission = dao.create_permission(
                    permission_id=_new_id("perm"),
                    code=code,
                    name=name.strip(),
                    resource=resource or "",
                    action=action or "",
                    description=description or "",
                )
                session.commit()
                return permission_to_dict(permission)
            except IntegrityError as exc:
                session.rollback()
                raise RBACError("RBAC-409", "权限码已存在", 409) from exc

    def delete_permission(self, permission_id: str) -> None:
        with get_session() as session:
            dao = RBACDAO(session)
            permission = dao.get_permission(permission_id)
            if permission is None:
                raise RBACError("RBAC-404", "权限不存在", 404)
            if permission.roles:
                raise RBACError("RBAC-409", "权限仍被角色引用，不能删除", 409)
            dao.delete_permission(permission)
            session.commit()

    # --------------------------------------------------------------- seeding
    def seed_defaults(
        self,
        *,
        admin_username: Optional[str] = None,
        admin_password: Optional[str] = None,
        admin_display_name: str = "系统管理员",
    ) -> dict:
        """幂等创建默认权限/角色；可选创建或补角色管理员。

        生产调用示例：
        RBAC_ADMIN_USERNAME=admin RBAC_ADMIN_PASSWORD='...' python scripts/seed_rbac.py
        """
        created = {"permissions": 0, "roles": 0, "admin": None}
        with get_session() as session:
            dao = RBACDAO(session)
            for code, name, resource, action in DEFAULT_PERMISSIONS:
                if dao.get_permission_by_code(code) is None:
                    dao.create_permission(
                        permission_id=_new_id("perm"),
                        code=code,
                        name=name,
                        resource=resource,
                        action=action,
                    )
                    created["permissions"] += 1
            for code, (name, permission_codes) in DEFAULT_ROLES.items():
                role = dao.get_role_by_code(code)
                if role is None:
                    role = dao.create_role(
                        role_id=_new_id("role"),
                        code=code,
                        name=name,
                    )
                    created["roles"] += 1
                # 只在角色权限为空或 admin 时补齐，避免覆盖人工调整。
                if not role.permissions or code == "admin":
                    dao.set_role_permissions(role, permission_codes)
            if admin_username:
                admin_username = _validate_username(admin_username)
                if not admin_password:
                    raise RBACError("RBAC-400", "创建管理员必须提供管理员密码", 400)
                _validate_password(admin_password)
                user = dao.get_user_by_username(admin_username)
                if user is None:
                    user = dao.create_user(
                        user_id=_new_id("usr"),
                        username=admin_username,
                        display_name=admin_display_name,
                        password_hash=hash_password(admin_password),
                        status="active",
                    )
                dao.set_user_roles(user, ["admin"])
                created["admin"] = user.username
            session.commit()
        return created
