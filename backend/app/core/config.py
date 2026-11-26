from functools import lru_cache
import re
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


_SECRET_PATTERN = re.compile(r"(sk-[A-Za-z0-9_\-]{6,}|Bearer\s+[A-Za-z0-9._\-]+)", re.I)


def redact_secrets(text: str | None) -> str:
    if not text:
        return ""
    return _SECRET_PATTERN.sub("***REDACTED***", str(text))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    M7_ENV: str = "development"
    DATABASE_URL: str = "sqlite+aiosqlite:///./m7_dev.db"

    # 对象/文件存储（支持 local / minio / auto）
    STORAGE_BACKEND: str = "auto"
    STORAGE_ROOT: str = "./m7_storage"
    MINIO_ENDPOINT: str = ""
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "crosspilot-assets"
    MINIO_SECURE: bool = False

    # 缓存与异步任务队列（Redis + Celery）
    REDIS_URL: str = ""
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""

    # 向量检索（Milvus）
    VECTOR_BACKEND: str = "auto"
    MILVUS_URI: str = ""
    MILVUS_COLLECTION: str = "crosspilot_m1_products"

    # Vanna 2 智能问数 & ComfyUI 图像算力（按需配置外部地址）
    VANNA_BASE_URL: str = ""
    COMFYUI_BASE_URL: str = ""

    # 默认云端大模型：阿里云百炼；允许本地无密钥时按双模式策略回退
    CLOUD_LLM_PROVIDER: str = "dashscope"
    DASHSCOPE_API_KEY: str = ""
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    DASHSCOPE_TEXT_MODEL: str = "qwen-plus"
    DASHSCOPE_IMAGE_MODEL: str = "wanx2.1-t2i-turbo"

    # 视频合成门禁
    FFMPEG_BIN: str = "ffmpeg"
    VIDEO_ENGINE_ENABLED: bool = True

    # 职责分离（禁自批）：默认严格开启
    M7_STRICT_SEPARATION_OF_DUTIES: bool = True
    M7_ENABLE_DEMO_ROLE_SWITCH: bool = True

    # 安全与跨域
    JWT_SECRET_KEY: str = "dev-local-placeholder-secret"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def storage_path(self) -> Path:
        p = Path(self.STORAGE_ROOT)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def dashscope_configured(self) -> bool:
        return bool(self.DASHSCOPE_API_KEY and self.DASHSCOPE_API_KEY.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
