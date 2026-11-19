"""RBAC HTTP 层：登录、用户/角色/权限管理、鉴权中间件。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from rbac.bootstrap import ensure_rbac_schema
from rbac.config import auth_enabled
from rbac.decorators import require_permission
from rbac.errors import RBACError
from rbac.jwt_tokens import create_access_token, decode_access_token
from rbac.principal import Principal
from rbac.service import RBACService


# ---------------------------------------------------------------------------
# Pydantic 请求体
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class UserCreateRequest(BaseModel):
    username: str
    password: str
    display_name: str = ""
    role_codes: list[str] = Field(default_factory=lambda: ["viewer"])
    status: str = "active"


class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    password: Optional[str] = None
    status: Optional[str] = None
    role_codes: Optional[list[str]] = None


class RoleCreateRequest(BaseModel):
    code: str
    name: str
    description: str = ""


class RoleUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_codes: Optional[list[str]] = None


class PermissionCodesRequest(BaseModel):
    permission_codes: list[str] = Field(default_factory=list)


class PermissionCreateRequest(BaseModel):
    code: str
    name: str
    resource: str = ""
    action: str = ""
    description: str = ""


# ---------------------------------------------------------------------------
# 主体解析
# ---------------------------------------------------------------------------
def _client_ip(request: Request) -> str:
    return request.client.host if request.client else ""


def _bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        return ""
    return header[7:].strip()


def current_principal(request: Request) -> Principal:
    state_principal = getattr(request.state, "principal", None)
    if isinstance(state_principal, Principal):
        return state_principal
    token = _bearer_token(request)
    if not token:
        raise RBACError("AUTH-401", "未登录或缺少 Bearer token", 401)
    principal = decode_access_token(token)
    request.state.principal = principal
    return principal


def current_principal_optional(request: Request) -> Optional[Principal]:
    """给旧业务路由使用：auth 关闭时返回 None；auth 打开时必须已有主体。"""
    state_principal = getattr(request.state, "principal", None)
    if isinstance(state_principal, Principal):
        return state_principal
    token = _bearer_token(request)
    if not token:
        return None
    try:
        return decode_access_token(token)
    except RBACError:
        return None


# ---------------------------------------------------------------------------
# 路径 → 权限码
# ---------------------------------------------------------------------------
def permission_for(method: str, path: str) -> Optional[str]:
    method = method.upper()
    if path in {"/api/health", "/api/copy", "/api/auth/login"}:
        return None
    if path == "/api/auth/me":
        return None
    if path == "/api/auth/logout":
        return None

    # RBAC 管理
    if path.startswith("/api/rbac/audit"):
        return "audit:read"
    if path.startswith("/api/rbac/users"):
        return "rbac:user:read" if method == "GET" else "rbac:user:write"
    if path.startswith("/api/rbac/roles"):
        return "rbac:role:read" if method == "GET" else "rbac:role:write"
    if path.startswith("/api/rbac/permissions"):
        return "rbac:permission:read" if method == "GET" else "rbac:permission:write"

    # 既有业务接口
    exact = {
        ("GET", "/api/datasets"): "dataset:read",
        ("POST", "/api/datasets/import"): "dataset:import",
        ("GET", "/api/ops/summary"): "ops:read",
        ("GET", "/api/p1/dashboard"): "dashboard:read",
        ("GET", "/api/p2/skus"): "sku:read",
        ("GET", "/api/p3/route-plan"): "sku:read",
        ("POST", "/api/p3/apply"): "apply:create",
        ("POST", "/api/p3/apply/approve"): "apply:approve",
        ("POST", "/api/p3/apply/reject"): "apply:approve",
        ("POST", "/api/p3/po/ship"): "po:ship",
        ("POST", "/api/p3/po/cancel"): "po:cancel",
        ("POST", "/api/p3/po/receive"): "po:receive",
        ("GET", "/api/p3/applies"): "apply:read",
        ("POST", "/api/agents/support"): "sku:read",
    }
    code = exact.get((method, path))
    if code:
        return code
    if method == "GET" and path.startswith("/api/p3/sku/"):
        return "sku:read"
    # 未登记的新 /api 路由至少要求登录；权限装饰器负责细粒度。
    return None


def _auth_error_response(code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": message},
    )


async def rbac_middleware(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/") or request.method == "OPTIONS":
        return await call_next(request)
    if path in {"/api/health", "/api/copy", "/api/auth/login"}:
        return await call_next(request)
    if not auth_enabled():
        # 演示模式：旧接口保持原行为；RBAC 管理接口由 current_principal 自己要求 Bearer。
        return await call_next(request)

    token = _bearer_token(request)
    if not token:
        return _auth_error_response("AUTH-401", "未登录或缺少 Bearer token", 401)
    try:
        principal = decode_access_token(token)
    except RBACError as exc:
        return _auth_error_response(exc.code, exc.message, exc.status_code)

    # 先确认账号仍启用，再写 request.state / ContextVar。
    # 这里不查库；has_permission 会查，停用账号会在权限校验时被拒。
    request.state.principal = principal
    from rbac.context import reset_current_principal, set_current_principal

    token_context = set_current_principal(principal)
    try:
        required = permission_for(request.method, path)
        if required and not RBACService().has_permission(principal.user_id, required):
            RBACService().audit(
                user_id=principal.user_id,
                username=principal.username,
                action="permission_check",
                resource=required,
                result="deny",
                detail=f"{request.method} {path}",
                ip=_client_ip(request),
            )
            return _auth_error_response(
                "AUTH-403",
                f"无权访问该资源（需要 {required}）",
                403,
            )
        return await call_next(request)
    finally:
        reset_current_principal(token_context)


# ---------------------------------------------------------------------------
# 路由
# ---------------------------------------------------------------------------
auth_router = APIRouter(prefix="/api/auth", tags=["auth"])
rbac_router = APIRouter(prefix="/api/rbac", tags=["rbac"])


@auth_router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request):
    from rbac.config import jwt_ttl_minutes

    principal = RBACService().authenticate(
        payload.username, payload.password, ip=_client_ip(request)
    )
    token = create_access_token(principal)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": jwt_ttl_minutes() * 60,
        "user": principal.to_dict(),
    }


@auth_router.get("/me")
def me(principal: Principal = Depends(current_principal)):
    return {"user": principal.to_dict()}


@rbac_router.get("/users")
@require_permission("rbac:user:read")
def list_users(principal: Principal = Depends(current_principal)):
    users = RBACService().list_users()
    return {"users": users, "total": len(users)}


@rbac_router.post("/users", status_code=201)
@require_permission("rbac:user:write")
def create_user(
    payload: UserCreateRequest,
    principal: Principal = Depends(current_principal),
):
    return RBACService().create_user(
        username=payload.username,
        password=payload.password,
        display_name=payload.display_name,
        role_codes=payload.role_codes,
        status=payload.status,
    )


@rbac_router.patch("/users/{user_id}")
@require_permission("rbac:user:write")
def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    principal: Principal = Depends(current_principal),
):
    return RBACService().update_user(
        user_id,
        display_name=payload.display_name,
        password=payload.password,
        status=payload.status,
        role_codes=payload.role_codes,
    )


@rbac_router.delete("/users/{user_id}")
@require_permission("rbac:user:write")
def delete_user(user_id: str, principal: Principal = Depends(current_principal)):
    RBACService().delete_user(user_id)
    return {"deleted": True, "user_id": user_id}


@rbac_router.get("/roles")
@require_permission("rbac:role:read")
def list_roles(principal: Principal = Depends(current_principal)):
    roles = RBACService().list_roles()
    return {"roles": roles, "total": len(roles)}


@rbac_router.post("/roles", status_code=201)
@require_permission("rbac:role:write")
def create_role(
    payload: RoleCreateRequest,
    principal: Principal = Depends(current_principal),
):
    return RBACService().create_role(
        code=payload.code, name=payload.name, description=payload.description
    )


@rbac_router.patch("/roles/{role_id}")
@require_permission("rbac:role:write")
def update_role(
    role_id: str,
    payload: RoleUpdateRequest,
    principal: Principal = Depends(current_principal),
):
    return RBACService().update_role(
        role_id,
        name=payload.name,
        description=payload.description,
        permission_codes=payload.permission_codes,
    )


@rbac_router.put("/roles/{role_id}/permissions")
@require_permission("rbac:role:write")
def set_role_permissions(
    role_id: str,
    payload: PermissionCodesRequest,
    principal: Principal = Depends(current_principal),
):
    return RBACService().update_role(
        role_id, permission_codes=payload.permission_codes
    )


@rbac_router.delete("/roles/{role_id}")
@require_permission("rbac:role:write")
def delete_role(role_id: str, principal: Principal = Depends(current_principal)):
    RBACService().delete_role(role_id)
    return {"deleted": True, "role_id": role_id}


@rbac_router.get("/permissions")
@require_permission("rbac:permission:read")
def list_permissions(principal: Principal = Depends(current_principal)):
    permissions = RBACService().list_permissions()
    return {"permissions": permissions, "total": len(permissions)}


@rbac_router.post("/permissions", status_code=201)
@require_permission("rbac:permission:write")
def create_permission(
    payload: PermissionCreateRequest,
    principal: Principal = Depends(current_principal),
):
    return RBACService().create_permission(
        code=payload.code,
        name=payload.name,
        resource=payload.resource,
        action=payload.action,
        description=payload.description,
    )


@rbac_router.delete("/permissions/{permission_id}")
@require_permission("rbac:permission:write")
def delete_permission(
    permission_id: str, principal: Principal = Depends(current_principal)
):
    RBACService().delete_permission(permission_id)
    return {"deleted": True, "permission_id": permission_id}


@rbac_router.get("/audit")
@require_permission("audit:read")
def list_audit(
    limit: int = 100, principal: Principal = Depends(current_principal)
):
    rows = RBACService().list_audit(limit)
    return {"items": rows, "total": len(rows)}


# ---------------------------------------------------------------------------
# 安装
# ---------------------------------------------------------------------------
def install_rbac(app) -> None:
    app.include_router(auth_router)
    app.include_router(rbac_router)
    app.middleware("http")(rbac_middleware)

    @app.exception_handler(RBACError)
    async def _rbac_error_handler(_request: Request, exc: RBACError):
        body = {"code": exc.code, "message": exc.message}
        if exc.detail:
            body["detail"] = exc.detail
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.on_event("startup")
    async def _rbac_startup() -> None:
        ensure_rbac_schema()
