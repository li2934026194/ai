"""PACK 23：RBAC / JWT / 权限装饰器回归。

测试自己创建唯一用户并在结束时清理；不依赖手工预置账号。
"""

from __future__ import annotations

import os
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import text

from api.main import app
from db import engine
from rbac.bootstrap import ensure_rbac_schema
from rbac.context import use_principal
from rbac.decorators import require_permission
from rbac.errors import RBACError
from rbac.service import RBACService

DS = "ds_00b31ed333b05de698c0"
SKU = "SKU-017"


@require_permission("rbac:user:read")
def _protected_probe() -> str:
    return "ok"


class TestRBAC(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_rbac_schema()
        RBACService().seed_defaults()
        suffix = uuid4().hex[:8]
        cls.admin_name = f"rbac_admin_{suffix}"
        cls.viewer_name = f"rbac_viewer_{suffix}"
        cls.admin = RBACService().create_user(
            username=cls.admin_name,
            password="AdminPass12345",
            role_codes=["admin"],
            display_name="测试管理员",
        )
        cls.viewer = RBACService().create_user(
            username=cls.viewer_name,
            password="ViewerPass12345",
            role_codes=["viewer"],
            display_name="测试观察者",
        )
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        try:
            cls.client.__exit__(None, None, None)
        finally:
            # 先降级管理员再删除，避免“最后一个管理员不能删除”的保护误伤清理。
            RBACService().update_user(cls.admin["id"], role_codes=["viewer"])
            RBACService().delete_user(cls.admin["id"])
            RBACService().delete_user(cls.viewer["id"])

    def setUp(self):
        os.environ.pop("AUTH_ENABLED", None)

    def tearDown(self):
        os.environ.pop("AUTH_ENABLED", None)

    def _login(self, username: str, password: str) -> dict:
        resp = self.client.post(
            "/api/auth/login",
            json={"username": username, "password": password},
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        return resp.json()

    def _auth(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    # ------------------------------------------------------------------ 登录
    def test_01_login_and_me(self):
        body = self._login(self.admin_name, "AdminPass12345")
        token = body["access_token"]
        self.assertEqual(body["token_type"], "bearer")
        self.assertIn("admin", body["user"]["roles"])
        me = self.client.get("/api/auth/me", headers=self._auth(token))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["user"]["username"], self.admin_name)

    def test_02_wrong_password_is_401(self):
        resp = self.client.post(
            "/api/auth/login",
            json={"username": self.admin_name, "password": "wrong-password"},
        )
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.json()["code"], "AUTH-401")

    # ------------------------------------------------------------- 中间件 401/403
    def test_03_auth_enabled_requires_token(self):
        os.environ["AUTH_ENABLED"] = "1"
        self.assertEqual(self.client.get("/api/health").status_code, 200)
        self.assertEqual(self.client.get("/api/datasets").status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_04_viewer_cannot_read_users(self):
        viewer = self._login(self.viewer_name, "ViewerPass12345")
        os.environ["AUTH_ENABLED"] = "1"
        resp = self.client.get(
            "/api/rbac/users", headers=self._auth(viewer["access_token"])
        )
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()["code"], "AUTH-403")
        # 同一 viewer 仍能读数据集：权限不是“一刀切禁止”。
        self.assertEqual(
            self.client.get(
                "/api/datasets", headers=self._auth(viewer["access_token"])
            ).status_code,
            200,
        )

    # ------------------------------------------------------------- 管理接口
    def test_05_admin_can_manage_users(self):
        admin = self._login(self.admin_name, "AdminPass12345")
        headers = self._auth(admin["access_token"])
        listing = self.client.get("/api/rbac/users", headers=headers)
        self.assertEqual(listing.status_code, 200)
        self.assertGreaterEqual(listing.json()["total"], 2)

        temp_name = f"rbac_temp_{uuid4().hex[:8]}"
        created = self.client.post(
            "/api/rbac/users",
            headers=headers,
            json={
                "username": temp_name,
                "password": "TempPass12345",
                "role_codes": ["viewer"],
            },
        )
        self.assertEqual(created.status_code, 201, created.text)
        temp_id = created.json()["id"]
        self.assertEqual(created.json()["roles"], ["viewer"])
        deleted = self.client.delete(f"/api/rbac/users/{temp_id}", headers=headers)
        self.assertEqual(deleted.status_code, 200, deleted.text)

    def test_06_viewer_cannot_create_user(self):
        viewer = self._login(self.viewer_name, "ViewerPass12345")
        os.environ["AUTH_ENABLED"] = "1"
        resp = self.client.post(
            "/api/rbac/users",
            headers=self._auth(viewer["access_token"]),
            json={"username": "forbidden_user", "password": "Forbidden12345"},
        )
        self.assertEqual(resp.status_code, 403)

    # --------------------------------------------------------- 服务装饰器
    def test_07_decorator_requires_principal(self):
        os.environ["AUTH_ENABLED"] = "1"
        with self.assertRaises(RBACError) as ctx:
            _protected_probe()
        self.assertEqual(ctx.exception.status_code, 401)

    def test_08_decorator_denies_viewer(self):
        viewer_principal = RBACService().authenticate(
            self.viewer_name, "ViewerPass12345"
        )
        os.environ["AUTH_ENABLED"] = "1"
        with use_principal(viewer_principal), self.assertRaises(RBACError) as ctx:
            _protected_probe()
        self.assertEqual(ctx.exception.status_code, 403)

    def test_09_decorator_allows_admin(self):
        admin_principal = RBACService().authenticate(
            self.admin_name, "AdminPass12345"
        )
        os.environ["AUTH_ENABLED"] = "1"
        with use_principal(admin_principal):
            self.assertEqual(_protected_probe(), "ok")

    # --------------------------------------------------------- 身份不可伪造
    def test_10_route_uses_token_identity_not_body(self):
        admin = self._login(self.admin_name, "AdminPass12345")
        os.environ["AUTH_ENABLED"] = "1"
        resp = self.client.post(
            "/api/p3/apply",
            headers=self._auth(admin["access_token"]),
            json={
                "dataset_id": DS,
                "sku": SKU,
                "qty_propose": 1,
                "submit_user": "spoofed_user",
            },
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        apply_row = resp.json()["apply"]
        self.assertEqual(apply_row["submit_user"], self.admin_name)
        with engine.begin() as con:
            con.execute(
                text("delete from replenish_apply where apply_id=:a"),
                {"a": apply_row["apply_id"]},
            )

    def test_11_denials_are_audited(self):
        viewer = self._login(self.viewer_name, "ViewerPass12345")
        admin = self._login(self.admin_name, "AdminPass12345")
        os.environ["AUTH_ENABLED"] = "1"
        self.client.get(
            "/api/rbac/users", headers=self._auth(viewer["access_token"])
        )
        audit = self.client.get(
            "/api/rbac/audit", headers=self._auth(admin["access_token"])
        )
        self.assertEqual(audit.status_code, 200)
        self.assertGreaterEqual(audit.json()["total"], 1)
        self.assertTrue(
            any(item["result"] == "deny" for item in audit.json()["items"])
        )
