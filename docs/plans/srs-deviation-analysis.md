# V5 流程图与《AI跨境电商平台V1.0_软件需求规格说明书(1)》偏差核查与V6纠偏说明

> 核对基准：
> 1. 仓库需求文档：`docs/requirements/AI跨境电商平台V1.0-软件需求规格说明书.md`（源自 `AI跨境电商平台V1.0_软件需求规格说明书(1).docx`）
> 2. 老师原版7张数据流向图：`docs/requirements/assets/v1.1/img_008.jpg`、`img_020.jpg`、`img_034.jpg`、`img_049.jpg`、`img_060.jpg`、`img_074.jpg`、`img_088.jpg`
> 3. 仓库现有权限代码：`pilot/rbac/service.py`（6个默认系统角色 `DEFAULT_ROLES`）

## 一、核心结论：确实存在较大偏差，现已全面纠偏至 V6

此前 V5 流程图（`docs/prototypes/modules/m00`~`m15`）主要参考了早期的 `CrossPilot-需求分析.md` 并自行补入了不少重型 ERP 管控设计，导致与老师最新的《AI跨境电商平台V1.0_软件需求规格说明书(1)》在**角色数量、模块结构、数据边界**三方面存在明显偏差。

本次已重新生成 **10 张严格对齐 V1.0 SRS 的 V6 数据流向图**（`docs/prototypes/dfd_v6/d00`~`d08`），同时保留您之前强调的**店铺/订单/商品完整底座**，避免闭环断裂。

---

## 二、逐项偏差对比表（证据对照）

| 维度 | 此前 V5 方案（偏差点） | 老师 V1.0 SRS + `pilot/rbac` 真实要求 | 偏差程度 | V6 纠偏做法 |
|---|---|---|---|---|
| **1. RBAC 角色数量与分工** | 拆出 **9 个重型孤岛角色**（`Owner老板 / Admin(仅12模块) / Finance / Compliance / OpsMgr / Operator / CS / Warehouse / Auditor`），并自创 Owner 4类白名单、Admin 业务全 `× DENY` | SRS §1.5 仅是按功能场景列出的 9 行职责（含测试入口「买家(模拟)」）；仓库 `pilot/rbac/service.py` 实际只有 **6 个核心角色**（`admin / approver / planner / warehouse / viewer / auditor`） | **大** | 收敛为 **6 个核心后台角色**：`admin`（系统/连接器）、`planner`（运营/选品/内容/驾驶舱设计）、`cs`（客服）、`approver`（主管/审批/审核）、`warehouse`（采购/仓配/物流）、`viewer/auditor`（大屏浏览/BI/只读审计）；仅保留 SRS 要求的 `org_id` 隔离、真实鉴权替换演示头（Q-01）与 `approver ≠ planner`（FR-RP-08） |
| **2. 系统模块划分** | 按 CrossPilot 扩成 **13 个 ERP 模块**（含独立的财务利润月结模块、独立上传知识库模块），把老师核心的「M2 驾驶舱设计器」压缩成静态经营总览 | SRS §1.2 明确为 **7 个 Agent 子模块（M1客服 / M2驾驶舱设计 / M3智能问数 / M4选品 / M5销量预测 / M6补货 / M7内容创作）+ 1 套公共底座** | **大** | 回归 **7 大 Agent + 1 个公共底座** 结构，在底座完整保留店铺/订单/商品主数据与独立库存同步，不再把独立财务红字调整/独立知识库当成主模块喧宾夺主 |
| **3. M6 补货是否修改库存（直接冲突）** | V5 `m09` / `m04` 画成「`9.5` 质检收货直接回写商品中台可用库存」并加了防环标识 | SRS §1.6、FR-RP-10、AC-RP-04 明确规定：**「库存数值不因审批或凭证登记而改变；库存实际变化由独立库存同步流程完成」** | **严重冲突** | V6 `d06`、`d08` 与 `d00` 严格改为：**M6 只登记采购/多批质检/发货凭证（多批收货保持 `PURCHASE_ORDERED`），绝不直接改写 `InventoryPosition`**；库存仅由底座的「独立库存同步流程」更新 |
| **4. M1 智能客服路径** | V5 `m07` 只画了客服三栏聊天与退款补偿单 | SRS 第3章 + `img_008` 明确要求：**推荐商品 `CustomerRecommendedProduct`（20件批写 Milvus）与 V2 `CustomerListing` 两条独立路径**、模拟买家页/邮件中继边界、WS+3秒HTTP回读、仅最新入站为投诉才查候选订单、`external_status` 保持 `UNKNOWN` | **中大** | V6 `d01_cs_agent.png` 完整还原推荐商品库、入站实时通道与售后工单3条数据流 |
| **5. M2 驾驶舱设计 Agent** | V5 `m10` 只画了静态老板晨会看板 | SRS 第4章 + `img_020` 核心是 **BI 设计器**：`/compose`、`/preview`、`/describe`、`PUT draft_layout`、`POST publish`、发布页首请求 `layout_only`、最多4卡并发独立 Session、单卡异常隔离、`queried_at` vs `data_as_of` | **大** | V6 `d02_bi_design_agent.png` 完整还原草稿/发布双版本布局流 + 实时问数下行流 |
| **6. M3 智能问数（拓展）** | V5 `m11` 只画了简单 SQL 沙箱与 RBAC 注入 | SRS 第5章 + `img_034` 要求 **三条查询路径**：路径A `MetricDataPoint` 同步指标点 / 路径B `BiDAO` 标准KPI与库存 / 路径C 受限 `Vanna 2 Text2SQL`，以及 `NDJSON` 流式事件与对话记忆（8/20/50条、30天清理） | **中** | V6 `d03_qa_agent.png` 完整还原三条路径 + 流式事件封装 + 记忆边界 |
| **7. M4 选品 & M5 预测 & M6 双分支 & M7 内容** | V5 偏重自创规则（如测款 `$25` 上限、10天异常、周一冻结 `WAPE>30%` 硬拦截、双人软删等） | SRS 第6~9章有精确规则：M4 **4种数据性质** `INTERNAL/PAID_EXTERNAL/OPEN_PUBLIC/MOCK` 与 `PRODUCE/SUPPLEMENT/DELIST`；M5 `DemandProfile` 版本锁、空日补零排除当日、误差带非置信区间；M6 **普通分支 vs 智能分支**并列且缺未来预测报 `FORECAST_REQUIRED`；M7 文案确定性策略+独立 `/compliance-check`、视觉 ComfyUI `/prompt→/sync→/history→/view` 校验 MIME 写入 `GenerationMedia.file_data` | **中** | V6 `d04`、`d05`、`d06`、`d07` 全部按 SRS 原文口径与老师 `img_049/060/074/088` 重绘 |
| **8. 超纲重管控机制** | 自创 `approval_policy_config` 三档金额表、全局 30 秒缓冲真撤回+超时红字调整单、10因子节点级 `fact_signature` | SRS 仅在 M6 提交时使用 `fact_signature` + `history_signature` 重算校验，以及各写操作的 `Idempotency-Key` + DB 行锁 + `version`（**无全局30秒撤回和三档金额参数表**） | **中大** | V6 全部移除超纲卡点，只保留 SRS 明确的幂等键、行锁版本号、`fact_signature` 校验与真实 RBAC 鉴权 |

---

## 三、V6 数据流向图清单（`docs/prototypes/dfd_v6/`）

| 文件名 | 模块/主题 | 对齐依据 |
|---|---|---|
| `d00_rbac_roles.png` | 精简 6 角色 RBAC 权限矩阵 | SRS §1.5 + `pilot/rbac/service.py` |
| `d00_system_data_flow.png` | 全局数据流向总图（公共底座 + 7 大 Agent 闭环） | SRS §1.2、§1.3、§1.6 |
| `d01_cs_agent.png` | M1 智能客服 Agent 数据流向图 | SRS 第3章 + `img_008` |
| `d02_bi_design_agent.png` | M2 驾驶舱设计 Agent 数据流向图 | SRS 第4章 + `img_020` |
| `d03_qa_agent.png` | M3 智能问数 Agent（拓展）数据流向图 | SRS 第5章 + `img_034` |
| `d04_selection_agent.png` | M4 选品分析 Agent 数据流向图 | SRS 第6章 + `img_049` |
| `d05_forecast_agent.png` | M5 销量预测 Agent 数据流向图 | SRS 第7章 + `img_060` |
| `d06_replenish_agent.png` | M6 补货预测 Agent（拓展）数据流向图 | SRS 第8章 + `img_074` |
| `d07_content_agent.png` | M7 商品内容创作 Agent 数据流向图 | SRS 第9章 + `img_088` |
| `d08_base_foundation.png` | 公共底座（店铺/订单/商品/独立库存同步/真实RBAC） | 完整闭环底座 + SRS §1.6 / R-01 |

---

## 四、后续逐板块协同把控方式

按您的安排，接下来我们将**逐个功能板块**推进：
1. 您逐一提出某一个板块的具体需求与把控意见（例如先从 **公共底座 / RBAC** 或 **M1 智能客服** 开始）；
2. 我根据您的确认口径先精修该板块的 **数据流向图**；
3. 确认后立即产出/更新该板块对应的 **高保真前端原型图**。
