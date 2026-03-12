import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true, title: '仪表盘' },
  },
  {
    path: '/collections',
    name: 'Collections',
    component: () => import('../views/Collections.vue'),
    meta: { requiresAuth: true, title: '数据模型' },
  },
  {
    path: '/collections/:id',
    name: 'CollectionDetail',
    component: () => import('../views/CollectionDetail.vue'),
    meta: { requiresAuth: true, title: '模型详情' },
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('../views/Users.vue'),
    meta: { requiresAuth: true, title: '用户管理', permission: 'admin' },
  },
  {
    path: '/tenants',
    name: 'Tenants',
    component: () => import('../views/Tenants.vue'),
    meta: { requiresAuth: true, title: '租户管理', permission: 'admin' },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiresAuth: true, title: '系统设置', permission: 'admin' },
  },
  {
    path: '/api-keys',
    name: 'ApiKeys',
    component: () => import('../views/ApiKeys.vue'),
    meta: { requiresAuth: true, title: 'API Key 管理', permission: 'admin' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const isAuthenticated = !!token;
  
  // 设置页面标题
  document.title = to.meta.title 
    ? `${to.meta.title} - Geekron CMS` 
    : 'Geekron CMS';
  
  // 需要认证的路由
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login');
    return;
  }
  
  // 访客路由（已登录不能访问）
  if (to.meta.guest && isAuthenticated) {
    next('/');
    return;
  }
  
  // 权限检查
  if (to.meta.permission) {
    const userRole = localStorage.getItem('userRole');
    const requiredPermission = to.meta.permission as string;
    
    // 简单的权限检查逻辑
    const hasPermission = 
      requiredPermission === 'admin' && userRole === 'admin';
    
    if (!hasPermission) {
      next('/');
      return;
    }
  }
  
  next();
});

// 导航完成后滚动到顶部
router.afterEach(() => {
  window.scrollTo(0, 0);
});

export default router;
