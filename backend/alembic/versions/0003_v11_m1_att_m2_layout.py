"""v1.1 upgrades: m1_aftersales_attachments & m2_dashboard_layouts

Revision ID: 0003_v11_m1_att_m2_layout
Revises: 0002_platform_m0_m8
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_v11_m1_att_m2_layout"
down_revision = "0002_platform_m0_m8"
branch_labels = None
depends_on = None

JSONBCompat = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "m1_aftersales_attachments",
        sa.Column("att_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("ticket_id", sa.String(64), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m1_att_org_id", "m1_aftersales_attachments", ["org_id"])
    op.create_index("ix_m1_att_ticket_id", "m1_aftersales_attachments", ["ticket_id"])

    op.create_table(
        "m2_dashboard_layouts",
        sa.Column("layout_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False, unique=True),
        sa.Column("draft_layout_json", JSONBCompat, nullable=False),
        sa.Column("published_layout_json", JSONBCompat, nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(64), nullable=False, server_default="system"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_m2_layouts_org_id", "m2_dashboard_layouts", ["org_id"])


def downgrade() -> None:
    op.drop_table("m2_dashboard_layouts")
    op.drop_table("m1_aftersales_attachments")
