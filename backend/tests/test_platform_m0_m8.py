import pytest
from httpx import AsyncClient


def _hdr(role: str, user_id: str):
    return {
        "X-Actor-Role": role,
        "X-Actor-Id": user_id,
    }


@pytest.mark.asyncio
async def test_m8_and_m0_cost_sod_and_inventory(test_ctx):
    client: AsyncClient = test_ctx["client"]
    # M8 roles & users
    r = await client.get("/api/v1/orgs/org_demo/m8/roles", headers=_hdr("manager", "usr_manager"))
    assert r.status_code == 200
    assert len(r.json()["data"]["items"]) == 9

    # M0 shops & products
    r = await client.get("/api/v1/orgs/org_demo/m0/products", headers=_hdr("planner", "usr_planner"))
    assert r.status_code == 200
    assert any(p["sku"] == "SKU-00704" for p in r.json()["data"]["items"])

    # M0 cost change request with SoD enforcement
    r_prop = await client.post(
        "/api/v1/orgs/org_demo/m0/cost-requests",
        json={"sku": "SKU-00704", "new_cost_usd": 5.10, "reason": "新模降本"},
        headers=_hdr("planner", "usr_planner"),
    )
    assert r_prop.status_code == 200
    req_id = r_prop.json()["data"]["req_id"]

    # Self-approval blocked even if approver tries with same user_id
    r_self = await client.post(
        f"/api/v1/orgs/org_demo/m0/cost-requests/{req_id}/decide",
        json={"decision": "APPROVED"},
        headers=_hdr("approver", "usr_planner"),
    )
    assert r_self.status_code == 403

    # Different approver actor succeeds
    r_ok = await client.post(
        f"/api/v1/orgs/org_demo/m0/cost-requests/{req_id}/decide",
        json={"decision": "APPROVED"},
        headers=_hdr("approver", "usr_approver"),
    )
    assert r_ok.status_code == 200
    assert r_ok.json()["data"]["status"] == "APPROVED"

    # Stocktake
    r_st = await client.post(
        "/api/v1/orgs/org_demo/m0/inventory/stocktake",
        json={"sku": "SKU-00704", "warehouse_code": "FBA-ONT8", "counted_qty": 225, "reason": "周期实盘"},
        headers=_hdr("warehouse", "usr_warehouse"),
    )
    assert r_st.status_code == 200
    assert r_st.json()["data"]["on_hand"] == 225


@pytest.mark.asyncio
async def test_m4_approval_flows_to_m0_and_m7_and_m1_faq_sync(test_ctx):
    client: AsyncClient = test_ctx["client"]
    # M4 import -> evaluate -> submit -> supervisor approve -> automatically visible in M7
    r_imp = await client.post(
        "/api/v1/orgs/org_demo/m4/candidates",
        json={
            "sku": "NEW-999",
            "name": "便携无线咖啡磨豆机",
            "category": "kitchen_appliance",
            "target_price_usd": 39.9,
            "est_cost_rmb": 55.0,
            "est_shipping_rmb": 18.0,
        },
        headers=_hdr("selector", "usr_selector"),
    )
    assert r_imp.status_code == 200
    cid = r_imp.json()["data"]["candidate_id"]

    r_eval = await client.post(
        f"/api/v1/orgs/org_demo/m4/candidates/{cid}/evaluate",
        json={
            "target_price_usd": 39.9,
            "est_cost_rmb": 55.0,
            "est_shipping_rmb": 18.0,
            "scores": {"demand": 90, "competition": 82, "margin": 88, "supply": 85, "compliance": 84},
            "operator_note": "咖啡类目高毛利测款",
            "submit_for_approval": True,
        },
        headers=_hdr("selector", "usr_selector"),
    )
    assert r_eval.status_code == 200
    assert r_eval.json()["data"]["status"] == "PENDING_APPROVAL"

    # Approver approves -> updates M0Product & shows up in M7 products
    r_dec = await client.post(
        f"/api/v1/orgs/org_demo/m4/candidates/{cid}/decide",
        json={"decision": "APPROVED", "note": "同意立项测款"},
        headers=_hdr("approver", "usr_approver"),
    )
    assert r_dec.status_code == 200

    r_m7 = await client.get("/api/v1/orgs/org_demo/m7/products/available", headers=_hdr("creator", "usr_creator"))
    assert r_m7.status_code == 200
    assert any(item["sku"] == "NEW-999" and item["origin"] == "M4_APPROVED" for item in r_m7.json()["data"]["items"])

    # M1 FAQ update (by planner) & buyer simulator (by cs)
    r_faq = await client.post(
        "/api/v1/orgs/org_demo/m1/faqs",
        json={
            "sku": "NEW-999",
            "pain_points": ["研磨粗细档位调节是否清晰"],
            "faq_pairs": [{"q": "支持多少档粗细？", "a": "支持 38 档精调刻度，适配意式与手冲。"}],
        },
        headers=_hdr("planner", "usr_planner"),
    )
    assert r_faq.status_code == 200

    r_sim = await client.post(
        "/api/v1/orgs/org_demo/m1/simulator/ask",
        json={"sku": "NEW-999", "question": "Can I adjust grind size for espresso?"},
        headers=_hdr("cs", "usr_cs"),
    )
    assert r_sim.status_code == 200
    assert "38 档" in r_sim.json()["data"]["suggested_reply"]


@pytest.mark.asyncio
async def test_m5_m6_forecast_sandbox_and_replenish_state_machine(test_ctx):
    client: AsyncClient = test_ctx["client"]
    # M5 forecast + M6 suggestion + routes + objectives
    r_fc = await client.get(
        "/api/v1/orgs/org_demo/supply/forecast/SKU-00704?route_code=sea&objective_mode=profit",
        headers=_hdr("planner", "usr_planner"),
    )
    assert r_fc.status_code == 200
    fc = r_fc.json()["data"]
    assert fc["best_model"] is not None
    assert len(fc["route_plan"]["routes"]) == 4
    assert len(fc["route_plan"]["objectives"]) == 3
    assert fc["suggestion"]["zero_days"] == 3  # 3 stockout days in seeded history

    # What-If sandbox
    r_sb = await client.post(
        "/api/v1/orgs/org_demo/supply/sandbox",
        json={"sku": "SKU-00704", "route_code": "air", "objective_mode": "sales", "demand_multiplier": 1.3},
        headers=_hdr("planner", "usr_planner"),
    )
    assert r_sb.status_code == 200
    assert r_sb.json()["data"]["qty_suggest"] > 0

    # Full replenish apply -> submit -> approve -> PO ship -> partial receive -> full receive -> closed
    r_ap = await client.post(
        "/api/v1/orgs/org_demo/supply/applies",
        json={"sku": "SKU-00704", "route_code": "air", "objective_mode": "profit", "qty_propose": 120},
        headers=_hdr("planner", "usr_planner"),
    )
    assert r_ap.status_code == 200
    apply_id = r_ap.json()["data"]["apply_id"]

    r_sub = await client.post(
        f"/api/v1/orgs/org_demo/supply/applies/{apply_id}/submit",
        headers=_hdr("planner", "usr_planner"),
    )
    assert r_sub.status_code == 200
    assert r_sub.json()["data"]["status"] == "pending_approve"

    # Self-approval blocked
    r_self = await client.post(
        f"/api/v1/orgs/org_demo/supply/applies/{apply_id}/approve",
        headers=_hdr("approver", "usr_planner"),
    )
    assert r_self.status_code == 403

    r_app = await client.post(
        f"/api/v1/orgs/org_demo/supply/applies/{apply_id}/approve",
        headers=_hdr("approver", "usr_approver"),
    )
    assert r_app.status_code == 200
    po_id = r_app.json()["data"]["po_id"]

    assert (await client.post(
        f"/api/v1/orgs/org_demo/supply/pos/{po_id}/ship",
        headers=_hdr("warehouse", "usr_warehouse"),
    )).status_code == 200

    r_p1 = await client.post(
        f"/api/v1/orgs/org_demo/supply/pos/{po_id}/receive",
        json={"receive_qty": 60, "defect_qty": 2},
        headers=_hdr("warehouse", "usr_warehouse"),
    )
    assert r_p1.status_code == 200
    assert r_p1.json()["data"]["status"] == "partial_received"

    r_p2 = await client.post(
        f"/api/v1/orgs/org_demo/supply/pos/{po_id}/receive",
        json={"receive_qty": 60, "defect_qty": 0},
        headers=_hdr("warehouse", "usr_warehouse"),
    )
    assert r_p2.status_code == 200
    assert r_p2.json()["data"]["status"] == "fully_received"

    # Check apply closed
    applies = (await client.get("/api/v1/orgs/org_demo/supply/applies", headers=_hdr("planner", "usr_planner"))).json()["data"]["items"]
    assert any(a["apply_id"] == apply_id and a["status"] == "closed" for a in applies)


@pytest.mark.asyncio
async def test_m2_m3_and_home_workbench(test_ctx):
    client: AsyncClient = test_ctx["client"]
    r_home = await client.get("/api/v1/orgs/org_demo/home/workbench", headers=_hdr("planner", "usr_planner"))
    assert r_home.status_code == 200
    assert r_home.json()["data"]["kpis"]["active_skus"] >= 5

    r_m2 = await client.get("/api/v1/orgs/org_demo/m2/overview", headers=_hdr("bi_analyst", "usr_analyst"))
    assert r_m2.status_code == 200
    assert r_m2.json()["data"]["summary"]["total_gmv_usd"] > 0

    r_m3 = await client.get("/api/v1/orgs/org_demo/m3/competitors", headers=_hdr("bi_analyst", "usr_analyst"))
    assert r_m3.status_code == 200
    assert len(r_m3.json()["data"]["items"]) >= 2
