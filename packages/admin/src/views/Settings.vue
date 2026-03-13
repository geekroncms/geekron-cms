<template>
  <AppLayout>
    <div class="settings-page">
      <h1 data-testid="page-title">
        系统设置
      </h1>

      <div class="settings-section">
        <h2>租户信息</h2>
        <div class="form-group">
          <label>租户名称</label>
          <input
            v-model="tenant.name"
            type="text"
            data-testid="tenant-name-input"
          >
        </div>
        <div class="form-group">
          <label>当前套餐</label>
          <div class="plan-info">
            <span :class="`badge badge-${tenant.plan}`">{{ tenant.plan }}</span>
          </div>
        </div>
        <button
          class="btn btn-primary"
          data-testid="save-settings-btn"
          @click="saveSettings"
        >
          保存设置
        </button>
      </div>

      <div class="settings-section">
        <h2>配额使用</h2>
        <div class="quota-item">
          <div class="quota-label">
            API 调用
          </div>
          <div class="quota-bar">
            <div
              class="quota-fill"
              :style="{ width: quotaUsage.apiPercent + '%' }"
            />
          </div>
          <div class="quota-text">
            {{ quotaUsage.apiUsed }} / {{ quotaUsage.apiLimit }}
          </div>
        </div>
        <div class="quota-item">
          <div class="quota-label">
            存储空间
          </div>
          <div class="quota-bar">
            <div
              class="quota-fill"
              :style="{ width: quotaUsage.storagePercent + '%' }"
            />
          </div>
          <div class="quota-text">
            {{ quotaUsage.storageUsed }} / {{ quotaUsage.storageLimit }}
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { AppLayout } from '@/components'

const tenant = ref({ name: '我的租户', plan: 'pro' })
const quotaUsage = ref({
  apiPercent: 45,
  apiUsed: 450,
  apiLimit: 1000,
  storagePercent: 30,
  storageUsed: '3GB',
  storageLimit: '10GB',
})

const saveSettings = () => {
  alert('设置已保存')
}
</script>

<style scoped>
.settings-page {
  padding: 2rem;
}
.settings-page h1 {
  font-size: 1.5rem;
  margin-bottom: 2rem;
}
.settings-section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}
.settings-section h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}
.form-group {
  margin-bottom: 1rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}
.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
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
.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
}
.badge-free {
  background: #e9ecef;
}
.badge-pro {
  background: #cce5ff;
}
.badge-enterprise {
  background: #d4edda;
}
.quota-item {
  margin-bottom: 1rem;
}
.quota-label {
  font-weight: 500;
  margin-bottom: 0.5rem;
}
.quota-bar {
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}
.quota-fill {
  height: 100%;
  background: #007bff;
}
.quota-text {
  font-size: 0.875rem;
  color: #6c757d;
  margin-top: 0.25rem;
}
</style>
