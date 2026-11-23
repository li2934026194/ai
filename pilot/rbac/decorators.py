"""可靠权限装饰器。

用法：
    @require_permission("apply:approve")
    def approve_apply(...): ...

- AUTH_ENABLED=0：演示模式跳过，保证旧测试与旧调用不被破坏；
- AUTH_ENABLED=1：先从 JWT 登录上下文拿 Principal，再到数据库实时查权限；
- 没有 Principal → 401；有 Principal 但没有权限 → 403；
- 不把 token 或 Principal 放进任何中间件/全局内存。
"""

from __future__ import annotations

from functools import wraps
from typing import Callable, TypeVar

from rbac.config import auth_enabled
from rbac.context import get_current_principal
from rbac.errors import RBACError
from rbac.principal import Principal
from rbac.service import RBACService

F = TypeVar("F", bound=Callable)


def _principal_from_call(kwargs: dict) -> Principal | None:
    value = kwargs.get("principal")
    if isinstance(value, Principal):
        return value
    return get_current_principal()


def require_permission(permission_code: str) -> Callable[[F], F]:
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not auth_enabled():
                return func(*args, **kwargs)
            principal = _principal_from_call(kwargs)
            if principal is None:
                raise RBACError("AUTH-401", "未登录或登录已过期", 401)
            if not RBACService().has_permission(principal.user_id, permission_code):
                RBACService().audit(
                    user_id=principal.user_id,
                    username=principal.username,
                    action="permission_check",
                    resource=permission_code,
                    result="deny",
                    detail=f"缺少权限 {permission_code}",
                )
                raise RBACError(
                    "AUTH-403",
                    f"无权执行该操作（需要 {permission_code}）",
                    403,
                )
            return func(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator


def require_authenticated(func: F) -> F:
    """只校验登录，不校验具体功能权限。"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        if not auth_enabled():
            return func(*args, **kwargs)
        if _principal_from_call(kwargs) is None:
            raise RBACError("AUTH-401", "未登录或登录已过期", 401)
        return func(*args, **kwargs)

    return wrapper  # type: ignore[return-value]
