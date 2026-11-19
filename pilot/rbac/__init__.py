"""RBAC 认证授权包（PACK 23）。

分层：
- dao.py：只碰 SQLAlchemy，不做业务判断；
- service.py：外观层，负责事务、一致性、密码哈希、角色/权限聚合；
- decorators.py：服务/函数级权限校验，读取登录上下文；
- api.py：登录、用户/角色/权限 HTTP 管理接口与鉴权中间件；
- bootstrap.py：建表与初始化角色/权限。
"""
