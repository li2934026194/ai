<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import axios from "axios";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { ALL_9_ROLES } from "@/composables/usePermission";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const users = ref<any[]>([]);
const errMsg = ref("");
const loginResult = ref("");

const form = reactive({
  user_id: "",
  display_name: "",
  role_code: "planner",
  email: "",
  password: "crosspilot123",
  allowed_shops_text: "",
});

const loginForm = reactive({
  org_id: "org_demo",
  user_id: "usr_approver",
  password: "crosspilot123",
});

const stats = computed(() => ({
  total: users.value.length,
  active: users.value.filter((u) => u.is_active).length,
  allShops: users.value.filter((u) => !u.allowed_shop_ids?.length).length,
  scoped: users.value.filter((u) => u.allowed_shop_ids?.length).length,
}));

async function load() {
  errMsg.value = "";
  try {
    users.value = (await platformApi.listUsers()).items;
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function createUser() {
  errMsg.value = "";
  try {
    const allowed_shop_ids = form.allowed_shops_text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await platformApi.createUser({
      user_id: form.user_id,
      display_name: form.display_name,
      role_code: form.role_code,
      email: form.email,
      password: form.password,
      allowed_shop_ids,
    });
    ws.showToast("已新增员工账号并记录 M8 审计");
    form.user_id = "";
    form.display_name = "";
    form.email = "";
    form.allowed_shops_text = "";
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function updateRole(u: any, newRole: string, active: boolean, shopIds?: string[]) {
  errMsg.value = "";
  try {
    await platformApi.updateUser(
      u.user_id,
      newRole,
      active,
      shopIds ?? u.allowed_shop_ids ?? []
    );
    ws.showToast(`已更新 ${u.display_name} 岗位授权`);
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function editShopScope(u: any) {
  const current = (u.allowed_shop_ids || []).join(", ");
  const raw = window.prompt(`设置 ${u.display_name} 允许访问的店铺编码（逗号分隔，留空代表全部店铺）`, current);
  if (raw === null) return;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await updateRole(u, u.role_code, u.is_active, ids);
}

async function verifyJwtLogin() {
  errMsg.value = "";
  loginResult.value = "";
  try {
    const res = await platformApi.authLogin(loginForm.org_id, loginForm.user_id, loginForm.password);
    loginResult.value = `登录成功：${res.user.display_name} (${res.user.role_code})，已签发 HS256 JWT (${res.access_token.slice(0, 28)}...)`;
    ws.showToast("真实账号密码校验通过");
  } catch (e) {
    if (axios.isAxiosError(e) && e.response) {
      const p = e.response.data as any;
      errMsg.value = `${p?.code || e.response.status}: ${p?.message || e.message}`;
    } else if (e instanceof M7ApiError) {
      errMsg.value = `${e.code}: ${e.message}`;
    }
  }
}

onMounted(() => void load());
</script>

<template>
  <div>
    <div v-if="errMsg" class="alert alert-red">{{ errMsg }}</div>

    <div class="grid-4" style="margin-bottom:14px;">
      <div class="kpi-card"><div class="kpi-label">账号总数</div><div class="kpi-val">{{ stats.total }}</div></div>
      <div class="kpi-card"><div class="kpi-label">在岗启用</div><div class="kpi-val" style="color:#047857;">{{ stats.active }}</div></div>
      <div class="kpi-card"><div class="kpi-label">全店权限</div><div class="kpi-val" style="color:#1d4ed8;">{{ stats.allShops }}</div></div>
      <div class="kpi-card"><div class="kpi-label">限定店铺范围</div><div class="kpi-val" style="color:#b45309;">{{ stats.scoped }}</div></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>员工花名册与在线调岗</span>
          <button type="button" class="btn btn-sm" @click="load">刷新</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>账号 / 姓名</th>
              <th>当前岗位</th>
              <th>店铺范围</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.user_id">
              <td>
                <strong>{{ u.display_name }}</strong>
                <div class="table-sub"><code>{{ u.user_id }}</code></div>
              </td>
              <td>
                <select
                  class="select"
                  style="min-width:110px;"
                  :value="u.role_code"
                  @change="updateRole(u, ($event.target as HTMLSelectElement).value, u.is_active)"
                >
                  <option v-for="r in ALL_9_ROLES" :key="r.key" :value="r.key">{{ r.key }}</option>
                </select>
              </td>
              <td>
                <span v-if="!u.allowed_shop_ids?.length" class="pill p-blue">全部</span>
                <span v-else class="pill p-amber">{{ u.allowed_shop_ids.join(",") }}</span>
                <button type="button" class="btn btn-sm" style="margin-left:4px;height:24px;padding:0 6px;" @click="editShopScope(u)">改</button>
              </td>
              <td>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="u.is_active ? '' : 'btn-primary'"
                  @click="updateRole(u, u.role_code, !u.is_active)"
                >
                  {{ u.is_active ? "启用中" : "已停用" }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="card">
          <div class="card-title">新增员工账号</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div class="grid-2">
              <div>
                <label class="field-label">账号 ID</label>
                <input v-model="form.user_id" class="input" placeholder="如 usr_ops_02" />
              </div>
              <div>
                <label class="field-label">姓名</label>
                <input v-model="form.display_name" class="input" placeholder="如 刘运营" />
              </div>
            </div>
            <div class="grid-2">
              <div>
                <label class="field-label">邮箱</label>
                <input v-model="form.email" class="input" placeholder="liu@crosspilot.ai" />
              </div>
              <div>
                <label class="field-label">初始密码</label>
                <input v-model="form.password" type="password" class="input" />
              </div>
            </div>
            <div class="grid-2">
              <div>
                <label class="field-label">岗位角色</label>
                <select v-model="form.role_code" class="select">
                  <option v-for="r in ALL_9_ROLES" :key="r.key" :value="r.key">{{ r.label }}</option>
                </select>
              </div>
              <div>
                <label class="field-label">店铺白名单（逗号分隔）</label>
                <input v-model="form.allowed_shops_text" class="input" placeholder="留空=全部" />
              </div>
            </div>
            <button type="button" class="btn btn-primary btn-lg" @click="createUser">创建账号并授权</button>
          </div>
        </div>

        <div class="card">
          <div class="card-title">JWT 登录与密码校验</div>
          <div class="grid-3" style="margin-bottom:8px;">
            <div>
              <label class="field-label">组织</label>
              <input v-model="loginForm.org_id" class="input" />
            </div>
            <div>
              <label class="field-label">账号 ID</label>
              <input v-model="loginForm.user_id" class="input" />
            </div>
            <div>
              <label class="field-label">密码</label>
              <input v-model="loginForm.password" type="password" class="input" />
            </div>
          </div>
          <button type="button" class="btn btn-primary" @click="verifyJwtLogin">校验登录并签发 JWT</button>
          <div v-if="loginResult" class="alert alert-green" style="margin-top:8px;">{{ loginResult }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
