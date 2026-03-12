# 租户数据隔离中间件使用指南

## 📋 目录

- [概述](#概述)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
- [核心功能](#核心功能)
- [API 参考](#api-参考)
- [最佳实践](#最佳实践)
- [常见陷阱](#常见陷阱)
- [故障排查](#故障排查)

---

## 概述

租户数据隔离中间件是 Geekron CMS 多租户架构的核心组件，确保每个租户只能访问自己的数据，防止跨租户数据泄露。

### 核心目标

- ✅ **自动注入**: 自动在所有数据库查询中注入 `tenant_id` 条件
- ✅ **透明拦截**: 无需修改现有业务代码，中间件自动拦截并增强查询
- ✅ **安全防护**: 防止 SQL 注入和跨租户访问
- ✅ **性能优化**: 最小化开销，对已隔离查询不重复处理

---

## 架构设计

### 中间件层次

```
HTTP Request
  ↓
authMiddleware (JWT 验证)
  ↓
tenantMiddleware (租户验证)
  ↓
tenantIsolationMiddleware (数据隔离)
  ↓
Business Logic (自动处理租户隔离)
  ↓
D1 Database (所有查询已包含 tenant_id)
```

### 查询转换流程

```
原始查询:
SELECT * FROM collections WHERE id = ?

↓ 中间件处理

安全查询:
SELECT * FROM collections WHERE tenant_id = ? AND id = ?
```

---

## 快速开始

### 1. 中间件已集成

租户隔离中间件已在 `src/index.ts` 中全局注册，无需额外配置。

### 2. 使用方式

**无需修改现有代码！** 中间件会自动拦截所有数据库查询。

```typescript
// 原有代码（无需修改）
const collection = await c.env.DB.prepare(
  'SELECT * FROM collections WHERE id = ?'
).bind(collectionId).first();

// 中间件会自动转换为：
// SELECT * FROM collections WHERE tenant_id = ? AND id = ?
```

### 3. 必需条件

确保请求包含 `X-Tenant-ID` header：

```bash
curl -H "X-Tenant-ID: tenant-123" \
     -H "Authorization: Bearer <token>" \
     https://api.geekron-cms.com/api/v1/collections
```

---

## 核心功能

### 1. 自动注入 tenant_id

#### SELECT 查询
```typescript
// 原始
SELECT * FROM collections WHERE id = ?

// 转换后
SELECT * FROM collections WHERE tenant_id = ? AND id = ?
```

#### INSERT 查询
```typescript
// 原始
INSERT INTO collections (id, name, slug) VALUES (?, ?, ?)

// 转换后
INSERT INTO collections (id, name, slug, tenant_id) VALUES (?, ?, ?, ?)
```

#### UPDATE 查询
```typescript
// 原始
UPDATE collections SET name = ? WHERE id = ?

// 转换后
UPDATE collections SET name = ? WHERE id = ? AND tenant_id = ?
```

#### DELETE 查询
```typescript
// 原始
DELETE FROM collections WHERE id = ?

// 转换后
DELETE FROM collections WHERE id = ? AND tenant_id = ?
```

### 2. 批量查询隔离

```typescript
import { verifyBatchTenantIsolation } from './middleware/tenant-isolation';

const ids = ['id1', 'id2', 'id3'];
const isSafe = await verifyBatchTenantIsolation(
  c,
  c.env.DB,
  'collection_data',
  ids
);
```

### 3. 事务隔离

```typescript
import { executeTenantSafeTransaction } from './middleware/tenant-isolation';

await executeTenantSafeTransaction(c, c.env.DB, async (tx) => {
  // 事务中的所有操作自动继承租户上下文
  await tx.prepare('INSERT INTO collections ...').run();
});
```

---

## API 参考

### 辅助函数

#### `getSafeDB(c)`
获取租户安全的数据库代理对象。

#### `verifyTenantBoundary(c, resourceTenantId)`
验证资源是否属于当前租户。返回 `boolean`。

#### `verifyBatchTenantIsolation(c, db, tableName, ids)`
验证批量操作中的所有项目是否属于同一租户。返回 `Promise<boolean>`。

#### `executeTenantSafeTransaction(c, db, callback)`
执行租户安全的事务。返回 `Promise<T>`。

---

## 最佳实践

### ✅ 应该做的

1. **始终使用参数化查询**
```typescript
// ✅ 正确
await c.env.DB.prepare('SELECT * FROM collections WHERE id = ?')
  .bind(collectionId)
  .first();
```

2. **为 tenant_id 创建索引**
```sql
CREATE INDEX idx_collections_tenant ON collections(tenant_id);
```

3. **记录审计日志**
```typescript
await logAudit(c, 'DELETE', 'collection', collectionId);
```

### ❌ 不应该做的

1. **不要绕过中间件**
```typescript
// ❌ 错误 - 直接使用原始 DB
const result = await c.env.DB.prepare('SELECT * FROM collections').all();
```

2. **不要信任客户端提供的 tenant_id**
```typescript
// ❌ 错误
const tenantId = body.tenant_id;

// ✅ 正确
const tenantId = c.get('tenantId');
```

---

## 常见陷阱

### 1. 忘记添加 X-Tenant-ID header
**症状:** 收到 `400 MISSING_TENANT_HEADER` 错误  
**解决:** 确保请求包含 header

### 2. JOIN 查询的租户隔离
确保 JOIN 的表也有 `tenant_id` 条件：
```sql
SELECT c.*, u.name 
FROM collections c 
JOIN users u ON c.created_by = u.id 
WHERE c.tenant_id = ? AND u.tenant_id = ?
```

### 3. 子查询的租户隔离
子查询也需要租户约束：
```sql
SELECT * FROM collection_data 
WHERE collection_id IN (
  SELECT id FROM collections WHERE tenant_id = ?
) AND tenant_id = ?
```

---

## 故障排查

### 错误：`TENANT_ISOLATION_ERROR`
**原因:** 请求缺少 `tenantId` 上下文  
**排查:**
1. 检查是否包含 `X-Tenant-ID` header
2. 检查租户是否存在且状态为 `active`

### 问题：查询性能下降
**原因:** `tenant_id` 字段缺少索引  
**解决:** 创建索引
```sql
CREATE INDEX idx_<table>_tenant ON <table>(tenant_id);
```

---

## 测试

运行测试：
```bash
cd packages/server
bun test tests/tenant-isolation.test.ts
```

测试覆盖：
- ✅ SQL 注入防护
- ✅ 跨租户访问阻止
- ✅ 批量操作隔离
- ✅ 事务隔离

---

## 版本历史

- **v1.0.0** (2026-03-12) - 初始版本
