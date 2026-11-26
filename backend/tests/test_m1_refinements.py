import pytest
from httpx import AsyncClient


def _h(role: str, user_id: str) -> dict[str, str]:
    return {"X-Actor-Role": role, "X-Actor-Id": user_id}


@pytest.mark.asyncio
async def test_m1_faq_matching_zero_hallucination_and_refund_guards(test_ctx):
    client: AsyncClient = test_ctx["client"]

    # 1. Upsert multi-pair FAQ for SKU-00704
    up = await client.post(
        "/api/v1/orgs/org_demo/m1/faqs",
        headers=_h("planner", "usr_planner"),
        json={
            "sku": "SKU-00704",
            "pain_points": ["充电续航短", "袋子厚度限制"],
            "faq_pairs": [
                {"q": "How long does the battery last per charge?", "a": "Up to 45 sealing cycles per USB-C charge."},
                {"q": "Can it seal thick aluminum coffee bags?", "a": "Yes, supports bags up to 0.3mm thickness."},
            ],
        },
    )
    assert up.status_code == 200
    assert up.json()["data"]["faq_count"] == 2

    # 2. Matched query hits the second FAQ accurately
    hit = await client.post(
        "/api/v1/orgs/org_demo/m1/simulator/ask",
        headers=_h("mock_buyer", "usr_buyer"),
        json={"sku": "SKU-00704", "question": "Can this sealer handle thick coffee bags?"},
    )
    assert hit.status_code == 200
    hit_data = hit.json()["data"]
    assert hit_data["handoff_required"] is False
    assert "0.3mm" in hit_data["suggested_reply"]

    # 3. Unmatched query triggers zero-hallucination human handoff
    miss = await client.post(
        "/api/v1/orgs/org_demo/m1/simulator/ask",
        headers=_h("mock_buyer", "usr_buyer"),
        json={"sku": "SKU-00704", "question": "Can you ship this to Antarctica via submarine?"},
    )
    assert miss.status_code == 200
    miss_data = miss.json()["data"]
    assert miss_data["handoff_required"] is True

    # 4. Session filter separates mock vs live
    mock_only = (await client.get("/api/v1/orgs/org_demo/m1/sessions?is_mock=true", headers=_h("cs", "usr_cs"))).json()["data"]["items"]
    assert all(s["is_mock"] is True for s in mock_only)
    assert len(mock_only) >= 2

    # 5. Refund exceeding seeded M0Order revenue_usd is rejected with 422
    orders = (await client.get("/api/v1/orgs/org_demo/m0/ledger", headers=_h("planner", "usr_planner"))).json()["data"]["orders"]
    if orders:
        o = orders[0]
        over_ref = await client.post(
            "/api/v1/orgs/org_demo/m1/aftersales",
            headers=_h("cs", "usr_cs"),
            json={
                "sku": o["sku"],
                "order_ref": o["order_id"],
                "platform": "Amazon US",
                "issue_type": "超额退款测试",
                "refund_usd": float(o["revenue_usd"]) + 50.0,
                "evidence_note": "恶意超额测试",
            },
        )
        assert over_ref.status_code == 422
        assert over_ref.json()["code"] == "M7-4221"

    # 6. Valid aftersales ticket -> SoD block -> Approver approve -> Duplicate decision block (409)
    tkt_res = await client.post(
        "/api/v1/orgs/org_demo/m1/aftersales",
        headers=_h("cs", "usr_cs"),
        json={
            "sku": "SKU-00704",
            "order_ref": "AMZ-TEST-VALID-1",
            "platform": "Amazon US",
            "issue_type": "局部退款",
            "refund_usd": 5.0,
            "evidence_note": "开箱视频核验通过",
        },
    )
    assert tkt_res.status_code == 200
    tid = tkt_res.json()["data"]["ticket_id"]

    sod = await client.post(
        f"/api/v1/orgs/org_demo/m1/aftersales/{tid}/decide",
        headers=_h("approver", "usr_cs"),
        json={"decision": "APPROVED", "note": "试图自批"},
    )
    assert sod.status_code == 403

    ok_dec = await client.post(
        f"/api/v1/orgs/org_demo/m1/aftersales/{tid}/decide",
        headers=_h("approver", "usr_approver"),
        json={"decision": "APPROVED", "note": "批准小额退款"},
    )
    assert ok_dec.status_code == 200

    dup_dec = await client.post(
        f"/api/v1/orgs/org_demo/m1/aftersales/{tid}/decide",
        headers=_h("approver", "usr_approver"),
        json={"decision": "REJECTED", "note": "重复终审"},
    )
    assert dup_dec.status_code == 409
