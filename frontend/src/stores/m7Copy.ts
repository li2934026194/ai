import { defineStore } from "pinia";
import { ref } from "vue";
import { M7ApiError } from "@/api/client";
import { m7Api, type CopyAssetDTO, type CopyScanResult } from "@/api/m7";
import { useM7WorkspaceStore } from "./m7Workspace";

export const CORE_COPY_SLOT_DEFS = [
  { key: "copy_title", label: "核心标题", core: true },
  { key: "copy_bullets", label: "五点卖点", core: true },
  { key: "copy_desc", label: "详情描述", core: true },
  { key: "copy_kw", label: "后台搜索词 (≤250B)", core: true },
] as const;

export const EXT_COPY_SLOT_DEFS = [
  { key: "copy_faq", label: "买家 FAQ 问答", core: false },
  { key: "copy_aplus_txt", label: "A+ 模块文案", core: false },
  { key: "copy_variant", label: "变体规格说明", core: false },
  { key: "copy_attr", label: "属性参数清单", core: false },
  { key: "copy_alt", label: "图片 Alt 无障碍描述", core: false },
  { key: "copy_warranty", label: "质保与售后说明", core: false },
] as const;

export const QUICK_MUST_CHIPS = ["CrossPilot Lab", "USB-C", "BPA-Free", "Lightweight"] as const;

export function escapeHtml(raw: string): string {
  return (raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightCopyHtml(
  rawText: string,
  mustHits: string[] = [],
  badHits: string[] = []
): string {
  let out = escapeHtml(rawText);
  for (const term of badHits) {
    const t = term.trim();
    if (!t) continue;
    const re = new RegExp(`(${escapeRegExp(escapeHtml(t))})`, "gi");
    out = out.replace(
      re,
      '<mark style="background:#fee2e2;color:#991b1b;text-decoration:underline;padding:0 2px;border-radius:3px;">$1</mark>'
    );
  }
  for (const term of mustHits) {
    const t = term.trim();
    if (!t) continue;
    const re = new RegExp(`(${escapeRegExp(escapeHtml(t))})`, "gi");
    out = out.replace(
      re,
      '<mark style="background:#dcfce7;color:#166534;padding:0 2px;border-radius:3px;">$1</mark>'
    );
  }
  return out;
}

export const useM7CopyStore = defineStore("m7Copy", () => {
  const activeSlot = ref("copy_title");
  const lang = ref("en-US");
  const extraMust = ref("CrossPilot Lab, BPA-Free");
  const extraBan = ref("100% Best, Free Gift");

  const variants = ref<CopyAssetDTO[]>([]);
  const editingAssetId = ref("");
  const editingText = ref("");
  const origSnapshotText = ref("");
  const editingVersion = ref(1);
  const editStatus = ref<string>("AI_GENERATED");
  const scanResult = ref<CopyScanResult | null>(null);
  const errorMsg = ref("");
  const isConflict409 = ref(false);
  const busy = ref(false);

  let scanTimer: ReturnType<typeof setTimeout> | null = null;

  function parseList(raw: string): string[] {
    return raw
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function appendMustChip(chip: string) {
    const cur = parseList(extraMust.value);
    if (!cur.some((x) => x.toLowerCase() === chip.toLowerCase())) {
      cur.push(chip);
      extraMust.value = cur.join(", ");
    }
    scheduleRealtimeScan();
  }

  function loadSelectedFromSummary() {
    const ws = useM7WorkspaceStore();
    const sel = ws.summary?.selected_copy_assets?.[activeSlot.value];
    if (sel && sel.asset_id) {
      editingAssetId.value = sel.asset_id;
      editingText.value = sel.content_json?.text || "";
      origSnapshotText.value = sel.orig_content_json?.text || sel.content_json?.text || "";
      editingVersion.value = sel.version || 1;
      editStatus.value = sel.edit_status || "AI_GENERATED";
      scanResult.value = sel.scan_result_json || null;
    } else {
      editingAssetId.value = "";
      editingText.value = "";
      origSnapshotText.value = "";
      editingVersion.value = 1;
      editStatus.value = "AI_GENERATED";
      scanResult.value = null;
    }
    errorMsg.value = "";
    isConflict409.value = false;
  }

  async function generateVariants() {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    errorMsg.value = "";
    try {
      const res = await m7Api.generateCopy(
        {
          sku: ws.currentSku,
          platform: ws.platform,
          lang: lang.value,
          asset_slot: activeSlot.value,
          extra_must: parseList(extraMust.value),
          extra_ban: parseList(extraBan.value),
        },
        `copy-${ws.currentSku}-${ws.platform}-${activeSlot.value}-${Date.now()}`
      );
      variants.value = res.variants;
      ws.showToast(`已生成 3 组 ${activeSlot.value} 候选文案`);
    } catch (e) {
      errorMsg.value = (e as Error).message;
    } finally {
      busy.value = false;
    }
  }

  async function autoAdopt4CoreSlots() {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    errorMsg.value = "";
    try {
      for (const s of CORE_COPY_SLOT_DEFS) {
        const res = await m7Api.generateCopy(
          {
            sku: ws.currentSku,
            platform: ws.platform,
            lang: lang.value,
            asset_slot: s.key,
            extra_must: parseList(extraMust.value),
            extra_ban: parseList(extraBan.value),
          },
          `auto4-${ws.currentSku}-${ws.platform}-${s.key}-${Date.now()}`
        );
        const compliant =
          res.variants.find((v) => v.scan_result_json?.passed) || res.variants[0];
        if (compliant) {
          await m7Api.selectCopyAsset(compliant.asset_id);
        }
      }
      await ws.hydrateSummary();
      loadSelectedFromSummary();
      ws.showToast("已完成 4 类核心文案一键生成与合规采纳（4/4）");
    } catch (e) {
      if (e instanceof M7ApiError) errorMsg.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  async function selectVariant(asset: CopyAssetDTO) {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    errorMsg.value = "";
    try {
      const updated = await m7Api.selectCopyAsset(asset.asset_id);
      editingAssetId.value = updated.asset_id;
      editingText.value = updated.content_json?.text || "";
      origSnapshotText.value = updated.orig_content_json?.text || "";
      editingVersion.value = updated.version;
      editStatus.value = updated.edit_status;
      scanResult.value = updated.scan_result_json;
      await ws.hydrateSummary();
      ws.showToast(`已采纳 ${activeSlot.value} 写入交付清单`);
    } catch (e) {
      if (e instanceof M7ApiError) {
        errorMsg.value = `${e.code}: ${e.message}`;
        if (e.data) scanResult.value = e.data as CopyScanResult;
      }
    } finally {
      busy.value = false;
    }
  }

  function scheduleRealtimeScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      void runRealtimeScan();
    }, 300);
  }

  async function runRealtimeScan() {
    const ws = useM7WorkspaceStore();
    const prod = ws.currentProduct;
    if (!prod) return;
    try {
      scanResult.value = await m7Api.scanCopy({
        sku: ws.currentSku,
        platform: ws.platform,
        category: prod.category,
        asset_slot: activeSlot.value,
        text: editingText.value,
        extra_must: parseList(extraMust.value),
        extra_ban: parseList(extraBan.value),
      });
    } catch {
      // 实时提示静默忽略网络抖动，保存时由服务端兜底
    }
  }

  async function saveManualEdit() {
    if (!editingAssetId.value) return;
    if (!editingText.value.trim()) {
      errorMsg.value = "修改后的文案不能为空";
      return;
    }
    const ws = useM7WorkspaceStore();
    busy.value = true;
    errorMsg.value = "";
    isConflict409.value = false;
    try {
      const updated = await m7Api.editCopyAsset(editingAssetId.value, {
        text: editingText.value,
        version: editingVersion.value,
        extra_must: parseList(extraMust.value),
        extra_ban: parseList(extraBan.value),
      });
      editingVersion.value = updated.version;
      editStatus.value = updated.edit_status;
      scanResult.value = updated.scan_result_json;
      await ws.hydrateSummary();
      ws.showToast("微调已保存（AI 原稿保留且旧审批已自动失效）");
    } catch (e) {
      if (e instanceof M7ApiError) {
        errorMsg.value = `${e.code}: ${e.message}`;
        if (e.code === "M7-4091") isConflict409.value = true;
        if (e.code === "M7-4221" && e.data) {
          scanResult.value = e.data as CopyScanResult;
        }
      }
    } finally {
      busy.value = false;
    }
  }

  async function refreshLatestFromServer() {
    const ws = useM7WorkspaceStore();
    await ws.hydrateSummary();
    loadSelectedFromSummary();
    ws.showToast("已同步服务端最新版本");
  }

  async function restoreOriginal() {
    if (!editingAssetId.value) return;
    const ws = useM7WorkspaceStore();
    busy.value = true;
    errorMsg.value = "";
    try {
      const updated = await m7Api.restoreCopyAsset(editingAssetId.value);
      editingText.value = updated.content_json?.text || "";
      editingVersion.value = updated.version;
      editStatus.value = updated.edit_status;
      scanResult.value = updated.scan_result_json;
      await ws.hydrateSummary();
      ws.showToast("已一键还原 AI 原稿");
    } catch (e) {
      if (e instanceof M7ApiError) errorMsg.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  return {
    activeSlot,
    lang,
    extraMust,
    extraBan,
    variants,
    editingAssetId,
    editingText,
    origSnapshotText,
    editingVersion,
    editStatus,
    scanResult,
    errorMsg,
    isConflict409,
    busy,
    parseList,
    appendMustChip,
    loadSelectedFromSummary,
    generateVariants,
    autoAdopt4CoreSlots,
    selectVariant,
    scheduleRealtimeScan,
    runRealtimeScan,
    saveManualEdit,
    refreshLatestFromServer,
    restoreOriginal,
  };
});
