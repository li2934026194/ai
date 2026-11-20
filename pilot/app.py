"""补货决策 Pilot · 一周版界面。

一个文件三个页签：数据 / 预测 / 补货建议。
启动：streamlit run app.py
"""

from __future__ import annotations

import os

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

import core
import shopify_client

st.set_page_config(page_title="补货决策 Pilot", page_icon="📦", layout="wide")
st.title("补货决策 Pilot")
st.caption("真实店铺数据 → 销量预测 → 该补多少、什么时候补")

# ------------------------------------------------------------------ 侧边栏
with st.sidebar:
    st.header("① 数据源")
    mode = st.radio("选择", ["演示数据（合成）", "Shopify 真实店铺"], index=0)

    orders, meta = None, {}
    if mode == "演示数据（合成）":
        orders = shopify_client.demo_orders()
        meta = {
            "来源": orders.attrs.get("source", "—"),
            "数据性质": orders.attrs.get("data_nature", "DEMO_SYNTHETIC"),
            "截止日期": str(orders["date"].max().date()) if not orders.empty else "—",
        }
        st.warning("演示数据：用于跑通链路，**不能**用于任何准确率结论。")
    else:
        shop = st.text_input("店铺域名", value=os.getenv("SHOP_DOMAIN", ""), placeholder="xxx.myshopify.com")
        token = st.text_input("Admin API Token", value=os.getenv("SHOP_TOKEN", ""), type="password")
        if st.button("连接并读取订单", type="primary"):
            try:
                st.success(f"已连接：{shopify_client.test_connection(shop, token)}")
                orders = shopify_client.fetch_orders(shop, token)
                st.session_state["real_orders"] = orders
            except Exception as e:  # noqa: BLE001
                st.error(f"连接失败：{e}")
        orders = st.session_state.get("real_orders")
        if orders is not None:
            meta = {
                "来源": orders.attrs.get("source", shop),
                "数据性质": orders.attrs.get("data_nature", "TEST_API"),
                "截止日期": str(orders["date"].max().date()) if not orders.empty else "—",
            }

if orders is None or orders.empty:
    st.info("左侧先选数据源。第一次用请选「演示数据」，30 秒就能看到完整效果。")
    st.stop()

daily = core.aggregate_daily(orders)
skus = sorted(daily["sku"].unique())

# 数据来源条：每个数字都必须能追到来源（铁律 2）
st.markdown(
 f"**数据来源**：{meta.get('来源')} ｜ **数据性质**：`{meta.get('数据性质')}` ｜ **截止**：{meta.get('截止日期')}"
)

tab_data, tab_fc, tab_rp = st.tabs(["① 数据", "② 预测", "③ 补货建议"])

# ------------------------------------------------------------------ ① 数据
with tab_data:
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("订单行数", f"{len(orders):,}")
    c2.metric("SKU 数", len(skus))
    c3.metric("覆盖天数", f"{daily['date'].nunique()} 天")
    c4.metric("总销量", f"{int(daily['qty'].sum()):,}")

    with st.expander("原始订单（前 30 行）"):
        st.dataframe(orders.head(30), use_container_width=True)

    sku_pick = st.selectbox("看哪个 SKU 的日销量", skus)
    one = daily[daily["sku"] == sku_pick]
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=one["date"], y=one["qty"], mode="lines+markers", name="日销量"))
    fig.update_layout(height=350, margin=dict(l=10, r=10, t=30, b=10), yaxis_title="件/天")
    st.plotly_chart(fig, use_container_width=True)

    zeros = int((one["qty"] == 0).sum())
    if zeros:
        st.info(f"这个 SKU 有 **{zeros}** 天零销量。零销量要区分「真没需求」和「断货」，"
                "否则模型会把断货当成没需求。")

# ------------------------------------------------------------------ ② 预测
with tab_fc:
    st.markdown("#### 先比模型，再谈预测")
    horizon = st.slider("预测天数", 7, 60, 30, 1)
    method = st.selectbox("用哪个模型出预测", list(core.MODELS.keys()), index=0)

    bt = core.backtest(daily[daily["sku"] == sku_pick], horizon=14)
    if not bt.empty:
        best = bt.iloc[0]
        st.dataframe(
            bt.style.format({"WAPE%": "{:.1f}", "Bias%": "{:.1f}", "MAE": "{:.2f}"}),
            use_container_width=True,
        )
        st.caption(f"留出回测（最后 14 天不参与训练）。当前最优：**{best['模型']}**，"
                   f"WAPE {best['WAPE%']:.1f}%。WAPE 越低越好，Bias 接近 0 说明没有系统性地多算或少算。")
    else:
        st.warning("数据太短，无法回测（至少需要 15 天）。")

    yhat = core.forecast(daily[daily["sku"] == sku_pick], horizon, method)
    one = daily[daily["sku"] == sku_pick]
    future = pd.date_range(one["date"].max() + pd.Timedelta(days=1), periods=horizon, freq="D")

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=one["date"].tail(60), y=one["qty"].tail(60), mode="lines", name="历史"))
    fig.add_trace(go.Scatter(x=future, y=yhat, mode="lines", name=f"预测（{method}）",
                             line=dict(dash="dash")))
    fig.update_layout(height=400, margin=dict(l=10, r=10, t=30, b=10), yaxis_title="件/天")
    st.plotly_chart(fig, use_container_width=True)

    avg = float(np.mean(yhat))
    st.metric(f"未来 {horizon} 天预计总需求", f"{yhat.sum():.0f} 件", f"日均 {avg:.1f} 件")

# ------------------------------------------------------------------ ③ 补货
with tab_rp:
    st.markdown("#### 该补多少？")
    c1, c2, c3 = st.columns(3)
    lead_time = c1.number_input("交期（天）", 1, 120, 15)
    safety_days = c2.number_input("安全库存（天）", 0, 60, 7)
    pack = c3.number_input("整箱数量", 1, 500, 1)

    c4, c5, c6 = st.columns(3)
    stock = c4.number_input("当前库存", 0, 100000, 120)
    inbound = c5.number_input("在途库存", 0, 100000, 0)
    moq = c6.number_input("起订量 MOQ", 0, 10000, 0)

    avg_daily = float(np.mean(yhat)) if len(yhat) else 0.0
    res = core.replenish_suggest(avg_daily, lead_time, stock, inbound, safety_days, pack, moq)

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("建议补货量", f"{res['建议补货量']} 件")
    m2.metric("日均需求", f"{avg_daily:.1f} 件")
    m3.metric("当前可支撑", f"{res['可支撑天数']} 天" if res["可支撑天数"] is not None else "—")
    m4.metric("预计断货", f"第 {res['预计断货日']} 天" if res["预计断货日"] is not None else "不会断")

    if res["建议补货量"] > 0:
        st.success(
            f"交期 {lead_time} 天需要 {res['交期需求']} 件，安全库存 {res['安全库存']} 件，"
            f"现有+在途 {res['可用合计']} 件 → **建议补 {res['建议补货量']} 件**"
            f"（按整箱 {pack} 取整）。"
        )
    else:
        st.info("当前库存足以覆盖交期与安全库存，这一轮不需要补。")

    curve = core.inventory_curve(stock, res["建议补货量"], lead_time, yhat)
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=curve["day"], y=curve["stock"], mode="lines", name="库存（含本次补货到货）"))
    fig.add_hline(y=0, line_dash="dot", line_color="red")
    fig.update_layout(height=350, margin=dict(l=10, r=10, t=30, b=10),
                      xaxis_title="未来第 N 天", yaxis_title="库存（件）")
    st.plotly_chart(fig, use_container_width=True)

    st.caption("这条线穿过 0 的那一天，就是你断货的那一天。补货建议的目的，是让它不要穿过去。")

    st.divider()
    if st.button("生成整店建议表", type="primary"):
        rows = []
        for sku in skus:
            sub = daily[daily["sku"] == sku]
            if len(sub) < 15:
                continue
            y = core.forecast(sub, horizon, method)
            a = float(np.mean(y))
            r = core.replenish_suggest(a, lead_time, stock, inbound, safety_days, pack, moq)
            rows.append({"SKU": sku, "日均需求": round(a, 1),
                         "建议补货量": r["建议补货量"], "预计断货日": r["预计断货日"],
                         "数据性质": meta.get("数据性质")})
        table = pd.DataFrame(rows).sort_values("建议补货量", ascending=False)
        st.dataframe(table, use_container_width=True)
        st.download_button("导出 CSV", table.to_csv(index=False).encode("utf-8-sig"),
                           file_name="补货建议.csv", mime="text/csv")
        st.caption("库存与交期目前是统一填的；Day 5 会改成按 SKU 各自读取店铺真实库存。")
