<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import type { ComplianceRuleDTO } from "@/api/m7";
import { usePermission } from "@/composables/usePermission";
import { useM7ComplianceStore } from "@/stores/m7Compliance";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const router = useRouter();
const ws = useM7WorkspaceStore();
const comp = useM7ComplianceStore();
const { canRunCompliance, canMaintainRules, canApprove, canExport } = usePermission();

const editingRule = ref<ComplianceRuleDTO | null>(null);
const certType = ref("UL");
const certNo = ref("UL-2026-88412");
const certExpire = ref("2027-12-31");

type OverviewTab = "buyer" | "copy" | "images" | "video" | "aplus" | "audit";
const activeTab = ref<OverviewTab>("buyer");

const activeRule = computed(() => {
  const cat = ws.currentProduct?.category;
  return comp.rules.find((r) => r.platform === ws.platform && (!cat || r.category === cat)) || null;
});

watch(
  () => ws.currentSku,
  () => {
    void comp.loadMatrix();
  },
  { immediate: true }
);

onMounted(() => {
  void comp.loadMatrix();
});

function openRuleEditor(r: ComplianceRuleDTO) {
  editingRule.value = JSON.parse(JSON.stringify(r)) as ComplianceRuleDTO;
}

async function saveEditedRule() {
  if (!editingRule.value) return;
  const r = editingRule.value;
  editingRule.value = null;
  await comp.saveRule(r);
}
</script>

<template>
  <div>
    <div v-if="comp.errorMsg" class="alert alert-red">{{ comp.errorMsg }}</div>

    <!-- 上方双栏：左=站点×类目规则与资质；右=5项合规检查与主管审批导出 -->
    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>规则矩阵（{{ ws.platform }} / {{ ws.currentProduct?.category_label_zh || "-" }}）& 资质台账</span>
          <span v-if="!canMaintainRules" class="pill p-gray">仅主管可维护</span>
        </div>

        <div
          v-if="activeRule"
          style="padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px;font-size:12.5px;"
        >
          <div>
            <strong>当前命中规则 {{ activeRule.rule_version }}：</strong>
            标题 ≤ {{ activeRule.title_max_chars }} 字符 · 搜索词 ≤ {{ activeRule.search_terms_max_bytes }}B ·
            必备资质：{{ activeRule.required_certs_json.length ? activeRule.required_certs_json.join(", ") : "无" }}
          </div>
          <div style="margin-top:4px;display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#475569;">全平台规则矩阵（共 {{ comp.rules.length }} 条）</span>
            <button
              type="button"
              class="btn btn-sm"
              :disabled="!canMaintainRules"
              @click="openRuleEditor(activeRule)"
            >
              编辑当前规则
            </button>
          </div>
        </div>

        <table class="table" style="margin-bottom:10px;">
          <thead>
            <tr><th>资质类型</th><th>编号</th><th>到期日</th><th>状态</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in comp.certs" :key="c.cert_id">
              <td>{{ c.cert_type }}</td>
              <td>{{ c.cert_no }}</td>
              <td class="tnum">{{ c.expire_date }}</td>
              <td>
                <span
                  class="pill"
                  :class="c.status === 'VALID' ? 'p-green' : c.status === 'EXPIRING' ? 'p-amber' : 'p-red'"
                >
                  {{ c.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <input v-model="certType" class="input" style="width:110px;" placeholder="UL/FCC" :disabled="!canMaintainRules" />
          <input v-model="certNo" class="input" style="width:130px;" placeholder="证书编号" :disabled="!canMaintainRules" />
          <input v-model="certExpire" class="input" style="width:130px;" placeholder="YYYY-MM-DD" :disabled="!canMaintainRules" />
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="!canMaintainRules || comp.busy"
            @click="comp.renewCert({ sku: ws.currentSku, cert_type: certType, cert_no: certNo, expire_date: certExpire })"
          >
            续期/新增资质
          </button>
        </div>
      </div>

      <!-- 右上：5项检查 + 禁自批审批 + 导出 -->
      <div class="card">
        <div class="card-title">
          <span>5 项上架合规检查 & 主管审批门禁</span>
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="!canRunCompliance || comp.busy"
            @click="comp.run5Checks()"
          >
            {{ comp.busy ? "核查中..." : "🛡 1. 运行 5 项上架合规检查" }}
          </button>
        </div>

        <div v-if="!ws.summary?.latest_check" class="alert alert-blue">
          尚未运行正式上架合规检查。请点击右上角「1. 运行 5 项上架合规检查」。
        </div>
        <div v-else style="margin-bottom:10px;">
          <div
            class="alert"
            :class="ws.summary.latest_check.overall_pass ? 'alert-green' : 'alert-red'"
          >
            检查结论：{{ ws.summary.latest_check.overall_pass ? "5 项全绿通过，等待主管审批" : "存在阻断项，已禁止主管放行" }}
            （交付物 {{ ws.summary.latest_check.deliverable_count }}/8）
          </div>
          <div
            v-for="chk in ws.summary.latest_check.checks"
            :key="chk.code"
            style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;gap:8px;"
          >
            <div>
              <div style="font-weight:600;font-size:12.5px;">{{ chk.name }}</div>
              <div style="font-size:11.5px;color:#475569;">{{ chk.detail }}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="pill" :class="chk.passed ? 'p-green' : 'p-red'">
                {{ chk.passed ? "通过" : "阻断" }}
              </span>
              <button
                v-if="!chk.passed"
                type="button"
                class="btn btn-sm"
                @click="router.push(chk.jump_route)"
              >
                定位
              </button>
            </div>
          </div>
        </div>

        <div style="border-top:1px solid #e2e8f0;padding-top:10px;">
          <label class="field-label" for="m7ApprNote">2. 主管审批意见（必填，禁自批，当前：{{ ws.summary?.approval_status || "PENDING_CHECK" }}）</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
            <input
              id="m7ApprNote"
              v-model="comp.approveNote"
              class="input"
              style="flex:1;min-width:180px;"
              :disabled="!canApprove"
            />
            <button
              id="m7ApproveBtn"
              type="button"
              class="btn btn-primary"
              :disabled="!canApprove || comp.busy"
              @click="comp.approve('APPROVED')"
            >
              ✓ 2. 主管批准发布包
            </button>
            <button
              type="button"
              class="btn btn-danger"
              :disabled="!canApprove || comp.busy"
              @click="comp.approve('REJECTED')"
            >
              驳回
            </button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button
              type="button"
              class="btn btn-success"
              :disabled="!canExport || comp.busy || ws.summary?.approval_status !== 'APPROVED'"
              @click="comp.exportFile('zip')"
            >
              📦 下载 .ZIP 交付包
            </button>
            <button
              type="button"
              class="btn"
              :disabled="!canExport || comp.busy || ws.summary?.approval_status !== 'APPROVED'"
              @click="comp.exportFile('html')"
            >
              📄 下载 .HTML 离线归档
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 下方主从结构：左侧 6 页签总览（minmax(0,1fr)） + 右侧 280px 8+N 交付清单 -->
    <div class="m7d-overview-split">
      <div class="card">
        <div class="card-title">
          <span>6 页签成品总览</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button
              v-for="t in [
                { key: 'buyer', label: '买家视角预览' },
                { key: 'copy', label: '商品文案' },
                { key: 'images', label: '1+4 套图' },
                { key: 'video', label: '15s 视频' },
                { key: 'aplus', label: 'A+ 长页' },
                { key: 'audit', label: `审计台账 (${ws.auditEvents.length})` },
              ]"
              :key="t.key"
              type="button"
              class="btn btn-sm"
              :class="activeTab === t.key ? 'btn-primary' : ''"
              @click="activeTab = t.key as OverviewTab"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <!-- Tab 1: 买家视角预览 -->
        <div v-if="activeTab === 'buyer' && ws.summary">
          <div class="alert alert-amber" style="font-weight:700;">
            ⚠ {{ ws.summary.buyer_preview.banner }} · 非真实上架（MOCK 隔离演示）
          </div>
          <h2 style="margin:8px 0;">{{ ws.summary.buyer_preview.title }}</h2>
          <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px;">
            <span style="font-size:22px;font-weight:800;color:#b91c1c;" class="tnum">
              ${{ ws.summary.buyer_preview.sale_price_usd ?? "--" }}
            </span>
            <span
              v-if="ws.summary.buyer_preview.strike_price_usd"
              style="text-decoration:line-through;color:#64748b;"
              class="tnum"
            >
              ${{ ws.summary.buyer_preview.strike_price_usd }}
            </span>
            <span v-if="ws.summary.buyer_preview.discount_pct !== null" class="pill p-red">
              -{{ ws.summary.buyer_preview.discount_pct }}% OFF
            </span>
          </div>
          <div class="grid-5" style="margin-bottom:12px;">
            <img
              v-for="img in ws.summary.buyer_preview.images"
              :key="img.media_id"
              :src="img.media_url"
              style="width:100%;aspect-ratio:1/1;object-fit:contain;border:1px solid #e2e8f0;border-radius:6px;"
            />
          </div>
          <ul>
            <li v-for="(b, idx) in ws.summary.buyer_preview.bullets" :key="idx">{{ b }}</li>
          </ul>
          <div style="margin-top:12px;">
            <div class="field-label">M0-2 实标属性表（缺失字段标黄提示补齐）</div>
            <table class="table">
              <tbody>
                <tr v-for="(val, key) in ws.summary.buyer_preview.specs" :key="key">
                  <td style="width:180px;font-weight:600;">{{ key }}</td>
                  <td>
                    <span v-if="val">{{ val }}</span>
                    <span v-else class="pill p-amber">待补（去 M0-2）</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 2: 商品文案 -->
        <div v-else-if="activeTab === 'copy' && ws.summary">
          <div
            v-for="(asset, slot) in ws.summary.selected_copy_assets"
            :key="slot"
            style="padding:10px;border-bottom:1px solid #f1f5f9;"
          >
            <div style="font-weight:700;margin-bottom:4px;">{{ slot }} (v{{ asset.version }} · {{ asset.edit_status }})</div>
            <div style="font-size:12.5px;white-space:pre-wrap;">{{ asset.content_json?.text }}</div>
          </div>
        </div>

        <!-- Tab 3: 1+4 套图 -->
        <div v-else-if="activeTab === 'images' && ws.summary" class="grid-5">
          <div v-for="img in ws.summary.buyer_preview.images" :key="img.media_id">
            <img :src="img.media_url" style="width:100%;aspect-ratio:1/1;object-fit:contain;border:1px solid #e2e8f0;border-radius:6px;" />
            <div style="font-size:11px;margin-top:4px;">img_{{ img.slot_idx }} · IPTC {{ img.iptc_verified ? "✓" : "✕" }}</div>
          </div>
        </div>

        <!-- Tab 4: 15s 视频 -->
        <div v-else-if="activeTab === 'video' && ws.summary">
          <video
            v-if="ws.summary.buyer_preview.video"
            :src="ws.summary.buyer_preview.video.media_url"
            controls
            style="width:100%;max-height:320px;border-radius:8px;background:#0f172a;"
          />
          <div v-else class="alert alert-blue" style="margin-bottom:0;">
            尚未生成 15 秒短视频成片，请前往 M7-3 合成。
          </div>
        </div>

        <!-- Tab 5: A+ 长页 -->
        <div v-else-if="activeTab === 'aplus' && ws.summary">
          <div v-if="ws.summary.buyer_preview.aplus_html" v-html="ws.summary.buyer_preview.aplus_html" />
          <div v-else class="alert alert-blue" style="margin-bottom:0;">
            尚未组装 A+ 图文详情长页，请前往 M7-3 一键组装。
          </div>
        </div>

        <!-- Tab 6: M8-2 中文操作审计台账 -->
        <div v-else-if="activeTab === 'audit'">
          <table class="table">
            <thead>
              <tr><th>时间</th><th>操作人 / 岗位</th><th>结果</th><th>审计摘要</th></tr>
            </thead>
            <tbody>
              <tr v-for="ev in ws.auditEvents" :key="ev.event_id">
                <td class="tnum" style="font-size:11.5px;">{{ ev.created_at.slice(0, 19).replace("T", " ") }}</td>
                <td>{{ ev.actor_id }} ({{ ev.actor_role }})</td>
                <td>
                  <span class="pill" :class="ev.ok ? 'p-green' : 'p-red'">{{ ev.ok ? "放行" : "拦截" }}</span>
                </td>
                <td>{{ ev.sentence_zh }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 右侧窄栏：8+N 交付清单 -->
      <div class="card">
        <div class="card-title">
          <span>8+N 清单</span>
          <span class="pill" :class="ws.doneCnt === 8 ? 'p-green' : 'p-amber'">
            {{ ws.doneCnt }}/8 · 扩展 {{ ws.extDoneCnt }}/6
          </span>
        </div>
        <div
          v-for="item in ws.summary?.core_items || []"
          :key="item.slot"
          style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px;"
        >
          <span>{{ item.label }}</span>
          <button
            v-if="!item.done"
            type="button"
            class="btn btn-sm btn-primary"
            @click="router.push(item.jump_route)"
          >
            补齐
          </button>
          <span v-else class="pill p-green">✓</span>
        </div>
      </div>
    </div>

    <!-- 规则编辑弹窗 -->
    <div v-if="editingRule" class="modal-backdrop">
      <div class="modal-card" style="width:min(540px, 100%);">
        <h3 style="margin-top:0;">编辑规则：{{ editingRule.platform }} / {{ editingRule.category }}</h3>
        <div class="grid-2">
          <div>
            <label class="field-label">标题最大字符数</label>
            <input v-model.number="editingRule.title_max_chars" type="number" class="input" />
          </div>
          <div>
            <label class="field-label">搜索词最大 UTF-8 字节</label>
            <input v-model.number="editingRule.search_terms_max_bytes" type="number" class="input" />
          </div>
        </div>
        <div style="margin-top:10px;">
          <label class="field-label">通用违禁词（逗号分隔）</label>
          <input
            class="input"
            :value="editingRule.lexicon_json.ban.join(', ')"
            @input="editingRule!.lexicon_json.ban = ($event.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean)"
          />
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
          <button type="button" class="btn" @click="editingRule = null">取消</button>
          <button type="button" class="btn btn-primary" @click="saveEditedRule()">保存规则（自动作废旧审批）</button>
        </div>
      </div>
    </div>
  </div>
</template>
