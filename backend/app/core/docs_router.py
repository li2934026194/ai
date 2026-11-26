from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.core.exceptions import build_envelope

router = APIRouter(prefix="/api/v1/docs", tags=["docs-hub"])

DOCS_ROOT = (Path(__file__).resolve().parents[3] / "docs").resolve()

FOLDER_LABELS = {
    "root": "总项目交付文档（合并精简版 5 份 .md / .docx）",
    "requirements": "老师原始需求与架构文件（原封保留）",
    "prototypes/dfd_v6": "V6 数据流图 (DFD)",
}

DISPLAY_NAME_MAP = {
    "00_docs_index.md": "00-全平台文档总索引.md",
    "01_project_requirements.md": "01-CrossPilot总需求说明书.md",
    "02_project_hld.md": "02-CrossPilot总概要设计说明书.md",
    "03_project_lld.md": "03-CrossPilot总详细设计说明书.md",
    "04_project_test_cases_and_report.md": "04-CrossPilot总测试用例与执行报告.md",
    "05_local_operation_guide.md": "05-本地运行与部署实操手册.md",
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
    collect_dir("requirements", DOCS_ROOT / "requirements", (".md", ".docx"))
    collect_dir("prototypes/dfd_v6", DOCS_ROOT / "prototypes/dfd_v6", (".png",))

    return build_envelope(data={"folders": folders})


@router.get("/content")
async def read_doc_content(path: str = Query(..., description="Path relative to docs/")):
    target = _safe_resolve(path)
    if target.suffix.lower() not in {".md", ".txt", ".mmd"}:
        raise HTTPException(status_code=400, detail="Only markdown/text files can be previewed inline")
    text = target.read_text(encoding="utf-8", errors="replace")
    return build_envelope(
        data={
            "path": path,
            "name": target.name,
            "display_name": DISPLAY_NAME_MAP.get(target.name, target.name),
            "content": text,
        }
    )


@router.get("/download")
async def download_doc_file(path: str = Query(..., description="Path relative to docs/")):
    target = _safe_resolve(path)
    media = "application/octet-stream"
    if target.suffix.lower() == ".md":
        media = "text/markdown; charset=utf-8"
    elif target.suffix.lower() == ".docx":
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif target.suffix.lower() == ".png":
        media = "image/png"
    return FileResponse(path=target, media_type=media, filename=target.name)
