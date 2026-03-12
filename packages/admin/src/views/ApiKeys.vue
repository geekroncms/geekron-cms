<template>
  <AppLayout>
    <div class="api-keys-page">
      <div class="page-header">
        <h1 data-testid="page-title">API Key 管理</h1>
        <button 
          @click="showCreateModal = true" 
          class="btn btn-primary"
          data-testid="create-api-key-btn"
        >
          + 创建 API Key
        </button>
      </div>

      <div class="api-keys-list" data-testid="api-keys-list">
        <div v-if="loading" class="loading">加载中...</div>
        <div v-else-if="keys.length === 0" class="empty-state">暂无 API Key</div>
        <div v-else class="cards-container">
          <div v-for="key in keys" :key="key.id" class="key-card" :data-testid="`api-key-card-${key.id}`">
            <div class="key-header">
              <h3>{{ key.name }}</h3>
              <span :class="`badge badge-${key.status}`">{{ key.status }}</span>
            </div>
            <div class="key-info">
              <div class="key-value">
                <code>{{ key.masked_key || 'gk_••••••••••••' }}</code>
                <button @click="copyKey(key)" class="btn-copy" data-testid="copy-key-btn">复制</button>
              </div>
              <div class="key-permissions">
                <strong>权限:</strong>
                <span v-for="perm in key.permissions" :key="perm" class="permission-tag">{{ perm }}</span>
              </div>
              <div class="key-meta">
                <span>创建：{{ formatDate(key.created_at) }}</span>
                <span v-if="key.expires_at">过期：{{ formatDate(key.expires_at) }}</span>
              </div>
            </div>
            <div class="key-actions">
              <button @click="rotateKey(key)" class="btn btn-sm" data-testid="rotate-key-btn">轮换</button>
              <button @click="deleteKey(key)" class="btn btn-sm btn-danger" data-testid="delete-key-btn">删除</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 创建模态框 -->
      <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2>创建 API Key</h2>
            <button @click="showCreateModal = false" class="close-btn">×</button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="createKey">
              <div class="form-group">
                <label for="name">名称</label>
                <input id="name" v-model="newKey.name" type="text" required data-testid="key-name-input" />
              </div>
              <div class="form-group">
                <label>权限</label>
                <div class="permissions-grid">
                  <label v-for="perm in ['read', 'write', 'delete', 'admin']" :key="perm" class="permission-checkbox">
                    <input 
                      type="checkbox" 
                      :value="perm" 
                      v-model="newKey.permissions"
                      :data-testid="`permission-${perm}-checkbox`"
                    />
                    {{ perm }}
                  </label>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button @click="showCreateModal = false" class="btn">取消</button>
            <button @click="createKey" class="btn btn-primary" data-testid="confirm-create-key-btn">创建</button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AppLayout } from '@/components';
import { api } from '@/api';

const keys = ref<any[]>([]);
const loading = ref(true);
const showCreateModal = ref(false);
const newKey = ref({ name: '', permissions: ['read'] });

const fetchKeys = async () => {
  try {
    const response = await api.get('/api-keys');
    keys.value = response.data;
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
  } finally {
    loading.value = false;
  }
};

const createKey = async () => {
  try {
    const response = await api.post('/api-keys', newKey.value);
    keys.value.unshift(response.data);
    showCreateModal.value = false;
    newKey.value = { name: '', permissions: ['read'] };
  } catch (error: any) {
    alert(error.response?.data?.message || '创建失败');
  }
};

const copyKey = async (key: any) => {
  try {
    await navigator.clipboard.writeText(key.key || 'gk_xxx');
    alert('已复制到剪贴板');
  } catch (error) {
    alert('复制失败');
  }
};

const rotateKey = async (key: any) => {
  if (confirm('确定要轮换此 API Key 吗？旧 Key 将失效。')) {
    try {
      const response = await api.post(`/api-keys/${key.id}/rotate`);
      alert(`新 Key: ${response.data.key}\n请妥善保存！`);
      await fetchKeys();
    } catch (error: any) {
      alert(error.response?.data?.message || '轮换失败');
    }
  }
};

const deleteKey = async (key: any) => {
  if (confirm('确定删除此 API Key？')) {
    try {
      await api.delete(`/api-keys/${key.id}`);
      keys.value = keys.value.filter(k => k.id !== key.id);
    } catch (error: any) {
      alert(error.response?.data?.message || '删除失败');
    }
  }
};

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('zh-CN');

onMounted(() => {
  fetchKeys();
});
</script>

<style scoped>
.api-keys-page { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; margin-bottom: 2rem; }
.page-header h1 { font-size: 1.5rem; }
.btn { padding: 0.5rem 1rem; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; }
.btn-primary { background: #007bff; color: white; border-color: #007bff; }
.btn-danger { background: #dc3545; color: white; border-color: #dc3545; }
.btn-sm { padding: 0.25rem 0.5rem; font-size: 0.875rem; margin-right: 0.5rem; }
.btn-copy { padding: 0.25rem 0.5rem; font-size: 0.75rem; background: #e9ecef; border: none; border-radius: 4px; cursor: pointer; }
.cards-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
.key-card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 1rem; }
.key-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.key-header h3 { font-size: 1rem; margin: 0; }
.key-info { margin-bottom: 1rem; }
.key-value { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.key-value code { background: #f8f9fa; padding: 0.25rem 0.5rem; border-radius: 4px; font-family: monospace; }
.key-permissions { margin-bottom: 0.5rem; }
.permission-tag { display: inline-block; background: #e9ecef; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-right: 0.25rem; }
.key-meta { display: flex; gap: 1rem; font-size: 0.875rem; color: #6c757d; }
.key-actions { display: flex; gap: 0.5rem; }
.badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
.badge-active { background: #d4edda; color: #155724; }
.badge-revoked { background: #f8d7da; color: #721c24; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: white; border-radius: 8px; width: 90%; max-width: 500px; }
.modal-header { display: flex; justify-content: space-between; padding: 1rem; border-bottom: 1px solid #eee; }
.modal-body { padding: 1rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem; border-top: 1px solid #eee; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
.form-group input { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
.permissions-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }
.permission-checkbox { display: flex; align-items: center; gap: 0.5rem; }
.loading, .empty-state { text-align: center; padding: 3rem; color: #6c757d; }
</style>
