<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
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

    <div class="grid-2">
      <div class="card">
        <div class="card-title">员工花名册、在线调岗与店铺范围授权（M8-1）</div>
        <table class="table">
          <thead>
            <tr>
              <th>账号</th>
              <th>姓名</th>
              <th>当前岗位</th>
              <th>店铺范围</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.user_id">
              <td><code>{{ u.user_id }}</code></td>
              <td>{{ u.display_name }}<div style="font-size:11px;color:#64748b;">{{ u.email }}</div></td>
              <td>
                <select
                  class="select"
                  :value="u.role_code"
                  @change="updateRole(u, ($event.target as HTMLSelectElement).value, u.is_active)"
                >
                  <option v-for="r in ALL_9_ROLES" :key="r.key" :value="r.key">{{ r.key }}</option>
                </select>
              </td>
              <td>
                <span v-if="!u.allowed_shop_ids?.length" class="pill p-blue">全部店铺</span>
                <span v-else class="pill p-amber">{{ u.allowed_shop_ids.join(", ") }}</span>
                <button type="button" class="btn btn-sm" style="margin-left:4px;" @click="editShopScope(u)">改范围</button>
              </td>
              <td>
                <span class="pill" :class="u.is_active ? 'p-green' : 'p-red'">{{ u.is_active ? "启用" : "停用" }}</span>
              </td>
              <td>
                <button type="button" class="btn btn-sm" @click="updateRole(u, u.role_code, !u.is_active)">
                  {{ u.is_active ? "停用" : "启用" }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="card">
          <div class="card-title">新增员工账号（需 m8:manage）</div>
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
                <label class="field-label">授权店铺白名单（可选，逗号分隔）</label>
                <input v-model="form.allowed_shops_text" class="input" placeholder="留空=全部，如 AMZ-US-01" />
              </div>
            </div>
            <button type="button" class="btn btn-primary" @click="createUser">创建账号并授权</button>
          </div>
        </div>

        <div class="card">
          <div class="card-title">真实账号密码登录与 JWT 签发验证（POST /api/v1/auth/login）</div>
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
              <label class="field-label">密码（演示默认 crosspilot123）</label>
              <input v-model="loginForm.password" type="password" class="input" />
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-primary" @click="verifyJwtLogin">校验登录并签发 JWT</button>
          <div v-if="loginResult" class="alert alert-green" style="margin-top:8px;">{{ loginResult }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
