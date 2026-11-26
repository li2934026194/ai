from collections.abc import AsyncGenerator
from sqlalchemy import JSON, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


# PostgreSQL 使用原生 JSONB，SQLite 兼容回退为 JSON
JSONBCompat = JSON().with_variant(JSONB, "postgresql")


def create_engine_from_url(database_url: str) -> AsyncEngine:
    connect_args: dict = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    engine = create_async_engine(
        database_url,
        echo=False,
        future=True,
        connect_args=connect_args,
    )
    if database_url.startswith("sqlite"):
        @event.listens_for(engine.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_conn, _connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.close()
    return engine


_settings = get_settings()
engine: AsyncEngine = create_engine_from_url(_settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
