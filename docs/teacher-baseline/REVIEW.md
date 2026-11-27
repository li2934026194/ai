# 项目文档与老师基线对照复核

本次清单覆盖修改前发现的 131 份可读文档：79 份 Markdown、52 份 DOCX；Word 锁文件不计。读取 Word 正文和表格文本，单独检查老师 V1.1 技术选型图片。原始教师文件未修改；代码、数据库和服务未改动。

## 评分含义与范围

分数是本轮编辑判断，不是老师评分或代码验收分。五项各 20 分：范围与追溯、技术与存储、业务与数据边界、可验证性、权威与状态清晰度。按文档职责评分，不要求 README 写全套 DDL。修订后分数只评价目标文本；实现未完成和未执行测试不因改文档变成通过。详细设计与测试用例仍因缺少完整目标字段契约/逐条可执行用例而扣分，不给虚假满分。

历史验收记录、旧 pilot 文档、原需求副本、原型索引和操作指令不适用“完整目标设计”评分，逐份列为 N/A 并说明用途；强行给历史报告打功能覆盖分会误导。重复副本继承同主题评判，但逐路径登记。

复核方法为正文抽取、关键要求逐模块对照和修订章节校验。没有逐页核验所有图示，也没有完成每一条 FR 对每一个段落的独立专家复审；不能把本报告理解为 131 份文档均已完整逐条验收。

## 核心结论

1. PostgreSQL 是老师业务主库基线，SQLite 不能代替正式对标；Milvus、MinIO、Redis/Celery 各有用途，不能全部泛称“数据库”。
2. M1 附件与 M7 图片/视频字节按老师要求存 PostgreSQL；知识原件/解析清单存 MinIO，向量存 Milvus。
3. ComfyUI、五组文案、M2 设计发布双版本、M3 受控问数、M4 周事实与测款、M5 冻结预测评估、M6 双分支与独立库存边界已进入修订目标章节。
4. 固定九岗或强制沿用 pilot 六岗均不能称老师硬性要求。未决项保留 TS Q-01～12。
5. 原实施稿以显式历史附录保留，避免把改过的目标文档冒充现有代码能力；真实实施与目标 DDL/API 的完整细化仍需后续工作。

## Word 排版验证状态

DOCX 已做文本层同步并能重新打开解析。后续已从官方下载安装 LibreOffice 26.8.3.1，签名有效；M8 概要设计成功渲染为 8 页图片，已检查第 1 页。渲染器缺失已解除，但所有 Word 的逐页检查尚未完成，不能据单份渲染成功标记全部排版通过。

## 逐文件对照评分

| 序号 | 文件 | 修改前 | 修订后 | 处理与剩余问题 |
|---:|---|---:|---:|---|
| 1 | [AGENTS.md](D:/ai/AGENTS.md) | N/A | N/A | 操作约束，不是需求交付；保留安全与架构约束。 |
| 2 | [crosspilot-arena/AGENTS.md](D:/ai/crosspilot-arena/AGENTS.md) | N/A | N/A | 操作约束，不是需求交付；保留安全与架构约束。 |
| 3 | [crosspilot-arena/docs/00_docs_index.md](D:/ai/crosspilot-arena/docs/00_docs_index.md) | 46 | 85 | 补充目标与演示实现区分、链接统一基线；历史测试结果不能代表老师全需求通过。 |
| 4 | [crosspilot-arena/docs/06_test_execution_report.md](D:/ai/crosspilot-arena/docs/06_test_execution_report.md) | 46 | 85 | 补充目标与演示实现区分、链接统一基线；历史测试结果不能代表老师全需求通过。 |
| 5 | [crosspilot-arena/docs/detailed-design.docx](D:/ai/crosspilot-arena/docs/detailed-design.docx) | 39 | 84 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 DOCX 未通过渲染验收。 |
| 6 | [crosspilot-arena/docs/modules/m0/01_requirements.md](D:/ai/crosspilot-arena/docs/modules/m0/01_requirements.md) | 52 | 90 | 原稿仅店铺/主档/盘点，缺完整多渠道映射和独立同步验收；已补目标，真实字段/迁移仍待细化。 |
| 7 | [crosspilot-arena/docs/modules/m0/02_hld.md](D:/ai/crosspilot-arena/docs/modules/m0/02_hld.md) | 52 | 90 | 原稿仅店铺/主档/盘点，缺完整多渠道映射和独立同步验收；已补目标，真实字段/迁移仍待细化。 |
| 8 | [crosspilot-arena/docs/modules/m0/03_lld.md](D:/ai/crosspilot-arena/docs/modules/m0/03_lld.md) | 52 | 84 | 原稿仅店铺/主档/盘点，缺完整多渠道映射和独立同步验收；已补目标，真实字段/迁移仍待细化。 |
| 9 | [crosspilot-arena/docs/modules/m0/04_test_cases.md](D:/ai/crosspilot-arena/docs/modules/m0/04_test_cases.md) | 52 | 84 | 原稿仅店铺/主档/盘点，缺完整多渠道映射和独立同步验收；已补目标，真实字段/迁移仍待细化。 |
| 10 | [crosspilot-arena/docs/modules/m1/01_requirements.md](D:/ai/crosspilot-arena/docs/modules/m1/01_requirements.md) | 39 | 90 | 原稿 FAQ/退款简化了 Milvus 推荐、会话消息、WS、订单核验和附件；已补老师链路。 |
| 11 | [crosspilot-arena/docs/modules/m1/02_hld.md](D:/ai/crosspilot-arena/docs/modules/m1/02_hld.md) | 39 | 90 | 原稿 FAQ/退款简化了 Milvus 推荐、会话消息、WS、订单核验和附件；已补老师链路。 |
| 12 | [crosspilot-arena/docs/modules/m1/03_lld.md](D:/ai/crosspilot-arena/docs/modules/m1/03_lld.md) | 39 | 84 | 原稿 FAQ/退款简化了 Milvus 推荐、会话消息、WS、订单核验和附件；已补老师链路。 |
| 13 | [crosspilot-arena/docs/modules/m1/04_test_cases.md](D:/ai/crosspilot-arena/docs/modules/m1/04_test_cases.md) | 39 | 84 | 原稿 FAQ/退款简化了 Milvus 推荐、会话消息、WS、订单核验和附件；已补老师链路。 |
| 14 | [crosspilot-arena/docs/modules/m2_m3/01_requirements.md](D:/ai/crosspilot-arena/docs/modules/m2_m3/01_requirements.md) | 32 | 90 | 原稿固定财务看板/广告页替代驾驶舱设计；缺双版本、四卡并发、三路径和对话记忆；已补目标。 |
| 15 | [crosspilot-arena/docs/modules/m2_m3/02_hld.md](D:/ai/crosspilot-arena/docs/modules/m2_m3/02_hld.md) | 32 | 90 | 原稿固定财务看板/广告页替代驾驶舱设计；缺双版本、四卡并发、三路径和对话记忆；已补目标。 |
| 16 | [crosspilot-arena/docs/modules/m2_m3/03_lld.md](D:/ai/crosspilot-arena/docs/modules/m2_m3/03_lld.md) | 32 | 84 | 原稿固定财务看板/广告页替代驾驶舱设计；缺双版本、四卡并发、三路径和对话记忆；已补目标。 |
| 17 | [crosspilot-arena/docs/modules/m2_m3/04_test_cases.md](D:/ai/crosspilot-arena/docs/modules/m2_m3/04_test_cases.md) | 32 | 84 | 原稿固定财务看板/广告页替代驾驶舱设计；缺双版本、四卡并发、三路径和对话记忆；已补目标。 |
| 18 | [crosspilot-arena/docs/modules/m4/01_requirements.md](D:/ai/crosspilot-arena/docs/modules/m4/01_requirements.md) | 38 | 90 | 原稿候选五维评分替代周事实/研究/测款，固定费用替代完整经营利润；已补来源和测款要求。 |
| 19 | [crosspilot-arena/docs/modules/m4/02_hld.md](D:/ai/crosspilot-arena/docs/modules/m4/02_hld.md) | 38 | 90 | 原稿候选五维评分替代周事实/研究/测款，固定费用替代完整经营利润；已补来源和测款要求。 |
| 20 | [crosspilot-arena/docs/modules/m4/03_lld.md](D:/ai/crosspilot-arena/docs/modules/m4/03_lld.md) | 38 | 84 | 原稿候选五维评分替代周事实/研究/测款，固定费用替代完整经营利润；已补来源和测款要求。 |
| 21 | [crosspilot-arena/docs/modules/m4/04_test_cases.md](D:/ai/crosspilot-arena/docs/modules/m4/04_test_cases.md) | 38 | 84 | 原稿候选五维评分替代周事实/研究/测款，固定费用替代完整经营利润；已补来源和测款要求。 |
| 22 | [crosspilot-arena/docs/modules/m5_m6/01_requirements.md](D:/ai/crosspilot-arena/docs/modules/m5_m6/01_requirements.md) | 40 | 90 | 原稿缺完整冻结预测评估与老师补货状态机，审批/收货改库存冲突；已明确禁止并补目标。 |
| 23 | [crosspilot-arena/docs/modules/m5_m6/02_hld.md](D:/ai/crosspilot-arena/docs/modules/m5_m6/02_hld.md) | 40 | 90 | 原稿缺完整冻结预测评估与老师补货状态机，审批/收货改库存冲突；已明确禁止并补目标。 |
| 24 | [crosspilot-arena/docs/modules/m5_m6/03_lld.md](D:/ai/crosspilot-arena/docs/modules/m5_m6/03_lld.md) | 40 | 84 | 原稿缺完整冻结预测评估与老师补货状态机，审批/收货改库存冲突；已明确禁止并补目标。 |
| 25 | [crosspilot-arena/docs/modules/m5_m6/04_test_cases.md](D:/ai/crosspilot-arena/docs/modules/m5_m6/04_test_cases.md) | 40 | 84 | 原稿缺完整冻结预测评估与老师补货状态机，审批/收货改库存冲突；已明确禁止并补目标。 |
| 26 | [crosspilot-arena/docs/modules/m8/01_requirements.md](D:/ai/crosspilot-arena/docs/modules/m8/01_requirements.md) | 50 | 90 | 原稿强制九岗、部分虚构已有表和本地任务底座；已区分角色草案、目标服务和未实现项。 |
| 27 | [crosspilot-arena/docs/modules/m8/02_hld.md](D:/ai/crosspilot-arena/docs/modules/m8/02_hld.md) | 50 | 90 | 原稿强制九岗、部分虚构已有表和本地任务底座；已区分角色草案、目标服务和未实现项。 |
| 28 | [crosspilot-arena/docs/modules/m8/03_lld.md](D:/ai/crosspilot-arena/docs/modules/m8/03_lld.md) | 50 | 84 | 原稿强制九岗、部分虚构已有表和本地任务底座；已区分角色草案、目标服务和未实现项。 |
| 29 | [crosspilot-arena/docs/modules/m8/04_test_cases.md](D:/ai/crosspilot-arena/docs/modules/m8/04_test_cases.md) | 50 | 84 | 原稿强制九岗、部分虚构已有表和本地任务底座；已区分角色草案、目标服务和未实现项。 |
| 30 | [crosspilot-arena/docs/plans/srs-deviation-analysis.docx](D:/ai/crosspilot-arena/docs/plans/srs-deviation-analysis.docx) | 68 | 83 | 已补老师技术存储基线，纠正“老师强制六角色”来源误判；原规划不作当前实现证据。DOCX 未通过渲染验收。 |
| 31 | [crosspilot-arena/docs/plans/业务与数据通俗说明_123步骤.docx](D:/ai/crosspilot-arena/docs/plans/业务与数据通俗说明_123步骤.docx) | 68 | 83 | 已补老师技术存储基线，纠正“老师强制六角色”来源误判；原规划不作当前实现证据。DOCX 未通过渲染验收。 |
| 32 | [crosspilot-arena/docs/plans/需求分析文档_V2_对齐SRS与V6数据流.docx](D:/ai/crosspilot-arena/docs/plans/需求分析文档_V2_对齐SRS与V6数据流.docx) | 68 | 83 | 已补老师技术存储基线，纠正“老师强制六角色”来源误判；原规划不作当前实现证据。DOCX 未通过渲染验收。 |
| 33 | [crosspilot-arena/docs/prototypes/README.md](D:/ai/crosspilot-arena/docs/prototypes/README.md) | N/A | N/A | 原型索引/辅助说明，不能作为功能、数据库或部署已完成证据；由本次统一基线限定适用范围。 |
| 34 | [crosspilot-arena/docs/prototypes/ui_v6/README.md](D:/ai/crosspilot-arena/docs/prototypes/ui_v6/README.md) | N/A | N/A | 原型索引/辅助说明，不能作为功能、数据库或部署已完成证据；由本次统一基线限定适用范围。 |
| 35 | [crosspilot-arena/docs/requirements/AI跨境电商平台-两周开发计划与方案设计_V1.1.docx](D:/ai/crosspilot-arena/docs/requirements/AI跨境电商平台-两周开发计划与方案设计_V1.1.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 36 | [crosspilot-arena/docs/requirements/AI跨境电商平台-模块需求细化_V1.1.docx](D:/ai/crosspilot-arena/docs/requirements/AI跨境电商平台-模块需求细化_V1.1.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 37 | [crosspilot-arena/docs/requirements/AI跨境电商平台-第一版需求文档_V1.0.docx](D:/ai/crosspilot-arena/docs/requirements/AI跨境电商平台-第一版需求文档_V1.0.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 38 | [crosspilot-arena/docs/requirements/AI跨境电商平台V1.0-软件需求规格说明书.docx](D:/ai/crosspilot-arena/docs/requirements/AI跨境电商平台V1.0-软件需求规格说明书.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 39 | [crosspilot-arena/docs/requirements/AI跨境电商平台V1.1-架构与需求.docx](D:/ai/crosspilot-arena/docs/requirements/AI跨境电商平台V1.1-架构与需求.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 40 | [crosspilot-arena/docs/requirements/CrossPilot-M7商品内容创作与合规交付概要设计说明书.docx](D:/ai/crosspilot-arena/docs/requirements/CrossPilot-M7商品内容创作与合规交付概要设计说明书.docx) | 39 | 90 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 DOCX 未通过渲染验收。 |
| 41 | [crosspilot-arena/docs/requirements/CrossPilot-M7商品内容创作与合规交付测试用例.docx](D:/ai/crosspilot-arena/docs/requirements/CrossPilot-M7商品内容创作与合规交付测试用例.docx) | 39 | 84 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 DOCX 未通过渲染验收。 |
| 42 | [crosspilot-arena/docs/requirements/CrossPilot-M7商品内容创作与合规交付需求说明书.docx](D:/ai/crosspilot-arena/docs/requirements/CrossPilot-M7商品内容创作与合规交付需求说明书.docx) | 39 | 90 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 DOCX 未通过渲染验收。 |
| 43 | [crosspilot-arena/docs/requirements/CrossPilot-M7测试用例思维导图大纲.docx](D:/ai/crosspilot-arena/docs/requirements/CrossPilot-M7测试用例思维导图大纲.docx) | 39 | 84 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 DOCX 未通过渲染验收。 |
| 44 | [crosspilot-arena/docs/requirements/CrossPilot-需求分析.docx](D:/ai/crosspilot-arena/docs/requirements/CrossPilot-需求分析.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 45 | [crosspilot-arena/docs/requirements/README.md](D:/ai/crosspilot-arena/docs/requirements/README.md) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 46 | [crosspilot-arena/docs-docx/docs/modules/m0/CrossPilot-M0店铺接入与商品主档概要设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m0/CrossPilot-M0店铺接入与商品主档概要设计说明书.docx) | 52 | 90 | 原稿仅店铺/主档/盘点，缺完整多渠道映射和独立同步验收；已补目标，真实字段/迁移仍待细化。 DOCX 未通过渲染验收。 |
| 47 | [crosspilot-arena/docs-docx/docs/modules/m0/CrossPilot-M0店铺接入与商品主档测试用例.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m0/CrossPilot-M0店铺接入与商品主档测试用例.docx) | 52 | 84 | 原稿仅店铺/主档/盘点，缺完整多渠道映射和独立同步验收；已补目标，真实字段/迁移仍待细化。 DOCX 未通过渲染验收。 |
| 48 | [crosspilot-arena/docs-docx/docs/modules/m0/CrossPilot-M0店铺接入与商品主档详细设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m0/CrossPilot-M0店铺接入与商品主档详细设计说明书.docx) | 52 | 84 | 原稿仅店铺/主档/盘点，缺完整多渠道映射和独立同步验收；已补目标，真实字段/迁移仍待细化。 DOCX 未通过渲染验收。 |
| 49 | [crosspilot-arena/docs-docx/docs/modules/m0/CrossPilot-M0店铺接入与商品主档需求说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m0/CrossPilot-M0店铺接入与商品主档需求说明书.docx) | 52 | 90 | 原稿仅店铺/主档/盘点，缺完整多渠道映射和独立同步验收；已补目标，真实字段/迁移仍待细化。 DOCX 未通过渲染验收。 |
| 50 | [crosspilot-arena/docs-docx/docs/modules/m1/CrossPilot-M1客服导购与售后闭环概要设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m1/CrossPilot-M1客服导购与售后闭环概要设计说明书.docx) | 39 | 90 | 原稿 FAQ/退款简化了 Milvus 推荐、会话消息、WS、订单核验和附件；已补老师链路。 DOCX 未通过渲染验收。 |
| 51 | [crosspilot-arena/docs-docx/docs/modules/m1/CrossPilot-M1客服导购与售后闭环测试用例.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m1/CrossPilot-M1客服导购与售后闭环测试用例.docx) | 39 | 84 | 原稿 FAQ/退款简化了 Milvus 推荐、会话消息、WS、订单核验和附件；已补老师链路。 DOCX 未通过渲染验收。 |
| 52 | [crosspilot-arena/docs-docx/docs/modules/m1/CrossPilot-M1客服导购与售后闭环详细设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m1/CrossPilot-M1客服导购与售后闭环详细设计说明书.docx) | 39 | 84 | 原稿 FAQ/退款简化了 Milvus 推荐、会话消息、WS、订单核验和附件；已补老师链路。 DOCX 未通过渲染验收。 |
| 53 | [crosspilot-arena/docs-docx/docs/modules/m1/CrossPilot-M1客服导购与售后闭环需求说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m1/CrossPilot-M1客服导购与售后闭环需求说明书.docx) | 39 | 90 | 原稿 FAQ/退款简化了 Milvus 推荐、会话消息、WS、订单核验和附件；已补老师链路。 DOCX 未通过渲染验收。 |
| 54 | [crosspilot-arena/docs-docx/docs/modules/m2_m3/CrossPilot-M2M3经营分析与智能问数概要设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m2_m3/CrossPilot-M2M3经营分析与智能问数概要设计说明书.docx) | 32 | 90 | 原稿固定财务看板/广告页替代驾驶舱设计；缺双版本、四卡并发、三路径和对话记忆；已补目标。 DOCX 未通过渲染验收。 |
| 55 | [crosspilot-arena/docs-docx/docs/modules/m2_m3/CrossPilot-M2M3经营分析与智能问数测试用例.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m2_m3/CrossPilot-M2M3经营分析与智能问数测试用例.docx) | 32 | 84 | 原稿固定财务看板/广告页替代驾驶舱设计；缺双版本、四卡并发、三路径和对话记忆；已补目标。 DOCX 未通过渲染验收。 |
| 56 | [crosspilot-arena/docs-docx/docs/modules/m2_m3/CrossPilot-M2M3经营分析与智能问数详细设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m2_m3/CrossPilot-M2M3经营分析与智能问数详细设计说明书.docx) | 32 | 84 | 原稿固定财务看板/广告页替代驾驶舱设计；缺双版本、四卡并发、三路径和对话记忆；已补目标。 DOCX 未通过渲染验收。 |
| 57 | [crosspilot-arena/docs-docx/docs/modules/m2_m3/CrossPilot-M2M3经营分析与智能问数需求说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m2_m3/CrossPilot-M2M3经营分析与智能问数需求说明书.docx) | 32 | 90 | 原稿固定财务看板/广告页替代驾驶舱设计；缺双版本、四卡并发、三路径和对话记忆；已补目标。 DOCX 未通过渲染验收。 |
| 58 | [crosspilot-arena/docs-docx/docs/modules/m4/CrossPilot-M4智能选品与过会决策概要设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m4/CrossPilot-M4智能选品与过会决策概要设计说明书.docx) | 38 | 90 | 原稿候选五维评分替代周事实/研究/测款，固定费用替代完整经营利润；已补来源和测款要求。 DOCX 未通过渲染验收。 |
| 59 | [crosspilot-arena/docs-docx/docs/modules/m4/CrossPilot-M4智能选品与过会决策测试用例.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m4/CrossPilot-M4智能选品与过会决策测试用例.docx) | 38 | 84 | 原稿候选五维评分替代周事实/研究/测款，固定费用替代完整经营利润；已补来源和测款要求。 DOCX 未通过渲染验收。 |
| 60 | [crosspilot-arena/docs-docx/docs/modules/m4/CrossPilot-M4智能选品与过会决策详细设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m4/CrossPilot-M4智能选品与过会决策详细设计说明书.docx) | 38 | 84 | 原稿候选五维评分替代周事实/研究/测款，固定费用替代完整经营利润；已补来源和测款要求。 DOCX 未通过渲染验收。 |
| 61 | [crosspilot-arena/docs-docx/docs/modules/m4/CrossPilot-M4智能选品与过会决策需求说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m4/CrossPilot-M4智能选品与过会决策需求说明书.docx) | 38 | 90 | 原稿候选五维评分替代周事实/研究/测款，固定费用替代完整经营利润；已补来源和测款要求。 DOCX 未通过渲染验收。 |
| 62 | [crosspilot-arena/docs-docx/docs/modules/m5_m6/CrossPilot-M5M6销量预测与智能补货概要设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m5_m6/CrossPilot-M5M6销量预测与智能补货概要设计说明书.docx) | 40 | 90 | 原稿缺完整冻结预测评估与老师补货状态机，审批/收货改库存冲突；已明确禁止并补目标。 DOCX 未通过渲染验收。 |
| 63 | [crosspilot-arena/docs-docx/docs/modules/m5_m6/CrossPilot-M5M6销量预测与智能补货测试用例.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m5_m6/CrossPilot-M5M6销量预测与智能补货测试用例.docx) | 40 | 84 | 原稿缺完整冻结预测评估与老师补货状态机，审批/收货改库存冲突；已明确禁止并补目标。 DOCX 未通过渲染验收。 |
| 64 | [crosspilot-arena/docs-docx/docs/modules/m5_m6/CrossPilot-M5M6销量预测与智能补货详细设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m5_m6/CrossPilot-M5M6销量预测与智能补货详细设计说明书.docx) | 40 | 84 | 原稿缺完整冻结预测评估与老师补货状态机，审批/收货改库存冲突；已明确禁止并补目标。 DOCX 未通过渲染验收。 |
| 65 | [crosspilot-arena/docs-docx/docs/modules/m5_m6/CrossPilot-M5M6销量预测与智能补货需求说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m5_m6/CrossPilot-M5M6销量预测与智能补货需求说明书.docx) | 40 | 90 | 原稿缺完整冻结预测评估与老师补货状态机，审批/收货改库存冲突；已明确禁止并补目标。 DOCX 未通过渲染验收。 |
| 66 | [crosspilot-arena/docs-docx/docs/modules/m8/CrossPilot-M8组织权限与平台底座概要设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m8/CrossPilot-M8组织权限与平台底座概要设计说明书.docx) | 50 | 90 | 原稿强制九岗、部分虚构已有表和本地任务底座；已区分角色草案、目标服务和未实现项。 DOCX 未通过渲染验收。 |
| 67 | [crosspilot-arena/docs-docx/docs/modules/m8/CrossPilot-M8组织权限与平台底座测试用例.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m8/CrossPilot-M8组织权限与平台底座测试用例.docx) | 50 | 84 | 原稿强制九岗、部分虚构已有表和本地任务底座；已区分角色草案、目标服务和未实现项。 DOCX 未通过渲染验收。 |
| 68 | [crosspilot-arena/docs-docx/docs/modules/m8/CrossPilot-M8组织权限与平台底座详细设计说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m8/CrossPilot-M8组织权限与平台底座详细设计说明书.docx) | 50 | 84 | 原稿强制九岗、部分虚构已有表和本地任务底座；已区分角色草案、目标服务和未实现项。 DOCX 未通过渲染验收。 |
| 69 | [crosspilot-arena/docs-docx/docs/modules/m8/CrossPilot-M8组织权限与平台底座需求说明书.docx](D:/ai/crosspilot-arena/docs-docx/docs/modules/m8/CrossPilot-M8组织权限与平台底座需求说明书.docx) | 50 | 90 | 原稿强制九岗、部分虚构已有表和本地任务底座；已区分角色草案、目标服务和未实现项。 DOCX 未通过渲染验收。 |
| 70 | [crosspilot-arena/README.md](D:/ai/crosspilot-arena/README.md) | 46 | 85 | 补充目标与演示实现区分、链接统一基线；历史测试结果不能代表老师全需求通过。 |
| 71 | [crosspilot-arena/README_M7.md](D:/ai/crosspilot-arena/README_M7.md) | 39 | 90 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 |
| 72 | [CrossPilot-M7商品内容创作与合规交付测试用例.md](D:/ai/CrossPilot-M7商品内容创作与合规交付测试用例.md) | 39 | 84 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 |
| 73 | [CrossPilot-M7商品内容创作与合规交付需求说明书.md](D:/ai/CrossPilot-M7商品内容创作与合规交付需求说明书.md) | 39 | 90 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 |
| 74 | [CrossPilot-M7概要设计说明书.md](D:/ai/CrossPilot-M7概要设计说明书.md) | 39 | 90 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 |
| 75 | [CrossPilot-M7测试用例思维导图大纲.md](D:/ai/CrossPilot-M7测试用例思维导图大纲.md) | 39 | 84 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 |
| 76 | [CrossPilot-详细设计.md](D:/ai/CrossPilot-详细设计.md) | 46 | 85 | 补充目标与演示实现区分、链接统一基线；历史测试结果不能代表老师全需求通过。 |
| 77 | [docs/requirements/AI跨境电商平台-两周开发计划与方案设计_V1.1.md](D:/ai/docs/requirements/AI跨境电商平台-两周开发计划与方案设计_V1.1.md) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 78 | [docs/requirements/AI跨境电商平台-模块需求细化_V1.1.md](D:/ai/docs/requirements/AI跨境电商平台-模块需求细化_V1.1.md) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 79 | [docs/requirements/AI跨境电商平台-第一版需求文档_V1.0.md](D:/ai/docs/requirements/AI跨境电商平台-第一版需求文档_V1.0.md) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 80 | [docs/requirements/AI跨境电商平台V1.0-软件需求规格说明书.md](D:/ai/docs/requirements/AI跨境电商平台V1.0-软件需求规格说明书.md) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 81 | [docs/requirements/AI跨境电商平台V1.1-架构与需求.md](D:/ai/docs/requirements/AI跨境电商平台V1.1-架构与需求.md) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 82 | [docs/requirements/CrossPilot-需求分析.md](D:/ai/docs/requirements/CrossPilot-需求分析.md) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 83 | [docs/requirements/README.md](D:/ai/docs/requirements/README.md) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 84 | [docx-all/docs/detailed-design.docx](D:/ai/docx-all/docs/detailed-design.docx) | 39 | 84 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 DOCX 未通过渲染验收。 |
| 85 | [docx-all/docs/plans/srs-deviation-analysis.docx](D:/ai/docx-all/docs/plans/srs-deviation-analysis.docx) | 68 | 83 | 已补老师技术存储基线，纠正“老师强制六角色”来源误判；原规划不作当前实现证据。DOCX 未通过渲染验收。 |
| 86 | [docx-all/docs/plans/业务与数据通俗说明_123步骤.docx](D:/ai/docx-all/docs/plans/业务与数据通俗说明_123步骤.docx) | 68 | 83 | 已补老师技术存储基线，纠正“老师强制六角色”来源误判；原规划不作当前实现证据。DOCX 未通过渲染验收。 |
| 87 | [docx-all/docs/plans/需求分析文档_V2_对齐SRS与V6数据流.docx](D:/ai/docx-all/docs/plans/需求分析文档_V2_对齐SRS与V6数据流.docx) | 68 | 83 | 已补老师技术存储基线，纠正“老师强制六角色”来源误判；原规划不作当前实现证据。DOCX 未通过渲染验收。 |
| 88 | [docx-all/docs/requirements/AI跨境电商平台-两周开发计划与方案设计_V1.1.docx](D:/ai/docx-all/docs/requirements/AI跨境电商平台-两周开发计划与方案设计_V1.1.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 89 | [docx-all/docs/requirements/AI跨境电商平台-模块需求细化_V1.1.docx](D:/ai/docx-all/docs/requirements/AI跨境电商平台-模块需求细化_V1.1.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 90 | [docx-all/docs/requirements/AI跨境电商平台-第一版需求文档_V1.0.docx](D:/ai/docx-all/docs/requirements/AI跨境电商平台-第一版需求文档_V1.0.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 91 | [docx-all/docs/requirements/AI跨境电商平台V1.0-软件需求规格说明书.docx](D:/ai/docx-all/docs/requirements/AI跨境电商平台V1.0-软件需求规格说明书.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 92 | [docx-all/docs/requirements/AI跨境电商平台V1.1-架构与需求.docx](D:/ai/docx-all/docs/requirements/AI跨境电商平台V1.1-架构与需求.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 93 | [docx-all/docs/requirements/CrossPilot-M7商品内容创作与合规交付概要设计说明书.docx](D:/ai/docx-all/docs/requirements/CrossPilot-M7商品内容创作与合规交付概要设计说明书.docx) | 39 | 90 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 DOCX 未通过渲染验收。 |
| 94 | [docx-all/docs/requirements/CrossPilot-M7商品内容创作与合规交付测试用例.docx](D:/ai/docx-all/docs/requirements/CrossPilot-M7商品内容创作与合规交付测试用例.docx) | 39 | 84 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 DOCX 未通过渲染验收。 |
| 95 | [docx-all/docs/requirements/CrossPilot-M7商品内容创作与合规交付需求说明书.docx](D:/ai/docx-all/docs/requirements/CrossPilot-M7商品内容创作与合规交付需求说明书.docx) | 39 | 90 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 DOCX 未通过渲染验收。 |
| 96 | [docx-all/docs/requirements/CrossPilot-M7测试用例思维导图大纲.docx](D:/ai/docx-all/docs/requirements/CrossPilot-M7测试用例思维导图大纲.docx) | 39 | 84 | 原稿云端/Pillow/FFmpeg、本地文件、三组草稿替代 ComfyUI/媒体字节入库/五组草稿；已纠正目标。 DOCX 未通过渲染验收。 |
| 97 | [docx-all/docs/requirements/CrossPilot-需求分析.docx](D:/ai/docx-all/docs/requirements/CrossPilot-需求分析.docx) | N/A | N/A | 来源/历史需求副本，保留原文；本轮权威仅限桌面三份老师原件，不将其它分期文档的取舍冒充老师批准。 |
| 98 | [pilot/.pytest_cache/README.md](D:/ai/pilot/.pytest_cache/README.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 99 | [pilot/_backup_pack14_fix/pack14-fix-report.md](D:/ai/pilot/_backup_pack14_fix/pack14-fix-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 100 | [pilot/_backup_pack15_fix/eval-report-v1.before.md](D:/ai/pilot/_backup_pack15_fix/eval-report-v1.before.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 101 | [pilot/_backup_pack15_fix/eval-report-v1.before_w4_realrun.md](D:/ai/pilot/_backup_pack15_fix/eval-report-v1.before_w4_realrun.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 102 | [pilot/_backup_pack15_fix/qa15_verification_run_eval-report-v1.RUN10.md](D:/ai/pilot/_backup_pack15_fix/qa15_verification_run_eval-report-v1.RUN10.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 103 | [pilot/deploy/README.md](D:/ai/pilot/deploy/README.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 104 | [pilot/docs/_archive/2026-11-19/eval-report-pack13-snapshot.md](D:/ai/pilot/docs/_archive/2026-11-19/eval-report-pack13-snapshot.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 105 | [pilot/docs/_archive/2026-11-19/eval-report-pack16a-ask.md](D:/ai/pilot/docs/_archive/2026-11-19/eval-report-pack16a-ask.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 106 | [pilot/docs/eval-report-v1.md](D:/ai/pilot/docs/eval-report-v1.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 107 | [pilot/docs/final-local-acceptance.md](D:/ai/pilot/docs/final-local-acceptance.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 108 | [pilot/docs/iteration-backlog.md](D:/ai/pilot/docs/iteration-backlog.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 109 | [pilot/docs/local-verification-2026-11-19.md](D:/ai/pilot/docs/local-verification-2026-11-19.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 110 | [pilot/docs/pack14-fix-report.md](D:/ai/pilot/docs/pack14-fix-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 111 | [pilot/docs/pack14-omission.md](D:/ai/pilot/docs/pack14-omission.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 112 | [pilot/docs/pack14-z5-qa-report.md](D:/ai/pilot/docs/pack14-z5-qa-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 113 | [pilot/docs/pack15-qa-report.md](D:/ai/pilot/docs/pack15-qa-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 114 | [pilot/docs/pack16a-report.md](D:/ai/pilot/docs/pack16a-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 115 | [pilot/docs/pack16b-report.md](D:/ai/pilot/docs/pack16b-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 116 | [pilot/docs/pack16c-report.md](D:/ai/pilot/docs/pack16c-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 117 | [pilot/docs/pack17a-report.md](D:/ai/pilot/docs/pack17a-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 118 | [pilot/docs/pack17b-report.md](D:/ai/pilot/docs/pack17b-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 119 | [pilot/docs/pack18-report.md](D:/ai/pilot/docs/pack18-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 120 | [pilot/docs/pack19-report.md](D:/ai/pilot/docs/pack19-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 121 | [pilot/docs/pack20-report.md](D:/ai/pilot/docs/pack20-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 122 | [pilot/docs/pack21-report.md](D:/ai/pilot/docs/pack21-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 123 | [pilot/docs/pack22-context-pack.md](D:/ai/pilot/docs/pack22-context-pack.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 124 | [pilot/docs/pack22-data-source-plan.md](D:/ai/pilot/docs/pack22-data-source-plan.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 125 | [pilot/docs/pack23-rbac.md](D:/ai/pilot/docs/pack23-rbac.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 126 | [pilot/docs/pack24-report.md](D:/ai/pilot/docs/pack24-report.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 127 | [pilot/docs/pack25-1688-first-layer.md](D:/ai/pilot/docs/pack25-1688-first-layer.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 128 | [pilot/docs/public-dataset.md](D:/ai/pilot/docs/public-dataset.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 129 | [pilot/docs/reject-matrix.md](D:/ai/pilot/docs/reject-matrix.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 130 | [pilot/docs/封版报告.md](D:/ai/pilot/docs/封版报告.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |
| 131 | [pilot/README.md](D:/ai/pilot/README.md) | N/A | N/A | 旧 pilot 实施/验收历史，保留原证据；不作为外包项目部署或全需求验收依据。 |

## 复核后仍不能宣布完成的事项

- 目标详细设计仍需补足可执行 DDL、完整接口字段/错误码、并发与迁移顺序；新增目标章节不是完整工程契约的替代品。
- 测试目标已补入，但未逐条展开并执行所有老师 FR/AC 用例；旧通过报告保留历史性质。
- DOCX 的版式、内嵌流程图及图中文字尚未全部同步与逐页视觉核验。
- PostgreSQL/Milvus/Redis/Celery/MinIO/Vanna/ComfyUI 的实际接入与本地部署不在本次文档修改中完成。
- 因上述缺口，本轮是可审阅的内容纠偏版，不能标记为“所有文档均已完全对齐、最终验收通过”。
