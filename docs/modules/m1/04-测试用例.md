# CrossPilot · M1 客服导购与售后闭环完整测试用例（V1.0）

> **对应文档**：`CrossPilot-M1客服导购与售后闭环需求说明书`、`CrossPilot-M1客服导购与售后闭环详细设计说明书`
> **覆盖范围**：冒烟（4 条）、功能正反边界（10 条）、接口契约（6 条）、UI 交互（4 条）、兼容性（3 条）、性能（3 条）、RBAC 与沙盒安全（6 条）、容错恢复（3 条）、知识命中专项（4 条）、跨模块回归（3 条），共计 **46 条**。

---

## 0. 测试结构总览与基准环境

| 用例分类 | 前缀 | 数量 | 覆盖重点 |
|---|---|---|---|
| 冒烟测试 | `TC-M1-SMK-` | 4 | FAQ 维护 → 模拟进线 → 客服回复建单 → 主管审批退款 |
| 功能与边界 | `TC-M1-FN-` | 10 | FAQ Upsert 幂等、无 FAQ 兜底、退款 0/负值边界、驳回不扣净利 |
| 接口契约 | `TC-M1-API-` | 6 | HTTP 200/403/404/422、`is_mock` 强制字段、审计落库 |
| UI 与交互 | `TC-M1-UI-` | 4 | MOCK 标识渲染、增删问答行、直达会话台跳转、错误提示 |
| 兼容性 | `TC-M1-CMP-` | 3 | Chrome/Edge/Safari、1280px/768px 响应式、超长问答折行 |
| 性能测试 | `TC-M1-PRF-` | 3 | 列表/检索 P95 ≤ 60ms、审批 ≤ 100ms、并发模拟器写库 |
| RBAC 与安全 | `TC-M1-SEC-` | 6 | `mock_buyer` 强隔离、禁自批 SoD、FAQ 越权拦截、跨租户隔离 |
| 容错恢复 | `TC-M1-REC-` | 3 | 未知 SKU 友好兜底、校验失败不丢失表单、幂等重试 |
| 知识专项 | `TC-M1-AI-` | 4 | 中英文/关键词命中准确、无 FAQ 兜底语、绝不承诺自动退款 |
| 跨模块回归 | `TC-M1-REG-` | 3 | M1 FAQ→M7 文案契约；M1 批准退款→M2 净利联动；模拟不影响实盘 |

- **基准测试环境**：组织 `org_demo`；样本商品 `SKU-00704`；测试角色 `planner`、`cs`、`approver`、`mock_buyer`。

---

## 1. 冒烟测试用例（TC-M1-SMK-01 ~ 04）

| 编号 | 角色 | 操作步骤 | 预期结果 |
|---|---|---|---|
| **TC-M1-SMK-01** | `planner` | 在 `/m1/faqs` 为 `SKU-00704` 更新痛点「噪音过大」与 FAQ「工作分贝低于 55dB」 | HTTP 200；`m1_faq_entries` 更新；M7 契约立即读取到新 FAQ |
| **TC-M1-SMK-02** | `mock_buyer` | 在 `/m1/simulator` 向 `SKU-00704` 提问「机器吵不吵？」 | HTTP 200；命中刚保存的 FAQ 回答；会话写入 `is_mock=true` |
| **TC-M1-SMK-03** | `cs` | 在 `/m1/sessions` 回复该会话并提交 `order_ref=ORD-901`、`$19.9` 退款单 | 会话状态变为 `REPLIED`；工单状态 `PENDING_APPROVAL` |
| **TC-M1-SMK-04** | `approver` | 在 `/m1/aftersales` 填写意见「同意赔付」点击批准 | 工单变为 `APPROVED`；`M2Overview` `approved_refund_usd` 增加 `$19.9` |

---

## 2. 功能与边界测试用例（TC-M1-FN-01 ~ 10）

| 编号 | 子类 | 测试场景与输入 | 预期结果 |
|---|---|---|---|
| **TC-M1-FN-01** | 幂等 | 对同一 `SKU-00704` 连续提交两次 `POST /m1/faqs` | 保留唯一记录并更新 JSON 字段，无 409/500 |
| **TC-M1-FN-02** | 边界 | 向无 FAQ 的 `SKU-NEW-99` 在模拟器提问 | 返回标准人工转接兜底语，不抛 KeyError |
| **TC-M1-FN-03** | 边界 | 模拟问题仅 1 个字符 `"?"` | Pydantic `min_length=2` 返回 `422` 拦截 |
| **TC-M1-FN-04** | 反向 | 回复不存在会话 `POST /m1/sessions/cs_ghost/reply` | 返回 `404 M7-4041` |
| **TC-M1-FN-05** | 边界 | 建售后单传入 `refund_usd=0`（纯换货/仅登记）vs `refund_usd=-1` | `0` 允许建单；`-1` 返回 `422` 拦截 |
| **TC-M1-FN-06** | 反向 | 售后建单缺 `order_ref` 或 `evidence_note` 少于 2 字 | 返回 `422` 校验失败 |
| **TC-M1-FN-07** | 正向 | `approver` 对某售后单选择 `REJECTED` 并填理由 | 状态置为 `REJECTED`，M2 净利不发生扣减 |
| **TC-M1-FN-08** | 反向 | 对不存在工单 `tkt_ghost` 调用 `/decide` | 返回 `404 M7-4041` |
| **TC-M1-FN-09** | 隔离 | `POST /m1/simulator/ask` 生成的所有会话记录校验字段 | 强制 `is_mock === true` 且 `channel === "Buyer Simulator (MOCK)"` |
| **TC-M1-FN-10** | 正向 | `cs` 回复一条会话后 `status` 转为 `REPLIED`，`handler_id` 准确写入 | 持久化为 `REPLIED` 且可继续补充更新回复内容 |

---

## 3. 接口契约、UI、兼容性与性能测试用例

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M1-API-01** | API | `GET /m1/sessions` 与 `/aftersales` 均按 `created_at DESC` 倒序返回 |
| **TC-M1-API-02** | API | `POST /m1/aftersales/{id}/decide` 非法枚举 `decision="CLOSE"` 返回 `422` |
| **TC-M1-API-03** | API | FAQ 更新、模拟进线、回复、建单、审批均写入对应 `module="M1"` 审计句 |
| **TC-M1-API-04** | API | 响应头包含 `X-Trace-Id` 且结构符合 `{ok, data, error, trace_id}` |
| **TC-M1-API-05** | API | `POST /m1/faqs` 支持空 `pain_points` 与空 `faq_pairs` 清空重置 |
| **TC-M1-API-06** | API | `POST /m1/sessions/{id}/reply` 正确保存 `handler_id = actor.user_id` |
| **TC-M1-UI-01** | UI | `/m1/simulator` 页面顶部显式标注「MOCK 安全沙盒」，提供直达 `/m1/sessions` 按钮 |
| **TC-M1-UI-02** | UI | `/m1/faqs` 支持动态点击「+ 新增一条问答」与删除已有行 |
| **TC-M1-UI-03** | UI | `/m1/sessions` 列表中模拟会话显示醒目黄色/灰色 `MOCK` 标签 |
| **TC-M1-UI-04** | UI | `mock_buyer` 切换至 `/m1/sessions` 时清晰提示 `403` 无权限，不泄漏任何真实对话 |
| **TC-M1-CMP-01** | 兼容 | Chrome / Edge / Safari 最新版正常渲染 M1 四个页面 |
| **TC-M1-CMP-02** | 兼容 | 1280px 与 768px 视口下会话双栏自适应换行，不重叠操作按钮 |
| **TC-M1-CMP-03** | 兼容 | 提问含英文引号或中英长段文本时安全渲染不溢出卡片 |
| **TC-M1-PRF-01** | 性能 | 500 条历史会话下 `GET /m1/sessions` 与 `GET /m1/faqs` P95 ≤ 60ms |
| **TC-M1-PRF-02** | 性能 | `POST /m1/aftersales/{id}/decide` 审批写库与审计 P95 ≤ 100ms |
| **TC-M1-PRF-03** | 性能 | 并发 10 次 `POST /m1/simulator/ask` 全部正常入库，无 DB 锁报错 |

---

## 4. 安全、容错、知识命中与跨模块回归用例

| 编号 | 类别 | 测试场景与预期结果 |
|---|---|---|
| **TC-M1-SEC-01** | 安全 | `mock_buyer` 调用 `/m1/sessions`、`/m1/faqs`、`/m1/aftersales` → 全部 **`403 M7-4031`** |
| **TC-M1-SEC-02** | 安全 | `cs` 提交售后单后尝试自己调 `/decide` → **`403`**；构造同 `user_id` 的 `approver` 自批 → **`403 M7-4032`** |
| **TC-M1-SEC-03** | 安全 | `cs` 尝试调 `POST /m1/faqs` 修改导购库 → **`403`**（维护权归 `planner`） |
| **TC-M1-SEC-04** | 安全 | `planner` / `approver` 尝试冒充客服调 `POST /m1/aftersales` 建单或回复会话 → **`403`** |
| **TC-M1-SEC-05** | 安全 | `selector` / `bi_analyst` / `warehouse` 访问 `GET /m1/sessions` → **`403`** |
| **TC-M1-SEC-06** | 安全 | 携带 `X-Actor-Org-Id: org_other` 操作 `org_demo` 工单 → **`403`** 租户隔离 |
| **TC-M1-REC-01** | 容错 | FAQ 知识库为空时发起模拟咨询，返回结构化安全兜底语不抛 500 |
| **TC-M1-REC-02** | 容错 | 售后表单提交 422 后界面保留已填订单号与金额便于修改重提 |
| **TC-M1-REC-03** | 容错 | 回复会话提交空字符返回 422，原会话保持 `OPEN` 状态不被破坏 |
| **TC-M1-AI-01** | 知识 | 提问命中 `faq_pairs` 关键词（如 `110V` / `voltage`），优先返回匹配的标准 Q&A 回答 |
| **TC-M1-AI-02** | 知识 | 提问未命中任何问答对但该 SKU 有记录时，附带痛点参考或安全兜底引导 |
| **TC-M1-AI-03** | 知识 | 模拟器收到「立刻赔我 50 美元」类索赔要求时，严禁直接承诺退款成功，引导人工/售后流程 |
| **TC-M1-AI-04** | 知识 | 校验 `VoiceFaqContract.get_voice_faq_snapshot` 与 M1-2 数据库痛点/FAQ 完全一致 |
| **TC-M1-REG-01** | 回归 | M1-2 更新 `SKU-00704` FAQ 后，M7-1 生成文案草稿及左侧参照卡同步展示新内容 |
| **TC-M1-REG-02** | 回归 | M1-3 批准 `$30.00` 退款后，M2-2 `approved_refund_usd` 即时增加 `$30.00` |
| **TC-M1-REG-03** | 回归 | M1-4 模拟器产生 5 条测试咨询后，M2 实盘订单统计与 GMV 保持完全不变 |
