"""init m7 9 tables

Revision ID: 0001_init_m7
Revises:
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_init_m7"
down_revision = None
branch_labels = None
depends_on = None

JSONBCompat = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "m7_workflow_registry",
        sa.Column("workflow_id", sa.String(64), primary_key=True),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("version", sa.String(32), nullable=False),
        sa.Column("adapter_type", sa.String(32), nullable=False, server_default="CLOUD_API"),
        sa.Column("compliance_node", sa.String(64), nullable=False, server_default="iptc_tail_v1"),
        sa.Column("status", sa.String(16), nullable=False, server_default="ACTIVE"),
        sa.Column("config_json", JSONBCompat, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_m7_workflow_registry_purpose", "m7_workflow_registry", ["purpose"])

    op.create_table(
        "m7_generation_jobs",
        sa.Column("job_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("job_type", sa.String(24), nullable=False),
        sa.Column("platform", sa.String(24), nullable=False, server_default="amazon_us"),
        sa.Column("workflow_id", sa.String(64), sa.ForeignKey("m7_workflow_registry.workflow_id"), nullable=True),
        sa.Column("workflow_version", sa.String(32), nullable=False, server_default="1.0.0"),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="QUEUED"),
        sa.Column("progress", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("engine_run_id", sa.String(128), nullable=True),
        sa.Column("params_json", JSONBCompat, nullable=False),
        sa.Column("error_code", sa.String(32), nullable=True),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("org_id", "idempotency_key", name="uq_m7_job_idemp"),
        sa.CheckConstraint("progress >= 0 AND progress <= 100", name="ck_m7_job_progress"),
    )
    op.create_index("idx_m7_jobs_org_sku_status", "m7_generation_jobs", ["org_id", "sku", "status", "created_at"])

    op.create_table(
        "m7_generation_assets",
        sa.Column("asset_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("job_id", sa.String(64), sa.ForeignKey("m7_generation_jobs.job_id"), nullable=False),
        sa.Column("asset_slot", sa.String(32), nullable=False),
        sa.Column("platform", sa.String(24), nullable=False, server_default="amazon_us"),
        sa.Column("lang", sa.String(16), nullable=False, server_default="en-US"),
        sa.Column("variant_idx", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_selected", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("edit_status", sa.String(24), nullable=False, server_default="AI_GENERATED"),
        sa.Column("content_json", JSONBCompat, nullable=False),
        sa.Column("orig_content_json", JSONBCompat, nullable=False),
        sa.Column("scan_result_json", JSONBCompat, nullable=False),
        sa.Column("last_edited_by", sa.String(64), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "idx_m7_assets_active",
        "m7_generation_assets",
        ["org_id", "sku", "asset_slot"],
        sqlite_where=sa.text("deleted_at IS NULL"),
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "uq_m7_assets_selected_slot",
        "m7_generation_assets",
        ["org_id", "sku", "platform", "asset_slot"],
        unique=True,
        sqlite_where=sa.text("is_selected = 1 AND deleted_at IS NULL"),
        postgresql_where=sa.text("is_selected = TRUE AND deleted_at IS NULL"),
    )

    op.create_table(
        "m7_generation_media",
        sa.Column("media_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("asset_id", sa.String(64), sa.ForeignKey("m7_generation_assets.asset_id"), nullable=False, unique=True),
        sa.Column("media_kind", sa.String(16), nullable=False),
        sa.Column("mime_type", sa.String(64), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("storage_key", sa.String(255), nullable=False, unique=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("duration_sec", sa.Numeric(5, 2), nullable=True),
        sa.Column("ai_person_flag", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("iptc_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("iptc_tags_json", JSONBCompat, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("media_kind IN ('IMAGE', 'VIDEO')", name="ck_m7_media_kind"),
        sa.CheckConstraint("file_size > 0", name="ck_m7_media_size_pos"),
    )
    op.create_index("idx_m7_media_org", "m7_generation_media", ["org_id", "media_kind"])

    op.create_table(
        "m7_compliance_rules",
        sa.Column("rule_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("platform", sa.String(24), nullable=False),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("rule_version", sa.String(32), nullable=False, server_default="2026.11"),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("title_max_chars", sa.Integer(), nullable=False, server_default="200"),
        sa.Column("bullet_max_chars", sa.Integer(), nullable=False, server_default="500"),
        sa.Column("search_terms_max_bytes", sa.Integer(), nullable=False, server_default="250"),
        sa.Column("lexicon_json", JSONBCompat, nullable=False),
        sa.Column("required_certs_json", JSONBCompat, nullable=False),
        sa.Column("image_policy_json", JSONBCompat, nullable=False),
        sa.Column("updated_by", sa.String(64), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("org_id", "platform", "category", name="uq_m7_rule_org_plat_cat"),
    )

    op.create_table(
        "m7_cert_records",
        sa.Column("cert_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("cert_type", sa.String(64), nullable=False),
        sa.Column("cert_no", sa.String(128), nullable=False),
        sa.Column("expire_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="VALID"),
        sa.Column("doc_url", sa.String(255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_m7_certs_org_sku", "m7_cert_records", ["org_id", "sku", "expire_date"])

    op.create_table(
        "m7_compliance_checks",
        sa.Column("check_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("platform", sa.String(24), nullable=False),
        sa.Column("rule_id", sa.String(64), sa.ForeignKey("m7_compliance_rules.rule_id"), nullable=False),
        sa.Column("rule_version", sa.String(32), nullable=False),
        sa.Column("checks_json", JSONBCompat, nullable=False),
        sa.Column("deliverable_count", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("overall_pass", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("checked_by", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_m7_checks_latest", "m7_compliance_checks", ["org_id", "sku", "created_at"])

    op.create_table(
        "m7_approval_records",
        sa.Column("approval_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("platform", sa.String(24), nullable=False, server_default="amazon_us"),
        sa.Column("check_id", sa.String(64), sa.ForeignKey("m7_compliance_checks.check_id"), nullable=False),
        sa.Column("last_editor_id", sa.String(64), nullable=False),
        sa.Column("approver_id", sa.String(64), nullable=False),
        sa.Column("decision", sa.String(16), nullable=False, server_default="APPROVED"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("invalidated_reason", sa.String(128), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "idx_m7_approval_active",
        "m7_approval_records",
        ["org_id", "sku", "platform", "is_active", "approved_at"],
    )

    op.create_table(
        "core_audit_events",
        sa.Column("event_id", sa.String(64), primary_key=True),
        sa.Column("org_id", sa.String(64), nullable=False),
        sa.Column("sku", sa.String(64), nullable=True),
        sa.Column("module", sa.String(16), nullable=False, server_default="M7"),
        sa.Column("action", sa.String(48), nullable=False),
        sa.Column("actor_id", sa.String(64), nullable=False),
        sa.Column("actor_role", sa.String(24), nullable=False),
        sa.Column("ok", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sentence_zh", sa.Text(), nullable=False),
        sa.Column("payload_json", JSONBCompat, nullable=False),
        sa.Column("trace_id", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_core_audit_org_sku", "core_audit_events", ["org_id", "sku", "created_at"])


def downgrade() -> None:
    op.drop_table("core_audit_events")
    op.drop_table("m7_approval_records")
    op.drop_table("m7_compliance_checks")
    op.drop_table("m7_cert_records")
    op.drop_table("m7_compliance_rules")
    op.drop_table("m7_generation_media")
    op.drop_table("m7_generation_assets")
    op.drop_table("m7_generation_jobs")
    op.drop_table("m7_workflow_registry")
