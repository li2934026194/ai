# CrossPilot · M1 客服导购与售后闭环详细设计说明书（LLD V1.0）

> **文档编号**：CP-M1-LLD-2026-V1.0
> **代码基线**：`backend/app/modules/m1_cs/{models,schemas,service,router}.py`、`backend/app/contracts/voice_faq_contract.py`、`frontend/src/views/m1/*.vue`

---

## 1. 需求追溯矩阵（RTM）

| 需求/原型编号 | 验收编号 | API 接口 | 数据表 | 前端视图 |
|---|---|---|---|---|
| M1-1 会话与建单 (`m1a`) | M1-AC-03, M1-AC-05 | `GET /m1/sessions`, `POST /m1/sessions/{id}/reply`, `POST /m1/aftersales` | `m1_cs_sessions`, `m1_aftersales_tickets` | `M1SessionsView.vue` |
| M1-2 导购 FAQ (`m1b`) | M1-AC-01 | `GET /m1/faqs`, `POST /m1/faqs` | `m1_faq_entries` | `M1FaqsView.vue` |
| M1-4 买家模拟器 (`m1d`) | M1-AC-02 | `POST /m1/simulator/ask` | `m1_cs_sessions`, `m1_faq_entries` | `M1SimulatorView.vue` |
| M1-3 售后退款审批 (`m1c`) | M1-AC-03, M1-AC-04 | `GET /m1/aftersales`, `POST /m1/aftersales/{id}/decide` | `m1_aftersales_tickets` | `M1AftersalesView.vue` |

---

## 2. 数据库物理表结构设计

### 2.1 `m1_faq_entries`（SKU 导购痛点与 FAQ 表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `faq_id` | `VARCHAR(64)` | PK | — | 主键 `faq_<hex10>` |
| `org_id` | `VARCHAR(64)` | NOT NULL, INDEX, UQ(`org_id`,`sku`) | — | 租户 ID |
| `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 关联商品 SKU |
| `pain_points_json` | `JSONB` | NOT NULL | `[]` | 买家痛点列表 |
| `faq_pairs_json` | `JSONB` | NOT NULL | `[]` | `[{"q":"...","a":"..."}]` 问答对列表 |
| `updated_at` | `TIMESTAMPTZ` | AUTO | `now()` | 更新时间 |

### 2.2 `m1_cs_sessions`（客服与模拟会话表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `session_id` | `VARCHAR(64)` | PK | — | 会话 ID `cs_<hex10>` |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 租户与商品 SKU |
| `buyer_name` / `channel` | `VARCHAR(64/32)` | NOT NULL | — | 买家名与渠道（模拟固定标 `Buyer Simulator (MOCK)`） |
| `question` / `reply` | `TEXT` | NOT NULL | `''` | 买家原问与客服/AI 建议回复 |
| `is_mock` | `BOOLEAN` | NOT NULL | `TRUE` | 强演示隔离标记 |
| `status` | `VARCHAR(24)` | NOT NULL | `'OPEN'` | `OPEN` / `REPLIED` |
| `handler_id` | `VARCHAR(64)` | NULLABLE | `NULL` | 接管回复人 ID |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `now()` | — | 进线时间 |

### 2.3 `m1_aftersales_tickets`（售后赔付审批表）

| 字段名 | SQL 类型 | 约束 | 默认值 | 说明 |
|---|---|---|---|---|
| `ticket_id` | `VARCHAR(64)` | PK | — | 工单 ID `tkt_<hex10>` |
| `org_id` / `sku` | `VARCHAR(64)` | NOT NULL, INDEX | — | 租户与 SKU |
| `order_ref` / `platform` | `VARCHAR(64/32)` | NOT NULL | `'Amazon US'` | 关联订单号与销售平台 |
| `issue_type` | `VARCHAR(64)` | NOT NULL | — | 售后问题分类 |
| `refund_usd` | `FLOAT` | NOT NULL (`>=0`) | `0.0` | 申请退款金额（USD） |
| `evidence_note` | `TEXT` | NOT NULL | `''` | 客服核验凭证说明 |
| `status` | `VARCHAR(24)` | NOT NULL | `'PENDING_APPROVAL'` | `PENDING_APPROVAL` / `APPROVED` / `REJECTED` |
| `submitter_id` / `approver_id` | `VARCHAR(64)` | NOT NULL / NULLABLE | — | 提交人与审批人（严格禁止相等） |
| `decision_note` | `TEXT` | NULLABLE | `NULL` | 主管审批意见 |

---

## 3. 状态流转与异常错误码

### 3.1 售后工单状态机

```
[cs 提交售后单] --> PENDING_APPROVAL (锁定 submitter_id, refund_usd)
                           |
         +-----------------+-----------------+
         | approver 决策 (submitter != actor)|
         v                                   v
     APPROVED                            REJECTED
(实时扣减 M2 净利润)                 (不发生利润扣减)
```

### 3.2 错误码字典

| HTTP 状态 | 错误码 | 触发场景 |
|---|---|---|
| `403` | `M7-4031` | `mock_buyer` 访问真实会话/工单，或非授权角色修改 FAQ/回复/审批 |
| `403` | `M7-4032` | `submitter_id == actor.user_id` 试图自批售后退款 |
| `404` | `M7-4041` | 回复不存在的 `session_id` 或审批不存在的 `ticket_id` |
| `422` | `M7-4221` | `refund_usd < 0`、`question` 少于 2 字、非法审批枚举 |

---

## 4. REST API 完整契约与示例

统一前缀：`/api/v1/orgs/{org_id}/m1`

| 端点 | 方法 | 权限码 | 请求 Schema | 审计 `action_code` |
|---|---|---|---|---|
| `/faqs` | `GET` / `POST` | `m1:read` / `m1:faq:edit` | `FaqUpsertReq` | `FAQ_UPDATED` |
| `/sessions` | `GET` | `m1:read` | — | — |
| `/sessions/{session_id}/reply` | `POST` | `m1:session:edit` | `SessionReplyReq` | `SESSION_REPLIED` |
| `/simulator/ask` | `POST` | `m1:simulator:run` | `SimulatorMsgReq` | `BUYER_SIMULATED` |
| `/aftersales` | `GET` / `POST` | `m1:read` / `m1:aftersales:submit` | `AftersalesCreateReq` | `AFTERSALES_SUBMITTED` |
| `/aftersales/{ticket_id}/decide` | `POST` | `m1:aftersales:approve` | `AftersalesDecisionReq` | `AFTERSALES_DECIDED` |

#### `POST /simulator/ask` & `POST /aftersales/{ticket_id}/decide` Payload 示例

```json
// POST /m1/simulator/ask
{ "sku": "SKU-00704", "question": "Does it support 110V?" }
// Response 200
{ "ok": true, "data": { "session_id": "cs_8a1b2c3d4e", "suggested_reply": "【知识库命中】..." }, "error": null, "trace_id": "tr_m1_01" }
```

```json
// POST /m1/aftersales/tkt_123/decide (SoD 自批拦截 Response 403)
{ "ok": false, "data": null, "error": { "code": "M7-4032", "message": "违反职责分离：客服建单人禁止自批售后退款" }, "trace_id": "tr_m1_02" }
```

---

## 5. 前端视图组件规范（`frontend/src/views/m1/`）

- `M1SessionsView.vue`：左列展示会话队列（`MOCK` 红色标）与快捷回复框；右列嵌售后退款建单表单。
- `M1FaqsView.vue`：支持选定 SKU、换行维护多条痛点、动态增删 Q&A 对并一键保存同步。
- `M1SimulatorView.vue`：页首明示「MOCK 安全沙盒，绝不外发真实平台」，实时回显知识库命中回复及跳往会话台。
- `M1AftersalesView.vue`：待审批工单与已审批历史分组展示，提供审批意见输入与通过/驳回按钮。
