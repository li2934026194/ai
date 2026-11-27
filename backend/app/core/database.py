from collections.abc import AsyncGenerator
from contextlib import closing
import os
import sqlite3

from sqlalchemy import JSON, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import make_url
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
    engine_kwargs: dict = {"echo": False, "future": True}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        connect_args["timeout"] = 30.0
        # 在任何异步连接建立之前，用同步连接预置 WAL（此时无并发）并立即关闭句柄
        db_path = make_url(database_url).database
        if db_path and db_path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
            with closing(sqlite3.connect(db_path, timeout=30.0)) as boot_conn:
                boot_conn.execute("PRAGMA journal_mode=WAL;")
    else:
        # PostgreSQL asyncpg 连接池优化：支持 M2 4卡并发 + 多人本地压测不爆池
        engine_kwargs.update(
            {
                "pool_size": 20,
                "max_overflow": 30,
                "pool_pre_ping": True,
                "pool_recycle": 1800,
            }
        )
    engine = create_async_engine(database_url, connect_args=connect_args, **engine_kwargs)
    if database_url.startswith("sqlite"):
        @event.listens_for(engine.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_conn, _connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA busy_timeout=30000;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
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
