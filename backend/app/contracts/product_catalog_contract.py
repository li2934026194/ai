from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProductFactSnapshot:
    """上游 M0-2 商品主档 + M4-3 选品终审只读快照（禁止 M7 反向写回或虚构参数）"""

    org_id: str
    sku: str
    name: str
    category: str
    category_label_zh: str
    platform: str
    sale_price_usd: float | None
    strike_price_usd: float | None
    origin: str  # M4_APPROVED | IN_STORE_REFRESH
    approver: str
    decision_reason: str
    specs: dict[str, str] = field(default_factory=dict)
    selling_points: list[str] = field(default_factory=list)
    brand_name: str = "CrossPilot Lab"


class ProductCatalogContract:
    """只读契约防腐层：V1 读取 mocks，生产可替换为 M0-2 / M4-3 只读视图"""

    def list_available_products(self, org_id: str) -> list[ProductFactSnapshot]:
        from app.mocks.seed_data import get_mock_products

        return get_mock_products(org_id)

    def get_product(self, org_id: str, sku: str) -> ProductFactSnapshot | None:
        for item in self.list_available_products(org_id):
            if item.sku == sku:
                return item
        return None
