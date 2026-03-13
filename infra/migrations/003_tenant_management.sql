-- 租户管理系统迁移
-- Geekron CMS 多租户核心架构
-- 版本：2.0.0
-- 创建时间：2026-03-12

-- ============================================
-- 租户表增强 (tenants)
-- ============================================
-- 注意：如果 tenants 表已存在，此迁移会添加新字段

-- 创建 tenants 表（如果不存在）
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    settings TEXT DEFAULT '{}',
    quota_api_calls INTEGER DEFAULT 1000,
    quota_storage_mb INTEGER DEFAULT 100,
    quota_users INTEGER DEFAULT 5,
    usage_api_calls INTEGER DEFAULT 0,
    usage_storage_mb INTEGER DEFAULT 0,
    usage_users INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 租户索引
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_created ON tenants(created_at);

-- ============================================
-- 租户成员表 (tenant_members)
-- ============================================
-- 用户与租户的关联关系（支持多租户成员）

CREATE TABLE IF NOT EXISTS tenant_members (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id)
);

-- 租户成员索引
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_role ON tenant_members(role);

-- ============================================
-- 触发器：自动更新 tenants 表的 updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS trg_tenants_updated_at
    AFTER UPDATE ON tenants
    FOR EACH ROW
BEGIN
    UPDATE tenants SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 视图：租户统计信息
-- ============================================
CREATE VIEW IF NOT EXISTS tenant_stats AS
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

-- ============================================
-- 注释
-- ============================================
COMMENT ON TABLE tenants IS '租户信息表 - 多租户 SaaS 核心';
COMMENT ON TABLE tenant_members IS '租户成员关联表 - 支持用户加入多个租户';
COMMENT ON COLUMN tenants.subdomain IS '租户子域名，用于租户隔离';
COMMENT ON COLUMN tenants.settings IS '租户配置 JSON，包含主题、功能开关等';
COMMENT ON COLUMN tenants.plan IS '租户套餐：free, pro, enterprise';
COMMENT ON COLUMN tenants.status IS '租户状态：active, suspended, deleted';
COMMENT ON COLUMN tenants.quota_api_calls IS 'API 调用配额（每月）';
COMMENT ON COLUMN tenants.quota_storage_mb IS '存储空间配额（MB）';
COMMENT ON COLUMN tenants.quota_users IS '用户数量配额';
COMMENT ON COLUMN tenants.usage_api_calls IS '已用 API 调用次数';
COMMENT ON COLUMN tenants.usage_storage_mb IS '已用存储空间（MB）';
COMMENT ON COLUMN tenants.usage_users IS '已用用户数量';
COMMENT ON COLUMN tenant_members.role IS '成员角色：owner, admin, editor, viewer';
