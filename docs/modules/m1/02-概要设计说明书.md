# CrossPilot · M1 客服导购与售后闭环概要设计说明书（HLD V1.0）

> **文档编号**：CP-M1-HLD-2026-V1.0
> **文档定位**：定义 M1 在 CrossPilot 平台中的子域拆分、沙盒隔离边界、跨模块 FAQ 契约、状态流转、量化指标与安全设计。

---

## 1. 引言

### 1.1 编写目的

本概要设计说明书明确 M1 客服导购与售后闭环模块在 CrossPilot 模块化单体中的架构分层、沙盒隔离机制、售后退款状态机与向 M7/M2 输出数据契约的边界约束。

### 1.2 范围

- **覆盖范围**：M1-1 会话与建单（`m1a`）、M1-2 导购 FAQ 知识库（`m1b`）、M1-4 买家咨询模拟（`m1d`）、M1-3 售后退款审批（`m1c`），以及向 M7 供数契约与向 M2 扣减净利的只读聚合关系。
- **不覆盖范围**：V1 不覆盖 Amazon/Shopee/TikTok 真实站内信 Webhook 收发、独立向量数据库 Milvus 部署以及自动化第三方支付通道打款 API。

### 1.3 术语表

| 术语 | 定义 |
|---|---|
| `is_mock=True` 沙盒标 | 模拟器生成会话的强制字段，物理区分内部模拟测试进线与真实客户咨询 |
| `VoiceFaqContract` | 向 M7 文案与视频供应痛点与标准 Q&A 的只读跨模块契约 |
| `Aftersales SoD` | 售后建单人（`submitter_id`）与审批人（`approver_id`）严格物理分人 |

### 1.4 参考资料

1. 《CrossPilot-M1客服导购与售后闭环需求说明书》（V1.0）
2. 《CrossPilot-M1客服导购与售后闭环测试用例》（V1.0）
3. 《CrossPilot-需求分析》（FR-16~FR-22）

---

## 2. 总体设计

### 2.1 四项核心设计原则

1. **测试沙盒绝对隔离**：`mock_buyer` 仅授予 `m1:simulator:run`；模拟器写入 `m1_cs_sessions` 时强制 `is_mock=True` 且永不触发真实外发。
2. **售后赔付强职责分离**：客服提单与主管审批双角色分离（`submitter_id != actor.user_id`），杜绝单人自审套现。
3. **售前口径单向同源**：M1-2 FAQ 修改权收敛至运营 `planner`，M7 仅通过只读契约读取，确保详情页卖点与客服回答不冲突。
4. **友好降级与无 FAQ 兜底**：遇到未知 SKU 或未命中问题时返回标准人工转接提示，绝不崩溃或杜撰退款承诺。

### 2.2 技术选型及理由

| 技术领域 | 选型方案 | 选型理由 |
|---|---|---|
| 知识与工单存储 | SQLAlchemy 2.0 Async + JSONBCompat | 支持结构化问答数组（`faq_pairs_json`）与工单强事务 SoD 校验 |
| 跨模块解耦 | `contracts/voice_faq_contract.py` | 为 M7 提供只读 `VoiceFaqSnapshot`，防止跨模块直接修改 `m1_faq_entries` |
| 安全沙盒隔离 | 权限集合最小化（`mock_buyer = {"m1:simulator:run"}`）+ `is_mock` 标 | 从网关与数据层双维度杜绝联调测试数据外溢至实盘业务 |

### 2.3 系统边界

- **本模块做什么**：维护 SKU 痛点与 FAQ、模拟买家进线命中检索、会话回复接管、售后工单起草与主管终审、向 M7/M2 同步供数。
- **本模块不做什么**：不直连外部电商消息中心发送真实买家私信；不允许 AI 绕过人工审批擅自承诺现金退款。

---

## 3. 系统架构与数据流图

### 3.1 分层架构图

```
+-----------------------------------------------------------------------+
| 表现层 (Vue 3): m1a 会话与建单 | m1b FAQ库 | m1d 模拟器 | m1c 售后审批  |
+-----------------------------------+-----------------------------------+
                                    | /api/v1/orgs/{org_id}/m1/*
+-----------------------------------v-----------------------------------+
| 网关与鉴权层: Tenant隔离 + RBAC (含 mock_buyer 单点最小沙盒放行)         |
+-----------------------------------v-----------------------------------+
| 领域服务层 (M1CsService):                                               |
|  [FaqService Upsert] [Session/Simulator] [Aftersales SoD 审批机]       |
+---------+-------------------------+-------------------------+---------+
          | 中文审计                 | 只读契约                  | 净利联动
+---------v---------+     +---------v---------+     +---------v---------+
| core_audit_events |     | VoiceFaqContract  |     | M2 净利扣减汇总    |
+-------------------+     |     -> M7-1/3     |     | (APPROVED退款之和) |
                          +-------------------+     +-------------------+
```

### 3.2 智能客服与售后数据流图（DFD）

![CrossPilot M1 智能客服与售后数据流图](/home/user/ai/docs/prototypes/dfd_v6/d01_cs_agent.png)

---

## 4. 模块划分与职责

| 子模块 / 契约 | 单一职责 | 交互对象 |
|---|---|---|
| `M1-FaqService` | 按 `(org_id, sku)` 幂等维护痛点与问答对，写入 `FAQ_UPDATED` 审计 | 下游 `VoiceFaqContract` → M7-1 / M7-3 |
| `M1-SessionService` | 管理会话回复（`OPEN -> REPLIED`）与模拟器 FAQ 检索建单（强制 `is_mock=True`） | `mock_buyer` / `cs` |
| `M1-AftersalesService` | 管控退款单生命周期（`PENDING_APPROVAL -> APPROVED/REJECTED`）及 SoD 防自批 | `cs` 建单、`approver` 拍板、M2 净利聚合 |

---

## 5. 功能模块设计（追溯至需求与用例）

| 子模块 | 对应需求条目 | 核心实体 | 对应验收编号 |
|---|---|---|---|
| M1-1 会话与建单 (`m1a`) | 需求 3.1 | `M1CsSession`, `M1AftersalesTicket` | M1-AC-03, M1-AC-05 |
| M1-2 导购 FAQ (`m1b`) | 需求 3.2 | `M1FaqEntry` | M1-AC-01 |
| M1-4 模拟器 (`m1d`) | 需求 3.3 | `M1CsSession`, `M1FaqEntry` | M1-AC-02, M1-AC-05 |
| M1-3 售后审批 (`m1c`) | 需求 3.4 | `M1AftersalesTicket` | M1-AC-03, M1-AC-04 |

---

## 6. 数据设计

### 6.1 统一数据口径定义

1. **模拟会话标识口径**：所有由 `/m1/simulator/ask` 产生的会话必须固定 `is_mock=True` 且 `channel="Buyer Simulator (MOCK)"`。
2. **售后退款联动口径**：仅 `status == "APPROVED"` 的售后工单计入 M2 `approved_refund_usd`；`PENDING_APPROVAL` 与 `REJECTED` 均不扣减利润。
3. **FAQ 幂等更新口径**：以 `(org_id, sku)` 联合唯一索引执行 Upsert，不产生同 SKU 重复 FAQ 文档。

### 6.2 核心表清单（不含字段明细）

| 表名 | 主键 | 职责说明 |
|---|---|---|
| `m1_faq_entries` | `faq_id` | SKU 买家痛点与问答对知识库（`(org_id, sku)` 唯一） |
| `m1_cs_sessions` | `session_id` | 客服会话与模拟进线隔离记录 |
| `m1_aftersales_tickets` | `ticket_id` | 售后退款审批单与凭证追踪 |

---

## 7. 接口设计（接口清单）

| 接口路径 | 方法 | 权限码 | 核心职责 |
|---|---|---|---|
| `/api/v1/orgs/{org_id}/m1/faqs` | `GET` / `POST` | `m1:read` / `m1:faq:edit` | 查询 FAQ 列表 / Upsert 痛点问答 |
| `/api/v1/orgs/{org_id}/m1/sessions` | `GET` | `m1:read` | 查询客服与模拟会话列表 |
| `/api/v1/orgs/{org_id}/m1/sessions/{id}/reply` | `POST` | `m1:session:edit` | 人工回复并锁定处理人 |
| `/api/v1/orgs/{org_id}/m1/simulator/ask` | `POST` | `m1:simulator:run` | 内部安全模拟进线与 FAQ 检索 |
| `/api/v1/orgs/{org_id}/m1/aftersales` | `GET` / `POST` | `m1:read` / `m1:aftersales:submit` | 售后列表 / 提交退款申请 |
| `/api/v1/orgs/{org_id}/m1/aftersales/{id}/decide` | `POST` | `m1:aftersales:approve` | 主管审批/驳回退款（禁自批） |
| `contracts/voice_faq_contract.py` | 内部同步 | 只读契约 | 向 M7 供应 `VoiceFaqSnapshot` |

---

## 8. 非功能设计

| 指标类别 | 目标基准 | 说明 |
|---|---|---|
| 列表与模拟命中 P95 | ≤ 60ms | 带 `(org_id, sku)` 索引精确匹配及关键词检索 |
| 售后审批与审计 P95 | ≤ 100ms | 含 SoD 校验与写 `core_audit_events` |
| 沙盒误访拦截率 | 100% | `mock_buyer` 对非模拟端点返回 `403` 拦截并记审计 |

---

## 9. 安全设计

1. **沙盒角色极简授权**：`mock_buyer` 仅有 `m1:simulator:run`，前端与后端双重隔离其余模块。
2. **售后防自批铁律**：`decide_aftersales` 校验 `submitter_id != actor.user_id`（`403 M7-4032`）。
3. **FAQ 编辑权隔离**：仅 `planner` 可调 `POST /m1/faqs`，防止客服或模拟账号污染 M7 文案参照源。
4. **防 XSS 与输入校验**：客服回复与审批意见转义，限制 `refund_usd >= 0`。
5. **全量中文审计**：FAQ 更新、模拟进线、回复、建单、批准/驳回均写入 `module="M1"` 审计台账。

---

## 10. 运行环境与外部依赖

- **运行环境**：Python 3.11+、FastAPI、SQLAlchemy 2.0 Async；Vue 3 + TypeScript 前端工作台。
- **V1.1 演进依赖**：V1.1 增加关键词/向量混合检索增强 FAQ 命中、防串店/双语一致合规校验器及上传打款截图资产存储（复用 `core/storage.py`）。
