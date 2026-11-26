import pytest
from httpx import AsyncClient


def _h(role: str, user_id: str) -> dict[str, str]:
    return {"X-Actor-Role": role.lower(), "X-Actor-Id": user_id}


@pytest.mark.asyncio
async def test_m4_weighted_score_csv_triage_and_m7_handoff(test_ctx):
    client: AsyncClient = test_ctx["client"]
    # 1. Mock filename guard for internal_live CSV import
    bad_csv = await client.post(
        "/api/v1/orgs/org_demo/m4/candidates/import-csv",
        headers=_h("selector", "usr_selector"),
        json={
            "csv_text": "sku,name,target_price_usd,est_cost_rmb,est_shipping_rmb\nDEMO-1,Test,30,40,10",
            "filename": "选品_demo_清单.csv",
            "source_nature": "internal_live",
        },
    )
    assert bad_csv.status_code == 422
    assert bad_csv.json()["code"] == "M7-4221"

    # 2. Valid CSV import with 3-way triage + 1 invalid line
    csv_payload = (
        "sku,name,category,fulfillment_mode,target_price_usd,est_cost_rmb,est_shipping_rmb,ip_risk_note\n"
        "M4-READY-1,便携恒温壶,kitchen_appliance,FBA,39.9,50,18,\n"
        "M4-RISK-1,仿品风险支架,3c_accessories,FBM,15.0,60,30,疑似含第三方专利\n"
        "BAD-ROW,,kitchen_appliance,FBA,20,10,5,\n"
    )
    good_csv = await client.post(
        "/api/v1/orgs/org_demo/m4/candidates/import-csv",
        headers=_h("selector", "usr_selector"),
        json={
            "csv_text": csv_payload,
            "filename": "202611_选品池.csv",
            "source_nature": "internal_live",
        },
    )
    assert good_csv.status_code == 200
    triage = good_csv.json()["data"]
    assert triage["imported"] == 2
    assert triage["ready_count"] == 1
    assert triage["risk_blocked_count"] == 1
    assert len(triage["errors"]) == 1

    # 3. Locate M4-READY-1 and verify out-of-range score fails with 422
    cands = (await client.get("/api/v1/orgs/org_demo/m4/candidates", headers=_h("selector", "usr_selector"))).json()["data"]["items"]
    ready_cand = next(c for c in cands if c["sku"] == "M4-READY-1")
    cid = ready_cand["candidate_id"]

    oob_eval = await client.post(
        f"/api/v1/orgs/org_demo/m4/candidates/{cid}/evaluate",
        headers=_h("selector", "usr_selector"),
        json={
            "target_price_usd": 39.9,
            "est_cost_rmb": 50.0,
            "est_shipping_rmb": 18.0,
            "scores": {"demand": 105, "competition": 80, "margin": 80, "supply": 80, "compliance": 80},
            "submit_for_approval": False,
        },
    )
    assert oob_eval.status_code == 422

    # 4. Valid weighted evaluation:
    # 90*0.25 + 70*0.20 + 88*0.25 + 80*0.15 + 100*0.15 = 22.5 + 14 + 22 + 12 + 15 = 85.5 -> 86
    eval_res = await client.post(
        f"/api/v1/orgs/org_demo/m4/candidates/{cid}/evaluate",
        headers=_h("selector", "usr_selector"),
        json={
            "target_price_usd": 39.9,
            "est_cost_rmb": 50.0,
            "est_shipping_rmb": 18.0,
            "fulfillment_mode": "FBA",
            "scores": {"demand": 90, "competition": 70, "margin": 88, "supply": 80, "compliance": 100},
            "operator_note": "高毛利且无专利冲突，建议立项",
            "submit_for_approval": True,
        },
    )
    assert eval_res.status_code == 200
    eval_data = eval_res.json()["data"]
    assert eval_data["total_score"] == 86
    assert eval_data["status"] == "PENDING_APPROVAL"
    # Verify unrounded 4-decimal margin precision
    assert isinstance(eval_data["est_margin_pct"], float)

    # 5. SoD check: submitter usr_selector cannot self-approve even with approver role
    sod_fail = await client.post(
        f"/api/v1/orgs/org_demo/m4/candidates/{cid}/decide",
        headers=_h("approver", "usr_selector"),
        json={"decision": "APPROVED", "note": "试图自批", "trigger_m7_draft": True},
    )
    assert sod_fail.status_code == 403
    assert sod_fail.json()["code"] == "M7-4032"

    # 6. Approver usr_approver approves AND triggers M7 initial copy draft
    approve_res = await client.post(
        f"/api/v1/orgs/org_demo/m4/candidates/{cid}/decide",
        headers=_h("approver", "usr_approver"),
        json={"decision": "APPROVED", "note": "批准测款并触发M7首版草稿", "trigger_m7_draft": True},
    )
    assert approve_res.status_code == 200
    dec_data = approve_res.json()["data"]
    assert dec_data["m0_synced"] is True
    assert dec_data["m7_draft_triggered"] is True

    # 7. Re-deciding finalized candidate is blocked with 409
    dup_decide = await client.post(
        f"/api/v1/orgs/org_demo/m4/candidates/{cid}/decide",
        headers=_h("approver", "usr_approver"),
        json={"decision": "REJECTED", "note": "反悔驳回"},
    )
    assert dup_decide.status_code == 409

    # 8. Verify M7 copy assets were created for M4-READY-1
    m7_prods = (await client.get("/api/v1/orgs/org_demo/m7/products/available", headers=_h("creator", "usr_creator"))).json()["data"]["items"]
    m7_sku = next(p for p in m7_prods if p["sku"] == "M4-READY-1")
    assert m7_sku["origin"] == "M4_APPROVED"
