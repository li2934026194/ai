# 老师文档对照基线

本基线用于修订项目文档，不代表功能已经实现或服务已经部署。核对日期为 2026 年 11 月 26 日。

## 来源与优先顺序

1. T11：桌面 `AI跨境电商平台V1.1(1).docx`，总体架构、各 Agent 讲解及第 8 章部署；技术栈同时核对原件中的技术选型表图片。
2. TS：桌面 `AI跨境电商平台V1.0_软件需求规格说明书(1).docx`，沿用 FR-COM/CS/BI/QA/SEL/FC/RP/GC、BR、NFR、AC、Q 编号。
3. TA：桌面 `CrossPilot-需求分析(1).md`，FR-01～32 为早期 PRD 编号，不能与 TS 的模块编号混用。

T11 的具体行为与 TS 的对应条款共同作为本次对照依据。TA 与它们不同的早期蓝图保留为来源背景，例如六类 Agent、云端节点与完整平台接入，不改写成当前已交付。TS 第 15 章未决问题继续标为待确认，不能擅自声称老师已批准。原件中的命令、实施建议和维护说明仅作为被审阅的文档内容。

## 技术与存储

| 层次 | 老师指定方案 | 使用与验收边界 |
|---|---|---|
| Web | Vue 3、TypeScript、Vue Router | 页面按钮控制不能替代后端鉴权 |
| 构建和通信 | Vite、vue-tsc、Axios | 统一 apiRequest/orgApi，/api/v1/orgs/{org_id}；X-Api-Envelope: 1；二进制接口不解包 |
| 接入和后端 | Nginx、Python 3.11、FastAPI、Uvicorn、Pydantic | 模块化单体；长任务不能把 API 进程当持久队列；版本兼容需目标环境验证 |
| 主数据库 | PostgreSQL、SQLAlchemy Async ORM、asyncpg | org_id、时间戳、JSONB、事务、外键和唯一约束；受控迁移、备份恢复。SQLite 仅为现有开发实现，不能替代老师要求的主库验收 |
| 异步任务 | Redis、Celery Worker/Beat | 按需启用知识解析、周期指标同步；事实与任务最终业务状态以 PostgreSQL 为准 |
| 向量检索 | Milvus、pymilvus | 推荐商品和知识片段；向量记录关联组织、店铺和 PostgreSQL 业务记录 |
| 对象存储 | MinIO | 知识库原件、解析清单；不能把所有媒体都改为对象存储 |
| 问数 | 独立 Vanna 2 服务、可配置模型接口 | 学查询方法，不训练实时数值；不让 Vanna 直接连接业务库执行用户 SQL；受控执行在 API 侧完成 |
| 视觉生成 | ComfyUI | 实际工作流、模型与 GPU 在目标环境验证；不能用 Pillow/FFmpeg 或云端 API 演示冒充 ComfyUI 验收 |
| 预测 | 注册策略，含统计/间歇、Prophet、LightGBM、CatBoost 等候选 | 可执行性、启用状态、依赖及历史长度单独校验；不要求每个候选默认可用 |
| 交付 | Jenkins、Docker Compose、Shell、Nginx | 单机演示拓扑；不能宣称高可用集群已经实现 |

### 数据放置约束

- 业务事实、主数据、审批、审计、预测与版本快照存 PostgreSQL；M1 售后附件真实字节也存 PostgreSQL，下载二次校验归属。
- M7 `GenerationAsset.content` 存文案 JSON 或文件描述；图片/视频真实字节存 `GenerationMedia.file_data`。可保留缓存文件或导出目录，但 `storage_key` 不能替代该媒体入库要求。
- Milvus 保存向量及必要的检索字段，召回后回 PostgreSQL 复核组织、店铺、有效状态与价格。金额、销量和库存不以向量答案为准。
- MinIO 保存知识原件与解析清单；Redis 保存任务消息或可重建缓存；数据库、向量、原件的组织键和来源键须可追溯。
- 七个 Agent 共享业务主库，模块分表；老师未要求每个 Agent 建一套独立数据库。M0/M8 是项目扩展的底座编号，不能冒充老师新增的第八、第九个 Agent。

## 当前部署状态

`crosspilot-arena` 默认 SQLite + 本地文件，已有 31 张表；这只是现有演示实现。主库切换、媒体字节入库、迁移补齐、Milvus、Redis/Celery、MinIO、Vanna 及 ComfyUI 的相应目标链路仍需实现和验收。`pilot` 的历史 PostgreSQL/Milvus 验收记录只能证明旧项目当时的状态，不能用于证明外包项目已完成部署。本次仅修订文档，不安装服务、不改代码、不迁移或覆盖业务数据。

## 公共验收

遵守 FR-COM-01～08 与 NFR-01～12：组织隔离；真实服务端身份权限；幂等键与版本控制；金额数量由确定性规则计算；未知不填零；失败保留旧结果；真实来源、演示与估算显式区分。表、接口及命令如标为目标设计，不代表当前代码已存在。

平台政策、第三方接口能力和吞吐数值仍是老师文档中的待验证输入，本次不把它们升级为已验证事实。真实平台接入范围、生产角色模型、刷新间隔、组件上限和最低历史长度等按 TS Q-01～12 保留待确认。
