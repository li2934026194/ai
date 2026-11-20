"""请求级登录主体上下文。

中间件在请求开始时 set，请求结束 reset；服务层装饰器从 ContextVar 读取，
这样不需要给每个 service 函数增加 principal 参数，也不会把 token 存在服务器内存。
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar, Token
from typing import Iterator, Optional

from rbac.principal import Principal

_current: ContextVar[Optional[Principal]] = ContextVar("pilot_current_principal", default=None)


def get_current_principal() -> Optional[Principal]:
    return _current.get()


def set_current_principal(principal: Optional[Principal]) -> Token:
    return _current.set(principal)


def reset_current_principal(token: Token) -> None:
    _current.reset(token)


@contextmanager
def use_principal(principal: Optional[Principal]) -> Iterator[None]:
    """测试或内部调用使用：``with use_principal(p): ...``。"""
    token = _current.set(principal)
    try:
        yield
    finally:
        _current.reset(token)
