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
const buyerImgIdx = ref(0);
const buyerVarIdx = ref(0);

const IMAGE_SLOT_LABELS = ["白底主图", "场景使用图", "细节特写图", "尺寸参数图", "包装清单图"];

const buyerVariants = computed(() => {
  const base = ws.summary?.buyer_preview.sale_price_usd ?? ws.currentProduct?.sale_price_usd ?? 26.9;
  const prod = ws.currentProduct?.name || ws.currentSku || "Standard";
  return [
    { name: "标准单机版 (Standard)", price: base },
    { name: `${prod.slice(0, 10)} 礼盒装 (+配件)`, price: Number((base + 6.0).toFixed(2)) },
  ];
});

const activeBuyerPrice = computed(() => {
  return buyerVariants.value[buyerVarIdx.value]?.price ?? ws.summary?.buyer_preview.sale_price_usd ?? null;
});

const activeBuyerImg = computed(() => {
  const imgs = ws.summary?.buyer_preview.images || [];
  if (!imgs.length) return null;
  return imgs[Math.min(buyerImgIdx.value, imgs.length - 1)] || imgs[0];
});

const activeRule = computed(() => {
  const cat = ws.currentProduct?.category;
  return comp.rules.find((r) => r.platform === ws.platform && (!cat || r.category === cat)) || null;
});

watch(
  () => ws.currentSku,
  () => {
    buyerImgIdx.value = 0;
    buyerVarIdx.value = 0;
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

        <!-- Tab 1: 买家视角预览（亚马逊详情页双栏 9 大模块排版） -->
        <div v-if="activeTab === 'buyer' && ws.summary" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff;">
          <div style="background:#fffbeb;border-bottom:1px solid #fde68a;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
            <div style="font-size:12px;font-weight:700;color:#92400e;">
              🛍️ 买家视角预览 · {{ ws.summary.buyer_preview.banner }}（模拟 {{ ws.platform }} 详情页排版，非真实上架 MOCK 隔离演示）
            </div>
            <span class="pill p-amber">按 M0-2 商品主档实时渲染</span>
          </div>

          <div style="padding:14px;display:grid;grid-template-columns:minmax(0,250px) minmax(0,1fr);gap:16px;align-items:start;">
            <!-- 左栏：主图大展区 + 1+4 缩略图切换器 -->
            <div style="min-width:0;">
              <div v-if="!ws.summary.buyer_preview.images.length" style="padding:24px 10px;text-align:center;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;">
                <div style="font-size:12px;font-weight:700;margin-bottom:6px;">商品主图与附图待生成</div>
                <button type="button" class="btn btn-primary btn-sm" @click="router.push('/m7/images')">去 M7-2 生成 1+4 套图</button>
              </div>
              <template v-else>
                <div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:#fff;position:relative;text-align:center;">
                  <span class="pill p-gray" style="position:absolute;top:6px;left:6px;font-size:10px;">演示图</span>
                  <img
                    v-if="activeBuyerImg"
                    :src="activeBuyerImg.media_url"
                    alt="买家视角主图"
                    style="width:100%;max-height:220px;object-fit:contain;"
                  />
                </div>
                <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:8px;">
                  <button
                    v-for="(img, idx) in ws.summary.buyer_preview.images"
                    :key="img.media_id"
                    type="button"
                    :style="{
                      border: buyerImgIdx === idx ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '2px',
                      background: '#fff',
                      cursor: 'pointer',
                    }"
                    @click="buyerImgIdx = idx"
                  >
                    <img :src="img.media_url" style="width:100%;height:38px;object-fit:contain;" :alt="IMAGE_SLOT_LABELS[idx] || '图'" />
                  </button>
                </div>
                <div style="font-size:11.5px;color:#64748b;margin-top:6px;">
                  当前预览：{{ IMAGE_SLOT_LABELS[buyerImgIdx] || `附图 ${buyerImgIdx}` }}（点击缩略图切换）
                </div>
              </template>
            </div>

            <!-- 右栏：亚马逊详情页 1~9 结构化板块 -->
            <div style="min-width:0;display:flex;flex-direction:column;gap:12px;">
              <!-- 1. 商品标题 -->
              <div style="border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
                <div style="font-size:11.5px;color:#64748b;margin-bottom:2px;">
                  1. 商品标题 · Brand: <strong>{{ ws.currentProduct?.brand_name || "CrossPilot" }}</strong>
                </div>
                <div style="font-size:16px;font-weight:800;line-height:1.4;color:#0f172a;">
                  {{ ws.summary.buyer_preview.title }}
                </div>
              </div>

              <!-- 2. 售价 / 划线价 / 折扣与库存 -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;">
                <div style="font-size:11px;color:#64748b;margin-bottom:4px;">
                  2. 售价 / 划线价 / 实时折扣与库存（联动 M0-2）
                </div>
                <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">
                  <span style="font-size:22px;font-weight:800;color:#b91c1c;" class="tnum">
                    ${{ activeBuyerPrice ?? "--" }}
                  </span>
                  <span
                    v-if="ws.summary.buyer_preview.strike_price_usd"
                    style="text-decoration:line-through;color:#64748b;font-size:13px;"
                    class="tnum"
                  >
                    ${{ ws.summary.buyer_preview.strike_price_usd }}
                  </span>
                  <span v-if="ws.summary.buyer_preview.discount_pct !== null" class="pill p-red">
                    -{{ ws.summary.buyer_preview.discount_pct }}% OFF
                  </span>
                  <span style="font-size:12px;color:#15803d;font-weight:700;">
                    库存：有货可售（实时同步 M0-3）
                  </span>
                </div>
              </div>

              <!-- 3. 买家评分与累计销量 -->
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 10px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;color:#475569;">
                <strong>3. 买家评分与累计销量：</strong>
                <span>暂无评分与销量（上架后由平台生成）</span>
              </div>

              <!-- 4. 规格变体选择 -->
              <div>
                <div style="font-size:12px;font-weight:700;margin-bottom:4px;">4. 规格变体选择（联动 M0-2）：</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button
                    v-for="(v, vi) in buyerVariants"
                    :key="v.name"
                    type="button"
                    class="btn btn-sm"
                    :class="buyerVarIdx === vi ? 'btn-primary' : ''"
                    @click="buyerVarIdx = vi"
                  >
                    {{ v.name }} · ${{ v.price }}
                  </button>
                </div>
              </div>

              <!-- 5. 关键属性表 -->
              <div>
                <div style="font-size:12px;font-weight:700;margin-bottom:4px;">5. 关键属性表（M0-2 实标属性 · 缺失字段标黄提示补齐）：</div>
                <table class="table">
                  <tbody>
                    <tr v-for="(val, key) in ws.summary.buyer_preview.specs" :key="key">
                      <td style="width:160px;font-weight:600;">{{ key }}</td>
                      <td>
                        <span v-if="val">{{ val }}</span>
                        <button
                          v-else
                          type="button"
                          class="btn btn-sm"
                          style="padding:2px 8px;font-size:11.5px;color:#b45309;background:#fffbeb;border-color:#fcd34d;"
                          @click="router.push('/m0/ledger')"
                        >
                          待补（去 M0-2）
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- 6. 五点核心卖点 -->
              <div>
                <div style="font-size:12px;font-weight:700;margin-bottom:4px;">6. 五点核心卖点 (About this item)：</div>
                <ul style="margin:0;padding-left:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding-top:8px;padding-bottom:8px;font-size:12.5px;line-height:1.55;">
                  <li v-for="(b, idx) in ws.summary.buyer_preview.bullets" :key="idx">{{ b }}</li>
                </ul>
              </div>

              <!-- 7. 商品详细描述 -->
              <div>
                <div style="font-size:12px;font-weight:700;margin-bottom:4px;">7. 商品详细描述：</div>
                <div
                  v-if="ws.summary.buyer_preview.description"
                  style="font-size:12.5px;line-height:1.55;background:#f8fafc;border:1px solid #e2e8f0;padding:8px 10px;border-radius:6px;white-space:pre-wrap;"
                >
                  {{ ws.summary.buyer_preview.description }}
                </div>
                <button v-else type="button" class="btn btn-sm" @click="router.push('/m7/copy')">
                  待选定商品描述（去 M7-1）→
                </button>
              </div>

              <!-- 8. A+ 品牌图文详情模块 -->
              <div>
                <div style="font-size:12px;font-weight:700;margin-bottom:4px;">8. A+ 品牌图文详情模块：</div>
                <div
                  v-if="ws.summary.buyer_preview.aplus_html"
                  style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;"
                >
                  <div style="min-width:0;">
                    <strong style="font-size:12.5px;">{{ ws.summary.product_name }} · A+ Story</strong>
                    <div style="font-size:11px;color:#cbd5e1;margin-top:2px;">
                      已配置品牌横幅 + 场景卖点 + 参数对比表（点击上方「A+ 长页」查看完整渲染）
                    </div>
                  </div>
                  <button type="button" class="btn btn-sm" @click="activeTab = 'aplus'">查看 A+ 完整长页</button>
                </div>
                <button v-else type="button" class="btn btn-sm" @click="router.push('/m7/video-aplus')">
                  待生成 A+ 图文（去 M7-3）→
                </button>
              </div>

              <!-- 9. 商品主图视频 (15s) -->
              <div>
                <div style="font-size:12px;font-weight:700;margin-bottom:4px;">9. 商品主图视频 (15s)：</div>
                <div
                  v-if="ws.summary.buyer_preview.video"
                  style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:#0f172a;color:#fff;font-size:12px;"
                >
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="pill p-green">▶ 15s 演示视频</span>
                    <span>{{ ws.summary.buyer_preview.video.duration_sec }}s · 3段分镜双语字幕成片</span>
                  </div>
                  <button type="button" class="btn btn-sm" @click="activeTab = 'video'">播放成片</button>
                </div>
                <button v-else type="button" class="btn btn-sm" @click="router.push('/m7/video-aplus')">
                  待生成 15s 短视频（去 M7-3）→
                </button>
              </div>
            </div>
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
