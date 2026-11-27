from pathlib import Path
import re,json,hashlib,shutil,html
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image,ImageDraw,ImageFont

ROOT=Path('D:/ai'); BASE=ROOT/'docs/teacher-baseline'; TARGET=ROOT/'crosspilot-arena/docs/target'
clauses=json.loads((BASE/'source-clauses.json').read_text(encoding='utf-8'))
cases=json.loads((TARGET/'acceptance-cases.json').read_text(encoding='utf-8'))
tables=json.loads((TARGET/'table-catalog.json').read_text(encoding='utf-8'))
api=json.loads((TARGET/'openapi-target.json').read_text(encoding='utf-8'))
old_changes=json.loads((BASE/'changes.json').read_text(encoding='utf-8'))
GROUPS={'m0':['COM'],'m1':['CS'],'m2_m3':['BI','QA'],'m4':['SEL'],'m5_m6':['FC','RP'],'m7':['GC'],'m8':['COM']}
NAMES={'m0':'店铺商品订单与库存底座','m1':'智能客服','m2_m3':'驾驶舱设计与智能问数','m4':'选品分析','m5_m6':'销量预测与补货预测','m7':'商品内容创作','m8':'组织权限与公共技术底座'}
KINDS={'01_requirements.md':'需求说明书','02_hld.md':'概要设计说明书','03_lld.md':'详细设计说明书','04_test_cases.md':'测试用例'}
manifest=[]
def write(p,t):
    p.parent.mkdir(parents=True,exist_ok=True); p.write_text(t.strip()+'\n',encoding='utf-8'); return p
def safe(s): return str(s).replace('|','∣').replace('\n',' ')
def clause_body(r):
    if r[0]=='BR-FC-01':return 'WAPE = Σ∣实际销量−预测销量∣ ÷ Σ实际销量 × 100%；越低越好。示例绝对误差50、实际总销量600，WAPE=8.33%。'
    return '；'.join(r[1:-1] if len(r)>2 and r[0].startswith(('FR-','NFR-','BR-COM-')) else r[1:])
def mdtable(headers,rows):
    return '\n'.join(['| '+' | '.join(headers)+' |','|'+'|'.join('---' for _ in headers)+'|']+['| '+' | '.join(safe(c) for c in r)+' |' for r in rows])+'\n'
def relevant(key): return [r for r in clauses if any(r[0].startswith(p+'-'+g+'-') for p in ['FR','BR','AC'] for g in GROUPS[key]) or (key=='m8' and r[0].startswith('NFR-'))]
def selected_cases(key): return [c for c in cases if any(c['source'].startswith('FR-'+g+'-') for g in GROUPS[key]) or (key=='m8' and c['source'].startswith('NFR-')) or (key=='m7' and c['source'].startswith('TA-FR-') and int(c['source'][-2:])>=23)]
def ops(key): return [(path,m,o) for path,ms in api['paths'].items() for m,o in ms.items() if key in o.get('tags',[])]
def summary(key):
    p=ROOT/('CrossPilot-M7概要设计说明书.md' if key=='m7' else f'crosspilot-arena/docs/modules/{key}/02_hld.md')
    text=p.read_text(encoding='utf-8')
    if '## 原实施稿' in text:
        text=text.split('## 原实施稿')[0]
        start=text.find('### ')
        text=text[start:] if start>=0 else ''
        text=text.split('### 分层与责任')[0]
    else:
        # On rerun use the previously stored business notes, not generated appendices.
        saved=BASE/'module-business-notes.json'
        return json.loads(saved.read_text(encoding='utf-8'))[key]
    text=re.sub(r'\n### (验收证据|验收|目标接口与验收)\n.*?(?=\n### |\Z)','\n',text,flags=re.S)
    return text.strip()
notes={key:summary(key) for key in GROUPS}
(BASE/'module-business-notes.json').write_text(json.dumps(notes,ensure_ascii=False,indent=2),encoding='utf-8')

FLOW={
'm0':['平台授权与原始来源','校验组织店铺与去重','订单商品标准化及独立库存同步','PostgreSQL事实与截止时间','库存写入仅由独立同步负责','MinIO原件和Milvus向量按需关联'],
'm1':['买家消息与推荐目录','组织店铺核验及规则意图','Milvus召回后回表核验','人工双语回复与内部售后审批','附件字节存PostgreSQL','外部状态UNKNOWN；WS断线HTTP回读'],
'm2_m3':['自然语言或拖拽布局','预览后保存草稿与发布快照','最多四卡并发受控问数','稳定布局与当前事实数值','PostgreSQL存布局指标和对话','Vanna只学查询方式；写意图拒绝'],
'm4':['登记四类来源并上传','202异步校验与周事实','完整费用利润及四周趋势','人工评审与测款最终决策','PostgreSQL研究周事实测款','未知费用NULL；外购不能独立支持批准'],
'm5_m6':['真实订单与版本需求画像','可执行模型预测并冻结运行','普通或智能只读补货预览','签名重算后审批及凭证履约','PostgreSQL预测评估计划及收货批次','补货全程不改库存；智能缺预测阻断'],
'm7':['商品事实与已发布工作流','确定性文案或ComfyUI视觉分流','history及view取回真实文件','单选资产送检与人工审批','图片视频字节存PostgreSQL','无真实文件不成功；生成不等于发布'],
'm8':['真实身份与当前资源授权','组织品牌店铺动作校验','业务事务和独立拒绝审计','版本幂等与可追溯结果','PostgreSQL为业务最终事实','Redis任务；MinIO知识原件；Milvus向量']}
figdir=TARGET/'figures'; figdir.mkdir(exist_ok=True)
fontpath='C:/Windows/Fonts/msyh.ttc'
def figure(key,filename=None):
    name=filename or key; w,h=1800,850
    im=Image.new('RGB',(w,h),'white'); d=ImageDraw.Draw(im)
    font=ImageFont.truetype(fontpath,30); title=ImageFont.truetype(fontpath,44)
    d.text((55,35),NAMES[key]+' 目标流程与数据边界',font=title,fill='#142b42')
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="100%" height="100%" fill="white"/>',f'<text x="55" y="78" font-family="Microsoft YaHei" font-size="44">{html.escape(NAMES[key])} 目标流程与数据边界</text>']
    coords=[(55+i*435,180,400,270) for i in range(4)]+[(55,535,835,190),(925,535,835,190)]
    for i,(label,(x,y,bw,bh)) in enumerate(zip(FLOW[key],coords)):
        color='#eef5fb' if i<4 else '#f1f7f1'
        d.rounded_rectangle((x,y,x+bw,y+bh),radius=14,fill=color,outline='#50718e',width=2)
        svg.append(f'<rect x="{x}" y="{y}" width="{bw}" height="{bh}" rx="14" fill="{color}" stroke="#50718e"/>')
        lines=[]; line=''
        for ch in label:
            if d.textlength(line+ch,font=font)>bw-55: lines.append(line); line=ch
            else: line+=ch
        if line: lines.append(line)
        assert len(lines)*48<bh-30
        for j,line in enumerate(lines):
            yy=y+35+j*48
            d.text((x+23,yy),line,font=font,fill='#172b3c')
            svg.append(f'<text x="{x+23}" y="{yy+32}" font-family="Microsoft YaHei" font-size="30">{html.escape(line)}</text>')
        if i<3:
            xx=x+bw; yy=y+bh//2
            d.line((xx+3,yy,xx+30,yy),fill='#3f607b',width=4); d.polygon([(xx+30,yy),(xx+20,yy-8),(xx+20,yy+8)],fill='#3f607b')
            svg.append(f'<path d="M{xx+3} {yy} H{xx+30} l-10 -8 m10 8 l-10 8" fill="none" stroke="#3f607b" stroke-width="4"/>')
    foot='目标设计 2026-11-26  ·  图示不代表代码已实现或服务已部署'
    d.text((55,780),foot,font=font,fill='#536675'); svg.append(f'<text x="55" y="813" font-family="Microsoft YaHei" font-size="30" fill="#536675">{foot}</text></svg>')
    im.save(figdir/(name+'.png')); (figdir/(name+'.svg')).write_text('\n'.join(svg),encoding='utf-8')
    return figdir/(name+'.png')
for key in GROUPS: figure(key)

intro='版本2.0，2026年11月26日。本文为老师基线下的目标设计；不代表现有代码已经实现或本地数据库已经部署。老师未规定的物理名称、完整接口字段和运行默认值在配套目标契约中作为项目设计明确，不冒充老师批准。'
stack='前端采用Vue 3、TypeScript、Vue Router、Vite/vue-tsc、Axios；接入Nginx，后端Python/FastAPI/Uvicorn/Pydantic；业务数据库PostgreSQL、SQLAlchemy Async ORM、asyncpg。Milvus用于向量，MinIO用于知识原件，Redis/Celery Worker/Beat按需启用，Vanna 2受控问数，ComfyUI执行视觉工作流。M1附件和M7真实媒体字节存PostgreSQL。'
links='完整配套规格：crosspilot-arena/docs/target/target-schema.sql、openapi-target.json、acceptance-cases.json、traceability.json；公共事务/状态/部署规则见 docs/teacher-baseline/TARGET-RULES.md。字段和接口以这些目标文件为准，旧实现的m0_*～m8_*不能自动等同于目标。'
def module_doc(key,kind):
    rr=relevant(key); own=[t for t in tables if t['module']==key]
    out=[f'# CrossPilot {NAMES[key]}{kind}','',intro,'','## 范围与技术约束','',stack,'',links,'']
    if kind=='需求说明书':
        out+=['## 老师需求与业务约束','',mdtable(['条款','要求'],[(r[0],clause_body(r)) for r in rr]),'## 业务流程','',notes[key], '']
    elif kind=='概要设计说明书':
        out+=['## 分层与数据流','',f'![目标流程]({(figdir/(key+".png")).as_posix()})','','Vue页面经统一orgApi到组织/资源鉴权、领域服务与数据访问层。确定性计算在服务端；可选模型只解释或给文案。数据库提交后发布事件；WS/缓存/向量不替代业务事实。','',notes[key],'','## 持久化实体与责任','',mdtable(['目标表','字段数量','组织关联'],[(t['name'],len(t['fields'])+5,'org_id复合外键、版本、RLS') for t in own]),'## 来源追溯','',', '.join(r[0] for r in rr),'','## 失效与恢复','', '外部依赖失败保存错误和旧成果；后台任务有幂等、租约和重试，数据库为最终事实。SQLite/Pillow/本地文件的演示结果不能替代PostgreSQL/ComfyUI验收。备份恢复与迁移次序按公共规则执行。','']
    elif kind=='详细设计说明书':
        out+=['## 业务算法与不变量','',notes[key],'','## 公共字段与事务','', '每表含id UUID、org_id UUID、created_at/updated_at TIMESTAMPTZ、version INTEGER。金额numeric以十进制字符串传输；缺失NULL不补零。外键按组织复合引用；事务内设置RLS组织上下文；更新行锁及版本，成功业务与审计同事务。跨行数量上限、状态机和媒体真实性由服务端在事务中检查。','']
        for t in own:
            out += ['### '+t['name'],'',mdtable(['字段','PostgreSQL定义'],t['fields'].items()),'约束：'+('; '.join(t['checks']) or '公共版本与组织约束')+'。唯一键：'+('; '.join('org_id,'+','.join(u) for u in t['unique']) or 'org_id,id')+'。', '关联：'+('; '.join(a+' → '+b for a,b in t['refs']) or '组织归属或经服务端契约校验的逻辑引用')+'。','']
        out+=['## 接口清单','',mdtable(['方法和路径','输入','输出及条款'],[(m.upper()+' '+p,request_name(o),response_name(o)+'；'+','.join(o.get('x-teacher-refs',[]))) for p,m,o in ops(key)]),'## 输入输出字段','']
        reqnames=set(request_name(o) for _,_,o in ops(key))
        for n in sorted(reqnames):
            if n not in api['components']['schemas']: continue
            s=api['components']['schemas'][n]
            out+=['### '+n,'',mdtable(['字段','类型或约束','必填'],[(f,json.dumps(v,ensure_ascii=False), '是' if f in s.get('required',[]) else '否') for f,v in s.get('properties',{}).items()])]
        out += ['## 错误与并发','', '401身份缺失；403权限/职责分离；404资源不存在；409版本/幂等/事实签名冲突；422参数或业务门槛；503依赖不可用。POST带Idempotency-Key；同键不同体409；更新与审批带version。逐项业务校验、状态流转、bytea入库和历史冻结见公共补充规则。','']
    else:
        out+=['## 执行准备','', '使用独立测试组织A/B及只对A部分品牌/店铺授权的真实用户。先记录相关业务表、版本和媒体SHA256，再执行下列操作；不得在真实经营库执行破坏性测试。测试结果均为未执行，设计覆盖不等于功能通过。','']
        for c in selected_cases(key):
            out += ['### '+c['id'],'','对应老师条款：'+c['source'],'','前置：'+c['setup'],'','步骤：'+c['steps'],'','预期：'+c['expected'],'','取证：'+c['evidence'],'','状态：未执行。','']
        out+=['## 业务规则与验收条款复核','',mdtable(['老师条款','联合验证要求'],[(r[0],clause_body(r)) for r in rr if not r[0].startswith('FR-')]),'## 通过判定','', '只有请求/响应、数据库前后状态、必要日志与前端截图共同满足预期才记PASS。依赖未部署、无授权或缺合法模型记BLOCKED；失败记FAIL，不将未执行写成PASS。性能结论必须附硬件、数据量、并发和统计窗口；演示数字不证明实际业务收益。','']
    out += ['## 当前实现差距与未决事项','', '外包当前仍是SQLite及本地媒体文件方案，目标DDL/API与真实ComfyUI/Milvus等接入尚需后续代码实施。生产角色模型、交付分期、刷新/上限等老师Q-01～12按原问题保留；本文的可配置建议值不等于老师已批准。本次只修改文档，不运行迁移、不改应用代码。','']
    return '\n'.join(out)
def request_name(o):
    cont=o.get('requestBody',{}).get('content',{})
    if not cont:return '无请求体'
    x=cont.get('application/json',{}).get('schema',{})
    return x.get('$ref','').split('/')[-1] or 'multipart文件/JSON payload'
def response_name(o):
    r=next((v for k,v in o['responses'].items() if k.startswith('2')),{}).get('content',{})
    if 'application/json' not in r:return '二进制或NDJSON'
    s=r['application/json']['schema']; return s.get('properties',{}).get('data',{}).get('$ref','').split('/')[-1] or '统一响应'

mdmap={}
for key in GROUPS:
    for fn,kind in KINDS.items():
        p=ROOT/f'crosspilot-arena/docs/modules/{key}/{fn}'
        write(p,module_doc(key,kind)); mdmap[(key,kind)]=p
rootm7={'CrossPilot-M7概要设计说明书.md':'概要设计说明书','CrossPilot-详细设计.md':'详细设计说明书','CrossPilot-M7商品内容创作与合规交付需求说明书.md':'需求说明书','CrossPilot-M7商品内容创作与合规交付测试用例.md':'测试用例','CrossPilot-M7测试用例思维导图大纲.md':'测试用例'}
for fn,kind in rootm7.items():write(ROOT/fn,module_doc('m7',kind))

def runs(p,line):
    # Plain text with code punctuation removed; hyperlinks remain readable.
    p.add_run(re.sub(r'\[([^]]+)\]\([^)]+\)',r'\1',line).replace('**','').replace('`',''))
def docx(md,dest):
    d=Document(); sec=d.sections[0]; sec.page_width=Inches(8.27); sec.page_height=Inches(11.69)
    sec.top_margin=Inches(.65); sec.bottom_margin=Inches(.65); sec.left_margin=Inches(.65); sec.right_margin=Inches(.65)
    for name,size in [('Normal',10),('Title',22),('Heading 1',15),('Heading 2',12),('Heading 3',11)]:
        st=d.styles[name]; st.font.name='Microsoft YaHei'; st.font.size=Pt(size); st.font.color.rgb=RGBColor(0,0,0); st.element.rPr.rFonts.set(qn('w:eastAsia'),'Microsoft YaHei')
        st.paragraph_format.space_after=Pt(6); st.paragraph_format.line_spacing=1.12
    d.styles['Normal'].paragraph_format.widow_control=True
    for s in ['Heading 1','Heading 2','Heading 3']: d.styles[s].paragraph_format.keep_with_next=True
    for node in list(d.styles.element.iter(qn('w:pBdr'))):
        node.getparent().remove(node)
    footer=sec.footer.paragraphs[0]; footer.alignment=2
    f=OxmlElement('w:fldSimple'); f.set(qn('w:instr'),'PAGE'); footer._p.append(f)
    lines=md.read_text(encoding='utf-8').splitlines(); i=0
    while i<len(lines):
        line=lines[i].strip(); i+=1
        if not line:continue
        if line.startswith('!['):
            path=Path(re.search(r'\]\((.*)\)',line).group(1)); d.add_picture(str(path),width=Inches(6.85)); continue
        if line.startswith('|') and i<len(lines) and re.match(r'^\|[- :|]+\|$',lines[i].strip()):
            rows=[[c.strip() for c in line.strip('|').split('|')]]; i+=1
            while i<len(lines) and lines[i].strip().startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')]); i+=1
            tb=d.add_table(rows=0,cols=len(rows[0])); tb.style='Table Grid'; tb.autofit=False
            # Most target tables have two or three columns; favor body descriptions.
            widths=[1.55,5.3] if len(rows[0])==2 else [2.25,2.05,2.55] if len(rows[0])==3 else [6.85/len(rows[0])]*len(rows[0])
            for col,width in zip(tb.columns,widths):col.width=Inches(width)
            for ri,row in enumerate(rows):
                cells=tb.add_row().cells
                cant=OxmlElement('w:cantSplit');cells[0]._tc.getparent().get_or_add_trPr().append(cant)
                for j,cell in enumerate(cells):
                    cell.width=Inches(widths[j]); runs(cell.paragraphs[0],row[j] if j<len(row) else '')
                    for r in cell.paragraphs[0].runs:r.font.size=Pt(8.5); r.bold=ri==0
                if ri==0:
                    repeat=OxmlElement('w:tblHeader'); cells[0]._tc.getparent().get_or_add_trPr().append(repeat)
            d.add_paragraph();continue
        if line.startswith('# '):d.add_paragraph(line[2:],'Title')
        elif line.startswith('## '):d.add_paragraph(line[3:],'Heading 1')
        elif line.startswith('### '):d.add_paragraph(line[4:],'Heading 2')
        else:
            p=d.add_paragraph();runs(p,line.lstrip('> '))
            if line.startswith(('对应老师条款：','前置：','步骤：','预期：','取证：')):p.paragraph_format.keep_with_next=True
    for node in list(d.element.iter(qn('w:pBdr'))):node.getparent().remove(node)
    dest.parent.mkdir(parents=True,exist_ok=True); d.save(dest)

# Existing Word copies map to the same canonical Markdown so copies are byte-identical.
cache={}
for rel in old_changes['docx_text_updated']:
    if '/plans/' in rel:continue
    key=rel.split('/modules/')[1].split('/')[0] if '/modules/' in rel else 'm7'
    kind='详细设计说明书' if ('详细' in rel or 'detailed-design' in rel) else '概要设计说明书' if '概要' in rel else '测试用例' if '测试' in rel else '需求说明书'
    md=mdmap[(key,kind)]; dest=ROOT/rel
    if (key,kind) in cache:shutil.copyfile(cache[(key,kind)],dest)
    else:docx(md,dest);cache[(key,kind)]=dest
    manifest.append({'docx':rel,'markdown':md.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})

# Replace current diagram publications; teacher-source illustrations are untouched.
dfd={'d00_rbac_matrix_detail':'m8','d00_rbac_roles':'m8','d00_system_data_flow':'m8','d01_cs_agent':'m1','d02_bi_design_agent':'m2_m3','d03_qa_agent':'m2_m3','d04_selection_agent':'m4','d05_forecast_agent':'m5_m6','d06_replenish_agent':'m5_m6','d07_content_agent':'m7','d08_base_foundation':'m0'}
for stem,key in dfd.items():
    for ext in ['png','svg']:shutil.copyfile(figdir/(key+'.'+ext),ROOT/f'crosspilot-arena/docs/prototypes/dfd_v6/{stem}.{ext}')
simple={'biz_00_overall':'m8','data_00_overall':'m8','mod_00_base':'m0','mod_01_cs':'m1','mod_02_bi':'m2_m3','mod_03_qa':'m2_m3','mod_04_selection':'m4','mod_05_forecast':'m5_m6','mod_06_replenish':'m5_m6','mod_07_content':'m7'}
for stem,key in simple.items():
    for ext in ['png','svg']:shutil.copyfile(figdir/(key+'.'+ext),ROOT/f'crosspilot-arena/docs/prototypes/simple_v6/{stem}.{ext}')
(BASE/'render-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Canonical module documents',len(mdmap),'Word copies',len(manifest),'unique Word designs',len(cache))
