"""PACK 25：为现有数据集的每个 SKU 生成 3 家 1688 第一层模拟报价。

用法（PowerShell）：
  cd C:\\Users\\Windows\\Desktop\\pilot
  .\\.venv\\Scripts\\python.exe scripts\\seed_1688_quotes.py
  .\\.venv\\Scripts\\python.exe scripts\\seed_1688_quotes.py --dataset-id ds_xxx

【模拟数据，非实时 1688、非正式报价、未校验供应商】只写 supplier_quotes 一张表，
不碰 products / replenish_apply / purchase_order，不改 products.unit_cost。
每个 SKU 的 3 家报价由 loaders.supplier_quotes 的确定性规则生成，无随机数。

幂等：quote_id = sq_ + sha1(dataset_id|sku|supplier_code)[:16] 确定性；
同一 quote_id 已存在就跳过，不重复插入、不删除旧数据。可反复执行。
不写死任何数据集 id：从 datasets 表读取；--dataset-id 可限定单个数据集。
不打印任何密钥、口令或连接串密码。
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select  # noqa: E402

from db import SessionLocal, create_all  # noqa: E402
from loaders.supplier_quotes import build_mock_quotes  # noqa: E402
from schema import Datasets, Products, SupplierQuotes  # noqa: E402


# 写库时只取 supplier_quotes 表真实存在的列；applicable/saving/rank 依赖请求时 qty，
# 不落库（由 service 在读取时用 finalize_quotes 现场重算）。
_TABLE_COLUMNS = (
    "quote_id",
    "dataset_id",
    "sku",
    "supplier_code",
    "supplier_name",
    "unit_price",
    "currency",
    "moq",
    "pack_size",
    "lead_prod",
    "lead_transit",
    "reliability",
    "freight_per_unit",
    "tier_json",
    "is_mock",
    "source_note",
)


def _row_values(base: dict) -> dict:
    out = {key: base[key] for key in _TABLE_COLUMNS}
    out["created_at"] = datetime.now()
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="生成 1688 第一层模拟供应商报价")
    parser.add_argument(
        "--dataset-id",
        default=None,
        help="只处理指定数据集；留空则处理 datasets 表里的全部数据集",
    )
    args = parser.parse_args()

    # 确保 supplier_quotes 表存在（create_all 对已存在的表是 no-op）。
    create_all()

    session = SessionLocal()
    try:
        ds_stmt = select(Datasets).order_by(Datasets.name)
        if args.dataset_id:
            ds_stmt = ds_stmt.where(Datasets.dataset_id == args.dataset_id)
        datasets = session.execute(ds_stmt).scalars().all()
        if not datasets:
            selector = args.dataset_id or "（全部）"
            print(f"没有匹配的数据集：{selector}")
            return 2

        total_skus = 0
        total_quotes = 0
        total_inserted = 0
        total_skipped = 0

        for ds in datasets:
            products = session.execute(
                select(Products).where(Products.dataset_id == ds.dataset_id).order_by(Products.sku)
            ).scalars().all()
            inserted = 0
            skipped = 0
            for p in products:
                # seed 时没有「当前建议量」上下文，qty=0 → 报价固定字段不受影响；
                # applicable/saving/rank 由 service 按请求 qty 现场重算。
                for base in build_mock_quotes(p, 0):
                    existing = session.get(SupplierQuotes, base["quote_id"])
                    if existing is not None:
                        skipped += 1
                        continue
                    session.add(SupplierQuotes(**_row_values(base)))
                    inserted += 1
            session.commit()

            sku_count = len(products)
            quote_count = sku_count * 3
            total_skus += sku_count
            total_quotes += quote_count
            total_inserted += inserted
            total_skipped += skipped
            print(
                f"{ds.dataset_id} {ds.name}: "
                f"skus={sku_count} quotes={quote_count} inserted={inserted} skipped={skipped}"
            )

        print(
            f"总计: datasets={len(datasets)} skus={total_skus} quotes={total_quotes} "
            f"inserted={total_inserted} skipped={total_skipped}"
        )
        return 0
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
