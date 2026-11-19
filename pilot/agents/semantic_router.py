"""PACK 17a：语义路由（规则表的兜底层）。

背景：`classify_intent` 是子串词表，问句里插字就失配——「这个月要备多少货」
（备—多少—货）、「这条申请能不能批」（能不能—批）都落 A3 自答，拿不到建议量。
词表不能再补（I-15 停止条件），所以加一层模型判定。

分工（必须守住）：
1. 规则表先跑。命中 A5/A6 直接返回，模型不参与——冻结集 50/50 不被扰动。
2. 指标保护词（「补货点」）直接返回 A3，模型也不参与——`METRIC_GUARD` 是红线。
3. 只有规则判 A3 时，才问模型「这句到底在问什么」。
4. 模型返回不在三分类里、超时、任何异常 → 一律回落 A3（自答）。

一致性：结果按问句原文落 `docs/intent_cache.json`，同一问句第二次起零调用，
保证两次跑分路由完全一致；换模型/换提示词时删缓存重跑即可。
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from pathlib import Path

PILOT_DIR = Path(__file__).resolve().parent.parent
CACHE_PATH = PILOT_DIR / "docs" / "intent_cache.json"

INTENTS = ("A3_ask", "A5_forecast", "A6_replenish")
DEFAULT_INTENT = "A3_ask"

SYSTEM_PROMPT = """你是补货系统的意图判别器。只输出一个 JSON 对象，不要解释、不要寒暄。

允许的取值只有三个：
- "A6_replenish"：用户在问「要不要补、补多少、订多少、备多少货、这条申请批不批、采购/收货到哪一步」。
  同义说法包括：备货、进货、囤货、下多少、走多少、能不能批、审批过没过、到货没、质检完没。
- "A5_forecast"：用户在问「预测准不准、模型怎么选、WAPE/误差/偏差是多少、回测怎么做的、参数怎么调」。
- "A3_ask"：其余全部——包括查指标（库存周转、日均销量、断货天数、服务水平）、
  问口径与定义、问价格或成本、问竞品、问系统能力边界、与补货无关的闲聊。

判别要点：
1. 只要句子的落点是「要不要下单、下多少、批不批、货到哪了」，就是 A6，哪怕它同时提到销量或预测。
2. 只是把某个数字读出来（销量、断货日、周转天数），没有下单动作，是 A3。
3. 提到「补货点」「安全库存」「服务水平」这类指标名但没问动作，是 A3。
4. 「竞争对手的进货价」是价格问题，是 A3，不是 A6。
5. **让系统去做动作而不是算数**——发邮件、起草话术、联系供应商、催货、打电话、改系统设置——
   一律 A3（越界请求，由 A3 拒答），不要因为出现「供应商/催货」就判 A6。
6. 「把参数改一下再算一遍」（如把在库天数调到 60 再算）**不是 A6**：它只是带着新条件重算一遍建议量，
   由 A3 用只读工具带参重算即可；A6 只处理「要不要下、下多少、批不批」。
   如果是在问「这个参数是什么意思」，也是 A3。
7. 拿不准就输出 A3——错判成 A6 会触发写库路径，代价远大于漏判。

输出格式：{"intent": "A3_ask"}"""


def _cfg() -> tuple[str, str, str]:
    """读 .env（与 agents/registry.py 同源），不引入额外依赖。"""
    env_path = PILOT_DIR / ".env"
    values: dict[str, str] = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            values[key.strip()] = val.strip().strip('"').strip("'")
    return (
        values.get("DEEPSEEK_API_KEY", os.getenv("DEEPSEEK_API_KEY", "")).strip(),
        values.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip(),
        values.get("DEEPSEEK_MODEL", "deepseek-chat").strip(),
    )


def _cache_key(question: str) -> str:
    return hashlib.sha1(question.strip().encode("utf-8")).hexdigest()


_lock = threading.Lock()


def _load_cache() -> dict:
    if not CACHE_PATH.exists():
        return {}
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_cache(cache: dict) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = CACHE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(CACHE_PATH)


def enabled() -> bool:
    return os.getenv("PILOT_SEMANTIC_ROUTER", "1").strip() not in ("0", "false", "off")


def semantic_intent(question: str, *, use_cache: bool = True) -> str:
    """问模型这句话属于哪一类；任何失败都返回 A3_ask。"""
    q = (question or "").strip()
    if not q or not enabled():
        return DEFAULT_INTENT

    key = _cache_key(q)
    if use_cache:
        cached = _load_cache().get(key)
        if isinstance(cached, dict) and cached.get("intent") in INTENTS:
            return cached["intent"]

    api_key, base_url, model = _cfg()
    if not api_key:
        return DEFAULT_INTENT

    timeout = float(os.getenv("PILOT_SEMANTIC_TIMEOUT", "8"))
    started = time.time()
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, base_url=base_url, timeout=timeout, max_retries=0)
        resp = client.chat.completions.create(
            model=model,
            temperature=0,
            max_tokens=20,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": q},
            ],
        )
        raw = (resp.choices[0].message.content or "").strip()
        intent = json.loads(raw).get("intent")
        if intent not in INTENTS:
            intent = DEFAULT_INTENT
    except Exception:
        return DEFAULT_INTENT

    if use_cache:
        with _lock:
            cache = _load_cache()
            cache[key] = {
                "question": q,
                "intent": intent,
                "model": model,
                "latency_ms": int((time.time() - started) * 1000),
                "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            }
            _save_cache(cache)
    return intent


__all__ = ["INTENTS", "DEFAULT_INTENT", "enabled", "semantic_intent"]
