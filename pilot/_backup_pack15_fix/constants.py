"""后端统一文案常量（PACK 14 / Z3）。

【合成演示业务，非真实生产业务】

为什么单独一层：
- 「本轮无需补货」「合成场景，结论不可当作真实经营依据」原来只硬编码在前端
  （P3SkuDetail.vue / errorCodes.js）和 web/index.html 的注释里，Agent 回执拿不到，
  于是 E-4001 / E-5001 两档在 AI 文本里永远命中不了；
- 现在这两句只有这一个源头：前端 GET /api/copy 取，Agent 回执 import 本模块，
  两端各留一处引用，禁止再各写一份字面量。
- 本模块不含任何业务数字，只放文案；数字仍由 core / 接口实时算。
"""

from __future__ import annotations

NO_REPLENISH_TEXT = "本轮无需补货"
SYNTHETIC_NOTICE = "合成场景，结论不可当作真实经营依据"
AMOUNT_UNAVAILABLE_TEXT = "成本未填，金额无法计算"

# 状态码 → 文案键的映射说明（前端 errorCodes.js 里 E-4001 / E-5001 直接引用下面两句）


def copy_payload() -> dict:
    """GET /api/copy 的响应体：前端唯一的文案来源。"""
    return {
        "no_replenish": NO_REPLENISH_TEXT,
        "synthetic_notice": SYNTHETIC_NOTICE,
        "amount_unavailable": AMOUNT_UNAVAILABLE_TEXT,
        "source": "api/constants.py",
        "note": "前端与 Agent 共用的唯一文案来源，禁止在页面或提示词里各写一份。",
    }


def agent_notice() -> str:
    """Agent 回执统一追加的口径声明（一行，模型可直接引用）。"""
    return f"口径声明：{SYNTHETIC_NOTICE}。"


__all__ = [
    "NO_REPLENISH_TEXT",
    "SYNTHETIC_NOTICE",
    "AMOUNT_UNAVAILABLE_TEXT",
    "copy_payload",
    "agent_notice",
]
