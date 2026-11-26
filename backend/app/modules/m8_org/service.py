from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import CoreAuditEvent, write_audit_event
from app.core.auth_rbac import ROLE_PERMISSIONS, ActorContext, hash_password, issue_actor_jwt, verify_password
from app.core.exceptions import M7Error
from app.modules.m8_org.models import M8ApprovalPolicy, M8RoleDefinition, M8UserAccount
from app.modules.m8_org.schemas import LoginReq, PolicyToggleReq, UserCreateReq, UserRoleUpdateReq


class M8OrgService:
    async def login(self, session: AsyncSession, req: LoginReq, trace_id: str) -> dict:
        u = await session.scalar(
            select(M8UserAccount).where(M8UserAccount.org_id == req.org_id, M8UserAccount.user_id == req.user_id)
        )
        if not u or not verify_password(req.password, u.password_hash):
            await write_audit_event(
                session,
                org_id=req.org_id,
                module="RBAC",
                action="AUTH_LOGIN_FAILED",
                actor_id=req.user_id,
                actor_role=u.role_code if u else "unknown",
                ok=False,
                sentence_zh=f"账号 {req.user_id} 密码登录组织 {req.org_id} 校验失败",
                trace_id=trace_id,
            )
            await session.commit()
            raise M7Error("M7-4011", "账号或密码错误", http_status=401)
        if not u.is_active:
            await write_audit_event(
                session,
                org_id=req.org_id,
                module="RBAC",
                action="ACCOUNT_DISABLED_DENIED",
                actor_id=u.user_id,
                actor_role=u.role_code,
                ok=False,
                sentence_zh=f"已停用账号 {u.display_name}（{u.user_id}）尝试密码登录，已被拦截",
                trace_id=trace_id,
            )
            await session.commit()
            raise M7Error("M7-4031", f"账号 {u.user_id} 已停用，禁止登录", http_status=403)
        token = issue_actor_jwt(u.user_id, u.role_code, u.org_id, u.display_name)
        await write_audit_event(
            session,
            org_id=req.org_id,
            module="M8",
            action="AUTH_LOGIN",
            actor_id=u.user_id,
            actor_role=u.role_code,
            ok=True,
            sentence_zh=f"{u.display_name}（{u.role_code}）通过账号密码成功登录",
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "user_id": u.user_id,
                "org_id": u.org_id,
                "display_name": u.display_name,
                "role_code": u.role_code,
                "allowed_shop_ids": u.allowed_shop_ids_json or [],
            },
        }

    async def list_users(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(select(M8UserAccount).where(M8UserAccount.org_id == org_id).order_by(M8UserAccount.user_id))
        ).all()
        return [
            {
                "user_id": r.user_id,
                "display_name": r.display_name,
                "role_code": r.role_code,
                "email": r.email,
                "is_active": r.is_active,
                "allowed_shop_ids": r.allowed_shop_ids_json or [],
            }
            for r in rows
        ]

    async def create_user(
        self, session: AsyncSession, org_id: str, req: UserCreateReq, actor: ActorContext, trace_id: str
    ) -> dict:
        if req.role_code not in ROLE_PERMISSIONS:
            raise M7Error("M7-4221", f"未知角色代码: {req.role_code}", http_status=422)
        existing = await session.scalar(select(M8UserAccount).where(M8UserAccount.user_id == req.user_id))
        if existing:
            raise M7Error("M7-4091", f"账号已存在: {req.user_id}", http_status=409)
        session.add(
            M8UserAccount(
                user_id=req.user_id,
                org_id=org_id,
                display_name=req.display_name,
                role_code=req.role_code,
                email=req.email,
                password_hash=hash_password(req.password),
                allowed_shop_ids_json=req.allowed_shop_ids,
                is_active=True,
            )
        )
        await write_audit_event(
            session,
            org_id=org_id,
            module="M8",
            action="USER_CREATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 新增账号 {req.display_name}（{req.role_code}，授权店铺={len(req.allowed_shop_ids) or '全部'}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"user_id": req.user_id}

    async def update_user(
        self, session: AsyncSession, org_id: str, user_id: str, req: UserRoleUpdateReq, actor: ActorContext, trace_id: str
    ) -> dict:
        u = await session.scalar(select(M8UserAccount).where(M8UserAccount.org_id == org_id, M8UserAccount.user_id == user_id))
        if not u:
            raise M7Error("M7-4041", f"未找到账号: {user_id}", http_status=404)
        if req.role_code is not None:
            if req.role_code not in ROLE_PERMISSIONS:
                raise M7Error("M7-4221", f"未知角色代码: {req.role_code}", http_status=422)
            u.role_code = req.role_code
        if req.is_active is not None:
            u.is_active = req.is_active
        if req.allowed_shop_ids is not None:
            u.allowed_shop_ids_json = req.allowed_shop_ids
        await write_audit_event(
            session,
            org_id=org_id,
            module="M8",
            action="USER_ROLE_UPDATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 将账号 {u.display_name} 角色变更为 {u.role_code}（active={u.is_active}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {
            "user_id": user_id,
            "role_code": req.role_code,
            "is_active": req.is_active,
            "allowed_shop_ids": u.allowed_shop_ids_json or [],
        }

    async def list_roles(self, session: AsyncSession) -> list[dict]:
        rows = (await session.scalars(select(M8RoleDefinition).order_by(M8RoleDefinition.role_code))).all()
        return [
            {
                "role_code": r.role_code,
                "display_name": r.display_name,
                "description": r.description,
                "permissions": r.permissions_json or sorted(ROLE_PERMISSIONS.get(r.role_code, set())),
            }
            for r in rows
        ]

    async def list_policies(self, session: AsyncSession, org_id: str) -> list[dict]:
        rows = (
            await session.scalars(select(M8ApprovalPolicy).where(M8ApprovalPolicy.org_id == org_id).order_by(M8ApprovalPolicy.policy_id))
        ).all()
        return [
            {
                "policy_id": r.policy_id,
                "module": r.module,
                "name": r.name,
                "threshold_rule": r.threshold_rule,
                "approver_role": r.approver_role,
                "enforce_sod": r.enforce_sod,
                "is_enabled": r.is_enabled,
            }
            for r in rows
        ]

    async def toggle_policy(
        self, session: AsyncSession, org_id: str, policy_id: str, req: PolicyToggleReq, actor: ActorContext, trace_id: str
    ) -> dict:
        pol = await session.scalar(
            select(M8ApprovalPolicy).where(M8ApprovalPolicy.org_id == org_id, M8ApprovalPolicy.policy_id == policy_id)
        )
        if not pol:
            raise M7Error("M7-4041", f"未找到审批流策略: {policy_id}", http_status=404)
        pol.is_enabled = req.is_enabled
        pol.enforce_sod = req.enforce_sod
        await write_audit_event(
            session,
            org_id=org_id,
            module="M8",
            action="POLICY_UPDATED",
            actor_id=actor.user_id,
            actor_role=actor.role,
            ok=True,
            sentence_zh=f"{actor.display_name} 更新审批流策略 {pol.name}（enabled={req.is_enabled}, SoD={req.enforce_sod}）",
            trace_id=trace_id,
        )
        await session.commit()
        return {"policy_id": policy_id, "is_enabled": pol.is_enabled, "enforce_sod": pol.enforce_sod}

    async def list_global_audits(self, session: AsyncSession, org_id: str, module: str | None = None, limit: int = 80) -> list[dict]:
        stmt = select(CoreAuditEvent).where(CoreAuditEvent.org_id == org_id)
        if module:
            stmt = stmt.where(CoreAuditEvent.module == module)
        stmt = stmt.order_by(CoreAuditEvent.created_at.desc()).limit(limit)
        rows = (await session.scalars(stmt)).all()
        return [
            {
                "event_id": r.event_id,
                "sku": r.sku,
                "module": r.module,
                "action": r.action,
                "actor_id": r.actor_id,
                "actor_role": r.actor_role,
                "ok": r.ok,
                "sentence_zh": r.sentence_zh,
                "trace_id": r.trace_id,
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
            for r in rows
        ]
