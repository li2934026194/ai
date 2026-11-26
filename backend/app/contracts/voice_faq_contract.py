from dataclasses import dataclass, field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class VoiceFaqSnapshot:
    """上游 M1-2 客服知识库高频痛点与 FAQ 只读快照"""

    org_id: str
    sku: str
    pain_points: list[str] = field(default_factory=list)
    faq_pairs: list[dict[str, str]] = field(default_factory=list)


class VoiceFaqContract:
    def get_faq_for_sku(self, org_id: str, sku: str) -> VoiceFaqSnapshot:
        from app.mocks.seed_data import get_mock_faq

        return get_mock_faq(org_id, sku)

    async def aget_faq_for_sku(self, session: AsyncSession, org_id: str, sku: str) -> VoiceFaqSnapshot:
        from app.modules.m1_cs.models import M1FaqEntry

        row = await session.scalar(
            select(M1FaqEntry).where(M1FaqEntry.org_id == org_id, M1FaqEntry.sku == sku)
        )
        if row:
            return VoiceFaqSnapshot(
                org_id=org_id,
                sku=sku,
                pain_points=row.pain_points_json or [],
                faq_pairs=row.faq_pairs_json or [],
            )
        return self.get_faq_for_sku(org_id, sku)
