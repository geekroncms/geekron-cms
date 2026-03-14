<template>
  <AppLayout>
    <div class="metadata-page">
      <div class="page-header">
        <h1 data-testid="page-title">元数据管理</h1>
        <button class="btn btn-primary" @click="showCreateModal = true">
          + 创建 Schema
        </button>
      </div>

      <!-- Schema 列表 -->
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="schemas.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>暂无 Schema</h3>
        <p>创建第一个元数据 Schema</p>
        <button class="btn btn-primary" @click="showCreateModal = true">
          创建 Schema
        </button>
      </div>
      <div v-else class="schemas-grid">
        <div v-for="schema in schemas" :key="schema.id" class="schema-card">
          <div class="schema-header">
            <div class="schema-info">
              <h3>{{ schema.name }}</h3>
              <span class="version">v{{ schema.version }}</span>
            </div>
            <span :class="['status-badge', schema.status]">{{ schema.status }}</span>
          </div>
          <div class="schema-body">
            <div class="schema-meta">
              <span>📝 {{ schema.field_count || 0 }} 个字段</span>
              <span>📅 {{ formatDate(schema.created_at) }}</span>
            </div>
            <div class="schema-desc">
              {{ schema.description || '无描述' }}
            </div>
          </div>
          <div class="schema-actions">
            <button class="btn-sm" @click="viewSchema(schema)">查看</button>
            <button class="btn-sm" @click="editSchema(schema)">编辑</button>
            <button
              v-if="schema.status === 'draft'"
              class="btn-sm btn-primary"
              @click="publishSchema(schema)"
            >
              发布
            </button>
            <button class="btn-sm btn-danger" @click="deleteSchema(schema)">删除</button>
          </div>
        </div>
      </div>

      <!-- 创建/编辑模态框 -->
      <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2>{{ editingSchema ? '编辑 Schema' : '创建 Schema' }}</h2>
            <button class="close-btn" @click="showCreateModal = false">×</button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveSchema">
              <div class="form-group">
                <label>名称</label>
                <input
                  v-model="schemaForm.name"
                  type="text"
                  placeholder="例如：User, Product, Article"
                  required
                >
              </div>
              <div class="form-group">
                <label>版本</label>
                <input
                  v-model="schemaForm.version"
                  type="text"
                  placeholder="1.0.0"
                  pattern="^\d+\.\d+\.\d+$"
                  required
                >
                <small>语义化版本格式 (例如：1.0.0)</small>
              </div>
              <div class="form-group">
                <label>描述</label>
                <textarea
                  v-model="schemaForm.description"
                  rows="3"
                  placeholder="Schema 描述"
                />
              </div>
              <div class="form-group">
                <label>状态</label>
                <select v-model="schemaForm.status">
                  <option value="draft">草稿</option>
                  <option value="active">活跃</option>
                  <option value="deprecated">已弃用</option>
                </select>
              </div>
              <div class="form-group">
                <label>Schema JSON</label>
                <textarea
                  v-model="schemaForm.schema_json_str"
                  rows="6"
                  placeholder='{"type": "object", "properties": {...}}'
                  @blur="validateJson"
                />
                <small v-if="jsonError" class="error">{{ jsonError }}</small>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showCreateModal = false">取消</button>
            <button class="btn btn-primary" @click="saveSchema">保存</button>
          </div>
        </div>
      </div>

      <!-- Schema 详情模态框 -->
      <div v-if="showDetailModal" class="modal-overlay" @click="showDetailModal = false">
        <div class="modal modal-large" @click.stop>
          <div class="modal-header">
            <h2>{{ selectedSchema?.name }}</h2>
            <button class="close-btn" @click="showDetailModal = false">×</button>
          </div>
          <div class="modal-body">
            <div v-if="selectedSchema" class="schema-detail">
              <div class="detail-section">
                <h3>基本信息</h3>
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="label">版本</span>
                    <span class="value">{{ selectedSchema.version }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">状态</span>
                    <span :class="['status-badge', selectedSchema.status]">
                      {{ selectedSchema.status }}
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="label">创建时间</span>
                    <span class="value">{{ formatDate(selectedSchema.created_at) }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">更新时间</span>
                    <span class="value">{{ formatDate(selectedSchema.updated_at) }}</span>
                  </div>
                </div>
              </div>
              <div class="detail-section">
                <h3>字段列表</h3>
                <div v-if="fields.length === 0" class="empty-tip">暂无字段</div>
                <table v-else class="fields-table">
                  <thead>
                    <tr>
                      <th>字段名</th>
                      <th>类型</th>
                      <th>必填</th>
                      <th>唯一</th>
                      <th>描述</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="field in fields" :key="field.id">
                      <td><code>{{ field.field_name }}</code></td>
                      <td><span class="type-tag">{{ field.field_type }}</span></td>
                      <td>{{ field.is_required ? '是' : '否' }}</td>
                      <td>{{ field.is_unique ? '是' : '否' }}</td>
                      <td>{{ field.description || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showDetailModal = false">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

import { api } from '@/api'
import { AppLayout } from '@/components'

interface Schema {
  id: string
  name: string
  version: string
  status: string
  description?: string
  field_count?: number
  created_at: string
  updated_at: string
}

interface Field {
  id: string
  field_name: string
  field_type: string
  is_required: boolean
  is_unique: boolean
  description?: string
}

const schemas = ref<Schema[]>([])
const fields = ref<Field[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const showDetailModal = ref(false)
const editingSchema = ref<Schema | null>(null)
const selectedSchema = ref<Schema | null>(null)
const jsonError = ref('')

const schemaForm = reactive({
  name: '',
  version: '1.0.0',
  description: '',
  status: 'draft',
  schema_json_str: '',
})

onMounted(() => {
  fetchSchemas()
})

async function fetchSchemas() {
  try {
    loading.value = true
    const response = await api.get('/metadata/schemas')
    schemas.value = response.data || []
  } catch (error) {
    console.error('Failed to fetch schemas:', error)
  } finally {
    loading.value = false
  }
}

async function fetchFields(schemaId: string) {
  try {
    const response = await api.get(`/metadata/schemas/${schemaId}/fields`)
    fields.value = response.data || []
  } catch (error) {
    console.error('Failed to fetch fields:', error)
  }
}

function validateJson() {
  try {
    if (schemaForm.schema_json_str) {
      JSON.parse(schemaForm.schema_json_str)
      jsonError.value = ''
    }
  } catch {
    jsonError.value = 'JSON 格式错误'
  }
}

async function saveSchema() {
  try {
    const data: any = {
      name: schemaForm.name,
      version: schemaForm.version,
      description: schemaForm.description,
      status: schemaForm.status,
    }

    if (schemaForm.schema_json_str) {
      data.schema_json = JSON.parse(schemaForm.schema_json_str)
    }

    if (editingSchema.value) {
      await api.put(`/metadata/schemas/${editingSchema.value.id}`, data)
    } else {
      await api.post('/metadata/schemas', data)
    }

    showCreateModal.value = false
    resetForm()
    await fetchSchemas()
  } catch (error) {
    alert('保存失败')
    console.error(error)
  }
}

async function viewSchema(schema: Schema) {
  selectedSchema.value = schema
  await fetchFields(schema.id)
  showDetailModal.value = true
}

function editSchema(schema: Schema) {
  editingSchema.value = schema
  schemaForm.name = schema.name
  schemaForm.version = schema.version
  schemaForm.description = schema.description || ''
  schemaForm.status = schema.status
  schemaForm.schema_json_str = ''
  showCreateModal.value = true
}

async function publishSchema(schema: Schema) {
  if (!confirm(`确定发布 Schema "${schema.name}"？`)) return
  try {
    await api.post(`/metadata/schemas/${schema.id}/publish`)
    alert('发布成功')
    await fetchSchemas()
  } catch (error) {
    alert('发布失败')
    console.error(error)
  }
}

async function deleteSchema(schema: Schema) {
  if (!confirm(`确定删除 Schema "${schema.name}"？`)) return
  try {
    await api.delete(`/metadata/schemas/${schema.id}`)
    schemas.value = schemas.value.filter(s => s.id !== schema.id)
  } catch (error) {
    alert('删除失败')
    console.error(error)
  }
}

function resetForm() {
  editingSchema.value = null
  schemaForm.name = ''
  schemaForm.version = '1.0.0'
  schemaForm.description = ''
  schemaForm.status = 'draft'
  schemaForm.schema_json_str = ''
  jsonError.value = ''
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.metadata-page {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  margin: 0;
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

.schemas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.schema-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.schema-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e2e8f0;
}

.schema-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.schema-info h3 {
  margin: 0;
  font-size: 1rem;
}

.version {
  background: #e2e8f0;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: monospace;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.draft {
  background: #e2e8f0;
  color: #666;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.status-badge.deprecated {
  background: #fff3cd;
  color: #856404;
}

.schema-body {
  padding: 1rem;
}

.schema-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.schema-desc {
  font-size: 0.875rem;
  color: #666;
}

.schema-actions {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
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

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.btn-sm.btn-primary {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.btn-sm.btn-danger {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
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
}

.modal-large {
  max-width: 800px;
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
  padding: 1.5rem;
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
  border-radius: 4px;
  font-size: 1rem;
}

.form-group small {
  color: #666;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: block;
}

.form-group small.error {
  color: #dc3545;
}

.schema-detail {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.detail-section h3 {
  font-size: 1rem;
  margin: 0 0 1rem 0;
  color: #333;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item .label {
  font-size: 0.75rem;
  color: #666;
}

.detail-item .value {
  font-size: 0.875rem;
  font-weight: 500;
}

.empty-tip {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.fields-table {
  width: 100%;
  border-collapse: collapse;
}

.fields-table th,
.fields-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.fields-table th {
  background: #f8f9fa;
  font-weight: 600;
  font-size: 0.875rem;
}

.fields-table td {
  font-size: 0.875rem;
}

.fields-table code {
  background: #f0f0f0;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
}

.type-tag {
  background: #e2e8f0;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: monospace;
}
</style>
