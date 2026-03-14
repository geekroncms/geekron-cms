-- 版本控制系统数据库迁移
-- 创建时间：2026-03-13
-- 说明：添加内容版本管理、版本比较、版本回滚功能

-- 1. 创建内容版本表
CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY,
  data_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  data TEXT NOT NULL,
  change_summary TEXT,
  change_type TEXT NOT NULL CHECK(change_type IN ('create', 'update', 'rollback', 'auto_save')),
  created_by TEXT,
  created_by_email TEXT,
  is_current INTEGER DEFAULT 0 CHECK(is_current IN (0, 1)),
  parent_version_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (data_id) REFERENCES collection_data(id),
  FOREIGN KEY (collection_id) REFERENCES collections(id)
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_content_versions_data ON content_versions(data_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_collection ON content_versions(collection_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_tenant ON content_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_number ON content_versions(data_id, version_number);
CREATE INDEX IF NOT EXISTS idx_content_versions_current ON content_versions(data_id, is_current);
CREATE INDEX IF NOT EXISTS idx_content_versions_created ON content_versions(created_at);

-- 2. 创建版本比较缓存表
CREATE TABLE IF NOT EXISTS version_comparisons (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  version_id_1 TEXT NOT NULL,
  version_id_2 TEXT NOT NULL,
  diff TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_version_comp_versions ON version_comparisons(version_id_1, version_id_2);
CREATE INDEX IF NOT EXISTS idx_version_comp_tenant ON version_comparisons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_version_comp_expires ON version_comparisons(expires_at);

-- 3. 创建自动版本配置表
CREATE TABLE IF NOT EXISTS auto_version_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  collection_id TEXT,
  enabled INTEGER DEFAULT 1 CHECK(enabled IN (0, 1)),
  auto_save_interval INTEGER DEFAULT 300,
  max_versions INTEGER DEFAULT 50,
  retention_days INTEGER DEFAULT 90,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (collection_id) REFERENCES collections(id)
);

CREATE INDEX IF NOT EXISTS idx_auto_version_tenant ON auto_version_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auto_version_collection ON auto_version_configs(collection_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_version_unique ON auto_version_configs(tenant_id, collection_id);

-- 4. 为现有 collection_data 表添加 version 字段 (如果不存在)
-- 注意：SQLite 不支持直接添加列，需要重建表
-- 这里我们假设 collection_data 表已经存在，只添加版本相关字段

-- 添加 version 字段 (版本号)
-- ALTER TABLE collection_data ADD COLUMN version INTEGER DEFAULT 1;

-- 添加 status 字段 (内容状态)
-- ALTER TABLE collection_data ADD COLUMN status TEXT DEFAULT 'published';

-- 添加 published_at 字段 (发布时间)
-- ALTER TABLE collection_data ADD COLUMN published_at TEXT;

-- 5. 插入默认的自动版本配置 (为所有现有租户)
-- 注意：实际运行时由代码动态创建

-- 迁移完成
-- 版本号：v1.0.0-version-control
