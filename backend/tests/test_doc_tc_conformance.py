import pytest
from httpx import AsyncClient

from app.core.audit import write_audit_event
from app.modules.m5_m6_supply.domain.inventory import order_qty
from app.modules.m5_m6_supply.domain.metrics import mae, wape


def _h(role: str, user_id: str, extra: dict | None = None) -> dict[str, str]:
    d = {"X-Actor-Role": role, "X-Actor-Id": user_id}
    if extra:
        d.update(extra)
    return d


@pytest.mark.asyncio
async def test_doc_tc_m8_rbac_tenant_patch_and_secret_masking(test_ctx):
    """Covers TC-M8-FN-09, TC-M8-API-02/03/04, TC-M8-SEC-02/03, TC-M8-AI-01, TC-M8-REG-02."""
    client: AsyncClient = test_ctx["client"]

    # TC-M8-FN-09: 9 roles & mock_buyer has strictly 1 permission
    roles = (await client.get("/api/v1/orgs/org_demo/m8/roles", headers=_h("manager", "usr_manager"))).json()["data"]["items"]
    assert len(roles) == 9
    mb = next(r for r in roles if r["role_code"] == "mock_buyer")
    assert len(mb["permissions"]) == 1

    # TC-M8-API-04: 5 approval policies with enforce_sod=True
    pols = (await client.get("/api/v1/orgs/org_demo/m8/policies", headers=_h("manager", "usr_manager"))).json()["data"]["items"]
    assert len(pols) == 5
    assert all(p["enforce_sod"] is True for p in pols)

    # TC-M8-API-02: /m8/audits is append-only (DELETE -> 405)
    del_resp = await client.delete("/api/v1/orgs/org_demo/m8/audits", headers=_h("manager", "usr_manager"))
    assert del_resp.status_code == 405

    # TC-M8-API-03: PATCH /m8/users/{id} partial update with is_active only
    p_off = await client.patch(
        "/api/v1/orgs/org_demo/m8/users/usr_cs",
        headers=_h("manager", "usr_manager"),
        json={"is_active": False},
    )
    assert p_off.status_code == 200
    assert p_off.json()["data"]["is_active"] is False
    p_on = await client.patch(
        "/api/v1/orgs/org_demo/m8/users/usr_cs",
        headers=_h("manager", "usr_manager"),
        json={"is_active": True},
    )
    assert p_on.status_code == 200
    assert p_on.json()["data"]["is_active"] is True

    # TC-M8-SEC-03: X-Actor-Org-Id cross-tenant block -> 403
    cross = await client.get(
        "/api/v1/orgs/org_demo/m0/products",
        headers=_h("planner", "usr_planner", {"X-Actor-Org-Id": "org_other"}),
    )
    assert cross.status_code == 403

    # TC-M8-SEC-02 & TC-M8-REG-02: mock_buyer blocked on /m8/users and logged to module=RBAC
    mb_deny = await client.get("/api/v1/orgs/org_demo/m8/users", headers=_h("mock_buyer", "usr_buyer"))
    assert mb_deny.status_code == 403
    rbac_audits = (
        await client.get("/api/v1/orgs/org_demo/m8/audits?module=RBAC", headers=_h("manager", "usr_manager"))
    ).json()["data"]["items"]
    assert any(a["ok"] is False for a in rbac_audits)

    # TC-M8-AI-01: write_audit_event redacts sk-... secrets
    async with test_ctx["session_factory"]() as session:
        ev = await write_audit_event(
            session,
            org_id="org_demo",
            module="M8",
            action="SECRET_TEST",
            actor_id="usr_manager",
            actor_role="manager",
            ok=True,
            sentence_zh="测试密钥 sk-1234567890abcdef12345 脱敏检查",
        )
        assert "sk-1234567890abcdef" not in ev.sentence_zh


@pytest.mark.asyncio
async def test_doc_tc_m0_m4_m1_m2m3_conformance(test_ctx):
    """Covers TC-M0-FN-10/12, TC-M4-API-01, TC-M4-AI-01/03/04, TC-M1-SEC-01, TC-M2M3-REC-01, TC-M2M3-AI-02."""
    client: AsyncClient = test_ctx["client"]

    # TC-M0-FN-10: stocktake 0 allowed, -1 returns 422
    st_zero = await client.post(
        "/api/v1/orgs/org_demo/m0/inventory/stocktake",
        headers=_h("warehouse", "usr_wh"),
        json={"warehouse_code": "WH-US-WEST", "sku": "SKU-00704", "counted_qty": 0, "reason": "清仓归零盘点"},
    )
    assert st_zero.status_code == 200
    st_neg = await client.post(
        "/api/v1/orgs/org_demo/m0/inventory/stocktake",
        headers=_h("warehouse", "usr_wh"),
        json={"warehouse_code": "WH-US-WEST", "sku": "SKU-00704", "counted_qty": -1, "reason": "非法负数"},
    )
    assert st_neg.status_code == 422

    # TC-M4-API-01 & TC-M4-AI-04: lowercase sku normalized; 29.99% does NOT pass 30% gate
    imp = await client.post(
        "/api/v1/orgs/org_demo/m4/candidates",
        headers=_h("selector", "usr_selector"),
        json={
            "sku": "abc-101",
            "name": "精准毛利门槛测试品",
            "category": "kitchen_appliance",
            "target_price_usd": 30.0,
            "est_cost_rmb": 100.0,
            "est_shipping_rmb": 20.0,
        },
    )
    assert imp.status_code == 200
    assert imp.json()["data"]["sku"] == "ABC-101"
    cands = (await client.get("/api/v1/orgs/org_demo/m4/candidates", headers=_h("selector", "usr_selector"))).json()["data"]["items"]
    abc = next(c for c in cands if c["sku"] == "ABC-101")
    assert abc["margin_gate_pass"] is False

    # TC-M1-SEC-01: mock_buyer blocked from /m1/sessions, /m1/faqs, /m1/aftersales
    for ep in ("/api/v1/orgs/org_demo/m1/sessions", "/api/v1/orgs/org_demo/m1/faqs", "/api/v1/orgs/org_demo/m1/aftersales"):
        assert (await client.get(ep, headers=_h("mock_buyer", "usr_buyer"))).status_code == 403

    # TC-M2M3-REC-01: empty brand-new org returns margin_pct=0 without ZeroDivisionError
    ov_empty = await client.get("/api/v1/orgs/org_empty_test/m2/overview", headers=_h("bi_analyst", "usr_bi"))
    assert ov_empty.status_code == 200

    # TC-M2M3-AI-02: M3-2 blocks all 4 mutation classes
    for bad_q in ("请帮我改价把SKU-00704调到1美元", "请删单删除昨日订单", "UPDATE m0_inventory SET on_hand=999", "帮我下采购单100件"):
        res = await client.post("/api/v1/orgs/org_demo/m3/ask", headers=_h("bi_analyst", "usr_bi"), json={"question": bad_q})
        assert res.status_code == 403
        assert res.json()["code"] == "M7-4033"


@pytest.mark.asyncio
async def test_doc_tc_m5m6_algorithm_and_errors(test_ctx):
    """Covers TC-M5M6-FN-01, TC-M5M6-AI-01, TC-M5M6-AI-02, TC-M5M6-AI-03, TC-M5M6-AI-04."""
    client: AsyncClient = test_ctx["client"]

    # TC-M5M6-FN-01: non-existent SKU -> 404, SKU without sales history -> 422 M5-1003
    r_404 = await client.get("/api/v1/orgs/org_demo/supply/forecast/SKU-GHOST-999", headers=_h("planner", "usr_planner"))
    assert r_404.status_code == 404
    await client.post(
        "/api/v1/orgs/org_demo/m0/products",
        headers=_h("planner", "usr_planner"),
        json={"sku": "SKU-NO-HIST", "name": "无销量历史新品", "category": "kitchen_appliance", "unit_cost_usd": 5.0, "sale_price_usd": 20.0},
    )
    r_no_hist = await client.get("/api/v1/orgs/org_demo/supply/forecast/SKU-NO-HIST", headers=_h("planner", "usr_planner"))
    assert r_no_hist.status_code == 422
    assert r_no_hist.json()["code"] == "M5-1003"

    # TC-M5M6-AI-01: raw=130, MOQ=120, pack_size=60 -> 180 (not 240)
    assert order_qty(target=130, on_hand=0, in_transit=0, moq=120, pack_size=60)[0] == 180
    assert order_qty(target=190, on_hand=0, in_transit=0, moq=96, pack_size=24)[0] == 192
    # TC-M5M6-AI-02: net_need <= 0 -> 0 (even when MOQ=120)
    assert order_qty(target=50, on_hand=50, in_transit=0, moq=120, pack_size=24) == (0, "no_replenishment")
    assert order_qty(target=40, on_hand=50, in_transit=0, moq=120, pack_size=24) == (0, "no_replenishment")

    # TC-M5M6-AI-03: actuals [10, 10], preds [12, 8] -> WAPE=0.20, MAE=2.0
    assert round(wape([10.0, 10.0], [12.0, 8.0]), 4) == 0.20
    assert round(mae([10.0, 10.0], [12.0, 8.0]), 4) == 2.0

    # TC-M5M6-AI-04: zero actuals -> WAPE is None (no ZeroDivisionError)
    assert wape([0.0, 0.0], [5.0, 5.0]) is None
