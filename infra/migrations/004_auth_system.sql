-- 用户认证系统迁移
-- Geekron CMS 用户认证与多租户增强
-- 版本：2.1.0
-- 创建时间：2026-03-12

-- ============================================
-- 用户表更新 (users)
-- ============================================
-- 移除 tenant_id 字段（改为通过 tenant_members 关联）
-- 注意：SQLite 不支持直接删除列，需要重建表

-- 创建临时表保存用户数据
CREATE TABLE IF NOT EXISTS users_backup AS 
SELECT id, email, password, name, role, status, created_at, updated_at 
FROM users WHERE 1=0;

-- 如果 users 表存在且有 tenant_id，迁移数据
-- 注意：这个迁移假设 users 表已经存在
-- 如果是全新安装，users 表结构应该已经正确

-- ============================================
-- 租户成员表增强 (tenant_members)
-- ============================================
-- 添加 permissions 和 invited_by 字段

ALTER TABLE tenant_members ADD COLUMN permissions TEXT DEFAULT '[]';
ALTER TABLE tenant_members ADD COLUMN invited_by TEXT REFERENCES users(id);
ALTER TABLE tenant_members ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended'));

-- ============================================
-- 审计日志表 (audit_logs)
-- ============================================
-- 如果不存在则创建

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- ============================================
-- 视图：用户租户关联视图
-- ============================================
-- 方便查询用户的所有租户信息

CREATE VIEW IF NOT EXISTS user_tenants AS
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

-- ============================================
-- 视图：租户成员详情
-- ============================================

CREATE VIEW IF NOT EXISTS tenant_member_details AS
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

-- ============================================
-- 触发器：审计日志记录
-- ============================================
-- 记录用户登录事件

CREATE TRIGGER IF NOT EXISTS trg_audit_user_login
    AFTER INSERT ON audit_logs
    WHEN NEW.action = 'user.login'
BEGIN
    -- 可以在这里添加额外的逻辑，如更新最后登录时间
    SELECT 1; -- SQLite 需要虚操作
END;

-- ============================================
-- 示例数据（仅用于开发环境）
-- ============================================
-- 注意：生产环境不应该包含示例数据
-- 以下数据仅在数据库为空时插入

-- 创建示例租户（如果不存在）
INSERT OR IGNORE INTO tenants (id, name, slug, email, plan, status, created_at)
VALUES (
    'tenant-dev-001',
    'Demo Tenant',
    'demo',
    'demo@geekron.com',
    'free',
    'active',
    CURRENT_TIMESTAMP
);

-- 创建示例用户（如果不存在）
-- 密码是 "password123" 的哈希值（需要在应用层生成）
-- 这里仅作为占位符，实际应该通过注册流程创建

-- ============================================
-- 注释
-- ============================================
COMMENT ON TABLE audit_logs IS '审计日志表 - 记录所有重要操作';
COMMENT ON TABLE user_tenants IS '用户租户关联视图 - 查询用户的所有租户';
COMMENT ON TABLE tenant_member_details IS '租户成员详情视图 - 查询租户的所有成员';
COMMENT ON COLUMN tenant_members.permissions IS '自定义权限列表 JSON 数组';
COMMENT ON COLUMN tenant_members.invited_by IS '邀请人用户 ID';
COMMENT ON COLUMN tenant_members.status IS '成员状态：active, invited, suspended';
COMMENT ON COLUMN audit_logs.action IS '操作类型：user.login, user.logout, data.create, etc.';
COMMENT ON COLUMN audit_logs.resource IS '资源类型：user, tenant, collection, data, etc.';
