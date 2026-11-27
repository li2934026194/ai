"""Add image_url to m0_products and m4_candidates

Binds product photos to product records at the database level.
Revision ID: 0004_product_image_url
Revises: 0003_v11_m1_att_m2_layout
Create Date: 2026-11-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_product_image_url"
down_revision = "0003_v11_m1_att_m2_layout"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("m0_products", sa.Column("image_url", sa.String(512), nullable=True))
    op.add_column("m4_candidates", sa.Column("image_url", sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column("m4_candidates", "image_url")
    op.drop_column("m0_products", "image_url")
