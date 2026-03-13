<template>
  <div class="app-layout">
    <!-- 侧边栏 -->
    <aside
      class="sidebar"
      :class="{ collapsed: sidebarCollapsed }"
    >
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">🦞</span>
          <span
            v-if="!sidebarCollapsed"
            class="logo-text"
          >Geekron CMS</span>
        </div>
        <button
          class="toggle-btn"
          @click="toggleSidebar"
        >
          <span v-if="sidebarCollapsed">›</span>
          <span v-else>‹</span>
        </button>
      </div>

      <nav class="sidebar-nav">
        <router-link
          to="/"
          class="nav-item"
          :class="{ active: $route.path === '/' }"
        >
          <span class="nav-icon">📊</span>
          <span
            v-if="!sidebarCollapsed"
            class="nav-text"
          >仪表盘</span>
        </router-link>
        <router-link
          to="/collections"
          class="nav-item"
          :class="{ active: $route.path.startsWith('/collections') }"
        >
          <span class="nav-icon">📁</span>
          <span
            v-if="!sidebarCollapsed"
            class="nav-text"
          >数据模型</span>
        </router-link>
        <router-link
          to="/users"
          class="nav-item"
          :class="{ active: $route.path === '/users' }"
        >
          <span class="nav-icon">👥</span>
          <span
            v-if="!sidebarCollapsed"
            class="nav-text"
          >用户管理</span>
        </router-link>
        <router-link
          to="/settings"
          class="nav-item"
          :class="{ active: $route.path === '/settings' }"
        >
          <span class="nav-icon">⚙️</span>
          <span
            v-if="!sidebarCollapsed"
            class="nav-text"
          >设置</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div
          v-if="!sidebarCollapsed && authStore.user"
          class="user-info"
        >
          <div class="avatar">
            {{ authStore.user.name?.charAt(0) || 'U' }}
          </div>
          <div class="user-details">
            <div class="user-name">
              {{ authStore.user.name }}
            </div>
            <div class="user-email">
              {{ authStore.user.email }}
            </div>
          </div>
        </div>
        <button
          class="logout-btn"
          :title="sidebarCollapsed ? '退出登录' : ''"
          @click="handleLogout"
        >
          <span class="nav-icon">🚪</span>
          <span v-if="!sidebarCollapsed">退出登录</span>
        </button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main-container">
      <!-- 顶栏 -->
      <header class="topbar">
        <div class="breadcrumb">
          <router-link
            v-for="(item, index) in breadcrumbLinks"
            :key="'link-' + index"
            :to="item.path"
            class="breadcrumb-item"
          >
            {{ item.name }}
          </router-link>
          <span
            v-for="(item, index) in breadcrumbLinks"
            :key="'sep-' + index"
            class="breadcrumb-separator"
          >/</span>
          <span
            class="breadcrumb-item active"
          >{{ lastBreadcrumbName }}</span>
        </div>
        <div class="topbar-actions">
          <span
            v-if="authStore.tenantId"
            class="tenant-badge"
          >租户：{{ authStore.tenantId.slice(0, 8) }}...</span>
        </div>
      </header>

      <!-- 内容区 -->
      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const sidebarCollapsed = ref(false)

interface BreadcrumbItem {
  name: string
  path?: string
}

const breadcrumbs = computed(() => {
  const path = route.path
  const parts = path.split('/').filter(Boolean)

  if (parts.length === 0) {
    return [{ name: '仪表盘', path: '/' }]
  }

  const result: BreadcrumbItem[] = [{ name: '仪表盘', path: '/' }]
  let currentPath = ''

  const names: Record<string, string> = {
    collections: '数据模型',
    users: '用户管理',
    settings: '设置',
  }

  parts.forEach((part, index) => {
    currentPath += '/' + part
    const name = names[part] || part

    if (index < parts.length - 1) {
      result.push({ name, path: currentPath })
    } else {
      result.push({ name, path: undefined })
    }
  })

  return result
})

const breadcrumbLinks = computed(() => {
  return breadcrumbs.value.filter((item, index) => item.path && index < breadcrumbs.value.length - 1)
})

const lastBreadcrumbName = computed(() => {
  return breadcrumbs.value[breadcrumbs.value.length - 1]?.name || ''
})

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  background: #f5f7fa;
}

/* 侧边栏 */
.sidebar {
  width: 240px;
  background: #1a1a2e;
  color: #fff;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-icon {
  font-size: 1.5rem;
}

.logo-text {
  font-size: 1.125rem;
  font-weight: 600;
  white-space: nowrap;
}

.toggle-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #fff;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  transition: background 0.2s;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.2s;
  cursor: pointer;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.active {
  background: #667eea;
  color: #fff;
}

.nav-icon {
  font-size: 1.25rem;
  width: 24px;
  text-align: center;
}

.nav-text {
  white-space: nowrap;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #667eea;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
}

.user-details {
  flex: 1;
  overflow: hidden;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: rgba(230, 57, 70, 0.2);
  color: #e53e3e;
}

/* 主内容区 */
.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.breadcrumb-item {
  color: #666;
  cursor: pointer;
}

.breadcrumb-item:hover {
  color: #667eea;
}

.breadcrumb-item.active {
  color: #333;
  font-weight: 500;
}

.breadcrumb-separator {
  color: #ccc;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.tenant-badge {
  padding: 0.25rem 0.75rem;
  background: #e2e8f0;
  border-radius: 9999px;
  font-size: 0.75rem;
  color: #666;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
  }

  .sidebar:not(.collapsed) {
    transform: translateX(0);
  }

  .sidebar.collapsed {
    width: 240px;
  }
}
</style>
