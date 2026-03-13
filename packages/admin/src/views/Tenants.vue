<template>
  <AppLayout>
    <div class="tenants-page">
      <div class="page-header">
        <h1 data-testid="page-title">
          租户管理
        </h1>
        <button
          class="btn btn-primary"
          data-testid="create-tenant-btn"
          @click="showCreateModal = true"
        >
          + 创建租户
        </button>
      </div>

      <!-- 租户列表 -->
      <div
        class="tenants-list"
        data-testid="tenants-list"
      >
        <div
          v-if="loading"
          class="loading"
        >
          加载中...
        </div>
        <div
          v-else-if="tenants.length === 0"
          class="empty-state"
        >
          暂无租户
        </div>
        <div
          v-else
          class="table-container"
        >
          <table class="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>子域名</th>
                <th>套餐</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="tenant in tenants"
                :key="tenant.id"
                :data-testid="`tenant-row-${tenant.id}`"
              >
                <td>{{ tenant.name }}</td>
                <td>{{ tenant.subdomain }}</td>
                <td>
                  <span :class="`badge badge-${tenant.plan}`">
                    {{ tenant.plan }}
                  </span>
                </td>
                <td>
                  <span :class="`badge badge-${tenant.status}`">
                    {{ tenant.status }}
                  </span>
                </td>
                <td>{{ formatDate(tenant.created_at) }}</td>
                <td class="actions">
                  <button
                    class="btn btn-sm"
                    data-testid="view-tenant-btn"
                    @click="viewTenant(tenant)"
                  >
                    查看
                  </button>
                  <button
                    class="btn btn-sm"
                    data-testid="edit-tenant-btn"
                    @click="editTenant(tenant)"
                  >
                    编辑
                  </button>
                  <button
                    class="btn btn-sm"
                    :class="tenant.status === 'active' ? 'btn-warning' : 'btn-success'"
                    data-testid="toggle-status-btn"
                    @click="toggleStatus(tenant)"
                  >
                    {{ tenant.status === 'active' ? '暂停' : '激活' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 创建租户模态框 -->
      <div
        v-if="showCreateModal"
        class="modal-overlay"
        @click="showCreateModal = false"
      >
        <div
          class="modal"
          @click.stop
        >
          <div class="modal-header">
            <h2>创建租户</h2>
            <button
              class="close-btn"
              @click="showCreateModal = false"
            >
              ×
            </button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="createTenant">
              <div class="form-group">
                <label for="name">名称</label>
                <input
                  id="name"
                  v-model="newTenant.name"
                  type="text"
                  required
                  data-testid="tenant-name-input"
                >
              </div>
              <div class="form-group">
                <label for="subdomain">子域名</label>
                <input
                  id="subdomain"
                  v-model="newTenant.subdomain"
                  type="text"
                  required
                  pattern="^[a-z][a-z0-9-]*[a-z0-9]$"
                  data-testid="tenant-subdomain-input"
                >
                <small>只能包含小写字母、数字和连字符</small>
              </div>
              <div class="form-group">
                <label for="email">邮箱</label>
                <input
                  id="email"
                  v-model="newTenant.email"
                  type="email"
                  required
                  data-testid="tenant-email-input"
                >
              </div>
              <div class="form-group">
                <label for="plan">套餐</label>
                <select
                  id="plan"
                  v-model="newTenant.plan"
                  data-testid="tenant-plan-select"
                >
                  <option value="free">
                    免费版
                  </option>
                  <option value="pro">
                    专业版
                  </option>
                  <option value="enterprise">
                    企业版
                  </option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button
              class="btn"
              @click="showCreateModal = false"
            >
              取消
            </button>
            <button
              class="btn btn-primary"
              data-testid="confirm-create-btn"
              @click="createTenant"
            >
              创建
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

import api from '@/api'
import { AppLayout } from '@/components'

interface Tenant {
  id: string
  name: string
  subdomain: string
  email: string
  plan: string
  status: string
  createdAt: string
}

const tenants = ref<Tenant[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const newTenant = ref({
  name: '',
  subdomain: '',
  email: '',
  plan: 'free',
})

const fetchTenants = async () => {
  try {
    const response = await api.get<Tenant[]>('/tenants')
    tenants.value = response.data
  } catch {
    // Handle error silently
  } finally {
    loading.value = false
  }
}

const createTenant = async () => {
  try {
    await api.post('/tenants', newTenant.value)
    showCreateModal.value = false
    await fetchTenants()
    newTenant.value = { name: '', subdomain: '', email: '', plan: 'free' }
  } catch {
    alert('创建失败')
  }
}

const viewTenant = (_tenant: unknown) => {
  // TODO: implement view tenant
}

const editTenant = (_tenant: unknown) => {
  // TODO: implement edit tenant
}

const toggleStatus = async (tenant: Tenant) => {
  try {
    const action = tenant.status === 'active' ? 'suspend' : 'activate'
    await api.post(`/tenants/${tenant.id}/${action}`)
    await fetchTenants()
  } catch {
    alert('操作失败')
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-CN')
}

onMounted(() => {
  fetchTenants()
})
</script>

<style scoped>
.tenants-page {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.5rem;
  color: #1a1a1a;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.btn-primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-success {
  background: #28a745;
  color: white;
  border-color: #28a745;
}

.btn-warning {
  background: #ffc107;
  color: #1a1a1a;
  border-color: #ffc107;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  margin-right: 0.5rem;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.data-table th,
.data-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.data-table th {
  background: #f8f9fa;
  font-weight: 600;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-free {
  background: #e9ecef;
  color: #495057;
}
.badge-pro {
  background: #cce5ff;
  color: #004085;
}
.badge-enterprise {
  background: #d4edda;
  color: #155724;
}
.badge-active {
  background: #d4edda;
  color: #155724;
}
.badge-suspended {
  background: #fff3cd;
  color: #856404;
}
.badge-deleted {
  background: #f8d7da;
  color: #721c24;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.modal-body {
  padding: 1rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #eee;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-group small {
  color: #6c757d;
  font-size: 0.875rem;
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #6c757d;
}
</style>
