import { defineStore } from "pinia";
import { ref } from "vue";
import { M7ApiError } from "@/api/client";
import { m7Api, type ImageSlotDTO, type VideoSegmentDTO } from "@/api/m7";
import { useM7WorkspaceStore } from "./m7Workspace";

export const useM7MediaStore = defineStore("m7Media", () => {
  const style = ref("Studio Minimalist");
  const aspect = ref<"1:1" | "4:5" | "3:4" | "16:9">("1:1");
  const avoidTerms = ref("watermark, extra accessories");
  const aiPersonSlots = ref<number[]>([1]);

  const imageSlots = ref<ImageSlotDTO[]>([]);
  const compareModal = ref<{
    open: boolean;
    slotIdx: number;
    beforeUrl: string;
    afterUrl: string;
    instruction: string;
  }>({ open: false, slotIdx: 0, beforeUrl: "", afterUrl: "", instruction: "" });

  const bgm = ref("Upbeat Acoustic");
  const useM7Copy = ref(true);
  const videoUrl = ref("");
  const videoVersion = ref(1);
  const videoError = ref("");
  const segments = ref<VideoSegmentDTO[]>([]);

  const aplusHtml = ref("");
  const busy = ref(false);
  const mediaError = ref("");

  function syncFromSummary() {
    const ws = useM7WorkspaceStore();
    const bp = ws.summary?.buyer_preview;
    if (!bp) {
      imageSlots.value = [];
      videoUrl.value = "";
      segments.value = [];
      aplusHtml.value = "";
      return;
    }
    imageSlots.value = bp.images || [];
    if (bp.video) {
      videoUrl.value = bp.video.media_url;
      videoVersion.value = bp.video.version;
      segments.value = bp.video.segments || [];
    } else {
      videoUrl.value = "";
      segments.value = [];
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
          ai_person_slots: aiPersonSlots.value,
          slot_notes: {},
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

  async function regenerateSlot(slotIdx: number, instruction = "") {
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
          instruction,
          ai_person_flag: aiPersonSlots.value.includes(slotIdx),
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
          ai_person_flag: aiPersonSlots.value.includes(slotIdx),
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

  async function generateVideo() {
    const ws = useM7WorkspaceStore();
    busy.value = true;
    videoError.value = "";
    try {
      const res = await m7Api.generateVideo(
        {
          sku: ws.currentSku,
          platform: ws.platform,
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
    aspect,
    avoidTerms,
    aiPersonSlots,
    imageSlots,
    compareModal,
    bgm,
    useM7Copy,
    videoUrl,
    videoVersion,
    videoError,
    segments,
    aplusHtml,
    busy,
    mediaError,
    syncFromSummary,
    submitAndSyncImages,
    regenerateSlot,
    inpaintSlot,
    runIptcAction,
    generateVideo,
    saveSegmentEdit,
    regenerateSegment,
    generateAplus,
  };
});
