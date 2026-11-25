# CrossPilot · 客服导购与售后闭环模块（M1）需求说明书

> **文档状态**：V1.0 正式基线（对齐《CrossPilot 需求分析》FR-16~FR-22 及原型 `docs/prototypes/web/pages_m0_m3.js`）
> **适用范围**：M1-1 客服会话与售后建单（`m1a`）、M1-2 客服导购商品库（`m1b`）、M1-4 买家咨询模拟测试（`m1d`）、M1-3 售后审批与退款凭证（`m1c`）

---

## 1. 模块定位、页面映射与核心原则

### 1.1 业务目标

M1 统一治理跨境多站点客服咨询、售前导购 FAQ 与售后赔付审批流程，解决四大典型运营风险：
1. 客服回复时错发竞品或别家店铺商品链接（串店风险），或中英文报价不一致；
2. 详情页承诺（M7）与客服实际回答口径矛盾，导致买家投诉“货不对板”；
3. 测试人员使用真实买家号反复下单测试客服话术，污染实盘客诉率与订单台账；
4. 同一客服自己新建售后退款单又自己批准打款，造成资金内控漏洞。

### 1.2 原型路由与前后端映射表

| 原型与现行路由 | 子模块名称 | 核心业务定位 | 后端模块 / 前端视图 |
|---|---|---|---|
| `m1a` (`/m1/sessions`) | M1-1 客服会话与售后建单 | 会话接待、回复提交、核验订单并起草售后退款工单 | `m1_cs` / `M1SessionsView.vue` |
| `m1b` (`/m1/faqs`) | M1-2 客服导购商品库 | 按 SKU 维护买家痛点与 FAQ，单向同步供 M7 文案引用 | `m1_cs` + `voice_faq_contract` / `M1FaqsView.vue` |
| `m1d` (`/m1/simulator`) | M1-4 买家咨询模拟测试 | 内部安全模拟进线（`is_mock=True` 彻底隔离，绝不外发真实平台） | `m1_cs` / `M1SimulatorView.vue` |
| `m1c` (`/m1/aftersales`) | M1-3 售后审批与退款凭证 | 主管终审退款（禁自批）、联动扣减 M2 净利润 | `m1_cs` / `M1AftersalesView.vue` |

### 1.3 上下游接口契约

- **上游输入**：`M0Product` 在售 SKU、买家咨询进线（模拟进线 `M1-4` 或平台会话同步）、`M0Order` 订单号参考。
- **下游输出**：
  - `contracts/voice_faq_contract.py`：向 M7-1 文案与 M7-3 视频分镜供应只读 `VoiceFaqSnapshot`（痛点列表 + FAQ 问答对），保证详情页卖点与客服回答同源。
  - M2 经营核算：汇总所有 `status == "APPROVED"` 的售后工单金额（`approved_refund_usd`），实时扣减净利润。

### 1.4 五项核心业务原则（硬约束）

1. **模拟进线绝对隔离（`is_mock=True`）**：M1-4 发出的任何模拟咨询必须强制打标 `is_mock=True` 与 `channel="Buyer Simulator (MOCK)"`，绝不调用外部真实买家发送通道。
2. **测试买家最小沙盒权（`mock_buyer` 强制隔离）**：`mock_buyer` 岗位**仅拥有 `m1:simulator:run` 一项权限**，禁止访问任何真实订单、成本、会话台账与售后退款列表。
3. **售后退款职责分离（SoD）**：`cs` 提交的售后赔付单必须由 `approver` 审批；系统严格核对 `submitter_id != actor.user_id`（同人返回 `403 M7-4032`）。
4. **导购知识库与 M7 文案同源**：M1-2 更新 FAQ 后立即在 M7-1 上游参照区可见，修改 FAQ 权收敛至运营（`planner`）并写审计。
5. **禁止客服 AI 越权承诺直接退款**：所有赔付或退款必须走 M1-3 主管审批，V1.1 扩充发送前 3 项合规检测（金额一致、本店链接、双语数字一致）及打款凭证上传闭环。

---

## 2. 岗位权限矩阵（RBAC）

| 业务操作 | 权限码 | `cs` | `approver` | `planner` | `mock_buyer` | `manager` / `creator` | `selector`/`bi_analyst`/`warehouse` |
|---|---|---|---|---|---|---|---|
| 浏览客服会话、FAQ、售后列表 | `m1:read` | ✅ | ✅ | ✅ | ❌ (403) | ✅ | ❌ (403) |
| 回复买家会话 | `m1:session:edit` | ✅ | ❌ (403) | ❌ | ❌ (403) | ❌ | ❌ |
| 提交售后退款工单 | `m1:aftersales:submit` | ✅ | ❌ (403) | ❌ | ❌ (403) | ❌ | ❌ |
| 维护导购 FAQ 知识库 | `m1:faq:edit` | ❌ (403) | ❌ | ✅ | ❌ | ❌ | ❌ |
| 审批售后退款（禁自批） | `m1:aftersales:approve` | ❌ (403) | ✅ | ❌ (403) | ❌ (403) | ❌ (403) | ❌ |
| 运行买家咨询模拟器 | `m1:simulator:run` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## 3. 分页详细功能需求

### 3.1 M1-1：客服会话与售后建单（`m1a` / `/m1/sessions`）

1. **会话队列展示**：按创建时间倒序展示 `session_id`、SKU、买家名称、渠道（真实渠道 vs `Buyer Simulator (MOCK)`）、`is_mock` 隔离标、问题正文、当前回复与状态（`OPEN` / `REPLIED`）。
2. **人工接管与回复**：`cs` 选择会话录入回复正文提交后，状态流转为 `REPLIED` 并锁定 `handler_id = actor.user_id`。
3. **售后退款建单**：填写关联 `sku`、订单编号 `order_ref`、平台、问题类型（破损/少件/功能故障/尺寸不符）、申请退款金额（`refund_usd >= 0`）与凭证备注，落库为 `PENDING_APPROVAL`（锁定 `submitter_id`）。
4. **V1.1 迭代规划**：增加「四要素核验绑单勾选（买家/金额/商品/时间）」与「发送前防串店链接/双语金额一致检测」。

### 3.2 M1-2：客服导购商品库（`m1b` / `/m1/faqs`）

1. 按 SKU 维护买家高频痛点列表（`pain_points`）与问答对（`faq_pairs`: `{q, a}`）。
2. 采用 `(org_id, sku)` 幂等 Upsert 保存，保存后写 `FAQ_UPDATED` 审计，供 `M1-4` 模拟命中与 `M7-1` 文案工作台实时读取。

### 3.3 M1-4：买家咨询模拟测试（`m1d` / `/m1/simulator`）

1. 输入目标 `sku` 与咨询内容 `question`（≥2 字符），后端检索 `M1FaqEntry` 自动生成 `suggested_reply`（未命中 FAQ 则返回标准人工转接兜底语）。
2. 写入 `M1CsSession`（强制 `is_mock=True`），写入 `BUYER_SIMULATED` 审计事件。

### 3.4 M1-3：售后审批与退款凭证（`m1c` / `/m1/aftersales`）

1. 展示所有售后工单、退款金额（USD）、原因、凭证说明与提交人。
2. `approver` 填写审批意见并选择 `APPROVED` / `REJECTED`；批准金额立即在 M2-2 经营大屏净利润计算中体现扣减。
3. **V1.1 迭代规划**：增加 `PENDING_RECEIPT`（待传人工打款截图凭证）→ `CLOSED` 终态，以及退款额 ≤ 原订单金额校验。

---

## 4. 核心数据对象与跨模块契约

| 核心实体 / 契约 | 归属表 / 路径 | 关键字段与职责 |
|---|---|---|
| `M1FaqEntry` | `m1_faq_entries` | `(org_id, sku)` 唯一，存储 `pain_points_json` 与 `faq_pairs_json` |
| `M1CsSession` | `m1_cs_sessions` | 存储 `is_mock` 隔离标、`channel`、`question`、`reply`、`status` |
| `M1AftersalesTicket` | `m1_aftersales_tickets` | 存储 `order_ref`、`refund_usd`、`submitter_id`、`approver_id`、`status` |
| `VoiceFaqContract` | `contracts/voice_faq_contract.py` | 向 M7-1 / M7-3 暴露只读 `VoiceFaqSnapshot` 痛点与 FAQ |

---

## 5. 非功能需求与验收标准

### 5.1 性能、准确率与安全覆盖率

1. **接口响应基准**：会话/工单/FAQ 查询 P95 ≤ 60ms；模拟器 FAQ 检索与入库 P95 ≤ 80ms；售后审批与审计提交 P95 ≤ 100ms。
2. **沙盒与权限隔离**：`mock_buyer` 越权访问其它端点拦截率 100%；同人自批售后拦截率 100%。
3. **跨模块一致性**：FAQ 更新后 M7-1 可见延迟 0 秒（同库同步读取）；售后批准后 M2 净利扣减即时生效。

### 5.2 核心验收标准矩阵（M1-AC-01 ~ M1-AC-05）

| 验收编号 | 给定条件与动作 | 通过标准 |
|---|---|---|
| **M1-AC-01** | `planner` 在 M1-2 为 `SKU-00704` 新增痛点与 Q&A 后查看 M7-1 | `voice_faq_contract` 与 M7-1 上游参照区立即展示最新痛点与 FAQ |
| **M1-AC-02** | `mock_buyer` 访问 `POST /m1/simulator/ask` 与其余业务接口 | 模拟器返回 200 且会话标记 `is_mock=True`；访问 M0/M1会话/M4/M7/M8 全部返回 `403` |
| **M1-AC-03** | `cs` 创建售后单后尝试自己审批，或同 `user_id` 伪造 `approver` 审批 | 返回 `403` / `403 M7-4032` 拦截；换另一位 `approver` 审批成功 |
| **M1-AC-04** | `approver` 批准一笔 `$25.00` 售后退款单后刷新 M2-2 大屏 | M2 `approved_refund_usd` 增加 `$25.00`，净利润同步扣减 `$25.00` |
| **M1-AC-05** | 模拟向无 FAQ 的 SKU 发起咨询，或回复不存在的 `session_id` | 无 FAQ 返回友好兜底提示不崩溃；不存在会话返回 `404 M7-4041` |

---

## 6. 已确认的技术落地口径（V1 实施方案拍板）

1. **V1 客服通信与隔离边界**：V1 聚焦于本地模拟进线、FAQ 导购知识库维护、工单内控审批流与对 M7/M2 的契约联动，不直连海外平台实时站内信 Webhook 推送。
2. **V1.1 精修规划**：补齐客服发送前 3 项防错检验（金额一致/防串店/双语一致）、四要素绑单校验、退款上限校验与打款凭证上传闭环（`PENDING_RECEIPT -> CLOSED`）。
