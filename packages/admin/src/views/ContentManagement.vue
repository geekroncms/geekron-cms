<template>
  <AppLayout>
    <div class="content-management-page">
      <div class="page-header">
        <div class="header-left">
          <button class="back-btn" @click="goBack">← 返回</button>
          <h1>{{ collection?.name || '数据内容管理' }}</h1>
          <span class="slug-badge">{{ collection?.slug }}</span>
        </div>
        <button class="btn btn-primary" @click="showCreateModal = true">
          + 添加数据
        </button>
      </div>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索..."
          class="search-input"
        >
        <select v-model="sortBy" class="select-input">
          <option value="createdAt_desc">最新创建</option>
          <option value="createdAt_asc">最早创建</option>
          <option value="updatedAt_desc">最近更新</option>
        </select>
      </div>

      <!-- 数据列表 -->
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="dataList.length === 0" class="empty-state">
        <div class="empty-icon">📄</div>
        <h3>暂无数据</h3>
        <p>创建第一条数据记录</p>
        <button class="btn btn-primary" @click="showCreateModal = true">
          添加数据
        </button>
      </div>
      <div v-else class="data-grid">
        <div v-for="item in dataList" :key="item.id" class="data-card">
          <div class="card-header">
            <h3>{{ getItemTitle(item) }}</h3>
            <div class="card-actions">
              <button class="btn-icon" @click="showVersionHistory(item)" title="版本历史">📜</button>
              <button class="btn-icon" @click="editItem(item)">✏️</button>
              <button class="btn-icon danger" @click="deleteItem(item.id)">🗑️</button>
            </div>
          </div>
          <div class="card-body">
            <div
              v-for="field in visibleFields"
              :key="field.id"
              class="field-value"
            >
              <span class="field-label">{{ field.field_name }}:</span>
              <span class="value">{{ formatValue(item[field.field_name], field.field_type) }}</span>
            </div>
          </div>
          <div class="card-footer">
            <span class="meta">创建：{{ formatDate(item.createdAt) }}</span>
            <span class="meta">更新：{{ formatDate(item.updatedAt) }}</span>
          </div>
        </div>
      </div>

      <!-- 版本历史模态框 -->
      <div v-if="showVersionHistoryModal" class="modal-overlay modal-overlay-large" @click="closeVersionHistory">
        <div class="modal modal-large" @click.stop>
          <div class="modal-header">
            <h2>版本历史 - {{ currentItem?.id }}</h2>
            <button class="close-btn" @click="closeVersionHistory">×</button>
          </div>
          <div class="modal-body">
            <VersionHistory
              v-if="currentItem"
              :data-id="currentItem.id"
              :collection-id="collectionId"
              @rollback="handleVersionRollback"
              @refresh="loadData"
            />
          </div>
        </div>
      </div>

      <!-- 创建/编辑模态框 -->
      <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2>{{ editingItem ? '编辑数据' : '添加数据' }}</h2>
            <button class="close-btn" @click="showCreateModal = false">×</button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveItem">
              <div
                v-for="field in fields"
                :key="field.id"
                class="form-group"
              >
                <label>
                  {{ field.field_name }}
                  <span v-if="field.is_required" class="required">*</span>
                </label>
                <input
                  v-if="['text', 'email', 'url', 'phone'].includes(field.field_type)"
                  v-model="itemForm[field.field_name]"
                  :type="field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'"
                  :required="field.is_required"
                >
                <input
                  v-else-if="field.field_type === 'number'"
                  v-model.number="itemForm[field.field_name]"
                  type="number"
                  :required="field.is_required"
                >
                <input
                  v-else-if="field.field_type === 'date'"
                  v-model="itemForm[field.field_name]"
                  type="date"
                  :required="field.is_required"
                >
                <select
                  v-else-if="field.field_type === 'boolean'"
                  v-model="itemForm[field.field_name]"
                >
                  <option :value="true">是</option>
                  <option :value="false">否</option>
                </select>
                <textarea
                  v-else-if="field.field_type === 'json'"
                  v-model="itemForm[field.field_name]"
                  rows="4"
                  placeholder="JSON 格式"
                />
                <small v-if="field.description">{{ field.description }}</small>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showCreateModal = false">取消</button>
            <button class="btn btn-primary" @click="saveItem">保存</button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { api } from '@/api'
import { AppLayout } from '@/components'
import VersionHistory from '@/components/VersionHistory.vue'

interface Field {
  id: string
  field_name: string
  field_type: string
  description?: string
  is_required: boolean
  display_order: number
}

interface Collection {
  id: string
  name: string
  slug: string
}

const route = useRoute()
const router = useRouter()
const collectionId = route.params.id as string

const collection = ref<Collection | null>(null)
const fields = ref<Field[]>([])
const dataList = ref<any[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const showVersionHistoryModal = ref(false)
const editingItem = ref<any>(null)
const currentItem = ref<any>(null)
const searchQuery = ref('')
const sortBy = ref('createdAt_desc')

const itemForm = reactive<any>({})

const visibleFields = computed(() => {
  return fields.value.slice(0, 3)
})

onMounted(async () => {
  await fetchCollection()
  await fetchFields()
  await fetchData()
})

async function fetchCollection() {
  try {
    const response = await api.get(`/collections/${collectionId}`)
    collection.value = response.data
  } catch (error) {
    console.error('Failed to fetch collection:', error)
  }
}

async function fetchFields() {
  try {
    const response = await api.get(`/collections/${collectionId}/fields`)
    fields.value = response.data || []
  } catch (error) {
    console.error('Failed to fetch fields:', error)
  }
}

async function fetchData() {
  try {
    loading.value = true
    const response = await api.get(`/collections/${collectionId}/contents`, {
      params: { search: searchQuery.value, sort: sortBy.value },
    })
    dataList.value = response.data || []
  } catch (error) {
    console.error('Failed to fetch data:', error)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/collections')
}

function getItemTitle(item: any): string {
  const titleField = fields.value.find(f => f.field_name.toLowerCase().includes('title') || f.field_name.toLowerCase().includes('name'))
  if (titleField) {
    return item[titleField.field_name] || '未命名'
  }
  return `#${item.id?.slice(0, 8)}`
}

function formatValue(value: any, type: string): string {
  if (value === null || value === undefined) return '-'
  if (type === 'boolean') return value ? '是' : '否'
  if (type === 'json') return JSON.stringify(value).slice(0, 50)
  return String(value)
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function editItem(item: any) {
  editingItem.value = item
  Object.assign(itemForm, item)
  showCreateModal.value = true
}

async function saveItem() {
  try {
    if (editingItem.value) {
      await api.put(`/collections/${collectionId}/contents/${editingItem.value.id}`, itemForm)
    } else {
      await api.post(`/collections/${collectionId}/contents`, itemForm)
    }
    showCreateModal.value = false
    resetForm()
    await fetchData()
  } catch (error) {
    alert('保存失败')
    console.error(error)
  }
}

async function deleteItem(id: string) {
  if (!confirm('确定删除此数据？')) return
  try {
    await api.delete(`/collections/${collectionId}/contents/${id}`)
    dataList.value = dataList.value.filter(item => item.id !== id)
  } catch (error) {
    alert('删除失败')
    console.error(error)
  }
}

function showVersionHistory(item: any) {
  currentItem.value = item
  showVersionHistoryModal.value = true
}

function closeVersionHistory() {
  showVersionHistoryModal.value = false
  currentItem.value = null
}

function handleVersionRollback(version: any) {
  alert(`已成功回滚到版本 v${version.versionNumber}`)
  loadData()
}

function resetForm() {
  editingItem.value = null
  Object.keys(itemForm).forEach(key => delete itemForm[key])
}
</script>

<style scoped>
.content-management-page {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-btn {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #666;
}

.back-btn:hover {
  color: #333;
}

h1 {
  font-size: 1.5rem;
  margin: 0;
}

.slug-badge {
  background: #e2e8f0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-family: monospace;
}

.filter-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-input,
.select-input {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.875rem;
}

.search-input {
  flex: 1;
  max-width: 300px;
}

.loading,
.empty-state {
  text-align: center;
  padding: 4rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: #666;
  margin-bottom: 1.5rem;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.data-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8f9fa;
}

.card-header h3 {
  margin: 0;
  font-size: 1rem;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.25rem;
}

.btn-icon.danger:hover {
  opacity: 0.7;
}

.card-body {
  padding: 1rem;
}

.field-value {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 0.875rem;
}

.field-value:last-child {
  border-bottom: none;
}

.field-label {
  color: #666;
  font-weight: 500;
}

.value {
  color: #333;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  font-size: 0.75rem;
  color: #666;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.btn-primary {
  background: #667eea;
  color: white;
  border-color: #667eea;
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

.modal-overlay-large {
  align-items: flex-start;
  padding-top: 2rem;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-large {
  max-width: 900px;
  width: 95%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
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

.required {
  color: #dc3545;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group small {
  color: #666;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: block;
}
</style>
