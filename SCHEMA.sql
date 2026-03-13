CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'deleted')),
  plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'enterprise')),
  settings TEXT, -- JSON 字符串
  owner_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member', 'viewer')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  avatar_url TEXT,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, email)
);
CREATE TABLE models (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  fields TEXT, -- JSON 字符串
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, slug)
);
CREATE TABLE contents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT,
  data TEXT, -- JSON 字符串
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  published_at DATETIME,
  created_by TEXT,
  updated_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  size INTEGER,
  mime_type TEXT,
  storage_type TEXT DEFAULT 'r2' CHECK(storage_type IN ('r2', 'oss', 'local')),
  storage_key TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT, -- JSON 字符串
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_models_tenant ON models(tenant_id);
CREATE INDEX idx_contents_tenant ON contents(tenant_id);
CREATE INDEX idx_contents_model ON contents(model_id);
CREATE INDEX idx_contents_status ON contents(status);
CREATE INDEX idx_files_tenant ON files(tenant_id);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_tenants_plan ON tenants(plan);
CREATE INDEX idx_tenants_created ON tenants(created_at);
CREATE TABLE tenant_members (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, permissions TEXT DEFAULT '[]', invited_by TEXT REFERENCES users(id), status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    UNIQUE(tenant_id, user_id)
);
CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_role ON tenant_members(role);
CREATE TRIGGER trg_tenants_updated_at
    AFTER UPDATE ON tenants
    FOR EACH ROW
BEGIN
    UPDATE tenants SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE VIEW tenant_stats AS
SELECT 
    t.id,
    t.name,
    t.subdomain,
    t.plan,
    t.status,
    COUNT(DISTINCT tm.user_id) as member_count,
    COUNT(DISTINCT u.id) as user_count,
    COUNT(DISTINCT c.id) as collection_count,
    COUNT(DISTINCT f.id) as file_count,
    t.usage_api_calls,
    t.usage_storage_mb,
    t.quota_api_calls,
    t.quota_storage_mb,
    t.created_at
FROM tenants t
LEFT JOIN tenant_members tm ON t.id = tm.tenant_id
LEFT JOIN users u ON t.id = u.tenant_id
LEFT JOIN collections c ON t.id = c.tenant_id
LEFT JOIN files f ON t.id = f.tenant_id
GROUP BY t.id;
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE VIEW user_tenants AS
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    tm.tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.plan as tenant_plan,
    tm.role,
    tm.permissions,
    tm.status as membership_status,
    tm.joined_at
FROM users u
INNER JOIN tenant_members tm ON u.id = tm.user_id
INNER JOIN tenants t ON tm.tenant_id = t.id
WHERE t.status = 'active' AND tm.status = 'active';
CREATE VIEW tenant_member_details AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    u.id as user_id,
    u.email,
    u.name as user_name,
    tm.role,
    tm.permissions,
    tm.status as membership_status,
    tm.joined_at,
    inv.email as invited_by_email
FROM tenants t
INNER JOIN tenant_members tm ON t.id = tm.tenant_id
INNER JOIN users u ON tm.user_id = u.id
LEFT JOIN users inv ON tm.invited_by = inv.id
WHERE t.status = 'active';
CREATE TRIGGER trg_audit_user_login
    AFTER INSERT ON audit_logs
    WHEN NEW.action = 'user.login'
BEGIN
    -- 可以在这里添加额外的逻辑，如更新最后登录时间
    SELECT 1; -- SQLite 需要虚操作
END;
CREATE TABLE tenant_quotas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  max_requests_per_minute INTEGER DEFAULT 100,
  max_requests_per_day INTEGER DEFAULT 10000,
  max_storage_bytes INTEGER DEFAULT 10737418240,  -- 10GB
  max_users INTEGER DEFAULT 10,
  max_collections INTEGER DEFAULT 50,
  max_api_keys INTEGER DEFAULT 20,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_tenant_quotas_tenant ON tenant_quotas(tenant_id);
CREATE INDEX idx_tenant_quotas_plan ON tenant_quotas(plan);
CREATE TABLE tenant_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  requests_today INTEGER DEFAULT 0,
  requests_this_minute INTEGER DEFAULT 0,
  storage_bytes INTEGER DEFAULT 0,
  users_count INTEGER DEFAULT 0,
  collections_count INTEGER DEFAULT 0,
  api_keys_count INTEGER DEFAULT 0,
  last_request_at TEXT,
  reset_date TEXT,  -- 每日重置日期
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_tenant_usage_tenant ON tenant_usage(tenant_id);
CREATE INDEX idx_tenant_usage_reset_date ON tenant_usage(reset_date);
CREATE TABLE rate_limit_counters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  window_start TEXT NOT NULL,  -- 滑动窗口起始时间
  request_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL  -- 过期时间，用于清理
);
CREATE INDEX idx_rate_limit_tenant ON rate_limit_counters(tenant_id);
CREATE INDEX idx_rate_limit_expires ON rate_limit_counters(expires_at);
CREATE TRIGGER trg_init_tenant_quota
AFTER INSERT ON tenants
BEGIN
  -- 插入默认配额（根据 plan）
  INSERT INTO tenant_quotas (
    id, tenant_id, max_requests_per_minute, max_requests_per_day,
    max_storage_bytes, max_users, max_collections, max_api_keys,
    plan, created_at, updated_at
  )
  VALUES (
    'quota_' || NEW.id,
    NEW.id,
    CASE NEW.plan
      WHEN 'free' THEN 60
      WHEN 'pro' THEN 600
      WHEN 'enterprise' THEN 6000
      ELSE 60
    END,
    CASE NEW.plan
      WHEN 'free' THEN 1000
      WHEN 'pro' THEN 100000
      WHEN 'enterprise' THEN 1000000
      ELSE 1000
    END,
    CASE NEW.plan
      WHEN 'free' THEN 1073741824  -- 1GB
      WHEN 'pro' THEN 10737418240  -- 10GB
      WHEN 'enterprise' THEN 107374182400  -- 100GB
      ELSE 1073741824
    END,
    CASE NEW.plan
      WHEN 'free' THEN 5
      WHEN 'pro' THEN 50
      WHEN 'enterprise' THEN 500
      ELSE 5
    END,
    CASE NEW.plan
      WHEN 'free' THEN 10
      WHEN 'pro' THEN 100
      WHEN 'enterprise' THEN 1000
      ELSE 10
    END,
    CASE NEW.plan
      WHEN 'free' THEN 5
      WHEN 'pro' THEN 50
      WHEN 'enterprise' THEN 500
      ELSE 5
    END,
    COALESCE(NEW.plan, 'free'),
    datetime('now'),
    datetime('now')
  );

  -- 插入初始使用量记录
  INSERT INTO tenant_usage (
    id, tenant_id, requests_today, requests_this_minute,
    storage_bytes, users_count, collections_count, api_keys_count,
    reset_date, updated_at
  )
  VALUES (
    'usage_' || NEW.id,
    NEW.id,
    0, 0, 0, 0, 0, 0,
    date('now'),
    datetime('now')
  );
END;
CREATE TRIGGER trg_update_tenant_quota
AFTER UPDATE OF plan ON tenants
WHEN OLD.plan != NEW.plan
BEGIN
  UPDATE tenant_quotas
  SET
    max_requests_per_minute = CASE NEW.plan
      WHEN 'free' THEN 60
      WHEN 'pro' THEN 600
      WHEN 'enterprise' THEN 6000
      ELSE 60
    END,
    max_requests_per_day = CASE NEW.plan
      WHEN 'free' THEN 1000
      WHEN 'pro' THEN 100000
      WHEN 'enterprise' THEN 1000000
      ELSE 1000
    END,
    max_storage_bytes = CASE NEW.plan
      WHEN 'free' THEN 1073741824
      WHEN 'pro' THEN 10737418240
      WHEN 'enterprise' THEN 107374182400
      ELSE 1073741824
    END,
    max_users = CASE NEW.plan
      WHEN 'free' THEN 5
      WHEN 'pro' THEN 50
      WHEN 'enterprise' THEN 500
      ELSE 5
    END,
    max_collections = CASE NEW.plan
      WHEN 'free' THEN 10
      WHEN 'pro' THEN 100
      WHEN 'enterprise' THEN 1000
      ELSE 10
    END,
    max_api_keys = CASE NEW.plan
      WHEN 'free' THEN 5
      WHEN 'pro' THEN 50
      WHEN 'enterprise' THEN 500
      ELSE 5
    END,
    plan = NEW.plan,
    updated_at = datetime('now')
  WHERE tenant_id = NEW.id;
END;
CREATE VIEW tenant_quota_usage AS
SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  tq.plan,
  tq.max_requests_per_minute,
  tq.max_requests_per_day,
  tq.max_storage_bytes,
  tq.max_users,
  tq.max_collections,
  tq.max_api_keys,
  tu.requests_today,
  tu.requests_this_minute,
  tu.storage_bytes,
  tu.users_count,
  tu.collections_count,
  tu.api_keys_count,
  tu.last_request_at,
  tu.reset_date,
  -- 使用率计算
  ROUND(CAST(tu.requests_today AS FLOAT) / tq.max_requests_per_day * 100, 2) as requests_today_usage_percent,
  ROUND(CAST(tu.requests_this_minute AS FLOAT) / tq.max_requests_per_minute * 100, 2) as requests_minute_usage_percent,
  ROUND(CAST(tu.storage_bytes AS FLOAT) / tq.max_storage_bytes * 100, 2) as storage_usage_percent,
  ROUND(CAST(tu.users_count AS FLOAT) / tq.max_users * 100, 2) as users_usage_percent,
  ROUND(CAST(tu.collections_count AS FLOAT) / tq.max_collections * 100, 2) as collections_usage_percent,
  ROUND(CAST(tu.api_keys_count AS FLOAT) / tq.max_api_keys * 100, 2) as api_keys_usage_percent
FROM tenants t
INNER JOIN tenant_quotas tq ON t.id = tq.tenant_id
INNER JOIN tenant_usage tu ON t.id = tu.tenant_id
WHERE t.status = 'active';
CREATE TRIGGER trg_reset_daily_counters
BEFORE INSERT ON tenant_usage
WHEN NEW.reset_date != date('now')
BEGIN
  SELECT RAISE(ABORT, 'Daily reset should be handled by application logic');
END;
CREATE TABLE metadata_schemas (
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
CREATE INDEX idx_metadata_schemas_tenant ON metadata_schemas(tenant_id);
CREATE INDEX idx_metadata_schemas_status ON metadata_schemas(status);
CREATE INDEX idx_metadata_schemas_name ON metadata_schemas(name);
CREATE TABLE metadata_fields (
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
CREATE INDEX idx_metadata_fields_schema ON metadata_fields(schema_id);
CREATE INDEX idx_metadata_fields_name ON metadata_fields(field_name);
CREATE TABLE metadata_schema_versions (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  change_summary TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (schema_id) REFERENCES metadata_schemas(id) ON DELETE CASCADE
);
CREATE INDEX idx_metadata_versions_schema ON metadata_schema_versions(schema_id);
CREATE INDEX idx_metadata_versions_version ON metadata_schema_versions(version);
CREATE TRIGGER trg_update_metadata_schemas_timestamp
AFTER UPDATE ON metadata_schemas
BEGIN
  UPDATE metadata_schemas SET updated_at = datetime('now') WHERE id = NEW.id;
END;
CREATE TRIGGER trg_update_metadata_fields_timestamp
AFTER UPDATE ON metadata_fields
BEGIN
  UPDATE metadata_fields SET updated_at = datetime('now') WHERE id = NEW.id;
END;
CREATE TRIGGER trg_metadata_schema_versioning
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
CREATE VIEW metadata_schema_stats AS
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
GROUP BY ms.id, ms.tenant_id, ms.name, ms.version, ms.status, ms.created_by, ms.created_at, ms.updated_at
/* metadata_schema_stats(schema_id,tenant_id,name,version,status,created_by,created_at,updated_at,field_count,required_field_count,unique_field_count) */;
CREATE VIEW metadata_field_details AS
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
WHERE ms.status = 'active'
/* metadata_field_details(schema_id,schema_name,tenant_id,field_id,field_name,field_type,field_config,is_required,is_unique,default_value,display_order,description,field_created_at) */;
CREATE UNIQUE INDEX idx_metadata_schemas_tenant_name 
ON metadata_schemas(tenant_id, name);
CREATE UNIQUE INDEX idx_metadata_fields_schema_name 
ON metadata_fields(schema_id, field_name);
