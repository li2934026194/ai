import io
import os
import subprocess
from pathlib import Path
from PIL import Image
import pytest
from sqlalchemy import inspect, select

from app.contracts.product_catalog_contract import ProductCatalogContract
from app.contracts.voice_faq_contract import VoiceFaqContract
from app.core.auth_rbac import ROLE_PERMISSIONS, issue_actor_jwt, verify_actor_jwt
from app.core.config import redact_secrets
from app.core.database import create_engine_from_url
from app.core.exceptions import M7Error
from app.core.storage import FileStorage
from app.modules.m7_content.models import (
    CoreAuditEvent,
    M7ComplianceRule,
    M7WorkflowRegistry,
)
from app.modules.m7_content.schemas import (
    ALL_ASSET_SLOTS,
    normalize_category,
    normalize_platform,
)


def test_alembic_upgrade_creates_all_9_tables(tmp_path: Path):
    db_path = tmp_path / "alembic_check.db"
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"
    alembic_bin = str(Path("/tmp/m7venv/bin/alembic"))
    if not Path(alembic_bin).exists():
        alembic_bin = "alembic"
    res = subprocess.run(
        [alembic_bin, "upgrade", "head"],
        cwd=str(Path(__file__).resolve().parents[1]),
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    assert res.returncode == 0

    import sqlite3

    con = sqlite3.connect(str(db_path))
    tables = {
        row[0]
        for row in con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    }
    con.close()
    expected = {
        "m7_workflow_registry",
        "m7_generation_jobs",
        "m7_generation_assets",
        "m7_generation_media",
        "m7_compliance_rules",
        "m7_cert_records",
        "m7_compliance_checks",
        "m7_approval_records",
        "core_audit_events",
    }
    assert expected.issubset(tables)


def test_canonical_enums_and_secret_redaction():
    assert len(ALL_ASSET_SLOTS) == 17
    assert normalize_platform("Amazon US") == "amazon_us"
    assert normalize_platform("Shopee 泰国") == "shopee_th"
    assert normalize_platform("TikTok Shop 美区") == "tiktok_us"
    assert normalize_category("厨卫小电") == "kitchen_appliance"
    assert normalize_category("箱包出行") == "bags_travel"
    assert "sk-***" not in redact_secrets("failed with sk-abc123456789xyz")
    assert "***REDACTED***" in redact_secrets("failed with sk-abc123456789xyz")


def test_file_storage_magic_bytes_and_traversal_guard(tmp_path: Path):
    storage = FileStorage(tmp_path)
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (255, 255, 255)).save(buf, format="PNG")
    mime, size, sha = storage.save_bytes(
        "orgs/org_demo/SKU-00704/img_0.png",
        buf.getvalue(),
        allowed_mimes={"image/png", "image/jpeg", "image/webp"},
    )
    assert mime == "image/png"
    assert size > 0
    assert len(sha) == 64

    with pytest.raises(M7Error) as e_zero:
        storage.save_bytes("orgs/org_demo/zero.png", b"", allowed_mimes={"image/png"})
    assert e_zero.value.code == "M7-4241"

    with pytest.raises(M7Error) as e_fake:
        storage.save_bytes("orgs/org_demo/fake.png", b"NOT_AN_IMAGE", allowed_mimes={"image/png"})
    assert e_fake.value.code == "M7-4241"

    with pytest.raises(M7Error) as e_trav:
        storage.resolve_safe("../../etc/passwd")
    assert e_trav.value.code == "M7-4001"


async def test_health_probes_seed_and_contracts(test_ctx):
    client = test_ctx["client"]
    r1 = await client.get("/healthz")
    assert r1.status_code == 200
    assert r1.json()["data"]["status"] == "healthy"

    r2 = await client.get("/api/v1/orgs/org_demo/m7/health")
    assert r2.status_code == 200
    d2 = r2.json()["data"]
    assert d2["cloud_provider"] == "dashscope"
    assert d2["dashscope_key_configured"] is False
    assert d2["strict_separation_of_duties"] is True

    async with test_ctx["session_factory"]() as s:
        rules = (
            await s.scalars(
                select(M7ComplianceRule).where(M7ComplianceRule.org_id == "org_demo")
            )
        ).all()
        wfs = (await s.scalars(select(M7WorkflowRegistry))).all()
        assert len(rules) == 12
        assert len(wfs) == 4

    products = ProductCatalogContract().list_available_products("org_demo")
    assert len(products) >= 4
    faq = VoiceFaqContract().get_faq_for_sku("org_demo", "SKU-00704")
    assert len(faq.pain_points) >= 1


async def test_rbac_9_roles_and_cross_org_isolation(test_ctx):
    client = test_ctx["client"]
    assert len(ROLE_PERMISSIONS) == 9
    assert "m7:publish:approve" in ROLE_PERMISSIONS["approver"]
    assert "m7:publish:approve" not in ROLE_PERMISSIONS["creator"]
    assert "m7:rule:maintain" not in ROLE_PERMISSIONS["creator"]

    # 可读角色可查审计台账
    for role in ("approver", "creator", "manager", "planner", "selector"):
        resp = await client.get(
            "/api/v1/orgs/org_demo/m7/audit",
            headers={"X-Actor-Role": role, "X-Actor-Id": f"u-{role}"},
        )
        assert resp.status_code == 200

    # 无 M7 权限角色返回 403 且写中文审计
    for role in ("bi_analyst", "warehouse", "cs", "mock_buyer"):
        resp = await client.get(
            "/api/v1/orgs/org_demo/m7/audit",
            headers={"X-Actor-Role": role, "X-Actor-Id": f"u-{role}"},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "M7-4031"

    # 跨组织越权拦截
    cross = await client.get(
        "/api/v1/orgs/org_demo/m7/audit",
        headers={"X-Actor-Role": "creator", "X-Org-Id": "org_other"},
    )
    assert cross.status_code == 403
    assert cross.json()["code"] == "M7-4031"

    # JWT 签发与校验
    tok = issue_actor_jwt("u-lin", "creator", "org_demo")
    claims = verify_actor_jwt(tok)
    assert claims["role"] == "creator"
    jwt_ok = await client.get(
        "/api/v1/orgs/org_demo/m7/audit",
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert jwt_ok.status_code == 200

    async with test_ctx["session_factory"]() as s:
        denied = (
            await s.scalars(
                select(CoreAuditEvent).where(
                    CoreAuditEvent.org_id == "org_demo",
                    CoreAuditEvent.ok.is_(False),
                )
            )
        ).all()
        assert len(denied) >= 5
        assert any(e.action == "CROSS_ORG_DENIED" for e in denied)
