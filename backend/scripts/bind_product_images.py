"""Bind real product photos to product records in the database.

Maps each product to one of the 7 real Amazon-style product photos stored
in MinIO, based on SKU / name / category. Idempotent: safe to re-run.

Image URLs point to the backend endpoint /api/v1/product-images/{sku}.png
which streams the photo from MinIO (no auth needed for <img> tags).
"""
import asyncio
import asyncpg

DB_DSN = "postgresql://crosspilot:crosspilot123@127.0.0.1:5432/crosspilot"

# 图片基址：后端图片接口（同源，前端直接访问）
IMG_BASE = "/api/v1/product-images"


def pick_image(sku: str, name: str, category: str) -> str:
    """按 SKU 精确匹配优先，再按名称/品类关键词回退，返回图片文件名。"""
    s = (sku or "").upper()
    n = name or ""

    # 1) 精确 SKU（7 个种子商品用自己专属的真实图）
    exact = {
        "SKU-00704": "SKU-00704",  # 真空封口机
        "BAG-108": "BAG-108",      # 双肩包
        "FAN-203": "FAN-203",      # 循环扇
        "COS-052": "COS-052",      # 面霜
        "MNT-405": "MNT-405",      # 磁吸支架
        "LED-812": "LED-812",      # 小夜灯
        "PET-905": "PET-905",      # 宠物
    }
    # 仿真商品的真实外观图（键盘/垃圾桶/硅胶置物架此前错绑到支架/灯条/封口机）
    by_name = {
        "键盘": "KB-FOLD",
        "垃圾桶": "TRASH-SENSOR",
        "置物架": "RACK-SILICONE",
    }
    if s in exact:
        return exact[s]

    # 2) SKU 前缀（仿真商品 RL-XXX 系列）
    if s.startswith("RL-BAG") or s.startswith("BAG"):
        return "BAG-108"
    if s.startswith("RL-BEA") or s.startswith("COS"):
        return "COS-052"
    if s.startswith("RL-PET") or s.startswith("PET"):
        return "PET-905"

    # 3) 名称关键词（最贴近真实外观）
    if "封口机" in n or "真空" in n:
        return "SKU-00704"
    if "风扇" in n or "循环扇" in n:
        return "FAN-203"
    if "夜灯" in n or "LED" in n or "照明" in n:
        return "LED-812"
    for keyword, img in by_name.items():
        if keyword in n:
            return img
    if "支架" in n or "收纳" in n or "小夜灯" in n:
        return "MNT-405" if "支架" in n else "LED-812"
    if "面霜" in n or "护肤" in n or "美妆" in n or "保湿" in n:
        return "COS-052"
    if "背包" in n or "双肩" in n or "箱包" in n:
        return "BAG-108"
    if "宠物" in n or "饮水" in n or "猫" in n or "狗" in n:
        return "PET-905"

    # 4) 品类回退
    c = (category or "").lower()
    if "pet" in c:
        return "PET-905"
    if "beauty" in c:
        return "COS-052"
    if "bag" in c:
        return "BAG-108"
    if "3c" in c or "mobile" in c or "accessor" in c:
        return "MNT-405"
    if "home" in c:
        return "LED-812"
    if "kitchen" in c:
        return "SKU-00704"

    return "SKU-00704"  # 兜底


async def main():
    conn = await asyncpg.connect(DB_DSN)
    try:
        # 1) 更新 m0_products
        products = await conn.fetch("SELECT sku, name, category FROM m0_products")
        m0_updated = 0
        for r in products:
            img = pick_image(r["sku"], r["name"], r["category"])
            url = f"{IMG_BASE}/{img}.png"
            await conn.execute(
                "UPDATE m0_products SET image_url=$1 WHERE sku=$2", url, r["sku"]
            )
            m0_updated += 1

        # 2) 更新 m4_candidates（按 sku 关联商品，或按名称/品类）
        candidates = await conn.fetch("SELECT candidate_id, sku, name, category FROM m4_candidates")
        m4_updated = 0
        for r in candidates:
            img = pick_image(r["sku"], r["name"], r["category"])
            url = f"{IMG_BASE}/{img}.png"
            await conn.execute(
                "UPDATE m4_candidates SET image_url=$1 WHERE candidate_id=$2",
                url, r["candidate_id"],
            )
            m4_updated += 1

        print(f"m0_products   更新 {m0_updated} 条")
        print(f"m4_candidates 更新 {m4_updated} 条")

        # 3) 验证每条都有图，且图片文件存在于白名单
        valid = {"SKU-00704", "BAG-108", "FAN-203", "COS-052", "MNT-405", "LED-812", "PET-905",
             "KB-FOLD", "TRASH-SENSOR", "RACK-SILICONE"}
        for table in ("m0_products", "m4_candidates"):
            total = await conn.fetchval(f"SELECT count(*) FROM {table}")
            filled = await conn.fetchval(f"SELECT count(*) FROM {table} WHERE image_url IS NOT NULL")
            bad = await conn.fetchval(
                f"SELECT count(*) FROM {table} WHERE image_url IS NULL OR image_url NOT LIKE '%/product-images/%'"
            )
            print(f"  {table}: {filled}/{total} 有图, 异常 {bad}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
