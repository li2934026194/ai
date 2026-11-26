<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const router = useRouter();
const ws = useM7WorkspaceStore();
const candidates = ref<any[]>([]);
const errMsg = ref("");

const form = reactive({
  sku: "",
  name: "",
  category: "kitchen_appliance",
  source_channel: "1688 趋势选品",
  source_nature: "internal_live",
  fulfillment_mode: "FBA",
  ip_risk_note: "",
  target_price_usd: 32.9,
  est_cost_rmb: 45.0,
  est_shipping_rmb: 16.0,
});

const csvText = ref(
  "sku,name,category,fulfillment_mode,target_price_usd,est_cost_rmb,est_shipping_rmb,ip_risk_note\nMUG-301,智能恒温陶瓷杯,kitchen_appliance,FBA,34.9,46,18,\nCLIP-302,便携磁吸补光灯,3c_accessories,FBM,21.5,24,12,疑似含第三方卡扣专利待查"
);
const csvFilename = ref("");
const csvSourceNature = ref("internal_live");
const csvReport = ref<any>(null);

const kpis = computed(() => ({
  total: candidates.value.length,
  investable: candidates.value.filter((c) => c.est_margin_pct >= 0.18).length,
  pending: candidates.value.filter((c) => c.status === "PENDING_APPROVAL").length,
  approved: candidates.value.filter((c) => c.status === "APPROVED").length,
}));

const csvPreview = computed(() => {
  const lines = csvText.value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [] as string[], rows: [] as string[][] };
  return {
    headers: lines[0].split(",").map((s) => s.trim()),
    rows: lines.slice(1, 11).map((l) => l.split(",").map((c) => c.trim())),
  };
});

const hasMockFilenameHint = computed(() => {
  const fn = csvFilename.value.toLowerCase();
  return ["mock", "demo", "演示", "测试"].some((k) => fn.includes(k));
});

async function load() {
  errMsg.value = "";
  try {
    candidates.value = (await platformApi.listCandidates()).items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function importCand() {
  errMsg.value = "";
  try {
    const res = await platformApi.importCandidate(form);
    ws.showToast(`已导入候选商品（毛利率 ${(res.est_margin_pct * 100).toFixed(2)}%）`);
    form.sku = "";
    form.name = "";
    form.ip_risk_note = "";
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

function handleCsvFile(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (!f) return;
  csvFilename.value = f.name;
  const r = new FileReader();
  r.onload = () => {
    csvText.value = String(r.result || "");
  };
  r.readAsText(f, "utf-8");
}

async function importCsv() {
  errMsg.value = "";
  csvReport.value = null;
  try {
    const res = await platformApi.importCandidatesCsv(
      csvText.value,
      csvFilename.value,
      csvSourceNature.value
    );
    csvReport.value = res;
    ws.showToast(`批量导入 ${res.imported} 款（可投产 ${res.ready_count}，待核价 ${res.pending_quote_count}，风险 ${res.risk_blocked_count}）`);
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

onMounted(() => void load());
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <div class="grid-4" style="margin-bottom:14px;">
      <div class="kpi-card"><div class="kpi-label">选品池总数</div><div class="kpi-val">{{ kpis.total }}</div></div>
      <div class="kpi-card"><div class="kpi-label">可投产 (≥18%毛利)</div><div class="kpi-val" style="color:#047857;">{{ kpis.investable }}</div></div>
      <div class="kpi-card"><div class="kpi-label">待主管终审</div><div class="kpi-val" style="color:#b45309;">{{ kpis.pending }}</div></div>
      <div class="kpi-card"><div class="kpi-label">已批准转正</div><div class="kpi-val" style="color:#1d4ed8;">{{ kpis.approved }}</div></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">单品候选导入（四源性质隔离）</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="grid-2">
            <div>
              <label class="field-label">候选 SKU</label>
              <input v-model="form.sku" class="input" placeholder="如 COF-301" />
            </div>
            <div>
              <label class="field-label">商品名称</label>
              <input v-model="form.name" class="input" placeholder="如 便携无线奶泡器" />
            </div>
          </div>
          <div class="grid-3">
            <div>
              <label class="field-label">类目</label>
              <select v-model="form.category" class="select">
                <option value="kitchen_appliance">厨卫小电</option>
                <option value="bags_travel">箱包出行</option>
                <option value="3c_accessories">3C数码</option>
                <option value="beauty_skincare">美妆个护</option>
              </select>
            </div>
            <div>
              <label class="field-label">数据性质</label>
              <select v-model="form.source_nature" class="select">
                <option value="internal_live">内部实盘选品</option>
                <option value="external_estimate">外购行业估算</option>
                <option value="public_bestseller">平台热销</option>
                <option value="demo_only">仅演示数据</option>
              </select>
            </div>
            <div>
              <label class="field-label">履约</label>
              <select v-model="form.fulfillment_mode" class="select">
                <option value="FBA">FBA</option>
                <option value="FBM">FBM</option>
              </select>
            </div>
          </div>
          <div class="grid-3">
            <div>
              <label class="field-label">目标售价 (USD)</label>
              <input v-model.number="form.target_price_usd" type="number" step="0.1" class="input" />
            </div>
            <div>
              <label class="field-label">预估采购 (RMB)</label>
              <input v-model.number="form.est_cost_rmb" type="number" step="0.5" class="input" />
            </div>
            <div>
              <label class="field-label">预估头程 (RMB)</label>
              <input v-model.number="form.est_shipping_rmb" type="number" step="0.5" class="input" />
            </div>
          </div>
          <div>
            <label class="field-label">商标/专利风险备注</label>
            <input v-model="form.ip_risk_note" class="input" placeholder="如：外观无冲突，或疑似含卡扣专利待审" />
          </div>
          <button type="button" class="btn btn-primary btn-lg" @click="importCand">导入至选品工作台</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">批量 CSV 导入与三分类分诊</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
          <input type="file" accept=".csv" style="font-size:12px;" @change="handleCsvFile" />
          <select v-model="csvSourceNature" class="select" style="width:170px;">
            <option value="internal_live">内部实盘选品</option>
            <option value="external_estimate">外购行业估算</option>
            <option value="public_bestseller">平台热销</option>
            <option value="demo_only">仅演示数据</option>
          </select>
        </div>
        <div v-if="hasMockFilenameHint && csvSourceNature === 'internal_live'" class="alert alert-red" style="margin-bottom:8px;">
          警告：文件名「{{ csvFilename }}」含演示/测试字样，禁止以实盘性质导入！
        </div>
        <textarea v-model="csvText" class="textarea" style="min-height:66px;font-family:monospace;font-size:12px;"></textarea>
        <div v-if="csvPreview.rows.length" style="margin-top:8px;">
          <table class="table" style="font-size:11px;">
            <thead><tr><th v-for="h in csvPreview.headers.slice(0, 5)" :key="h">{{ h }}</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in csvPreview.rows.slice(0, 5)" :key="i"><td v-for="(c, j) in r.slice(0, 5)" :key="j">{{ c }}</td></tr>
            </tbody>
          </table>
        </div>
        <button type="button" class="btn btn-primary" style="margin-top:10px;" @click="importCsv">批量分诊入池</button>
        <div v-if="csvReport" class="alert alert-blue" style="margin-top:8px;font-size:12px;">
          分诊：可投产 <strong>{{ csvReport.ready_count }}</strong> · 待核价 <strong>{{ csvReport.pending_quote_count }}</strong> · 风险拦截 <strong>{{ csvReport.risk_blocked_count }}</strong>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>当前选品候选池（{{ candidates.length }} 款）</span>
        <button type="button" class="btn btn-sm btn-primary" @click="router.push('/m4/workbench')">进入 M4-2 评估打分 →</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>SKU / 名称</th>
            <th>来源 / 履约</th>
            <th>毛利率</th>
            <th>侵权风险备忘</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in candidates" :key="c.candidate_id">
            <td>
              <strong>{{ c.name }}</strong>
              <div class="table-sub"><code>{{ c.sku }}</code></div>
            </td>
            <td>{{ c.source_nature }} / {{ c.fulfillment_mode }}</td>
            <td class="tnum" :style="{ color: c.est_margin_pct >= 0.18 ? '#047857' : '#b91c1c', fontWeight: 700 }">
              {{ (c.est_margin_pct * 100).toFixed(2) }}%
            </td>
            <td style="font-size:11.5px;color:#b45309;">{{ c.ip_risk_note || "无异常" }}</td>
            <td><span class="pill p-blue">{{ c.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
