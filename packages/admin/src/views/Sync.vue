<template>
  <AppLayout>
    <div class="sync-page">
      <div class="page-header">
        <h1 data-testid="page-title">数据同步</h1>
        <button class="btn btn-primary" @click="showCreateModal = true">
          + 新建同步任务
        </button>
      </div>

      <!-- 同步任务列表 -->
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="syncTasks.length === 0" class="empty-state">
        <div class="empty-icon">🔄</div>
        <h3>暂无同步任务</h3>
        <p>创建第一个同步任务来同步数据</p>
        <button class="btn btn-primary" @click="showCreateModal = true">
          创建任务
        </button>
      </div>
      <div v-else class="tasks-list">
        <div v-for="task in syncTasks" :key="task.id" class="task-card">
          <div class="task-header">
            <div class="task-info">
              <h3>{{ task.name }}</h3>
              <span :class="['status-badge', task.status]">{{ task.status }}</span>
            </div>
            <div class="task-actions">
              <button
                v-if="task.status === 'pending' || task.status === 'failed'"
                class="btn-sm btn-primary"
                @click="runTask(task)"
              >
                ▶️ 运行
              </button>
              <button
                v-if="task.status === 'running'"
                class="btn-sm btn-warning"
                @click="stopTask(task)"
              >
                ⏹️ 停止
              </button>
              <button class="btn-sm" @click="viewLogs(task)">📋 日志</button>
              <button class="btn-sm btn-danger" @click="deleteTask(task)">🗑️</button>
            </div>
          </div>
          <div class="task-body">
            <div class="task-meta">
              <div class="meta-item">
                <span class="label">源</span>
                <span class="value">{{ task.source_type }}: {{ task.source_name }}</span>
              </div>
              <div class="meta-item">
                <span class="label">目标</span>
                <span class="value">{{ task.target_type }}: {{ task.target_name }}</span>
              </div>
              <div class="meta-item">
                <span class="label">调度</span>
                <span class="value">{{ task.schedule || '手动' }}</span>
              </div>
            </div>
            <div class="task-progress" v-if="task.status === 'running'">
              <div class="progress-bar">
                <div
                  class="progress"
                  :style="{ width: (task.progress || 0) + '%' }"
                />
              </div>
              <span class="progress-text">{{ task.progress || 0 }}%</span>
            </div>
            <div class="task-stats">
              <span>同步：{{ task.synced_count || 0 }} 条</span>
              <span>失败：{{ task.failed_count || 0 }} 条</span>
              <span>最后运行：{{ formatDateTime(task.last_run_at) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 创建任务模态框 -->
      <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2>新建同步任务</h2>
            <button class="close-btn" @click="showCreateModal = false">×</button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="createTask">
              <div class="form-group">
                <label>任务名称</label>
                <input
                  v-model="taskForm.name"
                  type="text"
                  placeholder="例如：每日数据同步"
                  required
                >
              </div>
              <div class="form-group">
                <label>源类型</label>
                <select v-model="taskForm.source_type" required>
                  <option value="api">API</option>
                  <option value="database">数据库</option>
                  <option value="file">文件</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
              <div class="form-group">
                <label>源配置</label>
                <input
                  v-model="taskForm.source_name"
                  type="text"
                  placeholder="源名称/URL"
                  required
                >
              </div>
              <div class="form-group">
                <label>目标类型</label>
                <select v-model="taskForm.target_type" required>
                  <option value="collection">数据模型</option>
                  <option value="database">数据库</option>
                  <option value="file">文件</option>
                </select>
              </div>
              <div class="form-group">
                <label>目标配置</label>
                <input
                  v-model="taskForm.target_name"
                  type="text"
                  placeholder="目标名称"
                  required
                >
              </div>
              <div class="form-group">
                <label>调度配置</label>
                <select v-model="taskForm.schedule">
                  <option value="">手动运行</option>
                  <option value="0 * * * *">每小时</option>
                  <option value="0 0 * * *">每天</option>
                  <option value="0 0 * * 0">每周</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div v-if="taskForm.schedule === 'custom'" class="form-group">
                <label>自定义 Cron</label>
                <input
                  v-model="taskForm.schedule_custom"
                  type="text"
                  placeholder="*/5 * * * *"
                >
                <small>Cron 表达式格式</small>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showCreateModal = false">取消</button>
            <button class="btn btn-primary" @click="createTask">创建</button>
          </div>
        </div>
      </div>

      <!-- 日志模态框 -->
      <div v-if="showLogsModal" class="modal-overlay" @click="showLogsModal = false">
        <div class="modal modal-large" @click.stop>
          <div class="modal-header">
            <h2>同步日志 - {{ currentTask?.name }}</h2>
            <button class="close-btn" @click="showLogsModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="logs-container">
              <div v-if="logs.length === 0" class="empty-tip">暂无日志</div>
              <div v-else class="logs-list">
                <div
                  v-for="log in logs"
                  :key="log.id"
                  :class="['log-item', log.level]"
                >
                  <span class="log-time">{{ formatDateTime(log.timestamp) }}</span>
                  <span class="log-message">{{ log.message }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showLogsModal = false">关闭</button>
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

interface SyncTask {
  id: string
  name: string
  source_type: string
  source_name: string
  target_type: string
  target_name: string
  schedule?: string
  status: string
  progress?: number
  synced_count?: number
  failed_count?: number
  last_run_at?: string
}

interface Log {
  id: string
  timestamp: string
  level: string
  message: string
}

const syncTasks = ref<SyncTask[]>([])
const logs = ref<Log[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const showLogsModal = ref(false)
const currentTask = ref<SyncTask | null>(null)

const taskForm = reactive({
  name: '',
  source_type: 'api',
  source_name: '',
  target_type: 'collection',
  target_name: '',
  schedule: '',
  schedule_custom: '',
})

onMounted(() => {
  fetchTasks()
})

async function fetchTasks() {
  try {
    loading.value = true
    const response = await api.get('/sync/tasks')
    syncTasks.value = response.data || []
  } catch (error) {
    console.error('Failed to fetch sync tasks:', error)
  } finally {
    loading.value = false
  }
}

async function createTask() {
  try {
    const data = {
      name: taskForm.name,
      source_type: taskForm.source_type,
      source_name: taskForm.source_name,
      target_type: taskForm.target_type,
      target_name: taskForm.target_name,
      schedule: taskForm.schedule === 'custom' ? taskForm.schedule_custom : taskForm.schedule,
    }

    await api.post('/sync/tasks', data)
    showCreateModal.value = false
    resetForm()
    await fetchTasks()
  } catch (error) {
    alert('创建失败')
    console.error(error)
  }
}

async function runTask(task: SyncTask) {
  try {
    await api.post(`/sync/tasks/${task.id}/run`)
    alert('任务已启动')
    await fetchTasks()
  } catch (error) {
    alert('启动失败')
    console.error(error)
  }
}

async function stopTask(task: SyncTask) {
  try {
    await api.post(`/sync/tasks/${task.id}/stop`)
    alert('任务已停止')
    await fetchTasks()
  } catch (error) {
    alert('停止失败')
    console.error(error)
  }
}

async function viewLogs(task: SyncTask) {
  currentTask.value = task
  try {
    const response = await api.get(`/sync/tasks/${task.id}/logs`)
    logs.value = response.data || []
  } catch (error) {
    console.error('Failed to fetch logs:', error)
  }
  showLogsModal.value = true
}

async function deleteTask(task: SyncTask) {
  if (!confirm(`确定删除任务 "${task.name}"？`)) return
  try {
    await api.delete(`/sync/tasks/${task.id}`)
    syncTasks.value = syncTasks.value.filter(t => t.id !== task.id)
  } catch (error) {
    alert('删除失败')
    console.error(error)
  }
}

function resetForm() {
  taskForm.name = ''
  taskForm.source_type = 'api'
  taskForm.source_name = ''
  taskForm.target_type = 'collection'
  taskForm.target_name = ''
  taskForm.schedule = ''
  taskForm.schedule_custom = ''
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}
</script>

<style scoped>
.sync-page {
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

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.task-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.task-info h3 {
  margin: 0;
  font-size: 1.125rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.pending {
  background: #e2e8f0;
  color: #666;
}

.status-badge.running {
  background: #cce5ff;
  color: #004085;
}

.status-badge.completed {
  background: #d4edda;
  color: #155724;
}

.status-badge.failed {
  background: #f8d7da;
  color: #721c24;
}

.task-actions {
  display: flex;
  gap: 0.5rem;
}

.task-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.task-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.meta-item .label {
  font-size: 0.75rem;
  color: #666;
}

.meta-item .value {
  font-size: 0.875rem;
  font-weight: 500;
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress {
  height: 100%;
  background: #667eea;
  transition: width 0.3s;
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 600;
  min-width: 50px;
}

.task-stats {
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
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

.btn-sm.btn-warning {
  background: #ffc107;
  color: #1a1a1a;
  border-color: #ffc107;
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
.form-group select {
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

.logs-container {
  max-height: 400px;
  overflow-y: auto;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-item {
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  display: flex;
  gap: 1rem;
}

.log-item.info {
  background: #e3f2fd;
}

.log-item.warning {
  background: #fff3e0;
}

.log-item.error {
  background: #ffebee;
}

.log-time {
  font-family: monospace;
  color: #666;
  white-space: nowrap;
}

.log-message {
  flex: 1;
}

.empty-tip {
  text-align: center;
  color: #666;
  padding: 2rem;
}
</style>
