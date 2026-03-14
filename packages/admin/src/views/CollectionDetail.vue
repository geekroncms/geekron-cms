<template>
  <AppLayout>
    <div class="collection-detail-page">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-left">
          <button class="back-btn" @click="goBack">← 返回</button>
          <h1>{{ collection?.name || '模型详情' }}</h1>
          <span class="slug-badge">{{ collection?.slug }}</span>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" @click="activeTab = 'data'">
            📊 数据管理
          </button>
          <button class="btn btn-secondary" @click="activeTab = 'fields'">
            🔧 字段管理
          </button>
        </div>
      </div>

      <!-- 选项卡 -->
      <div class="tabs">
        <button
          :class="['tab', activeTab === 'fields' ? 'active' : '']"
          @click="activeTab = 'fields'"
        >
          字段管理
        </button>
        <button
          :class="['tab', activeTab === 'data' ? 'active' : '']"
          @click="activeTab = 'data'"
        >
          数据内容
        </button>
      </div>

      <!-- 字段管理面板 -->
      <div v-if="activeTab === 'fields'" class="panel">
        <div class="panel-header">
          <h2>字段列表</h2>
          <button class="btn btn-primary" @click="showFieldModal = true">
            + 添加字段
          </button>
        </div>

        <div v-if="loading" class="loading">加载中...</div>
        <div v-else-if="fields.length === 0" class="empty-state">
          <p>暂无字段，请添加字段</p>
        </div>
        <div v-else class="fields-list">
          <div v-for="field in fields" :key="field.id" class="field-card">
            <div class="field-header">
              <div class="field-info">
                <span class="field-name">{{ field.field_name }}</span>
                <span :class="['field-type', field.field_type]">{{ field.field_type }}</span>
              </div>
              <div class="field-actions">
                <button class="btn-icon" @click="editField(field)">✏️</button>
                <button class="btn-icon danger" @click="deleteField(field.id)">🗑️</button>
              </div>
            </div>
            <div class="field-meta">
              <span v-if="field.is_required" class="badge">必填</span>
              <span v-if="field.is_unique" class="badge">唯一</span>
              <span>{{ field.description || '无描述' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 数据内容面板 -->
      <div v-if="activeTab === 'data'" class="panel">
        <div class="panel-header">
          <h2>数据内容</h2>
          <button class="btn btn-primary" @click="showDataModal = true">
            + 添加数据
          </button>
        </div>

        <div v-if="dataLoading" class="loading">加载中...</div>
        <div v-else-if="dataList.length === 0" class="empty-state">
          <p>暂无数据，请添加数据</p>
        </div>
        <div v-else class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th v-for="field in fields" :key="field.id">
                  {{ field.field_name }}
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in dataList" :key="item.id">
                <td v-for="field in fields" :key="field.id">
                  {{ item[field.field_name] || '-' }}
                </td>
                <td class="actions">
                  <button class="btn-sm" @click="editData(item)">编辑</button>
                  <button class="btn-sm btn-danger" @click="deleteData(item.id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 字段模态框 -->
      <div v-if="showFieldModal" class="modal-overlay" @click="showFieldModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2>{{ editingField ? '编辑字段' : '添加字段' }}</h2>
            <button class="close-btn" @click="showFieldModal = false">×</button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveField">
              <div class="form-group">
                <label>字段名称</label>
                <input
                  v-model="fieldForm.field_name"
                  type="text"
                  placeholder="例如：title, content, price"
                  required
                  pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"
                >
                <small>只能包含字母、数字和下划线，且必须以字母或下划线开头</small>
              </div>
              <div class="form-group">
                <label>字段类型</label>
                <select v-model="fieldForm.field_type" required>
                  <option value="text">文本 (text)</option>
                  <option value="number">数字 (number)</option>
                  <option value="boolean">布尔 (boolean)</option>
                  <option value="date">日期 (date)</option>
                  <option value="json">JSON</option>
                  <option value="email">邮箱 (email)</option>
                  <option value="url">网址 (url)</option>
                  <option value="phone">电话 (phone)</option>
                </select>
              </div>
              <div class="form-group">
                <label>描述</label>
                <textarea
                  v-model="fieldForm.description"
                  rows="3"
                  placeholder="字段描述"
                />
              </div>
              <div class="form-group checkbox-group">
                <label>
                  <input v-model="fieldForm.is_required" type="checkbox">
                  必填字段
                </label>
                <label>
                  <input v-model="fieldForm.is_unique" type="checkbox">
                  唯一值
                </label>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showFieldModal = false">取消</button>
            <button class="btn btn-primary" @click="saveField">保存</button>
          </div>
        </div>
      </div>

      <!-- 数据模态框 -->
      <div v-if="showDataModal" class="modal-overlay" @click="showDataModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2>{{ editingData ? '编辑数据' : '添加数据' }}</h2>
            <button class="close-btn" @click="showDataModal = false">×</button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveData">
              <div
                v-for="field in fields"
                :key="field.id"
                class="form-group"
              >
                <label>{{ field.field_name }}</label>
                <input
                  v-if="['text', 'number', 'email', 'url', 'phone', 'date'].includes(field.field_type)"
                  v-model="dataForm[field.field_name]"
                  :type="field.field_type === 'number' ? 'number' : 'text'"
                  :required="field.is_required"
                >
                <select
                  v-else-if="field.field_type === 'boolean'"
                  v-model="dataForm[field.field_name]"
                >
                  <option :value="true">是</option>
                  <option :value="false">否</option>
                </select>
                <textarea
                  v-else-if="field.field_type === 'json'"
                  v-model="dataForm[field.field_name]"
                  rows="4"
                  placeholder="JSON 格式"
                />
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showDataModal = false">取消</button>
            <button class="btn btn-primary" @click="saveData">保存</button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { api } from '@/api'
import { AppLayout } from '@/components'

interface Field {
  id: string
  field_name: string
  field_type: string
  description?: string
  is_required: boolean
  is_unique: boolean
  display_order: number
}

interface Collection {
  id: string
  name: string
  slug: string
  description?: string
}

const route = useRoute()
const router = useRouter()
const collectionId = route.params.id as string

const collection = ref<Collection | null>(null)
const fields = ref<Field[]>([])
const dataList = ref<any[]>([])
const loading = ref(true)
const dataLoading = ref(true)
const activeTab = ref<'fields' | 'data'>('fields')

// 字段模态框
const showFieldModal = ref(false)
const editingField = ref<Field | null>(null)
const fieldForm = reactive({
  field_name: '',
  field_type: 'text',
  description: '',
  is_required: false,
  is_unique: false,
})

// 数据模态框
const showDataModal = ref(false)
const editingData = ref<any>(null)
const dataForm = reactive<any>({})

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
    loading.value = true
    const response = await api.get(`/collections/${collectionId}/fields`)
    fields.value = response.data || []
  } catch (error) {
    console.error('Failed to fetch fields:', error)
  } finally {
    loading.value = false
  }
}

async function fetchData() {
  try {
    dataLoading.value = true
    const response = await api.get(`/collections/${collectionId}/contents`)
    dataList.value = response.data || []
  } catch (error) {
    console.error('Failed to fetch data:', error)
  } finally {
    dataLoading.value = false
  }
}

function goBack() {
  router.push('/collections')
}

function editField(field: Field) {
  editingField.value = field
  fieldForm.field_name = field.field_name
  fieldForm.field_type = field.field_type
  fieldForm.description = field.description || ''
  fieldForm.is_required = field.is_required
  fieldForm.is_unique = field.is_unique
  showFieldModal.value = true
}

async function saveField() {
  try {
    if (editingField.value) {
      await api.put(`/collections/${collectionId}/fields/${editingField.value.id}`, fieldForm)
    } else {
      await api.post(`/collections/${collectionId}/fields`, fieldForm)
    }
    showFieldModal.value = false
    resetFieldForm()
    await fetchFields()
  } catch (error) {
    alert('保存失败')
    console.error(error)
  }
}

async function deleteField(fieldId: string) {
  if (!confirm('确定删除此字段？')) return
  try {
    await api.delete(`/collections/${collectionId}/fields/${fieldId}`)
    await fetchFields()
  } catch (error) {
    alert('删除失败')
    console.error(error)
  }
}

function resetFieldForm() {
  editingField.value = null
  fieldForm.field_name = ''
  fieldForm.field_type = 'text'
  fieldForm.description = ''
  fieldForm.is_required = false
  fieldForm.is_unique = false
}

function editData(item: any) {
  editingData.value = item
  Object.assign(dataForm, item)
  showDataModal.value = true
}

async function saveData() {
  try {
    if (editingData.value) {
      await api.put(`/collections/${collectionId}/contents/${editingData.value.id}`, dataForm)
    } else {
      await api.post(`/collections/${collectionId}/contents`, dataForm)
    }
    showDataModal.value = false
    resetDataForm()
    await fetchData()
  } catch (error) {
    alert('保存失败')
    console.error(error)
  }
}

async function deleteData(id: string) {
  if (!confirm('确定删除此数据？')) return
  try {
    await api.delete(`/collections/${collectionId}/contents/${id}`)
    await fetchData()
  } catch (error) {
    alert('删除失败')
    console.error(error)
  }
}

function resetDataForm() {
  editingData.value = null
  Object.keys(dataForm).forEach(key => delete dataForm[key])
}
</script>

<style scoped>
.collection-detail-page {
  max-width: 1400px;
  margin: 0 auto;
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
  background: #e2e8f0;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #666;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #cbd5e1;
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

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e2e8f0;
}

.tab {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  font-size: 1rem;
  color: #666;
  transition: all 0.2s;
  font-weight: 500;
}

.tab:hover {
  color: #333;
  background: rgba(102, 126, 234, 0.05);
}

.tab.active {
  color: #667eea;
  border-bottom-color: #667eea;
}

.panel {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.panel-header h2 {
  font-size: 1.25rem;
  margin: 0;
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.fields-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s;
}
.field-card:hover {
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.field-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.field-name {
  font-weight: 600;
  font-size: 1rem;
}

.field-type {
  background: #e2e8f0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: monospace;
}

.field-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  background: #f1f5f9;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #e2e8f0;
  transform: scale(1.1);
}

.btn-icon.danger:hover {
  background: #fee2e2;
}

.field-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.875rem;
  color: #666;
}

.badge {
  background: #667eea;
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.data-table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.data-table th {
  background: #f8f9fa;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-sm.btn-danger {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.btn-sm.btn-danger:hover {
  background: #c82333;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-primary {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.btn-primary:hover {
  background: #5a6fd6;
}

.btn-secondary {
  background: #e2e8f0;
  color: #333;
  border-color: #e2e8f0;
}

.btn-secondary:hover {
  background: #cbd5e1;
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
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: modalSlideIn 0.3s ease;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  background: #f1f5f9;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}
.close-btn:hover {
  background: #e2e8f0;
  color: #333;
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
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: all 0.2s;
}
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group small {
  color: #666;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: block;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: normal;
}
</style>
