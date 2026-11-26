import asyncio
import math
import pytest
from starlette.testclient import TestClient

from app.modules.m5_m6_supply.domain.models import MODELS, f_catboost_tree, f_lightgbm_gbdt, f_prophet_trend


def _auth_headers(user_id: str = "usr_manager", role: str = "manager") -> dict[str, str]:
    return {"X-Actor-Id": user_id, "X-Actor-Role": role}


def test_m5_prophet_lightgbm_catboost_models():
    series = [12.0, 14.0, 13.0, 18.0, 20.0, 17.0, 19.0, 22.0, 21.0, 24.0]
    for name in ("prophet", "lightgbm", "catboost"):
        assert name in MODELS
        out = MODELS[name](series, 7)
        assert len(out) == 7
        assert all(math.isfinite(x) and x >= 0 for x in out)
    assert len(f_prophet_trend([], 5)) == 5
    assert len(f_lightgbm_gbdt([], 5)) == 5
    assert len(f_catboost_tree([], 5)) == 5


@pytest.mark.asyncio
async def test_m1_aftersales_multipart_attachments(test_ctx):
    client = test_ctx["client"]
    headers = _auth_headers("usr_cs", "cs")

    tickets_res = await client.get("/api/v1/orgs/org_demo/m1/aftersales", headers=headers)
    assert tickets_res.status_code == 200
    ticket_id = tickets_res.json()["data"]["items"][0]["ticket_id"]

    bad_res = await client.post(
        f"/api/v1/orgs/org_demo/m1/aftersales/{ticket_id}/attachments",
        headers=headers,
        files=[("files", ("evil.exe", b"MZ1234", "application/octet-stream"))],
    )
    assert bad_res.status_code == 422

    up_res = await client.post(
        f"/api/v1/orgs/org_demo/m1/aftersales/{ticket_id}/attachments",
        headers=headers,
        files=[("files", ("evidence.txt", b"refund proof bytes", "text/plain"))],
    )
    assert up_res.status_code == 200
    att_id = up_res.json()["data"]["attachments"][0]["att_id"]

    dl_res = await client.get(
        f"/api/v1/orgs/org_demo/m1/aftersales/{ticket_id}/attachments/{att_id}",
        headers=headers,
    )
    assert dl_res.status_code == 200
    assert dl_res.content == b"refund proof bytes"


def test_m1_websocket_ping_pong(test_ctx):
    client = test_ctx["client"]
    app = client._transport.app
    with TestClient(app) as sync_client:
        with sync_client.websocket_connect("/api/v1/orgs/org_demo/m1/ws/sess_demo_1") as ws:
            ws.send_text("ping")
            data = ws.receive_json()
            assert data["type"] == "pong"
            assert data["session_id"] == "sess_demo_1"


@pytest.mark.asyncio
async def test_m2_designer_layout_publish_and_4card_concurrent(test_ctx):
    client = test_ctx["client"]
    headers = _auth_headers("usr_planner", "planner")

    g1 = await client.get("/api/v1/orgs/org_demo/m2/designer/layout", headers=headers)
    assert g1.status_code == 200
    assert g1.json()["data"]["published_layout"] is None

    cards_payload = [
        {"card_id": "c1", "title": "GMV", "metric_key": "gmv_usd"},
        {"card_id": "c2", "title": "NetProfit", "metric_key": "net_profit_usd"},
        {"card_id": "c3", "title": "AdSpend", "metric_key": "ad_spend_7d_usd"},
        {"card_id": "c4", "title": "Alerts", "metric_key": "open_alerts_count"},
    ]
    s1 = await client.put(
        "/api/v1/orgs/org_demo/m2/designer/layout",
        headers=headers,
        json={"cards": cards_payload, "version": 1},
    )
    assert s1.status_code == 200

    # Optimistic lock conflict on stale version
    conflict = await client.put(
        "/api/v1/orgs/org_demo/m2/designer/layout",
        headers=headers,
        json={"cards": cards_payload, "version": 99},
    )
    assert conflict.status_code == 409

    pub = await client.post("/api/v1/orgs/org_demo/m2/designer/publish", headers=headers)
    assert pub.status_code == 200
    assert len(pub.json()["data"]["published_layout"]) == 4

    cards_res = await client.get("/api/v1/orgs/org_demo/m2/designer/cards", headers=headers)
    assert cards_res.status_code == 200
    assert "no-store" in cards_res.headers.get("cache-control", "")
    assert len(cards_res.json()["data"]["cards"]) == 4
    assert all(c["ok"] is True for c in cards_res.json()["data"]["cards"])


@pytest.mark.asyncio
async def test_m4_async_csv_import_202(test_ctx):
    client = test_ctx["client"]
    headers = _auth_headers("usr_selector", "selector")

    csv_text = "title,category,cost_usd,target_price_usd,monthly_search_vol\nAsync Bottle,Sports,4.2,18.9,1200\n"
    res = await client.post(
        "/api/v1/orgs/org_demo/m4/candidates/import-csv-async",
        headers=headers,
        json={"csv_text": csv_text},
    )
    assert res.status_code == 202
    job_id = res.json()["data"]["job_id"]

    final_status = None
    for _ in range(25):
        jr = await client.get(f"/api/v1/orgs/org_demo/m4/jobs/{job_id}", headers=headers)
        assert jr.status_code == 200
        final_status = jr.json()["data"]["status"]
        if final_status in {"SUCCEEDED", "FAILED"}:
            break
        await asyncio.sleep(0.05)
    assert final_status == "SUCCEEDED"


@pytest.mark.asyncio
async def test_m3_ask_engine_mode(test_ctx):
    client = test_ctx["client"]
    headers = _auth_headers("usr_bi_analyst", "bi_analyst")
    res = await client.post(
        "/api/v1/orgs/org_demo/m3/ask",
        headers=headers,
        json={"question": "当前全店实盘 GMV 与在途告警情况如何？"},
    )
    assert res.status_code == 200
    assert res.json()["data"]["engine_mode"] in {"pg_readonly_fact", "vanna_http"}


@pytest.mark.asyncio
async def test_100_rows_and_30_concurrent_requests(test_ctx):
    """验证各核心表 >=100 条数据下 + 30 路并发读写混压不锁死、不超时、不崩溃"""
    from datetime import date, timedelta
    import time
    from app.modules.m0_catalog.models import M0Order, M0Product
    from app.modules.m1_cs.models import M1AftersalesTicket, M1CsSession
    from app.modules.m2_m3_bi.models import M2AdCampaign, M3CompetitorWatch
    from app.modules.m4_selection.models import M4Candidate
    from app.modules.m5_m6_supply.models import M5SalesHistory

    session_factory = test_ctx["session_factory"]
    async with session_factory() as s:
        for i in range(100):
            s.add(M0Product(product_id=f"p100_{i}", org_id="org_demo", sku=f"SKU-100-{i:03d}", name=f"商品{i}", category="kitchen_appliance", category_label_zh="厨房", platform="amazon_us", unit_cost_usd=6.0, sale_price_usd=29.9))
            s.add(M0Order(order_id=f"o100_{i}", org_id="org_demo", shop_id="shop_amz_us", sku="SKU-00704", order_date=(date.today() - timedelta(days=i % 30)).isoformat(), qty=2, revenue_usd=59.98, is_mock=False, status="COMPLETED"))
            s.add(M4Candidate(candidate_id=f"c100_{i}", org_id="org_demo", sku=f"SKU-C100-{i:03d}", name=f"选品{i}", category="kitchen_appliance", source_channel="1688", source_nature="internal_live", fulfillment_mode="FBA", target_price_usd=35.0, est_cost_rmb=42.0, est_shipping_rmb=14.0, est_margin_pct=0.35, scores_json={"demand": 80, "competition": 80, "margin": 80, "supply": 80, "compliance": 80}, total_score=80, status="DISCOVERED"))
            s.add(M1CsSession(session_id=f"s100_{i}", org_id="org_demo", sku="SKU-00704", buyer_name=f"B{i}", channel="Amazon", question="110V?", reply="Yes", is_mock=False, status="REPLIED", handler_id="usr_cs"))
            s.add(M1AftersalesTicket(ticket_id=f"t100_{i}", org_id="org_demo", sku="SKU-00704", order_ref=f"o100_{i}", platform="Amazon US", issue_type="退差", refund_usd=5.0, evidence_note="ok", status="APPROVED", submitter_id="usr_cs", approver_id="usr_approver"))
            s.add(M2AdCampaign(campaign_id=f"ad100_{i}", org_id="org_demo", sku="SKU-00704", platform="Amazon Sponsored", campaign_name=f"Camp-{i}", daily_budget_usd=30.0, spend_7d_usd=80.0, sales_7d_usd=320.0, acos=0.25, roas=4.0, status="ACTIVE"))
            s.add(M3CompetitorWatch(watch_id=f"w100_{i}", org_id="org_demo", sku="SKU-00704", competitor_brand=f"Brand-{i}", asin_or_ref=f"B00X{i:04d}", price_usd=29.0, rating=4.5, review_count=100, bsr_rank=300, sentiment_score=0.8, negative_topics_json=[]))
            s.add(M5SalesHistory(org_id="org_demo", sku="SKU-00704", sales_date=date.today() - timedelta(days=120 + i), qty_raw=12, on_hand_eod=50, revenue_usd=359.88))
        await s.commit()

    client = test_ctx["client"]
    h_mgr = _auth_headers("usr_manager", "manager")
    h_pln = _auth_headers("usr_planner", "planner")
    h_sel = _auth_headers("usr_selector", "selector")
    h_bi = _auth_headers("usr_analyst", "bi_analyst")
    h_buy = _auth_headers("usr_buyer", "mock_buyer")

    t0 = time.perf_counter()
    tasks = [
        *[client.get("/api/v1/orgs/org_demo/home/workbench", headers=h_mgr) for _ in range(5)],
        *[client.get("/api/v1/orgs/org_demo/m2/overview", headers=h_mgr) for _ in range(5)],
        *[client.get("/api/v1/orgs/org_demo/m2/designer/cards", headers=h_pln) for _ in range(5)],
        *[client.get("/api/v1/orgs/org_demo/m0/products", headers=h_mgr) for _ in range(3)],
        *[client.get("/api/v1/orgs/org_demo/m4/candidates", headers=h_sel) for _ in range(3)],
        *[client.get("/api/v1/orgs/org_demo/supply/forecast/SKU-00704", headers=h_pln) for _ in range(3)],
        *[client.post("/api/v1/orgs/org_demo/m3/ask", headers=h_bi, json={"question": "GMV多少?"}) for _ in range(3)],
        *[client.post("/api/v1/orgs/org_demo/m1/simulator/ask", headers=h_buy, json={"sku": "SKU-00704", "question": "噪音大吗?"}) for _ in range(3)],
    ]
    resps = await asyncio.gather(*tasks)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert len(resps) == 30
    assert all(r.status_code == 200 for r in resps), [r.status_code for r in resps if r.status_code != 200]
    assert elapsed_ms < 10000, f"30 concurrent requests with 100+ rows/table took {elapsed_ms:.1f}ms"
