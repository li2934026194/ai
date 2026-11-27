<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";
import { getProductImageUrl } from "@/utils/productImage";

const ws = useM7WorkspaceStore();
const candidates = ref<any[]>([]);
const selected = ref<any>(null);
const onlyInvestable = ref(false);
const compareIds = ref<string[]>([]);
const errMsg = ref("");

const filteredCandidates = computed(() =>
  onlyInvestable.value
    ? candidates.value.filter((c) => c.est_margin_pct >= 0.18 && c.source_nature !== "demo_only")
    : candidates.value
);

const comparedItems = computed(() =>
  candidates.value.filter((c) => compareIds.value.includes(c.candidate_id)).slice(0, 4)
);

async function load() {
  errMsg.value = "";
  try {
    candidates.value = (await platformApi.listCandidates()).items;
    if (!selected.value && candidates.value.length > 0) {
      selected.value = JSON.parse(JSON.stringify(candidates.value[0]));
    }
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

function pick(c: any) {
  selected.value = JSON.parse(JSON.stringify(c));
}

function toggleCompare(cid: string) {
  if (compareIds.value.includes(cid)) {
    compareIds.value = compareIds.value.filter((x) => x !== cid);
  } else if (compareIds.value.length < 4) {
    compareIds.value.push(cid);
  }
}

async function saveEval(submit: boolean) {
  if (!selected.value) return;
  errMsg.value = "";
  try {
    const res = await platformApi.evaluateCandidate(selected.value.candidate_id, {
      target_price_usd: selected.value.target_price_usd,
      est_cost_rmb: selected.value.est_cost_rmb,
      est_shipping_rmb: selected.value.est_shipping_rmb,
      fulfillment_mode: selected.value.fulfillment_mode || "FBA",
      ip_risk_note: selected.value.ip_risk_note || "",
      scores: selected.value.scores,
      operator_note: selected.value.operator_note,
      submit_for_approval: submit,
    });
    ws.showToast(
      submit
        ? `已提交 ${selected.value.sku} 送主管终审（加权总分 ${res.total_score}）`
        : `已保存 ${selected.value.sku} 测算评估`
    );
    await load();
    const updated = candidates.value.find((x) => x.candidate_id === selected.value.candidate_id);
    if (updated) selected.value = JSON.parse(JSON.stringify(updated));
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

onMounted(() => void load());
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>选品候选清单（勾选对比）</span>
          <label style="font-size:12px;display:flex;align-items:center;gap:6px;font-weight:400;">
            <input v-model="onlyInvestable" type="checkbox" />
            只看可投产 (≥18%)
          </label>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>对比</th>
              <th>SKU / 品名</th>
              <th>总分 / 毛利</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in filteredCandidates" :key="c.candidate_id">
              <td>
                <input
                  type="checkbox"
                  :checked="compareIds.includes(c.candidate_id)"
                  @change="toggleCompare(c.candidate_id)"
                />
              </td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <img
                    v-if="getProductImageUrl(c.image_url)"
                    :src="getProductImageUrl(c.image_url)!"
                    :alt="c.name"
                    style="width:34px;height:34px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;background:#fff;flex-shrink:0;"
                  />
                  <div>
                    <strong>{{ c.name }}</strong>
                    <div class="table-sub"><code>{{ c.sku }}</code></div>
                  </div>
                </div>
              </td>
              <td class="tnum">
                <strong>{{ c.total_score }}</strong>
                <div class="table-sub" :style="{ color: c.est_margin_pct >= 0.18 ? '#047857' : '#b91c1c' }">
                  {{ (c.est_margin_pct * 100).toFixed(2) }}%
                </div>
              </td>
              <td><span class="pill p-blue">{{ c.status }}</span></td>
              <td><button type="button" class="btn btn-sm" @click="pick(c)">评估</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="selected" class="card">
        <div class="card-title">
          <div style="display:flex;align-items:center;gap:10px;">
            <img
              v-if="getProductImageUrl(selected.image_url)"
              :src="getProductImageUrl(selected.image_url)!"
              :alt="selected.name"
              style="width:42px;height:42px;object-fit:contain;border-radius:8px;border:1px solid #cbd5e1;background:#fff;"
            />
            <span>五维打分与利润测算：{{ selected.sku }}</span>
          </div>
          <span class="pill p-purple">{{ selected.status }}</span>
        </div>
        <div class="grid-4" style="margin-bottom:10px;">
          <div>
            <label class="field-label">售价 (USD)</label>
            <input v-model.number="selected.target_price_usd" type="number" step="0.1" class="input" />
          </div>
          <div>
            <label class="field-label">采购 (RMB)</label>
            <input v-model.number="selected.est_cost_rmb" type="number" step="0.5" class="input" />
          </div>
          <div>
            <label class="field-label">头程 (RMB)</label>
            <input v-model.number="selected.est_shipping_rmb" type="number" step="0.5" class="input" />
          </div>
          <div>
            <label class="field-label">履约</label>
            <select v-model="selected.fulfillment_mode" class="select">
              <option value="FBA">FBA</option>
              <option value="FBM">FBM</option>
            </select>
          </div>
        </div>
        <div class="grid-5" style="margin-bottom:10px;">
          <div v-for="(val, key) in selected.scores" :key="key">
            <label class="field-label">{{ key }}</label>
            <input v-model.number="selected.scores[key]" type="number" min="0" max="100" class="input" />
          </div>
        </div>
        <div style="margin-bottom:10px;">
          <label class="field-label">商标/专利风险备忘</label>
          <input v-model="selected.ip_risk_note" class="input" />
        </div>
        <div style="margin-bottom:12px;">
          <label class="field-label">选品推荐理由</label>
          <textarea v-model="selected.operator_note" class="textarea" style="min-height:56px;"></textarea>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn" @click="saveEval(false)">保存草稿</button>
          <button type="button" class="btn btn-primary btn-lg" @click="saveEval(true)">提交送主管终审 →</button>
        </div>
      </div>
    </div>

    <div v-if="comparedItems.length >= 2" class="card" style="margin-top:12px;">
      <div class="card-title">多品并排对比（已选 {{ comparedItems.length }} / 4 款）</div>
      <table class="table">
        <thead>
          <tr>
            <th>维度</th>
            <th v-for="it in comparedItems" :key="it.candidate_id">
              <div style="display:flex;align-items:center;gap:6px;">
                <img
                  v-if="getProductImageUrl(it.image_url)"
                  :src="getProductImageUrl(it.image_url)!"
                  :alt="it.name"
                  style="width:28px;height:28px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;background:#fff;"
                />
                <span><code>{{ it.sku }}</code> {{ it.name }}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>售价 / 采购 / 头程</td>
            <td v-for="it in comparedItems" :key="it.candidate_id" class="tnum">${{ it.target_price_usd }} / ¥{{ it.est_cost_rmb }} / ¥{{ it.est_shipping_rmb }}</td>
          </tr>
          <tr>
            <td>未舍入净毛利率</td>
            <td v-for="it in comparedItems" :key="it.candidate_id" class="tnum">{{ (it.est_margin_pct * 100).toFixed(2) }}%</td>
          </tr>
          <tr>
            <td>五维加权综合分</td>
            <td v-for="it in comparedItems" :key="it.candidate_id" class="tnum"><strong>{{ it.total_score }}</strong></td>
          </tr>
          <tr>
            <td>来源性质 / 侵权备注</td>
            <td v-for="it in comparedItems" :key="it.candidate_id">{{ it.source_nature }} · {{ it.ip_risk_note || "无" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
