import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * 版本控制数据库 Schema
 * 用于内容版本管理、版本比较和版本回滚
 */

// 内容版本表
export const contentVersions = sqliteTable(
  'content_versions',
  {
    id: text('id').primaryKey(),
    dataId: text('data_id').notNull(), // 关联的 content data ID
    collectionId: text('collection_id').notNull(), // 集合 ID
    tenantId: text('tenant_id').notNull(), // 租户 ID
    versionNumber: integer('version_number').notNull(), // 版本号 (1, 2, 3...)
    data: text('data', { mode: 'json' }).notNull(), // 版本数据快照
    changeSummary: text('change_summary'), // 变更说明
    changeType: text('change_type', {
      enum: ['create', 'update', 'rollback', 'auto_save'],
    }).notNull(), // 变更类型
    createdBy: text('created_by'), // 创建人 ID
    createdByEmail: text('created_by_email'), // 创建人邮箱 (冗余字段，便于显示)
    isCurrent: integer('is_current', { mode: 'boolean' }).default(false), // 是否为当前版本
    parentVersionId: text('parent_version_id'), // 父版本 ID (用于回滚溯源)
    metadata: text('metadata', { mode: 'json' }), // 元数据 (diff 信息等)
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    idxDataId: index('idx_content_versions_data').on(table.dataId),
    idxCollection: index('idx_content_versions_collection').on(table.collectionId),
    idxTenant: index('idx_content_versions_tenant').on(table.tenantId),
    idxVersion: index('idx_content_versions_number').on(table.dataId, table.versionNumber),
    idxCurrent: index('idx_content_versions_current').on(table.dataId, table.isCurrent),
    idxCreated: index('idx_content_versions_created').on(table.createdAt),
  }),
)

// 版本比较缓存表 (可选，用于加速频繁的比较操作)
export const versionComparisons = sqliteTable(
  'version_comparisons',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    versionId1: text('version_id_1').notNull(), // 版本 1 ID
    versionId2: text('version_id_2').notNull(), // 版本 2 ID
    diff: text('diff', { mode: 'json' }).notNull(), // 差异数据
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at'), // 过期时间 (可选清理)
  },
  (table) => ({
    idxVersions: index('idx_version_comp_versions').on(table.versionId1, table.versionId2),
    idxTenant: index('idx_version_comp_tenant').on(table.tenantId),
    idxExpires: index('idx_version_comp_expires').on(table.expiresAt),
  }),
)

// 版本自动保存配置表
export const autoVersionConfigs = sqliteTable(
  'auto_version_configs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(), // 租户 ID
    collectionId: text('collection_id'), // 集合 ID (null 表示全局配置)
    enabled: integer('enabled', { mode: 'boolean' }).default(true), // 是否启用自动版本
    autoSaveInterval: integer('auto_save_interval').default(300), // 自动保存间隔 (秒), 默认 5 分钟
    maxVersions: integer('max_versions').default(50), // 最大版本数 (防止无限增长)
    retentionDays: integer('retention_days').default(90), // 版本保留天数
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at'),
  },
  (table) => ({
    idxTenant: index('idx_auto_version_tenant').on(table.tenantId),
    idxCollection: index('idx_auto_version_collection').on(table.collectionId),
    uniqueTenantCollection: index('idx_auto_version_unique').on(table.tenantId, table.collectionId),
  }),
)
