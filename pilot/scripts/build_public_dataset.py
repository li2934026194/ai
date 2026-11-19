"""离线构建公开数据集（PACK 22 / 22A）。

用法：
    python scripts/build_public_dataset.py --xlsx data/online_retail_II.xlsx --dry-run
    python scripts/build_public_dataset.py --xlsx data/online_retail_II.xlsx --name "公开-UCI礼品20SKU-180天"

--dry-run 只读 xlsx、复算选样与仿真、打印统计，不写库；正式模式用幂等
upsert_dataset 落四张事实表并写入 datasets.note。文件不存在时明确报错退出，
绝不用假数据补位。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# 脚本从 scripts/ 直接启动时，把项目根加入 sys.path 才能 import loaders/db。
_PILOT_DIR = Path(__file__).resolve().parent.parent
if str(_PILOT_DIR) not in sys.path:
    sys.path.insert(0, str(_PILOT_DIR))

from loaders.public_uci import (
    DEFAULT_LIMIT,
    DEFAULT_NAME,
    DEFAULT_WINDOW_DAYS,
    PublicUciError,
    PublicUciLoader,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="从 UCI Online Retail II 构建公开数据集")
    parser.add_argument("--xlsx", required=True, help="online_retail_II.xlsx 路径")
    parser.add_argument("--name", default=DEFAULT_NAME, help="数据集名")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="SKU 数（默认 20）")
    parser.add_argument(
        "--window-days", type=int, default=DEFAULT_WINDOW_DAYS, help="时间窗天数（默认 180）"
    )
    parser.add_argument("--dry-run", action="store_true", help="只复算统计，不写库")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    xlsx = Path(args.xlsx)
    if not xlsx.exists():
        print(f"[ERROR] UCI 文件不存在：{xlsx.resolve()}")
        print("        请从 https://archive.ics.uci.edu/dataset/502/online+retail+ii")
        print("        下载 online_retail_II.xlsx 放到 data/ 目录。不会用假数据补位。")
        return 2

    try:
        loader = PublicUciLoader(
            xlsx, name=args.name, limit=args.limit, window_days=args.window_days
        )
    except PublicUciError as exc:
        print(f"[ERROR] 构建失败：{exc}")
        return 3

    frames = loader.load()
    total_stockout = sum(item["stockout_days"] for item in loader.sim.values())
    print("=== 22A 公开数据集构建统计 ===")
    print(f"xlsx        : {xlsx.resolve()}")
    print(f"数据集名    : {loader.name}")
    print(f"source_type : {loader.source_type}")
    print(f"SKU 数      : {loader.sku_count}")
    print(f"销量行数    : {loader.row_count}（{loader.sku_count} × {(loader.end - loader.start).days + 1}）")
    print(f"起止日      : {loader.start.isoformat()} ~ {loader.end.isoformat()}")
    print(f"仿真断货    : {total_stockout} 个 SKU·日（真实销量未改）")
    print(f"on_hand<0   : {sum(1 for r in frames['inventory_daily'] if r['on_hand'] < 0)}")
    print("note        : " + loader.note)

    if args.dry_run:
        print("[DRY-RUN] 未写库。")
        return 0

    from db import get_session
    from loaders.base import upsert_dataset

    session = get_session()
    try:
        dataset_id = upsert_dataset(session, loader, loader.name, loader.note)
        session.commit()
    except Exception as exc:  # noqa: BLE001 - 脚本顶层如实报错
        session.rollback()
        print(f"[ERROR] 写库失败：{type(exc).__name__}: {exc}")
        return 4
    finally:
        session.close()

    print(f"[OK] 已写库 dataset_id={dataset_id}")
    print(f"     四表行数 products={len(frames['products'])} "
          f"sales_daily={len(frames['sales_daily'])} "
          f"inventory_daily={len(frames['inventory_daily'])} "
          f"inbound_batches={len(frames['inbound_batches'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
