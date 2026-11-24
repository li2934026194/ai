from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.m7_content.models import (
    CoreAuditEvent,
    M7ApprovalRecord,
    M7CertRecord,
    M7ComplianceCheck,
    M7ComplianceRule,
    M7GenerationAsset,
    M7GenerationJob,
    M7GenerationMedia,
    M7WorkflowRegistry,
)


class M7Repository:
    """所有 M7 数据库读写强制追加 org_id 租户隔离条件"""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_workflow(self, workflow_id: str) -> M7WorkflowRegistry | None:
        return await self.session.get(M7WorkflowRegistry, workflow_id)

    async def get_job_by_idempotency(self, org_id: str, idempotency_key: str) -> M7GenerationJob | None:
        return await self.session.scalar(
            select(M7GenerationJob).where(
                M7GenerationJob.org_id == org_id,
                M7GenerationJob.idempotency_key == idempotency_key,
            )
        )

    async def get_job(self, org_id: str, job_id: str) -> M7GenerationJob | None:
        return await self.session.scalar(
            select(M7GenerationJob).where(
                M7GenerationJob.org_id == org_id,
                M7GenerationJob.job_id == job_id,
            )
        )

    async def get_asset(self, org_id: str, asset_id: str) -> M7GenerationAsset | None:
        return await self.session.scalar(
            select(M7GenerationAsset).where(
                M7GenerationAsset.org_id == org_id,
                M7GenerationAsset.asset_id == asset_id,
                M7GenerationAsset.deleted_at.is_(None),
            )
        )

    async def list_selected_assets(
        self, org_id: str, sku: str, platform: str
    ) -> list[M7GenerationAsset]:
        res = await self.session.scalars(
            select(M7GenerationAsset).where(
                M7GenerationAsset.org_id == org_id,
                M7GenerationAsset.sku == sku,
                M7GenerationAsset.platform == platform,
                M7GenerationAsset.is_selected.is_(True),
                M7GenerationAsset.deleted_at.is_(None),
            )
        )
        return list(res.all())

    async def list_media_for_assets(self, org_id: str, asset_ids: list[str]) -> dict[str, M7GenerationMedia]:
        if not asset_ids:
            return {}
        res = await self.session.scalars(
            select(M7GenerationMedia).where(
                M7GenerationMedia.org_id == org_id,
                M7GenerationMedia.asset_id.in_(asset_ids),
            )
        )
        return {m.asset_id: m for m in res.all()}

    async def get_rule(self, org_id: str, platform: str, category: str) -> M7ComplianceRule | None:
        return await self.session.scalar(
            select(M7ComplianceRule).where(
                M7ComplianceRule.org_id == org_id,
                M7ComplianceRule.platform == platform,
                M7ComplianceRule.category == category,
            )
        )

    async def list_rules(self, org_id: str) -> list[M7ComplianceRule]:
        res = await self.session.scalars(
            select(M7ComplianceRule)
            .where(M7ComplianceRule.org_id == org_id)
            .order_by(M7ComplianceRule.platform, M7ComplianceRule.category)
        )
        return list(res.all())

    async def list_certs(self, org_id: str, sku: str) -> list[M7CertRecord]:
        res = await self.session.scalars(
            select(M7CertRecord)
            .where(M7CertRecord.org_id == org_id, M7CertRecord.sku == sku)
            .order_by(M7CertRecord.cert_type)
        )
        return list(res.all())

    async def get_latest_check(
        self, org_id: str, sku: str, platform: str
    ) -> M7ComplianceCheck | None:
        return await self.session.scalar(
            select(M7ComplianceCheck)
            .where(
                M7ComplianceCheck.org_id == org_id,
                M7ComplianceCheck.sku == sku,
                M7ComplianceCheck.platform == platform,
            )
            .order_by(M7ComplianceCheck.created_at.desc())
            .limit(1)
        )

    async def get_active_approval(
        self, org_id: str, sku: str, platform: str
    ) -> M7ApprovalRecord | None:
        return await self.session.scalar(
            select(M7ApprovalRecord)
            .where(
                M7ApprovalRecord.org_id == org_id,
                M7ApprovalRecord.sku == sku,
                M7ApprovalRecord.platform == platform,
                M7ApprovalRecord.is_active.is_(True),
            )
            .order_by(M7ApprovalRecord.approved_at.desc())
            .limit(1)
        )

    async def invalidate_active_approvals(
        self, org_id: str, sku: str, platform: str | None, reason: str
    ) -> int:
        stmt = (
            update(M7ApprovalRecord)
            .where(
                M7ApprovalRecord.org_id == org_id,
                M7ApprovalRecord.sku == sku,
                M7ApprovalRecord.is_active.is_(True),
            )
            .values(is_active=False, invalidated_reason=reason)
        )
        if platform:
            stmt = stmt.where(M7ApprovalRecord.platform == platform)
        res = await self.session.execute(stmt)
        return res.rowcount or 0

    async def list_audit_events(
        self, org_id: str, sku: str | None = None, limit: int = 50
    ) -> list[CoreAuditEvent]:
        stmt = select(CoreAuditEvent).where(CoreAuditEvent.org_id == org_id)
        if sku:
            stmt = stmt.where(CoreAuditEvent.sku == sku)
        stmt = stmt.order_by(CoreAuditEvent.created_at.desc()).limit(min(limit, 200))
        res = await self.session.scalars(stmt)
        return list(res.all())
