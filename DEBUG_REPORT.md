# Geekron CMS 问题排查报告

**测试时间**: 2026-03-13 16:35 UTC  
**测试版本**: v1.0.0  
**测试环境**: https://b94af84d.geekron-cms-admin.pages.dev

---

## 🔴 发现的问题

### 问题 1: 登录页面元素无法定位

**现象**:
- `data-testid="email-input"` 无法找到
- `data-testid="password-input"` 无法找到
- `data-testid="login-btn"` 无法找到

**可能原因**:
1. Login.vue 页面没有正确使用 data-testid
2. 页面渲染延迟
3. 样式问题导致元素不可见

**检查点**:
```vue
<!-- 检查 Login.vue 中是否有这些 data-testid -->
<input data-testid="email-input" ...>
<input data-testid="password-input" ...>
<button data-testid="login-btn" ...>
```

**修复建议**:
- 确认 Login.vue 中有正确的 data-testid 属性
- 增加页面加载等待时间
- 检查 CSS 是否隐藏了表单元素

---

### 问题 2: 侧边栏不可见

**现象**:
- `.sidebar` 元素测试返回 `false`
- 但菜单项数量为 20（说明 DOM 存在但可能样式问题）

**可能原因**:
1. 侧边栏被 CSS 隐藏（`display: none` 或 `visibility: hidden`）
2. 侧边栏 collapsed 状态导致
3. z-index 问题被其他元素遮挡
4. 登录状态验证失败，未显示侧边栏

**检查点**:
```vue
<!-- 检查 AppLayout.vue 中侧边栏的条件渲染 -->
<aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
  <!-- 检查是否有 v-if 条件 -->
</aside>
```

**修复建议**:
- 检查登录状态是否正确设置
- 检查侧边栏 CSS 样式
- 确认 sidebarCollapsed 初始状态

---

### 问题 3: 租户管理/用户管理/API Key 页面权限问题

**现象**:
- 这些页面配置了 `permission: 'admin'`
- 演示账号角色可能不是 admin
- 导致访问时被重定向

**路由配置**:
```typescript
{
  path: '/tenants',
  name: 'Tenants',
  component: () => import('../views/Tenants.vue'),
  meta: { requiresAuth: true, title: '租户管理', permission: 'admin' },
}
```

**权限检查逻辑**:
```typescript
const hasPermission = requiredPermission === 'admin' && userRole === 'admin'
```

**问题**:
- 演示账号登录时设置的角色是 `owner` 而不是 `admin`
- 导致所有需要 admin 权限的页面都无法访问

**修复方案**:
1. **方案 A**: 修改路由权限配置，移除 `permission: 'admin'`
2. **方案 B**: 修改登录逻辑，演示账号设置为 `admin` 角色
3. **方案 C**: 修改权限检查逻辑，`owner` 也应该有 admin 权限

**推荐**: 方案 C - 修改权限检查逻辑

```typescript
// router/index.ts 中修改
const hasPermission = (requiredPermission === 'admin' && (userRole === 'admin' || userRole === 'owner'))
```

---

### 问题 4: 快速操作按钮数量为 0

**现象**:
- Dashboard 页面快速操作按钮测试返回 0

**可能原因**:
1. 按钮样式类名不匹配
2. 按钮使用了 router-link 而不是 button 元素
3. 按钮在条件渲染块中未显示

**检查点**:
```vue
<!-- 检查 Dashboard.vue 中的快速操作 -->
<div class="quick-actions">
  <router-link to="/collections" class="btn">...</router-link>
  <!-- 确认是否有 .btn 类 -->
</div>
```

**修复建议**:
- 确认快速操作按钮的 HTML 结构
- 修改测试选择器匹配实际元素

---

### 问题 5: 表格数据未加载

**现象**:
- 租户/用户/集合页面表格行数为 0 或不可见

**可能原因**:
1. API 未调用或调用失败
2. 登录状态未正确传递到 API 请求
3. API 响应数据结构不匹配
4. 后端 API 响应超时

**检查点**:
```typescript
// 检查各页面的 API 调用
onMounted(async () => {
  await fetchTenants()  // 检查这个函数是否正确实现
})
```

**修复建议**:
- 检查浏览器控制台是否有 API 错误
- 确认 API 客户端配置正确
- 添加错误处理和日志

---

## 📋 待确认的配置问题

### 1. 演示账号角色配置

**当前配置**:
```typescript
// Login.vue 中
if (email === 'demo@geekron-cms.com' && password === 'Demo123456') {
  localStorage.setItem('userRole', 'owner')  // 设置的是 owner
}
```

**问题**:
- 路由权限检查需要 `admin`
- `owner` 无法通过权限检查

**建议修改**:
```typescript
localStorage.setItem('userRole', 'admin')  // 改为 admin
// 或
localStorage.setItem('userRole', 'owner')
// 并修改权限检查逻辑包含 owner
```

---

### 2. 登录成功后的跳转

**当前逻辑**:
```typescript
// Login.vue 中
router.push('/dashboard')  // 或 router.push('/')
```

**问题**:
- 登录成功后可能没有正确设置所有必要的 localStorage 项
- 导致后续 API 请求缺少认证信息

**需要确认**:
- `token` 是否设置
- `tenantId` 是否设置
- `userRole` 是否设置
- `user` 信息是否设置

---

### 3. API 客户端配置

**检查点**:
```typescript
// packages/admin/src/api/client.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8787/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// 检查请求拦截器是否正确添加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

**可能问题**:
- `VITE_API_URL` 环境变量未配置
- 使用了错误的 API 地址
- Token 未正确附加到请求头

---

## 🔧 修复优先级

### P0 - 立即修复

1. **权限检查逻辑** - 允许 owner 角色访问 admin 页面
2. **登录状态设置** - 确认所有必要的 localStorage 项都正确设置
3. **API 地址配置** - 确认使用了正确的后端 API 地址

### P1 - 高优先级

4. **侧边栏显示** - 检查 CSS 和组件渲染逻辑
5. **表格数据加载** - 修复 API 调用和数据处理
6. **data-testid 属性** - 确保所有测试元素都有正确的标识

### P2 - 中优先级

7. **错误处理** - 添加完善的错误提示
8. **加载状态** - 添加数据加载中的 UI 反馈
9. **空状态** - 添加数据为空时的友好提示

---

## 📝 下一步行动

1. **立即修复权限检查** - 修改 router/index.ts
2. **检查登录逻辑** - 确认 localStorage 设置完整
3. **验证 API 配置** - 确认 API 地址和认证配置
4. **逐个页面修复** - 按优先级修复每个页面的问题
5. **重新部署测试** - 部署后运行完整测试套件

---

**报告生成时间**: 2026-03-13 16:40 UTC  
**状态**: 待修复  
**负责人**: 项目开发助手
