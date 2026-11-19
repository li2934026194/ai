<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  ApiError,
  clearToken,
  createRbacUser,
  deleteRbacRole,
  deleteRbacUser,
  getMe,
  getToken,
  listRbacAudit,
  listRbacPermissions,
  listRbacRoles,
  listRbacUsers,
  login,
  setToken,
} from '../api'

const token = ref(getToken())
const me = ref(null)
const users = ref([])
const roles = ref([])
const permissions = ref([])
const audit = ref([])
const error = ref('')
const notice = ref('')
const busy = ref(false)

const username = ref('')
const password = ref('')

const newUser = ref({ username: '', password: '', display_name: '', role_codes: ['viewer'] })
const roleOptions = computed(() => roles.value.map((r) => r.code))

function errText(e) {
  return e instanceof ApiError ? e.code + '：' + e.message : (e && e.message) || String(e)
}

async function loadAll() {
  error.value = ''
  notice.value = ''
  try {
    me.value = (await getMe()).user
  } catch (e) {
    token.value = ''
    clearToken()
    error.value = '登录态失效，请重新登录：' + errText(e)
    return
  }
  const [u, r, p, a] = await Promise.allSettled([
    listRbacUsers(),
    listRbacRoles(),
    listRbacPermissions(),
    listRbacAudit(),
  ])
  if (u.status === 'fulfilled') users.value = u.value.users || []
  if (r.status === 'fulfilled') roles.value = r.value.roles || []
  if (p.status === 'fulfilled') permissions.value = p.value.permissions || []
  if (a.status === 'fulfilled') audit.value = a.value.items || []
  const failed = [u, r, p, a].find((x) => x.status === 'rejected')
  if (failed) error.value = '部分数据读取失败：' + errText(failed.reason)
}

async function doLogin() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const out = await login(username.value.trim(), password.value)
    setToken(out.access_token)
    token.value = out.access_token
    password.value = ''
    await loadAll()
    notice.value = '已登录：' + out.user.username
  } catch (e) {
    error.value = errText(e)
  } finally {
    busy.value = false
  }
}

function doLogout() {
  clearToken()
  token.value = ''
  me.value = null
  users.value = []
  roles.value = []
  permissions.value = []
  audit.value = []
  notice.value = ''
  error.value = ''
}

async function addUser() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const created = await createRbacUser({
      username: newUser.value.username.trim(),
      password: newUser.value.password,
      display_name: newUser.value.display_name || newUser.value.username,
      role_codes: newUser.value.role_codes,
    })
    notice.value = '已创建用户：' + created.username + '（' + created.roles.join(' / ') + '）'
    newUser.value = { username: '', password: '', display_name: '', role_codes: ['viewer'] }
    await loadAll()
  } catch (e) {
    error.value = errText(e)
  } finally {
    busy.value = false
  }
}

async function removeUser(id) {
  if (!window.confirm('确认删除该用户？')) return
  try {
    await deleteRbacUser(id)
    notice.value = '用户已删除'
    await loadAll()
  } catch (e) {
    error.value = errText(e)
  }
}

async function removeRole(id) {
  if (!window.confirm('确认删除该角色？角色仍被用户引用时会被拒绝。')) return
  try {
    await deleteRbacRole(id)
    notice.value = '角色已删除'
    await loadAll()
  } catch (e) {
    error.value = errText(e)
  }
}

onMounted(async () => {
  if (token.value) await loadAll()
})
</script>

<template>
  <section id="page-P7" class="page active">
    <h1 class="page-title">权限中枢</h1>

    <div v-if="!token" class="card section-gap" style="padding:22px;max-width:560px;">
      <h2 style="margin:0 0 6px;font-size:18px;">登录</h2>
      <p class="small muted" style="margin:0 0 14px;">
        JWT 无状态登录；token 只保存在当前浏览器会话。生产环境请通过 HTTPS 访问。
      </p>
      <label class="rbac-label">用户名</label>
      <input v-model="username" class="filter-input" style="width:100%;" autocomplete="username" />
      <label class="rbac-label">密码</label>
      <input v-model="password" type="password" class="filter-input" style="width:100%;" autocomplete="current-password" @keyup.enter="doLogin" />
      <div v-if="error" class="alert alert-missing" style="margin-top:12px;">{{ error }}</div>
      <div style="margin-top:14px;text-align:right;">
        <button class="btn-primary" :disabled="busy" @click="doLogin">{{ busy ? '登录中…' : '登录' }}</button>
      </div>
    </div>

    <div v-else>
      <div class="topbar card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div>
          <span class="muted small">当前用户</span>
          <strong style="margin-left:8px;">{{ me ? me.username : '—' }}</strong>
          <span v-if="me" class="badge badge-online" style="margin-left:8px;">{{ me.roles.join(' / ') }}</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-plain" @click="loadAll">刷新</button>
          <button class="btn-plain" @click="doLogout">退出登录</button>
        </div>
      </div>

      <div v-if="error" class="alert alert-missing section-gap">{{ error }}</div>
      <div v-if="notice" class="alert section-gap" style="background:#EFF6FF;border:1px solid #BFD6F0;color:#1E5A8A;">{{ notice }}</div>

      <div class="card section-gap" style="padding:16px;">
        <h2 class="rbac-h2">新建用户</h2>
        <div class="rbac-form">
          <input v-model="newUser.username" class="filter-input" placeholder="用户名（3-64 位）" />
          <input v-model="newUser.password" class="filter-input" type="password" placeholder="密码（至少 8 位）" />
          <input v-model="newUser.display_name" class="filter-input" placeholder="显示名（可选）" />
          <select v-model="newUser.role_codes" class="filter-input" multiple size="3">
            <option v-for="code in roleOptions" :key="code" :value="code">{{ code }}</option>
          </select>
          <button class="btn-primary" :disabled="busy" @click="addUser">创建</button>
        </div>
        <div class="small muted" style="margin-top:6px;">多选角色：按住 Ctrl / Command 选择。</div>
      </div>

      <div class="rbac-grid section-gap">
        <div class="card" style="padding:16px;">
          <h2 class="rbac-h2">用户（{{ users.length }}）</h2>
          <div class="tbl-wrap"><table class="rbac-table">
            <thead><tr><th>用户名</th><th>角色</th><th>状态</th><th></th></tr></thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td>{{ u.username }}<div class="small muted">{{ u.display_name }}</div></td>
                <td>{{ u.roles.join(' / ') }}</td>
                <td>{{ u.status }}</td>
                <td><button class="btn-plain" @click="removeUser(u.id)">删除</button></td>
              </tr>
              <tr v-if="!users.length"><td colspan="4" class="muted">无数据</td></tr>
            </tbody>
          </table></div>
        </div>

        <div class="card" style="padding:16px;">
          <h2 class="rbac-h2">角色（{{ roles.length }}）</h2>
          <div class="tbl-wrap"><table class="rbac-table">
            <thead><tr><th>角色</th><th>权限</th><th>用户</th><th></th></tr></thead>
            <tbody>
              <tr v-for="r in roles" :key="r.id">
                <td><strong>{{ r.code }}</strong><div class="small muted">{{ r.name }}</div></td>
                <td class="small">{{ r.permissions.join('、') }}</td>
                <td>{{ r.user_count }}</td>
                <td><button class="btn-plain" @click="removeRole(r.id)">删除</button></td>
              </tr>
              <tr v-if="!roles.length"><td colspan="4" class="muted">无数据</td></tr>
            </tbody>
          </table></div>
        </div>
      </div>

      <div class="rbac-grid section-gap">
        <div class="card" style="padding:16px;">
          <h2 class="rbac-h2">权限（{{ permissions.length }}）</h2>
          <div class="tbl-wrap"><table class="rbac-table">
            <thead><tr><th>权限码</th><th>名称</th></tr></thead>
            <tbody>
              <tr v-for="p in permissions" :key="p.id">
                <td><code>{{ p.code }}</code></td>
                <td>{{ p.name }}</td>
              </tr>
              <tr v-if="!permissions.length"><td colspan="2" class="muted">无数据</td></tr>
            </tbody>
          </table></div>
        </div>

        <div class="card" style="padding:16px;">
          <h2 class="rbac-h2">最近审计</h2>
          <div class="tbl-wrap"><table class="rbac-table">
            <thead><tr><th>用户</th><th>动作</th><th>结果</th></tr></thead>
            <tbody>
              <tr v-for="a in audit" :key="a.id">
                <td>{{ a.username || '—' }}</td>
                <td>{{ a.action }}<div class="small muted">{{ a.resource }}</div></td>
                <td>{{ a.result }}</td>
              </tr>
              <tr v-if="!audit.length"><td colspan="3" class="muted">无数据</td></tr>
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  </section>
</template>
