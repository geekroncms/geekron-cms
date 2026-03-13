# D1 数据库表结构清单

**数据库**: geekron-cms-db  
**生成时间**: 2026-03-13 02:20 UTC  
**表总数**: 13  
**索引总数**: 34

---

## 核心业务表

### 1. tenants (租户表)
- **主键**: id (TEXT)
- **字段**: name, subdomain, status, plan, settings, owner_id, created_at, updated_at
- **索引**: idx_tenants_subdomain, idx_tenants_status, idx_tenants_plan, idx_tenants_created
- **说明**: 多租户 SaaS 核心，每个租户独立隔离

### 2. users (用户表)
- **主键**: id (TEXT)
- **字段**: tenant_id, email, name, password_hash, role, status, avatar_url, last_login_at
- **索引**: idx_users_tenant, idx_users_email
- **说明**: 用户账户，通过 tenant_id 关联租户

### 3. models (数据模型表)
- **主键**: id (TEXT)
- **字段**: tenant_id, name, slug, description, fields (JSON), status
- **索引**: idx_models_tenant
- **说明**: 动态数据模型定义，支持自定义字段

### 4. contents (内容表)
- **主键**: id (TEXT)
- **字段**: tenant_id, model_id, title, slug, data (JSON), status, published_at, created_by, updated_by
- **索引**: idx_contents_tenant, idx_contents_model, idx_contents_status
- **说明**: 动态数据存储，根据 model_id 关联模型

### 5. files (文件表)
- **主键**: id (TEXT)
- **字段**: tenant_id, name, url, size, mime_type, storage_type, storage_key, created_by
- **索引**: idx_files_tenant
- **说明**: 文件元数据，实际文件存储在 R2/OSS

### 6. audit_logs (审计日志表)
- **主键**: id (TEXT)
- **字段**: tenant_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent
- **索引**: idx_audit_logs_tenant, idx_audit_logs_user, idx_audit_logs_action, idx_audit_logs_created_at
- **说明**: 操作审计日志，支持安全追溯

---

## 租户管理表

### 7. tenant_members (租户成员表)
- **主键**: id (TEXT)
- **字段**: tenant_id, user_id, role, permissions (JSON), invited_by, status
- **索引**: idx_tenant_members_tenant, idx_tenant_members_user, idx_tenant_members_role
- **说明**: 租户与成员关联，支持多租户多成员

### 8. tenant_quotas (租户配额表)
- **主键**: id (TEXT)
- **字段**: tenant_id, max_requests_per_minute, max_requests_per_day, max_storage_bytes, max_users, max_collections, max_api_keys, plan
- **索引**: idx_tenant_quotas_tenant, idx_tenant_quotas_plan
- **说明**: 租户配额限制，用于限流和资源控制

### 9. tenant_usage (租户使用量表)
- **主键**: id (TEXT)
- **字段**: tenant_id, api_calls, storage_bytes, user_count, reset_date
- **索引**: idx_tenant_usage_tenant, idx_tenant_usage_reset_date
- **说明**: 租户实际使用量统计

### 10. rate_limit_counters (限流计数器表)
- **主键**: id (TEXT)
- **字段**: tenant_id, counter_key, count, expires_at
- **索引**: idx_rate_limit_tenant, idx_rate_limit_expires
- **说明**: 实时限流计数，支持滑动窗口限流

---

## 元数据管理表

### 11. metadata_schemas (元数据 Schema 表)
- **主键**: id (TEXT)
- **字段**: tenant_id, name, version, schema_json, status, created_by
- **索引**: idx_metadata_schemas_tenant, idx_metadata_schemas_status, idx_metadata_schemas_name
- **说明**: JSON Schema 定义，用于数据验证

### 12. metadata_fields (元数据字段表)
- **主键**: id (TEXT)
- **字段**: schema_name, field_name, field_type, required, default_value, validation, order_index
- **索引**: idx_metadata_fields_name, idx_metadata_fields_schema
- **说明**: Schema 字段定义

### 13. metadata_schema_versions (Schema 版本表)
- **主键**: id (TEXT)
- **字段**: schema_name, version, changes, created_at
- **索引**: idx_metadata_versions_schema, idx_metadata_versions_version
- **说明**: Schema 版本历史

---

## 数据关系图

```
tenants (1) ──< (N) users
tenants (1) ──< (N) models
tenants (1) ──< (N) contents
tenants (1) ──< (N) files
tenants (1) ──< (N) audit_logs
tenants (1) ──< (N) tenant_members
tenants (1) ──< (1) tenant_quotas
tenants (1) ──< (1) tenant_usage
tenants (1) ──< (N) rate_limit_counters
tenants (1) ──< (N) metadata_schemas

models (1) ──< (N) contents
users (1) ──< (N) contents (created_by, updated_by)
users (1) ──< (N) tenant_members
```

---

## 初始数据

| 表 | 记录数 | 说明 |
|----|--------|------|
| tenants | 1 | Default Tenant |
| users | 2 | Admin + Sample User |
| models | 1 | Blog Posts 模型 |
| contents | 1 | Hello World 文章 |

---

_清单生成时间：2026-03-13 02:20 UTC_
