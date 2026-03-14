# API 客户端使用指南

## 目录结构

```
src/api/
├── index.ts          # 主导出文件
├── client.ts         # Axios 实例配置
├── types.ts          # TypeScript 类型定义
├── auth.ts           # 认证相关 API
├── tenants.ts        # 租户管理 API
├── users.ts          # 用户管理 API
├── collections.ts    # 集合管理 API
├── data.ts           # 数据管理 API
├── apiKeys.ts        # API Key 管理 API
└── quotas.ts         # 配额管理 API
```

## 快速开始

### 1. 导入 API 客户端

```typescript
// 导入特定模块
import { authApi, userApi, collectionApi } from '@/api'

// 或导入所有内容
import * as api from '@/api'

// 导入辅助函数
import { login, logout, isAuthenticated } from '@/api'
```

### 2. 认证流程

```typescript
import { authApi, login, logout } from '@/api'

// 用户登录
try {
  const result = await login('user@example.com', 'password123')
  console.log('登录成功:', result)
  // Token 和租户信息已自动保存到 localStorage
} catch (error) {
  console.error('登录失败:', error)
}

// 或使用底层 API
const result = await authApi.login('user@example.com', 'password123')

// 获取当前用户信息
const userInfo = await authApi.me()

// 刷新 Token
const { token } = await authApi.refresh()

// 切换租户
const { token, tenant } = await authApi.switchTenant('tenant-id')

// 登出
logout()
// 或
await authApi.logout()
```

### 3. 租户管理

```typescript
import { tenantApi } from '@/api'

// 获取当前租户信息
const tenant = await tenantApi.getMe()

// 获取租户列表
const { data, pagination } = await tenantApi.list({ page: 1, limit: 20 })

// 获取租户详情
const tenant = await tenantApi.get('tenant-id')

// 创建租户
const newTenant = await tenantApi.create({
  name: '新租户',
  subdomain: 'new-tenant',
  email: 'tenant@example.com',
  plan: 'free',
})

// 更新租户
await tenantApi.update('tenant-id', {
  name: '更新后的名称',
  plan: 'pro',
})

// 删除租户
await tenantApi.delete('tenant-id')

// 激活/暂停租户
await tenantApi.activate('tenant-id')
await tenantApi.suspend('tenant-id')

// 检查子域名
const { available } = await tenantApi.checkSubdomain('my-subdomain')

// 获取配额使用情况
const quotas = await tenantApi.getQuotas('tenant-id')
```

### 4. 用户管理

```typescript
import { userApi } from '@/api'

// 获取用户列表
const { data, pagination } = await userApi.list({ page: 1, limit: 20 })

// 获取用户详情
const user = await userApi.get('user-id')

// 创建用户
const newUser = await userApi.create({
  email: 'new@example.com',
  password: 'password123',
  name: '新用户',
  role: 'viewer',
})

// 邀请现有用户
const invite = await userApi.invite({
  email: 'existing@example.com',
  role: 'editor',
  permissions: ['read', 'write'],
})

// 更新用户
await userApi.update('user-id', {
  name: '新名称',
  role: 'admin',
  status: 'active',
})

// 从租户移除用户
await userApi.delete('user-id')

// 用户离开租户
await userApi.leave('user-id')

// 修改密码
await userApi.changePassword({
  currentPassword: 'old-password',
  newPassword: 'new-password',
})
```

### 5. 集合管理

```typescript
import { collectionApi } from '@/api'

// 获取所有集合
const { data } = await collectionApi.list()

// 获取集合详情（包含字段）
const collection = await collectionApi.get('collection-id')

// 创建集合
const newCollection = await collectionApi.create({
  name: '文章',
  slug: 'articles',
  description: '文章集合',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      unique: false,
    },
    {
      name: 'content',
      type: 'json',
      required: false,
    },
    {
      name: 'published',
      type: 'boolean',
      required: false,
      defaultValue: false,
    },
  ],
})

// 更新集合
await collectionApi.update('collection-id', {
  name: '更新后的名称',
  description: '新描述',
})

// 删除集合
await collectionApi.delete('collection-id')

// 添加字段
await collectionApi.addField('collection-id', {
  name: 'author',
  type: 'text',
  required: true,
})

// 删除字段
await collectionApi.deleteField('collection-id', 'field-id')
```

### 6. 数据管理

```typescript
import { dataApi } from '@/api'

// 创建数据
const entry = await dataApi.create('collection-id', {
  title: '第一篇文章',
  content: { blocks: [...] },
  published: true,
})

// 获取数据列表（分页、过滤、排序）
const { data, pagination } = await dataApi.list('collection-id', {
  page: 1,
  limit: 20,
  sort: 'createdAt',
  order: 'desc',
  filter: { published: true },
})

// 获取单条数据
const item = await dataApi.get('collection-id', 'data-id')

// 更新数据
await dataApi.update('collection-id', 'data-id', {
  title: '更新后的标题',
  published: false,
})

// 删除数据
await dataApi.delete('collection-id', 'data-id')

// 批量创建
await dataApi.bulkCreate('collection-id', [
  { title: '文章 1', published: true },
  { title: '文章 2', published: false },
])
```

### 7. API Key 管理

```typescript
import { apiKeyApi } from '@/api'

// 创建 API Key
const { key, ...apiKey } = await apiKeyApi.create({
  name: '我的 API Key',
  permissions: ['read', 'write'],
  expiresAt: '2026-12-31T23:59:59Z',
})
// 注意：key 只会显示一次，请立即保存

// 获取 API Key 列表
const { data, pagination } = await apiKeyApi.list({ page: 1, limit: 20 })

// 获取 API Key 详情
const apiKey = await apiKeyApi.get('key-id')

// 更新 API Key
await apiKeyApi.update('key-id', {
  name: '新名称',
  permissions: ['read'],
})

// 删除 API Key
await apiKeyApi.delete('key-id')

// 轮换 API Key
const { key: newKey } = await apiKeyApi.rotate('key-id')

// 验证 API Key
const { valid, error } = await apiKeyApi.validate('gk_xxx')

// 获取使用统计
const usage = await apiKeyApi.getUsage('key-id')
```

### 8. 配额管理

```typescript
import { quotaApi } from '@/api'

// 获取配额状态
const { data } = await quotaApi.get()
console.log('配额使用情况:', data.usage_percent)

// 获取详细使用统计
const { data } = await quotaApi.getUsage()

// 重置使用量（管理员）
await quotaApi.reset({
  reset_requests: true,
  reset_storage: false,
  reason: '月度重置',
})

// 更新配额（超级管理员）
await quotaApi.update({
  plan: 'pro',
  max_users: 50,
  max_collections: 100,
})

// 检查资源配额
const { data } = await quotaApi.check('users', 5)
if (!data.ok) {
  console.log('配额不足:', data)
}

// 更新存储使用量
await quotaApi.updateStorage(1024 * 1024, 'file-id') // 增加 1MB
```

## 错误处理

```typescript
import { authApi } from '@/api'

try {
  const result = await authApi.login('user@example.com', 'wrong-password')
} catch (error) {
  // 错误结构
  console.log(error.status)    // HTTP 状态码
  console.log(error.code)      // 错误代码
  console.log(error.message)   // 错误消息
  console.log(error.details)   // 详细错误信息
}
```

## 类型安全

所有 API 都提供了完整的 TypeScript 类型定义，支持智能提示和类型检查。

```typescript
import type { User, CreateUserRequest } from '@/api'

// 完整的类型提示
const userData: CreateUserRequest = {
  email: 'user@example.com',
  password: 'password123',
  name: '用户名称',
  role: 'viewer',
}

const user: User = await userApi.create(userData)
```

## 注意事项

1. **Token 管理**: 登录成功后，Token 会自动保存到 `localStorage`，无需手动处理
2. **租户上下文**: 大多数 API 都需要租户上下文，确保登录后正确设置 `tenantId`
3. **错误处理**: 始终使用 try-catch 处理 API 调用错误
4. **API Key 安全**: 创建的 API Key 只会显示一次，请立即保存到安全位置
5. **配额限制**: 注意各种操作的配额限制，避免超出限制导致请求失败
