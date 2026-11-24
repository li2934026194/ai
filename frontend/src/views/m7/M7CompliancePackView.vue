<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
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

    <!-- 1. 8+N 交付总览 + 5 项独立上架合规检查 -->
    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>8+N 交付清单完整度与缺失一键跳修</span>
          <span class="pill" :class="ws.doneCnt === 8 ? 'p-green' : 'p-amber'">
            核心 {{ ws.doneCnt }}/8 · 扩展 {{ ws.extDoneCnt }}/6
          </span>
        </div>

        <table class="table">
          <thead>
            <tr><th>交付项</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in ws.summary?.core_items || []" :key="item.slot">
              <td>{{ item.label }}</td>
              <td>
                <span class="pill" :class="item.done ? 'p-green' : 'p-red'">
                  {{ item.done ? "已就绪" : "缺失" }}
                </span>
              </td>
              <td>
                <button
                  v-if="!item.done"
                  type="button"
                  class="btn btn-sm btn-primary"
                  @click="router.push(item.jump_route)"
                >
                  去补齐 →
                </button>
                <span v-else style="color:#64748b;font-size:12px;">已入库</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">
          <span>5 项独立上架合规检查 & 买家视角预览</span>
          <div style="display:flex;gap:6px;">
            <button
              type="button"
              class="btn btn-sm"
              @click="comp.buyerDrawerOpen = true"
            >
              👁 买家视角预览
            </button>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="!canRunCompliance || comp.busy"
              @click="comp.run5Checks()"
            >
              {{ comp.busy ? "核查中..." : "🛡 1. 运行 5 项上架合规检查" }}
            </button>
          </div>
        </div>

        <div v-if="!ws.summary?.latest_check" class="alert alert-blue">
          尚未运行正式上架合规检查。点击「运行 5 项上架合规检查」将依据服务端词库与磁盘实读完成核验。
        </div>

        <div v-else>
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
            style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;gap:8px;"
          >
            <div>
              <div style="font-weight:600;font-size:13px;">{{ chk.name }}</div>
              <div style="font-size:12px;color:#475569;">{{ chk.detail }}</div>
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
      </div>
    </div>

    <!-- 2. 主管审批（禁自批）与离线交付导出 -->
    <div class="card">
      <div class="card-title">
        <span>2. 主管审批发布包（职责分离强门禁）与本地离线导出</span>
        <span
          class="pill"
          :class="ws.summary?.approval_status === 'APPROVED' ? 'p-green' : 'p-amber'"
        >
          当前门禁状态：{{ ws.summary?.approval_status || "PENDING_CHECK" }}
        </span>
      </div>

      <div class="grid-2">
        <div>
          <label class="field-label">主管审批意见（仅主管/审批人可操作，且禁止自我审批）</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <input
              v-model="comp.approveNote"
              class="input"
              style="flex:1;min-width:200px;"
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
          <div v-if="!canApprove" style="font-size:12px;color:#b45309;margin-top:6px;">
            当前岗位无 <code>m7:publish:approve</code> 审批权限（请切换「主管 / 审批人 (陈主管)」执行复核放行）。
          </div>
          <div v-if="ws.summary?.active_approval" style="font-size:12px;color:#047857;margin-top:6px;">
            已批准凭证：{{ ws.summary.active_approval.approval_id }} · 审批人 {{ ws.summary.active_approval.approver_id }}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;justify-content:flex-end;gap:8px;">
          <div class="field-label">3. 本地离线交付包下载（必须「5 项过检 + 有效主管批准」方可导出）</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button
              type="button"
              class="btn btn-success"
              :disabled="!canExport || comp.busy || ws.summary?.approval_status !== 'APPROVED'"
              @click="comp.exportFile('zip')"
            >
              📦 下载 .ZIP 分目录交付包
            </button>
            <button
              type="button"
              class="btn"
              :disabled="!canExport || comp.busy || ws.summary?.approval_status !== 'APPROVED'"
              @click="comp.exportFile('html')"
            >
              📄 下载 .HTML 可视化归档
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. 资质台账与 3×4 规则矩阵 -->
    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>类目资质与 TikTok 授权台账（{{ ws.currentSku }}）</span>
          <span v-if="!canMaintainRules" class="pill p-gray">仅主管可续期</span>
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
          <input v-model="certType" class="input" style="width:120px;" placeholder="UL/FCC" :disabled="!canMaintainRules" />
          <input v-model="certNo" class="input" style="width:140px;" placeholder="证书编号" :disabled="!canMaintainRules" />
          <input v-model="certExpire" class="input" style="width:140px;" placeholder="YYYY-MM-DD" :disabled="!canMaintainRules" />
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

      <div class="card">
        <div class="card-title">
          <span>三平台 × 四类目合规规则矩阵（共 {{ comp.rules.length }} 条）</span>
          <span v-if="!canMaintainRules" class="pill p-gray">只读</span>
        </div>
        <div style="max-height:260px;overflow-y:auto;">
          <table class="table">
            <thead>
              <tr><th>站点 / 类目</th><th>标题上限</th><th>搜索词字节</th><th>操作</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in comp.rules" :key="r.rule_id">
                <td>{{ r.platform }} / {{ r.category }}</td>
                <td class="tnum">{{ r.title_max_chars }} 字符</td>
                <td class="tnum">{{ r.search_terms_max_bytes }} B</td>
                <td>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :disabled="!canMaintainRules"
                    @click="openRuleEditor(r)"
                  >
                    编辑
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
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
          <button type="button" class="btn btn-primary" @click="saveEditedRule()">保存规则</button>
        </div>
      </div>
    </div>

    <!-- 买家视角模拟预览抽屉 -->
    <div v-if="comp.buyerDrawerOpen && ws.summary" class="modal-backdrop">
      <div class="modal-card">
        <div class="alert alert-amber" style="font-weight:700;display:flex;justify-content:space-between;align-items:center;">
          <span>⚠ {{ ws.summary.buyer_preview.banner }} · 模拟店铺隔离预览（严禁视为线上真实发布）</span>
          <button type="button" class="btn btn-sm" @click="comp.buyerDrawerOpen = false">关闭</button>
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
          <span
            v-if="ws.summary.buyer_preview.discount_pct !== null"
            class="pill p-red"
          >
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

        <div
          v-if="ws.summary.buyer_preview.aplus_html"
          style="margin-top:12px;padding:10px;border:1px solid #e2e8f0;border-radius:8px;"
          v-html="ws.summary.buyer_preview.aplus_html"
        />
      </div>
    </div>
  </div>
</template>
