<template>
  <div class="collections-page">
    <header class="header">
      <h1>数据模型管理</h1>
      <button @click="showCreateModal = true" class="btn-primary">+ 新建模型</button>
    </header>
    
    <main class="content">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
      
      <div v-else-if="collections.length === 0" class="empty-state">
        <div class="empty-icon">📁</div>
        <h3>暂无数据模型</h3>
        <p>创建一个数据模型来开始管理您的内容</p>
        <button @click="showCreateModal = true" class="btn-primary">创建第一个模型</button>
      </div>
      
      <div v-else class="grid">
        <div v-for="collection in collections" :key="collection.id" class="card">
          <div class="card-header">
            <div class="card-icon">📊</div>
            <div class="card-info">
              <h3>{{ collection.name }}</h3>
              <span class="slug">{{ collection.slug }}</span>
            </div>
          </div>
          <p class="desc">{{ collection.description || '暂无描述' }}</p>
          <div class="card-meta">
            <span class="meta-item">📝 {{ collection.fieldCount || 0 }} 个字段</span>
            <span class="meta-item">📅 {{ formatDate(collection.createdAt) }}</span>
          </div>
          <div class="card-actions">
            <router-link :to="'/collections/' + collection.id">
              <button class="btn-secondary">管理字段</button>
            </router-link>
            <button @click="handleDelete(collection.id)" class="btn-danger">删除</button>
          </div>
        </div>
      </div>
    </main>
    
    <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <div class="modal" @click.stop>
        <h2>创建数据模型</h2>
        <form @submit.prevent="handleCreate">
          <div class="form-group">
            <label>名称</label>
            <input v-model="newCollection.name" type="text" placeholder="例如：文章、产品、用户" required />
          </div>
          <div class="form-group">
            <label>标识符</label>
            <input v-model="newCollection.slug" type="text" placeholder="例如：articles, products, users" required />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="newCollection.description" rows="3" placeholder="简要描述这个数据模型的用途"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showCreateModal = false" class="btn-secondary">取消</button>
            <button type="submit" class="btn-primary">创建</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { collectionApi } from '@/api';

const collections = ref<any[]>([]);
const loading = ref(true);
const showCreateModal = ref(false);
const newCollection = ref({ name: '', slug: '', description: '' });

onMounted(async () => {
  try {
    loading.value = true;
    const response = await collectionApi.list();
    collections.value = response.data;
  } catch (error) {
    console.error('Failed to fetch collections:', error);
  } finally {
    loading.value = false;
  }
});

async function handleCreate() {
  try {
    const response = await collectionApi.create(newCollection.value);
    collections.value.push(response.data);
    showCreateModal.value = false;
    newCollection.value = { name: '', slug: '', description: '' };
  } catch (error) {
    console.error('Failed to create collection:', error);
    alert('创建失败');
  }
}

async function handleDelete(id: string) {
  if (!confirm('确定要删除这个模型吗？')) return;
  try {
    await collectionApi.delete(id);
    collections.value = collections.value.filter((c: any) => c.id !== id);
  } catch (error) {
    console.error('Failed to delete collection:', error);
    alert('删除失败');
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '未知';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}
</script>

<style scoped>
.collections-page { padding: 2rem; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.header h1 { font-size: 1.5rem; color: #333; }
.loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; padding: 4rem; text-align: center; }
.spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.empty-state h3 { color: #333; margin-bottom: 0.5rem; }
.empty-state p { color: #666; margin-bottom: 1.5rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
.card { background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.card-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
.card-icon { font-size: 2rem; background: #f0f4ff; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 12px; }
.card-info h3 { color: #333; margin-bottom: 0.25rem; }
.slug { color: #667eea; font-family: monospace; font-size: 0.875rem; }
.desc { color: #666; font-size: 0.875rem; margin-bottom: 1rem; }
.card-meta { display: flex; gap: 1rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0; font-size: 0.8125rem; color: #666; }
.card-actions { display: flex; gap: 0.75rem; }
.btn-primary, .btn-secondary, .btn-danger { padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; font-size: 0.875rem; }
.btn-primary { background: #667eea; color: #fff; }
.btn-secondary { background: #e2e8f0; color: #333; }
.btn-danger { background: #e53e3e; color: #fff; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; padding: 2rem; border-radius: 12px; width: 100%; max-width: 500px; }
.modal h2 { margin-bottom: 1.5rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; color: #555; }
.form-group input, .form-group textarea { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }
</style>
