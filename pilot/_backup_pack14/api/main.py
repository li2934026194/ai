"""FastAPI 壳 + uvicorn 入口（api/main.py，PACK 4）。

铁律：本层只做「路由 + 参数校验 + 异常转 JSON」，不算任何业务数字。
所有数字来自 api.service（→ core / 库）。错误一律结构化返回，绝不 500。

启动（在 pilot/ 目录下）：
    python -m api.main
或：
    uvicorn api.main:app --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from api import service
from api.ws import router as ws_router
from api.schemas import (
    ApplyApproveRequest,
    ApplyCreateRequest,
    ApplyFlowResponse,
    ApplyListResponse,
    ApplyRejectRequest,
    DashboardResponse,
    DatasetsResponse,
    ErrorResponse,
    Health,
    PoReceiveRequest,
    PoShipRequest,
    RoutePlanResponse,
    SkusResponse,
    SkuDetailResponse,
)

app = FastAPI(title="七 Agent 跨境备货助手 API", version="0.1.0")

# 开发阶段允许前端（file:// 或其它端口）跨域取数；上线前收窄。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(service.ServiceError)
async def _service_error_handler(_request, exc: service.ServiceError):
    """业务异常 → 结构化 JSON，HTTP 200（数据层错误，不是服务器错误）。"""
    body = {"code": exc.code, "message": exc.message}
    if exc.available is not None:
        body["available"] = exc.available
    return JSONResponse(status_code=200, content=body)


@app.get("/api/health", response_model=Health)
async def get_health():
    """存活探针：状态 + 数据集数 + SQLAlchemy 版本。"""
    return service.health()


@app.get("/api/datasets", response_model=DatasetsResponse)
async def get_datasets():
    """五个数据集：id / name / source_type / created_at。"""
    return {"datasets": service.list_datasets()}


@app.get("/api/p1/dashboard", response_model=DashboardResponse)
async def get_dashboard(dataset_id: str = Query(...)):
    """P1 首页 KPI：待补货 / 断货风险 / 占用资金 / 今日运行次数。"""
    return service.dashboard(dataset_id)


@app.get("/api/p2/skus", response_model=SkusResponse)
async def get_skus(dataset_id: str = Query(...), rank: int = Query(20, ge=1, le=100)):
    """P2 SKU 列表（按日均销量降序，取前 rank 个）。"""
    return service.list_skus(dataset_id, rank)


@app.get("/api/p3/sku/{sku}", response_model=SkuDetailResponse)
async def get_sku_detail(sku: str, dataset_id: str = Query(...)):
    """P3 单 SKU 详情：S1 曲线 + per_model 对比 + 推导链 + 服务水平。"""
    return service.sku_detail(dataset_id, sku)


# PACK 11：多路线方案对比 + 三目标决策（只加，不改上面任何现有端点）
@app.get("/api/p3/route-plan", response_model=RoutePlanResponse)
async def get_route_plan(dataset_id: str = Query(...), sku: str = Query(...)):
    """同一 SKU 的海运/空运/铁运/卡航对比 + 保销量/保利润/保现金方案对比。

    运输参数与决策偏好均为 core/routes.py 的「合成假设参数」，非真实物流报价。
    """
    return service.route_plan(dataset_id, sku)


# PACK 12：补货申请 → 多级审批 → 采购单 → 收货质检 履约闭环（只加，不改上面任何端点）
# 【合成演示业务，非真实生产业务】状态流转与数量校验全部在 core/replenish_flow.py。
@app.post("/api/p3/apply", response_model=ApplyFlowResponse)
async def post_replenish_apply(payload: ApplyCreateRequest):
    """提交补货申请（默认直接进入 pending_approve；submit=false 只存草稿）。"""
    return service.create_apply(
        payload.dataset_id,
        payload.sku,
        qty_propose=payload.qty_propose,
        route_code=payload.route_code,
        objective_mode=payload.objective_mode,
        submit_user=payload.submit_user,
        submit=payload.submit,
    )


@app.post("/api/p3/apply/approve", response_model=ApplyFlowResponse)
async def post_approve_apply(payload: ApplyApproveRequest):
    """审批通过：申请置 approved，并自动生成一张采购单。"""
    return service.approve_apply(payload.apply_id, approve_user=payload.approve_user)


@app.post("/api/p3/apply/reject", response_model=ApplyFlowResponse)
async def post_reject_apply(payload: ApplyRejectRequest):
    """审批驳回：必须带驳回理由，否则返回 E-1104。"""
    return service.reject_apply(
        payload.apply_id,
        approve_user=payload.approve_user,
        reject_reason=payload.reject_reason,
    )


@app.post("/api/p3/po/ship", response_model=ApplyFlowResponse)
async def post_ship_po(payload: PoShipRequest):
    """采购单发货：created → shipping。"""
    return service.ship_po(payload.po_id, operator=payload.operator)


@app.post("/api/p3/po/receive", response_model=ApplyFlowResponse)
async def post_receive_po(payload: PoReceiveRequest):
    """收货质检：实收 + 不良品入账；partial_received / fully_received 自动判定。"""
    return service.receive_po_goods(
        payload.po_id,
        payload.receive_qty,
        payload.defect_qty,
        operator=payload.operator,
    )


@app.get("/api/p3/applies", response_model=ApplyListResponse)
async def get_applies(
    dataset_id: str = Query(...),
    sku: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """补货申请列表（可按 SKU / 状态过滤），P2 审批台与 P3 历史记录共用。"""
    return service.list_applies(dataset_id, sku=sku, status=status, limit=limit)


# PACK 9：WebSocket 实时推送（只加不改现有端点）
app.include_router(ws_router)

# PACK 10：Vue 构建产物由 FastAPI 直接提供（只加静态挂载，不改任何现有 API 路由）。
# 放在所有 API/WS 路由之后；check_dir=False 避免 dist 缺失时影响后端启动。
WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"
app.mount(
    "/",
    StaticFiles(directory=str(WEB_DIST), html=True, check_dir=False),
    name="web-dist",
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=False)
