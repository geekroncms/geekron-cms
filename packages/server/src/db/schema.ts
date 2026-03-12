import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * D1 数据库 Schema (SQLite)
 * 租户数据存储
 * 
 * 索引说明：
 * - 所有外键字段都创建了索引以优化查询性能
 * - 常用查询字段（status, email, slug 等）都创建了索引
 * - 审计日志表创建了时间范围查询索引
 */

// 租户表
export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  email: text('email').notNull(),
  plan: text('plan', { enum: ['free', 'pro', 'enterprise'] }).default('free'),
  status: text('status', { enum: ['active', 'suspended', 'deleted'] }).default('active'),
  settings: text('settings', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (table) => ({
  idxSlug: index('idx_tenants_slug').on(table.slug),
  idxStatus: index('idx_tenants_status').on(table.status),
  idxPlan: index('idx_tenants_plan').on(table.plan),
  idxCreated: index('idx_tenants_created').on(table.createdAt),
}));

// 用户表
// 注意：用户不再直接关联租户，而是通过 tenant_members 表实现多对多关系
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'editor', 'viewer'] }).default('viewer'),
  status: text('status', { enum: ['active', 'inactive', 'banned'] }).default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (table) => ({
  idxEmail: index('idx_users_email').on(table.email),
  idxStatus: index('idx_users_status').on(table.status),
  idxRole: index('idx_users_role').on(table.role),
}));

// 租户成员表（多对多关系：一个用户可以属于多个租户）
export const tenantMembers = sqliteTable('tenant_members', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'editor', 'viewer'] }).default('viewer'),
  permissions: text('permissions', { mode: 'json' }), // 自定义权限覆盖
  invitedBy: text('invited_by'),
  status: text('status', { enum: ['active', 'invited', 'suspended'] }).default('active'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxTenant: index('idx_tenant_members_tenant').on(table.tenantId),
  idxUser: index('idx_tenant_members_user').on(table.userId),
  idxRole: index('idx_tenant_members_role').on(table.role),
  idxStatus: index('idx_tenant_members_status').on(table.status),
  uniqueTenantUser: index('idx_tenant_members_unique').on(table.tenantId, table.userId),
}));

// 集合（数据模型）表
export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  schema: text('schema', { mode: 'json' }),
  isSystem: integer('is_system', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (table) => ({
  idxTenant: index('idx_collections_tenant').on(table.tenantId),
  idxSlug: index('idx_collections_slug').on(table.slug),
  idxSystem: index('idx_collections_system').on(table.isSystem),
  uniqueTenantSlug: index('idx_collections_tenant_slug').on(table.tenantId, table.slug),
}));

// 集合字段定义表
export const collectionFields = sqliteTable('collection_fields', {
  id: text('id').primaryKey(),
  collectionId: text('collection_id').notNull(),
  name: text('name').notNull(),
  type: text('type', { enum: ['text', 'number', 'boolean', 'date', 'json', 'relation', 'file', 'richtext'] }).notNull(),
  required: integer('required', { mode: 'boolean' }).default(false),
  unique: integer('unique', { mode: 'boolean' }).default(false),
  defaultValue: text('default_value'),
  validation: text('validation', { mode: 'json' }),
  orderIndex: integer('order_index').default(0),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxCollection: index('idx_collection_fields_collection').on(table.collectionId),
  idxType: index('idx_collection_fields_type').on(table.type),
  uniqueCollectionName: index('idx_collection_fields_unique').on(table.collectionId, table.name),
}));

// 动态数据表（租户自定义内容）
export const collectionData = sqliteTable('collection_data', {
  id: text('id').primaryKey(),
  collectionId: text('collection_id').notNull(),
  tenantId: text('tenant_id').notNull(),
  data: text('data', { mode: 'json' }).notNull(),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (table) => ({
  idxTenant: index('idx_collection_data_tenant').on(table.tenantId),
  idxCollection: index('idx_collection_data_collection').on(table.collectionId),
  idxCreated: index('idx_collection_data_created').on(table.createdAt),
}));

// API Keys 表
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  key: text('key').notNull().unique(),
  permissions: text('permissions', { mode: 'json' }),
  expiresAt: text('expires_at'),
  lastUsedAt: text('last_used_at'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxTenant: index('idx_api_keys_tenant').on(table.tenantId),
  idxKey: index('idx_api_keys_key').on(table.key),
  idxExpires: index('idx_api_keys_expires').on(table.expiresAt),
}));

// 审计日志表
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id'),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  details: text('details', { mode: 'json' }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxTenant: index('idx_audit_logs_tenant').on(table.tenantId),
  idxUser: index('idx_audit_logs_user').on(table.userId),
  idxAction: index('idx_audit_logs_action').on(table.action),
  idxResource: index('idx_audit_logs_resource').on(table.resource),
  idxCreated: index('idx_audit_logs_created').on(table.createdAt),
}));

// 文件表
export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  r2Key: text('r2_key'),
  checksum: text('checksum'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  idxTenant: index('idx_files_tenant').on(table.tenantId),
  idxMimeType: index('idx_files_mime_type').on(table.mimeType),
  idxCreated: index('idx_files_created').on(table.createdAt),
}));
