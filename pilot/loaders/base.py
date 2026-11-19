"""Loader 协议 + 幂等 upsert（17 号 3.1）。

契约原文：

    class Loader(Protocol):
        source_type: SourceType
        def load(self) -> dict[str, "pd.DataFrame"]: ...

    def upsert_dataset(conn, loader: Loader, name: str, note: str) -> str: ...

本环境未装 pandas：契约里的 ``pd.DataFrame`` 用 duck-typed ``list[dict]`` 实现
（core/demand.py::_iter_records 明确支持 list[dict]）。若将来装了 pandas，
``to_dict("records")`` 分支也能直接吃真 DataFrame，签名不变。

幂等策略：SQLite 用 ``insert(...).on_conflict_do_nothing(index_elements=[...])``；
PostgreSQL 用同样语义的方言实现（10 号文档 1.3 留的口子）；其他方言退回先查后插。
撞唯一键跳过，不报错，同一份报表导两次销量合计完全相等。
"""

from __future__ import annotations

from typing import Any, Iterable, Protocol
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import Table, and_, select
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session

from core import SourceType
from schema import (
    SOURCE_TYPES,
    Datasets,
    InboundBatches,
    InventoryDaily,
    Products,
    SalesDaily,
)

# 一次 executemany 的行数上限：SQLite 参数上限约 32766，分块更稳。
UPSERT_CHUNK_SIZE = 500

# 键必须属于这四张事实表（17 号 3.1）。
_ALLOWED_TABLE_KEYS: frozenset[str] = frozenset(
    {"products", "sales_daily", "inventory_daily", "inbound_batches"}
)

# 每张表的模型 / 唯一键 / 必填列，集中登记，避免散落字符串。
_TABLE_MODEL: dict[str, type] = {
    "products": Products,
    "sales_daily": SalesDaily,
    "inventory_daily": InventoryDaily,
    "inbound_batches": InboundBatches,
}
_UNIQUE_COLUMNS: dict[str, tuple[str, ...]] = {
    "products": ("dataset_id", "sku"),
    "sales_daily": ("dataset_id", "sku", "date"),
    "inventory_daily": ("dataset_id", "sku", "date"),
    "inbound_batches": ("dataset_id", "sku", "batch_id"),
}
_REQUIRED_COLUMNS: dict[str, tuple[str, ...]] = {
    "products": (
        "dataset_id",
        "sku",
        "title",
        "unit_cost",
        "price",
        "moq",
        "pack_size",
        "lead_prod",
        "lead_transit",
        "lead_customs",
        "lead_inbound",
        "source_type",
    ),
    "sales_daily": (
        "dataset_id",
        "sku",
        "date",
        "qty",
        "revenue",
        "is_refund",
        "source_type",
    ),
    "inventory_daily": (
        "dataset_id",
        "sku",
        "date",
        "on_hand",
        "in_transit",
        "source_type",
    ),
    "inbound_batches": (
        "dataset_id",
        "sku",
        "batch_id",
        "arrive_date",
        "qty",
        "status",
        "source_type",
    ),
}


class Loader(Protocol):
    """四种数据源共用的接口（17 号 v1.1，签名照抄）。"""

    source_type: SourceType

    def load(self) -> dict[str, "pd.DataFrame"]:
        """返回以表名为键的数据；键只能取自 _ALLOWED_TABLE_KEYS。

        pandas 未安装，实际返回 ``dict[str, list[dict]]``（等价 DataFrame）。
        """
        raise NotImplementedError


def _as_records(frame: Any) -> list[dict]:
    """把 duck-typed DataFrame（list[dict]）或真 DataFrame 统一成 dict 列表。"""
    if frame is None:
        return []
    if hasattr(frame, "to_dict") and callable(frame.to_dict):
        raw_records = frame.to_dict("records")
    else:
        raw_records = frame
    records: list[dict] = []
    for record in raw_records:
        if not isinstance(record, dict):
            raise ValueError(f"loader 记录必须是 dict，实际为 {type(record).__name__}")
        records.append(dict(record))
    return records


def _dialect_name(conn: Connection | Session) -> str:
    """取连接方言名；兼容 Session 与 SQLAlchemy Connection。"""
    bind = conn.get_bind() if isinstance(conn, Session) else conn
    return str(bind.dialect.name)


def _chunks(rows: list[dict], size: int = UPSERT_CHUNK_SIZE) -> Iterable[list[dict]]:
    """把大批量行切成固定大小的分块。"""
    for start in range(0, len(rows), size):
        yield rows[start : start + size]


def upsert_rows(
    conn: Connection | Session,
    table: Table,
    rows: list[dict],
    unique_cols: tuple[str, ...] | list[str],
) -> int:
    """按唯一键幂等写入一批行；撞键跳过。

    Args:
        conn: SQLAlchemy Connection 或 Session（调用方负责事务）。
        table: 目标 Table 对象（如 ``Products.__table__``）。
        rows: 要写入的 dict 列表。
        unique_cols: 唯一键列名，用于 ON CONFLICT 判定。

    Returns:
        提交的行数（含被跳过的；幂等语义下行数不重复增长）。

    Raises:
        ValueError: 行里出现表里不存在的列名。
    """
    if not rows:
        return 0

    known_columns = set(table.columns.keys())
    unique_cols = tuple(unique_cols)
    for row in rows:
        unknown = set(row.keys()) - known_columns
        if unknown:
            raise ValueError(
                f"表 {table.name} 出现未知列: {sorted(unknown)}；"
                f"合法列: {sorted(known_columns)}"
            )
        missing_unique = [col for col in unique_cols if col not in row]
        if missing_unique:
            raise ValueError(f"表 {table.name} 缺少唯一键列: {missing_unique}")

    dialect = _dialect_name(conn)
    submitted = 0
    for chunk in _chunks(rows):
        if dialect == "sqlite":
            from sqlalchemy.dialects.sqlite import insert as sqlite_insert

            statement = (
                sqlite_insert(table)
                .values(chunk)
                .on_conflict_do_nothing(index_elements=list(unique_cols))
            )
            conn.execute(statement)
        elif dialect == "postgresql":
            # 10 号文档 1.3：将来切 PostgreSQL 只改 DATABASE_URL，这里已适配方言。
            from sqlalchemy.dialects.postgresql import insert as pg_insert

            statement = (
                pg_insert(table)
                .values(chunk)
                .on_conflict_do_nothing(index_elements=list(unique_cols))
            )
            conn.execute(statement)
        else:
            # 兜底：先查后插，不依赖任何方言扩展。
            for row in chunk:
                conditions = [table.columns[col] == row[col] for col in unique_cols]
                exists = conn.execute(
                    select(table.columns[unique_cols[0]]).where(and_(*conditions)).limit(1)
                ).first()
                if exists is None:
                    conn.execute(table.insert().values(**row))
        submitted += len(chunk)
    return submitted


def upsert_dataset(conn: Connection | Session, loader: Loader, name: str, note: str) -> str:
    """建/取一个 dataset，再幂等导入 loader 的四张事实表，返回 dataset_id。

    幂等有两个层次：
    1. dataset 用确定性 id（uuid5(source_type, name)）+ name 唯一键，重复调用不新增行；
    2. 四张事实表按各自唯一键 ON CONFLICT DO NOTHING，重复导入销量不翻倍。

    Args:
        conn: SQLAlchemy Connection 或 Session；本函数不 commit，由调用方控制事务。
        loader: Loader 实现（如 SyntheticLoader）。
        name: dataset 名。
        note: 生成参数说明，写进 datasets.note 供解释层引用。

    Returns:
        dataset_id 字符串。

    Raises:
        ValueError: source_type 非法、load() 返回了非法键、列缺失或列名不符。
    """
    source_type = str(getattr(loader, "source_type", ""))
    if source_type not in SOURCE_TYPES:
        raise ValueError(
            f"非法 source_type={source_type!r}，只允许 {SOURCE_TYPES}"
        )

    frames = loader.load()
    if not isinstance(frames, dict):
        raise ValueError("loader.load() 必须返回 dict[str, DataFrame]")
    extra_keys = set(frames.keys()) - _ALLOWED_TABLE_KEYS
    if extra_keys:
        raise ValueError(f"loader.load() 返回非法表名: {sorted(extra_keys)}")

    records_by_table: dict[str, list[dict]] = {
        key: _as_records(frames.get(key)) for key in _ALLOWED_TABLE_KEYS
    }
    for key, records in records_by_table.items():
        required = _REQUIRED_COLUMNS[key]
        for index, row in enumerate(records):
            missing = [col for col in required if col not in row]
            if missing:
                raise ValueError(f"{key} 第 {index} 行缺列: {missing}")
            if str(row["source_type"]) not in SOURCE_TYPES:
                raise ValueError(
                    f"{key} 第 {index} 行 source_type 非法: {row['source_type']!r}"
                )

    dataset_id = "ds_" + uuid5(NAMESPACE_URL, f"{source_type}:{name}").hex[:20]
    from datetime import datetime

    upsert_rows(
        conn,
        Datasets.__table__,
        [
            {
                "dataset_id": dataset_id,
                "name": name,
                "source_type": source_type,
                "note": note,
                "created_at": datetime.now(),
            }
        ],
        ("dataset_id",),
    )

    for key in ("products", "sales_daily", "inventory_daily", "inbound_batches"):
        records = records_by_table[key]
        if not records:
            continue
        stamped = []
        for row in records:
            merged = dict(row)
            merged["dataset_id"] = dataset_id
            stamped.append(merged)
        upsert_rows(
            conn,
            _TABLE_MODEL[key].__table__,
            stamped,
            _UNIQUE_COLUMNS[key],
        )
    return dataset_id


__all__ = ["Loader", "upsert_dataset", "upsert_rows", "UPSERT_CHUNK_SIZE"]
