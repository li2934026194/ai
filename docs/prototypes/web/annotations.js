export const MODULE_DEFS = [
  {
    id: "m0",
    label: "M0 公共底座",
    pages: [
      { id: "m0a", label: "店铺授权接入 (OAuth)" },
      { id: "m0b", label: "商品与订单主数据" },
      { id: "m0c", label: "分店独立库存中心" },
    ],
  },
  {
    id: "m1",
    label: "M1 智能客服 Agent",
    pages: [
      { id: "m1a", label: "客服三栏工作台" },
      { id: "m1b", label: "客服导购商品库" },
      { id: "m1d", label: "模拟买家入口" },
      { id: "m1c", label: "售后工单审批" },
    ],
  },
  {
    id: "m2",
    label: "M2 驾驶舱设计",
    pages: [
      { id: "m2a", label: "低代码设计工作台" },
      { id: "m2b", label: "已发布经营大屏" },
    ],
  },
  {
    id: "m3",
    label: "M3 智能问数 Agent",
    pages: [
      { id: "m3a", label: "指标管理与调度" },
      { id: "m3b", label: "经营智能问答" },
    ],
  },
  {
    id: "m4",
    label: "M4 选品分析 Agent",
    pages: [
      { id: "m4a", label: "三源数据接入" },
      { id: "m4b", label: "选品推荐与初筛" },
      { id: "m4c", label: "待审清单与拍板 (主管)" },
    ],
  },
  {
    id: "m5",
    label: "M5 销量预测 Agent",
    pages: [
      { id: "m5a", label: "需求画像与模型注册" },
      { id: "m5b", label: "销量预测执行与曲线" },
      { id: "m5c", label: "回测 WAPE 评估与修正" },
    ],
  },
  {
    id: "m6",
    label: "M6 补货预测 Agent",
    pages: [
      { id: "m6a", label: "普通补货测算" },
      { id: "m6b", label: "智能补货测算" },
      { id: "m6c", label: "计划校验与主管审批" },
      { id: "m6d", label: "采购单与分批收货凭证" },
    ],
  },
  {
    id: "m7",
    label: "M7 商品内容创作",
    pages: [
      { id: "m7a", label: "Listing 文案生成" },
      { id: "m7b", label: "AI 商品主图 (1大4小)" },
      { id: "m7c", label: "AI 短视频生成" },
      { id: "m7d", label: "整套交付与合规审核" },
    ],
  },
  {
    id: "m8",
    label: "M8 员工与权限管理",
    pages: [
      { id: "m8a", label: "员工名册与角色分配" },
      { id: "m8b", label: "9角色权限矩阵与审计" },
    ],
  },
];

export const PAGE_META = {
  m0a: {
    breadcrumb: "CROSSPILOT / M0 公共底座 · 店铺授权接入",
    title: "店铺授权接入（OAuth2 · 实盘与演示隔离）",
    subtitle: "统一接入 Shopee / TikTok Shop / Amazon 店铺，严格隔离 REAL 实盘与 MOCK 演示通道。",
    blocks: [
      { color: "#2563eb", title: "3 家店铺连接概览", step: "0.2 步骤1 店铺授权状态", srs: "SRS §1.4 & §2.1 多平台店铺管理", tech: "OAuth2 加密 Token 存储" },
      { color: "#10b981", title: "REAL vs MOCK 环境隔离", step: "0.2 步骤2 阻断演示数据混入实利", srs: "SRS §0.3 明确隔离 Amazon 沙盒", tech: "source_mode 校验与前端标签隔离" },
    ],
    ledger: [
      ["3家 / REAL vs MOCK", "§0.3 示例", "Shopee TH、TikTok US 为实盘；Amazon 为演示沙盒"],
      ["OAuth2 Token 刷新", "SRS §1.3", "消息与订单接入中台统一管理授权续期"],
    ],
  },
  m0b: {
    breadcrumb: "CROSSPILOT / M0 公共底座 · 商品与订单主数据",
    title: "商品主档（Product）与标准化订单明细（Order）",
    subtitle: "维护内部主 SKU、店铺映射编号（platform_sku）、成本卡与多渠道订单，支持搜索筛选与右侧抽屉核验。",
    blocks: [
      { color: "#2563eb", title: "主 SKU 与店铺在售映射", step: "0.2 步骤3 一货多店与单店专卖区分", srs: "SRS §2.2 & §5.2 Product 统一主档", tech: "products + shop_sku_mappings + sha256 幂等" },
      { color: "#7c3aed", title: "成本卡版本与订单事实", step: "0.2 步骤3 供 M1/M2/M5/M6 读取", srs: "SRS FR-RP-01 成本卡缺失禁止补货", tech: "ReplenishmentCostCard 版本锁" },
    ],
    ledger: [
      ["4个示例SKU / 1,536单", "§0.3 示例", "BAG-108/FAN-203/MAT-014/COS-052"],
      ["sha256 幂等去重", "SRS架构", "防止重复拉取订单导致 GMV 虚增"],
    ],
  },
  m0c: {
    breadcrumb: "CROSSPILOT / M0 公共底座 · 分店独立库存中心",
    title: "分店独立库存同步与盘点校准中心",
    subtitle: "按「3家店铺 × 物理仓 × 在售SKU」展示独立可售/锁定库存；支持仓管直接盘点改数并联动 M5/M6 缺口重算。",
    blocks: [
      { color: "#f59e0b", title: "分店分仓独立口径", step: "0.3 区分跨店独立库存与MOCK隔离", srs: "SRS §1.4 & FR-RP 库存独立口径", tech: "InventoryPosition (shop_id + warehouse_id + sku)" },
      { color: "#10b981", title: "人工盘点校准（联动M5/M6）", step: "0.3 唯一允许改写库存的入口", srs: "SRS §8.1 采购收货绝不自动改库存", tech: "仅 warehouse/manager 可校准，实时刷新缺口" },
    ],
    ledger: [
      ["BAG-108 美仓18 / 泰仓52", "§0.3 示例", "同一主SKU在不同店铺/物理仓拥有独立库存"],
      ["FAN-203 43件 / 安全60", "§0.3 示例", "对齐老师 img_082 FAN-203 泰国仓示例"],
      ["不自动改写库存", "SRS红线", "采购收货凭证仅留痕，不自动加可售库存"],
    ],
  },
  m1a: {
    breadcrumb: "CROSSPILOT / M1 智能客服 · 三栏工作台",
    title: "跨境智能客服工作台（会话 · 推荐 · 译文 · 订单关联）",
    subtitle: "对齐老师 img_017 三栏工作台：切换会话、触发敏感词人工接管、双语编辑回复并核验绑定订单。",
    blocks: [
      { color: "#2563eb", title: "多渠道会话队列", step: "1.2 步骤1 入站聚类与状态机", srs: "SRS FR-CS-12/14 AI_AUTO/PENDING_HUMAN", tech: "WebSocket + HTTP 3秒回读兜底" },
      { color: "#10b981", title: "译文/敏感拦截/Top-3推荐", step: "1.2 步骤2-3 人工接管与双语核对", srs: "SRS FR-CS-17~21 禁止AI承诺退款", tech: "pgvector Top-3 + 双语数字一致拦截" },
      { color: "#7c3aed", title: "订单核验与跳转售后", step: "1.3 步骤1 核验后建售后工单", srs: "SRS FR-CS-24 ConversationOrderLink", tech: "PostgreSQL 订单行归属校验" },
    ],
    ledger: [
      ["PENDING_HUMAN / 88%", "SRS+示例", "状态枚举自SRS；88%为本会话示例"],
      ["SYN9D-005671 / $34.50", "§0.3 示例", "对齐老师 img_017 示例订单号"],
    ],
  },
  m1b: {
    breadcrumb: "CROSSPILOT / M1 智能客服 · 客服导购商品库",
    title: "客服售前导购商品库（话术依据与 XLSX 向量化）",
    subtitle: "仅供客服聊天时检索本店在售商品、价格与购买链接（CustomerRecommendedProduct），区别于 M4 新品选品。",
    blocks: [
      { color: "#2563eb", title: "为什么放在客服模块而不是 M4 选品？", step: "1.1 客服查本店在售货典", srs: "SRS §3.1 推荐目录与选品池隔离", tech: "CustomerRecommendedProduct" },
      { color: "#10b981", title: "XLSX 校验与批量入库", step: "1.1 步骤3 每20件一批写入向量", srs: "SRS FR-CS-07/08 READY/FAILED 状态", tech: "openpyxl + Embedding 异步任务" },
    ],
    ledger: [
      ["Shopee TH / TikTok US", "§0.3 示例", "按店铺隔离推荐商品，跨店链接拦截"],
      ["每20件批向量化", "SRS FR-CS-08", "检查向量维度后回写 READY"],
    ],
  },
  m1d: {
    breadcrumb: "CROSSPILOT / M1 智能客服 · 模拟买家入口",
    title: "模拟买家入站消息生成器（仅买家(模拟) / 客服联调）",
    subtitle: "对齐老师 img_016：发送英文商品咨询或售后投诉，实时推入客服三栏工作台触发推荐或拦截。",
    blocks: [
      { color: "#2563eb", title: "Mock 买家入站入口", step: "1.2 前置测试入口", srs: "SRS FR-CS-11 仅模拟Amazon买家入站", tech: "POST /inbound 幂等入站 + 广播" },
    ],
    ledger: [
      ["Mock Buyer 入口", "SRS §1.5", "买家（模拟）唯一可访问页面"],
      ["client_message_id", "SRS FR-CS-11", "防重试重复入站"],
    ],
  },
  m1c: {
    breadcrumb: "CROSSPILOT / M1 智能客服 · 售后工单审批",
    title: "售后工单创建与主管审批中心",
    subtitle: "客服创建工单并核验金额上限；主管/审批人通过行锁 + SoD 审批，平台侧标为 external_status = UNKNOWN。",
    blocks: [
      { color: "#f59e0b", title: "external_status=UNKNOWN", step: "1.3 步骤3 不虚构平台自动退款", srs: "SRS §0.3 诚实外部状态边界", tech: "工单表记录 external_status 枚举" },
      { color: "#2563eb", title: "行锁与 SoD 审批", step: "1.3 步骤2-3 客服建单→主管审批", srs: "SRS FR-CS-25/27 SELECT FOR UPDATE", tech: "提交人与审批人不可同账号" },
    ],
    ledger: [
      ["TK-20261119-01 / $34.50", "§0.3 示例", "不超过原订单总金额校验"],
      ["external_status=UNKNOWN", "SRS §0.3", "不声明已接通平台自动退款到账"],
    ],
  },
  m2a: {
    breadcrumb: "CROSSPILOT / M2 驾驶舱设计 · 低代码工作台",
    title: "驾驶舱低代码设计工作台（组件库 · 画布 · 属性）",
    subtitle: "自由添加/上移/下移/删除卡片组件、绑定 M3 统一指标口径、预览公式并发布至经营大屏。",
    blocks: [
      { color: "#2563eb", title: "组件库与画布排布", step: "2.1 步骤1-2 拖拽/排序/删除组件", srs: "SRS FR-BI-01 草稿与发布双版本", tech: "12列栅格布局 JSON Schema" },
      { color: "#7c3aed", title: "统一指标绑定与公式", step: "2.1 步骤2-3 复用M3口径与AI解读", srs: "SRS §2.3 确保M2/M3零偏差", tech: "metric_definitions 元数据联动" },
    ],
    ledger: [
      ["$125,429.99 / $65,529.67", "§0.3 示例", "对齐老师 img_043 同套经营事实"],
      ["净利率 = 净利润 ÷ GMV", "SRS口径", "旁注公式实时代入当前选中指标值"],
    ],
  },
  m2b: {
    breadcrumb: "CROSSPILOT / M2 驾驶舱 · 已发布经营大屏",
    title: "CrossPilot 经营总览大屏（发布态 · 只读看板）",
    subtitle: "4 张并发 KPI 卡片附带计算公式旁注，展示趋势折线、双时间戳，并支持带着上下文直跳 M3 智能问数。",
    blocks: [
      { color: "#2563eb", title: "双时间基准与并发拉取", step: "2.2 步骤1-2 标注口径版本与截止时间", srs: "SRS FR-BI-03/04 只读稳定版式", tech: "Promise.all 并发读取 metric_snapshots" },
      { color: "#7c3aed", title: "公式旁注与联动问数", step: "2.2 步骤3 解读异常并跳M3追问", srs: "SRS §2.3 口径与问数完全一致", tech: "净利率 & ACOS 算式实时展示" },
    ],
    ledger: [
      ["52.2% 净利率 / 14.9% ACOS", "实时计算", "由 GMV/广告/净利润现场代入算式得出"],
      ["metric_snapshots v1.2", "SRS统一", "与 M3 智能问数共用事实快照"],
    ],
  },
  m3a: {
    breadcrumb: "CROSSPILOT / M3 智能问数 · 指标与调度",
    title: "指标管理与多源数据绑定调度（M3 前置底座）",
    subtitle: "配置内置汇总或 REST API 指标提取路径，通过 Celery Beat 周期巡检并写入统一指标快照。",
    blocks: [
      { color: "#2563eb", title: "指标字典与别名管理", step: "3.1 步骤1 维护 bi_ontology 口径", srs: "SRS FR-QA-04 指标别名与单位版本", tech: "context/bi_ontology.py + metric_definitions" },
      { color: "#10b981", title: "REST/模拟调度巡检", step: "3.1 步骤2-3 周期拉取写入快照", srs: "SRS/img_041 METRIC_REST_BASE_URL", tech: "Celery Beat 每分钟巡检" },
    ],
    ledger: [
      ["METRIC_REST_BASE_URL", "SRS/img_041", "REST 接入必需环境变量"],
      ["360,000 / 5,600 USD", "§0.3 示例", "对齐老师 img_042 SIMULATION 示例"],
    ],
  },
  m3b: {
    breadcrumb: "CROSSPILOT / M3 智能问数 · 经营智能问答",
    title: "经营智能问答助手（Vanna Text-to-SQL · 只读守卫）",
    subtitle: "回答 GMV/利润/广告/库存问题并附证据 SQL 与算式；多币种不强行混加，UPDATE/DELETE 直接拦截。",
    blocks: [
      { color: "#f59e0b", title: "多币种分离与口径说明", step: "3.2 步骤1 解析时间/平台/币种", srs: "SRS FR-QA-02/06 跨币种不强行合计", tech: "parse_question() + recognize_intent()" },
      { color: "#ef4444", title: "只读白名单拦截写操作", step: "3.2 步骤2-3 证据SQL与写拦截", srs: "SRS BR-QA-02 严禁修改业务数据", tech: "SQL AST 单条只读校验 + 审计留痕" },
    ],
    ledger: [
      ["65,529.67 / 2,933.63 USD", "§0.3 示例", "对齐老师 img_043 对话数字"],
      ["只读 SELECT 守卫", "SRS §5.2", "硬编码拦截所有 UPDATE/DELETE/DROP"],
    ],
  },
  m4a: {
    breadcrumb: "CROSSPILOT / M4 选品分析 · 三源数据接入",
    title: "选品三源数据接入中心（外购估算 · 内部实际 · 公网观察）",
    subtitle: "严格区分四类数据性质（INTERNAL / PAID_EXTERNAL / OPEN_PUBLIC / MOCK），含 mock 文件名禁止作真实数据导入。",
    blocks: [
      { color: "#2563eb", title: "三源分卡与数据性质边界", step: "4.1 步骤1 外购不可支撑实际利润", srs: "SRS FR-SEL-02 未知费用保持空值", tech: "TenantMixin + SHA-256 重复校验" },
      { color: "#10b981", title: "异步任务与Mock强拦截", step: "4.1 步骤2-3 QUEUED→SUCCEEDED/FAILED", srs: "SRS FR-SEL-03/04/05 限制25MB/5万行", tech: "SHA256 文件哈希 + mock 关键词阻断" },
    ],
    ledger: [
      ["10,000条 / 160条", "§0.3 示例", "对齐老师 img_056 接入统计数字"],
      ["未知费用不按0算", "SRS FR-SEL-02", "缺失成本或费用时不生成假经营利润"],
    ],
  },
  m4b: {
    breadcrumb: "CROSSPILOT / M4 选品分析 · 选品推荐与初筛",
    title: "M4-2 多维选品推荐与 AI 初筛工作台",
    subtitle: "支持按「综合均衡 / 规模创收 / 高增趋势」三大推荐视角实时重排榜单，透明呈现 4 维推荐依据与计算公式。",
    blocks: [
      { color: "#2563eb", title: "三大推荐视角与 4 维依据", step: "4.2 步骤1 选择推荐关注维度", srs: "SRS FR-SEL-09 均衡/收入/增长三权重模式", tech: "先规则排序再可选 LLM 摘要（FR-SEL-12）" },
      { color: "#10b981", title: "状态Tab与提交待审", step: "4.2 步骤2-3 核验算式并提交待审", srs: "SRS §6.3 未知利润率重归一不按0算", tech: "选品研究员初筛提交 → 转交 M4-3 主管" },
    ],
    ledger: [
      ["0.5净收入+0.4趋势+0.1利润率", "SRS FR-SEL-09", "利润率未知时在可用权重内重新归一化"],
      ["选品研究员 ≠ 主管终审", "SoD 规则", "本页仅初筛入清单，测款拍板在 M4-3"],
    ],
  },
  m4c: {
    breadcrumb: "CROSSPILOT / M4 选品分析 · 待审清单与测款拍板 (主管)",
    title: "M4-3 待审选品清单与测款终审拍板（主管/审批人专页）",
    subtitle: "独立承载主管视角：核对纯内部实盘与≥10%利润率门槛，做出 PRODUCE(投产) / SUPPLEMENT(继续测款) / DELIST(淘汰) 决策。",
    blocks: [
      { color: "#7c3aed", title: "测款批准硬性门槛检查", step: "4.3 步骤1 核对纯内部实际与缺失项", srs: "SRS FR-SEL-10 纯内部+利润率≥10%+无高风险", tech: "门槛未达标自动禁用投产或高亮风险" },
      { color: "#ef4444", title: "PRODUCE / SUPPLEMENT / DELIST", step: "4.3 步骤2-3 主管拍板并记录理由", srs: "SRS FR-SEL-11 规则建议+人工最终结论", tech: "selection_decisions 审批留痕表" },
    ],
    ledger: [
      ["利润率 ≥ 10% 硬门槛", "SRS FR-SEL-10", "外购估算数据只可观察/继续补采，不可批准投产"],
      ["PRODUCE/SUPPLEMENT/DELIST", "SRS FR-SEL-11", "SRS 原文三类测款最终决策枚举"],
    ],
  },
  m5a: {
    breadcrumb: "CROSSPILOT / M5 销量预测 · 画像与模型注册",
    title: "M5-1 SKU 需求画像（DemandProfile）与 9 模型注册表",
    subtitle: "维护 SKU 需求模式（带版本锁），根据真实有单天数门槛校验 9 类算法可执行性并推荐候选模型。",
    blocks: [
      { color: "#2563eb", title: "DemandProfile 版本递增", step: "5.1 步骤1-2 识别需求画像与候选", srs: "SRS FR-FC-04 行锁+版本校验刷新推荐", tech: "recommend() 只给候选理由，不承诺精度" },
      { color: "#10b981", title: "9模型注册与历史门槛", step: "5.1 步骤3 校验依赖与最低历史天数", srs: "SRS FR-FC-02/03/06 门槛不足拒绝执行", tech: "ForecastStrategy 契约 + 启停开关" },
    ],
    ledger: [
      ["BAG-108 / 96天(90天有单)", "§0.3 示例", "对齐老师 img_069 真实历史点数"],
      ["TFT需≥180点 / TSFM≥8点", "SRS/img_067", "直接源自老师 img_067 模型注册表"],
    ],
  },
  m5b: {
    breadcrumb: "CROSSPILOT / M5 销量预测 · 执行预测与曲线",
    title: "M5-2 真实销量预测执行与未来曲线工作台",
    subtitle: "基于已完成订单日频归集（排除当日未完结），运行选定模型输出未来 7/14/30 天曲线、非置信误差带与建议补货算式。",
    blocks: [
      { color: "#2563eb", title: "预测参数与实时联动重算", step: "5.2 步骤1 选SKU/模型/预测窗口", srs: "SRS FR-FC-05/07 排除当日未结束订单", tech: "实时读取 M0-3 最新库存重算建议补货量" },
      { color: "#10b981", title: "预测曲线与非置信误差带", step: "5.2 步骤2-3 展示误差带说明", srs: "SRS FR-FC-09 误差带非统计学P80置信区间", tech: "SVG 交互曲线 + 建议补货公式旁注" },
    ],
    ledger: [
      ["29/63/27/138/130/88/153", "§0.3 示例", "对齐老师 img_069 BAG-108 逐日预测"],
      ["补货参考 = 预测+安全-可售", "SRS §7.1", "实时读取 M0-3 分店当前可售库存计算"],
    ],
  },
  m5c: {
    breadcrumb: "CROSSPILOT / M5 销量预测 · 回测 WAPE 评估与修正",
    title: "M5-3 历史回测评估中心（WAPE · MAE · Bias · 人工修正）",
    subtitle: "展示 WAPE / MAE / Bias 完整公式与实时代入计算；支持识别缺货日、修正实际销量并保留原始事实留痕。",
    blocks: [
      { color: "#7c3aed", title: "三大评估指标实时算式", step: "5.3 步骤1 区分 WAPE/MAE/Bias 与区间评级", srs: "SRS BR-FC-01/02/03 计算公式与评级标准", tech: "修正实际值后立即重算 Σ|实际-预测|÷Σ实际" },
      { color: "#f59e0b", title: "缺货日标记与修正审计", step: "5.3 步骤2-3 保留原始订单事实", srs: "SRS FR-FC-08/11 标记缺货日防失真", tech: "人工修正记录操作人与时间" },
    ],
    ledger: [
      ["WAPE = Σ|实际-预测|÷Σ实际", "SRS BR-FC-01", "≤5%极优 / 5-10%优 / 10-20%良 / 20-30%一般"],
      ["保留原始订单值", "SRS FR-FC-08", "人工修正不覆盖底层 OrderItem 事实"],
    ],
  },
  m6a: {
    breadcrumb: "CROSSPILOT / M6 补货预测 · 普通补货测算",
    title: "M6-1 普通补货测算（近30天代理 · 淡旺季/活动依据 · 三方案）",
    subtitle: "还原老师 img_082：缺 M5 预测时允许以近30天销量÷30作代理；填写淡旺季/活动/排名人工依据并实时对比保守/平衡/激进三方案。",
    blocks: [
      { color: "#2563eb", title: "30天代理与人工调节依据", step: "6.1 步骤1-2 淡旺季(%)/活动/排名必填依据", srs: "SRS FR-RP-01/04 非零调整须填依据，缺成本禁提", tech: "Sales_30d/30 代理 + 实时公式代入" },
      { color: "#10b981", title: "逐日基线表与三方案模拟", step: "6.1 步骤3 提交 NORMAL 计划草案", srs: "SRS FR-RP-03 规则定数量，AI仅写摘要", tech: "planning_mode = NORMAL，与智能列表隔离" },
    ],
    ledger: [
      ["FAN-203 / 30件/天 / 43件", "§0.3 示例", "对齐老师 img_082 示例数字"],
      ["目标 = 日均×(交期+安全)", "SRS算式", "随滑块/输入变化实时重算缺口与三方案"],
    ],
  },
  m6b: {
    breadcrumb: "CROSSPILOT / M6 补货预测 · 智能补货测算",
    title: "M6-2 智能补货测算（M5预测驱动 · 多仓覆盖风险 · 路线比例）",
    subtitle: "还原老师 img_083：强制读取 M5 已保存未来预测与多仓覆盖天数风险；若选中无预测 SKU 则严格触发 FORECAST_REQUIRED 阻断。",
    blocks: [
      { color: "#ef4444", title: "FORECAST_REQUIRED 硬阻断", step: "6.1 步骤1 缺M5未来预测严禁降级", srs: "SRS §8.1 & AC-RP-01 缺未来预测停止预览", tech: "切换 COS-052 / MAT-014 可真实触发拦截" },
      { color: "#2563eb", title: "SKU覆盖风险与路线分配", step: "6.1 步骤2-3 物流海运/空运与仓位比例", srs: "SRS FR-RP-02/06 历史成交+路线报价依据", tech: "planning_mode = SMART 提交独立审批队列" },
    ],
    ledger: [
      ["FORECAST_REQUIRED", "SRS §8.1", "智能分支绝不降级使用 30天代理"],
      ["BAG-108 覆盖 0.2天 (高风险)", "§0.3 示例", "对齐老师 img_083 多仓风险巡检表"],
    ],
  },
  m6c: {
    breadcrumb: "CROSSPILOT / M6 补货预测 · 计划校验与主管审批",
    title: "M6-3 补货计划校验与主管审批中心（NORMAL / SMART 分列）",
    subtitle: "严格隔离普通计划与智能计划列表；校验参数快照签名重算一致后，由「主管/审批人」执行 SoD 审批。",
    blocks: [
      { color: "#2563eb", title: "NORMAL 与 SMART 独立列表", step: "6.2 步骤1 两类计划互不混入", srs: "SRS §8.1 snapshot.planning_mode 隔离", tech: "Idempotency-Key + 事实签名重算校验" },
      { color: "#7c3aed", title: "提交≠审批 (SoD) 行锁审批", step: "6.2 步骤2-3 主管批准生成内部执行任务", srs: "SRS FR-RP-07/08 状态机按序推进", tech: "READY_FOR_REVIEW → APPROVED / REJECTED" },
    ],
    ledger: [
      ["两列表互不混入", "SRS AC-RP-01", "Tab 明确隔离普通计划与智能计划"],
      ["提交人 ≠ 审批人", "SRS FR-RP-08", "运营提交后必须由主管/审批人审批"],
    ],
  },
  m6d: {
    breadcrumb: "CROSSPILOT / M6 补货预测 · 采购单与分批收货凭证",
    title: "M6-4 采购履约与分批收货差异凭证（不改 M0 库存）",
    subtitle: "由「采购/仓库/物流人员」登记采购单、质检报告、物流单与分批收货差异；严格遵守收货凭证不直接改写 M0 可售库存。",
    blocks: [
      { color: "#ef4444", title: "收货不改库存红线", step: "6.3 步骤3 仅写履约审计台账", srs: "SRS FR-RP-10 & AC-RP-04", tech: "分批收货独立表 receipt_batches" },
      { color: "#10b981", title: "多批收货差异与事件流水", step: "6.3 步骤1-2 登记短装/质检与状态推进", srs: "SRS FR-RP-07/09 多批收满前保持PURCHASE_ORDERED", tech: "仅 warehouse 可登记入库凭证" },
    ],
    ledger: [
      ["PO-20261119-03 / -5短装", "§0.3 示例", "多批分批收货与差异复盘示例"],
      ["不自动加 M0 库存", "SRS AC-RP-04", "实际库存变化需回 M0-3 独立校准"],
    ],
  },
  m7a: {
    breadcrumb: "CROSSPILOT / M7 商品内容创作 · Listing 文案",
    title: "M7-1 Listing 多语言营销文案生成工作台",
    subtitle: "按任务卡（必用术语 / 排除违禁词）生成标题、五点描述、商品描述与后台20个搜索词，一键同步至「整套交付清单」。",
    blocks: [
      { color: "#2563eb", title: "Listing 任务卡强约束", step: "7.1 步骤1-2 必用词与禁忌词校验", srs: "SRS FR-GC-03/04 确定性策略基于目录事实", tech: "术语命中高亮 + 禁忌词实时报警" },
      { color: "#10b981", title: "四区块切换与入清单", step: "7.1 步骤3 选用并写入整套交付清单", srs: "SRS FR-GC-09/10 文案与视觉分流并汇合", tech: "同步更新 M7-4 8类交付清单状态" },
    ],
    ledger: [
      ["Waterproof / 禁忌 Best", "SRS术语示例", "创作期标记只是提示，正式送检见 M7-4"],
      ["8类整套交付联动", "参考图融合", "在 M7-1 选定后，M7-4 清单自动亮绿"],
    ],
  },
  m7b: {
    breadcrumb: "CROSSPILOT / M7 商品内容创作 · AI 商品主图",
    title: "M7-2 AI 商品主图生成页（1大 + 4小电商陈列 · 局部修改）",
    subtitle: "融合参考图「01白底主图 + 02使用场景/03功能卖点/04尺寸规格/05包装清单」阵型，支持局部修改重绘与 ComfyUI MIME 校验。",
    blocks: [
      { color: "#2563eb", title: "1大+4小电商主图附图阵型", step: "7.2 步骤1-2 选工作流生成5张套图", srs: "SRS FR-GC-06/07 ComfyUI /prompt 与真实下载", tech: "仅保存 image/png 匹配文件" },
      { color: "#7c3aed", title: "单图局部修改与选用入清单", step: "7.2 步骤3 局部重绘并同步交付清单", srs: "SRS FR-GC-08/09 保留可用图，局部重绘", tech: "点击「✏️ 局部修改」生成新版并更新 M7-4" },
    ],
    ledger: [
      ["01主图 + 02~05附图", "参考图结构", "对齐参考图电商套图排布与局部修改交互"],
      ["image/png 二进制校验", "SRS AC-GC-03", "杜绝把报错 JSON 当成图片保存"],
    ],
  },
  m7c: {
    breadcrumb: "CROSSPILOT / M7 商品内容创作 · AI 短视频",
    title: "M7-3 AI 短视频生成页（ComfyUI SVD · /sync 轮询）",
    subtitle: "还原老师 img_097：下发 SVD 图生视频工作流并通过 /sync 轮询进度；未配置视频节点时真实报错，绝不伪造成功。",
    blocks: [
      { color: "#2563eb", title: "SVD 脚本与能力边界", step: "7.2 步骤1-2 未配节点真实报错", srs: "SRS AC-GC-02 禁止出现成功但无文件", tech: "ComfyUI /history/{prompt_id} + /view" },
      { color: "#10b981", title: "/sync 轮询与选用入清单", step: "7.2 步骤3 真实 MP4 入库后可写入交付清单", srs: "SRS FR-GC-07 SHORT_VIDEO MIME 校验", tech: "同步点亮 M7-4「产品种草视频」" },
    ],
    ledger: [
      ["产品展示/开箱/种草/快剪", "img_097", "沿用老师 img_097 四大视频脚本类型"],
      ["未配节点绝不伪造成功", "SRS AC-GC-02", "可切换选项实测真实错误拦截"],
    ],
  },
  m7d: {
    breadcrumb: "CROSSPILOT / M7 商品内容创作 · 整套交付与合规审核",
    title: "M7-4 整套交付清单（8类内容）与成品合规审核",
    subtitle: "融合参考图结构：左侧真实电商上架成品预览（主图/文案/搜索词/视频），右侧「8类整套交付清单」+「合规校验与主管发布把关」。",
    blocks: [
      { color: "#2563eb", title: "左侧成品上架预览卡", step: "7.3 步骤1 跨模态成品拼装预览", srs: "SRS FR-GC-09 文案与视觉成果汇总交付", tech: "Tabbed 预览：主图附图 / Listing / 搜索词 / 视频" },
      { color: "#10b981", title: "右侧 8 类整套交付清单", step: "7.3 步骤2 缺项点击直达对应子页补齐", srs: "参考图 8 类清单 + SRS FR-GC-05 独立合规记录", tech: "内容创作提交送检 → 主管/审批人最终把关" },
    ],
    ledger: [
      ["8类整套交付清单", "参考图+SRS", "标题/五点/描述/20词/白底主图/附图/A+/视频"],
      ["不直连推线上店铺", "SRS §9.1", "只产生独立 ComplianceCheck 记录与导出包"],
    ],
  },
  m8a: {
    breadcrumb: "CROSSPILOT / M8 员工与权限管理 · 员工名册与角色分配",
    title: "M8-1 员工名册与 SRS §1.5 九大角色分配中心",
    subtitle: "严格按照老师 SRS V1.0 §1.5 原文 9 大业务角色管理在职员工、人数分布、负责店铺与账号启停。",
    blocks: [
      { color: "#f59e0b", title: "授权管理权限门控", step: "8.1 步骤1 校验管理者/主管权限", srs: "SRS §1.5 & §12.2 R-01 替代演示固定Header", tech: "RBAC 门控 (仅 manager/approver 可写)" },
      { color: "#2563eb", title: "9角色人数筛选与在线调岗", step: "8.1 步骤2-3 建档/调岗/停用写审计", srs: "SRS §15 Q-01 角色分配落地", tech: "实时联动全局员工名册与 rbac_audit_logs" },
    ],
    ledger: [
      ["9大业务角色", "SRS §1.5", "主管/审批人、大屏浏览者/管理者等9个原文角色"],
      ["12名示例员工", "§0.3 示例", "覆盖9类岗位的教学演示团队名册"],
    ],
  },
  m8b: {
    breadcrumb: "CROSSPILOT / M8 员工与权限管理 · 9角色权限矩阵与审计",
    title: "M8-2 9 大业务角色权限矩阵与审计日志",
    subtitle: "100% 映射 SRS §1.5 九大角色对 M0~M8 功能的操作边界，支持点击表头即时切换角色体验并查看审计追踪。",
    blocks: [
      { color: "#2563eb", title: "点击表头即时切换角色", step: "8.2 步骤1 交互式权限预览", srs: "SRS §1.5 直观演示不同岗位菜单与待办差异", tech: "列高亮联动全局 roleSelect 与菜单角标" },
      { color: "#7c3aed", title: "9角色矩阵与403越权审计", step: "8.2 步骤2-3 全链路不可篡改留痕", srs: "SRS FR-COM-05 & SoD 越权追溯", tech: "对应 d00_rbac_matrix_detail.png" },
    ],
    ledger: [
      ["★ / ✓ / ◆ / ○ / —", "权限分级", "治理授权 / 终审拍板 / 业务操作 / 只读 / 禁止"],
      ["rbac_audit_logs", "SRS合规", "记录员工调岗、停用及403越权拦截事件"],
    ],
  },
};
