from datetime import date, timedelta
import io
from pathlib import Path
from PIL import Image
import pytest

from app.contracts.product_catalog_contract import ProductCatalogContract
from app.contracts.voice_faq_contract import VoiceFaqContract
from app.core.config import get_settings
from app.core.exceptions import M7Error
from app.core.storage import FileStorage
from app.modules.m7_content.adapters.cloud_api_adapter import CloudApiAdapter
from app.modules.m7_content.adapters.local_media_adapter import LocalMediaAdapter
from app.modules.m7_content.domain.iptc_handler import (
    DIGITAL_SOURCE_TAG,
    SYNTHETIC_PERFORMER_TAG,
    IptcMetadataHandler,
)
from app.modules.m7_content.domain.lexicon_scanner import LexiconScanner
from app.modules.m7_content.domain.rule_evaluator import RuleEvaluator
from app.modules.m7_content.models import (
    M7CertRecord,
    M7ComplianceRule,
    M7GenerationAsset,
    M7GenerationMedia,
)
from app.modules.m7_content.schemas import CORE_COPY_SLOTS, IMAGE_SLOTS


def _make_rule(platform="amazon_us") -> M7ComplianceRule:
    return M7ComplianceRule(
        rule_id="rule_test",
        org_id="org_demo",
        platform=platform,
        category="kitchen_appliance",
        rule_version="2026.11",
        effective_date=date.today(),
        title_max_chars={"amazon_us": 200, "tiktok_us": 150, "shopee_th": 120}[platform],
        bullet_max_chars=500,
        search_terms_max_bytes=250,
        lexicon_json={
            "must": ["CrossPilot Lab", "BPA-Free"],
            "ban": ["100% Best", "Free Gift"],
            "trademark": ["Velcro", "Dyson"],
            "regulatory": ["Waterproof", "FDA Approved"],
        },
        required_certs_json=["UL", "FCC"],
        image_policy_json={},
        updated_by="approver",
    )


def test_lexicon_scanner_layers_caps_and_utf8_bytes():
    scanner = LexiconScanner()
    rule = _make_rule("amazon_us")

    ok_res = scanner.scan(
        "CrossPilot Lab USBC USB-C Mini Sealer BPA-Free Compact Kitchen Tool",
        slot="copy_title",
        rule=rule,
        platform="amazon_us",
    )
    assert ok_res.passed is True
    assert "CrossPilot Lab" in ok_res.must_hits
    assert ok_res.all_caps_words == []

    # ALL CAPS（如 AMAZING/SAVE）仅黄色软提示，不阻断保存（TC-FN-10）
    caps_res = scanner.scan(
        "CrossPilot Lab AMAZING SAVE BPA-Free Sealer",
        slot="copy_title",
        rule=rule,
        platform="amazon_us",
    )
    assert caps_res.passed is True
    assert set(caps_res.all_caps_words) == {"AMAZING", "SAVE"}

    # 违禁词/商标/监管词与改写建议（硬阻断）
    bad_res = scanner.scan(
        "AMAZING Velcro Waterproof FDA Approved 100% Best Sealer",
        slot="copy_title",
        rule=rule,
        platform="amazon_us",
    )
    assert bad_res.passed is False
    assert "100% Best" in bad_res.ban_hits
    assert "Velcro" in bad_res.trademark_hits
    assert "Waterproof" in bad_res.regulatory_hits
    assert "AMAZING" in bad_res.all_caps_words
    assert bad_res.suggestions.get("Velcro") == "hook and loop"
    assert bad_res.suggestions.get("Waterproof") == "Water-resistant"

    # 标题按字符数（200 字符通过，201 超限）
    assert scanner.scan("a" * 200, slot="copy_title", rule=rule).over_len is False
    assert scanner.scan("a" * 201, slot="copy_title", rule=rule).over_len is True

    # 搜索词按 UTF-8 真实字节数（83 个中文=249 字节通过；84 个中文=252 字节超限）
    kw_ok = scanner.scan("厨" * 83, slot="copy_kw", rule=rule)
    assert kw_ok.utf8_bytes == 249
    assert kw_ok.over_len is False
    kw_over = scanner.scan("厨" * 84, slot="copy_kw", rule=rule)
    assert kw_over.utf8_bytes == 252
    assert kw_over.over_len is True
    assert kw_over.passed is False


def test_iptc_embed_verify_strip_and_rewrite(tmp_path: Path):
    storage = FileStorage(tmp_path)
    handler = IptcMetadataHandler()

    # PNG（含 AI 真人出镜标记）
    buf = io.BytesIO()
    Image.new("RGB", (200, 200), (255, 255, 255)).save(buf, format="PNG")
    tagged = handler.embed_tags(buf.getvalue(), ai_person_flag=True)
    key = "orgs/org_demo/SKU-00704/img_1.png"
    storage.save_bytes(key, tagged, allowed_mimes={"image/png"})

    ok, tags = handler.verify_disk_file(storage, key, ai_person_flag=True)
    assert ok is True
    assert tags["has_trainedAlgorithmicMedia"] == "True"
    assert tags["has_contains_synthetic_performer"] == "True"

    # 模拟裁剪/转码剥离元数据
    handler.strip_tags_for_simulation(storage, key)
    ok_after_strip, _ = handler.verify_disk_file(storage, key, ai_person_flag=True)
    assert ok_after_strip is False

    # 重新写入并读回验证通过
    _, _, _, info = handler.rewrite_disk_file(storage, key, ai_person_flag=True)
    assert info["has_trainedAlgorithmicMedia"] == "True"
    assert info["has_contains_synthetic_performer"] == "True"

    # JPEG 链路校验
    jbuf = io.BytesIO()
    Image.new("RGB", (120, 120), (240, 240, 240)).save(jbuf, format="JPEG")
    j_tagged = handler.embed_tags(jbuf.getvalue(), ai_person_flag=False)
    ok_j, tags_j = handler.verify_bytes(j_tagged, ai_person_flag=False)
    assert ok_j is True
    assert DIGITAL_SOURCE_TAG in str(tags_j)


def test_rule_evaluator_5_checks_and_cert_boundaries(tmp_path: Path):
    storage = FileStorage(tmp_path)
    handler = IptcMetadataHandler()
    evaluator = RuleEvaluator()
    rule = _make_rule("amazon_us")

    assets: list[M7GenerationAsset] = []
    media_map: dict[str, M7GenerationMedia] = {}

    copy_texts = {
        "copy_title": "CrossPilot Lab BPA-Free Mini Vacuum Sealer",
        "copy_bullets": "CrossPilot Lab compact USB-C sealer\nBPA-Free seal strip",
        "copy_desc": "CrossPilot Lab BPA-Free portable kitchen sealer.",
        "copy_kw": "mini sealer kitchen storage usb-c",
    }
    for slot in CORE_COPY_SLOTS:
        assets.append(
            M7GenerationAsset(
                asset_id=f"as_{slot}",
                org_id="org_demo",
                sku="SKU-00704",
                job_id="job_1",
                asset_slot=slot,
                platform="amazon_us",
                is_selected=True,
                content_json={"text": copy_texts[slot]},
                orig_content_json={"text": copy_texts[slot]},
                last_edited_by="u-lin",
            )
        )

    for idx, slot in enumerate(IMAGE_SLOTS):
        buf = io.BytesIO()
        Image.new("RGB", (300, 300), (255, 255, 255)).save(buf, format="PNG")
        raw = handler.embed_tags(buf.getvalue(), ai_person_flag=(idx == 1))
        key = f"orgs/org_demo/SKU-00704/{slot}.png"
        mime, size, sha = storage.save_bytes(key, raw, allowed_mimes={"image/png"})
        aid = f"as_{slot}"
        assets.append(
            M7GenerationAsset(
                asset_id=aid,
                org_id="org_demo",
                sku="SKU-00704",
                job_id="job_1",
                asset_slot=slot,
                platform="amazon_us",
                is_selected=True,
                content_json={"slot_idx": idx},
                orig_content_json={"slot_idx": idx},
                last_edited_by="u-lin",
            )
        )
        media_map[aid] = M7GenerationMedia(
            media_id=f"med_{slot}",
            org_id="org_demo",
            asset_id=aid,
            media_kind="IMAGE",
            mime_type=mime,
            file_size=size,
            sha256=sha,
            storage_key=key,
            ai_person_flag=(idx == 1),
            iptc_verified=True,
        )

    # A+ 与 15s 视频
    assets.append(
        M7GenerationAsset(
            asset_id="as_aplus",
            org_id="org_demo",
            sku="SKU-00704",
            job_id="job_1",
            asset_slot="aplus_page",
            platform="amazon_us",
            is_selected=True,
            content_json={"html": "<section>ok</section>"},
            orig_content_json={"html": "<section>ok</section>"},
            last_edited_by="u-lin",
        )
    )
    vid_key = "orgs/org_demo/SKU-00704/vid_15s.mp4"
    vmime, vsize, vsha = storage.save_bytes(
        vid_key, b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42", allowed_mimes={"video/mp4"}
    )
    assets.append(
        M7GenerationAsset(
            asset_id="as_vid",
            org_id="org_demo",
            sku="SKU-00704",
            job_id="job_1",
            asset_slot="vid_15s",
            platform="amazon_us",
            is_selected=True,
            content_json={"segments": []},
            orig_content_json={"segments": []},
            last_edited_by="u-lin",
        )
    )
    media_map["as_vid"] = M7GenerationMedia(
        media_id="med_vid",
        org_id="org_demo",
        asset_id="as_vid",
        media_kind="VIDEO",
        mime_type=vmime,
        file_size=vsize,
        sha256=vsha,
        storage_key=vid_key,
    )

    today = date.today()
    # 边界：T 当天到期与 T+1 明天到期均有效（带临期预警）
    certs_ok = [
        M7CertRecord(cert_id="c1", org_id="org_demo", sku="SKU-00704", cert_type="UL", cert_no="UL1", expire_date=today),
        M7CertRecord(cert_id="c2", org_id="org_demo", sku="SKU-00704", cert_type="FCC", cert_no="FCC1", expire_date=today + timedelta(days=1)),
    ]
    res_ok = evaluator.evaluate_five_checks(
        rule=rule, selected_assets=assets, media_by_asset=media_map, certs=certs_ok, storage=storage, today=today
    )
    assert res_ok["overall_pass"] is True
    assert res_ok["deliverable_count"] == 8
    assert len(res_ok["warnings"]) == 2

    # 边界：T-1 昨天过期必须阻断
    certs_expired = [
        M7CertRecord(cert_id="c1", org_id="org_demo", sku="SKU-00704", cert_type="UL", cert_no="UL1", expire_date=today - timedelta(days=1)),
        certs_ok[1],
    ]
    res_exp = evaluator.evaluate_five_checks(
        rule=rule, selected_assets=assets, media_by_asset=media_map, certs=certs_expired, storage=storage, today=today
    )
    assert res_exp["overall_pass"] is False
    cert_chk = next(c for c in res_exp["checks"] if c["code"] == "CERT_VALIDITY")
    assert cert_chk["passed"] is False


async def test_cloud_fallback_and_video_503_hard_gate(monkeypatch: pytest.MonkeyPatch):
    product = ProductCatalogContract().get_product("org_demo", "SKU-00704")
    faq = VoiceFaqContract().get_faq_for_sku("org_demo", "SKU-00704")
    assert product is not None

    monkeypatch.setenv("DASHSCOPE_API_KEY", "")
    monkeypatch.setenv("VIDEO_ENGINE_ENABLED", "false")
    get_settings.cache_clear()

    adapter = CloudApiAdapter()
    variants = await adapter.generate_copy_variants(
        product, faq, slot="copy_title", platform="amazon_us", lang="en-US", must_terms=["CrossPilot Lab"]
    )
    assert len(variants) == 3

    img_main = await adapter.generate_slot_image(
        product,
        slot_idx=0,
        style="Minimalist",
        aspect="1:1",
        avoid_terms=["watermark"],
        selling_points=product.selling_points,
        ai_person_flag=False,
    )
    assert img_main.width == 1000 and img_main.height == 1000
    with Image.open(io.BytesIO(img_main.image_bytes)) as im:
        assert im.getpixel((5, 5)) == (255, 255, 255)  # 白底主图纯白确认

    ok_iptc, _ = IptcMetadataHandler().verify_bytes(img_main.image_bytes, ai_person_flag=False)
    assert ok_iptc is True

    # 视频引擎未开启或无 FFmpeg 必须抛 503 M7-5031
    local = LocalMediaAdapter()
    with pytest.raises(M7Error) as e_vid:
        await local.synthesize_15s_video(
            sku="SKU-00704",
            segments=[{"slot_idx": 0, "duration_sec": 5}],
            slot_image_bytes={0: img_main.image_bytes},
        )
    assert e_vid.value.http_status == 503
    assert e_vid.value.code == "M7-5031"
    get_settings.cache_clear()
