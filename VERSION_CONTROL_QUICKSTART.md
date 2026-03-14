# 版本控制系统快速开始指南

## 🚀 快速开始

### 1. 数据库迁移

首先运行数据库迁移创建版本控制表:

```bash
cd packages/server

# 运行迁移
bun run db:migrate

# 或者手动执行 SQL
# 执行 src/db/migrations/003-version-control.sql 中的 SQL 语句
```

### 2. 启用自动版本控制

自动版本中间件已在 `src/index.ts` 中注册:

```typescript
// 已自动启用
protectedApi.use('/data/*', autoVersionMiddleware)
```

### 3. 配置自动版本

为租户配置自动版本设置:

```bash
# 获取当前配置
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8787/api/v1/versions/auto-config

# 更新配置
curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "autoSaveInterval": 300,
    "maxVersions": 50,
    "retentionDays": 90
  }' \
  http://localhost:8787/api/v1/versions/auto-config
```

---

## 📖 使用示例

### 创建内容 (自动创建版本)

```bash
# 创建内容时会自动创建版本 1
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -d '{
    "collectionId": "collection-uuid",
    "data": {
      "title": "My Article",
      "content": "Initial content"
    }
  }' \
  http://localhost:8787/api/v1/data
```

### 查看版本历史

```bash
# 获取内容的版本历史
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8787/api/v1/versions/DATA_ID/history?limit=20"
```

### 比较版本

```bash
# 比较两个版本的差异
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8787/api/v1/versions/compare?versionId1=VER_ID_1&versionId2=VER_ID_2"
```

### 版本回滚

```bash
# 回滚到历史版本
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "versionId": "VERSION_ID_TO_ROLLBACK",
    "changeSummary": "回滚到此版本"
  }' \
  http://localhost:8787/api/v1/versions/rollback
```

---

## 🎨 前端使用

### 在内容管理页使用版本历史

版本历史组件已集成到内容管理页面:

1. 打开内容管理页面
2. 点击内容卡片上的 📜 图标
3. 查看版本历史
4. 可以:
   - 查看版本详情
   - 比较两个版本
   - 回滚到历史版本

### 单独使用版本历史组件

```vue
<template>
  <VersionHistory
    :data-id="contentId"
    :collection-id="collectionId"
    @rollback="handleRollback"
    @refresh="loadContent"
  />
</template>

<script setup>
import VersionHistory from '@/components/VersionHistory.vue'

const contentId = 'data-uuid'
const collectionId = 'collection-uuid'

function handleRollback(version) {
  console.log('Rolled back to version', version.versionNumber)
}
</script>
```

---

## 🔧 开发指南

### 手动创建版本

```typescript
import { VersionService } from '@/services/version-service'

const versionService = new VersionService(db)

// 创建新版本
const version = await versionService.createVersion({
  dataId: 'data-uuid',
  collectionId: 'collection-uuid',
  tenantId: 'tenant-uuid',
  data: { title: 'Updated', content: 'New content' },
  changeSummary: '手动创建版本',
  changeType: 'update', // 'create' | 'update' | 'rollback' | 'auto_save'
  userId: 'user-uuid',
  userEmail: 'user@example.com',
})
```

### 获取版本历史

```typescript
const { versions, total } = await versionService.getVersionHistory(
  'data-uuid',
  'tenant-uuid',
  50,  // limit
  0    // offset
)
```

### 版本比较

```typescript
const diff = await versionService.compareVersions(
  'version-id-1',
  'version-id-2',
  'tenant-uuid'
)

console.log(diff.added)    // 新增字段
console.log(diff.removed)  // 删除字段
console.log(diff.modified) // 修改字段
```

### 版本回滚

```typescript
const rollbackVersion = await versionService.rollbackToVersion({
  versionId: 'version-id-to-rollback',
  changeSummary: '回滚说明',
  userId: 'user-uuid',
})
```

---

## 📊 数据库表结构

### content_versions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 版本 ID (UUID) |
| data_id | TEXT | 关联的内容数据 ID |
| collection_id | TEXT | 集合 ID |
| tenant_id | TEXT | 租户 ID |
| version_number | INTEGER | 版本号 (1, 2, 3...) |
| data | TEXT (JSON) | 版本数据快照 |
| change_summary | TEXT | 变更说明 |
| change_type | TEXT | 变更类型 |
| created_by | TEXT | 创建人 ID |
| created_by_email | TEXT | 创建人邮箱 |
| is_current | INTEGER | 是否当前版本 |
| parent_version_id | TEXT | 父版本 ID |
| metadata | TEXT (JSON) | 元数据 |
| created_at | TEXT | 创建时间 |

### auto_version_configs

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 配置 ID |
| tenant_id | TEXT | 租户 ID |
| collection_id | TEXT | 集合 ID (NULL=全局) |
| enabled | INTEGER | 是否启用 |
| auto_save_interval | INTEGER | 自动保存间隔 (秒) |
| max_versions | INTEGER | 最大版本数 |
| retention_days | INTEGER | 保留天数 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

---

## 🧪 运行测试

```bash
cd packages/server

# 运行单元测试
bun test tests/version-control.test.ts

# 运行 E2E 测试
bun test tests/version-control.e2e.test.ts
```

---

## ⚙️ 配置选项

### 自动版本配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| enabled | boolean | true | 是否启用自动版本 |
| autoSaveInterval | number | 300 | 自动保存间隔 (秒) |
| maxVersions | number | 50 | 最大版本数 |
| retentionDays | number | 90 | 版本保留天数 |

### 变更类型

| 类型 | 说明 | 触发场景 |
|------|------|----------|
| create | 创建 | 首次创建内容 |
| update | 更新 | 手动更新内容 |
| rollback | 回滚 | 版本回滚操作 |
| auto_save | 自动保存 | 中间件自动创建 |

---

## 🔍 常见问题

### Q: 版本数据会占用太多空间吗？

A: 通过以下机制控制:
- `maxVersions`: 限制最大版本数
- `retentionDays`: 自动清理过期版本
- 定期运行清理 API: `POST /versions/cleanup`

### Q: 自动版本会影响性能吗？

A: 影响很小:
- 版本创建是异步的
- 不阻塞主请求
- 失败不影响内容操作

### Q: 可以禁用自动版本吗？

A: 可以:
```bash
curl -X PUT -H "Authorization: Bearer TOKEN" \
  -d '{"enabled": false}' \
  http://localhost:8787/api/v1/versions/auto-config
```

### Q: 版本回滚会删除数据吗？

A: 不会:
- 回滚创建新版本
- 旧版本都保留
- 可以随时再次回滚

---

## 📞 技术支持

遇到问题？

1. 查看 [实现文档](./VERSION_CONTROL_IMPLEMENTATION.md)
2. 检查 [PRD 文档](./PRODUCT_REQUIREMENTS.md)
3. 查看测试文件示例
4. 联系开发团队

---

_简洁，高效，解决问题。有事直接吩咐，老板！🫡_
