# Geekron CMS Admin

Geekron CMS 前端管理后台，基于 Vue 3 + Vite + TypeScript + Pinia 构建。

## 技术栈

- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **语言**: TypeScript
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **HTTP 客户端**: Axios
- **UI 风格**: 参考 Directus，简洁现代

## 目录结构

```
packages/admin/
├── src/
│   ├── api/              # API 客户端
│   │   └── index.ts
│   ├── components/       # 组件
│   │   ├── Layout/       # 布局组件
│   │   │   └── AppLayout.vue
│   │   └── UI/           # 通用 UI 组件
│   │       ├── BaseButton.vue
│   │       ├── BaseForm.vue
│   │       ├── BaseModal.vue
│   │       └── BaseTable.vue
│   ├── router/           # 路由配置
│   │   └── index.ts
│   ├── stores/           # Pinia stores
│   │   └── auth.ts
│   ├── styles/           # 全局样式
│   │   └── main.css
│   ├── views/            # 页面组件
│   │   ├── Login.vue
│   │   ├── Dashboard.vue
│   │   ├── Collections.vue
│   │   ├── CollectionDetail.vue
│   │   ├── Users.vue
│   │   └── Settings.vue
│   ├── App.vue
│   └── main.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

## 功能模块

### 1. 认证模块

- 登录/登出
- Token 管理
- 路由守卫
- 权限控制

### 2. 数据模型管理

- 模型列表（卡片视图）
- 创建/删除模型
- 字段管理
- 字段类型支持：文本、数字、布尔、日期、邮箱、链接、多行文本、JSON、关联

### 3. 用户管理

- 用户列表（表格视图）
- 搜索和筛选
- 添加/编辑/删除用户
- 角色管理（管理员、编辑、普通用户）
- 状态管理（活跃、未激活、已禁用）

### 4. 系统设置

- 基本信息配置
- 外观设置（Logo、主题色）
- 功能开关
- API 密钥管理
- 危险操作（删除租户）

### 5. 仪表盘

- 数据统计卡片
- 快速操作入口
- 最近活动记录

## 开发指南

### 安装依赖

```bash
cd packages/admin
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

### 构建生产版本

```bash
pnpm build
```

### 预览生产构建

```bash
pnpm preview
```

## 环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

配置项：

- `VITE_API_URL`: API 服务器地址（默认：http://localhost:8787/api/v1）
- `VITE_APP_NAME`: 应用名称
- `VITE_APP_VERSION`: 应用版本

## 组件使用

### BaseButton

```vue
<BaseButton
  type="primary"
  size="medium"
  label="提交"
  :loading="false"
  @click="handleSubmit"
/>
```

### BaseForm

```vue
<BaseForm
  v-model="formData"
  :fields="[
    { key: 'name', label: '名称', type: 'text', required: true },
    { key: 'email', label: '邮箱', type: 'email' },
    { key: 'status', label: '状态', type: 'select', options: [...] }
  ]"
/>
```

### BaseModal

```vue
<BaseModal v-model="showModal" title="标题" size="medium">
  <p>内容</p>
  <template #footer>
    <BaseButton @click="showModal = false">取消</BaseButton>
    <BaseButton @click="handleConfirm">确认</BaseButton>
  </template>
</BaseModal>
```

### BaseTable

```vue
<BaseTable
  :data="users"
  :columns="[
    { key: 'name', title: '姓名' },
    { key: 'email', title: '邮箱' },
  ]"
  row-key="id"
>
  <template #actions="{ row }">
    <BaseButton @click="edit(row)">编辑</BaseButton>
  </template>
</BaseTable>
```

## API 调用

```typescript
import { collectionApi, userApi, authApi } from '@/api'

// 认证
await authApi.login(email, password)
await authApi.me()

// 数据模型
await collectionApi.list()
await collectionApi.get(id)
await collectionApi.create(data)
await collectionApi.update(id, data)
await collectionApi.delete(id)
await collectionApi.updateFields(id, fields)

// 用户
await userApi.list()
await userApi.create(data)
await userApi.update(id, data)
await userApi.delete(id)
```

## 路由配置

```typescript
{
  path: '/collections',
  name: 'Collections',
  component: () => import('../views/Collections.vue'),
  meta: {
    requiresAuth: true,  // 需要认证
    title: '数据模型',    // 页面标题
    permission: 'admin'   // 权限要求
  },
}
```

## UI 设计规范

- **主色调**: #667eea (紫色)
- **成功色**: #38a169 (绿色)
- **危险色**: #e53e3e (红色)
- **警告色**: #dd6b20 (橙色)
- **圆角**: 6px - 12px
- **阴影**: 0 2px 8px rgba(0, 0, 0, 0.06)

## 响应式设计

- 移动端：< 768px
- 平板端：768px - 1024px
- 桌面端：> 1024px

侧边栏在移动端自动折叠，支持手势滑动。

## 待办事项

- [ ] 内容管理界面（基于数据模型动态生成）
- [ ] 文件上传组件
- [ ] 富文本编辑器
- [ ] 数据导入/导出
- [ ] 操作日志
- [ ] 主题切换（深色模式）
- [ ] 国际化支持
- [ ] 单元测试
- [ ] E2E 测试

## License

MIT
