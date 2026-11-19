"""Shopify 数据接入。

为什么不用官方 SDK：`Shopify/shopify_python_api` 仓库已 archived（REST Admin API 正在退役），
直接 requests 打 GraphQL Admin API 更轻、更可控，也不会有版本坑。

两种模式：
- demo：合成数据，用来先把界面和算法跑通（data_nature = DEMO_SYNTHETIC）
- real：读环境变量里的店铺域名与 Admin API token（data_nature = LIVE_API 或 TEST_API）
"""

from __future__ import annotations

import os
from typing import Dict, List

import numpy as np
import pandas as pd
import requests

API_VERSION = "2025-10"
TIMEOUT = 20
MAX_ORDERS = 300  # 一周版只拉最近订单，避免翻页拖时间


# ------------------------------------------------------------------ 演示数据
def demo_orders(days: int = 90, seed: int = 42) -> pd.DataFrame:
    """生成带趋势 + 周规律 + 噪声 + 一段断货的合成订单，仅用于跑通链路。"""
    rng = np.random.default_rng(seed)
    skus = ["SKU-A 保温杯", "SKU-B 收纳盒", "SKU-C 手机支架", "SKU-D 瑜伽垫"]
    base = {"SKU-A 保温杯": 6.0, "SKU-B 收纳盒": 3.0, "SKU-C 手机支架": 1.5, "SKU-D 瑜伽垫": 0.8}
    trend = {"SKU-A 保温杯": 0.02, "SKU-B 收纳盒": -0.01, "SKU-C 手机支架": 0.03, "SKU-D 瑜伽垫": 0.0}
    weekday_factor = np.array([1.15, 1.0, 1.0, 1.05, 1.2, 0.75, 0.7])  # 周一..周日

    end = pd.Timestamp.today().normalize() - pd.Timedelta(days=1)
    dates = pd.date_range(end - pd.Timedelta(days=days - 1), end, freq="D")

    rows = []
    for sku in skus:
        for i, d in enumerate(dates):
            lam = max(base[sku] * (1 + trend[sku] * i) * weekday_factor[d.weekday()], 0.05)
            # 人为制造 8 天断货（真实店铺最常见的"看起来没销量"其实是无货）
            if sku == "SKU-C 手机支架" and 40 <= i <= 47:
                qty = 0
            else:
                qty = int(rng.poisson(lam))
            if qty > 0:
                rows.append({"sku": sku, "date": d, "qty": qty})

    df = pd.DataFrame(rows)
    df.attrs["source"] = "demo_orders() 合成数据"
    df.attrs["data_nature"] = "DEMO_SYNTHETIC"
    return df


# ------------------------------------------------------------------ 真实数据
def _graphql(shop: str, token: str, query: str, variables: Dict) -> Dict:
    url = f"https://{shop}/admin/api/{API_VERSION}/graphql.json"
    resp = requests.post(
        url,
        json={"query": query, "variables": variables},
        headers={"X-Shopify-Access-Token": token, "Content-Type": "application/json"},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    payload = resp.json()
    if "errors" in payload:
        raise RuntimeError(f"GraphQL 报错: {payload['errors']}")
    return payload["data"]


ORDERS_QUERY = """
query Orders($cursor: String) {
  orders(first: 50, after: $cursor, sortKey: CREATED_AT, reverse: true) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id
        createdAt
        lineItems(first: 50) {
          edges { node { sku quantity } }
        }
      }
    }
  }
}
"""


def fetch_orders(shop: str, token: str) -> pd.DataFrame:
    """拉最近订单 -> [sku, date, qty]。（Day 1 需按你店铺实际返回字段微调）"""
    rows: List[Dict] = []
    cursor = None
    while len(rows) < MAX_ORDERS:
        data = _graphql(shop, token, ORDERS_QUERY, {"cursor": cursor})
        orders = data.get("orders", {})
        for edge in orders.get("edges", []):
            node = edge.get("node", {})
            day = pd.to_datetime(node.get("createdAt")).normalize()
            for li in node.get("lineItems", {}).get("edges", []):
                item = li.get("node", {})
                sku = item.get("sku") or "NO-SKU"
                qty = item.get("quantity") or 0
                if qty:
                    rows.append({"sku": sku, "date": day, "qty": int(qty)})
        page = orders.get("pageInfo", {})
        if not page.get("hasNextPage"):
            break
        cursor = page.get("endCursor")

    df = pd.DataFrame(rows[:MAX_ORDERS]) if rows else pd.DataFrame(columns=["sku", "date", "qty"])
    df.attrs["source"] = f"{shop} / GraphQL Admin API {API_VERSION}"
    df.attrs["data_nature"] = "LIVE_API" if os.getenv("SHOP_IS_LIVE") == "1" else "TEST_API"
    return df


def test_connection(shop: str, token: str) -> str:
    data = _graphql(shop, token, "query { shop { name myshopifyDomain currencyCode } }", {})
    s = data.get("shop", {})
    return f"{s.get('name')} · {s.get('myshopifyDomain')} · {s.get('currencyCode')}"
