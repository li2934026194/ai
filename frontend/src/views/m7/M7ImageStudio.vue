<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { usePermission } from "@/composables/usePermission";
import { useM7MediaStore } from "@/stores/m7Media";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const media = useM7MediaStore();
const { canEdit, canRunCompliance } = usePermission();

const inpaintTargetIdx = ref<number | null>(null);
const inpaintInstruction = ref("去除底部边缘反光并提亮白色主体");
const inpaintError = ref("");
const showPromptAdvanced = ref(false);

const iptcPassedCount = computed(
  () => media.imageSlots.filter((s) => s.iptc_verified).length
);

const assembledPromptPreview = computed(() => {
  const prod = ws.currentProduct;
  const skuLabel = prod ? `${prod.sku} ${prod.name}` : ws.currentSku;
  const note = media.slotNotes[String(media.activeSlotIdx)] || "";
  const neg = media.avoidTerms || "watermark";
  return `[Subject Lock: ${skuLabel}] Style=${media.style} | Angle=${media.angle} | Aspect=${media.aspect} | Slot=img_${media.activeSlotIdx} | Directive="${note}" | --no ${neg}`;
});

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

function openInpaintModal(slotIdx: number) {
  inpaintTargetIdx.value = slotIdx;
  inpaintError.value = "";
}

async function submitInpaint() {
  if (inpaintTargetIdx.value === null) return;
  if (!inpaintInstruction.value.trim()) {
    inpaintError.value = "请填写局部修改要求";
    return;
  }
  const idx = inpaintTargetIdx.value;
  inpaintTargetIdx.value = null;
  inpaintError.value = "";
  await media.inpaintSlot(idx, inpaintInstruction.value.trim());
}
</script>

<template>
  <div>
    <!-- 归纳 KPI 条 -->
    <div class="grid-4" style="margin-bottom:14px;">
      <div class="kpi-card">
        <div class="kpi-label">1+4 套图生成</div>
        <div class="kpi-val" :style="{ color: media.imageSlots.length === 5 ? '#047857' : '#1d4ed8' }">{{ media.imageSlots.length }} / 5</div>
        <div class="kpi-sub">1 白底主图 + 4 附图</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">IPTC/XMP 合规校验</div>
        <div class="kpi-val" :style="{ color: iptcPassedCount === 5 ? '#047857' : '#b45309' }">{{ iptcPassedCount }} / 5</div>
        <div class="kpi-sub">AI 元数据读盘校验</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">AI 人物声明</div>
        <div class="kpi-val">{{ media.hasAiPerson ? "开启" : "关闭" }}</div>
        <div class="kpi-sub">{{ media.hasAiPerson ? "含合成人物双标签" : "纯商品静物棚拍" }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">画幅与视角</div>
        <div class="kpi-val">{{ media.aspect }}</div>
        <div class="kpi-sub">{{ media.angle }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>1+4 套图配置与合规落盘</span>
        <span class="pill p-blue">末端写入 IPTC/XMP</span>
      </div>

      <div v-if="media.mediaError" class="alert alert-red">{{ media.mediaError }}</div>

      <div class="grid-3" style="margin-bottom:10px;">
        <div>
          <label class="field-label">视觉风格</label>
          <select v-model="media.style" class="select" :disabled="!canEdit">
            <option value="Studio Minimalist">极简白底影棚 (Studio Minimalist)</option>
            <option value="Warm Kitchen Lifestyle">欧美居家生活方式 (Warm Lifestyle)</option>
            <option value="Tech Macro Detail">工业参数微距 (Tech Macro)</option>
          </select>
        </div>
        <div>
          <label class="field-label">镜头视角与比例</label>
          <div style="display:flex;gap:6px;">
            <select v-model="media.angle" class="select" :disabled="!canEdit">
              <option value="45° 立体俯拍">45° 立体俯拍</option>
              <option value="正视平拍白底">正视平拍白底</option>
              <option value="微距特写">微距特写</option>
            </select>
            <select v-model="media.aspect" class="select" :disabled="!canEdit">
              <option value="1:1">1:1 主图</option>
              <option value="4:5">4:5 详情</option>
              <option value="3:4">3:4 竖版</option>
            </select>
          </div>
        </div>
        <div>
          <label class="field-label">负向约束 (--no)</label>
          <input v-model="media.avoidTerms" class="input" :disabled="!canEdit" />
        </div>
      </div>

      <!-- AI 人物开关 & 5 个图位独立设计要求 -->
      <div style="padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
          <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;cursor:pointer;">
            <input
              :checked="media.hasAiPerson"
              type="checkbox"
              :disabled="!canEdit"
              @change="media.toggleAiPerson(($event.target as HTMLInputElement).checked)"
            />
            <span>包含 AI 合成人物出镜（自动写入 contains-synthetic-performer 双标签）</span>
          </label>
          <button type="button" class="btn btn-sm" @click="showPromptAdvanced = !showPromptAdvanced">
            {{ showPromptAdvanced ? "收起 Prompt ▲" : "查看 Prompt ▼" }}
          </button>
        </div>

        <div
          v-if="showPromptAdvanced"
          style="margin-bottom:8px;padding:8px 10px;background:#0f172a;color:#e2e8f0;border-radius:6px;font-size:11.5px;font-family:monospace;word-break:break-word;"
        >
          {{ assembledPromptPreview }}
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
          <button
            v-for="idx in [0, 1, 2, 3, 4]"
            :key="idx"
            type="button"
            class="btn btn-sm"
            :class="media.activeSlotIdx === idx ? 'btn-primary' : ''"
            @click="media.activeSlotIdx = idx"
          >
            {{ idx === 0 ? "图位 1 (白底主图)" : `图位 ${idx + 1}` }}
          </button>
        </div>

        <div style="display:flex;gap:8px;align-items:center;">
          <input
            v-model="media.slotNotes[String(media.activeSlotIdx)]"
            class="input"
            :disabled="!canEdit"
            placeholder="输入当前图位独立设计要求..."
          />
          <button
            type="button"
            class="btn btn-sm"
            :disabled="!canEdit"
            @click="media.resetSlotNote(media.activeSlotIdx)"
          >
            ↺ 恢复推荐
          </button>
        </div>
      </div>

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button
          type="button"
          class="btn btn-primary btn-lg"
          :disabled="!canEdit || media.busy"
          @click="media.submitAndSyncImages()"
        >
          {{ media.busy ? "渲染写入中..." : "🎨 生成并落盘 1+4 套图" }}
        </button>

        <button
          type="button"
          class="btn"
          :disabled="!canEdit || media.busy || media.imageSlots.length === 0"
          @click="media.regenerateSlot(media.activeSlotIdx)"
        >
          🔄 重绘当前图位
        </button>

        <button
          type="button"
          class="btn"
          :disabled="!canEdit || media.busy || media.imageSlots.length === 0"
          @click="openInpaintModal(media.activeSlotIdx)"
        >
          ✏️ 局部精修
        </button>

        <button
          type="button"
          class="btn"
          :disabled="!canRunCompliance || media.busy || media.imageSlots.length === 0"
          @click="media.runIptcAction('verify')"
        >
          🔍 校验 IPTC
        </button>

        <button
          type="button"
          class="btn"
          :disabled="!canRunCompliance || media.busy || media.imageSlots.length === 0"
          @click="media.runIptcAction('simulate_strip', 1)"
        >
          🧪 模拟剥离
        </button>

        <button
          type="button"
          class="btn btn-success"
          :disabled="!canRunCompliance || media.busy || media.imageSlots.length === 0"
          @click="media.runIptcAction('rewrite')"
        >
          🛠 重写修复标签
        </button>
      </div>
    </div>

    <!-- 1+4 画廊 -->
    <div v-if="media.imageSlots.length === 0" class="summary-bar">
      <span class="pill p-blue">待生成</span>
      <span>尚未生成 1+4 套图，请点击上方「生成并落盘 1+4 套图」。</span>
    </div>

    <div v-else class="grid-5">
      <div
        v-for="slot in media.imageSlots"
        :key="slot.asset_id"
        class="card"
        :style="{
          padding: '10px',
          marginBottom: '0',
          borderColor: media.activeSlotIdx === slot.slot_idx ? '#2563eb' : undefined,
          cursor: 'pointer',
        }"
        @click="media.activeSlotIdx = slot.slot_idx"
      >
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="font-size:12.5px;">{{ slot.slot_idx === 0 ? "0. 白底主图" : `${slot.slot_idx}. 附图` }}</strong>
          <span class="pill p-gray">v{{ slot.version }}</span>
        </div>

        <img
          :src="slot.media_url"
          :alt="slot.asset_slot"
          style="width:100%;aspect-ratio:1/1;object-fit:contain;border:1px solid #e2e8f0;border-radius:8px;background:#fff;"
        />

        <div style="margin:6px 0;display:flex;flex-wrap:wrap;gap:4px;">
          <span class="pill p-blue">演示图</span>
          <span class="pill" :class="slot.iptc_verified ? 'p-green' : 'p-red'">
            {{ slot.iptc_verified ? "IPTC ✓" : "IPTC ✕" }}
          </span>
          <span v-if="slot.ai_person_flag" class="pill p-purple">AI 人物</span>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button
            type="button"
            class="btn btn-sm"
            :disabled="!canEdit || media.busy"
            @click.stop="media.regenerateSlot(slot.slot_idx)"
          >
            重绘
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :disabled="!canEdit || media.busy"
            @click.stop="openInpaintModal(slot.slot_idx)"
          >
            精修
          </button>
        </div>
      </div>
    </div>

    <!-- 局部修改输入弹框 -->
    <div v-if="inpaintTargetIdx !== null" class="modal-backdrop">
      <div class="modal-card" style="width:min(480px, 100%);">
        <h3 style="margin-top:0;">局部精修 · 图位 img_{{ inpaintTargetIdx }}</h3>
        <label class="field-label" for="inpaintPrompt">局部修改指令（仅重渲染当前图位）</label>
        <textarea
          id="inpaintPrompt"
          v-model="inpaintInstruction"
          class="textarea"
          :style="inpaintError ? { borderColor: '#dc2626' } : undefined"
        />
        <div v-if="inpaintError" class="alert alert-red" style="margin-top:8px;margin-bottom:0;">
          {{ inpaintError }}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
          <button type="button" class="btn" @click="inpaintTargetIdx = null">取消</button>
          <button type="button" class="btn btn-primary" @click="submitInpaint()">应用局部修改</button>
        </div>
      </div>
    </div>

    <!-- 局部修改前后对比弹框 -->
    <div v-if="media.compareModal.open" class="modal-backdrop">
      <div class="modal-card">
        <div class="card-title">
          <span>局部修改对比（img_{{ media.compareModal.slotIdx }}）</span>
          <button type="button" class="btn btn-sm" @click="media.compareModal.open = false">关闭</button>
        </div>
        <div class="grid-2">
          <div>
            <div class="field-label">修改前原图</div>
            <img :src="media.compareModal.beforeUrl" style="width:100%;border-radius:8px;border:1px solid #cbd5e1;" />
          </div>
          <div>
            <div class="field-label">修改后新图（{{ media.compareModal.instruction }}）</div>
            <img :src="media.compareModal.afterUrl" style="width:100%;border-radius:8px;border:1px solid #2563eb;" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
