from pydantic import BaseModel, Field


class UserCreateReq(BaseModel):
    user_id: str = Field(..., min_length=2, max_length=64)
    display_name: str = Field(..., min_length=2, max_length=64)
    role_code: str = Field(..., min_length=2, max_length=64)
    email: str = Field(..., min_length=3, max_length=128)


class UserRoleUpdateReq(BaseModel):
    role_code: str = Field(..., min_length=2, max_length=64)
    is_active: bool = True


class PolicyToggleReq(BaseModel):
    is_enabled: bool
    enforce_sod: bool = True
