import base64
from dataclasses import dataclass
import hashlib
import hmac
import json
import secrets
import time
from typing import Callable
from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_event
from app.core.config import get_settings
from app.core.database import get_db_session
from app.core.exceptions import M7Error
from app.core.tenant import OrgContext, get_org_context


def hash_password(raw_password: str, salt: str | None = None) -> str:
    salt_val = salt or secrets.token_hex(8)
    dk = hashlib.pbkdf2_hmac("sha256", raw_password.encode("utf-8"), salt_val.encode("utf-8"), 120_000)
    return f"pbkdf2_sha256${salt_val}${dk.hex()}"


def verify_password(raw_password: str, stored_hash: str | None) -> bool:
    if not stored_hash or "$" not in stored_hash:
        return False
    parts = stored_hash.split("$", 2)
    if len(parts) != 3 or parts[0] != "pbkdf2_sha256":
        return False
    expected = hash_password(raw_password, salt=parts[1])
    return hmac.compare_digest(expected, stored_hash)


ROLE_LABELS_ZH: dict[str, str] = {
    "approver": "主管 / 审批人",
    "creator": "内容创作 / 审核人员",
    "manager": "大屏浏览者 / 管理者",
    "planner": "驾驶舱设计者 / 业务运营",
    "selector": "选品研究员",
    "bi_analyst": "数据分析 / BI 人员",
    "warehouse": "采购 / 仓库 / 物流人员",
    "cs": "客服",
    "mock_buyer": "测试买家",
}

ROLE_DEFAULT_NAMES: dict[str, str] = {
    "approver": "陈主管",
    "creator": "林设计",
    "manager": "王总监",
    "planner": "张运营",
    "selector": "吴选品",
    "bi_analyst": "周分析",
    "warehouse": "赵仓管",
    "cs": "李客服",
    "mock_buyer": "测试买家",
}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "approver": {
        "m0:read", "m0:cost:approve",
        "m1:read", "m1:aftersales:approve",
        "m2:read",
        "m3:read",
        "m4:read", "m4:approve",
        "m5:read",
        "m6:read", "m6:approve",
        "m7:content:read",
        "m7:content:edit",
        "m7:compliance:run",
        "m7:rule:maintain",
        "m7:publish:approve",
        "m7:package:export",
        "m8:read", "m8:manage",
    },
    "creator": {
        "m0:read",
        "m1:read",
        "m7:content:read",
        "m7:content:edit",
        "m7:compliance:run",
        "m7:package:export",
    },
    "manager": {
        "m0:read", "m0:shop:manage",
        "m1:read",
        "m2:read",
        "m3:read",
        "m4:read",
        "m5:read",
        "m6:read",
        "m7:content:read",
        "m8:read", "m8:manage",
    },
    "planner": {
        "m0:read", "m0:cost:propose",
        "m1:read", "m1:faq:edit",
        "m2:read", "m2:edit",
        "m3:read",
        "m4:read",
        "m5:read", "m5:run",
        "m6:read", "m6:draft",
        "m7:content:read",
    },
    "selector": {
        "m0:read",
        "m4:read", "m4:edit",
        "m5:read",
        "m7:content:read",
    },
    "bi_analyst": {
        "m0:read",
        "m2:read", "m2:edit",
        "m3:read", "m3:edit", "m3:ask",
        "m4:read",
        "m5:read", "m5:review",
    },
    "warehouse": {
        "m0:read", "m0:inventory:edit",
        "m5:read",
        "m6:read", "m6:receive",
    },
    "cs": {
        "m0:read",
        "m1:read", "m1:session:edit", "m1:aftersales:submit", "m1:simulator:run",
    },
    "mock_buyer": {
        "m1:simulator:run",
    },
}


@dataclass(frozen=True)
class ActorContext:
    user_id: str
    role: str
    display_name: str
    actor_org_id: str | None = None
    auth_mode: str = "header"
    allowed_shop_ids: tuple[str, ...] = ()

    @property
    def permissions(self) -> set[str]:
        return ROLE_PERMISSIONS.get(self.role, set())


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def issue_actor_jwt(
    user_id: str,
    role: str,
    org_id: str,
    display_name: str | None = None,
    ttl_seconds: int = 86400,
) -> str:
    settings = get_settings()
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url_encode(
        json.dumps(
            {
                "sub": user_id,
                "role": role,
                "org_id": org_id,
                "name": display_name or ROLE_DEFAULT_NAMES.get(role, user_id),
                "exp": int(time.time()) + ttl_seconds,
            }
        ).encode()
    )
    msg = f"{header}.{payload}".encode()
    sig = hmac.new(settings.JWT_SECRET_KEY.encode(), msg, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url_encode(sig)}"


def verify_actor_jwt(token: str) -> dict:
    settings = get_settings()
    parts = token.split(".")
    if len(parts) != 3:
        raise M7Error("M7-4031", "无效的访问令牌格式", http_status=403)
    msg = f"{parts[0]}.{parts[1]}".encode()
    expected = hmac.new(settings.JWT_SECRET_KEY.encode(), msg, hashlib.sha256).digest()
    actual = _b64url_decode(parts[2])
    if not hmac.compare_digest(expected, actual):
        raise M7Error("M7-4031", "访问令牌签名校验失败", http_status=403)
    data = json.loads(_b64url_decode(parts[1]).decode("utf-8"))
    if data.get("exp", 0) < int(time.time()):
        raise M7Error("M7-4031", "访问令牌已过期", http_status=403)
    return data


async def get_actor_context(
    request: Request,
    org_ctx: OrgContext = Depends(get_org_context),
    session: AsyncSession = Depends(get_db_session),
    authorization: str | None = Header(default=None),
    x_actor_id: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
    x_org_id: str | None = Header(default=None),
) -> ActorContext:
    from app.modules.m8_org.models import M8UserAccount

    trace_id = getattr(request.state, "trace_id", "")
    settings = get_settings()

    if authorization and authorization.lower().startswith("bearer "):
        claims = verify_actor_jwt(authorization.split(" ", 1)[1].strip())
        role = str(claims.get("role", "")).strip()
        user_id = str(claims.get("sub", "")).strip()
        actor_org = str(claims.get("org_id", "")).strip() or None
        display_name = str(claims.get("name", user_id))
        auth_mode = "jwt"
    else:
        if not settings.M7_ENABLE_DEMO_ROLE_SWITCH:
            raise M7Error("M7-4011", "演示切岗已关闭，请先通过账号密码登录获取 Bearer 令牌", http_status=401)
        role = (x_actor_role or "creator").strip()
        user_id = (x_actor_id or f"demo-{role}").strip()
        actor_org = x_org_id.strip() if x_org_id and x_org_id.strip() else None
        display_name = ROLE_DEFAULT_NAMES.get(role, user_id)
        auth_mode = "demo_header"

    if role not in ROLE_PERMISSIONS:
        await write_audit_event(
            session,
            org_id=org_ctx.org_id,
            action="RBAC_UNKNOWN_ROLE",
            actor_id=user_id,
            actor_role=role,
            ok=False,
            sentence_zh=f"未知角色 {role}（用户 {user_id}）尝试访问组织 {org_ctx.org_id} 的接口，系统已拒绝",
            trace_id=trace_id,
        )
        await session.commit()
        raise M7Error("M7-4031", f"未识别的岗位角色: {role}", http_status=403)

    if actor_org and actor_org != org_ctx.org_id:
        await write_audit_event(
            session,
            org_id=org_ctx.org_id,
            action="CROSS_ORG_DENIED",
            actor_id=user_id,
            actor_role=role,
            ok=False,
            sentence_zh=f"{display_name}({role}) 所属组织 {actor_org} 尝试越权访问组织 {org_ctx.org_id}，已被租户隔离拦截",
            payload={"actor_org_id": actor_org, "target_org_id": org_ctx.org_id},
            trace_id=trace_id,
        )
        await session.commit()
        raise M7Error("M7-4031", "跨组织访问被租户隔离门禁拒绝", http_status=403)

    allowed_shops: tuple[str, ...] = ()
    user_row = await session.scalar(
        select(M8UserAccount).where(M8UserAccount.org_id == org_ctx.org_id, M8UserAccount.user_id == user_id)
    )
    if user_row:
        if not user_row.is_active:
            await write_audit_event(
                session,
                org_id=org_ctx.org_id,
                module="RBAC",
                action="ACCOUNT_DISABLED_DENIED",
                actor_id=user_id,
                actor_role=role,
                ok=False,
                sentence_zh=f"已停用账号 {user_row.display_name}（{user_id}）尝试访问组织 {org_ctx.org_id}，已被拦截",
                trace_id=trace_id,
            )
            await session.commit()
            raise M7Error("M7-4031", f"账号 {user_id} 已停用，禁止访问平台", http_status=403)
        allowed_shops = tuple(user_row.allowed_shop_ids_json or [])

    return ActorContext(
        user_id=user_id,
        role=role,
        display_name=display_name,
        actor_org_id=actor_org,
        auth_mode=auth_mode,
        allowed_shop_ids=allowed_shops,
    )


def require_perm(perm_code: str) -> Callable:
    async def _dependency(
        request: Request,
        org_ctx: OrgContext = Depends(get_org_context),
        actor: ActorContext = Depends(get_actor_context),
        session: AsyncSession = Depends(get_db_session),
    ) -> ActorContext:
        trace_id = getattr(request.state, "trace_id", "")
        if perm_code not in actor.permissions:
            is_approve = perm_code == "m7:publish:approve"
            err_code = "M7-4032" if is_approve else "M7-4031"
            action = "APPROVE_ROLE_DENIED" if is_approve else "RBAC_PERM_DENIED"
            msg = (
                f"角色 {ROLE_LABELS_ZH.get(actor.role, actor.role)} 禁止执行主管审批（违反职责分离）"
                if is_approve
                else f"当前岗位 {ROLE_LABELS_ZH.get(actor.role, actor.role)} 无权限 {perm_code}"
            )
            await write_audit_event(
                session,
                org_id=org_ctx.org_id,
                action=action,
                actor_id=actor.user_id,
                actor_role=actor.role,
                ok=False,
                sentence_zh=f"{actor.display_name}（{actor.role}）尝试触发 {request.method} {request.url.path}（需权限 {perm_code}），被 RBAC 拦截",
                payload={"required_perm": perm_code, "path": request.url.path},
                trace_id=trace_id,
            )
            await session.commit()
            raise M7Error(err_code, msg, http_status=403)
        return actor

    return _dependency
