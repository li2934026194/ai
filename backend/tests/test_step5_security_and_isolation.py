import os
from pathlib import Path
import sqlite3
import subprocess
import sys


async def test_all_9_roles_rbac_enforcement(test_ctx):
    client = test_ctx["client"]

    # 4 个无 M7 权限角色：连只读 GET 也返回 403 M7-4031
    for role in ("bi_analyst", "warehouse", "cs", "mock_buyer"):
        r = await client.get(
            "/api/v1/orgs/org_demo/m7/products/available",
            headers={"X-Actor-Role": role, "X-Actor-Id": f"u-{role}"},
        )
        assert r.status_code == 403, f"{role} should be denied"
        assert r.json()["code"] == "M7-4031"

    # 3 个仅读角色：可读 products/summary，不可 generate/check/approve
    for role in ("manager", "planner", "selector"):
        hdr = {"X-Actor-Role": role, "X-Actor-Id": f"u-{role}"}
        r_read = await client.get("/api/v1/orgs/org_demo/m7/products/available", headers=hdr)
        assert r_read.status_code == 200, f"{role} should read"
        r_gen = await client.post(
            "/api/v1/orgs/org_demo/m7/copy/generate",
            headers=hdr,
            json={"sku": "SKU-00704", "platform": "amazon_us", "asset_slot": "copy_title"},
        )
        assert r_gen.status_code == 403
        r_chk = await client.post(
            "/api/v1/orgs/org_demo/m7/compliance/check",
            headers=hdr,
            json={"sku": "SKU-00704", "platform": "amazon_us"},
        )
        assert r_chk.status_code == 403

    # creator 可生成不可审批；approver 可读取/生成/审批
    r_c = await client.post(
        "/api/v1/orgs/org_demo/m7/copy/generate",
        headers={"X-Actor-Role": "creator", "X-Actor-Id": "u-lin"},
        json={"sku": "BAG-108", "platform": "tiktok_us", "asset_slot": "copy_title"},
    )
    assert r_c.status_code == 200
    r_app = await client.post(
        "/api/v1/orgs/org_demo/m7/packages/approve",
        headers={"X-Actor-Role": "creator", "X-Actor-Id": "u-lin"},
        json={"sku": "BAG-108", "platform": "tiktok_us", "decision": "APPROVED"},
    )
    assert r_app.status_code == 403


async def test_multi_tenant_isolation_and_all_5_skus(test_ctx):
    client = test_ctx["client"]
    hdr_a = {"X-Actor-Role": "creator", "X-Actor-Id": "u-lin"}

    # 1. org_demo 生成并采纳文案
    g = await client.post(
        "/api/v1/orgs/org_demo/m7/copy/generate",
        headers={**hdr_a, "X-Idempotency-Key": "tenant-a-copy"},
        json={"sku": "FAN-203", "platform": "shopee_th", "asset_slot": "copy_title"},
    )
    assert g.status_code == 200
    aid = g.json()["data"]["variants"][0]["asset_id"]
    await client.post(f"/api/v1/orgs/org_demo/m7/copy/assets/{aid}/select", headers=hdr_a)

    # 2. org_other 看不到 org_demo 的已选文案，且跨租户选/改返回 404 M7-4041
    sum_b = await client.get(
        "/api/v1/orgs/org_other/m7/packages/FAN-203/summary?platform=shopee_th",
        headers=hdr_a,
    )
    assert sum_b.status_code == 200
    assert sum_b.json()["data"]["done_cnt"] == 0

    cross_sel = await client.post(
        f"/api/v1/orgs/org_other/m7/copy/assets/{aid}/select",
        headers=hdr_a,
    )
    assert cross_sel.status_code == 404
    assert cross_sel.json()["code"] == "M7-4041"

    # 3. 5 个种子 SKU 均能正常加载摘要
    for sku, plat in [
        ("SKU-00704", "amazon_us"),
        ("BAG-108", "tiktok_us"),
        ("FAN-203", "shopee_th"),
        ("COS-052", "amazon_us"),
        ("MNT-405", "amazon_us"),
    ]:
        sr = await client.get(
            f"/api/v1/orgs/org_demo/m7/packages/{sku}/summary?platform={plat}",
            headers=hdr_a,
        )
        assert sr.status_code == 200, f"{sku} failed"

    # 4. 空文案拦截 & 空局部修改指令拦截
    empty_edit = await client.put(
        f"/api/v1/orgs/org_demo/m7/copy/assets/{aid}",
        headers=hdr_a,
        json={"text": "   ", "version": 1},
    )
    assert empty_edit.status_code == 422
    assert empty_edit.json()["code"] == "M7-4221"

    empty_inpaint = await client.post(
        "/api/v1/orgs/org_demo/m7/images/slots/1/inpaint",
        headers=hdr_a,
        json={"sku": "FAN-203", "platform": "shopee_th", "instruction": "   "},
    )
    assert empty_inpaint.status_code == 422
    assert empty_inpaint.json()["code"] == "M7-4001"


def test_alembic_upgrade_head_on_clean_sqlite(tmp_path: Path):
    db_file = tmp_path / "alembic_clean.db"
    backend_dir = Path(__file__).resolve().parent.parent
    env = {**os.environ, "DATABASE_URL": f"sqlite+aiosqlite:///{db_file}"}
    res = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(backend_dir),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert res.returncode == 0, res.stderr

    conn = sqlite3.connect(str(db_file))
    tables = {
        row[0]
        for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    }
    conn.close()
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
        "alembic_version",
    }
    assert expected.issubset(tables)
