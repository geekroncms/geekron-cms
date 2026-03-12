<template>
  <AppLayout>
    <div class="users-page">
      <div class="page-header">
        <h1 data-testid="page-title">用户管理</h1>
        <button 
          @click="showCreateModal = true" 
          class="btn btn-primary"
          data-testid="create-user-btn"
        >
          + 创建用户
        </button>
      </div>

      <div class="users-list" data-testid="users-list">
        <div v-if="loading" class="loading">加载中...</div>
        <div v-else-if="users.length === 0" class="empty-state">暂无用户</div>
        <div v-else class="table-container">
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
              <tr v-for="user in users" :key="user.id" :data-testid="`user-row-${user.id}`">
                <td>{{ user.name }}</td>
                <td>{{ user.email }}</td>
                <td>
                  <span :class="`badge badge-${user.role}`">{{ user.role }}</span>
                </td>
                <td>
                  <span :class="`badge badge-${user.status}`">{{ user.status }}</span>
                </td>
                <td class="actions">
                  <button @click="editUser(user)" class="btn btn-sm" data-testid="edit-user-btn">编辑</button>
                  <button @click="deleteUser(user)" class="btn btn-sm btn-danger" data-testid="delete-user-btn">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AppLayout } from '@/components';
import { api } from '@/api';

const users = ref<any[]>([]);
const loading = ref(true);
const showCreateModal = ref(false);

const fetchUsers = async () => {
  try {
    const response = await api.get('/users');
    users.value = response.data;
  } catch (error) {
    console.error('Failed to fetch users:', error);
  } finally {
    loading.value = false;
  }
};

const editUser = (user: any) => console.log('Edit:', user);
const deleteUser = async (user: any) => {
  if (confirm('确定删除此用户？')) {
    try {
      await api.delete(`/users/${user.id}`);
      await fetchUsers();
    } catch (error) {
      alert('删除失败');
    }
  }
};

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.users-page { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; margin-bottom: 2rem; }
.page-header h1 { font-size: 1.5rem; }
.btn { padding: 0.5rem 1rem; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; }
.btn-primary { background: #007bff; color: white; border-color: #007bff; }
.btn-danger { background: #dc3545; color: white; border-color: #dc3545; }
.btn-sm { padding: 0.25rem 0.5rem; font-size: 0.875rem; margin-right: 0.5rem; }
.data-table { width: 100%; border-collapse: collapse; background: white; }
.data-table th, .data-table td { padding: 1rem; text-align: left; border-bottom: 1px solid #eee; }
.data-table th { background: #f8f9fa; }
.badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
.badge-owner { background: #d4edda; color: #155724; }
.badge-admin { background: #cce5ff; color: #004085; }
.badge-editor { background: #fff3cd; color: #856404; }
.badge-viewer { background: #e9ecef; color: #495057; }
.badge-active { background: #d4edda; color: #155724; }
.badge-inactive { background: #f8d7da; color: #721c24; }
.loading, .empty-state { text-align: center; padding: 3rem; color: #6c757d; }
</style>
