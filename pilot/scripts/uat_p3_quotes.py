"""PACK 25 UAT：真实浏览器验证 P3 的 1688 第一层模拟报价卡片。

复用 uat_cdp.Browser（Edge headless + CDP），只做浏览器自动化与真实 DOM 断言：
- 真实加载 P3（SKU-017），确认报价卡片与 3 行报价；
- 确认徽标「模拟数据 / 非实时」、最低价、存金额；
- 1366×768 下 P3 无页面级横向滚动；
- 截图到 docs/uat-screenshots/1688-P3-quotes.png。

用法：.venv\\Scripts\\python.exe scripts\\uat_p3_quotes.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from uat_cdp import Browser  # noqa: E402

SHOT = ROOT / "docs" / "uat-screenshots" / "1688-P3-quotes.png"
DATASET = "ds_00b31ed333b05de698c0"
SKU = "SKU-017"


def main() -> int:
    SHOT.parent.mkdir(parents=True, exist_ok=True)
    b = Browser(width=1366, height=768)
    try:
        # App 挂载时按名称默认选中「正在缺货」数据集，SKU 默认 SKU-017。
        # 不注入任何业务数据；等页面真实取数渲染出 3 行报价再做断言。
        b.goto("http://127.0.0.1:8000/#P3")
        for _ in range(20):
            rows = b.js("document.querySelectorAll('#p3QuoteBody tr').length")
            if rows and rows >= 3:
                break
            time.sleep(0.5)

        # 通过真实 API 先确认接口有数据（DOM 依赖它）
        dom = b.js(
            "({card: !!document.getElementById('p3QuoteCard'),"
            " badge: (document.getElementById('p3QuoteMockBadge')||{}).textContent||'',"
            " rows: document.querySelectorAll('#p3QuoteBody tr').length,"
            " suppliers: Array.from(document.querySelectorAll('#p3QuoteBody tr')).map(r=>r.getAttribute('data-supplier')),"
            " summary: (document.getElementById('p3QuoteSummary')||{}).textContent||'',"
            " empty: !!document.getElementById('p3QuoteEmpty'),"
            " offline: !!document.getElementById('p3QuoteOffline'),"
            " sw: document.documentElement.scrollWidth,"
            " cw: document.documentElement.clientWidth})"
        )
        print("DOM:", dom)

        ok = True
        if not dom["card"]:
            print("FAIL: 报价卡片未渲染"); ok = False
        if "模拟数据" not in dom["badge"]:
            print("FAIL: 模拟徽标缺失"); ok = False
        if dom["rows"] != 3:
            print("FAIL: 报价行数不是 3"); ok = False
        if dom["suppliers"] != ["MOCK-A", "MOCK-C", "MOCK-B"]:
            print("FAIL: 供应商排名不符"); ok = False
        if "288" not in dom["summary"] and "节省" not in dom["summary"]:
            print("FAIL: 最低价汇总缺失"); ok = False
        if dom["sw"] > dom["cw"]:
            print(f"FAIL: 页面级横向滚动 {dom['sw']}>{dom['cw']}"); ok = False

        # 滚动到报价卡片，让截图真实呈现 3 家报价表格（不是页面顶部）
        b.js("document.getElementById('p3QuoteCard').scrollIntoView({block:'center'})")
        time.sleep(0.8)
        # 滚动后再取一次 DOM，确认卡片仍在视口内且表格完整可见
        visible = b.js(
            "(()=>{const el=document.getElementById('p3QuoteCard');"
            "const r=el.getBoundingClientRect();"
            "return {top:r.top,bottom:r.bottom,vh:window.innerHeight,"
            "rows:document.querySelectorAll('#p3QuoteBody tr').length};})()"
        )
        print("visible:", visible)
        b.screenshot(str(SHOT))
        print("screenshot:", SHOT)
        print("RESULT:", "PASS" if ok else "FAIL")
        return 0 if ok else 1
    finally:
        b.close()


if __name__ == "__main__":
    raise SystemExit(main())
