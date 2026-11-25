# CrossPilot · M2·M3 经营分析与智能问数详细设计说明书（LLD V1.0）

> **文档编号**：CP-M2M3-LLD-2026-V1.0
> **代码基线**：`backend/app/modules/m2_m3_bi/{models,schemas,service,router}.py`、`frontend/src/views/HomeWorkbenchView.vue`、`frontend/src/views/m2m3/*.vue`

---

## 1. 需求追溯矩阵（RTM）

| 需求/原型编号 | 验收编号 | API 接口 | 数据表 / 上游来源 | 前端视图 |
|---|---|---|---|---|
| 首页待办 (`/home`) | M2M3-AC-05 | `GET /home/workbench` | `m0_*`, `m1_aftersales_tickets`, `m6_*` | `HomeWorkbenchView.vue` |
| M2-1 广告调节 (`m2a`) | M2M3-AC-04 | `GET /m2/ads`, `POST /m2/ads/{id}/adjust` | `m2_ad_campaigns` | `M2AdsView.vue` |
| M2-2 经营大屏 (`m2b`) | M2M3-AC-01/02 | `GET /m2/overview` | 多模块聚合 | `M2OverviewView.vue` |
| M3-1 竞品监控 (`m3a`) | M2M3-AC-04 | `GET /m3/competitors`, `POST /m3/competitors` | `m3_competitor_watches` | `M3CompetitorsView.vue` |
| M3-2 智能问数 (`m3b`) | M2M3-AC-03/05 | `POST /m3/ask` *(V1.1)* + 聚合读接口 | 只读聚合 + 审计 | `M3AskView.vue` |

---

## 2. 数据库物理表结构设计

### 2.1 `m2_ad_campaigns`（广告投放计划表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `campaign_id` | `VARCHAR(64)` | PK | — | 广告计划 ID `camp_<hex10>` |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 组织与推广 SKU |
| `platform` | `VARCHAR(32)` | NOT NULL | `'Amazon Sponsored'` | 广告渠道 |
| `campaign_name` | `VARCHAR(128)` | NOT NULL | — | 计划名称 |
| `daily_budget_usd` | `FLOAT` | NOT NULL (`>0`) | `50.0` | 日预算（USD） |
| `spend_7d_usd` / `sales_7d_usd` | `FLOAT` | NOT NULL | `280.0` / `1400.0` | 近 7 日广告花费与归因销售 |
| `acos` / `roas` | `FLOAT` | NOT NULL | `0.20` / `5.0` | 广告投入产出比指标 |
| `status` | `VARCHAR(24)` | NOT NULL | `'ACTIVE'` | `ACTIVE` / `PAUSED` |

### 2.2 `m3_competitor_watches`（竞品监控表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `watch_id` | `VARCHAR(64)` | PK | — | 监控记录 ID `watch_<hex10>` |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 组织与我方对标 SKU |
| `competitor_brand` / `asin_or_ref` | `VARCHAR(64)` | NOT NULL | — | 竞品品牌与 ASIN |
| `price_usd` / `rating` | `FLOAT` | `price > 0`, `1.0<=rating<=5.0` | `4.5` | 竞品售价与评分 |
| `review_count` / `bsr_rank` | `INTEGER` | `bsr >= 1` | `120` / `450` | 评论数与类目 BSR 排名 |
| `sentiment_score` | `FLOAT` | NOT NULL | `0.82` | 评论正向情感分（0~1） |
| `negative_topics_json` | `JSONB` | NOT NULL | `[]` | 高频差评痛点标签数组 |
| `last_alert` | `TEXT` | NOT NULL | `''` | 最新异动警示 |
| `updated_at` | `TIMESTAMPTZ` | AUTO | `now()` | 更新时间 |

---

## 3. 核心聚合口径与问数安全守卫逻辑

### 3.1 利润与资金计算口径

```python
# 实盘订单过滤 (V1.1 全量加固)
live_orders = [o for o in m0_orders if not o.is_mock]
# SKU 级利润
cogs_usd = round(sum(o.qty) * unit_cost_usd, 2)
platform_fee_usd = round(gmv_usd * 0.15, 2)
sku_net_profit_usd = round(gmv_usd - cogs_usd - platform_fee_usd, 2)

# 组织级总净利（扣减 7 日广告消耗与已批准售后退款）
org_net_profit_usd = round(sum(sku_net_profit_usd) - total_ad_spend - total_approved_refund, 2)

# PO 承诺资金（RMB，不与 USD 混加）
po_commitment_rmb = sum(po.order_qty * round(unit_cost_usd * 7.2, 2) for po in pos if po.status != "cancelled")
```

### 3.2 只读问数安全守卫与错误码

- **写意图检测规则**：匹配 `delete | drop | update | insert | alter | truncate | 修改 | 删除 | 改价 | 下单 | 退款` 即拒绝执行，返回只读拦截提示并记 `ASK_WRITE_BLOCKED` 审计。
- **错误码字典**：`403 M7-4031`（权限/租户越界）、`404 M7-4041`（广告计划 `campaign_id` 不存在）、`422 M7-4221`（预算 `<= 0`、评分越界、问题为空）。

---

## 4. REST API 完整契约

统一路径前缀：`/api/v1/orgs/{org_id}`

| 端点 | 方法 | 权限码 | 请求 Schema | 错误码 & 审计 |
|---|---|---|---|---|
| `/home/workbench` | `GET` | `m0:read` | — | `403 M7-4031` |
| `/m2/overview` | `GET` | `m2:read` | — | `403 M7-4031` |
| `/m2/ads` | `GET` | `m2:read` | — | `403 M7-4031` |
| `/m2/ads/{campaign_id}/adjust` | `POST` | `m2:edit` | `AdAdjustReq` | `404 M7-4041`, `422`, 记 `AD_ADJUSTED` |
| `/m3/competitors` | `GET` / `POST` | `m3:read` / `m3:edit` | `CompetitorCreateReq` | `422`, 记 `COMPETITOR_ADDED` |
| `/m3/ask` *(V1.1)* | `POST` | `m3:ask` | `AskQueryReq` (`question`) | 写意图拦截记 `ASK_WRITE_BLOCKED`；查询记 `ASK_EXECUTED` |

#### `POST /m2/ads/{campaign_id}/adjust` Payload 示例

```json
// Request
{ "daily_budget_usd": 85.0, "status": "ACTIVE" }
// Response 200
{ "ok": true, "data": { "campaign_id": "camp_amz_704", "daily_budget_usd": 85.0, "status": "ACTIVE" }, "error": null, "trace_id": "tr_m2_01" }
```

---

## 5. 前端视图组件规范

- **`HomeWorkbenchView.vue`**：6 项 KPI 卡片 + 4 项动态待办流转卡（M7 跳转 `/m7/compliance`）+ 8 项快捷通道按钮；对 `mock_buyer` 展示 403 引导跳转 `/m1/simulator`。
- **`M2AdsView.vue`**：行内可编辑 `daily_budget_usd` 输入框 + 「保存启用 / 暂停」双按钮。
- **`M2OverviewView.vue`**：四格财务 KPI + 单 SKU 盈利拆解表 + 多渠道结算对账表，右上角「追问智能助手 →」跳 `/m3/ask`。
- **`M3CompetitorsView.vue`** & **`M3AskView.vue`**：竞品监控表/新增表单；问答预设问题按钮 + 写意图安全阻断 + 溯源输出区。
