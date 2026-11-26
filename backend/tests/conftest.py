from collections.abc import AsyncGenerator
from contextlib import closing
from pathlib import Path
import sqlite3
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.core.database import Base, create_engine_from_url, get_db_session
from app.main import create_app
from app.mocks.seed_data import ensure_seed_data


@pytest.fixture
async def test_ctx(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_file = tmp_path / "m7_test.db"
    storage_dir = tmp_path / "storage"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("STORAGE_ROOT", str(storage_dir))
    monkeypatch.setenv("M7_ENV", "test")
    monkeypatch.setenv("DASHSCOPE_API_KEY", "")
    monkeypatch.setenv("M7_STRICT_SEPARATION_OF_DUTIES", "true")
    get_settings.cache_clear()

    eng = create_engine_from_url(f"sqlite+aiosqlite:///{db_file}")
    with closing(sqlite3.connect(db_file, timeout=30.0)) as boot_conn:
        boot_conn.execute("PRAGMA journal_mode=WAL;")
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
            "db_file": db_file,
        }

    await eng.dispose()
    get_settings.cache_clear()
