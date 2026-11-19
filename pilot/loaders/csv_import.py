"""CSV 导入器（PACK 20）：把一份“日粒度销量 + 库存快照”的 CSV 变成可跑的数据集。

设计原则：
1. 只做一件事——把外部 CSV 变成系统已有的四张事实表，不另造数据结构；
2. 产品参数（成本/售价/MOQ/箱规/四段交期）沿用产品主数据，CSV 里不重复填；
3. 所有校验在写库前完成，错一行就整批不写（不做“能导入多少算多少”）。
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime
from typing import Any

SOURCE_TYPE = "TEST_API"  # schema.SOURCE_TYPES 里的“测试输入”
MIN_DAYS = 60             # core.calibrate_demand 的最低历史要求
MAX_ROWS = 50000
MAX_SKUS = 50

REQUIRED_COLUMNS = ("date", "sku", "sales_qty", "on_hand", "in_transit")

# PACK 24：可选商品主数据列。旧 CSV 不填这些列行为完全不变；
# 新 SKU 必须提供完整且合法的一组，才能建产品并导入。
MASTER_COLUMNS = (
    "title", "price", "unit_cost", "moq", "pack_size",
    "lead_prod", "lead_transit", "lead_customs", "lead_inbound",
)
INTEGER_MASTER_COLUMNS = frozenset({
    "moq", "pack_size", "lead_prod", "lead_transit", "lead_customs", "lead_inbound",
})


class CsvImportError(ValueError):
    """导入失败：code 供 API 映射成结构化错误码。"""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _parse_date(value: str, line: int) -> date:
    text_value = (value or "").strip()
    try:
        return datetime.strptime(text_value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise CsvImportError("E-6001", f"第 {line} 行日期 {text_value!r} 不是 YYYY-MM-DD") from exc


def _parse_number(value: str, field: str, line: int, *, allow_zero: bool = True) -> float:
    text_value = (value or "").strip()
    try:
        number = float(text_value)
    except ValueError as exc:
        raise CsvImportError("E-6001", f"第 {line} 行 {field} {text_value!r} 不是数字") from exc
    if number != number or number in (float("inf"), float("-inf")):
        raise CsvImportError("E-6001", f"第 {line} 行 {field} 不是有效数字")
    if number < 0 or (not allow_zero and number == 0):
        raise CsvImportError("E-6001", f"第 {line} 行 {field} 不能为负" + ("或 0" if not allow_zero else ""))
    return number


def parse_csv(csv_text: str) -> dict[str, list[dict[str, Any]]]:
    """解析并校验 CSV，返回按 SKU 聚合的日记录。

    Returns: {sku: [{"date": date, "sales_qty": float, "on_hand": float, "in_transit": float}, ...]}
    """
    if not csv_text or not csv_text.strip():
        raise CsvImportError("E-6001", "CSV 内容为空")
    reader = csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff")))
    header = [str(h or "").strip() for h in (reader.fieldnames or [])]
    missing = [col for col in REQUIRED_COLUMNS if col not in header]
    if missing:
        raise CsvImportError(
            "E-6001",
            f"CSV 缺少列 {missing}；必需列为 {list(REQUIRED_COLUMNS)}",
        )

    rows = list(reader)
    if not rows:
        raise CsvImportError("E-6001", "CSV 只有表头，没有数据行")
    if len(rows) > MAX_ROWS:
        raise CsvImportError("E-6001", f"行数 {len(rows)} 超过上限 {MAX_ROWS}")

    by_sku: dict[str, list[dict[str, Any]]] = {}
    seen: set[tuple[str, date]] = set()
    for index, raw in enumerate(rows, start=2):  # 表头占第 1 行
        sku = str(raw.get("sku") or "").strip()
        if not sku:
            raise CsvImportError("E-6001", f"第 {index} 行 sku 为空")
        day = _parse_date(raw.get("date") or "", index)
        key = (sku, day)
        if key in seen:
            raise CsvImportError("E-6001", f"第 {index} 行重复：{sku} 在 {day} 出现两次")
        seen.add(key)
        record = {
            "date": day,
            "sales_qty": _parse_number(raw.get("sales_qty") or "", "sales_qty", index),
            "on_hand": _parse_number(raw.get("on_hand") or "", "on_hand", index),
            "in_transit": _parse_number(raw.get("in_transit") or "", "in_transit", index),
            # PACK 24：保留主数据原始字符串与行号，供 extract_master 校验；
            # 不放进 build_frames 的事实表记录（那三个数值键才是销量/库存口径）。
            "_line": index,
            # 保留原始单元格（含空格），空白值由 extract_master 判 E-6007；
            # 正常值在校验时 strip，兼容单元格两侧空格。
            "_master": {col: str(raw.get(col) or "") for col in MASTER_COLUMNS},
        }
        by_sku.setdefault(sku, []).append(record)

    if len(by_sku) > MAX_SKUS:
        raise CsvImportError("E-6001", f"SKU 数 {len(by_sku)} 超过上限 {MAX_SKUS}")
    return by_sku


def _master_value(sku: str, field: str, value: str, line: int) -> Any:
    """校验并归一化单个主数据字段；非法值抛 E-6007，可定位到行/列。"""
    text_value = str(value or "").strip()
    if not text_value:
        raise CsvImportError("E-6007", f"第 {line} 行 {sku} 的 {field} 为空")
    if field == "title":
        return text_value
    if field in INTEGER_MASTER_COLUMNS:
        try:
            number = float(text_value)
        except ValueError as exc:
            raise CsvImportError(
                "E-6007", f"第 {line} 行 {sku} 的 {field}={text_value!r} 不是整数"
            ) from exc
        if number != number or number in (float("inf"), float("-inf")):
            raise CsvImportError("E-6007", f"第 {line} 行 {sku} 的 {field} 不是有效数字")
        if not number.is_integer():
            raise CsvImportError(
                "E-6007", f"第 {line} 行 {sku} 的 {field}={text_value!r} 必须是整数"
            )
        if number <= 0:
            raise CsvImportError(
                "E-6007", f"第 {line} 行 {sku} 的 {field}={text_value!r} 必须大于 0"
            )
        return int(number)
    # price / unit_cost：正的小数
    try:
        number = float(text_value)
    except ValueError as exc:
        raise CsvImportError(
            "E-6007", f"第 {line} 行 {sku} 的 {field}={text_value!r} 不是数字"
        ) from exc
    if number != number or number in (float("inf"), float("-inf")):
        raise CsvImportError("E-6007", f"第 {line} 行 {sku} 的 {field} 不是有效数字")
    if number <= 0:
        raise CsvImportError(
            "E-6007", f"第 {line} 行 {sku} 的 {field}={text_value!r} 必须大于 0"
        )
    return number


def extract_master(
    by_sku: dict[str, list[dict[str, Any]]],
    *,
    skip_skus: set[str] | None = None,
) -> dict[str, dict[str, Any]]:
    """从 CSV 解析结果里提取新 SKU 的商品主数据。

    返回 {sku: 归一化后的主数据 dict}；旧格式（未填任何主数据列）的 SKU 不出现在结果里。
    skip_skus：已有的 SKU 一律沿用库里主数据，CSV 里带的主数据既不采用也不校验。

    校验顺序（任一失败即整批拒绝，错误可定位到行/列）：
    - 缺字段 E-6006：SKU 提供了部分主数据列但没给全；
    - 同 SKU 多行主数据冲突 E-6005；
    - 非法值 E-6007：空标题 / 0 或负值 / 非整数 MOQ·箱规·交期 / 非法数字。
    """
    skip_skus = skip_skus or set()
    master: dict[str, dict[str, Any]] = {}
    for sku, rows in by_sku.items():
        if sku in skip_skus:
            continue
        # 该 SKU 是否出现了任意主数据单元格。用原始字符串判断（不 strip），
        # 这样「填了但全空格」也算提供了，交给 _master_value 报 E-6007 空值，
        # 而不是误判成缺列 E-6006。
        provided = any(
            any(str((row.get("_master") or {}).get(col) or "") != "" for col in MASTER_COLUMNS)
            for row in rows
        )
        if not provided:
            continue  # 旧格式：交给 service 判断——已有 SKU 沿用旧主数据，新 SKU 报 E-6006

        normalized: dict[str, Any] = {}
        for field in MASTER_COLUMNS:
            # 收集该字段在所有行的非空值及行号
            values: list[tuple[int, str]] = []
            for row in rows:
                raw = (row.get("_master") or {}).get(field)
                line = int(row.get("_line", 0))
                if str(raw or "") != "":  # 单元格存在即收集；空值由 _master_value 判 E-6007
                    values.append((line, str(raw).strip()))
            if not values:
                first_line = int(rows[0].get("_line", 0))
                raise CsvImportError(
                    "E-6006",
                    f"SKU {sku} 缺少商品主数据字段 {field}（首行第 {first_line} 行）；"
                    f"新 SKU 必须提供全部字段：{list(MASTER_COLUMNS)}",
                )
            # 同一 SKU 多行冲突
            first_line, first_value = values[0]
            for line, value in values[1:]:
                if value != first_value:
                    raise CsvImportError(
                        "E-6005",
                        f"SKU {sku} 主数据冲突：{field} 在第 {first_line} 行是 {first_value!r}、"
                        f"第 {line} 行是 {value!r}；同一 SKU 多行必须一致",
                    )
            normalized[field] = _master_value(sku, field, first_value, first_line)
        master[sku] = normalized
    return master


def build_frames(
    by_sku: dict[str, list[dict[str, Any]]],
    products_by_sku: dict[str, dict[str, Any]],
    *,
    source_type: str = SOURCE_TYPE,
) -> dict[str, list[dict[str, Any]]]:
    """把解析结果变成 upsert_dataset 需要的四张表记录。

    products_by_sku：产品主数据 {sku: {title, unit_cost, price, moq, pack_size,
    lead_prod, lead_transit, lead_customs, lead_inbound}}；缺哪个 SKU 就整批失败。
    """
    unknown = sorted(set(by_sku) - set(products_by_sku))
    if unknown:
        raise CsvImportError(
            "E-6002",
            f"未知 SKU {unknown}：产品主数据里没有。请先补产品参数，或改用已有 SKU。",
        )

    short = sorted((sku, len(rows)) for sku, rows in by_sku.items() if len(rows) < MIN_DAYS)
    if short:
        detail = "、".join(f"{sku} 只有 {n} 天" for sku, n in short)
        raise CsvImportError(
            "E-6003",
            f"{detail}；每个 SKU 至少需要 {MIN_DAYS} 天历史才能预测",
        )

    products: list[dict[str, Any]] = []
    sales: list[dict[str, Any]] = []
    inventory: list[dict[str, Any]] = []
    for sku, rows in by_sku.items():
        meta = products_by_sku[sku]
        products.append(
            {
                "dataset_id": "",
                "sku": sku,
                "title": meta.get("title") or sku,
                "unit_cost": meta.get("unit_cost"),
                "price": meta.get("price"),
                "moq": int(meta.get("moq") or 1),
                "pack_size": int(meta.get("pack_size") or 1),
                "lead_prod": int(meta.get("lead_prod") or 0),
                "lead_transit": int(meta.get("lead_transit") or 0),
                "lead_customs": int(meta.get("lead_customs") or 0),
                "lead_inbound": int(meta.get("lead_inbound") or 0),
                "source_type": source_type,
            }
        )
        price = meta.get("price")
        for record in sorted(rows, key=lambda r: r["date"]):
            qty = float(record["sales_qty"])
            sales.append(
                {
                    "dataset_id": "",
                    "sku": sku,
                    "date": record["date"],
                    "qty": qty,
                    "revenue": round(qty * float(price), 2) if price is not None else None,
                    "is_refund": 0,
                    "source_type": source_type,
                }
            )
            inventory.append(
                {
                    "dataset_id": "",
                    "sku": sku,
                    "date": record["date"],
                    "on_hand": float(record["on_hand"]),
                    "in_transit": float(record["in_transit"]),
                    "source_type": source_type,
                }
            )

    return {
        "products": products,
        "sales_daily": sales,
        "inventory_daily": inventory,
        "inbound_batches": [],
    }


class CsvLoader:
    """满足 loaders.base.Loader 协议：load() 直接返回四张表记录。"""

    def __init__(self, frames: dict[str, list[dict[str, Any]]], source_type: str = SOURCE_TYPE):
        self.source_type = source_type
        self._frames = frames
        self.rows = sum(len(v) for k, v in frames.items() if k in ("sales_daily",))
        self.skus = sorted({r["sku"] for r in frames["products"]})

    def load(self) -> dict[str, list[dict[str, Any]]]:
        return self._frames


def date_range(by_sku: dict[str, list[dict[str, Any]]]) -> tuple[date, date]:
    days = [r["date"] for rows in by_sku.values() for r in rows]
    return min(days), max(days)


__all__ = [
    "CsvImportError",
    "CsvLoader",
    "parse_csv",
    "extract_master",
    "build_frames",
    "date_range",
    "REQUIRED_COLUMNS",
    "MASTER_COLUMNS",
    "MIN_DAYS",
]
