"""RBAC DAO：只负责三张主表 + 两张关联表的读写。

所有方法都接收外部 Session，事务边界由 Service 控制；DAO 不 commit。
"""

from __future__ import annotations

from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from schema import (
    RBACAuditLog,
    RBACPermission,
    RBACRole,
    RBACUser,
)


class RBACDAO:
    def __init__(self, session: Session):
        self.session = session

    # ------------------------------------------------------------------ user
    def get_user(self, user_id: str) -> Optional[RBACUser]:
        return self.session.get(RBACUser, user_id)

    def get_user_by_username(self, username: str) -> Optional[RBACUser]:
        return self.session.execute(
            select(RBACUser).where(RBACUser.username == username)
        ).scalar_one_or_none()

    def list_users(self) -> list[RBACUser]:
        return list(
            self.session.execute(select(RBACUser).order_by(RBACUser.created_at, RBACUser.id))
            .scalars()
            .all()
        )

    def create_user(
        self,
        *,
        user_id: str,
        username: str,
        display_name: str,
        password_hash: str,
        status: str = "active",
    ) -> RBACUser:
        row = RBACUser(
            id=user_id,
            username=username,
            display_name=display_name,
            password_hash=password_hash,
            status=status,
        )
        self.session.add(row)
        self.session.flush()
        return row

    def update_user(
        self,
        user: RBACUser,
        *,
        display_name: Optional[str] = None,
        password_hash: Optional[str] = None,
        status: Optional[str] = None,
    ) -> RBACUser:
        if display_name is not None:
            user.display_name = display_name
        if password_hash is not None:
            user.password_hash = password_hash
        if status is not None:
            user.status = status
        self.session.flush()
        return user

    def delete_user(self, user: RBACUser) -> None:
        self.session.delete(user)
        self.session.flush()

    def set_user_roles(self, user: RBACUser, role_codes: Iterable[str]) -> RBACUser:
        codes = list(dict.fromkeys(str(c).strip() for c in role_codes if str(c).strip()))
        roles = self._roles_by_codes(codes)
        missing = [c for c in codes if c not in {r.code for r in roles}]
        if missing:
            raise ValueError(f"角色不存在: {missing}")
        user.roles = roles
        self.session.flush()
        return user

    # ------------------------------------------------------------------ role
    def get_role(self, role_id: str) -> Optional[RBACRole]:
        return self.session.get(RBACRole, role_id)

    def get_role_by_code(self, code: str) -> Optional[RBACRole]:
        return self.session.execute(
            select(RBACRole).where(RBACRole.code == code)
        ).scalar_one_or_none()

    def list_roles(self) -> list[RBACRole]:
        return list(
            self.session.execute(select(RBACRole).order_by(RBACRole.code)).scalars().all()
        )

    def create_role(
        self, *, role_id: str, code: str, name: str, description: str = ""
    ) -> RBACRole:
        row = RBACRole(id=role_id, code=code, name=name, description=description)
        self.session.add(row)
        self.session.flush()
        return row

    def update_role(
        self,
        role: RBACRole,
        *,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> RBACRole:
        if name is not None:
            role.name = name
        if description is not None:
            role.description = description
        self.session.flush()
        return role

    def delete_role(self, role: RBACRole) -> None:
        self.session.delete(role)
        self.session.flush()

    def set_role_permissions(self, role: RBACRole, permission_codes: Iterable[str]) -> RBACRole:
        codes = list(dict.fromkeys(str(c).strip() for c in permission_codes if str(c).strip()))
        permissions = self._permissions_by_codes(codes)
        missing = [c for c in codes if c not in {p.code for p in permissions}]
        if missing:
            raise ValueError(f"权限不存在: {missing}")
        role.permissions = permissions
        self.session.flush()
        return role

    # -------------------------------------------------------------- permission
    def get_permission(self, permission_id: str) -> Optional[RBACPermission]:
        return self.session.get(RBACPermission, permission_id)

    def get_permission_by_code(self, code: str) -> Optional[RBACPermission]:
        return self.session.execute(
            select(RBACPermission).where(RBACPermission.code == code)
        ).scalar_one_or_none()

    def list_permissions(self) -> list[RBACPermission]:
        return list(
            self.session.execute(
                select(RBACPermission).order_by(RBACPermission.code)
            ).scalars().all()
        )

    def create_permission(
        self,
        *,
        permission_id: str,
        code: str,
        name: str,
        resource: str = "",
        action: str = "",
        description: str = "",
    ) -> RBACPermission:
        row = RBACPermission(
            id=permission_id,
            code=code,
            name=name,
            resource=resource,
            action=action,
            description=description,
        )
        self.session.add(row)
        self.session.flush()
        return row

    def delete_permission(self, permission: RBACPermission) -> None:
        self.session.delete(permission)
        self.session.flush()

    # ------------------------------------------------------------------ audit
    def add_audit(
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
        self.session.add(
            RBACAuditLog(
                user_id=user_id,
                username=username or "",
                action=action,
                resource=resource,
                result=result,
                detail=detail,
                ip=ip,
            )
        )
        self.session.flush()

    def list_audit(self, limit: int = 100) -> list[RBACAuditLog]:
        return list(
            self.session.execute(
                select(RBACAuditLog)
                .order_by(RBACAuditLog.created_at.desc(), RBACAuditLog.id.desc())
                .limit(max(1, min(limit, 500)))
            ).scalars().all()
        )

    # ---------------------------------------------------------------- helpers
    def _roles_by_codes(self, codes: list[str]) -> list[RBACRole]:
        if not codes:
            return []
        return list(
            self.session.execute(select(RBACRole).where(RBACRole.code.in_(codes)))
            .scalars()
            .all()
        )

    def _permissions_by_codes(self, codes: list[str]) -> list[RBACPermission]:
        if not codes:
            return []
        return list(
            self.session.execute(select(RBACPermission).where(RBACPermission.code.in_(codes)))
            .scalars()
            .all()
        )
