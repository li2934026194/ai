"""PACK 21a 自检：全文数字 diff 必须能抓到“凭空多出来的数”。"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

PILOT_DIR = Path(__file__).resolve().parent.parent
if str(PILOT_DIR) not in sys.path:
    sys.path.append(str(PILOT_DIR))

from tests import check_numbers  # noqa: E402


class TestNumberChecker(unittest.TestCase):
    def _real_case(self) -> dict:
        raw = json.loads((PILOT_DIR / "docs" / "eval-raw.json").read_text(encoding="utf-8"))
        for case in raw.get("explain_cases", []):
            if case.get("category") in ("normal", "正常") or case.get("category") == "E-5001":
                if case.get("dataset_id") and case.get("sku"):
                    return case
        return raw["explain_cases"][0]

    def test_real_answer_passes(self):
        case = self._real_case()
        self.assertEqual(check_numbers.check_case(case), [])

    def test_injected_number_is_caught(self):
        case = dict(self._real_case())
        case["text"] = (case.get("text") or "") + "\n另外建议补 9999 件。"
        violations = check_numbers.check_case(case)
        self.assertTrue(violations, "9999 不在 detail 里，必须被抓出来")
        self.assertTrue(any(token == "9999" for token, _ in violations))


if __name__ == "__main__":
    unittest.main()
