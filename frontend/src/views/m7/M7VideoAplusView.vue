<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { usePermission } from "@/composables/usePermission";
import { useM7MediaStore } from "@/stores/m7Media";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const media = useM7MediaStore();
const { canEdit } = usePermission();
const videoEl = ref<HTMLVideoElement | null>(null);
const activeSegIdx = ref(0);

watch(
  () => ws.summary,
  () => {
    media.syncFromSummary();
  },
  { immediate: true }
);

onMounted(() => {
  media.syncFromSummary();
});

onUnmounted(() => {
  if (videoEl.value) {
    videoEl.value.pause();
    videoEl.value.removeAttribute("src");
  }
});
</script>

<template>
  <div class="grid-2">
    <!-- 左栏：15 秒短视频合成与 3 段分镜控制 -->
    <div>
      <div class="card">
        <div class="card-title">
          <span>M7-3 商品短视频制作（15 秒 9:16 三段分镜）</span>
          <span class="pill" :class="ws.healthInfo?.video_ready ? 'p-green' : 'p-red'">
            {{ ws.healthInfo?.video_ready ? "FFmpeg 就绪" : "FFmpeg 未配置（503 门禁）" }}
          </span>
        </div>

        <div v-if="media.videoError" class="alert alert-red">
          <strong>操作/合成提示：</strong>{{ media.videoError }}
          <div style="margin-top:4px;font-size:12px;">
            系统绝不伪造空 MP4；前序 M7-1 文案与 M7-2 1+4 套图成果（当前 {{ ws.doneCnt }}/8）已完整保留。
          </div>
        </div>

        <div class="grid-3" style="margin-bottom:10px;">
          <div>
            <label class="field-label">脚本风格</label>
            <select v-model="media.scriptStyle" class="select" :disabled="!canEdit">
              <option value="产品展示">产品展示</option>
              <option value="开箱测评">开箱测评</option>
              <option value="场景种草">场景种草</option>
              <option value="卖点快剪">卖点快剪</option>
            </select>
          </div>
          <div>
            <label class="field-label">配音音色</label>
            <select v-model="media.voiceOver" class="select" :disabled="!canEdit">
              <option value="女声">女声 (Warm EN)</option>
              <option value="男声">男声 (Crisp Pro)</option>
              <option value="无配音">无配音（仅字幕+BGM）</option>
            </select>
          </div>
          <div>
            <label class="field-label">背景配乐 (BGM)</label>
            <select v-model="media.bgm" class="select" :disabled="!canEdit">
              <option value="Upbeat Acoustic">轻快原声吉他 (Upbeat Acoustic)</option>
              <option value="Modern Tech Beat">科技节奏 (Modern Tech)</option>
              <option value="Soft Lifestyle">舒缓居家 (Soft Lifestyle)</option>
            </select>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;">
            <input v-model="media.useM7Copy" type="checkbox" :disabled="!canEdit" />
            <span>自动引用 M7-1 选定标题与卖点生成字幕</span>
          </label>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!canEdit || media.busy"
            @click="media.generateVideo()"
          >
            {{ media.busy ? "合成 MP4 中..." : "🎬 合成 15 秒竖屏短视频 (.mp4)" }}
          </button>
        </div>

        <div v-if="media.videoUrl" style="margin-top:12px;">
          <video
            ref="videoEl"
            :src="media.videoUrl"
            controls
            style="width:100%;max-height:360px;border-radius:10px;background:#0f172a;"
          />
        </div>
        <div
          v-else
          style="padding:12px;border:1px dashed #cbd5e1;border-radius:10px;background:#0f172a;color:#f8fafc;"
        >
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="pill p-blue">分镜预览窗 · {{ media.scriptStyle }} · {{ media.voiceOver }}</span>
            <span class="pill p-amber">{{ ws.healthInfo?.video_ready ? "待合成" : "未配置合成节点" }}</span>
          </div>
          <div style="font-size:13px;font-weight:600;margin-bottom:4px;">
            [分镜 {{ activeSegIdx + 1 }}] {{ media.segments[activeSegIdx]?.title }} ({{ media.segments[activeSegIdx]?.motion }})
          </div>
          <div style="font-size:12.5px;color:#cbd5e1;">
            EN: {{ media.segments[activeSegIdx]?.sub_en }}<br />
            CN: {{ media.segments[activeSegIdx]?.sub_cn }}
          </div>
        </div>
      </div>

      <!-- 3 段分镜热编辑（无论 FFmpeg 是否就绪始终可用，支持引用 M7-1） -->
      <div class="card">
        <div class="card-title">
          <span>3 段分镜脚本文案与单镜控制（v{{ media.videoVersion }}）</span>
        </div>
        <div
          v-for="seg in media.segments"
          :key="seg.seg_idx"
          style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px;overflow:hidden;"
          :style="activeSegIdx === seg.seg_idx ? { borderColor: '#2563eb' } : undefined"
          @click="activeSegIdx = seg.seg_idx"
        >
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <strong class="m7-vid-seg" style="flex:1;min-width:140px;white-space:normal;word-break:break-word;">
              {{ seg.title }} ({{ seg.duration_sec }}s)
            </strong>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button
                type="button"
                class="btn btn-sm"
                :disabled="!canEdit"
                @click.stop="media.fillSegmentFromM7Copy(seg.seg_idx)"
              >
                📥 引用M7-1
              </button>
              <button
                type="button"
                class="btn btn-sm"
                :disabled="!canEdit || media.busy"
                @click.stop="media.saveSegmentEdit(seg.seg_idx, seg)"
              >
                保存分镜
              </button>
              <button
                type="button"
                class="btn btn-sm btn-primary"
                :disabled="!canEdit || media.busy || !media.videoUrl"
                @click.stop="media.regenerateSegment(seg.seg_idx)"
              >
                🔄 重做本镜
              </button>
            </div>
          </div>
          <div class="grid-2" style="gap:8px;">
            <div>
              <label class="field-label">引用套图图位 (0-4)</label>
              <input v-model.number="seg.slot_idx" type="number" min="0" max="4" class="input" :disabled="!canEdit" />
            </div>
            <div>
              <label class="field-label">运镜模式</label>
              <select v-model="seg.motion" class="select" :disabled="!canEdit">
                <option value="zoom_in">微距慢推 (zoom_in)</option>
                <option value="pan_left">平滑横移 (pan_left)</option>
                <option value="zoom_out">轻缓拉远 (zoom_out)</option>
              </select>
            </div>
          </div>
          <div style="margin-top:6px;">
            <label class="field-label">英文字幕</label>
            <input v-model="seg.sub_en" class="input" :disabled="!canEdit" />
          </div>
          <div style="margin-top:6px;">
            <label class="field-label">中文字幕</label>
            <input v-model="seg.sub_cn" class="input" :disabled="!canEdit" />
          </div>
        </div>
      </div>
    </div>

    <!-- 右栏：A+ 图文详情长页组装 -->
    <div>
      <div class="card">
        <div class="card-title">
          <span>A+ 图文详情长页组装（消费 M7-1 文案 + M7-2 套图 + M0-2 实标参数）</span>
          <span class="pill" :class="media.aplusHtml ? 'p-green' : 'p-gray'">
            {{ media.aplusHtml ? "已组装 ✓" : "待组装" }}
          </span>
        </div>

        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select v-model="media.aplusTheme" class="select" style="width:180px;" :disabled="!canEdit">
            <option value="Clean Modern">极简现代白 (Clean Modern)</option>
            <option value="Tech Dark">科技深邃黑 (Tech Dark)</option>
            <option value="Warm Lifestyle">温暖生活美学 (Warm Lifestyle)</option>
          </select>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!canEdit || media.busy"
            @click="media.generateAplus()"
          >
            {{ media.busy ? "组装中..." : "🧩 一键组装 A+ 图文详情长页" }}
          </button>
        </div>

        <div
          v-if="media.aplusHtml"
          class="aplus-preview-shell"
          v-html="media.aplusHtml"
        />
        <div v-else class="alert alert-blue" style="margin-top:12px;margin-bottom:0;">
          点击「一键组装 A+ 图文详情长页」后，服务端将自动融合 <strong>M7-1 文案 + M7-2 1+4 真实商品套图 + M0-2 实标参数表</strong>，执行 HTML XSS 转义并计入 8/8 核心交付进度。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aplus-preview-shell {
  margin-top: 14px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
}
.aplus-preview-shell :deep(.m7-aplus-page) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #1e293b;
  background: #ffffff;
}
.aplus-preview-shell :deep(.aplus-hero) {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 16px;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
  color: #ffffff;
}
.aplus-preview-shell :deep(.m7-aplus-page[data-theme="Warm Lifestyle"] .aplus-hero) {
  background: linear-gradient(135deg, #78350f 0%, #b45309 100%);
}
.aplus-preview-shell :deep(.m7-aplus-page[data-theme="Clean Modern"] .aplus-hero) {
  background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%);
  color: #0f172a;
  border-bottom: 1px solid #e2e8f0;
}
.aplus-preview-shell :deep(.aplus-brand-tag) {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.16);
  margin-bottom: 8px;
}
.aplus-preview-shell :deep(.aplus-hero h2) {
  margin: 0 0 6px;
  font-size: 16px;
  line-height: 1.4;
}
.aplus-preview-shell :deep(.aplus-sub) {
  margin: 0;
  font-size: 12px;
  opacity: 0.82;
}
.aplus-preview-shell :deep(.aplus-hero-media) {
  background: #ffffff;
  border-radius: 10px;
  padding: 8px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.25);
}
.aplus-preview-shell :deep(.aplus-hero-media img) {
  width: 100%;
  max-height: 165px;
  object-fit: contain;
}
.aplus-preview-shell :deep(.aplus-story) {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 16px;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid #e2e8f0;
}
.aplus-preview-shell :deep(.aplus-story-media img) {
  width: 100%;
  max-height: 190px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
}
.aplus-preview-shell :deep(.aplus-story-body h3) {
  margin: 0 0 6px;
  font-size: 15px;
  color: #0f172a;
}
.aplus-preview-shell :deep(.aplus-story-body p) {
  margin: 0 0 10px;
  font-size: 12.5px;
  color: #475569;
  line-height: 1.5;
}
.aplus-preview-shell :deep(.aplus-bullets) {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
}
.aplus-preview-shell :deep(.aplus-bullets li) {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  line-height: 1.45;
}
.aplus-preview-shell :deep(.aplus-dot) {
  color: #059669;
  font-weight: 700;
  flex-shrink: 0;
}
.aplus-preview-shell :deep(.aplus-gallery-wrap),
.aplus-preview-shell :deep(.aplus-specs-wrap) {
  padding: 16px 20px;
}
.aplus-preview-shell :deep(.aplus-sec-hdr) {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 10px;
  padding-left: 8px;
  border-left: 3px solid #2563eb;
}
.aplus-preview-shell :deep(.aplus-gallery) {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.aplus-preview-shell :deep(.aplus-gal-card) {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #f8fafc;
}
.aplus-preview-shell :deep(.aplus-gal-card img) {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: contain;
  background: #ffffff;
  display: block;
}
.aplus-preview-shell :deep(.aplus-gal-cap) {
  padding: 6px 8px;
  font-size: 11px;
  color: #334155;
  text-align: center;
}
.aplus-preview-shell :deep(.aplus-specs) {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.aplus-preview-shell :deep(.aplus-specs th),
.aplus-preview-shell :deep(.aplus-specs td) {
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  text-align: left;
}
.aplus-preview-shell :deep(.aplus-specs th) {
  width: 34%;
  background: #f1f5f9;
  color: #334155;
  font-weight: 600;
}
.aplus-preview-shell :deep(.aplus-specs tr:nth-child(even) td) {
  background: #f8fafc;
}
</style>
