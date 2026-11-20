"""鉴权配置：全部从环境变量读取，不在模块导入时固化。

这样测试可以在单个用例内临时打开 AUTH_ENABLED，而不会污染其他 111 条基线测试。
生产必须设置 AUTH_JWT_SECRET（>=32 字节）、AUTH_ENABLED=1。
"""

from __future__ import annotations

import os

_DEV_SECRET = "pilot-dev-only-secret-change-me-32-bytes-minimum-2026"


def auth_enabled() -> bool:
    return os.environ.get("AUTH_ENABLED", "0").strip().lower() in {"1", "true", "yes", "on"}


def jwt_secret() -> str:
    # 本地/测试允许使用固定开发密钥，生产必须覆盖；启动脚本会检查长度。
    return os.environ.get("AUTH_JWT_SECRET") or _DEV_SECRET


def jwt_issuer() -> str:
    return os.environ.get("AUTH_JWT_ISSUER", "pilot")


def jwt_audience() -> str:
    return os.environ.get("AUTH_JWT_AUDIENCE", "pilot-api")


def jwt_ttl_minutes() -> int:
    try:
        value = int(os.environ.get("AUTH_JWT_TTL_MINUTES", "60"))
    except ValueError:
        value = 60
    return max(5, min(value, 24 * 60))


def cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "*").strip()
    if not raw or raw == "*":
        return ["*"]
    return [item.strip() for item in raw.split(",") if item.strip()]


def require_production_secret() -> list[str]:
    """返回配置问题清单；部署脚本拿它做启动前体检。"""
    issues: list[str] = []
    if not os.environ.get("AUTH_JWT_SECRET"):
        issues.append("AUTH_JWT_SECRET 未设置，不能在生产启用 AUTH_ENABLED=1")
    elif len(os.environ["AUTH_JWT_SECRET"].encode("utf-8")) < 32:
        issues.append("AUTH_JWT_SECRET 少于 32 字节，HS256 密钥强度不足")
    if os.environ.get("AUTH_ENABLED", "0") not in {"1", "true", "yes", "on"}:
        issues.append("AUTH_ENABLED 当前不是 1（演示模式），生产必须显式打开")
    return issues
