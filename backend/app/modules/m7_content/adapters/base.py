from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.contracts.product_catalog_contract import ProductFactSnapshot
from app.contracts.voice_faq_contract import VoiceFaqSnapshot


@dataclass
class CopyVariant:
    variant_idx: int
    style_label: str
    content: dict[str, Any]


@dataclass
class GeneratedImageSlot:
    slot_idx: int
    slot_name: str
    image_bytes: bytes
    width: int
    height: int
    prompt_used: str
    ai_person_flag: bool = False
    engine_mode: str = "pillow_fallback"


@dataclass
class GeneratedVideoResult:
    video_bytes: bytes
    width: int
    height: int
    duration_sec: float
    segments: list[dict[str, Any]] = field(default_factory=list)


class GeneratorAdapter(ABC):
    @abstractmethod
    async def generate_copy_variants(
        self,
        product: ProductFactSnapshot,
        faq: VoiceFaqSnapshot,
        *,
        slot: str,
        platform: str,
        lang: str,
        must_terms: list[str],
    ) -> list[CopyVariant]:
        ...

    @abstractmethod
    async def generate_slot_image(
        self,
        product: ProductFactSnapshot,
        *,
        slot_idx: int,
        style: str,
        aspect: str,
        avoid_terms: list[str],
        selling_points: list[str],
        custom_instruction: str = "",
        ai_person_flag: bool = False,
    ) -> GeneratedImageSlot:
        ...
