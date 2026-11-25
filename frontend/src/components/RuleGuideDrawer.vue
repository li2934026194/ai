<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PAGE_FLOW_META } from "@/data/navigation";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const route = useRoute();
const router = useRouter();
const meta = computed(() => PAGE_FLOW_META[route.path] || PAGE_FLOW_META["/home"]);

function jump(target: string) {
  emit("close");
  void router.push(target);
}
</script>

<template>
  <template v-if="open">
    <div class="drawer-backdrop" @click="emit('close')"></div>
    <aside class="slide-drawer" aria-label="规则与流程说明">
      <div class="drawer-head">
        <div>
          <div style="font-size:15px;font-weight:700;">{{ meta.title }}</div>
          <div style="font-size:11.5px;color:#94a3b8;">流程位置 · 规则红线 · 责任人与数据溯源</div>
        </div>
        <button type="button" class="btn btn-sm" @click="emit('close')">✕ 关闭</button>
      </div>

      <div class="drawer-body">
        <div class="alert alert-blue">
          <strong>核心业务规则红线</strong>
          <div style="margin-top:4px;">{{ meta.ruleSummary }}</div>
        </div>

        <div class="card">
          <div class="card-title">上下游数据流向</div>
          <div style="font-size:13px;display:flex;flex-direction:column;gap:10px;">
            <div>
              <div style="font-weight:700;color:#475569;">1. 上游来源</div>
              <div>{{ meta.up }}</div>
              <button type="button" class="btn btn-sm" style="margin-top:4px;" @click="jump(meta.upRoute)">
                前往上游页面 →
              </button>
            </div>
            <div>
              <div style="font-weight:700;color:#1d4ed8;">2. 本页操作</div>
              <div>{{ meta.cur }}</div>
            </div>
            <div>
              <div style="font-weight:700;color:#047857;">3. 下游同步</div>
              <div>{{ meta.down }}</div>
              <button type="button" class="btn btn-sm" style="margin-top:4px;" @click="jump(meta.downRoute)">
                前往下游页面 →
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">跨模块契约与审计约束</div>
          <ul style="margin:0;padding-left:18px;font-size:12.5px;color:#334155;line-height:1.7;">
            <li>全平台所有写操作均写入 <code>core_audit_events</code> 审计台账（含操作人、岗位、中文轨迹与 <code>trace_id</code>）。</li>
            <li>所有审批节点（M0 调价、M1 退款、M4 选品、M6 补货、M7 上架）强制校验「提交人 ≠ 审批人」职责分离（SoD）。</li>
            <li>M5/M6 需求校准、走步回测、SS/ROP、两步取整与状态机全部由后端 <code>domain</code> 唯一算法内核驱动。</li>
          </ul>
        </div>
      </div>
    </aside>
  </template>
</template>
