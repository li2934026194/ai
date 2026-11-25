<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { M7ApiError } from "@/api/client";
import { platformApi } from "@/api/platform";
import { ALL_9_ROLES } from "@/composables/usePermission";
import { useM7WorkspaceStore } from "@/stores/m7Workspace";

const ws = useM7WorkspaceStore();
const users = ref<any[]>([]);
const errMsg = ref("");

const form = reactive({
  user_id: "",
  display_name: "",
  role_code: "planner",
  email: "",
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
    await platformApi.createUser(form);
    ws.showToast("已新增员工账号并记录 M8 审计");
    form.user_id = "";
    form.display_name = "";
    form.email = "";
    await load();
  } catch (e) {
    if (e instanceof M7ApiError) errMsg.value = `${e.code}: ${e.message}`;
  }
}

async function updateRole(u: any, newRole: string, active: boolean) {
  errMsg.value = "";
  try {
    await platformApi.updateUser(u.user_id, newRole, active);
    ws.showToast(`已更新 ${u.display_name} 岗位授权`);
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

    <div class="grid-2">
      <div class="card">
        <div class="card-title">员工花名册与在线调岗（M8-1）</div>
        <table class="table">
          <thead>
            <tr>
              <th>账号</th>
              <th>姓名</th>
              <th>当前岗位</th>
              <th>状态</th>
              <th>停用/启用</th>
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

      <div class="card">
        <div class="card-title">新增员工账号（需 m8:manage）</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label class="field-label">账号 ID</label>
            <input v-model="form.user_id" class="input" placeholder="如 usr_ops_02" />
          </div>
          <div>
            <label class="field-label">姓名</label>
            <input v-model="form.display_name" class="input" placeholder="如 刘运营" />
          </div>
          <div>
            <label class="field-label">邮箱</label>
            <input v-model="form.email" class="input" placeholder="liu@crosspilot.ai" />
          </div>
          <div>
            <label class="field-label">岗位角色</label>
            <select v-model="form.role_code" class="select">
              <option v-for="r in ALL_9_ROLES" :key="r.key" :value="r.key">{{ r.label }}</option>
            </select>
          </div>
          <button type="button" class="btn btn-primary" @click="createUser">创建账号并授权</button>
        </div>
      </div>
    </div>
  </div>
</template>
