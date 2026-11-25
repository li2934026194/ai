from dataclasses import dataclass, field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


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
    """只读契约防腐层：优先读取 M0-2 / M4-3 真实数据库视图，兼容离线 mock 快照。"""

    def list_available_products(self, org_id: str) -> list[ProductFactSnapshot]:
        from app.mocks.seed_data import get_mock_products

        return get_mock_products(org_id)

    def get_product(self, org_id: str, sku: str) -> ProductFactSnapshot | None:
        for item in self.list_available_products(org_id):
            if item.sku == sku:
                return item
        return None

    async def alist_available_products(self, session: AsyncSession, org_id: str) -> list[ProductFactSnapshot]:
        from app.modules.m0_catalog.models import M0Product

        mock_by_sku = {m.sku: m for m in self.list_available_products(org_id)}
        rows = (
            await session.scalars(
                select(M0Product).where(M0Product.org_id == org_id).order_by(M0Product.sku)
            )
        ).all()
        if not rows:
            return list(mock_by_sku.values())

        snapshots: list[ProductFactSnapshot] = []
        for p in rows:
            m = mock_by_sku.get(p.sku)
            snapshots.append(
                ProductFactSnapshot(
                    org_id=org_id,
                    sku=p.sku,
                    name=p.name,
                    category=p.category or (m.category if m else "3c_accessories"),
                    category_label_zh=p.category_label_zh or (m.category_label_zh if m else "3C数码"),
                    platform=p.platform or (m.platform if m else "amazon_us"),
                    sale_price_usd=float(p.sale_price_usd) if p.sale_price_usd else (m.sale_price_usd if m else 24.9),
                    strike_price_usd=p.strike_price_usd if p.strike_price_usd is not None else (m.strike_price_usd if m else None),
                    origin=p.origin or (m.origin if m else "M4_APPROVED"),
                    approver=p.approver or (m.approver if m else "陈主管"),
                    decision_reason=p.decision_reason or (m.decision_reason if m else "M0/M4 同步主档"),
                    specs=p.specs_json or (m.specs if m else {}),
                    selling_points=p.selling_points_json or (m.selling_points if m else []),
                    brand_name=p.brand_name or "CrossPilot Lab",
                )
            )
        return snapshots

    async def aget_product(self, session: AsyncSession, org_id: str, sku: str) -> ProductFactSnapshot | None:
        for item in await self.alist_available_products(session, org_id):
            if item.sku == sku:
                return item
        return self.get_product(org_id, sku)
