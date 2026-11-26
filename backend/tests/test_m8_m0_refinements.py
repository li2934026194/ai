import pytest
from httpx import AsyncClient


def _hdr(role: str, user_id: str, org_id: str | None = None):
    h = {"X-Actor-Role": role, "X-Actor-Id": user_id}
    if org_id:
        h["X-Org-Id"] = org_id
    return h


@pytest.mark.asyncio
async def test_m8_real_login_deactivated_user_and_shop_acl(test_ctx, monkeypatch):
    client: AsyncClient = test_ctx["client"]

    # 1. Real password login issues valid HS256 JWT
    r_login = await client.post(
        "/api/v1/auth/login",
        json={"org_id": "org_demo", "user_id": "usr_approver", "password": "crosspilot123"},
    )
    assert r_login.status_code == 200
    token = r_login.json()["data"]["access_token"]
    assert r_login.json()["data"]["user"]["role_code"] == "approver"

    # Using Bearer JWT succeeds even when demo header switch is disabled
    monkeypatch.setenv("M7_ENABLE_DEMO_ROLE_SWITCH", "false")
    from app.core.config import get_settings
    get_settings.cache_clear()

    r_no_jwt = await client.get("/api/v1/orgs/org_demo/m8/roles", headers=_hdr("manager", "usr_manager"))
    assert r_no_jwt.status_code == 401

    r_with_jwt = await client.get(
        "/api/v1/orgs/org_demo/m8/roles",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_with_jwt.status_code == 200

    monkeypatch.setenv("M7_ENABLE_DEMO_ROLE_SWITCH", "true")
    get_settings.cache_clear()

    # 2. Create user with shop-level ACL ("AMZ-US-01")
    r_create = await client.post(
        "/api/v1/orgs/org_demo/m8/users",
        json={
            "user_id": "usr_amz_only",
            "display_name": "美区专员",
            "role_code": "planner",
            "email": "amz@crosspilot.ai",
            "password": "mysecret99",
            "allowed_shop_ids": ["AMZ-US-01"],
        },
        headers=_hdr("manager", "usr_manager"),
    )
    assert r_create.status_code == 200

    r_shops = await client.get("/api/v1/orgs/org_demo/m0/shops", headers=_hdr("planner", "usr_amz_only"))
    assert r_shops.status_code == 200
    shop_codes = [s["shop_code"] for s in r_shops.json()["data"]["items"]]
    assert shop_codes == ["AMZ-US-01"]

    # 3. Deactivate user -> both API & login blocked (403)
    r_disable = await client.put(
        "/api/v1/orgs/org_demo/m8/users/usr_amz_only",
        json={"role_code": "planner", "is_active": False, "allowed_shop_ids": ["AMZ-US-01"]},
        headers=_hdr("manager", "usr_manager"),
    )
    assert r_disable.status_code == 200

    r_blocked_api = await client.get("/api/v1/orgs/org_demo/m0/shops", headers=_hdr("planner", "usr_amz_only"))
    assert r_blocked_api.status_code == 403

    r_blocked_login = await client.post(
        "/api/v1/auth/login",
        json={"org_id": "org_demo", "user_id": "usr_amz_only", "password": "mysecret99"},
    )
    assert r_blocked_login.status_code == 403


@pytest.mark.asyncio
async def test_m0_shop_dup_sync_csv_dedup_fx_and_inventory_no_double_deduct(test_ctx):
    client: AsyncClient = test_ctx["client"]

    # 1. Duplicate shop_code returns 409 M7-4091 (not 500)
    r_dup = await client.post(
        "/api/v1/orgs/org_demo/m0/shops",
        json={"shop_code": "AMZ-US-01", "name": "Dup Shop", "platform": "amazon_us", "currency": "USD", "is_mock": False},
        headers=_hdr("manager", "usr_manager"),
    )
    assert r_dup.status_code == 409
    assert r_dup.json()["code"] == "M7-4091"

    # 2. Sync shop creates batch
    r_shops = await client.get("/api/v1/orgs/org_demo/m0/shops", headers=_hdr("manager", "usr_manager"))
    amz_shop = next(s for s in r_shops.json()["data"]["items"] if s["shop_code"] == "AMZ-US-01")
    r_sync = await client.post(
        f"/api/v1/orgs/org_demo/m0/shops/{amz_shop['shop_id']}/sync",
        headers=_hdr("manager", "usr_manager"),
    )
    assert r_sync.status_code == 200
    assert r_sync.json()["data"]["status"] == "SUCCESS"

    # 3. CSV import: dedup by order_id + partial error isolation + mock filename rejection
    r_mock_fn = await client.post(
        "/api/v1/orgs/org_demo/m0/orders/import-csv",
        json={
            "csv_text": "order_id,shop_id,sku,order_date,qty,revenue_usd\nORD-X1,shop_amz_us_org_demo,SKU-00704,2026-11-18,2,50",
            "filename": "demo_orders.csv",
            "source_type": "live",
        },
        headers=_hdr("planner", "usr_planner"),
    )
    assert r_mock_fn.status_code == 422

    csv_payload = (
        "order_id,shop_id,sku,order_date,qty,revenue_usd,is_mock,status\n"
        "ORD-DEDUP-1,shop_amz_us_org_demo,SKU-00704,2026-11-18,3,80.7,false,SETTLED\n"
        "ORD-BAD-1,shop_amz_us_org_demo,SKU-00704,2026-11-18,-5,10.0,false,SETTLED\n"
    )
    r_csv1 = await client.post(
        "/api/v1/orgs/org_demo/m0/orders/import-csv",
        json={"csv_text": csv_payload, "filename": "live_nov.csv", "source_type": "live"},
        headers=_hdr("planner", "usr_planner"),
    )
    assert r_csv1.status_code == 200
    assert r_csv1.json()["data"]["imported"] == 1
    assert r_csv1.json()["data"]["skipped_duplicates"] == 0
    assert len(r_csv1.json()["data"]["errors"]) == 1

    # Re-import same CSV -> ORD-DEDUP-1 is skipped
    r_csv2 = await client.post(
        "/api/v1/orgs/org_demo/m0/orders/import-csv",
        json={"csv_text": csv_payload, "filename": "live_nov.csv", "source_type": "live"},
        headers=_hdr("planner", "usr_planner"),
    )
    assert r_csv2.status_code == 200
    assert r_csv2.json()["data"]["imported"] == 0
    assert r_csv2.json()["data"]["skipped_duplicates"] == 1

    # 4. FX rates transparent table
    r_fx = await client.get("/api/v1/orgs/org_demo/m0/fx-rates", headers=_hdr("planner", "usr_planner"))
    assert r_fx.status_code == 200
    assert any(x["currency"] == "RMB" for x in r_fx.json()["data"]["items"])

    # 5. Inventory available == on_hand (no double-deduction of reserved)
    r_inv = await client.get("/api/v1/orgs/org_demo/m0/inventory", headers=_hdr("warehouse", "usr_warehouse"))
    assert r_inv.status_code == 200
    sku704 = next(i for i in r_inv.json()["data"]["items"] if i["sku"] == "SKU-00704")
    assert sku704["available"] == sku704["on_hand"]
    assert sku704["reserved"] == 12
