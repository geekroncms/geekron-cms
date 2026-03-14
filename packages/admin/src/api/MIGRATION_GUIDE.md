# API 客户端迁移指南

## 从旧 API 迁移到新 API 客户端

本文档帮助你将现有的视图和组件从旧的 API 结构迁移到新的模块化 API 客户端。

---

## 主要变更

### 1. 导入方式变更

**旧代码**:
```typescript
import api from '@/api'  // ❌ 不再有默认导出
```

**新代码**:
```typescript
import { api } from '@/api'  // ✅ 命名导出
// 或
import { authApi, userApi } from '@/api'  // ✅ 导入特定模块
```

---

### 2. 响应结构变更

**旧代码**:
```typescript
const response = await api.get('/users')
const users = response.data  // ❌ 需要访问 .data
```

**新代码**:
```typescript
import { userApi } from '@/api'
const { data: users } = await userApi.list()  // ✅ 直接返回数据
```

---

### 3. 类型名称变更（snake_case → camelCase）

后端返回的字段是 snake_case，但 TypeScript 类型使用 camelCase。

**旧代码**:
```typescript
interface User {
  created_at: string  // ❌
  updated_at: string
}
```

**新代码**:
```typescript
import type { User } from '@/api'
// User 类型已定义为：
// { id, email, name, role, status, createdAt, updatedAt }
```

---

## 各模块迁移示例

### 认证模块

**旧代码**:
```typescript
import api from '@/api'

const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password })
  localStorage.setItem('token', response.data.token)
  return response.data
}
```

**新代码**:
```typescript
import { authApi, login } from '@/api'

// 方式 1: 使用辅助函数（推荐）
const result = await login(email, password)
// Token 已自动保存

// 方式 2: 使用底层 API
const result = await authApi.login(email, password)
```

---

### 用户管理

**旧代码**:
```typescript
import api from '@/api'

const users = await api.get('/users')
const user = await api.get(`/users/${id}`)
const created = await api.post('/users', userData)
```

**新代码**:
```typescript
import { userApi } from '@/api'

const { data: users, pagination } = await userApi.list()
const user = await userApi.get(id)
const created = await userApi.create(userData)
```

---

### 集合管理

**旧代码**:
```typescript
import api from '@/api'

const collections = await api.get('/collections')
const collection = await api.get(`/collections/${id}`)
```

**新代码**:
```typescript
import { collectionApi } from '@/api'

const { data: collections } = await collectionApi.list()
const collection = await collectionApi.get(id)
// collection.fields 已自动包含
```

---

### 数据管理

**旧代码**:
```typescript
import api from '@/api'

const data = await api.get(`/collections/${collectionId}/contents`)
const item = await api.get(`/collections/${collectionId}/contents/${id}`)
```

**新代码**:
```typescript
import { dataApi } from '@/api'

const { data: items, pagination } = await dataApi.list(collectionId, {
  page: 1,
  limit: 20,
})
const item = await dataApi.get(collectionId, id)
```

---

### API Key 管理

**旧代码**:
```typescript
import api from '@/api'

const keys = await api.get('/api-keys')
const key = await api.post('/api-keys', { name: 'My Key' })
console.log(key.data.key)  // API Key
```

**新代码**:
```typescript
import { apiKeyApi } from '@/api'

const { data: keys, pagination } = await apiKeyApi.list()
const { key, ...apiKey } = await apiKeyApi.create({ name: 'My Key' })
console.log(key)  // 仅在创建时显示
```

---

### 配额管理

**旧代码**:
```typescript
import api from '@/api'

const quotas = await api.get('/quotas')
```

**新代码**:
```typescript
import { quotaApi } from '@/api'

const { data } = await quotaApi.get()
console.log(data.usage_percent)  // 使用百分比
```

---

## 常见错误修复

### 错误 1: Module has no default export

**错误**:
```typescript
import api from '@/api'  // ❌
```

**修复**:
```typescript
import { api } from '@/api'  // ✅
// 或
import { authApi, userApi } from '@/api'  // ✅
```

---

### 错误 2: Property 'data' does not exist

**错误**:
```typescript
const response = await authApi.login(email, password)
const token = response.data.token  // ❌ response 已经是数据本身
```

**修复**:
```typescript
const response = await authApi.login(email, password)
const token = response.token  // ✅
```

---

### 错误 3: Property 'created_at' does not exist

**错误**:
```typescript
import type { User } from '@/api'
const user: User = await userApi.get(id)
console.log(user.created_at)  // ❌ 类型定义为 createdAt
```

**修复**:
```typescript
console.log(user.createdAt)  // ✅
```

---

### 错误 4: Property 'status' does not exist

**错误**:
```typescript
// 旧类型可能没有 status 字段
const user = await api.post('/users', data)
console.log(user.status)  // ❌
```

**修复**:
```typescript
import type { User } from '@/api'
const user: User = await userApi.create(data)
console.log(user.status)  // ✅ status 已定义
```

---

## 迁移检查清单

- [ ] 更新所有 `import api from '@/api'` 为命名导入
- [ ] 更新所有响应处理，移除 `.data` 访问
- [ ] 更新所有字段名从 snake_case 到 camelCase
- [ ] 更新类型导入，使用新的类型定义
- [ ] 测试所有 API 调用是否正常工作
- [ ] 删除旧的 API 辅助函数（如果有）

---

## 逐步迁移策略

### 第 1 步：更新导入
先更新所有文件的导入语句，但不改变使用方式。

```typescript
// 临时兼容
import { api } from '@/api'
// 保持原有调用方式
const response = await api.get('/users')
```

### 第 2 步：更新 API 调用
逐个模块更新 API 调用方式。

```typescript
import { userApi } from '@/api'
const { data } = await userApi.list()
```

### 第 3 步：更新类型
更新所有类型定义和变量声明。

```typescript
import type { User } from '@/api'
const user: User = await userApi.get(id)
```

### 第 4 步：清理代码
删除旧的 API 辅助函数和类型定义。

---

## 需要帮助？

如果迁移过程中遇到问题，请参考：
- `README.md` - 详细的使用指南
- `types.ts` - 完整的类型定义
- `API_INTEGRATION_REPORT.md` - API 集成状态报告

---

**最后更新**: 2026-03-13 14:56 UTC
