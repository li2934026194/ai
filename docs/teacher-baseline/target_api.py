from pathlib import Path
import json, re
ROOT=Path('D:/ai'); OUT=ROOT/'crosspilot-arena/docs/target'
S={}; P={}
def string(maximum=255): return {'type':'string','minLength':1,'maxLength':maximum}
def enum(*v): return {'type':'string','enum':list(v)}
def ref(n): return {'$ref':'#/components/schemas/'+n}
UUID={'type':'string','format':'uuid'}; DATE={'type':'string','format':'date'}
BOOL={'type':'boolean'}; INT={'type':'integer','minimum':0}; VER={'type':'integer','minimum':1}
DEC={'type':'string','pattern':r'^-?\d+(\.\d+)?$','description':'Decimal string; never binary float for money.'}
JSON={'type':'object','additionalProperties':True,'description':'Versioned domain document; validated by the specific business rules in the design.'}
def obj(fields,optional=()): return {'type':'object','properties':fields,'required':[k for k in fields if k not in optional],'additionalProperties':False}
def schema(n,fields,optional=()): S[n]=obj(fields,optional); return n
def array(t): return {'type':'array','items':t}
schema('Error',{'code':string(),'message':string(2000),'details':JSON},['details'])
schema('ErrorEnvelope',{'ok':{'const':False},'data':{'type':'null'},'error':ref('Error'),'trace_id':string()})
schema('Quality',{'source':string(),'quality_status':enum('ANSWERED','NO_DATA','MIXED_CURRENCY','UNAVAILABLE','SIMULATION'),'data_as_of':{'type':['string','null'],'format':'date-time'},'evidence':array(JSON)})
tables=json.loads((OUT/'table-catalog.json').read_text(encoding='utf-8'))
for t in tables:
    fields={'id':UUID,'org_id':UUID,'version':VER,'created_at':{'type':'string','format':'date-time'},'updated_at':{'type':'string','format':'date-time'}}
    for name,typ in t['fields'].items():
        low=typ.lower(); v= UUID if low.startswith('uuid') else BOOL if low.startswith('boolean') else INT if low.startswith('integer') else DEC if low.startswith('numeric') else JSON if low.startswith('jsonb') else DATE if low=='date' or low.startswith('date ') else {'type':'string','format':'date-time'} if low.startswith('timestamptz') else {'type':'string','contentEncoding':'base64'} if low.startswith('bytea') else string(100000)
        if 'not null' not in low: v={'anyOf':[v,{'type':'null'}]}
        fields[name]=v
    schema(t['name'],fields)
schema('Page',{'items':array(JSON),'next_cursor':{'type':['string','null']}})
schema('JobAccepted',{'job_id':UUID,'status':enum('QUEUED','RUNNING'),'status_url':string()})
schema('LayoutWidget',{'id':string(64),'metric':string(64),'question':string(1000),'chart':enum('number','line','bar','table','pie'),'width':{'type':'integer','minimum':1,'maximum':12},'title':string(120)},['question'])
schema('Layout',{'schema_version':{'const':1},'theme':enum('light','dark'),'widgets':array(ref('LayoutWidget'))})
schema('SaveLayout',{'version':VER,'layout':ref('Layout')})
schema('PublishLayout',{'draft_version':VER})
schema('Compose',{'instruction':string(2000),'device':enum('desktop','tablet','mobile')})
schema('Description',{'widget':ref('LayoutWidget'),'filters':JSON})
schema('Query',{'question':string(4000),'session_id':UUID,'filters':JSON},['session_id','filters'])
schema('QueryResult',{'answer':string(100000),'value':{'anyOf':[DEC,JSON,{'type':'null'}]},'source':string(),'quality_status':enum('ANSWERED','NO_DATA','MIXED_CURRENCY','UNAVAILABLE'),'data_as_of':{'type':['string','null'],'format':'date-time'},'evidence':array(JSON),'session_id':UUID})
schema('Inbound',{'shop_id':UUID,'conversation_id':UUID,'buyer_ref':string(),'client_message_id':string(128),'kind':enum('INQUIRY','COMPLAINT'),'body':string(10000),'language':string(16),'order_hint':string()},['conversation_id','order_hint'])
schema('Reply',{'conversation_id':UUID,'body_zh':string(10000),'body_en':string(10000),'human_confirmed':{'const':True},'client_message_id':string(128)})
schema('Translation',{'text':string(10000),'source_language':string(16),'target_language':string(16)})
schema('TranslationResult',{'original':string(10000),'translated':{'type':['string','null']},'status':enum('TRANSLATED','UNTRANSLATABLE'),'method':string(64),'human_review_required':{'const':True}})
schema('DescriptionResult',{'description':string(10000),'facts':JSON,'method':enum('MODEL','RULE'),'queried_at':{'type':'string','format':'date-time'}})
schema('DashboardView',{'draft':ref('Layout'),'draft_version':VER,'published':{'anyOf':[ref('Layout'),{'type':'null'}]},'published_version':{'type':['integer','null']},'published_at':{'type':['string','null'],'format':'date-time'},'queried_at':{'type':['string','null'],'format':'date-time'},'cards':array(ref('QueryResult'))})
schema('OrderLink',{'conversation_id':UUID,'order_id':UUID,'buyer_confirmed':{'const':True},'evidence_type':string(64),'evidence_ref':string(1000),'fulfillment':enum('FBA','FBM')})
schema('CaseCreate',{'link_id':UUID,'order_item_id':UUID,'case_type':enum('RETURN','REFUND','REPLACEMENT','EXCHANGE_VARIANT'),'qty':DEC,'refund_amount':DEC,'reason':{'type':'string','minLength':5,'maxLength':1000}})
schema('Decision',{'version':VER,'decision':enum('APPROVED','REJECTED'),'reason':string(1000)})
schema('Version',{'version':VER})
schema('ResearchCreate',{'sku':string(64),'platform':string(32),'region':string(32),'title':string(255)})
schema('SourceCreate',{'nature':enum('INTERNAL','PAID_EXTERNAL','OPEN_PUBLIC','MOCK'),'name':string(),'vendor':string(),'purchase_evidence':string()},['vendor','purchase_evidence'])
schema('WeeklyFact',{'source_id':UUID,'week_start':DATE,'currency':{'type':'string','pattern':'^[A-Z]{3}$'},'paid_qty':DEC,'refund_qty':DEC,'gross_revenue':DEC,'discount':DEC,'refund_amount':DEC,'unit_cost':DEC,'unit_freight':DEC,'platform_fee':DEC,'fulfillment_fee':DEC,'return_fee':DEC,'storage_fee':DEC,'advertising_fee':DEC,'source_ref':string()},['refund_qty','discount','refund_amount','unit_cost','unit_freight','platform_fee','fulfillment_fee','return_fee','storage_fee','advertising_fee'])
schema('Ranking',{'mode':enum('BALANCED','REVENUE','GROWTH'),'research_ids':array(UUID)},['research_ids'])
schema('Review',{'version':VER,'decision':enum('APPROVE_TRIAL','REJECT','NEED_DATA'),'reason':string(1000)})
schema('TrialPlan',{'version':VER,'target_revenue':DEC,'target_unit_price':DEC,'budget':DEC,'currency':string(3),'start_date':DATE,'end_date':DATE})
schema('TrialActual',{'version':VER,'actual_revenue':DEC,'actual_qty':DEC,'operating_profit':DEC,'source_ref':string(1000)})
schema('TrialDecision',{'version':VER,'decision':enum('PRODUCE','SUPPLEMENT','DELIST'),'reason':string(1000)})
schema('ProfileSave',{'version':VER,'verified':BOOL,'profile':JSON})
schema('ModelRegister',{'code':string(64),'model_version':string(64),'strategy':string(128),'dependencies':JSON,'min_history_days':VER})
schema('ModelStatus',{'version':VER,'status':enum('ENABLED','DISABLED')})
schema('ForecastCreate',{'product_id':UUID,'shop_id':UUID,'model_id':UUID,'horizon':{'type':'integer','enum':[7,14,30]},'train_end':DATE})
schema('ActualCorrection',{'version':VER,'business_date':DATE,'actual_qty':DEC,'is_stockout':BOOL,'reason':string(1000),'source_ref':string(1000)})
schema('Preview',{'position_id':UUID,'product_id':UUID,'objective':enum('SALES','PROFIT','CASH'),'cost_card_id':UUID,'forecast_run_id':UUID,'route_quotes':array(UUID),'assumptions':JSON,'assumption_evidence':JSON},['forecast_run_id','route_quotes','assumptions','assumption_evidence','cost_card_id'])
schema('PreviewResult',{'planning_mode':enum('STANDARD','INTELLIGENT'),'qty':DEC,'currency':string(3),'amount':DEC,'daily_curve':array(JSON),'constraints':array(string()),'warnings':array(string()),'fact_signature':{'type':'string','pattern':'^[0-9a-f]{64}$'},'history_signature':{'type':['string','null']},'input_versions':JSON})
schema('PlanCreate',{'planning_mode':enum('STANDARD','INTELLIGENT'),'preview_input':ref('Preview'),'fact_signature':{'type':'string','pattern':'^[0-9a-f]{64}$'},'history_signature':{'type':'string','pattern':'^[0-9a-f]{64}$'},'expected_qty':DEC},['history_signature'])
schema('PurchaseEvidence',{'version':VER,'supplier_order_no':string(),'currency':string(3),'amount':DEC,'ordered_qty':DEC,'evidence_ref':string(1000)})
schema('Receipt',{'version':VER,'batch_no':string(),'received_qty':DEC,'defect_qty':DEC,'is_last':BOOL,'evidence_ref':string(1000),'received_at':{'type':'string','format':'date-time'}})
schema('Shipment',{'version':VER,'tracking_no':string(),'carrier':string(),'shipped_at':{'type':'string','format':'date-time'},'evidence_ref':string(1000)})
schema('GenerationCreate',{'product_id':UUID,'workflow_id':UUID,'purpose':enum('COPYWRITING','MAIN_IMAGE','SHORT_VIDEO'),'platform':string(32),'language':string(16),'parameters':JSON})
schema('AssetSelection',{'version':VER,'asset_id':UUID})
schema('ComplianceCreate',{'version':VER,'asset_id':UUID,'sections':{'type':'array','items':enum('title','bullets','description','keywords'),'minItems':1,'uniqueItems':True},'rule_id':UUID})
schema('Approval',{'version':VER,'check_id':UUID,'reason':string(1000)})
schema('WorkflowCreate',{'code':string(64),'workflow_version':string(64),'purpose':enum('COPYWRITING','MAIN_IMAGE','SHORT_VIDEO'),'api_graph':JSON,'node_mapping':JSON,'model_versions':JSON,'resource_requirements':JSON,'compliance_node':string()},['api_graph','compliance_node'])
schema('ShopCreate',{'brand_id':UUID,'platform':string(32),'site':string(32),'external_id':string(),'currency':string(3),'is_mock':BOOL})
schema('ProductCreate',{'sku':string(64),'brand_id':UUID,'title':string(255),'category':string(64),'attributes':JSON,'currency':string(3),'sale_price':DEC,'unit_cost':DEC,'moq':VER,'pack_size':VER,'lead_days':INT},['sale_price','unit_cost','moq','pack_size','lead_days'])
schema('InventorySync',{'source_ref':string(1000),'data_as_of':{'type':'string','format':'date-time'},'complete':BOOL,'positions':array(obj({'product_id':UUID,'shop_id':UUID,'warehouse':string(64),'on_hand':DEC,'in_transit':DEC,'reserved':DEC}))})
schema('MemberCreate',{'subject':string(),'display_name':string(),'roles':array(UUID),'resource_scopes':array(JSON)})
schema('MemberUpdate',{'version':VER,'active':BOOL,'roles':array(UUID),'resource_scopes':array(JSON)},['active','roles','resource_scopes'])
schema('Login',{'username':string(),'password':{'type':'string','minLength':1,'writeOnly':True}})
schema('Token',{'access_token':string(4096),'token_type':{'const':'Bearer'},'expires_in':INT})
S['Layout']['properties']['widgets'].update({'maxItems':24,'description':'Project proposed default, configurable; teacher Q-08 does not fix this value. IDs must be unique in application validation.'})
schema('ComposeResult',{'layout':ref('Layout'),'preview':array(ref('QueryResult'))})
schema('RecommendationResult',{'items':{'type':'array','maxItems':3,'items':obj({'id':UUID,'sku':string(64),'title':string(255),'price':DEC,'currency':string(3),'purpose':string(1000),'url':string(2000),'evidence':array(JSON)})},'quality_status':enum('ANSWERED','NO_DATA','UNAVAILABLE'),'data_as_of':{'type':['string','null'],'format':'date-time'}})

COMMON_ERRORS={'401':'AUTH_REQUIRED','403':'SCOPE_DENIED or SOD_DENIED','404':'RESOURCE_NOT_FOUND','409':'VERSION_CONFLICT, IDEMPOTENCY_CONFLICT or FACT_CHANGED','422':'VALIDATION_FAILED','503':'DEPENDENCY_UNAVAILABLE'}
def op(module,method,path,summary,request=None,response='Page',refs=(),permission=None,code=None,params=(),binary=False):
    full='/api/v1/orgs/{org_id}'+path
    oid=module+'_'+method+'_'+re.sub('[^a-z0-9]+','_',path.lower()).strip('_')
    parameters=[{'name':'org_id','in':'path','required':True,'schema':UUID}]
    for n in re.findall(r'\{([^}]+)\}',path): parameters.append({'name':n,'in':'path','required':True,'schema':UUID})
    for name,typ,required in params: parameters.append({'name':name,'in':'query','required':required,'schema':typ})
    parameters.append({'name':'X-Api-Envelope','in':'header','required':False,'schema':{'const':'1'}})
    if method in ('post','put','patch','delete'):
        parameters.append({'name':'Idempotency-Key','in':'header','required':method=='post','schema':string(128)})
    status=str(code or (202 if response=='JobAccepted' else 201 if method=='post' and path in ['/products','/shops','/selection/research','/generation-jobs','/replenishment/plans'] else 200))
    content={'application/octet-stream':{'schema':{'type':'string','format':'binary'}}} if binary else {'application/x-ndjson':{'schema':{'type':'string','description':'One JSON object per line: status/sql/answer_delta/result/error; trace_id on errors.'}}} if path.endswith('/stream') else {'application/json':{'schema':obj({'ok':{'const':True},'data':ref(response),'error':{'type':'null'},'trace_id':string()})}}
    responses={status:{'description':'Success; target contract, not implementation evidence.','content':content}}
    responses.update({s:{'description':m,'content':{'application/json':{'schema':ref('ErrorEnvelope')}}} for s,m in COMMON_ERRORS.items()})
    body=None
    if request=='upload':
        body={'required':True,'content':{'multipart/form-data':{'schema':obj({'file':{'type':'string','format':'binary'},'source_id':UUID,'overwrite':BOOL},['source_id','overwrite'])}}}
    elif request=='case_multipart':
        body={'required':True,'content':{'application/json':{'schema':ref('CaseCreate')},'multipart/form-data':{'schema':obj({'payload':{'type':'string','description':'JSON-encoded CaseCreate'},'files':{'type':'array','maxItems':10,'items':{'type':'string','format':'binary'}}})}}}
    elif request: body={'required':True,'content':{'application/json':{'schema':ref(request)}}}
    item={'operationId':oid,'tags':[module],'summary':summary,'description':'Server validates current organization/brand/shop/action grants. See target business invariants and source references.','security':[{'BearerAuth':[]}],'parameters':parameters,'responses':responses,'x-permission':permission or module+':'+('read' if method=='get' else 'write'),'x-teacher-refs':list(refs),'x-implementation-status':'TARGET_NOT_IMPLEMENTED'}
    if body: item['requestBody']=body
    P.setdefault(full,{})[method]=item

op('m0','get','/shops','店铺与授权状态',response='Page',refs=['FR-COM-01'])
op('m0','post','/shops','登记店铺；真实授权连接器另验收','ShopCreate','shops',refs=['FR-COM-01'])
op('m0','get','/products','统一商品列表',refs=['FR-FC-01'])
op('m0','post','/products','创建商品事实','ProductCreate','products',refs=['FR-FC-01'])
op('m0','get','/orders','组织店铺订单',params=[('shop_id',UUID,False),('cursor',string(),False),('limit',{'type':'integer','minimum':1,'maximum':200,'default':50},False)])
op('m0','get','/inventory','读取仓位事实',refs=['FR-RP-02'])
op('m0','post','/inventory/sync','独立库存同步唯一写入口','InventorySync','JobAccepted',refs=['FR-RP-10'],permission='inventory:sync')
op('m0','get','/jobs/{id}','异步状态与错误',response='async_jobs')
op('m1','post','/customer-service/recommended-products/import','整表校验并在提交后异步索引','upload','JobAccepted',refs=['FR-CS-06','FR-CS-07','FR-CS-08'])
op('m1','post','/customer-service/recommended-products/{id}/reindex','重新索引','Version','JobAccepted',refs=['FR-CS-08'])
op('m1','get','/customer-service/recommendations','向量召回并回表最多三件',refs=['FR-CS-09','FR-CS-10'],params=[('conversation_id',UUID,True),('query',string(1000),True),('budget',DEC,False)])
op('m1','post','/inbound','模拟入站，提交后广播','Inbound','conversation_messages',refs=['FR-CS-11','FR-CS-12'])
op('m1','get','/customer-service/conversations','会话队列',refs=['FR-CS-15'])
op('m1','get','/customer-service/conversations/{id}/messages','断线回读消息',refs=['FR-CS-14'],params=[('after_id',UUID,False)])
op('m1','get','/customer-service/conversations/{id}/context','会话上下文与最近意图',response='conversations',refs=['FR-CS-15'])
op('m1','post','/customer-service/translate','翻译草稿，失败保留原文','Translation','TranslationResult',refs=['FR-CS-13','FR-CS-18'])
op('m1','post','/replies','人工确认及双语合规发送','Reply','conversation_messages',refs=['FR-CS-17','FR-CS-19'])
op('m1','post','/customer-service-v2/conversations/{id}/analyze','最新消息规则分析','Version','intent_analyses',refs=['FR-CS-20'])
op('m1','post','/customer-service/conversations/{id}/takeover','人工接管','Version','conversations',refs=['FR-CS-21'])
op('m1','get','/customer-service/conversations/{id}/order-candidates','投诉订单候选，不自动核验',refs=['FR-CS-22','FR-CS-23'])
op('m1','post','/order-links','买家确认与本店订单关联','OrderLink','conversation_order_links',refs=['FR-CS-24'])
op('m1','post','/aftersales/cases','创建 JSON 或带附件工单','case_multipart','aftersales_cases',refs=['FR-CS-25','FR-CS-26'])
op('m1','post','/aftersales/cases/{id}/decide','版本行锁审批，外部状态 UNKNOWN','Decision','aftersales_cases',refs=['FR-CS-27'],permission='aftersales:approve')
op('m1','get','/aftersales/attachments/{id}/file','归属复核后下载数据库字节',refs=['FR-CS-26'],binary=True)
op('m2_m3','get','/bi/design','草稿、发布版本及发布卡片',response='DashboardView',refs=['FR-BI-01','FR-BI-05'],params=[('layout_only',BOOL,False)])
op('m2_m3','post','/bi/design/compose','自然语言编排，只返回不保存','Compose','Layout',refs=['FR-BI-02','FR-BI-03'])
op('m2_m3','post','/bi/design/preview','最多四卡只读预览','Layout','Page',refs=['FR-BI-06'])
op('m2_m3','post','/bi/design/describe','核验事实后生成说明','Description','DescriptionResult',refs=['FR-BI-04'])
op('m2_m3','put','/bi/design','版本校验保存草稿','SaveLayout','dashboard_designs',refs=['FR-BI-03','FR-BI-10'])
op('m2_m3','post','/bi/design/publish','复制已保存草稿','PublishLayout','dashboard_designs',refs=['FR-BI-03','FR-BI-07'])
op('m2_m3','get','/bi/dashboard','无发布版旧摘要回退',response='Page',refs=['FR-BI-05'])
op('m2_m3','post','/bi/query','受控只读问数','Query','QueryResult',refs=['FR-QA-01','FR-QA-02','FR-QA-06'])
op('m2_m3','post','/bi/query/stream','NDJSON 流式问数','Query','QueryResult',refs=['FR-QA-07','FR-QA-08'])
op('m2_m3','get','/bi/sessions/{id}','最多二十条会话历史',refs=['FR-QA-09','FR-QA-11'])
op('m2_m3','delete','/bi/sessions/{id}','只删除本用户本组织问数历史',response='Page',refs=['FR-QA-11'])
op('m2_m3','get','/bi/metrics','指标定义和口径版本',refs=['FR-QA-04'])
op('m2_m3','post','/bi/metrics/{id}/sync','按配置同步指标','Version','JobAccepted',refs=['FR-QA-04'])
op('m2_m3','post','/knowledge/documents','原件入 MinIO，Worker 解析与向量索引','upload','JobAccepted',refs=['FR-QA-10'])
op('m4','post','/selection/sources','登记四类来源','SourceCreate','selection_sources',refs=['FR-SEL-02'])
op('m4','get','/selection/sources','来源与采购凭证列表',refs=['FR-SEL-02'])
op('m4','post','/selection/imports','限制文件与组织哈希防重返回202','upload','JobAccepted',refs=['FR-SEL-03','FR-SEL-04','FR-SEL-05'])
op('m4','get','/selection/imports/{id}','导入状态、计数与行错误',response='selection_imports',refs=['FR-SEL-04'])
op('m4','get','/selection/research','研究列表与概览',refs=['FR-SEL-13','FR-SEL-14'])
op('m4','post','/selection/research','建立研究档案','ResearchCreate','selection_research',refs=['FR-SEL-01'])
op('m4','get','/selection/research/{id}','事实和费用完整性',response='selection_research',refs=['FR-SEL-06'])
op('m4','put','/selection/research/{id}/weekly-facts','按来源周写事实','WeeklyFact','selection_weekly_facts',refs=['FR-SEL-05','FR-SEL-06'])
op('m4','post','/selection/analysis','确定性排名及可选解释','Ranking','Page',refs=['FR-SEL-07','FR-SEL-08','FR-SEL-09','FR-SEL-12'])
op('m4','post','/selection/research/{id}/review','内部实际与利润完整门槛','Review','selection_reviews',refs=['FR-SEL-10'])
op('m4','put','/selection/research/{id}/trial-plan','保存测款计划','TrialPlan','selection_trials',refs=['FR-SEL-11'])
op('m4','put','/selection/research/{id}/trial-actual','保存实际及来源','TrialActual','selection_trials',refs=['FR-SEL-11'])
op('m4','post','/selection/research/{id}/trial-preview','只读测款建议','Version','selection_trials',refs=['FR-SEL-11'])
op('m4','post','/selection/research/{id}/trial-decision','人工最终测款决策','TrialDecision','selection_trials',refs=['FR-SEL-11'])
op('m5_m6','get','/forecast/models','注册表与依赖可用性',refs=['FR-FC-02','FR-FC-06'])
op('m5_m6','post','/forecast/models','登记元数据，不自动可执行','ModelRegister','forecast_models',refs=['FR-FC-03'])
op('m5_m6','put','/forecast/models/{id}/status','启停但不绕过适配器','ModelStatus','forecast_models',refs=['FR-FC-03'])
op('m5_m6','get','/forecast/products/{id}/profile','画像与未核验先验',response='demand_profiles',refs=['FR-FC-04'])
op('m5_m6','put','/forecast/products/{id}/profile','行锁版本保存画像','ProfileSave','demand_profiles',refs=['FR-FC-04'])
op('m5_m6','get','/forecast/products/{id}/recommendations','候选理由，不承诺精度',refs=['FR-FC-04'])
op('m5_m6','post','/forecast/runs','线程池执行并冻结预测','ForecastCreate','forecast_runs',refs=['FR-FC-05','FR-FC-06','FR-FC-07'])
op('m5_m6','get','/forecast/runs/{id}','逐日预测和历史误差带',response='forecast_runs',refs=['FR-FC-09','FR-FC-12'])
op('m5_m6','post','/forecast/runs/{id}/collect-actuals','归集已结束日期真实订单','Version','forecast_evaluations',refs=['FR-FC-08','FR-FC-11'])
op('m5_m6','post','/forecast/runs/{id}/actual-corrections','保留原预测订单事实的人工修正','ActualCorrection','forecast_actuals',refs=['FR-FC-08'])
op('m5_m6','get','/forecast/evaluations','按 SKU 平台周期评估',refs=['FR-FC-10'])
op('m5_m6','get','/replenishment/options','仓位、来源、有效成本卡和成功未来预测',refs=['FR-RP-01','FR-RP-02'])
for mode in ['standard','intelligent']:
    op('m5_m6','post',f'/replenishment/{mode}/preview','只读测算；智能缺预测阻断','Preview','PreviewResult',refs=['FR-RP-02','FR-RP-03','FR-RP-04'])
op('m5_m6','get','/replenishment/plans','按 planning_mode 隔离列表',refs=['FR-RP-01'],params=[('planning_mode',enum('STANDARD','INTELLIGENT'),True)])
op('m5_m6','post','/replenishment/plans','重取事实重算并签名校验','PlanCreate','replenishment_plans',refs=['FR-RP-05','FR-RP-06'])
op('m5_m6','get','/replenishment/plans/{id}','计划详情与冻结快照',response='replenishment_plans',refs=['FR-RP-05'])
op('m5_m6','post','/replenishment/plans/{id}/decide','不同提交人的审批人','Decision','replenishment_plans',refs=['FR-RP-08'],permission='replenishment:approve')
op('m5_m6','post','/replenishment/plans/{id}/execution-task','创建内部执行任务','Version','replenishment_plans',refs=['FR-RP-07'])
op('m5_m6','post','/replenishment/plans/{id}/purchase-evidence','登记实际采购凭证，不改库存','PurchaseEvidence','purchase_evidence',refs=['FR-RP-07','FR-RP-10'])
op('m5_m6','post','/replenishment/plans/{id}/receipts','独立批次与超收校验，不改库存','Receipt','receipt_batches',refs=['FR-RP-09','FR-RP-10'])
op('m5_m6','post','/replenishment/plans/{id}/shipment','登记物流凭证，不改库存','Shipment','shipment_evidence',refs=['FR-RP-07','FR-RP-10'])
op('m5_m6','get','/replenishment/plans/{id}/events','事件去重和版本历史',refs=['FR-RP-09'])
op('m5_m6','get','/replenishment/plans/{id}/receipts','逐批质检与数量差异',refs=['FR-RP-09'])
op('m7','get','/workflows','已发布且用途匹配的工作流',refs=['FR-GC-01'])
op('m7','post','/workflows','登记图、模型和资源版本','WorkflowCreate','workflow_versions',refs=['FR-GC-01'])
op('m7','post','/workflows/{id}/publish','校验节点用途并发布版本','Version','workflow_versions',refs=['FR-GC-06'])
op('m7','post','/generation-jobs','幂等查重、事实文案或 ComfyUI 分流','GenerationCreate','generation_jobs',refs=['FR-GC-01','FR-GC-03','FR-GC-04','FR-GC-06'])
op('m7','get','/generation-jobs','任务列表',refs=['FR-GC-10'])
op('m7','get','/generation-jobs/{id}','真实任务状态与错误',response='generation_jobs',refs=['FR-GC-08'])
op('m7','post','/generation-jobs/{id}/sync','history/view 同步并实际媒体入库','Version','generation_jobs',refs=['FR-GC-02','FR-GC-07'])
op('m7','post','/generation-jobs/{id}/cancel','取消等待或执行任务','Version','generation_jobs',refs=['FR-GC-08'])
op('m7','post','/generation-jobs/{id}/select','同任务单选资产','AssetSelection','generation_assets',refs=['FR-GC-09'])
op('m7','post','/compliance-check','指定文案区段正式送检','ComplianceCreate','compliance_checks',refs=['FR-GC-05'])
op('m7','post','/content-approvals','独立人工审批，版本变化失效','Approval','content_approvals',refs=['FR-GC-09'],permission='content:approve')
op('m7','get','/media/{id}/file','读取 PostgreSQL 真实字节',refs=['FR-GC-02','FR-GC-08'],binary=True)
op('m8','get','/members','成员与资源范围',refs=['FR-COM-01'])
op('m8','post','/members','创建成员及组织授权','MemberCreate','members',refs=['FR-COM-01'])
op('m8','patch','/members/{id}','停用调岗与店铺范围','MemberUpdate','members',refs=['NFR-01'])
op('m8','get','/audit-events','按组织资源动作审计',refs=['FR-COM-05'])
spec={'openapi':'3.1.0','info':{'title':'CrossPilot 老师基线目标 API 契约','version':'2.0.0','description':'Proposed target contract. Does not describe current backend implementation. Exact paths/field names/error codes supplement teacher Q-05 as project design choices.'},'servers':[{'url':'http://127.0.0.1:8000'}],'paths':P,'components':{'schemas':S,'securitySchemes':{'BearerAuth':{'type':'http','scheme':'bearer'}}}}
typed_lists={
 '/shops':'shops','/products':'products','/orders':'orders','/inventory':'inventory_positions',
 '/customer-service/conversations':'conversations','/customer-service/conversations/{id}/messages':'conversation_messages',
 '/customer-service/conversations/{id}/order-candidates':'orders','/bi/sessions/{id}':'bi_conversation_turns','/bi/metrics':'dashboard_metrics',
 '/selection/sources':'selection_sources','/selection/research':'selection_research','/forecast/models':'forecast_models',
 '/forecast/evaluations':'forecast_evaluations','/replenishment/plans':'replenishment_plans',
 '/replenishment/plans/{id}/events':'replenishment_events','/replenishment/plans/{id}/receipts':'receipt_batches',
 '/workflows':'workflow_versions','/generation-jobs':'generation_jobs','/members':'members','/audit-events':'audit_events'}
for path,resource in typed_lists.items():
    name=resource+'_Page'
    schema(name,{'items':array(ref(resource)),'next_cursor':{'type':['string','null']}})
    item=P['/api/v1/orgs/{org_id}'+path]['get']
    item['responses']['200']['content']['application/json']['schema']['properties']['data']=ref(name)
    if not any(p['name']=='limit' for p in item['parameters']):
        item['parameters'] += [{'name':'limit','in':'query','schema':{'type':'integer','minimum':1,'maximum':20 if resource=='bi_conversation_turns' else 200,'default':20 if resource=='bi_conversation_turns' else 50}}, {'name':'cursor','in':'query','schema':string()}]
for path,name in [('/customer-service/recommendations','RecommendationResult'),('/bi/design/compose','ComposeResult')]:
    item=P['/api/v1/orgs/{org_id}'+path]['get' if path.endswith('recommendations') else 'post']
    item['responses']['200']['content']['application/json']['schema']['properties']['data']=ref(name)
selection_upload=P['/api/v1/orgs/{org_id}/selection/imports']['post']['requestBody']['content']['multipart/form-data']['schema']
selection_upload['required']=['file','source_id']
selection_upload['properties']['file']['description']='Maximum 25 MiB; XLSX expanded 150 MiB, 50 columns, 50000 data rows. Explicit overwrite required for replacement.'
for t in tables:
    for name,typ in t['fields'].items():
        if typ.lower().startswith('jsonb'):
            shape={'anyOf':[{'type':'object','additionalProperties':True},{'type':'array','items':{}}]}
            if 'not null' not in typ.lower(): shape['anyOf'].append({'type':'null'})
            S[t['name']]['properties'][name]=shape
for name in ['password_hash']:
    S['members']['properties'].pop(name,None)
    S['members']['required']=[x for x in S['members']['required'] if x!=name]
spec['paths']['/api/v1/auth/login']={'post':{'operationId':'auth_login','summary':'真实身份登录；令牌算法/期限属项目配置','security':[],'requestBody':{'required':True,'content':{'application/json':{'schema':ref('Login')}}},'responses':{'200':{'description':'Token','content':{'application/json':{'schema':ref('Token')}}},'401':{'description':'Invalid credentials'}}}}
(OUT/'openapi-target.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf-8')
print('Target paths',len(P),'operations',sum(len(x) for x in P.values()),'schemas',len(S))
