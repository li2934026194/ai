# CrossPilot 13大模块高保真界面原型清单（Step 2）

本目录的 13 张高保真界面原型图严格依据已完成定稿的 **V5 数据流程图**（`docs/prototypes/modules/m00` ~ `m15`）与 **CrossPilot 深海蓝侧栏 + 卡片式设计规范** 生成，将角色 RBAC 实时鉴权、节点级 `fact_signature` 契约、Auto-Fill 来源提示、硬拦截解释与一键跳转、以及「30 秒缓冲真撤回 + 超时红字兜底」全部显式落入界面交互中。

| 序号 | 模块名称 | 原型图路径 | 对应流程图 | 界面核心交互与 P0/P1 防线落点 |
|---|---|---|---|---|
| 01 | 店铺管理 | `docs/prototypes/ui/p01_shop.png` | `m01_shop.png` | OAuth scope 防越权、org_id 1对1责任书、3次指数退避转人工单 `#TK09`、SLA 逐级告警、右侧免切页绑定/费率抽屉、Owner 白名单解绑二次审批 |
| 02 | 订单中心 | `docs/prototypes/ui/p02_order.png` | `m02_order.png` | `(order_id, platform)` 幂等去重、成交额库级只读锁死、金额变更申请单实时防超退拦截、COD 拒收剔除、30秒退款撤回底栏 |
| 03 | 财务利润 | `docs/prototypes/ui/p03_finance.png` | `m03_finance.png` | 结算日 `exchange_rate_ver` 锁汇、CostCard v4→v5 差异高亮、缺费用标「未知」禁填零、负毛利置顶归因、月结后红字调整单 |
| 04 | 商品中台 | `docs/prototypes/ui/p04_product.png` | `m04_product.png` | 一码多物/重复 ASIN 拦截、四态库存（可用/预占/在途/隔离）、缺 PO 在途禁转可售、`9→4` 收货回写 `cause=PO_RECEIPT` 防环、调价保本线实时校验抽屉 |
| 05 | 选品研究 | `docs/prototypes/ui/p05_selection.png` | `m05_selection.png` | CSV 异常列高亮+模板对比、初筛权重拖拽保存、五条件逐条门禁、参数化测款预算上限（≤$25/款）、测款第10天出单异常预警与复盘 |
| 06 | 内容智能 | `docs/prototypes/ui/p06_content.png` | `m06_content.png` | 三状态隔离（草稿→强检→已发布）、5秒自动存稿+bilingual 一键采纳、红线词 `BLOCKED` 硬阻断（不可跳过）与一键原地替换、规则库软删+沙盒试跑+回滚 |
| 07 | 客服工作台 | `docs/prototypes/ui/p07_cs.png` | `m07_cs.png` | 一屏三栏免切页（会话队列 / 双语对话 / 近3单+设备PII脱敏+售后补偿工单）、四类转人工硬拦截、30秒发信缓冲真撤回 |
| 08 | 销量预测 | `docs/prototypes/ui/p08_forecast.png` | `m08_forecast.png` | 断货日与 `promo_cal_id` 大促校准曲线、算法对比切换、人工修正系数实时影响预览（多备件数+资金占用）、周一冻结 `run_id`、`WAPE > 30%` 硬拦截补货与一键跳转 |
| 09 | 智能补货 | `docs/prototypes/ui/p09_replenish.png` | `m09_replenish.png` | 节点签名 `sig_replenish` 校验条、保守/均衡/激进三方比价、命中 `approval_policy_config` 参数档路由、一屏审批卡+`row_version` 乐观锁+中途变动 HTTP 409 重算、三单匹配收货防环 |
| 10 | 经营总览 | `docs/prototypes/ui/p10_dashboard.png` | `m10_dashboard.png` | 老板一屏晨会视图（8+9+3+2+7 汇总）、顶部统一水位线对齐、GMV 趋势与平台占比、含来源标签的4大核心KPI、异常红灯一键跳转直达单据 |
| 11 | 智能问数 | `docs/prototypes/ui/p11_qa.png` | `m11_qa.png` | 写库/改价指令硬拦截与一键跳转、SQL 生成前 RBAC 权限域注入、只读从库沙箱、口径澄清切换、跨币种分列不强行相加、CSV 导出与钉选总览卡片 |
| 12 | 系统管理 | `docs/prototypes/ui/p12_rbac.png` | `m12_rbac.png` + `m00_rbac_matrix.png` | 9 岗最小权限矩阵、Admin 业务权物理剥离仅留本页、离职毫秒踢出与一键交接、`approval_policy_config` 可配置参数表、Append-Only + SHA-256 哈希链审计日志 |
| 13 | 上传知识库 | `docs/prototypes/ui/p13_kb.png` | `m13_kb.png` | Excel 隐藏列与 PII/底价自动扫描拦截、一键抹除脱敏、切片可视化、审前「模拟买家试问盒」、仅 `PUBLISHED` 在有效期可检索、到期自动下架影响预览与30秒撤回 |
