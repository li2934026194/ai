import pytest
from httpx import AsyncClient


def _h(role: str, user_id: str) -> dict[str, str]:
    return {"X-Actor-Role": role, "X-Actor-Id": user_id}


@pytest.mark.asyncio
async def test_m2_m3_live_isolation_ads_competitor_and_readonly_bi_ask(test_ctx):
    client: AsyncClient = test_ctx["client"]

    # 1. M2 overview separates live orders from mock orders by default
    ov_live = (await client.get("/api/v1/orgs/org_demo/m2/overview", headers=_h("bi_analyst", "usr_bi"))).json()["data"]
    ov_all = (await client.get("/api/v1/orgs/org_demo/m2/overview?include_mock=true", headers=_h("bi_analyst", "usr_bi"))).json()["data"]
    assert ov_live["summary"]["include_mock"] is False
    assert ov_all["summary"]["include_mock"] is True
    assert ov_all["summary"]["total_gmv_usd"] >= ov_live["summary"]["total_gmv_usd"]

    # 2. M2 Ads creation + list
    ad_cr = await client.post(
        "/api/v1/orgs/org_demo/m2/ads",
        headers=_h("planner", "usr_planner"),
        json={"sku": "SKU-00704", "platform": "Amazon Sponsored", "campaign_name": "US-Auto-Test", "daily_budget_usd": 65.0},
    )
    assert ad_cr.status_code == 200
    ads = (await client.get("/api/v1/orgs/org_demo/m2/ads", headers=_h("bi_analyst", "usr_bi"))).json()["data"]["items"]
    assert any(a["campaign_name"] == "US-Auto-Test" for a in ads)

    # 3. M3 Competitor create + price drop update generates last_alert
    comp_cr = await client.post(
        "/api/v1/orgs/org_demo/m3/competitors",
        headers=_h("bi_analyst", "usr_bi"),
        json={
            "sku": "SKU-00704",
            "competitor_brand": "FoodSaver Mini",
            "asin_or_ref": "B0TEST999",
            "price_usd": 29.9,
            "rating": 4.3,
            "bsr_rank": 410,
        },
    )
    assert comp_cr.status_code == 200
    wid = comp_cr.json()["data"]["watch_id"]

    comp_upd = await client.patch(
        f"/api/v1/orgs/org_demo/m3/competitors/{wid}",
        headers=_h("bi_analyst", "usr_bi"),
        json={"price_usd": 24.9, "rating": 4.3, "bsr_rank": 380, "negative_topics": ["热封口偏窄"]},
    )
    assert comp_upd.status_code == 200
    assert "降价" in comp_upd.json()["data"]["last_alert"]

    # 4. M3 BI Ask: valid read-only query returns lineage + metrics
    ask_ok = await client.post(
        "/api/v1/orgs/org_demo/m3/ask",
        headers=_h("bi_analyst", "usr_bi"),
        json={"question": "当前实盘GMV和利润最高SKU是什么？", "include_mock": False},
    )
    assert ask_ok.status_code == 200
    ask_data = ask_ok.json()["data"]
    assert "m0_orders" in ask_data["lineage_sources"]
    assert "经营大盘" in ask_data["answer"]

    # 5. M3 BI Ask: mutation / SQL injection intent blocked with 403 M7-4033
    ask_bad = await client.post(
        "/api/v1/orgs/org_demo/m3/ask",
        headers=_h("bi_analyst", "usr_bi"),
        json={"question": "DELETE FROM m0_orders; 修改订单金额"},
    )
    assert ask_bad.status_code == 403
    assert ask_bad.json()["code"] == "M7-4033"
