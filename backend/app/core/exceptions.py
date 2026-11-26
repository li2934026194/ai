from typing import Any
from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.config import redact_secrets


class M7Error(Exception):
    """M7 统一业务异常，映射到详细设计第 11.2 节错误码表"""

    def __init__(
        self,
        code: str,
        message: str,
        http_status: int = 400,
        data: Any = None,
    ) -> None:
        self.code = code
        self.message = redact_secrets(message)
        self.http_status = http_status
        self.data = data
        super().__init__(self.message)


def build_envelope(
    code: str = "OK",
    message: str = "成功",
    data: Any = None,
    trace_id: str = "",
) -> dict[str, Any]:
    return {
        "code": code,
        "message": redact_secrets(message),
        "trace_id": trace_id,
        "data": data,
    }


async def m7_exception_handler(request: Request, exc: M7Error) -> JSONResponse:
    trace_id = getattr(request.state, "trace_id", "")
    return JSONResponse(
        status_code=exc.http_status,
        content=build_envelope(
            code=exc.code,
            message=exc.message,
            data=exc.data,
            trace_id=trace_id,
        ),
    )
