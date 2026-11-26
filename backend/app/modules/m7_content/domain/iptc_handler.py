import io
from PIL import Image, PngImagePlugin

from app.core.exceptions import M7Error
from app.core.storage import FileStorage


DIGITAL_SOURCE_TAG = "trainedAlgorithmicMedia"
SYNTHETIC_PERFORMER_TAG = "contains-synthetic-performer"
IPTC_DIGITAL_SOURCE_URL = (
    "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
)


def _build_xmp_packet(ai_person_flag: bool) -> bytes:
    synth_xml = (
        f"<crosspilot:SyntheticPerformer>{SYNTHETIC_PERFORMER_TAG}</crosspilot:SyntheticPerformer>"
        if ai_person_flag
        else ""
    )
    xml = (
        '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/">'
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"'
        ' xmlns:iptcExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"'
        ' xmlns:crosspilot="https://crosspilot.local/ns/1.0/">'
        '<rdf:Description rdf:about="">'
        f"<iptcExt:DigitalSourceType>{IPTC_DIGITAL_SOURCE_URL}</iptcExt:DigitalSourceType>"
        f"<crosspilot:DigitalSourceTag>{DIGITAL_SOURCE_TAG}</crosspilot:DigitalSourceTag>"
        f"{synth_xml}"
        "</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end=\"w\"?>"
    )
    return xml.encode("utf-8")


class IptcMetadataHandler:
    """末端写入并真实打开磁盘图片读回 IPTC/XMP AI 合规声明"""

    def embed_tags(self, image_bytes: bytes, *, ai_person_flag: bool = False) -> bytes:
        with Image.open(io.BytesIO(image_bytes)) as img:
            fmt = (img.format or "PNG").upper()
            out = io.BytesIO()
            xmp_bytes = _build_xmp_packet(ai_person_flag)

            if fmt == "PNG":
                pnginfo = PngImagePlugin.PngInfo()
                pnginfo.add_text("DigitalSourceType", IPTC_DIGITAL_SOURCE_URL)
                pnginfo.add_text("IPTC:DigitalSourceType", DIGITAL_SOURCE_TAG)
                pnginfo.add_text("XML:com.adobe.xmp", xmp_bytes.decode("utf-8"))
                if ai_person_flag:
                    pnginfo.add_text("CrossPilot:Performer", SYNTHETIC_PERFORMER_TAG)
                img.convert("RGB").save(out, format="PNG", pnginfo=pnginfo)
                return out.getvalue()

            # JPEG / WEBP：写入 APP1 XMP + COMMENT 标记
            comment = f"{DIGITAL_SOURCE_TAG}" + (
                f";{SYNTHETIC_PERFORMER_TAG}" if ai_person_flag else ""
            )
            rgb = img.convert("RGB")
            rgb.save(out, format="JPEG", quality=92, comment=comment.encode("utf-8"))
            raw_jpg = out.getvalue()
            # 注入标准 Adobe XMP APP1 段（在 SOI 之后）
            xmp_header = b"http://ns.adobe.com/xap/1.0/\x00" + xmp_bytes
            app1_len = len(xmp_header) + 2
            app1_seg = b"\xff\xe1" + app1_len.to_bytes(2, "big") + xmp_header
            return raw_jpg[:2] + app1_seg + raw_jpg[2:]

    def read_tags(self, image_bytes: bytes) -> dict[str, str]:
        tags: dict[str, str] = {}
        with Image.open(io.BytesIO(image_bytes)) as img:
            for k, v in (img.info or {}).items():
                if isinstance(v, (str, bytes)):
                    s = v.decode("utf-8", errors="ignore") if isinstance(v, bytes) else v
                    tags[str(k)] = s
        raw_text = image_bytes.decode("latin-1", errors="ignore")
        if DIGITAL_SOURCE_TAG in raw_text:
            tags["detected_digital_source"] = DIGITAL_SOURCE_TAG
        if SYNTHETIC_PERFORMER_TAG in raw_text:
            tags["detected_synthetic_performer"] = SYNTHETIC_PERFORMER_TAG
        return tags

    def verify_bytes(
        self, image_bytes: bytes, *, ai_person_flag: bool = False
    ) -> tuple[bool, dict[str, str]]:
        tags = self.read_tags(image_bytes)
        joined = "\n".join(tags.values())
        has_ai = DIGITAL_SOURCE_TAG in joined
        has_person = (not ai_person_flag) or (SYNTHETIC_PERFORMER_TAG in joined)
        return bool(has_ai and has_person), {
            "has_trainedAlgorithmicMedia": str(has_ai),
            "has_contains_synthetic_performer": str(SYNTHETIC_PERFORMER_TAG in joined),
            "ai_person_required": str(ai_person_flag),
        }

    def verify_disk_file(
        self, storage: FileStorage, storage_key: str, *, ai_person_flag: bool = False
    ) -> tuple[bool, dict[str, str]]:
        raw = storage.read_bytes(storage_key)
        return self.verify_bytes(raw, ai_person_flag=ai_person_flag)

    def strip_tags_for_simulation(self, storage: FileStorage, storage_key: str) -> tuple[int, str]:
        """模拟图床裁剪/转码剥离元数据：仅重存像素并落盘"""
        raw = storage.read_bytes(storage_key)
        with Image.open(io.BytesIO(raw)) as img:
            clean = Image.new(img.mode, img.size)
            clean.putdata(list(img.getdata()))
            out = io.BytesIO()
            fmt = (img.format or "PNG").upper()
            clean.save(out, format="PNG" if fmt == "PNG" else "JPEG")
        _, size, sha = storage.save_bytes(
            storage_key, out.getvalue(), allowed_mimes={"image/png", "image/jpeg"}
        )
        return size, sha

    def rewrite_disk_file(
        self, storage: FileStorage, storage_key: str, *, ai_person_flag: bool = False
    ) -> tuple[str, int, str, dict[str, str]]:
        raw = storage.read_bytes(storage_key)
        patched = self.embed_tags(raw, ai_person_flag=ai_person_flag)
        mime, size, sha = storage.save_bytes(
            storage_key, patched, allowed_mimes={"image/png", "image/jpeg"}
        )
        ok, info = self.verify_bytes(patched, ai_person_flag=ai_person_flag)
        if not ok:
            raise M7Error("M7-4242", "IPTC/XMP 重新写入后磁盘读回校验仍失败", http_status=424)
        return mime, size, sha, info
