import asyncio
from collections.abc import Coroutine
from typing import Any


_BACKGROUND_TASKS: set[asyncio.Task[Any]] = set()


def spawn_background_job(coro: Coroutine[Any, Any, Any]) -> asyncio.Task[Any]:
    task = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)
    return task
