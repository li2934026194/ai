"""JWT 签发与校验（HS256，无服务端 session）。

token 只携带稳定身份和登录时快照；权限判断仍以数据库实时结果为准。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt as pyjwt

from rbac.config import (
    jwt_audience,
    jwt_issuer,
    jwt_secret,
    jwt_ttl_minutes,
)
from rbac.errors import RBACError
from rbac.principal import Principal


def create_access_token(principal: Principal) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": principal.user_id,
        "username": principal.username,
        "roles": list(principal.roles),
        "permissions": list(principal.permissions),
        "typ": "access",
        "iss": jwt_issuer(),
        "aud": jwt_audience(),
        "iat": now,
        "exp": now + timedelta(minutes=jwt_ttl_minutes()),
    }
    return pyjwt.encode(payload, jwt_secret(), algorithm="HS256")


def decode_access_token(token: str) -> Principal:
    if not token:
        raise RBACError("AUTH-401", "缺少访问令牌", 401)
    try:
        claims = pyjwt.decode(
            token,
            jwt_secret(),
            algorithms=["HS256"],
            audience=jwt_audience(),
            issuer=jwt_issuer(),
            options={"require": ["exp", "iat", "sub"]},
        )
    except pyjwt.ExpiredSignatureError as exc:
        raise RBACError("AUTH-401", "登录已过期，请重新登录", 401) from exc
    except pyjwt.PyJWTError as exc:
        raise RBACError("AUTH-401", "访问令牌无效", 401) from exc
    if claims.get("typ") != "access":
        raise RBACError("AUTH-401", "访问令牌类型错误", 401)
    principal = Principal.from_claims(claims)
    if not principal.user_id:
        raise RBACError("AUTH-401", "访问令牌缺少用户标识", 401)
    return principal
