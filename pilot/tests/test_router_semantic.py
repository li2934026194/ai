"""PACK 17a：语义路由的分工与降级（不打网络，全部用桩）。"""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.insert(0, str(PILOT_DIR))


def _load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, PILOT_DIR / rel)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


registry = _load("_t_router_registry", "agents/registry.py")
semantic = _load("_t_semantic", "agents/semantic_router.py")


class _Stub:
    def __init__(self, intent=None, raises=False, calls=None):
        self.intent = intent
        self.raises = raises
        self.calls = calls if calls is not None else []

    def semantic_intent(self, question):
        self.calls.append(question)
        if self.raises:
            raise RuntimeError("boom")
        return self.intent


class TestSemanticRouterWiring(unittest.TestCase):
    def tearDown(self):
        registry._semantic_router = None

    def test_rule_hit_skips_model(self):
        calls = []
        registry._semantic_router = _Stub("A3_ask", calls=calls)
        self.assertEqual(registry.route_intent("SKU-017 建议补多少"), "A6_replenish")
        self.assertEqual(calls, [], "规则已判 A6 时不得再调模型")

    def test_metric_guard_beats_model(self):
        calls = []
        registry._semantic_router = _Stub("A5_forecast", calls=calls)
        self.assertEqual(registry.route_intent("补货点是怎么定的"), "A3_ask")
        self.assertEqual(calls, [], "保护词必须压过模型，且不产生调用")

    def test_rules_default_goes_to_model(self):
        calls = []
        registry._semantic_router = _Stub("A6_replenish", calls=calls)
        self.assertEqual(registry.route_intent("这个月要备多少货"), "A6_replenish")
        self.assertEqual(len(calls), 1)

    def test_model_failure_falls_back_to_ask(self):
        registry._semantic_router = _Stub(raises=True)
        self.assertEqual(registry.route_intent("这个月要备多少货"), "A3_ask")

    def test_classify_intent_stays_pure_rules(self):
        calls = []
        registry._semantic_router = _Stub("A6_replenish", calls=calls)
        self.assertEqual(registry.classify_intent("这个月要备多少货"), "A3_ask")
        self.assertEqual(calls, [], "classify_intent 必须保持纯规则，供离线复算使用")


class TestSemanticRouterCache(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cache = Path(self.tmp.name) / "intent_cache.json"
        self._orig = semantic.CACHE_PATH
        semantic.CACHE_PATH = self.cache

    def tearDown(self):
        semantic.CACHE_PATH = self._orig
        self.tmp.cleanup()

    def _fake_client(self, payload: str, calls: list):
        class _Msg:
            content = payload

        class _Choice:
            message = _Msg()

        class _Resp:
            choices = [_Choice()]

        class _Completions:
            def create(self, **kwargs):
                calls.append(kwargs)
                return _Resp()

        class _Chat:
            completions = _Completions()

        class _Client:
            chat = _Chat()

        return _Client()

    def test_cache_prevents_second_call(self):
        calls = []
        payload = json.dumps({"intent": "A6_replenish"})
        with mock.patch("openai.OpenAI", return_value=self._fake_client(payload, calls)):
            first = semantic.semantic_intent("这条申请能不能批")
            second = semantic.semantic_intent("这条申请能不能批")
        self.assertEqual(first, "A6_replenish")
        self.assertEqual(second, "A6_replenish")
        self.assertEqual(len(calls), 1, "同一问句第二次必须命中缓存")
        data = json.loads(self.cache.read_text(encoding="utf-8"))
        self.assertEqual(len(data), 1)

    def test_bad_payload_falls_back(self):
        calls = []
        with mock.patch("openai.OpenAI", return_value=self._fake_client("not-json", calls)):
            self.assertEqual(semantic.semantic_intent("随便问一句"), "A3_ask")

    def test_unknown_intent_falls_back(self):
        calls = []
        payload = json.dumps({"intent": "A9_unknown"})
        with mock.patch("openai.OpenAI", return_value=self._fake_client(payload, calls)):
            self.assertEqual(semantic.semantic_intent("随便问一句"), "A3_ask")

    def test_disabled_flag_skips_model(self):
        calls = []
        payload = json.dumps({"intent": "A6_replenish"})
        with mock.patch.dict("os.environ", {"PILOT_SEMANTIC_ROUTER": "0"}):
            with mock.patch("openai.OpenAI", return_value=self._fake_client(payload, calls)):
                self.assertEqual(semantic.semantic_intent("这条申请能不能批"), "A3_ask")
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
