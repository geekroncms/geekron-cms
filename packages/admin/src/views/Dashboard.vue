<template>
  <AppLayout>
    <div class="dashboard">
      <h1 data-testid="page-title">
        Dashboard
      </h1>

      <div class="stats-grid">
        <div class="stat-card">
          <h3>租户数量</h3>
          <p
            class="stat-value"
            data-testid="tenant-count"
          >
            0
          </p>
        </div>
        <div class="stat-card">
          <h3>用户数量</h3>
          <p
            class="stat-value"
            data-testid="user-count"
          >
            0
          </p>
        </div>
        <div class="stat-card">
          <h3>API 调用</h3>
          <p
            class="stat-value"
            data-testid="api-calls"
          >
            0
          </p>
        </div>
        <div class="stat-card">
          <h3>存储空间</h3>
          <p
            class="stat-value"
            data-testid="storage-used"
          >
            0 GB
          </p>
        </div>
      </div>

      <div class="quick-actions">
        <h2>快速操作</h2>
        <div class="actions-grid">
          <router-link
            to="/tenants"
            class="action-btn"
          >
            管理租户
          </router-link>
          <router-link
            to="/users"
            class="action-btn"
          >
            用户管理
          </router-link>
          <router-link
            to="/collections"
            class="action-btn"
          >
            数据模型
          </router-link>
          <router-link
            to="/api-keys"
            class="action-btn"
          >
            API Keys
          </router-link>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { AppLayout } from '@/components'
</script>

<style scoped>
.dashboard {
  padding: 2rem;
}
.dashboard h1 {
  font-size: 1.5rem;
  margin-bottom: 2rem;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}
.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.stat-card h3 {
  font-size: 0.875rem;
  color: #6c757d;
  margin-bottom: 0.5rem;
}
.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #1a1a1a;
}
.quick-actions {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
}
.quick-actions h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}
.action-btn {
  display: block;
  padding: 1rem;
  background: #007bff;
  color: white;
  text-align: center;
  border-radius: 8px;
  text-decoration: none;
}
.action-btn:hover {
  background: #0056b3;
}
</style>
