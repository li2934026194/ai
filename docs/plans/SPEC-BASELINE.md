# 需求基线（SPEC-BASELINE）

> 权威文档只有三份：A `CrossPilot-需求分析.md`、B `AI跨境电商平台V1.0-软件需求规格说明书.md`、C `AI跨境电商平台V1.1-架构与需求.md`。
> 裁决规则：**C 的架构 > B 的 FR 编号与验收口径 > A 的业务背景描述**。
> `模块需求细化_V1.1.md` 的 M01–M10 只作验收细则挂在对应 FR 下面，不扩新需求。
> 编号：`B·FR-xxx` = B 的 FR；`A·FR-xx` = A 的 FR-01~32；`C·C-xx` = C 无编号、按节归纳（C 的实现细节多已在 B 中编号，C-only 只收 B 未覆盖的架构/部署点）。
> 代码状态判定：有路由+有表+有测试+有前端页才算“已实现”；文档写了不算。证据见 `2026-11-20-project-plan.md` 第 3 节。

## B · 公共（FR-COM）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| B·FR-COM-01 | 业务数据按 org_id 租户隔离，读写校验归属 | 公共 | B 第 2 章 FR-COM-01 | P0 | 跨组织不可见 | **与文档口径不一致**：代码用 `dataset_id`，无 `org_id`（`pilot/schema.py:77`） |
| B·FR-COM-02 | 前端统一请求封装 `/api/v1` + orgApi 注入 | 公共 | B 第 2 章 FR-COM-02 | P0 | 前端走统一封装 | **与文档口径不一致**：前端调 `/api/p1~p3`（`pilot/frontend/src/api.js:78`），无 `/api/v1`、无 orgApi |
| B·FR-COM-03 | 统一响应封装 X-Api-Envelope: 1 | 公共 | B 第 2 章 FR-COM-03 | P1 | 拦截器解包 | **未实现**：无此请求头（`pilot/frontend/src/api.js:45`） |
| B·FR-COM-04 | 写操作幂等键或版本校验 | 公共 | B 第 2 章 FR-COM-04 | P0 | 重复提交不产生第二条 | **半实现**：补货流有状态校验（`pilot/core/replenish_flow.py:98`），无通用幂等键 |
| B·FR-COM-05 | 关键操作日志与审计 | 公共 | B 第 2 章 FR-COM-05 | P0 | 操作人/结论/版本留痕 | **半实现**：RBAC 有审计（`pilot/schema.py:506`），业务操作无统一审计 |
| B·FR-COM-06 | 金额数量由服务端确定性规则算，AI 只写文字 | 公共 | B 第 2 章 FR-COM-06 | P0 | AI 不产数字 | **已实现**（补货/预测链）：`pilot/core/inventory.py:224` 全规则计算 |
| B·FR-COM-07 | 模型不可用回退规则或明确标记 | 公共 | B 第 2 章 FR-COM-07 | P0 | 不静默失败 | **半实现**：A1 有 fallback（`pilot/api/service.py:1190`），其余无模型依赖 |
| B·FR-COM-08 | 数据库为最终事实来源，实时通道只通知 | 公共 | B 第 2 章 FR-COM-08 | P0 | 断线 HTTP 回读 | **半实现**：WS 仅 Agent 运行（`pilot/api/ws.py:139`），无业务消息广播 |

## B · 智能客服（FR-CS）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| B·FR-CS-01 | Amazon 邮件中继收发买家消息 | 客服 | B 第 3.2.1 节 FR-CS-01 | P1 | IMAP 拉取+SES 回复 | **未实现**：无 IMAP/SES 代码 |
| B·FR-CS-02 | 中继中断告警+手动兜底 | 客服 | B 第 3.2.1 节 FR-CS-02 | P1 | 降级设计 | **未实现** |
| B·FR-CS-03 | Shopee/Lazada/TikTok 官方消息 API 适配 | 客服 | B 第 3.2.1 节 FR-CS-03 | P2 | 逐平台适配 | **未实现** |
| B·FR-CS-04 | UnifiedMessage + MessageAdapter | 客服 | B 第 3.2.1 节 FR-CS-04 | P1 | 统一领域模型 | **未实现**：无此模型 |
| B·FR-CS-05 | 接入中台（连接/归一/去重/路由/回执） | 客服 | B 第 3.2.1 节 FR-CS-05 | P1 | 只做标准化进出 | **未实现** |
| B·FR-CS-06 | 建 CustomerRecommendedProduct+店铺关联+唯一约束 | 客服 | B 第 3.2.2 节 FR-CS-06 | P0 | 组织/店铺/SKU 唯一 | **未实现**：无此表（`pilot/schema.py` 无） |
| B·FR-CS-07 | 导入先校验后 upsert，异步索引标 INDEXING | 客服 | B 第 3.2.2 节 FR-CS-07 | P0 | 整表校验 | **未实现** |
| B·FR-CS-08 | 20 件一批嵌入写 Milvus，回写 READY/FAILED | 客服 | B 第 3.2.2 节 FR-CS-08 | P0 | 向量数量/维度检查 | **未实现**：Milvus 只用于客服知识库（`pilot/rag/milvus_store.py:155`） |
| B·FR-CS-09 | 向量召回+回表过滤，最多 3 件及依据 | 客服 | B 第 3.2.2 节 FR-CS-09 | P0 | ACTIVE/READY+预算+店铺 | **未实现** |
| B·FR-CS-10 | 推荐查询截断 1000 字符+防旧请求覆盖 | 客服 | B 第 3.2.2 节 FR-CS-10 | P0 | 买家原文优先 | **未实现** |
| B·FR-CS-11 | 只展示 Amazon 店铺，买家发 INQUIRY/COMPLAINT | 客服 | B 第 3.2.3 节 FR-CS-11 | P0 | client_message_id 保留 | **未实现**：无会话页 |
| B·FR-CS-12 | 入站校验+写会话消息意图+WS 广播 | 客服 | B 第 3.2.3 节 FR-CS-12 | P0 | MESSAGE_RECEIVED | **未实现**：无 `POST /inbound` |
| B·FR-CS-13 | 已知句即时译，其余异步补译 | 客服 | B 第 3.2.3 节 FR-CS-13 | P0 | MESSAGE_TRANSLATED | **未实现** |
| B·FR-CS-14 | EventHub 进程内，断线 3 秒 HTTP 回读 | 客服 | B 第 3.2.3 节 FR-CS-14 | P0 | 数据库为准 | **未实现** |
| B·FR-CS-15 | 工作台并行读消息/上下文/意图分析 | 客服 | B 第 3.2.3 节 FR-CS-15 | P0 | 投诉候选查询 | **未实现** |
| B·FR-CS-16 | 售前词触发 Milvus 推荐 | 客服 | B 第 3.2.3 节 FR-CS-16 | P1 | PRESALE_ADVICE | **未实现** |
| B·FR-CS-17 | 推荐商品放入中英文回复 | 客服 | B 第 3.2.3 节 FR-CS-17 | P0 | 标题价格用途链接 | **未实现** |
| B·FR-CS-18 | 中文先快捷译再调翻译接口，需人工核对 | 客服 | B 第 3.2.3 节 FR-CS-18 | P0 | 译文人工核对 | **未实现** |
| B·FR-CS-19 | 模拟发送四重校验，写草稿状态 DELIVERED_MOCK | 客服 | B 第 3.2.3 节 FR-CS-19 | P0 | 拦截承诺/链接/数字不一致 | **未实现**：A1 只有单条草稿（`pilot/api/main.py:259`） |
| B·FR-CS-20 | 规则意图识别保存结果，标注非自主决策 | 客服 | B 第 3.2.3 节 FR-CS-20 | P0 | 非大模型决策 | **未实现** |
| B·FR-CS-21 | 投诉会话人工接管跳售后 | 客服 | B 第 3.2.3 节 FR-CS-21 | P0 | HUMAN 接管 | **未实现** |
| B·FR-CS-22 | 售后只列 MOCK-AMAZON-*，投诉才查候选订单 | 客服 | B 第 3.2.4 节 FR-CS-22 | P0 | 订单号/买家名提示 | **未实现** |
| B·FR-CS-23 | 工单原因/类型预填规则 | 客服 | B 第 3.2.4 节 FR-CS-23 | P0 | 不误改类型 | **未实现** |
| B·FR-CS-24 | 订单关联需买家确认+店铺归属校验 | 客服 | B 第 3.2.4 节 FR-CS-24 | P0 | ConversationOrderLink | **未实现** |
| B·FR-CS-25 | 工单行归属/件数/金额校验，理由 5–1000 字符 | 客服 | B 第 3.2.4 节 FR-CS-25 | P0 | RETURN/REFUND 等四类 | **未实现** |
| B·FR-CS-26 | 附件 10 件/5MB/五类格式，字节存 PG | 客服 | B 第 3.2.4 节 FR-CS-26 | P0 | 下载二次校验 | **未实现** |
| B·FR-CS-27 | 主管行锁+版本审批，external_status 恒 UNKNOWN | 客服 | B 第 3.2.4 节 FR-CS-27 | P0 | 版本+1，不触发真实退款 | **未实现** |

## B · 驾驶舱设计（FR-BI）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| B·FR-BI-01 | Widget/Layout 模型+`bi_dashboard_designs` 双版本 | 驾驶舱 | B 第 4.2 节 FR-BI-01 | P0 | 草稿/发布 JSONB+版本 | **未实现**：无此表 |
| B·FR-BI-02 | 自然语言编排+拖拽+三终端预览 | 驾驶舱 | B 第 4.2 节 FR-BI-02 | P0 | 桌面/平板/手机 | **未实现**：A2 骨架（`pilot/agents/registry.py:339`） |
| B·FR-BI-03 | `/compose` 不持久化，PUT 写草稿，POST /publish 复制 | 驾驶舱 | B 第 4.2 节 FR-BI-03 | P0 | 读写边界 | **未实现**：无此四接口 |
| B·FR-BI-04 | `/describe` 独立分支，先核验再调模型 | 驾驶舱 | B 第 4.2 节 FR-BI-04 | P1 | 不改发布版 | **未实现** |
| B·FR-BI-05 | `layout_only` 两段加载，无发布版回退旧看板 | 驾驶舱 | B 第 4.2 节 FR-BI-05 | P0 | published:null 回退 | **未实现** |
| B·FR-BI-06 | 最多 4 卡并发独立会话，单卡隔离 | 驾驶舱 | B 第 4.2 节 FR-BI-06 | P0 | Cache-Control | **未实现** |
| B·FR-BI-07 | 数值实时重算，旧布局新数值，隐藏暂停刷新 | 驾驶舱 | B 第 4.2 节 FR-BI-07 | P0 | 失败保留旧结果 | **未实现** |
| B·FR-BI-08 | 已知指标不经 LLM 直接显示，`get_qa_client` 选传输 | 驾驶舱 | B 第 4.2 节 FR-BI-08 | P0 | 本地/远程问数 | **未实现** |
| B·FR-BI-09 | `queried_at/data_as_of` 时间边界，Vanna 不学数值 | 驾驶舱 | B 第 4.2 节 FR-BI-09 | P0 | 不直查指标点表 | **未实现** |
| B·FR-BI-10 | 保存发布同会话写日志，读接口不改行 | 驾驶舱 | B 第 4.2 节 FR-BI-10 | P0 | 审计 | **未实现** |

## B · 智能问数（FR-QA）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| B·FR-QA-01 | 销售额/订单/广告/净利润/库存按维度问，追问继承 | 问数 | B 第 5.2 节 FR-QA-01 | P0 | 会话继承 | **未实现**：A3 只问补货指标（`pilot/agents/registry.py:300`） |
| B·FR-QA-02 | 解析→选工具→只读事实→核验→证据，写入拒绝 | 问数 | B 第 5.2 节 FR-QA-02 | P0 | 跨币种不合计 | **未实现** |
| B·FR-QA-03 | 确定性读快照库存，Vanna 只增补解释 | 问数 | B 第 5.2 节 FR-QA-03 | P1 | 不补造数字 | **未实现**：无 Vanna |
| B·FR-QA-04 | `context/bi_ontology.py` 维护本体 | 问数 | B 第 5.2 节 FR-QA-04 | P0 | 别名/映射/口径版本 | **未实现**：无此文件 |
| B·FR-QA-05 | `parse_question/recognize_intent/plan_query` | 问数 | B 第 5.2 节 FR-QA-05 | P0 | 追问继承+写入拦截 | **未实现**：A3 用 `classify_intent`（`pilot/agents/registry.py:108`），非此三函数 |
| B·FR-QA-06 | `BiDAO` 读快照库存异常，`BiToolRunner` 只跑允许工具 | 问数 | B 第 5.2 节 FR-QA-06 | P0 | 同日取最高版本 | **未实现** |
| B·FR-QA-07 | 流式先 status 按需 sql 后 answer_delta | 问数 | B 第 5.2 节 FR-QA-07 | P0 | NDJSON | **未实现**：WS 只跑 Agent（`pilot/api/ws.py:139`） |
| B·FR-QA-08 | `POST /bi/query` + `/bi/query/stream` 双接口 | 问数 | B 第 5.2 节 FR-QA-08 | P0 | 一次性 JSON+流式 | **未实现**：无 `/bi/*` 路由 |
| B·FR-QA-09 | 只记 ANSWERED/NO_DATA/MIXED_CURRENCY，8/20/50/30 天 | 问数 | B 第 5.2 节 FR-QA-09 | P0 | 会话保留 | **未实现**：无会话表 |
| B·FR-QA-10 | 训练 SQL 检索 READY 资料+只读校验+租户隔离 | 问数 | B 第 5.2 节 FR-QA-10 | P2 | 表/函数/行数/时间限制 | **未实现** |
| B·FR-QA-11 | sessionStorage 恢复，新建只删会话 | 问数 | B 第 5.2 节 FR-QA-11 | P0 | 不改经营数据 | **未实现** |

## B · 选品分析（FR-SEL）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| B·FR-SEL-01 | 来源/任务/档案/周事实/测款表+TenantMixin | 选品 | B 第 6.2 节 FR-SEL-01 | P0 | 组织键+唯一约束 | **未实现**：无此五表 |
| B·FR-SEL-02 | 四种数据性质区分，未知不填零 | 选品 | B 第 6.2 节 FR-SEL-02 | P0 | INTERNAL 等四值 | **与文档口径不一致**：代码四值不同（`pilot/schema.py:45`） |
| B·FR-SEL-03 | 导入 25MB+SHA-256+组织哈希去重 | 选品 | B 第 6.2 节 FR-SEL-03 | P0 | 外购键含凭证 | **未实现**：CSV 导入无哈希去重（`pilot/loaders/csv_import.py:64`） |
| B·FR-SEL-04 | QUEUED→202→RUNNING→SUCCEEDED/FAILED | 选品 | B 第 6.2 节 FR-SEL-04 | P0 | 前端轮询双 Tab | **未实现**：CSV 导入同步执行（`pilot/api/service.py:1068`） |
| B·FR-SEL-05 | CSV BOM+XLSX 150MB/50列/5万行+周去重 | 选品 | B 第 6.2 节 FR-SEL-05 | P0 | 来源类型一致 | **未实现**：只支持 CSV（`pilot/loaders/csv_import.py:64`） |
| B·FR-SEL-06 | 净销量/净收入/成本/毛利/经营利润确定性计算 | 选品 | B 第 6.2 节 FR-SEL-06 | P0 | 任一费用未知不生成利润 | **未实现**：无选品利润引擎 |
| B·FR-SEL-07 | 趋势前后半段均值相对变化，至少 4 周 | 选品 | B 第 6.2 节 FR-SEL-07 | P0 | 前半段零则未知 | **未实现** |
| B·FR-SEL-08 | DEMO_ONLY/ESTIMATE_ONLY/BLOCKED/NEED_DATA 状态 | 选品 | B 第 6.2 节 FR-SEL-08 | P0 | 待评审/风险复核 | **未实现** |
| B·FR-SEL-09 | 初筛三模式加权，利润率未知重归一 | 选品 | B 第 6.2 节 FR-SEL-09 | P0 | 0.5/0.4/0.1 等 | **未实现** |
| B·FR-SEL-10 | 批准测款五条件（纯内部+利润率≥10% 等） | 选品 | B 第 6.2 节 FR-SEL-10 | P0 | 缺一不可 | **未实现** |
| B·FR-SEL-11 | 测款建议规则+人工 PRODUCE/SUPPLEMENT/DELIST | 选品 | B 第 6.2 节 FR-SEL-11 | P0 | 90%+利润率 10% 建议投产 | **未实现** |
| B·FR-SEL-12 | 规则排名+可选 LLM 解释，失败回退摘要 | 选品 | B 第 6.2 节 FR-SEL-12 | P1 | 笔记回退关键词 | **未实现**：A4 骨架（`pilot/agents/registry.py:341`） |
| B·FR-SEL-13 | 建档/详情/周事实/概览/评审/测款 API | 选品 | B 第 6.2 节 FR-SEL-13 | P0 | org_id 校验 | **未实现**：无 `/selection-research` |
| B·FR-SEL-14 | 选品数据页统计卡+任务/来源 Tab | 选品 | B 第 6.2 节 FR-SEL-14 | P1 | 按钮弹窗 | **未实现**：无此页 |

## B · 销量预测（FR-FC）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| B·FR-FC-01 | Product/Order/OrderItem/InventoryPosition+三预测表 | 预测 | B 第 7.2 节 FR-FC-01 | P0 | 组织范围+唯一约束 | **与文档口径不一致**：代码有 Products/SalesDaily/InventoryDaily/ForecastRuns（`pilot/schema.py:77,100,118,172`），无 Order/OrderItem/ModelDefinition/Profile |
| B·FR-FC-02 | ForecastStrategy 契约+四类策略登记 | 预测 | B 第 7.2 节 FR-FC-02 | P0 | available 检查依赖 | **半实现**：`MODELS` 四统计模型（`pilot/core/models.py:100`），无契约、无树/深度 |
| B·FR-FC-03 | 自定义模型只元数据，启停不绕检查 | 预测 | B 第 7.2 节 FR-FC-03 | P0 | status only | **未实现**：无模型注册表 |
| B·FR-FC-04 | 画像版本锁，recommend 只给候选不写精度 | 预测 | B 第 7.2 节 FR-FC-04 | P0 | 行锁+版本递增 | **未实现**：无 DemandProfile |
| B·FR-FC-05 | 归集真实日销量，空日补零，排除当日未结束 | 预测 | B 第 7.2 节 FR-FC-05 | P0 | 可售状态+SKU | **半实现**：`aggregate_daily`+`calibrate_demand`（`pilot/core/demand.py:60,104`），但销量来自 dataset 非订单明细 |
| B·FR-FC-06 | 未启用/缺依赖/历史不足显示原因并拒绝 | 预测 | B 第 7.2 节 FR-FC-06 | P0 | 短样本警告 | **半实现**：`InsufficientHistory`（`pilot/core/__init__.py:33`），无前端原因展示 |
| B·FR-FC-07 | 线程池跑预测+滚动回测，存 ForecastRun 可追溯 | 预测 | B 第 7.2 节 FR-FC-07 | P0 | 口径/版本/截止日 | **半实现**：回测有（`pilot/core/backtest.py:50`），未来预测无接口无落库 |
| B·FR-FC-08 | 评估核对来源平台，算 WAPE/偏差/MAE/覆盖率 | 预测 | B 第 7.2 节 FR-FC-08 | P0 | 人工修正留审计 | **半实现**：WAPE/偏差/MAE 有（`pilot/core/metrics.py:28`），覆盖率/人工修正无 |
| B·FR-FC-09 | 误差带标注非 P80/置信区间 | 预测 | B 第 7.2 节 FR-FC-09 | P0 | 明确标注 | **未实现**：无误差带输出 |
| B·FR-FC-10 | 评估中心多维+传补货 | 预测 | B 第 7.2 节 FR-FC-10 | P1 | SKU/店铺/周期/大促 | **未实现** |
| B·FR-FC-11 | WAPE 识别缺货日期 | 预测 | B 第 7.2 节 FR-FC-11 | P1 | 不把缺货当需求 | **半实现**：断货日置 None（`pilot/core/demand.py:104`），WAPE 排除 None 但无缺货日期清单 |
| B·FR-FC-12 | 三页：算法/预测/评估 | 预测 | B 第 7.2 节 FR-FC-12 | P0 | 曲线+导出+修正入口 | **半实现**：P4 只有回测对比（`pilot/frontend/src/pages/P4Forecast.vue`） |

## B · 补货预测（FR-RP）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| B·FR-RP-01 | 普通分支五输入，缺预测用 sales_30d/30 带警告代理 | 补货 | B 第 8.2 节 FR-RP-01 | P0 | CostCard 版本化 | **半实现**：有建议算法（`pilot/core/inventory.py:224`），无 CostCard、无代理分支 |
| B·FR-RP-02 | 智能分支仓位+预测+订单历史+路线，缺预测停预览 | 补货 | B 第 8.2 节 FR-RP-02 | P0 | FORECAST_REQUIRED | **未实现**：无智能分支 |
| B·FR-RP-03 | 双分支先只读方案曲线，AI 只写文字 | 补货 | B 第 8.2 节 FR-RP-03 | P0 | 数值规则所有 | **半实现**：规则算数有，AI 文案无 |
| B·FR-RP-04 | 无事实源参数留空，Pydantic 校验 | 补货 | B 第 8.2 节 FR-RP-04 | P0 | 范围/来源/日期 | **半实现**：`InventoryParams` 有校验（`pilot/core/__init__.py:87`），无来源记录 |
| B·FR-RP-05 | Idempotency-Key+事实签名+重算落 READY_FOR_REVIEW | 补货 | B 第 8.2 节 FR-RP-05 | P0 | 签名不符拒绝 | **与文档口径不一致**：代码用 `pending_approve`（`pilot/core/replenish_flow.py:65`），无签名 |
| B·FR-RP-06 | 普通需有效成本卡+SYNCED，智能需未来预测 | 补货 | B 第 8.2 节 FR-RP-06 | P0 | 库存状态门槛 | **未实现**：无成本卡、无 SYNCED 判定 |
| B·FR-RP-07 | 状态机 READY→APPROVED→EXECUTING→PURCHASE_ORDERED→INSPECTED→SHIPPED | 补货 | B 第 8.2 节 FR-RP-07 | P0 | 越级拒绝 | **与文档口径不一致**：代码 `draft→closed`（`pilot/core/replenish_flow.py:65`） |
| B·FR-RP-08 | 不同于提交人审批+内部任务+版本推进 | 补货 | B 第 8.2 节 FR-RP-08 | P0 | 审批人分离 | **半实现**：有审批（`pilot/api/main.py:172`），无提交人分离校验 |
| B·FR-RP-09 | 事件按计划+类型去重，多批收货保持状态 | 补货 | B 第 8.2 节 FR-RP-09 | P0 | 收货批次独立表 | **半实现**：PO 累计收货（`pilot/schema.py:311`），无事件表 |
| B·FR-RP-10 | 采购质检物流凭证，库存由同步流程改 | 补货 | B 第 8.2 节 FR-RP-10 | P0 | 凭证登记 | **半实现**：有收货质检（`pilot/api/main.py:221`），无凭证表 |
| B·FR-RP-11 | 事实查询组织隔离，智能聚合非演示订单 | 补货 | B 第 8.2 节 FR-RP-11 | P0 | 组织隔离 | **与文档口径不一致**：按 `dataset_id` 隔离 |

## B · 商品内容创作（FR-GC）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| B·FR-GC-01 | 商品主数据+工作流版本（用途/状态/平台/API 图） | 内容 | B 第 9.2 节 FR-GC-01 | P0 | 可选 ComfyUI 图 | **未实现**：无工作流表 |
| B·FR-GC-02 | GenerationJob/Asset/Media+幂等+字节分离 | 内容 | B 第 9.2 节 FR-GC-02 | P0 | content 存 JSON，字节存 file_data | **未实现**：无此三表 |
| B·FR-GC-03 | 幂等查重+归属校验，存 AgentRun/Job/Asset | 内容 | B 第 9.2 节 FR-GC-03 | P0 | 跨组织拒绝 | **未实现**：A7 骨架（`pilot/agents/registry.py:344`） |
| B·FR-GC-04 | 目录事实生成标题要点描述关键词+术语检查 | 内容 | B 第 9.2 节 FR-GC-04 | P0 | 五组草稿+复核标记 | **未实现** |
| B·FR-GC-05 | 合规检查独立 ComplianceCheck 记录 | 内容 | B 第 9.2 节 FR-GC-05 | P0 | 送检≠批准 | **未实现** |
| B·FR-GC-06 | 校验工作流用途，提交 /prompt 存 prompt_id | 内容 | B 第 9.2 节 FR-GC-06 | P0 | 商品图+SVD 视频 | **未实现**：无 ComfyUI |
| B·FR-GC-07 | /sync 轮询 /history，MIME 匹配才入库 SUCCEEDED | 内容 | B 第 9.2 节 FR-GC-07 | P0 | 无输出记失败 | **未实现** |
| B·FR-GC-08 | HTTP 失败不生成占位成功，支持展示下载 | 内容 | B 第 9.2 节 FR-GC-08 | P0 | 真实字节 | **未实现** |
| B·FR-GC-09 | 同任务单选素材，发布人工审批 | 内容 | B 第 9.2 节 FR-GC-09 | P0 | 分流汇合 | **未实现** |
| B·FR-GC-10 | 三种前端模式共用组件 | 内容 | B 第 9.2 节 FR-GC-10 | P1 | 语言+批量卡 | **未实现**：无此页 |

## B · 业务规则（BR-*）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| B·BR-COM-01 | 真实优先，未知空值不填零 | 公共 | B 第 1.4 节 BR-COM-01 | P0 | 演示可识别 | **半实现**：`unit_cost/price` 可 NULL（`pilot/schema.py:77`），但 `query_order` 假数据（`pilot/agents/tools.py:172`）违反 |
| B·BR-COM-02 | 可追溯（依据/证据/版本/审批人/签名） | 公共 | B 第 1.4 节 BR-COM-02 | P0 | 全链路留存 | **半实现**：补货有快照（`pilot/schema.py:205`），问数/预测无 |
| B·BR-COM-03 | 人工最终决策（翻译/回复/工单/测款/补货/内容） | 公共 | B 第 1.4 节 BR-COM-03 | P0 | 关键动作人工确认 | **半实现**：补货有审批，客服/内容无 |
| B·BR-COM-04 | 租户隔离 | 公共 | B 第 1.4 节 BR-COM-04 | P0 | 跨组织不可见 | **与文档口径不一致**：`dataset_id` 非 `org_id` |
| B·BR-COM-05 | AI 边界（规则不称自主决策等） | 公共 | B 第 1.4 节 BR-COM-05 | P0 | 不把模型输出当事实 | **半实现**：A1 指令有声明（`pilot/agents/registry.py:270`），无全局约束 |
| B·BR-COM-06 | 幂等与版本防重防覆盖 | 公共 | B 第 1.4 节 BR-COM-06 | P0 | 幂等 ID/版本号 | **半实现**：状态机有版本（`pilot/core/replenish_flow.py:98`），无通用幂等 |
| B·BR-CS-01 | Amazon 默认草稿+人工确认，白名单才自动 | 客服 | B 第 3.3 节 BR-CS-01 | P0 | 全自动限白名单 | **未实现**：无客服会话 |
| B·BR-CS-02 | 禁营销/外链/超范围触达 | 客服 | B 第 3.3 节 BR-CS-02 | P0 | 平台 AI 扫描 | **未实现** |
| B·BR-CS-03 | 候选订单只是提示不等于核验 | 客服 | B 第 3.3 节 BR-CS-03 | P0 | 需人工核验 | **未实现** |
| B·BR-CS-04 | 后端补 HUMAN 校验（源文档缺口 Q-02） | 客服 | B 第 3.3 节 BR-CS-04 | P0 | 前后端一致 | **未实现** |
| B·BR-CS-05 | 工单 PENDING_REVIEW，外部恒 UNKNOWN | 客服 | B 第 3.3 节 BR-CS-05 | P0 | 内部批准不退款 | **未实现** |
| B·BR-CS-06 | Ecommerce4j 只作参考不作生产依赖 | 客服 | B 第 3.3 节 BR-CS-06 | P0 | 自行维护 | **未实现**（无适配器） |
| B·BR-BI-01 | 预览/保存/发布/刷新读写边界 | 驾驶舱 | B 第 4.3 节 BR-BI-01 | P0 | 编辑不影响线上 | **未实现** |
| B·BR-BI-02 | 编排描述不改发布版，compose 不持久化 | 驾驶舱 | B 第 4.3 节 BR-BI-02 | P0 | 双版本 | **未实现** |
| B·BR-QA-01 | 类图连线不等于 ORM 反向属性 | 问数 | B 第 5.3 节 BR-QA-01 | P0 | 文档口径 | **未实现**（无问数） |
| B·BR-QA-02 | 不把跨币种/缺失/样例/模型生成当事实 | 问数 | B 第 5.3 节 BR-QA-02 | P0 | 数值可证实 | **未实现** |
| B·BR-SEL-01 | 净销量/净收入口径，退款未知则未知 | 选品 | B 第 6.3 节 BR-SEL-01 | P0 | 支付-退款 | **未实现** |
| B·BR-SEL-02 | 商品成本/毛利口径 | 选品 | B 第 6.3 节 BR-SEL-02 | P0 | （采购+头程）×净销量 | **未实现** |
| B·BR-SEL-03 | 经营利润六项，任一未知不生成 | 选品 | B 第 6.3 节 BR-SEL-03 | P0 | 平台/履约/退货/仓储/广告 | **未实现** |
| B·BR-SEL-04 | 外购公网不单独支撑利润与批准 | 选品 | B 第 6.3 节 BR-SEL-04 | P0 | 需内部真实 | **未实现** |
| B·BR-FC-01 | WAPE 定义与 8.33% 算例 | 预测 | B 第 7.3 节 BR-FC-01 | P0 | Σ\|误差\|/Σ实际 | **已实现**：`pilot/core/metrics.py:28` |
| B·BR-FC-02 | WAPE 参考区间（非行业标准） | 预测 | B 第 7.3 节 BR-FC-02 | P0 | ≤5% 优秀…>30% 较差 | **半实现**：计算有，区间展示无 |
| B·BR-FC-03 | MAE/RMSE/MAPE/WAPE/Bias 区别 | 预测 | B 第 7.3 节 BR-FC-03 | P0 | WAPE 不被低销量误导 | **半实现**：MAE/WAPE/Bias 有（`pilot/core/metrics.py:45,62`），RMSE/MAPE 无 |
| B·BR-FC-04 | 闭环链路 历史→预测→评估→补货→回流 | 预测 | B 第 7.3 节 BR-FC-04 | P0 | 反馈优化 | **半实现**：回测→补货有（`pilot/core/inventory.py:224` 调 backtest），评估回流无 |

## B · 非功能（NFR-*，摘要行）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| B·NFR-01 | 租户隔离+演示头不得作生产鉴权 | 公共 | B 第 10 章 NFR-01 | P0 | 真实身份角色校验 | **半实现**：JWT 真鉴权（`pilot/rbac/api.py:170`）但默认关（`pilot/rbac/config.py:16`） |
| B·NFR-02 | Amazon 消息合规红线 | 客服 | B 第 10 章 NFR-02 | P0 | 禁营销外链 | **未实现** |
| B·NFR-03 | 数据真实性四分+未知空值 | 公共 | B 第 10 章 NFR-03 | P0 | 模型输出不作事实 | **半实现**：见 BR-COM-01 |
| B·NFR-04 | 客服 WS+3 秒回读，东南亚首响率 | 客服 | B 第 10 章 NFR-04 | P1 | 实时性 | **未实现** |
| B·NFR-05 | 4 卡并发/线程池/导入 202 | 公共 | B 第 10 章 NFR-05 | P0 | 并发上限 | **未实现**：导入同步（`pilot/api/service.py:1068`） |
| B·NFR-06 | 容量限制（25MB/150MB/10件/1000字符/20批） | 公共 | B 第 10 章 NFR-06 | P0 | 越界拒绝 | **半实现**：CSV 有行数上限（`pilot/loaders/csv_import.py:64`），其余无 |
| B·NFR-07 | 组件隔离+失败保留旧值+回退 | 公共 | B 第 10 章 NFR-07 | P0 | 单点不拖垮 | **半实现**：A1 fallback 有（`pilot/api/service.py:1190`） |
| B·NFR-08 | 可追溯审计 | 公共 | B 第 10 章 NFR-08 | P0 | 证据口径版本 | **半实现**：见 BR-COM-02 |
| B·NFR-09 | 幂等行锁版本签名，DB 为准 | 公共 | B 第 10 章 NFR-09 | P0 | 防并发覆盖 | **半实现**：见 BR-COM-06 |
| B·NFR-10 | 驾驶舱三终端适配 | 驾驶舱 | B 第 10 章 NFR-10 | P1 | 配色布局拖拽 | **未实现** |
| B·NFR-11 | 每模块单测+E2E，桩数值不作结论 | 公共 | B 第 10 章 NFR-11 | P0 | 测试覆盖 | **半实现**：143 测试（`pilot/tests/`），无 E2E（Playwright） |
| B·NFR-12 | 模型/ComfyUI 目标环境验证 | 公共 | B 第 10 章 NFR-12 | P1 | 端到端验证 | **未实现** |

## A · CrossPilot（FR-01~32）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| A·FR-01 | Amazon SP-API OAuth+角色+续签 | 平台接入 | A 第 3.1 节 FR-01 | P0 | 授权+失效暂停提醒 | **未实现**：无 SP-API |
| A·FR-02 | Shopee Open Platform 材料+IP 白名单 | 平台接入 | A 第 3.1 节 FR-02 | P0 | 无权限不采敏感字段 | **未实现** |
| A·FR-03 | TikTok Shop Partner API OAuth 2.0 | 平台接入 | A 第 3.1 节 FR-03 | P0 | 续期/重授权 | **未实现** |
| A·FR-04 | 跨店铺看板 GMV/订单/广告/库存 | 数据服务 | A 第 3.1 节 FR-04 | P0 | 组织品牌店铺站点筛选 | **未实现**：P1 只有补货 KPI（`pilot/api/main.py:110`） |
| A·FR-05 | 销量/ACOS/库存/评分异常+归因 | 数据服务 | A 第 3.1 节 FR-05 | P1 | 阈值时间窗可追溯 | **未实现** |
| A·FR-06 | 日报/周报自动生成 | 数据服务 | A 第 3.1 节 FR-06 | P1 | 数字回溯+可编辑 | **未实现** |
| A·FR-07 | 品类增速/价格带/评分/竞品趋势 | 选品 | A 第 3.2 节 FR-07 | P1 | 标注来源采样覆盖 | **未实现** |
| A·FR-08 | 六维选品评分+供应链匹配 | 选品 | A 第 3.2 节 FR-08 | P1 | 权重可配可解释 | **未实现** |
| A·FR-09 | 多版本标题生成 | 内容 | A 第 3.3 节 FR-09 | P0 | 站点字符+禁用词 | **未实现** |
| A·FR-10 | 主图+A+ 生成+AI 人物标记 | 内容 | A 第 3.3 节 FR-10 | P0 | 平台规格+元数据校验 | **未实现** |
| A·FR-11 | 短视频生成+平台预检 | 内容 | A 第 3.3 节 FR-11 | P1 | 预检不可用阻发布 | **未实现** |
| A·FR-12 | 站点×类目×认证规则矩阵 | 合规 | A 第 3.4 节 FR-12 | P0 | 切换站点得对应规则 | **未实现** |
| A·FR-13 | 禁用词/夸大宣传审核 | 合规 | A 第 3.4 节 FR-13 | P0 | 定位+拦截可追溯 | **未实现** |
| A·FR-14 | 品牌授权/检测报告有效期 | 合规 | A 第 3.4 节 FR-14 | P1 | 到期提醒+过期阻断 | **未实现** |
| A·FR-15 | TikTok 保证金及违规风险监测 | 合规 | A 第 3.4 节 FR-15 | P2 | 数据源更新时间明确 | **未实现** |
| A·FR-16 | 多语言意图+知识检索+自动应答 | 客服 | A 第 3.5 节 FR-16 | P0 | 关联来源，高风险不自动发 | **半实现**：A1 草稿+知识检索（`pilot/agents/tools.py:220`），无会话/自动应答 |
| A·FR-17 | 低置信转人工工单 | 客服 | A 第 3.5 节 FR-17 | P1 | 上下文+接管停自动 | **未实现** |
| A·FR-18 | SKU×站点 7/14/30 日预测+区间 | 预测 | A 第 3.5 节 FR-18 | P0 | 绑定快照模型版本 | **半实现**：回测有，未来预测无（见 B·FR-FC-07） |
| A·FR-19 | 回填实际按品类站点披露误差 | 预测 | A 第 3.5 节 FR-19 | P1 | 缺失不纳入，历史不可覆盖 | **未实现**：无回填评估 |
| A·FR-20 | 组织品牌店铺三级+RBAC | 矩阵 | A 第 3.5 节 FR-20 | P0 | 越权拒绝+审计 | **半实现**：RBAC 真实现（`pilot/rbac/api.py:170`），无三级结构（只有 dataset） |
| A·FR-21 | 统一 SKU 与平台商品 ID 映射 | 矩阵 | A 第 3.5 节 FR-21 | P0 | 多平台映射+冲突识别 | **未实现** |
| A·FR-22 | 多平台库存同步防超卖 | 矩阵 | A 第 3.5 节 FR-22 | P1 | 来源更新时间冲突 | **未实现** |
| A·FR-23 | ComfyUI Server Pool+健康检测 | ComfyUI | A 第 3.3 节 FR-23 | P0 | 不可用不接新任务 | **未实现** |
| A·FR-24 | 工作流注册表+版本回滚 | ComfyUI | A 第 3.3 节 FR-24 | P0 | 执行锁定版本 | **未实现** |
| A·FR-25 | 提交/查询/取消+幂等 | ComfyUI | A 第 3.3 节 FR-25 | P0 | 明确状态 | **未实现** |
| A·FR-26 | GPU 容量队列调度 | ComfyUI | A 第 3.3 节 FR-26 | P0 | 优先级排队 | **未实现** |
| A·FR-27 | 多 SKU 批量生成部分完成 | ComfyUI | A 第 3.3 节 FR-27 | P1 | 单项失败不影响已完成 | **未实现** |
| A·FR-28 | 内置电商工作流模板 | ComfyUI | A 第 3.3 节 FR-28 | P1 | 平台用途版本 | **未实现** |
| A·FR-29 | 生成参数与链路审计 | ComfyUI | A 第 3.3 节 FR-29 | P0 | JSON/种子/提示词可追溯 | **未实现** |
| A·FR-30 | IPTC/XMP 标记写入验证 | ComfyUI | A 第 3.3 节 FR-30 | P0 | 失败拒绝入库 | **未实现** |
| A·FR-31 | GPU 显存利用率队列深度 | ComfyUI | A 第 3.3 节 FR-31 | P1 | 趋势告警 | **未实现** |
| A·FR-32 | 失败重试与降级 | ComfyUI | A 第 3.3 节 FR-32 | P1 | 上限+规格变化知晓 | **未实现** |

## C · 架构与部署（C-only，B 未编号）

| 编号 | 需求一句话 | 模块 | 来源 | 优先级 | 验收标准 | 当前代码状态 |
|---|---|---|---|---|---|---|
| C·C-01 | 七层分层：场景→应用→服务→AI→数据→接入→底座 | 架构 | C 总体架构（`img_001`） | P0 | 实心/虚线图例 | **半实现**：分层有（`img_002`），图例失真（见 project-plan 附录） |
| C·C-02 | 单 FastAPI 进程+PostgreSQL，非微服务 | 架构 | C 总体架构 | P0 | 共用进程 | **已实现**：`pilot/api/main.py:50` 单 app |
| C·C-03 | 技术栈 Vue3+FastAPI+PG+按需 AI 服务 | 架构 | C 技术栈选型（`img_003`） | P0 | 版本以 lock 为准 | **与文档口径不一致**：前端 JS 非 TS，无 Router/Axios（`pilot/frontend/package.json`） |
| C·C-04 | 部署 Nginx+Docker Compose+Jenkins+Shell | 部署 | C 第 8 节（`img_098`） | P1 | 单机演示 | **半实现**：有 `pilot/deploy/nginx-pilot.conf`，无 Docker/Jenkins |
| C·C-05 | 异步 Redis/Celery，问数 Vanna，内容 ComfyUI | 部署 | C 第 8 节 | P1 | 按需启用 | **未实现**：无 Celery/Vanna/ComfyUI 调用 |
| C·C-06 | 客服邮件中继（SP-API 只写不读） | 客服 | C 第 1.1 节 | P1 | IMAP/SES | **未实现**（同 B·FR-CS-01） |
| C·C-07 | 统一消息模型+适配器（Shopee/Lazada/TikTok） | 客服 | C 第 1.2 节 | P1 | UnifiedMessage | **未实现**（同 B·FR-CS-04） |
| C·C-08 | 驾驶舱草稿/发布双版本+快照+实时问数 | 驾驶舱 | C 第 2.1 节 | P0 | 编辑不影响线上 | **未实现**（同 B·FR-BI） |
| C·C-09 | 问数只读+本体+双传输+会话记忆 | 问数 | C 第 3.1 节 | P0 | 证据口径质量 | **未实现**（同 B·FR-QA） |
| C·C-10 | 选品四种数据性质+未知不填零 | 选品 | C 第 4.1 节 | P0 | 只有内部真实支撑批准 | **未实现**（同 B·FR-SEL） |
| C·C-11 | 预测三页闭环+误差带非置信区间 | 预测 | C 第 5.1 节 | P0 | 版本截止日可追溯 | **半实现**（同 B·FR-FC） |
| C·C-12 | 补货双分支+事实签名+状态机 | 补货 | C 第 6.1 节（`img_074/079`） | P0 | FORECAST_REQUIRED | **半实现**（同 B·FR-RP，口径不一致） |
| C·C-13 | 内容双路径（确定性文案+ComfyUI 视觉） | 内容 | C 第 7.1 节 | P0 | 取回真实文件才成功 | **未实现**（同 B·FR-GC） |

## 矛盾裁决（按 C 架构 > B FR/验收 > A 背景）

| # | 矛盾 | 裁决 | 依据 |
|---|---|---|---|
| X1 | 模块编号：B 的 M1–M7（7 Agent）vs A 的六类 Agent（运营/选品/内容/合规/客服/预测）vs C 的 7 Agent | **以 B 的 FR 编号为准**；A 的 FR-01~32 保留为 A·FR 行，不与 B 混号 | B 第 1.2 节模块清单 |
| X2 | 客服范围：B/C 把客服列为第 1 个 Agent，A 把客服列为六类之一 | **客服在范围内**（B/C 优先于 A 背景）；M01–M10 细则不含客服不作数（用户已裁决 M01–M10 只当验收细则） | 用户裁决规则 |
| X3 | 数据性质：B/C 四值（INTERNAL/PAID_EXTERNAL/OPEN_PUBLIC/MOCK）vs 代码四值（TEST_API/OPEN_PUBLIC/PLATFORM_REPORT/SYNTHETIC） | **以 B/C 四值为准**，代码加映射表不改名 | B 第 6.1 节；C 第 4.1 节 |
| X4 | 租户：B/C `org_id` vs 代码 `dataset_id` | **以 B/C `org_id` 为准**，代码本期保留 `dataset_id` 并标注差距 | B FR-COM-01；C 第 3.4 节 |
| X5 | 补货状态机：B `READY_FOR_REVIEW→SHIPPED` vs 代码 `draft→closed` | **以 B 为准**，代码加映射层 | B FR-RP-07；C 第 6.4 节 |
| X6 | 预测模型谱：B 统计/间歇/树/深度 vs 代码 4 统计 | **以 B 为准**，代码缺树/深度记差距 | B FR-FC-02 |
| X7 | 前端栈：C 图称 Vue3+TypeScript+Router+Axios vs 代码 Vue3 JS+fetch | **以 C 为准**，代码记差距 | C 技术栈选型（`img_003`） |
| X8 | 部署：C 称 Jenkins+Docker+Celery+Vanna+ComfyUI vs 代码无 | **以 C 为准**，代码记未实现 | C 第 8 节（`img_098`） |
| X9 | A 的 P0~P3 队列优先级 vs FR 优先级 | **队列优先级与 FR 优先级分开管理**（A 第 3.3 节已声明） | A 第 3.3 节 |
| X10 | A 的性能数值（P95 1.5s、100 SKU/小时等） vs B 未给 | **以 A 为待核实输入**，不作验收门槛（A 头部已声明） | A 头部声明；B 第 0.2 节转换规则 |

---

*基线完。逐 FR 代码状态的详细证据见 `2026-11-20-project-plan.md` 第 3 节。*
