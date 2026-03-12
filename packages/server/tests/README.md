# Geekron CMS 测试指南

本目录包含 Geekron CMS 的完整测试套件，确保代码质量达到生产标准。

## 📋 目录

- [运行测试](#运行测试)
- [测试规范](#测试规范)
- [覆盖率要求](#覆盖率要求)
- [测试结构](#测试结构)
- [Mock 使用指南](#mock-使用指南)
- [常见问题](#常见问题)

---

## 🚀 运行测试

### 基本命令

```bash
# 运行所有测试
bun test

# 运行测试并生成覆盖率报告
bun test --coverage

# 运行指定测试文件
bun test tests/tenants.test.ts

# 运行匹配模式的测试
bun test --test-name-pattern "should create"

# 运行特定目录的测试
bun test tests/middleware/
```

### 覆盖率报告

运行覆盖率测试后，Bun 会生成详细的覆盖率报告：

```bash
bun test --coverage
```

输出示例：
```
------------------------------------|---------|---------|-------------------
File                                | % Funcs | % Lines | Uncovered Line #s
------------------------------------|---------|---------|-------------------
All files                           |   90.50 |   91.23 |
 src/middleware/auth.ts             |  100.00 |  100.00 | 
 src/routes/tenants.ts              |   95.00 |   96.50 | 45-48
------------------------------------|---------|---------|-------------------
```

---

## 📝 测试规范

### AAA 模式

所有测试遵循 **Arrange-Act-Assert** 模式：

```typescript
it('should create tenant with correct plan quotas', async () => {
  // Arrange - 准备测试数据
  const tenantData = {
    name: 'Test Tenant',
    subdomain: 'test',
    email: 'test@example.com',
    plan: 'pro',
  };
  
  const mockDB = new MockD1Database();
  mockDB.setSingleRecord('quota-query', {
    quota_api_calls: 10000,
    quota_storage_mb: 1000,
  });

  // Act - 执行测试操作
  const res = await app.request('/api/v1/tenants', {
    method: 'POST',
    headers: createAuthHeaders(),
    body: JSON.stringify(tenantData),
  });

  // Assert - 验证结果
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.plan).toBe('pro');
  expect(body.quotas.apiCalls).toBe(10000);
});
```

### 测试命名规范

```typescript
describe('POST /tenants', () => {
  // ✅ 好的命名：清晰描述预期行为
  it('should create a new tenant successfully', async () => { ... });
  it('should reject duplicate subdomain', async () => { ... });
  it('should return 400 for invalid email format', async () => { ... });
  
  // ❌ 避免：模糊或不完整的命名
  it('test create', async () => { ... });
  it('should work', async () => { ... });
});
```

### 测试组织

```typescript
// 按功能模块组织
describe('Tenant Routes', () => {
  describe('POST /tenants', () => { ... });
  describe('GET /tenants', () => { ... });
  describe('PATCH /tenants/:id', () => { ... });
  describe('DELETE /tenants/:id', () => { ... });
});

// 按中间件功能组织
describe('Auth Middleware', () => {
  describe('JWT Token Validation', () => { ... });
  describe('Public Routes', () => { ... });
  describe('Edge Cases', () => { ... });
});
```

---

## 📊 覆盖率要求

### 目标覆盖率

| 模块类型 | 最低要求 | 目标 |
|---------|---------|------|
| **整体覆盖率** | 85% | **90%+** |
| **核心中间件** | 90% | **95%+** |
| **关键业务逻辑** | 90% | **95%+** |
| **路由层** | 85% | **90%+** |
| **工具函数** | 95% | **100%** |

### 必须覆盖的场景

1. **正常流程** - 主要业务逻辑
2. **边界情况** - 最小值、最大值、空值
3. **错误处理** - 异常输入、失败场景
4. **权限验证** - 不同角色的访问控制
5. **数据验证** - 输入验证、格式检查

---

## 🏗️ 测试结构

```
tests/
├── setup.ts                    # 全局测试配置
├── test-utils.ts               # 测试工具函数
├── README.md                   # 本文档
│
├── middleware/                 # 中间件单元测试
│   ├── auth-middleware.test.ts
│   ├── api-key-auth.test.ts
│   ├── permissions.test.ts
│   ├── rate-limit.test.ts
│   ├── quota-check.test.ts
│   ├── tenant.test.ts
│   └── tenant-isolation.test.ts
│
├── routes/                     # 路由集成测试
│   ├── tenants-integration.test.ts
│   ├── auth-integration.test.ts
│   ├── api-keys-integration.test.ts
│   ├── quotas-integration.test.ts
│   ├── collections-integration.test.ts
│   ├── collection-data-integration.test.ts
│   ├── files-integration.test.ts
│   └── users-integration.test.ts
│
└── *.test.ts                   # 其他测试文件
    ├── tenants.test.ts
    ├── users.test.ts
    ├── auth.test.ts
    └── ...
```

---

## 🔧 Mock 使用指南

### 数据库 Mock

```typescript
import { MockD1Database } from './test-utils';

const mockDB = new MockD1Database();

// 设置单条记录
mockDB.setSingleRecord('tenant-query', {
  id: 'tenant-123',
  name: 'Test Tenant',
  plan: 'free',
});

// 设置多条记录
mockDB.setRecords('tenants-list', [
  { id: '1', name: 'Tenant 1' },
  { id: '2', name: 'Tenant 2' },
]);
```

### JWT Token Mock

```typescript
import { generateTestJWT } from './test-utils';

const token = await generateTestJWT({
  sub: 'user-123',
  email: 'test@example.com',
  role: 'admin',
  tenant_id: 'tenant-123',
  permissions: ['read', 'write'],
});
```

### API Key Mock

```typescript
import { generateTestApiKey } from './test-utils';

const { key, hashedKey } = generateTestApiKey('tenant-123');
```

### 认证 Headers

```typescript
import { createAuthHeaders } from './test-utils';

// JWT 认证
const headers = createAuthHeaders({
  jwt: token,
  tenantId: 'tenant-123',
});

// API Key 认证
const headers = createAuthHeaders({
  apiKey: 'gk_test_...',
  tenantId: 'tenant-123',
});
```

---

## ⚠️ 常见问题

### Q: 测试失败显示 401 未授权错误

**原因**: 缺少认证 headers

**解决**:
```typescript
// ❌ 错误 - 缺少认证
const res = await app.request('/api/v1/tenants', {
  method: 'POST',
  body: JSON.stringify(data),
});

// ✅ 正确 - 添加认证
const token = await generateTestJWT({ sub: 'user', email: 'test@example.com' });
const res = await app.request('/api/v1/tenants', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': 'tenant-123',
  },
  body: JSON.stringify(data),
});
```

### Q: 数据库操作返回 undefined

**原因**: Mock DB 没有设置对应的查询结果

**解决**:
```typescript
const mockDB = new MockD1Database();

// 明确设置查询结果
mockDB.setSingleRecord('SELECT * FROM tenants WHERE id = ?', {
  id: 'tenant-123',
  name: 'Test',
});
```

### Q: 覆盖率不达标

**检查清单**:
- [ ] 所有边缘情况都有测试
- [ ] 错误处理逻辑被覆盖
- [ ] 条件分支的 true/false 都有测试
- [ ] 循环和递归有边界测试

---

## 📚 参考资源

- [Bun Test 文档](https://bun.sh/docs/testing)
- [测试最佳实践](https://testingjavascript.com/)
- [AAA Pattern](https://wiki.c2.com/?ArrangeActAssert)

---

## 🎯 测试检查清单

在提交代码前，确保：

- [ ] 所有新代码都有对应的测试
- [ ] 运行 `bun test` 全部通过
- [ ] 覆盖率不低于 90%
- [ ] 测试命名清晰描述行为
- [ ] 遵循 AAA 模式
- [ ] 边缘情况已覆盖
- [ ] Mock 数据合理且隔离

---

**最后更新**: 2026-03-12
**维护者**: Geekron CMS Team
