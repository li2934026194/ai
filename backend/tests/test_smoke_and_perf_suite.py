import asyncio
import time
import pytest
from httpx import AsyncClient


def _h(role: str, user_id: str) -> dict[str, str]:
    return {"X-Actor-Role": role, "X-Actor-Id": user_id}


@pytest.mark.asyncio
async def test_all_24_module_smoke_cases_end_to_end(test_ctx):
    """Executes all 24 TC-*-SMK-01..04 smoke test cases across M0, M8, M4, M1, M5/M6, and M2/M3."""
    client: AsyncClient = test_ctx["client"]

    # === M0 Smoke (TC-M0-SMK-01..04) ===
    # TC-M0-SMK-01
    r = await client.post(
        "/api/v1/orgs/org_demo/m0/shops",
        headers=_h("manager", "usr_manager"),
        json={"shop_code": "SH-UK-01", "name": "UK Flagship", "platform": "amazon_us", "currency": "USD", "is_mock": False},
    )
    assert r.status_code == 200
    shops = (await client.get("/api/v1/orgs/org_demo/m0/shops", headers=_h("manager", "usr_manager"))).json()["data"]["items"]
    assert any(s["shop_code"] == "SH-UK-01" and s["status"] == "CONNECTED" for s in shops)

    # TC-M0-SMK-02
    prods_before = (await client.get("/api/v1/orgs/org_demo/m0/products", headers=_h("planner", "usr_planner"))).json()["data"]["items"]
    old_cost = next(p["unit_cost_usd"] for p in prods_before if p["sku"] == "SKU-00704")
    r_cost = await client.post(
        "/api/v1/orgs/org_demo/m0/cost-requests",
        headers=_h("planner", "usr_planner"),
        json={"sku": "SKU-00704", "new_cost_usd": 9.80, "reason": "SMK改价验证"},
    )
    assert r_cost.status_code == 200
    req_id = r_cost.json()["data"]["req_id"]
    prods_mid = (await client.get("/api/v1/orgs/org_demo/m0/products", headers=_h("planner", "usr_planner"))).json()["data"]["items"]
    assert next(p["unit_cost_usd"] for p in prods_mid if p["sku"] == "SKU-00704") == old_cost
    r_dec = await client.post(
        f"/api/v1/orgs/org_demo/m0/cost-requests/{req_id}/decide",
        headers=_h("approver", "usr_approver"),
        json={"decision": "APPROVED"},
    )
    assert r_dec.status_code == 200
    prods_after = (await client.get("/api/v1/orgs/org_demo/m0/products", headers=_h("planner", "usr_planner"))).json()["data"]["items"]
    assert next(p["unit_cost_usd"] for p in prods_after if p["sku"] == "SKU-00704") == 9.80

    # TC-M0-SMK-03
    r_csv = await client.post(
        "/api/v1/orgs/org_demo/m0/orders/import-csv",
        headers=_h("planner", "usr_planner"),
        json={
            "csv_text": "order_id,shop_id,sku,order_date,qty,revenue_usd\nSMK-ORD-1,shop_amz_us,SKU-00704,2026-11-18,2,59.98\nSMK-ORD-2,shop_amz_us,SKU-00704,2026-11-18,1,29.99",
            "filename": "smk_orders.csv",
            "source_type": "live",
        },
    )
    assert r_csv.status_code == 200
    assert r_csv.json()["data"]["imported"] == 2
    assert r_csv.json()["data"]["skipped_duplicates"] == 0

    # TC-M0-SMK-04
    r_st = await client.post(
        "/api/v1/orgs/org_demo/m0/inventory/stocktake",
        headers=_h("warehouse", "usr_warehouse"),
        json={"warehouse_code": "WH-US-WEST", "sku": "SKU-00704", "counted_qty": 120, "reason": "SMK盘点"},
    )
    assert r_st.status_code == 200
    inv = (await client.get("/api/v1/orgs/org_demo/m0/inventory", headers=_h("warehouse", "usr_warehouse"))).json()["data"]["items"]
    item_704 = next(i for i in inv if i["warehouse_code"] == "WH-US-WEST" and i["sku"] == "SKU-00704")
    assert item_704["on_hand"] == 120
    assert item_704["last_stocktake_by"] == "usr_warehouse"

    # === M8 Smoke (TC-M8-SMK-01..04) ===
    # TC-M8-SMK-01
    r_u1 = await client.post(
        "/api/v1/orgs/org_demo/m8/users",
        headers=_h("manager", "usr_manager"),
        json={"user_id": "usr_new_cs", "display_name": "新客服", "role_code": "cs", "email": "newcs@crosspilot.ai"},
    )
    assert r_u1.status_code == 200
    users = (await client.get("/api/v1/orgs/org_demo/m8/users", headers=_h("manager", "usr_manager"))).json()["data"]["items"]
    assert any(u["user_id"] == "usr_new_cs" for u in users)

    # TC-M8-SMK-02
    r_u2 = await client.put(
        "/api/v1/orgs/org_demo/m8/users/usr_new_cs",
        headers=_h("approver", "usr_approver"),
        json={"role_code": "planner", "is_active": False},
    )
    assert r_u2.status_code == 200
    assert r_u2.json()["data"]["is_active"] is False
    audits_m8 = (await client.get("/api/v1/orgs/org_demo/m8/audits?module=M8", headers=_h("manager", "usr_manager"))).json()["data"]["items"]
    assert any(a["action"] == "USER_CREATED" for a in audits_m8)

    # TC-M8-SMK-03
    roles = (await client.get("/api/v1/orgs/org_demo/m8/roles", headers=_h("manager", "usr_manager"))).json()["data"]["items"]
    pols = (await client.get("/api/v1/orgs/org_demo/m8/policies", headers=_h("manager", "usr_manager"))).json()["data"]["items"]
    assert len(roles) == 9 and len(pols) == 5

    # TC-M8-SMK-04
    m4_pol_id = next((p["policy_id"] for p in pols if p.get("module") == "M4"), pols[0]["policy_id"])
    r_pol = await client.post(
        f"/api/v1/orgs/org_demo/m8/policies/{m4_pol_id}/toggle",
        headers=_h("approver", "usr_approver"),
        json={"is_enabled": True, "enforce_sod": True},
    )
    assert r_pol.status_code == 200
    audits_m8_after = (await client.get("/api/v1/orgs/org_demo/m8/audits?module=M8", headers=_h("manager", "usr_manager"))).json()["data"]["items"]
    assert audits_m8_after[0]["action"] in ("POLICY_TOGGLED", "POLICY_UPDATED")

    # === M4 Smoke (TC-M4-SMK-01..04) ===
    # TC-M4-SMK-01
    r_c1 = await client.post(
        "/api/v1/orgs/org_demo/m4/candidates",
        headers=_h("selector", "usr_selector"),
        json={"sku": "sku-new-88", "name": "新品测试88", "category": "kitchen_appliance", "target_price_usd": 35.0, "est_cost_rmb": 50.0, "est_shipping_rmb": 15.0},
    )
    assert r_c1.status_code == 200
    cid = r_c1.json()["data"]["candidate_id"]
    assert r_c1.json()["data"]["sku"] == "SKU-NEW-88"

    # TC-M4-SMK-02
    r_c2 = await client.post(
        f"/api/v1/orgs/org_demo/m4/candidates/{cid}/evaluate",
        headers=_h("selector", "usr_selector"),
        json={
            "target_price_usd": 39.99,
            "est_cost_rmb": 50.0,
            "est_shipping_rmb": 15.0,
            "scores": {"demand": 88, "competition": 80, "margin": 90, "supply": 85, "compliance": 92},
            "submit_for_approval": False,
        },
    )
    assert r_c2.status_code == 200
    assert r_c2.json()["data"]["status"] == "EVALUATING"
    assert r_c2.json()["data"]["total_score"] == 87

    # TC-M4-SMK-03
    r_c3 = await client.post(
        f"/api/v1/orgs/org_demo/m4/candidates/{cid}/evaluate",
        headers=_h("selector", "usr_selector"),
        json={
            "target_price_usd": 39.99,
            "est_cost_rmb": 50.0,
            "est_shipping_rmb": 15.0,
            "scores": {"demand": 88, "competition": 80, "margin": 90, "supply": 85, "compliance": 92},
            "submit_for_approval": True,
        },
    )
    assert r_c3.status_code == 200
    assert r_c3.json()["data"]["status"] == "PENDING_APPROVAL"

    # TC-M4-SMK-04
    r_c4 = await client.post(
        f"/api/v1/orgs/org_demo/m4/candidates/{cid}/decide",
        headers=_h("approver", "usr_approver"),
        json={"decision": "APPROVED", "note": "同意测款"},
    )
    assert r_c4.status_code == 200
    assert r_c4.json()["data"]["m0_synced"] is True
    m7_prods = (await client.get("/api/v1/orgs/org_demo/m7/products/available", headers=_h("creator", "usr_creator"))).json()["data"]["items"]
    assert any(p["sku"] == "SKU-NEW-88" and p["origin"] == "M4_APPROVED" for p in m7_prods)

    # === M1 Smoke (TC-M1-SMK-01..04) ===
    # TC-M1-SMK-01
    r_faq = await client.post(
        "/api/v1/orgs/org_demo/m1/faqs",
        headers=_h("planner", "usr_planner"),
        json={"sku": "SKU-00704", "pain_points": ["噪音过大"], "faq_pairs": [{"q": "工作噪音分贝高吗？", "a": "工作分贝低于 55dB，安静不扰民。"}]},
    )
    assert r_faq.status_code == 200

    # TC-M1-SMK-02
    r_sim = await client.post(
        "/api/v1/orgs/org_demo/m1/simulator/ask",
        headers=_h("mock_buyer", "usr_buyer"),
        json={"sku": "SKU-00704", "question": "机器吵不吵？"},
    )
    assert r_sim.status_code == 200
    assert "55dB" in r_sim.json()["data"]["suggested_reply"]
    sid = r_sim.json()["data"]["session_id"]

    # TC-M1-SMK-03
    r_rep = await client.post(
        f"/api/v1/orgs/org_demo/m1/sessions/{sid}/reply",
        headers=_h("cs", "usr_cs"),
        json={"reply": "实测低于55dB，可放心使用"},
    )
    assert r_rep.status_code == 200 and r_rep.json()["data"]["status"] == "REPLIED"

    ov_before = (await client.get("/api/v1/orgs/org_demo/m2/overview", headers=_h("manager", "usr_manager"))).json()["data"]["summary"]["approved_refund_usd"]
    r_tkt = await client.post(
        "/api/v1/orgs/org_demo/m1/aftersales",
        headers=_h("cs", "usr_cs"),
        json={"sku": "SKU-00704", "order_ref": "ORD-901", "platform": "Amazon US", "issue_type": "噪音体验退差", "refund_usd": 19.9, "evidence_note": "SMK凭证"},
    )
    assert r_tkt.status_code == 200 and r_tkt.json()["data"]["status"] == "PENDING_APPROVAL"
    tid = r_tkt.json()["data"]["ticket_id"]

    # TC-M1-SMK-04
    r_tdec = await client.post(
        f"/api/v1/orgs/org_demo/m1/aftersales/{tid}/decide",
        headers=_h("approver", "usr_approver"),
        json={"decision": "APPROVED", "note": "同意赔付"},
    )
    assert r_tdec.status_code == 200 and r_tdec.json()["data"]["status"] == "APPROVED"
    ov_after = (await client.get("/api/v1/orgs/org_demo/m2/overview", headers=_h("manager", "usr_manager"))).json()["data"]["summary"]["approved_refund_usd"]
    assert round(ov_after - ov_before, 2) == 19.90

    # === M5/M6 Smoke (TC-M5M6-SMK-01..04) ===
    # TC-M5M6-SMK-01
    r_fc = await client.get("/api/v1/orgs/org_demo/supply/forecast/SKU-00704?route_code=sea&objective_mode=profit", headers=_h("planner", "usr_planner"))
    assert r_fc.status_code == 200
    fc = r_fc.json()["data"]
    assert fc["best_model"] and len(fc["route_plan"]["routes"]) == 4

    # TC-M5M6-SMK-02
    r_sb_base = await client.post("/api/v1/orgs/org_demo/supply/sandbox", headers=_h("planner", "usr_planner"), json={"sku": "SKU-00704", "demand_multiplier": 1.0})
    r_sb_15 = await client.post("/api/v1/orgs/org_demo/supply/sandbox", headers=_h("planner", "usr_planner"), json={"sku": "SKU-00704", "demand_multiplier": 1.5})
    assert r_sb_15.status_code == 200
    assert r_sb_15.json()["data"]["qty_suggest"] >= r_sb_base.json()["data"]["qty_suggest"]

    # TC-M5M6-SMK-03
    r_ap = await client.post("/api/v1/orgs/org_demo/supply/applies", headers=_h("planner", "usr_planner"), json={"sku": "SKU-00704", "route_code": "sea", "objective_mode": "profit", "qty_propose": 120})
    aid = r_ap.json()["data"]["apply_id"]
    assert (await client.post(f"/api/v1/orgs/org_demo/supply/applies/{aid}/submit", headers=_h("planner", "usr_planner"))).json()["data"]["status"] == "pending_approve"
    r_app = await client.post(f"/api/v1/orgs/org_demo/supply/applies/{aid}/approve", headers=_h("approver", "usr_approver"))
    assert r_app.json()["data"]["status"] == "approved"
    po_id = r_app.json()["data"]["po_id"]

    # TC-M5M6-SMK-04
    assert (await client.post(f"/api/v1/orgs/org_demo/supply/pos/{po_id}/ship", headers=_h("warehouse", "usr_warehouse"))).json()["data"]["status"] == "shipping"
    assert (await client.post(f"/api/v1/orgs/org_demo/supply/pos/{po_id}/receive", headers=_h("warehouse", "usr_warehouse"), json={"receive_qty": 60, "defect_qty": 5})).json()["data"]["status"] == "partial_received"
    assert (await client.post(f"/api/v1/orgs/org_demo/supply/pos/{po_id}/receive", headers=_h("warehouse", "usr_warehouse"), json={"receive_qty": 60, "defect_qty": 0})).json()["data"]["status"] == "fully_received"
    applies_after = (await client.get("/api/v1/orgs/org_demo/supply/applies", headers=_h("planner", "usr_planner"))).json()["data"]["items"]
    assert next(a for a in applies_after if a["apply_id"] == aid)["status"] == "closed"

    # === M2/M3 Smoke (TC-M2M3-SMK-01..04) ===
    # TC-M2M3-SMK-01
    wb = (await client.get("/api/v1/orgs/org_demo/home/workbench", headers=_h("manager", "usr_manager"))).json()["data"]
    assert len(wb["kpis"]) == 6 and len(wb["todos"]) == 4
    ov = (await client.get("/api/v1/orgs/org_demo/m2/overview", headers=_h("manager", "usr_manager"))).json()["data"]
    assert len(ov["settlements"]) == 2

    # TC-M2M3-SMK-02
    ads = (await client.get("/api/v1/orgs/org_demo/m2/ads", headers=_h("planner", "usr_planner"))).json()["data"]["items"]
    cid_ad = ads[0]["campaign_id"]
    r_ad = await client.post(f"/api/v1/orgs/org_demo/m2/ads/{cid_ad}/adjust", headers=_h("planner", "usr_planner"), json={"daily_budget_usd": 95, "status": "PAUSED"})
    assert r_ad.status_code == 200 and r_ad.json()["data"]["status"] == "PAUSED"

    # TC-M2M3-SMK-03
    r_cmp = await client.post(
        "/api/v1/orgs/org_demo/m3/competitors",
        headers=_h("bi_analyst", "usr_bi"),
        json={"sku": "SKU-00704", "competitor_brand": "Nesco Pro", "asin_or_ref": "B0C998877", "price_usd": 28.9, "rating": 4.5, "bsr_rank": 320},
    )
    assert r_cmp.status_code == 200

    # TC-M2M3-SMK-04
    r_ask = await client.post(
        "/api/v1/orgs/org_demo/m3/ask",
        headers=_h("bi_analyst", "usr_bi"),
        json={"question": "当前整体毛利率与哪个 SKU 利润贡献最高？"},
    )
    assert r_ask.status_code == 200
    assert "lineage_sources" in r_ask.json()["data"] and "毛利率" in r_ask.json()["data"]["answer"]


@pytest.mark.asyncio
async def test_performance_and_concurrency_benchmarks(test_ctx):
    """Covers TC-M0-PRF-02, TC-M5M6-PRF-01, TC-M8-PRF-03 (scale & concurrency)."""
    client: AsyncClient = test_ctx["client"]

    # 1. TC-M0-PRF-02: 500-row CSV import with 100 duplicate rows
    rows = ["order_id,shop_id,sku,order_date,qty,revenue_usd"]
    for i in range(400):
        rows.append(f"PRF-ORD-{i},shop_amz_us,SKU-00704,2026-11-18,1,29.99")
    for i in range(100):
        rows.append(f"PRF-ORD-{i},shop_amz_us,SKU-00704,2026-11-18,1,29.99")
    t0 = time.perf_counter()
    r_prf_csv = await client.post(
        "/api/v1/orgs/org_demo/m0/orders/import-csv",
        headers=_h("planner", "usr_planner"),
        json={"csv_text": "\n".join(rows), "filename": "prf_500.csv", "source_type": "live"},
    )
    csv_ms = (time.perf_counter() - t0) * 1000
    assert r_prf_csv.status_code == 200
    assert r_prf_csv.json()["data"]["imported"] == 400
    assert r_prf_csv.json()["data"]["skipped_duplicates"] == 100
    assert csv_ms < 3000, f"500-row CSV took {csv_ms:.1f}ms"

    # 2. TC-M5M6-PRF-01: Single-SKU 6-model forecast + 4-route calculation
    t1 = time.perf_counter()
    r_fc = await client.get("/api/v1/orgs/org_demo/supply/forecast/SKU-00704", headers=_h("planner", "usr_planner"))
    fc_ms = (time.perf_counter() - t1) * 1000
    assert r_fc.status_code == 200
    assert fc_ms < 500, f"Forecast took {fc_ms:.1f}ms"

    # 3. TC-M8-PRF-03: 15 concurrent 403 RBAC audit writes without SQLite lock errors
    resps = await asyncio.gather(
        *[client.get("/api/v1/orgs/org_demo/m8/users", headers=_h("mock_buyer", f"mb_{i}")) for i in range(15)]
    )
    assert all(r.status_code == 403 for r in resps)
