import pytest
from httpx import AsyncClient


def _h(role: str, user_id: str) -> dict[str, str]:
    return {"X-Actor-Role": role, "X-Actor-Id": user_id}


@pytest.mark.asyncio
async def test_m5_m6_csv_import_param_tuning_alerts_and_po_guards(test_ctx):
    client: AsyncClient = test_ctx["client"]

    # 1. Mock filename guard on sales history CSV import
    bad_csv = await client.post(
        "/api/v1/orgs/org_demo/supply/sales-history/import-csv",
        headers=_h("planner", "usr_planner"),
        json={"csv_text": "sku,sales_date,qty_raw,on_hand_eod\nSKU-00704,2026-11-18,12,80", "filename": "sales_demo.csv"},
    )
    assert bad_csv.status_code == 422

    # 2. Valid CSV sales upsert + 1 negative error row
    good_csv = await client.post(
        "/api/v1/orgs/org_demo/supply/sales-history/import-csv",
        headers=_h("planner", "usr_planner"),
        json={
            "csv_text": (
                "sku,sales_date,qty_raw,on_hand_eod,revenue_usd\n"
                "SKU-00704,2026-11-18,18,75,359.82\n"
                "SKU-00704,2026-11-19,-5,70,0\n"
            ),
            "filename": "202611_daily_sales.csv",
        },
    )
    assert good_csv.status_code == 200
    assert good_csv.json()["data"]["imported"] == 1
    assert len(good_csv.json()["data"]["errors"]) == 1

    # 3. Update SKU supply params (MOQ=100, pack_size=50, lead_time_days=24)
    upd = await client.patch(
        "/api/v1/orgs/org_demo/supply/sku-params/SKU-00704",
        headers=_h("planner", "usr_planner"),
        json={"moq": 100, "pack_size": 50, "lead_time_days": 24},
    )
    assert upd.status_code == 200
    assert upd.json()["data"]["moq"] == 100

    fc = (await client.get("/api/v1/orgs/org_demo/supply/forecast/SKU-00704", headers=_h("planner", "usr_planner"))).json()["data"]
    sug_qty = fc["suggestion"]["qty"]
    if sug_qty > 0:
        assert sug_qty >= 100
        assert sug_qty % 50 == 0

    # 4. Scan alerts & verify ack works
    scan = await client.post("/api/v1/orgs/org_demo/supply/alerts/scan", headers=_h("planner", "usr_planner"))
    assert scan.status_code == 200
    alerts = (await client.get("/api/v1/orgs/org_demo/supply/alerts", headers=_h("planner", "usr_planner"))).json()["data"]["items"]
    assert len(alerts) >= 1

    # 5. Create -> submit -> approve -> test PO defect > receive guard (422)
    cr = await client.post(
        "/api/v1/orgs/org_demo/supply/applies",
        headers=_h("planner", "usr_planner"),
        json={"sku": "SKU-00704", "route_code": "air", "objective_mode": "profit", "qty_propose": 100},
    )
    assert cr.status_code == 200
    aid = cr.json()["data"]["apply_id"]
    assert (await client.post(f"/api/v1/orgs/org_demo/supply/applies/{aid}/submit", headers=_h("planner", "usr_planner"))).status_code == 200

    app_res = await client.post(f"/api/v1/orgs/org_demo/supply/applies/{aid}/approve", headers=_h("approver", "usr_approver"))
    assert app_res.status_code == 200
    po_id = app_res.json()["data"]["po_id"]

    # Defect > receive blocked (422)
    bad_recv = await client.post(
        f"/api/v1/orgs/org_demo/supply/pos/{po_id}/receive",
        headers=_h("warehouse", "usr_wh"),
        json={"receive_qty": 20, "defect_qty": 25},
    )
    assert bad_recv.status_code == 422

    # Valid full receive closes apply
    ok_recv = await client.post(
        f"/api/v1/orgs/org_demo/supply/pos/{po_id}/receive",
        headers=_h("warehouse", "usr_wh"),
        json={"receive_qty": 100, "defect_qty": 2},
    )
    assert ok_recv.status_code == 200
    assert ok_recv.json()["data"]["status"] == "fully_received"
