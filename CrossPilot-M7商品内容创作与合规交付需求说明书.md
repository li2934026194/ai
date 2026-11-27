# CrossPilot 商品内容创作需求说明书

版本2.0，2026年11月26日。本文为老师基线下的目标设计；不代表现有代码已经实现或本地数据库已经部署。老师未规定的物理名称、完整接口字段和运行默认值在配套目标契约中作为项目设计明确，不冒充老师批准。

## 范围与技术约束

前端采用Vue 3、TypeScript、Vue Router、Vite/vue-tsc、Axios；接入Nginx，后端Python/FastAPI/Uvicorn/Pydantic；业务数据库PostgreSQL、SQLAlchemy Async ORM、asyncpg。Milvus用于向量，MinIO用于知识原件，Redis/Celery Worker/Beat按需启用，Vanna 2受控问数，ComfyUI执行视觉工作流。M1附件和M7真实媒体字节存PostgreSQL。

完整配套规格：crosspilot-arena/docs/target/target-schema.sql、openapi-target.json、acceptance-cases.json、traceability.json；公共事务/状态/部署规则见 docs/teacher-baseline/TARGET-RULES.md。字段和接口以这些目标文件为准，旧实现的m0_*～m8_*不能自动等同于目标。

## 老师需求与业务约束

| 条款 | 要求 |
|---|---|
| FR-GC-01 | 应建立商品主数据（标题、SKU、品类、属性）与工作流版本（用途、状态、平台、可选 ComfyUI API 图）；P0 |
| FR-GC-02 | 应建立 GenerationJob、GenerationAsset、GenerationMedia，含组织字段、外键与媒体唯一约束，保留幂等键、参数、进度与错误详情；GenerationAsset.content 保存文案 JSON 或视觉文件描述，真实图片/视频字节存于 GenerationMedia.file_data；P0 |
| FR-GC-03 | 创建请求应先按组织与幂等键查重，再校验商品归属；WorkflowTemplateContentStrategy 调用 ContentHarness 与 ContentDraftSkills 生成变体，保存 AgentRun、GenerationJob、GenerationAsset；P0 |
| FR-GC-04 | 文案策略应根据目录事实生成标题、要点、描述和关键词，检查必用术语与排除词；页面展示五组草稿与复核标记，供用户选择方案；P0 |
| FR-GC-05 | 点击合规检查时，后端应选中素材、只取指定文案区段，运行合规策略并保存独立 ComplianceCheck 记录；创作阶段的术语/禁忌复核标记只是提示，不构成正式合规结论；P0 |
| FR-GC-06 | 视觉任务应校验已发布工作流用途，生成内置或注册的 ComfyUI API 图，向 /prompt 提交并保存任务与 prompt_id；无自定义图时从 ComfyUI 已安装模型生成默认图；分别处理商品图与 SVD 视频工作流；P0 |
| FR-GC-07 | 前端应定时调用 /sync，后端请求 /history/{prompt_id}：无历史保持运行中，节点执行错误或无输出记录失败原因；有输出时向 /view 下载文件，仅保存与 MAIN_IMAGE 或 SHORT_VIDEO MIME 类型匹配的文件，实际媒体入库后任务才置 SUCCEEDED；P0 |
| FR-GC-08 | HTTP/依赖失败应返回错误，不得生成占位成功记录；页面读取资产和文件，支持图片/视频展示与下载；P0 |
| FR-GC-09 | 同一任务内单选素材；文案与视觉任务从相同输入页分流，完成后回到素材选择、审核与交付；后续发布由人工审批流程决定；P0 |
| FR-GC-10 | 三种前端模式（内容生成、商品图、短视频）应共用组件加载商品、工作流和任务；文案支持语言与批量任务卡，视觉支持轮询、预览和文件下载，并提示业务边界；P1 |
| AC-GC-01 | 相同幂等键重复提交不产生第二个生成任务；跨组织商品被拒绝 |
| AC-GC-02 | ComfyUI 无输出或节点报错时任务为失败并记录原因，不得出现「成功但无文件」 |
| AC-GC-03 | 仅 MIME 匹配的真实字节入库；文案送检产生独立检查记录，且不等于自动批准 |
| AC-GC-04 | 运行后端内容任务卡与 ComfyUI 测试、前端相关 E2E，并在目标环境以实际 checkpoint/视频模型与合法工作流完成一次端到端生成 |

## 业务流程

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

## 当前实现差距与未决事项

外包当前仍是SQLite及本地媒体文件方案，目标DDL/API与真实ComfyUI/Milvus等接入尚需后续代码实施。生产角色模型、交付分期、刷新/上限等老师Q-01～12按原问题保留；本文的可配置建议值不等于老师已批准。本次只修改文档，不运行迁移、不改应用代码。
