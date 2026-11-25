from pydantic import BaseModel, Field


class LoginReq(BaseModel):
    org_id: str = Field(default="org_demo", min_length=2, max_length=64)
    user_id: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class UserCreateReq(BaseModel):
    user_id: str = Field(..., min_length=2, max_length=64)
    display_name: str = Field(..., min_length=2, max_length=64)
    role_code: str = Field(..., min_length=2, max_length=64)
    email: str = Field(..., min_length=3, max_length=128)
    password: str = Field(default="crosspilot123", min_length=6, max_length=128)
    allowed_shop_ids: list[str] = Field(default_factory=list)


class UserRoleUpdateReq(BaseModel):
    role_code: str = Field(..., min_length=2, max_length=64)
    is_active: bool = True
    allowed_shop_ids: list[str] | None = None


class PolicyToggleReq(BaseModel):
    is_enabled: bool
    enforce_sod: bool = True
