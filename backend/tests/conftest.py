from collections.abc import AsyncGenerator
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.core.database import Base, create_engine_from_url, get_db_session
from app.main import create_app
from app.mocks.seed_data import ensure_seed_data

# 测试统一使用独立的 PostgreSQL 测试库，与业务库隔离。
TEST_DATABASE_URL = "postgresql+asyncpg://crosspilot:crosspilot123@127.0.0.1:5432/crosspilot_test"


async def _reset_test_schema(eng) -> None:
    """每个测试前清空 public schema，保证测试之间数据完全隔离。"""
    async with eng.begin() as conn:
        await conn.exec_driver_sql("DROP SCHEMA public CASCADE;")
        await conn.exec_driver_sql("CREATE SCHEMA public;")


@pytest.fixture
async def test_ctx(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    storage_dir = tmp_path / "storage"
    monkeypatch.setenv("DATABASE_URL", TEST_DATABASE_URL)
    monkeypatch.setenv("STORAGE_ROOT", str(storage_dir))
    monkeypatch.setenv("M7_ENV", "test")
    monkeypatch.setenv("DASHSCOPE_API_KEY", "")
    monkeypatch.setenv("M7_STRICT_SEPARATION_OF_DUTIES", "true")
    get_settings.cache_clear()

    eng = create_engine_from_url(TEST_DATABASE_URL)
    await _reset_test_schema(eng)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=eng, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )
    async with session_factory() as s:
        await ensure_seed_data(s, org_id="org_demo")

    app = create_app()

    async def _override_session() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as s:
            yield s

    app.dependency_overrides[get_db_session] = _override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield {
            "client": client,
            "session_factory": session_factory,
            "storage_dir": storage_dir,
        }

    await eng.dispose()
    get_settings.cache_clear()
