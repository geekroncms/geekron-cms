<template>
  <div class="version-history-container">
    <!-- 版本历史头部 -->
    <div class="version-header">
      <h3 class="text-lg font-semibold text-gray-900">版本历史</h3>
      <div class="version-actions">
        <button
          @click="refreshVersions"
          class="btn-secondary"
          :disabled="loading"
        >
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
        <button
          @click="showAutoVersionConfig = !showAutoVersionConfig"
          class="btn-secondary"
        >
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          自动版本设置
        </button>
      </div>
    </div>

    <!-- 自动版本配置面板 -->
    <div v-if="showAutoVersionConfig" class="auto-version-config mb-4 p-4 bg-gray-50 rounded-lg">
      <h4 class="text-sm font-medium text-gray-700 mb-3">自动版本控制配置</h4>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-gray-600 mb-1">启用自动版本</label>
          <label class="flex items-center">
            <input
              v-model="autoConfig.enabled"
              type="checkbox"
              class="rounded border-gray-300 text-blue-500 focus:ring-primary"
            />
            <span class="ml-2 text-sm text-gray-700">是</span>
          </label>
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">自动保存间隔 (秒)</label>
          <input
            v-model.number="autoConfig.autoSaveInterval"
            type="number"
            min="60"
            max="3600"
            class="w-full text-sm border-gray-300 rounded-md focus:ring-primary focus:border-primary"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">最大版本数</label>
          <input
            v-model.number="autoConfig.maxVersions"
            type="number"
            min="10"
            max="500"
            class="w-full text-sm border-gray-300 rounded-md focus:ring-primary focus:border-primary"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">保留天数</label>
          <input
            v-model.number="autoConfig.retentionDays"
            type="number"
            min="7"
            max="365"
            class="w-full text-sm border-gray-300 rounded-md focus:ring-primary focus:border-primary"
          />
        </div>
      </div>
      <div class="mt-3 flex justify-end">
        <button @click="saveAutoConfig" class="btn-primary text-sm">
          保存配置
        </button>
      </div>
    </div>

    <!-- 版本列表 -->
    <div class="version-list">
      <div v-if="loading" class="text-center py-8">
        <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p class="mt-2 text-sm text-gray-600">加载中...</p>
      </div>

      <div v-else-if="versions.length === 0" class="text-center py-8 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>暂无版本历史</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="version in versions"
          :key="version.id"
          :class="['version-item', { 'current-version': version.isCurrent }]"
          @click="selectVersion(version)"
        >
          <div class="version-info">
            <div class="version-header-row">
              <span class="version-number">v{{ version.versionNumber }}</span>
              <span v-if="version.isCurrent" class="current-badge">当前版本</span>
              <span :class="['change-type-badge', version.changeType]">
                {{ changeTypeLabels[version.changeType] }}
              </span>
            </div>
            <div class="version-summary">
              {{ version.changeSummary || '无变更说明' }}
            </div>
            <div class="version-meta">
              <span class="version-author">{{ version.createdByEmail || '未知用户' }}</span>
              <span class="version-time">{{ formatTime(version.createdAt) }}</span>
            </div>
          </div>
          <div class="version-actions-cell">
            <button
              @click.stop="viewVersion(version)"
              class="btn-icon"
              title="查看"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              @click.stop="compareVersion(version)"
              class="btn-icon"
              title="比较"
              :disabled="!selectedVersion || selectedVersion.id === version.id"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
            <button
              v-if="!version.isCurrent"
              @click.stop="rollbackToVersion(version)"
              class="btn-icon danger"
              title="回滚到此版本"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 版本详情对话框 -->
    <div v-if="showVersionDetail" class="modal-overlay" @click="closeVersionDetail">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3 class="text-lg font-semibold">版本详情 - v{{ selectedVersionDetail?.versionNumber }}</h3>
          <button @click="closeVersionDetail" class="close-btn">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="version-detail-section">
            <h4 class="text-sm font-medium text-gray-700 mb-2">版本信息</h4>
            <dl class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt class="text-gray-500">版本号</dt>
                <dd class="text-gray-900">v{{ selectedVersionDetail?.versionNumber }}</dd>
              </div>
              <div>
                <dt class="text-gray-500">变更类型</dt>
                <dd class="text-gray-900">{{ changeTypeLabels[selectedVersionDetail?.changeType] }}</dd>
              </div>
              <div>
                <dt class="text-gray-500">创建人</dt>
                <dd class="text-gray-900">{{ selectedVersionDetail?.createdByEmail || '未知' }}</dd>
              </div>
              <div>
                <dt class="text-gray-500">创建时间</dt>
                <dd class="text-gray-900">{{ formatTime(selectedVersionDetail?.createdAt) }}</dd>
              </div>
            </dl>
          </div>
          <div class="version-detail-section">
            <h4 class="text-sm font-medium text-gray-700 mb-2">变更说明</h4>
            <p class="text-sm text-gray-600">{{ selectedVersionDetail?.changeSummary || '无' }}</p>
          </div>
          <div class="version-detail-section">
            <h4 class="text-sm font-medium text-gray-700 mb-2">数据内容</h4>
            <pre class="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-64">{{ JSON.stringify(selectedVersionDetail?.data, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- 版本比较对话框 -->
    <div v-if="showCompare" class="modal-overlay" @click="closeCompare">
      <div class="modal-content modal-large" @click.stop>
        <div class="modal-header">
          <h3 class="text-lg font-semibold">版本比较</h3>
          <button @click="closeCompare" class="close-btn">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="compare-info mb-4">
            <div class="flex items-center justify-between text-sm">
              <span>比较：</span>
              <span class="font-medium">v{{ compareData?.version1?.versionNumber}}</span>
              <span>→</span>
              <span class="font-medium">v{{ compareData?.version2?.versionNumber}}</span>
            </div>
          </div>
          <div class="compare-result">
            <div class="diff-section">
              <h4 class="text-sm font-medium text-green-700 mb-2">新增字段 ({{ Object.keys(compareData?.diff?.added || {}).length }})</h4>
              <pre class="bg-green-50 p-3 rounded text-xs overflow-auto max-h-32">{{ JSON.stringify(compareData?.diff?.added, null, 2) }}</pre>
            </div>
            <div class="diff-section mt-3">
              <h4 class="text-sm font-medium text-red-700 mb-2">删除字段 ({{ Object.keys(compareData?.diff?.removed || {}).length }})</h4>
              <pre class="bg-red-50 p-3 rounded text-xs overflow-auto max-h-32">{{ JSON.stringify(compareData?.diff?.removed, null, 2) }}</pre>
            </div>
            <div class="diff-section mt-3">
              <h4 class="text-sm font-medium text-yellow-700 mb-2">修改字段 ({{ Object.keys(compareData?.diff?.modified || {}).length }})</h4>
              <pre class="bg-yellow-50 p-3 rounded text-xs overflow-auto max-h-48">{{ JSON.stringify(compareData?.diff?.modified, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import type { Ref } from 'vue'

interface Version {
  id: string
  dataId: string
  collectionId: string
  tenantId: string
  versionNumber: number
  data: Record<string, any>
  changeSummary?: string
  changeType: 'create' | 'update' | 'rollback' | 'auto_save'
  createdBy?: string
  createdByEmail?: string
  isCurrent: boolean
  parentVersionId?: string
  createdAt: string
}

interface AutoVersionConfig {
  enabled: boolean
  autoSaveInterval: number
  maxVersions: number
  retentionDays: number
}

const props = defineProps<{
  dataId: string
  collectionId: string
}>()

const emit = defineEmits<{
  (e: 'rollback', version: Version): void
  (e: 'refresh'): void
}>()

const { api } = useApi()

// State
const loading = ref(false)
const versions: Ref<Version[]> = ref([])
const selectedVersion: Ref<Version | null> = ref(null)
const selectedVersionDetail: Ref<Version | null> = ref(null)
const showVersionDetail = ref(false)
const showCompare = ref(false)
const showAutoVersionConfig = ref(false)
const autoConfig: Ref<AutoVersionConfig> = ref({
  enabled: true,
  autoSaveInterval: 300,
  maxVersions: 50,
  retentionDays: 90,
})
const compareData: Ref<{
  version1?: Version
  version2?: Version
  diff?: any
} | null> = ref(null)

const changeTypeLabels = {
  create: '创建',
  update: '更新',
  rollback: '回滚',
  auto_save: '自动保存',
}

// Methods
const loadVersions = async () => {
  loading.value = true
  try {
    const response = await api.get(`/versions/${props.dataId}/history?limit=50`)
    versions.value = response.data.versions || []
  } catch (error) {
    console.error('Failed to load versions:', error)
  } finally {
    loading.value = false
  }
}

const refreshVersions = () => {
  loadVersions()
  emit('refresh')
}

const selectVersion = (version: Version) => {
  selectedVersion.value = version
}

const viewVersion = (version: Version) => {
  selectedVersionDetail.value = version
  showVersionDetail.value = true
}

const closeVersionDetail = () => {
  showVersionDetail.value = false
  selectedVersionDetail.value = null
}

const compareVersion = async (version: Version) => {
  if (!selectedVersion.value) return

  try {
    const response = await api.get('/versions/compare', {
      params: {
        versionId1: selectedVersion.value.id,
        versionId2: version.id,
      },
    })
    compareData.value = {
      version1: selectedVersion.value,
      version2: version,
      diff: response.data.diff,
    }
    showCompare.value = true
  } catch (error) {
    console.error('Failed to compare versions:', error)
  }
}

const closeCompare = () => {
  showCompare.value = false
  compareData.value = null
}

const rollbackToVersion = async (version: Version) => {
  if (!confirm(`确定要回滚到版本 v${version.versionNumber} 吗？此操作将创建一个新的回滚版本。`)) {
    return
  }

  try {
    await api.post('/versions/rollback', {
      versionId: version.id,
      changeSummary: `回滚到版本 v${version.versionNumber}`,
    })
    await loadVersions()
    emit('rollback', version)
  } catch (error: any) {
    alert('回滚失败：' + (error.response?.data?.message || error.message))
  }
}

const loadAutoConfig = async () => {
  try {
    const response = await api.get('/versions/auto-config', {
      params: { collectionId: props.collectionId },
    })
    if (response.data) {
      autoConfig.value = response.data
    }
  } catch (error) {
    console.error('Failed to load auto version config:', error)
  }
}

const saveAutoConfig = async () => {
  try {
    await api.put('/versions/auto-config', {
      collectionId: props.collectionId,
      ...autoConfig.value,
    })
    alert('配置已保存')
    showAutoVersionConfig.value = false
  } catch (error: any) {
    alert('保存失败：' + (error.response?.data?.message || error.message))
  }
}

const formatTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Lifecycle
onMounted(() => {
  loadVersions()
  loadAutoConfig()
})
</script>

<style scoped>
.version-history-container {
  @apply bg-white rounded-lg shadow-sm border border-gray-200 p-4;
}

.version-header {
  @apply flex items-center justify-between mb-4 pb-3 border-b border-gray-200;
}

.version-actions {
  @apply flex gap-2;
}

.btn-secondary {
  @apply px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors;
}

.btn-primary {
  @apply px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors;
}

.btn-icon {
  @apply p-1.5 text-gray-500 hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-icon.danger {
  @apply text-red-500 hover:text-red-700 hover:bg-red-50;
}

.version-list {
  @apply max-h-96 overflow-y-auto;
}

.version-item {
  @apply flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer transition-colors border border-transparent;
}

.version-item.current-version {
  @apply bg-blue-50 border-blue-200;
}

.version-info {
  @apply flex-1;
}

.version-header-row {
  @apply flex items-center gap-2 mb-1;
}

.version-number {
  @apply font-semibold text-blue-500;
}

.current-badge {
  @apply px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full;
}

.change-type-badge {
  @apply px-2 py-0.5 text-xs rounded-full;
}

.change-type-badge.create {
  @apply bg-blue-100 text-blue-700;
}

.change-type-badge.update {
  @apply bg-yellow-100 text-yellow-700;
}

.change-type-badge.rollback {
  @apply bg-purple-100 text-purple-700;
}

.change-type-badge.auto_save {
  @apply bg-gray-100 text-gray-700;
}

.version-summary {
  @apply text-sm text-gray-600 mb-1;
}

.version-meta {
  @apply flex items-center gap-3 text-xs text-gray-500;
}

.version-actions-cell {
  @apply flex items-center gap-1;
}

.modal-overlay {
  @apply fixed inset-0 bg-black/50 flex items-center justify-center z-50;
}

.modal-content {
  @apply bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col;
}

.modal-content.modal-large {
  @apply max-w-4xl;
}

.modal-header {
  @apply flex items-center justify-between p-4 border-b border-gray-200;
}

.close-btn {
  @apply p-1 text-gray-400 hover:text-gray-600 rounded transition-colors;
}

.modal-body {
  @apply p-4 overflow-y-auto flex-1;
}

.version-detail-section,
.diff-section {
  @apply mb-4;
}

.auto-version-config {
  @apply border border-gray-200;
}
</style>
