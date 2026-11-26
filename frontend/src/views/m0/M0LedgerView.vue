<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";
import { getProductImageUrl } from "@/utils/productImage";

const ws = useM7WorkspaceStore();
const products = ref<any[]>([]);
const orders = ref<any[]>([]);
const quotes = ref<any[]>([]);
const costReqs = ref<any[]>([]);
const fxRates = ref<any[]>([]);
const errMsg = ref("");
const showAddProd = ref(false);

const prodForm = reactive({
  sku: "",
  name: "",
  category: "kitchen_appliance",
  category_label_zh: "厨卫小电",
  platform: "amazon_us",
  sale_price_usd: 29.9,
  unit_cost_usd: 6.5,
  moq: 100,
  pack_size: 20,
  lead_time_days: 21,
});

const costForm = reactive({ sku: "SKU-00704", new_cost_usd: 5.15, reason: "供应商阶梯报价调整" });
const csvText = ref(
  "order_id,shop_id,sku,order_date,qty,revenue_usd,is_mock,status\nORD-CSV-1001,shop_amz_us_org_demo,SKU-00704,2026-11-18,12,322.8,false,SETTLED"
);
const csvFilename = ref("");
const csvSourceType = ref<"auto" | "live" | "mock">("auto");
const csvReport = ref<{ imported: number; skipped_duplicates: number; errors: any[] } | null>(null);

const rmbRate = computed(() => {
  const r = fxRates.value.find((x) => x.currency === "RMB");
  return r ? Number(r.rate_to_usd) : 0.1389;
});

const csvPreviewRows = computed(() => {
  const lines = csvText.value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [] as string[], rows: [] as string[][] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1, 11).map((line) => line.split(",").map((c) => c.trim()));
  return { headers, rows };
});

const hasMockFilenameHint = computed(() => {
  const fn = csvFilename.value.toLowerCase();
  return ["mock", "demo", "演示", "测试"].some((k) => fn.includes(k));
});

async function load() {
  errMsg.value = "";
  try {
    const [p, l, fx] = await Promise.all([
      platformApi.listProducts(),
      platformApi.getLedger(),
      platformApi.listFxRates(),
    ]);
    products.value = p.items;
    orders.value = l.orders;
    quotes.value = l.quotes;
    costReqs.value = l.cost_requests;
    fxRates.value = fx.items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function saveProduct() {
  errMsg.value = "";
  try {
    await platformApi.upsertProduct(prodForm);
    ws.showToast(`已保存商品主档 ${prodForm.sku}`);
    showAddProd.value = false;
    prodForm.sku = "";
    prodForm.name = "";
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function proposeCost() {
  errMsg.value = "";
  try {
    await platformApi.proposeCost(costForm);
    ws.showToast("已发起成本变更申请（待主管审批）");
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function decideCost(reqId: string, decision: "APPROVED" | "REJECTED") {
  errMsg.value = "";
  try {
    await platformApi.decideCost(reqId, decision);
    ws.showToast(`成本审批单已${decision === "APPROVED" ? "批准并生效" : "驳回"}`);
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

function handleCsvFile(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  csvFilename.value = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    csvText.value = String(reader.result || "");
  };
  reader.readAsText(file, "utf-8");
}

async function importCsv() {
  errMsg.value = "";
  csvReport.value = null;
  try {
    const res = await platformApi.importOrdersCsv(csvText.value, csvFilename.value, csvSourceType.value);
    csvReport.value = res;
    ws.showToast(`导入完成：新增 ${res.imported} 单，去重跳过 ${res.skipped_duplicates} 单`);
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

    <!-- 归纳指标卡 -->
    <div class="grid-4" style="margin-bottom:14px;">
      <div class="kpi-card">
        <div class="kpi-label">在营主档 SKU</div>
        <div class="kpi-val">{{ products.length }}</div>
        <div class="kpi-sub">M4 转正与建品合计</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">台账订单笔数</div>
        <div class="kpi-val">{{ orders.length }}</div>
        <div class="kpi-sub">含实盘与模拟隔离</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">待审成本调整</div>
        <div class="kpi-val" style="color:#b45309;">{{ costReqs.filter((r) => r.status === "PENDING").length }}</div>
        <div class="kpi-sub">SoD 禁自批</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">1688 比价条目</div>
        <div class="kpi-val" style="color:#047857;">{{ quotes.length }}</div>
        <div class="kpi-sub">RMB 汇率 {{ rmbRate }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>商品主档与成本卡</span>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-sm btn-primary" @click="showAddProd = !showAddProd">
            {{ showAddProd ? "收起建品" : "+ 新增/维护主档 SKU" }}
          </button>
          <button type="button" class="btn btn-sm" @click="load">刷新台账</button>
        </div>
      </div>

      <div v-if="showAddProd" style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:12px;">
        <div class="grid-4" style="margin-bottom:8px;">
          <div>
            <label class="field-label">SKU</label>
            <input v-model="prodForm.sku" class="input" placeholder="如 SKU-8899" />
          </div>
          <div>
            <label class="field-label">商品名称</label>
            <input v-model="prodForm.name" class="input" placeholder="商品中文名称" />
          </div>
          <div>
            <label class="field-label">售价 (USD)</label>
            <input v-model.number="prodForm.sale_price_usd" type="number" step="0.1" class="input" />
          </div>
          <div>
            <label class="field-label">核算成本 (USD)</label>
            <input v-model.number="prodForm.unit_cost_usd" type="number" step="0.1" class="input" />
          </div>
        </div>
        <div class="grid-4">
          <div>
            <label class="field-label">MOQ</label>
            <input v-model.number="prodForm.moq" type="number" class="input" />
          </div>
          <div>
            <label class="field-label">箱规</label>
            <input v-model.number="prodForm.pack_size" type="number" class="input" />
          </div>
          <div>
            <label class="field-label">交期(天)</label>
            <input v-model.number="prodForm.lead_time_days" type="number" class="input" />
          </div>
          <div style="display:flex;align-items:flex-end;">
            <button type="button" class="btn btn-primary btn-sm" @click="saveProduct">保存商品主档</button>
          </div>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>商品名称</th>
            <th>来源</th>
            <th>售价 (USD)</th>
            <th>采购成本 (USD)</th>
            <th>MOQ / 整箱</th>
            <th>总交期</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.sku">
            <td><code>{{ p.sku }}</code></td>
            <td>
              <div style="display:flex;align-items:center;gap:8px;">
                <img
                  v-if="getProductImageUrl(p.sku)"
                  :src="getProductImageUrl(p.sku)!"
                  :alt="p.name"
                  style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;background:#fff;flex-shrink:0;"
                />
                <span>{{ p.name }}</span>
              </div>
            </td>
            <td><span class="pill p-blue">{{ p.origin }}</span></td>
            <td class="tnum">${{ p.sale_price_usd }}</td>
            <td class="tnum">${{ p.unit_cost_usd }}</td>
            <td class="tnum">{{ p.moq }} / {{ p.pack_size }}</td>
            <td class="tnum">{{ p.lead_time_days }} 天</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">成本变更申请与审批（严格 SoD 禁自批）</div>
        <div class="grid-3" style="margin-bottom:10px;">
          <div>
            <label class="field-label">SKU</label>
            <select v-model="costForm.sku" class="select">
              <option v-for="p in products" :key="p.sku" :value="p.sku">{{ p.sku }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">新采购成本 (USD)</label>
            <input v-model.number="costForm.new_cost_usd" type="number" step="0.1" class="input" />
          </div>
          <div>
            <label class="field-label">调价原因</label>
            <input v-model="costForm.reason" class="input" />
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" style="margin-bottom:12px;" @click="proposeCost">
          提交调价申请
        </button>

        <table class="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>原价 → 新价</th>
              <th>发起人</th>
              <th>状态 / 操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in costReqs" :key="r.req_id">
              <td><code>{{ r.sku }}</code></td>
              <td class="tnum">${{ r.old_cost_usd }} → ${{ r.new_cost_usd }}</td>
              <td><code>{{ r.proposer_id }}</code></td>
              <td>
                <template v-if="r.status === 'PENDING'">
                  <button type="button" class="btn btn-sm btn-success" @click="decideCost(r.req_id, 'APPROVED')">批准</button>
                  <button type="button" class="btn btn-sm btn-danger" style="margin-left:4px;" @click="decideCost(r.req_id, 'REJECTED')">驳回</button>
                </template>
                <span v-else class="pill" :class="r.status === 'APPROVED' ? 'p-green' : 'p-red'">{{ r.status }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">
          <span>1688 模拟比价（透明参考汇率）与 CSV 订单防重导入</span>
        </div>
        <div style="font-size:11px;color:#475569;margin-bottom:8px;">
          组织参考汇率：
          <span v-for="fx in fxRates" :key="fx.currency" class="pill p-gray" style="margin-right:4px;">
            1 {{ fx.currency }} = ${{ fx.rate_to_usd }} USD
          </span>
        </div>
        <table class="table" style="margin-bottom:12px;">
          <thead>
            <tr>
              <th>SKU</th>
              <th>供应商</th>
              <th>报价 (RMB / 折合 USD)</th>
              <th>MOQ / 交期</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="q in quotes" :key="q.quote_id">
              <td><code>{{ q.sku }}</code></td>
              <td>{{ q.supplier_name }}</td>
              <td class="tnum">¥{{ q.unit_price_rmb }} <span style="color:#64748b;">(≈ ${{ (q.unit_price_rmb * rmbRate).toFixed(2) }})</span></td>
              <td class="tnum">{{ q.moq }} / {{ q.lead_time_days }}d</td>
            </tr>
          </tbody>
        </table>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
          <input type="file" accept=".csv" style="font-size:12px;" @change="handleCsvFile" />
          <select v-model="csvSourceType" class="select" style="width:160px;">
            <option value="auto">按文件与店铺自动判别</option>
            <option value="live">实盘订单 (is_mock=false)</option>
            <option value="mock">演示订单 (is_mock=true)</option>
          </select>
        </div>
        <div v-if="hasMockFilenameHint && csvSourceType === 'live'" class="alert alert-red" style="margin-bottom:6px;">
          安全警示：文件名「{{ csvFilename }}」包含演示/测试标识，禁止作为实盘订单导入！
        </div>

        <textarea v-model="csvText" class="textarea" style="min-height:66px;font-family:monospace;font-size:12px;"></textarea>

        <div v-if="csvPreviewRows.rows.length" style="margin-top:8px;overflow-x:auto;">
          <div style="font-size:11px;color:#64748b;margin-bottom:4px;">前 10 行数据预览（共 {{ csvPreviewRows.rows.length }} 行展示）：</div>
          <table class="table" style="font-size:11px;">
            <thead>
              <tr><th v-for="h in csvPreviewRows.headers" :key="h">{{ h }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in csvPreviewRows.rows" :key="idx">
                <td v-for="(col, cidx) in row" :key="cidx">{{ col }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <button type="button" class="btn btn-sm btn-primary" style="margin-top:8px;" @click="importCsv">
          导入 CSV 订单（按 order_id 幂等去重）
        </button>
        <div v-if="csvReport" class="alert alert-blue" style="margin-top:8px;font-size:12px;">
          导入结果：新增 <strong>{{ csvReport.imported }}</strong> 单，去重跳过 <strong>{{ csvReport.skipped_duplicates }}</strong> 单，格式错误 <strong>{{ csvReport.errors.length }}</strong> 行
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">全平台订单台账（最近 {{ orders.length }} 笔）</div>
      <table class="table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>店铺</th>
            <th>SKU</th>
            <th>日期</th>
            <th>件数</th>
            <th>营收 (USD)</th>
            <th>口径隔离</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.order_id">
            <td><code>{{ o.order_id }}</code></td>
            <td>{{ o.shop_id }}</td>
            <td><code>{{ o.sku }}</code></td>
            <td>{{ o.order_date }}</td>
            <td class="tnum">{{ o.qty }}</td>
            <td class="tnum">${{ o.revenue_usd }}</td>
            <td>
              <span class="pill" :class="o.is_mock ? 'p-amber' : 'p-green'">
                {{ o.is_mock ? "演示隔离" : "实盘" }}
              </span>
            </td>
            <td><span class="pill p-blue">{{ o.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
