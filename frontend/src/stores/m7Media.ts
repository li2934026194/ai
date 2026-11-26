import { defineStore } from "pinia";
import { ref } from "vue";
import { M7ApiError } from "@/api/client";
import { m7Api, type ImageSlotDTO, type VideoSegmentDTO } from "@/api/m7";
import { useM7WorkspaceStore } from "./m7Workspace";

export const DEFAULT_SLOT_NOTES: Record<string, string> = {
  "0": "纯白底 #FFFFFF 商品主图，主体占比 85%，严禁促销角标或水印",
  "1": "真实使用场景图，自然采光构图，仅展示 M0-2 实标配件",
  "2": "核心性能卖点标注图，突出真实参数指标",
  "3": "尺寸与容量标尺对比图，比例精确",
  "4": "包装清单与质保卡全览图，严格对齐 M0-2 配件清单",
};

function makeDefaultSegments(productName: string): VideoSegmentDTO[] {
  return [
    {
      seg_idx: 0,
      title: "0-3s 痛点吸睛钩子",
      slot_idx: 0,
      duration_sec: 3,
      motion: "zoom_in",
      sub_en: `Meet ${productName}`,
      sub_cn: `3秒吸睛开场：${productName}`,
    },
    {
      seg_idx: 1,
      title: "3-11s 核心卖点实拍演示",
      slot_idx: 2,
      duration_sec: 8,
      motion: "pan_left",
      sub_en: "Verified performance & food-grade detail",
      sub_cn: "核心参数与真实现场演示（严格匹配 M0-2 主档）",
    },
    {
      seg_idx: 2,
      title: "11-15s 行动号召收尾",
      slot_idx: 4,
      duration_sec: 4,
      motion: "zoom_out",
      sub_en: "Ready for daily use — shop now",
      sub_cn: "全套规格一目了然，立即选购",
    },
  ];
}

export const useM7MediaStore = defineStore("m7Media", () => {
  const style = ref("Studio Minimalist");
  const angle = ref("45° 立体俯拍");
  const aspect = ref<"1:1" | "4:5" | "3:4" | "16:9">("1:1");
  const avoidTerms = ref("watermark, extra accessories, promo badge");
  const hasAiPerson = ref(true);
  const aiPersonSlots = ref<number[]>([1]);
  const slotNotes = ref<Record<string, string>>({ ...DEFAULT_SLOT_NOTES });
  const activeSlotIdx = ref(0);

  const imageSlots = ref<ImageSlotDTO[]>([]);
  const compareModal = ref<{
    open: boolean;
    slotIdx: number;
    beforeUrl: string;
    afterUrl: string;
    instruction: string;
  }>({ open: false, slotIdx: 0, beforeUrl: "", afterUrl: "", instruction: "" });

  const scriptStyle = ref("产品展示");
  const voiceOver = ref("女声");
  const bgm = ref("Upbeat Acoustic");
  const useM7Copy = ref(true);
  const videoUrl = ref("");
  const videoVersion = ref(1);
  const videoError = ref("");
  const segments = ref<VideoSegmentDTO[]>(makeDefaultSegments("商品"));

  const aplusHtml = ref("");
  const busy = ref(false);
  const mediaError = ref("");

  function toggleAiPerson(enabled: boolean) {
    hasAiPerson.value = enabled;
    aiPersonSlots.value = enabled ? [1] : [];
  }

  function resetSlotNote(idx: number) {
    slotNotes.value[String(idx)] = DEFAULT_SLOT_NOTES[String(idx)] || "";
  }

  function syncFromSummary() {
    const ws = useM7WorkspaceStore();
    const bp = ws.summary?.buyer_preview;
    const prodName = ws.currentProduct?.name || ws.currentSku;
    if (!bp) {
      imageSlots.value = [];
      videoUrl.value = "";
      segments.value = makeDefaultSegments(prodName);
      aplusHtml.value = "";
      return;
    }
    imageSlots.value = bp.images || [];
    if (bp.video) {
      videoUrl.value = bp.video.media_url;
      videoVersion.value = bp.video.version;
      segments.value =
        bp.video.segments && bp.video.segments.length === 3
          ? bp.video.segments
          : makeDefaultSegments(prodName);
    } else {
      videoUrl.value = "";
      segments.value = makeDefaultSegments(prodName);
    }
    aplusHtml.value = bp.aplus_html || "";
  }

  async function submitAndSyncImages() {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    mediaError.value = "";
    try {
      const sub = await m7Api.submitImageBatch(
        {
          sku: ws.currentSku,
          platform: ws.platform,
          style: style.value,
          aspect: aspect.value,
          avoid_terms: avoidTerms.value
            .split(/[,，]/)
            .map((x) => x.trim())
            .filter(Boolean),
          ai_person_slots: hasAiPerson.value ? aiPersonSlots.value : [],
          slot_notes: slotNotes.value,
        },
        `imgbatch-${ws.currentSku}-${ws.platform}-${Date.now()}`
      );
      const synced = await m7Api.syncJob(sub.job_id);
      imageSlots.value = synced.slots;
      await ws.hydrateSummary();
      ws.showToast("1+4 套图生成并写入磁盘 IPTC/XMP 完成");
    } catch (e) {
      if (e instanceof M7ApiError) mediaError.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  async function regenerateSlot(slotIdx: number, instruction?: string) {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    mediaError.value = "";
    try {
      await m7Api.regenerateImageSlot(
        slotIdx,
        {
          sku: ws.currentSku,
          platform: ws.platform,
          style: style.value,
          aspect: aspect.value,
          instruction: instruction ?? slotNotes.value[String(slotIdx)] ?? "",
          ai_person_flag: hasAiPerson.value && aiPersonSlots.value.includes(slotIdx),
        },
        `regen-${ws.currentSku}-${slotIdx}-${Date.now()}`
      );
      await ws.hydrateSummary();
      syncFromSummary();
      ws.showToast(`已完成图位 img_${slotIdx} 单图重绘（其余 4 张不变）`);
    } catch (e) {
      if (e instanceof M7ApiError) mediaError.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  async function inpaintSlot(slotIdx: number, instruction: string) {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    mediaError.value = "";
    try {
      const res = await m7Api.inpaintImageSlot(
        slotIdx,
        {
          sku: ws.currentSku,
          platform: ws.platform,
          style: style.value,
          aspect: aspect.value,
          instruction,
          ai_person_flag: hasAiPerson.value && aiPersonSlots.value.includes(slotIdx),
        },
        `inpaint-${ws.currentSku}-${slotIdx}-${Date.now()}`
      );
      await ws.hydrateSummary();
      syncFromSummary();
      compareModal.value = {
        open: true,
        slotIdx,
        beforeUrl: res.before_media_url || res.media_url,
        afterUrl: res.media_url,
        instruction,
      };
      ws.showToast(`图位 img_${slotIdx} 局部精修完成`);
    } catch (e) {
      if (e instanceof M7ApiError) mediaError.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  async function runIptcAction(mode: "verify" | "simulate_strip" | "rewrite", slotIdx?: number) {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    mediaError.value = "";
    try {
      const res = await m7Api.verifyIptc({
        sku: ws.currentSku,
        platform: ws.platform,
        mode,
        slot_idx: slotIdx,
      });
      await ws.hydrateSummary();
      syncFromSummary();
      ws.showToast(
        res.all_verified
          ? "磁盘真实读回校验：全部 IPTC/XMP 双标记完好"
          : "警告：检测到磁盘图片 IPTC/XMP 标签缺失，请执行一键重写修复"
      );
    } catch (e) {
      if (e instanceof M7ApiError) mediaError.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  function fillSegmentFromM7Copy(segIdx: number): boolean {
    const ws = useM7WorkspaceStore();
    const copyMap = ws.summary?.selected_copy_assets || {};
    const titleAsset = copyMap["copy_title"];
    const bulletsAsset = copyMap["copy_bullets"];
    const titleTxt = titleAsset?.content_json?.text?.trim() || "";
    const bulletsTxt = bulletsAsset?.content_json?.text?.trim() || "";
    if (!titleTxt && !bulletsTxt) {
      videoError.value = "M7-1 尚未选定标题或五点描述，请先去第 1 步写入文案";
      return false;
    }
    videoError.value = "";
    const seg = segments.value[segIdx];
    if (!seg) return false;
    const raw = segIdx === 0 ? titleTxt || bulletsTxt : bulletsTxt || titleTxt;
    seg.sub_en = raw.slice(0, 72);
    seg.sub_cn = `引用 M7-1 已选文案（${segIdx === 0 ? "核心标题" : "卖点摘要"}）`;
    ws.showToast(`分镜 ${segIdx + 1} 已成功引用 M7-1 文案`);
    return true;
  }

  async function generateVideo() {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    videoError.value = "";
    try {
      const res = await m7Api.generateVideo(
        {
          sku: ws.currentSku,
          platform: ws.platform,
          script_style: scriptStyle.value,
          voice_over: voiceOver.value,
          bgm: bgm.value,
          use_m7_copy: useM7Copy.value,
          segments: segments.value.length === 3 ? segments.value : undefined,
        },
        `vid-${ws.currentSku}-${ws.platform}-${Date.now()}`
      );
      videoUrl.value = res.media_url;
      videoVersion.value = res.version;
      segments.value = res.segments;
      await ws.hydrateSummary();
      ws.showToast("15 秒短视频合成完成");
    } catch (e) {
      if (e instanceof M7ApiError) {
        videoError.value = `${e.code}: ${e.message}`;
      }
    } finally {
      busy.value = false;
    }
  }

  async function saveSegmentEdit(segIdx: number, seg: VideoSegmentDTO) {
    const ws = useM7WorkspaceStore();
    if (!videoUrl.value) {
      ws.showToast(`分镜 ${segIdx + 1} 草稿配置已更新（合成 MP4 后将自动应用）`);
      return;
    }
    busy.value = true;
    videoError.value = "";
    try {
      const res = await m7Api.editVideoSegment(segIdx, {
        sku: ws.currentSku,
        platform: ws.platform,
        version: videoVersion.value,
        slot_idx: seg.slot_idx,
        motion: seg.motion,
        sub_en: seg.sub_en,
        sub_cn: seg.sub_cn,
      });
      videoVersion.value = res.version;
      segments.value = res.segments;
      await ws.hydrateSummary();
      ws.showToast(`分镜 ${segIdx + 1} 热修改已保存`);
    } catch (e) {
      if (e instanceof M7ApiError) videoError.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  async function regenerateSegment(segIdx: number) {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    videoError.value = "";
    try {
      const res = await m7Api.regenerateVideoSegment(segIdx, {
        sku: ws.currentSku,
        platform: ws.platform,
      });
      videoVersion.value = res.version;
      segments.value = res.segments;
      await ws.hydrateSummary();
      syncFromSummary();
      ws.showToast(`第 ${segIdx + 1} 段分镜已重做并重新压制 MP4`);
    } catch (e) {
      if (e instanceof M7ApiError) videoError.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  async function generateAplus() {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    mediaError.value = "";
    try {
      const res = await m7Api.generateAplus(
        { sku: ws.currentSku, platform: ws.platform, theme: "Clean Modern" },
        `aplus-${ws.currentSku}-${ws.platform}-${Date.now()}`
      );
      aplusHtml.value = res.html;
      await ws.hydrateSummary();
      ws.showToast("A+ 图文详情长页组装完成");
    } catch (e) {
      if (e instanceof M7ApiError) mediaError.value = `${e.code}: ${e.message}`;
    } finally {
      busy.value = false;
    }
  }

  return {
    style,
    angle,
    aspect,
    avoidTerms,
    hasAiPerson,
    aiPersonSlots,
    slotNotes,
    activeSlotIdx,
    imageSlots,
    compareModal,
    scriptStyle,
    voiceOver,
    bgm,
    useM7Copy,
    videoUrl,
    videoVersion,
    videoError,
    segments,
    aplusHtml,
    busy,
    mediaError,
    toggleAiPerson,
    resetSlotNote,
    syncFromSummary,
    submitAndSyncImages,
    regenerateSlot,
    inpaintSlot,
    runIptcAction,
    fillSegmentFromM7Copy,
    generateVideo,
    saveSegmentEdit,
    regenerateSegment,
    generateAplus,
  };
});
