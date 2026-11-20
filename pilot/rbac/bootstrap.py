"""RBAC 建表与初始化。"""

from __future__ import annotations

from db import create_all
from rbac.service import RBACService


def ensure_rbac_schema() -> None:
    """create_all 是幂等的；新增 RBAC 表不会动已有业务表。"""
    create_all()


def seed_defaults(
    *,
    admin_username: str | None = None,
    admin_password: str | None = None,
    admin_display_name: str = "系统管理员",
) -> dict:
    ensure_rbac_schema()
    return RBACService().seed_defaults(
        admin_username=admin_username,
        admin_password=admin_password,
        admin_display_name=admin_display_name,
    )
