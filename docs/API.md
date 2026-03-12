# Geekron CMS API 文档

## 概述

Geekron CMS 提供 RESTful API 用于管理多租户 CMS 系统。

**基础 URL:**
- 生产环境：`https://api.geekron-cms.com`
- 测试环境：`https://staging-api.geekron-cms.com`
- 本地开发：`http://localhost:8787`

## 认证

### JWT Token 认证

大部分 API 需要在请求头中包含 JWT Token：

```
Authorization: Bearer <your_jwt_token>
```

### 获取 Token

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 604800,
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

## API 端点

### 认证

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/auth/register` | 用户注册 |
| POST | `/api/v1/auth/login` | 用户登录 |
| POST | `/api/v1/auth/logout` | 用户登出 |
| POST | `/api/v1/auth/refresh` | 刷新 Token |
| POST | `/api/v1/auth/forgot-password` | 忘记密码 |
| POST | `/api/v1/auth/reset-password` | 重置密码 |

### 租户管理

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/v1/tenants` | 获取租户列表 | Admin |
| POST | `/api/v1/tenants` | 创建租户 | Admin |
| GET | `/api/v1/tenants/:id` | 获取租户详情 | Admin |
| PUT | `/api/v1/tenants/:id` | 更新租户 | Admin |
| DELETE | `/api/v1/tenants/:id` | 删除租户 | Admin |
| POST | `/api/v1/tenants/:id/activate` | 激活租户 | Admin |
| POST | `/api/v1/tenants/:id/suspend` | 暂停租户 | Admin |

### 用户管理

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/v1/users` | 获取用户列表 | Admin |
| POST | `/api/v1/users` | 创建用户 | Admin |
| GET | `/api/v1/users/:id` | 获取用户详情 | Admin/User |
| PUT | `/api/v1/users/:id` | 更新用户 | Admin/User |
| DELETE | `/api/v1/users/:id` | 删除用户 | Admin |
| PUT | `/api/v1/users/:id/password` | 修改密码 | User |
| PUT | `/api/v1/users/:id/role` | 修改角色 | Admin |

### 内容管理

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/v1/content` | 获取内容列表 | User |
| POST | `/api/v1/content` | 创建内容 | User |
| GET | `/api/v1/content/:id` | 获取内容详情 | User |
| PUT | `/api/v1/content/:id` | 更新内容 | User |
| DELETE | `/api/v1/content/:id` | 删除内容 | User |
| POST | `/api/v1/content/:id/publish` | 发布内容 | User |
| POST | `/api/v1/content/:id/unpublish` | 取消发布 | User |

### 数据模型

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/v1/models` | 获取模型列表 | Admin |
| POST | `/api/v1/models` | 创建模型 | Admin |
| GET | `/api/v1/models/:id` | 获取模型详情 | Admin |
| PUT | `/api/v1/models/:id` | 更新模型 | Admin |
| DELETE | `/api/v1/models/:id` | 删除模型 | Admin |
| POST | `/api/v1/models/:id/fields` | 添加字段 | Admin |

### 文件存储

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| POST | `/api/v1/files/upload` | 上传文件 | User |
| GET | `/api/v1/files` | 获取文件列表 | User |
| GET | `/api/v1/files/:id` | 获取文件详情 | User |
| DELETE | `/api/v1/files/:id` | 删除文件 | User |
| GET | `/api/v1/files/:id/url` | 获取文件 URL | User |

## 请求/响应示例

### 创建租户

**请求:**

```http
POST /api/v1/tenants
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "示例公司",
  "subdomain": "example-company",
  "plan": "pro",
  "settings": {
    "timezone": "Asia/Shanghai",
    "language": "zh-CN"
  }
}
```

**响应:**

```json
{
  "success": true,
  "data": {
    "id": "tenant_abc123",
    "name": "示例公司",
    "subdomain": "example-company",
    "status": "active",
    "plan": "pro",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      {
        "field": "name",
        "message": "名称不能为空"
      }
    ]
  }
}
```

## 错误码

| 错误码 | 描述 |
|--------|------|
| `UNAUTHORIZED` | 未授权访问 |
| `FORBIDDEN` | 禁止访问 |
| `NOT_FOUND` | 资源不存在 |
| `VALIDATION_ERROR` | 参数验证失败 |
| `CONFLICT` | 资源冲突 |
| `RATE_LIMIT_EXCEEDED` | 请求频率超限 |
| `INTERNAL_ERROR` | 服务器内部错误 |

## 分页

列表接口支持分页查询：

```
GET /api/v1/users?page=1&limit=20&orderBy=createdAt&order=desc
```

参数：
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 20，最大 100）
- `orderBy`: 排序字段
- `order`: 排序方向（asc/desc）

响应包含分页信息：

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## 速率限制

API 实施速率限制：

- 普通用户：100 请求/分钟
- 管理员：500 请求/分钟
- 企业用户：1000 请求/分钟

超限后返回 `429 Too Many Requests`。

## Webhooks

支持配置 Webhooks 接收事件通知：

```json
{
  "event": "tenant.created",
  "data": {
    "id": "tenant_abc123",
    "name": "示例公司"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

支持的事件类型：
- `tenant.created` - 租户创建
- `tenant.deleted` - 租户删除
- `user.created` - 用户创建
- `content.published` - 内容发布
- `content.updated` - 内容更新

---

**最后更新:** 2026-03-12
**API 版本:** v1
