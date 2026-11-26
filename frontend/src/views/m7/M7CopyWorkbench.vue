<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { usePermission } from "@/composables/usePermission";
import {
  CORE_COPY_SLOT_DEFS,
  EXT_COPY_SLOT_DEFS,
  QUICK_MUST_CHIPS,
  highlightCopyHtml,
  useM7CopyStore,
} from "@/stores/m7Copy";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const copy = useM7CopyStore();
const { canEdit } = usePermission();
const showBilingual = ref(true);

const coreDoneCount = computed(
  () => CORE_COPY_SLOT_DEFS.filter((s) => Boolean(ws.summary?.selected_copy_assets?.[s.key])).length
);
const extDoneCount = computed(
  () => EXT_COPY_SLOT_DEFS.filter((s) => Boolean(ws.summary?.selected_copy_assets?.[s.key])).length
);

const editorHighlightHtml = computed(() => {
  const sr = copy.scanResult;
  const must = sr?.must_hits || [];
  const bad = [
    ...(sr?.ban_hits || []),
    ...(sr?.trademark_hits || []),
    ...(sr?.regulatory_hits || []),
  ];
  return highlightCopyHtml(copy.editingText, must, bad);
});

function switchSlot(slotKey: string) {
  copy.activeSlot = slotKey;
  copy.variants = [];
  copy.loadSelectedFromSummary();
}

watch(
  () => [ws.currentSku, ws.platform, ws.summary],
  () => {
    copy.loadSelectedFromSummary();
  },
  { immediate: true }
);

onMounted(() => {
  copy.loadSelectedFromSummary();
});
</script>

<template>
  <div>
    <!-- 归纳 KPI 条 -->
    <div class="grid-4" style="margin-bottom:14px;">
      <div class="kpi-card">
        <div class="kpi-label">核心文案槽位</div>
        <div class="kpi-val" :style="{ color: coreDoneCount === 4 ? '#047857' : '#1d4ed8' }">{{ coreDoneCount }} / 4</div>
        <div class="kpi-sub">标题 · 五点 · 描述 · 搜索词</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">扩展文案槽位</div>
        <div class="kpi-val">{{ extDoneCount }} / 6</div>
        <div class="kpi-sub">独立统计不占核心进度</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">当前定价 / 类目</div>
        <div class="kpi-val">${{ ws.currentProduct?.sale_price_usd ?? "--" }}</div>
        <div class="kpi-sub">{{ ws.currentProduct?.category_label_zh || "-" }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">当前槽位扫描状态</div>
        <div class="kpi-val" :style="{ color: copy.scanResult?.passed === false ? '#b91c1c' : '#047857' }">
          {{ copy.scanResult ? (copy.scanResult.passed ? "合规通过" : "命中拦截") : "待扫描" }}
        </div>
        <div class="kpi-sub">三层词库 + 长度门禁</div>
      </div>
    </div>

    <!-- 紧凑事实与痛点锚定条 -->
    <div v-if="ws.currentProduct" class="summary-bar" style="flex-wrap:wrap;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span class="pill p-blue">M0 实标参数</span>
        <span
          v-for="(val, key) in ws.currentProduct.specs"
          :key="key"
          class="pill p-gray"
        >
          {{ key }}: {{ val || "待补" }}
        </span>
      </div>
      <div v-if="ws.currentProduct.faq?.pain_points?.length" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span class="pill p-amber">M1 买家痛点</span>
        <span style="font-size:12px;">{{ ws.currentProduct.faq.pain_points.join(" · ") }}</span>
      </div>
    </div>

    <!-- 槽位切换与生成配置 -->
    <div class="card">
      <div class="card-title">
        <span>文案交付槽位与生成配置</span>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:400;cursor:pointer;">
          <input v-model="showBilingual" type="checkbox" />
          <span>高亮透视预览</span>
        </label>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
        <button
          v-for="s in CORE_COPY_SLOT_DEFS"
          :key="s.key"
          type="button"
          class="btn btn-sm"
          :class="copy.activeSlot === s.key ? 'btn-primary' : ''"
          @click="switchSlot(s.key)"
        >
          {{ ws.summary?.selected_copy_assets?.[s.key] ? "✓" : "○" }} {{ s.label }}
        </button>
        <button
          v-for="s in EXT_COPY_SLOT_DEFS"
          :key="s.key"
          type="button"
          class="btn btn-sm"
          :class="copy.activeSlot === s.key ? 'btn-primary' : ''"
          @click="switchSlot(s.key)"
        >
          {{ ws.summary?.selected_copy_assets?.[s.key] ? "✓" : "·" }} {{ s.label }}
        </button>
      </div>

      <div class="grid-3" style="margin-bottom:10px;padding-top:8px;border-top:1px solid #f1f5f9;">
        <div>
          <label class="field-label">输出语言</label>
          <select v-model="copy.lang" class="select" :disabled="!canEdit">
            <option value="en-US">English (en-US)</option>
            <option value="th-TH">Thai / Bilingual (th-TH)</option>
            <option value="zh-CN">中文参考 (zh-CN)</option>
          </select>
        </div>
        <div>
          <label class="field-label">品牌必用词</label>
          <input v-model="copy.extraMust" class="input" :disabled="!canEdit" />
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;">
            <button
              v-for="chip in QUICK_MUST_CHIPS"
              :key="chip"
              type="button"
              class="btn btn-sm"
              style="height:22px;padding:0 7px;font-size:11px;"
              :disabled="!canEdit"
              @click="copy.appendMustChip(chip)"
            >
              + {{ chip }}
            </button>
          </div>
        </div>
        <div>
          <label class="field-label">附加禁用词（逗号分隔）</label>
          <input v-model="copy.extraBan" class="input" :disabled="!canEdit" />
        </div>
      </div>

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button
          type="button"
          class="btn btn-primary btn-lg"
          :disabled="!canEdit || copy.busy"
          @click="copy.generateVariants()"
        >
          {{ copy.busy ? "生成中..." : "✨ 生成 3 组合规候选" }}
        </button>
        <button
          type="button"
          class="btn btn-success btn-lg"
          :disabled="!canEdit || copy.busy"
          @click="copy.autoAdopt4CoreSlots()"
        >
          ⚡ 一键采纳 4 类核心文案
        </button>
        <span v-if="!canEdit" class="pill p-gray">当前角色只读</span>
      </div>
    </div>

    <!-- 3 组候选草稿 -->
    <div v-if="copy.variants.length > 0" class="grid-3" style="margin-bottom:14px;">
      <div v-for="v in copy.variants" :key="v.asset_id" class="card" style="margin-bottom:0;">
        <div class="card-title">
          <span>{{ v.content_json.style_label || `方案 ${v.variant_idx + 1}` }}</span>
          <span class="pill" :class="v.scan_result_json?.passed ? 'p-green' : 'p-red'">
            {{ v.scan_result_json?.passed ? "通过" : "拦截" }}
          </span>
        </div>
        <div
          style="font-size:12.5px;white-space:pre-wrap;min-height:86px;color:#1e293b;margin-bottom:10px;"
          v-html="
            highlightCopyHtml(
              v.content_json.text || '',
              v.scan_result_json?.must_hits || [],
              [
                ...(v.scan_result_json?.ban_hits || []),
                ...(v.scan_result_json?.trademark_hits || []),
                ...(v.scan_result_json?.regulatory_hits || []),
              ]
            )
          "
        />
        <button
          type="button"
          class="btn btn-sm btn-primary"
          style="width:100%;"
          :disabled="!canEdit || copy.busy"
          @click="copy.selectVariant(v)"
        >
          采纳写入交付清单
        </button>
      </div>
    </div>

    <!-- 就地微调与原稿保留 -->
    <div class="card">
      <div class="card-title">
        <span>交付文案微调与实时合规扫描（{{ copy.activeSlot }}）</span>
        <div style="display:flex;gap:6px;align-items:center;">
          <span v-if="copy.editStatus === 'MANUALLY_EDITED'" class="pill p-amber">已人工微调</span>
          <span class="pill p-gray">{{ copy.editStatus }}</span>
          <span class="pill p-blue">v{{ copy.editingVersion }}</span>
        </div>
      </div>

      <div v-if="!copy.editingAssetId" class="summary-bar">
        <span class="pill p-blue">待采纳</span>
        <span>请点击上方「生成 3 组合规候选」或「一键采纳 4 类核心文案」。</span>
      </div>

      <template v-else>
        <div v-if="copy.errorMsg" class="alert alert-red" style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span>{{ copy.errorMsg }}</span>
          <button
            v-if="copy.isConflict409"
            type="button"
            class="btn btn-sm"
            @click="copy.refreshLatestFromServer()"
          >
            刷新最新版本
          </button>
        </div>

        <textarea
          v-model="copy.editingText"
          class="textarea"
          :disabled="!canEdit"
          @input="copy.scheduleRealtimeScan()"
        />

        <div
          v-if="showBilingual"
          style="margin-top:8px;padding:8px 10px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;font-size:12.5px;white-space:pre-wrap;"
        >
          <span style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">
            词库实时高亮透视（绿底=品牌词 · 红底=拦截词）：
          </span>
          <span v-html="editorHighlightHtml" />
        </div>

        <div
          v-if="copy.scanResult"
          class="alert"
          :class="copy.scanResult.passed ? 'alert-green' : 'alert-red'"
          style="margin-top:10px;"
        >
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-weight:600;">
            <span>
              {{ copy.scanResult.passed ? "✓ 实时扫描通过" : "✕ 触发红线阻断（保存将被拒绝）" }}
            </span>
            <span class="tnum">
              {{ copy.scanResult.limit_unit === "bytes" ? copy.scanResult.utf8_bytes : copy.scanResult.char_count }}
              / {{ copy.scanResult.max_limit }} {{ copy.scanResult.limit_unit }}
            </span>
          </div>
          <div v-if="copy.scanResult.ban_hits.length" style="margin-top:4px;">
            违禁词：{{ copy.scanResult.ban_hits.join(", ") }}
          </div>
          <div v-if="copy.scanResult.trademark_hits.length" style="margin-top:4px;">
            商标词：{{ copy.scanResult.trademark_hits.join(", ") }}
          </div>
          <div v-if="copy.scanResult.regulatory_hits.length" style="margin-top:4px;">
            监管敏感词：{{ copy.scanResult.regulatory_hits.join(", ") }}
          </div>
          <div v-if="copy.scanResult.all_caps_words.length" style="margin-top:4px;color:#b45309;">
            ⚠ 全大写软提示：{{ copy.scanResult.all_caps_words.join(", ") }}
          </div>
          <div v-if="Object.keys(copy.scanResult.suggestions).length" style="margin-top:4px;">
            改写建议：
            <span
              v-for="(repl, orig) in copy.scanResult.suggestions"
              :key="orig"
              class="pill p-amber"
              style="margin-right:6px;"
            >
              {{ orig }} → {{ repl }}
            </span>
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
          <button
            type="button"
            class="btn btn-primary btn-lg"
            :disabled="!canEdit || copy.busy"
            @click="copy.saveManualEdit()"
          >
            💾 保存修改并保留原稿
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!canEdit || copy.busy"
            @click="copy.restoreOriginal()"
          >
            ↩ 还原 AI 原稿
          </button>
        </div>

        <div
          v-if="copy.origSnapshotText"
          style="margin-top:10px;padding:8px 10px;background:#f8fafc;border-radius:8px;font-size:12px;color:#475569;"
        >
          <strong>AI 不可变原稿快照：</strong>{{ copy.origSnapshotText }}
        </div>
      </template>
    </div>
  </div>
</template>
