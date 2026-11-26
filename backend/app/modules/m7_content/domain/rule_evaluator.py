from datetime import date
from typing import Any

from app.core.storage import FileStorage
from app.modules.m7_content.domain.iptc_handler import IptcMetadataHandler
from app.modules.m7_content.domain.lexicon_scanner import LexiconScanner
from app.modules.m7_content.models import (
    M7CertRecord,
    M7ComplianceRule,
    M7GenerationAsset,
    M7GenerationMedia,
)
from app.modules.m7_content.schemas import CORE_COPY_SLOTS, IMAGE_SLOTS


class RuleEvaluator:
    """M7-4 五项独立上架合规检查评估器（强制以服务端规则与真实磁盘文件为准）"""

    def __init__(self) -> None:
        self.scanner = LexiconScanner()
        self.iptc = IptcMetadataHandler()

    def evaluate_five_checks(
        self,
        *,
        rule: M7ComplianceRule,
        selected_assets: list[M7GenerationAsset],
        media_by_asset: dict[str, M7GenerationMedia],
        certs: list[M7CertRecord],
        storage: FileStorage,
        today: date | None = None,
    ) -> dict[str, Any]:
        cur_day = today or date.today()
        by_slot = {a.asset_slot: a for a in selected_assets}

        # 1. 文案合规与字符/字节校验（使用数据库持久化的服务端规则词库）
        copy_issues: list[str] = []
        soft_warnings: list[str] = []
        for slot in CORE_COPY_SLOTS:
            asset = by_slot.get(slot)
            if not asset:
                copy_issues.append(f"缺失核心文案 {slot}")
                continue
            text_val = self._extract_copy_text(asset)
            res = self.scanner.scan(
                text_val, slot=slot, rule=rule, platform=rule.platform
            )
            if res.all_caps_words:
                soft_warnings.append(f"{slot} 含全大写词（软提示）: {', '.join(res.all_caps_words)}")
            if not res.passed:
                reasons = []
                if res.ban_hits:
                    reasons.append(f"禁用词:{','.join(res.ban_hits)}")
                if res.trademark_hits:
                    reasons.append(f"商标词:{','.join(res.trademark_hits)}")
                if res.regulatory_hits:
                    reasons.append(f"监管词:{','.join(res.regulatory_hits)}")
                if res.over_len:
                    reasons.append(f"超限({res.utf8_bytes if res.limit_unit=='bytes' else res.char_count}>{res.max_limit}{res.limit_unit})")
                copy_issues.append(f"{slot}({'; '.join(reasons)})")
        chk_copy_passed = len(copy_issues) == 0

        # 2. 1+4 套图完整性与磁盘真实文件存在性
        img_issues: list[str] = []
        for slot in IMAGE_SLOTS:
            asset = by_slot.get(slot)
            if not asset:
                img_issues.append(f"缺失图位 {slot}")
                continue
            media = media_by_asset.get(asset.asset_id)
            if not media or not storage.exists(media.storage_key):
                img_issues.append(f"{slot} 无真实磁盘媒体文件")
        chk_img_passed = len(img_issues) == 0

        # 3. 磁盘级 IPTC/XMP 双标签真实读盘校验
        iptc_issues: list[str] = []
        for slot in IMAGE_SLOTS:
            asset = by_slot.get(slot)
            media = media_by_asset.get(asset.asset_id) if asset else None
            if not asset or not media or not storage.exists(media.storage_key):
                iptc_issues.append(f"{slot} 未就绪")
                continue
            ok, _ = self.iptc.verify_disk_file(
                storage, media.storage_key, ai_person_flag=media.ai_person_flag
            )
            if not ok:
                iptc_issues.append(
                    f"{slot} 磁盘缺失 {'contains-synthetic-performer/' if media.ai_person_flag else ''}trainedAlgorithmicMedia"
                )
        chk_iptc_passed = len(iptc_issues) == 0

        # 4. 类目必备资质与到期日核验（T-1 及更早过期阻断，T 及以后有效）
        required_certs: list[str] = list(rule.required_certs_json or [])
        cert_map = {c.cert_type: c for c in certs}
        cert_issues: list[str] = []
        cert_warnings: list[str] = []
        for ctype in required_certs:
            rec = cert_map.get(ctype)
            if not rec:
                cert_issues.append(f"缺少必备资质 {ctype}")
            elif rec.expire_date < cur_day:
                cert_issues.append(f"{ctype} 已于 {rec.expire_date.isoformat()} 过期")
            elif (rec.expire_date - cur_day).days <= 30:
                cert_warnings.append(f"{ctype} 将于 {rec.expire_date.isoformat()} 到期（临期预警）")
        chk_cert_passed = len(cert_issues) == 0

        # 5. 核心 8 项交付物完整度校验
        vid_asset = by_slot.get("vid_15s")
        vid_media = media_by_asset.get(vid_asset.asset_id) if vid_asset else None
        vid_ok = bool(vid_asset and vid_media and storage.exists(vid_media.storage_key))
        aplus_ok = "aplus_page" in by_slot
        img_main_ok = (
            "img_0" in by_slot
            and by_slot["img_0"].asset_id in media_by_asset
            and storage.exists(media_by_asset[by_slot["img_0"].asset_id].storage_key)
        )
        img_sub_ok = all(
            s in by_slot
            and by_slot[s].asset_id in media_by_asset
            and storage.exists(media_by_asset[by_slot[s].asset_id].storage_key)
            for s in ("img_1", "img_2", "img_3", "img_4")
        )
        copy_ok_flags = [s in by_slot for s in CORE_COPY_SLOTS]
        deliverable_count = (
            sum(1 for x in copy_ok_flags if x)
            + (1 if img_main_ok else 0)
            + (1 if img_sub_ok else 0)
            + (1 if aplus_ok else 0)
            + (1 if vid_ok else 0)
        )
        missing_deliv: list[str] = []
        for s in CORE_COPY_SLOTS:
            if s not in by_slot:
                missing_deliv.append(s)
        if not img_main_ok:
            missing_deliv.append("img_0(白底主图)")
        if not img_sub_ok:
            missing_deliv.append("img_1~4(4张附图)")
        if not aplus_ok:
            missing_deliv.append("aplus_page(A+长页)")
        if not vid_ok:
            missing_deliv.append("vid_15s(15秒短视频)")
        chk_deliv_passed = deliverable_count == 8

        checks = [
            {
                "code": "COPY_COMPLIANCE",
                "name": "1. 三层词库与平台字节/字符上限",
                "passed": chk_copy_passed,
                "detail": "全部核心文案合规达标" if chk_copy_passed else "；".join(copy_issues),
                "jump_route": "/m7/copy",
            },
            {
                "code": "IMAGES_1PLUS4",
                "name": "2. 1+4 电商套图完整性与磁盘文件",
                "passed": chk_img_passed,
                "detail": "5 张套图全部落盘就绪" if chk_img_passed else "；".join(img_issues),
                "jump_route": "/m7/images",
            },
            {
                "code": "IPTC_METADATA",
                "name": "3. 磁盘级 IPTC/XMP AI 来源标记读回",
                "passed": chk_iptc_passed,
                "detail": "磁盘真实读回 AI 合规声明完整" if chk_iptc_passed else "；".join(iptc_issues),
                "jump_route": "/m7/images",
            },
            {
                "code": "CERT_VALIDITY",
                "name": "4. 类目资质与站点授权有效期",
                "passed": chk_cert_passed,
                "detail": (
                    ("全部必备资质有效" + (f"（{'；'.join(cert_warnings)}）" if cert_warnings else ""))
                    if chk_cert_passed
                    else "；".join(cert_issues)
                ),
                "jump_route": "/m7/compliance",
            },
            {
                "code": "DELIVERABLES_8_OF_8",
                "name": "5. 核心 8/8 交付清单完整度",
                "passed": chk_deliv_passed,
                "detail": "8/8 核心资产齐备" if chk_deliv_passed else f"尚缺 ({deliverable_count}/8): {', '.join(missing_deliv)}",
                "jump_route": self._guess_first_missing_route(missing_deliv),
            },
        ]
        return {
            "checks": checks,
            "deliverable_count": deliverable_count,
            "overall_pass": all(c["passed"] for c in checks),
            "warnings": [*cert_warnings, *soft_warnings],
        }

    @staticmethod
    def _extract_copy_text(asset: M7GenerationAsset) -> str:
        c = asset.content_json or {}
        if isinstance(c.get("text"), str):
            return c["text"]
        if isinstance(c.get("bullets"), list):
            return "\n".join(str(x) for x in c["bullets"])
        return str(c)

    @staticmethod
    def _guess_first_missing_route(missing: list[str]) -> str:
        if not missing:
            return "/m7/compliance"
        first = missing[0]
        if first.startswith("copy_"):
            return "/m7/copy"
        if first.startswith("img_"):
            return "/m7/images"
        if first.startswith("vid_") or first.startswith("aplus_"):
            return "/m7/video-aplus"
        return "/m7/compliance"
