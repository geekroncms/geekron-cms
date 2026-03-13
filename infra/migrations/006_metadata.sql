-- 元数据管理系统迁移
-- Geekron CMS 数据模型引擎 - 阶段三
-- 版本：3.0.0
-- 创建时间：2026-03-12

-- ============================================
-- 元数据表 (metadata_schemas)
-- ============================================
-- 定义元数据 Schema 的完整结构

CREATE TABLE IF NOT EXISTS metadata_schemas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  schema_json TEXT NOT NULL,  -- 完整 Schema 定义（JSON Schema 格式）
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'deprecated')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metadata_schemas_tenant ON metadata_schemas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metadata_schemas_status ON metadata_schemas(status);
CREATE INDEX IF NOT EXISTS idx_metadata_schemas_name ON metadata_schemas(name);

-- ============================================
-- 元数据字段表 (metadata_fields)
-- ============================================
-- 定义 Schema 中的字段详情

CREATE TABLE IF NOT EXISTS metadata_fields (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'json', 'relation', 'email', 'url', 'phone')),
  field_config TEXT,  -- JSON 配置（长度限制、正则、选项等）
  is_required INTEGER DEFAULT 0 CHECK (is_required IN (0, 1)),
  is_unique INTEGER DEFAULT 0 CHECK (is_unique IN (0, 1)),
  default_value TEXT,
  display_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (schema_id) REFERENCES metadata_schemas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metadata_fields_schema ON metadata_fields(schema_id);
CREATE INDEX IF NOT EXISTS idx_metadata_fields_name ON metadata_fields(field_name);

-- ============================================
-- 元数据版本历史表 (metadata_schema_versions)
-- ============================================
-- 记录 Schema 的版本变更历史

CREATE TABLE IF NOT EXISTS metadata_schema_versions (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  change_summary TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (schema_id) REFERENCES metadata_schemas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metadata_versions_schema ON metadata_schema_versions(schema_id);
CREATE INDEX IF NOT EXISTS idx_metadata_versions_version ON metadata_schema_versions(version);

-- ============================================
-- 触发器：更新 metadata_schemas 的 updated_at
-- ============================================

CREATE TRIGGER IF NOT EXISTS trg_update_metadata_schemas_timestamp
AFTER UPDATE ON metadata_schemas
BEGIN
  UPDATE metadata_schemas SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================
-- 触发器：更新 metadata_fields 的 updated_at
-- ============================================

CREATE TRIGGER IF NOT EXISTS trg_update_metadata_fields_timestamp
AFTER UPDATE ON metadata_fields
BEGIN
  UPDATE metadata_fields SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================
-- 触发器：Schema 状态变更时记录版本历史
-- ============================================

CREATE TRIGGER IF NOT EXISTS trg_metadata_schema_versioning
AFTER UPDATE OF schema_json ON metadata_schemas
WHEN OLD.schema_json != NEW.schema_json
BEGIN
  INSERT INTO metadata_schema_versions (
    id, schema_id, version, schema_json, change_summary, created_by, created_at
  )
  VALUES (
    'ver_' || NEW.id || '_' || (SELECT COUNT(*) FROM metadata_schema_versions WHERE schema_id = NEW.id),
    NEW.id,
    NEW.version,
    OLD.schema_json,
    'Version update from ' || OLD.version || ' to ' || NEW.version,
    NEW.created_by,
    datetime('now')
  );
END;

-- ============================================
-- 视图：Schema 与字段统计
-- ============================================

CREATE VIEW IF NOT EXISTS metadata_schema_stats AS
SELECT
  ms.id as schema_id,
  ms.tenant_id,
  ms.name,
  ms.version,
  ms.status,
  ms.created_by,
  ms.created_at,
  ms.updated_at,
  COUNT(mf.id) as field_count,
  SUM(CASE WHEN mf.is_required = 1 THEN 1 ELSE 0 END) as required_field_count,
  SUM(CASE WHEN mf.is_unique = 1 THEN 1 ELSE 0 END) as unique_field_count
FROM metadata_schemas ms
LEFT JOIN metadata_fields mf ON ms.id = mf.schema_id
GROUP BY ms.id, ms.tenant_id, ms.name, ms.version, ms.status, ms.created_by, ms.created_at, ms.updated_at;

-- ============================================
-- 视图：Schema 字段详情
-- ============================================

CREATE VIEW IF NOT EXISTS metadata_field_details AS
SELECT
  ms.id as schema_id,
  ms.name as schema_name,
  ms.tenant_id,
  mf.id as field_id,
  mf.field_name,
  mf.field_type,
  mf.field_config,
  mf.is_required,
  mf.is_unique,
  mf.default_value,
  mf.display_order,
  mf.description,
  mf.created_at as field_created_at
FROM metadata_schemas ms
INNER JOIN metadata_fields mf ON ms.id = mf.schema_id
WHERE ms.status = 'active';

-- ============================================
-- 唯一性约束：同一租户下 Schema 名称唯一
-- ============================================
-- SQLite 不支持添加唯一索引到现有表，使用唯一索引

CREATE UNIQUE INDEX IF NOT EXISTS idx_metadata_schemas_tenant_name 
ON metadata_schemas(tenant_id, name);

-- ============================================
-- 唯一性约束：同一 Schema 下字段名称唯一
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_metadata_fields_schema_name 
ON metadata_fields(schema_id, field_name);

-- ============================================
-- 示例数据（仅用于开发环境）
-- ============================================
-- 创建一个示例 Schema：文章（Article）

-- INSERT INTO metadata_schemas (
--   id, tenant_id, name, version, schema_json, status, created_by, created_at
-- )
-- VALUES (
--   'schema_article_001',
--   'tenant_demo_001',
--   'Article',
--   '1.0.0',
--   '{
--     "type": "object",
--     "properties": {
--       "title": {"type": "string"},
--       "content": {"type": "string"},
--       "author": {"type": "string"},
--       "publishedAt": {"type": "date"},
--       "tags": {"type": "array"}
--     }
--   }',
--   'active',
--   'system',
--   datetime('now')
-- );

-- INSERT INTO metadata_fields (
--   id, schema_id, field_name, field_type, field_config, is_required, is_unique, display_order, description
-- )
-- VALUES
-- ('field_001', 'schema_article_001', 'title', 'text', '{"maxLength": 200}', 1, 0, 1, '文章标题'),
-- ('field_002', 'schema_article_001', 'content', 'text', '{"minLength": 1}', 1, 0, 2, '文章内容'),
-- ('field_003', 'schema_article_001', 'author', 'text', '{"maxLength": 100}', 0, 0, 3, '作者'),
-- ('field_004', 'schema_article_001', 'publishedAt', 'date', '{}', 0, 0, 4, '发布时间'),
-- ('field_005', 'schema_article_001', 'tags', 'json', '{"itemType": "string"}', 0, 0, 5, '标签');

-- ============================================
-- 注释说明
-- ============================================
-- metadata_schemas: 存储元数据 Schema 定义
--   - schema_json: 完整的 JSON Schema 定义，用于验证
--   - status: active(使用中), draft(草稿), deprecated(已废弃)
--   - version: 语义化版本号 (e.g., 1.0.0)

-- metadata_fields: 存储 Schema 的字段定义
--   - field_type: text/number/boolean/date/json/relation/email/url/phone
--   - field_config: JSON 配置，如 {"maxLength": 100, "pattern": "^\\d+$"}
--   - is_required: 是否必填
--   - is_unique: 是否唯一
--   - display_order: 显示顺序

-- metadata_schema_versions: 版本历史记录
--   - 每次 schema_json 变更时自动记录
--   - 支持版本回滚和对比

-- ============================================
-- 迁移完成
-- ============================================
