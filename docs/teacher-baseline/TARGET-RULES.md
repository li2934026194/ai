# 目标契约补充规则

本文件把老师的行为约束细化为可实现的事务、错误与部署规则。物理名称、UUID、金额精度、接口完整路径、错误码和默认运行参数属于项目补充设计，不冒充老师原文。目标 SQL/OpenAPI 是待实现规格，不描述当前 FastAPI 的运行接口。

## 数据库和事务

目标业务库使用 PostgreSQL，65 张业务表加 organizations 组织表，集中在 cp_target schema。所有业务表统一 UUID 主键、org_id、created_at/updated_at、version；金额使用 numeric，API 用十进制字符串，缺失费用仍为 NULL。target-schema.sql 创建空 schema，故意不使用 IF NOT EXISTS 掩盖已存在结构差异；不得直接在 pilot 或现有 SQLite 上运行。

外键采用 (org_id, resource_id) 复合引用，防止同一 UUID 资源跨租户绑定。M7 的 product_ref 为逻辑事实引用，服务端通过商品契约校验，不建立 M7 到商品主档的跨域物理外键。RLS 用事务内 SET LOCAL app.org_id，应用账户不得是超级用户、BYPASSRLS 或迁移所有者；每次连接池借用在事务中设置，提交或回滚后清除。路径组织与登录授权同时验证，不以 RLS 代替品牌/店铺/动作权限。

所有修改采用 SELECT FOR UPDATE + expected version，更新时 version+1、updated_at=now()。幂等创建保存组织、键、请求体规范化哈希和响应资源；同键同体返回同资源，同键不同体 409。预览只读，不能因查询刷新 updated_at。业务与成功审计、需要投递的 outbox 在一个事务提交；失败拒绝审计在业务事务回滚后用独立短事务落库，避免同连接锁冲突。outbox 提交后才广播/投递，失败有上限重试，消费者去重。

数据库 CHECK 不承担跨行累计约束。工单创建锁订单关联和订单行，校验会话→订单→订单行同店、qty≤原行数、退款≤订单总金额；本版不自行引入老师未定义的多工单累计退款政策。附件逐件魔数、大小、扩展名白名单校验，最多10件，单件5 MiB；在同一事务保存工单及 bytea 字节，下载再核验归属。

M7 只有真实非空 MIME 匹配媒体保存到 generation_media.file_data 后才能将任务置 SUCCEEDED；资产、媒体和任务终态在同事务提交。五个文案候选以一个任务存多个资产，partial unique index 确保同任务至多一个 selected；不同工作流任务可分别有主图或视频选中资产。二进制响应使用实际 MIME、长度、SHA256/ETag，不做 JSON 解包。知识库原件及解析清单存 MinIO；MinIO 失败不得写 READY 知识索引。向量写入成功后回写 READY，失败保留 FAILED 和错误，可幂等重建。

forecast_runs 一旦发布成功，product/shop/model/train_end/input_snapshot/predictions/backtest 不允许覆盖；重算新建运行。actuals 人工修正追加新版本并保留 original_order_value、来源和理由；评估记录追加。业务账户对审计、预测历史应采用只增读权限或受控服务方法，历史清理按专门维护身份执行。SQL 文件只定义结构和租户策略，以上冻结/权限/状态校验仍需应用及迁移授权共同落实。

## 补货状态与不变量

| 当前状态 | 操作 | 下一状态 | 必需条件 |
|---|---|---|---|
| 无计划 | 提交 | READY_FOR_REVIEW | 幂等、重取事实、签名及数量一致；普通SYNCED+有效成本卡；智能成功未来预测+非演示历史与依据 |
| READY_FOR_REVIEW | 批准 | APPROVED | 不同提交人的审批人、有权、当前version及事实有效 |
| READY_FOR_REVIEW | 驳回 | REJECTED | 有权、version、理由 |
| APPROVED | 创建内部执行任务 | EXECUTING | 有权、version、TASK_CREATED事件 |
| EXECUTING | 登记采购凭证 | PURCHASE_ORDERED | 真实采购号、数量、金额币种和凭证 |
| PURCHASE_ORDERED | 多批质检收货 | PURCHASE_ORDERED | 锁计划和采购证据，新增独立批号，累计实收≤采购量；不良≤实收 |
| PURCHASE_ORDERED | 收满或确认最后一批 | INSPECTED | 批次记录完整；最后一批不足量时保存计划实际差异及确认依据 |
| INSPECTED | 登记物流凭证 | SHIPPED | 物流单号、承运商、时间与凭证 |

事件 SUBMITTED、APPROVED/REJECTED、TASK_CREATED、PURCHASE_ORDER_RECORDED、INBOUND_INSPECTED、SHIPMENT_RECORDED 按计划/事件类型唯一。逐批收货写 receipt_batches，直到完成检查才记录一次 INBOUND_INSPECTED，避免把每批收货误当重复事件冲突。每一步锁行并校验版本，失败不产生状态/事件/凭证半条记录。所有补货操作均不修改库存表，包括 in_transit；库存只由底座独立同步产生变化。普通和智能列表强制 planning_mode 过滤。智能预览不直接调用M5重新运行预测。

## 来源、指标和问数

M4 周事实在一个研究/平台/地区/周内可保留多个来源记录，不能直接把多来源同周数值相加；用于统计时显式选定依据、优先内部实际，并对来源冲突给出待核验。至少四周，前半与后半周均值比较；前半为零则未知。排名权重：均衡0.5/0.4/0.1、收入0.7/0.2/0.1、增长0.25/0.65/0.1，对应净收入/趋势/已知利润率；利润未知仅对可用权重归一。净收入/经营利润按老师BR-SEL公式，缺一必需费用不生成经营利润。

M3 查询路径A使用同步指标点；路径B使用确定性事实快照/库存，同日同维度最高版本；路径C是P2受限训练SQL补充分支，非默认替代A/B。Vanna独立服务不持有业务库写凭据、不直接执行用户SQL。API校验本组织READY训练样例、SQL AST单SELECT、表/函数白名单、行数/超时和组织范围。示例项目默认超时5秒、最多1000行，可配置，不是老师给定阈值。只支持经授权表和列，拒绝多语句、DDL/DML、跨组织读取和危险函数。DB只读角色与只读事务作为第二道约束。

流式NDJSON一行一个事件，type为status/sql/answer_delta/result/error，含trace_id。HTTP已开始后发生错误，发error事件并结束，不伪造第二HTTP状态；最终result与非流式结果同口径。会话记录由org_id+session_id+actor_subject隔离；只存ANSWERED/NO_DATA/MIXED_CURRENCY，最多50条、读上下文8条、历史20条、清理30天以前。删除对话不触及经营数据。

## API约定与项目默认值

共同前缀/api/v1/orgs/{org_id}，生产Bearer身份；X-Api-Envelope:1启用统一ok/data/error/trace_id。所有POST请求Idempotency-Key；更新/审批请求version。创建201，异步接收202，查询/更新200；校验422、未登录401、无权403、资源不存在404、版本或事实冲突409、依赖不可用503。敏感资源可用404隐藏存在性。错误码见OpenAPI，属于项目补充设计，不沿用外包稿把所有模块错误都命名M7。

分页limit默认50、最大200；问数历史最大20。目标布局最多24组件、12列、刷新默认30秒、实时卡片Cache-Control:no-store，均为Q-08的可配置项目建议值，需评审后冻结，不称老师硬性数值。Widget ID唯一、类型/宽度/主题/字符串长度校验。compose/preview/describe不写设计行，PUT写草稿，publish只复制已保存指定draft_version，读发布版不做隐式保存；最多四卡并发、各自独立会话。无发布版返回published:null并回退旧摘要。

## 本地部署目标与验收顺序

1. 备份现有SQLite及m7_storage，并校验恢复副本；记录当前31表计数、媒体SHA256和来源性质。老师原件与旧pilot资料不作为外包部署证据。
2. 准备独立PostgreSQL数据库、迁移账户与最小应用账户，配置asyncpg；在空验证库执行目标DDL并验证RLS/外键/JSONB/bytea，不覆盖原库。
3. 用Alembic版本化创建目标结构，现有m0_products/orders/inventory分别映射products/orders+order_items/inventory_positions；m1_faq_entries不能假装推荐目录；缺少字段作为待补数据记录；M4候选不能直接变完整周事实；M5历史种子不能伪装真实订单；m7媒体storage_key需读真实文件、校验后存bytea；m8成员身份与角色重新映射。任何缺失事实保持未知，不填造值。
4. 部署Redis/Celery Worker/Beat与outbox消费者，验证任务中断/重启、租约和去重；按需部署MinIO和Milvus，验证知识原件、解析清单、向量维度版本及跨组织过滤。所有服务持久数据分别备份，不向公网开放默认端口。
5. 配置独立Vanna模型接口和受控只读执行；配置已有合法ComfyUI及GPU/模型/工作流，运行真实图片和视频链路。无资源则记阻塞，不能用演示结果替代通过。本次不下载模型、不部署数据库。
6. Vite/vue-tsc构建，Nginx代理/api/v1和WS，提供静态SPA；Shell完成健康检查/迁移/启动/回滚，Docker Compose按需profiles，Jenkins运行构建/校验并保留产物。部署脚本是后续代码工作，本文件仅给出明确目标与验收次序。
7. 在独立测试组织执行acceptance-cases.json，保存每条请求/响应和DB证据。与旧库核对商品、订单、库存、媒体字节及审计计数。做一次PostgreSQL和MinIO/Milvus持久数据恢复演练，验证恢复后媒体与向量关联。

恢复或部署尚未执行，不能从DDL语法检查、OpenAPI校验或文档排版通过推断系统部署通过。老师Q-01～12作为未决事项保留，不伪造批准人或批准日期。
