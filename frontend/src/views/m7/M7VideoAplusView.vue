<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { usePermission } from "@/composables/usePermission";
import { useM7MediaStore } from "@/stores/m7Media";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const media = useM7MediaStore();
const { canEdit } = usePermission();
const videoEl = ref<HTMLVideoElement | null>(null);

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
          <strong>合成被后端真实阻断：</strong>{{ media.videoError }}
          <div style="margin-top:4px;font-size:12px;">
            系统绝不伪造空 MP4；前序 M7-1 文案与 M7-2 1+4 套图成果（当前 {{ ws.doneCnt }}/8）已完整保留。
          </div>
        </div>

        <div class="grid-2" style="margin-bottom:10px;">
          <div>
            <label class="field-label">背景配乐风格 (BGM)</label>
            <select v-model="media.bgm" class="select" :disabled="!canEdit">
              <option value="Upbeat Acoustic">轻快原声吉他 (Upbeat Acoustic)</option>
              <option value="Modern Tech Beat">科技节奏 (Modern Tech)</option>
              <option value="Soft Lifestyle">舒缓居家 (Soft Lifestyle)</option>
            </select>
          </div>
          <div style="display:flex;align-items:flex-end;padding-bottom:6px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;">
              <input v-model="media.useM7Copy" type="checkbox" :disabled="!canEdit" />
              <span>自动引用 M7-1 选定标题与卖点生成字幕</span>
            </label>
          </div>
        </div>

        <button
          type="button"
          class="btn btn-primary"
          :disabled="!canEdit || media.busy"
          @click="media.generateVideo()"
        >
          {{ media.busy ? "合成 MP4 中..." : "🎬 合成 15 秒竖屏短视频 (.mp4)" }}
        </button>

        <div v-if="media.videoUrl" style="margin-top:14px;">
          <video
            ref="videoEl"
            :src="media.videoUrl"
            controls
            style="width:100%;max-height:360px;border-radius:10px;background:#0f172a;"
          />
        </div>
      </div>

      <!-- 3 段分镜热编辑 -->
      <div v-if="media.segments.length > 0" class="card">
        <div class="card-title">
          <span>3 段分镜脚本文案与单镜重做（v{{ media.videoVersion }}）</span>
        </div>
        <div
          v-for="seg in media.segments"
          :key="seg.seg_idx"
          style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px;"
        >
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <strong>{{ seg.title }} ({{ seg.duration_sec }}s)</strong>
            <div style="display:flex;gap:6px;">
              <button
                type="button"
                class="btn btn-sm"
                :disabled="!canEdit || media.busy"
                @click="media.saveSegmentEdit(seg.seg_idx, seg)"
              >
                保存分镜
              </button>
              <button
                type="button"
                class="btn btn-sm btn-primary"
                :disabled="!canEdit || media.busy"
                @click="media.regenerateSegment(seg.seg_idx)"
              >
                仅重做本镜
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
                <option value="zoom_in">缓慢推进 (zoom_in)</option>
                <option value="pan_left">横向平移 (pan_left)</option>
                <option value="zoom_out">全景拉远 (zoom_out)</option>
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

        <button
          type="button"
          class="btn btn-primary"
          :disabled="!canEdit || media.busy"
          @click="media.generateAplus()"
        >
          {{ media.busy ? "组装中..." : "🧩 一键组装 A+ 图文详情长页" }}
        </button>

        <div
          v-if="media.aplusHtml"
          style="margin-top:14px;padding:12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;"
          v-html="media.aplusHtml"
        />
        <div v-else class="alert alert-blue" style="margin-top:12px;margin-bottom:0;">
          点击「一键组装 A+ 图文详情长页」后，服务端会自动执行 HTML XSS 转义并计入 8/8 核心交付进度。
        </div>
      </div>
    </div>
  </div>
</template>
