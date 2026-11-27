# CrossPilot 商品内容创作概要设计说明书

版本2.0，2026年11月26日。本文为老师基线下的目标设计；不代表现有代码已经实现或本地数据库已经部署。老师未规定的物理名称、完整接口字段和运行默认值在配套目标契约中作为项目设计明确，不冒充老师批准。

## 范围与技术约束

前端采用Vue 3、TypeScript、Vue Router、Vite/vue-tsc、Axios；接入Nginx，后端Python/FastAPI/Uvicorn/Pydantic；业务数据库PostgreSQL、SQLAlchemy Async ORM、asyncpg。Milvus用于向量，MinIO用于知识原件，Redis/Celery Worker/Beat按需启用，Vanna 2受控问数，ComfyUI执行视觉工作流。M1附件和M7真实媒体字节存PostgreSQL。

完整配套规格：crosspilot-arena/docs/target/target-schema.sql、openapi-target.json、acceptance-cases.json、traceability.json；公共事务/状态/部署规则见 docs/teacher-baseline/TARGET-RULES.md。字段和接口以这些目标文件为准，旧实现的m0_*～m8_*不能自动等同于目标。

## 分层与数据流

![目标流程](D:/ai/crosspilot-arena/docs/target/figures/m7.png)

Vue页面经统一orgApi到组织/资源鉴权、领域服务与数据访问层。确定性计算在服务端；可选模型只解释或给文案。数据库提交后发布事件；WS/缓存/向量不替代业务事实。

### 工作流与文案

统一商品、工作流版本和任务入口，按组织/幂等键先查重再验证商品与工作流归属。WorkflowTemplateContentStrategy 经 ContentHarness/ContentDraftSkills 基于商品事实生成五组标题/要点/描述/关键词草稿，保存 AgentRun、GenerationJob、GenerationAsset.content。云端 LLM 可作为另行评估的扩展，不能将必配云 Key 或三组草稿替代老师基线。

### ComfyUI 链路

MAIN_IMAGE/SHORT_VIDEO 校验已发布工作流用途，注册或内置 ComfyUI API 图；/prompt 提交保存 prompt_id；前端 /sync，后端 /history/{prompt_id}。无历史保持运行，节点错误或无输出记录失败；/view 获取真实文件，验证 MIME 与用途匹配。实际媒体入库后才 SUCCEEDED。Pillow/FFmpeg 可作文件处理工具或明确标记演示，不是 ComfyUI 验收替代品。

### 媒体存储

GenerationAsset.content 保存文案 JSON 或视觉文件描述；GenerationMedia.file_data 保存真实图片/视频字节，关联资产、组织、MIME、大小和完整性信息。知识原件/解析清单走 MinIO；不能把 GenerationMedia 全部改为本地 storage_key。最终文件的 AI 人物元数据按老师输入读回验证，政策字段适用性保留待验证。

### 合规与交付

同任务单选方案；创作期必用词/禁忌提示不等于正式合规。/compliance-check 只取指定区段并保存独立检查记录，后续人工审批；生成成功不代表视觉审核或已发布。素材接口二进制直返。离线 ZIP/HTML、1+4 套图、A+ 和 8+N 是项目扩展，不得替代三种模式、真实工作流、五组草稿与媒体入库要求。

### 资源与审计

工作流锁定版本，记录模型/节点版本、参数、种子、提示词、操作者、时间、结果与错误；按配置管理 ComfyUI 实例健康、容量/队列和有上限的失败重试。GPU、checkpoint/SVD 模型与合法工作流在目标环境确认，不自行下载或假定可用。

## 持久化实体与责任

| 目标表 | 字段数量 | 组织关联 |
|---|---|---|
| workflow_versions | 14 | org_id复合外键、版本、RLS |
| comfy_instances | 12 | org_id复合外键、版本、RLS |
| agent_runs | 10 | org_id复合外键、版本、RLS |
| generation_jobs | 20 | org_id复合外键、版本、RLS |
| generation_assets | 10 | org_id复合外键、版本、RLS |
| generation_media | 10 | org_id复合外键、版本、RLS |
| compliance_rule_versions | 13 | org_id复合外键、版本、RLS |
| certificates | 10 | org_id复合外键、版本、RLS |
| compliance_checks | 12 | org_id复合外键、版本、RLS |
| content_approvals | 11 | org_id复合外键、版本、RLS |

## 来源追溯

FR-GC-01, FR-GC-02, FR-GC-03, FR-GC-04, FR-GC-05, FR-GC-06, FR-GC-07, FR-GC-08, FR-GC-09, FR-GC-10, AC-GC-01, AC-GC-02, AC-GC-03, AC-GC-04

## 失效与恢复

外部依赖失败保存错误和旧成果；后台任务有幂等、租约和重试，数据库为最终事实。SQLite/Pillow/本地文件的演示结果不能替代PostgreSQL/ComfyUI验收。备份恢复与迁移次序按公共规则执行。

## 当前实现差距与未决事项

外包当前仍是SQLite及本地媒体文件方案，目标DDL/API与真实ComfyUI/Milvus等接入尚需后续代码实施。生产角色模型、交付分期、刷新/上限等老师Q-01～12按原问题保留；本文的可配置建议值不等于老师已批准。本次只修改文档，不运行迁移、不改应用代码。
