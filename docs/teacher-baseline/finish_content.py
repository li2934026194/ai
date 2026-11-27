from pathlib import Path
import json,re,shutil,ast,html
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
ROOT=Path('D:/ai');BASE=ROOT/'docs/teacher-baseline';TARGET=ROOT/'crosspilot-arena/docs/target'
# Reuse only pure rendering functions; do not execute the module's build actions.
tree=ast.parse((BASE/'consolidate_docs.py').read_text(encoding='utf-8'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['runs','docx']],type_ignores=[]),'docx_helpers','exec'))
manifest=json.loads((BASE/'render-manifest.json').read_text(encoding='utf-8'))
import hashlib
plans={
'需求分析文档_V2_对齐SRS与V6数据流':'''# CrossPilot 全平台需求分析

本项目按老师三份文档设计七个Agent与公共底座。T11为V1.1架构与讲解，TS为V1.0 SRS，TA为早期需求分析；早期蓝图与后续明确边界分别记录，不把任何图示当作已部署证明。

## 技术和数据

Vue 3、TypeScript、Vue Router、Vite/vue-tsc、Axios；Nginx与Python/FastAPI/Uvicorn/Pydantic；PostgreSQL/SQLAlchemy Async ORM/asyncpg。Redis/Celery Worker/Beat按需异步；Milvus向量；MinIO知识原件；独立受控Vanna 2；ComfyUI视觉任务。媒体字节和售后附件存PostgreSQL，知识文件存MinIO；SQLite和本地目录只反映现有演示实现。

## 七个Agent

M1以推荐目录、Milvus回表、双语人工回复、订单核验和内部售后审批形成会话上下文；外部工单状态UNKNOWN，WS断线3秒HTTP回读。

M2是驾驶舱设计器：自然语言/拖拽、预览、草稿/发布双版本、四卡并发独立会话，版式快照与实时事实分离。广告页和固定财务看板不能替代设计器。

M3是受控只读问数：同步指标点、确定性快照库存、P2受限训练SQL；返回证据/口径/截止时间/质量，NDJSON与JSON双传输，记忆8/20/50条及30天清理。

M4是四类来源、异步文件导入、周事实、完整费用利润、至少四周趋势、人工评审和测款决策；外购/公开不能独立支持实际利润和测款批准。

M5以真实订单日销量、版本画像、可执行模型、7/14/30天冻结预测、逐日实际回填和WAPE/Bias/MAE评估闭环；历史误差带不是P80保证。

M6普通/智能并列；智能必须读取已保存成功未来预测。只读预览后签名重算提交，计划依READY_FOR_REVIEW至SHIPPED推进，多批收货独立记录；所有补货审批和凭证登记不增减库存。

M7文案由商品事实确定性策略生成五组；图片/视频以ComfyUI prompt/history/view获取真实MIME字节入库后才成功；单选资产、独立送检和人工审批，不自动发布。

## 权限和交付

老师规定业务职责与隔离要求，未强制固定六岗或九岗。真实身份与当前组织/品牌/店铺/动作授权必须在服务端校验；生产不能信任演示Header；敏感审批禁止自批。

目标表结构、接口、测试和条款追溯分别见target-schema.sql、openapi-target.json、acceptance-cases.json、traceability.json。目标设计与当前代码有差距，实施时按TARGET-RULES.md迁移和验收；此次不改代码或数据库。Q-01至Q-12保留老师未决问题，不伪造评审通过。
''',
'srs-deviation-analysis':'''# CrossPilot 老师基线偏差与修订说明

本次修订按老师原件核对当前外包文档，消除目标方案与现有演示实现混写的问题。旧pilot记录仅是旧项目历史，不是外包项目部署证据。

## 已纠正的偏差

| 原稿问题 | 修订要求 |
|---|---|
| 将SQLite写成正式主库 | PostgreSQL与asyncpg为目标，SQLite只记当前开发状态 |
| 将M7媒体仅存本地storage_key | GenerationMedia.file_data存真实字节，知识原件才用MinIO |
| 云端API/Pillow/FFmpeg替代视觉主链 | ComfyUI真实工作流取回MIME匹配文件后才成功 |
| 三组云端草稿替代老师文案策略 | 商品事实确定性策略五组草稿，保存AgentRun证据 |
| 固定财务页面替代M2设计器 | 草稿发布双版本、只读预览、四卡并发、实时事实 |
| 单候选打分替代M4研究 | 来源/导入任务/周事实/完整费用/测款闭环 |
| 补货审批或收货直接改库存 | 仅登记计划与凭证，库存由独立同步更新 |
| 强制沿用pilot六岗或固定九岗 | 角色为项目映射，老师Q-01待确认，权限范围不削弱 |

## 修订结果与验证边界

模块需求、概要、详细设计和测试用例已经按统一目标重编；原稿中的冲突段落不再保留为有效设计。目标DDL和OpenAPI可机器校验，测试用例逐条给前置/操作/预期/取证。机器校验只说明文档规格格式和语法，不证明服务运行通过。

当前应用仍使用现有SQLite和文件方案。完整代码改造、主库迁移、真实平台授权和GPU模型依赖验收属于后续任务。本轮只处理文档与图示，旧测试通过数不改成新需求通过数。
''',
'业务与数据通俗说明_123步骤':'''# CrossPilot 业务与数据操作说明

本说明描述老师基线下的目标业务，适用于理解七个Agent与公共底座的关系，不作为现有部署完成证明。

## 公共底座

1. 先验证真实身份，按组织/品牌/店铺/动作授权，关键操作留人和理由。
2. 把商品、渠道映射、订单明细、汇率和独立同步的库存存入PostgreSQL，保留来源、时间和版本。
3. 向各Agent提供授权范围内的事实；M6凭证登记不直接改库存。

## M1 客服

1. 推荐商品完整校验入库后，每20件一批写Milvus；召回再回本店事实核验。
2. 买家消息防重入库，WS通知、断线3秒回读；中英草稿需人工确认并检查链接数字承诺。
3. 投诉先核验订单再建工单，附件字节存PostgreSQL；主管内部审批不等于外部退款。

## M2 驾驶舱

1. 自然语言或拖拽编排，预览只读。
2. 保存草稿后人工发布，草稿编辑不改变已发布布局。
3. 大屏读取稳定布局，最多四卡并发重新问数，一卡失败不影响其它卡。

## M3 问数

1. 解析指标、时间、平台与追问上下文，拒绝写入指令。
2. 读取同步指标点或确定性快照，必要时走受限Vanna训练SQL，跨币种不相加。
3. 返回数字、口径、证据和截止时间；只删除问数对话，不删除订单事实。

## M4 选品

1. 登记内部/外购/公开/演示来源，文件上传后202异步校验为周事实。
2. 完整费用才算经营利润，至少四周才算趋势；外购和演示不能伪装实盘。
3. 人工批准测款，记录计划与实际，最后选择投产/补充/下架。

## M5 预测

1. 用真实订单归集日销量，排除未结束当日；检查模型依赖和画像版本。
2. 生成并冻结7/14/30天预测和回测，不预先承诺准确度。
3. 到期回填真实销量计算WAPE/Bias/MAE，人工修正保留原预测和原事实。

## M6 补货

1. 普通/智能只读预览；智能缺已保存未来预测就停止，不能现场补造。
2. 提交前后台重取事实，核对签名和数量，由不同于提交人的审批人决定。
3. 依状态登记采购、独立批次质检和物流凭证；库存只等底座独立同步。

## M7 内容

1. 基于商品事实出五组文案；图和视频走已发布ComfyUI工作流。
2. 轮询历史并下载真实文件，MIME匹配且字节入PostgreSQL后才成功。
3. 单选资产并独立送检，最终人工审批；生成成功不等于自动审核或发布。
'''}
for stem,text in plans.items():
    md=ROOT/f'crosspilot-arena/docs/plans/{stem}.md';md.write_text(text,encoding='utf-8')
    first=ROOT/f'crosspilot-arena/docs/plans/{stem}.docx';docx(md,first)
    other=ROOT/f'docx-all/docs/plans/{stem}.docx';shutil.copyfile(first,other)
    for dest in [first,other]:manifest.append({'docx':dest.relative_to(ROOT).as_posix(),'markdown':md.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
(BASE/'render-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

# Replace the M7 diagram sources and their SVG publications with matching target content.
seq={
'sequence-m7-copy':[('UI','API','POST generation-jobs COPYWRITING 幂等请求'),('API','Facts','校验组织商品与工作流'),('API','Strategy','商品事实确定性生成五组草稿'),('Strategy','DB','保存AgentRun任务与JSON资产'),('UI','API','单选方案并对指定区段送检'),('API','DB','独立ComplianceCheck，后续人工审批')],
'sequence-m7-image':[('UI','API','创建MAIN_IMAGE任务并锁工作流版本'),('API','ComfyUI','prompt提交并保存prompt_id'),('UI','API','sync轮询'),('API','ComfyUI','history无历史保持运行，错误则失败'),('API','ComfyUI','view下载真实图片并验证MIME及元数据'),('API','DB','事务保存bytea媒体及资产后才SUCCEEDED')],
'sequence-m7-video-aplus':[('UI','API','创建SHORT_VIDEO任务'),('API','ComfyUI','提交已发布SVD工作流及模型版本'),('UI','API','sync轮询真实进度'),('API','ComfyUI','history及view回收真实视频'),('API','DB','MIME匹配且非空视频字节入file_data'),('API','UI','成功可播放下载；不是自动视觉合规或发布')],
'sequence-m7-compliance-export':[('UI','API','指定资产版本与区段送检'),('API','DB','读取规则版本与选中素材'),('API','DB','保存独立ComplianceCheck'),('Approver','API','真实权限版本理由审批，禁止自批'),('API','DB','保存审批与资产版本快照'),('API','UI','仅返回审批结果；版本变更旧审批失效')]
}
def svg_steps(stem,steps):
    title=stem.replace('sequence-m7-','M7 ')
    ss=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="850" viewBox="0 0 1600 850"><rect width="1600" height="850" fill="white"/>',f'<text x="50" y="60" font-family="Microsoft YaHei" font-size="32">{html.escape(title)} 目标时序</text>']
    for i,(a,b,msg) in enumerate(steps):
        y=110+i*100
        ss += [f'<rect x="50" y="{y}" width="1500" height="78" rx="10" fill="#eef5fb" stroke="#50718e"/>',f'<text x="75" y="{y+47}" font-family="Microsoft YaHei" font-size="26">{i+1}. {html.escape(a)} → {html.escape(b)}：{html.escape(msg)}</text>']
    ss.append('<text x="50" y="800" font-family="Microsoft YaHei" font-size="24">PostgreSQL为事实来源；图示不代表现有代码已实现</text></svg>')
    (ROOT/f'attachments/{stem}.svg').write_text('\n'.join(ss),encoding='utf-8')
for stem,steps in seq.items():
    m=['sequenceDiagram']+[f'    {a}->>{b}: {msg}' for a,b,msg in steps]
    (ROOT/f'attachments/{stem}.mmd').write_text('\n'.join(m)+'\n',encoding='utf-8');svg_steps(stem,steps)
for stem in ['class-m7-domain','class-m7-service','usecase-m7-content']:
    # These are deliberately republished as target dependency views, not fake UML.
    content='flowchart LR\n    Product[商品事实契约] --> Job[版本锁定GenerationJob]\n    Workflow[已发布ComfyUI或文案工作流] --> Job\n    Job --> Asset[GenerationAsset JSON及选中态]\n    Asset --> Media[GenerationMedia file_data bytea]\n    Asset --> Check[独立ComplianceCheck]\n    Check --> Approval[真实身份人工审批]\n'
    (ROOT/f'attachments/{stem}.mmd').write_text(content,encoding='utf-8')
    shutil.copyfile(TARGET/'figures/m7.svg',ROOT/f'attachments/{stem}.svg')
print('Plans and all target Word copies',len(manifest))
