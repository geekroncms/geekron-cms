# Geekron CMS 产品需求文档 (PRD)

**项目名称**: Geekron CMS - SaaS 版 Directus  
**版本**: v1.0.0  
**文档状态**: 待评审  
**生成时间**: 2026-03-13  
**参考项目**: Directus CMS (https://directus.io)

---

## 📋 目录

1. [项目概述](#1-项目概述)
2. [产品定位](#2-产品定位)
3. [功能架构](#3-功能架构)
4. [数据模型设计](#4-数据模型设计)
5. [核心功能详解](#5-核心功能详解)
6. [API 设计规范](#6-api-设计规范)
7. [UI/UX 设计规范](#7-uiux-设计规范)
8. [技术架构](#8-技术架构)
9. [开发计划](#9-开发计划)

---

## 1. 项目概述

### 1.1 项目背景

**Directus** 是一款开源的 Headless CMS，核心特点：
- 🎨 可视化数据模型设计器
- 🔌 自动生成 REST/GraphQL API
- 🏢 多租户支持
- 👥 细粒度权限控制
- 📦 文件/资产管理
- 🔄 内容审核工作流

**Geekron CMS 目标**: 基于 Cloudflare Workers 平台，构建 SaaS 版本的 Directus，提供：
- 更低成本（Serverless 按需付费）
- 更高性能（边缘计算 CDN 加速）
- 更易部署（一键部署到 Cloudflare）
- 完整多租户支持

### 1.2 竞品分析

| 功能 | Directus | Geekron CMS | 说明 |
|------|----------|-------------|------|
| **部署方式** | 自托管/云托管 | SaaS | Geekron 完全托管 |
| **数据库** | 支持多种 SQL | D1 (SQLite) | Cloudflare 原生 |
| **计算平台** | Node.js | Cloudflare Workers | 边缘计算 |
| **多租户** | ✅ | ✅ | 完整隔离 |
| **数据模型** | ✅ | ✅ | 可视化设计 |
| **REST API** | ✅ | ✅ | 自动生成 |
| **GraphQL** | ✅ | ⏳ 规划中 | Phase 3 |
| **权限系统** | ✅ 完整 | ⏳ 基础 | 待完善 |
| **文件管理** | ✅ 完整 | ⏳ 基础 | 待 R2 |
| **工作流** | ✅ | ⏳ 基础 | 待完善 |
| **定价** | $99+/月 | 按使用量付费 | 成本更低 |

### 1.3 核心价值主张

**对中小企业**:
- 💰 低成本 - 按使用量付费，无需服务器运维
- ⚡ 快速上线 - 一键部署，分钟级配置
- 🎨 灵活定制 - 可视化数据模型设计

**对开发者**:
- 🔌 API 优先 - 自动生成 REST/GraphQL API
- 📚 完整文档 - 详细的 API 和使用文档
- 🛠️ 开发友好 - TypeScript + 热重载

**对 SaaS 提供商**:
- 🏢 多租户 - 完整的租户隔离
- 👥 权限管理 - 细粒度权限控制
- 📊 配额管理 - 套餐和用量限制

---

## 2. 产品定位

### 2.1 目标用户

| 用户类型 | 特征 | 需求 |
|---------|------|------|
| **中小企业** | 10-500 人，无专业运维 | 低成本、易部署、免运维 |
| **开发者** | 全栈/后端开发 | 灵活 API、完整文档、开发友好 |
| **内容创作者** | 编辑、运营人员 | 可视化编辑、易用的后台 |
| **SaaS 提供商** | 需要多租户架构 | 租户隔离、权限管理、配额控制 |

### 2.2 使用场景

#### 场景 1: 企业内容管理系统
- **用户**: 中小企业市场部
- **需求**: 管理官网内容、新闻、产品
- **方案**: 创建内容模型 → 配置权限 → 编辑发布

#### 场景 2: 多租户 SaaS 应用
- **用户**: SaaS 创业者
- **需求**: 为多个客户提供内容管理服务
- **方案**: 创建租户 → 分配配额 → 客户自助管理

#### 场景 3: 移动应用后端
- **用户**: 移动开发者
- **需求**: 快速搭建内容 API
- **方案**: 定义数据模型 → 自动生成 API → 客户端调用

### 2.3 产品愿景

**短期 (v1.0-v2.0)**:
- 完成 Directus 核心功能
- 实现多租户 SaaS 架构
- 建立完整的 API 体系

**中期 (v2.0-v3.0)**:
- 添加 GraphQL 支持
- 完善权限和工作流
- 建立插件生态系统

**长期 (v3.0+)**:
- 成为 Cloudflare 生态首选 CMS
- 支持更多数据源
- 建立应用市场

---

## 3. 功能架构

### 3.1 功能模块总览

```
Geekron CMS
├── 认证系统 (Auth)
│   ├── 用户注册/登录
│   ├── JWT Token 管理
│   ├── 密码找回
│   └── 多因素认证 (2FA)
│
├── 租户管理 (Tenants)
│   ├── 租户 CRUD
│   ├── 子域名管理
│   ├── 套餐管理
│   └── 配额管理
│
├── 用户管理 (Users)
│   ├── 用户 CRUD
│   ├── 角色管理
│   ├── 权限分配
│   └── 活动日志
│
├── 数据模型 (Data Model)
│   ├── 集合管理 (Collections)
│   ├── 字段管理 (Fields)
│   ├── 关系管理 (Relations)
│   └── 元数据管理 (Metadata)
│
├── 内容管理 (Content)
│   ├── 内容 CRUD
│   ├── 版本控制
│   ├── 内容审核
│   └── 批量操作
│
├── 文件管理 (Files)
│   ├── 文件上传/下载
│   ├── 图片处理
│   ├── 文件预览
│   └── CDN 加速
│
├── 权限系统 (Permissions)
│   ├── 角色定义 (RBAC)
│   ├── 资源权限
│   ├── 字段权限
│   └── 数据规则
│
├── 工作流 (Workflow)
│   ├── 状态机定义
│   ├── 审核流程
│   ├── 通知机制
│   └── 版本管理
│
├── API 管理 (API)
│   ├── REST API
│   ├── GraphQL API
│   ├── Webhook
│   └── API Key 管理
│
└── 系统管理 (Settings)
    ├── 系统配置
    ├── 审计日志
    ├── 监控告警
    └── 备份恢复
```

### 3.2 功能优先级

| 优先级 | 模块 | 功能 | 预计工时 |
|--------|------|------|----------|
| **P0** | 认证系统 | 登录/注册/Token | ✅ 已完成 |
| **P0** | 数据模型 | Collection/Field | ✅ 已完成 |
| **P0** | 内容管理 | 基础 CRUD | ✅ 已完成 |
| **P0** | 租户管理 | 基础 CRUD | ✅ 已完成 |
| **P0** | 用户管理 | 基础 CRUD | ✅ 已完成 |
| **P0** | API Key | 基础管理 | ✅ 已完成 |
| **P1** | 权限系统 | RBAC+ 字段权限 | 8h |
| **P1** | 文件管理 | R2 完整功能 | 6h |
| **P1** | 工作流引擎 | 审核流程 | 8h |
| **P2** | GraphQL | GraphQL API | 12h |
| **P2** | 版本控制 | 内容版本 | 8h |
| **P2** | Webhook | 事件通知 | 6h |
| **P3** | 多语言 | i18n 支持 | 8h |
| **P3** | 模板系统 | 内容模板 | 10h |
| **P3** | SDK | 多语言 SDK | 16h |

---

## 4. 数据模型设计

### 4.1 核心数据表

#### tenants (租户表)

```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,              -- 租户 ID (UUID)
  name TEXT NOT NULL,               -- 租户名称
  slug TEXT NOT NULL UNIQUE,        -- 子域名标识
  email TEXT NOT NULL,              -- 管理员邮箱
  plan TEXT DEFAULT 'free',         -- 套餐：free/pro/enterprise
  status TEXT DEFAULT 'active',     -- 状态：active/suspended/deleted
  settings TEXT,                    -- 租户配置 (JSON)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### users (用户表)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- 用户 ID (UUID)
  email TEXT NOT NULL UNIQUE,       -- 邮箱
  password TEXT NOT NULL,           -- 密码哈希
  name TEXT NOT NULL,               -- 姓名
  avatar TEXT,                      -- 头像 URL
  role TEXT DEFAULT 'viewer',       -- 角色：owner/admin/editor/viewer
  status TEXT DEFAULT 'active',     -- 状态：active/inactive/banned
  last_login_at TEXT,               -- 最后登录时间
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### tenant_members (租户成员表)

```sql
CREATE TABLE tenant_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,          -- 租户 ID
  user_id TEXT NOT NULL,            -- 用户 ID
  role TEXT DEFAULT 'viewer',       -- 租户内角色
  permissions TEXT,                 -- 自定义权限 (JSON)
  invited_by TEXT,                  -- 邀请人 ID
  status TEXT DEFAULT 'active',     -- 状态：active/invited/suspended
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, user_id)
);
```

#### collections (集合表)

```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,          -- 租户 ID
  name TEXT NOT NULL,               -- 集合名称 (articles)
  slug TEXT NOT NULL,               -- URL 标识
  display_name TEXT,                -- 显示名称 (文章)
  description TEXT,                 -- 描述
  schema TEXT,                      -- Schema 定义 (JSON)
  is_system INTEGER DEFAULT 0,      -- 是否系统集合
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, slug)
);
```

#### collection_fields (集合字段表)

```sql
CREATE TABLE collection_fields (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,      -- 集合 ID
  name TEXT NOT NULL,               -- 字段名 (title)
  display_name TEXT,                -- 显示名称 (标题)
  type TEXT NOT NULL,               -- 类型：text/number/boolean/date/json/relation/file/richtext
  required INTEGER DEFAULT 0,       -- 是否必填
  unique INTEGER DEFAULT 0,         -- 是否唯一
  default_value TEXT,               -- 默认值
  validation TEXT,                  -- 验证规则 (JSON)
  options TEXT,                     -- 选项配置 (JSON)
  order_index INTEGER DEFAULT 0,    -- 排序
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(collection_id, name)
);
```

#### collection_data (集合数据表)

```sql
CREATE TABLE collection_data (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,      -- 集合 ID
  tenant_id TEXT NOT NULL,          -- 租户 ID
  data TEXT NOT NULL,               -- 数据内容 (JSON)
  created_by TEXT,                  -- 创建人 ID
  updated_by TEXT,                  -- 更新人 ID
  status TEXT DEFAULT 'published',  -- 状态：draft/pending/published/archived
  version INTEGER DEFAULT 1,        -- 版本号
  published_at TEXT,                -- 发布时间
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### api_keys (API 密钥表)

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,          -- 租户 ID
  name TEXT NOT NULL,               -- Key 名称
  key TEXT NOT NULL UNIQUE,         -- Key 哈希
  permissions TEXT,                 -- 权限列表 (JSON)
  expires_at TEXT,                  -- 过期时间
  last_used_at TEXT,                -- 最后使用时间
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### quotas (配额表)

```sql
CREATE TABLE quotas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,          -- 租户 ID
  resource_type TEXT NOT NULL,      -- 资源类型：users/collections/api_calls/storage
  limit_value INTEGER NOT NULL,     -- 限制值
  used_value INTEGER DEFAULT 0,     -- 已使用值
  period TEXT DEFAULT 'monthly',    -- 周期：daily/monthly/yearly
  reset_at TEXT,                    -- 重置时间
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, resource_type)
);
```

#### files (文件表)

```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,          -- 租户 ID
  name TEXT NOT NULL,               -- 文件名
  path TEXT NOT NULL,               -- 文件路径
  mime_type TEXT NOT NULL,          -- MIME 类型
  size INTEGER NOT NULL,            -- 文件大小 (字节)
  r2_key TEXT,                      -- R2 存储键
  checksum TEXT,                    -- 文件校验和
  width INTEGER,                    -- 图片宽度
  height INTEGER,                   -- 图片高度
  created_by TEXT,                  -- 上传人 ID
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### audit_logs (审计日志表)

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,          -- 租户 ID
  user_id TEXT,                     -- 用户 ID
  action TEXT NOT NULL,             -- 操作：create/update/delete/login
  resource_type TEXT NOT NULL,      -- 资源类型：user/collection/content
  resource_id TEXT,                 -- 资源 ID
  details TEXT,                     -- 详细信息 (JSON)
  ip_address TEXT,                  -- IP 地址
  user_agent TEXT,                  -- 用户代理
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 4.2 字段类型定义

| 类型 ID | 类型名 | 说明 | 示例 |
|--------|--------|------|------|
| `text` | 文本 | 短文本 | 标题、名称 |
| `richtext` | 富文本 | Markdown/HTML | 文章内容 |
| `number` | 数字 | 整数/小数 | 价格、数量 |
| `boolean` | 布尔 | true/false | 是否发布 |
| `date` | 日期 | 日期时间 | 发布时间 |
| `datetime` | 时间戳 | 精确时间 | 创建时间 |
| `json` | JSON | 任意 JSON | 配置数据 |
| `file` | 文件 | 文件引用 | 图片、文档 |
| `image` | 图片 | 图片引用 | 头像、封面 |
| `relation` | 关联 | 关联其他集合 | 作者、分类 |
| `m2m` | 多对多 | 多对多关联 | 标签 |
| `uuid` | UUID | 唯一标识 | 外部 ID |
| `slug` | Slug | URL 友好字符串 | URL 路径 |

---

## 5. 核心功能详解

### 5.1 认证系统

#### 5.1.1 用户注册

**流程**:
```
1. 用户填写注册表单（邮箱、密码、租户名称）
   ↓
2. 检查邮箱是否已存在
   ↓
3. 创建租户（自动创建第一个租户）
   ↓
4. 创建用户并关联租户（角色：owner）
   ↓
5. 发送验证邮件（可选）
   ↓
6. 自动登录并返回 Token
```

**API**:
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "tenantName": "My Company",
  "tenantSlug": "my-company"
}

Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user_xxx",
      "email": "user@example.com",
      "name": "User Name"
    },
    "tenant": {
      "id": "tenant_xxx",
      "name": "My Company",
      "slug": "my-company"
    }
  }
}
```

#### 5.1.2 用户登录

**流程**:
```
1. 用户输入邮箱和密码
   ↓
2. 查询用户并验证密码
   ↓
3. 获取用户所属租户列表
   ↓
4. 生成 JWT Token（包含租户上下文）
   ↓
5. 返回 Token 和用户信息
```

**API**:
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "tenantSlug": "my-company"  // 可选，多租户时指定
}

Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 604800,
    "user": {...},
    "tenants": [
      {"id": "t1", "name": "Company A", "slug": "company-a"},
      {"id": "t2", "name": "Company B", "slug": "company-b"}
    ]
  }
}
```

#### 5.1.3 Token 管理

**JWT Token 结构**:
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "tenant_id": "tenant_id",
  "role": "admin",
  "permissions": ["read:all", "write:content"],
  "iat": 1234567890,
  "exp": 1234654290
}
```

**Token 刷新**:
```http
POST /api/auth/refresh
Authorization: Bearer <old_token>

Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 604800
  }
}
```

---

### 5.2 数据模型管理

#### 5.2.1 创建集合

**UI 流程**:
```
1. 点击"新建集合"按钮
   ↓
2. 填写集合信息（名称、显示名称、描述）
   ↓
3. 添加字段（拖拽或点击添加）
   ↓
4. 配置字段属性（类型、验证、默认值）
   ↓
5. 保存并自动生成 API
```

**API**:
```http
POST /api/collections
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "articles",
  "displayName": "文章",
  "description": "文章集合",
  "fields": [
    {
      "name": "title",
      "displayName": "标题",
      "type": "text",
      "required": true
    },
    {
      "name": "content",
      "displayName": "内容",
      "type": "richtext",
      "required": true
    },
    {
      "name": "published",
      "displayName": "是否发布",
      "type": "boolean",
      "default": false
    }
  ]
}
```

#### 5.2.2 字段类型配置

**文本字段配置**:
```json
{
  "name": "title",
  "type": "text",
  "required": true,
  "unique": false,
  "defaultValue": null,
  "validation": {
    "minLength": 1,
    "maxLength": 200,
    "pattern": null
  },
  "ui": {
    "inputType": "text",
    "placeholder": "请输入标题",
    "helpText": "文章标题，最多 200 字"
  }
}
```

**关联字段配置**:
```json
{
  "name": "author",
  "type": "relation",
  "relation": {
    "collection": "users",
    "type": "m2o",  // many-to-one
    "field": "id",
    "display": "name"
  }
}
```

---

### 5.3 内容管理

#### 5.3.1 内容 CRUD

**创建内容**:
```http
POST /api/collections/articles/data
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "第一篇文章",
  "content": "这是文章内容...",
  "published": false
}
```

**查询内容**:
```http
GET /api/collections/articles/data?filter[published]=true&sort=-created_at&limit=10&page=1

Response:
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

**更新内容**:
```http
PATCH /api/collections/articles/data/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "更新后的标题",
  "published": true
}
```

**删除内容**:
```http
DELETE /api/collections/articles/data/{id}
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Content deleted"
}
```

#### 5.3.2 查询参数

**过滤**:
```
?filter[field]=value
?filter[field][_eq]=value      // 等于
?filter[field][_neq]=value     // 不等于
?filter[field][_gt]=value      // 大于
?filter[field][_gte]=value     // 大于等于
?filter[field][_lt]=value      // 小于
?filter[field][_lte]=value     // 小于等于
?filter[field][_in]=a,b,c      // 包含
?filter[field][_contains]=text // 包含文本
```

**排序**:
```
?sort=field           // 升序
?sort=-field          // 降序
?sort=field1,-field2  // 多字段排序
```

**分页**:
```
?page=1&limit=10      // 第 1 页，每页 10 条
?offset=0&limit=10    // 偏移量方式
```

**字段选择**:
```
?fields=title,content,created_at
```

---

### 5.4 权限系统

#### 5.4.1 角色定义

| 角色 | 权限说明 |
|------|----------|
| **owner** | 租户所有者，所有权限 |
| **admin** | 管理员，除租户管理外的所有权限 |
| **editor** | 编辑，可创建/编辑/发布内容 |
| **viewer** | 查看者，只能查看内容 |

#### 5.4.2 权限粒度

**资源权限**:
```json
{
  "collection:articles": {
    "read": true,
    "create": true,
    "update": true,
    "delete": false
  },
  "collection:users": {
    "read": "own",    // 只能读自己的
    "create": false,
    "update": "own",
    "delete": false
  }
}
```

**字段权限**:
```json
{
  "collection:articles": {
    "fields": {
      "title": "read,write",
      "content": "read,write",
      "salary": "none"  // 不可见
    }
  }
}
```

**数据规则**:
```json
{
  "collection:articles": {
    "read": {
      "status": "published"  // 只能读已发布的
    },
    "update": {
      "created_by": "$CURRENT_USER"  // 只能编辑自己创建的
    }
  }
}
```

#### 5.4.3 权限 API

**获取角色权限**:
```http
GET /api/roles/{roleId}/permissions
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "roleId": "editor",
    "permissions": {...}
  }
}
```

**更新权限**:
```http
PUT /api/roles/{roleId}/permissions
Authorization: Bearer <token>
Content-Type: application/json

{
  "collection:articles": {
    "read": true,
    "create": true,
    "update": true,
    "delete": false
  }
}
```

---

### 5.5 文件管理

#### 5.5.1 文件上传

**单文件上传**:
```http
POST /api/files
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>

Response:
{
  "success": true,
  "data": {
    "id": "file_xxx",
    "name": "image.jpg",
    "path": "/files/2026/03/image.jpg",
    "mimeType": "image/jpeg",
    "size": 102400,
    "url": "https://cdn.geekron-cms.com/files/2026/03/image.jpg"
  }
}
```

**多文件上传**:
```http
POST /api/files/batch
Authorization: Bearer <token>
Content-Type: multipart/form-data

files[]: <binary>
files[]: <binary>
```

#### 5.5.2 图片处理

**图片变换**:
```
GET /api/files/{id}/transform?width=300&height=200&fit=cover&quality=80

参数:
- width: 宽度
- height: 高度
- fit: cover/contain/fill
- quality: 1-100
- format: auto/webp/jpeg/png
```

**缩略图生成**:
```http
POST /api/files/{id}/thumbnails
Authorization: Bearer <token>
Content-Type: application/json

{
  "sizes": [
    {"width": 100, "height": 100, "name": "thumb"},
    {"width": 400, "height": 300, "name": "medium"}
  ]
}
```

---

### 5.6 工作流引擎

#### 5.6.1 工作流定义

**状态机配置**:
```json
{
  "collection": "articles",
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
    {"from": "published", "to": "archived", "action": "archive"}
  ]
}
```

#### 5.6.2 审核流程

**提交审核**:
```http
POST /api/collections/articles/data/{id}/workflow
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "submit",
  "comment": "请审核这篇文章"
}
```

**审核操作**:
```http
POST /api/collections/articles/data/{id}/workflow
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "approve",  // 或 reject
  "comment": "审核通过，可以发布"
}

Response:
{
  "success": true,
  "data": {
    "id": "content_xxx",
    "status": "published",
    "publishedAt": "2026-03-13T16:00:00Z"
  }
}
```

---

## 6. API 设计规范

### 6.1 RESTful 规范

**资源命名**:
- 使用复数名词：`/api/collections`, `/api/users`
- 小写字母，连字符分隔：`/api/api-keys`
- 嵌套资源：`/api/collections/{id}/data`

**HTTP 方法**:
| 方法 | 用途 | 幂等 |
|------|------|------|
| GET | 读取 | 是 |
| POST | 创建 | 否 |
| PUT | 全量更新 | 是 |
| PATCH | 部分更新 | 是 |
| DELETE | 删除 | 是 |

**响应格式**:
```json
{
  "success": true,
  "data": {...},
  "meta": {
    "timestamp": "2026-03-13T16:00:00Z",
    "requestId": "req_xxx"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {"field": "email", "message": "Invalid email format"}
    ]
  }
}
```

### 6.2 认证规范

**请求头**:
```
Authorization: Bearer <jwt_token>
X-Tenant-ID: <tenant_id>  // 可选，多租户时指定
```

**Token 位置**:
1. Header (推荐): `Authorization: Bearer xxx`
2. Query: `?token=xxx` (仅限 WebSocket)

### 6.3 限流规范

**限流头**:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1647172800
```

**限流响应**:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later"
  }
}
```

---

## 7. UI/UX 设计规范

### 7.1 设计原则

1. **简洁直观** - 减少认知负担，操作符合直觉
2. **一致性** - 统一的视觉语言和交互模式
3. **响应式** - 适配桌面、平板、移动端
4. **可访问性** - 支持键盘操作、屏幕阅读器

### 7.2 色彩规范

**主色调**:
```css
--primary: #667eea      /* 主色 */
--primary-dark: #5a67d8  /* 主色深色 */
--primary-light: #90cdf4 /* 主色浅色 */
```

**功能色**:
```css
--success: #48bb78  /* 成功 */
--warning: #ed8936  /* 警告 */
--error: #f56565    /* 错误 */
--info: #4299e1     /* 信息 */
```

**中性色**:
```css
--gray-50: #f9fafb
--gray-100: #f3f4f6
--gray-200: #e5e7eb
--gray-300: #d1d5db
--gray-400: #9ca3af
--gray-500: #6b7280
--gray-600: #4b5563
--gray-700: #374151
--gray-800: #1f2937
--gray-900: #111827
```

### 7.3 布局规范

**侧边栏**:
- 宽度：256px (展开), 64px (折叠)
- 高度：100vh
- 背景：#1f2937 (深色主题)

**顶部栏**:
- 高度：64px
- 背景：白色/深色
- 阴影：0 1px 3px rgba(0,0,0,0.1)

**内容区**:
- 最大宽度：1400px
- 内边距：24px
- 背景：#f9fafb

### 7.4 组件规范

**按钮**:
```css
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
```

**卡片**:
```css
.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  padding: 16px;
  transition: all 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

**表单**:
```css
.input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
}

.input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}
```

### 7.5 响应式断点

```css
/* 移动端 */
@media (max-width: 640px) { ... }

/* 平板 */
@media (min-width: 641px) and (max-width: 1024px) { ... }

/* 桌面 */
@media (min-width: 1025px) { ... }

/* 大桌面 */
@media (min-width: 1440px) { ... }
```

---

## 8. 技术架构

### 8.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     Cloudflare CDN                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Cloudflare Workers                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Server     │  │    Admin     │  │     SDK      │  │
│  │   (Hono)     │  │   (Vue3)     │  │  (Client)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  D1 (SQL)   │     │  R2 Store   │     │  KV Cache   │
│  Database   │     │   Files     │     │  Session    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 8.2 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端框架** | Vue 3 | Composition API |
| **构建工具** | Vite | 快速开发和构建 |
| **样式方案** | TailwindCSS | 原子化 CSS |
| **状态管理** | Pinia | Vue 3 状态管理 |
| **HTTP 客户端** | Axios | API 请求 |
| **后端框架** | Hono | Cloudflare Workers 框架 |
| **数据库** | D1 | Cloudflare SQLite |
| **文件存储** | R2 | Cloudflare 对象存储 |
| **缓存** | KV | Cloudflare KV |
| **语言** | TypeScript | 类型安全 |
| **包管理** | Bun | 快速安装 |

### 8.3 部署架构

**开发环境**:
```bash
bun run dev  # 本地开发服务器
```

**测试环境**:
```bash
bun run deploy:staging  # 部署到 staging
```

**生产环境**:
```bash
bun run deploy:production  # 部署到 production
```

**CI/CD**:
```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      - run: npx wrangler deploy
```

---

## 9. 开发计划

### 9.1 Phase 1: 基础功能（已完成 ✅）

**时间**: 2026-03-12 ~ 2026-03-13  
**状态**: 已完成

| 模块 | 功能 | 状态 |
|------|------|------|
| 认证系统 | 登录/注册/Token | ✅ |
| 租户管理 | 基础 CRUD | ✅ |
| 用户管理 | 基础 CRUD | ✅ |
| 数据模型 | Collection/Field | ✅ |
| 内容管理 | 基础 CRUD | ✅ |
| API Key | 基础管理 | ✅ |
| 配额管理 | 基础监控 | ✅ |

### 9.2 Phase 2: 功能完善（进行中 🔄）

**时间**: 2026-03-13 ~ 2026-03-20  
**状态**: 开发中

| 优先级 | 模块 | 功能 | 预计工时 | 状态 |
|--------|------|------|----------|------|
| P0 | 文件管理 | R2 存储集成 | 4h | ⏳ |
| P0 | 权限系统 | RBAC+ 字段权限 | 8h | ⏳ |
| P1 | 工作流引擎 | 审核流程 | 8h | ⏳ |
| P1 | 版本控制 | 内容版本管理 | 6h | ⏳ |

### 9.3 Phase 3: 高级功能（规划中 📋）

**时间**: 2026-03-21 ~ 2026-04-10  
**状态**: 待开发

| 优先级 | 模块 | 功能 | 预计工时 |
|--------|------|------|----------|
| P2 | GraphQL | GraphQL API | 12h |
| P2 | Webhook | 事件通知 | 6h |
| P2 | 监控日志 | 完整监控体系 | 8h |
| P3 | 多语言 | i18n 支持 | 8h |
| P3 | 模板系统 | 内容模板 | 10h |
| P3 | SDK | 多语言 SDK | 16h |

### 9.4 里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| **v1.0.0** | 2026-03-13 | 基础功能完成 |
| **v1.1.0** | 2026-03-20 | 权限系统 + 工作流 |
| **v1.2.0** | 2026-03-27 | GraphQL + Webhook |
| **v2.0.0** | 2026-04-10 | 完整 Directus 功能 |

---

## 📎 附录

### A. 术语表

| 术语 | 说明 |
|------|------|
| **Tenant** | 租户，多租户系统中的独立组织 |
| **Collection** | 集合，数据模型的容器 |
| **Field** | 字段，数据模型的属性 |
| **Relation** | 关联，集合之间的关系 |
| **RBAC** | Role-Based Access Control，基于角色的访问控制 |

### B. 参考文档

- [Directus 官方文档](https://docs.directus.io)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers)
- [Vue 3 文档](https://vuejs.org)
- [Hono 文档](https://hono.dev)

### C. 版本历史

| 版本 | 时间 | 说明 |
|------|------|------|
| v0.1.0 | 2026-03-12 | 项目启动 |
| v1.0.0 | 2026-03-13 | 基础功能完成 |
| v1.1.0 | 2026-03-20 | 计划发布 |

---

**文档状态**: ✅ 已完成  
**评审人**: 欧阳浩  
**下次更新**: 2026-03-20

---

_简洁，高效，解决问题。有事直接吩咐，老板！🫡_
