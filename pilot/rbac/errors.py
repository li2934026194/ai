"""RBAC 统一异常。

接口层会把 RBACError 转成真实 HTTP 状态码（401/403/404/409/400），
不能用项目原有的 HTTP 200 + body.code 约定，否则鉴权失败会被前端当成业务成功。
"""

from __future__ import annotations


class RBACError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, detail: str = ""):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.detail = detail
