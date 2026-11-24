from dataclasses import dataclass, field


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
