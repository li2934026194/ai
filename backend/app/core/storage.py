import hashlib
import io
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
    """统一对象/文件存储抽象：支持 MinIO 对象存储与本地磁盘回退（对齐 V1.1 架构）"""

    def __init__(self, root: Path | None = None) -> None:
        self._explicit_local = root is not None
        self.settings = get_settings()
        self.root = (root or self.settings.storage_path).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self._minio_client = None
        if not self._explicit_local and self.settings.MINIO_ENDPOINT and self.settings.STORAGE_BACKEND in {"auto", "minio"}:
            self._minio_client = self._try_init_minio()

    def _try_init_minio(self):
        try:
            from minio import Minio  # type: ignore

            client = Minio(
                self.settings.MINIO_ENDPOINT,
                access_key=self.settings.MINIO_ACCESS_KEY,
                secret_key=self.settings.MINIO_SECRET_KEY,
                secure=self.settings.MINIO_SECURE,
            )
            bucket = self.settings.MINIO_BUCKET
            if not client.bucket_exists(bucket):
                client.make_bucket(bucket)
            return client
        except Exception:
            if self.settings.STORAGE_BACKEND == "minio":
                raise
            return None

    @property
    def backend_name(self) -> str:
        return "minio" if self._minio_client is not None else "local"

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
        mime = detected or "application/octet-stream"
        clean_key = storage_key.lstrip("/").replace("\\", "/")
        if ".." in clean_key.split("/"):
            raise M7Error("M7-4001", "非法的存储路径 key", http_status=400)

        if self._minio_client is not None:
            try:
                self._minio_client.put_object(
                    self.settings.MINIO_BUCKET,
                    clean_key,
                    io.BytesIO(data),
                    length=len(data),
                    content_type=mime,
                )
            except Exception as exc:
                if self.settings.STORAGE_BACKEND == "minio":
                    raise M7Error("M7-5032", f"MinIO 写入失败: {exc}", http_status=503) from exc
                self._minio_client = None

        target = self.resolve_safe(clean_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        sha256 = hashlib.sha256(data).hexdigest()
        return mime, len(data), sha256

    def read_bytes(self, storage_key: str) -> bytes:
        clean_key = storage_key.lstrip("/").replace("\\", "/")
        if self._minio_client is not None:
            try:
                resp = self._minio_client.get_object(self.settings.MINIO_BUCKET, clean_key)
                try:
                    return resp.read()
                finally:
                    resp.close()
                    resp.release_conn()
            except Exception:
                if self.settings.STORAGE_BACKEND == "minio":
                    raise M7Error("M7-4041", f"MinIO 对象不存在: {storage_key}", http_status=404)

        target = self.resolve_safe(clean_key)
        if not target.exists() or not target.is_file():
            raise M7Error("M7-4041", f"磁盘媒体文件不存在: {storage_key}", http_status=404)
        return target.read_bytes()

    def exists(self, storage_key: str) -> bool:
        clean_key = storage_key.lstrip("/").replace("\\", "/")
        if self._minio_client is not None:
            try:
                stat = self._minio_client.stat_object(self.settings.MINIO_BUCKET, clean_key)
                return bool(stat and stat.size > 0)
            except Exception:
                pass
        target = self.resolve_safe(clean_key)
        return target.exists() and target.is_file() and target.stat().st_size > 0
