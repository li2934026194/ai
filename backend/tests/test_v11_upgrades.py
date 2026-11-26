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
