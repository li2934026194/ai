"""platform m0 to m8 tables

Revision ID: 0002_platform_m0_m8
Revises: 0001_init_m7
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_platform_m0_m8"
down_revision = "0001_init_m7"
branch_labels = None
depends_on = None

JSONBCompat = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "m8_users",
        sa.Column("user_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("display_name", sa.String(64), nullable=False),
        sa.Column("role_code", sa.String(64), nullable=False),
        sa.Column("email", sa.String(128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m8_users_org_id", "m8_users", ["org_id"])

    op.create_table(
        "m8_role_definitions",
        sa.Column("role_code", sa.String(64), primary_key=True),
        sa.Column("display_name", sa.String(64), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("permissions_json", JSONBCompat, nullable=False),
    )

    op.create_table(
        "m8_approval_policies",
        sa.Column("policy_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("module", sa.String(32), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("threshold_rule", sa.String(256), nullable=False),
        sa.Column("approver_role", sa.String(64), nullable=False),
        sa.Column("enforce_sod", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )
    op.create_index("ix_m8_approval_policies_org_id", "m8_approval_policies", ["org_id"])

    op.create_table(
        "m0_shops",
        sa.Column("shop_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("shop_code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("platform", sa.String(24), nullable=False),
        sa.Column("currency", sa.String(12), nullable=False, server_default="USD"),
        sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("status", sa.String(24), nullable=False, server_default="CONNECTED"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "shop_code", name="uq_m0_shop_code"),
    )
    op.create_index("ix_m0_shops_org_id", "m0_shops", ["org_id"])

    op.create_table(
        "m0_products",
        sa.Column("product_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("category", sa.String(64), nullable=False, server_default="kitchen_appliance"),
        sa.Column("category_label_zh", sa.String(64), nullable=False, server_default="厨卫小电"),
        sa.Column("platform", sa.String(24), nullable=False, server_default="amazon_us"),
        sa.Column("brand_name", sa.String(64), nullable=False, server_default="CrossPilot Lab"),
        sa.Column("sale_price_usd", sa.Float(), nullable=False, server_default="24.9"),
        sa.Column("strike_price_usd", sa.Float(), nullable=True),
        sa.Column("unit_cost_usd", sa.Float(), nullable=False, server_default="7.5"),
        sa.Column("moq", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("pack_size", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("lead_time_days", sa.Integer(), nullable=False, server_default="21"),
        sa.Column("origin", sa.String(32), nullable=False, server_default="IN_STORE_REFRESH"),
        sa.Column("approver", sa.String(64), nullable=False, server_default="在售老品翻新"),
        sa.Column("decision_reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("specs_json", JSONBCompat, nullable=False),
        sa.Column("selling_points_json", JSONBCompat, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "sku", name="uq_m0_org_sku"),
    )
    op.create_index("ix_m0_products_org_id", "m0_products", ["org_id"])
    op.create_index("ix_m0_products_sku", "m0_products", ["sku"])

    op.create_table(
        "m0_cost_requests",
        sa.Column("req_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("old_cost_usd", sa.Float(), nullable=False),
        sa.Column("new_cost_usd", sa.Float(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="PENDING"),
        sa.Column("proposer_id", sa.String(64), nullable=False),
        sa.Column("reviewer_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m0_cost_requests_org_id", "m0_cost_requests", ["org_id"])
    op.create_index("ix_m0_cost_requests_sku", "m0_cost_requests", ["sku"])

    op.create_table(
        "m0_orders",
        sa.Column("order_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("shop_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("order_date", sa.String(16), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("revenue_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("status", sa.String(24), nullable=False, server_default="PAID"),
    )
    op.create_index("ix_m0_orders_org_id", "m0_orders", ["org_id"])
    op.create_index("ix_m0_orders_sku", "m0_orders", ["sku"])

    op.create_table(
        "m0_inventory",
        sa.Column("inv_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("warehouse_code", sa.String(32), nullable=False, server_default="WH-US-WEST"),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("on_hand", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("in_transit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reserved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_stocktake_by", sa.String(64), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "warehouse_code", "sku", name="uq_m0_wh_sku"),
    )
    op.create_index("ix_m0_inventory_org_id", "m0_inventory", ["org_id"])
    op.create_index("ix_m0_inventory_sku", "m0_inventory", ["sku"])

    op.create_table(
        "m0_supplier_quotes",
        sa.Column("quote_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("supplier_name", sa.String(128), nullable=False),
        sa.Column("unit_price_rmb", sa.Float(), nullable=False),
        sa.Column("moq", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("lead_time_days", sa.Integer(), nullable=False, server_default="18"),
        sa.Column("is_simulated", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
    )
    op.create_index("ix_m0_supplier_quotes_org_id", "m0_supplier_quotes", ["org_id"])
    op.create_index("ix_m0_supplier_quotes_sku", "m0_supplier_quotes", ["sku"])

    op.create_table(
        "m1_faq_entries",
        sa.Column("faq_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("pain_points_json", JSONBCompat, nullable=False),
        sa.Column("faq_pairs_json", JSONBCompat, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "sku", name="uq_m1_org_sku_faq"),
    )
    op.create_index("ix_m1_faq_entries_org_id", "m1_faq_entries", ["org_id"])
    op.create_index("ix_m1_faq_entries_sku", "m1_faq_entries", ["sku"])

    op.create_table(
        "m1_cs_sessions",
        sa.Column("session_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("buyer_name", sa.String(64), nullable=False),
        sa.Column("channel", sa.String(32), nullable=False, server_default="Amazon Buyer Msg"),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("reply", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("status", sa.String(24), nullable=False, server_default="OPEN"),
        sa.Column("handler_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m1_cs_sessions_org_id", "m1_cs_sessions", ["org_id"])
    op.create_index("ix_m1_cs_sessions_sku", "m1_cs_sessions", ["sku"])

    op.create_table(
        "m1_aftersales_tickets",
        sa.Column("ticket_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("order_ref", sa.String(64), nullable=False),
        sa.Column("platform", sa.String(32), nullable=False, server_default="Amazon US"),
        sa.Column("issue_type", sa.String(64), nullable=False),
        sa.Column("refund_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("evidence_note", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(24), nullable=False, server_default="PENDING_APPROVAL"),
        sa.Column("submitter_id", sa.String(64), nullable=False),
        sa.Column("approver_id", sa.String(64), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m1_aftersales_tickets_org_id", "m1_aftersales_tickets", ["org_id"])
    op.create_index("ix_m1_aftersales_tickets_sku", "m1_aftersales_tickets", ["sku"])

    op.create_table(
        "m2_ad_campaigns",
        sa.Column("campaign_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("platform", sa.String(32), nullable=False, server_default="Amazon Sponsored"),
        sa.Column("campaign_name", sa.String(128), nullable=False),
        sa.Column("daily_budget_usd", sa.Float(), nullable=False, server_default="50.0"),
        sa.Column("spend_7d_usd", sa.Float(), nullable=False, server_default="280.0"),
        sa.Column("sales_7d_usd", sa.Float(), nullable=False, server_default="1400.0"),
        sa.Column("acos", sa.Float(), nullable=False, server_default="0.20"),
        sa.Column("roas", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("status", sa.String(24), nullable=False, server_default="ACTIVE"),
    )
    op.create_index("ix_m2_ad_campaigns_org_id", "m2_ad_campaigns", ["org_id"])
    op.create_index("ix_m2_ad_campaigns_sku", "m2_ad_campaigns", ["sku"])

    op.create_table(
        "m3_competitor_watches",
        sa.Column("watch_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("competitor_brand", sa.String(64), nullable=False),
        sa.Column("asin_or_ref", sa.String(64), nullable=False),
        sa.Column("price_usd", sa.Float(), nullable=False),
        sa.Column("rating", sa.Float(), nullable=False, server_default="4.5"),
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("bsr_rank", sa.Integer(), nullable=False, server_default="450"),
        sa.Column("sentiment_score", sa.Float(), nullable=False, server_default="0.82"),
        sa.Column("negative_topics_json", JSONBCompat, nullable=False),
        sa.Column("last_alert", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m3_competitor_watches_org_id", "m3_competitor_watches", ["org_id"])
    op.create_index("ix_m3_competitor_watches_sku", "m3_competitor_watches", ["sku"])

    op.create_table(
        "m4_candidates",
        sa.Column("candidate_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("category", sa.String(64), nullable=False, server_default="Consumer Electronics"),
        sa.Column("source_channel", sa.String(64), nullable=False, server_default="1688 趋势选品"),
        sa.Column("target_price_usd", sa.Float(), nullable=False, server_default="29.99"),
        sa.Column("est_cost_rmb", sa.Float(), nullable=False, server_default="42.0"),
        sa.Column("est_shipping_rmb", sa.Float(), nullable=False, server_default="18.0"),
        sa.Column("est_margin_pct", sa.Float(), nullable=False, server_default="0.35"),
        sa.Column("scores_json", JSONBCompat, nullable=False),
        sa.Column("total_score", sa.Integer(), nullable=False, server_default="75"),
        sa.Column("operator_note", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(32), nullable=False, server_default="DISCOVERED"),
        sa.Column("submitter_id", sa.String(64), nullable=True),
        sa.Column("approver_id", sa.String(64), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m4_candidates_org_id", "m4_candidates", ["org_id"])
    op.create_index("ix_m4_candidates_sku", "m4_candidates", ["sku"])

    op.create_table(
        "m5_sales_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("sales_date", sa.Date(), nullable=False),
        sa.Column("qty_raw", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("on_hand_eod", sa.Float(), nullable=False, server_default="100.0"),
        sa.Column("revenue_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.UniqueConstraint("org_id", "sku", "sales_date", name="uq_m5_org_sku_date"),
    )
    op.create_index("ix_m5_sales_history_org_id", "m5_sales_history", ["org_id"])
    op.create_index("ix_m5_sales_history_sales_date", "m5_sales_history", ["sales_date"])
    op.create_index("ix_m5_sales_history_sku", "m5_sales_history", ["sku"])

    op.create_table(
        "m6_replenish_applies",
        sa.Column("apply_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("route_code", sa.String(24), nullable=False, server_default="sea"),
        sa.Column("objective_mode", sa.String(24), nullable=False, server_default="profit"),
        sa.Column("qty_suggest", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("qty_propose", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("est_amount_rmb", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("submit_user", sa.String(64), nullable=True),
        sa.Column("submit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approve_user", sa.String(64), nullable=True),
        sa.Column("approve_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column("snapshot_json", JSONBCompat, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m6_replenish_applies_org_id", "m6_replenish_applies", ["org_id"])
    op.create_index("ix_m6_replenish_applies_sku", "m6_replenish_applies", ["sku"])

    op.create_table(
        "m6_purchase_orders",
        sa.Column("po_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("apply_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("route_code", sa.String(24), nullable=False, server_default="sea"),
        sa.Column("order_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("receive_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("defect_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="created"),
        sa.Column("expect_arrive", sa.Date(), nullable=True),
        sa.Column("actual_arrive", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m6_purchase_orders_apply_id", "m6_purchase_orders", ["apply_id"])
    op.create_index("ix_m6_purchase_orders_org_id", "m6_purchase_orders", ["org_id"])
    op.create_index("ix_m6_purchase_orders_sku", "m6_purchase_orders", ["sku"])

    op.create_table(
        "m6_alert_events",
        sa.Column("alert_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False, server_default="HIGH"),
        sa.Column("alert_type", sa.String(48), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="OPEN"),
        sa.Column("ack_by", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m6_alert_events_org_id", "m6_alert_events", ["org_id"])
    op.create_index("ix_m6_alert_events_sku", "m6_alert_events", ["sku"])

    op.create_table(
        "m6_weekly_reviews",
        sa.Column("review_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("week_label", sa.String(32), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("metrics_json", JSONBCompat, nullable=False),
        sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_by", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m6_weekly_reviews_org_id", "m6_weekly_reviews", ["org_id"])


def downgrade() -> None:
    for tbl in (
        "m6_weekly_reviews",
        "m6_alert_events",
        "m6_purchase_orders",
        "m6_replenish_applies",
        "m5_sales_history",
        "m4_candidates",
        "m3_competitor_watches",
        "m2_ad_campaigns",
        "m1_aftersales_tickets",
        "m1_cs_sessions",
        "m1_faq_entries",
        "m0_supplier_quotes",
        "m0_inventory",
        "m0_orders",
        "m0_cost_requests",
        "m0_products",
        "m0_shops",
        "m8_approval_policies",
        "m8_role_definitions",
        "m8_users",
    ):
        op.drop_table(tbl)
