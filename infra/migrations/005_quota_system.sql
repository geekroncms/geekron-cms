-- 租户配额与限流系统迁移
-- Geekron CMS 租户配额管理系统
-- 版本：2.2.0
-- 创建时间：2026-03-12

-- ============================================
-- 租户配额表 (tenant_quotas)
-- ============================================
-- 定义每个租户的配额限制

CREATE TABLE IF NOT EXISTS tenant_quotas (
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

CREATE INDEX IF NOT EXISTS idx_tenant_quotas_tenant ON tenant_quotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_quotas_plan ON tenant_quotas(plan);

-- ============================================
-- 租户使用量表 (tenant_usage)
-- ============================================
-- 记录租户的实际使用量

CREATE TABLE IF NOT EXISTS tenant_usage (
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

CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant ON tenant_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_reset_date ON tenant_usage(reset_date);

-- ============================================
-- 限流计数器表 (rate_limit_counters)
-- ============================================
-- 用于滑动窗口限流的计数器（高性能 KV 存储的 SQL 备份）

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  window_start TEXT NOT NULL,  -- 滑动窗口起始时间
  request_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL  -- 过期时间，用于清理
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_tenant ON rate_limit_counters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_expires ON rate_limit_counters(expires_at);

-- ============================================
-- 触发器：租户创建时自动初始化配额
-- ============================================

CREATE TRIGGER IF NOT EXISTS trg_init_tenant_quota
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

-- ============================================
-- 触发器：租户计划变更时更新配额
-- ============================================

CREATE TRIGGER IF NOT EXISTS trg_update_tenant_quota
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

-- ============================================
-- 触发器：用户数变更时更新使用量
-- ============================================

CREATE TRIGGER IF NOT EXISTS trg_update_user_count
AFTER INSERT OR DELETE ON tenant_members
BEGIN
  -- INSERT: 增加计数
  INSERT OR REPLACE INTO tenant_usage (
    id, tenant_id, users_count, updated_at
  )
  SELECT
    'usage_' || COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    (SELECT COUNT(*) FROM tenant_members WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)),
    datetime('now')
  WHERE COALESCE(NEW.tenant_id, OLD.tenant_id) IS NOT NULL;
END;

-- ============================================
-- 触发器：集合数变更时更新使用量
-- ============================================

CREATE TRIGGER IF NOT EXISTS trg_update_collection_count
AFTER INSERT OR DELETE ON collections
BEGIN
  INSERT OR REPLACE INTO tenant_usage (
    id, tenant_id, collections_count, updated_at
  )
  SELECT
    'usage_' || COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    (SELECT COUNT(*) FROM collections WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)),
    datetime('now')
  WHERE COALESCE(NEW.tenant_id, OLD.tenant_id) IS NOT NULL;
END;

-- ============================================
-- 触发器：API Key 数变更时更新使用量
-- ============================================

CREATE TRIGGER IF NOT EXISTS trg_update_api_key_count
AFTER INSERT OR DELETE ON api_keys
BEGIN
  INSERT OR REPLACE INTO tenant_usage (
    id, tenant_id, api_keys_count, updated_at
  )
  SELECT
    'usage_' || COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    (SELECT COUNT(*) FROM api_keys WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)),
    datetime('now')
  WHERE COALESCE(NEW.tenant_id, OLD.tenant_id) IS NOT NULL;
END;

-- ============================================
-- 视图：租户配额与使用情况
-- ============================================

CREATE VIEW IF NOT EXISTS tenant_quota_usage AS
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

-- ============================================
-- 存储过程：重置每日计数器
-- ============================================
-- 注意：SQLite 不支持存储过程，使用触发器实现

CREATE TRIGGER IF NOT EXISTS trg_reset_daily_counters
BEFORE INSERT ON tenant_usage
WHEN NEW.reset_date != date('now')
BEGIN
  SELECT RAISE(ABORT, 'Daily reset should be handled by application logic');
END;

-- ============================================
-- 示例数据（仅用于开发环境）
-- ============================================
-- 为现有租户初始化配额（如果存在租户但没有配额记录）

INSERT OR IGNORE INTO tenant_quotas (
  id, tenant_id, max_requests_per_minute, max_requests_per_day,
  max_storage_bytes, max_users, max_collections, max_api_keys,
  plan, created_at, updated_at
)
SELECT
  'quota_' || id,
  id,
  CASE plan
    WHEN 'free' THEN 60
    WHEN 'pro' THEN 600
    WHEN 'enterprise' THEN 6000
    ELSE 60
  END,
  CASE plan
    WHEN 'free' THEN 1000
    WHEN 'pro' THEN 100000
    WHEN 'enterprise' THEN 1000000
    ELSE 1000
  END,
  CASE plan
    WHEN 'free' THEN 1073741824
    WHEN 'pro' THEN 10737418240
    WHEN 'enterprise' THEN 107374182400
    ELSE 1073741824
  END,
  CASE plan
    WHEN 'free' THEN 5
    WHEN 'pro' THEN 50
    WHEN 'enterprise' THEN 500
    ELSE 5
  END,
  CASE plan
    WHEN 'free' THEN 10
    WHEN 'pro' THEN 100
    WHEN 'enterprise' THEN 1000
    ELSE 10
  END,
  CASE plan
    WHEN 'free' THEN 5
    WHEN 'pro' THEN 50
    WHEN 'enterprise' THEN 500
    ELSE 5
  END,
  COALESCE(plan, 'free'),
  datetime('now'),
  datetime('now')
FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM tenant_quotas);

INSERT OR IGNORE INTO tenant_usage (
  id, tenant_id, requests_today, requests_this_minute,
  storage_bytes, users_count, collections_count, api_keys_count,
  reset_date, updated_at
)
SELECT
  'usage_' || id,
  id,
  0, 0, 0,
  (SELECT COUNT(*) FROM tenant_members WHERE tenant_id = tenants.id),
  (SELECT COUNT(*) FROM collections WHERE tenant_id = tenants.id),
  (SELECT COUNT(*) FROM api_keys WHERE tenant_id = tenants.id),
  date('now'),
  datetime('now')
FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM tenant_usage);

-- ============================================
-- 注释
-- ============================================
-- SQLite 不支持 COMMENT 语法，使用文档说明

-- tenant_quotas 表说明:
-- - 定义每个租户的配额限制
-- - plan 变更时自动更新配额
-- - 支持 free/pro/enterprise 三种套餐

-- tenant_usage 表说明:
-- - 记录租户的实际使用量
-- - requests_today 每日重置
-- - requests_this_minute 每分钟重置（滑动窗口）

-- rate_limit_counters 表说明:
-- - 用于滑动窗口限流
-- - 支持高性能 KV 存储（Cloudflare KV）
-- - SQL 表作为备份和查询使用

-- ============================================
-- 迁移完成
-- ============================================
