"""DeepSeek 连通性验证（只验证连通，不实现任何 Agent）。

运行：
    cd pilot && .venv/Scripts/python.exe tests/smoke_llm.py

只做三件事：
1. 用一句话问「什么是安全库存」
2. 打印返回原文
3. 打印端到端耗时 + token 用量

key 只从 pilot/.env 读，绝不写死在代码里。
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

# ---- 1. 手动读 .env（零新增依赖，不装 python-dotenv） -------------------
PILOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = PILOT_DIR / ".env"


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        values[k.strip()] = v.strip()
    return values


cfg = read_env(ENV_PATH)
api_key = cfg.get("DEEPSEEK_API_KEY", "").strip()
base_url = cfg.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()
model = cfg.get("DEEPSEEK_MODEL", "deepseek-chat").strip()

if not api_key or api_key.startswith("<"):
    print("缺少真实 DEEPSEEK_API_KEY：请在 pilot/.env 的 DEEPSEEK_API_KEY= 后填入真实 key。")
    sys.exit(1)

# ---- 2. 装配 openai-agents → DeepSeek（OpenAI 兼容端点） ----------------
from agents import Agent, Runner, set_default_openai_api, set_default_openai_client  # noqa: E402
from openai import AsyncOpenAI  # noqa: E402

client = AsyncOpenAI(api_key=api_key, base_url=base_url)
set_default_openai_client(client)
# DeepSeek 只提供 Chat Completions，没有 Responses API
set_default_openai_api("chat_completions")

agent = Agent(
    name="connectivity-smoke",
    instructions="你是连通性测试助手。用中文、严格一句话回答，不要多余解释。",
    model=model,
)

QUESTION = "用一句话说什么是安全库存"

# ---- 3. 跑一次，量三样 ---------------------------------------------------
t0 = time.perf_counter()
result = Runner.run_sync(agent, QUESTION)
elapsed = time.perf_counter() - t0

reply = result.final_output

# openai-agents 0.24.0：用量在 raw_responses[-1].usage（老版本在 result.usage）
usage = getattr(result, "usage", None)
if usage is None:
    raw_responses = getattr(result, "raw_responses", None) or []
    if raw_responses:
        usage = getattr(raw_responses[-1], "usage", None)

input_tokens = getattr(usage, "input_tokens", None)
output_tokens = getattr(usage, "output_tokens", None)
total_tokens = getattr(usage, "total_tokens", None)

print("=== 1. 返回原文 ===")
print(reply)
print()
print("=== 2. 端到端耗时 ===")
print(f"elapsed_seconds = {elapsed:.3f}")
print()
print("=== 3. token 用量 ===")
print(f"input_tokens  = {input_tokens}")
print(f"output_tokens = {output_tokens}")
print(f"total_tokens  = {total_tokens}")
