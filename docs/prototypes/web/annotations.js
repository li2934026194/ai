export const MODULE_DEFS = [
  {
    id: "m0",
    label: "M0 公共底座",
    badge: "2页",
    pages: [
      { id: "m0a", label: "店铺与主数据" },
      { id: "m0b", label: "独立库存同步中心" },
    ],
  },
  {
    id: "m1",
    label: "M1 智能客服 Agent",
    badge: "4页",
    pages: [
      { id: "m1a", label: "客服三栏工作台" },
      { id: "m1b", label: "推荐商品库" },
      { id: "m1d", label: "模拟买家入口" },
      { id: "m1c", label: "售后工单审批" },
    ],
  },
  {
    id: "m2",
    label: "M2 驾驶舱设计",
    badge: "2页",
    pages: [
      { id: "m2a", label: "低代码设计工作台" },
      { id: "m2b", label: "已发布经营大屏" },
    ],
  },
  {
    id: "m3",
    label: "M3 智能问数 Agent",
    badge: "2页",
    pages: [
      { id: "m3a", label: "指标管理与调度" },
      { id: "m3b", label: "经营智能问答" },
    ],
  },
  {
    id: "m4",
    label: "M4 选品分析 Agent",
    badge: "2页",
    pages: [
      { id: "m4a", label: "三源数据接入" },
      { id: "m4b", label: "初筛与主管拍板" },
    ],
  },
  {
    id: "m5",
    label: "M5 销量预测 Agent",
    badge: "2页",
    pages: [
      { id: "m5a", label: "画像与模型注册" },
      { id: "m5b", label: "预测与WAPE评估" },
    ],
  },
  {
    id: "m6",
    label: "M6 补货预测 Agent",
    badge: "2页",
    pages: [
      { id: "m6a", label: "步骤1-3 三方案测算" },
      { id: "m6b", label: "步骤4-5 审批与履约" },
    ],
  },
  {
    id: "m7",
    label: "M7 商品内容创作",
    badge: "4页",
    pages: [
      { id: "m7a", label: "Listing 文案生成" },
      { id: "m7b", label: "AI 商品主图生成" },
      { id: "m7c", label: "AI 短视频生成" },
      { id: "m7d", label: "合规审核与选用" },
    ],
  },
  {
    id: "m8",
    label: "M8 员工与权限管理",
    badge: "2页",
    pages: [
      { id: "m8a", label: "员工名册与角色分配" },
      { id: "m8b", label: "9角色权限矩阵与审计" },
    ],
  },
];

export const PAGE_META = {
  m0a: {
    breadcrumb: "CROSSPILOT / M0 公共底座 · 店铺与主数据",
    title: "店铺授权接入与订单 / 商品主数据",
    subtitle: "接入 Shopee / TikTok Shop / Amazon SP-API 店铺与订单商品主档，严格隔离 Mock 与实盘。",
    blocks: [
      { color: "#2563eb", title: "全局主数据概览卡", step: "0.2 订单与商品同步总览", srs: "SRS §2.1 & §3.2 统一店铺/订单/商品基座", tech: "PostgreSQL orders + products 聚合" },
      { color: "#10b981", title: "OAuth店铺接入与Mock隔离", step: "0.2 步骤1-2 授权与环境隔离", srs: "SRS §1.4 & §0.3 禁止Mock混入实盘指标", tech: "OAuth2 加密Token + source_mode 校验" },
      { color: "#7c3aed", title: "标准化主数据落库表", step: "0.2 步骤3 幂等去重供M1-M7读取", srs: "SRS §2.2 统一订单与SKU模型", tech: "sha256 幂等去重 + 异步拉取任务" },
    ],
    ledger: [
      ["3家 / REAL vs MOCK", "§0.3 示例", "Shopee/TikTok实盘，Amazon沙盒仅演示"],
      ["1,536单 / 128 SKU", "§0.3 示例", "对齐老师 img_043 示例订单量展示"],
      ["orders+products底座", "SRS §2.2", "M1订单关联/M2BI/M3问数/M5训练共用"],
      ["sha256 幂等校验", "SRS架构", "防止重复拉取导致 GMV 或销量虚增"],
    ],
  },
  m0b: {
    breadcrumb: "CROSSPILOT / M0 公共底座 · 独立库存同步",
    title: "独立库存同步与盘点校准中心",
    subtitle: "仓库库存仅由「采购 / 仓库 / 物流人员」在本页同步或人工盘点更新，绝不由 M6 采购/收货凭证自动改写；员工与角色授权已独立至 M8。",
    blocks: [
      { color: "#f59e0b", title: "独立库存红线与快照水位", step: "0.3 独立库存校准同步", srs: "SRS §1.4 & FR-RP 库存独立口径", tech: "inventory_snapshots 可售/锁定分离" },
      { color: "#7c3aed", title: "联动跳转 M8 权限治理", step: "0.1 身份授权独立模块化", srs: "SRS §1.5 九大角色独立授权中心", tech: "RBAC 权限校验与 warehouse 门控" },
    ],
    ledger: [
      ["18件 / 锁定4件 / 安全25", "§0.3 示例", "对齐老师 img_069 / img_083 BAG-108 示例"],
      ["43件 / 60件", "§0.3 示例", "对齐老师 img_082 FAN-203 示例库存"],
      ["不自动改写库存", "SRS红线", "采购收货凭证仅留痕，不自动加可售库存"],
      ["权限管理见 M8", "页面拆分", "员工名册与9角色矩阵已拆分至 M8 两页"],
    ],
  },
  m1a: {
    breadcrumb: "CROSSPILOT / M1 智能客服 · 三栏工作台",
    title: "跨境智能客服工作台（会话 · 推荐 · 译文 · 订单关联）",
    subtitle: "对齐老师 img_017 / image-17 三栏工作台：可切换买家会话、点击人工接管、体验双语草拟回复。",
    blocks: [
      { color: "#2563eb", title: "左列多渠道会话队列", step: "1.2 步骤1 入站消息聚类与状态", srs: "SRS FR-CS-01 AI_AUTO / PENDING_HUMAN / HUMAN", tech: "WebSocket 推送 + 会话状态机" },
      { color: "#10b981", title: "中栏译文/敏感拦截/Top-3推荐", step: "1.2 步骤2-3 意图识别与人工接管", srs: "SRS FR-CS-02/03 退款/投诉强制人工接管", tech: "LLM意图分类 + pgvector Top-3 + 双语互译" },
      { color: "#7c3aed", title: "右列客户与候选订单核验", step: "1.3 步骤1 订单号提取与关联绑定", srs: "SRS FR-CS-04 核验订单后跳转售后工单页", tech: "正则订单抽取 + PostgreSQL 模糊核验" },
    ],
    ledger: [
      ["PENDING_HUMAN / 88%", "SRS+示例", "状态机枚举自SRS；88%与REFUND为本会话示例"],
      ["MONEY_REQUEST 拦截", "SRS FR-CS", "涉及金额/售后投诉强制挂起等待人工接管"],
      ["Top-3 推荐 (92%/76%)", "§0.3 示例", "向量相似度检索示例分值"],
      ["SYN9D-005671 / $34.50", "§0.3 示例", "对齐老师 img_017 / image-17.png 示例订单"],
    ],
  },
  m1b: {
    breadcrumb: "CROSSPILOT / M1 智能客服 · 推荐商品库",
    title: "客服推荐商品库与 XLSX 批量导入",
    subtitle: "对齐老师 img_014 / img_015：按店铺管理客服可推荐商品资料与向量索引。",
    blocks: [
      { color: "#2563eb", title: "多店铺商品知识列表", step: "1.1 步骤1-2 商品资料与启用开关", srs: "SRS FR-CS-01 按店铺隔离推荐商品", tech: "PostgreSQL products_kb + 向量状态" },
      { color: "#10b981", title: "XLSX 批量导入与向量化", step: "1.1 步骤3 解析表格生成检索向量", srs: "SRS §4.1 必填列校验与批量语义入库", tech: "openpyxl 解析 + Embedding → pgvector" },
    ],
    ledger: [
      ["全部店铺(142) / 18条", "§0.3 示例", "示例推荐商品库与模拟导入规模"],
      ["BAG-108 / MAT-014", "§0.3 示例", "沿用老师测试包与示例SKU编号"],
      [".xlsx 必填列校验", "SRS §4.1", "导入前校验 SKU/标题/卖点/价格"],
      ["pgvector 向量化", "技术实现", "支撑工作台 1.2 步骤 Top-3 自动匹配"],
    ],
  },
  m1d: {
    breadcrumb: "CROSSPILOT / M1 智能客服 · 模拟买家入口",
    title: "Amazon / 多平台模拟买家消息生成器",
    subtitle: "对齐老师 img_016：用于教学/演示触发咨询推荐或售后投诉，实时推入客服三栏工作台。",
    blocks: [
      { color: "#2563eb", title: "买家入站消息模拟发送", step: "1.2 前置测试入口", srs: "SRS §0.3 & img_016 模拟买家入站不连真实卖家账户", tech: "Mock Webhook → CS Session Queue" },
    ],
    ledger: [
      ["Mock Buyer 入口", "SRS §0.3", "演示触发咨询/退款消息，不连接真实平台"],
      ["自动路由工作台", "交互联动", "发送后可一键跳回[客服三栏工作台]查看拦截"],
    ],
  },
  m1c: {
    breadcrumb: "CROSSPILOT / M1 智能客服 · 售后工单审批",
    title: "售后工单创建与主管审批中心",
    subtitle: "独立承载建单、金额校验、SoD行锁审批与 external_status = UNKNOWN 诚实边界。",
    blocks: [
      { color: "#f59e0b", title: "external_status=UNKNOWN", step: "1.3 步骤3 审批与外部状态说明", srs: "SRS §0.3 不虚构平台自动退款到账", tech: "工单表记录 external_status 枚举" },
      { color: "#2563eb", title: "工单队列与SoD行锁审批", step: "1.3 步骤2-3 planner建单→approver拍板", srs: "SRS FR-CS-05 防并发重复审批", tech: "SQL SELECT FOR UPDATE + 提交≠审批" },
    ],
    ledger: [
      ["TK-20261119-01 / $34.50", "§0.3 示例", "关联 SYN9D-005671 的示例退款工单"],
      ["external_status=UNKNOWN", "SRS §0.3", "不声明已接通平台实时自动退款回调"],
      ["SELECT FOR UPDATE", "SRS设计", "数据库行锁防并发重复退款审批"],
      ["staff_lin ≠ mgr_chen", "SRS §1.5", "提交人与审批人必须不同账号(SoD)"],
    ],
  },
  m2a: {
    breadcrumb: "CROSSPILOT / M2 驾驶舱设计 · 低代码工作台",
    title: "驾驶舱低代码设计工作台（组件库 · 画布 · 属性配置）",
    subtitle: "对齐老师 img_026：自由选择组件编排看板、绑定统一指标口径并生成 AI 解读，独立于发布态。",
    blocks: [
      { color: "#2563eb", title: "左侧标准化组件库", step: "2.1 步骤1 选择KPI/折线/解读组件", srs: "SRS FR-BI-01 支持自定义指标看板编排", tech: "组件清单 JSON Schema" },
      { color: "#10b981", title: "中间画布与AI解读预览", step: "2.1 步骤2-3 画布排布与AI解读", srs: "SRS FR-BI-02 实时绑定统一指标口径", tech: "12列栅格布局 + SVG/ECharts" },
      { color: "#7c3aed", title: "右侧属性与指标字典绑定", step: "2.1 步骤2 绑定平台/指标/格式", srs: "SRS §2.3 复用 M3 统一指标字典", tech: "metric_definitions 元数据联动" },
    ],
    ledger: [
      ["$125,429.99 / $65,529.67", "§0.3 示例", "严格对齐老师 img_043 同套经营事实示例"],
      ["gmv / CURRENCY", "SRS指标库", "绑定统一指标字典，确保M2/M3零偏差"],
      ["设计态 vs 发布态拆分", "交互设计", "避免将编辑工具栏混入管理层看数大屏"],
    ],
  },
  m2b: {
    breadcrumb: "CROSSPILOT / M2 驾驶舱 · 已发布经营大屏",
    title: "CrossPilot 经营总览大屏（发布态 · 只读看板）",
    subtitle: "对齐老师 img_027：使用与 M3 同一套事实口径展示 4 张并发卡片、趋势折线与双时间戳。",
    blocks: [
      { color: "#2563eb", title: "双时间基准栏", step: "2.2 步骤1 展示口径版本与截止时间", srs: "SRS FR-BI-03 标注数据截止与指标版本", tech: "metric_snapshots 快照时间戳" },
      { color: "#10b981", title: "4卡并发拉取与趋势渲染", step: "2.2 步骤2-3 并发刷新指标卡片", srs: "SRS FR-BI-04 管理层零配置直接看数", tech: "Promise.all 并发查询 + ECharts" },
      { color: "#7c3aed", title: "AI 解读与跳转 M3 问数", step: "2.2 步骤3 解读异常并联动问数", srs: "SRS §2.3 驾驶舱与智能问数口径一致", tech: "带上下文跳至 M3 智能问答页" },
    ],
    ledger: [
      ["$125,429.99 / 1,536单", "§0.3 示例", "对齐老师 img_043 全部平台近30天数字"],
      ["$18,650.16 / $65,529.67", "§0.3 示例", "对齐老师 img_043 广告花费与净利润"],
      ["$2,933.63 (近7天)", "§0.3 示例", "对齐老师 img_043 Amazon 近7天广告花费"],
      ["metric_snapshots v1.2", "SRS统一", "与 M3 智能问数共用同一套事实快照"],
    ],
  },
  m3a: {
    breadcrumb: "CROSSPILOT / M3 智能问数 · 指标与调度",
    title: "指标管理与多源数据绑定调度（M3 前置底座）",
    subtitle: "对齐老师 img_041 / img_042：配置内置/REST指标提取路径，并由 Celery Beat 周期调度入库。",
    blocks: [
      { color: "#2563eb", title: "指标定义与多平台口径", step: "3.1 步骤1 定义指标代码与取值方式", srs: "SRS FR-QA-01 指标字典与格式统一管理", tech: "metric_definitions 表" },
      { color: "#10b981", title: "REST/模拟接口与Celery调度", step: "3.1 步骤2-3 周期拉取写入快照", srs: "SRS FR-QA-02 支持 JSON 路径提取与调度", tech: "Celery Beat 每分钟巡检 + JSONPath" },
    ],
    ledger: [
      ["METRIC_REST_BASE_URL", "SRS/img_041", "老师 img_041 明确要求的后端环境变量"],
      ["360,000 / 5,600 USD", "§0.3 示例", "对齐老师 img_042 SIMULATION 示例值"],
      ["Celery Beat 每分钟巡检", "SRS/img_042", "老师 img_042 调度表原话机制"],
    ],
  },
  m3b: {
    breadcrumb: "CROSSPILOT / M3 智能问数 · 经营智能问答",
    title: "经营智能问答助手（Vanna Text-to-SQL · 只读安全守卫）",
    subtitle: "对齐老师 img_043：点击快捷提问或发送 SQL 写操作语句，实时验证证据 SQL、多币种与只读拦截。",
    blocks: [
      { color: "#f59e0b", title: "统一事实入口与双时间口径", step: "3.2 步骤1 问题规范化与元数据加载", srs: "SRS FR-QA-03 与M2共享同一套指标口径", tech: "Vanna RAG 业务语义检索" },
      { color: "#10b981", title: "Text-to-SQL 自动查数", step: "3.2 步骤2 生成只读SQL并附证据", srs: "SRS FR-QA-04 答案必须附口径与SQL依据", tech: "Vanna SQL生成 + 多币种处理" },
      { color: "#ef4444", title: "只读白名单拦截写操作", step: "3.2 步骤3 拦截 UPDATE/DELETE", srs: "SRS §5.2 严禁问数模块改删业务表", tech: "SQL AST 语法树只读校验 + 审计日志" },
    ],
    ledger: [
      ["65,529.67 / 2,933.63 USD", "§0.3 示例", "原封不动对齐老师 img_043 对话数字"],
      ["只读 SELECT 拦截", "SRS §5.2", "硬编码 AST 拦截所有写入/删表语句"],
      ["证据 SQL + 耗时", "SRS可追溯", "所有 AI 数字必须给出可核验 SQL 依据"],
    ],
  },
  m4a: {
    breadcrumb: "CROSSPILOT / M4 选品分析 · 三源数据接入",
    title: "选品数据接入中心（外购估算 · 内部实际 · 公网观察）",
    subtitle: "对齐老师 img_056：三源严格分账，含 mock 标识的文件禁止当作真实数据导入。",
    blocks: [
      { color: "#2563eb", title: "外购/内部/公网三源分卡", step: "4.1 步骤1 区分数据性质与可信度", srs: "SRS FR-SL-01 外部估算与内部实际不混账", tech: "data_sources 分类型统计" },
      { color: "#10b981", title: "SHA256追溯与Mock强拦截", step: "4.1 步骤2-3 上传校验与防污染入库", srs: "SRS §0.3 含mock文件禁止作为真实导入", tech: "SHA256 哈希去重 + 文件名守卫" },
    ],
    ledger: [
      ["10,000条 / 160条", "§0.3 示例", "对齐老师 img_056 接入统计数字"],
      ["含mock不可作真实数据", "SRS/img_056", "老师 img_056 失败行原话校验规则"],
    ],
  },
  m4b: {
    breadcrumb: "CROSSPILOT / M4 选品分析 · 初筛与主管拍板",
    title: "选品研究工作台（planner 初筛进清单 → approver 终审拍板）",
    subtitle: "对齐老师 img_057 并落实角色接力：尝试切换左上角角色体验 planner 与 approver 的不同按钮权限。",
    blocks: [
      { color: "#2563eb", title: "选品员→主管角色接力", step: "4.2+4.3 流水线接力", srs: "用户明确纠正：planner初筛入清单，approver终审拍板", tech: "RBAC 门控：planner 不可点击批准测款" },
      { color: "#10b981", title: "阶段一：机会池 AI 初筛", step: "4.2 步骤1-3 初筛并提交进待选清单", srs: "SRS FR-SL-02 未知利润不按零计算", tech: "规则引擎 + LLM 竞品风险摘要" },
      { color: "#7c3aed", title: "阶段二：待审清单测款拍板", step: "4.3 步骤1-3 approver 决策与留痕", srs: "SRS FR-SL-03 测款结果沉淀入产品库", tech: "selection_decisions 审批表" },
    ],
    ledger: [
      ["$66,829.54 / +27.5%", "§0.3 示例", "对齐老师 img_057 机会池第1行示例值"],
      ["$56,521.94 / +31.2%", "§0.3 示例", "对齐老师 img_057 可折叠洗衣篮示例值"],
      ["planner → approver", "用户要求", "严格区分初筛提交与主管最终拍板权限"],
    ],
  },
  m5a: {
    breadcrumb: "CROSSPILOT / M5 销量预测 · 画像与模型注册",
    title: "SKU 需求画像（DemandProfile）与版本化模型注册表",
    subtitle: "对齐老师 img_067：维护 9 类算法建议历史门槛与启停状态，自动匹配候选预测模型。",
    blocks: [
      { color: "#2563eb", title: "SKU 需求画像与模型推荐", step: "5.1 步骤1-2 识别需求模式与候选", srs: "SRS FR-FC-01/04 DemandProfile 匹配规则", tech: "零销量占比/CV值 + 版本递增留痕" },
      { color: "#10b981", title: "9模型注册与历史门槛校验", step: "5.1 步骤3 过滤历史不足模型", srs: "SRS FR-FC-02 METADATA_ONLY 不可执行", tech: "model_registry 表 + 启停开关" },
    ],
    ledger: [
      ["BAG-108 / 96天(90天有单)", "§0.3 示例", "对齐老师 img_069 BAG-108 真实历史点数"],
      ["9个模型 / ≥90 / ≥180点", "SRS/img_067", "直接源自老师 img_067 模型注册表数据"],
      ["Chronos-Bolt-Tiny", "img_067", "老师 img_067 TSFM 零样本基座模型"],
    ],
  },
  m5b: {
    breadcrumb: "CROSSPILOT / M5 销量预测 · 执行预测与WAPE评估",
    title: "真实销量预测与历史回测 WAPE 评估中心",
    subtitle: "对齐老师 img_069：展示 7 天预测曲线与非置信区间误差带；支持人工修正实际值并重算 wAPE。",
    blocks: [
      { color: "#2563eb", title: "真实订单筛选与KPI总览", step: "5.2 步骤1 过滤已支付/发货/完成订单", srs: "SRS FR-FC-03 当日未完结不参与训练", tech: "订单日频聚合 + 模型推理" },
      { color: "#10b981", title: "逐日曲线与非置信误差带", step: "5.2 步骤2-3 输出预测与补货参考", srs: "SRS §0.3 & img_069 误差带非置信区间", tech: "SVG 趋势图 + 向上取整" },
      { color: "#7c3aed", title: "滚动回测 WAPE 与人工修正", step: "5.3 步骤1-3 保留原始值重算 wAPE", srs: "SRS FR-FC-05 人工修正记录操作人与时间", tech: "forecast_evaluations + 修正审计" },
    ],
    ledger: [
      ["626件 / 633件 / 18 / 25", "§0.3 示例", "完全对齐老师 img_069 BAG-108 示例值"],
      ["29/63/27/138/130/88/153", "§0.3 示例", "对齐老师 img_069 逐日预测7天明细"],
      ["误差带非置信区间", "img_069", "老师页面原话提示，防业务误解"],
    ],
  },
  m6a: {
    breadcrumb: "CROSSPILOT / M6 智能补货 · 步骤1-3 方案测算",
    title: "智能补货决策中心（双分支需求 · 成本校验 · 三方案比较）",
    subtitle: "对齐老师 img_082 / img_083：5 步向导前 3 步，缺成本或利润数据禁止提交。",
    blocks: [
      { color: "#2563eb", title: "双分支输入与缺成本熔断", step: "6.1 步骤1-2 选普通/智能并核成本卡", srs: "SRS FR-RP-01/02 缺成本禁止提交", tech: "成本卡校验 + M5预测/30天代理路由" },
      { color: "#10b981", title: "保守/平衡/激进三方案模拟", step: "6.1 步骤3 测算缺货风险与现金占用", srs: "SRS FR-RP-03 输出件数/现金/增量贡献", tech: "ROP/MOQ/箱规取整 + calculation_version" },
    ],
    ledger: [
      ["30件/天 / 43 / 660 / 617", "§0.3 示例", "对齐老师 img_082 FAN-203 示例数字"],
      ["完整交期 18天", "§0.3 示例", "对齐老师 img_083 交期示例"],
      ["480 / 620 / 800 三方案", "§0.3 示例", "基于 617 缺口与箱规推演的三方案对比"],
    ],
  },
  m6b: {
    breadcrumb: "CROSSPILOT / M6 智能补货 · 步骤4-5 审批与履约",
    title: "补货方案审批与采购收货凭证台账",
    subtitle: "参数快照签名重算防篡改；SoD 行锁审批后由 warehouse 登记收货差异凭证，绝不改仓库库存。",
    blocks: [
      { color: "#ef4444", title: "采购收货不改库存红线", step: "6.3 步骤3 凭证归档边界", srs: "SRS §1.4 & img_081 收货不自动改可售库存", tech: "隔离 receipt_batches 与 inventory" },
      { color: "#2563eb", title: "快照重算与 SoD 审批", step: "6.2 步骤1-3 签名校验与提交≠审批", srs: "SRS FR-RP-04/05 规则定数量，AI仅摘要", tech: "参数哈希签名 + RBAC SoD 门控" },
      { color: "#7c3aed", title: "分批收货差异与质检凭证", step: "6.3 步骤1-2 采购/物流/质检闭环留痕", srs: "SRS FR-RP-06 登记差异供复盘", tech: "多批次 receipt_batches 关联 PO" },
    ],
    ledger: [
      ["RULE_FIXED + AI摘要", "img_081", "老师 img_081 明确数量由规则固定"],
      ["buyer_zhang ≠ mgr_chen", "SRS §1.5", "提交人与审批人不可为同一账号"],
      ["620件 / $6,944 / -5短装", "§0.3 示例", "多批收货差异演练示例"],
    ],
  },
  m7a: {
    breadcrumb: "CROSSPILOT / M7 商品内容创作 · Listing 文案",
    title: "M7-1 Listing 多语言营销文案生成工作台",
    subtitle: "对齐老师 img_095：专注文案生成与任务卡约束；通过上方按钮独立跳转至主图页与短视频页。",
    blocks: [
      { color: "#2563eb", title: "多页跳转按钮与3步导引", step: "7.1 步骤1 选商品/平台/语言", srs: "SRS FR-CT-01 & 老师 img_095 三步结构", tech: "独立子页面路由切换" },
      { color: "#10b981", title: "Listing 任务卡强约束", step: "7.1 步骤2 必用术语与排除词控制", srs: "SRS FR-CT-02 命中禁忌词提示复核", tech: "Prompt 约束注入 + 术语正则校验" },
      { color: "#7c3aed", title: "5组草稿卡片与一键检查", step: "7.1 步骤3 生成文案并进入检查", srs: "SRS FR-CT-03 支持复制/导出/使用并检查", tech: "LLM 结构化输出 + 敏感词预检" },
    ],
    ledger: [
      ["MAT-014 / Amazon US", "§0.3/img_095", "对齐老师 img_095 桌面收纳垫示例商品"],
      ["Waterproof / 禁忌 Best", "SRS术语表", "任务卡必用词与广告违禁词对照示例"],
      ["文案/主图/视频分3页", "用户要求", "按按钮跳转独立页面，彻底告别拥挤"],
    ],
  },
  m7b: {
    breadcrumb: "CROSSPILOT / M7 商品内容创作 · AI 商品主图",
    title: "M7-2 AI 商品主图生成页（ComfyUI 图像工作流）",
    subtitle: "对齐老师 img_096：专注白底主图/家居场景/细节特写生成，4 宫格预览并校验真实图片 MIME。",
    blocks: [
      { color: "#2563eb", title: "白底/场景/特写主图配置", step: "7.2 步骤1 选择商品与图像工作流", srs: "SRS FR-CT-04 & img_096 独立主图页", tech: "ComfyUI Workflow JSON 模板映射" },
      { color: "#10b981", title: "Prompt 与平台合规参数", step: "7.2 步骤2 下发 ComfyUI 异步任务", srs: "SRS FR-CT-05 白底占比与无水印规范", tech: "ComfyUI /prompt 队列" },
      { color: "#7c3aed", title: "4宫格预览与MIME校验", step: "7.2 步骤3 真实二进制校验与选用", srs: "SRS §0.3 不把 JSON 报错误存成图片", tech: "Magic-Byte / MIME 校验 + /view 代理" },
    ],
    ledger: [
      ["Amazon 白底主图 · v3", "img_096", "对齐老师 img_096 工作流版本号"],
      ["2000×2000px / 85%占比", "Amazon规范", "Amazon 主图分辨率与主体占比标准"],
      ["image/png 二进制校验", "SRS架构", "确保导出真实图片而非包装 JSON"],
    ],
  },
  m7c: {
    breadcrumb: "CROSSPILOT / M7 商品内容创作 · AI 短视频",
    title: "M7-3 AI 短视频生成页（ComfyUI / SVD 工作流）",
    subtitle: "对齐老师 img_097：专注带货短视频脚本与 /sync 异步渲染，未配工作流时真实报错不伪造。",
    blocks: [
      { color: "#2563eb", title: "视频模板与能力边界声明", step: "7.2 步骤1-2 视频工作流下发", srs: "SRS §0.3 & img_097 未配节点不伪造视频", tech: "ComfyUI SVD 工作流参数校验" },
      { color: "#10b981", title: "/sync 轮询与 MP4 下载", step: "7.2 步骤3 异步状态轮询与预览", srs: "SRS FR-CT-05 真实校验 video/mp4 下载", tech: "ComfyUI /sync 状态机 + 流式代理" },
    ],
    ledger: [
      ["产品展示/开箱/种草/快剪", "img_097", "沿用老师 img_097 四大视频模板命名"],
      ["15s 1080×1920 MP4", "§0.3 示例", "TikTok/Amazon 竖屏带货视频示例规格"],
      ["/sync 状态轮询", "SRS设计", "避免超时，异步追踪渲染完成状态"],
    ],
  },
  m7d: {
    breadcrumb: "CROSSPILOT / M7 商品内容创作 · 合规审核与选用",
    title: "M7-4 全内容合规审核与平台选用台账",
    subtitle: "汇总已选中的 Listing 文案、ComfyUI 主图与短视频资产，复检违禁词后写入选用记录（不直连发店）。",
    blocks: [
      { color: "#7c3aed", title: "跨模态资产合规复检", step: "7.3 步骤1-2 汇总文案/主图/视频复检", srs: "SRS FR-CT-06 广告违禁词与MIME双检", tech: "敏感词规则引擎 + 资产引用校验" },
      { color: "#f59e0b", title: "落库选用与平台发布边界", step: "7.3 步骤3 写入选用台账", srs: "SRS §0.3 选用记录不宣称直接推线上店铺", tech: "content_selections 选用状态表" },
    ],
    ledger: [
      ["0违禁词 · 必用词齐备", "SRS规则", "任务卡排除词与必用术语最终核验"],
      ["不直接推线上店铺", "SRS §0.3", "严守系统边界，仅留存选用与导出包"],
    ],
  },
  m8a: {
    breadcrumb: "CROSSPILOT / M8 员工与权限管理 · 员工名册与角色分配",
    title: "M8-1 员工名册与 SRS §1.5 九大角色分配中心",
    subtitle: "严格按照老师 SRS V1.0 §1.5 原文 9 大业务角色管理在职员工、人数分布、负责店铺与账号启停。",
    blocks: [
      { color: "#f59e0b", title: "授权管理权限门控", step: "8.1 步骤1 校验管理者/主管权限", srs: "SRS §1.5 & §12.2 R-01 替代演示固定Header", tech: "RBAC 鉴权门控 (仅 manager/approver 可写)" },
      { color: "#2563eb", title: "团队规模与9角色统计", step: "8.1 步骤2 查看在职人数与SoD状态", srs: "SRS §1.5 完整覆盖9类业务场景角色", tech: "前端状态聚合 + SoD 互斥检查" },
      { color: "#10b981", title: "按角色筛选与在线调岗", step: "8.1 步骤3 建档/调岗/停用离职账号", srs: "SRS §15 Q-01 正式身份与角色分配落地", tech: "员工名册表 + 实时触发 rbac_audit_logs" },
    ],
    ledger: [
      ["9大业务角色", "SRS §1.5", "主管/审批人、大屏浏览者/管理者等9个原文角色"],
      ["12名示例员工", "§0.3 示例", "覆盖9类岗位的教学演示团队名册"],
      ["SoD 0冲突", "SRS §15 Q-09", "提交人与审批人严禁为同一账号"],
    ],
  },
  m8b: {
    breadcrumb: "CROSSPILOT / M8 员工与权限管理 · 9角色权限矩阵与审计",
    title: "M8-2 9 大业务角色权限矩阵与审计日志",
    subtitle: "100% 映射 SRS §1.5 九大角色对 M0~M8 共 15 项功能的操作边界，支持点击表头即时切换角色体验并查看审计追踪。",
    blocks: [
      { color: "#2563eb", title: "点击表头即时切换角色", step: "8.2 步骤1 交互式权限预览", srs: "SRS §1.5 直观演示不同岗位菜单与按钮差异", tech: "列高亮联动全局 roleSelect 状态" },
      { color: "#10b981", title: "9角色×15功能细颗粒矩阵", step: "8.2 步骤2 核对管理/审批/操作/只读/禁止", srs: "SRS §1.5 + §0.2 工程落地权限清单", tech: "对应 d00_rbac_matrix_detail.png" },
      { color: "#7c3aed", title: "变更与403越权拦截审计", step: "8.2 步骤3 全链路不可篡改留痕", srs: "SRS FR-COM-05 & SoD 越权操作追溯", tech: "rbac_audit_logs 追加式流水表" },
    ],
    ledger: [
      ["★ / ✓ / ◆ / ○ / —", "权限分级", "治理授权 / 终审拍板 / 业务操作 / 只读 / 禁止"],
      ["买家(模拟)仅M1-3", "SRS §1.5", "仅可访问模拟买家入站入口，禁止进后台"],
      ["rbac_audit_logs", "SRS合规", "记录员工调岗、停用及403越权拦截事件"],
    ],
  },
};
