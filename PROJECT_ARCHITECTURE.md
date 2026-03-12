# Geekron CMS - 完整项目架构文档

> 本文档包含 Geekron CMS 项目的完整架构设计、技术栈、功能需求、开发计划等所有细节，供开发团队和 AI Agent 使用。

**文档版本：** v1.0  
**最后更新：** 2026-03-12  
**项目状态：** 阶段一完成 (1/7)

---

## 📋 目录

1. [项目概述](#1-项目概述)
2. [架构设计](#2-架构设计)
3. [技术栈](#3-技术栈)
4. [功能需求](#4-功能需求)
5. [数据库设计](#5-数据库设计)
6. [API 设计](#6-api-设计)
7. [开发计划](#7-开发计划)
8. [部署方案](#8-部署方案)
9. [开发规范](#9-开发规范)
10. [测试策略](#10-测试策略)
11. [项目结构](#11-项目结构)
12. [Agent 协作指南](#12-agent-协作指南)

---

## 1. 项目概述

### 1.1 项目定位

**Geekron CMS** 是一款基于 Cloudflare Workers 的**多租户 SaaS CMS 系统**，参考 Directus 的设计理念，提供可视化数据模型管理和动态 API 生成能力。

### 1.2 核心价值

- **低成本部署**：利用 Cloudflare Workers 边缘计算，降低服务器成本
- **数据自主可控**：用户数据存储在自有数据库，Cloudflare 仅作计算层
- **多租户架构**：一套系统服务多个租户，数据严格隔离
- **动态模型**：租户可自定义数据模型，无需代码开发
- **混合存储**：D1（租户数据）+ PostgreSQL（索引/元数据）+ R2（文件存储）

### 1.3 目标用户

- 中小企业：快速搭建内容管理系统
- 开发者：需要灵活的数据模型和 API
- SaaS 服务商：多租户内容管理平台

### 1.4 项目信息

| 项目 | 信息 |
|------|------|
| **项目名称** | Geekron CMS |
| **GitHub** | https://github.com/geekroncms/geekron-cms |
| **本地路径** | `/root/.openclaw/workspace/geekron-cms` |
| **组织** | GeekronCMS |
| **License** | MIT |

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    客户端层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  管理后台    │  │  移动端 APP  │  │  第三方客户端 │      │
│  │  (Vue3)     │  │  (SDK)      │  │  (API)      │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 Cloudflare 边缘层                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Workers   │  │    Pages    │  │    D1       │      │
│  │  (API 路由)  │  │  (静态资源)  │  │  边缘缓存   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                          │                                │
│                    ┌─────┴─────┐                          │
│                    │   R2      │                          │
│                    │ (文件存储) │                          │
│                    └───────────┘                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  自有数据层 (可控)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  PostgreSQL │  │    Redis    │  │  对象存储    │      │
│  │  (索引/元数据)│  │  (会话缓存)  │  │  (备份)     │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流架构

```
用户请求
   │
   ▼
┌─────────────────┐
│  API Gateway    │ ← JWT 认证 + 租户识别
│  (Hono Router)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tenant Context │ ← 注入 tenant_id
│  Middleware     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Business Logic │
│  (CRUD/验证)    │
└────────┬────────┘
         │
         ├──────────────┐
         │              │
         ▼              ▼
┌─────────────┐  ┌─────────────┐
│  D1 数据库   │  │  同步触发器  │
│  (租户数据)  │  │             │
└─────────────┘  └──────┬──────┘
                        │
                        ▼
                 ┌─────────────┐
                 │ PostgreSQL  │
                 │ (索引/搜索)  │
                 └─────────────┘
```

### 2.3 多租户隔离架构

**隔离级别：** 共享数据库 + `tenant_id` 字段隔离

```sql
-- 所有租户数据表都包含 tenant_id 字段
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,  -- 租户隔离字段
  name TEXT NOT NULL,
  ...
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 中间件自动注入 tenant_id
-- 所有查询自动添加 WHERE tenant_id = ?
```

**数据同步策略：**

| 数据类型 | 主存储 | 同步到 PG | 同步方式 |
|----------|--------|-----------|----------|
| 租户配置 | D1 | ✅ 完整 | 实时触发器 |
| 用户数据 | D1 | ✅ 完整 | 实时触发器 |
| 内容数据 | D1 | ⚠️ 仅索引 | 异步队列 |
| 文件元数据 | D1 | ✅ 完整 | 实时触发器 |
| 审计日志 | D1 | ✅ 完整 | 异步批量 |

---

## 3. 技术栈

### 3.1 后端技术栈

| 技术 | 选型 | 用途 |
|------|------|------|
| **Runtime** | Bun | JavaScript 运行时 |
| **Framework** | Hono | Web 框架（CF Workers 兼容） |
| **ORM** | Drizzle ORM | 数据库 ORM |
| **验证** | Zod | Schema 验证 |
| **认证** | JWT (jose) | Token 生成/验证 |
| **密码** | bcryptjs | 密码哈希 |
| **测试** | Bun Test | 单元测试框架 |

### 3.2 前端技术栈

| 技术 | 选型 | 用途 |
|------|------|------|
| **Framework** | Vue 3.4 | 前端框架 |
| **语言** | TypeScript | 类型系统 |
| **状态管理** | Pinia | 状态管理 |
| **路由** | Vue Router 4 | 路由管理 |
| **构建工具** | Vite 5 | 构建工具 |
| **UI 组件** | 自研 Base 组件 | 基础组件库 |
| **样式** | TailwindCSS | CSS 框架 |
| **HTTP** | Axios | API 客户端 |

### 3.3 数据库技术栈

| 技术 | 选型 | 用途 |
|------|------|------|
| **边缘数据库** | Cloudflare D1 | 租户数据存储 |
| **主数据库** | Supabase PostgreSQL | 索引/元数据 |
| **缓存** | Redis | 会话/缓存 |
| **对象存储** | Cloudflare R2 | 文件存储 |
| **备份存储** | 自有 OSS | 数据备份 |

### 3.4 基础设施

| 技术 | 选型 | 用途 |
|------|------|------|
| **部署平台** | Cloudflare Workers | 边缘计算 |
| **静态托管** | Cloudflare Pages | 前端托管 |
| **CI/CD** | GitHub Actions | 自动化部署 |
| **容器** | Docker | 本地开发环境 |
| **监控** | 自定义日志 | 错误追踪 |

---

## 4. 功能需求

### 4.1 核心功能模块

#### 4.1.1 租户管理

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 租户创建 | 注册新租户，分配唯一 ID | P0 |
| 租户配置 | 修改租户名称、域名、设置 | P0 |
| 租户状态 | 激活/暂停/删除租户 | P0 |
| 租户配额 | 请求限制、存储空间限制 | P1 |
| 租户迁移 | 数据导出/导入 | P1 |

#### 4.1.2 用户认证

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 用户注册 | 邮箱 + 密码注册 | P0 |
| 用户登录 | JWT Token 认证 | P0 |
| 密码管理 | 重置、修改密码 | P0 |
| 角色系统 | owner/admin/editor/viewer | P0 |
| 权限控制 | 基于角色的访问控制 | P0 |
| API Keys | 租户级 API 密钥管理 | P1 |

#### 4.1.3 数据模型管理

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 模型创建 | 可视化创建数据模型 | P0 |
| 字段管理 | 添加/编辑/删除字段 | P0 |
| 字段类型 | text/number/boolean/date/json/relation | P0 |
| 关系管理 | 一对多、多对多关系 | P1 |
| 验证规则 | 必填、唯一、默认值 | P1 |
| 模型导入/导出 | JSON Schema 导入导出 | P2 |

#### 4.1.4 内容管理

| 功能 | 描述 | 优先级 |
|------|------|--------|
| CRUD 操作 | 创建/读取/更新/删除 | P0 |
| 列表查询 | 分页、排序、过滤 | P0 |
| 高级过滤 | JSON 过滤、关系过滤 | P1 |
| 批量操作 | 批量创建/更新/删除 | P1 |
| 数据验证 | 自动验证字段类型和规则 | P0 |
| 版本控制 | 数据版本历史 | P2 |

#### 4.1.5 文件管理

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 文件上传 | 单文件/多文件上传 | P1 |
| 文件存储 | R2 对象存储 | P1 |
| 文件分类 | 文件夹/标签管理 | P2 |
| 图片处理 | 缩放、裁剪、压缩 | P2 |
| CDN 加速 | Cloudflare CDN | P1 |

#### 4.1.6 系统功能

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 审计日志 | 记录所有关键操作 | P1 |
| Webhook | 事件触发外部回调 | P2 |
| 数据备份 | 定时备份到自有存储 | P1 |
| 数据导出 | JSON/SQL/CSV格式 | P1 |
| API 文档 | 自动生成 OpenAPI 文档 | P2 |
| 使用分析 | 访问量、API 调用统计 | P2 |

### 4.2 管理后台功能

| 页面 | 功能 | 优先级 |
|------|------|--------|
| **登录页** | 邮箱密码登录、Token 持久化 | P0 |
| **Dashboard** | 数据统计、快速操作入口 | P0 |
| **数据模型** | 模型列表、创建、编辑、删除 | P0 |
| **模型详情** | 字段管理、关系配置 | P0 |
| **内容管理** | 数据列表、表单、搜索 | P0 |
| **用户管理** | 用户列表、角色分配 | P1 |
| **设置** | 租户配置、API Key 管理 | P1 |

---

## 5. 数据库设计

### 5.1 D1 Schema (租户数据)

```sql
-- 租户表
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  plan TEXT DEFAULT 'free',  -- free/pro/enterprise
  status TEXT DEFAULT 'active',  -- active/suspended/deleted
  settings TEXT,  -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'viewer',  -- owner/admin/editor/viewer
  status TEXT DEFAULT 'active',  -- active/inactive/banned
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 集合（数据模型）表
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 集合字段定义表
CREATE TABLE collection_fields (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- text/number/boolean/date/json/relation
  required INTEGER DEFAULT 0,
  unique INTEGER DEFAULT 0,
  default_value TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (collection_id) REFERENCES collections(id)
);

-- 动态数据表（租户自定义内容）
CREATE TABLE collection_data (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  data TEXT NOT NULL,  -- JSON
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (collection_id) REFERENCES collections(id)
);

-- API Keys 表
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  permissions TEXT,  -- JSON
  expires_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 审计日志表
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,  -- JSON
  ip_address TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 文件表
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  r2_key TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 索引
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_collections_tenant ON collections(tenant_id);
CREATE INDEX idx_collection_fields_collection ON collection_fields(collection_id);
CREATE INDEX idx_collection_data_tenant ON collection_data(tenant_id);
CREATE INDEX idx_collection_data_collection ON collection_data(collection_id);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

### 5.2 PostgreSQL Schema (索引/元数据)

```sql
-- 租户索引表
CREATE TABLE tenants_index (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户索引表
CREATE TABLE users_index (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'viewer',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants_index(id)
);

-- 集合索引表
CREATE TABLE collections_index (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  field_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants_index(id)
);

-- 字段索引表
CREATE TABLE collection_fields_index (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES collections_index(id)
);

-- 审计日志表
CREATE TABLE audit_logs_index (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants_index(id)
);

-- 同步队列表
CREATE TABLE sync_queue (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- INSERT/UPDATE/DELETE
  data JSONB,
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP
);

-- 索引
CREATE INDEX idx_users_index_tenant ON users_index(tenant_id);
CREATE INDEX idx_collections_index_tenant ON collections_index(tenant_id);
CREATE INDEX idx_audit_logs_index_tenant ON audit_logs_index(tenant_id);
CREATE INDEX idx_audit_logs_index_created ON audit_logs_index(created_at);
CREATE INDEX idx_sync_queue_synced ON sync_queue(synced);
```

### 5.3 数据字典

| 表名 | 用途 | 存储位置 | 同步策略 |
|------|------|----------|----------|
| `tenants` | 租户信息 | D1 | 实时同步到 PG |
| `users` | 用户信息 | D1 | 实时同步到 PG |
| `collections` | 数据模型定义 | D1 | 实时同步到 PG |
| `collection_fields` | 字段定义 | D1 | 实时同步到 PG |
| `collection_data` | 动态内容数据 | D1 | 仅索引同步 |
| `api_keys` | API 密钥 | D1 | 实时同步到 PG |
| `audit_logs` | 审计日志 | D1 | 异步批量同步 |
| `files` | 文件元数据 | D1 | 实时同步到 PG |
| `sync_queue` | 同步队列 | PG | 仅 PG |

---

## 6. API 设计

### 6.1 API 规范

**基础 URL：** `https://api.geekron-cms.com/api/v1`

**认证方式：**
- Header: `Authorization: Bearer <JWT_TOKEN>`
- Header: `X-Tenant-ID: <TENANT_ID>`

**响应格式：**
```json
{
  "data": {},
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100
  },
  "error": null
}
```

### 6.2 端点列表

#### 6.2.1 认证相关

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/auth/register` | 用户注册 | ❌ |
| POST | `/auth/login` | 用户登录 | ❌ |
| POST | `/auth/logout` | 用户登出 | ✅ |
| GET | `/auth/me` | 获取当前用户 | ✅ |
| PUT | `/auth/password` | 修改密码 | ✅ |

#### 6.2.2 租户相关

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/tenants` | 创建租户 | ❌ |
| GET | `/tenants/me` | 获取当前租户 | ✅ |
| PUT | `/tenants/me` | 更新租户配置 | ✅ |
| DELETE | `/tenants/me` | 删除租户 | ✅ |

#### 6.2.3 用户相关

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/users` | 用户列表 | ✅ |
| POST | `/users` | 创建用户 | ✅ |
| GET | `/users/:id` | 获取用户详情 | ✅ |
| PUT | `/users/:id` | 更新用户 | ✅ |
| DELETE | `/users/:id` | 删除用户 | ✅ |

#### 6.2.4 数据模型相关

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/collections` | 模型列表 | ✅ |
| POST | `/collections` | 创建模型 | ✅ |
| GET | `/collections/:id` | 模型详情 | ✅ |
| PUT | `/collections/:id` | 更新模型 | ✅ |
| DELETE | `/collections/:id` | 删除模型 | ✅ |
| POST | `/collections/:id/fields` | 添加字段 | ✅ |
| DELETE | `/collections/:id/fields/:fieldId` | 删除字段 | ✅ |

#### 6.2.5 内容数据相关

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/data/:collection` | 数据列表 | ✅ |
| POST | `/data/:collection` | 创建数据 | ✅ |
| GET | `/data/:collection/:id` | 数据详情 | ✅ |
| PUT | `/data/:collection/:id` | 更新数据 | ✅ |
| DELETE | `/data/:collection/:id` | 删除数据 | ✅ |
| POST | `/data/:collection/bulk` | 批量操作 | ✅ |

#### 6.2.6 API Key 相关

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api-keys` | 密钥列表 | ✅ |
| POST | `/api-keys` | 创建密钥 | ✅ |
| DELETE | `/api-keys/:id` | 删除密钥 | ✅ |
| POST | `/api-keys/:id/rotate` | 轮换密钥 | ✅ |

#### 6.2.7 文件相关

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/files` | 文件列表 | ✅ |
| POST | `/files` | 上传文件 | ✅ |
| GET | `/files/:id` | 文件详情 | ✅ |
| DELETE | `/files/:id` | 删除文件 | ✅ |
| GET | `/files/:id/download` | 下载文件 | ✅ |

#### 6.2.8 系统相关

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/health` | 健康检查 | ❌ |
| GET | `/health/ready` | 就绪检查 | ❌ |
| GET | `/audit-logs` | 审计日志 | ✅ |
| POST | `/webhooks` | 创建 Webhook | ✅ |
| GET | `/export/:collection` | 导出数据 | ✅ |

---

## 7. 开发计划

### 7.1 阶段总览

| 阶段 | 名称 | 状态 | 工时估算 |
|------|------|------|----------|
| **阶段一** | 基础设施搭建 | ✅ 完成 | 20 人天 |
| **阶段二** | 多租户核心架构 | 🔄 待开始 | 9 人天 |
| **阶段三** | 数据模型引擎 | ⏳ 待开始 | 12 人天 |
| **阶段四** | 管理后台完善 | ⏳ 待开始 | 12 人天 |
| **阶段五** | 数据控制与迁移 | ⏳ 待开始 | 11 人天 |
| **阶段六** | 高级功能 | ⏳ 待开始 | 11 人天 |
| **阶段七** | 测试与上线 | ⏳ 待开始 | 9 人天 |
| **总计** | - | - | **84 人天** |

### 7.2 阶段一：基础设施搭建（✅ 已完成）

**完成时间：** 2026-03-12  
**完成度：** 100%

**任务清单：**

| 任务 | 状态 | 输出物 |
|------|------|--------|
| Monorepo 项目结构 | ✅ | packages/server, packages/admin, packages/sdk |
| 后端 API 服务器 | ✅ | Bun + Hono, 30+ 端点 |
| 前端管理后台 | ✅ | Vue3 + TypeScript, 基础页面 |
| 数据库 Schema | ✅ | D1 + PostgreSQL |
| Cloudflare 配置 | ✅ | wrangler.toml |
| CI/CD 工作流 | ✅ | GitHub Actions |
| 单元测试 | ✅ | 88% 通过率 |
| 文档 | ✅ | README, API 文档 |

**代码统计：**
- 文件数：110 个
- 代码行数：16,761+ 行
- GitHub：已推送

### 7.3 阶段二：多租户核心架构（🔄 待开始）

**预计工时：** 9 人天

**任务清单：**

| 优先级 | 任务 | 负责人 | 工时 | 依赖 |
|--------|------|--------|------|------|
| P0 | 租户管理系统 | 后端组 | 2 天 | - |
| P0 | 用户认证系统 | 后端组 | 2 天 | - |
| P0 | 数据隔离中间件 | 后端组 | 1 天 | - |
| P1 | API Key 管理 | 后端组 | 2 天 | - |
| P1 | 租户配额系统 | 后端组 | 2 天 | - |

**验收标准：**
- [ ] 租户可独立注册和配置
- [ ] JWT Token 包含租户上下文
- [ ] 所有查询自动注入 tenant_id
- [ ] API Key 可生成和验证
- [ ] 限流中间件生效

### 7.4 阶段三：数据模型引擎（⏳ 待开始）

**预计工时：** 12 人天

**任务清单：**

| 优先级 | 任务 | 负责人 | 工时 | 依赖 |
|--------|------|--------|------|------|
| P0 | 元数据管理系统 | 后端组 | 3 天 | 阶段二 |
| P0 | 动态 CRUD API | 后端组 | 3 天 | 元数据管理 |
| P0 | 字段类型系统 | 后端组 | 2 天 | - |
| P1 | 关系管理 | 后端组 | 2 天 | - |
| P1 | 数据验证引擎 | 后端组 | 2 天 | - |

**验收标准：**
- [ ] 租户可创建自定义数据模型
- [ ] 自动生成 CRUD API 端点
- [ ] 支持所有字段类型
- [ ] 关系查询正常工作
- [ ] 数据验证生效

### 7.5 阶段四：管理后台完善（⏳ 待开始）

**预计工时：** 12 人天

**任务清单：**

| 优先级 | 任务 | 负责人 | 工时 | 依赖 |
|--------|------|--------|------|------|
| P0 | 数据模型配置界面 | 前端组 | 3 天 | 阶段三 |
| P0 | 内容管理界面 | 前端组 | 4 天 | 阶段三 |
| P1 | 用户/权限管理 | 前端组 | 2 天 | 阶段二 |
| P1 | API Key 管理界面 | 前端组 | 1 天 | 阶段二 |
| P2 | 租户管理界面 | 前端组 | 2 天 | - |

**验收标准：**
- [ ] 可视化创建数据模型
- [ ] 内容列表、表单、搜索正常
- [ ] 用户管理界面完整
- [ ] 响应式设计
- [ ] 加载状态和错误处理

### 7.6 阶段五：数据控制与迁移（⏳ 待开始）

**预计工时：** 11 人天

**任务清单：**

| 优先级 | 任务 | 负责人 | 工时 | 依赖 |
|--------|------|--------|------|------|
| P0 | 数据导出功能 | 后端组 | 2 天 | - |
| P0 | 数据备份系统 | 后端组 | 2 天 | - |
| P1 | 数据迁移工具 | 后端组 | 3 天 | - |
| P1 | 操作审计日志 | 后端组 | 2 天 | - |
| P1 | 数据加密 | 后端组 | 2 天 | - |

**验收标准：**
- [ ] 支持 JSON/SQL/CSV 导出
- [ ] 定时备份正常运行
- [ ] 数据迁移流程完整
- [ ] 审计日志记录完整
- [ ] 敏感字段加密存储

### 7.7 阶段六：高级功能（⏳ 待开始）

**预计工时：** 11 人天

**任务清单：**

| 优先级 | 任务 | 负责人 | 工时 | 依赖 |
|--------|------|--------|------|------|
| P1 | 文件管理 | 后端组 | 3 天 | - |
| P1 | Webhook 系统 | 后端组 | 2 天 | - |
| P2 | 自动化工作流 | 后端组 | 3 天 | Webhook |
| P2 | API 文档生成 | 后端组 | 1 天 | - |
| P2 | 使用分析 | 后端组 | 2 天 | - |

**验收标准：**
- [ ] 文件上传下载正常
- [ ] Webhook 触发正常
- [ ] 工作流可配置
- [ ] API 文档自动生成
- [ ] 统计数据准确

### 7.8 阶段七：测试与上线（⏳ 待开始）

**预计工时：** 9 人天

**任务清单：**

| 优先级 | 任务 | 负责人 | 工时 | 依赖 |
|--------|------|--------|------|------|
| P0 | 多租户隔离测试 | 测试组 | 2 天 | 全部完成 |
| P0 | 性能压测 | 测试组 | 2 天 | 全部完成 |
| P0 | 安全审计 | 测试组 | 2 天 | 全部完成 |
| P1 | 文档完善 | 文档组 | 2 天 | - |
| P1 | 部署演练 | DevOps | 1 天 | - |

**验收标准：**
- [ ] 租户数据完全隔离
- [ ] 性能满足要求（<100ms P95）
- [ ] 无高危安全漏洞
- [ ] 文档完整准确
- [ ] 生产部署成功

---

## 8. 部署方案

### 8.1 环境配置

| 环境 | 用途 | 域名 | 数据库 |
|------|------|------|--------|
| **Development** | 本地开发 | localhost | 本地 D1 + PG |
| **Staging** | 测试环境 | staging.api.geekron-cms.com | CF D1 + Supabase |
| **Production** | 生产环境 | api.geekron-cms.com | CF D1 + Supabase |

### 8.2 Cloudflare 配置

**wrangler.toml：**
```toml
name = "geekron-cms"
main = "packages/server/src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# D1 数据库
[[d1_databases]]
binding = "DB"
database_name = "geekron-cms-db"
database_id = "<D1_DATABASE_ID>"

# R2 存储
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "geekron-cms-files"

# KV 存储（会话/缓存）
[[kv_namespaces]]
binding = "KV"
id = "<KV_NAMESPACE_ID>"

# 环境变量
[vars]
ENVIRONMENT = "production"
API_BASE_URL = "https://api.geekron-cms.com"
SUPABASE_URL = "https://xxx.supabase.co"
SUPABASE_KEY = "<SUPABASE_ANON_KEY>"
JWT_SECRET = "<JWT_SECRET>"

# 多环境配置
[env.staging]
name = "geekron-cms-staging"
database_id = "<STAGING_D1_ID>"

[env.production]
name = "geekron-cms-production"
database_id = "<PROD_D1_ID>"
```

### 8.3 部署流程

```bash
# 1. 安装依赖
bun install

# 2. 构建
bun run build

# 3. 数据库迁移
bun run db:migrate

# 4. 部署到 Staging
wrangler deploy --env staging

# 5. 部署到 Production
wrangler deploy --env production

# 6. 前端部署
cd packages/admin
bun run build
# 上传到 Cloudflare Pages
```

### 8.4 CI/CD 流程

**GitHub Actions 工作流：**

| 工作流 | 触发条件 | 操作 |
|--------|----------|------|
| **CI** | PR/Push | 测试 + 构建 |
| **Release** | Tag 推送 | 构建 + 部署 Staging |
| **Deploy Production** | Manual | 部署 Production |
| **Migrations** | Manual | 数据库迁移 |

---

## 9. 开发规范

### 9.1 代码规范

**目录结构：**
```
packages/server/src/
├── index.ts           # 入口文件
├── routes/            # 路由处理器
├── middleware/        # 中间件
├── db/                # 数据库相关
├── utils/             # 工具函数
├── types/             # 类型定义
└── sync/              # 同步逻辑

packages/admin/src/
├── main.ts            # 入口文件
├── views/             # 页面组件
├── components/        # 通用组件
├── stores/            # Pinia stores
├── router/            # 路由配置
├── api/               # API 客户端
└── styles/            # 样式文件
```

**命名规范：**
- 文件：kebab-case（`user-routes.ts`）
- 组件：PascalCase（`BaseButton.vue`）
- 函数：camelCase（`getUserById`）
- 常量：UPPER_SNAKE_CASE（`API_BASE_URL`）
- 类型：PascalCase（`UserDTO`）

### 9.2 Git 规范

**分支模型：**
```
main (生产)
  │
  └── develop (开发)
        │
        ├── feature/user-auth
        ├── feature/collections
        └── bugfix/login-error
```

**提交规范（Conventional Commits）：**
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

**示例：**
```bash
git commit -m "feat: add user authentication system"
git commit -m "fix: resolve login token expiration issue"
git commit -m "docs: update API documentation"
```

### 9.3 代码审查

**PR 要求：**
- [ ] 代码通过所有测试
- [ ] 新增功能包含单元测试
- [ ] 代码符合 ESLint 规范
- [ ] 更新相关文档
- [ ] 至少 1 人 Code Review

**Review 检查项：**
- 代码逻辑正确性
- 安全性（SQL 注入、XSS 等）
- 性能影响
- 测试覆盖率
- 文档完整性

---

## 10. 测试策略

### 10.1 测试类型

| 类型 | 工具 | 覆盖率要求 |
|------|------|------------|
| **单元测试** | Bun Test | >80% |
| **集成测试** | Bun Test + Supertest | 核心流程 |
| **E2E 测试** | Playwright | 关键路径 |
| **性能测试** | k6 | P95 < 100ms |
| **安全测试** | OWASP ZAP | 无高危漏洞 |

### 10.2 测试用例示例

**单元测试：**
```typescript
// packages/server/tests/users.test.ts
import { describe, it, expect } from 'bun:test';

describe('User Routes', () => {
  it('should register a new user successfully', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      }),
    });
    
    expect(res.status).toBe(201);
  });
});
```

### 10.3 测试命令

```bash
# 运行所有测试
bun test

# 运行特定测试
bun test users.test.ts

# 生成覆盖率报告
bun test --coverage
```

---

## 11. 项目结构

### 11.1 完整目录树

```
geekron-cms/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── release.yml
│   │   └── migrations.yml
│   └── pull_request_template.md
├── docker/
│   └── Dockerfile
├── docs/
│   ├── API.md
│   └── openapi.yaml
├── infra/
│   ├── migrations/
│   │   ├── 001_initial.sql
│   │   └── 002_sync_triggers.sql
│   └── README.md
├── packages/
│   ├── admin/
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── router/
│   │   │   ├── stores/
│   │   │   ├── styles/
│   │   │   ├── views/
│   │   │   ├── App.vue
│   │   │   └── main.ts
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   ├── server/
│   │   ├── src/
│   │   │   ├── db/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── sync/
│   │   │   ├── types/
│   │   │   ├── utils/
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── sdk/
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── scripts/
│   ├── backup-d1.sh
│   ├── backup-postgres.sh
│   ├── deploy.sh
│   ├── init-d1.sh
│   └── seed-data.sh
├── docker-compose.yml
├── package.json
├── README.md
├── wrangler.toml
└── tsconfig.json
```

### 11.2 关键文件说明

| 文件 | 用途 |
|------|------|
| `packages/server/src/index.ts` | 后端入口，Hono 应用 |
| `packages/admin/src/main.ts` | 前端入口，Vue 应用 |
| `wrangler.toml` | Cloudflare Workers 配置 |
| `infra/migrations/` | 数据库迁移脚本 |
| `scripts/` | 部署和工具脚本 |

---

## 12. Agent 协作指南

### 12.1 Agent 角色定义

| 角色 | 职责 | 技能要求 |
|------|------|----------|
| **后端 Agent** | API 开发、数据库设计、中间件 | Bun, Hono, SQL, Drizzle |
| **前端 Agent** | UI 开发、组件库、状态管理 | Vue3, TypeScript, Pinia |
| **数据库 Agent** | Schema 设计、迁移、同步 | D1, PostgreSQL, 触发器 |
| **DevOps Agent** | 部署配置、CI/CD、监控 | Cloudflare, GitHub Actions |
| **测试 Agent** | 单元测试、集成测试、E2E | Bun Test, Playwright |

### 12.2 任务分配流程

```
1. 项目经理创建任务
   ↓
2. 分配给对应 Agent
   ↓
3. Agent 执行任务
   ↓
4. 完成后群里汇报
   ↓
5. Code Review
   ↓
6. 合并到 develop 分支
```

### 12.3 汇报模板

**任务完成汇报：**
```markdown
## 📢 [阶段 X] 任务完成汇报

### ✅ 完成任务
- [任务 1]
- [任务 2]

### 📦 输出物
- 文件列表
- 代码统计

### ⚠️ 问题（如有）
- 问题描述
- 解决方案

### ➡️ 下一步
- 后续计划
```

### 12.4 沟通规范

**在群里沟通时：**
- 使用清晰的标题
- 附上相关文件路径
- 代码片段用代码块
- 错误信息附完整日志
- @相关人员时说明原因

---

## 附录

### A. 环境变量清单

| 变量名 | 用途 | 示例 |
|--------|------|------|
| `JWT_SECRET` | JWT 签名密钥 | `your-secret-key` |
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Supabase 匿名密钥 | `eyJhbG...` |
| `API_BASE_URL` | API 基础 URL | `https://api.geekron-cms.com` |
| `ENVIRONMENT` | 环境标识 | `development/staging/production` |

### B. 端口清单

| 服务 | 端口 | 用途 |
|------|------|------|
| 后端开发服务器 | 8787 | Hono dev server |
| 前端开发服务器 | 5173 | Vite dev server |
| PostgreSQL | 5432 | 数据库 |
| Redis | 6379 | 缓存 |
| MinIO | 9000/9001 | 对象存储 |

### C. 参考资源

- **Cloudflare Workers 文档**: https://developers.cloudflare.com/workers/
- **Hono 文档**: https://hono.dev/
- **Vue 3 文档**: https://vuejs.org/
- **Drizzle ORM 文档**: https://orm.drizzle.team/
- **Directus**: https://directus.io/ (参考设计)

---

**文档结束**

*最后更新：2026-03-12*  
*维护者：GeekronCMS 开发团队*
