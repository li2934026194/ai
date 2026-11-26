<script setup lang="ts">
import { onMounted, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const roles = ref<any[]>([]);
const policies = ref<any[]>([]);
const audits = ref<any[]>([]);
const modFilter = ref("");
const errMsg = ref("");

async function load() {
  errMsg.value = "";
  try {
    const [r, p, a] = await Promise.all([
      platformApi.listRoles(),
      platformApi.listPolicies(),
      platformApi.listAudits(modFilter.value || undefined),
    ]);
    roles.value = r.items;
    policies.value = p.items;
    audits.value = a.items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function togglePol(pol: any) {
  errMsg.value = "";
  try {
    await platformApi.togglePolicy(pol.policy_id, !pol.is_enabled, pol.enforce_sod);
    ws.showToast(`已切换策略「${pol.name}」状态`);
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

    <div class="card">
      <div class="card-title">跨模块审批流与 SoD 策略</div>
      <table class="table">
        <thead>
          <tr>
            <th>模块</th>
            <th>审批流名称 / 门槛</th>
            <th>终审岗位</th>
            <th>状态开关</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in policies" :key="p.policy_id">
            <td><span class="pill p-purple">{{ p.module }}</span></td>
            <td>
              <strong>{{ p.name }}</strong>
              <div class="table-sub">{{ p.threshold_rule }}</div>
            </td>
            <td><code>{{ p.approver_role }}</code> (SoD: {{ p.enforce_sod ? "强校验" : "关闭" }})</td>
            <td>
              <button
                type="button"
                class="btn btn-sm"
                :class="p.is_enabled ? 'btn-success' : ''"
                @click="togglePol(p)"
              >
                {{ p.is_enabled ? "已启用" : "已停用" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-title">九大标准业务岗位权限矩阵</div>
      <table class="table">
        <thead>
          <tr>
            <th>岗位</th>
            <th>职责说明</th>
            <th>已分配权限码</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in roles" :key="r.role_code">
            <td>
              <strong>{{ r.display_name }}</strong>
              <div class="table-sub"><code>{{ r.role_code }}</code></div>
            </td>
            <td style="font-size:12px;">{{ r.description }}</td>
            <td>
              <span v-for="perm in r.permissions" :key="perm" class="pill p-gray" style="margin:2px;">{{ perm }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-title">
        <span>全平台中文审计台账（{{ audits.length }} 条）</span>
        <div style="display:flex;gap:6px;">
          <select v-model="modFilter" class="select" style="width:130px;" @change="load">
            <option value="">全部模块</option>
            <option value="M0">M0 店铺档案</option>
            <option value="M1">M1 客服售后</option>
            <option value="M2">M2 经营分析</option>
            <option value="M3">M3 竞品监控</option>
            <option value="M4">M4 选品决策</option>
            <option value="M6">M6 补货履约</option>
            <option value="M7">M7 内容合规</option>
            <option value="M8">M8 组织权限</option>
          </select>
          <button type="button" class="btn btn-sm" @click="load">刷新</button>
        </div>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>模块 / 动作</th>
            <th>中文业务轨迹</th>
            <th>状态</th>
            <th>Trace ID</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in audits" :key="a.event_id">
            <td>
              <span class="pill p-blue">{{ a.module }}</span>
              <div class="table-sub"><code>{{ a.action }}</code></div>
            </td>
            <td>{{ a.sentence_zh }}</td>
            <td><span class="pill" :class="a.ok ? 'p-green' : 'p-red'">{{ a.ok ? "放行" : "拦截" }}</span></td>
            <td><code>{{ a.trace_id }}</code></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
