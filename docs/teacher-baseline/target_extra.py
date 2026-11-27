from pathlib import Path
import json,re
ROOT=Path('D:/ai'); SRC=ROOT/'docs/teacher-baseline'; OUT=ROOT/'crosspilot-arena/docs/target'
cases=json.loads((OUT/'acceptance-cases.json').read_text(encoding='utf-8'))
clauses=json.loads((SRC/'source-clauses.json').read_text(encoding='utf-8'))
NFR=[
('A/B组织各一资源、伪造主管头、停用用户','使用真实令牌、错误组织、无令牌Header逐项请求','无身份401；越权403；停用/调岗依服务端当前权限；演示头不作为生产证据'),
('包含营销/外链/超范围主动触达的客服草稿','尝试发送及白名单自动回复','违规则拒绝；默认人工确认；未批准白名单不能自动发送；平台政策适用性另核实'),
('MOCK/外购/公开/内部及缺失费用样本','查看研究、看板和预测报告','性质与NULL显式，生成说明不引入无证据数值'),
('断WS和不同平台接入样本','发送后观察轮询及适配器延迟指标','3秒回读兜底；外部首响指标仅记录实测，未获接口权限标阻塞'),
('8卡、CPU预测、延迟选品解析器','并发渲染/执行预测/上传导入','卡并发≤4且会话独立，预测线程池，导入立即202后后台状态推进'),
('25MB边界文件、超限解压/列/行/附件/查询','逐项执行导入、创建工单和推荐','25MB、150MB解压、50列/50000行、10件/单5MB、1000字符、20件索引批次均按边界校验'),
('单卡失败、无发布版、模型断连、外部连接器中断','逐项读取及重试','单卡隔离、旧布局/结果保留、规则回退或不可用、中断告警和手动入口'),
('推荐、问数、预测、补货、附件完整链路','按trace_id和资源ID追踪','来源/口径/版本/截止日/审批理由/事实签名/附件归属可查'),
('同version两并发审批、同幂等重放、预览后事实变更','并发执行并对比前后记录','同版本一成功，重复不增记录，过期事实拒绝；通知仅在提交后'),
('桌面1920、平板1024、手机390宽度','拖拽、预览、保存发布','布局可读无裁切，图表与表格内部滚动，三个设备预览结果符合布局约束'),
('各模块独立测试组织及实际后端','执行后端单测和前端E2E，检查报告证据','真实请求响应与数据库证明结果；桩数据只验证机制不证明业务收益'),
('目标主机模型依赖/ComfyUI模型与合法图','执行预测及真实图片视频端到端','依赖可执行性可证；无模型明示阻塞，不用云端/Pillow替代ComfyUI通过')]
for i,(setup,steps,expected) in enumerate(NFR,1):
    c=next(r for r in clauses if r[0]==f'NFR-{i:02}')
    cases.append(dict(id='TC-'+c[0],source=c[0],requirement=c[2],priority=c[3],source_location=c[4],setup=setup,steps=steps,expected=expected,evidence='请求/响应、页面截图、任务时序及数据库快照；性能项附硬件/数据量/并发/统计窗口',status='NOT_RUN',test_type='目标非功能验收用例'))

# Earlier PRD clauses are retained and traced as separate requirements, not
# silently discarded by the later SRS.
ta=(Path('C:/Users/Windows/Desktop')/'CrossPilot-需求分析(1).md').read_text(encoding='utf-8-sig')
early=[]
for line in ta.splitlines():
    cells=[s.strip() for s in line.strip().strip('|').split('|')]
    if cells and re.fullmatch('FR-\d\d',cells[0]) and len(cells)>=4:
        early.append({'id':'TA-'+cells[0],'priority':cells[1],'requirement':cells[2],'acceptance':cells[3]})
special={
 'FR-01':('隔离Amazon授权账号，授权范围可读取','完成OAuth、令牌到期与重新授权','可读取获批资源；失效暂停采集并提醒，不声称买家消息可由SP-API读取'),
 'FR-02':('Shopee开发者权限及敏感数据审批记录','检查白名单、材料有效期，未批字段尝试采集','无权限字段不采集；权限与失败原因记录'),
 'FR-03':('TikTok隔离授权账号','OAuth后采集、过期后请求续期','状态与授权范围可追溯，无权限标阻塞'),
 'FR-04':('多组织品牌店铺站点真实/模拟订单','按组织/品牌/店铺/站点/日期筛经营看板','GMV订单广告库存可溯源，币种/口径/新鲜度可见，模拟不冒充实盘'),
 'FR-05':('预设销量/ACOS/库存/评分阈值并造越阈值样本','运行异常检测','告警含阈值/时间窗/源，归因标建议而非事实'),
 'FR-06':('已核验日报周报事实及模型断连','生成并人工编辑报告，重试失败','关键数字可回溯事实，失败可重试，不把模型文字当数字来源'),
 'FR-07':('合法公开竞品来源及采样范围','展示增速/价格带/评分/评论变化','来源/采样时间/覆盖可见；缺源明确未知'),
 'FR-08':('各项评分与成本依据、高合规风险样本','切权重并验证总和；评审高风险高总分商品','权重可配置且总和1，分项解释；高风险不能由高分抵消'),
 'FR-12':('同商品两站点和版本化规则','切站点类目运行合规','规则/依据/版本/生效日期对应，未核实政策不提升强制规则'),
 'FR-13':('标题/描述敏感词和违规图片视频已知样本','扫描并人工复核','命中定位并留复核记录，未启用视觉审核不宣称通过'),
 'FR-14':('昨天到期、今天到期、未来资质三例','运行有效期检查和到期提醒','过期阻断；阈值依据配置；责任人与依据记录'),
 'FR-15':('TikTok保证金已授权数据源或无源','更新保证金及违规风险页','来源/更新时间可见；金额非写死，无源不伪造余额'),
 'FR-20':('组织A品牌X店铺Y，用户仅Y读取权','查询X另一店及其它组织','资源范围拒绝且审计；权限变更按服务端即时生效'),
 'FR-21':('一个主SKU两渠道映射及重复外部ID','创建映射、更新版本、制造冲突','一SKU多平台可映射；重复冲突拒绝，版本留存'),
 'FR-22':('独立库存同步及过期/冲突外部库存','同步并对比本地版本','来源/截止时间/冲突可见，失败不静默覆盖，M6不写仓位'),
 'FR-23':('两ComfyUI实例其中一不可用','运行健康检测并分发任务','实例版本/GPU绑定可见，不可用实例不接新任务'),
 'FR-24':('工作流v1执行中、准备v2','发布v2再回滚或下线','执行任务仍锁v1；节点/模型/资源与发布历史可查'),
 'FR-25':('有幂等键的等待与执行视觉任务','提交两次、查询、取消并回收输出','重复不新建，取消有明确状态，不回收假文件'),
 'FR-26':('两GPU容量不同、队列优先级P0/P3','同时提交高低优先级任务且资源不足','按容量/负载调度；资源不足排队；优先级和需求优先级分别存'),
 'FR-27':('10个SKU其中2个失败','批量生成并回写','每SKU状态可查，8个成功不因其它失败丢失'),
 'FR-28':('电商场景/精修/多角度/视频/A+模板','复制为组织工作流并编辑','用途/输入/版本保留，原模板不被改写'),
 'FR-29':('视觉和文案成功/失败任务','按任务追溯执行链','工作流JSON/模型节点版本/种子/提示词/操作者/时间/结果完整'),
 'FR-30':('AI人物图片保存后转码裁剪剥离标签','检查最终文件、修复后再检查','所需双标记分别读回；缺失拒绝交付/发布，不能把一种标记当两种'),
 'FR-31':('ComfyUI实例监控采集可用及中断','读取显存/利用率/队列趋势并模拟异常','按实例可见并告警；监控异常不改真实任务状态'),
 'FR-32':('GPU执行失败、备用节点可用及重试耗尽','按策略重试与降级','重试有上限/原因，切换与规格变化用户可知；无真实输出不成功')}
cross={'FR-09':'GC-04','FR-10':'GC-07','FR-11':'GC-07','FR-16':'CS-19','FR-17':'CS-21','FR-18':'FC-07','FR-19':'FC-08'}
for e in early:
    key=e['id'][3:]
    if key in special: setup,steps,expected=special[key]
    else:
        c=next(x for x in cases if x['source']=='FR-'+cross[key]); setup,steps,expected=c['setup'],c['steps'],c['expected']
    cases.append(dict(id='TC-'+e['id'],source=e['id'],requirement=e['requirement'],priority=e['priority'],source_location='TA §3',setup=setup,steps=steps,expected=expected,evidence='授权/来源证明、请求响应、数据库与工作流证据；政策与性能另作目标环境核验',status='NOT_RUN',test_type='早期PRD补充验收，交付分期与后续SRS边界一并注明'))

# Supplemental business invariants attach to concrete suites, not a second
# invented requirement namespace.
GROUP={'COM':'COM','CS':'CS','BI':'BI','QA':'QA','SEL':'SEL','FC':'FC','RP':'RP','GC':'GC'}
links=[]
for r in clauses:
    ident=r[0]
    if ident.startswith(('FR-','NFR-')):
        ids=['TC-'+ident]
    elif ident.startswith('Q-'): ids=[]
    else:
        parts=ident.split('-'); group=parts[1] if len(parts)==3 else 'COM'
        ids=[c['id'] for c in cases if c['source'].startswith('FR-'+GROUP.get(group,'COM')+'-')]
    links.append({'source':ident,'source_text':r[1:],'tests':ids,'disposition':'老师未决问题保留；项目字段/接口补充设计不冒充老师批准' if ident.startswith('Q-') else '对应功能/非功能用例组联合验证；不声称执行通过'})
links += [dict(source=e['id'],source_text=e,tests=['TC-'+e['id']],disposition='早期PRD补充范围，真实平台权限与GPU验收条件单独记录') for e in early]
(OUT/'acceptance-cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'traceability.json').write_text(json.dumps(links,ensure_ascii=False,indent=2),encoding='utf-8')
print('cases',len(cases),'source clauses',len(links),'unresolved questions',sum(not r['tests'] for r in links))
