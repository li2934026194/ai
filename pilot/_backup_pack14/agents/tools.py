"""Agent 工具层（agents/tools.py，17 号契约 3.6）。

分两组：
  A1 客服白名单（结构约束）：query_order / query_logistics / draft_reply / search_knowledge
      —— 全部只读、只出草稿或只检索，没有任何「发送」能力。
      —— search_knowledge 走 Milvus 语义检索，失败降级不抛异常（PACK 8）。
  A5/A6 计算工具：forecast_backtest / run_replenish —— 全部转调 core 纯函数。

由 registry.py 用 importlib 按文件路径加载（避开本地 agents/ 与 SDK agents 包同名冲突）。
落库 trace 通过 _log 回调注入，避免工具层直接依赖 db（保持可测）。
"""

from __future__ import annotations

import sqlite3

from agents import function_tool

from core import InventoryParams
from core.models import MODELS
from core.backtest import backtest
from core.demand import calibrate_demand
from core.inventory import build_suggestion

# trace 落库回调，由 registry 注入；默认空实现（单独测工具时不炸）
_TRACE_SINK = None


def set_trace_sink(sink) -> None:
    global _TRACE_SINK
    _TRACE_SINK = sink


def _log(agent: str, tool: str) -> None:
    if _TRACE_SINK is not None:
        _TRACE_SINK(agent, tool)


def _db_path():
    from db import DB_PATH

    return DB_PATH


def load_sku_rows(sku: str, dataset_name: str | None = None):
    """读库取一个 SKU 的 daily + inventory 行 + dataset_id（duck-typed list[dict]）。
    默认取「合成-断货14天」数据集（有真实断货场景，演示最有说服力）。
    返回三元组 (daily, inventory, dataset_id)。

    取数走 db.py 的 engine（默认 PostgreSQL，随 DATABASE_URL 切换），
    不再直连 SQLite 文件。date 归一化为 ISO 字符串，保持返回结构不变。
    """
    from sqlalchemy import text

    from db import engine

    with engine.connect() as con:
        if dataset_name:
            did = con.execute(
                text("SELECT dataset_id FROM datasets WHERE name=:name"),
                {"name": dataset_name},
            ).scalar()
        else:
            did = con.execute(
                text("SELECT dataset_id FROM datasets WHERE name='合成-断货14天' LIMIT 1")
            ).scalar()

        daily_rows = con.execute(
            text(
                "SELECT sku,date,qty FROM sales_daily "
                "WHERE dataset_id=:did AND sku=:sku ORDER BY date"
            ),
            {"did": did, "sku": sku},
        ).mappings().all()
        inventory_rows = con.execute(
            text(
                "SELECT sku,date,on_hand,in_transit FROM inventory_daily "
                "WHERE dataset_id=:did AND sku=:sku ORDER BY date"
            ),
            {"did": did, "sku": sku},
        ).mappings().all()

    daily = []
    for r in daily_rows:
        d = r["date"]
        daily.append(
            {
                "sku": r["sku"],
                "date": d.isoformat() if hasattr(d, "isoformat") else d,
                "qty_raw": r["qty"],
                "source_type": "SYNTHETIC",
            }
        )
    inventory = []
    for r in inventory_rows:
        d = r["date"]
        inventory.append(
            {
                "sku": r["sku"],
                "date": d.isoformat() if hasattr(d, "isoformat") else d,
                "on_hand": r["on_hand"],
                "in_transit": r["in_transit"],
            }
        )
    return daily, inventory, did


def load_sku_cost(sku: str, dataset_id: str | None = None):
    """返回 products 一行：unit_cost/price/moq/pack_size + lead 四段。缺成本用 None。

    取数走 db.py 的 engine（默认 PostgreSQL，随 DATABASE_URL 切换），
    不再直连 SQLite 文件。返回八元组结构不变。
    """
    from sqlalchemy import text

    from db import engine

    with engine.connect() as con:
        if dataset_id:
            row = con.execute(
                text(
                    "SELECT unit_cost,price,moq,pack_size,lead_prod,lead_transit,"
                    "lead_customs,lead_inbound FROM products "
                    "WHERE dataset_id=:did AND sku=:sku"
                ),
                {"did": dataset_id, "sku": sku},
            ).mappings().first()
        else:
            row = con.execute(
                text(
                    "SELECT unit_cost,price,moq,pack_size,lead_prod,lead_transit,"
                    "lead_customs,lead_inbound FROM products WHERE sku=:sku LIMIT 1"
                ),
                {"sku": sku},
            ).mappings().first()

    if not row:
        return None, None, 120, 60, 7, 35, 6, 5
    return (
        row["unit_cost"], row["price"], row["moq"], row["pack_size"],
        row["lead_prod"], row["lead_transit"], row["lead_customs"], row["lead_inbound"],
    )


# ---------------------------------------------------------------------------
# A1 客服白名单 —— 只读 + 只出草稿，绝无发送类
# ---------------------------------------------------------------------------
@function_tool
def query_order(order_id: str) -> str:
    """按订单号查询订单状态（只读）。不提供任何修改或发送能力。"""
    _log("A1_support", "query_order")
    return f"订单 {order_id}：已付款，待发货（查询自订单表，只读）。"


@function_tool
def query_logistics(order_id: str) -> str:
    """按订单号查询物流轨迹（只读）。不提供任何修改或发送能力。"""
    _log("A1_support", "query_logistics")
    return f"订单 {order_id}：包裹已出库，预计 2 日送达（查询自物流表，只读）。"


@function_tool
def draft_reply(content: str) -> str:
    """生成客服回复草稿。只返回草稿文本，需人工确认后由人工发送——本工具无发送能力。"""
    _log("A1_support", "draft_reply")
    return f"【草稿·需你确认后发送】{content}"


def _search_knowledge_impl(query: str, top_k: int = 3) -> str:
    """search_knowledge 的实现体（普通函数，便于单测直调；包装器只转调它）。"""
    _log("A1_support", "search_knowledge")
    try:
        from rag import milvus_store

        r = milvus_store.search(query, top_k=top_k)
    except Exception as exc:  # 连 rag 包都 import 失败时也要降级，不打断对话
        r = {"retrieval_ok": False, "results": [], "count": 0, "error": f"{type(exc).__name__}: {exc}"}

    if not r.get("retrieval_ok"):
        return (
            "retrieval_ok=false｜知识库检索当前不可用，本次没有可引用的知识。"
            "请如实告知用户暂时查不到资料，不要编造答案。"
            f"（内部原因：{r.get('error', 'unknown')}）"
        )

    lines = [f"retrieval_ok=true｜命中 {r['count']} 条（以下均为 SYNTHETIC 演示知识，非真实客服数据）："]
    for i, hit in enumerate(r["results"], 1):
        lines.append(
            f"[{i}] 分类={hit['category']}｜距离={hit['distance']:.4f}｜source_type={hit['source_type']}\n"
            f"    问：{hit['question']}\n"
            f"    答：{hit['answer']}"
        )
    return "\n".join(lines)


@function_tool
def search_knowledge(query: str, top_k: int = 3) -> str:
    """从客服知识库（Milvus 语义检索）查相关 FAQ，返回命中的问答与来源标注。

    只读检索，无发送能力。检索不可用（Milvus 宕机/超时）时返回
    retrieval_ok=false 的空结果，绝不抛异常打断对话。
    知识全部为 SYNTHETIC 演示数据，回答时必须如实标注，不得说成真实客服记录。
    """
    return _search_knowledge_impl(query, top_k=top_k)


# A1 白名单常量（结构约束的唯一来源；测试 T-7 直接检查这个列表）
# 全部只读/只出草稿/只检索，无任何「发送」能力。
A1_TOOLS = [query_order, query_logistics, draft_reply, search_knowledge]


# ---------------------------------------------------------------------------
# PACK 11：多路线方案对比 + 三目标决策（A6）
# 只新增工具，run_replenish 一行未动；计算结果来自 core.routes 的合成假设参数，
# 绝不伪装成真实物流报价，也不产生任何收益百分比。
# ---------------------------------------------------------------------------
def _route_compare_impl(sku: str, dataset_name: str = "合成-正在缺货") -> str:
    """route_compare 的实现体（普通函数，便于单测直调；包装器只转调它）。"""
    _log("A6_replenish", "route_compare")
    try:
        from sqlalchemy import text

        from api import service
        from db import engine

        with engine.connect() as con:
            did = con.execute(
                text("SELECT dataset_id FROM datasets WHERE name=:name"),
                {"name": dataset_name},
            ).scalar()
        if not did:
            return f"未找到数据集「{dataset_name}」，无法生成方案对比。"

        plan = service.route_plan(did, sku)
        base = plan["base"]
        lines = [
            plan["assumption_note"],
            f"SKU {plan['sku']}：基础建议量 {base['base_qty']} 件，"
            f"（在手 {base['on_hand']} + 在途 {base['in_transit']}）÷ 日均 {base['mu_daily']}"
            f" = 可撑 {base['cover_days']:.2f} 天。",
            "【四条运输路线（合成假设参数）】",
        ]
        for r in plan["routes"]:
            lines.append(
                f"{r['name']}：时效 {r['transit_days']} 天，单件运费 ¥{r['unit_freight']}，"
                f"最小起运量 {r['min_qty']} 件，可靠性 {r['reliability']}，"
                f"总运费 ¥{r['total_freight']:,.0f}，"
                f"到货时剩余可撑 {r['arrival_remaining_days']:.1f} 天，"
                f"缺货风险{r['risk_level']}（指数 {r['risk_index']:.2f}）｜{r['recommendation']}"
            )
        lines.append("【三目标决策（合成假设参数）】")
        for o in plan["objectives"]:
            cap = "缺成本，无法计算" if o["capital"] is None else f"¥{o['capital']:,.0f}"
            lines.append(
                f"{o['name']}：服务水平 {o['service_level']:.0%}，建议量 {o['qty']} 件，"
                f"资金占用 {cap}｜{o['difference_from']}"
            )
        return "\n".join(lines)
    except Exception as exc:
        return f"方案对比暂不可用（{type(exc).__name__}: {exc}）；请如实告知用户，不要编造数字。"


@function_tool
def route_compare(sku: str, dataset_name: str = "合成-正在缺货") -> str:
    """对指定 SKU 做「海运/空运/铁运/卡航」四条路线与「保销量/保利润/保现金」三目标方案对比。

    运输时效、单件运费、最小起运量、可靠性与决策偏好参数全部是 core/routes.py 里
    显式定义的「合成假设参数」，不是真实物流报价；回答时必须如实标注，
    不得说成真实承运商报价，也不得编造任何收益数字。只用本工具返回的数字。
    """
    return _route_compare_impl(sku, dataset_name)


# ---------------------------------------------------------------------------
# A5 / A6 计算工具 —— 转调 core，无自造算法
# ---------------------------------------------------------------------------
@function_tool
def forecast_backtest(sku: str) -> str:
    """对指定 SKU 跑走步回测，返回最佳模型名与各模型 WAPE（转调 core.backtest）。"""
    daily, inventory, _did = load_sku_rows(sku)
    series = calibrate_demand(daily, inventory, sku, min_history=60)
    bt = backtest(series, MODELS)
    best = bt.best or "无可用模型"
    lines = [f"最佳模型={best}"]
    for name, m in bt.per_model.items():
        wape = "None" if m.wape is None else f"{m.wape:.4f}"
        lines.append(f"{name}.WAPE={wape}")
    # S1 断货场景：snaive 周对齐偏移不可靠，按契约不参与 best 选优但留在对比表。
    # 必须显式标注，否则 LLM 看到「snaive WAPE 更低却没选它」会误报为 bug。
    if any(series.is_stockout):
        lines.append(
            "说明：本场景存在断货日，snaive 因周对齐偏移不可靠，不参与最佳模型评选（其 WAPE 仅供对比参考）"
        )
    _log("A5_forecast", "forecast_backtest")
    return "；".join(lines)


@function_tool
def run_replenish(sku: str, holding_days: int = 45) -> str:
    """对指定 SKU 算补货建议量与占用资金（调 core.build_suggestion，与 API 同源）。"""
    daily, inventory, did = load_sku_rows(sku)
    series = calibrate_demand(daily, inventory, sku, min_history=60)

    unit_cost, price, moq, pack_size, lp, lt, lc, li = load_sku_cost(sku, did)
    inv = InventoryParams(
        unit_cost=unit_cost,
        price=price,
        moq=moq,
        pack_size=pack_size,
        lead_prod=lp,
        lead_transit=lt,
        lead_customs=lc,
        lead_inbound=li,
        review_period=15,
        holding_days=holding_days,
    )

    # 补货时点 = 数据截止日（as_of）：取 inventory_daily 最后一天的真实在手/在途。
    as_of_row = inventory[-1] if inventory else None
    on_hand = float(as_of_row["on_hand"]) if as_of_row else 0.0
    in_transit = float(as_of_row["in_transit"]) if as_of_row else 0.0

    # ---- 唯一建议算法：与 api/service.py 共用 core.build_suggestion ----
    sug = build_suggestion(series, inv, on_hand, in_transit)
    ctx: dict = sug.inputs_json
    mu_daily = float(ctx["mu_daily"])
    lead_time = int(ctx["lead_time"])
    qty = int(sug.qty)
    amount = sug.amount

    _log("A6_replenish", "run_replenish")
    if amount is None:
        amt_txt = "成本未填，金额无法计算"
    else:
        amt_txt = f"占用资金 {amount:,.0f} 元"
    extra = f"（{sug.reason}）" if sug.reason else ""
    return (
        f"SKU {sku}：日均 {mu_daily:.2f} 件，服务水平 {sug.service_level:.0%}"
        f"（{sug.service_level_source}），总交期 {lead_time} 天，"
        f"σ_LT={sug.sigma_lt:.2f}，SS={sug.ss:.2f}，"
        f"建议补 {qty} 件{extra}，{amt_txt}。"
    )


# ---------------------------------------------------------------------------
# PACK 12：补货审批履约闭环四个工具（A6）
# 【合成演示业务，非真实生产业务】状态流转与数量校验全部在 core/replenish_flow，
# 落库在 api/service；工具层只做「取数据集 → 调 service → 人话回执」，不写死任何状态。
# 原有 run_replenish / route_compare 一行未动。
# ---------------------------------------------------------------------------
def _dataset_id_by_name(dataset_name: str) -> str | None:
    """按数据集名取 dataset_id（找不到返回 None，由调用方给出降级文案）。"""
    from sqlalchemy import text

    from db import engine

    with engine.connect() as con:
        return con.execute(
            text("SELECT dataset_id FROM datasets WHERE name=:name"),
            {"name": dataset_name},
        ).scalar()


def _flow_error_text(exc: Exception) -> str:
    """结构化业务错误 → 给 LLM 看的可引用文案（绝不假装成功）。"""
    code = getattr(exc, "code", "")
    message = getattr(exc, "message", str(exc))
    return f"操作被拦截（{code}）：{message}。请如实告知用户，不要编造已成功的结论。"


@function_tool
def submit_replenish_apply(
    sku: str,
    dataset_name: str = "合成-正在缺货",
    route_code: str = "sea",
    objective_mode: str = "profit",
    submit_user: str = "demo_submitter",
) -> str:
    """提交补货申请（数量默认取该 SKU 的实时建议量），提交后状态变为待审批（pending_approve）。"""
    _log("A6_replenish", "submit_replenish_apply")
    from api import service

    did = _dataset_id_by_name(dataset_name)
    if not did:
        return f"未找到数据集「{dataset_name}」，无法提交补货申请。"
    try:
        r = service.create_apply(
            did,
            sku,
            route_code=route_code,
            objective_mode=objective_mode,
            submit_user=submit_user,
        )
    except Exception as exc:
        return _flow_error_text(exc)
    a = r["apply"]
    return (
        f"已提交补货申请 {a['apply_id']}：SKU {a['sku_id']} 建议 {a['qty_propose']} 件"
        f"（占用资金 {'缺成本无法计算' if a['capital'] is None else f'¥{a["capital"]:,.0f}'}），"
        f"路线 {a['route_code']}、目标 {a['objective_mode']}，"
        f"当前状态 {a['status_label']}（{a['status']}），提交人 {a['submit_user']}。"
        f"全部为合成演示业务，非真实采购单据。"
    )


@function_tool
def approve_apply(apply_id: str, approve_user: str = "demo_approver") -> str:
    """审批通过一条补货申请：状态 approved，并自动生成一张采购单（订单量=申请数量）。"""
    _log("A6_replenish", "approve_apply")
    from api import service

    try:
        r = service.approve_apply(apply_id, approve_user=approve_user)
    except Exception as exc:
        return _flow_error_text(exc)
    po = r["purchase_order"]
    return (
        f"申请 {r['apply']['apply_id']} 已通过（审批人 {r['apply']['approve_user']}），"
        f"生成采购单 {po['po_id']}：订单量 {po['order_qty']} 件，状态 {po['status_label']}，"
        f"预计到货 {po['expect_arrive']}。可直接用该 po_id 做收货质检。"
    )


@function_tool
def reject_apply(
    apply_id: str,
    reject_reason: str,
    approve_user: str = "demo_approver",
) -> str:
    """驳回一条补货申请：必须填写驳回理由（为空会被拦截），驳回后状态 rejected 且不再流转。"""
    _log("A6_replenish", "reject_apply")
    from api import service

    try:
        r = service.reject_apply(
            apply_id, approve_user=approve_user, reject_reason=reject_reason
        )
    except Exception as exc:
        return _flow_error_text(exc)
    return (
        f"申请 {r['apply']['apply_id']} 已驳回（审批人 {r['apply']['approve_user']}），"
        f"理由：{r['apply']['reject_reason']}，状态拒批后不可再流转。"
    )


@function_tool
def receive_po_goods(
    po_id: str,
    receive_qty: int,
    defect_qty: int = 0,
    operator: str = "demo_receiver",
) -> str:
    """采购单收货质检：累计实收与不良品，自动判定部分收货/完全收货；收满后对应申请关闭。"""
    _log("A6_replenish", "receive_po_goods")
    from api import service

    try:
        r = service.receive_po_goods(
            po_id, receive_qty, defect_qty, operator=operator
        )
    except Exception as exc:
        return _flow_error_text(exc)
    po = r["purchase_order"]
    return (
        f"采购单 {po['po_id']} 收货完成：本次实收 {receive_qty} 件、不良 {defect_qty} 件，"
        f"累计实收 {po['receive_qty']}/{po['order_qty']} 件，状态 {po['status_label']}；"
        f"对应申请 {r['apply']['apply_id']} 当前状态 {r['apply']['status_label']}。"
        f"（合成演示业务，非真实入库凭证）"
    )


__all__ = [
    "A1_TOOLS", "query_order", "query_logistics", "draft_reply", "search_knowledge",
    "forecast_backtest", "run_replenish", "route_compare", "load_sku_rows", "load_sku_cost",
    "set_trace_sink",
    # PACK 12：补货审批履约闭环四个工具（只新增）
    "submit_replenish_apply", "approve_apply", "reject_apply", "receive_po_goods",
]
