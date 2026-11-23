"""rag 包：跨境电商客服知识库的 Milvus 语义检索。

对外只暴露检索入口，种子数据单独放 knowledge_seed.py。
"""

from . import milvus_store

__all__ = ["milvus_store"]
