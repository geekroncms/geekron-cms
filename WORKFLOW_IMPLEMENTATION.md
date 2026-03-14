# 工作流引擎实现文档

**版本**: v1.0.0  
**实现时间**: 2026-03-13  
**状态**: ✅ 已完成

---

## 📋 实现概览

根据 PRD 文档 5.6 节的要求，已完成工作流引擎的完整实现，包括：

1. ✅ 状态机定义和配置
2. ✅ 工作流转换逻辑
3. ✅ 审核流程（草稿→待审核→已发布→已归档）
4. ✅ 审核操作 API
5. ✅ 工作流管理 UI
6. ✅ 通知机制基础

---

## 🏗️ 架构设计

### 后端架构

```
packages/server/
├── src/
│   ├── services/
│   │   ├── workflow.ts          # 工作流服务（状态机、转换逻辑）
│   │   └── notification.ts      # 通知服务
│   ├── routes/
│   │   ├── workflow.ts          # 工作流 API 路由
│   │   └── notifications.ts     # 通知 API 路由
│   └── index.ts                 # 主服务器（注册路由）
└── tests/
    └── workflow.test.ts         # 完整测试
```

### 前端架构

```
packages/admin/
├── src/
│   ├── api/
│   │   └── workflow.ts          # 工作流 API 客户端
│   ├── components/
│   │   ├── WorkflowManager.vue  # 工作流配置管理组件
│   │   └── WorkflowActions.vue  # 内容工作流动作组件
│   ├── views/
│   │   └── Workflow.vue         # 工作流管理页面
│   ├── router/
│   │   └── index.ts             # 路由配置
│   └── components/Layout/
│       └── AppLayout.vue        # 侧边栏（添加入口）
```

---

## 📊 数据模型

### workflow_configs (工作流配置表)

```sql
CREATE TABLE workflow_configs (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL UNIQUE,
  states TEXT NOT NULL,              -- JSON 数组
  transitions TEXT NOT NULL,         -- JSON 数组
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)
```

### workflow_history (工作流历史表)

```sql
CREATE TABLE workflow_history (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  action TEXT NOT NULL,
  comment TEXT,
  user_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)
```

### collection_data (扩展字段)

```sql
ALTER TABLE collection_data ADD COLUMN status TEXT DEFAULT 'draft'
ALTER TABLE collection_data ADD COLUMN published_at TEXT
```

### notifications (通知表)

```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id TEXT NOT NULL,
  metadata TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)
```

---

## 🔧 核心功能

### 1. 状态机定义和配置

**默认工作流状态**:
- `draft` (草稿) - 灰色
- `pending` (待审核) - 黄色
- `published` (已发布) - 绿色
- `archived` (已归档) - 蓝色

**状态机配置示例**:
```json
{
  "collectionId": "collection-uuid",
  "states": [
    {"id": "draft", "name": "草稿", "color": "gray"},
    {"id": "pending", "name": "待审核", "color": "yellow"},
    {"id": "published", "name": "已发布", "color": "green"},
    {"id": "archived", "name": "已归档", "color": "blue"}
  ],
  "transitions": [
    {"from": "draft", "to": "pending", "action": "submit"},
    {"from": "pending", "to": "published", "action": "approve"},
    {"from": "pending", "to": "draft", "action": "reject"},
    {"from": "published", "to": "archived", "action": "archive"},
    {"from": "archived", "to": "draft", "action": "restore"}
  ]
}
```

### 2. 工作流转换逻辑

**状态转换验证**:
- 验证 from 状态是否存在
- 验证 to 状态是否存在
- 验证 action 是否合法
- 只有符合配置的转换才被允许

**转换执行流程**:
```
1. 获取内容当前状态
2. 获取工作流配置
3. 验证转换是否合法
4. 更新内容状态
5. 记录工作流历史
6. 触发通知（可选）
```

### 3. 审核流程

**完整流程**:
```
草稿 (draft)
  ↓ [提交审核]
待审核 (pending)
  ↓ [审核通过]        [拒绝]
已发布 (published) ←──┘
  ↓ [归档]
已归档 (archived)
  ↓ [恢复]
草稿 (draft)
```

**审核操作**:
- **提交审核**: 草稿 → 待审核
- **审核通过**: 待审核 → 已发布（自动设置发布时间）
- **拒绝**: 待审核 → 草稿（可添加拒绝原因）
- **归档**: 已发布 → 已归档
- **恢复**: 已归档 → 草稿

### 4. 审核操作 API

#### 获取工作流配置
```http
GET /api/v1/workflow/config/:collectionId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "id": "workflow-id",
    "collectionId": "collection-id",
    "states": [...],
    "transitions": [...],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### 保存工作流配置
```http
PUT /api/v1/workflow/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "collectionId": "collection-id",
  "states": [...],
  "transitions": [...]
}
```

#### 执行工作流动作
```http
POST /api/v1/workflow/:collectionId/:contentId/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "submit",
  "comment": "请审核这篇文章"
}

Response:
{
  "success": true,
  "data": {
    "id": "content-id",
    "previousState": "draft",
    "newState": "pending",
    "action": "submit",
    "comment": "请审核这篇文章"
  }
}
```

#### 获取工作流历史
```http
GET /api/v1/workflow/:collectionId/:contentId/history
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "id": "history-id",
      "contentId": "content-id",
      "fromState": "draft",
      "toState": "pending",
      "action": "submit",
      "comment": "请审核这篇文章",
      "userId": "user-id",
      "createdAt": "2026-03-13T16:00:00Z"
    }
  ]
}
```

#### 获取可用转换动作
```http
GET /api/v1/workflow/:collectionId/:contentId/available-actions
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "currentState": "draft",
    "availableActions": [
      {
        "from": "draft",
        "to": "pending",
        "action": "submit",
        "description": "提交审核"
      }
    ]
  }
}
```

#### 获取工作流统计
```http
GET /api/v1/workflow/:collectionId/stats
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "total": 100,
    "byStatus": {
      "draft": 30,
      "pending": 10,
      "published": 50,
      "archived": 10
    },
    "recentActivity": [...]
  }
}
```

### 5. 工作流管理 UI

#### 工作流配置管理页面
**路径**: `/workflow?collectionId=xxx`

**功能**:
- 可视化配置工作流状态
- 添加/编辑/删除状态
- 配置状态转换规则
- 恢复默认工作流
- 保存工作流配置

**组件**: `WorkflowManager.vue`

#### 内容工作流动作组件
**用途**: 嵌入到内容管理页面

**功能**:
- 显示当前状态
- 显示可用操作按钮
- 执行状态转换
- 添加评论
- 查看历史记录

**组件**: `WorkflowActions.vue`

### 6. 通知机制基础

**通知服务功能**:
- 创建工作流变更通知
- 获取用户通知列表
- 标记通知为已读
- 获取未读通知数量
- 删除通知

**通知 API**:
```http
# 获取通知列表
GET /api/v1/notifications?unreadOnly=true&limit=50

# 获取未读数量
GET /api/v1/notifications/unread-count

# 标记为已读
POST /api/v1/notifications/:id/read

# 标记所有为已读
POST /api/v1/notifications/read-all

# 删除通知
DELETE /api/v1/notifications/:id
```

---

## 🧪 测试

### 测试覆盖率

**测试文件**: `packages/server/tests/workflow.test.ts`

**测试用例**:
- ✅ 默认工作流配置验证 (2 个)
- ✅ 状态转换验证 (3 个)
- ✅ 可用动作查询 (4 个)
- ✅ 状态颜色和名称 (2 个)
- ✅ 工作流转换验证 (5 个)
- ✅ 完整审核流程验证 (3 个)
- ✅ 通知服务验证 (1 个)
- ✅ 配置验证 (2 个)

**总计**: 22 个测试用例，全部通过 ✅

### 运行测试
```bash
cd /root/.openclaw/workspace/geekron-cms
bun test packages/server/tests/workflow.test.ts
```

---

## 📖 使用指南

### 1. 配置工作流

1. 进入工作流管理页面 `/workflow`
2. 选择要配置的集合
3. 添加/编辑状态
4. 配置状态转换
5. 保存配置

### 2. 使用工作流

在内容管理页面中：
1. 创建内容（默认为草稿状态）
2. 点击"提交审核"按钮
3. 审核员看到待审核内容
4. 审核员点击"审核通过"或"拒绝"
5. 内容状态自动更新

### 3. 查看历史

在内容工作流动作组件中：
- 查看所有状态变更历史
- 查看每次操作的评论
- 查看操作时间和操作人

---

## 🔌 集成示例

### 在内容管理页面集成工作流

```vue
<template>
  <div class="content-detail">
    <!-- 内容详情 -->
    <ContentForm :data="content" />
    
    <!-- 工作流动作 -->
    <WorkflowActions
      :collectionId="collectionId"
      :contentId="contentId"
      :currentStatus="content.status"
      @status-change="handleStatusChange"
    />
  </div>
</template>

<script setup>
import WorkflowActions from '@/components/WorkflowActions.vue'

const handleStatusChange = (newStatus) => {
  console.log('状态变更为:', newStatus)
  // 刷新内容列表或执行其他操作
}
</script>
```

### 自定义工作流配置

```javascript
import { saveWorkflowConfig } from '@/api/workflow'

// 自定义审核流程
const customWorkflow = {
  collectionId: 'collection-id',
  states: [
    { id: 'draft', name: '草稿', color: 'gray' },
    { id: 'review', name: '审核中', color: 'orange' },
    { id: 'approved', name: '已批准', color: 'blue' },
    { id: 'published', name: '已发布', color: 'green' }
  ],
  transitions: [
    { from: 'draft', to: 'review', action: 'submit' },
    { from: 'review', to: 'approved', action: 'approve' },
    { from: 'review', to: 'draft', action: 'reject' },
    { from: 'approved', to: 'published', action: 'publish' }
  ]
}

await saveWorkflowConfig(customWorkflow)
```

---

## 🚀 后续优化

### 短期优化
- [ ] 在内容列表页面显示状态标签
- [ ] 添加工作流统计图表
- [ ] 优化通知推送机制（WebSocket）
- [ ] 添加批量操作支持

### 中期优化
- [ ] 支持多级别审核流程
- [ ] 支持条件转换（基于内容字段）
- [ ] 支持定时发布
- [ ] 支持工作流模板

### 长期优化
- [ ] 可视化工作流设计器
- [ ] 支持并行审核
- [ ] 支持审核意见历史
- [ ] 集成邮件/短信通知

---

## 📝 注意事项

1. **权限控制**: 确保只有授权用户可以执行特定操作
   - 草稿 → 待审核：所有编辑
   - 待审核 → 已发布：审核员/管理员
   - 已发布 → 已归档：管理员

2. **数据一致性**: 状态变更时确保相关数据同步更新
   - 发布时间在首次发布时设置
   - 记录所有历史操作

3. **性能优化**: 对于大量内容的集合
   - 使用分页查询历史记录
   - 缓存工作流配置

4. **错误处理**: 完善的错误提示
   - 无效状态转换
   - 权限不足
   - 网络错误

---

## ✅ 验收标准

- [x] 状态机可以正确定义和配置
- [x] 工作流转换逻辑正确执行
- [x] 审核流程完整（草稿→待审核→已发布→已归档）
- [x] 审核操作 API 正常工作
- [x] 工作流管理 UI 可用
- [x] 通知机制基础功能完成
- [x] 所有测试通过
- [x] 文档完整

---

**实现完成时间**: 2026-03-13  
**测试状态**: ✅ 22/22 通过  
**文档状态**: ✅ 已完成

_简洁，高效，解决问题。老板！🫡_
