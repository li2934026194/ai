import hashlib
from pathlib import Path
from app.core.config import get_settings
from app.core.exceptions import M7Error


def detect_magic_mime(data: bytes) -> str | None:
    if len(data) < 8:
        return None
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return "video/mp4"
    if data[:2] == b"PK":
        return "application/zip"
    stripped = data.lstrip()
    if stripped.startswith(b"<!DOCTYPE html") or stripped.startswith(b"<html"):
        return "text/html"
    return None


class FileStorage:
    """本地磁盘存储抽象（V1 落盘真实二进制媒体与离线交付包）"""

    def __init__(self, root: Path | None = None) -> None:
        self.root = (root or get_settings().storage_path).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def resolve_safe(self, storage_key: str) -> Path:
        clean_key = storage_key.lstrip("/").replace("\\", "/")
        target = (self.root / clean_key).resolve()
        if not str(target).startswith(str(self.root)):
            raise M7Error("M7-4001", "非法的存储路径 key", http_status=400)
        return target

    def save_bytes(
        self,
        storage_key: str,
        data: bytes,
        *,
        allowed_mimes: set[str] | None = None,
    ) -> tuple[str, int, str]:
        if not data:
            raise M7Error("M7-4241", "拒绝写入 0 字节空文件", http_status=424)
        detected = detect_magic_mime(data)
        if allowed_mimes is not None and detected not in allowed_mimes:
            raise M7Error(
                "M7-4241",
                f"文件魔数 MIME 校验失败：检测到 {detected or 'unknown'}，不允许落盘",
                http_status=424,
            )
        target = self.resolve_safe(storage_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        sha256 = hashlib.sha256(data).hexdigest()
        return detected or "application/octet-stream", len(data), sha256

    def read_bytes(self, storage_key: str) -> bytes:
        target = self.resolve_safe(storage_key)
        if not target.exists() or not target.is_file():
            raise M7Error("M7-4041", f"磁盘媒体文件不存在: {storage_key}", http_status=404)
        return target.read_bytes()

    def exists(self, storage_key: str) -> bool:
        target = self.resolve_safe(storage_key)
        return target.exists() and target.is_file() and target.stat().st_size > 0
