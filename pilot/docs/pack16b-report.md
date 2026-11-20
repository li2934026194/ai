# PACK 16b 执行报告（路线/目标回灌交期，I-10）

- 日期：2026-11-19
- 前置：PACK 16a 已通过（σ 改样本外残差、ar1 真接、回测合并错位修复）
- 范围：只让 `route_code` / `objective_mode` 真正参与计算，不新增页面、不改既有默认口径

## 一、问题原状（I-10）

`route_code` 全项目只在三处起作用：`api/service.create_apply` 校验合法性与落库、`schema.replenish_apply` 存字段、前端下拉框传值。**建议量本身从来没用过路线**——`create_apply` 的 `qty_propose` 默认取 `_sku_detail(session, dataset_id, sku)`，不带路线；`compare_routes` 只算"能撑几天/运费多少"，不回写交期。所以"切路线重算建议量"这句话此前不成立。

## 二、口径冲突先定死（不先定就会算重）

- 产品交期是四段之和：`lead_prod 7 + lead_transit 35 + lead_customs 6 + lead_inbound 5 = 53`。
- `ROUTE_ASSUMPTIONS` 的 `transit_days` 注释写明"**已含起运+干线+清关+入仓**"；海运是 45。
- 若把 45 当 `lead_transit` 再加清关 6 与入仓 5，会得到 7+45+6+5=63，**同一段路算两遍**。

统一定义（写进 `core/routes.py` 的 `ROUTE_LEAD_BASIS`，唯一定义处）：

```
路线总交期 = lead_prod + transit_days
```

即路线接管后三段（`lead_transit` 取 `transit_days`，`lead_customs=0`、`lead_inbound=0`）。海运因此是 52 天，与产品口径 53 天差 1 天——这 1 天是两套合成假设本身的差（产品后三段合计 46 vs 海运 45），不是重复计算，也不硬对齐成 53。

## 三、改动清单

| 文件 | 位置 | 改动 |
|---|---|---|
| `core/routes.py` | 头部 / `__all__` | 增 `ROUTE_LEAD_BASIS`、`route_lead_time()`、`with_route()`、`with_objective()`（`dataclasses.replace`，不改原对象） |
| `api/service.py` | `_sku_detail` 签名与 `InventoryParams` 之后 | 增 `route_code` / `objective_mode` 两个可选参数，传了才回灌；不传保持原口径 |
| `api/service.py` | `meta` | 增 `route_code` / `objective_mode` / `lead_time_basis`，把"按哪条路线算的"写进响应 |
| `api/service.py` | `sku_detail` / `create_apply` | 透传参数；`qty_propose` 缺省时按所选路线与目标重算（这正是 I-10 的病灶） |
| `api/main.py` | `/api/p3/sku/{sku}` | 增 `route` / `objective` 查询参数 |
| `api/schemas.py` | `Meta` | 增三个可选字段（默认 None，旧响应仍合法） |
| `agents/tools.py` | `submit_replenish_apply` docstring | 明说"route/objective 会真正改变这条建议量"，避免模型继续按旧认知解释 |
| `tests/test_routes.py` | 新增 5 条 | 交期口径、接管三段不叠加、目标覆盖服务水平与周期、接口传 route 后 lead_time 变短且建议量不增、接口传 objective 后服务水平与周期被覆盖 |

未动：前端页面、路由词表、评测集、判定口径、`replenish_apply` 表结构。

## 四、实证（SKU-017，`ds_00b31ed333b05de698c0`，μ 8.7722、在手 279、MOQ 300/整箱 60）

默认口径（不传参数）：`lead_time=53`、`qty=360`、`capital=3600`、`SL=0.97` ——与 16a 收口值逐位相同，说明加参数没有动摇既有对外数字。

| 路线 | 总交期 | σ_LT | SS | ROP | 目标水位 | qty | 资金 |
|---|---|---|---|---|---|---|---|
| sea 海运 | 52 | 19.36 | 36.41 | 492.57 | 624.15 | 360 | 3600 |
| air 空运 | 14 | 10.05 | 18.89 | 141.71 | 273.29 | **0** | 0 |
| rail 铁运 | 29 | 14.46 | 27.19 | 281.59 | 413.17 | 300 | 3000 |
| truck 卡航 | 21 | 12.30 | 23.14 | 207.36 | 338.94 | 300 | 3000 |

| 目标 | 交期 | 覆盖周期 | qty | 资金 | 服务水平 |
|---|---|---|---|---|---|
| sales 保销量 | 53 | 22 | 480 | 4800 | 0.99 |
| profit 保利润 | 53 | 15 | 360 | 3600 | 0.97 |
| cash 保现金 | 53 | 8 | 300 | 3000 | 0.90 |

两条必须讲清的结论：其一，空运下建议量为 **0** 不是 bug——交期 14 天、在手 279 件、日销 8.77 件，库存足够覆盖到货，算法判"本轮无需补货"，随后 `create_apply` 会按 E-1106 拒绝提交（这条链路本来就设计成不许下 0 件单）。其二，铁运/卡航的建议量都落在 **300**，是 MOQ 抬升的结果（未取整量 134 / 59 件 < MOQ），不是算错；这一点必须在页面与答辩里说清，否则看起来像"换路线没用"。

## 五、验证

- `pytest tests -q`：**74 passed + 6 subtests in 34.49s**（16a 收口时 69，本轮 +5）。
- 默认路径零变化：同一 SKU 不传参数仍 53 / 360 / 3600 / 0.97。
- 接口往返：`/api/p3/sku/SKU-017?dataset_id=...&route=air` 返回 `meta.route_code=air`、`meta.lead_time_basis` 含 `transit_days`、`lead_time<53`、`qty<=360`（由 `test_api_route_param_changes_derivation` 固化）。
- 库计数：`replenish_apply=3`、`purchase_order=1`，未因本轮变化（本轮未提交任何申请）。

## 六、欠账（本轮不做，已登记）

1. **前端未接**：`P3SkuDetail.vue` 的 `routeCode` 目前只用于"提交申请"表单，页面上的补货建议卡片仍按默认口径显示。要让用户"在页面上切路线就看到建议量变"，需要加视图切换 + 重建 dist，列为 PACK 18（双壳一致性）内的活。
2. **`route-plan` 端点与 SKU 详情仍各算一套**：`/api/p3/route-plan` 的三目标用 `compare_objectives`，SKU 详情用 `with_objective`，两者服务口径相同但覆盖周期取整方式不同（前者保留小数、后者取整到天）。对外须统一说法：路线对比页是"方案对比"，SKU 详情是"该目标下的单条建议"，数字允许差 1 天覆盖期，但必须写在同一张口径表里。
3. **断货日/总成本随路线变化的验证未做**：本轮只证到 SS/ROP/目标水位/建议量/资金，`simulate_stockout` 的到货日期仍取产品默认交期，未按路线重算；这条要做，否则"切路线重算断货日"依旧是空话。

## 七、结论

16b 通过：路线与目标从"只落库"变成"真参与计算"，有接口参数、有溯源字段、有 4 条测试固化，默认口径零漂移。剩下三条欠账都是"对外说法与界面"层面的，不影响内核正确性，但不许在文档里写成"已全部打通"。
