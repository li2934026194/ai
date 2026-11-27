# CrossPilot 商品内容创作详细设计说明书

版本2.0，2026年11月26日。本文为老师基线下的目标设计；不代表现有代码已经实现或本地数据库已经部署。老师未规定的物理名称、完整接口字段和运行默认值在配套目标契约中作为项目设计明确，不冒充老师批准。

## 范围与技术约束

前端采用Vue 3、TypeScript、Vue Router、Vite/vue-tsc、Axios；接入Nginx，后端Python/FastAPI/Uvicorn/Pydantic；业务数据库PostgreSQL、SQLAlchemy Async ORM、asyncpg。Milvus用于向量，MinIO用于知识原件，Redis/Celery Worker/Beat按需启用，Vanna 2受控问数，ComfyUI执行视觉工作流。M1附件和M7真实媒体字节存PostgreSQL。

完整配套规格：crosspilot-arena/docs/target/target-schema.sql、openapi-target.json、acceptance-cases.json、traceability.json；公共事务/状态/部署规则见 docs/teacher-baseline/TARGET-RULES.md。字段和接口以这些目标文件为准，旧实现的m0_*～m8_*不能自动等同于目标。

## 业务算法与不变量

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

## 公共字段与事务

每表含id UUID、org_id UUID、created_at/updated_at TIMESTAMPTZ、version INTEGER。金额numeric以十进制字符串传输；缺失NULL不补零。外键按组织复合引用；事务内设置RLS组织上下文；更新行锁及版本，成功业务与审计同事务。跨行数量上限、状态机和媒体真实性由服务端在事务中检查。

### workflow_versions

| 字段 | PostgreSQL定义 |
|---|---|
| workflow_code | text NOT NULL |
| workflow_version | text NOT NULL |
| purpose | text NOT NULL |
| status | text NOT NULL |
| api_graph | jsonb |
| node_mapping | jsonb NOT NULL |
| model_versions | jsonb NOT NULL |
| resource_requirements | jsonb NOT NULL |
| compliance_node | text |

约束：purpose IN ('COPYWRITING','MAIN_IMAGE','SHORT_VIDEO'); status IN ('DRAFT','PUBLISHED','RETIRED')。唯一键：org_id,workflow_code,workflow_version。
关联：组织归属或经服务端契约校验的逻辑引用。

### comfy_instances

| 字段 | PostgreSQL定义 |
|---|---|
| endpoint_secret_ref | text NOT NULL |
| gpu_binding | text NOT NULL |
| health | text NOT NULL |
| software_version | text |
| free_vram_mb | integer |
| queue_depth | integer |
| checked_at | timestamptz |

约束：公共版本与组织约束。唯一键：org_id,id。
关联：组织归属或经服务端契约校验的逻辑引用。

### agent_runs

| 字段 | PostgreSQL定义 |
|---|---|
| strategy | text NOT NULL |
| input_snapshot | jsonb NOT NULL |
| result_evidence | jsonb NOT NULL |
| status | text NOT NULL |
| actor_subject | text NOT NULL |

约束：公共版本与组织约束。唯一键：org_id,id。
关联：组织归属或经服务端契约校验的逻辑引用。

### generation_jobs

| 字段 | PostgreSQL定义 |
|---|---|
| product_ref | uuid NOT NULL |
| workflow_id | uuid NOT NULL |
| agent_run_id | uuid |
| purpose | text NOT NULL |
| platform | text NOT NULL |
| language | text NOT NULL |
| status | text NOT NULL |
| idempotency_key | text NOT NULL |
| request_hash | char(64) NOT NULL |
| prompt_id | text |
| instance_id | uuid |
| parameters | jsonb NOT NULL |
| progress | integer NOT NULL DEFAULT 0 |
| error_code | text |
| error_detail | text |

约束：progress BETWEEN 0 AND 100; status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED')。唯一键：org_id,idempotency_key。
关联：workflow_id → workflow_versions; agent_run_id → agent_runs; instance_id → comfy_instances。

### generation_assets

| 字段 | PostgreSQL定义 |
|---|---|
| job_id | uuid NOT NULL |
| slot | text NOT NULL |
| content | jsonb NOT NULL |
| selected | boolean NOT NULL DEFAULT false |
| deleted_at | timestamptz |

约束：公共版本与组织约束。唯一键：org_id,job_id,slot,version。
关联：job_id → generation_jobs。

### generation_media

| 字段 | PostgreSQL定义 |
|---|---|
| asset_id | uuid NOT NULL |
| mime | text NOT NULL |
| file_data | bytea NOT NULL |
| sha256 | char(64) NOT NULL |
| metadata_check | jsonb NOT NULL |

约束：octet_length(file_data) > 0。唯一键：org_id,asset_id。
关联：asset_id → generation_assets。

### compliance_rule_versions

| 字段 | PostgreSQL定义 |
|---|---|
| platform | text NOT NULL |
| category | text NOT NULL |
| rule_version | integer NOT NULL |
| status | text NOT NULL |
| effective_from | timestamptz NOT NULL |
| source_ref | text NOT NULL |
| verified_by | text |
| rules | jsonb NOT NULL |

约束：公共版本与组织约束。唯一键：org_id,platform,category,rule_version。
关联：组织归属或经服务端契约校验的逻辑引用。

### certificates

| 字段 | PostgreSQL定义 |
|---|---|
| product_ref | uuid NOT NULL |
| kind | text NOT NULL |
| expires_on | date NOT NULL |
| evidence_ref | text NOT NULL |
| verified_by | text |

约束：公共版本与组织约束。唯一键：org_id,id。
关联：组织归属或经服务端契约校验的逻辑引用。

### compliance_checks

| 字段 | PostgreSQL定义 |
|---|---|
| job_id | uuid NOT NULL |
| rule_id | uuid NOT NULL |
| asset_versions | jsonb NOT NULL |
| sections | jsonb NOT NULL |
| passed | boolean NOT NULL |
| findings | jsonb NOT NULL |
| checked_by | text NOT NULL |

约束：公共版本与组织约束。唯一键：org_id,id。
关联：job_id → generation_jobs; rule_id → compliance_rule_versions。

### content_approvals

| 字段 | PostgreSQL定义 |
|---|---|
| check_id | uuid NOT NULL |
| last_editor | text NOT NULL |
| reviewed_by | text NOT NULL |
| reason | text NOT NULL |
| active | boolean NOT NULL DEFAULT true |
| asset_versions | jsonb NOT NULL |

约束：last_editor <> reviewed_by。唯一键：org_id,id。
关联：check_id → compliance_checks。

## 接口清单

| 方法和路径 | 输入 | 输出及条款 |
|---|---|---|
| GET /api/v1/orgs/{org_id}/workflows | 无请求体 | workflow_versions_Page；FR-GC-01 |
| POST /api/v1/orgs/{org_id}/workflows | WorkflowCreate | workflow_versions；FR-GC-01 |
| POST /api/v1/orgs/{org_id}/workflows/{id}/publish | Version | workflow_versions；FR-GC-06 |
| POST /api/v1/orgs/{org_id}/generation-jobs | GenerationCreate | generation_jobs；FR-GC-01,FR-GC-03,FR-GC-04,FR-GC-06 |
| GET /api/v1/orgs/{org_id}/generation-jobs | 无请求体 | generation_jobs_Page；FR-GC-10 |
| GET /api/v1/orgs/{org_id}/generation-jobs/{id} | 无请求体 | generation_jobs；FR-GC-08 |
| POST /api/v1/orgs/{org_id}/generation-jobs/{id}/sync | Version | generation_jobs；FR-GC-02,FR-GC-07 |
| POST /api/v1/orgs/{org_id}/generation-jobs/{id}/cancel | Version | generation_jobs；FR-GC-08 |
| POST /api/v1/orgs/{org_id}/generation-jobs/{id}/select | AssetSelection | generation_assets；FR-GC-09 |
| POST /api/v1/orgs/{org_id}/compliance-check | ComplianceCreate | compliance_checks；FR-GC-05 |
| POST /api/v1/orgs/{org_id}/content-approvals | Approval | content_approvals；FR-GC-09 |
| GET /api/v1/orgs/{org_id}/media/{id}/file | 无请求体 | 二进制或NDJSON；FR-GC-02,FR-GC-08 |

## 输入输出字段

### Approval

| 字段 | 类型或约束 | 必填 |
|---|---|---|
| version | {"type": "integer", "minimum": 1} | 是 |
| check_id | {"type": "string", "format": "uuid"} | 是 |
| reason | {"type": "string", "minLength": 1, "maxLength": 1000} | 是 |

### AssetSelection

| 字段 | 类型或约束 | 必填 |
|---|---|---|
| version | {"type": "integer", "minimum": 1} | 是 |
| asset_id | {"type": "string", "format": "uuid"} | 是 |

### ComplianceCreate

| 字段 | 类型或约束 | 必填 |
|---|---|---|
| version | {"type": "integer", "minimum": 1} | 是 |
| asset_id | {"type": "string", "format": "uuid"} | 是 |
| sections | {"type": "array", "items": {"type": "string", "enum": ["title", "bullets", "description", "keywords"]}, "minItems": 1, "uniqueItems": true} | 是 |
| rule_id | {"type": "string", "format": "uuid"} | 是 |

### GenerationCreate

| 字段 | 类型或约束 | 必填 |
|---|---|---|
| product_id | {"type": "string", "format": "uuid"} | 是 |
| workflow_id | {"type": "string", "format": "uuid"} | 是 |
| purpose | {"type": "string", "enum": ["COPYWRITING", "MAIN_IMAGE", "SHORT_VIDEO"]} | 是 |
| platform | {"type": "string", "minLength": 1, "maxLength": 32} | 是 |
| language | {"type": "string", "minLength": 1, "maxLength": 16} | 是 |
| parameters | {"type": "object", "additionalProperties": true, "description": "Versioned domain document; validated by the specific business rules in the design."} | 是 |

### Version

| 字段 | 类型或约束 | 必填 |
|---|---|---|
| version | {"type": "integer", "minimum": 1} | 是 |

### WorkflowCreate

| 字段 | 类型或约束 | 必填 |
|---|---|---|
| code | {"type": "string", "minLength": 1, "maxLength": 64} | 是 |
| workflow_version | {"type": "string", "minLength": 1, "maxLength": 64} | 是 |
| purpose | {"type": "string", "enum": ["COPYWRITING", "MAIN_IMAGE", "SHORT_VIDEO"]} | 是 |
| api_graph | {"type": "object", "additionalProperties": true, "description": "Versioned domain document; validated by the specific business rules in the design."} | 否 |
| node_mapping | {"type": "object", "additionalProperties": true, "description": "Versioned domain document; validated by the specific business rules in the design."} | 是 |
| model_versions | {"type": "object", "additionalProperties": true, "description": "Versioned domain document; validated by the specific business rules in the design."} | 是 |
| resource_requirements | {"type": "object", "additionalProperties": true, "description": "Versioned domain document; validated by the specific business rules in the design."} | 是 |
| compliance_node | {"type": "string", "minLength": 1, "maxLength": 255} | 否 |

## 错误与并发

401身份缺失；403权限/职责分离；404资源不存在；409版本/幂等/事实签名冲突；422参数或业务门槛；503依赖不可用。POST带Idempotency-Key；同键不同体409；更新与审批带version。逐项业务校验、状态流转、bytea入库和历史冻结见公共补充规则。

## 当前实现差距与未决事项

外包当前仍是SQLite及本地媒体文件方案，目标DDL/API与真实ComfyUI/Milvus等接入尚需后续代码实施。生产角色模型、交付分期、刷新/上限等老师Q-01～12按原问题保留；本文的可配置建议值不等于老师已批准。本次只修改文档，不运行迁移、不改应用代码。
