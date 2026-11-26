from datetime import date, datetime, timezone
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, JSONBCompat


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class M7WorkflowRegistry(Base):
    __tablename__ = "m7_workflow_registry"

    workflow_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    purpose: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    adapter_type: Mapped[str] = mapped_column(String(32), nullable=False, default="CLOUD_API")
    compliance_node: Mapped[str] = mapped_column(String(64), nullable=False, default="iptc_tail_v1")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ACTIVE")
    config_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)


class M7GenerationJob(Base):
    __tablename__ = "m7_generation_jobs"
    __table_args__ = (
        UniqueConstraint("org_id", "idempotency_key", name="uq_m7_job_idemp"),
        CheckConstraint("progress >= 0 AND progress <= 100", name="ck_m7_job_progress"),
        Index("idx_m7_jobs_org_sku_status", "org_id", "sku", "status", "created_at"),
    )

    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    job_type: Mapped[str] = mapped_column(String(24), nullable=False)
    platform: Mapped[str] = mapped_column(String(24), nullable=False, default="amazon_us")
    workflow_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("m7_workflow_registry.workflow_id"), nullable=True
    )
    workflow_version: Mapped[str] = mapped_column(String(32), nullable=False, default="1.0.0")
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="QUEUED", index=True)
    progress: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    engine_run_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    params_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    error_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )


class M7GenerationAsset(Base):
    __tablename__ = "m7_generation_assets"
    __table_args__ = (
        Index(
            "idx_m7_assets_active",
            "org_id",
            "sku",
            "asset_slot",
            sqlite_where=text("deleted_at IS NULL"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "uq_m7_assets_selected_slot",
            "org_id",
            "sku",
            "platform",
            "asset_slot",
            unique=True,
            sqlite_where=text("is_selected = 1 AND deleted_at IS NULL"),
            postgresql_where=text("is_selected = TRUE AND deleted_at IS NULL"),
        ),
    )

    asset_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    job_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("m7_generation_jobs.job_id"), nullable=False
    )
    asset_slot: Mapped[str] = mapped_column(String(32), nullable=False)
    platform: Mapped[str] = mapped_column(String(24), nullable=False, default="amazon_us")
    lang: Mapped[str] = mapped_column(String(16), nullable=False, default="en-US")
    variant_idx: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_selected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    edit_status: Mapped[str] = mapped_column(String(24), nullable=False, default="AI_GENERATED")
    content_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    orig_content_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    scan_result_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    last_edited_by: Mapped[str] = mapped_column(String(64), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )


class M7GenerationMedia(Base):
    __tablename__ = "m7_generation_media"
    __table_args__ = (
        CheckConstraint("media_kind IN ('IMAGE', 'VIDEO')", name="ck_m7_media_kind"),
        CheckConstraint("file_size > 0", name="ck_m7_media_size_pos"),
        Index("idx_m7_media_org", "org_id", "media_kind"),
    )

    media_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), nullable=False)
    asset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("m7_generation_assets.asset_id"), nullable=False, unique=True
    )
    media_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_sec: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    ai_person_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    iptc_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    iptc_tags_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)


class M7ComplianceRule(Base):
    __tablename__ = "m7_compliance_rules"
    __table_args__ = (
        UniqueConstraint("org_id", "platform", "category", name="uq_m7_rule_org_plat_cat"),
    )

    rule_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), nullable=False)
    platform: Mapped[str] = mapped_column(String(24), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    rule_version: Mapped[str] = mapped_column(String(32), nullable=False, default="2026.11")
    effective_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    title_max_chars: Mapped[int] = mapped_column(Integer, nullable=False, default=200)
    bullet_max_chars: Mapped[int] = mapped_column(Integer, nullable=False, default=500)
    search_terms_max_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=250)
    lexicon_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    required_certs_json: Mapped[list] = mapped_column(JSONBCompat, nullable=False, default=list)
    image_policy_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    updated_by: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )


class M7CertRecord(Base):
    __tablename__ = "m7_cert_records"
    __table_args__ = (Index("idx_m7_certs_org_sku", "org_id", "sku", "expire_date"),)

    cert_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    cert_type: Mapped[str] = mapped_column(String(64), nullable=False)
    cert_no: Mapped[str] = mapped_column(String(128), nullable=False)
    expire_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="VALID")
    doc_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )


class M7ComplianceCheck(Base):
    __tablename__ = "m7_compliance_checks"
    __table_args__ = (Index("idx_m7_checks_latest", "org_id", "sku", "created_at"),)

    check_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    platform: Mapped[str] = mapped_column(String(24), nullable=False)
    rule_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("m7_compliance_rules.rule_id"), nullable=False
    )
    rule_version: Mapped[str] = mapped_column(String(32), nullable=False)
    checks_json: Mapped[list] = mapped_column(JSONBCompat, nullable=False, default=list)
    deliverable_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    overall_pass: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    checked_by: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)


class M7ApprovalRecord(Base):
    __tablename__ = "m7_approval_records"
    __table_args__ = (
        Index("idx_m7_approval_active", "org_id", "sku", "platform", "is_active", "approved_at"),
    )

    approval_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    platform: Mapped[str] = mapped_column(String(24), nullable=False, default="amazon_us")
    check_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("m7_compliance_checks.check_id"), nullable=False
    )
    last_editor_id: Mapped[str] = mapped_column(String(64), nullable=False)
    approver_id: Mapped[str] = mapped_column(String(64), nullable=False)
    decision: Mapped[str] = mapped_column(String(16), nullable=False, default="APPROVED")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    invalidated_reason: Mapped[str | None] = mapped_column(String(128), nullable=True)
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)


class CoreAuditEvent(Base):
    __tablename__ = "core_audit_events"
    __table_args__ = (Index("idx_core_audit_org_sku", "org_id", "sku", "created_at"),)

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    org_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(64), nullable=True)
    module: Mapped[str] = mapped_column(String(16), nullable=False, default="M7")
    action: Mapped[str] = mapped_column(String(48), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(64), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(24), nullable=False)
    ok: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sentence_zh: Mapped[str] = mapped_column(Text, nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSONBCompat, nullable=False, default=dict)
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
