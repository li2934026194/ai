from dataclasses import dataclass, field
import re

from app.modules.m7_content.models import M7ComplianceRule


REWRITE_SUGGESTIONS: dict[str, str] = {
    "velcro": "hook and loop",
    "waterproof": "Water-resistant",
    "ziploc": "resealable storage bag",
    "teflon": "non-stick coating",
    "thermos": "insulated vacuum container",
    "dyson": "cyclonic vacuum",
    "magsafe": "magnetic ring compatible",
    "botox": "peptide firming complex",
    "vaseline": "petroleum jelly barrier",
    "samsonite": "hardshell travel luggage",
    "cordura": "high-density ballistic nylon",
    "fda approved": "food-grade material tested",
    "sterilize": "deep clean",
    "cure": "soothe / relieve",
    "treat acne": "help balance blemish-prone skin",
    "medical grade": "commercial grade",
    "100% best": "high-performance",
    "no.1": "popular choice",
    "guaranteed": "backed by standard warranty",
    "free gift": "included accessory",
}

ALLOWED_ACRONYMS: set[str] = {
    "USB",
    "USB-C",
    "HDMI",
    "LED",
    "LCD",
    "ABS",
    "BPA",
    "FDA",
    "FCC",
    "UL",
    "CE",
    "ROHS",
    "IP65",
    "IPX4",
    "IPX5",
    "KPA",
    "MAH",
    "RGB",
    "UTF",
    "SKU",
    "CNC",
    "N52",
    "DIY",
    "SUV",
    "MP4",
    "PNG",
    "FAQ",
    "MOCRA",
    "TISI",
    "NBTC",
}

_ALL_CAPS_RE = re.compile(r"\b[A-Z]{4,}\b")


@dataclass
class CopyScanResult:
    char_count: int
    utf8_bytes: int
    max_limit: int
    limit_unit: str  # "chars" | "bytes"
    over_len: bool
    must_hits: list[str] = field(default_factory=list)
    must_missing: list[str] = field(default_factory=list)
    ban_hits: list[str] = field(default_factory=list)
    trademark_hits: list[str] = field(default_factory=list)
    regulatory_hits: list[str] = field(default_factory=list)
    all_caps_words: list[str] = field(default_factory=list)
    suggestions: dict[str, str] = field(default_factory=dict)
    passed: bool = True

    def to_dict(self) -> dict:
        return {
            "char_count": self.char_count,
            "utf8_bytes": self.utf8_bytes,
            "max_limit": self.max_limit,
            "limit_unit": self.limit_unit,
            "over_len": self.over_len,
            "must_hits": self.must_hits,
            "must_missing": self.must_missing,
            "ban_hits": self.ban_hits,
            "trademark_hits": self.trademark_hits,
            "regulatory_hits": self.regulatory_hits,
            "all_caps_words": self.all_caps_words,
            "suggestions": self.suggestions,
            "passed": self.passed,
        }


def _find_terms(text: str, terms: list[str]) -> list[str]:
    hits: list[str] = []
    for raw in terms:
        term = raw.strip()
        if not term:
            continue
        pat = re.compile(r"(?<![A-Za-z0-9])" + re.escape(term) + r"(?![A-Za-z0-9])", re.I)
        if pat.search(text):
            hits.append(term)
    return hits


class LexiconScanner:
    """三层词库扫描与平台字节/字符上限校验（纯领域服务，无 HTTP 依赖）"""

    def scan(
        self,
        text: str,
        *,
        slot: str,
        rule: M7ComplianceRule | None = None,
        extra_must: list[str] | None = None,
        extra_ban: list[str] | None = None,
        platform: str = "amazon_us",
    ) -> CopyScanResult:
        content = text or ""
        lex = (rule.lexicon_json if rule else None) or {}
        must_terms = list(dict.fromkeys((lex.get("must") or []) + (extra_must or [])))
        ban_terms = list(dict.fromkeys((lex.get("ban") or []) + (extra_ban or [])))
        tm_terms = list(lex.get("trademark") or ["Dyson", "Ziploc", "Velcro", "Teflon", "Thermos"])
        reg_terms = list(
            lex.get("regulatory")
            or ["FDA Approved", "Sterilize", "Cure", "Medical Grade", "Waterproof"]
        )

        must_hits = _find_terms(content, must_terms)
        must_missing = [t for t in must_terms if t not in must_hits]
        ban_hits = _find_terms(content, ban_terms)
        tm_hits = _find_terms(content, tm_terms)
        reg_hits = _find_terms(content, reg_terms)

        all_caps = [
            w for w in _ALL_CAPS_RE.findall(content) if w not in ALLOWED_ACRONYMS
        ]

        char_count = len(content)
        utf8_bytes = len(content.encode("utf-8"))

        if slot == "copy_kw":
            limit_unit = "bytes"
            max_limit = rule.search_terms_max_bytes if rule else 250
            over_len = utf8_bytes > max_limit
        elif slot == "copy_title":
            limit_unit = "chars"
            default_title_limit = {"amazon_us": 200, "tiktok_us": 150, "shopee_th": 120}.get(
                platform, 200
            )
            max_limit = rule.title_max_chars if rule else default_title_limit
            over_len = char_count > max_limit
        elif slot == "copy_bullets":
            limit_unit = "chars"
            max_limit = (rule.bullet_max_chars if rule else 500) * 5
            over_len = char_count > max_limit
        else:
            limit_unit = "chars"
            max_limit = 2000
            over_len = char_count > max_limit

        suggestions: dict[str, str] = {}
        for hit in [*ban_hits, *tm_hits, *reg_hits]:
            repl = REWRITE_SUGGESTIONS.get(hit.lower())
            if repl:
                suggestions[hit] = repl

        passed = (
            len(ban_hits) == 0
            and len(tm_hits) == 0
            and len(reg_hits) == 0
            and len(all_caps) == 0
            and not over_len
        )

        return CopyScanResult(
            char_count=char_count,
            utf8_bytes=utf8_bytes,
            max_limit=max_limit,
            limit_unit=limit_unit,
            over_len=over_len,
            must_hits=must_hits,
            must_missing=must_missing,
            ban_hits=ban_hits,
            trademark_hits=tm_hits,
            regulatory_hits=reg_hits,
            all_caps_words=all_caps,
            suggestions=suggestions,
            passed=passed,
        )
