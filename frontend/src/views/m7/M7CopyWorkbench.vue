<script setup lang="ts">
import { onMounted, watch } from "vue";
import { usePermission } from "@/composables/usePermission";
import {
  CORE_COPY_SLOT_DEFS,
  EXT_COPY_SLOT_DEFS,
  useM7CopyStore,
} from "@/stores/m7Copy";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const copy = useM7CopyStore();
const { canEdit } = usePermission();

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
    <!-- 上游只读事实快照 -->
    <div v-if="ws.currentProduct" class="card">
      <div class="card-title">
        <span>M7-1 多语言商品文案 · 上游事实与 FAQ 锚定（只读）</span>
        <span class="pill p-blue">{{ ws.currentProduct.category_label_zh }} · ${{ ws.currentProduct.sale_price_usd }}</span>
      </div>
      <div class="grid-2">
        <div>
          <div class="field-label">M0-2 主档实标参数（严禁虚构未包含配件）</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <span
              v-for="(val, key) in ws.currentProduct.specs"
              :key="key"
              class="pill p-gray"
            >
              {{ key }}: {{ val }}
            </span>
          </div>
        </div>
        <div>
          <div class="field-label">M1-2 客服知识库高频痛点</div>
          <ul style="margin:0;padding-left:18px;font-size:12.5px;color:#334155;">
            <li v-for="(pt, idx) in ws.currentProduct.faq.pain_points" :key="idx">{{ pt }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 8+N 槽位切换 -->
    <div class="card">
      <div class="card-title">
        <span>文案交付槽位（核心 4 项计入 8/8 · 扩展 6 项独立统计）</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
        <button
          v-for="s in CORE_COPY_SLOT_DEFS"
          :key="s.key"
          type="button"
          class="btn btn-sm"
          :class="copy.activeSlot === s.key ? 'btn-primary' : ''"
          @click="switchSlot(s.key)"
        >
          <span>{{ ws.summary?.selected_copy_assets?.[s.key] ? "✓" : "○" }} {{ s.label }}</span>
        </button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        <button
          v-for="s in EXT_COPY_SLOT_DEFS"
          :key="s.key"
          type="button"
          class="btn btn-sm"
          :class="copy.activeSlot === s.key ? 'btn-primary' : ''"
          @click="switchSlot(s.key)"
        >
          <span>{{ ws.summary?.selected_copy_assets?.[s.key] ? "✓" : "·" }} [扩展] {{ s.label }}</span>
        </button>
      </div>
    </div>

    <!-- 生成参数与触发 -->
    <div class="card">
      <div class="grid-3" style="margin-bottom:10px;">
        <div>
          <label class="field-label">输出语言</label>
          <select v-model="copy.lang" class="select" :disabled="!canEdit">
            <option value="en-US">English (en-US)</option>
            <option value="th-TH">Thai / Bilingual (th-TH)</option>
            <option value="zh-CN">中文参考 (zh-CN)</option>
          </select>
        </div>
        <div>
          <label class="field-label">附加品牌必用词（逗号分隔）</label>
          <input v-model="copy.extraMust" class="input" :disabled="!canEdit" />
        </div>
        <div>
          <label class="field-label">附加禁用词（逗号分隔）</label>
          <input v-model="copy.extraBan" class="input" :disabled="!canEdit" />
        </div>
      </div>

      <div style="display:flex;gap:10px;align-items:center;">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!canEdit || copy.busy"
          @click="copy.generateVariants()"
        >
          {{ copy.busy ? "生成中..." : "✨ 生成 3 组合规候选文案" }}
        </button>
        <span v-if="!canEdit" class="pill p-gray">当前角色为只读视图，生成与编辑已禁用</span>
      </div>
    </div>

    <!-- 3 组候选草稿 -->
    <div v-if="copy.variants.length > 0" class="grid-3" style="margin-bottom:14px;">
      <div v-for="v in copy.variants" :key="v.asset_id" class="card" style="margin-bottom:0;">
        <div class="card-title">
          <span>{{ v.content_json.style_label || `方案 ${v.variant_idx + 1}` }}</span>
          <span class="pill" :class="v.scan_result_json?.passed ? 'p-green' : 'p-red'">
            {{ v.scan_result_json?.passed ? "扫描通过" : "命中拦截" }}
          </span>
        </div>
        <p style="font-size:12.5px;white-space:pre-wrap;min-height:86px;color:#1e293b;">
          {{ v.content_json.text }}
        </p>
        <button
          type="button"
          class="btn btn-sm btn-primary"
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
        <span>已选交付文案微调与实时合规扫描（{{ copy.activeSlot }}）</span>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="pill p-gray">状态: {{ copy.editStatus }}</span>
          <span class="pill p-blue">版本: v{{ copy.editingVersion }}</span>
        </div>
      </div>

      <div v-if="!copy.editingAssetId" class="alert alert-blue">
        当前槽位尚未采纳文案，请先点击上方「生成 3 组合规候选文案」并采纳任意一组。
      </div>

      <template v-else>
        <div v-if="copy.errorMsg" class="alert alert-red">{{ copy.errorMsg }}</div>

        <textarea
          v-model="copy.editingText"
          class="textarea"
          :disabled="!canEdit"
          @input="copy.scheduleRealtimeScan()"
        />

        <!-- 实时扫描提示 -->
        <div
          v-if="copy.scanResult"
          class="alert"
          :class="copy.scanResult.passed ? 'alert-green' : 'alert-red'"
          style="margin-top:10px;"
        >
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-weight:600;">
            <span>
              {{ copy.scanResult.passed ? "✓ 实时扫描通过" : "✕ 触发红线/上限阻断（保存将被服务端 M7-4221 拒绝）" }}
            </span>
            <span class="tnum">
              当前长度：{{ copy.scanResult.limit_unit === "bytes" ? copy.scanResult.utf8_bytes : copy.scanResult.char_count }}
              / {{ copy.scanResult.max_limit }} {{ copy.scanResult.limit_unit }}
              （字符 {{ copy.scanResult.char_count }} · UTF-8 {{ copy.scanResult.utf8_bytes }}B）
            </span>
          </div>
          <div v-if="copy.scanResult.ban_hits.length" style="margin-top:4px;">
            违禁词命中：{{ copy.scanResult.ban_hits.join(", ") }}
          </div>
          <div v-if="copy.scanResult.trademark_hits.length" style="margin-top:4px;">
            商标词命中：{{ copy.scanResult.trademark_hits.join(", ") }}
          </div>
          <div v-if="copy.scanResult.regulatory_hits.length" style="margin-top:4px;">
            监管敏感词命中：{{ copy.scanResult.regulatory_hits.join(", ") }}
          </div>
          <div v-if="copy.scanResult.all_caps_words.length" style="margin-top:4px;">
            全大写禁用词：{{ copy.scanResult.all_caps_words.join(", ") }}
          </div>
          <div v-if="Object.keys(copy.scanResult.suggestions).length" style="margin-top:4px;">
            合规改写建议：
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
            class="btn btn-primary"
            :disabled="!canEdit || copy.busy"
            @click="copy.saveManualEdit()"
          >
            💾 保存微调（校验入库并保留 AI 原稿）
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!canEdit || copy.busy"
            @click="copy.restoreOriginal()"
          >
            ↩ 一键还原 AI 原稿
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
