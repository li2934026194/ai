from pathlib import Path
import ast,json,hashlib,shutil
ROOT=Path('D:/ai');BASE=ROOT/'docs/teacher-baseline';TARGET=ROOT/'crosspilot-arena/docs/target'
tree=ast.parse((BASE/'consolidate_docs.py').read_text(encoding='utf-8'))
allowed={'GROUPS','NAMES','KINDS','intro','stack','links'}
nodes=[n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef)) or (isinstance(n,ast.Assign) and any(isinstance(x,ast.Name) and x.id in allowed for x in n.targets))]
exec(compile(ast.Module(body=nodes,type_ignores=[]),'helpers','exec'))
clauses=json.loads((BASE/'source-clauses.json').read_text(encoding='utf-8'));cases=json.loads((TARGET/'acceptance-cases.json').read_text(encoding='utf-8'));tables=json.loads((TARGET/'table-catalog.json').read_text(encoding='utf-8'));api=json.loads((TARGET/'openapi-target.json').read_text(encoding='utf-8'));notes=json.loads((BASE/'module-business-notes.json').read_text(encoding='utf-8'));figdir=TARGET/'figures'
changed={}
for key in GROUPS:
    md=ROOT/f'crosspilot-arena/docs/modules/{key}/04_test_cases.md'
    write(md,module_doc(key,'测试用例'));changed[md.relative_to(ROOT).as_posix()]=md
md=ROOT/'crosspilot-arena/docs/modules/m5_m6/01_requirements.md';write(md,module_doc('m5_m6','需求说明书'));changed[md.relative_to(ROOT).as_posix()]=md
for fn in ['CrossPilot-M7商品内容创作与合规交付测试用例.md','CrossPilot-M7测试用例思维导图大纲.md']:write(ROOT/fn,module_doc('m7','测试用例'))
manifest=json.loads((BASE/'render-manifest.json').read_text(encoding='utf-8'));cache={}
for row in manifest:
    if row['markdown'] not in changed:continue
    dest=ROOT/row['docx'];md=changed[row['markdown']]
    if row['markdown'] in cache:shutil.copyfile(cache[row['markdown']],dest)
    else:docx(md,dest);cache[row['markdown']]=dest
    row['sha256']=hashlib.sha256(dest.read_bytes()).hexdigest()
(BASE/'render-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Refreshed case pagination and WAPE formula; unique documents',len(cache))
