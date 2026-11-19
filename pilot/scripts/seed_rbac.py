"""初始化 RBAC 默认权限/角色，并可创建管理员。

用法（PowerShell）：
  $env:RBAC_ADMIN_USERNAME="admin"
  $env:RBAC_ADMIN_PASSWORD="change-me-at-least-8-chars"
  .venv\\Scripts\\python.exe scripts\\seed_rbac.py

不提供管理员账号时只建默认权限/角色，不创建任何可登录用户（生产更安全）。
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rbac.bootstrap import ensure_rbac_schema  # noqa: E402
from rbac.service import RBACService  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="初始化 RBAC 默认权限/角色")
    parser.add_argument(
        "--admin-username",
        default=os.environ.get("RBAC_ADMIN_USERNAME", ""),
        help="管理员用户名；留空则只建权限/角色",
    )
    parser.add_argument(
        "--admin-password",
        default=os.environ.get("RBAC_ADMIN_PASSWORD", ""),
        help="管理员密码（至少 8 位）；生产必须从环境变量传入",
    )
    parser.add_argument(
        "--admin-display-name",
        default=os.environ.get("RBAC_ADMIN_DISPLAY_NAME", "系统管理员"),
    )
    args = parser.parse_args()

    ensure_rbac_schema()
    result = RBACService().seed_defaults(
        admin_username=args.admin_username or None,
        admin_password=args.admin_password or None,
        admin_display_name=args.admin_display_name,
    )
    print(
        "RBAC 初始化完成："
        f"新增权限 {result['permissions']}，新增角色 {result['roles']}，"
        f"管理员 {result['admin'] or '未创建'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
