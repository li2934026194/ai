from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator


PlatformCode = Literal["amazon_us", "shopee_th", "tiktok_us"]
CategoryCode = Literal["kitchen_appliance", "bags_travel", "3c_accessories", "beauty_skincare"]

CORE_COPY_SLOTS: tuple[str, ...] = ("copy_title", "copy_bullets", "copy_desc", "copy_kw")
EXT_COPY_SLOTS: tuple[str, ...] = (
    "copy_faq",
    "copy_aplus_txt",
    "copy_variant",
    "copy_attr",
    "copy_alt",
    "copy_warranty",
)
IMAGE_SLOTS: tuple[str, ...] = ("img_0", "img_1", "img_2", "img_3", "img_4")
VIDEO_APLUS_SLOTS: tuple[str, ...] = ("vid_15s", "aplus_page")
ALL_ASSET_SLOTS: tuple[str, ...] = (
    *CORE_COPY_SLOTS,
    *EXT_COPY_SLOTS,
    *IMAGE_SLOTS,
    *VIDEO_APLUS_SLOTS,
)

AssetSlotLiteral = Literal[
    "copy_title",
    "copy_bullets",
    "copy_desc",
    "copy_kw",
    "copy_faq",
    "copy_aplus_txt",
    "copy_variant",
    "copy_attr",
    "copy_alt",
    "copy_warranty",
    "img_0",
    "img_1",
    "img_2",
    "img_3",
    "img_4",
    "vid_15s",
    "aplus_page",
]

PLATFORM_ALIASES: dict[str, PlatformCode] = {
    "amazon_us": "amazon_us",
    "amazon us": "amazon_us",
    "amazon": "amazon_us",
    "亚马逊美站": "amazon_us",
    "shopee_th": "shopee_th",
    "shopee th": "shopee_th",
    "shopee": "shopee_th",
    "shopee 泰国": "shopee_th",
    "tiktok_us": "tiktok_us",
    "tiktok us": "tiktok_us",
    "tiktok": "tiktok_us",
    "tiktok shop 美区": "tiktok_us",
}

CATEGORY_ALIASES: dict[str, CategoryCode] = {
    "kitchen_appliance": "kitchen_appliance",
    "厨卫小电": "kitchen_appliance",
    "居家小电": "kitchen_appliance",
    "家居收纳": "kitchen_appliance",
    "bags_travel": "bags_travel",
    "箱包出行": "bags_travel",
    "3c_accessories": "3c_accessories",
    "3c数码": "3c_accessories",
    "3c配件": "3c_accessories",
    "beauty_skincare": "beauty_skincare",
    "美妆个护": "beauty_skincare",
}


def normalize_platform(raw: str) -> PlatformCode:
    key = (raw or "").strip().lower()
    if key in PLATFORM_ALIASES:
        return PLATFORM_ALIASES[key]
    raise ValueError(f"不支持的站点枚举: {raw}")


def normalize_category(raw: str) -> CategoryCode:
    key = (raw or "").strip().lower()
    if key in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[key]
    return "kitchen_appliance"


class ApiEnvelope(BaseModel):
    code: str = "OK"
    message: str = "成功"
    trace_id: str = ""
    data: Any = None


class AuditEventOut(BaseModel):
    event_id: str
    org_id: str
    sku: str | None = None
    module: str
    action: str
    actor_id: str
    actor_role: str
    ok: bool
    sentence_zh: str
    payload_json: dict[str, Any] = Field(default_factory=dict)
    trace_id: str
    created_at: str


# ---------- M7-1 文案 DTO ----------
class CopyGenerateReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    platform: str = "amazon_us"
    lang: str = "en-US"
    asset_slot: AssetSlotLiteral = "copy_title"
    extra_must: list[str] = Field(default_factory=list)
    extra_ban: list[str] = Field(default_factory=list)

    @field_validator("platform")
    @classmethod
    def _norm_plat(cls, v: str) -> PlatformCode:
        return normalize_platform(v)


class CopyScanReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    platform: str = "amazon_us"
    category: str = "kitchen_appliance"
    asset_slot: AssetSlotLiteral = "copy_title"
    text: str = ""
    extra_must: list[str] = Field(default_factory=list)
    extra_ban: list[str] = Field(default_factory=list)

    @field_validator("platform")
    @classmethod
    def _norm_plat(cls, v: str) -> PlatformCode:
        return normalize_platform(v)

    @field_validator("category")
    @classmethod
    def _norm_cat(cls, v: str) -> CategoryCode:
        return normalize_category(v)


class CopyEditReq(BaseModel):
    text: str
    version: int = Field(..., ge=1)
    extra_must: list[str] = Field(default_factory=list)
    extra_ban: list[str] = Field(default_factory=list)


# ---------- M7-2 套图 DTO ----------
class ImageBatchReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    platform: str = "amazon_us"
    style: str = "Studio Minimalist"
    aspect: Literal["1:1", "4:5", "3:4", "16:9"] = "1:1"
    avoid_terms: list[str] = Field(default_factory=lambda: ["watermark", "extra accessories"])
    ai_person_slots: list[int] = Field(default_factory=list)
    slot_notes: dict[str, str] = Field(default_factory=dict)

    @field_validator("platform")
    @classmethod
    def _norm_plat(cls, v: str) -> PlatformCode:
        return normalize_platform(v)


class ImageSlotActionReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    platform: str = "amazon_us"
    style: str = "Studio Minimalist"
    aspect: Literal["1:1", "4:5", "3:4", "16:9"] = "1:1"
    instruction: str = ""
    ai_person_flag: bool = False

    @field_validator("platform")
    @classmethod
    def _norm_plat(cls, v: str) -> PlatformCode:
        return normalize_platform(v)


class IptcVerifyReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    platform: str = "amazon_us"
    mode: Literal["verify", "simulate_strip", "rewrite"] = "verify"
    slot_idx: int | None = Field(default=None, ge=0, le=4)

    @field_validator("platform")
    @classmethod
    def _norm_plat(cls, v: str) -> PlatformCode:
        return normalize_platform(v)


# ---------- M7-3 视频与 A+ DTO ----------
class VideoSegmentInput(BaseModel):
    seg_idx: int = Field(..., ge=0, le=2)
    title: str = ""
    slot_idx: int = Field(default=0, ge=0, le=4)
    duration_sec: float = Field(default=5.0, ge=2.0, le=10.0)
    motion: str = "zoom_in"
    sub_en: str = ""
    sub_cn: str = ""


class VideoGenerateReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    platform: str = "amazon_us"
    script_style: str = "产品展示"
    voice_over: str = "女声"
    bgm: str = "Upbeat Acoustic"
    use_m7_copy: bool = True
    segments: list[VideoSegmentInput] = Field(default_factory=list)

    @field_validator("platform")
    @classmethod
    def _norm_plat(cls, v: str) -> PlatformCode:
        return normalize_platform(v)


class VideoSegmentEditReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    platform: str = "amazon_us"
    version: int = Field(..., ge=1)
    slot_idx: int | None = Field(default=None, ge=0, le=4)
    motion: str | None = None
    sub_en: str | None = None
    sub_cn: str | None = None

    @field_validator("platform")
    @classmethod
    def _norm_plat(cls, v: str) -> PlatformCode:
        return normalize_platform(v)


class AplusGenerateReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    platform: str = "amazon_us"
    theme: str = "Clean Modern"

    @field_validator("platform")
    @classmethod
    def _norm_plat(cls, v: str) -> PlatformCode:
        return normalize_platform(v)


# ---------- M7-4 合规、资质与审批 DTO ----------
class RuleMatrixUpdateReq(BaseModel):
    title_max_chars: int = Field(..., ge=40, le=500)
    bullet_max_chars: int = Field(..., ge=50, le=1500)
    search_terms_max_bytes: int = Field(..., ge=50, le=1000)
    lexicon_json: dict[str, list[str]]
    required_certs_json: list[str]
    image_policy_json: dict[str, Any] = Field(default_factory=dict)


class CertRenewReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    cert_type: str = Field(..., min_length=1, max_length=64)
    cert_no: str = Field(..., min_length=1, max_length=128)
    expire_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")


class ComplianceCheckReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    platform: str = "amazon_us"

    @field_validator("platform")
    @classmethod
    def _norm_plat(cls, v: str) -> PlatformCode:
        return normalize_platform(v)


class PackageApproveReq(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    platform: str = "amazon_us"
    decision: Literal["APPROVED", "REJECTED"] = "APPROVED"
    note: str = ""

    @field_validator("platform")
    @classmethod
    def _norm_plat(cls, v: str) -> PlatformCode:
        return normalize_platform(v)
