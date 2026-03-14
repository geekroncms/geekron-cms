<template>
  <AppLayout>
    <div class="quotas-page">
      <div class="page-header">
        <h1 data-testid="page-title">配额管理</h1>
        <button class="btn btn-secondary" @click="fetchQuotas">
          🔄 刷新
        </button>
      </div>

      <!-- 配额概览 -->
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else class="quotas-overview">
        <!-- 套餐信息 -->
        <div class="plan-card">
          <div class="plan-header">
            <h2>当前套餐</h2>
            <span :class="['plan-badge', quota.plan]">{{ quota.plan }}</span>
          </div>
          <div class="plan-info">
            <div class="info-item">
              <span class="label">租户</span>
              <span class="value">{{ tenantName }}</span>
            </div>
            <div class="info-item">
              <span class="label">角色</span>
              <span class="value">{{ userRole }}</span>
            </div>
          </div>
        </div>

        <!-- API 调用配额 -->
        <div class="quota-card">
          <div class="quota-header">
            <h3>📡 API 调用</h3>
            <span class="quota-period">/分钟</span>
          </div>
          <div class="quota-content">
            <div class="progress-container">
              <div
                class="progress-bar"
                :class="getProgressClass(apiUsagePercent)"
              >
                <div
                  class="progress"
                  :style="{ width: apiUsagePercent + '%' }"
                />
              </div>
              <div class="progress-text">
                {{ apiUsagePercent.toFixed(1) }}%
              </div>
            </div>
            <div class="quota-stats">
              <span class="stat">已用：{{ quota.api_used || 0 }}</span>
              <span class="stat">限制：{{ quota.max_requests_per_minute || 1000 }}/分钟</span>
            </div>
          </div>
        </div>

        <!-- 存储空间配额 -->
        <div class="quota-card">
          <div class="quota-header">
            <h3>💾 存储空间</h3>
          </div>
          <div class="quota-content">
            <div class="progress-container">
              <div
                class="progress-bar"
                :class="getProgressClass(storageUsagePercent)"
              >
                <div
                  class="progress"
                  :style="{ width: storageUsagePercent + '%' }"
                />
              </div>
              <div class="progress-text">
                {{ storageUsagePercent.toFixed(1) }}%
              </div>
            </div>
            <div class="quota-stats">
              <span class="stat">已用：{{ formatBytes(quota.storage_used || 0) }}</span>
              <span class="stat">限制：{{ formatBytes(quota.max_storage_bytes || 10737418240) }}</span>
            </div>
          </div>
        </div>

        <!-- 用户数量配额 -->
        <div class="quota-card">
          <div class="quota-header">
            <h3>👥 用户数量</h3>
          </div>
          <div class="quota-content">
            <div class="progress-container">
              <div
                class="progress-bar"
                :class="getProgressClass(userUsagePercent)"
              >
                <div
                  class="progress"
                  :style="{ width: userUsagePercent + '%' }"
                />
              </div>
              <div class="progress-text">
                {{ userUsagePercent.toFixed(1) }}%
              </div>
            </div>
            <div class="quota-stats">
              <span class="stat">已用：{{ quota.users_count || 0 }}</span>
              <span class="stat">限制：{{ quota.max_users || 100 }}</span>
            </div>
          </div>
        </div>

        <!-- 数据模型配额 -->
        <div class="quota-card">
          <div class="quota-header">
            <h3>📁 数据模型</h3>
          </div>
          <div class="quota-content">
            <div class="progress-container">
              <div
                class="progress-bar"
                :class="getProgressClass(collectionUsagePercent)"
              >
                <div
                  class="progress"
                  :style="{ width: collectionUsagePercent + '%' }"
                />
              </div>
              <div class="progress-text">
                {{ collectionUsagePercent.toFixed(1) }}%
              </div>
            </div>
            <div class="quota-stats">
              <span class="stat">已用：{{ quota.collections_count || 0 }}</span>
              <span class="stat">限制：{{ quota.max_collections || 50 }}</span>
            </div>
          </div>
        </div>

        <!-- API Key 配额 -->
        <div class="quota-card">
          <div class="quota-header">
            <h3>🔑 API Keys</h3>
          </div>
          <div class="quota-content">
            <div class="progress-container">
              <div
                class="progress-bar"
                :class="getProgressClass(apiKeyUsagePercent)"
              >
                <div
                  class="progress"
                  :style="{ width: apiKeyUsagePercent + '%' }"
                />
              </div>
              <div class="progress-text">
                {{ apiKeyUsagePercent.toFixed(1) }}%
              </div>
            </div>
            <div class="quota-stats">
              <span class="stat">已用：{{ quota.api_keys_count || 0 }}</span>
              <span class="stat">限制：{{ quota.max_api_keys || 20 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 使用量统计 -->
      <div class="usage-stats">
        <h2>使用量统计</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ dailyApiCalls }}</div>
            <div class="stat-label">今日 API 调用</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ monthlyApiCalls }}</div>
            <div class="stat-label">本月 API 调用</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ totalFiles }}</div>
            <div class="stat-label">文件总数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ totalCollections }}</div>
            <div class="stat-label">模型总数</div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div v-if="userRole === 'owner' || userRole === 'admin'" class="actions">
        <button class="btn btn-primary" @click="showUpgradeModal = true">
          ⬆️ 升级套餐
        </button>
        <button class="btn btn-secondary" @click="resetUsage">
          🔄 重置使用量
        </button>
      </div>

      <!-- 升级套餐模态框 -->
      <div v-if="showUpgradeModal" class="modal-overlay" @click="showUpgradeModal = false">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2>升级套餐</h2>
            <button class="close-btn" @click="showUpgradeModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="plans">
              <div class="plan-option">
                <h3>免费版</h3>
                <p class="price">¥0/月</p>
                <ul>
                  <li>1,000 API 调用/分钟</li>
                  <li>10GB 存储空间</li>
                  <li>10 用户</li>
                  <li>10 数据模型</li>
                </ul>
              </div>
              <div class="plan-option popular">
                <div class="popular-badge">热门</div>
                <h3>专业版</h3>
                <p class="price">¥99/月</p>
                <ul>
                  <li>10,000 API 调用/分钟</li>
                  <li>100GB 存储空间</li>
                  <li>50 用户</li>
                  <li>50 数据模型</li>
                </ul>
              </div>
              <div class="plan-option">
                <h3>企业版</h3>
                <p class="price">¥499/月</p>
                <ul>
                  <li>无限 API 调用</li>
                  <li>1TB 存储空间</li>
                  <li>无限用户</li>
                  <li>无限数据模型</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showUpgradeModal = false">取消</button>
            <button class="btn btn-primary" @click="upgradePlan">
              确认升级
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

import { api } from '@/api'
import { AppLayout } from '@/components'

interface Quota {
  plan: string
  max_requests_per_minute: number
  max_storage_bytes: number
  max_users: number
  max_collections: number
  max_api_keys: number
  api_used: number
  storage_used: number
  users_count: number
  collections_count: number
  api_keys_count: number
}

const quota = ref<Quota>({
  plan: 'free',
  max_requests_per_minute: 1000,
  max_storage_bytes: 10737418240,
  max_users: 10,
  max_collections: 10,
  max_api_keys: 5,
  api_used: 0,
  storage_used: 0,
  users_count: 0,
  collections_count: 0,
  api_keys_count: 0,
})

const loading = ref(true)
const showUpgradeModal = ref(false)
const tenantName = ref('我的租户')
const userRole = ref('admin')

// 统计数据
const dailyApiCalls = ref(1234)
const monthlyApiCalls = ref(23456)
const totalFiles = ref(56)
const totalCollections = ref(8)

const apiUsagePercent = computed(() => {
  return (quota.value.api_used / quota.value.max_requests_per_minute) * 100
})

const storageUsagePercent = computed(() => {
  return (quota.value.storage_used / quota.value.max_storage_bytes) * 100
})

const userUsagePercent = computed(() => {
  return (quota.value.users_count / quota.value.max_users) * 100
})

const collectionUsagePercent = computed(() => {
  return (quota.value.collections_count / quota.value.max_collections) * 100
})

const apiKeyUsagePercent = computed(() => {
  return (quota.value.api_keys_count / quota.value.max_api_keys) * 100
})

onMounted(() => {
  fetchQuotas()
})

async function fetchQuotas() {
  try {
    loading.value = true
    const response = await api.get('/quotas')
    quota.value = { ...quota.value, ...response.data }
  } catch (error) {
    console.error('Failed to fetch quotas:', error)
  } finally {
    loading.value = false
  }
}

function getProgressClass(percent: number): string {
  if (percent >= 90) return 'danger'
  if (percent >= 70) return 'warning'
  return 'success'
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function resetUsage() {
  if (!confirm('确定重置使用量统计？')) return
  try {
    await api.post('/quotas/reset', { reset_requests: true, reset_storage: false })
    alert('使用量已重置')
    await fetchQuotas()
  } catch (error) {
    alert('重置失败')
    console.error(error)
  }
}

async function upgradePlan() {
  alert('升级功能开发中，请联系管理员')
  showUpgradeModal.value = false
}
</script>

<style scoped>
.quotas-page {
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

.loading {
  text-align: center;
  padding: 3rem;
}

.quotas-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.plan-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem;
  border-radius: 12px;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.plan-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.plan-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.plan-badge.free {
  background: rgba(255, 255, 255, 0.2);
}

.plan-badge.pro {
  background: rgba(255, 255, 255, 0.3);
}

.plan-badge.enterprise {
  background: rgba(255, 255, 255, 0.4);
}

.plan-info {
  display: flex;
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-item .label {
  font-size: 0.75rem;
  opacity: 0.8;
}

.info-item .value {
  font-size: 1rem;
  font-weight: 600;
}

.quota-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.quota-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.quota-header h3 {
  margin: 0;
  font-size: 1rem;
}

.quota-period {
  font-size: 0.75rem;
  color: #666;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.progress-bar {
  flex: 1;
  height: 12px;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.progress {
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s, background 0.3s;
}

.progress-bar.success .progress {
  background: linear-gradient(90deg, #48bb78, #38a169);
}

.progress-bar.warning .progress {
  background: linear-gradient(90deg, #ed8936, #dd6b20);
}

.progress-bar.danger .progress {
  background: linear-gradient(90deg, #f56565, #e53e3e);
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 600;
  min-width: 50px;
  text-align: right;
}

.quota-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: #666;
}

.usage-stats {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.usage-stats h2 {
  font-size: 1.25rem;
  margin: 0 0 1rem 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-card {
  text-align: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #666;
}

.actions {
  display: flex;
  gap: 1rem;
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

.btn-secondary {
  background: #e2e8f0;
  color: #333;
  border-color: #e2e8f0;
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
  max-width: 700px;
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

.plans {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.plan-option {
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  position: relative;
}

.plan-option.popular {
  border-color: #667eea;
  background: #f8f9ff;
}

.popular-badge {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #667eea;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.plan-option h3 {
  margin: 0.5rem 0;
}

.price {
  font-size: 1.5rem;
  font-weight: 700;
  color: #667eea;
  margin: 0.5rem 0;
}

.plan-option ul {
  list-style: none;
  padding: 0;
  text-align: left;
  font-size: 0.875rem;
  color: #666;
}

.plan-option li {
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.plan-option li:last-child {
  border-bottom: none;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #eee;
}
</style>
