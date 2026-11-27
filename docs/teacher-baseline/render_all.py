from pathlib import Path
import os,json,subprocess,concurrent.futures,hashlib
BASE=Path('D:/ai/docs/teacher-baseline'); ROOT=Path('D:/ai')
PY=Path('C:/Users/Windows/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
RENDER=Path('C:/Users/Windows/.codex/plugins/cache/openai-primary-runtime/documents/26.1123.11515/skills/documents/render_docx.py')
env=os.environ.copy();env['PYTHONUTF8']='1';env['PYTHONIOENCODING']='utf-8';env['PATH']='D:/ai/.tools/LibreOffice/program;C:/Users/Windows/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin;'+env['PATH']
manifest=json.loads((BASE/'render-manifest.json').read_text(encoding='utf-8'))
unique={}
for row in manifest:unique.setdefault(row['sha256'],row)
prior=json.loads((BASE/'render-results.json').read_text(encoding='utf-8')) if (BASE/'render-results.json').exists() else []
cached={r['sha256']:r for r in prior if r.get('exit_code')==0 and r.get('pages') and all(Path(p).exists() for p in r['pages'])}
def run(pair):
    sha,row=pair; dest=BASE/'render-final'/sha[:12];dest.mkdir(parents=True,exist_ok=True)
    if sha in cached:return cached[sha]
    proc=subprocess.run([str(PY),str(RENDER),str(ROOT/row['docx']),'--output_dir',str(dest),'--emit_pdf'],env=env,capture_output=True,timeout=240)
    pages=sorted(dest.glob('page-*.png'),key=lambda p:int(p.stem.split('-')[-1]))
    (dest/'render.log').write_bytes(proc.stdout+proc.stderr)
    result=dict(row,exit_code=proc.returncode,render_dir=str(dest),pages=[str(p) for p in pages],page_count=len(pages),visual_review='PENDING')
    print(json.dumps({'document':row['markdown'],'pages':len(pages),'exit':proc.returncode},ensure_ascii=False),flush=True)
    return result
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for r in pool.map(run,unique.items()):
        results.append(r);(BASE/'render-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('Unique documents',len(results),'pages',sum(r['page_count'] for r in results),flush=True)
