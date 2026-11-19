"""登录主体：从 JWT claims 还原出来的不可变对象。

注意：token 里带 roles/permissions 只是“登录时快照”，真正的权限判断在
RBACService.has_permission() 里重新查库，因此管理员改角色后旧 token 不会继续放行。
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Principal:
    user_id: str
    username: str
    roles: tuple[str, ...] = field(default_factory=tuple)
    permissions: tuple[str, ...] = field(default_factory=tuple)

    @classmethod
    def from_claims(cls, claims: dict) -> "Principal":
        return cls(
            user_id=str(claims.get("sub") or ""),
            username=str(claims.get("username") or ""),
            roles=tuple(str(x) for x in (claims.get("roles") or [])),
            permissions=tuple(str(x) for x in (claims.get("permissions") or [])),
        )

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "username": self.username,
            "roles": list(self.roles),
            "permissions": list(self.permissions),
        }
