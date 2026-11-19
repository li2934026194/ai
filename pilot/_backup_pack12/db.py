"""数据库入口：SQLAlchemy 引擎 + 会话 + create_all + Suggestion 显式映射。

连接串（PACK 7 起支持双库）：
- 默认连 PostgreSQL 16（``postgresql+psycopg://postgres@127.0.0.1:5432/pilot``）。
- 设环境变量 ``DATABASE_URL`` 可覆盖（切回 SQLite 写 ``sqlite:///data/pilot.db``）。
- SQLite 相关代码（DB_PATH / DATABASE_URL_RELATIVE / check_same_thread）全部保留，
  作为回滚路径，不删除。

契约铁律一：数据层不依赖任何 Web/UI 框架（禁用清单见 17 号文档）。
"""

from __future__ import annotations

import json
import os
from copy import deepcopy
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from core import Suggestion
from schema import Base

# 10 号文档 1.1：单文件 SQLite，零服务零端口（回滚路径保留）。
PILOT_DIR = Path(__file__).resolve().parent
DATA_DIR = PILOT_DIR / "data"
DB_PATH = DATA_DIR / "pilot.db"

# SQLite 相对写法 + 按 pilot/ 目录解析出的绝对 URL（供显式切回 SQLite 用）。
DATABASE_URL_RELATIVE = "sqlite:///data/pilot.db"
SQLITE_DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

# PostgreSQL 默认连接串（PACK 7）。psycopg 3 方言驱动已装进 .venv。
POSTGRES_DATABASE_URL = "postgresql+psycopg://postgres@127.0.0.1:5432/pilot"

# 优先级：环境变量 DATABASE_URL > PostgreSQL 默认。未设环境变量时默认连 PG。
DATABASE_URL = os.environ.get("DATABASE_URL") or POSTGRES_DATABASE_URL


def _ensure_data_dir() -> None:
    """确保 data/ 存在（SQLite 模式需要；SQLAlchemy 不会自动建目录）。"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


_ensure_data_dir()


def _build_connect_args(url: str) -> dict[str, Any]:
    """按方言给 create_engine 的 connect_args。

    - SQLite 需要 ``check_same_thread=False``，允许 FastAPI 壳跨线程复用连接；
    - PostgreSQL（psycopg）不需要任何额外参数，返回空 dict。
    """
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


engine: Engine = create_engine(
    DATABASE_URL,
    connect_args=_build_connect_args(DATABASE_URL),
    echo=False,
    future=True,
)
SessionLocal: sessionmaker[Session] = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
    class_=Session,
)


def get_engine() -> Engine:
    """返回模块级引擎（唯一）。"""
    return engine


def get_session() -> Session:
    """新建一个会话；调用方负责 commit/rollback 与 close。"""
    return SessionLocal()


def create_all() -> None:
    """建全部 10 张表；已存在则跳过（开发期不做 Alembic 迁移）。"""
    _ensure_data_dir()
    Base.metadata.create_all(engine)


def drop_all() -> None:
    """删全部表：仅用于开发期重建库，生产脚本不应调用。"""
    Base.metadata.drop_all(engine)


def dispose_engine() -> None:
    """释放连接池（脚本退出或重建库前调用）。"""
    engine.dispose()


def _json_default(value: Any) -> str:
    """inputs_json 序列化兜底：date/datetime 转 ISO 字符串，其他转 str。"""
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def suggestion_to_row(sug: Suggestion, dataset_id: str) -> dict:
    """把 core.Suggestion 显式映射成 suggestions 表的一行（17 号 3.2）。

    - ``amount`` → ``capital``（缺成本时 amount=None，落 NULL，绝不落 0）；
    - ``qty`` / ``service_level`` / ``z`` 等结果列原样落；
    - ``raw_service_level`` / ``service_level_source`` / ``zero_days`` / ``reason``
      等不设表列的字段塞进 ``inputs_json``，保证快照可原地复现；
    - 严禁 ``**asdict(sug)`` 直接落库：那会丢 capital/source_type 并写错列名。

    Args:
        sug: core 层算好的一条建议。
        dataset_id: 该建议所属数据集。

    Returns:
        可直接 ``session.add(Suggestions(**row))`` 或 Core insert 的字典。
    """
    snapshot: dict[str, Any]
    if isinstance(sug.inputs_json, dict):
        # 深拷贝：映射函数不得改动 core 传入的快照对象。
        snapshot = deepcopy(sug.inputs_json)
    else:
        snapshot = {}

    # 17 号 v1.1 新增字段：表上没有独立列，全部进 inputs_json。
    snapshot["raw_service_level"] = sug.raw_service_level
    snapshot["service_level_source"] = sug.service_level_source
    snapshot["zero_days"] = sug.zero_days
    snapshot["reason"] = sug.reason

    source_type: Any = snapshot.get("source_type", "SYNTHETIC")
    return {
        "sug_id": f"sug_{uuid4().hex[:16]}",
        "dataset_id": dataset_id,
        "sku": sug.sku,
        "created_at": datetime.now(),
        "service_level": float(sug.service_level),
        "z": float(sug.z),
        "sigma_lt": float(sug.sigma_lt),
        "ss": float(sug.ss),
        "rop": float(sug.rop),
        "target_s": float(sug.target_s),
        "on_hand": float(sug.on_hand),
        "in_transit": float(sug.in_transit),
        "qty": int(sug.qty),
        "stockout_date": sug.stockout_date,
        "lost_amount": sug.lost_amount,
        # 显式改名：amount 是 core 字段名，capital 是表列名。
        "capital": sug.amount,
        "inputs_json": json.dumps(snapshot, ensure_ascii=False, default=_json_default),
        "source_type": str(source_type),
    }


__all__ = [
    "DATABASE_URL",
    "DATABASE_URL_RELATIVE",
    "SQLITE_DATABASE_URL",
    "POSTGRES_DATABASE_URL",
    "DB_PATH",
    "engine",
    "SessionLocal",
    "get_engine",
    "get_session",
    "create_all",
    "drop_all",
    "dispose_engine",
    "suggestion_to_row",
]
