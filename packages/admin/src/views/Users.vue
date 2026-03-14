<template>
  <AppLayout>
    <div class="users-page">
      <div class="page-header">
        <h1 data-testid="page-title">
          用户管理
        </h1>
        <button
          class="btn btn-primary"
          data-testid="create-user-btn"
          @click="showCreateModal = true"
        >
          + 创建用户
        </button>
      </div>

      <div
        class="users-list"
        data-testid="users-list"
      >
        <div
          v-if="loading"
          class="loading"
        >
          加载中...
        </div>
        <div
          v-else-if="users.length === 0"
          class="empty-state"
        >
          暂无用户
        </div>
        <div
          v-else
          class="table-container"
        >
          <table class="data-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="user in users"
                :key="user.id"
                :data-testid="`user-row-${user.id}`"
              >
                <td>{{ user.name }}</td>
                <td>{{ user.email }}</td>
                <td>
                  <span :class="`badge badge-${user.role}`">{{ user.role }}</span>
                </td>
                <td>
                  <span :class="`badge badge-${user.status}`">{{ user.status }}</span>
                </td>
                <td class="actions">
                  <button
                    class="btn btn-sm"
                    data-testid="edit-user-btn"
                    @click="editUser(user)"
                  >
                    编辑
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    data-testid="delete-user-btn"
                    @click="deleteUser(user)"
                  >
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 创建用户模态框 -->
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
            <h2>创建用户</h2>
            <button
              class="close-btn"
              @click="showCreateModal = false"
            >
              ×
            </button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="createUser">
              <div class="form-group">
                <label for="name">姓名</label>
                <input
                  id="name"
                  v-model="newUser.name"
                  type="text"
                  required
                  data-testid="user-name-input"
                >
              </div>
              <div class="form-group">
                <label for="email">邮箱</label>
                <input
                  id="email"
                  v-model="newUser.email"
                  type="email"
                  required
                  data-testid="user-email-input"
                >
              </div>
              <div class="form-group">
                <label for="role">角色</label>
                <select
                  id="role"
                  v-model="newUser.role"
                  data-testid="user-role-select"
                >
                  <option value="viewer">查看者</option>
                  <option value="editor">编辑者</option>
                  <option value="admin">管理员</option>
                  <option value="owner">所有者</option>
                </select>
              </div>
              <div class="form-group">
                <label for="status">状态</label>
                <select
                  id="status"
                  v-model="newUser.status"
                  data-testid="user-status-select"
                >
                  <option value="active">激活</option>
                  <option value="inactive">未激活</option>
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
              @click="createUser"
            >
              创建
            </button>
          </div>
        </div>
      </div>

      <!-- 编辑用户模态框 -->
      <div
        v-if="showEditModal"
        class="modal-overlay"
        @click="showEditModal = false"
      >
        <div
          class="modal"
          @click.stop
        >
          <div class="modal-header">
            <h2>编辑用户</h2>
            <button
              class="close-btn"
              @click="showEditModal = false"
            >
              ×
            </button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="updateUser">
              <div class="form-group">
                <label for="edit-name">姓名</label>
                <input
                  id="edit-name"
                  v-model="editingUser!.name"
                  type="text"
                  required
                  data-testid="edit-user-name-input"
                >
              </div>
              <div class="form-group">
                <label for="edit-email">邮箱</label>
                <input
                  id="edit-email"
                  v-model="editingUser!.email"
                  type="email"
                  required
                  data-testid="edit-user-email-input"
                >
              </div>
              <div class="form-group">
                <label for="edit-role">角色</label>
                <select
                  id="edit-role"
                  v-model="editingUser!.role"
                  data-testid="edit-user-role-select"
                >
                  <option value="viewer">查看者</option>
                  <option value="editor">编辑者</option>
                  <option value="admin">管理员</option>
                  <option value="owner">所有者</option>
                </select>
              </div>
              <div class="form-group">
                <label for="edit-status">状态</label>
                <select
                  id="edit-status"
                  v-model="editingUser!.status"
                  data-testid="edit-user-status-select"
                >
                  <option value="active">激活</option>
                  <option value="inactive">未激活</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button
              class="btn"
              @click="showEditModal = false"
            >
              取消
            </button>
            <button
              class="btn btn-primary"
              data-testid="confirm-update-btn"
              @click="updateUser"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { api } from '@/api'
import { AppLayout } from '@/components'

interface User {
  id: string
  name: string
  email: string
  role: string
  status: string
  createdAt: string
}

const users = ref<User[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingUser = ref<User | null>(null)
const newUser = ref({
  name: '',
  email: '',
  role: 'viewer',
  status: 'active',
})

const fetchUsers = async () => {
  try {
    const response = await api.get<User[]>('/users')
    users.value = response.data
  } catch {
    // Handle error silently
  } finally {
    loading.value = false
  }
}

const createUser = async () => {
  try {
    await api.post('/users', newUser.value)
    showCreateModal.value = false
    await fetchUsers()
    newUser.value = { name: '', email: '', role: 'viewer', status: 'active' }
  } catch {
    alert('创建失败')
  }
}

const editUser = (user: User) => {
  editingUser.value = { ...user }
  showEditModal.value = true
}

const updateUser = async () => {
  if (!editingUser.value) return
  try {
    await api.put(`/users/${editingUser.value.id}`, editingUser.value)
    showEditModal.value = false
    await fetchUsers()
  } catch {
    alert('更新失败')
  }
}

const deleteUser = async (user: User) => {
  if (confirm('确定删除此用户？')) {
    try {
      await api.delete(`/users/${user.id}`)
      await fetchUsers()
    } catch {
      alert('删除失败')
    }
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.users-page {
  padding: 2rem;
}
.page-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
}
.page-header h1 {
  font-size: 1.5rem;
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
.btn-danger {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
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
}
.data-table th,
.data-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}
.data-table th {
  background: #f8f9fa;
}
.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}
.badge-owner {
  background: #d4edda;
  color: #155724;
}
.badge-admin {
  background: #cce5ff;
  color: #004085;
}
.badge-editor {
  background: #fff3cd;
  color: #856404;
}
.badge-viewer {
  background: #e9ecef;
  color: #495057;
}
.badge-active {
  background: #d4edda;
  color: #155724;
}
.badge-inactive {
  background: #f8d7da;
  color: #721c24;
}
.loading,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #6c757d;
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

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
}

.close-btn:hover {
  color: #1a1a1a;
}
</style>
