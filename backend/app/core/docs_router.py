from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.core.exceptions import build_envelope

router = APIRouter(prefix="/api/v1/docs", tags=["docs-hub"])

DOCS_ROOT = (Path(__file__).resolve().parents[3] / "docs").resolve()

FOLDER_LABELS = {
    "root": "总览与测试报告",
    "modules/m0": "M0 店铺接入与商品主档",
    "modules/m1": "M1 客服导购与售后闭环",
    "modules/m2_m3": "M2 经营分析与 M3 智能问数",
    "modules/m4": "M4 智能选品与过会决策",
    "modules/m5_m6": "M5 销量预测与 M6 智能补货",
    "modules/m8": "M8 组织权限与平台底座",
    "prototypes/dfd_v6": "V6 数据流图 (DFD)",
}

DISPLAY_NAME_MAP = {
    "00_docs_index.md": "00-文档总览与导航索引.md",
    "06_test_execution_report.md": "06-测试执行详细描述报告.md",
    "01_requirements.md": "01-需求说明书.md",
    "02_hld.md": "02-概要设计说明书.md",
    "03_lld.md": "03-详细设计说明书.md",
    "04_test_cases.md": "04-测试用例.md",
}


def _safe_resolve(rel_path: str) -> Path:
    candidate = (DOCS_ROOT / rel_path).resolve()
    if not candidate.is_relative_to(DOCS_ROOT) or not candidate.is_file():
        raise HTTPException(status_code=404, detail=f"Document not found: {rel_path}")
    return candidate


@router.get("/tree")
async def list_docs_tree():
    folders: list[dict] = []

    def collect_dir(key: str, directory: Path, exts: tuple[str, ...]) -> None:
        if not directory.is_dir():
            return
        files = []
        for p in sorted(directory.iterdir(), key=lambda x: x.name):
            if not p.is_file() or p.suffix.lower() not in exts:
                continue
            rel = p.relative_to(DOCS_ROOT).as_posix()
            files.append(
                {
                    "path": rel,
                    "name": p.name,
                    "display_name": DISPLAY_NAME_MAP.get(p.name, p.name),
                    "ext": p.suffix.lower().lstrip("."),
                    "size_kb": round(p.stat().st_size / 1024, 1),
                }
            )
        if files:
            folders.append(
                {
                    "key": key,
                    "label": FOLDER_LABELS.get(key, key),
                    "files": files,
                }
            )

    collect_dir("root", DOCS_ROOT, (".md", ".docx"))
    for mod in ["modules/m0", "modules/m1", "modules/m2_m3", "modules/m4", "modules/m5_m6", "modules/m8"]:
        collect_dir(mod, DOCS_ROOT / mod, (".md", ".docx"))
    collect_dir("prototypes/dfd_v6", DOCS_ROOT / "prototypes/dfd_v6", (".png",))

    return build_envelope(data={"folders": folders})


@router.get("/content")
async def read_doc_content(path: str = Query(..., min_length=1)):
    target = _safe_resolve(path)
    if target.suffix.lower() not in {".md", ".txt", ".mmd"}:
        raise HTTPException(status_code=400, detail="Only text/markdown preview supported")
    return build_envelope(
        data={
            "path": target.relative_to(DOCS_ROOT).as_posix(),
            "display_name": DISPLAY_NAME_MAP.get(target.name, target.name),
            "content": target.read_text(encoding="utf-8"),
        }
    )


@router.get("/download")
async def download_doc_file(path: str = Query(..., min_length=1)):
    target = _safe_resolve(path)
    return FileResponse(path=str(target), filename=target.name)
