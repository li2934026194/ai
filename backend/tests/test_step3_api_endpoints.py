import io
from pathlib import Path
import subprocess
import zipfile
import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.modules.m7_content.models import M7ApprovalRecord, M7GenerationJob


CREATOR_H = {"X-Actor-Role": "creator", "X-Actor-Id": "u-lin"}
APPROVER_H = {"X-Actor-Role": "approver", "X-Actor-Id": "u-chen"}
READONLY_H = {"X-Actor-Role": "manager", "X-Actor-Id": "u-wang"}


async def _prepare_copy_and_images(client, sku="SKU-00704", platform="amazon_us"):
    # M7-1: 生成并采纳 4 个核心文案
    for slot in ("copy_title", "copy_bullets", "copy_desc", "copy_kw"):
        r = await client.post(
            "/api/v1/orgs/org_demo/m7/copy/generate",
            headers={**CREATOR_H, "X-Idempotency-Key": f"copy-{sku}-{slot}"},
            json={"sku": sku, "platform": platform, "lang": "en-US", "asset_slot": slot},
        )
        assert r.status_code == 200, r.text
        variants = r.json()["data"]["variants"]
        assert len(variants) == 3
        sel = await client.post(
            f"/api/v1/orgs/org_demo/m7/copy/assets/{variants[0]['asset_id']}/select",
            headers=CREATOR_H,
        )
        assert sel.status_code == 200, sel.text

    # M7-2: 提交 1+4 套图并同步落盘
    b = await client.post(
        "/api/v1/orgs/org_demo/m7/images/batch",
        headers={**CREATOR_H, "X-Idempotency-Key": f"img-{sku}"},
        json={"sku": sku, "platform": platform, "ai_person_slots": [1]},
    )
    assert b.status_code == 202
    job_id = b.json()["data"]["job_id"]
    sync = await client.post(f"/api/v1/orgs/org_demo/m7/jobs/{job_id}/sync", headers=CREATOR_H)
    assert sync.status_code == 200
    slots = sync.json()["data"]["slots"]
    assert len(slots) == 5
    assert all(s["iptc_verified"] is True for s in slots)
    return slots


async def test_copy_scan_edit_lock_and_restore(test_ctx):
    client = test_ctx["client"]

    # 1. 可用商品列表
    prods = await client.get("/api/v1/orgs/org_demo/m7/products/available", headers=CREATOR_H)
    assert prods.status_code == 200
    assert any(p["sku"] == "SKU-00704" for p in prods.json()["data"]["items"])

    # 2. 幂等生成
    g1 = await client.post(
        "/api/v1/orgs/org_demo/m7/copy/generate",
        headers={**CREATOR_H, "X-Idempotency-Key": "idem-copy-1"},
        json={"sku": "SKU-00704", "platform": "amazon_us", "asset_slot": "copy_title"},
    )
    g2 = await client.post(
        "/api/v1/orgs/org_demo/m7/copy/generate",
        headers={**CREATOR_H, "X-Idempotency-Key": "idem-copy-1"},
        json={"sku": "SKU-00704", "platform": "amazon_us", "asset_slot": "copy_title"},
    )
    assert g2.json()["data"]["idempotent_reused"] is True
    asset_id = g1.json()["data"]["variants"][0]["asset_id"]
    orig_text = g1.json()["data"]["variants"][0]["content_json"]["text"]

    # 3. 实时扫描违禁词
    scan = await client.post(
        "/api/v1/orgs/org_demo/m7/copy/scan",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us", "asset_slot": "copy_title", "text": "AMAZING Velcro Waterproof"},
    )
    assert scan.status_code == 200
    assert scan.json()["data"]["passed"] is False
    assert scan.json()["data"]["suggestions"]["Velcro"] == "hook and loop"

    # 4. 服务端强拦截微调（M7-4221）
    bad_edit = await client.put(
        f"/api/v1/orgs/org_demo/m7/copy/assets/{asset_id}",
        headers=CREATOR_H,
        json={"text": "CrossPilot Lab Waterproof Sealer", "version": 1},
    )
    assert bad_edit.status_code == 422
    assert bad_edit.json()["code"] == "M7-4221"

    # 5. 合规微调 + 乐观锁 409 + 一键还原 AI 原稿
    ok_edit = await client.put(
        f"/api/v1/orgs/org_demo/m7/copy/assets/{asset_id}",
        headers=CREATOR_H,
        json={"text": "CrossPilot Lab BPA-Free Compact Sealer v2", "version": 1},
    )
    assert ok_edit.status_code == 200
    assert ok_edit.json()["data"]["version"] == 2
    assert ok_edit.json()["data"]["edit_status"] == "MANUALLY_EDITED"

    stale = await client.put(
        f"/api/v1/orgs/org_demo/m7/copy/assets/{asset_id}",
        headers=CREATOR_H,
        json={"text": "CrossPilot Lab BPA-Free Stale", "version": 1},
    )
    assert stale.status_code == 409
    assert stale.json()["code"] == "M7-4091"

    restored = await client.post(
        f"/api/v1/orgs/org_demo/m7/copy/assets/{asset_id}/restore",
        headers=CREATOR_H,
    )
    assert restored.status_code == 200
    assert restored.json()["data"]["content_json"]["text"] == orig_text
    assert restored.json()["data"]["edit_status"] == "RESTORED_ORIGINAL"


async def test_video_503_hard_gate_preserves_prior_assets(test_ctx, monkeypatch: pytest.MonkeyPatch):
    client = test_ctx["client"]
    storage_dir: Path = test_ctx["storage_dir"]
    await _prepare_copy_and_images(client)

    # 场景 A：VIDEO_ENGINE_ENABLED=false
    monkeypatch.setenv("VIDEO_ENGINE_ENABLED", "false")
    get_settings.cache_clear()
    r_disabled = await client.post(
        "/api/v1/orgs/org_demo/m7/videos/generate",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us"},
    )
    assert r_disabled.status_code == 503
    assert r_disabled.json()["code"] == "M7-5031"

    # 场景 B：VIDEO_ENGINE_ENABLED=true 但系统无可用 ffmpeg
    monkeypatch.setenv("VIDEO_ENGINE_ENABLED", "true")
    monkeypatch.setenv("FFMPEG_BIN", "nonexistent_ffmpeg_binary_xyz")
    get_settings.cache_clear()
    r_noff = await client.post(
        "/api/v1/orgs/org_demo/m7/videos/generate",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us"},
    )
    assert r_noff.status_code == 503
    assert r_noff.json()["code"] == "M7-5031"

    # 硬断言：绝不产出任何空 .mp4，且前序 4 文案 + 5 套图 (6/8) 完整保留
    mp4s = list(storage_dir.rglob("*.mp4"))
    assert mp4s == []
    summary = await client.get(
        "/api/v1/orgs/org_demo/m7/packages/SKU-00704/summary?platform=amazon_us",
        headers=CREATOR_H,
    )
    assert summary.status_code == 200
    assert summary.json()["data"]["done_cnt"] == 6  # 4 copy + img_0 + img_1_4

    async with test_ctx["session_factory"]() as s:
        failed_jobs = (
            await s.scalars(
                select(M7GenerationJob).where(
                    M7GenerationJob.sku == "SKU-00704",
                    M7GenerationJob.job_type == "VIDEO_15S",
                    M7GenerationJob.status == "FAILED",
                )
            )
        ).all()
        assert len(failed_jobs) == 2
        assert all(j.error_code == "M7-5031" for j in failed_jobs)
    get_settings.cache_clear()


async def test_full_e2e_workflow_iptc_rbac_invalidation_and_export(
    test_ctx, monkeypatch: pytest.MonkeyPatch
):
    client = test_ctx["client"]
    slots = await _prepare_copy_and_images(client)

    # 1. 单图重绘与局部对比（仅变 img_2，其余 4 张不变）
    regen = await client.post(
        "/api/v1/orgs/org_demo/m7/images/slots/2/regenerate",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us", "instruction": "Highlight 60kPa"},
    )
    assert regen.status_code == 200
    assert regen.json()["data"]["version"] == 2
    assert regen.json()["data"]["before_media_url"] == slots[2]["media_url"]

    inp = await client.post(
        "/api/v1/orgs/org_demo/m7/images/slots/3/inpaint",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us", "instruction": "Clean table"},
    )
    assert inp.status_code == 200
    assert "before_media_url" in inp.json()["data"]

    # 2. A+ 长页组装（带 XSS 测试验证转义）
    aplus = await client.post(
        "/api/v1/orgs/org_demo/m7/aplus/generate",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us"},
    )
    assert aplus.status_code == 200
    assert "<section" in aplus.json()["data"]["html"]

    # 3. 模拟可用 FFmpeg（写入合法 ftyp mp4 字节）完成第 8/8 项视频合成与分镜修改/重做
    def _fake_ffmpeg_run(cmd, **_kwargs):
        out_path = Path(cmd[-1])
        out_path.write_bytes(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42FAKE_VIDEO_STREAM")
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setenv("VIDEO_ENGINE_ENABLED", "true")
    monkeypatch.setattr("shutil.which", lambda _name: "/usr/bin/ffmpeg")
    monkeypatch.setattr("subprocess.run", _fake_ffmpeg_run)
    get_settings.cache_clear()

    vid = await client.post(
        "/api/v1/orgs/org_demo/m7/videos/generate",
        headers={**CREATOR_H, "X-Idempotency-Key": "vid-00704"},
        json={"sku": "SKU-00704", "platform": "amazon_us"},
    )
    assert vid.status_code == 200
    vid_media_url = vid.json()["data"]["media_url"]

    # 分镜热编辑 + 单镜重做
    seg_edit = await client.put(
        "/api/v1/orgs/org_demo/m7/videos/segments/1",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us", "version": 1, "motion": "zoom_in"},
    )
    assert seg_edit.status_code == 200
    assert seg_edit.json()["data"]["segments"][1]["motion"] == "zoom_in"

    seg_regen = await client.post(
        "/api/v1/orgs/org_demo/m7/videos/segments/1/regenerate",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us"},
    )
    assert seg_regen.status_code == 200

    # 读取二进制媒体流校验
    media_bin = await client.get(vid_media_url, headers=READONLY_H)
    assert media_bin.status_code == 200
    assert media_bin.headers["content-type"] == "video/mp4"

    # 4. 模拟 IPTC 剥离 -> 合规检查拦截 -> 一键重写入恢复 -> 合规检查全绿
    stripped = await client.post(
        "/api/v1/orgs/org_demo/m7/images/iptc/verify",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us", "mode": "simulate_strip", "slot_idx": 1},
    )
    assert stripped.status_code == 200
    assert stripped.json()["data"]["all_verified"] is False

    chk_fail = await client.post(
        "/api/v1/orgs/org_demo/m7/compliance/check",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us"},
    )
    assert chk_fail.status_code == 200
    assert chk_fail.json()["data"]["overall_pass"] is False

    repaired = await client.post(
        "/api/v1/orgs/org_demo/m7/images/iptc/verify",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us", "mode": "rewrite", "slot_idx": 1},
    )
    assert repaired.status_code == 200
    assert repaired.json()["data"]["all_verified"] is True

    # 5. 引擎状态 + 规则矩阵权限控制 + 资质续期
    eng_st = await client.get("/api/v1/orgs/org_demo/m7/engines/status", headers=READONLY_H)
    assert eng_st.status_code == 200
    mat = await client.get("/api/v1/orgs/org_demo/m7/compliance/matrix?sku=SKU-00704", headers=READONLY_H)
    assert mat.status_code == 200
    rule_id = mat.json()["data"]["rules"][0]["rule_id"]

    # creator 不可修改规则（403）
    c_upd = await client.put(
        f"/api/v1/orgs/org_demo/m7/compliance/matrix/{rule_id}",
        headers=CREATOR_H,
        json={
            "title_max_chars": 180,
            "bullet_max_chars": 500,
            "search_terms_max_bytes": 250,
            "lexicon_json": mat.json()["data"]["rules"][0]["lexicon_json"],
            "required_certs_json": mat.json()["data"]["rules"][0]["required_certs_json"],
        },
    )
    assert c_upd.status_code == 403

    a_upd = await client.put(
        f"/api/v1/orgs/org_demo/m7/compliance/matrix/{rule_id}",
        headers=APPROVER_H,
        json={
            "title_max_chars": 200,
            "bullet_max_chars": 500,
            "search_terms_max_bytes": 250,
            "lexicon_json": mat.json()["data"]["rules"][0]["lexicon_json"],
            "required_certs_json": mat.json()["data"]["rules"][0]["required_certs_json"],
        },
    )
    assert a_upd.status_code == 200

    cert_ren = await client.post(
        "/api/v1/orgs/org_demo/m7/certs/renew",
        headers=APPROVER_H,
        json={"sku": "SKU-00704", "cert_type": "UL", "cert_no": "UL-2026-NEW", "expire_date": "2027-12-31"},
    )
    assert cert_ren.status_code == 200

    # 运行合规检查 -> 全绿 8/8
    chk_ok = await client.post(
        "/api/v1/orgs/org_demo/m7/compliance/check",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us"},
    )
    assert chk_ok.status_code == 200
    assert chk_ok.json()["data"]["overall_pass"] is True
    assert chk_ok.json()["data"]["deliverable_count"] == 8

    # 6. 未批准前导出必须阻断 (422 M7-4222)
    exp_early = await client.get(
        "/api/v1/orgs/org_demo/m7/packages/SKU-00704/export?platform=amazon_us&format=zip",
        headers=CREATOR_H,
    )
    assert exp_early.status_code == 422
    assert exp_early.json()["code"] == "M7-4222"

    # 7. creator 越权审批 -> 403 M7-4032；同人自批 -> 403 M7-4032
    self_c = await client.post(
        "/api/v1/orgs/org_demo/m7/packages/approve",
        headers=CREATOR_H,
        json={"sku": "SKU-00704", "platform": "amazon_us", "decision": "APPROVED"},
    )
    assert self_c.status_code == 403
    assert self_c.json()["code"] == "M7-4032"

    same_person_approver = {"X-Actor-Role": "approver", "X-Actor-Id": "u-lin"}
    self_same = await client.post(
        "/api/v1/orgs/org_demo/m7/packages/approve",
        headers=same_person_approver,
        json={"sku": "SKU-00704", "platform": "amazon_us", "decision": "APPROVED"},
    )
    assert self_same.status_code == 403
    assert self_same.json()["code"] == "M7-4032"

    # 主管陈主管批准放行 -> 200
    app_ok = await client.post(
        "/api/v1/orgs/org_demo/m7/packages/approve",
        headers=APPROVER_H,
        json={"sku": "SKU-00704", "platform": "amazon_us", "decision": "APPROVED", "note": "核验通过准予导出"},
    )
    assert app_ok.status_code == 200

    # 8. 导出 ZIP & HTML 交付包校验
    z_resp = await client.get(
        "/api/v1/orgs/org_demo/m7/packages/SKU-00704/export?platform=amazon_us&format=zip",
        headers=CREATOR_H,
    )
    assert z_resp.status_code == 200
    assert z_resp.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(z_resp.content)) as zf:
        names = set(zf.namelist())
        assert "listing_copy.csv" in names
        assert "aplus/aplus.html" in names
        assert "video/vid_15s.mp4" in names
        assert "compliance_report.json" in names
        for i in range(5):
            assert f"images/img_{i}.png" in names

    h_resp = await client.get(
        "/api/v1/orgs/org_demo/m7/packages/SKU-00704/export?platform=amazon_us&format=html",
        headers=CREATOR_H,
    )
    assert h_resp.status_code == 200
    assert "预览，尚未发布" in h_resp.text

    # 9. 上游改文案自动失效旧审批，且导出立即重新拦截
    summary_now = await client.get(
        "/api/v1/orgs/org_demo/m7/packages/SKU-00704/summary?platform=amazon_us",
        headers=READONLY_H,
    )
    assert summary_now.json()["data"]["approval_status"] == "APPROVED"
    assert summary_now.json()["data"]["buyer_preview"]["discount_pct"] == 23

    # 构造一次性新文案修改触发失效
    g_title = await client.post(
        "/api/v1/orgs/org_demo/m7/copy/generate",
        headers={**CREATOR_H, "X-Idempotency-Key": "trigger-invalidate"},
        json={"sku": "SKU-00704", "platform": "amazon_us", "asset_slot": "copy_title"},
    )
    new_aid = g_title.json()["data"]["variants"][1]["asset_id"]
    await client.post(f"/api/v1/orgs/org_demo/m7/copy/assets/{new_aid}/select", headers=CREATOR_H)

    exp_after_inv = await client.get(
        "/api/v1/orgs/org_demo/m7/packages/SKU-00704/export?platform=amazon_us&format=zip",
        headers=CREATOR_H,
    )
    assert exp_after_inv.status_code == 422
    assert exp_after_inv.json()["code"] == "M7-4222"

    # 10. COS-052 无划线价绝不输出 NaN
    cos_sum = await client.get(
        "/api/v1/orgs/org_demo/m7/packages/COS-052/summary?platform=amazon_us",
        headers=READONLY_H,
    )
    assert cos_sum.status_code == 200
    assert cos_sum.json()["data"]["buyer_preview"]["discount_pct"] is None
