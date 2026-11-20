"""api 包：FastAPI 壳（PACK 4）。

铁律（17 号契约）：
- api 只做「取数 + 转 JSON」，绝不重算任何数；
- 公式（σ、z、ceil、安全库存、两步取整）只在 core 出现，api 出现即错；
- service.py 不 import agents.tools（本地 agents/ 与 openai-agents SDK 同名会撞），
  自己从 db 读 + 调 core。
"""
