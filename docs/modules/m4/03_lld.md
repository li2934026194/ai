# CrossPilot · M4 智能选品与过会决策详细设计说明书（LLD V1.0）

> **文档编号**：CP-M4-LLD-2026-V1.0
> **代码基线**：`backend/app/modules/m4_selection/{models,schemas,service,router}.py`、`frontend/src/views/m4/*.vue`

---

## 1. 需求追溯矩阵（RTM）

| 需求/原型编号 | 验收编号 | API 接口 | 数据表 | 前端视图 |
|---|---|---|---|---|
| M4-1 候选导入 (`m4a`) | M4-AC-01, M4-AC-06 | `GET /m4/candidates`, `POST /m4/candidates` | `m4_candidates` | `M4ImportView.vue` |
| M4-2 选品工作台 (`m4b`) | M4-AC-01, M4-AC-02 | `POST /m4/candidates/{id}/evaluate` | `m4_candidates` | `M4WorkbenchView.vue` |
| M4-3 测款终审 (`m4c`) | M4-AC-03, M4-AC-04, M4-AC-05 | `POST /m4/candidates/{id}/decide` | `m4_candidates`, `m0_products` | `M4ApprovalView.vue` |

---

## 2. 数据库物理表结构设计（PostgreSQL 15+ 标准方言）

> **存储规范**：基于 **PostgreSQL 15+ (`JSONB`, `TIMESTAMPTZ`, `asyncpg`)**，选品五维评分存为原生 `JSONB`，过会批准写 `m4_candidates` 与 `m0_products` 在同一事务中提交；批量导入 CSV 原件通过 `FileStorage` 存入 **MinIO**，大批量导入按需由 **Redis + Celery** 异步调度。

### 2.1 `m4_candidates`（选品候选评估表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `candidate_id` | `VARCHAR(64)` | PK | — | 主键 `cand_<hex10>` |
| `org_id` | `VARCHAR(64)` | NOT NULL, INDEX | — | 租户 ID |
| `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 建议商品编码（自动转大写） |
| `title` / `category_cn` | `VARCHAR(255/64)` | NOT NULL | — | 商品标题与中文类目 |
| `source_channel` | `VARCHAR(64)` | NOT NULL | `'1688 工厂直采'` | 货源渠道与性质来源 |
| `target_price_usd` | `FLOAT` | NOT NULL (`>0`) | — | 目标站售价（USD） |
| `est_cost_rmb` / `est_shipping_rmb` | `FLOAT` | NOT NULL (`>0` / `>=0`) | — | 预估采购成本与头程（RMB） |
| `est_margin_pct` | `FLOAT` | NOT NULL | `0.0` | 扣除 15% 佣金与采购/头程后净毛利率（%） |
| `scores_json` | `JSONB` | NOT NULL | `{...}` | 五维评分字典 (`demand`/`competition`/`margin`/`supply`/`compliance`) |
| `total_score` | `FLOAT` | NOT NULL | `0.0` | 五维加权综合分 |
| `status` | `VARCHAR(32)` | NOT NULL | `'DISCOVERED'` | `DISCOVERED`/`EVALUATING`/`PENDING_APPROVAL`/`APPROVED`/`REJECTED` |
| `operator_note` | `TEXT` | NOT NULL | `''` | 选品调研推荐理由与备注 |
| `submitter_id` / `approver_id` | `VARCHAR(64)` | NULLABLE | `NULL` | 送审人 ID 与审批人 ID（禁相等） |
| `decision_reason` | `TEXT` | NULLABLE | `NULL` | 终审通过/驳回评语 |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | — | `now()` | 创建与更新时间 |

---

## 3. 核心算法、状态机与错误码

### 3.1 利润与加权评分算子

```python
def compute_margin_pct(target_price_usd: float, est_cost_rmb: float, est_shipping_rmb: float) -> float:
    fx = 7.2
    total_cost_usd = (est_cost_rmb + est_shipping_rmb) / fx
    platform_fee = target_price_usd * 0.15
    net = target_price_usd - total_cost_usd - platform_fee
    return round((net / target_price_usd) * 100.0, 2) if target_price_usd > 0 else 0.0

def compute_total_score(scores: dict[str, float]) -> float:
    w = {"demand": 0.25, "competition": 0.20, "margin": 0.25, "supply": 0.15, "compliance": 0.15}
    return round(sum(float(scores.get(k, 75)) * wt for k, wt in w.items()), 1)
```

### 3.2 状态机跃迁与错误码

```
[导入] --> DISCOVERED --(保存评估)--> EVALUATING --(提交审批)--> PENDING_APPROVAL
                                                                     |
                                           +-------------------------+-------------------------+
                                           | approver 终审 (submitter != actor)                |
                                           v                                                   v
                                        APPROVED                                            REJECTED
                              (同事务写/升级 M0Product)                                 (不写入 M0 主档)
```

| HTTP 状态 | 错误码 | 触发场景 |
|---|---|---|
| `403` | `M7-4031` | 非 `selector` 调 `/evaluate`、非 `approver` 调 `/decide` 或跨租户访问 |
| `403` | `M7-4032` | `submitter_id == actor.user_id` 试图自批过会 |
| `404` | `M7-4041` | 操作不存在的 `candidate_id` |
| `422` | `M7-4221` | `target_price_usd <= 0`、`est_cost_rmb <= 0`、五维评分越界（`<0` 或 `>100`）、审批意见少于 2 字 |

---

## 4. REST API 完整契约与审计模板

统一前缀：`/api/v1/orgs/{org_id}/m4`

| 端点 | 方法 | 权限码 | 请求 Schema | 审计 `action_code` & 中文日志 |
|---|---|---|---|---|
| `/candidates` | `GET` | `m4:read` | — | 按 `updated_at DESC` 返回全部候选 |
| `/candidates` | `POST` | `m4:edit` | `CandidateImportReq` | `CANDIDATE_IMPORTED`: `导入选品候选 {sku}，初算毛利 {margin}%` |
| `/candidates/{id}/evaluate` | `POST` | `m4:edit` | `CandidateEvaluateReq` | `CANDIDATE_EVALUATED`: `评估 {sku}（总分 {score}，毛利 {margin}%，提交={submit}）` |
| `/candidates/{id}/decide` | `POST` | `m4:approve` | `CandidateDecisionReq` | `CANDIDATE_DECIDED`: `终审 {sku}（{decision}）：{note}` |

#### `POST /candidates/{id}/decide` Payload 示例

```json
// Request
{ "decision": "APPROVED", "note": "毛利率达标且无商标冲突，同意小批测款并转 M0 主档" }
// Response 200
{ "ok": true, "data": { "candidate_id": "cand_9a8b", "sku": "SKU-NEW-01", "status": "APPROVED", "m0_synced": true }, "error": null, "trace_id": "tr_m4_01" }
```

---

## 5. 前端视图组件规范（`frontend/src/views/m4/`）

- **`M4ImportView.vue`**：单品导入表单，录入即时预览预估净毛利率，导入后支持直达 `/m4/workbench`。
- **`M4WorkbenchView.vue`**：左列候选清单（状态徽章 + 毛利率）+ 右列成本/五维评分滑块与双按钮（「保存评估」/「保存并提交审批」）。
- **`M4ApprovalView.vue`**：展示待审与已决队列，提交人视图禁用审批并提示 SoD；`approver` 填写理由一键同意/驳回，同意后出现「前往 M7-1 开始内容制作 →」引导链接。
