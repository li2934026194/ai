from dataclasses import dataclass
from fastapi import Path


@dataclass(frozen=True)
class OrgContext:
    org_id: str


async def get_org_context(
    org_id: str = Path(..., min_length=1, max_length=64, description="组织租户 ID"),
) -> OrgContext:
    return OrgContext(org_id=org_id.strip())
